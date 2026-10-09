import type { CSSProperties } from 'react'
import { dateParts, formatNumber, timeLabel } from './previewData'
import { finiteNumber, isRecord, trimmedText } from './semanticValidation'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'

const marineVariables = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'sea_surface_temperature',
  'ocean_current_velocity',
  'ocean_current_direction',
] as const

type MarineVariable = typeof marineVariables[number]
type MarineRequest = {
  valid: true
  latitude: string
  longitude: string
  forecastDays: number
} | { valid: false }

type MarineHour = {
  time: string
  localEpoch: number
  waveHeight: number
  waveDirection: number
  wavePeriod: number
  seaSurfaceTemperature: number
  oceanCurrentVelocity: number
  oceanCurrentDirection: number
}

type MarineResultState = 'ready' | 'partial' | 'invalid'

type MarineViewModel = {
  state: MarineResultState
  reason?: string
  request?: MarineRequest
  requestBound: boolean
  providerLatitude?: number
  providerLongitude?: number
  timezone?: string
  utcOffsetSeconds?: number
  providerHourCount: number
  validHourCount: number
  invalidHourCount: number
  missingMeasurementCount: number
  invalidMeasurementCount: number
  arrayLengthContract: boolean
  unitContract: boolean
  timeContract: boolean
  cadenceContract: boolean
  horizonContract: boolean
  rows: MarineHour[]
}

const expectedUnits: Record<'time' | MarineVariable, string> = {
  time: 'iso8601',
  wave_height: 'm',
  wave_direction: '°',
  wave_period: 's',
  sea_surface_temperature: '°C',
  ocean_current_velocity: 'km/h',
  ocean_current_direction: '°',
}

const boundedQueryNumber = (value: string | null, minimum: number, maximum: number) => {
  if (value === null || !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? { numeric, raw: value } : undefined
}

const parseMarineRequest = (requestUrl?: string): MarineRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const entries = [...url.searchParams.entries()]
    const allowedKeys = new Set(['latitude', 'longitude', 'hourly', 'timezone', 'forecast_days'])
    const exactKeys = entries.length === allowedKeys.size
      && entries.every(([key]) => allowedKeys.has(key))
      && [...allowedKeys].every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
    const latitude = boundedQueryNumber(url.searchParams.get('latitude'), -90, 90)
    const longitude = boundedQueryNumber(url.searchParams.get('longitude'), -180, 180)
    const forecastDays = url.searchParams.get('forecast_days')
    const requestValid = url.protocol === 'https:'
      && url.hostname === 'marine-api.open-meteo.com'
      && url.port === ''
      && url.pathname === '/v1/marine'
      && !url.username
      && !url.password
      && !url.hash
      && exactKeys
      && Boolean(latitude)
      && Boolean(longitude)
      && url.searchParams.get('hourly') === marineVariables.join(',')
      && url.searchParams.get('timezone') === 'auto'
      && forecastDays !== null
      && /^[1-7]$/.test(forecastDays)
    return requestValid && latitude && longitude && forecastDays
      ? { valid: true, latitude: latitude.raw, longitude: longitude.raw, forecastDays: Number(forecastDays) }
      : { valid: false }
  } catch {
    return { valid: false }
  }
}

type MarineTransport = { request?: MarineRequest; valid: boolean; bound: boolean }

const resolveMarineRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): MarineTransport => {
  const displayed = parseMarineRequest(requestUrl)
  if (displayed?.valid === false) return { valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
    return { valid: false, bound: false }
  }
  const executed = parseMarineRequest(executedRequest.url)
  return executed?.valid === true ? { request: executed, valid: true, bound: true } : { valid: false, bound: false }
}

const localHourEpoch = (value: unknown) => {
  const time = trimmedText(value)
  if (time === undefined || time !== value || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):00$/.test(time)) return undefined
  const epoch = Date.parse(`${time}:00Z`)
  return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 16) === time ? epoch : undefined
}

const measurement = (value: unknown, variable: MarineVariable) => {
  if (value === null || value === undefined) return { kind: 'missing' as const, value: undefined }
  const numeric = finiteNumber(value)
  if (numeric === undefined) return { kind: 'invalid' as const, value: undefined }
  const valid = variable === 'sea_surface_temperature'
    || (variable === 'wave_direction' || variable === 'ocean_current_direction' ? numeric >= 0 && numeric <= 360 : numeric >= 0)
  return valid ? { kind: 'valid' as const, value: numeric } : { kind: 'invalid' as const, value: undefined }
}

