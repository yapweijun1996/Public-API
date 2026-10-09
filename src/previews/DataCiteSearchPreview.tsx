import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

type DataCiteRequest = { query: string; pageSize: number }

type DataCiteRecord = {
  doi: string
  title: string
  creators: string[]
  publisher?: string
  publicationYear?: number
  resourceType?: string
  incomplete: boolean
}

type DataCiteResult = {
  records: DataCiteRecord[]
  total: number
  totalPages: number
  page: number
  providerRecordCount: number
  malformedRecordCount: number
  duplicateDoiCount: number
  incompleteRecordCount: number
  overflowRecordCount: number
  countContract: boolean
}

const parseRequest = (requestUrl?: string): DataCiteRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const allowed = new Set(['query', 'page[size]'])
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'api.datacite.org' || url.port || url.username || url.password
      || url.pathname !== '/dois' || url.hash || keys.length !== 2 || keys.some((key) => !allowed.has(key))) return undefined
    if ([...allowed].some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    const query = url.searchParams.get('query')?.trim() ?? ''
    const rawPageSize = url.searchParams.get('page[size]') ?? ''
    if (!query || !/^[1-9]\d*$/.test(rawPageSize)) return undefined
    const pageSize = Number(rawPageSize)
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 10) return undefined
    return { query, pageSize }
  } catch {
    return undefined
  }
}

