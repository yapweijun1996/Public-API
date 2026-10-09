import './stationList.css'
import './weatherCards.css'
import type { CSSProperties } from 'react'
import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { cleanText, dateParts, forecastSymbol, formatNumber, isRecord, numberValue, previewLabel, previewValue, recordValue, textValue, timeLabel } from './previewData'
import { finiteNumber, nonNegativeInteger, positiveInteger } from './semanticValidation'

export type WeatherPreviewVariant = 'current' | 'four-day' | 'twenty-four-hour' | 'area-forecast' | 'station-readings' | 'regional-air-quality' | 'air-quality-forecast' | 'uv-index'

const stationWeatherIds = ['data-gov-air-temperature', 'data-gov-rainfall', 'data-gov-relative-humidity', 'data-gov-wind-direction', 'data-gov-wind-speed']

export function selectWeatherPreviewVariant(api: Pick<ApiDemo, 'id'>): WeatherPreviewVariant {
  if (api.id === 'open-meteo-air-quality') return 'air-quality-forecast'
  if (api.id === 'data-gov-4day-forecast') return 'four-day'
  if (api.id === 'data-gov-24hr-forecast') return 'twenty-four-hour'
  if (api.id === 'data-gov-forecast-2hr') return 'area-forecast'
  if (stationWeatherIds.includes(api.id)) return 'station-readings'
  if (['data-gov-pm25', 'data-gov-psi'].includes(api.id)) return 'regional-air-quality'
  if (api.id === 'data-gov-uv-index') return 'uv-index'
  return 'current'
}

const weatherCondition = (code: number | undefined) => {
  if (code === undefined) return { label: 'Live conditions', icon: '◌' }
  if (code === 0) return { label: 'Clear sky', icon: '☀' }
  if (code <= 3) return { label: 'Partly cloudy', icon: '☁' }
  if ([45, 48].includes(code)) return { label: 'Foggy', icon: '≋' }
  if (code <= 67 || [80, 81, 82].includes(code)) return { label: 'Rain showers', icon: '☂' }
  if (code >= 95) return { label: 'Thunderstorms', icon: 'ϟ' }
  return { label: 'Mixed conditions', icon: '◒' }
}

const firstResponseItem = (data: unknown) => {
  if (!isRecord(data) || !Array.isArray(data.items) || !isRecord(data.items[0])) return undefined
  return data.items[0]
}

const rangeValues = (value: unknown) => {
  const range = isRecord(value) ? value : {}
  return { low: numberValue(range.low), high: numberValue(range.high) }
}

const measurementMeta = (api: ApiDemo) => {
  if (api.id === 'data-gov-air-temperature') return { label: 'Air temperature', unit: '°C' }
  if (api.id === 'data-gov-pm25') return { label: 'PM2.5 reading', unit: ' µg/m³' }
  if (api.id === 'data-gov-psi') return { label: 'Air quality index', unit: ' PSI' }
  if (api.id === 'data-gov-rainfall') return { label: 'Rainfall', unit: ' mm' }
  if (api.id === 'data-gov-relative-humidity') return { label: 'Relative humidity', unit: '%' }
  if (api.id === 'data-gov-uv-index') return { label: 'UV index', unit: '' }
  if (api.id === 'data-gov-wind-direction') return { label: 'Wind direction', unit: '°' }
  if (api.id === 'data-gov-wind-speed') return { label: 'Wind speed', unit: ' km/h' }
  return { label: 'Current conditions', unit: undefined }
}

type OpenMeteoResultState = 'ready' | 'partial' | 'invalid'

type OpenMeteoRequest = {
  latitude: number
  longitude: number
}

type CurrentWeatherViewModel = {
  state: OpenMeteoResultState
  reason?: string
  request?: OpenMeteoRequest
  envelopeContract: boolean
  providerCoordinateContract: boolean
  timezoneContract: boolean
  timeContract: boolean
  unitsContract: boolean
  measurementContract: boolean
  validMeasurementCount: number
  providerLatitude?: number
  providerLongitude?: number
  timezone?: string
  utcOffsetSeconds?: number
  time?: string
  interval?: number
  temperature?: number
  humidity?: number
  wind?: number
  code?: number
  temperatureUnit?: string
  humidityUnit?: string
  windUnit?: string
}

type AirQualityViewModel = {
  state: OpenMeteoResultState
  reason?: string
  request?: OpenMeteoRequest
  envelopeContract: boolean
  providerCoordinateContract: boolean
  timezoneContract: boolean
  timeContract: boolean
  unitsContract: boolean
  measurementContract: boolean
  validMeasurementCount: number
  providerLatitude?: number
  providerLongitude?: number
  timezone?: string
  utcOffsetSeconds?: number
  time?: string
  interval?: number
  aqi?: number
  pm25?: number
  pm10?: number
  nitrogenDioxide?: number
  ozone?: number
  pollutantUnit?: string
}

