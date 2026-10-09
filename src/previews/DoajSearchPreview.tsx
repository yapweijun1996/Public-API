import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

type DoajRequest = { query: string; pageSize: number; transportBound: boolean }
type DoajRequestUrl = Omit<DoajRequest, 'transportBound'>

type DoajArticle = {
  id: string
  title: string
  authors: string[]
  journal?: string
  publisher?: string
  year?: string
  doi?: string
}

type DoajResult = {
  articles: DoajArticle[]
  total: number
  page: number
  providerPageSize: number
  providerRecordCount: number
  malformedRecordCount: number
  duplicateRecordCount: number
  overflowRecordCount: number
  countContract: boolean
}

const requestPrefix = '/api/search/articles/'

const parseRequestUrl = (requestUrl?: string): DoajRequestUrl | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'doaj.org' || url.port || url.username || url.password || url.hash
      || !url.pathname.startsWith(requestPrefix) || keys.length !== 1 || keys[0] !== 'pageSize'
      || url.searchParams.getAll('pageSize').length !== 1) return undefined
    const encodedQuery = url.pathname.slice(requestPrefix.length)
    if (!encodedQuery || encodedQuery.includes('/')) return undefined
    const query = decodeURIComponent(encodedQuery).trim()
    if (!query || `${requestPrefix}${encodeURIComponent(query)}` !== url.pathname) return undefined
    const rawPageSize = url.searchParams.get('pageSize') ?? ''
    if (!/^[1-9]\d*$/.test(rawPageSize)) return undefined
    const pageSize = Number(rawPageSize)
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 10) return undefined
    return { query, pageSize }
  } catch {
    return undefined
  }
}

const parseRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): DoajRequest | null | undefined => {
  const displayedRequest = parseRequestUrl(requestUrl)
  if (requestUrl && !displayedRequest) return null
  if (!executedRequest) return displayedRequest ? { ...displayedRequest, transportBound: false } : undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return null
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return null
  const executed = parseRequestUrl(executedRequest.url)
  return executed ? { ...executed, transportBound: true } : null
}

const readAuthors = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const name = trimmedText(entry.name)
    return name ? [name] : []
  })
}

const readDoi = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return undefined
  for (const entry of value) {
    if (!isRecord(entry) || trimmedText(entry.type)?.toLowerCase() !== 'doi') continue
    const doi = trimmedText(entry.id)
    if (doi) return doi
  }
  return undefined
}

const parseArticle = (value: unknown): DoajArticle | undefined => {
  if (!isRecord(value) || !isRecord(value.bibjson)) return undefined
  const id = trimmedText(value.id)
  const title = trimmedText(value.bibjson.title)
  if (!id || !title) return undefined
  const journalRecord = isRecord(value.bibjson.journal) ? value.bibjson.journal : undefined
  return {
    id,
    title,
    authors: readAuthors(value.bibjson.author),
    journal: journalRecord ? trimmedText(journalRecord.title) : undefined,
    publisher: journalRecord ? trimmedText(journalRecord.publisher) : undefined,
    year: trimmedText(value.bibjson.year),
    doi: readDoi(value.bibjson.identifier),
  }
}

const parseResult = (data: unknown, request: DoajRequest): { result?: DoajResult; queryContract: boolean } => {
  if (!isRecord(data) || !Array.isArray(data.results)) return { queryContract: false }
  const providerQuery = trimmedText(data.query)
  const queryContract = providerQuery === request.query
  if (!queryContract) return { queryContract: false }

  const total = nonNegativeSafeInteger(data.total)
  const page = positiveSafeInteger(data.page)
  const providerPageSize = positiveSafeInteger(data.pageSize)
  if (total === undefined || page === undefined || providerPageSize === undefined) return { queryContract: true }

  const articles: DoajArticle[] = []
  const seen = new Set<string>()
  let malformedRecordCount = 0
  let duplicateRecordCount = 0
  let overflowRecordCount = 0
  for (const raw of data.results) {
    const article = parseArticle(raw)
    if (!article) {
      malformedRecordCount += 1
      continue
    }
    const key = article.id.toLowerCase()
    if (seen.has(key)) {
      duplicateRecordCount += 1
      continue
    }
    seen.add(key)
    if (articles.length >= request.pageSize) {
      overflowRecordCount += 1
      continue
    }
    articles.push(article)
  }

  const providerRecordCount = data.results.length
  const countContract = page === 1 && providerPageSize === request.pageSize && total >= providerRecordCount
    && providerRecordCount === Math.min(request.pageSize, total)
  return {
    queryContract: true,
    result: {
      articles,
      total,
      page,
      providerPageSize,
      providerRecordCount,
      malformedRecordCount,
      duplicateRecordCount,
      overflowRecordCount,
      countContract,
    },
  }
}