const executedRequestIdentity = (executedRequest?: ExecutedRequestContext, requestUrl?: string): { request?: DataCiteRequest; invalid: boolean } => {
  if (!executedRequest) return { invalid: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return { invalid: true }
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return { invalid: true }
  const request = parseRequest(executedRequest.url)
  return request ? { request, invalid: false } : { invalid: true }
}

const sameRequest = (left: DataCiteRequest, right: DataCiteRequest | undefined) =>
  Boolean(right && right.query === left.query && right.pageSize === left.pageSize)

const textList = (value: unknown): { values: string[]; malformed: boolean } => {
  if (!Array.isArray(value)) return { values: [], malformed: true }
  let malformed = false
  const values = value.flatMap((entry) => {
    if (!isRecord(entry)) {
      malformed = true
      return []
    }
    const text = trimmedText(entry.title)
    if (!text) malformed = true
    return text ? [text] : []
  })
  return { values, malformed }
}

const creatorList = (value: unknown): { values: string[]; malformed: boolean } => {
  if (!Array.isArray(value)) return { values: [], malformed: true }
  let malformed = false
  const values = value.flatMap((entry) => {
    if (!isRecord(entry)) {
      malformed = true
      return []
    }
    const name = trimmedText(entry.name)
    if (!name) malformed = true
    return name ? [name] : []
  })
  return { values, malformed }
}

const parseRecord = (value: unknown): DataCiteRecord | undefined => {
  if (!isRecord(value) || value.type !== 'dois' || !isRecord(value.attributes)) return undefined
  const id = trimmedText(value.id)
  const doi = trimmedText(value.attributes.doi)
  const titles = textList(value.attributes.titles)
  const title = titles.values[0]
  if (!id || !doi || !title || !/^10\.\d{4,9}\/.+/i.test(doi) || id.toLowerCase() !== doi.toLowerCase()) return undefined

  const creators = creatorList(value.attributes.creators)
  const publisher = trimmedText(value.attributes.publisher)
  const publicationYear = positiveSafeInteger(value.attributes.publicationYear)
  const types = isRecord(value.attributes.types) ? value.attributes.types : undefined
  const resourceType = types ? trimmedText(types.resourceTypeGeneral) : undefined
  const publisherMalformed = value.attributes.publisher !== undefined && !publisher
  const yearMalformed = value.attributes.publicationYear !== undefined && (publicationYear === undefined || publicationYear > 9999)
  const typesMalformed = value.attributes.types !== undefined && (!types || !resourceType)
  const incomplete = titles.malformed || creators.malformed || creators.values.length === 0 || !publisher || publicationYear === undefined
    || publicationYear > 9999 || !resourceType || publisherMalformed || yearMalformed || typesMalformed

  return { doi, title, creators: creators.values, publisher, publicationYear: publicationYear && publicationYear <= 9999 ? publicationYear : undefined, resourceType, incomplete }
}

const parseResult = (data: unknown, request: DataCiteRequest): { result?: DataCiteResult; selfContract: boolean } => {
  if (!isRecord(data) || !Array.isArray(data.data) || !isRecord(data.links) || !isRecord(data.meta)) return { selfContract: false }
  const self = trimmedText(data.links.self)
  const selfContract = Boolean(self && sameRequest(request, parseRequest(self)))
  if (!selfContract) return { selfContract: false }

  const total = nonNegativeSafeInteger(data.meta.total)
  const totalPages = nonNegativeSafeInteger(data.meta.totalPages)
  const page = positiveSafeInteger(data.meta.page)
  if (total === undefined || totalPages === undefined || page !== 1) return { selfContract: true }

  const records: DataCiteRecord[] = []
  const seen = new Set<string>()
  let malformedRecordCount = 0
  let duplicateDoiCount = 0
  let incompleteRecordCount = 0
  let overflowRecordCount = 0

  for (const raw of data.data) {
    const record = parseRecord(raw)
    if (!record) {
      malformedRecordCount += 1
      continue
    }
    const key = record.doi.toLowerCase()
    if (seen.has(key)) {
      duplicateDoiCount += 1
      continue
    }
    seen.add(key)
    if (records.length >= request.pageSize) {
      overflowRecordCount += 1
      continue
    }
    if (record.incomplete) incompleteRecordCount += 1
    records.push(record)
  }

  const providerRecordCount = data.data.length
  const countContract = total >= providerRecordCount && providerRecordCount === Math.min(request.pageSize, total)
  return {
    selfContract: true,
    result: {
      records,
      total,
      totalPages,
      page,
      providerRecordCount,
      malformedRecordCount,
      duplicateDoiCount,
      incompleteRecordCount,
      overflowRecordCount,
      countContract,
    },
  }
}

function ResultState({ state, title, detail, request, requestBound = false, selfContract, countContract }: {
  state: 'invalid' | 'empty' | 'partial'
  title: string
  detail: string
  request?: DataCiteRequest
  requestBound?: boolean
  selfContract?: boolean
  countContract?: boolean
}) {
  const semanticRequestBound = Boolean(requestBound && request && selfContract)
  return <div className="domain-card domain-empty" data-domain-card="datacite-search" data-result-state={state}
    data-request-bound={semanticRequestBound ? 'true' : 'false'} data-request-contract="exact-datacite-dois-first-page"
    data-request-query={request?.query} data-requested-page-size={request?.pageSize}
    data-self-contract={selfContract === undefined ? undefined : String(selfContract)} data-count-contract={countContract === undefined ? undefined : String(countContract)}>
    <h3>{title}</h3><p>{detail}</p>
  </div>
}

export function DataCiteSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const displayedRequest = parseRequest(requestUrl)
  if (requestUrl && !displayedRequest) {
    return <ResultState state="invalid" title="Invalid DataCite search request" detail="The displayed request was not the supported exact DataCite DOI search request."/>
  }
  const execution = executedRequestIdentity(executedRequest, requestUrl)
  if (execution.invalid) {
    return <ResultState state="invalid" title="Invalid DataCite executed request" detail="The successful response is not bound to the exact supported bodyless GET DataCite DOI search request."/>
  }
  const request = execution.request ?? displayedRequest
  if (!request) {
    return <ResultState state="invalid" title="Invalid DataCite search request" detail="The successful response was not tied to the supported exact DataCite DOI search request."/>
  }
  const requestBound = Boolean(execution.request)

  const parsed = parseResult(data, request)
  if (!parsed.result) {
    return <ResultState state="invalid" title="Invalid DataCite search response" detail="DataCite did not return a coherent JSON:API first page whose self link matches the selected search." request={request} requestBound={requestBound} selfContract={parsed.selfContract}/>
  }
  const result = parsed.result

  if (result.providerRecordCount === 0) {
    if (result.total === 0 && result.totalPages === 0 && result.countContract) {
      if (requestBound) return <ResultState state="empty" title="No DataCite DOI records matched" detail={`DataCite returned a request-bound zero-result first page for “${request.query}”.`} request={request} requestBound selfContract countContract/>
      return <ResultState state="partial" title="DataCite request identity unavailable" detail="DataCite returned a coherent zero-result first page, but the executed request transport is unavailable, so the response is not trusted as a request-bound no-match result." request={request} selfContract countContract/>
    }
    return <ResultState state="invalid" title="Invalid DataCite empty response" detail="The empty HTTP-success response did not include a coherent zero-result count." request={request} requestBound={requestBound} selfContract countContract={result.countContract}/>
  }

  if (!result.records.length) {
    return <ResultState state="invalid" title="Invalid DataCite DOI identities" detail="DataCite returned DOI rows, but none carried a unique coherent DOI identifier and title." request={request} requestBound={requestBound} selfContract countContract={result.countContract}/>
  }

  const partial = !requestBound || !result.countContract || result.malformedRecordCount > 0 || result.duplicateDoiCount > 0
    || result.incompleteRecordCount > 0 || result.overflowRecordCount > 0
  const primary = result.records[0]

  return <div className="datacite-search-preview domain-card" data-domain-card="datacite-search" data-result-state={partial ? 'partial' : 'ready'}
    data-request-bound={requestBound ? 'true' : 'false'} data-request-contract="exact-datacite-dois-first-page" data-request-query={request.query} data-requested-page-size={request.pageSize}
    data-self-contract="true" data-count-contract={String(result.countContract)} data-provider-total={result.total} data-provider-total-pages={result.totalPages}
    data-provider-page={result.page} data-provider-record-count={result.providerRecordCount} data-valid-record-count={result.records.length}
    data-malformed-record-count={result.malformedRecordCount} data-duplicate-doi-count={result.duplicateDoiCount}
    data-incomplete-record-count={result.incompleteRecordCount} data-overflow-record-count={result.overflowRecordCount} data-primary-doi={primary.doi}>
    <header className="domain-heading">
      <div>
        <small className="domain-eyebrow">DataCite DOI metadata search</small>
        <h3>{request.query}</h3>
        <p>DOI metadata returned by the exact DataCite first-page search.</p>
      </div>
      <span className="domain-state">{result.records.length} trusted records</span>
    </header>

    {partial && <p className="domain-note">{requestBound ? 'Request binding is valid, but pagination or record metadata is incomplete. Malformed, duplicate, or over-limit DOI evidence is withheld; raw JSON retains the provider response.' : 'The provider page is internally coherent, but executed-request identity is unavailable, so the result is not marked ready.'}</p>}

    <dl className="domain-facts">
      <div><dt>Requested query</dt><dd>{request.query}</dd></div>
      <div><dt>Total matches</dt><dd>{result.total.toLocaleString('en')}</dd></div>
      <div><dt>First-page size</dt><dd>{result.providerRecordCount} / {request.pageSize}</dd></div>
      <div><dt>Total pages</dt><dd>{result.totalPages.toLocaleString('en')}</dd></div>
      <div><dt>Primary DOI</dt><dd><code>{primary.doi}</code></dd></div>
    </dl>

    <ol className="domain-list" aria-label="DataCite DOI records">
      {result.records.map((record) => <li key={record.doi} data-doi={record.doi}>
        <strong>{record.title}</strong>
        <span>{record.creators.slice(0, 3).join(', ') || 'Creators unavailable'}</span>
        <span>{record.resourceType ?? 'Resource type unavailable'}{record.publicationYear ? ` · ${record.publicationYear}` : ''}{record.publisher ? ` · ${record.publisher}` : ''}</span>
        <code>{record.doi}</code>
      </li>)}
    </ol>

    <p className="domain-note">DataCite metadata is shown as provider evidence. The card withholds rows whose DOI identity or title cannot be established from the response.</p>
  </div>
}
