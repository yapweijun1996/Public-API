import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { ApiDemo } from './apiCatalog'
import { getPreviewProfile, type PreviewLayout } from './previewProfiles'

export type { PreviewLayout } from './previewProfiles'

export type WeatherPreviewVariant = 'current' | 'four-day' | 'twenty-four-hour' | 'area-forecast' | 'station-readings' | 'regional-air-quality' | 'air-quality-forecast' | 'uv-index'

export type DemoPreviewItem = {
  title: string
  fields: Array<{ label: string; value: string }>
}

type MediaItem = { image: string; title: string; subtitle?: string }
type LocationPoint = { latitude: number; longitude: number; label: string; detail?: string }
type MarketSnapshot = { label: string; value: number; currency?: string; points: number[]; dates: string[]; metrics: Array<{ label: string; value: string }> }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const previewTitleKeys = ['name', 'title', 'label', 'commonname', 'country', 'city', 'id', 'code']
const previewCollectionKeys = ['results', 'items', 'records', 'data', 'features', 'entries', 'result', 'docs']

const previewLabel = (key: string) => key
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .split(' ')
  .filter(Boolean)
  .map((word) => ['id', 'url', 'api', 'iso', 'utc', 'gdp'].includes(word.toLowerCase()) ? word.toUpperCase() : `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
  .join(' ')

const previewValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)
  if (typeof value === 'string') return value.length > 90 ? `${value.slice(0, 87)}…` : value
  if (Array.isArray(value)) {
    const scalars = value.filter((item) => ['string', 'number', 'boolean'].includes(typeof item))
    return scalars.length === value.length ? scalars.slice(0, 4).map(previewValue).join(', ') : `${value.length} items`
  }
  if (isRecord(value)) {
    for (const key of ['value', 'name', 'title', 'label', 'id', 'code']) {
      if (key in value && !isRecord(value[key]) && !Array.isArray(value[key])) return previewValue(value[key])
    }
    return `${Object.keys(value).length} properties`
  }
  return String(value)
}

const findPreviewRecords = (value: unknown, depth = 0): Array<Record<string, unknown>> => {
  if (depth > 6) return []
  if (Array.isArray(value)) {
    const directRecords = value.filter(isRecord)
    if (directRecords.length && directRecords.length === value.length) return directRecords
    for (const item of value) {
      const nested = findPreviewRecords(item, depth + 1)
      if (nested.length) return nested
    }
    return directRecords
  }
  if (!isRecord(value)) return []
  for (const key of previewCollectionKeys) {
    if (key in value) {
      const nested = findPreviewRecords(value[key], depth + 1)
      if (nested.length) return nested
    }
  }
  for (const item of Object.values(value)) {
    if (!Array.isArray(item) && !isRecord(item)) continue
    const nested = findPreviewRecords(item, depth + 1)
    if (nested.length) return nested
  }
  return depth === 0 ? [value] : []
}

export const buildDemoPreview = (data: unknown): DemoPreviewItem[] => {
  const records = findPreviewRecords(data)
  if (!records.length) {
    if (Array.isArray(data)) return data.slice(0, 6).map((value, index) => ({ title: `Result ${index + 1}`, fields: [{ label: 'Value', value: previewValue(value) }] }))
    return [{ title: 'Response value', fields: [{ label: 'Value', value: previewValue(data) }] }]
  }
  return records.slice(0, 6).map((record, index) => {
    const entries = Object.entries(record)
    let titleEntry: [string, unknown] | undefined
    for (const preferredKey of previewTitleKeys) {
      titleEntry = entries.find(([key, value]) => key.toLowerCase() === preferredKey && ['string', 'number'].includes(typeof value))
      if (titleEntry) break
    }
    const fields = entries
      .filter(([key, value]) => key !== titleEntry?.[0] && value !== undefined)
      .slice(0, 6)
      .map(([key, value]) => ({ label: previewLabel(key), value: previewValue(value) }))
    return { title: titleEntry ? previewValue(titleEntry[1]) : `Result ${index + 1}`, fields: fields.length ? fields : [{ label: 'Value', value: previewValue(record) }] }
  })
}

const stationWeatherIds = ['data-gov-air-temperature', 'data-gov-rainfall', 'data-gov-relative-humidity', 'data-gov-wind-direction', 'data-gov-wind-speed']

export function selectPreviewLayout(api: Pick<ApiDemo, 'id' | 'category'>): PreviewLayout {
  return getPreviewProfile(api.id)?.layout ?? 'result-list'
}

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

const scalar = (value: unknown) => ['string', 'number', 'boolean'].includes(typeof value) ? value : undefined
const numberValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined
const textValue = (value: unknown) => scalar(value) === undefined ? undefined : String(value)
const recordValue = (value: unknown, key: string) => isRecord(value) ? value[key] : undefined

const findByKey = (value: unknown, keys: string[], depth = 0): unknown => {
  if (depth > 7 || value === null || value === undefined) return undefined
  if (isRecord(value)) {
    const entry = Object.entries(value).find(([key, item]) => keys.some((candidate) => key.toLowerCase() === candidate.toLowerCase()) && scalar(item) !== undefined)
    if (entry) return entry[1]
    for (const item of Object.values(value)) {
      const found = findByKey(item, keys, depth + 1)
      if (found !== undefined) return found
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findByKey(item, keys, depth + 1)
      if (found !== undefined) return found
    }
  }
  return undefined
}

const formatNumber = (value: number, digits = 1) => new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value)
const compactNumber = (value: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
const decodeHtml = (value: string) => value.replace(/&(#x[\da-f]+|#\d+|quot|apos|amp|lt|gt);/gi, (entity, code: string) => {
  const named: Record<string, string> = { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' }
  if (code[0] !== '#') return named[code.toLowerCase()] ?? entity
  const numeric = Number.parseInt(code[1].toLowerCase() === 'x' ? code.slice(2) : code.slice(1), code[1].toLowerCase() === 'x' ? 16 : 10)
  return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity
})
const cleanText = (value: unknown) => {
  const text = textValue(value)
  return text ? decodeHtml(text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()) : undefined
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

const forecastSymbol = (forecast: string | undefined) => {
  const value = forecast?.toLowerCase() ?? ''
  if (value.includes('thunder')) return 'ϟ'
  if (value.includes('shower') || value.includes('rain')) return '☂'
  if (value.includes('cloud')) return '☁'
  if (value.includes('fair') || value.includes('sun') || value.includes('clear')) return '☀'
  if (value.includes('haze') || value.includes('mist')) return '≋'
  return '◒'
}

const firstResponseItem = (data: unknown) => {
  if (!isRecord(data) || !Array.isArray(data.items) || !isRecord(data.items[0])) return undefined
  return data.items[0]
}

const dateParts = (value: unknown) => {
  const text = textValue(value)
  if (!text) return { day: '—', weekday: 'Forecast', full: '' }
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return { day: text.slice(-2), weekday: 'Forecast', full: text }
  return {
    day: date.toLocaleDateString('en-SG', { day: '2-digit' }),
    weekday: date.toLocaleDateString('en-SG', { weekday: 'short' }),
    full: date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }),
  }
}

const timeLabel = (value: unknown) => {
  const text = textValue(value)
  if (!text) return '—'
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? text : date.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })
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

function CurrentConditionsPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const root = isRecord(data) ? data : {}
  const current = isRecord(root.current) ? root.current : findPreviewRecords(data)[0] ?? {}
  const units = isRecord(root.current_units) ? root.current_units : {}
  const temperature = numberValue(current.temperature_2m ?? findByKey(data, ['temperature_2m', 'temperature', 'value']))
  const humidity = numberValue(current.relative_humidity_2m ?? findByKey(data, ['relative_humidity_2m', 'humidity']))
  const wind = numberValue(current.wind_speed_10m ?? findByKey(data, ['wind_speed_10m', 'wind_speed']))
  const code = numberValue(current.weather_code ?? findByKey(data, ['weather_code']))
  const condition = weatherCondition(code)
  const timezone = textValue(root.timezone) ?? textValue(findByKey(data, ['area', 'location'])) ?? 'Live station'
  const location = timezone.split('/').at(-1)?.replace(/_/g, ' ') ?? timezone
  const time = textValue(current.time ?? findByKey(data, ['timestamp', 'date']))
  const temperatureUnit = textValue(units.temperature_2m) ?? '°C'
  const measurement = measurementMeta(api)
  const primaryUnit = measurement.unit ?? temperatureUnit
  const metrics = [
    { label: 'Humidity', value: humidity === undefined ? 'Live reading' : `${formatNumber(humidity)}%`, icon: '◉' },
    { label: 'Wind speed', value: wind === undefined ? 'Live reading' : `${formatNumber(wind)} ${textValue(units.wind_speed_10m) ?? 'km/h'}`, icon: '≈' },
    { label: 'Coordinates', value: root.latitude !== undefined && root.longitude !== undefined ? `${formatNumber(Number(root.latitude), 3)}, ${formatNumber(Number(root.longitude), 3)}` : 'Station supplied', icon: '⌖' },
  ]
  return <div className="weather-preview">
    <div className="weather-hero">
      <div><span className="weather-location">⌖ {location}</span><strong>{temperature === undefined ? 'Live' : `${formatNumber(temperature)}${primaryUnit}`}</strong><b>{code === undefined ? measurement.label : condition.label}</b><small>{time ? `Updated ${time.replace('T', ' ')}` : 'Current observation'}</small></div>
      <span className="weather-symbol" aria-hidden="true">{condition.icon}</span>
    </div>
    <div className="weather-metrics">{metrics.map((metric) => <article key={metric.label}><span aria-hidden="true">{metric.icon}</span><div><small>{metric.label}</small><strong>{metric.value}</strong></div></article>)}</div>
  </div>
}

function FourDayForecastPreview({ data }: { data: unknown }) {
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

function TwentyFourHourForecastPreview({ data }: { data: unknown }) {
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

function AreaForecastPreview({ data }: { data: unknown }) {
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

function StationReadingsPreview({ data, api }: { data: unknown; api: ApiDemo }) {
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

function RegionalAirQualityPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const item = firstResponseItem(data)
  const readings = item && isRecord(item.readings) ? item.readings : {}
  const preferredKey = api.id === 'data-gov-psi' ? 'psi_twenty_four_hourly' : 'pm25_one_hourly'
  let regional = isRecord(readings[preferredKey]) ? readings[preferredKey] : undefined
  if (!regional) regional = Object.values(readings).find((value) => isRecord(value) && Object.values(value).some((reading) => numberValue(reading) !== undefined)) as Record<string, unknown> | undefined
  const regions = regional ? Object.entries(regional).map(([name, value]) => ({ name, value: numberValue(value) })).filter((entry): entry is { name: string; value: number } => entry.value !== undefined) : []
  if (!regions.length) return <div className="weather-empty"><strong>Regional readings unavailable</strong><span>No regional air-quality values were returned.</span></div>
  const max = Math.max(...regions.map((region) => region.value))
  const average = regions.reduce((sum, region) => sum + region.value, 0) / regions.length
  const unit = api.id === 'data-gov-psi' ? 'PSI' : 'µg/m³'
  const status = api.id === 'data-gov-psi' ? max <= 50 ? 'Good' : max <= 100 ? 'Moderate' : 'Elevated' : max <= 12 ? 'Low' : max <= 35 ? 'Moderate' : 'Elevated'
  return <div className="weather-preview regional-air-preview" data-weather-view="regional-air-quality">
    <div className="air-quality-summary"><div><span>Singapore air quality</span><strong>{formatNumber(average)}</strong><b>{unit} regional average</b><small>Updated {timeLabel(item?.update_timestamp ?? item?.timestamp)}</small></div><em className={status.toLowerCase()}>{status}</em></div>
    <div className="regional-reading-grid">{regions.map((region) => <article key={region.name}><span>{previewLabel(region.name)}</span><strong>{formatNumber(region.value)}</strong><small>{unit}</small><i style={{ '--reading-level': `${Math.min(100, (region.value / Math.max(max, 1)) * 100)}%` } as CSSProperties}/></article>)}</div>
  </div>
}

function AirQualityForecastPreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const current = isRecord(root.current) ? root.current : {}
  const units = isRecord(root.current_units) ? root.current_units : {}
  const aqi = numberValue(current.us_aqi)
  if (aqi === undefined) return <div className="weather-empty"><strong>Air-quality reading unavailable</strong><span>The response did not include a current U.S. AQI value.</span></div>
  const status = aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Sensitive groups' : aqi <= 200 ? 'Unhealthy' : aqi <= 300 ? 'Very unhealthy' : 'Hazardous'
  const metrics = [
    { label: 'PM2.5', key: 'pm2_5' }, { label: 'PM10', key: 'pm10' }, { label: 'Nitrogen dioxide', key: 'nitrogen_dioxide' }, { label: 'Ozone', key: 'ozone' },
  ]
  return <div className="weather-preview global-air-preview" data-weather-view="air-quality-forecast">
    <div className="global-air-hero"><div><span>⌖ {textValue(root.timezone)?.replace('_', ' ') ?? 'Selected coordinates'}</span><strong>{formatNumber(aqi)}</strong><b>U.S. AQI · {status}</b><small>Updated {textValue(current.time)?.replace('T', ' ') ?? 'now'}</small></div><div className="air-orbit" aria-hidden="true"><i/><i/><i/></div></div>
    <div className="global-air-metrics">{metrics.map((metric) => <article key={metric.key}><small>{metric.label}</small><strong>{numberValue(current[metric.key]) === undefined ? '—' : formatNumber(numberValue(current[metric.key]) as number)}</strong><span>{textValue(units[metric.key]) ?? 'µg/m³'}</span></article>)}</div>
  </div>
}

function UvIndexPreview({ data }: { data: unknown }) {
  const item = firstResponseItem(data)
  const indexes = item && Array.isArray(item.index) ? item.index.filter(isRecord) : []
  const latest = indexes[0]
  const value = numberValue(latest?.value)
  if (value === undefined) return <div className="weather-empty"><strong>UV reading unavailable</strong><span>No UV index values were returned.</span></div>
  const status = value < 3 ? 'Low' : value < 6 ? 'Moderate' : value < 8 ? 'High' : value < 11 ? 'Very high' : 'Extreme'
  return <div className="weather-preview uv-preview" data-weather-view="uv-index"><div className="uv-summary"><div><span>Current UV index</span><strong>{formatNumber(value)}</strong><b>{status}</b><small>Updated {timeLabel(item?.update_timestamp ?? latest.timestamp)}</small></div><div className="uv-gauge" style={{ '--uv-position': `${Math.min(100, (value / 12) * 100)}%` } as CSSProperties}><i/><span>Low</span><span>Extreme</span></div></div>{indexes.length > 1 && <div className="uv-timeline">{indexes.slice(0, 8).map((entry, index) => <article key={`${entry.timestamp}-${index}`}><span>{timeLabel(entry.timestamp)}</span><strong>{previewValue(entry.value)}</strong></article>)}</div>}</div>
}

function WeatherPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const variant = selectWeatherPreviewVariant(api)
  if (variant === 'four-day') return <FourDayForecastPreview data={data}/>
  if (variant === 'twenty-four-hour') return <TwentyFourHourForecastPreview data={data}/>
  if (variant === 'area-forecast') return <AreaForecastPreview data={data}/>
  if (variant === 'station-readings') return <StationReadingsPreview data={data} api={api}/>
  if (variant === 'regional-air-quality') return <RegionalAirQualityPreview data={data} api={api}/>
  if (variant === 'air-quality-forecast') return <AirQualityForecastPreview data={data}/>
  if (variant === 'uv-index') return <UvIndexPreview data={data}/>
  return <CurrentConditionsPreview data={data} api={api}/>
}

function CountryPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const country = findPreviewRecords(data)[0] ?? (isRecord(data) ? data : {})
  const name = textValue(country.name) ?? 'Country profile'
  const code = textValue(country.iso2Code ?? country.id ?? country.code) ?? api.monogram
  const region = previewValue(country.region ?? 'Regional data')
  const facts = [
    ['Capital city', previewValue(country.capitalCity)],
    ['Income group', previewValue(country.incomeLevel)],
    ['Lending type', previewValue(country.lendingType)],
    ['Coordinates', country.latitude !== undefined && country.longitude !== undefined ? `${previewValue(country.latitude)}, ${previewValue(country.longitude)}` : '—'],
  ]
  return <div className="country-preview">
    <div className="country-hero"><span className="country-code">{code}</span><div><small>World profile</small><h3>{name}</h3><p><span>●</span> {region}</p></div><span className="country-globe" aria-hidden="true">◎</span></div>
    <dl className="country-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </div>
}

function marketSnapshot(api: ApiDemo, data: unknown): MarketSnapshot {
  if (api.id === 'open-meteo-history' && isRecord(data)) {
    const daily = isRecord(data.daily) ? data.daily : {}
    const units = isRecord(data.daily_units) ? data.daily_units : {}
    const highs = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max.map(numberValue).filter((value): value is number => value !== undefined) : []
    const lows = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min.map(numberValue).filter((value): value is number => value !== undefined) : []
    const rain = Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum.map(numberValue).filter((value): value is number => value !== undefined) : []
    const dates = Array.isArray(daily.time) ? daily.time.map((value) => textValue(value) ?? '') : []
    const latest = highs.at(-1) ?? 0
    return {
      label: `${textValue(data.timezone)?.replace(/_/g, ' ') ?? 'Historical climate'} · Daily high (${textValue(units.temperature_2m_max) ?? '°C'})`, value: latest,
      points: highs, dates,
      metrics: [
        { label: 'Average high', value: highs.length ? `${formatNumber(highs.reduce((sum, value) => sum + value, 0) / highs.length)}°` : '—' },
        { label: 'Average low', value: lows.length ? `${formatNumber(lows.reduce((sum, value) => sum + value, 0) / lows.length)}°` : '—' },
        { label: 'Total rain', value: `${formatNumber(rain.reduce((sum, value) => sum + value, 0))} ${textValue(units.precipitation_sum) ?? 'mm'}` },
      ],
    }
  }
  if (api.id === 'kraken-public-ticker' && isRecord(data)) {
    const result = isRecord(data.result) ? data.result : {}
    const ticker = Object.values(result).find(isRecord) ?? {}
    const last = numberValue(Array.isArray(ticker.c) ? ticker.c[0] : undefined) ?? 0
    const open = numberValue(ticker.o) ?? last
    const low = numberValue(Array.isArray(ticker.l) ? ticker.l[1] ?? ticker.l[0] : undefined)
    const high = numberValue(Array.isArray(ticker.h) ? ticker.h[1] ?? ticker.h[0] : undefined)
    const volume = numberValue(Array.isArray(ticker.v) ? ticker.v[1] ?? ticker.v[0] : undefined)
    const bid = numberValue(Array.isArray(ticker.b) ? ticker.b[0] : undefined)
    const ask = numberValue(Array.isArray(ticker.a) ? ticker.a[0] : undefined)
    return {
      label: Object.keys(result)[0] ?? 'Kraken spot market', value: last, currency: 'USD', points: [open, low, high, last].filter((value): value is number => value !== undefined), dates: ['Open', 'Low', 'High', 'Last'],
      metrics: [
        { label: 'Bid / ask', value: `${bid === undefined ? '—' : formatNumber(bid, 2)} / ${ask === undefined ? '—' : formatNumber(ask, 2)}` },
        { label: '24h high / low', value: `${high === undefined ? '—' : formatNumber(high, 2)} / ${low === undefined ? '—' : formatNumber(low, 2)}` },
        { label: '24h volume', value: volume === undefined ? '—' : compactNumber(volume) },
      ],
    }
  }
  if (api.id === 'wikimedia-pageviews' && isRecord(data)) {
    const items = recordArray(data.items)
    const points = items.map((item) => numberValue(item.views)).filter((value): value is number => value !== undefined)
    const dates = items.map((item) => {
      const stamp = textValue(item.timestamp) ?? ''
      return stamp.length >= 8 ? `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}` : stamp
    })
    const latest = points.at(-1) ?? 0
    const total = points.reduce((sum, value) => sum + value, 0)
    return {
      label: `${textValue(items[0]?.article)?.replace(/_/g, ' ') ?? api.name} · Daily readers`, value: latest, points, dates,
      metrics: [
        { label: 'Total views', value: compactNumber(total) },
        { label: 'Daily average', value: points.length ? compactNumber(total / points.length) : '—' },
        { label: 'Peak day', value: points.length ? compactNumber(Math.max(...points)) : '—' },
      ],
    }
  }
  if (api.id === 'yahoo-finance-sgx-history' && isRecord(data)) {
    const chart = isRecord(data.chart) ? data.chart : {}
    const result = Array.isArray(chart.result) && isRecord(chart.result[0]) ? chart.result[0] : {}
    const meta = isRecord(result.meta) ? result.meta : {}
    const quote = isRecord(result.indicators) && Array.isArray(result.indicators.quote) && isRecord(result.indicators.quote[0]) ? result.indicators.quote[0] : {}
    const closes = Array.isArray(quote.close) ? quote.close.map(numberValue).filter((item): item is number => item !== undefined) : []
    const timestamps = Array.isArray(result.timestamp) ? result.timestamp.map((item) => typeof item === 'number' ? new Date(item * 1000).toISOString().slice(0, 10) : String(item)) : []
    const latest = closes.at(-1) ?? numberValue(meta.regularMarketPrice) ?? 0
    return { label: textValue(meta.symbol) ?? api.name, value: latest, currency: textValue(meta.currency), points: closes, dates: timestamps, metrics: [['Day high', quote.high], ['Day low', quote.low], ['Volume', quote.volume]].map(([label, values]) => ({ label: String(label), value: Array.isArray(values) ? previewValue(values.at(-1)) : previewValue(values) })) }
  }
  if (api.id === 'coinpaprika-ticker' && isRecord(data)) {
    const usd = isRecord(data.quotes) && isRecord(data.quotes.USD) ? data.quotes.USD : {}
    const price = numberValue(usd.price) ?? 0
    return { label: `${textValue(data.name) ?? api.name} · ${textValue(data.symbol) ?? ''}`, value: price, currency: 'USD', points: [price], dates: [textValue(data.last_updated) ?? 'Latest'], metrics: [['24h change', usd.percent_change_24h], ['Market cap', usd.market_cap], ['24h volume', usd.volume_24h]].map(([label, value]) => ({ label: String(label), value: numberValue(value) === undefined ? '—' : label === '24h change' ? `${formatNumber(Number(value), 2)}%` : compactNumber(Number(value)) })) }
  }
  const records = findPreviewRecords(data)
  const rateRecords = records.map((record) => ({ record, value: numberValue(record.rate ?? record.value ?? record.close ?? record.price), date: textValue(record.date ?? record.period ?? record.year) })).filter((item): item is { record: Record<string, unknown>; value: number; date: string | undefined } => item.value !== undefined)
  const points = rateRecords.map((item) => item.value)
  const latestRecord = rateRecords.at(-1)?.record ?? records[0] ?? {}
  const latest = points.at(-1) ?? numberValue(findByKey(data, ['rate', 'value', 'price', 'close'])) ?? 0
  const pair = latestRecord.base && (latestRecord.quote || latestRecord.currency) ? `${latestRecord.base}/${latestRecord.quote ?? latestRecord.currency}` : api.name
  const series = points.length ? points : [latest]
  return {
    label: String(pair),
    value: latest,
    currency: textValue(latestRecord.quote ?? latestRecord.currency),
    points: series,
    dates: rateRecords.map((item) => item.date ?? ''),
    metrics: [
      { label: 'Period high', value: formatNumber(Math.max(...series), 4) },
      { label: 'Period low', value: formatNumber(Math.min(...series), 4) },
      { label: 'Observations', value: compactNumber(series.length) },
    ],
  }
}

function Sparkline({ values }: { values: number[] }) {
  const clean = values.filter(Number.isFinite).slice(-60)
  const points = clean.length > 1 ? clean : [clean[0] ?? 0, clean[0] ?? 0]
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const path = points.map((value, index) => `${(index / (points.length - 1)) * 100},${34 - ((value - min) / range) * 27}`).join(' ')
  return <svg className="market-sparkline" viewBox="0 0 100 38" preserveAspectRatio="none" role="img" aria-label="Price history sparkline"><defs><linearGradient id="marketArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3975f7" stopOpacity=".28"/><stop offset="1" stopColor="#3975f7" stopOpacity="0"/></linearGradient></defs><polygon points={`0,38 ${path} 100,38`} fill="url(#marketArea)"/><polyline points={path} fill="none" stroke="#3975f7" strokeWidth="1.8" vectorEffect="non-scaling-stroke"/></svg>
}

function MarketPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const snapshot = marketSnapshot(api, data)
  const first = snapshot.points[0] ?? snapshot.value
  const change = first ? ((snapshot.value - first) / Math.abs(first)) * 100 : 0
  return <div className="market-preview">
    <div className="market-summary"><div><span>{snapshot.label}</span><strong>{snapshot.currency ? `${snapshot.currency} ` : ''}{formatNumber(snapshot.value, snapshot.value < 10 ? 4 : 2)}</strong><small className={change < 0 ? 'negative' : ''}>{change < 0 ? '↓' : '↑'} {formatNumber(Math.abs(change), 2)}% across this response</small></div><div className="market-range"><span>{snapshot.dates[0] || 'First point'}</span><span>{snapshot.dates.at(-1) || 'Latest'}</span></div></div>
    <Sparkline values={snapshot.points}/>
    <div className="market-metrics">{(snapshot.metrics.length ? snapshot.metrics : [{ label: 'Data points', value: String(snapshot.points.length) }]).map((metric) => <article key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong></article>)}</div>
  </div>
}

function FuelPricePreview({ data }: { data: unknown }) {
  const levels = recordArray(data).filter((row) => row.series_type === 'level')
  const latest = levels[0] ?? {}
  const previous = levels[1] ?? {}
  const fuels = [
    { key: 'ron95', label: 'RON95', note: 'Market price' },
    { key: 'ron97', label: 'RON97', note: 'Premium petrol' },
    { key: 'diesel', label: 'Diesel', note: 'Peninsular Malaysia' },
    { key: 'ron95_budi95', label: 'BUDI95', note: 'Targeted price' },
  ]
  const ron95History = levels.map((row) => numberValue(row.ron95)).filter((value): value is number => value !== undefined).reverse()
  if (!levels.length) return <div className="weather-empty"><strong>Fuel-price history unavailable</strong><span>No weekly price-level rows were returned.</span></div>
  return <div className="fuel-preview">
    <header className="fuel-hero"><div><small>Official weekly price · Malaysia</small><strong>{dateParts(latest.date).full || previewValue(latest.date)}</strong><span>Ringgit Malaysia per litre</span></div><div className="fuel-pump" aria-hidden="true"><i/><b>MY</b></div></header>
    <div className="fuel-price-grid">{fuels.map((fuel) => {
      const value = numberValue(latest[fuel.key])
      const previousValue = numberValue(previous[fuel.key])
      const change = value !== undefined && previousValue !== undefined ? value - previousValue : undefined
      return <article key={fuel.key}><small>{fuel.label}</small><strong>{value === undefined ? '—' : `RM ${formatNumber(value, 2)}`}</strong><span className={change !== undefined && change < 0 ? 'down' : ''}>{change === undefined || change === 0 ? 'No weekly change' : `${change > 0 ? '↑' : '↓'} RM ${formatNumber(Math.abs(change), 2)}`}</span><em>{fuel.note}</em></article>
    })}</div>
    <div className="fuel-history"><div><small>RON95 history</small><strong>{ron95History.length} observations</strong></div><Sparkline values={ron95History}/></div>
  </div>
}

function MarineForecastPreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const hourly = isRecord(root.hourly) ? root.hourly : {}
  const units = isRecord(root.hourly_units) ? root.hourly_units : {}
  const times = Array.isArray(hourly.time) ? hourly.time.map(textValue) : []
  const offset = numberValue(root.utc_offset_seconds) ?? 0
  const now = Date.now()
  const timestamps = times.map((time) => time ? Date.parse(`${time}:00Z`) - (offset * 1000) : Number.NaN)
  const validIndexes = timestamps.map((timestamp, index) => ({ timestamp, index })).filter((entry) => Number.isFinite(entry.timestamp))
  const currentIndex = validIndexes.reduce((closest, entry) => Math.abs(entry.timestamp - now) < Math.abs(closest.timestamp - now) ? entry : closest, validIndexes[0] ?? { timestamp: now, index: 0 }).index
  const series = (key: string) => Array.isArray(hourly[key]) ? hourly[key].map(numberValue) : []
  const waveHeights = series('wave_height')
  const waveDirections = series('wave_direction')
  const wavePeriods = series('wave_period')
  const temperatures = series('sea_surface_temperature')
  const currents = series('ocean_current_velocity')
  const currentDirections = series('ocean_current_direction')
  const sampleIndexes = Array.from({ length: 8 }, (_, index) => Math.min(currentIndex + (index * 3), Math.max(0, times.length - 1))).filter((index, position, all) => all.indexOf(index) === position)
  if (!times.length) return <div className="weather-empty"><strong>Marine forecast unavailable</strong><span>No hourly marine series were returned.</span></div>
  return <div className="marine-preview">
    <div className="marine-hero"><div><small>{textValue(root.timezone)?.replace('_', ' ') ?? 'Coastal forecast'} · nearest forecast hour</small><strong>{formatNumber(waveHeights[currentIndex] ?? 0, 2)}<span>{textValue(units.wave_height) ?? 'm'}</span></strong><b>Wave height</b><p>{timeLabel(times[currentIndex])} · {formatNumber(numberValue(root.latitude) ?? 0, 3)}, {formatNumber(numberValue(root.longitude) ?? 0, 3)}</p></div><div className="marine-compass" style={{ '--marine-bearing': `${waveDirections[currentIndex] ?? 0}deg` } as CSSProperties}><i>↑</i><span>N</span><b>{formatNumber(waveDirections[currentIndex] ?? 0, 0)}°</b></div></div>
    <div className="marine-metrics">
      <article><small>Wave period</small><strong>{formatNumber(wavePeriods[currentIndex] ?? 0, 1)} {textValue(units.wave_period) ?? 's'}</strong><span>Energy interval</span></article>
      <article><small>Sea surface</small><strong>{formatNumber(temperatures[currentIndex] ?? 0, 1)}{textValue(units.sea_surface_temperature) ?? '°C'}</strong><span>Water temperature</span></article>
      <article><small>Ocean current</small><strong>{formatNumber(currents[currentIndex] ?? 0, 1)} {textValue(units.ocean_current_velocity) ?? 'km/h'}</strong><span>{formatNumber(currentDirections[currentIndex] ?? 0, 0)}° bearing</span></article>
    </div>
    <div className="marine-timeline">{sampleIndexes.map((index) => <article key={`${times[index]}-${index}`}><time>{timeLabel(times[index])}</time><i style={{ '--wave-height': `${Math.min(100, ((waveHeights[index] ?? 0) / Math.max(...waveHeights.filter((value): value is number => value !== undefined), 1)) * 100)}%` } as CSSProperties}/><strong>{formatNumber(waveHeights[index] ?? 0, 2)} m</strong><small>{dateParts(times[index]).full}</small></article>)}</div>
    <p className="marine-disclaimer">Forecast guidance only · Not for navigation or safety-critical decisions</p>
  </div>
}

function NobelPrizePreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const prizes = recordArray(root.nobelPrizes)
  if (!prizes.length) return <div className="weather-empty"><strong>Nobel Prize records unavailable</strong><span>No prize records were returned.</span></div>
  const first = prizes[0]
  const firstCategory = isRecord(first.category) ? cleanText(first.category.en) : undefined
  const laureateCount = prizes.reduce((total, prize) => total + recordArray(prize.laureates).length, 0)
  return <div className="nobel-preview">
    <div className="nobel-summary"><span aria-hidden="true">N</span><div><small>Latest {firstCategory ?? 'Nobel'} awards</small><strong>{prizes.length} prize years</strong><p>{laureateCount} laureates represented in this response</p></div><b>{previewValue(first.awardYear)}</b></div>
    <ol className="nobel-timeline">{prizes.slice(0, 6).map((prize, index) => {
      const category = isRecord(prize.category) ? cleanText(prize.category.en) : 'Nobel Prize'
      const laureates = recordArray(prize.laureates)
      return <li key={`${prize.awardYear}-${index}`}><time>{previewValue(prize.awardYear)}</time><i/><article><header><small>{category}</small><b>{compactNumber(numberValue(prize.prizeAmount) ?? 0)} SEK</b></header><h3>{laureates.map((laureate) => cleanText(recordValue(laureate.knownName, 'en') ?? recordValue(laureate.fullName, 'en'))).filter(Boolean).join(' · ') || 'Prize organization'}</h3><p>{cleanText(recordValue(laureates[0]?.motivation, 'en')) ?? 'Official prize record and laureate information.'}</p></article></li>
    })}</ol>
  </div>
}

function ChessRatingsPreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const modes = [
    { key: 'chess_blitz', label: 'Blitz', symbol: '⚡' },
    { key: 'chess_bullet', label: 'Bullet', symbol: '●' },
    { key: 'chess_rapid', label: 'Rapid', symbol: '◷' },
    { key: 'chess_daily', label: 'Daily', symbol: '□' },
  ].map((mode) => {
    const stats = isRecord(root[mode.key]) ? root[mode.key] as Record<string, unknown> : {}
    const last = isRecord(stats.last) ? stats.last : {}
    const best = isRecord(stats.best) ? stats.best : {}
    const record = isRecord(stats.record) ? stats.record : {}
    return { ...mode, rating: numberValue(last.rating), best: numberValue(best.rating), wins: numberValue(record.win) ?? 0, losses: numberValue(record.loss) ?? 0, draws: numberValue(record.draw) ?? 0 }
  }).filter((mode) => mode.rating !== undefined)
  if (!modes.length) return <div className="weather-empty"><strong>Chess ratings unavailable</strong><span>The player has no public rating records.</span></div>
  const leader = [...modes].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]
  const totalGames = modes.reduce((total, mode) => total + mode.wins + mode.losses + mode.draws, 0)
  return <div className="chess-preview">
    <header className="chess-hero"><div className="chess-board" aria-hidden="true">♞</div><div><small>Public competitive profile</small><strong>{formatNumber(leader.rating ?? 0, 0)}</strong><span>Highest current rating · {leader.label}</span></div><div><small>FIDE</small><b>{previewValue(root.fide)}</b><span>{compactNumber(totalGames)} recorded games</span></div></header>
    <div className="chess-rating-grid">{modes.map((mode) => {
      const games = mode.wins + mode.losses + mode.draws
      const winRate = games ? (mode.wins / games) * 100 : 0
      return <article key={mode.key}><header><span>{mode.symbol}</span><div><small>{mode.label}</small><strong>{formatNumber(mode.rating ?? 0, 0)}</strong></div><b>Best {formatNumber(mode.best ?? mode.rating ?? 0, 0)}</b></header><div className="chess-score"><i style={{ '--win-rate': `${winRate}%` } as CSSProperties}/></div><dl><div><dt>Win</dt><dd>{compactNumber(mode.wins)}</dd></div><div><dt>Draw</dt><dd>{compactNumber(mode.draws)}</dd></div><div><dt>Loss</dt><dd>{compactNumber(mode.losses)}</dd></div></dl></article>
    })}</div>
  </div>
}

function CrossrefWorksPreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const message = isRecord(root.message) ? root.message : {}
  const works = recordArray(message.items)
  if (!works.length) return <div className="weather-empty"><strong>Scholarly works unavailable</strong><span>No Crossref work records were returned.</span></div>
  return <div className="crossref-preview">
    <header><div><small>Crossref scholarly index</small><strong>{compactNumber(numberValue(message['total-results']) ?? works.length)} matching works</strong></div><span>{works.length} shown</span></header>
    <ol>{works.slice(0, 8).map((work, index) => {
      const authors = recordArray(work.author).map((author) => [cleanText(author.given), cleanText(author.family)].filter(Boolean).join(' ')).filter(Boolean)
      const published = isRecord(work.published) && Array.isArray(work.published['date-parts']) && Array.isArray(work.published['date-parts'][0]) ? previewValue(work.published['date-parts'][0][0]) : '—'
      return <li key={`${work.DOI}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><article><header><small>{previewLabel(cleanText(work.type) ?? 'Scholarly work')} · {published}</small><b>{compactNumber(numberValue(work['is-referenced-by-count']) ?? 0)} citations</b></header><h3>{textArray(work.title)[0] ?? 'Untitled scholarly work'}</h3><p>{authors.slice(0, 3).join(', ') || 'Authorship unavailable'} · {cleanText(work.publisher) ?? 'Publisher unavailable'}</p><code>{cleanText(work.DOI) ?? 'DOI unavailable'}</code></article></li>
    })}</ol>
  </div>
}

