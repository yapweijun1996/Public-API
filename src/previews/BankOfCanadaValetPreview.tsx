import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { Sparkline } from './ChartPrimitives'
import { isRecord, trimmedText } from './semanticValidation'

type ValetRequest = {
  series: string
  startDate: string
  endDate: string
  startDay: number
  endDay: number
}

type ValetObservation = {
  date: string
  epochDay: number
  rawValue: string
  value: number
}

type ValetState = 'ready' | 'partial' | 'empty' | 'invalid'

type ValetViewModel = {
  state: ValetState
  reason?: string
  request?: ValetRequest
  envelopeContract: boolean
  seriesIdentityContract: boolean
  dateRangeContract: boolean
  decimalStringContract: boolean
  providerSeries?: string
  seriesLabel?: string
  seriesDescription?: string
  providerRecordCount: number
  validRecordCount: number
  invalidRecordCount: number
  missingValueCount: number
  malformedValueCount: number
  observations: ValetObservation[]
}

const parseIsoDay = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return undefined
  return Math.floor(date.getTime() / 86_400_000)
}

const exactSearchKeys = (url: URL, allowedKeys: string[]) => {
  const entries = [...url.searchParams.entries()]
  return entries.length === allowedKeys.length
    && entries.every(([key]) => allowedKeys.includes(key))
    && allowedKeys.every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
}

const parseExecutedRequest = (executedRequest?: ExecutedRequestContext): ValetRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const path = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment))
    const series = path[2]
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')
    const startDay = parseIsoDay(startDate)
    const endDay = parseIsoDay(endDate)
    const valid = url.protocol === 'https:'
      && url.hostname === 'www.bankofcanada.ca'
      && url.port === ''
      && !url.username
      && !url.password
      && !url.hash
      && path.length === 4
      && path[0] === 'valet'
      && path[1] === 'observations'
      && path[3] === 'json'
      && Boolean(series && /^[A-Za-z0-9_.-]+$/.test(series))
      && url.pathname === `/valet/observations/${encodeURIComponent(series ?? '')}/json`
      && exactSearchKeys(url, ['start_date', 'end_date'])
      && startDate !== null
      && endDate !== null
      && startDay !== undefined
      && endDay !== undefined
      && endDay >= startDay
    return valid && series && startDate && endDate && startDay !== undefined && endDay !== undefined
      ? { series, startDate, endDate, startDay, endDay }
      : undefined
  } catch {
    return undefined
  }
}