const FORECAST_CURRENT_VARIABLES = ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'weather_code'] as const
const AIR_QUALITY_CURRENT_VARIABLES = ['us_aqi', 'pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone'] as const
const WMO_WEATHER_CODES = new Set([0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99])

const exactSearchKeys = (url: URL, expected: string[]) => {
  const entries = [...url.searchParams.entries()]
  return entries.length === expected.length
    && entries.every(([key]) => expected.includes(key))
    && expected.every((key) => entries.filter(([candidate]) => candidate === key).length === 1)
}

const requestCoordinate = (value: string | null, minimum: number, maximum: number) => {
  if (!value || value !== value.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined
}

const sameVariables = (value: string | null, expected: readonly string[]) => {
  if (!value) return false
  const variables = value.split(',')
  return variables.length === expected.length
    && new Set(variables).size === expected.length
    && variables.every((variable) => expected.includes(variable))
}

const parseOpenMeteoRequest = (
  request: ExecutedRequestContext | undefined,
  expectedHost: string,
  expectedPath: string,
  expectedVariables: readonly string[],
): OpenMeteoRequest | undefined => {
  if (!request || request.method !== 'GET' || request.body !== undefined) return undefined
  try {
    const url = new URL(request.url)
    const authority = /^https:\/\/([^/?#]+)/.exec(request.url)?.[1]
    const latitude = requestCoordinate(url.searchParams.get('latitude'), -90, 90)
    const longitude = requestCoordinate(url.searchParams.get('longitude'), -180, 180)
    const valid = url.protocol === 'https:'
      && url.hostname === expectedHost
      && authority === expectedHost
      && url.port === ''
      && url.pathname === expectedPath
      && !url.username
      && !url.password
      && !url.hash
      && exactSearchKeys(url, ['latitude', 'longitude', 'current', 'timezone'])
      && sameVariables(url.searchParams.get('current'), expectedVariables)
      && url.searchParams.get('timezone') === 'auto'
      && latitude !== undefined
      && longitude !== undefined
    return valid && latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined
  } catch {
    return undefined
  }
}

const boundedCoordinate = (value: unknown, minimum: number, maximum: number) => {
  const parsed = finiteNumber(value)
  return parsed !== undefined && parsed >= minimum && parsed <= maximum ? parsed : undefined
}

const timezoneOffset = (value: unknown) => typeof value === 'number'
  && Number.isInteger(value)
  && value >= -43_200
  && value <= 50_400
  ? value
  : undefined

const providerTimezone = (value: unknown) => {
  if (typeof value !== 'string' || value !== value.trim()) return undefined
  return /^(?:UTC|GMT|[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z][A-Za-z0-9._+-]*)+)$/.test(value) ? value : undefined
}

const localIsoDateTime = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return undefined
  const [, year, month, day, hour, minute, second = '0'] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)))
  const valid = date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day)
    && date.getUTCHours() === Number(hour)
    && date.getUTCMinutes() === Number(minute)
    && date.getUTCSeconds() === Number(second)
  return valid ? value : undefined
}

const expectedUnits = (value: unknown, units: Record<string, string>) => isRecord(value)
  && Object.entries(units).every(([key, expected]) => value[key] === expected)

const nonNegativeNumber = (value: unknown) => {
  const parsed = finiteNumber(value)
  return parsed !== undefined && parsed >= 0 ? parsed : undefined
}

const weatherCode = (value: unknown) => typeof value === 'number'
  && Number.isInteger(value)
  && WMO_WEATHER_CODES.has(value)
  ? value
  : undefined

