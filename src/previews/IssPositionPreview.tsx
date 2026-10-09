import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts } from './cardPrimitives'
import { finiteNumber, isRecord, positiveSafeInteger, trimmedText } from './semanticValidation'

export const ISS_POSITION_URL = 'https://api.wheretheiss.at/v1/satellites/25544'

type ResultState = 'ready' | 'partial' | 'invalid'

export type IssPositionViewModel = {
  state: ResultState
  reason?: string
  requestBound: boolean
  identityContract: boolean
  positionContract: boolean
  measurementContract: boolean
  supplementalContract: boolean
  name?: 'iss'
  id?: 25544
  latitude?: number
  longitude?: number
  altitude?: number
  velocity?: number
  visibility?: string
  footprint?: number
  timestamp?: number
  timestampIso?: string
  daynum?: number
  solarLatitude?: number
  solarLongitude?: number
  units?: 'kilometers'
}

const exactRequest = (request?: ExecutedRequestContext) => {
  if (!request || request.method !== 'GET' || request.body !== undefined) return false
  try {
    const url = new URL(request.url)
    return url.protocol === 'https:'
      && url.hostname === 'api.wheretheiss.at'
      && url.port === ''
      && url.pathname === '/v1/satellites/25544'
      && url.search === ''
      && url.hash === ''
      && url.username === ''
      && url.password === ''
      && request.url === ISS_POSITION_URL
  } catch {
    return false
  }
}

const boundedNumber = (value: unknown, minimum: number, maximum: number) => {
  const number = finiteNumber(value)
  return number !== undefined && number >= minimum && number <= maximum ? number : undefined
}

const positiveNumber = (value: unknown) => {
  const number = finiteNumber(value)
  return number !== undefined && number > 0 ? number : undefined
}

const timestampIso = (timestamp: number | undefined) => {
  if (timestamp === undefined) return undefined
  const date = new Date(timestamp * 1000)
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
}

export const buildIssPositionViewModel = (
  data: unknown,
  executedRequest?: ExecutedRequestContext,
): IssPositionViewModel => {
  const requestBound = exactRequest(executedRequest)
  const root = isRecord(data) ? data : undefined
  const name: 'iss' | undefined = root?.name === 'iss' ? 'iss' : undefined
  const id: 25544 | undefined = positiveSafeInteger(root?.id) === 25544 ? 25544 : undefined
  const latitude = boundedNumber(root?.latitude, -90, 90)
  const longitude = boundedNumber(root?.longitude, -180, 180)
  const altitude = positiveNumber(root?.altitude)
  const velocity = positiveNumber(root?.velocity)
  const footprint = positiveNumber(root?.footprint)
  const timestamp = positiveSafeInteger(root?.timestamp)
  const observedAt = timestampIso(timestamp)
  const visibility = trimmedText(root?.visibility)
  const units: 'kilometers' | undefined = root?.units === 'kilometers' ? 'kilometers' : undefined
  const daynum = finiteNumber(root?.daynum)
  const solarLatitude = boundedNumber(root?.solar_lat, -90, 90)
  const solarLongitude = boundedNumber(root?.solar_lon, 0, 360)
  const identityContract = name !== undefined && id !== undefined
  const positionContract = latitude !== undefined && longitude !== undefined
  const measurementContract = altitude !== undefined
    && velocity !== undefined
    && footprint !== undefined
    && timestamp !== undefined
    && observedAt !== undefined
    && visibility !== undefined
    && units !== undefined
  const supplementalContract = daynum !== undefined
    && solarLatitude !== undefined
    && solarLongitude !== undefined
  const base = {
    requestBound,
    identityContract,
    positionContract,
    measurementContract,
    supplementalContract,
    name,
    id,
    latitude,
    longitude,
    altitude,
    velocity,
    visibility,
    footprint,
    timestamp,
    timestampIso: observedAt,
    daynum,
    solarLatitude,
    solarLongitude,
    units,
  }

  if (!requestBound) return { ...base, state: 'invalid', reason: 'The response was not tied to the exact bodyless current-position GET request for NORAD 25544.' }
  if (!root) return { ...base, state: 'invalid', reason: 'Where The ISS At did not return the documented satellite position object.' }
  if (!identityContract) return { ...base, state: 'invalid', reason: 'The provider response did not identify the ISS as name “iss” and native NORAD id 25544.' }
  if (!positionContract) return { ...base, state: 'invalid', reason: 'The ISS response did not contain native finite WGS84 latitude and longitude values.' }
  if (!measurementContract) return { ...base, state: 'invalid', reason: 'The ISS response did not contain trustworthy native altitude, velocity, footprint, timestamp, visibility, and kilometer-unit measurements.' }
  if (!supplementalContract) return { ...base, state: 'partial', reason: 'Supplemental orbital context is unavailable because day number or solar coordinates were missing or malformed.' }
  return { ...base, state: 'ready' }
}

