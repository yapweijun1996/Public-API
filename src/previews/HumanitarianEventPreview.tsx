import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, Facts, numericText, rows } from './cardPrimitives'
import { cleanText } from './previewData'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

const canonicalRequestUrl = 'https://goadmin.ifrc.org/api/v2/event/?limit=6&ordering=-disaster_start_date'
const nativeFieldReportMetrics = [
  'num_affected',
  'num_dead',
  'gov_num_affected',
  'gov_num_dead',
  'gov_num_displaced',
  'other_num_affected',
  'other_num_dead',
  'other_num_displaced',
] as const

type RequestModel = {
  bound: boolean
  method?: string
  limit?: string
  ordering?: string
}

type OptionalCount = { value?: number; malformed: boolean }

type Impact = {
  affected?: number
  dead?: number
  displaced?: number
}

type EventModel = {
  raw: Record<string, unknown>
  id: number
  name: string
  eventAffected: OptionalCount
  activeDeployments: OptionalCount
  latestReport?: Record<string, unknown>
  ifrc?: Impact
  government?: Impact
  other?: Impact
  malformedNativeCount: number
  incomplete: boolean
}

const dateOnly = (value: unknown) => trimmedText(value)?.slice(0, 10) ?? 'Not supplied'
const impactValue = (value: number | undefined) => value === undefined ? 'Not supplied' : numericText(value)
const optionalNativeCount = (value: unknown): OptionalCount => {
  if (value === undefined || value === null) return { malformed: false }
  const parsed = nonNegativeSafeInteger(value)
  return parsed === undefined ? { malformed: true } : { value: parsed, malformed: false }
}

// IFRC GO's Field Report dictionary documents the unprefixed num_displaced
// field as a string. Parse only its exact non-negative integer representation;
// it is intentionally separate from the native-number contract below.
const optionalDisplacedString = (value: unknown): OptionalCount => {
  if (value === undefined || value === null) return { malformed: false }
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) return { malformed: true }
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? { value: parsed, malformed: false } : { malformed: true }
}

const parseRequest = (executedRequest?: ExecutedRequestContext): RequestModel => {
  if (!executedRequest) return { bound: false }
  let parsed: URL | undefined
  try {
    parsed = new URL(executedRequest.url)
  } catch {
    return { bound: false, method: executedRequest.method }
  }
  const limit = parsed.searchParams.get('limit') ?? undefined
  const ordering = parsed.searchParams.get('ordering') ?? undefined
  const bound = executedRequest.method === 'GET'
    && executedRequest.body === undefined
    && executedRequest.url === canonicalRequestUrl
    && parsed.protocol === 'https:'
    && !parsed.username
    && !parsed.password
    && !parsed.hash
    && !parsed.port
    && parsed.hostname === 'goadmin.ifrc.org'
    && parsed.pathname === '/api/v2/event/'
    && parsed.search === '?limit=6&ordering=-disaster_start_date'
    && parsed.searchParams.size === 2
    && limit === '6'
    && ordering === '-disaster_start_date'
  return { bound, method: executedRequest.method, limit, ordering }
}

const requestAttributes = (request: RequestModel) => ({
  'data-request-bound': String(request.bound),
  'data-request-method': request.method,
  'data-request-limit': request.limit,
  'data-request-ordering': request.ordering,
})

const ContractMessage = ({
  state = 'invalid',
  title,
  detail,
  request,
  providerTotal,
  providerEventCount,
  countContract,
  validEventCount = 0,
  invalidEventCount = 0,
  duplicateEventCount = 0,
  malformedNumericCount = 0,
}: {
  state?: 'invalid' | 'empty'
  title: string
  detail: string
  request: RequestModel
  providerTotal?: number
  providerEventCount?: number
  countContract: boolean
  validEventCount?: number
  invalidEventCount?: number
  duplicateEventCount?: number
  malformedNumericCount?: number
}) => <div
  className="domain-card domain-empty"
  data-domain-card="humanitarian-events"
  data-result-state={state}
  data-provider-total={providerTotal}
  data-provider-event-count={providerEventCount}
  data-valid-event-count={validEventCount}
  data-invalid-event-count={invalidEventCount}
  data-duplicate-event-count={duplicateEventCount}
  data-count-contract={String(countContract)}
  data-native-number-contract={String(malformedNumericCount === 0)}
  data-malformed-numeric-count={malformedNumericCount}
  {...requestAttributes(request)}
