import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { isRecord, trimmedText } from './semanticValidation'

const WEEKLY_VARS = 'temperature_2m_mean,temperature_2m_anomaly,precipitation_mean,precipitation_anomaly'
const DAY_MS = 86_400_000

type SeasonalRequest = { latitude: number; longitude: number; forecastDays: number }
type SeasonalWeek = { time: string; temperature: number; temperatureAnomaly: number; precipitation: number; precipitationAnomaly: number }

const finiteNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const dateText = (value: unknown): string | undefined => {
  const text = trimmedText(value)
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined
}
const utcDay = (value: string): number => Date.parse(`${value}T00:00:00Z`)

const boundedQueryNumber = (value: string | null, minimum: number, maximum: number) => {
  if (value === null || !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? numeric : undefined
}

const requestedSeasonal = (requestUrl?: string): SeasonalRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const allowed = new Set(['latitude', 'longitude', 'weekly', 'forecast_days', 'timezone'])
    const entries = [...url.searchParams.entries()]
    const exactKeys = entries.length === allowed.size
      && entries.every(([key]) => allowed.has(key))
      && [...allowed].every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
    if (url.protocol !== 'https:' || url.hostname !== 'seasonal-api.open-meteo.com' || url.port !== '' || url.pathname !== '/v1/seasonal' || url.hash || url.username || url.password || !exactKeys) return undefined
    if (url.searchParams.get('weekly') !== WEEKLY_VARS || url.searchParams.get('timezone') !== 'Asia/Singapore') return undefined
    const latitude = boundedQueryNumber(url.searchParams.get('latitude'), -90, 90)
    const longitude = boundedQueryNumber(url.searchParams.get('longitude'), -180, 180)
    const forecastDaysText = url.searchParams.get('forecast_days')
    if (latitude === undefined || longitude === undefined || forecastDaysText === null || !/^(?:[1-9]|[1-3]\d|4[0-6])$/.test(forecastDaysText)) return undefined
    return { latitude, longitude, forecastDays: Number(forecastDaysText) }
  } catch { return undefined }
}

type SeasonalTransport = { request?: SeasonalRequest; valid: boolean; bound: boolean }

const resolveSeasonalRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): SeasonalTransport => {
  const displayed = requestedSeasonal(requestUrl)
  if (requestUrl && !displayed) return { valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
    return { valid: false, bound: false }
  }
  const executed = requestedSeasonal(executedRequest.url)
  return executed ? { request: executed, valid: true, bound: true } : { valid: false, bound: false }
}

const invalid = (detail: string, requestBound = false) => <div className="domain-card domain-empty" data-domain-card="seasonal-outlook" data-result-state="invalid" data-request-bound={String(requestBound)}><h3>Invalid seasonal forecast response</h3><p>{detail}</p></div>

export function OpenMeteoSeasonalPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const transport = resolveSeasonalRequest(requestUrl, executedRequest)
  const request = transport.request
  if (!transport.valid) return invalid('The executed request was not the exact supported bodyless GET Open-Meteo weekly seasonal outlook request, or it disagreed with the displayed request URL.')
  if (!isRecord(data) || !isRecord(data.weekly) || !isRecord(data.weekly_units)) return invalid('Open-Meteo returned HTTP-success data without the documented weekly seasonal forecast envelope.', transport.bound)
  const weekly = data.weekly
  const times = Array.isArray(weekly.time) ? weekly.time : undefined
  const temperatures = Array.isArray(weekly.temperature_2m_mean) ? weekly.temperature_2m_mean : undefined
  const temperatureAnomalies = Array.isArray(weekly.temperature_2m_anomaly) ? weekly.temperature_2m_anomaly : undefined
  const precipitation = Array.isArray(weekly.precipitation_mean) ? weekly.precipitation_mean : undefined
  const precipitationAnomalies = Array.isArray(weekly.precipitation_anomaly) ? weekly.precipitation_anomaly : undefined
  if (!times || !temperatures || !temperatureAnomalies || !precipitation || !precipitationAnomalies) return invalid('One or more requested weekly seasonal arrays are missing or malformed.', transport.bound)
  const lengths = [times.length, temperatures.length, temperatureAnomalies.length, precipitation.length, precipitationAnomalies.length]
  const providerCount = Math.max(...lengths)
  if (providerCount === 0) return invalid('Open-Meteo returned no weekly seasonal buckets for a valid seasonal request.', transport.bound)
  const arrayLengthContract = lengths.every((length) => length === providerCount)
  const rows: SeasonalWeek[] = []
  let invalidCount = 0
  for (let i = 0; i < providerCount; i += 1) {
    const time = dateText(times[i]); const temperature = finiteNumber(temperatures[i]); const temperatureAnomaly = finiteNumber(temperatureAnomalies[i]); const precip = finiteNumber(precipitation[i]); const precipAnomaly = finiteNumber(precipitationAnomalies[i])
    if (!time || temperature === undefined || temperatureAnomaly === undefined || precip === undefined || precipAnomaly === undefined) { invalidCount += 1; continue }
    rows.push({ time, temperature, temperatureAnomaly, precipitation: precip, precipitationAnomaly: precipAnomaly })
  }
  if (!rows.length) return invalid('None of the returned weekly records contained the requested seasonal measurements.', transport.bound)
  const units = data.weekly_units
  const unitsValid = units.temperature_2m_mean === '°C' && units.temperature_2m_anomaly === 'K' && units.precipitation_mean === 'mm' && units.precipitation_anomaly === 'mm'
  const timezone = trimmedText(data.timezone)
  const weeklyCadenceContract = rows.every((row, index) => index === 0 || utcDay(row.time) - utcDay(rows[index - 1].time) === 7 * DAY_MS)
  const minimumBuckets = request ? Math.ceil(request.forecastDays / 7) : undefined
  const maximumBuckets = minimumBuckets === undefined ? undefined : minimumBuckets + 1
  const horizonCountContract = request && minimumBuckets !== undefined && maximumBuckets !== undefined
    ? providerCount >= minimumBuckets && providerCount <= maximumBuckets
    : false
  const state = transport.bound && request && timezone === 'Asia/Singapore' && unitsValid && arrayLengthContract && weeklyCadenceContract && horizonCountContract && invalidCount === 0 ? 'ready' : 'partial'
  const cards: SemanticCard[] = rows.slice(0, 7).map((row) => ({
    title: `Week of ${row.time}`,
    eyebrow: 'ECMWF seasonal outlook',
    badge: `${row.temperatureAnomaly >= 0 ? '+' : ''}${row.temperatureAnomaly.toFixed(2)} K temp anomaly`,
    metrics: [
      { label: 'Mean temperature', value: `${row.temperature.toFixed(1)} °C` },
      { label: 'Mean precipitation', value: `${row.precipitation.toFixed(1)} mm` },
      { label: 'Precipitation anomaly', value: `${row.precipitationAnomaly >= 0 ? '+' : ''}${row.precipitationAnomaly.toFixed(1)} mm` },
      { label: 'Calendar week starts', value: row.time },
    ],
  }))
  return <div data-domain-card="seasonal-outlook" data-result-state={state} data-request-bound={String(transport.bound)} data-query-bound={String(transport.bound)} data-request-forecast-days={request?.forecastDays} data-provider-period-count={providerCount} data-valid-period-count={rows.length} data-invalid-period-count={invalidCount} data-array-length-contract={String(arrayLengthContract)} data-weekly-cadence-contract={String(weeklyCadenceContract)} data-horizon-count-contract={String(horizonCountContract)} data-minimum-expected-buckets={minimumBuckets} data-maximum-expected-buckets={maximumBuckets} data-unit-contract={String(unitsValid)} data-timezone={timezone}>
    <div className="domain-note"><strong>ECMWF seasonal outlook</strong> · {request ? `${request.forecastDays}-day horizon · ` : ''}{rows.length} calendar-aligned weekly bucket{rows.length === 1 ? '' : 's'} · anomalies are relative to model climatology</div>
    {state === 'partial' && <p className="domain-note">Only validated seasonal buckets are shown because request identity, units, timezone, array shape, weekly cadence, horizon coverage, or one or more provider rows are incomplete.</p>}
    <SemanticCards cards={cards} emptyTitle="Seasonal outlook unavailable"/>
  </div>
}