export const currentWeatherModel = (data: unknown, executedRequest?: ExecutedRequestContext): CurrentWeatherViewModel => {
  const request = parseOpenMeteoRequest(executedRequest, 'api.open-meteo.com', '/v1/forecast', FORECAST_CURRENT_VARIABLES)
  const envelopeContract = isRecord(data) && isRecord(data.current)
  const root = isRecord(data) ? data : {}
  const current = envelopeContract ? root.current as Record<string, unknown> : {}
  const units = isRecord(root.current_units) ? root.current_units : undefined
  const providerLatitude = boundedCoordinate(root.latitude, -90, 90)
  const providerLongitude = boundedCoordinate(root.longitude, -180, 180)
  const providerCoordinateContract = providerLatitude !== undefined && providerLongitude !== undefined
  const timezone = providerTimezone(root.timezone)
  const utcOffsetSeconds = timezoneOffset(root.utc_offset_seconds)
  const timezoneContract = timezone !== undefined && utcOffsetSeconds !== undefined
  const time = localIsoDateTime(current.time)
  const interval = positiveInteger(current.interval)
  const timeContract = time !== undefined && interval !== undefined
  const temperature = finiteNumber(current.temperature_2m)
  const rawHumidity = finiteNumber(current.relative_humidity_2m)
  const humidity = rawHumidity !== undefined && rawHumidity >= 0 && rawHumidity <= 100 ? rawHumidity : undefined
  const wind = nonNegativeNumber(current.wind_speed_10m)
  const code = weatherCode(current.weather_code)
  const validMeasurementCount = [temperature, humidity, wind, code].filter((value) => value !== undefined).length
  const measurementContract = validMeasurementCount === FORECAST_CURRENT_VARIABLES.length
  const unitsContract = expectedUnits(units, {
    time: 'iso8601',
    interval: 'seconds',
    temperature_2m: '°C',
    relative_humidity_2m: '%',
    wind_speed_10m: 'km/h',
    weather_code: 'wmo code',
  })
  const validIdentityAndEnvelope = Boolean(request) && envelopeContract
  const state = !validIdentityAndEnvelope || validMeasurementCount === 0
    ? 'invalid'
    : providerCoordinateContract && timezoneContract && timeContract && unitsContract && measurementContract
      ? 'ready'
      : 'partial'
  const reason = !request
    ? 'The response is not bound to the exact bodyless Open-Meteo current-conditions request.'
    : !envelopeContract
      ? 'Open-Meteo did not return the required current response envelope. No live weather conclusion can be drawn from this response.'
      : validMeasurementCount === 0
        ? 'No trusted current-condition measurements were returned. No live weather conclusion can be drawn from this response.'
        : state === 'partial'
          ? 'Only strictly validated current-condition evidence is shown; missing or malformed response facts remain unavailable.'
          : undefined

  return {
    state,
    reason,
    request,
    envelopeContract,
    providerCoordinateContract,
    timezoneContract,
    timeContract,
    unitsContract,
    measurementContract,
    validMeasurementCount,
    providerLatitude,
    providerLongitude,
    timezone,
    utcOffsetSeconds,
    time,
    interval,
    temperature,
    humidity,
    wind,
    code,
    temperatureUnit: units?.temperature_2m === '°C' ? '°C' : undefined,
    humidityUnit: units?.relative_humidity_2m === '%' ? '%' : undefined,
    windUnit: units?.wind_speed_10m === 'km/h' ? 'km/h' : undefined,
  }
}

const coordinateLabel = (latitude?: number, longitude?: number) => latitude === undefined || longitude === undefined
  ? 'Unavailable'
  : `${formatNumber(latitude, 3)}, ${formatNumber(longitude, 3)}`

const measurementLabel = (value: number | undefined, unit: string | undefined, spaced = false) => value === undefined
  ? '—'
  : unit
    ? `${formatNumber(value)}${spaced ? ' ' : ''}${unit}`
    : `${formatNumber(value)} (unit unavailable)`

export function CurrentConditionsPreview({ data, api, executedRequest }: { data: unknown; api: ApiDemo; executedRequest?: ExecutedRequestContext }) {
  const model = currentWeatherModel(data, executedRequest)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(model.request)),
    'data-envelope-contract': String(model.envelopeContract),
    'data-provider-coordinate-contract': String(model.providerCoordinateContract),
    'data-timezone-contract': String(model.timezoneContract),
    'data-time-contract': String(model.timeContract),
    'data-units-contract': String(model.unitsContract),
    'data-measurement-contract': String(model.measurementContract),
    'data-valid-measurement-count': model.validMeasurementCount,
    'data-request-latitude': model.request?.latitude,
    'data-request-longitude': model.request?.longitude,
    'data-provider-latitude': model.providerLatitude,
    'data-provider-longitude': model.providerLongitude,
    'data-provider-timezone': model.timezone,
    'data-utc-offset-seconds': model.utcOffsetSeconds,
    'data-observation-time': model.time,
    'data-observation-interval': model.interval,
    'data-temperature-2m': model.temperature,
    'data-relative-humidity-2m': model.humidity,
    'data-wind-speed-10m': model.wind,
    'data-weather-code': model.code,
  }

  if (model.state === 'invalid') return <div className="weather-empty" data-domain-card="current-weather" {...evidence}>
    <strong>Current weather response unavailable</strong>
    <span>{model.reason}</span>
  </div>

  const condition = weatherCondition(model.code)
  const location = model.timezone?.split('/').at(-1)?.replace(/_/g, ' ') ?? 'Timezone unavailable'
  const measurement = measurementMeta(api)
  const metrics = [
    { label: 'Humidity', value: measurementLabel(model.humidity, model.humidityUnit), icon: '◉' },
    { label: 'Wind speed', value: measurementLabel(model.wind, model.windUnit, true), icon: '≈' },
    { label: 'Requested coordinates', value: coordinateLabel(model.request?.latitude, model.request?.longitude), icon: '⌖' },
    { label: 'Provider grid', value: coordinateLabel(model.providerLatitude, model.providerLongitude), icon: '⌖' },
  ]
  return <div
    className="weather-preview"
    data-domain-card="current-weather"
    {...evidence}
  >
    {model.state === 'partial' && <p className="diagnostic-warning" role="status">Provider response is incomplete. {model.reason}</p>}
    <div className="weather-hero">
      <div><span className="weather-location">⌖ {location}</span><strong>{measurementLabel(model.temperature, measurement.unit ?? model.temperatureUnit)}</strong><b>{model.code === undefined ? measurement.label : condition.label}</b><small>{model.time ? `Updated ${model.time.replace('T', ' ')}` : 'Observation time unavailable'}</small></div>
      <span className="weather-symbol" aria-hidden="true">{condition.icon}</span>
    </div>
    <div className="weather-metrics">{metrics.map((metric) => <article key={metric.label}><span aria-hidden="true">{metric.icon}</span><div><small>{metric.label}</small><strong>{metric.value}</strong></div></article>)}</div>
  </div>
}