><h3>{title}</h3><p>{detail}</p></div>

const latestFieldReport = (event: Record<string, unknown>) => {
  const reports = rows(event.field_reports)
  return [...reports].sort((a, b) => (trimmedText(b.report_date) ?? trimmedText(b.updated_at) ?? '').localeCompare(trimmedText(a.report_date) ?? trimmedText(a.updated_at) ?? ''))[0]
}

const buildEventModel = (raw: Record<string, unknown>, id: number, name: string): EventModel => {
  const eventAffected = optionalNativeCount(raw.num_affected)
  const activeDeployments = optionalNativeCount(raw.active_deployments)
  const latestReport = latestFieldReport(raw)
  const metric = (key: typeof nativeFieldReportMetrics[number]) => optionalNativeCount(latestReport?.[key])
  const nativeMetrics = Object.fromEntries(nativeFieldReportMetrics.map((key) => [key, metric(key)])) as Record<typeof nativeFieldReportMetrics[number], OptionalCount>
  const displaced = optionalDisplacedString(latestReport?.num_displaced)
  const malformedNativeCount = Number(eventAffected.malformed)
    + Number(activeDeployments.malformed)
    + nativeFieldReportMetrics.reduce((sum, key) => sum + Number(nativeMetrics[key].malformed), 0)
  const malformedFieldReports = raw.field_reports !== undefined && raw.field_reports !== null && !Array.isArray(raw.field_reports)
  const incomplete = !trimmedText(raw.disaster_start_date)
    || !trimmedText(raw.ifrc_severity_level_display)
    || malformedFieldReports
    || malformedNativeCount > 0
    || displaced.malformed

  return {
    raw,
    id,
    name,
    eventAffected,
    activeDeployments,
    latestReport,
    ifrc: latestReport ? { affected: nativeMetrics.num_affected.value, dead: nativeMetrics.num_dead.value, displaced: displaced.value } : undefined,
    government: latestReport ? { affected: nativeMetrics.gov_num_affected.value, dead: nativeMetrics.gov_num_dead.value, displaced: nativeMetrics.gov_num_displaced.value } : undefined,
    other: latestReport ? { affected: nativeMetrics.other_num_affected.value, dead: nativeMetrics.other_num_dead.value, displaced: nativeMetrics.other_num_displaced.value } : undefined,
    malformedNativeCount,
    incomplete,
  }
}

