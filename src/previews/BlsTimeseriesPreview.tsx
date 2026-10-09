import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { Sparkline } from './ChartPrimitives'
import { isRecord, nonNegativeSafeInteger } from './semanticValidation'

type BlsState = 'ready' | 'partial' | 'empty' | 'invalid'

type BlsRequest = {
  series: string
  label: string
}

type BlsObservation = {
  year: string
  period: string
  periodName: string
  periodKey: string
  ordinal: number
  rawValue?: string
  value?: number
  valueKind: 'valid' | 'missing' | 'malformed'
}

type BlsViewModel = {
  state: BlsState
  reason?: string
  request?: BlsRequest
  envelopeContract: boolean
  statusContract: boolean
  responseTimeContract: boolean
  messageContract: boolean
  resultsContract: boolean
  resultsShape?: 'object' | 'array'
  seriesIdentityContract: boolean
  rowUniquenessContract: boolean
  rowOrderContract: boolean
  periodContract: boolean
  threeYearContract: boolean
  decimalStringContract: boolean
  responseTime?: number
  providerMessageCount: number
  providerSeries?: string
  providerSeriesCount: number
  providerRowCount: number
  validRowCount: number
  invalidRowCount: number
  validValueCount: number
  missingValueCount: number
  malformedValueCount: number
  observations: BlsObservation[]
}

const periodNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Annual',
] as const

const catalogSeries = (api: ApiDemo) => new Map(
  api.fields.find((field) => field.id === 'seriesId')?.options?.map(({ value, label }) => [value, label]) ?? [],
)

const parseExecutedRequest = (api: ApiDemo, executedRequest?: ExecutedRequestContext): BlsRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const path = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment))
    const series = path[4]
    const label = series ? catalogSeries(api).get(series) : undefined
    const valid = url.protocol === 'https:'
      && url.hostname === 'api.bls.gov'
      && url.port === ''
      && !url.username
      && !url.password
      && !url.hash
      && url.search === ''
      && path.length === 5
      && path.slice(0, 4).join('/') === 'publicAPI/v1/timeseries/data'
      && Boolean(series && label)
      && url.pathname === `/publicAPI/v1/timeseries/data/${encodeURIComponent(series ?? '')}`
      && executedRequest.url === `https://api.bls.gov/publicAPI/v1/timeseries/data/${encodeURIComponent(series ?? '')}`
    return valid && series && label ? { series, label } : undefined
  } catch {
    return undefined
  }
}

const parseYear = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) return undefined
  const year = Number(value)
  return Number.isSafeInteger(year) ? year : undefined
}

const parsePeriod = (period: unknown, periodName: unknown) => {
  if (typeof period !== 'string' || !/^M(?:0[1-9]|1[0-3])$/.test(period)) return undefined
  const number = Number(period.slice(1))
  return typeof periodName === 'string' && periodName === periodNames[number - 1] ? number : undefined
}