export function FourDayForecastPreview({ data }: { data: unknown }) {
  const item = firstResponseItem(data)
  const forecasts = item && Array.isArray(item.forecasts) ? item.forecasts.filter(isRecord).slice(0, 4) : []
  if (!item || !forecasts.length) return <div className="weather-empty"><strong>Forecast unavailable</strong><span>The response did not include daily forecast records.</span></div>
  const lead = forecasts[0]
  const leadTemperature = rangeValues(lead.temperature)
  const leadHumidity = rangeValues(lead.relative_humidity)
  const leadWind = isRecord(lead.wind) ? lead.wind : {}
  const leadWindSpeed = rangeValues(leadWind.speed)
  const leadForecast = cleanText(lead.forecast) ?? 'Forecast available'
  return <div className="weather-preview weather-forecast-preview" data-weather-view="four-day-outlook">
    <div className="forecast-lead">
      <div><span className="weather-location">⌖ Singapore · {dateParts(lead.date ?? lead.timestamp).full}</span><strong>{leadTemperature.high === undefined ? '—' : `${formatNumber(leadTemperature.high)}°`}<small>{leadTemperature.low === undefined ? '' : ` / ${formatNumber(leadTemperature.low)}°`}</small></strong><b>{leadForecast}</b><small>Updated {timeLabel(item.update_timestamp ?? item.timestamp)}</small></div>
      <span className="weather-symbol" aria-hidden="true">{forecastSymbol(leadForecast)}</span>
    </div>
    <div className="forecast-summary" aria-label="First forecast day details">
      <span><small>Humidity</small><strong>{leadHumidity.low ?? '—'}–{leadHumidity.high ?? '—'}%</strong></span>
      <span><small>Wind</small><strong>{leadWindSpeed.low ?? '—'}–{leadWindSpeed.high ?? '—'} km/h</strong></span>
      <span><small>Direction</small><strong>{previewValue(leadWind.direction)}</strong></span>
    </div>
    <div className="forecast-days">{forecasts.map((forecast, index) => {
      const date = dateParts(forecast.date ?? forecast.timestamp)
      const temperature = rangeValues(forecast.temperature)
      const humidity = rangeValues(forecast.relative_humidity)
      const description = cleanText(forecast.forecast) ?? 'Forecast'
      return <article className={index === 0 ? 'active' : ''} key={`${date.full}-${index}`}><div><span>{date.weekday}</span><small>{date.full}</small></div><b aria-hidden="true">{forecastSymbol(description)}</b><strong>{temperature.high ?? '—'}° <small>{temperature.low ?? '—'}°</small></strong><p>{description}</p><em>Humidity {humidity.low ?? '—'}–{humidity.high ?? '—'}%</em></article>
    })}</div>
  </div>
}

export function TwentyFourHourForecastPreview({ data }: { data: unknown }) {
  const item = firstResponseItem(data)
  const general = item && isRecord(item.general) ? item.general : undefined
  const periods = item && Array.isArray(item.periods) ? item.periods.filter(isRecord).slice(0, 3) : []
  if (!item || !general) return <div className="weather-empty"><strong>Forecast unavailable</strong><span>The response did not include a general forecast.</span></div>
  const temperature = rangeValues(general.temperature)
  const humidity = rangeValues(general.relative_humidity)
  const wind = isRecord(general.wind) ? general.wind : {}
  const windSpeed = rangeValues(wind.speed)
  const description = cleanText(general.forecast) ?? '24-hour forecast'
  return <div className="weather-preview weather-forecast-preview" data-weather-view="twenty-four-hour">
    <div className="forecast-lead compact"><div><span className="weather-location">⌖ Singapore · next 24 hours</span><strong>{temperature.high ?? '—'}°<small> / {temperature.low ?? '—'}°</small></strong><b>{description}</b><small>Valid {timeLabel(recordValue(item.valid_period, 'start'))}–{timeLabel(recordValue(item.valid_period, 'end'))}</small></div><span className="weather-symbol" aria-hidden="true">{forecastSymbol(description)}</span></div>
    <div className="forecast-summary"><span><small>Humidity</small><strong>{humidity.low ?? '—'}–{humidity.high ?? '—'}%</strong></span><span><small>Wind</small><strong>{windSpeed.low ?? '—'}–{windSpeed.high ?? '—'} km/h</strong></span><span><small>Direction</small><strong>{previewValue(wind.direction)}</strong></span></div>
    <div className="forecast-periods">{periods.map((period, index) => {
      const regions = isRecord(period.regions) ? period.regions : {}
      return <article key={`${timeLabel(recordValue(period.time, 'start'))}-${index}`}><div><strong>{timeLabel(recordValue(period.time, 'start'))}–{timeLabel(recordValue(period.time, 'end'))}</strong><small>Regional outlook</small></div><ul>{Object.entries(regions).map(([region, forecast]) => <li key={region}><span>{previewLabel(region)}</span><b>{previewValue(forecast)}</b></li>)}</ul></article>
    })}</div>
  </div>
}

