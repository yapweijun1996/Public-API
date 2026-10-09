import { isRecord, nonNegativeSafeInteger, trimmedText } from './semanticValidation'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'

type InternetArchiveRequest = { query: string; mediaType: string; rows: 6; page: 1 }
type ArchiveItem = {
  identifier: string
  title: string
  creator?: string
  date?: string
  rights?: string
  licenseUrl?: string
  optionalMalformed: boolean
}
type InternetArchiveResult = {
  items: ArchiveItem[]
  providerTotal: number
  providerStart: number
  providerRecordCount: number
  malformedRecordCount: number
  duplicateRecordCount: number
  overflowRecordCount: number
  optionalWarningCount: number
  rightsEvidenceCount: number
  licenseEvidenceCount: number
  countContract: boolean
}

const ORIGIN = 'https://archive.org'
const PATH = '/advancedsearch.php'
const ROWS = 6
const FIELDS = ['identifier', 'title', 'creator', 'date', 'mediatype', 'rights', 'licenseurl'] as const
const MEDIA_TYPES = new Set(['texts', 'audio', 'movies', 'software'])
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

export const parseInternetArchiveRequest = (requestUrl?: string): InternetArchiveRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    const allowedKeys = new Set(['q', 'rows', 'page', 'output', 'fl[]'])
    if (url.origin !== ORIGIN || url.protocol !== 'https:' || url.pathname !== PATH || url.port || url.username || url.password || url.hash
      || keys.length !== 11 || keys.some((key) => !allowedKeys.has(key))
      || url.searchParams.getAll('q').length !== 1 || url.searchParams.getAll('rows').length !== 1
      || url.searchParams.getAll('page').length !== 1 || url.searchParams.getAll('output').length !== 1
      || url.searchParams.get('rows') !== String(ROWS) || url.searchParams.get('page') !== '1' || url.searchParams.get('output') !== 'json') return undefined
    const fields = url.searchParams.getAll('fl[]')
    if (fields.length !== FIELDS.length || fields.some((field, index) => field !== FIELDS[index])) return undefined
    const rawQuery = url.searchParams.get('q') ?? ''
    const match = /^(.*) AND mediatype:([A-Za-z]+)$/.exec(rawQuery)
    if (!match) return undefined
    const query = match[1].trim()
    const mediaType = match[2]
    if (!query || match[1] !== query || !MEDIA_TYPES.has(mediaType)) return undefined
    return { query, mediaType, rows: ROWS, page: 1 }
  } catch {
    return undefined
  }
}

const optionalProviderText = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized ? { value: normalized, malformed: false } : { malformed: true }
  }
  if (Array.isArray(value) && value.length > 0) {
    const values = value.map(trimmedText)
    return values.every(Boolean) ? { value: values.join(', '), malformed: false } : { malformed: true }
  }
  return { malformed: true }
}

const recognizedLicenseUrl = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  if (typeof value !== 'string' || !value.trim()) return { malformed: true }
  try {
    const url = new URL(value.trim())
    const recognizedHost = url.hostname === 'creativecommons.org' || url.hostname.endsWith('.creativecommons.org')
      || url.hostname === 'rightsstatements.org' || url.hostname.endsWith('.rightsstatements.org')
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && recognizedHost
      ? { value: url.toString(), malformed: false }
      : { malformed: true }
  } catch {
    return { malformed: true }
  }
}

const parseItem = (value: unknown, mediaType: string): { item?: ArchiveItem; malformed: boolean; optionalMalformed: boolean } => {
  if (!isRecord(value)) return { malformed: true, optionalMalformed: false }
  const identifier = trimmedText(value.identifier)
  const title = trimmedText(value.title)
  if (!identifier || !IDENTIFIER.test(identifier) || !title || value.mediatype !== mediaType) return { malformed: true, optionalMalformed: false }
  const creator = optionalProviderText(value.creator)
  const date = optionalProviderText(value.date)
  const rights = optionalProviderText(value.rights)
  const licenseUrl = recognizedLicenseUrl(value.licenseurl)
  const optionalMalformed = creator.malformed || date.malformed || rights.malformed || licenseUrl.malformed
  return {
    item: { identifier, title, creator: creator.value, date: date.value, rights: rights.value, licenseUrl: licenseUrl.value, optionalMalformed },
    malformed: false,
    optionalMalformed,
  }
}

