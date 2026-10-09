import { Sparkline } from './ChartPrimitives'
import { formatNumber } from './previewData'
import { finiteNumber, isRecord, trimmedText } from './semanticValidation'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'

const dailyVariables = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum'] as const
type DailyVariable = typeof dailyVariables[number]
type HistoryRequest = {
  valid: true
  latitude: string
  longitude: string
  startDate: string
  endDate: string
  expectedDayCount: number
} | { valid: false }

type HistoryDay = {
  date: string
  high: number
  low: number
  precipitation: number
}

type HistoryState = 'ready' | 'partial' | 'invalid'
type HistoryViewModel = {
  state: HistoryState
  reason?: string
  request?: HistoryRequest
  requestBound: boolean
  providerLatitude?: number
  providerLongitude?: number
  timezone?: string
  utcOffsetSeconds?: number
  providerDayCount: number
  validDayCount: number
  invalidDayCount: number
  missingMeasurementCount: number
  invalidMeasurementCount: number
  arrayLengthContract: boolean
  unitContract: boolean
  dateRangeContract: boolean
  rows: HistoryDay[]
}

const expectedUnits: Record<'time' | DailyVariable, string> = {
  time: 'iso8601',
  temperature_2m_max: '°C',
  temperature_2m_min: '°C',
  precipitation_sum: 'mm',
}

const DAY_MS = 86_400_000

const calendarDateEpoch = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const epoch = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === value ? epoch : undefined
}

const boundedQueryNumber = (value: string | null, minimum: number, maximum: number) => {
  if (value === null || !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? { raw: value, numeric } : undefined
}

const parseHistoryRequest = (requestUrl?: string): HistoryRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const allowedKeys = new Set(['latitude', 'longitude', 'start_date', 'end_date', 'daily', 'timezone'])
    const entries = [...url.searchParams.entries()]
    const exactKeys = entries.length === allowedKeys.size
      && entries.every(([key]) => allowedKeys.has(key))
      && [...allowedKeys].every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
    const latitude = boundedQueryNumber(url.searchParams.get('latitude'), -90, 90)
    const longitude = boundedQueryNumber(url.searchParams.get('longitude'), -180, 180)
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')
    const startEpoch = calendarDateEpoch(startDate)
    const endEpoch = calendarDateEpoch(endDate)
    const expectedDayCount = startEpoch !== undefined && endEpoch !== undefined && endEpoch >= startEpoch
      ? ((endEpoch - startEpoch) / DAY_MS) + 1
      : undefined
    const valid = url.protocol === 'https:'
      && url.hostname === 'archive-api.open-meteo.com'
      && url.port === ''
      && url.pathname === '/v1/archive'
      && !url.username
      && !url.password
      && !url.hash
      && exactKeys
      && Boolean(latitude)
      && Boolean(longitude)
      && startDate !== null
      && endDate !== null
      && expectedDayCount !== undefined
      && Number.isSafeInteger(expectedDayCount)
      && expectedDayCount > 0
      && url.searchParams.get('daily') === dailyVariables.join(',')
      && url.searchParams.get('timezone') === 'auto'
    return valid && latitude && longitude && startDate && endDate && expectedDayCount !== undefined
      ? { valid: true, latitude: latitude.raw, longitude: longitude.raw, startDate, endDate, expectedDayCount }
      : { valid: false }
  } catch {
    return { valid: false }
  }
}

type HistoryTransport = { request?: HistoryRequest; valid: boolean; bound: boolean }

const resolveHistoryRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): HistoryTransport => {
  const displayed = parseHistoryRequest(requestUrl)
  if (displayed?.valid === false) return { valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
    return { valid: false, bound: false }
  }
  const executed = parseHistoryRequest(executedRequest.url)
  return executed?.valid === true ? { request: executed, valid: true, bound: true } : { valid: false, bound: false }
}

const measurement = (value: unknown, variable: DailyVariable) => {
  if (value === null || value === undefined) return { kind: 'missing' as const, value: undefined }
  const numeric = finiteNumber(value)
  if (numeric === undefined) return { kind: 'invalid' as const, value: undefined }
  if (variable === 'precipitation_sum' && numeric < 0) return { kind: 'invalid' as const, value: undefined }
  return { kind: 'valid' as const, value: numeric }
}

