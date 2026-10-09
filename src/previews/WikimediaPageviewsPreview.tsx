import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { Sparkline } from './ChartPrimitives'
import { compactNumber, formatNumber } from './previewData'
import { isRecord, nonNegativeSafeInteger, trimmedText } from './semanticValidation'

type PageviewsState = 'ready' | 'partial' | 'empty' | 'invalid'

type PageviewsRequest = {
  article: string
  startCompact: string
  endCompact: string
  startDate: string
  endDate: string
  startDay: number
  endDay: number
  dayCount: number
}

type PageviewObservation = {
  date: string
  compactDate: string
  timestamp: string
  views: number
}

type PageviewsViewModel = {
  state: PageviewsState
  reason?: string
  request?: PageviewsRequest
  envelopeContract: boolean
  rowIdentityContract: boolean
  dateRangeContract: boolean
  nativeViewContract: boolean
  providerRecordCount: number
  validRecordCount: number
  invalidRecordCount: number
  malformedViewCount: number
  missingDayCount: number
  observations: PageviewObservation[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const EARLIEST_DAY = Date.UTC(2015, 6, 1) / DAY_MS

const parseCompactDay = (value: string) => {
  if (!/^[0-9]{8}$/.test(value)) return undefined
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6))
  const day = Number(value.slice(6, 8))
  const epochMs = Date.UTC(year, month - 1, day)
  const date = new Date(epochMs)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined
  return {
    compact: value,
    iso: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
    epochDay: epochMs / DAY_MS,
  }
}

const parseExecutedRequest = (executedRequest?: ExecutedRequestContext): PageviewsRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length !== 12) return undefined
    const [api, version, metrics, pageviews, mode, project, access, agent, encodedArticle, granularity, startCompact, endCompact] = segments
    const article = decodeURIComponent(encodedArticle)
    const start = parseCompactDay(startCompact)
    const end = parseCompactDay(endCompact)
    if (!start || !end) return undefined
    const dayCount = end.epochDay - start.epochDay + 1
    const valid = url.protocol === 'https:'
      && url.hostname === 'wikimedia.org'
      && url.port === ''
      && !url.username
      && !url.password
      && !url.hash
      && !url.search
      && api === 'api'
      && version === 'rest_v1'
      && metrics === 'metrics'
      && pageviews === 'pageviews'
      && mode === 'per-article'
      && project === 'en.wikipedia.org'
      && access === 'all-access'
      && agent === 'user'
      && granularity === 'daily'
      && article.length > 0
      && article === article.trim()
      && !/\s/.test(article)
      && start.epochDay >= EARLIEST_DAY
      && Number.isSafeInteger(dayCount)
      && dayCount >= 7
      && dayCount <= 90
    return valid ? {
      article,
      startCompact,
      endCompact,
      startDate: start.iso,
      endDate: end.iso,
      startDay: start.epochDay,
      endDay: end.epochDay,
      dayCount,
    } : undefined
  } catch {
    return undefined
  }
}

export const wikimediaPageviewsModel = (data: unknown, executedRequest?: ExecutedRequestContext): PageviewsViewModel => {
  const request = parseExecutedRequest(executedRequest)
  const envelopeContract = isRecord(data) && Array.isArray(data.items)
  const providerRows = envelopeContract ? data.items as unknown[] : []
  const observations: PageviewObservation[] = []
  const seenDays = new Set<string>()
  let invalidRecordCount = 0
  let malformedViewCount = 0
  let rowIdentityContract = Boolean(request && envelopeContract)
  let dateRangeContract = Boolean(request && envelopeContract)
  let nativeViewContract = Boolean(request && envelopeContract)

  if (request && envelopeContract) {
    for (const candidate of providerRows) {
      if (!isRecord(candidate)) {
        invalidRecordCount += 1
        rowIdentityContract = false
        dateRangeContract = false
        nativeViewContract = false
        continue
      }

      const project = trimmedText(candidate.project)
      const article = trimmedText(candidate.article)
      const access = trimmedText(candidate.access)
      const agent = trimmedText(candidate.agent)
      const granularity = trimmedText(candidate.granularity)
      const identityValid = project === 'en.wikipedia'
        && article === request.article
        && access === 'all-access'
        && agent === 'user'
        && granularity === 'daily'
      if (!identityValid) {
        invalidRecordCount += 1
        rowIdentityContract = false
        continue
      }

      const timestamp = trimmedText(candidate.timestamp)
      const compactDate = timestamp && /^[0-9]{10}$/.test(timestamp) && timestamp.endsWith('00') ? timestamp.slice(0, 8) : undefined
      const parsedDay = compactDate ? parseCompactDay(compactDate) : undefined
      const dateValid = Boolean(parsedDay
        && parsedDay.epochDay >= request.startDay
        && parsedDay.epochDay <= request.endDay
        && !seenDays.has(compactDate!))
      if (!dateValid || !timestamp || !compactDate || !parsedDay) {
        invalidRecordCount += 1
        dateRangeContract = false
        continue
      }
      seenDays.add(compactDate)

      const views = nonNegativeSafeInteger(candidate.views)
      if (views === undefined) {
        malformedViewCount += 1
        nativeViewContract = false
        continue
      }

      observations.push({ date: parsedDay.iso, compactDate, timestamp, views })
    }
  }

  observations.sort((left, right) => left.compactDate.localeCompare(right.compactDate))
  const validRecordCount = observations.length
  const missingDayCount = request ? Math.max(0, request.dayCount - validRecordCount) : 0

  let state: PageviewsState = 'invalid'
  let reason: string | undefined
  if (!request) {
    reason = 'The executed request is not the exact supported Wikimedia per-article daily GET request.'
  } else if (!envelopeContract) {
    reason = 'The HTTP-success payload does not contain the documented Wikimedia items array.'
  } else if (providerRows.length === 0) {
    state = 'empty'
    reason = 'No pageview observations returned for the requested article and date range.'
  } else if (validRecordCount === 0) {
    reason = 'No request-matching daily pageview rows with native non-negative integer views could be validated.'
  } else if (invalidRecordCount === 0 && malformedViewCount === 0 && missingDayCount === 0) {
    state = 'ready'
  } else {
    state = 'partial'
    reason = 'Only request-matching daily rows with native integer pageview counts are shown; malformed, mismatched, duplicate, or omitted days are withheld.'
  }

  return {
    state,
    reason,
    request,
    envelopeContract,
    rowIdentityContract,
    dateRangeContract,
    nativeViewContract,
    providerRecordCount: providerRows.length,
    validRecordCount,
    invalidRecordCount,
    malformedViewCount,
    missingDayCount,
    observations,
  }
}