export const parseInternetArchiveResponse = (data: unknown, requestUrl?: string): { request?: InternetArchiveRequest; result?: InternetArchiveResult; invalidReason?: string } => {
  const request = parseInternetArchiveRequest(requestUrl)
  if (!request) return { invalidReason: 'The successful response was not tied to the exact supported Internet Archive Advanced Search request.' }
  if (!isRecord(data) || !isRecord(data.responseHeader) || !isRecord(data.responseHeader.params) || !isRecord(data.response) || !Array.isArray(data.response.docs)) {
    return { request, invalidReason: 'Internet Archive did not return the documented responseHeader and response envelope.' }
  }
  const params = data.responseHeader.params
  const expectedQuery = `${request.query} AND mediatype:${request.mediaType}`
  if (data.responseHeader.status !== 0 || params.qin !== expectedQuery || params.fl !== FIELDS.join(',') || params.wt !== 'json' || params.rows !== request.rows || params.start !== 0) {
    return { request, invalidReason: 'The provider request acknowledgement did not acknowledge the executed query, fields, first page, and native row count.' }
  }
  const providerTotal = nonNegativeSafeInteger(data.response.numFound)
  const providerStart = nonNegativeSafeInteger(data.response.start)
  if (providerTotal === undefined || providerStart !== 0) return { request, invalidReason: 'Internet Archive result counts and start offset must use native non-negative integers for the first page.' }

  const parsed = data.response.docs.map((value) => parseItem(value, request.mediaType))
  const items: ArchiveItem[] = []
  const seen = new Set<string>()
  let duplicateRecordCount = 0
  let overflowRecordCount = 0
  for (const entry of parsed) {
    if (!entry.item) continue
    if (seen.has(entry.item.identifier)) { duplicateRecordCount += 1; continue }
    seen.add(entry.item.identifier)
    if (items.length >= request.rows) { overflowRecordCount += 1; continue }
    items.push(entry.item)
  }
  const providerRecordCount = data.response.docs.length
  const countContract = providerRecordCount === Math.min(request.rows, providerTotal)
  return { request, result: {
    items,
    providerTotal,
    providerStart,
    providerRecordCount,
    malformedRecordCount: parsed.filter((entry) => entry.malformed).length,
    duplicateRecordCount,
    overflowRecordCount,
    optionalWarningCount: parsed.filter((entry) => entry.optionalMalformed).length,
    rightsEvidenceCount: items.filter((item) => item.rights || item.licenseUrl).length,
    licenseEvidenceCount: items.filter((item) => item.licenseUrl).length,
    countContract,
  } }
}

const attrs = (request?: InternetArchiveRequest, result?: InternetArchiveResult) => ({
  'data-domain-card': 'internet-archive-search',
  'data-request-bound': request ? 'true' : 'false',
  'data-request-contract': 'exact-internet-archive-advanced-search-v1',
  'data-request-query': request?.query,
  'data-request-media-type': request?.mediaType,
  'data-requested-row-count': request?.rows,
  'data-provider-total': result?.providerTotal,
  'data-provider-start': result?.providerStart,
  'data-provider-record-count': result?.providerRecordCount,
  'data-valid-record-count': result?.items.length,
  'data-malformed-record-count': result?.malformedRecordCount,
  'data-duplicate-record-count': result?.duplicateRecordCount,
  'data-overflow-record-count': result?.overflowRecordCount,
  'data-optional-warning-count': result?.optionalWarningCount,
  'data-rights-evidence-count': result?.rightsEvidenceCount,
  'data-license-evidence-count': result?.licenseEvidenceCount,
  'data-count-contract': result ? String(result.countContract) : undefined,
  'data-primary-identifier': result?.items[0]?.identifier,
})