function ResultState({ state, title, detail, request, queryContract, countContract }: {
  state: 'invalid' | 'empty' | 'partial'
  title: string
  detail: string
  request?: DoajRequest
  queryContract?: boolean
  countContract?: boolean
}) {
  return <div className="domain-card domain-empty" data-domain-card="doaj-search" data-result-state={state}
    data-request-bound={request?.transportBound ? 'true' : 'false'} data-request-contract="exact-doaj-article-search-first-page"
    data-request-query={request?.query} data-requested-page-size={request?.pageSize}
    data-query-contract={queryContract === undefined ? undefined : String(queryContract)}
    data-count-contract={countContract === undefined ? undefined : String(countContract)}>
    <h3>{title}</h3><p>{detail}</p>
  </div>
}

export function DoajSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = parseRequest(requestUrl, executedRequest)
  if (!request) {
    return <ResultState state="invalid" title="Invalid DOAJ search request" detail="The successful response was not tied to the supported exact DOAJ article-search request."/>
  }

  const parsed = parseResult(data, request)
  if (!parsed.result) {
    return <ResultState state="invalid" title="Invalid DOAJ search response" detail="DOAJ did not return native first-page pagination metadata with a query echo matching the executed search." request={request} queryContract={parsed.queryContract}/>
  }
  const result = parsed.result

  if (result.providerRecordCount === 0) {
    if (result.total === 0 && result.countContract) {
      return request.transportBound
        ? <ResultState state="empty" title="No DOAJ articles matched" detail={`DOAJ returned a request-bound zero-result first page for “${request.query}”.`} request={request} queryContract countContract/>
        : <ResultState state="partial" title="DOAJ request identity unavailable" detail="DOAJ returned a coherent zero-result first page, but the executed request transport is unavailable, so the response is not trusted as a request-bound no-match result." request={request} queryContract countContract/>
    }
    return <ResultState state="invalid" title="Invalid DOAJ empty response" detail="The empty HTTP-success response did not include a coherent request-bound zero-result count." request={request} queryContract countContract={result.countContract}/>
  }

  if (!result.articles.length) {
    return <ResultState state="invalid" title="Invalid DOAJ article identities" detail="DOAJ returned article rows, but none carried a provider record ID and non-empty article title." request={request} queryContract countContract={result.countContract}/>
  }

  const partial = !request.transportBound || !result.countContract || result.malformedRecordCount > 0 || result.duplicateRecordCount > 0 || result.overflowRecordCount > 0
  const primary = result.articles[0]

  return <div className="doaj-search-preview domain-card" data-domain-card="doaj-search" data-result-state={partial ? 'partial' : 'ready'}
    data-request-bound={request.transportBound ? 'true' : 'false'} data-request-contract="exact-doaj-article-search-first-page" data-request-query={request.query}
    data-requested-page-size={request.pageSize} data-query-contract="true" data-count-contract={String(result.countContract)}
    data-provider-total={result.total} data-provider-page={result.page} data-provider-page-size={result.providerPageSize}
    data-provider-record-count={result.providerRecordCount} data-valid-record-count={result.articles.length}
    data-malformed-record-count={result.malformedRecordCount} data-duplicate-record-count={result.duplicateRecordCount}
    data-overflow-record-count={result.overflowRecordCount} data-primary-article-id={primary.id}>
    <header className="domain-heading">
      <div>
        <small className="domain-eyebrow">DOAJ open-access article search</small>
        <h3>{request.query}</h3>
        <p>{request.transportBound ? 'Open-access article metadata acknowledged by the exact executed DOAJ search.' : 'Validated article metadata from the claimed DOAJ request URL; executed transport identity is unavailable.'}</p>
      </div>
      <span className="domain-state">{result.articles.length} trusted articles</span>
    </header>

    {partial && <p className="domain-note">{request.transportBound ? 'Request binding is valid, but pagination or article identity evidence is incomplete. Malformed, duplicate, or over-limit records are withheld; raw JSON retains the provider response.' : 'The provider result is structurally valid, but executed-request identity is unavailable, so this result is not marked ready.'}</p>}

    <dl className="domain-facts">
      <div><dt>Requested query</dt><dd>{request.query}</dd></div>
      <div><dt>Total matches</dt><dd>{result.total.toLocaleString('en')}</dd></div>
      <div><dt>First-page size</dt><dd>{result.providerRecordCount} / {request.pageSize}</dd></div>
      <div><dt>Primary DOAJ ID</dt><dd><code>{primary.id}</code></dd></div>
    </dl>

    <ol className="domain-list" aria-label="DOAJ article records">
      {result.articles.map((article) => <li key={article.id} data-article-id={article.id}>
        <strong>{article.title}</strong>
        <span>{article.authors.slice(0, 3).join(', ') || 'Authors unavailable'}</span>
        <span>{article.journal ?? 'Journal unavailable'}{article.year ? ` · ${article.year}` : ''}{article.publisher ? ` · ${article.publisher}` : ''}</span>
        {article.doi ? <code>{article.doi}</code> : <span>DOI unavailable</span>}
      </li>)}
    </ol>

    <p className="domain-note">DOAJ article metadata is discovery evidence supplied through the directory. The card withholds rows whose provider record identity or title cannot be established.</p>
  </div>
}
