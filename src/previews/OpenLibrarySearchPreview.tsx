import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

const FIELDS = 'key,title,author_name,first_publish_year,cover_i'
type Request = { query: string; limit: number; transportBound: boolean }
type Work = { key: string; title: string; authors: string[]; firstPublishYear?: number; coverId?: number }
type Result = { works: Work[]; providerRecordCount: number; validRecordCount: number; malformedRecordCount: number; duplicateRecordCount: number; overflowRecordCount: number; providerTotal?: number; providerStart?: number; providerTotalExact?: boolean; queryEchoContract?: boolean; countContract: boolean; supplementalContract: boolean }

export const parseOpenLibraryRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): Request | undefined => {
  const candidateUrl = executedRequest?.url ?? requestUrl
  if (!candidateUrl) return undefined
  if (executedRequest && (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && requestUrl !== executedRequest.url))) return undefined
  try {
    const url = new URL(candidateUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'openlibrary.org' || url.port || url.username || url.password || url.hash || url.pathname !== '/search.json'
      || keys.length !== 3 || !['q', 'limit', 'fields'].every((key) => keys.includes(key))
      || url.searchParams.getAll('q').length !== 1 || url.searchParams.getAll('limit').length !== 1 || url.searchParams.getAll('fields').length !== 1
      || url.searchParams.get('fields') !== FIELDS) return undefined
    const rawQuery = url.searchParams.get('q') ?? ''
    const query = rawQuery.trim()
    const rawLimit = url.searchParams.get('limit') ?? ''
    if (!query || rawQuery !== query || !/^[1-9]\d*$/.test(rawLimit)) return undefined
    const limit = Number(rawLimit)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20 || String(limit) !== rawLimit) return undefined
    const canonical = `https://openlibrary.org/search.json?${new URLSearchParams({ q: query, limit: String(limit), fields: FIELDS }).toString()}`
    if (candidateUrl !== canonical) return undefined
    return { query, limit, transportBound: Boolean(executedRequest) }
  } catch { return undefined }
}

const normalizeWorkKey = (value: unknown) => {
  const key = trimmedText(value)
  if (!key) return undefined
  if (/^\/works\/OL\d+W$/i.test(key)) return key
  return /^OL\d+W$/i.test(key) ? `/works/${key}` : undefined
}
const readAuthors = (value: unknown) => {
  if (value === undefined || value === null) return { authors: [] as string[], malformed: false }
  if (!Array.isArray(value)) return { authors: [] as string[], malformed: true }
  const authors: string[] = []
  let malformed = false
  for (const entry of value) {
    const author = trimmedText(entry)
    if (!author) { malformed = true; continue }
    if (!authors.includes(author)) authors.push(author)
  }
  return { authors, malformed }
}
const optionalPositiveInteger = (value: unknown) => {
  if (value === undefined || value === null) return { value: undefined, malformed: false }
  const parsed = positiveSafeInteger(value)
  return parsed === undefined ? { value: undefined, malformed: true } : { value: parsed, malformed: false }
}
const parseWork = (value: unknown): { work?: Work; malformed: boolean } => {
  if (!isRecord(value)) return { malformed: true }
  const key = normalizeWorkKey(value.key)
  const title = trimmedText(value.title)
  if (!key || !title) return { malformed: true }
  const authors = readAuthors(value.author_name)
  const year = optionalPositiveInteger(value.first_publish_year)
  const cover = optionalPositiveInteger(value.cover_i)
  return { work: { key, title, authors: authors.authors, firstPublishYear: year.value, coverId: cover.value }, malformed: authors.malformed || year.malformed || cover.malformed }
}
const providerTotal = (data: Record<string, unknown>) => {
  const hasCamel = Object.prototype.hasOwnProperty.call(data, 'numFound')
  const hasSnake = Object.prototype.hasOwnProperty.call(data, 'num_found')
  const camel = hasCamel ? nonNegativeSafeInteger(data.numFound) : undefined
  const snake = hasSnake ? nonNegativeSafeInteger(data.num_found) : undefined
  const malformed = (hasCamel && camel === undefined) || (hasSnake && snake === undefined) || (camel !== undefined && snake !== undefined && camel !== snake)
  return { total: malformed ? undefined : camel ?? snake, malformed }
}