export function HumanitarianEventPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const request = parseRequest(executedRequest)
  const root = isRecord(data) ? data : undefined
  const providerResults = root && Array.isArray(root.results) ? root.results : undefined
  const providerTotal = root ? nonNegativeSafeInteger(root.count) : undefined
  const countContract = providerResults !== undefined
    && providerTotal !== undefined
    && providerResults.length <= 6
    && providerTotal >= providerResults.length

  if (!request.bound) {
    return <ContractMessage
      title="Invalid IFRC emergency-event request"
      detail="This card only renders the exact bodyless IFRC GO first-page emergency-event request."
      request={request}
      providerTotal={providerTotal}
      providerEventCount={providerResults?.length}
      countContract={Boolean(countContract)}
    />
  }

  if (!countContract || !providerResults) {
    return <ContractMessage
      title="Invalid IFRC emergency-event response"
      detail="IFRC GO did not return a coherent native count and results array within the requested six-event page."
      request={request}
      providerTotal={providerTotal}
      providerEventCount={providerResults?.length}
      countContract={false}
    />
  }

  if (providerResults.length === 0) {
    if (providerTotal !== 0) {
      return <ContractMessage
        title="Invalid IFRC emergency-event response"
        detail="IFRC GO reported matching events but returned an empty first page."
        request={request}
        providerTotal={providerTotal}
        providerEventCount={0}
        countContract={false}
      />
    }
    return <ContractMessage
      state="empty"
      title="No IFRC emergency events returned"
      detail="IFRC GO returned a coherent zero-total first page for this request."
      request={request}
      providerTotal={0}
      providerEventCount={0}
      countContract
    />
  }

  const providerRecords = providerResults.map((value) => isRecord(value) ? value : undefined)
  const idCounts = new Map<number, number>()
  let malformedIdentityNumericCount = 0
  for (const record of providerRecords) {
    if (!record) continue
    const id = positiveSafeInteger(record.id)
    if (id === undefined) {
      if (record.id !== undefined && record.id !== null) malformedIdentityNumericCount += 1
      continue
    }
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1)
  }
  const duplicateIds = new Set([...idCounts].filter(([, count]) => count > 1).map(([id]) => id))
  const duplicateEventCount = providerRecords.reduce((sum, record) => {
    const id = record ? positiveSafeInteger(record.id) : undefined
    return sum + Number(id !== undefined && duplicateIds.has(id))
  }, 0)
  const events = providerRecords.flatMap((record) => {
    if (!record) return []
    const id = positiveSafeInteger(record.id)
    const name = trimmedText(record.name)
    if (id === undefined || name === undefined || duplicateIds.has(id)) return []
    return [buildEventModel(record, id, name)]
  })
  const validEventCount = events.length
  const invalidEventCount = providerResults.length - validEventCount
  const malformedNumericCount = malformedIdentityNumericCount + events.reduce((sum, event) => sum + event.malformedNativeCount, 0)

  if (!validEventCount) {
    return <ContractMessage
      title="Invalid IFRC emergency-event response"
      detail="IFRC GO returned event rows, but none had a unique positive safe-integer emergency ID and official event name."
      request={request}
      providerTotal={providerTotal}
      providerEventCount={providerResults.length}
      countContract
      invalidEventCount={invalidEventCount}
      duplicateEventCount={duplicateEventCount}
      malformedNumericCount={malformedNumericCount}
    />
  }

  const incompleteEventCount = events.filter((event) => event.incomplete).length
  const first = events[0]
  const resultState = invalidEventCount > 0 || incompleteEventCount > 0 ? 'partial' : 'ready'

  return <div
    className="domain-card humanitarian-events-preview"
    data-domain-card="humanitarian-events"
    data-result-state={resultState}
    data-event-count={validEventCount}
    data-provider-total={providerTotal}
    data-count-contract={String(countContract)}
    data-provider-event-count={providerResults.length}
    data-valid-event-count={validEventCount}
    data-invalid-event-count={invalidEventCount}
    data-duplicate-event-count={duplicateEventCount}
    data-incomplete-event-count={incompleteEventCount}
    data-native-number-contract={String(malformedNumericCount === 0)}
    data-malformed-numeric-count={malformedNumericCount}
    data-primary-event-id={first.id}
    data-primary-start-date={trimmedText(first.raw.disaster_start_date)}
    {...requestAttributes(request)}
  >
    <CardHeading
      eyebrow="IFRC GO · Emergency events"
      title={`${validEventCount} trusted emergency event${validEventCount === 1 ? '' : 's'}`}
      description="Ordered by disaster start date. Impact figures remain separated by reporting source instead of being merged into one unsupported total."
    ><span className="domain-state">{resultState === 'partial' ? 'Partial provider records' : 'Source-aware impacts'}</span></CardHeading>

    {resultState === 'partial' && <p className="domain-note">
      {invalidEventCount > 0 ? `${invalidEventCount} provider event row${invalidEventCount === 1 ? ' was' : 's were'} omitted because its provider identity was missing, malformed, or duplicated. ` : ''}
      {incompleteEventCount > 0 ? `${incompleteEventCount} trusted event${incompleteEventCount === 1 ? ' has' : 's have'} incomplete display fields or malformed metrics; those values are withheld.` : ''}
    </p>}

    <ol className="humanitarian-event-list" aria-label="IFRC GO emergency events">
      {events.map((event, index) => {
        const raw = event.raw
        const dtype = asRecord(raw.dtype)
        const countries = rows(raw.countries)
        const startDate = trimmedText(raw.disaster_start_date)
        const reportDate = trimmedText(event.latestReport?.report_date)
        const countryNames = countries.map((country) => trimmedText(country.name)).filter((value): value is string => Boolean(value))
        const countryIso3 = countries.map((country) => trimmedText(country.iso3)).filter((value): value is string => Boolean(value))
        const severity = trimmedText(raw.ifrc_severity_level_display)
        const summary = cleanText(raw.summary)
        const summaryTruncated = Boolean(summary && summary.length > 700)
        const visibleSummary = summaryTruncated ? `${summary!.slice(0, 697)}…` : summary
        return <li
          key={event.id}
          data-event-index={index + 1}
          data-event-id={event.id}
          data-event-name={event.name}
          data-disaster-type={trimmedText(dtype.name)}
          data-start-date={startDate}
          data-country-iso3={countryIso3.join(',')}
          data-severity={severity}
          data-latest-report-date={reportDate}
          data-ifrc-affected={event.ifrc?.affected}
          data-government-affected={event.government?.affected}
          data-other-affected={event.other?.affected}
          data-summary-truncated={summaryTruncated ? 'true' : 'false'}
        >
          <header><div><small>{trimmedText(dtype.name) ?? '—'} · {countryNames.join(', ') || '—'}</small><h4>{event.name}</h4></div><span>{severity ?? '—'}</span></header>
          <Facts items={[
            { label: 'GO emergency ID', value: numericText(event.id) },
            { label: 'Disaster start', value: startDate ? <time dateTime={startDate}>{dateOnly(startDate)}</time> : 'Not supplied' },
            { label: 'GLIDE', value: trimmedText(raw.glide) ?? 'Not supplied' },
            { label: 'Countries', value: countryNames.join(', ') || 'Not supplied' },
            { label: 'Event-level affected figure', value: impactValue(event.eventAffected.value) },
            { label: 'Active deployments', value: impactValue(event.activeDeployments.value) },
            { label: 'Latest public field report', value: reportDate ? <time dateTime={reportDate}>{dateOnly(reportDate)}</time> : 'No field report supplied' },
          ]}/>
          {visibleSummary && <p className="humanitarian-summary">{visibleSummary}{summaryTruncated && <small> Summary excerpt; full provider narrative remains in Raw JSON.</small>}</p>}
          {event.latestReport && <section className="humanitarian-impact" aria-label={`${event.name} latest field report impact figures`}><h4>Latest field report · source-specific impact figures</h4><div className="humanitarian-impact-grid">
            {[['IFRC', event.ifrc], ['Government', event.government], ['Other source', event.other]].map(([label, metrics]) => { const values = metrics as Impact; return <article key={String(label)}><strong>{String(label)}</strong><dl><div><dt>Affected</dt><dd>{impactValue(values.affected)}</dd></div><div><dt>Dead</dt><dd>{impactValue(values.dead)}</dd></div><div><dt>Displaced</dt><dd>{impactValue(values.displaced)}</dd></div></dl></article> })}
          </div></section>}
        </li>
      })}
    </ol>
    <p className="domain-note">IFRC GO documents each event with a non-null GO emergency ID, official event name, disaster start date, and severity display value. Event-level figures and field-report figures come from different reporting scopes, so this card keeps IFRC, government, and other-source values separate; a zero or missing value from one source is not treated as the event-wide humanitarian total.</p>
  </div>
}