const collectImageUrls = (value: unknown, found: string[] = [], depth = 0): string[] => {
  if (depth > 7 || found.length >= 8) return found
  if (typeof value === 'string' && /^https?:\/\//.test(value) && /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(value)) found.push(value)
  else if (Array.isArray(value)) value.forEach((item) => collectImageUrls(item, found, depth + 1))
  else if (isRecord(value)) Object.entries(value).forEach(([key, item]) => {
    if (/image|picture|photo|sprite|thumbnail/i.test(key)) collectImageUrls(item, found, depth + 1)
  })
  return [...new Set(found)]
}

function mediaItems(api: ApiDemo, data: unknown): MediaItem[] {
  if (api.id === 'dogs' && isRecord(data) && Array.isArray(data.message)) return data.message.filter((item): item is string => typeof item === 'string').slice(0, 6).map((image, index) => ({ image, title: `Dog ${index + 1}`, subtitle: 'Random Dog gallery' }))
  if (api.id === 'people' && isRecord(data) && Array.isArray(data.results)) return data.results.filter(isRecord).slice(0, 6).map((person, index) => ({ image: textValue(recordValue(person.picture, 'large') ?? recordValue(person.picture, 'medium')) ?? '', title: isRecord(person.name) ? `${textValue(person.name.first) ?? ''} ${textValue(person.name.last) ?? ''}`.trim() : `Person ${index + 1}`, subtitle: textValue(person.email) })).filter((item) => item.image)
  if (api.id === 'wikipedia-search' && isRecord(data)) {
    const query = isRecord(data.query) ? data.query : {}
    const pages = isRecord(query.pages) ? Object.values(query.pages).filter(isRecord) : []
    return pages.slice(0, 8).map((page) => ({
      image: textValue(recordValue(page.thumbnail, 'source')) ?? '',
      title: cleanText(page.title) ?? 'Wikipedia article',
      subtitle: cleanText(page.extract) ?? `Page ID ${previewValue(page.pageid)}`,
    })).filter((item) => item.image)
  }
  if (api.id === 'rick-morty-characters' && isRecord(data)) return recordArray(data.results).slice(0, 8).map((character) => ({
    image: textValue(character.image) ?? '',
    title: cleanText(character.name) ?? 'Character',
    subtitle: `${previewValue(character.status)} · ${previewValue(character.species)} · ${previewValue(recordValue(character.location, 'name'))}`,
  })).filter((item) => item.image)
  if (api.id === 'art-institute-search' && isRecord(data)) {
    const base = isRecord(data.config) ? textValue(data.config.iiif_url) : undefined
    if (base && Array.isArray(data.data)) return data.data.filter(isRecord).filter((item) => item.image_id).slice(0, 6).map((item) => ({ image: `${base}/2/${item.image_id}/full/500,/0/default.jpg`, title: textValue(item.title) ?? 'Artwork', subtitle: textValue(item.artist_title) }))
  }
  const records = findPreviewRecords(data)
  const urls = collectImageUrls(data)
  return urls.slice(0, 6).map((image, index) => {
    const record = records[index] ?? records[0] ?? {}
    const nested = isRecord(record.show) ? record.show : isRecord(record.product) ? record.product : record
    return { image, title: textValue(nested.name ?? nested.title ?? nested.product_name) ?? `${api.name} ${index + 1}`, subtitle: cleanText(nested.artist_title ?? nested.email ?? nested.summary ?? nested.brands) }
  })
}

function MediaGalleryPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const items = mediaItems(api, data)
  if (!items.length) return <ResultListPreview data={data} api={api}/>
  return <div className={`media-preview ${items.length === 1 ? 'single' : ''}`}>{items.map((item, index) => <article key={`${item.image}-${index}`}><img src={item.image} alt="" loading="lazy"/><div><small>{api.category}</small><h3>{item.title}</h3>{item.subtitle && <p>{item.subtitle}</p>}</div></article>)}</div>
}

