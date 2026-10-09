import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { compactNumber, previewLabel } from './previewData'
import { isRecord, nonNegativeSafeInteger, optionalTrimmedText, positiveSafeInteger, trimmedText } from './semanticValidation'

const CROSSREF_SELECT = 'DOI,title,author,published,publisher,is-referenced-by-count,type,URL'

type CrossrefRequest = { query: string; rows: number }

type CrossrefWork = {
  doi: string
  url: string
  title?: string
  authors: string[]
  publishedYear?: number
  publisher?: string
  referenceCount?: number
  type?: string
  incomplete: boolean
}

const requestIdentity = (requestUrl?: string): CrossrefRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'api.crossref.org' || url.port || url.username || url.password
      || url.pathname !== '/v1/works' || url.hash || keys.some((key) => !['query', 'rows', 'select'].includes(key))
      || url.searchParams.getAll('query').length !== 1 || url.searchParams.getAll('rows').length !== 1
      || url.searchParams.getAll('select').length !== 1 || url.searchParams.get('select') !== CROSSREF_SELECT) return undefined
    const query = url.searchParams.get('query') ?? ''
    const rowsText = url.searchParams.get('rows') ?? ''
    if (!query.trim() || query !== query.trim() || !/^\d+$/.test(rowsText)) return undefined
    const rows = Number(rowsText)
    return Number.isInteger(rows) && rows >= 1 && rows <= 20 ? { query, rows } : undefined
  } catch {
    return undefined
  }
}