const formatNumber = (value: number | undefined, maximumFractionDigits = 6) => value === undefined
  ? '—'
  : new Intl.NumberFormat('en', { maximumFractionDigits }).format(value)

const formatCoordinates = (latitude: number | undefined, longitude: number | undefined) => latitude === undefined || longitude === undefined
  ? '—'
  : `${formatNumber(latitude)}, ${formatNumber(longitude)}`

const titleCase = (value: string | undefined) => value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : '—'

export function IssPositionPreview({
  data,
  executedRequest,
}: {
  data: unknown
  executedRequest?: ExecutedRequestContext
}) {
  const model = buildIssPositionViewModel(data, executedRequest)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': 'exact-current-iss-position-get',
    'data-request-method': 'GET',
    'data-request-url': ISS_POSITION_URL,
    'data-identity-contract': String(model.identityContract),
    'data-position-contract': String(model.positionContract),
    'data-measurement-contract': String(model.measurementContract),
    'data-supplemental-contract': String(model.supplementalContract),
    'data-norad-id': model.id,
    'data-latitude': model.latitude,
    'data-longitude': model.longitude,
    'data-altitude': model.altitude,
    'data-velocity': model.velocity,
    'data-footprint': model.footprint,
    'data-timestamp': model.timestamp,
    'data-units': model.units,
    'data-visibility': model.visibility,
  }

  if (model.state === 'invalid') return <div className="domain-card domain-empty iss-position-preview" data-domain-card="iss-position" {...evidence}>
    <h3>ISS position evidence unavailable</h3>
    <p>{model.reason}</p>
  </div>

  return <div className="domain-card iss-position-preview" data-domain-card="iss-position" {...evidence}>
    <CardHeading
      eyebrow="Where The ISS At · Current orbital position"
      title="International Space Station"
      description="Request-bound current position and motion for NORAD satellite 25544."
    >
      <span className={`domain-state${model.state === 'partial' ? ' warning' : ''}`}>
        {model.state === 'partial' ? 'Validated position · Partial orbital context' : 'Validated current position'}
      </span>
    </CardHeading>
    {model.state === 'partial' && <p className="domain-note">{model.reason}</p>}
    <Facts items={[
      { label: 'NORAD ID', value: model.id },
      { label: 'Coordinates', value: formatCoordinates(model.latitude, model.longitude) },
      { label: 'Altitude', value: `${formatNumber(model.altitude, 3)} km` },
      { label: 'Velocity', value: `${formatNumber(model.velocity, 3)} km/h` },
      { label: 'Observed at', value: model.timestampIso ? <time dateTime={model.timestampIso}>{model.timestampIso}</time> : '—' },
      { label: 'Units', value: model.units ?? '—' },
      { label: 'Visibility', value: titleCase(model.visibility) },
      { label: 'Footprint', value: model.footprint === undefined ? '—' : `${formatNumber(model.footprint, 3)} km` },
      { label: 'Day number', value: formatNumber(model.daynum, 6) },
      { label: 'Solar coordinates', value: formatCoordinates(model.solarLatitude, model.solarLongitude) },
    ]}/>
    <p className="domain-note">Coordinates are WGS84 degrees. Altitude, velocity, and footprint use the provider-declared kilometer units; the observation time is the provider Unix timestamp rendered in UTC.</p>
  </div>
}