export const openMeteoHistoryModel = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): HistoryViewModel => {
  const transport = resolveHistoryRequest(requestUrl, executedRequest)
  const request = transport.request
  const root = isRecord(data) ? data : undefined
  const daily = root && isRecord(root.daily) ? root.daily : undefined
  const units = root && isRecord(root.daily_units) ? root.daily_units : undefined
  const arrays = daily
    ? Object.fromEntries(['time', ...dailyVariables].map((key) => [key, Array.isArray(daily[key]) ? daily[key] as unknown[] : undefined])) as Record<'time' | DailyVariable, unknown[] | undefined>
    : undefined
  const arraysPresent = Boolean(arrays && Object.values(arrays).every(Array.isArray))
  const lengths = arraysPresent && arrays ? Object.values(arrays).map((series) => series?.length ?? 0) : []
  const providerDayCount = arrays?.time?.length ?? 0
  const providerRowCount = lengths.length ? Math.max(...lengths) : 0
  const arrayLengthContract = arraysPresent && providerDayCount > 0 && lengths.every((length) => length === providerDayCount)

  const providerLatitude = finiteNumber(root?.latitude)
  const providerLongitude = finiteNumber(root?.longitude)
  const offset = finiteNumber(root?.utc_offset_seconds)
  const utcOffsetSeconds = offset !== undefined && Number.isInteger(offset) && offset >= -86_400 && offset <= 86_400 ? offset : undefined
  const timezoneValue = trimmedText(root?.timezone)
  const timezone = timezoneValue !== undefined && timezoneValue === root?.timezone ? timezoneValue : undefined
  const providerContextValid = providerLatitude !== undefined && providerLatitude >= -90 && providerLatitude <= 90
    && providerLongitude !== undefined && providerLongitude >= -180 && providerLongitude <= 180
    && utcOffsetSeconds !== undefined
    && timezone !== undefined
  const unitContract = Boolean(units && Object.entries(expectedUnits).every(([key, unit]) => units[key] === unit))

  let missingMeasurementCount = 0
  let invalidMeasurementCount = 0
  let dateRangeContract = request?.valid === true && arrayLengthContract && providerDayCount === request.expectedDayCount
  const rows: HistoryDay[] = []

  if (arraysPresent && arrays) {
    const requestStartEpoch = request?.valid === true ? calendarDateEpoch(request.startDate) : undefined
    for (let index = 0; index < providerRowCount; index += 1) {
      const date = arrays.time?.[index]
      const dateEpoch = calendarDateEpoch(date)
      const expectedEpoch = requestStartEpoch === undefined ? undefined : requestStartEpoch + index * DAY_MS
      const expectedDate = expectedEpoch === undefined ? undefined : new Date(expectedEpoch).toISOString().slice(0, 10)
      const dateValid = dateEpoch !== undefined && typeof date === 'string' && (request?.valid !== true || date === expectedDate)
      if (!dateValid) dateRangeContract = false

      const values = Object.fromEntries(dailyVariables.map((variable) => {
        const parsed = measurement(arrays[variable]?.[index], variable)
        if (parsed.kind === 'missing') missingMeasurementCount += 1
        if (parsed.kind === 'invalid') invalidMeasurementCount += 1
        return [variable, parsed]
      })) as Record<DailyVariable, ReturnType<typeof measurement>>

      const high = values.temperature_2m_max.value
      const low = values.temperature_2m_min.value
      if (high !== undefined && low !== undefined && high < low) {
        invalidMeasurementCount += 1
        continue
      }
      if (!dateValid || typeof date !== 'string' || dailyVariables.some((variable) => values[variable].kind !== 'valid')) continue
      rows.push({
        date,
        high: high as number,
        low: low as number,
        precipitation: values.precipitation_sum.value as number,
      })
    }
  }

  if (request?.valid === true && arrays?.time?.at(-1) !== request.endDate) dateRangeContract = false
  const validDayCount = rows.length
  const invalidDayCount = Math.max(0, providerRowCount - validDayCount)

  let state: HistoryState = 'partial'
  let reason: string | undefined
  if (!transport.valid) {
    state = 'invalid'
    reason = 'The executed request was not the exact supported bodyless GET Open-Meteo historical-weather request, or it disagreed with the displayed request URL.'
  } else if (!root || !arraysPresent || providerDayCount === 0) {
    state = 'invalid'
    reason = 'The response does not contain every requested daily historical-weather array.'
  } else if (!providerContextValid) {
    state = 'invalid'
    reason = 'The response grid coordinates, timezone, or UTC offset are malformed.'
  } else if (!unitContract) {
    state = 'invalid'
    reason = 'The response does not declare the expected units for each requested daily variable.'
  } else if (validDayCount === 0) {
    state = 'invalid'
    reason = 'No complete historical-weather days could be validated.'
  } else if (transport.bound && request?.valid === true && arrayLengthContract && dateRangeContract && missingMeasurementCount === 0 && invalidMeasurementCount === 0 && invalidDayCount === 0) {
    state = 'ready'
  } else {
    reason = request?.valid === true && !transport.bound
      ? 'The provider series is usable, but the exact executed request is unavailable.'
      : request?.valid === true
        ? 'Only complete request-matching days are shown; the provider series is incomplete or inconsistent.'
        : 'The provider series is usable, but the exact executed request is unavailable.'
  }

  return {
    state,
    reason,
    request,
    requestBound: transport.bound,
    providerLatitude,
    providerLongitude,
    timezone,
    utcOffsetSeconds,
    providerDayCount,
    validDayCount,
    invalidDayCount,
    missingMeasurementCount,
    invalidMeasurementCount,
    arrayLengthContract,
    unitContract,
    dateRangeContract,
    rows,
  }
}