export function InternetArchiveSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const executedUrl = executedRequest
    ? executedRequest.method === 'GET' && executedRequest.body === undefined ? executedRequest.url : undefined
    : requestUrl
  const parsed = parseInternetArchiveResponse(data, executedUrl)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty internet-archive-search-preview" {...attrs(parsed.request)} data-result-state="invalid"><h3>Invalid Internet Archive search response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  if (result.providerRecordCount === 0) {
    const empty = result.providerTotal === 0 && result.countContract
    return <div className="domain-card domain-empty internet-archive-search-preview" {...attrs(request, result)} data-result-state={empty ? 'empty' : 'invalid'}><h3>{empty ? 'No Internet Archive items matched' : 'Invalid Internet Archive empty response'}</h3><p>{empty ? `Internet Archive returned a coherent, request-bound zero-result ${request.mediaType} search for “${request.query}”.` : 'The empty provider batch contradicted its reported result count.'}</p></div>
  }
  if (!result.items.length) return <div className="domain-card domain-empty internet-archive-search-preview" {...attrs(request, result)} data-result-state="invalid"><h3>Archive item evidence unavailable</h3><p>Records were returned, but none carried a unique valid Internet Archive identifier, nonempty title, and the requested media type.</p></div>
  const partial = !result.countContract || result.malformedRecordCount > 0 || result.duplicateRecordCount > 0 || result.overflowRecordCount > 0 || result.optionalWarningCount > 0 || result.items.length !== result.providerRecordCount
  return <div className="domain-card internet-archive-search-preview bounded-media-preview" {...attrs(request, result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Internet Archive · Advanced Search</small><h3>{request.query}</h3><p>Exact-request-bound {request.mediaType} records with provider identifiers and optional uploader-supplied rights evidence.</p></div><span className="domain-state">{result.items.length} trusted items</span></header>
    {partial && <p className="domain-note">Only unique items with a valid Internet Archive identifier, title, and requested media type are shown. Malformed, duplicate, over-limit, or unsafe optional evidence is withheld.</p>}
    <dl className="domain-facts"><div><dt>Total matches</dt><dd>{result.providerTotal.toLocaleString('en')}</dd></div><div><dt>Trusted items</dt><dd>{result.items.length} / {result.providerRecordCount}</dd></div><div><dt>Media type</dt><dd>{request.mediaType}</dd></div><div><dt>Rights evidence</dt><dd>{result.rightsEvidenceCount} items</dd></div></dl>
    <div className={`media-preview ${result.items.length === 1 ? 'single' : ''}`}>{result.items.map((item) => <article key={item.identifier} data-archive-identifier={item.identifier} data-rights-evidence={item.rights || item.licenseUrl ? 'present' : 'absent'} data-license-evidence={item.licenseUrl ? 'present' : 'absent'}>
      <img src={`https://archive.org/services/img/${encodeURIComponent(item.identifier)}`} alt="" loading="lazy"/>
      <div><small>Internet Archive · {request.mediaType}</small><h3>{item.title}</h3><p>{item.creator ? `Creator: ${item.creator}` : 'Creator metadata unavailable'}{item.date ? ` · ${item.date}` : ''}</p><p>{item.rights ? `Uploader rights statement: ${item.rights}` : 'Uploader rights statement unavailable'}</p><p><a href={`https://archive.org/details/${encodeURIComponent(item.identifier)}`} target="_blank" rel="noreferrer">Archive item source</a>{item.licenseUrl ? <> · <a href={item.licenseUrl} target="_blank" rel="noreferrer">License evidence</a></> : null}</p></div>
    </article>)}</div>
    <p className="domain-note">Internet Archive does not guarantee copyright status. Verify each item’s rights and license evidence before reuse; uploader-supplied metadata is not itself a reuse guarantee.</p>
  </div>
}