export function AreaForecastPreview({ data }: { data: unknown }) {
  const item = firstResponseItem(data)
  const forecasts = item && Array.isArray(item.forecasts) ? item.forecasts.filter(isRecord) : []
  if (!item || !forecasts.length) return <div className="weather-empty"><strong>Area forecast unavailable</strong><span>No neighbourhood forecasts were returned.</span></div>
  const counts = new Map<string, number>()
  forecasts.forEach((forecast) => {
    const description = cleanText(forecast.forecast) ?? 'Unknown'
    counts.set(description, (counts.get(description) ?? 0) + 1)
  })
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return <div className="weather-preview area-forecast-preview" data-weather-view="area-forecast">
    <div className="area-forecast-summary"><div><span>Singapore neighbourhoods</span><strong>{forecasts.length}</strong><b>areas reporting</b><small>Valid {timeLabel(recordValue(item.valid_period, 'start'))}–{timeLabel(recordValue(item.valid_period, 'end'))}</small></div><div><span aria-hidden="true">{forecastSymbol(dominant?.[0])}</span><strong>{dominant?.[0] ?? 'Current outlook'}</strong><small>{dominant?.[1] ?? 0} areas</small></div></div>
    <div className="area-forecast-grid">{forecasts.slice(0, 12).map((forecast, index) => <article key={`${forecast.area}-${index}`}><span aria-hidden="true">{forecastSymbol(cleanText(forecast.forecast))}</span><div><strong>{previewValue(forecast.area)}</strong><small>{previewValue(forecast.forecast)}</small></div></article>)}</div>
  </div>
}

export function StationReadingsPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const root = isRecord(data) ? data : {}
  const metadata = isRecord(root.metadata) ? root.metadata : {}
  const item = firstResponseItem(data)
  const readings = item && Array.isArray(item.readings) ? item.readings.filter(isRecord) : []
  const stations = Array.isArray(metadata.stations) ? metadata.stations.filter(isRecord) : []
  const stationById = new Map(stations.map((station) => [textValue(station.id) ?? '', station]))
  const values = readings.map((reading) => numberValue(reading.value)).filter((value): value is number => value !== undefined)
  if (!readings.length || !values.length) return <div className="weather-empty"><strong>Station readings unavailable</strong><span>No measurement values were returned.</span></div>
  const measurement = measurementMeta(api)
  const metadataUnit = textValue(metadata.reading_unit)?.replace('deg C', '°C')
  const unit = metadataUnit ?? measurement.unit?.trim() ?? ''
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return <div className="weather-preview station-readings-preview" data-weather-view="station-readings">
    <div className="station-summary"><div><span>{measurement.label}</span><strong>{formatNumber(average)}{unit}</strong><b>Network average</b><small>{values.length} active station{values.length === 1 ? '' : 's'} · {timeLabel(item?.timestamp)}</small></div><dl><div><dt>Lowest</dt><dd>{formatNumber(Math.min(...values))}{unit}</dd></div><div><dt>Highest</dt><dd>{formatNumber(Math.max(...values))}{unit}</dd></div><div><dt>Updated</dt><dd>{timeLabel(item?.timestamp)}</dd></div></dl></div>
    <div className="station-list">{readings.slice(0, 8).map((reading, index) => {
      const station = stationById.get(textValue(reading.station_id) ?? '')
      return <article key={`${reading.station_id}-${index}`}><span>{textValue(reading.station_id) ?? index + 1}</span><div><strong>{textValue(station?.name) ?? 'Weather station'}</strong><small>{station && isRecord(station.location) ? `${previewValue(station.location.latitude)}, ${previewValue(station.location.longitude)}` : 'Singapore sensor network'}</small></div><b>{previewValue(reading.value)}{unit}</b></article>
    })}</div>
  </div>
}