const executedRequestIdentity = (executedRequest?: ExecutedRequestContext, requestUrl?: string): { request?: CrossrefRequest; invalid: boolean } => {
  if (!executedRequest) return { invalid: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return { invalid: true }
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return { invalid: true }
  const request = requestIdentity(executedRequest.url)
  return request ? { request, invalid: false } : { invalid: true }
}

const doiFromUrl = (value: unknown): string | undefined => {
  const url = trimmedText(value)
  if (!url || !url.toLowerCase().startsWith('https://doi.org/')) return undefined
  try {
    return decodeURIComponent(url.slice('https://doi.org/'.length))
  } catch {
    return undefined
  }
}

const textList = (value: unknown): { values: string[]; malformed: boolean } => {
  if (value === undefined || value === null) return { values: [], malformed: false }
  if (!Array.isArray(value)) return { values: [], malformed: true }
  const values = value.map(trimmedText).filter((item): item is string => item !== undefined)
  return { values, malformed: values.length !== value.length }
}

const authorList = (value: unknown): { values: string[]; malformed: boolean } => {
  if (value === undefined || value === null) return { values: [], malformed: false }
  if (!Array.isArray(value)) return { values: [], malformed: true }
  let malformed = false
  const values = value.flatMap((entry) => {
    if (!isRecord(entry)) {
      malformed = true
      return []
    }
    const given = optionalTrimmedText(entry.given)
    const family = optionalTrimmedText(entry.family)
    const name = optionalTrimmedText(entry.name)
    if (given.malformed || family.malformed || name.malformed) malformed = true
    const displayName = [given.value, family.value].filter(Boolean).join(' ') || name.value
    if (!displayName) malformed = true
    return displayName ? [displayName] : []
  })
  return { values, malformed }
}

const publicationYear = (value: unknown): { value?: number; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  if (!isRecord(value) || !Array.isArray(value['date-parts']) || !Array.isArray(value['date-parts'][0])) return { malformed: true }
  const year = positiveSafeInteger(value['date-parts'][0][0])
  return year !== undefined && year <= 9999 ? { value: year, malformed: false } : { malformed: true }
}

const parseWork = (value: unknown): CrossrefWork | undefined => {
  if (!isRecord(value)) return undefined
  const doi = trimmedText(value.DOI)
  const providerUrl = trimmedText(value.URL)
  const urlDoi = doiFromUrl(providerUrl)
  if (!doi || !providerUrl || !urlDoi || !/^10\.\d{4,9}\/.+$/i.test(doi) || urlDoi.toLowerCase() !== doi.toLowerCase()) return undefined

  const titles = textList(value.title)
  const authors = authorList(value.author)
  const published = publicationYear(value.published)
  const publisher = optionalTrimmedText(value.publisher)
  const type = optionalTrimmedText(value.type)
  const referenceCount = nonNegativeSafeInteger(value['is-referenced-by-count'])
  const referenceCountMalformed = value['is-referenced-by-count'] !== undefined && value['is-referenced-by-count'] !== null && referenceCount === undefined
  const title = titles.values[0]
  const incomplete = titles.malformed || authors.malformed || published.malformed || publisher.malformed || type.malformed || referenceCountMalformed
    || !title || authors.values.length === 0 || published.value === undefined || !publisher.value || !type.value || referenceCount === undefined

  return { doi, url: providerUrl, title, authors: authors.values, publishedYear: published.value, publisher: publisher.value, referenceCount, type: type.value, incomplete }
}

function ResultState({ state, title, detail, request, requestBound = false, queryContract, countContract }: {
  state: 'invalid' | 'empty' | 'partial'
  title: string
  detail: string
  request?: CrossrefRequest
  requestBound?: boolean
  queryContract?: boolean
  countContract?: boolean
}) {
  return <div className="domain-card domain-empty" data-domain-card="crossref-works-search" data-result-state={state}
    data-request-query={request?.query} data-request-rows={request?.rows} data-request-bound={requestBound ? 'true' : 'false'}
    data-query-contract={queryContract === undefined ? undefined : String(queryContract)} data-count-contract={countContract === undefined ? undefined : String(countContract)}>
    <h3>{title}</h3><p>{detail}</p>
  </div>
}

export function CrossrefWorksPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const displayedRequest = requestIdentity(requestUrl)
  if (requestUrl && !displayedRequest) return <ResultState state="invalid" title="Invalid Crossref request identity" detail="The displayed request was not the supported versioned Crossref works query."/>
  const execution = executedRequestIdentity(executedRequest, requestUrl)
  if (execution.invalid) return <ResultState state="invalid" title="Invalid Crossref executed request" detail="The successful response is not bound to the exact supported bodyless GET Crossref works request."/>
  const request = execution.request ?? displayedRequest
  const requestBound = Boolean(execution.request)

  if (!isRecord(data) || data.status !== 'ok' || data['message-type'] !== 'work-list' || !trimmedText(data['message-version']) || !isRecord(data.message) || !Array.isArray(data.message.items)) {
    return <ResultState state="invalid" title="Invalid Crossref works response" detail="Crossref did not return the documented successful work-list envelope with an items array." request={request} requestBound={requestBound}/>
  }

  const message = data.message as Record<string, unknown>
  const providerItems = message.items as unknown[]
  const providerItemsPerPage = nonNegativeSafeInteger(message['items-per-page'])
  const providerTotalResults = nonNegativeSafeInteger(message['total-results'])
  const providerQuery = isRecord(message.query) ? message.query : undefined
  const providerStartIndex = providerQuery ? nonNegativeSafeInteger(providerQuery['start-index']) : undefined
  const providerSearchTerms = providerQuery ? trimmedText(providerQuery['search-terms']) : undefined
  const queryContract = Boolean(request && providerStartIndex === 0 && providerSearchTerms === request.query)
  const countContract = Boolean(request && providerItemsPerPage === request.rows && providerTotalResults !== undefined
    && providerTotalResults >= providerItems.length && providerItems.length === Math.min(request.rows, providerTotalResults))

  if (request && !queryContract) {
    return <ResultState state="invalid" title="Invalid Crossref search acknowledgement" detail="Crossref did not acknowledge the selected search terms and first-page position, so these works cannot be trusted as results for this request." request={request} requestBound={requestBound} queryContract={false} countContract={countContract}/>
  }

  if (providerItems.length === 0) {
    if (request && queryContract && countContract && providerTotalResults === 0) {
      if (requestBound) return <ResultState state="empty" title="No Crossref works matched" detail={`Crossref acknowledged the first-page search for “${request.query}” and returned zero matching works.`} request={request} requestBound queryContract countContract/>
      return <ResultState state="partial" title="Crossref request identity unavailable" detail="Crossref returned a coherent zero-result page, but the executed request transport is unavailable, so the response is not trusted as a request-bound no-match result." request={request} queryContract countContract/>
    }
    return <ResultState state="invalid" title="Invalid Crossref empty response" detail="The empty HTTP-success response did not include a coherent zero-result count and query acknowledgement." request={request} requestBound={requestBound} queryContract={queryContract} countContract={countContract}/>
  }

  const seen = new Set<string>()
  const trusted = providerItems.flatMap((item) => {
    const parsed = parseWork(item)
    if (!parsed || seen.has(parsed.doi.toLowerCase())) return []
    seen.add(parsed.doi.toLowerCase())
    return [parsed]
  })
  const invalidItemCount = providerItems.length - trusted.length
  if (!trusted.length) {
    return <ResultState state="invalid" title="Invalid Crossref work identities" detail="Crossref returned work rows, but none carried a unique coherent DOI and DOI URL identity." request={request} requestBound={requestBound} queryContract={queryContract} countContract={countContract}/>
  }

  const incompleteItemCount = trusted.filter((work) => work.incomplete).length
  const state = requestBound && request && queryContract && countContract && invalidItemCount === 0 && incompleteItemCount === 0 ? 'ready' : 'partial'

  return <div className="domain-card crossref-preview" data-domain-card="crossref-works-search" data-result-state={state}
    data-request-query={request?.query} data-request-rows={request?.rows} data-request-bound={requestBound ? 'true' : 'false'}
    data-provider-search-terms={providerSearchTerms} data-provider-start-index={providerStartIndex} data-provider-items-per-page={providerItemsPerPage}
    data-provider-total-results={providerTotalResults} data-provider-item-count={providerItems.length} data-valid-item-count={trusted.length}
    data-invalid-item-count={invalidItemCount} data-incomplete-item-count={incompleteItemCount} data-query-contract={String(queryContract)}
    data-count-contract={String(countContract)} data-primary-doi={trusted[0].doi}>
    <header><div><small>Crossref scholarly index</small><strong>{providerTotalResults === undefined ? 'Total unavailable' : `${compactNumber(providerTotalResults)} matching works`}</strong></div><span>{trusted.length} trusted</span></header>
    {state === 'partial' && <p className="domain-note">This first page is only partially trusted because its executed-request binding, pagination, work identity, or selected metadata is incomplete. Untrusted rows and values are withheld.</p>}
    <ol>{trusted.slice(0, 8).map((work, index) => <li key={work.doi}><span>{String(index + 1).padStart(2, '0')}</span><article>
      <header><small>{work.type ? previewLabel(work.type) : 'Type unavailable'} · {work.publishedYear ?? 'Publication year unavailable'}</small><b>{work.referenceCount === undefined ? 'Citation count unavailable' : `${compactNumber(work.referenceCount)} citations`}</b></header>
      <h3>{work.title ?? work.doi}</h3>
      <p>{work.authors.slice(0, 3).join(', ') || 'Authorship unavailable'} · {work.publisher ?? 'Publisher unavailable'}</p>
      <code>{work.doi}</code>
    </article></li>)}</ol>
  </div>
}