export const parseOpenLibraryResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: Request; result?: Result; invalidReason?: string } => {
  const request = parseOpenLibraryRequest(requestUrl, executedRequest)
  if (!request) return { invalidReason: 'The successful response was not tied to the exact supported Open Library search request.' }
  if (!isRecord(data) || !Array.isArray(data.docs)) return { request, invalidReason: 'Open Library did not return the documented search response envelope.' }
  let queryEchoContract: boolean | undefined
  if (Object.prototype.hasOwnProperty.call(data, 'q')) {
    queryEchoContract = typeof data.q === 'string' && data.q === request.query
    if (!queryEchoContract) return { request, invalidReason: 'Open Library contradicted the executed search query in its response acknowledgement.' }
  }
  const totalEvidence = providerTotal(data)
  const start = nonNegativeSafeInteger(data.start)
  const startMalformed = Object.prototype.hasOwnProperty.call(data, 'start') && start === undefined
  const exactPresent = Object.prototype.hasOwnProperty.call(data, 'numFoundExact')
  const providerTotalExact = exactPresent && typeof data.numFoundExact === 'boolean' ? data.numFoundExact : undefined
  const exactMalformed = exactPresent && providerTotalExact === undefined
  const works: Work[] = []
  const seen = new Set<string>()
  let malformedRecordCount = 0, duplicateRecordCount = 0, overflowRecordCount = 0
  for (const raw of data.docs) {
    const parsed = parseWork(raw)
    if (!parsed.work) { malformedRecordCount += 1; continue }
    if (seen.has(parsed.work.key)) { duplicateRecordCount += 1; continue }
    seen.add(parsed.work.key)
    if (works.length >= request.limit) { overflowRecordCount += 1; continue }
    if (parsed.malformed) malformedRecordCount += 1
    works.push(parsed.work)
  }
  const providerRecordCount = data.docs.length
  const countContract = totalEvidence.total !== undefined && start === 0 && !totalEvidence.malformed && !startMalformed
    && providerRecordCount <= request.limit && providerRecordCount <= totalEvidence.total && providerRecordCount === Math.min(request.limit, totalEvidence.total)
  return { request, result: { works, providerRecordCount, validRecordCount: works.length, malformedRecordCount, duplicateRecordCount, overflowRecordCount, providerTotal: totalEvidence.total, providerStart: start, providerTotalExact, queryEchoContract, countContract, supplementalContract: !exactMalformed } }
}

const attrs = (request?: Request, result?: Result) => ({
  'data-domain-card': 'open-library-search', 'data-request-bound': request?.transportBound ? 'true' : 'false', 'data-request-contract': 'exact-open-library-search-first-page',
  'data-request-query': request?.query, 'data-request-limit': request?.limit, 'data-query-echo-contract': result?.queryEchoContract === undefined ? 'not-provided' : String(result.queryEchoContract),
  'data-count-contract': result ? String(result.countContract) : undefined, 'data-supplemental-contract': result ? String(result.supplementalContract) : undefined,
  'data-provider-total': result?.providerTotal, 'data-provider-start': result?.providerStart, 'data-provider-record-count': result?.providerRecordCount,
  'data-valid-record-count': result?.validRecordCount, 'data-malformed-record-count': result?.malformedRecordCount, 'data-duplicate-record-count': result?.duplicateRecordCount,
  'data-overflow-record-count': result?.overflowRecordCount, 'data-primary-work-key': result?.works[0]?.key,
})
const cards = (works: Work[]): SemanticCard[] => works.map((work) => ({ title: work.title, eyebrow: work.authors.slice(0, 3).join(', ') || 'Open Library work', badge: work.firstPublishYear ? String(work.firstPublishYear) : 'Year unavailable', metrics: [
  { label: 'Authors', value: String(work.authors.length) }, { label: 'First published', value: work.firstPublishYear ? String(work.firstPublishYear) : 'Unavailable' }, { label: 'Work key', value: work.key }, { label: 'Cover ID', value: work.coverId ? String(work.coverId) : 'Unavailable' },
] }))

export function OpenLibrarySearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseOpenLibraryResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request)} data-result-state="invalid"><h3>Invalid Open Library search response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  if (result.providerRecordCount === 0) {
    const empty = request.transportBound && result.providerTotal === 0 && result.countContract
    return <div className="domain-card domain-empty" {...attrs(request, result)} data-result-state={empty ? 'empty' : 'invalid'}><h3>{empty ? 'No Open Library books matched' : 'Invalid Open Library empty response'}</h3><p>{empty ? `Open Library returned a request-bound zero-result page for “${request.query}”.` : 'The empty HTTP-success response did not include a coherent zero-result count.'}</p></div>
  }
  if (!result.works.length) return <div className="domain-card domain-empty" {...attrs(request, result)} data-result-state="invalid"><h3>Invalid Open Library work identities</h3><p>Open Library returned rows, but none carried a trustworthy work key and title.</p></div>
  const partial = !request.transportBound || !result.countContract || !result.supplementalContract || result.malformedRecordCount > 0 || result.duplicateRecordCount > 0 || result.overflowRecordCount > 0
  return <div className="domain-card open-library-search-preview" {...attrs(request, result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Open Library · Book search</small><h3>{request.query}</h3><p>{request.transportBound ? 'Request-bound work records from the exact low-volume Open Library search, with malformed or duplicate identities withheld.' : 'Validated work records from the claimed Open Library search URL; executed transport identity is unavailable.'}</p></div><span className="domain-state">{result.works.length} trusted books</span></header>
    {partial && <p className="domain-note">{!request.transportBound ? 'The response is structurally useful, but executed transport identity is unavailable, so it cannot be marked ready.' : 'Search identity is bound to the executed request, but count or record evidence is incomplete. Raw JSON retains the full provider response.'}</p>}
    <dl className="domain-facts"><div><dt>Total matches</dt><dd>{result.providerTotal === undefined ? 'Unavailable' : result.providerTotal.toLocaleString('en')}</dd></div><div><dt>Returned rows</dt><dd>{result.providerRecordCount} / {request.limit}</dd></div><div><dt>Trusted books</dt><dd>{result.validRecordCount}</dd></div><div><dt>Primary work</dt><dd><code>{result.works[0].key}</code></dd></div></dl>
    <SemanticCards cards={cards(result.works)} emptyTitle="Open Library books unavailable"/>
    <p className="domain-note">Open Library search is intended for human-facing, low-volume discovery. This card treats work IDs and titles as provider identity evidence and does not second-guess the provider's broad Solr relevance matching.</p>
  </div>
}