const parseValetDecimal = (value: unknown) => {
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const bankOfCanadaValetModel = (data: unknown, executedRequest?: ExecutedRequestContext): ValetViewModel => {
  const request = parseExecutedRequest(executedRequest)
  const envelopeContract = isRecord(data) && isRecord(data.seriesDetail) && Array.isArray(data.observations)
  const seriesDetail = envelopeContract ? data.seriesDetail as Record<string, unknown> : {}
  const providerRows = envelopeContract ? data.observations as unknown[] : []
  const providerSeriesKeys = Object.keys(seriesDetail)
  const providerSeries = providerSeriesKeys.length === 1 ? providerSeriesKeys[0] : undefined
  const detail = providerSeries && isRecord(seriesDetail[providerSeries]) ? seriesDetail[providerSeries] : undefined
  const dimension = detail && isRecord(detail.dimension) ? detail.dimension : undefined
  const seriesLabel = trimmedText(detail?.label)
  const seriesDescription = trimmedText(detail?.description)
  const seriesIdentityContract = Boolean(
    request
    && providerSeries === request.series
    && detail
    && seriesLabel
    && seriesDescription
    && dimension?.key === 'd'
    && dimension?.name === 'Date',
  )

  let invalidRecordCount = 0
  let missingValueCount = 0
  let malformedValueCount = 0
  const observations: ValetObservation[] = []
  const seenDays = new Set<number>()

  if (request && envelopeContract && seriesIdentityContract) {
    for (const candidate of providerRows) {
      if (!isRecord(candidate)) {
        invalidRecordCount += 1
        continue
      }
      const date = trimmedText(candidate.d)
      const epochDay = date ? parseIsoDay(date) : undefined
      const rawSeriesValue = candidate[request.series]
      const seriesValue = isRecord(rawSeriesValue) ? rawSeriesValue : undefined
      const rowKeys = Object.keys(candidate)
      const identityValid = date !== undefined
        && epochDay !== undefined
        && epochDay >= request.startDay
        && epochDay <= request.endDay
        && !seenDays.has(epochDay)
        && seriesValue !== undefined
        && rowKeys.length === 2
        && rowKeys.includes('d')
        && rowKeys.includes(request.series)
      if (!identityValid || epochDay === undefined || !date || !seriesValue) {
        invalidRecordCount += 1
        continue
      }
      seenDays.add(epochDay)
      const rawValue = seriesValue.v
      if (rawValue === undefined || rawValue === null) {
        missingValueCount += 1
        continue
      }
      const value = parseValetDecimal(rawValue)
      if (value === undefined || typeof rawValue !== 'string') {
        malformedValueCount += 1
        continue
      }
      observations.push({ date, epochDay, rawValue, value })
    }
  }

  observations.sort((left, right) => left.epochDay - right.epochDay)
  const dateRangeContract = Boolean(request
    && envelopeContract
    && seriesIdentityContract
    && invalidRecordCount === 0)
  const decimalStringContract = Boolean(request
    && envelopeContract
    && seriesIdentityContract
    && malformedValueCount === 0)

  let state: ValetState = 'invalid'
  let reason: string | undefined
  if (!request) {
    reason = 'The executed request is not the exact supported Bank of Canada Valet series GET request.'
  } else if (!envelopeContract) {
    reason = 'The HTTP-success payload does not contain the documented seriesDetail and observations envelope.'
  } else if (!seriesIdentityContract) {
    reason = 'Bank of Canada series metadata does not identify the series in the executed request.'
  } else if (providerRows.length === 0) {
    state = 'empty'
  } else if (observations.length === 0) {
    reason = 'No request-matching observations with documented decimal-string values could be validated.'
  } else if (invalidRecordCount === 0 && missingValueCount === 0 && malformedValueCount === 0) {
    state = 'ready'
  } else {
    state = 'partial'
    reason = 'Only request-matching observations with documented decimal-string values are shown; invalid or unavailable rows are withheld.'
  }

  return {
    state,
    reason,
    request,
    envelopeContract,
    seriesIdentityContract,
    dateRangeContract,
    decimalStringContract,
    providerSeries,
    seriesLabel,
    seriesDescription,
    providerRecordCount: providerRows.length,
    validRecordCount: observations.length,
    invalidRecordCount,
    missingValueCount,
    malformedValueCount,
    observations,
  }
}

export function BankOfCanadaValetPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const model = bankOfCanadaValetModel(data, executedRequest)
  const latest = model.observations.at(-1)
  const high = model.observations.reduce<ValetObservation | undefined>((current, observation) => !current || observation.value > current.value ? observation : current, undefined)
  const low = model.observations.reduce<ValetObservation | undefined>((current, observation) => !current || observation.value < current.value ? observation : current, undefined)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(model.request)),
    'data-request-method': model.request ? 'GET' : undefined,
    'data-request-series': model.request?.series,
    'data-request-start-date': model.request?.startDate,
    'data-request-end-date': model.request?.endDate,
    'data-provider-series': model.providerSeries,
    'data-provider-record-count': model.providerRecordCount,
    'data-valid-record-count': model.validRecordCount,
    'data-invalid-record-count': model.invalidRecordCount,
    'data-missing-value-count': model.missingValueCount,
    'data-malformed-value-count': model.malformedValueCount,
    'data-envelope-contract': String(model.envelopeContract),
    'data-series-identity-contract': String(model.seriesIdentityContract),
    'data-date-range-contract': String(model.dateRangeContract),
    'data-decimal-string-contract': String(model.decimalStringContract),
  }

  if (model.state === 'invalid') return <div className="market-preview" data-domain-card="bank-of-canada-series" {...evidence}>
    <div className="market-summary"><div><span>Bank of Canada evidence unavailable</span><strong>—</strong><small>{model.reason}</small></div></div>
  </div>

  if (model.state === 'empty') return <div className="market-preview" data-domain-card="bank-of-canada-series" {...evidence}>
    <div className="market-summary"><div><span>{model.seriesLabel} · Bank of Canada</span><strong>—</strong><small>No observations returned for {model.request?.startDate} – {model.request?.endDate}.</small></div></div>
  </div>

  const values = model.observations.map((observation) => observation.value)
  return <div
    className="market-preview"
    data-domain-card="bank-of-canada-series"
    data-primary-date={latest?.date}
    data-primary-value={latest?.rawValue}
    {...evidence}
  >
    <div className="market-summary"><div><span>{model.seriesLabel} · Bank of Canada</span><strong>{latest?.rawValue ?? '—'}</strong><small>{latest?.date} · Latest validated observation</small></div><div className="market-range"><span>{model.request?.startDate}</span><span>{model.request?.endDate}</span></div></div>
    <Sparkline values={values} label={`${model.seriesLabel} validated Bank of Canada observations from ${model.request?.startDate} to ${model.request?.endDate}`}/>
    <div className="market-metrics">
      <article><small>Series high</small><strong>{high?.rawValue ?? '—'}</strong></article>
      <article><small>Series low</small><strong>{low?.rawValue ?? '—'}</strong></article>
      <article><small>Validated observations</small><strong>{model.validRecordCount} / {model.providerRecordCount}</strong></article>
    </div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span></article></div>}
    <p className="sr-only">{model.seriesDescription}</p>
    <ol className="sr-only" aria-label="Bank of Canada validated observation evidence">
      {model.observations.map((observation) => <li key={observation.date}>{observation.date}: {observation.rawValue}</li>)}
    </ol>
  </div>
}