function locationPoints(data: unknown, api?: Pick<ApiDemo, 'id'>): LocationPoint[] {
  if (api?.id === 'uk-police-street-crime') return recordArray(data).slice(0, 8).map((crime, index) => {
    const location = isRecord(crime.location) ? crime.location : {}
    const street = isRecord(location.street) ? location.street : {}
    return {
      latitude: numberValue(location.latitude) ?? 0,
      longitude: numberValue(location.longitude) ?? 0,
      label: cleanText(street.name) ?? `Anonymised location ${index + 1}`,
      detail: `${previewLabel(cleanText(crime.category) ?? 'Street crime')} · ${previewValue(crime.month)}`,
    }
  }).filter((point) => point.latitude !== 0 || point.longitude !== 0)
  if (api?.id === 'open-brewery-directory') return recordArray(data).slice(0, 8).map((brewery, index) => ({
    latitude: numberValue(brewery.latitude) ?? 0,
    longitude: numberValue(brewery.longitude) ?? 0,
    label: cleanText(brewery.name) ?? `Brewery ${index + 1}`,
    detail: `${previewLabel(cleanText(brewery.brewery_type) ?? 'Brewery')} · ${cleanText(brewery.city) ?? cleanText(brewery.country) ?? 'Location available'}`,
  })).filter((point) => point.latitude !== 0 || point.longitude !== 0)
  const points: LocationPoint[] = []
  const visit = (value: unknown, depth = 0) => {
    if (depth > 7 || points.length >= 8) return
    if (isRecord(value)) {
      const geometry = isRecord(value.geometry) ? value.geometry : undefined
      const coordinates = geometry && Array.isArray(geometry.coordinates) ? geometry.coordinates : undefined
      const latitude = numberValue(value.latitude ?? value.lat ?? (coordinates && coordinates.length === 2 ? coordinates[1] : undefined))
      const longitude = numberValue(value.longitude ?? value.lon ?? value.lng ?? (coordinates && coordinates.length === 2 ? coordinates[0] : undefined))
      if (latitude !== undefined && longitude !== undefined) {
        const properties = isRecord(value.properties) ? value.properties : value
        points.push({ latitude, longitude, label: textValue(properties.title ?? properties.place ?? properties.name ?? properties.camera_id ?? properties.postcode) ?? `Location ${points.length + 1}`, detail: properties.mag !== undefined ? `Magnitude ${previewValue(properties.mag)}` : undefined })
      }
      Object.values(value).forEach((item) => visit(item, depth + 1))
    } else if (Array.isArray(value)) value.forEach((item) => visit(item, depth + 1))
  }
  visit(data)
  return points
}

function LocationPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const points = locationPoints(data, api)
  if (!points.length) return <ResultListPreview data={data} api={api}/>
  const lats = points.map((point) => point.latitude)
  const lons = points.map((point) => point.longitude)
  const latMin = Math.min(...lats); const latRange = Math.max(...lats) - latMin || 1
  const lonMin = Math.min(...lons); const lonRange = Math.max(...lons) - lonMin || 1
  return <div className="location-preview"><div className="location-map" role="img" aria-label={`Map with ${points.length} response locations`}><span className="map-compass">N</span>{points.map((point, index) => <i key={`${point.latitude}-${point.longitude}-${index}`} style={{ '--point-x': `${10 + ((point.longitude - lonMin) / lonRange) * 80}%`, '--point-y': `${90 - ((point.latitude - latMin) / latRange) * 80}%` } as CSSProperties}><b>{index + 1}</b></i>)}</div><ol>{points.slice(0, 5).map((point, index) => <li key={`${point.label}-${index}`}><span>{index + 1}</span><div><strong>{point.label}</strong><small>{point.detail ?? `${formatNumber(point.latitude, 4)}, ${formatNumber(point.longitude, 4)}`}</small></div></li>)}</ol></div>
}

function CalendarPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const records = findPreviewRecords(data).slice(0, 6)
  if (!records.length) return <ResultListPreview data={data} api={api}/>
  return <ol className="calendar-preview">{records.map((record, index) => {
    const dateText = textValue(record.date ?? record.start ?? record.datetime) ?? 'Upcoming'
    const parsed = new Date(dateText)
    const valid = !Number.isNaN(parsed.getTime())
    return <li key={`${dateText}-${index}`}><time dateTime={dateText}><strong>{valid ? parsed.toLocaleDateString('en', { day: '2-digit' }) : '—'}</strong><span>{valid ? parsed.toLocaleDateString('en', { month: 'short' }) : dateText.slice(0, 3)}</span></time><div><small>{textValue(record.countryCode) ?? api.provider}</small><h3>{textValue(record.name ?? record.localName ?? record.title) ?? `Event ${index + 1}`}</h3><p>{record.localName && record.localName !== record.name ? textValue(record.localName) : record.global === true ? 'Observed nationally' : 'Public calendar event'}</p></div></li>
  })}</ol>
}

function SolarCyclePreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const sunrise = textValue(root.sunrise)
  const sunset = textValue(root.sunset)
  if (!sunrise || !sunset) return <div className="weather-empty"><strong>Solar data unavailable</strong><span>The response did not include sunrise and sunset times.</span></div>
  const dayLength = numberValue(root.day_length)
  const duration = dayLength === undefined ? '—' : `${Math.floor(dayLength / 3600)}h ${Math.round((dayLength % 3600) / 60)}m`
  const moments = [
    { label: 'First light', value: root.first_light, icon: '◔' }, { label: 'Sunrise', value: root.sunrise, icon: '↑' },
    { label: 'Solar noon', value: root.solar_noon, icon: '☀' }, { label: 'Sunset', value: root.sunset, icon: '↓' }, { label: 'Last light', value: root.last_light, icon: '◕' },
  ]
  return <div className="solar-preview">
    <div className="solar-hero"><div><span>{textValue(root.tzid) ?? 'Local solar time'} · {textValue(root.date) ?? 'Selected date'}</span><strong>{timeLabel(sunrise)} <i>→</i> {timeLabel(sunset)}</strong><b>{duration} of daylight</b><small>{formatNumber(Number(root.lat), 3)}, {formatNumber(Number(root.lng), 3)} · {textValue(root.moon_phase) ?? 'Moon data available'}</small></div><span aria-hidden="true">☀</span></div>
    <ol className="solar-timeline">{moments.map((moment) => <li key={moment.label}><span aria-hidden="true">{moment.icon}</span><div><small>{moment.label}</small><strong>{timeLabel(moment.value)}</strong></div></li>)}</ol>
  </div>
}

function SpaceWeatherPreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const current = isRecord(root['0']) ? root['0'] : {}
  const scales = [
    { key: 'R', label: 'Radio blackout', icon: 'R' },
    { key: 'S', label: 'Solar radiation', icon: 'S' },
    { key: 'G', label: 'Geomagnetic storm', icon: 'G' },
  ].map((scale) => {
    const candidate = current[scale.key]
    const reading: Record<string, unknown> = isRecord(candidate) ? candidate : {}
    return { ...scale, value: numberValue(reading.Scale) ?? 0, text: cleanText(reading.Text) ?? 'None', probability: numberValue(reading.Prob ?? reading.MinorProb) }
  })
  const forecasts = ['1', '2', '3'].map((key) => isRecord(root[key]) ? root[key] : {}).filter((entry) => Object.keys(entry).length)
  if (!Object.keys(current).length) return <div className="weather-empty"><strong>Space-weather scales unavailable</strong><span>NOAA did not return the current R, S, and G scales.</span></div>
  const peak = Math.max(...scales.map((scale) => scale.value))
  return <div className="weather-preview regional-air-preview" data-weather-view="space-weather">
    <div className="air-quality-summary"><div><span>NOAA operational scales</span><strong>{peak === 0 ? 'Quiet' : `Level ${peak}`}</strong><b>{peak === 0 ? 'No current storm-scale activity' : 'Space-weather activity detected'}</b><small>Updated {previewValue(current.DateStamp)} · {previewValue(current.TimeStamp)} UTC</small></div><em className={peak === 0 ? 'good' : 'elevated'}>R · S · G</em></div>
    <div className="regional-reading-grid">{scales.map((scale) => <article key={scale.key}><span>{scale.icon}</span><div><small>{scale.label}</small><strong>{scale.value === 0 ? '0' : scale.value}</strong><b>{scale.text}</b></div><em>{scale.probability === undefined ? 'Current' : `${scale.probability}%`}</em></article>)}</div>
    {forecasts.length ? <div className="forecast-days">{forecasts.map((forecast, index) => {
      const geomagnetic = isRecord(forecast.G) ? forecast.G : {}
      return <article key={`${forecast.DateStamp}-${index}`}><div><span>{dateParts(forecast.DateStamp).weekday}</span><small>{dateParts(forecast.DateStamp).full}</small></div><b aria-hidden="true">◎</b><strong>G{previewValue(geomagnetic.Scale)}</strong><p>{cleanText(geomagnetic.Text) ?? 'No storm expected'}</p><em>NOAA forecast</em></article>
    })}</div> : null}
  </div>
}

function FloodForecastPreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const daily = isRecord(root.daily) ? root.daily : {}
  const units = isRecord(root.daily_units) ? root.daily_units : {}
  const times = Array.isArray(daily.time) ? daily.time.map((value) => textValue(value) ?? '') : []
  const discharge = Array.isArray(daily.river_discharge) ? daily.river_discharge.map(numberValue).filter((value): value is number => value !== undefined) : []
  const means = Array.isArray(daily.river_discharge_mean) ? daily.river_discharge_mean.map(numberValue).filter((value): value is number => value !== undefined) : []
  const maxima = Array.isArray(daily.river_discharge_max) ? daily.river_discharge_max.map(numberValue).filter((value): value is number => value !== undefined) : []
  if (!discharge.length) return <div className="weather-empty"><strong>Flood forecast unavailable</strong><span>No daily river-discharge values were returned.</span></div>
  const unit = textValue(units.river_discharge) ?? 'm³/s'
  const peak = Math.max(...maxima, ...discharge)
  const peakIndex = maxima.indexOf(Math.max(...maxima))
  return <div className="market-preview flood-preview">
    <div className="market-summary"><div><span>River discharge · {formatNumber(numberValue(root.latitude) ?? 0, 3)}, {formatNumber(numberValue(root.longitude) ?? 0, 3)}</span><strong>{formatNumber(discharge[0], 2)} {unit}</strong><small>Current modelled discharge · peak {formatNumber(peak, 2)} {unit}</small></div><div className="market-range"><span>{times[0] ?? 'Today'}</span><span>{times.at(-1) ?? 'Forecast end'}</span></div></div>
    <Sparkline values={discharge}/>
    <div className="market-metrics"><article><small>Forecast peak</small><strong>{formatNumber(peak, 2)} {unit}</strong></article><article><small>Peak date</small><strong>{times[peakIndex] ?? '—'}</strong></article><article><small>Mean discharge</small><strong>{means.length ? `${formatNumber(means.reduce((sum, value) => sum + value, 0) / means.length, 2)} ${unit}` : '—'}</strong></article></div>
  </div>
}

function FederalRegisterPreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const documents = recordArray(root.results).slice(0, 8)
  if (!documents.length) return <div className="weather-empty"><strong>Federal documents unavailable</strong><span>No matching Federal Register documents were returned.</span></div>
  return <ol className="calendar-preview federal-register-preview">{documents.map((document, index) => {
    const dateText = textValue(document.publication_date) ?? ''
    const date = new Date(dateText)
    const agencies = recordArray(document.agencies).map((agency) => cleanText(agency.name)).filter(Boolean)
    return <li key={`${document.document_number}-${index}`}><time dateTime={dateText}><strong>{Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en', { day: '2-digit' })}</strong><span>{Number.isNaN(date.getTime()) ? 'FR' : date.toLocaleDateString('en', { month: 'short' })}</span></time><div><small>{cleanText(document.type) ?? 'Federal document'} · {agencies[0] ?? 'U.S. Government'}</small><h3>{cleanText(document.title) ?? `Document ${index + 1}`}</h3><p>{cleanText(document.abstract) ?? `Document ${previewValue(document.document_number)}`}</p></div></li>
  })}</ol>
}

function NaturalEventsPreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const events = Array.isArray(root.events) ? root.events.filter(isRecord).slice(0, 6) : []
  if (!events.length) return <div className="weather-empty"><strong>No active events found</strong><span>Try a broader category or a longer date range.</span></div>
  return <div className="natural-events-preview"><div className="event-overview"><div><span>NASA EONET monitor</span><strong>{events.length}</strong><b>active natural events</b></div><div className="event-globe" aria-hidden="true">◎<i/><i/><i/></div></div><div className="event-grid">{events.map((event, index) => {
    const categories = Array.isArray(event.categories) ? event.categories.filter(isRecord) : []
    const geometry = Array.isArray(event.geometry) ? event.geometry.filter(isRecord) : []
    const latest = geometry.at(-1)
    const coordinates = latest && Array.isArray(latest.coordinates) ? latest.coordinates : []
    const magnitude = numberValue(latest?.magnitudeValue)
    return <article key={textValue(event.id) ?? index}><span>{forecastSymbol(textValue(categories[0]?.title))}</span><div><small>{textValue(categories[0]?.title) ?? 'Natural event'} · {timeLabel(latest?.date)}</small><h3>{cleanText(event.title) ?? `Event ${index + 1}`}</h3><p>{coordinates.length >= 2 ? `${formatNumber(Number(coordinates[1]), 3)}, ${formatNumber(Number(coordinates[0]), 3)}` : 'Location tracked by EONET'}{magnitude === undefined ? '' : ` · ${formatNumber(magnitude)} ${textValue(latest?.magnitudeUnit) ?? ''}`}</p></div><em>{event.closed ? 'Closed' : 'Open'}</em></article>
  })}</div></div>
}

function TransitBoardPreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const routes = Array.isArray(root.data) ? root.data.filter(isRecord).slice(0, 10) : []
  if (!routes.length) return <div className="weather-empty"><strong>No transit routes found</strong><span>The response did not include MBTA route records.</span></div>
  return <div className="transit-preview"><div className="transit-summary"><span>Boston network</span><strong>{routes.length}</strong><b>routes in this view</b><small>Live MBTA route catalogue</small></div><div className="transit-routes">{routes.map((route, index) => {
    const attributes = isRecord(route.attributes) ? route.attributes : {}
    const colorValue = textValue(attributes.color) ?? '165C96'
    const color = /^[\da-f]{6}$/i.test(colorValue) ? `#${colorValue}` : '#165c96'
    const destinations = Array.isArray(attributes.direction_destinations) ? attributes.direction_destinations.map(cleanText).filter(Boolean) : []
    return <article key={textValue(route.id) ?? index} style={{ '--route-color': color } as CSSProperties}><span>{textValue(attributes.short_name) || textValue(route.id)?.slice(0, 2) || 'T'}</span><div><small>{cleanText(attributes.description) ?? 'MBTA service'}</small><h3>{cleanText(attributes.long_name) ?? textValue(route.id) ?? `Route ${index + 1}`}</h3><p>{destinations.length ? destinations.join(' ↔ ') : 'Destination information available'}</p></div><em>Route</em></article>
  })}</div></div>
}

function TriviaGamePreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const questions = Array.isArray(root.results) ? root.results.filter(isRecord).slice(0, 6) : []
  if (!questions.length) return <div className="weather-empty"><strong>No trivia questions found</strong><span>Try a different category or difficulty.</span></div>
  return <div className="trivia-preview"><div className="trivia-score"><span>Quiz deck</span><strong>{questions.length}</strong><b>questions ready</b><small>Correct answers are highlighted for this developer demo.</small></div><div className="trivia-grid">{questions.map((question, index) => {
    const correct = cleanText(question.correct_answer) ?? 'Answer unavailable'
    const incorrect = Array.isArray(question.incorrect_answers) ? question.incorrect_answers.map(cleanText).filter((answer): answer is string => Boolean(answer)) : []
    const answers = [correct, ...incorrect]
    return <article key={`${correct}-${index}`}><header><span>{index + 1}</span><div><small>{cleanText(question.category) ?? 'Trivia'} · {cleanText(question.difficulty) ?? 'mixed'}</small><h3>{cleanText(question.question) ?? `Question ${index + 1}`}</h3></div></header><ul>{answers.map((answer, answerIndex) => <li className={answerIndex === 0 ? 'correct' : ''} key={`${answer}-${answerIndex}`}><span>{String.fromCharCode(65 + answerIndex)}</span>{answer}{answerIndex === 0 && <b>Answer</b>}</li>)}</ul></article>
  })}</div></div>
}

type SemanticCard = {
  title: string
  eyebrow: string
  description?: string
  badge?: string
  metrics: Array<{ label: string; value: string }>
  tags?: string[]
}

