import type { CSSProperties } from 'react'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts } from './cardPrimitives'
import { finiteNumber, isRecord, nonNegativeSafeInteger, trimmedText } from './semanticValidation'

export const DATA_GOV_TAXI_AVAILABILITY_URL = 'https://api.data.gov.sg/v1/transport/taxi-availability'

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'
type TaxiCoordinate = { longitude: number; latitude: number }

export type DataGovTaxiAvailabilityViewModel = {
  state: ResultState
  reason?: string
  requestBound: boolean
  envelopeContract: boolean
  countContract: boolean
  timestampContract: boolean
  coordinateContract: boolean
  timestamp?: string
  taxiCount?: number
  providerCoordinateCount: number
  validCoordinateCount: number
  invalidCoordinateCount: number
  coordinates: TaxiCoordinate[]
}

const exactRequest = (request?: ExecutedRequestContext) => {
  if (!request || request.method !== 'GET' || request.body !== undefined) return false
  try {
    const url = new URL(request.url)
    return url.protocol === 'https:'
      && url.origin === 'https://api.data.gov.sg'
      && url.pathname === '/v1/transport/taxi-availability'
      && url.search === ''
      && url.hash === ''
      && url.username === ''
      && url.password === ''
      && request.url === DATA_GOV_TAXI_AVAILABILITY_URL
  } catch {
    return false
  }
}

const parseDateTime = (value: unknown) => {
  const text = trimmedText(value)
  if (!text) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(text)
  if (!match) return undefined
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const calendarValid = calendar.getUTCFullYear() === year
    && calendar.getUTCMonth() === month - 1
    && calendar.getUTCDate() === day
    && calendar.getUTCHours() === hour
    && calendar.getUTCMinutes() === minute
    && calendar.getUTCSeconds() === second
  const offsetValid = offsetHourText === undefined
    || (Number(offsetHourText) <= 23 && Number(offsetMinuteText) <= 59)
  return calendarValid && offsetValid && Number.isFinite(Date.parse(text)) ? text : undefined
}

const parseCoordinate = (value: unknown): TaxiCoordinate | undefined => {
  if (!Array.isArray(value) || value.length !== 2) return undefined
  const longitude = finiteNumber(value[0])
  const latitude = finiteNumber(value[1])
  if (longitude === undefined || longitude < -180 || longitude > 180
    || latitude === undefined || latitude < -90 || latitude > 90) return undefined
  return { longitude, latitude }
}

export const buildDataGovTaxiAvailabilityViewModel = (
  data: unknown,
  executedRequest?: ExecutedRequestContext,
): DataGovTaxiAvailabilityViewModel => {
  const requestBound = exactRequest(executedRequest)
  const root = isRecord(data) ? data : undefined
  const features = root && Array.isArray(root.features) ? root.features : undefined
  const feature = features?.length === 1 && isRecord(features[0]) ? features[0] : undefined
  const geometry = feature && isRecord(feature.geometry) ? feature.geometry : undefined
  const properties = feature && isRecord(feature.properties) ? feature.properties : undefined
  const rawCoordinates = geometry && Array.isArray(geometry.coordinates) ? geometry.coordinates : undefined
  const providerCoordinateCount = rawCoordinates?.length ?? 0
  const envelopeContract = root?.type === 'FeatureCollection'
    && features?.length === 1
    && feature?.type === 'Feature'
    && geometry?.type === 'MultiPoint'
    && rawCoordinates !== undefined
    && properties !== undefined
  const timestamp = properties ? parseDateTime(properties.timestamp) : undefined
  const taxiCount = properties ? nonNegativeSafeInteger(properties.taxi_count) : undefined
  const timestampContract = timestamp !== undefined
  const countContract = taxiCount !== undefined && taxiCount === providerCoordinateCount
  const coordinates = rawCoordinates?.map(parseCoordinate).filter((coordinate): coordinate is TaxiCoordinate => Boolean(coordinate)) ?? []
  const validCoordinateCount = coordinates.length
  const invalidCoordinateCount = providerCoordinateCount - validCoordinateCount
  const coordinateContract = rawCoordinates !== undefined && invalidCoordinateCount === 0
  const base = {
    requestBound,
    envelopeContract,
    countContract,
    timestampContract,
    coordinateContract,
    timestamp,
    taxiCount,
    providerCoordinateCount,
    validCoordinateCount,
    invalidCoordinateCount,
    coordinates,
  }

  if (!requestBound) return { ...base, state: 'invalid', reason: 'The response was not tied to the exact supported latest taxi-availability GET request.' }
  if (!envelopeContract) return { ...base, state: 'invalid', reason: 'The HTTP-success payload was not the documented single-feature GeoJSON MultiPoint envelope.' }
  if (!timestampContract) return { ...base, state: 'invalid', reason: 'The taxi feature did not contain a parseable provider acquisition timestamp.' }
  if (!countContract) return { ...base, state: 'invalid', reason: 'The native taxi_count did not exactly match the provider coordinate-array length.' }
  if (taxiCount === 0) {
    if (!coordinateContract) return { ...base, state: 'invalid', reason: 'A zero-taxi response must contain an empty, fully valid coordinate array.' }
    return { ...base, state: 'empty', reason: 'data.gov.sg returned a coherent zero-taxi availability snapshot.' }
  }
  if (validCoordinateCount === 0) return { ...base, state: 'invalid', reason: 'The provider returned taxi positions, but none were exact native-number longitude/latitude pairs.' }
  if (!coordinateContract) return { ...base, state: 'partial', reason: 'Malformed taxi positions were withheld; the provider count and acquisition timestamp remain visible with a partial-state warning.' }
  return { ...base, state: 'ready' }
}