const parseBlsDecimal = (value: unknown) => {
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const blsTimeseriesModel = (
  api: ApiDemo,
  data: unknown,
  executedRequest?: ExecutedRequestContext,
): BlsViewModel => {
  const request = parseExecutedRequest(api, executedRequest)
  const objectEnvelope = isRecord(data)
  const statusContract = objectEnvelope && data.status === 'REQUEST_SUCCEEDED'
  const responseTime = objectEnvelope ? nonNegativeSafeInteger(data.responseTime) : undefined
  const responseTimeContract = responseTime !== undefined
  const providerMessages = objectEnvelope && Array.isArray(data.message) ? data.message : undefined
  const messageArrayContract = Boolean(providerMessages?.every((message) => typeof message === 'string'))
  const providerMessageCount = providerMessages?.length ?? 0
  const messageContract = messageArrayContract && providerMessageCount === 0
  const rawResults = objectEnvelope ? data.Results : undefined
  const directResults = isRecord(rawResults) ? rawResults : undefined
  const arrayResults = Array.isArray(rawResults) && rawResults.length === 1 && isRecord(rawResults[0]) ? rawResults[0] : undefined
  const results = directResults ?? arrayResults
  const resultsShape: BlsViewModel['resultsShape'] = directResults ? 'object' : arrayResults ? 'array' : undefined
  const providerSeriesRows = results && Array.isArray(results.series) ? results.series : []
  const resultsContract = Boolean(results && Array.isArray(results.series))
  const envelopeContract = objectEnvelope && statusContract && responseTimeContract && messageArrayContract && resultsContract

  const matchingSeries = request
    ? providerSeriesRows.filter((series) => isRecord(series) && series.seriesID === request.series && Array.isArray(series.data))
    : []
  const providerSeries = providerSeriesRows.length === 1 && isRecord(providerSeriesRows[0]) && typeof providerSeriesRows[0].seriesID === 'string'
    ? providerSeriesRows[0].seriesID
    : matchingSeries.length === 1 && isRecord(matchingSeries[0])
      ? String(matchingSeries[0].seriesID)
      : undefined
  const seriesIdentityContract = Boolean(request && resultsContract && providerSeriesRows.length === 1 && matchingSeries.length === 1)
  const providerRows = matchingSeries.length === 1 && isRecord(matchingSeries[0]) && Array.isArray(matchingSeries[0].data)
    ? matchingSeries[0].data
    : []

  const identityCounts = new Map<string, number>()
  const rawOrdinals: Array<number | undefined> = []
  for (const candidate of providerRows) {
    if (!isRecord(candidate)) {
      rawOrdinals.push(undefined)
      continue
    }
    const year = parseYear(candidate.year)
    const period = parsePeriod(candidate.period, candidate.periodName)
    const periodText = typeof candidate.period === 'string' ? candidate.period : undefined
    const key = year !== undefined && periodText ? `${year}-${periodText}` : undefined
    if (key) identityCounts.set(key, (identityCounts.get(key) ?? 0) + 1)
    rawOrdinals.push(year !== undefined && period !== undefined ? year * 13 + period : undefined)
  }

  let invalidRowCount = 0
  let missingValueCount = 0
  let malformedValueCount = 0
  const observations: BlsObservation[] = []
  for (const candidate of providerRows) {
    if (!isRecord(candidate)) {
      invalidRowCount += 1
      continue
    }
    const year = parseYear(candidate.year)
    const periodNumber = parsePeriod(candidate.period, candidate.periodName)
    const period = typeof candidate.period === 'string' ? candidate.period : undefined
    const periodName = typeof candidate.periodName === 'string' ? candidate.periodName : undefined
    const periodKey = year !== undefined && period ? `${year}-${period}` : undefined
    if (
      year === undefined
      || periodNumber === undefined
      || !period
      || !periodName
      || !periodKey
      || identityCounts.get(periodKey) !== 1
    ) {
      invalidRowCount += 1
      continue
    }

    const rawValue = candidate.value
    let valueKind: BlsObservation['valueKind'] = 'valid'
    let value: number | undefined
    if (rawValue === undefined || rawValue === null || rawValue === '-') {
      valueKind = 'missing'
      missingValueCount += 1
    } else {
      value = parseBlsDecimal(rawValue)
      if (value === undefined || typeof rawValue !== 'string') {
        valueKind = 'malformed'
        malformedValueCount += 1
      }
    }
    observations.push({
      year: String(year),
      period,
      periodName,
      periodKey,
      ordinal: year * 13 + periodNumber,
      ...(typeof rawValue === 'string' && valueKind === 'valid' ? { rawValue } : {}),
      ...(value === undefined ? {} : { value }),
      valueKind,
    })
  }

  const rowUniquenessContract = providerRows.length === identityCounts.size
    && [...identityCounts.values()].every((count) => count === 1)
  const periodContract = providerRows.length === rawOrdinals.length && rawOrdinals.every((ordinal) => ordinal !== undefined)
  const rowOrderContract = periodContract
    && rowUniquenessContract
    && rawOrdinals.every((ordinal, index) => index === 0 || (rawOrdinals[index - 1] as number) > (ordinal as number))
  const years = observations.map(({ year }) => Number(year))
  const threeYearContract = years.length === 0 || Math.max(...years) - Math.min(...years) <= 2
  const decimalStringContract = malformedValueCount === 0
  observations.sort((left, right) => left.ordinal - right.ordinal)
  const validValueCount = observations.filter(({ valueKind }) => valueKind === 'valid').length

  let state: BlsState = 'invalid'
  let reason: string | undefined
  if (!request) {
    reason = 'The executed request is not the exact supported BLS single-series GET request.'
  } else if (!envelopeContract) {
    reason = 'The HTTP-success payload does not contain the documented successful BLS response envelope.'
  } else if (!messageContract) {
    reason = 'BLS returned a provider-domain message, so this response cannot be treated as successful series data.'
  } else if (matchingSeries.length !== 1) {
    reason = 'The provider response does not contain exactly one request-matching BLS series.'
  } else if (providerRows.length === 0 && seriesIdentityContract) {
    state = 'empty'
    reason = 'No observations returned for the selected BLS series.'
  } else if (observations.length === 0) {
    reason = 'No rows with trustworthy BLS period identity could be validated.'
  } else if (
    seriesIdentityContract
    && rowOrderContract
    && rowUniquenessContract
    && periodContract
    && threeYearContract
    && decimalStringContract
    && missingValueCount === 0
    && validValueCount === providerRows.length
  ) {
    state = 'ready'
  } else {
    state = 'partial'
    reason = 'Only request-matching BLS rows with trustworthy period and value evidence are shown; invalid or unavailable evidence is withheld.'
  }

  return {
    state,
    reason,
    request,
    envelopeContract,
    statusContract,
    responseTimeContract,
    messageContract,
    resultsContract,
    resultsShape,
    seriesIdentityContract,
    rowUniquenessContract,
    rowOrderContract,
    periodContract,
    threeYearContract,
    decimalStringContract,
    responseTime,
    providerMessageCount,
    providerSeries,
    providerSeriesCount: providerSeriesRows.length,
    providerRowCount: providerRows.length,
    validRowCount: observations.length,
    invalidRowCount,
    validValueCount,
    missingValueCount,
    malformedValueCount,
    observations,
  }
}

const periodLabel = (observation?: BlsObservation) => observation ? `${observation.periodName} ${observation.year}` : 'Unavailable'

export function BlsTimeseriesPreview({
  api,
  data,
  executedRequest,
}: {
  api: ApiDemo
  data: unknown
  executedRequest?: ExecutedRequestContext
}) {
  const model = blsTimeseriesModel(api, data, executedRequest)
  const latest = model.observations.at(-1)
  const values = model.observations.filter((observation) => observation.value !== undefined)
  const high = values.reduce<BlsObservation | undefined>((current, observation) => !current || (observation.value as number) > (current.value as number) ? observation : current, undefined)
  const low = values.reduce<BlsObservation | undefined>((current, observation) => !current || (observation.value as number) < (current.value as number) ? observation : current, undefined)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(model.request)),
    'data-request-method': model.request ? 'GET' : undefined,
    'data-request-series': model.request?.series,
    'data-provider-series': model.providerSeries,
    'data-response-time-ms': model.responseTime,
    'data-provider-message-count': model.providerMessageCount,
    'data-provider-series-count': model.providerSeriesCount,
    'data-provider-row-count': model.providerRowCount,
    'data-valid-row-count': model.validRowCount,
    'data-invalid-row-count': model.invalidRowCount,
    'data-valid-value-count': model.validValueCount,
    'data-missing-value-count': model.missingValueCount,
    'data-malformed-value-count': model.malformedValueCount,
    'data-envelope-contract': String(model.envelopeContract),
    'data-status-contract': String(model.statusContract),
    'data-response-time-contract': String(model.responseTimeContract),
    'data-message-contract': String(model.messageContract),
    'data-results-contract': String(model.resultsContract),
    'data-results-shape': model.resultsShape,
    'data-series-identity-contract': String(model.seriesIdentityContract),
    'data-row-uniqueness-contract': String(model.rowUniquenessContract),
    'data-row-order-contract': String(model.rowOrderContract),
    'data-period-contract': String(model.periodContract),
    'data-three-year-contract': String(model.threeYearContract),
    'data-decimal-string-contract': String(model.decimalStringContract),
  }

  if (model.state === 'invalid') return <div className="market-preview" data-domain-card="bls-timeseries" {...evidence}>
    <div className="market-summary"><div><span>BLS evidence unavailable</span><strong>—</strong><small>{model.reason}</small></div></div>
  </div>

  if (model.state === 'empty') return <div className="market-preview" data-domain-card="bls-timeseries" {...evidence}>
    <div className="market-summary"><div><span>{model.request?.label} · {model.request?.series}</span><strong>—</strong><small>{model.reason}</small></div></div>
  </div>

  return <div
    className="market-preview"
    data-domain-card="bls-timeseries"
    data-primary-period={latest?.periodKey}
    data-primary-value={latest?.rawValue}
    {...evidence}
  >
    <div className="market-summary"><div><span>{model.request?.label} · {model.request?.series}</span><strong>{latest?.rawValue ?? 'Value unavailable'}</strong><small>{periodLabel(latest)} · Latest validated period</small></div><div className="market-range"><span>{periodLabel(model.observations[0])}</span><span>{periodLabel(latest)}</span></div></div>
    {values.length > 0 && <Sparkline values={values.map(({ value }) => value as number)} label={`${model.request?.label} validated BLS observations from ${periodLabel(model.observations[0])} to ${periodLabel(latest)}`}/>}
    <div className="market-metrics">
      <article><small>Series high</small><strong>{high?.rawValue ?? 'Unavailable'}</strong></article>
      <article><small>Series low</small><strong>{low?.rawValue ?? 'Unavailable'}</strong></article>
      <article><small>Validated values</small><strong>{model.validValueCount} / {model.providerRowCount}</strong></article>
    </div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span></article></div>}
    <ol className="sr-only" aria-label="BLS validated time-series evidence">
      {model.observations.map((observation) => <li key={observation.periodKey}>{periodLabel(observation)} ({observation.period}): {observation.rawValue ?? 'unavailable'}</li>)}
    </ol>
  </div>
}