export function OpenMeteoHistoryPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = openMeteoHistoryModel(data, requestUrl, executedRequest)
  const request = model.request?.valid === true ? model.request : undefined
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-latitude': request?.latitude,
    'data-request-longitude': request?.longitude,
    'data-request-start-date': request?.startDate,
    'data-request-end-date': request?.endDate,
    'data-request-day-count': request?.expectedDayCount,
    'data-provider-latitude': model.providerLatitude,
    'data-provider-longitude': model.providerLongitude,
    'data-timezone': model.timezone,
    'data-utc-offset-seconds': model.utcOffsetSeconds,
    'data-provider-day-count': model.providerDayCount,
    'data-valid-day-count': model.validDayCount,
    'data-invalid-day-count': model.invalidDayCount,
    'data-missing-measurement-count': model.missingMeasurementCount,
    'data-invalid-measurement-count': model.invalidMeasurementCount,
    'data-array-length-contract': String(model.arrayLengthContract),
    'data-unit-contract': String(model.unitContract),
    'data-date-range-contract': String(model.dateRangeContract),
  }

  if (model.state === 'invalid' || !model.timezone || model.rows.length === 0) {
    return <div className="market-preview" data-domain-card="historical-weather" {...evidence}>
      <div className="market-summary"><div><span>Historical weather unavailable</span><strong>—</strong><small>{model.reason}</small></div></div>
    </div>
  }

  const highs = model.rows.map((row) => row.high)
  const lows = model.rows.map((row) => row.low)
  const totalRain = model.rows.reduce((sum, row) => sum + row.precipitation, 0)
  const latest = model.rows.at(-1) as HistoryDay
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

  return <div className="market-preview" data-domain-card="historical-weather" data-primary-date={latest.date} data-primary-high={latest.high} {...evidence}>
    <div className="market-summary"><div><span>{model.timezone.replaceAll('_', ' ')} · Daily high</span><strong>{formatNumber(latest.high, 1)}°C</strong><small>{latest.date} · latest validated day</small></div><div className="market-range"><span>{model.rows[0].date}</span><span>{latest.date}</span></div></div>
    <Sparkline values={highs} label="Response trend sparkline"/>
    <div className="market-metrics">
      <article><small>Average high</small><strong>{formatNumber(average(highs), 1)}°C</strong></article>
      <article><small>Average low</small><strong>{formatNumber(average(lows), 1)}°C</strong></article>
      <article><small>Total rain</small><strong>{formatNumber(totalRain, 1)} mm</strong></article>
    </div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span></article></div>}
  </div>
}
