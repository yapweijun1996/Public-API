import type { CSSProperties } from 'react'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts } from './cardPrimitives'
import { formatNumber } from './previewData'
import { finiteNumber, isRecord, nonNegativeSafeInteger, optionalTrimmedText, trimmedText } from './semanticValidation'

export const USGS_EARTHQUAKE_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'

type Earthquake = {
  id: string
  magnitude: number
  place: string
  time: number
  updated: number
  status: string
  title?: string
  longitude: number
  latitude: number
  depthKm: number
}

type EarthquakeMetadata = {
  generated: number
  url: string
  title: string
  api: string
  count: number
  status: number
}

export type UsgsEarthquakeViewModel = {
  state: ResultState
  reason?: string
  requestBound: boolean
  envelopeContract: boolean
  metadataContract: boolean
  countContract: boolean
  rowIdentityContract: boolean
  geometryContract: boolean
  nativeNumberContract: boolean
  metadata?: EarthquakeMetadata
  providerFeatureCount: number
  validRecordCount: number
  invalidRecordCount: number
  optionalIssueCount: number
  earthquakes: Earthquake[]
}

const timestamp = (value: unknown) => {
  const parsed = nonNegativeSafeInteger(value)
  return parsed !== undefined && Number.isFinite(new Date(parsed).getTime()) ? parsed : undefined
}

const exactRequest = (request?: ExecutedRequestContext) => Boolean(
  request
  && request.method === 'GET'
  && request.url === USGS_EARTHQUAKE_FEED_URL
  && request.body === undefined,
)

const parseMetadata = (value: unknown): EarthquakeMetadata | undefined => {
  if (!isRecord(value)) return undefined
  const generated = timestamp(value.generated)
  const url = trimmedText(value.url)
  const title = trimmedText(value.title)
  const api = trimmedText(value.api)
  const count = nonNegativeSafeInteger(value.count)
  const status = nonNegativeSafeInteger(value.status)
  if (generated === undefined || url !== USGS_EARTHQUAKE_FEED_URL || !title || !api || count === undefined || status !== 200) return undefined
  return { generated, url, title, api, count, status }
}

type ParsedEarthquake = {
  earthquake?: Earthquake
  geometryValid: boolean
  nativeNumbersValid: boolean
  optionalIssue: boolean
}

const parseEarthquake = (value: unknown, seenIds: Set<string>): ParsedEarthquake => {
  if (!isRecord(value)) return { geometryValid: false, nativeNumbersValid: false, optionalIssue: false }
  const id = trimmedText(value.id)
  const duplicate = Boolean(id && seenIds.has(id))
  if (id) seenIds.add(id)
  const properties = isRecord(value.properties) ? value.properties : undefined
  const geometry = isRecord(value.geometry) ? value.geometry : undefined
  const coordinates = geometry && Array.isArray(geometry.coordinates) ? geometry.coordinates : undefined
  const magnitude = finiteNumber(properties?.mag)
  const longitude = coordinates ? finiteNumber(coordinates[0]) : undefined
  const latitude = coordinates ? finiteNumber(coordinates[1]) : undefined
  const depthKm = coordinates ? finiteNumber(coordinates[2]) : undefined
  const nativeNumbersValid = magnitude !== undefined
    && magnitude >= 2.5
    && longitude !== undefined
    && longitude >= -180
    && longitude <= 180
    && latitude !== undefined
    && latitude >= -90
    && latitude <= 90
    && depthKm !== undefined
    && depthKm >= -100
    && depthKm <= 1000
  const geometryValid = geometry?.type === 'Point' && coordinates?.length === 3 && nativeNumbersValid
  const place = trimmedText(properties?.place)
  const eventTime = timestamp(properties?.time)
  const updated = timestamp(properties?.updated)
  const status = trimmedText(properties?.status)
  const optionalTitle = optionalTrimmedText(properties?.title)
  const identityValid = value.type === 'Feature'
    && Boolean(id)
    && !duplicate
    && Boolean(properties)
    && Boolean(place)
    && eventTime !== undefined
    && updated !== undefined
    && updated >= eventTime
    && Boolean(status)
  if (!identityValid || !geometryValid || !id || !place || eventTime === undefined || updated === undefined || !status
    || magnitude === undefined || longitude === undefined || latitude === undefined || depthKm === undefined) {
    return { geometryValid, nativeNumbersValid, optionalIssue: optionalTitle.malformed }
  }
  return {
    earthquake: {
      id,
      magnitude,
      place,
      time: eventTime,
      updated,
      status,
      title: optionalTitle.value,
      longitude,
      latitude,
      depthKm,
    },
    geometryValid,
    nativeNumbersValid,
    optionalIssue: optionalTitle.malformed,
  }
}