export function WikimediaPageviewsPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const model = wikimediaPageviewsModel(data, executedRequest)
  const request = model.request
  const values = model.observations.map((observation) => observation.views)
  const latest = model.observations.at(-1)
  const total = values.reduce((sum, value) => sum + value, 0)
  const average = values.length ? total / values.length : undefined
  const peak = values.length ? Math.max(...values) : undefined
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(request)),
    'data-request-method': request ? 'GET' : undefined,
    'data-request-article': request?.article,
    'data-request-start-date': request?.startDate,
    'data-request-end-date': request?.endDate,
    'data-request-day-count': request?.dayCount,
    'data-provider-record-count': model.providerRecordCount,
    'data-valid-record-count': model.validRecordCount,
    'data-invalid-record-count': model.invalidRecordCount,
    'data-malformed-view-count': model.malformedViewCount,
    'data-missing-day-count': model.missingDayCount,
    'data-envelope-contract': String(model.envelopeContract),
    'data-row-identity-contract': String(model.rowIdentityContract),
    'data-date-range-contract': String(model.dateRangeContract),
    'data-native-view-contract': String(model.nativeViewContract),
  }

  if (model.state === 'invalid') return <div className="market-preview" data-domain-card="wikimedia-pageviews" {...evidence}>
    <div className="market-summary"><div><span>Pageview evidence unavailable</span><strong>—</strong><small>{model.reason}</small></div></div>
  </div>

  if (model.state === 'empty') return <div className="market-preview" data-domain-card="wikimedia-pageviews" {...evidence}>
    <div className="market-summary"><div><span>{request?.article.replace(/_/g, ' ')} · Daily readers</span><strong>—</strong><small>No pageview observations returned for {request?.startDate} – {request?.endDate}.</small></div></div>
  </div>

  return <div className="market-preview" data-domain-card="wikimedia-pageviews" data-primary-date={latest?.date} data-primary-value={latest?.views} {...evidence}>
    <div className="market-summary"><div><span>{request?.article.replace(/_/g, ' ')} · Daily readers</span><strong>{latest ? `${compactNumber(latest.views)} views` : '—'}</strong><small>{latest ? `${latest.date} · Latest validated day` : model.reason}</small></div><div className="market-range"><span>{request?.startDate}</span><span>{request?.endDate}</span></div></div>
    <Sparkline values={values} label={`${request?.article.replace(/_/g, ' ')} validated daily pageviews from ${request?.startDate} to ${request?.endDate}`}/>
    <div className="market-metrics">
      <article><small>Total views</small><strong>{compactNumber(total)}</strong></article>
      <article><small>Daily average</small><strong>{average === undefined ? '—' : compactNumber(average)}</strong></article>
      <article><small>Peak day</small><strong>{peak === undefined ? '—' : compactNumber(peak)}</strong></article>
      <article><small>Observed days</small><strong>{model.validRecordCount} / {request?.dayCount}</strong></article>
    </div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span></article></div>}
    <ol className="sr-only" aria-label="Wikimedia daily pageview evidence">
      {model.observations.map((observation) => <li key={observation.timestamp}>{observation.date}: {formatNumber(observation.views, 0)} views</li>)}
    </ol>
  </div>
}