const recordArray = (value: unknown) => Array.isArray(value) ? value.filter(isRecord) : []
const textArray = (value: unknown) => Array.isArray(value) ? value.map(cleanText).filter((item): item is string => Boolean(item)) : []
const epochDate = (value: unknown) => {
  const seconds = numberValue(value)
  return seconds === undefined ? undefined : new Date(seconds * 1000).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SemanticCards({ cards, emptyTitle }: { cards: SemanticCard[]; emptyTitle: string }) {
  if (!cards.length) return <div className="weather-empty"><strong>{emptyTitle}</strong><span>The response did not include records for this demo layout.</span></div>
  return <div className="semantic-card-grid">{cards.slice(0, 8).map((card, index) => <article key={`${card.title}-${index}`}><header><span>{index + 1}</span><div><small>{card.eyebrow}</small><h3>{card.title}</h3></div>{card.badge && <em>{card.badge}</em>}</header>{card.description && <p>{card.description}</p>}<dl>{card.metrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>{card.tags?.length ? <footer>{card.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</footer> : null}</article>)}</div>
}

function DeveloperFeedPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const root = isRecord(data) ? data : {}
  let cards: SemanticCard[] = []
  if (api.id === 'posts') cards = [root].filter((record) => Object.keys(record).length > 0).map((record) => ({ title: cleanText(record.title) ?? 'Post', eyebrow: 'JSONPlaceholder post', description: cleanText(record.body), metrics: [{ label: 'Post ID', value: previewValue(record.id) }, { label: 'User ID', value: previewValue(record.userId) }] }))
  else if (api.id === 'devto') cards = recordArray(data).map((record) => ({ title: cleanText(record.title) ?? 'DEV article', eyebrow: cleanText(record.readable_publish_date) ?? 'Published article', description: cleanText(record.description), badge: `${previewValue(record.public_reactions_count)} reactions`, metrics: [{ label: 'Comments', value: previewValue(record.comments_count) }, { label: 'Reading time', value: `${previewValue(record.reading_time_minutes)} min` }], tags: textArray(record.tag_list) }))
  else if (api.id === 'github') cards = recordArray(data).map((record) => ({ title: cleanText(record.full_name ?? record.name) ?? 'Repository', eyebrow: cleanText(record.language) ?? 'GitHub repository', description: cleanText(record.description) ?? 'Public source repository', badge: record.archived ? 'Archived' : 'Active', metrics: [{ label: 'Stars', value: previewValue(record.stargazers_count) }, { label: 'Forks', value: previewValue(record.forks_count) }, { label: 'Issues', value: previewValue(record.open_issues_count) }], tags: textArray(record.topics) }))
  else if (api.id === 'gitlab-public-projects') cards = recordArray(data).map((record) => ({
    title: cleanText(record.path_with_namespace ?? record.name) ?? 'GitLab project',
    eyebrow: `${cleanText(record.language) ?? 'Public repository'} · updated ${dateParts(record.last_activity_at).full || 'recently'}`,
    description: cleanText(record.description) ?? 'Public GitLab project',
    badge: `${compactNumber(numberValue(record.star_count) ?? 0)} stars`,
    metrics: [
      { label: 'Forks', value: compactNumber(numberValue(record.forks_count) ?? 0) },
      { label: 'Issues', value: record.open_issues_count === undefined ? '—' : previewValue(record.open_issues_count) },
      { label: 'Visibility', value: previewValue(record.visibility) },
    ],
    tags: textArray(record.topics ?? record.tag_list),
  }))
  else if (api.id === 'hacker-news') cards = [root].map((record) => ({ title: cleanText(record.title) ?? 'Hacker News item', eyebrow: `${previewValue(record.type)} by ${previewValue(record.by)}`, badge: `${previewValue(record.score)} points`, metrics: [{ label: 'Comments', value: previewValue(record.descendants) }, { label: 'Published', value: epochDate(record.time) ?? '—' }, { label: 'Item ID', value: previewValue(record.id) }] }))
  else if (api.id === 'npm-search') cards = recordArray(root.objects).map((record) => {
    const pkg = isRecord(record.package) ? record.package : {}
    const downloads = isRecord(record.downloads) ? record.downloads : {}
    return { title: cleanText(pkg.name) ?? 'npm package', eyebrow: `v${previewValue(pkg.version)}`, description: cleanText(pkg.description), badge: `${compactNumber(numberValue(downloads.weekly) ?? 0)} weekly`, metrics: [{ label: 'Publisher', value: previewValue(recordValue(pkg.publisher, 'username')) }, { label: 'Updated', value: dateParts(pkg.date).full }, { label: 'Score', value: formatNumber((numberValue(record.searchScore) ?? 0) * 100, 0) }], tags: textArray(pkg.keywords) }
  })
  else if (api.id === 'pypi-json') {
    const info = isRecord(root.info) ? root.info : {}
    cards = [{ title: cleanText(info.name) ?? 'Python package', eyebrow: `Python · v${previewValue(info.version)}`, description: cleanText(info.summary), badge: previewValue(info.license_expression ?? info.license), metrics: [{ label: 'Requires Python', value: previewValue(info.requires_python) }, { label: 'Maintainer', value: previewValue(info.maintainer ?? info.author) }, { label: 'Releases', value: String(Object.keys(isRecord(root.releases) ? root.releases : {}).length) }], tags: textArray(info.keywords?.toString().split(',')) }]
  } else if (api.id === 'stack-exchange') cards = recordArray(root.items).map((record) => ({ title: cleanText(record.title) ?? 'Stack Overflow question', eyebrow: epochDate(record.creation_date) ?? 'Active question', badge: record.is_answered ? 'Answered' : 'Open', metrics: [{ label: 'Score', value: previewValue(record.score) }, { label: 'Answers', value: previewValue(record.answer_count) }, { label: 'Views', value: compactNumber(numberValue(record.view_count) ?? 0) }], tags: textArray(record.tags) }))
  return <SemanticCards cards={cards} emptyTitle="Developer records unavailable"/>
}

function SecurityCenterPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const root = isRecord(data) ? data : {}
  let cards: SemanticCard[] = []
  if (api.id === 'osv-vulnerability') {
    const affected = recordArray(root.affected)
    const packageNames = affected.map((entry) => cleanText(recordValue(entry.package, 'name'))).filter((value): value is string => Boolean(value))
    const ecosystems = affected.map((entry) => cleanText(recordValue(entry.package, 'ecosystem'))).filter((value): value is string => Boolean(value))
    const severity = recordArray(root.severity)[0]
    cards = Object.keys(root).length ? [{
      title: cleanText(root.id) ?? 'OSV advisory',
      eyebrow: 'Open Source Vulnerability database',
      description: cleanText(root.summary ?? root.details),
      badge: cleanText(severity?.type) ?? (root.withdrawn ? 'Withdrawn' : 'Active'),
      metrics: [
        { label: 'Affected packages', value: packageNames.length ? packageNames.slice(0, 3).join(', ') : '—' },
        { label: 'Ecosystems', value: [...new Set(ecosystems)].join(', ') || '—' },
        { label: 'Published', value: dateParts(root.published).full || previewValue(root.published) },
        { label: 'Modified', value: dateParts(root.modified).full || previewValue(root.modified) },
      ],
      tags: [...textArray(root.aliases), ...textArray(root.related)].slice(0, 5),
    }] : []
  } else if (api.id === 'nvd-cpe-search') cards = recordArray(root.products).map((product) => {
    const cpe = isRecord(product.cpe) ? product.cpe : product
    const titles = recordArray(cpe.titles)
    return { title: cleanText(titles[0]?.title) ?? cleanText(cpe.cpeName) ?? 'CPE product', eyebrow: 'NVD product dictionary', badge: cpe.deprecated ? 'Deprecated' : 'Active', metrics: [{ label: 'CPE name', value: previewValue(cpe.cpeName) }, { label: 'Created', value: dateParts(cpe.created).full }, { label: 'Modified', value: dateParts(cpe.lastModified).full }] }
  })
  else cards = recordArray(root.vulnerabilities).map((entry) => {
    const cve = isRecord(entry.cve) ? entry.cve : entry
    const descriptions = recordArray(cve.descriptions)
    const metrics = isRecord(cve.metrics) ? cve.metrics : {}
    const cvss = recordArray(metrics.cvssMetricV31)[0] ?? recordArray(metrics.cvssMetricV30)[0] ?? recordArray(metrics.cvssMetricV2)[0]
    const cvssData = cvss && isRecord(cvss.cvssData) ? cvss.cvssData : {}
    return { title: cleanText(cve.id) ?? 'CVE advisory', eyebrow: 'NIST vulnerability record', description: cleanText(descriptions.find((item) => item.lang === 'en')?.value ?? descriptions[0]?.value), badge: cleanText(cvssData.baseSeverity) ?? cleanText(cve.vulnStatus) ?? 'Reviewed', metrics: [{ label: 'CVSS score', value: previewValue(cvssData.baseScore) }, { label: 'Published', value: dateParts(cve.published).full }, { label: 'Modified', value: dateParts(cve.lastModified).full }] }
  })
  return <SemanticCards cards={cards} emptyTitle="Security records unavailable"/>
}

function ResearchLibraryPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const root = isRecord(data) ? data : {}
  let cards: SemanticCard[] = []
  if (api.id === 'open-library-search') cards = recordArray(root.docs).map((book) => ({ title: cleanText(book.title) ?? 'Book', eyebrow: textArray(book.author_name).join(', ') || 'Open Library', badge: previewValue(book.first_publish_year), metrics: [{ label: 'Authors', value: String(textArray(book.author_name).length || 1) }, { label: 'First published', value: previewValue(book.first_publish_year) }, { label: 'Edition key', value: previewValue(book.key) }] }))
  else if (api.id === 'clinical-trials-search') cards = recordArray(root.studies).map((study) => {
    const protocol = isRecord(study.protocolSection) ? study.protocolSection : {}
    const identification = isRecord(protocol.identificationModule) ? protocol.identificationModule : {}
    const status = isRecord(protocol.statusModule) ? protocol.statusModule : {}
    const design = isRecord(protocol.designModule) ? protocol.designModule : {}
    return { title: cleanText(identification.briefTitle ?? identification.officialTitle) ?? 'Clinical study', eyebrow: cleanText(identification.nctId) ?? 'ClinicalTrials.gov', badge: cleanText(status.overallStatus) ?? 'Study', metrics: [{ label: 'Study type', value: previewValue(design.studyType) }, { label: 'Start date', value: previewValue(recordValue(status.startDateStruct, 'date')) }, { label: 'Has results', value: study.hasResults ? 'Yes' : 'No' }] }
  })
  else if (api.id === 'europe-pmc-search') {
    const list = isRecord(root.resultList) ? root.resultList : {}
    cards = recordArray(list.result).map((paper) => ({ title: cleanText(paper.title) ?? 'Research paper', eyebrow: cleanText(paper.authorString) ?? 'Europe PMC', description: cleanText(paper.journalTitle), badge: previewValue(paper.pubYear), metrics: [{ label: 'Citations', value: previewValue(paper.citedByCount) }, { label: 'Open access', value: paper.isOpenAccess === 'Y' ? 'Yes' : 'No' }, { label: 'Identifier', value: previewValue(paper.doi ?? paper.pmid ?? paper.id) }] }))
  }
  return <SemanticCards cards={cards} emptyTitle="Research records unavailable"/>
}

function DictionaryEntryPreview({ data }: { data: unknown }) {
  const entry = recordArray(data)[0]
  if (!entry) return <div className="weather-empty"><strong>Dictionary entry unavailable</strong><span>No word entry was returned.</span></div>
  const phonetics = recordArray(entry.phonetics)
  const meanings = recordArray(entry.meanings)
  const phonetic = cleanText(entry.phonetic) ?? cleanText(phonetics.find((item) => item.text)?.text) ?? 'Pronunciation unavailable'
  return <div className="dictionary-preview"><div className="dictionary-hero"><div><span>English dictionary</span><strong>{cleanText(entry.word) ?? 'Word'}</strong><b>{phonetic}</b></div><span aria-hidden="true">Aa</span></div><div className="dictionary-meanings">{meanings.map((meaning, index) => {
    const definitions = recordArray(meaning.definitions)
    return <section key={`${meaning.partOfSpeech}-${index}`}><header><span>{index + 1}</span><h3>{cleanText(meaning.partOfSpeech) ?? 'Meaning'}</h3></header><ol>{definitions.slice(0, 3).map((definition, definitionIndex) => <li key={definitionIndex}><p>{cleanText(definition.definition) ?? 'Definition unavailable'}</p>{cleanText(definition.example) && <blockquote>“{cleanText(definition.example)}”</blockquote>}</li>)}</ol>{textArray(meaning.synonyms).length ? <footer><b>Synonyms</b>{textArray(meaning.synonyms).slice(0, 6).map((word) => <span key={word}>{word}</span>)}</footer> : null}</section>
  })}</div></div>
}

function DataTablePreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const root = isRecord(data) ? data : {}
  let records: Array<Record<string, unknown>> = []
  if (api.id === 'carbon-intensity-gb') records = recordArray(root.data).map((record) => ({ title: 'GB carbon intensity', status: recordValue(record.intensity, 'index'), value: recordValue(record.intensity, 'actual') ?? recordValue(record.intensity, 'forecast'), unit: 'gCO₂/kWh', updated: record.from }))
  else if (api.id === 'ipify-public-ip') records = [{ title: 'Detected public address', value: root.ip, status: String(root.ip ?? '').includes(':') ? 'IPv6' : 'IPv4', source: 'Network response' }]
  else if (api.id === 'nws-weather') records = recordArray(root.features).map((feature) => isRecord(feature.properties) ? feature.properties : feature)
  else if (api.id === 'usaspending') records = recordArray(root.results)
  else if (api.id === 'wikidata-sparql') records = recordArray(recordValue(recordValue(root.results, 'bindings'), 'items') ?? recordValue(root.results, 'bindings')).map((binding) => Object.fromEntries(Object.entries(binding).map(([key, value]) => [key, recordValue(value, 'value') ?? value])))
  else if (api.id === 'openfda-drug-labels') records = recordArray(root.results).map((record) => ({ title: textArray(record.openfda && recordValue(record.openfda, 'brand_name'))[0] ?? textArray(record.spl_product_data_elements)[0] ?? 'Drug label', purpose: textArray(record.purpose)[0], warnings: textArray(record.warnings)[0], active_ingredient: textArray(record.active_ingredient)[0] }))
  else records = findPreviewRecords(data)
  const cards = records.map((record, index) => {
    const entries = Object.entries(record).filter(([, value]) => value !== undefined).slice(0, 6)
    const titleEntry = entries.find(([key]) => ['title', 'name', 'recipient name', 'award id'].includes(key.toLowerCase()))
    return { title: cleanText(titleEntry?.[1]) ?? `${api.name} record ${index + 1}`, eyebrow: api.provider, badge: cleanText(record.status ?? record.severity ?? record.event) ?? undefined, description: cleanText(record.description ?? record.summary ?? record.warnings), metrics: entries.filter(([key]) => key !== titleEntry?.[0] && !['description', 'summary', 'warnings'].includes(key.toLowerCase())).slice(0, 4).map(([key, value]) => ({ label: previewLabel(key), value: previewValue(value) })) }
  })
  return <SemanticCards cards={cards} emptyTitle="Structured records unavailable"/>
}

