import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading } from './cardPrimitives'
import { isRecord, trimmedText } from './semanticValidation'

const ENDPOINT = 'https://services.swpc.noaa.gov/products/noaa-scales.json'
const SCALE_TEXT = ['none', 'minor', 'moderate', 'strong', 'severe', 'extreme'] as const

type ScaleKey = 'R' | 'S' | 'G'
type ScaleReading = {
  key: ScaleKey
  label: string
  scale?: number
  text?: string
  valid: boolean
}

type ForecastReading = {
  key: string
  date?: string
  scale?: number
  text?: string
  valid: boolean
}

const scaleDefinitions: Array<{ key: ScaleKey; label: string }> = [
  { key: 'R', label: 'Radio blackout' },
  { key: 'S', label: 'Solar radiation storm' },
  { key: 'G', label: 'Geomagnetic storm' },
]

const exactRequest = (executedRequest?: ExecutedRequestContext): boolean => Boolean(
  executedRequest
  && executedRequest.method === 'GET'
  && executedRequest.body === undefined
  && executedRequest.url === ENDPOINT,
)

const scaleValue = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !/^[0-5]$/.test(value)) return undefined
  return Number(value)
}

const validDate = (value: unknown): string | undefined => {
  const text = trimmedText(value)
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined
  const parsed = new Date(`${text}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : undefined
}

const validTime = (value: unknown): string | undefined => {
  const text = trimmedText(value)
  if (!text || !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(text)) return undefined
  return text
}

const scaleReading = (source: unknown, definition: { key: ScaleKey; label: string }): ScaleReading => {
  const reading = isRecord(source) ? source : undefined
  const scale = reading ? scaleValue(reading.Scale) : undefined
  const text = reading ? trimmedText(reading.Text)?.toLowerCase() : undefined
  const expectedText = scale === undefined ? undefined : SCALE_TEXT[scale]
  const valid = scale !== undefined && text === expectedText
  return { ...definition, scale: valid ? scale : undefined, text: valid ? text : undefined, valid }
}

const forecastReading = (key: string, source: unknown): ForecastReading => {
  if (!isRecord(source)) return { key, valid: false }
  const date = validDate(source.DateStamp)
  const geomagnetic = isRecord(source.G) ? source.G : undefined
  const scale = geomagnetic ? scaleValue(geomagnetic.Scale) : undefined
  const text = geomagnetic ? trimmedText(geomagnetic.Text)?.toLowerCase() : undefined
  const expectedText = scale === undefined ? undefined : SCALE_TEXT[scale]
  const valid = Boolean(date) && scale !== undefined && text === expectedText
  return {
    key,
    date,
    scale: valid ? scale : undefined,
    text: valid ? text : undefined,
    valid,
  }
}

export function NoaaSpaceWeatherPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const requestBound = exactRequest(executedRequest)
  const root = isRecord(data) ? data : undefined
  const current = root && isRecord(root['0']) ? root['0'] : undefined
  const readings = scaleDefinitions.map((definition) => scaleReading(current?.[definition.key], definition))
  const validReadings = readings.filter((reading) => reading.valid)
  const invalidReadingCount = readings.length - validReadings.length
  const currentDate = current ? validDate(current.DateStamp) : undefined
  const currentTime = current ? validTime(current.TimeStamp) : undefined
  const observedAt = currentDate && currentTime ? `${currentDate}T${currentTime}Z` : undefined
  const forecasts = root
    ? ['1', '2', '3'].filter((key) => root[key] !== undefined).map((key) => forecastReading(key, root[key]))
    : []
  const invalidForecastCount = forecasts.filter((forecast) => !forecast.valid).length
  const validForecastCount = forecasts.length - invalidForecastCount
  const peak = validReadings.length ? Math.max(...validReadings.map((reading) => reading.scale as number)) : undefined

  const state = !requestBound || !root || !current || validReadings.length === 0
    ? 'invalid'
    : invalidReadingCount > 0 || !observedAt || invalidForecastCount > 0
      ? 'partial'
      : 'ready'

  const evidence = {
    'data-domain-card': 'noaa-space-weather-scales',
    'data-result-state': state,
    'data-request-bound': String(requestBound),
    'data-current-valid-scale-count': String(validReadings.length),
    'data-current-invalid-scale-count': String(invalidReadingCount),
    'data-current-peak-scale': peak === undefined ? undefined : String(peak),
    'data-current-observed-at': observedAt,
    'data-forecast-valid-count': String(validForecastCount),
    'data-forecast-invalid-count': String(invalidForecastCount),
  }

  if (!requestBound) return <div className="domain-card domain-empty" {...evidence}>
    <h3>NOAA request identity unavailable</h3>
    <p>The successful response cannot be trusted because the executed request was not the fixed NOAA Space Weather Scales product URL.</p>
  </div>

  if (!root || !current || validReadings.length === 0) return <div className="domain-card domain-empty" {...evidence}>
    <h3>Current NOAA scales unavailable</h3>
    <p>The response did not contain trustworthy current R, S, or G scale evidence. Missing or malformed values are not interpreted as quiet zero activity.</p>
  </div>

  return <div className="domain-card" {...evidence}>
    <CardHeading
      eyebrow="NOAA SWPC · operational R / S / G scales"
      title={peak === 0 ? 'Quiet current scale' : `Level ${peak ?? '—'} current scale`}
      description={observedAt ? `Provider observation ${observedAt}` : 'Provider observation timestamp unavailable'}
    />
    {state === 'partial' && <p className="domain-note">Only validated NOAA decimal-string scale evidence is shown. Missing or malformed current/forecast fields are withheld rather than converted to zero or “no storm”.</p>}
    <dl className="domain-facts" aria-label="Current NOAA scale evidence">{readings.map((reading) => <div key={reading.key} data-scale-key={reading.key} data-scale-valid={String(reading.valid)}><dt>{reading.label}</dt><dd>{reading.valid ? `${reading.key}${reading.scale} · ${reading.text}` : `${reading.label} · Unavailable`}</dd></div>)}</dl>
    {forecasts.length > 0 && <section aria-label="Geomagnetic storm forecast evidence">
      <h3>Geomagnetic forecast</h3>
      <ul>{forecasts.map((forecast) => <li key={forecast.key}>{forecast.valid
        ? `${forecast.date} · G${forecast.scale} · ${forecast.text}`
        : `${forecast.date ?? `Forecast ${forecast.key}`} · G unavailable`}</li>)}</ul>
    </section>}
  </div>
}