const singaporeAirQualityRegions = ['north', 'south', 'east', 'west', 'central'] as const

const isoDateTimeText = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const candidate = value.trim()
  if (candidate.length < 17 || candidate.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(candidate)) return undefined
  return Number.isFinite(Date.parse(candidate)) ? candidate : undefined
}

const regionalAirQualityMeta = (api: ApiDemo) => api.id === 'data-gov-psi'
  ? {
      metricKey: 'psi_twenty_four_hourly',
      label: 'PSI',
      unit: 'PSI',
      band: (value: number) => value <= 50 ? 'Good' : value <= 100 ? 'Moderate' : value <= 200 ? 'Unhealthy' : value <= 300 ? 'Very unhealthy' : 'Hazardous',
    }
  : {
      metricKey: 'pm25_one_hourly',
      label: 'PM2.5',
      unit: 'µg/m³',
      band: (value: number) => value <= 55 ? 'Normal' : value <= 150 ? 'Elevated' : value <= 250 ? 'High' : 'Very High',
    }

function InvalidRegionalAirQuality({ label, metricKey, unit, providerCount = 0, invalidCount = 0, missingCount = singaporeAirQualityRegions.length, detail }: {
  label: string
  metricKey: string
  unit: string
  providerCount?: number
  invalidCount?: number
  missingCount?: number
  detail: string
}) {
  return <div
    className="weather-empty"
    data-domain-card="regional-air-quality"
    data-weather-view="regional-air-quality"
    data-result-state="invalid"
    data-metric-key={metricKey}
    data-provider-region-count={providerCount}
    data-valid-region-count="0"
    data-invalid-region-count={invalidCount}
    data-missing-region-count={missingCount}
    data-unit={unit}
  >
    <strong>Regional {label} response invalid</strong>
    <span>{detail}</span>
  </div>
}

export function RegionalAirQualityPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const meta = regionalAirQualityMeta(api)
  const item = firstResponseItem(data)
  const readings = item && isRecord(item.readings) ? item.readings : undefined
  const regional = readings && isRecord(readings[meta.metricKey]) ? readings[meta.metricKey] : undefined

  if (!regional) {
    return <InvalidRegionalAirQuality
      label={meta.label}
      metricKey={meta.metricKey}
      unit={meta.unit}
      detail={`The provider response did not contain the required items[0].readings.${meta.metricKey} regional object. No ${meta.label} values or status are shown.`}
    />
  }

  const providerEntries = Object.entries(regional)
  const trustedRegionNames = new Set<string>(singaporeAirQualityRegions)
  const valueByRegion = new Map<string, number>()
  let invalidCount = 0

  providerEntries.forEach(([name, rawValue]) => {
    const value = finiteNumber(rawValue)
    if (!trustedRegionNames.has(name) || value === undefined || value < 0) {
      invalidCount += 1
      return
    }
    valueByRegion.set(name, value)
  })

  const regions = singaporeAirQualityRegions.map((name) => ({ name, value: valueByRegion.get(name) }))
  const validValues = regions.flatMap(({ value }) => value === undefined ? [] : [value])
  const missingCount = singaporeAirQualityRegions.filter((name) => !Object.prototype.hasOwnProperty.call(regional, name)).length

  if (!validValues.length) {
    return <InvalidRegionalAirQuality
      label={meta.label}
      metricKey={meta.metricKey}
      unit={meta.unit}
      providerCount={providerEntries.length}
      invalidCount={invalidCount}
      missingCount={missingCount}
      detail={`The required ${meta.metricKey} object contained no trustworthy non-negative JSON-number values for Singapore's five reporting regions. No ${meta.label} values or status are shown.`}
    />
  }

  const observationTime = isoDateTimeText(item?.timestamp)
  const updateTime = isoDateTimeText(item?.update_timestamp)
  const hasCompleteRegions = validValues.length === singaporeAirQualityRegions.length && invalidCount === 0 && missingCount === 0
  const resultState = hasCompleteRegions && observationTime && updateTime ? 'ready' : 'partial'
  const max = Math.max(...validValues)
  const average = validValues.reduce((sum, value) => sum + value, 0) / validValues.length
  const status = meta.band(max)
  const incompleteFacts = [
    invalidCount > 0 ? `${invalidCount} invalid provider entr${invalidCount === 1 ? 'y' : 'ies'}` : undefined,
    missingCount > 0 ? `${missingCount} expected region${missingCount === 1 ? '' : 's'} missing` : undefined,
    !observationTime ? 'observation timestamp invalid or missing' : undefined,
    !updateTime ? 'update timestamp invalid or missing' : undefined,
  ].filter((value): value is string => Boolean(value))

  return <div
    className="weather-preview regional-air-preview"
    data-domain-card="regional-air-quality"
    data-weather-view="regional-air-quality"
    data-result-state={resultState}
    data-metric-key={meta.metricKey}
    data-provider-region-count={providerEntries.length}
    data-valid-region-count={validValues.length}
    data-invalid-region-count={invalidCount}
    data-missing-region-count={missingCount}
    data-unit={meta.unit}
    data-band={status}
    data-band-basis="highest-regional-reading"
    data-highest-regional-reading={max}
    data-derived-regional-average={average}
    data-observation-time={observationTime}
    data-update-time={updateTime}
  >
    {resultState === 'partial' && <p className="diagnostic-warning" role="status">Provider response is incomplete: {validValues.length} trusted region{validValues.length === 1 ? '' : 's'}; {incompleteFacts.join('; ')}.</p>}
    <div className="air-quality-summary"><div><span>Singapore air quality</span><strong>{formatNumber(average)}</strong><b>Derived regional average · {meta.unit}</b><small>{updateTime ? `Updated ${timeLabel(updateTime)}` : 'Update time unavailable'}</small></div><em className={status.toLowerCase().replaceAll(' ', '-')}>{status}</em></div>
    <div className="regional-reading-grid">{regions.map((region) => <article key={region.name}><span>{previewLabel(region.name)}</span><strong>{region.value === undefined ? '—' : formatNumber(region.value)}</strong><small>{meta.unit}</small><i style={{ '--reading-level': region.value === undefined ? '0%' : `${Math.min(100, (region.value / Math.max(max, 1)) * 100)}%` } as CSSProperties}/></article>)}</div>
  </div>
}