export function buildUsgsEarthquakeViewModel(data: unknown, request?: ExecutedRequestContext): UsgsEarthquakeViewModel {
  const requestBound = exactRequest(request)
  const envelopeContract = isRecord(data)
    && data.type === 'FeatureCollection'
    && isRecord(data.metadata)
    && Array.isArray(data.features)
  const features = envelopeContract ? data.features as unknown[] : []
  const metadata = envelopeContract ? parseMetadata(data.metadata) : undefined
  const metadataContract = metadata !== undefined
  const countContract = Boolean(metadata && metadata.count === features.length)
  const invalidBase = {
    requestBound,
    envelopeContract,
    metadataContract,
    countContract,
    rowIdentityContract: false,
    geometryContract: false,
    nativeNumberContract: false,
    metadata,
    providerFeatureCount: features.length,
    validRecordCount: 0,
    invalidRecordCount: features.length,
    optionalIssueCount: 0,
    earthquakes: [],
  }

  if (!requestBound) return { ...invalidBase, state: 'invalid', reason: 'The executed request is not the exact supported USGS M2.5+ past-day GeoJSON GET request.' }
  if (!envelopeContract) return { ...invalidBase, state: 'invalid', reason: 'The HTTP-success payload is not the documented USGS FeatureCollection envelope.' }
  if (!metadataContract) return { ...invalidBase, state: 'invalid', reason: 'USGS metadata does not contain the documented generated, URL, title, API, count, and HTTP status evidence.' }
  if (!countContract) return { ...invalidBase, state: 'invalid', reason: 'USGS metadata.count does not match the provider features array length.' }
  if (metadata.count === 0) return {
    ...invalidBase,
    state: 'empty',
    rowIdentityContract: true,
    geometryContract: true,
    nativeNumberContract: true,
    invalidRecordCount: 0,
    reason: 'No M2.5+ earthquakes were present in the valid past-day feed.',
  }

  const seenIds = new Set<string>()
  const earthquakes: Earthquake[] = []
  let invalidRecordCount = 0
  let optionalIssueCount = 0
  let geometryContract = true
  let nativeNumberContract = true
  for (const feature of features) {
    const parsed = parseEarthquake(feature, seenIds)
    geometryContract = geometryContract && parsed.geometryValid
    nativeNumberContract = nativeNumberContract && parsed.nativeNumbersValid
    if (parsed.optionalIssue) optionalIssueCount += 1
    if (parsed.earthquake) earthquakes.push(parsed.earthquake)
    else invalidRecordCount += 1
  }

  const validRecordCount = earthquakes.length
  const rowIdentityContract = invalidRecordCount === 0
  if (validRecordCount === 0) return {
    state: 'invalid',
    reason: 'USGS returned features, but none had trustworthy event identity, native measurements, timestamps, and Point geometry.',
    requestBound,
    envelopeContract,
    metadataContract,
    countContract,
    rowIdentityContract,
    geometryContract,
    nativeNumberContract,
    metadata,
    providerFeatureCount: features.length,
    validRecordCount,
    invalidRecordCount,
    optionalIssueCount,
    earthquakes,
  }

  const partial = invalidRecordCount > 0 || optionalIssueCount > 0
  return {
    state: partial ? 'partial' : 'ready',
    reason: partial ? 'Only strictly validated USGS earthquake rows are shown; malformed rows and malformed optional titles are withheld.' : undefined,
    requestBound,
    envelopeContract,
    metadataContract,
    countContract,
    rowIdentityContract,
    geometryContract,
    nativeNumberContract,
    metadata,
    providerFeatureCount: features.length,
    validRecordCount,
    invalidRecordCount,
    optionalIssueCount,
    earthquakes,
  }
}

const eventTime = (milliseconds: number) => new Date(milliseconds).toISOString()