const formatCoordinate = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(value)

export function DataGovTaxiAvailabilityPreview({
  data,
  executedRequest,
}: {
  data: unknown
  executedRequest?: ExecutedRequestContext
}) {
  const model = buildDataGovTaxiAvailabilityViewModel(data, executedRequest)
  const sample = model.coordinates.slice(0, 8)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': 'exact-data-gov-sg-latest-taxi-availability',
    'data-envelope-contract': String(model.envelopeContract),
    'data-count-contract': String(model.countContract),
    'data-timestamp-contract': String(model.timestampContract),
    'data-coordinate-contract': String(model.coordinateContract),
    'data-taxi-count': model.taxiCount,
    'data-provider-coordinate-count': model.providerCoordinateCount,
    'data-valid-coordinate-count': model.validCoordinateCount,
    'data-invalid-coordinate-count': model.invalidCoordinateCount,
    'data-acquisition-timestamp': model.timestamp,
    'data-sample-coordinate-count': sample.length,
  }

  if (model.state === 'invalid') return <div className="domain-card domain-empty data-gov-taxi-preview" data-domain-card="data-gov-taxi-availability" {...evidence}>
    <h3>Taxi availability evidence unavailable</h3>
    <p>{model.reason}</p>
  </div>

  const lats = sample.map((coordinate) => coordinate.latitude)
  const lons = sample.map((coordinate) => coordinate.longitude)
  const latMin = sample.length ? Math.min(...lats) : 0
  const lonMin = sample.length ? Math.min(...lons) : 0
  const latRange = sample.length ? Math.max(...lats) - latMin : 0
  const lonRange = sample.length ? Math.max(...lons) - lonMin : 0
  const markerPosition = (coordinate: TaxiCoordinate): CSSProperties => ({
    '--point-x': `${lonRange === 0 ? 50 : 10 + ((coordinate.longitude - lonMin) / lonRange) * 80}%`,
    '--point-y': `${latRange === 0 ? 50 : 90 - ((coordinate.latitude - latMin) / latRange) * 80}%`,
  } as CSSProperties)

  return <div className="domain-card data-gov-taxi-preview" data-domain-card="data-gov-taxi-availability" {...evidence}>
    <CardHeading
      eyebrow="data.gov.sg · Latest taxi availability"
      title={`${model.taxiCount?.toLocaleString('en')} available taxis`}
      description="Anonymous availability positions in the latest data.gov.sg acquisition snapshot."
    >
      <span className={`domain-state${model.state === 'partial' ? ' warning' : ''}`}>
        {model.state === 'empty' ? 'No taxis available' : model.state === 'partial' ? 'Partial validated snapshot' : 'Validated snapshot'}
      </span>
    </CardHeading>
    {model.state === 'partial' && <p className="domain-note">{model.reason}</p>}
    <Facts items={[
      { label: 'Available taxis', value: model.taxiCount?.toLocaleString('en') },
      { label: 'data.gov.sg acquisition time', value: model.timestamp },
      { label: 'Validated positions', value: model.validCoordinateCount.toLocaleString('en') },
      { label: 'Withheld positions', value: model.invalidCoordinateCount.toLocaleString('en') },
    ]}/>
    {model.state === 'empty' ? <p className="domain-note">No anonymous taxi positions were present in this coherent provider snapshot.</p> : <div className="location-preview taxi-availability-sample">
      <div className="location-map" role="img" aria-label={`Map sample of ${sample.length} anonymous available taxi positions`}>
        <span className="map-compass">N</span>
        {sample.map((coordinate, index) => <i key={`${coordinate.longitude}-${coordinate.latitude}-${index}`} style={markerPosition(coordinate)}><b>{index + 1}</b></i>)}
      </div>
      <ol className="taxi-position-list earthquake-list" aria-label="Anonymous taxi position sample">
        {sample.map((coordinate, index) => <li key={`${coordinate.longitude}-${coordinate.latitude}-${index}`} data-sample-index={index + 1} data-longitude={coordinate.longitude} data-latitude={coordinate.latitude}>
          <span>{index + 1}</span>
          <div><strong>Anonymous position {index + 1}</strong><small>{formatCoordinate(coordinate.latitude)}, {formatCoordinate(coordinate.longitude)}</small></div>
        </li>)}
      </ol>
    </div>}
    <p className="domain-note">The timestamp is data.gov.sg’s acquisition/scrape time, not a per-taxi observation time. Positions are anonymous availability points, not stable taxi identities. The map/list shows at most 8 positions; the count covers the complete validated provider snapshot.</p>
  </div>
}