export const openMeteoMarineModel = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): MarineViewModel => {
  const transport = resolveMarineRequest(requestUrl, executedRequest)
  const request = transport.request
  const root = isRecord(data) ? data : undefined
  const hourly = root && isRecord(root.hourly) ? root.hourly : undefined
  const units = root && isRecord(root.hourly_units) ? root.hourly_units : undefined
  const arrays = hourly
    ? Object.fromEntries(['time', ...marineVariables].map((key) => [key, Array.isArray(hourly[key]) ? hourly[key] as unknown[] : undefined])) as Record<'time' | MarineVariable, unknown[] | undefined>
    : undefined
  const coreArraysValid = Boolean(arrays && Object.values(arrays).every(Array.isArray))
  const lengths = coreArraysValid && arrays ? Object.values(arrays).map((series) => series?.length ?? 0) : []
  const providerHourCount = arrays?.time?.length ?? 0
  const providerRowCount = lengths.length ? Math.max(...lengths) : 0
  const arrayLengthContract = coreArraysValid && providerHourCount > 0 && lengths.every((length) => length === providerHourCount)

  const providerLatitude = finiteNumber(root?.latitude)
  const providerLongitude = finiteNumber(root?.longitude)
  const offset = finiteNumber(root?.utc_offset_seconds)
  const utcOffsetSeconds = offset !== undefined && Number.isInteger(offset) && offset >= -86400 && offset <= 86400 ? offset : undefined
  const timezoneValue = trimmedText(root?.timezone)
  const timezone = timezoneValue !== undefined && timezoneValue === root?.timezone ? timezoneValue : undefined
  const providerContextValid = providerLatitude !== undefined && providerLatitude >= -90 && providerLatitude <= 90
    && providerLongitude !== undefined && providerLongitude >= -180 && providerLongitude <= 180
    && utcOffsetSeconds !== undefined
    && timezone !== undefined
  const unitContract = Boolean(units && Object.entries(expectedUnits).every(([key, unit]) => units[key] === unit))

  let missingMeasurementCount = 0
  let invalidMeasurementCount = 0
  const timeEpochs: Array<number | undefined> = []
  const rows: MarineHour[] = []
  if (coreArraysValid && arrays) {
    for (let index = 0; index < providerRowCount; index += 1) {
      const time = arrays.time?.[index]
      const epoch = localHourEpoch(time)
      timeEpochs.push(epoch)
      const values = Object.fromEntries(marineVariables.map((variable) => {
        const parsed = measurement(arrays[variable]?.[index], variable)
        if (parsed.kind === 'missing') missingMeasurementCount += 1
        if (parsed.kind === 'invalid') invalidMeasurementCount += 1
        return [variable, parsed]
      })) as Record<MarineVariable, ReturnType<typeof measurement>>
      if (epoch === undefined || typeof time !== 'string' || marineVariables.some((variable) => values[variable].kind !== 'valid')) continue
      rows.push({
        time,
        localEpoch: epoch,
        waveHeight: values.wave_height.value as number,
        waveDirection: values.wave_direction.value as number,
        wavePeriod: values.wave_period.value as number,
        seaSurfaceTemperature: values.sea_surface_temperature.value as number,
        oceanCurrentVelocity: values.ocean_current_velocity.value as number,
        oceanCurrentDirection: values.ocean_current_direction.value as number,
      })
    }
  }

  const timeContract = coreArraysValid && providerHourCount > 0 && timeEpochs.length === providerRowCount && timeEpochs.every((epoch) => epoch !== undefined)
  const cadenceContract = timeContract && timeEpochs.every((epoch, index) => index === 0 || (epoch as number) - (timeEpochs[index - 1] as number) === 3_600_000)
  const horizonContract = request?.valid === true && providerHourCount === request.forecastDays * 24 && cadenceContract
  const validHourCount = rows.length
  const invalidHourCount = Math.max(0, providerRowCount - validHourCount)

  let state: MarineResultState = 'partial'
  let reason: string | undefined
  if (!transport.valid) {
    state = 'invalid'
    reason = 'The executed request was not the exact supported bodyless GET Open-Meteo marine request, or it disagreed with the displayed request URL.'
  } else if (!root || !coreArraysValid || providerHourCount === 0) {
    state = 'invalid'
    reason = 'The response does not contain every documented hourly marine array.'
  } else if (!providerContextValid) {
    state = 'invalid'
    reason = 'The response grid coordinates, timezone, or UTC offset are malformed.'
  } else if (!unitContract) {
    state = 'invalid'
    reason = 'The response does not declare the expected units for every requested marine variable.'
  } else if (validHourCount === 0) {
    state = 'invalid'
    reason = 'No complete hourly marine measurements could be validated.'
  } else if (transport.bound && request?.valid === true && arrayLengthContract && timeContract && cadenceContract && horizonContract && invalidHourCount === 0 && missingMeasurementCount === 0 && invalidMeasurementCount === 0) {
    state = 'ready'
  } else {
    reason = request?.valid === true && !transport.bound
      ? 'The provider series is usable, but the exact executed request is unavailable.'
      : request?.valid === true
        ? 'Only complete validated hours are shown; the provider series is incomplete or inconsistent.'
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
    providerHourCount,
    validHourCount,
    invalidHourCount,
    missingMeasurementCount,
    invalidMeasurementCount,
    arrayLengthContract,
    unitContract,
    timeContract,
    cadenceContract,
    horizonContract,
    rows,
  }
}

