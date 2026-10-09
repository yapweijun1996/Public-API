import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, optionalTrimmedText, positiveSafeInteger, trimmedText } from './semanticValidation'

type Request = { query: string; limit: number }
type Article = {
  pageId: number
  index: number
  title: string
  extract?: string
  thumbnail?: { source: string; width?: number; height?: number }
  articleUrl: string
}
type Result = { articles: Article[]; providerCount: number; malformed: number; duplicates: number; overflow: number }

const FIXED: Record<string, string> = {
  action: 'query', generator: 'search', prop: 'pageimages|extracts', exintro: '1', explaintext: '1',
  piprop: 'thumbnail', pithumbsize: '480', format: 'json', origin: '*',
}
const KEYS = [...Object.keys(FIXED), 'gsrsearch', 'gsrlimit']

export const parseWikipediaSearchRequest = (requestUrl?: string): Request | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'en.wikipedia.org' || url.port || url.username || url.password || url.hash || url.pathname !== '/w/api.php') return undefined
    if (keys.length !== KEYS.length || !KEYS.every((key) => keys.includes(key))) return undefined
    if (KEYS.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    if (Object.entries(FIXED).some(([key, value]) => url.searchParams.get(key) !== value)) return undefined
    const rawQuery = url.searchParams.get('gsrsearch') ?? ''
    const query = rawQuery.trim()
    const rawLimit = url.searchParams.get('gsrlimit') ?? ''
    if (!query || rawQuery !== query || !/^[1-9]\d*$/.test(rawLimit)) return undefined
    const limit = Number(rawLimit)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 12 || String(limit) !== rawLimit) return undefined
    return { query, limit }
  } catch {
    return undefined
  }
}

type RequestIdentity = { request?: Request; requestBound: boolean; invalidReason?: string }

