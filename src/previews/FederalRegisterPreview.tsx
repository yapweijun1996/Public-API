import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { DateList, type DateListItem } from './DateList'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger } from './semanticValidation'

export type FederalRegisterRequest = {
  query: string
  limit: number
}

type FederalRegisterDocument = {
  documentNumber: string
  publicationDate: string
  type: string
  title: string
  abstract?: string
  agencies: string[]
  htmlUrl: string
}

type FederalRegisterResult = {
  providerCount: number
  providerTotalPages?: number
  providerRecordCount: number
  trustedRecordCount: number
  malformedEvidenceCount: number
  duplicateEvidenceCount: number
  documents: FederalRegisterDocument[]
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const strictText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 && value === value.trim() ? value : undefined

const optionalStrictText = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null || value === '') return { malformed: false }
  const text = strictText(value)
  return text ? { value: text, malformed: false } : { malformed: true }
}

const validCalendarDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || value !== value.trim()) return false
  const match = value.match(DATE_PATTERN)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

export const parseFederalRegisterRequest = (requestUrl?: string): FederalRegisterRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'www.federalregister.gov' || url.port || url.username || url.password
      || url.pathname !== '/api/v1/documents.json' || url.hash) return undefined
    const keys = [...url.searchParams.keys()]
    const allowed = new Set(['per_page', 'order', 'conditions[term]'])
    if (keys.length !== 3 || keys.some((key) => !allowed.has(key))
      || url.searchParams.getAll('per_page').length !== 1
      || url.searchParams.getAll('order').length !== 1
      || url.searchParams.getAll('conditions[term]').length !== 1) return undefined
    if (url.searchParams.get('order') !== 'newest') return undefined

    const query = url.searchParams.get('conditions[term]') ?? ''
    const rawLimit = url.searchParams.get('per_page') ?? ''
    if (!query || query !== query.trim() || !/^(?:[1-9]|1\d|20)$/.test(rawLimit)) return undefined
    return { query, limit: Number(rawLimit) }
  } catch {
    return undefined
  }
}

const nextPageMatchesRequest = (value: unknown, request: FederalRegisterRequest): boolean => {
  const text = strictText(value)
  if (!text) return false
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.hostname !== 'www.federalregister.gov' || url.port || url.username || url.password
      || url.pathname !== '/api/v1/documents' || url.hash) return false
    const expectedKeys = ['conditions[term]', 'format', 'order', 'page', 'per_page']
    const keys = [...url.searchParams.keys()]
    if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) return false
    return expectedKeys.every((key) => url.searchParams.getAll(key).length === 1)
      && url.searchParams.get('conditions[term]') === request.query
      && url.searchParams.get('format') === 'json'
      && url.searchParams.get('order') === 'newest'
      && url.searchParams.get('page') === '2'
      && url.searchParams.get('per_page') === String(request.limit)
  } catch {
    return false
  }
}

