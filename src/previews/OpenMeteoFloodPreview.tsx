import { Sparkline } from './ChartPrimitives'
import { formatNumber } from './previewData'
import { finiteNumber, isRecord, trimmedText } from './semanticValidation'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'

const dailyVariables = [
  'river_discharge',
  'river_discharge_mean',
  'river_discharge_max',
] as const

type DailyVariable = typeof dailyVariables[number]
type FloodRequest = {
  latitude: string
  longitude: string
  forecastDays: number
}

type FloodDay = {
  date: string
  discharge: number
  mean: number
  maximum: number
}

type FloodResultState = 'ready' | 'partial' | 'empty' | 'invalid'

type FloodViewModel = {
  state: FloodResultState
  reason: string
  request?: FloodRequest
  requestBound: boolean
  providerLatitude?: number
  providerLongitude?: number
  timezone?: string
  timezoneAbbreviation?: string
  utcOffsetSeconds?: number
  providerRowCount: number
  validRowCount: number
  invalidRowCount: number
  missingMeasurementCount: number
  invalidMeasurementCount: number
  gridContract: boolean
  timezoneContract: boolean
  arrayLengthContract: boolean
  unitContract: boolean
  timeContract: boolean
  cadenceContract: boolean
  horizonContract: boolean
  rows: FloodDay[]
}

const expectedUnits: Record<DailyVariable, string> = {
  river_discharge: 'm³/s',
  river_discharge_mean: 'm³/s',
  river_discharge_max: 'm³/s',
}

const DAY_MS = 86_400_000

const boundedQueryNumber = (value: string | null, minimum: number, maximum: number) => {
  if (value === null || !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? { raw: value, numeric } : undefined
}

const parseFloodRequest = (requestUrl?: string): FloodRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const allowedKeys = new Set(['latitude', 'longitude', 'daily', 'forecast_days'])
    const entries = [...url.searchParams.entries()]
    const exactKeys = entries.length === allowedKeys.size
      && entries.every(([key]) => allowedKeys.has(key))
      && [...allowedKeys].every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
    const latitude = boundedQueryNumber(url.searchParams.get('latitude'), -90, 90)
    const longitude = boundedQueryNumber(url.searchParams.get('longitude'), -180, 180)
    const forecastDays = url.searchParams.get('forecast_days')
    const valid = url.protocol === 'https:'
      && url.hostname === 'flood-api.open-meteo.com'
      && url.port === ''
      && url.pathname === '/v1/flood'
      && !url.username
      && !url.password
      && !url.hash
      && exactKeys
      && Boolean(latitude)
      && Boolean(longitude)
      && url.searchParams.get('daily') === dailyVariables.join(',')
      && forecastDays !== null
      && /^(?:[1-9]|[12]\d|30)$/.test(forecastDays)
    return valid && latitude && longitude && forecastDays
      ? { latitude: latitude.raw, longitude: longitude.raw, forecastDays: Number(forecastDays) }
      : undefined
  } catch {
    return undefined
  }
}

type FloodTransport = { request?: FloodRequest; valid: boolean; bound: boolean }

const resolveFloodRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): FloodTransport => {
  const displayed = parseFloodRequest(requestUrl)
  if (requestUrl && !displayed) return { valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
    return { valid: false, bound: false }
  }
  const executed = parseFloodRequest(executedRequest.url)
  return executed ? { request: executed, valid: true, bound: true } : { valid: false, bound: false }
}

const calendarDateEpoch = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const epoch = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === value ? epoch : undefined
}

const measurement = (value: unknown) => {
  if (value === null || value === undefined) return { kind: 'missing' as const }
  const numeric = finiteNumber(value)
  return numeric !== undefined && numeric >= 0
    ? { kind: 'valid' as const, value: numeric }
    : { kind: 'invalid' as const }
}

const exactUnitContract = (units: Record<string, unknown> | undefined) => {
  if (!units) return false
  const expectedKeys = Object.keys(expectedUnits)
  const keys = Object.keys(units)
  const allowedKeys = new Set([...expectedKeys, 'time'])
  return keys.every((key) => allowedKeys.has(key))
    && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(units, key) && units[key] === expectedUnits[key as keyof typeof expectedUnits])
    && (!Object.prototype.hasOwnProperty.call(units, 'time') || units.time === 'iso8601')
}

