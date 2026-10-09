import './foodRecall.css'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { isRecord, nonNegativeSafeInteger, trimmedText } from './semanticValidation'

type UnknownRecord = Record<string, unknown>
type RequestContract = { query: string; limit: number; transportBound: boolean }
type RequestUrlContract = Omit<RequestContract, 'transportBound'>

const parseRequestUrl = (requestUrl?: string): RequestUrlContract | null | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    const exactKeys = keys.length === 2
      && keys.filter((key) => key === 'search').length === 1
      && keys.filter((key) => key === 'limit').length === 1
    const match = /^product_description:"([^"\\]+)" OR reason_for_recall:"([^"\\]+)"$/.exec(url.searchParams.get('search') ?? '')
    const query = match?.[1].trim() ?? ''
    const secondQuery = match?.[2].trim() ?? ''
    const limitText = url.searchParams.get('limit') ?? ''
    const limit = /^\d+$/.test(limitText) ? Number(limitText) : Number.NaN
    if (url.protocol !== 'https:' || url.hostname !== 'api.fda.gov' || url.port || url.username || url.password
      || url.pathname !== '/food/enforcement.json' || url.hash || !exactKeys || !query || query !== secondQuery
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 30 || String(limit) !== limitText) return null
    return { query, limit }
  } catch {
    return null
  }
}

const parseRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestContract | null | undefined => {
  const displayedRequest = parseRequestUrl(requestUrl)
  if (requestUrl && !displayedRequest) return null
  if (!executedRequest) return displayedRequest ? { ...displayedRequest, transportBound: false } : undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return null
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return null
  const executed = parseRequestUrl(executedRequest.url)
  return executed ? { ...executed, transportBound: true } : null
}

const cleanText = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined
const normalized = (value: string) => value.toLocaleLowerCase('en')
const matchesQuery = (record: UnknownRecord, query: string) => {
  const needle = normalized(query)
  return [cleanText(record.product_description), cleanText(record.reason_for_recall)]
    .some((value) => value !== undefined && normalized(value).includes(needle))
}

const fdaDate = (value: unknown) => {
  const text = cleanText(value)
  if (!text) return '—'
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  return text
}

const recallLocation = (record: UnknownRecord) => {
  const cityState = [cleanText(record.city), cleanText(record.state)].filter(Boolean).join(', ')
  return [cityState, cleanText(record.country)].filter(Boolean).join(' · ') || '—'
}

const field = (value: unknown) => cleanText(value) ?? '—'