const federalRegisterDocumentUrl = (value: unknown, publicationDate: string, documentNumber: string): string | undefined => {
  const text = strictText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    const [year, month, day] = publicationDate.split('-')
    const prefix = `/documents/${year}/${month}/${day}/${documentNumber}/`
    if (url.protocol !== 'https:' || url.hostname !== 'www.federalregister.gov' || url.port || url.username || url.password
      || url.search || url.hash || !url.pathname.startsWith(prefix)) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

const parseAgencies = (value: unknown): { agencies: string[]; malformed: number } => {
  if (!Array.isArray(value)) return { agencies: [], malformed: 1 }
  const agencies: string[] = []
  const seen = new Set<string>()
  let malformed = 0
  for (const item of value) {
    if (!isRecord(item)) { malformed += 1; continue }
    const name = strictText(item.name)
    if (!name) { malformed += 1; continue }
    if (seen.has(name)) continue
    seen.add(name)
    agencies.push(name)
  }
  return { agencies, malformed }
}

const parseDocument = (value: unknown): { document?: FederalRegisterDocument; malformed: number } => {
  if (!isRecord(value)) return { malformed: 1 }
  const documentNumber = strictText(value.document_number)
  const publicationDate = validCalendarDate(value.publication_date) ? value.publication_date : undefined
  const type = strictText(value.type)
  const title = strictText(value.title)
  if (!documentNumber || !publicationDate || !type || !title) return { malformed: 1 }
  const htmlUrl = federalRegisterDocumentUrl(value.html_url, publicationDate, documentNumber)
  if (!htmlUrl) return { malformed: 1 }

  const abstract = optionalStrictText(value.abstract)
  const agencies = parseAgencies(value.agencies)
  return {
    document: { documentNumber, publicationDate, type, title, abstract: abstract.value, agencies: agencies.agencies, htmlUrl },
    malformed: Number(abstract.malformed) + agencies.malformed,
  }
}

type FederalRegisterRequestBinding = {
  request?: FederalRegisterRequest
  transportBound: boolean
  invalidReason?: string
}

const bindFederalRegisterRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): FederalRegisterRequestBinding => {
  const displayedRequest = parseFederalRegisterRequest(requestUrl)
  if (requestUrl !== undefined && !displayedRequest) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported Federal Register document-search request.' }
  if (!executedRequest) return displayedRequest ? { request: displayedRequest, transportBound: false } : { transportBound: false, invalidReason: 'Federal Register request identity is unavailable.' }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
    return { request: displayedRequest, transportBound: false, invalidReason: 'The successful response was not tied to the exact supported bodyless GET Federal Register document-search request.' }
  }
  const executed = parseFederalRegisterRequest(executedRequest.url)
  if (!executed) return { request: displayedRequest, transportBound: false, invalidReason: 'The executed URL was not the exact supported Federal Register document-search request.' }
  if (displayedRequest && (displayedRequest.query !== executed.query || displayedRequest.limit !== executed.limit)) {
    return { request: displayedRequest, transportBound: false, invalidReason: 'The displayed Federal Register request and executed request identity did not match.' }
  }
  return { request: displayedRequest ?? executed, transportBound: true }
}

export const parseFederalRegisterResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: FederalRegisterRequest; transportBound: boolean; result?: FederalRegisterResult; invalidReason?: string } => {
  const binding = bindFederalRegisterRequest(requestUrl, executedRequest)
  const { request, transportBound } = binding
  if (!request || binding.invalidReason) return { request, transportBound, invalidReason: binding.invalidReason ?? 'Federal Register request identity is unavailable.' }
  if (!isRecord(data) || !Array.isArray(data.results)) return { request, transportBound, invalidReason: 'The provider did not return the documented Federal Register search envelope.' }

  const providerCount = nonNegativeSafeInteger(data.count)
  if (providerCount === undefined) return { request, transportBound, invalidReason: 'The provider count was missing or was not a native non-negative integer.' }
  if (data.description !== `Documents matching '${request.query}'`) {
    return { request, transportBound, invalidReason: 'The provider search description did not acknowledge the executed search term.' }
  }

  const providerTotalPages = data.total_pages === null ? undefined : positiveSafeInteger(data.total_pages)
  if (providerCount === 0) {
    if (data.results.length !== 0 || data.total_pages !== null || data.next_page_url !== null) {
      return { request, transportBound, invalidReason: 'The zero-result pagination evidence contradicted the executed search.' }
    }
  } else {
    if (providerTotalPages === undefined || data.results.length !== Math.min(request.limit, providerCount)) {
      return { request, transportBound, invalidReason: 'The first-page cardinality did not match the executed Federal Register request.' }
    }
    if (providerTotalPages > 1 ? !nextPageMatchesRequest(data.next_page_url, request) : data.next_page_url !== null) {
      return { request, transportBound, invalidReason: 'The provider pagination link did not acknowledge the executed search term, order, and page size.' }
    }
  }

  const documents: FederalRegisterDocument[] = []
  const seen = new Set<string>()
  let malformedEvidenceCount = 0
  let duplicateEvidenceCount = 0
  for (const row of data.results) {
    const parsed = parseDocument(row)
    malformedEvidenceCount += parsed.malformed
    if (!parsed.document) continue
    if (seen.has(parsed.document.documentNumber)) { duplicateEvidenceCount += 1; continue }
    seen.add(parsed.document.documentNumber)
    documents.push(parsed.document)
  }

  return { request, transportBound, result: {
    providerCount,
    providerTotalPages,
    providerRecordCount: data.results.length,
    trustedRecordCount: documents.length,
    malformedEvidenceCount,
    duplicateEvidenceCount,
    documents,
  } }
}