export const openMeteoFloodModel = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): FloodViewModel => {
  const transport = resolveFloodRequest(requestUrl, executedRequest)
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
  const arrayLengthContract = arraysPresent && lengths.every((length) => length === providerDayCount)

  const providerLatitude = finiteNumber(root?.latitude)
  const providerLongitude = finiteNumber(root?.longitude)
  const offset = finiteNumber(root?.utc_offset_seconds)
  const utcOffsetSeconds = offset !== undefined && Number.isInteger(offset) && offset >= -86_400 && offset <= 86_400 ? offset : undefined
  const timezoneValue = trimmedText(root?.timezone)
  const timezone = timezoneValue !== undefined && timezoneValue === root?.timezone ? timezoneValue : undefined
  const abbreviationValue = trimmedText(root?.timezone_abbreviation)
  const timezoneAbbreviation = abbreviationValue !== undefined && abbreviationValue === root?.timezone_abbreviation ? abbreviationValue : undefined
  const requestedLatitude = request ? Number(request.latitude) : undefined
  const requestedLongitude = request ? Number(request.longitude) : undefined
  const longitudeDifference = providerLongitude === undefined || requestedLongitude === undefined
    ? undefined
    : Math.abs(providerLongitude - requestedLongitude)
  const gridContract = providerLatitude !== undefined && requestedLatitude !== undefined
    && Math.abs(providerLatitude - requestedLatitude) <= 0.1
    && longitudeDifference !== undefined
    && Math.min(longitudeDifference, 360 - longitudeDifference) <= 0.1
  const timezoneContract = utcOffsetSeconds === 0 && timezone === 'GMT' && timezoneAbbreviation === 'GMT'
  const providerContextValid = providerLatitude !== undefined && providerLatitude >= -90 && providerLatitude <= 90
    && providerLongitude !== undefined && providerLongitude >= -180 && providerLongitude <= 180
    && gridContract
    && timezoneContract
  const unitContract = exactUnitContract(units)

  let missingMeasurementCount = 0
  let invalidMeasurementCount = 0
  const dateEpochs: Array<number | undefined> = []
  const rows: FloodDay[] = []
  if (arraysPresent && arrays) {
    for (let index = 0; index < providerRowCount; index += 1) {
      const date = arrays.time?.[index]
      const dateEpoch = calendarDateEpoch(date)
      dateEpochs.push(dateEpoch)
      const values = Object.fromEntries(dailyVariables.map((variable) => {
        const parsed = measurement(arrays[variable]?.[index])
        if (parsed.kind === 'missing') missingMeasurementCount += 1
        if (parsed.kind === 'invalid') invalidMeasurementCount += 1
        return [variable, parsed]
      })) as Record<DailyVariable, ReturnType<typeof measurement>>
      if (dateEpoch === undefined || typeof date !== 'string' || dailyVariables.some((variable) => values[variable].kind !== 'valid')) continue
      rows.push({
        date,
        discharge: values.river_discharge.value as number,
        mean: values.river_discharge_mean.value as number,
        maximum: values.river_discharge_max.value as number,
      })
    }
  }

  const timeContract = arraysPresent && providerDayCount > 0
    && dateEpochs.length >= providerDayCount
    && dateEpochs.slice(0, providerDayCount).every((epoch) => epoch !== undefined)
  const cadenceContract = timeContract && dateEpochs.slice(0, providerDayCount).every((epoch, index) => index === 0 || (epoch as number) - (dateEpochs[index - 1] as number) === DAY_MS)
  const horizonContract = Boolean(request && providerDayCount === request.forecastDays && cadenceContract)
  const validRowCount = rows.length
  const invalidRowCount = Math.max(0, providerRowCount - validRowCount)

  let state: FloodResultState
  let reason: string
  if (!transport.valid) {
    state = 'invalid'
    reason = 'The executed request was not the exact supported bodyless GET Open-Meteo flood request, or it disagreed with the displayed request URL.'
  } else if (!root || !arraysPresent) {
    state = 'invalid'
    reason = 'The response does not contain every requested daily flood-forecast array.'
  } else if (!providerContextValid) {
    state = 'invalid'
    reason = 'The response grid or GMT time metadata is malformed or does not match the executed request.'
  } else if (!unitContract) {
    state = 'invalid'
    reason = 'The response does not declare exactly the expected units for every requested flood variable.'
  } else if (providerDayCount === 0) {
    state = transport.bound ? 'empty' : 'partial'
    reason = transport.bound
      ? 'Open-Meteo returned no daily flood-forecast rows for the executed request.'
      : 'The provider series is empty, but the exact executed request is unavailable.'
  } else if (!timeContract || !cadenceContract) {
    state = 'invalid'
    reason = 'The response dates are malformed or do not form an aligned daily series.'
  } else if (transport.bound && validRowCount === 0 && arrayLengthContract && horizonContract && invalidMeasurementCount === 0 && missingMeasurementCount > 0) {
    state = 'empty'
    reason = 'Open-Meteo returned dates but no available discharge measurements.'
  } else if (validRowCount === 0) {
    state = 'invalid'
    reason = 'No complete native-number flood-forecast rows could be validated.'
  } else if (transport.bound && arrayLengthContract && horizonContract && missingMeasurementCount === 0 && invalidMeasurementCount === 0 && invalidRowCount === 0) {
    state = 'ready'
    reason = 'Every requested daily flood-forecast row was validated.'
  } else {
    state = 'partial'
    reason = request && !transport.bound
      ? 'The provider series is usable, but the exact executed request is unavailable.'
      : 'Only complete aligned rows are shown; the provider series is incomplete or contains malformed measurements.'
  }

  return {
    state,
    reason,
    request,
    requestBound: transport.bound,
    providerLatitude,
    providerLongitude,
    timezone,
    timezoneAbbreviation,
    utcOffsetSeconds,
    providerRowCount,
    validRowCount,
    invalidRowCount,
    missingMeasurementCount,
    invalidMeasurementCount,
    gridContract,
    timezoneContract,
    arrayLengthContract,
    unitContract,
    timeContract,
    cadenceContract,
    horizonContract,
    rows,
  }
}