function ResultListPreview({ data, api }: { data: unknown; api: ApiDemo }) {
  const items = buildDemoPreview(data)
  return <div className="demo-preview-grid">{items.map((item, index) => <article className="demo-preview-card" aria-label={`${item.title} preview`} key={`${item.title}-${index}`}><div className="demo-preview-card-title"><span style={{ '--api-color': api.accent } as CSSProperties}>{api.monogram}</span><div><small>{api.name}</small><h3>{item.title}</h3></div></div><dl>{item.fields.map((field, fieldIndex) => <div key={`${field.label}-${fieldIndex}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl></article>)}</div>
}

type ApiPreviewProps = { api: ApiDemo; data: unknown }
export type ApiPreviewComponent = (props: ApiPreviewProps) => ReactElement

const componentName = (id: string) => `${id.split('-').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join('')}Preview`
const componentSeed = (id: string) => [...id].reduce((seed, character) => ((seed * 31) + character.charCodeAt(0)) >>> 0, 17)

const defineApiPreview = (id: string, render: (props: ApiPreviewProps) => ReactElement): ApiPreviewComponent => {
  const seed = componentSeed(id)
  const Component = ({ api, data }: ApiPreviewProps) => <div
    className={`api-specific-preview api-specific-${id}`}
    data-api-preview-component={id}
    data-visual-signature={`${componentName(id)}-${seed.toString(36)}`}
    aria-label={`${api.name} visual component`}
    style={{
      '--component-angle': `${105 + (seed % 150)}deg`,
      '--component-radius': `${10 + (seed % 13)}px`,
      '--component-pattern-size': `${22 + (seed % 31)}px`,
    } as CSSProperties}
  >{render({ api, data })}</div>
  Object.defineProperty(Component, 'name', { value: componentName(id) })
  return Component
}

// Every catalog item owns a distinct React component function. Components may
// compose the low-level chart, metric, gallery, map, and timeline primitives
// above, but no catalog item is dispatched through a family-level component.
export const apiPreviewComponents: Partial<Record<string, ApiPreviewComponent>> = {
  countries: defineApiPreview('countries', ({ api, data }) => <CountryPreview api={api} data={data}/>),
  weather: defineApiPreview('weather', ({ api, data }) => <CurrentConditionsPreview api={api} data={data}/>),
  people: defineApiPreview('people', ({ api, data }) => <MediaGalleryPreview api={api} data={data}/>),
  dogs: defineApiPreview('dogs', ({ api, data }) => <MediaGalleryPreview api={api} data={data}/>),
  posts: defineApiPreview('posts', ({ api, data }) => <DeveloperFeedPreview api={api} data={data}/>),
  holidays: defineApiPreview('holidays', ({ api, data }) => <CalendarPreview api={api} data={data}/>),
  'geocoding-search': defineApiPreview('geocoding-search', ({ api, data }) => <LocationPreview api={api} data={data}/>),
  'open-meteo-air-quality': defineApiPreview('open-meteo-air-quality', ({ api, data }) => <AirQualityForecastPreview data={data}/>),
  'sunrise-sunset': defineApiPreview('sunrise-sunset', ({ data }) => <SolarCyclePreview data={data}/>),
  'nasa-eonet-events': defineApiPreview('nasa-eonet-events', ({ data }) => <NaturalEventsPreview data={data}/>),
  'mbta-transit-routes': defineApiPreview('mbta-transit-routes', ({ data }) => <TransitBoardPreview data={data}/>),
  'open-trivia': defineApiPreview('open-trivia', ({ data }) => <TriviaGamePreview data={data}/>),
  'carbon-intensity-gb': defineApiPreview('carbon-intensity-gb', ({ api, data }) => <DataTablePreview api={api} data={data}/>),
  'data-gov-24hr-forecast': defineApiPreview('data-gov-24hr-forecast', ({ data }) => <TwentyFourHourForecastPreview data={data}/>),
  'data-gov-4day-forecast': defineApiPreview('data-gov-4day-forecast', ({ data }) => <FourDayForecastPreview data={data}/>),
  'data-gov-air-temperature': defineApiPreview('data-gov-air-temperature', ({ api, data }) => <StationReadingsPreview api={api} data={data}/>),
  'data-gov-carpark': defineApiPreview('data-gov-carpark', ({ api, data }) => <LocationPreview api={api} data={data}/>),
  'data-gov-forecast-2hr': defineApiPreview('data-gov-forecast-2hr', ({ data }) => <AreaForecastPreview data={data}/>),
  'data-gov-pm25': defineApiPreview('data-gov-pm25', ({ api, data }) => <RegionalAirQualityPreview api={api} data={data}/>),
  'data-gov-psi': defineApiPreview('data-gov-psi', ({ api, data }) => <RegionalAirQualityPreview api={api} data={data}/>),
  'data-gov-rainfall': defineApiPreview('data-gov-rainfall', ({ api, data }) => <StationReadingsPreview api={api} data={data}/>),
  'data-gov-relative-humidity': defineApiPreview('data-gov-relative-humidity', ({ api, data }) => <StationReadingsPreview api={api} data={data}/>),
  'data-gov-taxi': defineApiPreview('data-gov-taxi', ({ api, data }) => <LocationPreview api={api} data={data}/>),
  'data-gov-traffic-images': defineApiPreview('data-gov-traffic-images', ({ api, data }) => <MediaGalleryPreview api={api} data={data}/>),
  'data-gov-uv-index': defineApiPreview('data-gov-uv-index', ({ data }) => <UvIndexPreview data={data}/>),
  'data-gov-wind-direction': defineApiPreview('data-gov-wind-direction', ({ api, data }) => <StationReadingsPreview api={api} data={data}/>),
  'data-gov-wind-speed': defineApiPreview('data-gov-wind-speed', ({ api, data }) => <StationReadingsPreview api={api} data={data}/>),
  'data-usa': defineApiPreview('data-usa', ({ api, data }) => <MarketPreview api={api} data={data}/>),
  devto: defineApiPreview('devto', ({ api, data }) => <DeveloperFeedPreview api={api} data={data}/>),
  'fiscal-data-treasury': defineApiPreview('fiscal-data-treasury', ({ api, data }) => <MarketPreview api={api} data={data}/>),
  github: defineApiPreview('github', ({ api, data }) => <DeveloperFeedPreview api={api} data={data}/>),
  'hacker-news': defineApiPreview('hacker-news', ({ api, data }) => <DeveloperFeedPreview api={api} data={data}/>),
  'ipify-public-ip': defineApiPreview('ipify-public-ip', ({ api, data }) => <DataTablePreview api={api} data={data}/>),
  'met-museum-object-detail': defineApiPreview('met-museum-object-detail', ({ api, data }) => <MediaGalleryPreview api={api} data={data}/>),
  'met-museum-search': defineApiPreview('met-museum-search', ({ api, data }) => <MediaGalleryPreview api={api} data={data}/>),
  'nhtsa-vpic': defineApiPreview('nhtsa-vpic', ({ api, data }) => <LocationPreview api={api} data={data}/>),
  'npm-search': defineApiPreview('npm-search', ({ api, data }) => <DeveloperFeedPreview api={api} data={data}/>),
  'nvd-cpe-search': defineApiPreview('nvd-cpe-search', ({ api, data }) => <SecurityCenterPreview api={api} data={data}/>),
  'nvd-cve-detail': defineApiPreview('nvd-cve-detail', ({ api, data }) => <SecurityCenterPreview api={api} data={data}/>),
  'nvd-cves': defineApiPreview('nvd-cves', ({ api, data }) => <SecurityCenterPreview api={api} data={data}/>),
  'nvd-recent-cves': defineApiPreview('nvd-recent-cves', ({ api, data }) => <SecurityCenterPreview api={api} data={data}/>),
  'nws-weather': defineApiPreview('nws-weather', ({ api, data }) => <DataTablePreview api={api} data={data}/>),
  'postcodes-io': defineApiPreview('postcodes-io', ({ api, data }) => <LocationPreview api={api} data={data}/>),
  'pypi-json': defineApiPreview('pypi-json', ({ api, data }) => <DeveloperFeedPreview api={api} data={data}/>),
  'stack-exchange': defineApiPreview('stack-exchange', ({ api, data }) => <DeveloperFeedPreview api={api} data={data}/>),
  'uk-bank-holidays': defineApiPreview('uk-bank-holidays', ({ api, data }) => <CalendarPreview api={api} data={data}/>),
  usaspending: defineApiPreview('usaspending', ({ api, data }) => <DataTablePreview api={api} data={data}/>),
  usgs: defineApiPreview('usgs', ({ api, data }) => <LocationPreview api={api} data={data}/>),
  'wikidata-sparql': defineApiPreview('wikidata-sparql', ({ api, data }) => <DataTablePreview api={api} data={data}/>),
  'world-bank-gdp': defineApiPreview('world-bank-gdp', ({ api, data }) => <MarketPreview api={api} data={data}/>),
  'world-bank-population': defineApiPreview('world-bank-population', ({ api, data }) => <MarketPreview api={api} data={data}/>),
  'frankfurter-sgd-myr-history': defineApiPreview('frankfurter-sgd-myr-history', ({ api, data }) => <MarketPreview api={api} data={data}/>),
  'open-library-search': defineApiPreview('open-library-search', ({ api, data }) => <ResearchLibraryPreview api={api} data={data}/>),
  'free-dictionary': defineApiPreview('free-dictionary', ({ data }) => <DictionaryEntryPreview data={data}/>),
  pokeapi: defineApiPreview('pokeapi', ({ api, data }) => <MediaGalleryPreview api={api} data={data}/>),
  'art-institute-search': defineApiPreview('art-institute-search', ({ api, data }) => <MediaGalleryPreview api={api} data={data}/>),
  'tvmaze-search': defineApiPreview('tvmaze-search', ({ api, data }) => <MediaGalleryPreview api={api} data={data}/>),
  'open-food-facts': defineApiPreview('open-food-facts', ({ api, data }) => <MediaGalleryPreview api={api} data={data}/>),
  'gbif-species-search': defineApiPreview('gbif-species-search', ({ api, data }) => <MediaGalleryPreview api={api} data={data}/>),
  'clinical-trials-search': defineApiPreview('clinical-trials-search', ({ api, data }) => <ResearchLibraryPreview api={api} data={data}/>),
  'europe-pmc-search': defineApiPreview('europe-pmc-search', ({ api, data }) => <ResearchLibraryPreview api={api} data={data}/>),
  'openfda-drug-labels': defineApiPreview('openfda-drug-labels', ({ api, data }) => <DataTablePreview api={api} data={data}/>),
  'coinpaprika-ticker': defineApiPreview('coinpaprika-ticker', ({ api, data }) => <MarketPreview api={api} data={data}/>),
  'yahoo-finance-sgx-history': defineApiPreview('yahoo-finance-sgx-history', ({ api, data }) => <MarketPreview api={api} data={data}/>),
  'malaysia-fuel-price': defineApiPreview('malaysia-fuel-price', ({ data }) => <FuelPricePreview data={data}/>),
  'open-meteo-marine': defineApiPreview('open-meteo-marine', ({ data }) => <MarineForecastPreview data={data}/>),
  'nobel-prizes': defineApiPreview('nobel-prizes', ({ data }) => <NobelPrizePreview data={data}/>),
  'chess-player-stats': defineApiPreview('chess-player-stats', ({ data }) => <ChessRatingsPreview data={data}/>),
  'crossref-works': defineApiPreview('crossref-works', ({ data }) => <CrossrefWorksPreview data={data}/>),
  'noaa-space-weather': defineApiPreview('noaa-space-weather', ({ data }) => <SpaceWeatherPreview data={data}/>),
  'osv-vulnerability': defineApiPreview('osv-vulnerability', ({ api, data }) => <SecurityCenterPreview api={api} data={data}/>),
  'federal-register-documents': defineApiPreview('federal-register-documents', ({ data }) => <FederalRegisterPreview data={data}/>),
  'wikipedia-search': defineApiPreview('wikipedia-search', ({ api, data }) => <MediaGalleryPreview api={api} data={data}/>),
  'open-meteo-flood': defineApiPreview('open-meteo-flood', ({ data }) => <FloodForecastPreview data={data}/>),
  'open-meteo-history': defineApiPreview('open-meteo-history', ({ api, data }) => <MarketPreview api={api} data={data}/>),
  'kraken-public-ticker': defineApiPreview('kraken-public-ticker', ({ api, data }) => <MarketPreview api={api} data={data}/>),
  'gitlab-public-projects': defineApiPreview('gitlab-public-projects', ({ api, data }) => <DeveloperFeedPreview api={api} data={data}/>),
  'uk-police-street-crime': defineApiPreview('uk-police-street-crime', ({ api, data }) => <LocationPreview api={api} data={data}/>),
  'open-brewery-directory': defineApiPreview('open-brewery-directory', ({ api, data }) => <LocationPreview api={api} data={data}/>),
  'rick-morty-characters': defineApiPreview('rick-morty-characters', ({ api, data }) => <MediaGalleryPreview api={api} data={data}/>),
  'wikimedia-pageviews': defineApiPreview('wikimedia-pageviews', ({ api, data }) => <MarketPreview api={api} data={data}/>),
}

export const apiPreviewComponentIds = Object.keys(apiPreviewComponents)

const previewMeta: Record<PreviewLayout, { icon: string; eyebrow: string; title: string; description: string }> = {
  'weather-dashboard': { icon: '☀', eyebrow: 'Live response · Weather layout', title: 'Current conditions', description: 'A ready-to-use weather dashboard built from observations, units, and location data.' },
  'country-profile': { icon: '◎', eyebrow: 'Live response · Profile layout', title: 'Country profile', description: 'A structured destination profile using regional and economic metadata.' },
  'market-chart': { icon: '↗', eyebrow: 'Live response · Market layout', title: 'Market snapshot', description: 'A financial panel that turns price history and rates into an at-a-glance trend.' },
  'media-gallery': { icon: '▧', eyebrow: 'Live response · Visual layout', title: 'Visual gallery', description: 'An image-led interface using media, profile, or catalogue fields from the response.' },
  'location-map': { icon: '⌖', eyebrow: 'Live response · Location layout', title: 'Location explorer', description: 'A spatial interface that maps coordinates and keeps every location agent-readable.' },
  'calendar-timeline': { icon: '□', eyebrow: 'Live response · Calendar layout', title: 'Event timeline', description: 'A chronological interface built from dates, event names, and regional metadata.' },
  'solar-cycle': { icon: '☀', eyebrow: 'Live response · Solar layout', title: 'Sun & moon cycle', description: 'A daylight timeline built from local sunrise, sunset, twilight, solar, and lunar data.' },
  'natural-events': { icon: '◎', eyebrow: 'Live response · Earth monitor', title: 'Natural events monitor', description: 'Near-real-time natural events organized by category, location, status, and observation time.' },
  'transit-board': { icon: 'T', eyebrow: 'Live response · Transit layout', title: 'Transit route board', description: 'A route-focused interface using MBTA colors, destinations, and service types.' },
  'trivia-game': { icon: '?', eyebrow: 'Live response · Game layout', title: 'Trivia challenge', description: 'A playable-looking question deck with decoded prompts, answer options, and difficulty labels.' },
  'developer-feed': { icon: '</>', eyebrow: 'Live response · Developer layout', title: 'Developer workspace', description: 'Repositories, packages, posts, and community activity translated into actionable cards.' },
  'security-center': { icon: '◇', eyebrow: 'Live response · Security layout', title: 'Security advisory center', description: 'Vulnerability and product records organized by severity, identifiers, and review dates.' },
  'research-library': { icon: '▤', eyebrow: 'Live response · Research layout', title: 'Research library', description: 'Books, papers, and clinical studies presented with authorship, status, and identifiers.' },
  'dictionary-entry': { icon: 'Aa', eyebrow: 'Live response · Language layout', title: 'Dictionary entry', description: 'Definitions, parts of speech, examples, and synonyms mapped from the word response.' },
  'data-table': { icon: '▦', eyebrow: 'Live response · Data layout', title: 'Structured data view', description: 'Purpose-built records that expose the most useful values from this response.' },
  'fuel-dashboard': { icon: '⛽', eyebrow: 'Live response · Fuel market layout', title: 'Malaysia fuel board', description: 'Official weekly pump prices, subsidy tiers, changes, and price history in a retail-market dashboard.' },
  'marine-forecast': { icon: '≈', eyebrow: 'Live response · Marine layout', title: 'Marine forecast', description: 'Wave, current, bearing, period, and sea-temperature series presented as a coastal conditions cockpit.' },
  'awards-timeline': { icon: 'N', eyebrow: 'Live response · Awards layout', title: 'Nobel Prize timeline', description: 'Prize years, categories, laureates, discoveries, and award values arranged chronologically.' },
  'chess-ratings': { icon: '♞', eyebrow: 'Live response · Chess layout', title: 'Player ratings', description: 'Competitive ratings, personal bests, match records, and win ratios compared across time controls.' },
  'scholarly-search': { icon: 'DOI', eyebrow: 'Live response · Scholarly layout', title: 'Scholarly works', description: 'DOI metadata organized by title, authorship, publication year, publisher, type, and citation count.' },
  'result-list': { icon: '✦', eyebrow: 'Live response · Results layout', title: 'Result explorer', description: 'A structured result browser adapted to this API response.' },
}

const weatherPreviewMeta: Record<WeatherPreviewVariant, { icon: string; eyebrow: string; title: string; description: string }> = {
  current: previewMeta['weather-dashboard'],
  'four-day': { icon: '☂', eyebrow: 'Live response · Daily forecast', title: '4-day outlook', description: 'Daily conditions, temperature ranges, humidity, and wind values mapped directly from the forecast response.' },
  'twenty-four-hour': { icon: '◒', eyebrow: 'Live response · Regional forecast', title: '24-hour forecast', description: 'A full-day outlook with general conditions and time-based forecasts for every Singapore region.' },
  'area-forecast': { icon: '⌖', eyebrow: 'Live response · Neighbourhood forecast', title: '2-hour area forecast', description: 'Short-range conditions grouped by named Singapore neighbourhoods.' },
  'station-readings': { icon: '◉', eyebrow: 'Live response · Sensor network', title: 'Station readings', description: 'Live measurements joined with station names, units, coordinates, and network statistics.' },
  'regional-air-quality': { icon: '≋', eyebrow: 'Live response · Air quality', title: 'Regional air quality', description: 'PSI and particulate readings compared across Singapore’s five reporting regions.' },
  'air-quality-forecast': { icon: '≋', eyebrow: 'Live response · Air quality', title: 'Current air quality', description: 'Current AQI and pollutant concentrations mapped directly from the selected coordinates.' },
  'uv-index': { icon: '☀', eyebrow: 'Live response · UV monitoring', title: 'UV index', description: 'The latest ultraviolet exposure level and its reporting timeline.' },
}

export function ResponseDemoPreview({ api, data }: { api: ApiDemo; data: unknown }) {
  const layout = selectPreviewLayout(api)
  const weatherVariant = layout === 'weather-dashboard' ? selectWeatherPreviewVariant(api) : undefined
  const profileLabel = getPreviewProfile(api.id)?.label ?? previewMeta[layout].eyebrow
  const PreviewComponent = apiPreviewComponents[api.id]
  const content: ReactNode = PreviewComponent
    ? <PreviewComponent api={api} data={data}/>
    : <ResultListPreview data={data} api={api}/>

  const headingId = `demo-preview-${api.id}`
  return <section
    className={`demo-preview preview-${layout}`}
    aria-labelledby={headingId}
    aria-live="polite"
    data-webmcp-surface="api-demo-preview"
    data-preview-layout={layout}
    data-preview-variant={weatherVariant}
    data-preview-component={PreviewComponent ? api.id : 'generic-fallback'}
    data-api-id={api.id}
    style={{ '--preview-accent': api.accent } as CSSProperties}
  >
    <div className="demo-preview-head"><span aria-hidden="true">{api.monogram}</span><div><small>Live response · {profileLabel} · Dedicated component</small><h2 id={headingId}>{api.name}</h2><p>{api.description}</p></div><em><span aria-hidden="true">✓</span> API-specific UI</em></div>
    {content}
    <p className="demo-preview-note">Generated only from the live JSON response · Component: {componentName(api.id)}</p>
  </section>
}