const itemForDocument = (document: FederalRegisterDocument): DateListItem => {
  const [, , day] = document.publicationDate.split('-')
  const date = new Date(`${document.publicationDate}T00:00:00Z`)
  return {
    key: document.documentNumber,
    dateText: document.publicationDate,
    day,
    month: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    eyebrow: `${document.type} · ${document.agencies[0] ?? 'Agency unavailable'} · ${document.documentNumber}`,
    title: <a href={document.htmlUrl} target="_blank" rel="noreferrer">{document.title}</a>,
    description: document.abstract ?? 'Provider abstract unavailable.',
  }
}

const attrs = (request: FederalRegisterRequest | undefined, transportBound: boolean, result?: FederalRegisterResult) => ({
  'data-domain-card': 'federal-register-documents',
  'data-request-bound': String(transportBound),
  'data-request-contract': 'exact-federal-register-document-search-v2',
  'data-search-term': request?.query,
  'data-requested-limit': request?.limit,
  'data-provider-count': result?.providerCount,
  'data-provider-total-pages': result?.providerTotalPages,
  'data-provider-record-count': result?.providerRecordCount,
  'data-trusted-record-count': result?.trustedRecordCount,
  'data-malformed-evidence-count': result?.malformedEvidenceCount,
  'data-duplicate-evidence-count': result?.duplicateEvidenceCount,
  'data-primary-document-number': result?.documents[0]?.documentNumber,
  'data-primary-publication-date': result?.documents[0]?.publicationDate,
  'data-primary-document-type': result?.documents[0]?.type,
})

export function FederalRegisterPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseFederalRegisterResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request, parsed.transportBound)} data-result-state="invalid"><h3>Invalid Federal Register response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result, transportBound } = parsed
  if (result.providerCount === 0) return transportBound
    ? <div className="domain-card domain-empty" {...attrs(request, transportBound, result)} data-result-state="empty"><h3>No Federal Register documents matched</h3><p>The provider returned a coherent exact-request-bound empty result for “{request.query}”.</p></div>
    : <div className="domain-card domain-empty" {...attrs(request, transportBound, result)} data-result-state="partial"><h3>Unbound Federal Register search result</h3><p>The provider response is coherent, but executed transport identity is unavailable, so semantic emptiness is not trusted.</p></div>
  if (!result.documents.length) return <div className="domain-card domain-empty" {...attrs(request, transportBound, result)} data-result-state="invalid"><h3>No trustworthy Federal Register documents</h3><p>The provider returned rows, but none carried a trustworthy document identity and canonical FederalRegister.gov URL.</p></div>

  const partial = !transportBound || result.malformedEvidenceCount > 0 || result.duplicateEvidenceCount > 0
  return <div className="domain-card federal-register-document-preview" {...attrs(request, transportBound, result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">FederalRegister.gov · Published documents</small><h3>Federal documents matching “{request.query}”</h3><p>{transportBound ? 'Exact-request-bound publication dates, document identities, agency context, and FederalRegister.gov source links.' : 'Validated Federal Register document records from the displayed search URL; executed transport identity is unavailable.'}</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{partial ? 'Partial evidence' : 'Request matched'}</span></header>
    {partial ? <p className="domain-note">{!transportBound ? 'The provider evidence is structurally coherent, but executed transport identity is unavailable, so the result cannot be marked ready.' : 'Malformed or duplicate provider evidence was withheld. Raw JSON retains the complete response.'}</p> : null}
    <dl className="domain-facts"><div><dt>Provider matches</dt><dd>{result.providerCount.toLocaleString('en')}</dd></div><div><dt>Returned rows</dt><dd>{result.providerRecordCount}</dd></div><div><dt>Trusted rows</dt><dd>{result.trustedRecordCount}</dd></div><div><dt>Page size</dt><dd>{request.limit}</dd></div></dl>
    <DateList items={result.documents.map(itemForDocument)} className="federal-register-preview"/>
    <p className="domain-note">FederalRegister.gov describes its web edition as an unofficial informational resource. For legal research, verify the corresponding official edition or PDF on govinfo.gov.</p>
  </div>
}