export function FloodForecastPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = openMeteoFloodModel(data, requestUrl, executedRequest)
  const peak = model.rows.reduce<FloodDay | undefined>((highest, row) => !highest || row.maximum > highest.maximum ? row : highest, undefined)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-latitude': model.request?.latitude,
    'data-request-longitude': model.request?.longitude,
    'data-request-forecast-days': model.request?.forecastDays,
    'data-provider-latitude': model.providerLatitude,
    'data-provider-longitude': model.providerLongitude,
    'data-timezone': model.timezone,
    'data-timezone-abbreviation': model.timezoneAbbreviation,
    'data-utc-offset-seconds': model.utcOffsetSeconds,
    'data-provider-row-count': model.providerRowCount,
    'data-valid-row-count': model.validRowCount,
    'data-invalid-row-count': model.invalidRowCount,
    'data-missing-measurement-count': model.missingMeasurementCount,
    'data-invalid-measurement-count': model.invalidMeasurementCount,
    'data-grid-contract': String(model.gridContract),
    'data-timezone-contract': String(model.timezoneContract),
    'data-array-length-contract': String(model.arrayLengthContract),
    'data-unit-contract': String(model.unitContract),
    'data-time-contract': String(model.timeContract),
    'data-cadence-contract': String(model.cadenceContract),
    'data-horizon-contract': String(model.horizonContract),
    'data-primary-peak-date': peak?.date,
    'data-primary-peak-discharge': peak?.maximum,
  }

  if (model.state === 'invalid' || model.state === 'empty' || !peak || model.providerLatitude === undefined || model.providerLongitude === undefined) {
    return <div className="market-preview flood-preview" data-domain-card="flood-forecast" {...evidence}>
      <div className="market-summary"><div><span>{model.state === 'empty' ? 'No flood forecast measurements returned' : 'Flood forecast evidence unavailable'}</span><strong>—</strong><small>{model.reason}</small></div></div>
    </div>
  }

  const averageMean = model.rows.reduce((sum, row) => sum + row.mean, 0) / model.rows.length
  const first = model.rows[0]
  const last = model.rows.at(-1) as FloodDay
  return <div className="market-preview flood-preview" data-domain-card="flood-forecast" {...evidence}>
    <div className="market-summary"><div><span>River discharge · {formatNumber(model.providerLatitude, 3)}, {formatNumber(model.providerLongitude, 3)}</span><strong>{formatNumber(first.discharge, 2)} m³/s</strong><small>First validated forecast day · peak {formatNumber(peak.maximum, 2)} m³/s</small></div><div className="market-range"><span>{first.date}</span><span>{last.date}</span></div></div>
    <Sparkline values={model.rows.map((row) => row.discharge)} label="Validated river discharge forecast sparkline"/>
    <div className="market-metrics"><article><small>Forecast peak</small><strong>{formatNumber(peak.maximum, 2)} m³/s</strong></article><article><small>Peak date</small><strong>{peak.date}</strong></article><article><small>Mean discharge</small><strong>{formatNumber(averageMean, 2)} m³/s</strong></article></div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span></article></div>}
  </div>
}