const wikipediaRequestIdentity = (requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestIdentity => {
  const request = parseWikipediaSearchRequest(requestUrl)
  if (!request) return { requestBound: false, invalidReason: 'The successful response was not tied to the exact supported English Wikipedia search request.' }
  if (!executedRequest) return { request, requestBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl || !parseWikipediaSearchRequest(executedRequest.url)) {
    return { request, requestBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET English Wikipedia search request.' }
  }
  return { request, requestBound: true }
}

const httpsUrl = (value: unknown): { value?: string; malformed: boolean } => {
  const parsed = optionalTrimmedText(value)
  if (parsed.malformed) return { malformed: true }
  if (!parsed.value) return { malformed: false }
  try {
    const url = new URL(parsed.value)
    return url.protocol === 'https:' ? { value: url.toString(), malformed: false } : { malformed: true }
  } catch {
    return { malformed: true }
  }
}

const parseThumbnail = (value: unknown): { value?: Article['thumbnail']; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  if (!isRecord(value)) return { malformed: true }
  const source = httpsUrl(value.source)
  const width = value.width === undefined || value.width === null ? undefined : positiveSafeInteger(value.width)
  const height = value.height === undefined || value.height === null ? undefined : positiveSafeInteger(value.height)
  const malformed = !source.value || source.malformed
    || (value.width !== undefined && value.width !== null && width === undefined)
    || (value.height !== undefined && value.height !== null && height === undefined)
  return source.value && !malformed
    ? { value: { source: source.value, width, height }, malformed: false }
    : { malformed }
}

const articleUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`

const parseArticle = (value: unknown): { article?: Article; malformed: boolean } => {
  if (!isRecord(value)) return { malformed: true }
  const pageId = positiveSafeInteger(value.pageid)
  const index = positiveSafeInteger(value.index)
  const title = trimmedText(value.title)
  if (!pageId || value.ns !== 0 || !index || !title) return { malformed: true }

  const extract = optionalTrimmedText(value.extract)
  const thumbnail = parseThumbnail(value.thumbnail)
  return {
    article: { pageId, index, title, extract: extract.value, thumbnail: thumbnail.value, articleUrl: articleUrl(title) },
    malformed: extract.malformed || thumbnail.malformed,
  }
}

export const parseWikipediaSearchResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: Request; requestBound: boolean; result?: Result; invalidReason?: string } => {
  const identity = wikipediaRequestIdentity(requestUrl, executedRequest)
  const { request, requestBound } = identity
  if (!request || identity.invalidReason) return identity
  if (!isRecord(data)) return { request, requestBound, invalidReason: 'Wikipedia did not return the documented Action API response object.' }
  if (!Object.prototype.hasOwnProperty.call(data, 'query')) {
    if (data.batchcomplete === '') return { request, requestBound, result: { articles: [], providerCount: 0, malformed: 0, duplicates: 0, overflow: 0 } }
    return { request, requestBound, invalidReason: 'Wikipedia returned neither a query result nor the completed empty-search envelope.' }
  }
  if (!isRecord(data.query) || !isRecord(data.query.pages)) return { request, requestBound, invalidReason: 'Wikipedia did not return the documented query.pages object.' }

  const rawPages = Object.values(data.query.pages)
  const parsed = rawPages.map(parseArticle)
  const candidates = parsed.flatMap((entry) => entry.article ? [entry.article] : []).sort((a, b) => a.index - b.index)
  const seen = new Set<number>()
  const articles: Article[] = []
  let duplicates = 0
  let overflow = 0
  for (const article of candidates) {
    if (seen.has(article.pageId)) { duplicates += 1; continue }
    seen.add(article.pageId)
    if (articles.length >= request.limit) { overflow += 1; continue }
    articles.push(article)
  }
  return { request, requestBound, result: {
    articles, providerCount: rawPages.length,
    malformed: parsed.filter((entry) => entry.malformed).length, duplicates, overflow,
  } }
}

const attrs = (request?: Request, result?: Result, requestBound = false) => ({
  'data-domain-card': 'wikipedia-search',
  'data-request-bound': requestBound ? 'true' : 'false',
  'data-request-contract': 'exact-wikipedia-generator-search-v1',
  'data-request-query': request?.query,
  'data-request-limit': request?.limit,
  'data-provider-record-count': result?.providerCount,
  'data-valid-record-count': result?.articles.length,
  'data-malformed-record-count': result?.malformed,
  'data-duplicate-record-count': result?.duplicates,
  'data-overflow-record-count': result?.overflow,
  'data-primary-page-id': result?.articles[0]?.pageId,
  'data-primary-index': result?.articles[0]?.index,
})

export function WikipediaSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseWikipediaSearchResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request, undefined, parsed.requestBound)} data-result-state="invalid"><h3>Invalid Wikipedia search response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result, requestBound } = parsed
  if (!result.providerCount) {
    const state = requestBound ? 'empty' : 'partial'
    return <div className="domain-card domain-empty" {...attrs(request, result, requestBound)} data-result-state={state}><h3>{requestBound ? 'No Wikipedia articles matched' : 'Unbound Wikipedia empty response'}</h3><p>{requestBound ? `English Wikipedia returned a completed, exact-request-bound zero-result search for “${request.query}”.` : 'Wikipedia returned a structurally coherent zero-result envelope, but executed transport identity is unavailable, so semantic emptiness is not trusted.'}</p></div>
  }
  if (!result.articles.length) return <div className="domain-card domain-empty" {...attrs(request, result, requestBound)} data-result-state="invalid"><h3>Invalid Wikipedia article identities</h3><p>Records were returned, but none carried trustworthy page identity, namespace, search-index, and title evidence.</p></div>
  const partial = !requestBound || result.malformed > 0 || result.duplicates > 0 || result.overflow > 0
  return <div className="domain-card wikipedia-search-preview bounded-media-preview" {...attrs(request, result, requestBound)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">English Wikipedia · Encyclopedia</small><h3>{request.query}</h3><p>{requestBound ? 'Exact-request-bound article identities with optional extracts and thumbnails shown only when their evidence is valid.' : 'Validated article identities from the displayed canonical request; executed transport identity is unavailable, so the result is not marked ready.'}</p></div><span className="domain-state">{result.articles.length} trusted articles</span></header>
    {partial && <p className="domain-note">Only records with valid Wikipedia page identity are shown. Malformed or duplicate evidence is withheld; missing optional extracts or thumbnails remain unavailable.</p>}
    <dl className="domain-facts"><div><dt>Returned</dt><dd>{result.providerCount}</dd></div><div><dt>Trusted articles</dt><dd>{result.articles.length}</dd></div><div><dt>Primary page ID</dt><dd>{result.articles[0].pageId}</dd></div><div><dt>Primary search index</dt><dd>{result.articles[0].index}</dd></div></dl>
    <div className={`media-preview ${result.articles.length === 1 ? 'single' : ''}`}>{result.articles.map((article) => <article key={article.pageId} data-page-id={article.pageId} data-search-index={article.index}><>{article.thumbnail ? <img src={article.thumbnail.source} alt={`${article.title} thumbnail`} loading="lazy"/> : <p className="domain-note">Thumbnail unavailable</p>}</><div><small>English Wikipedia</small><h3>{article.title}</h3><p>{article.extract ?? 'Article extract unavailable'}</p><p><a href={article.articleUrl} target="_blank" rel="noreferrer">Read article</a></p></div></article>)}</div>
    <p className="domain-note">Wikipedia article text is available under CC BY-SA terms. Image licensing varies by file; check the thumbnail source file before reuse.</p>
  </div>
}