export const airQualityForecastModel = (data: unknown, executedRequest?: ExecutedRequestContext): AirQualityViewModel => {
  const request = parseOpenMeteoRequest(executedRequest, 'air-quality-api.open-meteo.com', '/v1/air-quality', AIR_QUALITY_CURRENT_VARIABLES)
  const envelopeContract = isRecord(data) && isRecord(data.current)
  const root = isRecord(data) ? data : {}
  const current = envelopeContract ? root.current as Record<string, unknown> : {}
  const units = isRecord(root.current_units) ? root.current_units : undefined
  const providerLatitude = boundedCoordinate(root.latitude, -90, 90)
  const providerLongitude = boundedCoordinate(root.longitude, -180, 180)
  const providerCoordinateContract = providerLatitude !== undefined && providerLongitude !== undefined
  const timezone = providerTimezone(root.timezone)
  const utcOffsetSeconds = timezoneOffset(root.utc_offset_seconds)
  const timezoneContract = timezone !== undefined && utcOffsetSeconds !== undefined
  const time = localIsoDateTime(current.time)
  const interval = positiveInteger(current.interval)
  const timeContract = time !== undefined && interval !== undefined
  const aqi = nonNegativeInteger(current.us_aqi)
  const pm25 = nonNegativeNumber(current.pm2_5)
  const pm10 = nonNegativeNumber(current.pm10)
  const nitrogenDioxide = nonNegativeNumber(current.nitrogen_dioxide)
  const ozone = nonNegativeNumber(current.ozone)
  const validMeasurementCount = [aqi, pm25, pm10, nitrogenDioxide, ozone].filter((value) => value !== undefined).length
  const measurementContract = validMeasurementCount === AIR_QUALITY_CURRENT_VARIABLES.length
  const unitsContract = expectedUnits(units, {
    time: 'iso8601',
    interval: 'seconds',
    us_aqi: 'USAQI',
    pm2_5: 'μg/m³',
    pm10: 'μg/m³',
    nitrogen_dioxide: 'μg/m³',
    ozone: 'μg/m³',
  })
  const state = !request || !envelopeContract || validMeasurementCount === 0
    ? 'invalid'
    : providerCoordinateContract && timezoneContract && timeContract && unitsContract && measurementContract
      ? 'ready'
      : 'partial'
  const reason = !request
    ? 'The response is not bound to the exact bodyless Open-Meteo air-quality request.'
    : !envelopeContract
      ? 'Open-Meteo did not return the required current air-quality response envelope.'
      : validMeasurementCount === 0
        ? 'No trusted current air-quality measurements were returned.'
        : state === 'partial'
          ? 'Only strictly validated current air-quality evidence is shown; missing or malformed response facts remain unavailable.'
          : undefined

  return {
    state,
    reason,
    request,
    envelopeContract,
    providerCoordinateContract,
    timezoneContract,
    timeContract,
    unitsContract,
    measurementContract,
    validMeasurementCount,
    providerLatitude,
    providerLongitude,
    timezone,
    utcOffsetSeconds,
    time,
    interval,
    aqi,
    pm25,
    pm10,
    nitrogenDioxide,
    ozone,
    pollutantUnit: units?.pm2_5 === 'μg/m³'
      && units.pm10 === 'μg/m³'
      && units.nitrogen_dioxide === 'μg/m³'
      && units.ozone === 'μg/m³'
      ? 'μg/m³'
      : undefined,
  }
}