export function MarineForecastPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = openMeteoMarineModel(data, requestUrl, executedRequest)
  const request = model.request?.valid === true ? model.request : undefined
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-latitude': request?.latitude,
    'data-request-longitude': request?.longitude,
    'data-request-forecast-days': request?.forecastDays,
    'data-provider-latitude': model.providerLatitude,
    'data-provider-longitude': model.providerLongitude,
    'data-timezone': model.timezone,
    'data-utc-offset-seconds': model.utcOffsetSeconds,
    'data-provider-hour-count': model.providerHourCount,
    'data-valid-hour-count': model.validHourCount,
    'data-invalid-hour-count': model.invalidHourCount,
    'data-missing-measurement-count': model.missingMeasurementCount,
    'data-invalid-measurement-count': model.invalidMeasurementCount,
    'data-array-length-contract': String(model.arrayLengthContract),
    'data-unit-contract': String(model.unitContract),
    'data-time-contract': String(model.timeContract),
    'data-cadence-contract': String(model.cadenceContract),
    'data-horizon-contract': String(model.horizonContract),
    'data-wave-direction-semantics': 'from',
    'data-current-direction-semantics': 'toward',
  }

  if (model.state === 'invalid' || !model.timezone || model.utcOffsetSeconds === undefined || model.providerLatitude === undefined || model.providerLongitude === undefined) {
    return <div className="marine-preview weather-empty" data-domain-card="marine-forecast" {...evidence}><strong>Marine forecast unavailable</strong><span>{model.reason}</span></div>
  }

  const now = Date.now()
  const current = model.rows.reduce((closest, row) => Math.abs((row.localEpoch - model.utcOffsetSeconds! * 1000) - now) < Math.abs((closest.localEpoch - model.utcOffsetSeconds! * 1000) - now) ? row : closest, model.rows[0])
  const currentIndex = model.rows.indexOf(current)
  const sampleRows = Array.from({ length: 8 }, (_, index) => model.rows[Math.min(currentIndex + index * 3, model.rows.length - 1)])
    .filter((row, index, all) => all.findIndex((candidate) => candidate.time === row.time) === index)
  const maximumWaveHeight = Math.max(...model.rows.map((row) => row.waveHeight), 1)

  return <div className="marine-preview" data-domain-card="marine-forecast" data-primary-time={current.time} data-primary-wave-height={current.waveHeight} {...evidence}>
    <div className="marine-hero"><div><small>{model.timezone.replaceAll('_', ' ')} · nearest validated forecast hour</small><strong>{formatNumber(current.waveHeight, 2)}<span>m</span></strong><b>Wave height</b><p>{timeLabel(current.time)} · {formatNumber(model.providerLatitude, 3)}, {formatNumber(model.providerLongitude, 3)}</p></div><div className="marine-compass" style={{ '--marine-bearing': `${current.waveDirection}deg` } as CSSProperties}><i>↑</i><span>N</span><b>{formatNumber(current.waveDirection, 0)}° from</b></div></div>
    <div className="marine-metrics">
      <article><small>Wave period</small><strong>{formatNumber(current.wavePeriod, 1)} s</strong><span>Energy interval</span></article>
      <article><small>Sea surface</small><strong>{formatNumber(current.seaSurfaceTemperature, 1)}°C</strong><span>Water temperature</span></article>
      <article><small>Ocean current</small><strong>{formatNumber(current.oceanCurrentVelocity, 1)} km/h</strong><span>{formatNumber(current.oceanCurrentDirection, 0)}° toward</span></article>
    </div>
    <div className="marine-timeline">{sampleRows.map((row) => <article key={row.time}><time>{timeLabel(row.time)}</time><i style={{ '--wave-height': `${Math.min(100, row.waveHeight / maximumWaveHeight * 100)}%` } as CSSProperties}/><strong>{formatNumber(row.waveHeight, 2)} m</strong><small>{dateParts(row.time).full}</small></article>)}</div>
    {model.state === 'partial' && <p className="marine-disclaimer">Partial marine response · {model.reason}</p>}
    <p className="marine-disclaimer">Forecast guidance only · Wave direction is from; ocean-current direction is toward · Not for navigation or safety-critical decisions</p>
  </div>
}