export function FoodRecallPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = parseRequest(requestUrl, executedRequest)
  if (request === null || request === undefined) {
    return <CardEmpty domain="food-recalls" title="Invalid openFDA food-recall request" detail="The successful response was not tied to the supported product-description / recall-reason phrase search." state="invalid"/>
  }
  if (!isRecord(data) || !Array.isArray(data.results)) {
    return <CardEmpty domain="food-recalls" title="Invalid openFDA food-recall response" detail="openFDA did not return the documented food-enforcement results array." state="invalid"/>
  }

  const rawResults = data.results
  const meta = isRecord(data.meta) ? data.meta : undefined
  const metaResults = meta && isRecord(meta.results) ? meta.results : undefined
  const skip = metaResults ? nonNegativeSafeInteger(metaResults.skip) : undefined
  const providerLimit = metaResults ? nonNegativeSafeInteger(metaResults.limit) : undefined
  const total = metaResults ? nonNegativeSafeInteger(metaResults.total) : undefined
  const paginationCoherent = skip === 0
    && providerLimit === request.limit
    && total !== undefined
    && total >= rawResults.length
    && rawResults.length <= request.limit

  if (!rawResults.length) {
    if (paginationCoherent && total === 0) {
      if (request.transportBound) return <CardEmpty domain="food-recalls" title="No openFDA food recalls returned" detail={`The provider returned no enforcement records whose product description or recall reason matched the request-bound phrase “${request.query}”.`} state="empty"/>
      return <div className="domain-card domain-empty" data-domain-card="food-recalls" data-result-state="partial" data-request-bound="false" data-requested-query={request.query} data-requested-limit={request.limit}><h3>openFDA food-recall request identity unavailable</h3><p>openFDA returned a coherent zero-result response, but the executed request transport is unavailable, so it is not trusted as a request-bound no-match result.</p></div>
    }
    return <CardEmpty domain="food-recalls" title="Invalid openFDA food-recall response" detail="The empty response did not include coherent openFDA pagination evidence." state="invalid"/>
  }

  const trusted: UnknownRecord[] = []
  let malformedIdentityCount = 0
  let queryMismatchCount = 0
  for (const value of rawResults) {
    if (!isRecord(value) || !trimmedText(value.recall_number)) {
      malformedIdentityCount += 1
      continue
    }
    if (!matchesQuery(value, request.query)) {
      queryMismatchCount += 1
      continue
    }
    trusted.push(value)
  }

  if (!trusted.length) {
    return <CardEmpty domain="food-recalls" title="Invalid openFDA food-recall response" detail="The provider returned enforcement rows, but none had a trusted recall identity that acknowledged the executed product/reason search." state="invalid"/>
  }

  const primary = trusted[0]
  const updated = cleanText(meta?.last_updated) ?? '—'
  const invalidRecordCount = rawResults.length - trusted.length
  const partial = !request.transportBound || !paginationCoherent || invalidRecordCount > 0
  const recallNumber = field(primary.recall_number)
  const product = field(primary.product_description)
  const classification = field(primary.classification)
  const status = field(primary.status)
  const firm = field(primary.recalling_firm)
  const initiationDate = fdaDate(primary.recall_initiation_date)
  const reportDate = fdaDate(primary.report_date)
  const totalDisplay = total === undefined ? 'Unavailable' : total.toLocaleString('en')

  return <div
    className="food-recall-preview domain-card"
    data-result-state={partial ? 'partial' : 'ready'}
    data-request-bound={request.transportBound ? 'true' : 'false'}
    data-requested-query={request.query}
    data-requested-limit={request.limit}
    data-provider-record-count={rawResults.length}
    data-valid-record-count={trusted.length}
    data-invalid-record-count={invalidRecordCount}
    data-query-mismatch-count={queryMismatchCount}
    data-malformed-identity-count={malformedIdentityCount}
    data-pagination-coherent={paginationCoherent ? 'true' : 'false'}
    data-primary-recall-number={recallNumber === '—' ? '' : recallNumber}
    data-primary-classification={classification === '—' ? '' : classification}
    data-primary-status={status === '—' ? '' : status}
    data-primary-recalling-firm={firm === '—' ? '' : firm}
    data-primary-recall-initiation-date={initiationDate === '—' ? '' : initiationDate}
    data-provider-match-count={total ?? ''}
    data-provider-last-updated={updated === '—' ? '' : updated}
  >
    <header className="domain-heading food-recall-heading">
      <div>
        <small className="domain-eyebrow">FDA food enforcement report</small>
        <h3>{recallNumber === '—' ? 'Food recall enforcement record' : `Recall ${recallNumber}`}</h3>
        <p>{product}</p>
      </div>
      <span className={`domain-state ${classification === 'Class I' ? 'warning' : ''}`}>{classification}</span>
    </header>

    {partial && <p className="domain-note">{request.transportBound ? 'Only records tied to the executed product-description / recall-reason phrase search are trusted. Query mismatches, malformed identities, or incoherent pagination evidence are withheld or marked unavailable.' : 'The returned records are structurally consistent with the displayed product/reason search, but executed transport identity is unavailable, so the result cannot be marked ready.'}</p>}

    <dl className="domain-facts">
      <div><dt>Recalling firm</dt><dd>{firm}</dd></div>
      <div><dt>Status</dt><dd>{status}</dd></div>
      <div><dt>Recall initiated</dt><dd>{initiationDate}</dd></div>
      <div><dt>Enforcement report</dt><dd>{reportDate}</dd></div>
      <div><dt>Location</dt><dd>{recallLocation(primary)}</dd></div>
      <div><dt>Initiation</dt><dd>{field(primary.voluntary_mandated)}</dd></div>
      <div><dt>Quantity</dt><dd>{field(primary.product_quantity)}</dd></div>
      <div><dt>Distribution</dt><dd>{field(primary.distribution_pattern)}</dd></div>
    </dl>

    <section className="food-recall-narratives" aria-label="Primary recall details">
      <article><small>Product</small><h4>Recalled product</h4><p>{product}</p></article>
      <article><small>Reason</small><h4>Reason for recall</h4><p>{field(primary.reason_for_recall)}</p></article>
      <article><small>Identification</small><h4>Code / lot information</h4><p>{field(primary.code_info)}</p></article>
    </section>

    {trusted.length > 1 && <section className="food-recall-related" aria-labelledby="food-recall-related-heading">
      <header>
        <div><small className="domain-eyebrow">Trusted returned matches</small><h4 id="food-recall-related-heading">Other recall records</h4></div>
        <span>{trusted.length - 1} more shown · {totalDisplay} provider matches</span>
      </header>
      <ol>{trusted.slice(1).map((record, index) => <li key={`${field(record.recall_number)}-${index}`}>
        <div><strong>{field(record.recall_number)}</strong><span>{field(record.classification)} · {field(record.status)}</span></div>
        <p>{field(record.product_description)}</p><small>{field(record.recalling_firm)}</small>
      </li>)}</ol>
    </section>}

    <p className="domain-note">Dataset updated {updated}. This is public FDA enforcement-report data and may be revised by the provider. Raw JSON retains the complete returned records.</p>
  </div>
}