export function AirQualityForecastPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const model = airQualityForecastModel(data, executedRequest)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(model.request)),
    'data-envelope-contract': String(model.envelopeContract),
    'data-provider-coordinate-contract': String(model.providerCoordinateContract),
    'data-timezone-contract': String(model.timezoneContract),
    'data-time-contract': String(model.timeContract),
    'data-units-contract': String(model.unitsContract),
    'data-measurement-contract': String(model.measurementContract),
    'data-valid-measurement-count': model.validMeasurementCount,
    'data-request-latitude': model.request?.latitude,
    'data-request-longitude': model.request?.longitude,
    'data-provider-latitude': model.providerLatitude,
    'data-provider-longitude': model.providerLongitude,
    'data-provider-timezone': model.timezone,
    'data-utc-offset-seconds': model.utcOffsetSeconds,
    'data-observation-time': model.time,
    'data-observation-interval': model.interval,
    'data-us-aqi': model.aqi,
    'data-pm2-5': model.pm25,
    'data-pm10': model.pm10,
    'data-nitrogen-dioxide': model.nitrogenDioxide,
    'data-ozone': model.ozone,
  }

  if (model.state === 'invalid') return <div className="weather-empty" data-domain-card="open-meteo-air-quality" data-weather-view="air-quality-forecast" {...evidence}>
    <strong>Air-quality response unavailable</strong>
    <span>{model.reason}</span>
  </div>

  const status = model.aqi === undefined
    ? 'Unavailable'
    : model.aqi <= 50 ? 'Good' : model.aqi <= 100 ? 'Moderate' : model.aqi <= 150 ? 'Sensitive groups' : model.aqi <= 200 ? 'Unhealthy' : model.aqi <= 300 ? 'Very unhealthy' : 'Hazardous'
  const metrics = [
    { label: 'PM2.5', value: model.pm25 },
    { label: 'PM10', value: model.pm10 },
    { label: 'Nitrogen dioxide', value: model.nitrogenDioxide },
    { label: 'Ozone', value: model.ozone },
  ]
  return <div className="weather-preview global-air-preview" data-domain-card="open-meteo-air-quality" data-weather-view="air-quality-forecast" {...evidence}>
    {model.state === 'partial' && <p className="diagnostic-warning" role="status">Provider response is incomplete. {model.reason}</p>}
    <div className="global-air-hero"><div><span>⌖ {model.timezone?.replaceAll('_', ' ') ?? 'Timezone unavailable'}</span><strong>{model.aqi === undefined ? '—' : formatNumber(model.aqi)}</strong><b>U.S. AQI · {status}</b><small>{model.time ? `Updated ${model.time.replace('T', ' ')}` : 'Observation time unavailable'}</small></div><div className="air-orbit" aria-hidden="true"><i/><i/><i/></div></div>
    <div className="global-air-metrics">
      {metrics.map((metric) => <article key={metric.label}><small>{metric.label}</small><strong>{metric.value === undefined ? '—' : formatNumber(metric.value)}</strong><span>{model.pollutantUnit ?? 'Unit unavailable'}</span></article>)}
      <article><small>Requested coordinates</small><strong>{coordinateLabel(model.request?.latitude, model.request?.longitude)}</strong></article>
      <article><small>Provider grid</small><strong>{coordinateLabel(model.providerLatitude, model.providerLongitude)}</strong></article>
    </div>
  </div>
}

export function UvIndexPreview({ data }: { data: unknown }) {
  const item = firstResponseItem(data)
  const indexes = item && Array.isArray(item.index) ? item.index.filter(isRecord) : []
  const latest = indexes[0]
  const value = numberValue(latest?.value)
  if (value === undefined) return <div className="weather-empty"><strong>UV reading unavailable</strong><span>No UV index values were returned.</span></div>
  const status = value < 3 ? 'Low' : value < 6 ? 'Moderate' : value < 8 ? 'High' : value < 11 ? 'Very high' : 'Extreme'
  return <div className="weather-preview uv-preview" data-weather-view="uv-index"><div className="uv-summary"><div><span>Current UV index</span><strong>{formatNumber(value)}</strong><b>{status}</b><small>Updated {timeLabel(item?.update_timestamp ?? latest.timestamp)}</small></div><div className="uv-gauge" style={{ '--uv-position': `${Math.min(100, (value / 12) * 100)}%` } as CSSProperties}><i/><span>Low</span><span>Extreme</span></div></div>{indexes.length > 1 && <div className="uv-timeline">{indexes.slice(0, 8).map((entry, index) => <article key={`${entry.timestamp}-${index}`}><span>{timeLabel(entry.timestamp)}</span><strong>{previewValue(entry.value)}</strong></article>)}</div>}</div>
}