export function UsgsEarthquakePreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const model = buildUsgsEarthquakeViewModel(data, executedRequest)
  const displayed = model.earthquakes.slice(0, 8)
  const latitudes = displayed.map((event) => event.latitude)
  const longitudes = displayed.map((event) => event.longitude)
  const latitudeMin = latitudes.length ? Math.min(...latitudes) : 0
  const longitudeMin = longitudes.length ? Math.min(...longitudes) : 0
  const latitudeRange = latitudes.length ? Math.max(...latitudes) - latitudeMin || 1 : 1
  const longitudeRange = longitudes.length ? Math.max(...longitudes) - longitudeMin || 1 : 1
  const primary = model.earthquakes[0]
  const generated = model.metadata ? eventTime(model.metadata.generated) : undefined
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-method': model.requestBound ? 'GET' : undefined,
    'data-request-url': model.requestBound ? USGS_EARTHQUAKE_FEED_URL : undefined,
    'data-envelope-contract': String(model.envelopeContract),
    'data-metadata-contract': String(model.metadataContract),
    'data-count-contract': String(model.countContract),
    'data-row-identity-contract': String(model.rowIdentityContract),
    'data-geometry-contract': String(model.geometryContract),
    'data-native-number-contract': String(model.nativeNumberContract),
    'data-provider-count': model.metadata?.count,
    'data-provider-feature-count': model.providerFeatureCount,
    'data-valid-record-count': model.validRecordCount,
    'data-invalid-record-count': model.invalidRecordCount,
    'data-optional-issue-count': model.optionalIssueCount,
    'data-displayed-record-count': displayed.length,
    'data-feed-generated': generated,
    'data-feed-url': model.metadata?.url,
    'data-feed-api-version': model.metadata?.api,
    'data-primary-event-id': primary?.id,
    'data-primary-magnitude': primary?.magnitude,
    'data-primary-longitude': primary?.longitude,
    'data-primary-latitude': primary?.latitude,
    'data-primary-depth-km': primary?.depthKm,
    'data-primary-event-time': primary ? eventTime(primary.time) : undefined,
  }

  return <div className="domain-card usgs-earthquake-preview" data-domain-card="usgs-earthquake-feed" {...evidence}>
    {model.state === 'invalid' ? <div className="domain-empty"><h3>USGS earthquake evidence unavailable</h3><p>{model.reason}</p></div> : null}
    {model.state === 'empty' ? <div className="domain-empty"><h3>No M2.5+ earthquakes returned</h3><p>{model.reason}</p></div> : null}
    {model.earthquakes.length ? <>
      <CardHeading
        eyebrow="USGS Earthquake Hazards Program · M2.5+ past day"
        title={`${model.validRecordCount} validated earthquake${model.validRecordCount === 1 ? '' : 's'}`}
        description={`${model.metadata?.title}. Generated ${generated}.`}
      ><span className={`domain-state${model.state === 'partial' ? ' warning' : ''}`}>{model.state === 'partial' ? 'Partial validated feed' : 'Validated feed'}</span></CardHeading>
      <Facts items={[
        { label: 'Provider features', value: model.providerFeatureCount.toLocaleString('en') },
        { label: 'Validated events', value: model.validRecordCount.toLocaleString('en') },
        { label: 'Withheld events', value: model.invalidRecordCount.toLocaleString('en') },
        { label: 'Feed API', value: model.metadata?.api ?? 'Unavailable' },
      ]}/>
      {model.state === 'partial' ? <p className="domain-note">{model.reason} {model.optionalIssueCount ? `${model.optionalIssueCount} optional title value${model.optionalIssueCount === 1 ? ' was' : 's were'} malformed.` : ''}</p> : null}
      <div className="location-preview">
        <div className="location-map" role="img" aria-label={`Map with ${displayed.length} validated USGS earthquake ${displayed.length === 1 ? 'location' : 'locations'}`}>
          <span className="map-compass">N</span>
          {displayed.map((event, index) => <i key={event.id} style={{ '--point-x': `${10 + ((event.longitude - longitudeMin) / longitudeRange) * 80}%`, '--point-y': `${90 - ((event.latitude - latitudeMin) / latitudeRange) * 80}%` } as CSSProperties}><b>{index + 1}</b></i>)}
        </div>
        <ol className="earthquake-list" aria-label="Validated USGS earthquake evidence">
          {displayed.map((event, index) => <li
            key={event.id}
            data-event-id={event.id}
            data-magnitude={event.magnitude}
            data-place={event.place}
            data-event-time={eventTime(event.time)}
            data-updated-time={eventTime(event.updated)}
            data-status={event.status}
            data-longitude={event.longitude}
            data-latitude={event.latitude}
            data-depth-km={event.depthKm}
          >
            <span>{index + 1}</span>
            <div><strong>M {formatNumber(event.magnitude, 2)} · {event.place}</strong><small><time dateTime={eventTime(event.time)}>{eventTime(event.time)}</time> · {formatNumber(event.depthKm, 2)} km deep · {event.status}</small><small>{formatNumber(event.latitude, 4)}, {formatNumber(event.longitude, 4)} · USGS ID {event.id}</small></div>
          </li>)}
        </ol>
      </div>
      {model.validRecordCount > displayed.length ? <p className="domain-note">Showing the first {displayed.length} of {model.validRecordCount.toLocaleString('en')} validated events; provider and validation counts cover the complete feed.</p> : null}
    </> : null}
  </div>
}
