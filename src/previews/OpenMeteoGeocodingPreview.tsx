import type { CSSProperties } from 'react'
import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts } from './cardPrimitives'
import { finiteNumber, isRecord, nonNegativeSafeInteger, optionalTrimmedText, positiveSafeInteger, trimmedText } from './semanticValidation'

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'
type GeocodingRequest = { name: string; count: number }
type GeocodingPlace = {
  id: number; name: string; latitude: number; longitude: number
  featureCode?: string; country?: string; countryCode?: string; timezone?: string
  elevation?: number; population?: number; postcodes: string[]
}

export type OpenMeteoGeocodingViewModel = {
  state: ResultState; reason?: string; requestBound: boolean; request?: GeocodingRequest
  providerRecordCount: number; validRecordCount: number; invalidRecordCount: number
  duplicateRecordCount: number; overflowRecordCount: number; generationTimeMs?: number
  places: GeocodingPlace[]
}

export const parseOpenMeteoGeocodingRequest = (api: ApiDemo, requestUrl?: string): GeocodingRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.origin !== 'https://geocoding-api.open-meteo.com' || url.pathname !== '/v1/search' || url.username || url.password || url.hash) return undefined
    const entries = [...url.searchParams.entries()]
    const allowed = new Set(['name', 'count', 'language', 'format'])
    if (entries.length !== 4 || entries.some(([key]) => !allowed.has(key)) || [...allowed].some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    const name = url.searchParams.get('name') ?? ''
    const countText = url.searchParams.get('count') ?? ''
    const nameField = api.fields.find((field) => field.id === 'name')
    const countField = api.fields.find((field) => field.id === 'count')
    const count = /^\d+$/.test(countText) ? Number(countText) : Number.NaN
    const exactName = name !== '' && name === name.trim()
      && (nameField?.minLength === undefined || name.length >= nameField.minLength)
      && (nameField?.maxLength === undefined || name.length <= nameField.maxLength)
    const exactCount = Number.isSafeInteger(count) && String(count) === countText
      && (countField?.min === undefined || count >= countField.min)
      && (countField?.max === undefined || count <= countField.max)
      && (countField?.step === undefined || (count - (countField.min ?? 0)) % countField.step === 0)
    if (!exactName || !exactCount || url.searchParams.get('language') !== 'en' || url.searchParams.get('format') !== 'json') return undefined
    return { name, count }
  } catch { return undefined }
}

const resolveGeocodingRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext) => {
  const displayed = parseOpenMeteoGeocodingRequest(api, requestUrl)
  if (requestUrl && !displayed) return { request: undefined, valid: false, bound: false } as const
  if (!executedRequest) return { request: displayed, valid: true, bound: false } as const
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined
    || (requestUrl !== undefined && requestUrl !== executedRequest.url)) return { request: undefined, valid: false, bound: false } as const
  const executed = parseOpenMeteoGeocodingRequest(api, executedRequest.url)
  return executed ? { request: executed, valid: true, bound: true } as const : { request: undefined, valid: false, bound: false } as const
}

const parsePlace = (value: unknown): GeocodingPlace | undefined => {
  if (!isRecord(value)) return undefined
  const id = positiveSafeInteger(value.id)
  const name = trimmedText(value.name)
  const latitude = finiteNumber(value.latitude)
  const longitude = finiteNumber(value.longitude)
  if (!id || !name || latitude === undefined || latitude < -90 || latitude > 90 || longitude === undefined || longitude < -180 || longitude > 180) return undefined
  const featureCode = optionalTrimmedText(value.feature_code)
  const country = optionalTrimmedText(value.country)
  const countryCode = optionalTrimmedText(value.country_code)
  const timezone = optionalTrimmedText(value.timezone)
  const elevation = value.elevation === undefined || value.elevation === null ? undefined : finiteNumber(value.elevation)
  const population = value.population === undefined || value.population === null ? undefined : nonNegativeSafeInteger(value.population)
  if (featureCode.malformed || country.malformed || countryCode.malformed || timezone.malformed
    || (value.elevation !== undefined && value.elevation !== null && elevation === undefined)
    || (value.population !== undefined && value.population !== null && population === undefined)) return undefined
  if (countryCode.value && !/^[A-Z]{2}$/.test(countryCode.value)) return undefined
  let postcodes: string[] = []
  if (value.postcodes !== undefined && value.postcodes !== null) {
    if (!Array.isArray(value.postcodes)) return undefined
    postcodes = value.postcodes.map(trimmedText).filter((item): item is string => Boolean(item))
    if (postcodes.length !== value.postcodes.length) return undefined
  }
  return { id, name, latitude, longitude, featureCode: featureCode.value, country: country.value, countryCode: countryCode.value, timezone: timezone.value, elevation, population, postcodes }
}

export const buildOpenMeteoGeocodingViewModel = (api: ApiDemo, data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): OpenMeteoGeocodingViewModel => {
  const transport = resolveGeocodingRequest(api, requestUrl, executedRequest)
  const request = transport.request
  const root = isRecord(data) ? data : undefined
  const generationTimeMs = root ? finiteNumber(root.generationtime_ms) : undefined
  const rawResults = root?.results
  const rows = Array.isArray(rawResults) ? rawResults : rawResults === undefined ? [] : undefined
  const providerRecordCount = rows?.length ?? 0
  const base = { requestBound: transport.bound, request, providerRecordCount, validRecordCount: 0, invalidRecordCount: providerRecordCount, duplicateRecordCount: 0, overflowRecordCount: 0, generationTimeMs, places: [] as GeocodingPlace[] }
  if (!transport.valid || !request) return { ...base, state: 'invalid', reason: 'The executed request was not the exact supported bodyless GET Open-Meteo geocoding request, or it disagreed with the displayed request URL.' }
  if (!root || rows === undefined || generationTimeMs === undefined || generationTimeMs < 0) return { ...base, state: 'invalid', reason: 'The HTTP-success response did not match the documented Open-Meteo geocoding envelope.' }
  if (rows.length === 0) return { ...base, state: transport.bound ? 'empty' : 'partial', invalidRecordCount: 0, reason: transport.bound ? `Open-Meteo returned no location matches for “${request.name}”.` : 'The response is structurally coherent, but executed transport identity is unavailable, so an empty result cannot be trusted as request-bound.' }
  const seenIds = new Set<number>()
  const places: GeocodingPlace[] = []
  let invalidRecordCount = 0, duplicateRecordCount = 0, overflowRecordCount = 0
  rows.forEach((row, index) => {
    if (index >= request.count) { invalidRecordCount += 1; overflowRecordCount += 1; return }
    const place = parsePlace(row)
    if (!place) { invalidRecordCount += 1; return }
    if (seenIds.has(place.id)) { invalidRecordCount += 1; duplicateRecordCount += 1; return }
    seenIds.add(place.id); places.push(place)
  })
  if (places.length === 0) return { ...base, state: 'invalid', reason: 'Open-Meteo returned location rows, but none had a unique documented location ID plus native WGS84 coordinates.', invalidRecordCount, duplicateRecordCount, overflowRecordCount, places }
  const partial = invalidRecordCount > 0 || !transport.bound
  const reason = !transport.bound
    ? 'The response is structurally useful, but executed transport identity is unavailable, so it cannot be marked ready.'
    : invalidRecordCount > 0
      ? 'Only rows with a unique provider location ID and valid documented fields are shown; malformed, duplicate, or over-limit rows are withheld.'
      : undefined
  return { ...base, state: partial ? 'partial' : 'ready', reason, validRecordCount: places.length, invalidRecordCount, duplicateRecordCount, overflowRecordCount, places }
}

const formatCoordinate = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 5 }).format(value)

export function OpenMeteoGeocodingPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildOpenMeteoGeocodingViewModel(api, data, requestUrl, executedRequest)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': 'exact-open-meteo-geocoding',
    'data-request-name': model.request?.name,
    'data-request-count': model.request?.count,
    'data-provider-record-count': model.providerRecordCount,
    'data-valid-record-count': model.validRecordCount,
    'data-invalid-record-count': model.invalidRecordCount,
    'data-duplicate-record-count': model.duplicateRecordCount,
    'data-overflow-record-count': model.overflowRecordCount,
    'data-primary-location-id': model.places[0]?.id,
    'data-identity-field': 'id',
  }
  if (model.state === 'invalid' || model.state === 'empty') return <div className="domain-card domain-empty open-meteo-geocoding-preview" data-domain-card="open-meteo-geocoding" {...evidence}><h3>{model.state === 'empty' ? 'No locations returned' : 'Geocoding evidence unavailable'}</h3><p>{model.reason}</p></div>

  const lats = model.places.map((place) => place.latitude)
  const lons = model.places.map((place) => place.longitude)
  const latMin = Math.min(...lats); const latRawRange = Math.max(...lats) - latMin
  const lonMin = Math.min(...lons); const lonRawRange = Math.max(...lons) - lonMin
  const markerPosition = (place: GeocodingPlace): CSSProperties => ({
    '--point-x': `${lonRawRange === 0 ? 50 : 10 + ((place.longitude - lonMin) / lonRawRange) * 80}%`,
    '--point-y': `${latRawRange === 0 ? 50 : 90 - ((place.latitude - latMin) / latRawRange) * 80}%`,
  } as CSSProperties)

  return <div className="domain-card open-meteo-geocoding-preview" data-domain-card="open-meteo-geocoding" {...evidence}>
    <CardHeading eyebrow="Open-Meteo · GeoNames location search" title={`${model.validRecordCount} validated location${model.validRecordCount === 1 ? '' : 's'}`} description={`Place/postal-code search for “${model.request?.name}”.`}><span className={`domain-state${model.state === 'partial' ? ' warning' : ''}`}>{model.state === 'partial' ? 'Partial validated batch' : 'Validated batch'}</span></CardHeading>
    {model.state === 'partial' && <p className="domain-note">{model.reason}</p>}
    <Facts items={[
      { label: 'Requested search', value: model.request?.name },
      { label: 'Requested limit', value: model.request?.count },
      { label: 'Provider rows', value: model.providerRecordCount },
      { label: 'Validated rows', value: model.validRecordCount },
      { label: 'Withheld rows', value: model.invalidRecordCount },
      { label: 'Location identity', value: 'Open-Meteo location ID' },
    ]}/>
    <div className="location-preview">
      <div className="location-map" role="img" aria-label={`Map with ${model.validRecordCount} validated Open-Meteo locations`}><span className="map-compass">N</span>{model.places.map((place, index) => <i key={place.id} style={markerPosition(place)}><b>{index + 1}</b></i>)}</div>
      <ol className="geocoding-list" aria-label="Validated Open-Meteo geocoding results">{model.places.map((place, index) => <li key={place.id} data-location-id={place.id} data-latitude={place.latitude} data-longitude={place.longitude}><span>{index + 1}</span><div><strong>{place.name}</strong><small>{[place.country, place.countryCode, place.timezone].filter(Boolean).join(' · ') || 'Location metadata unavailable'}</small><small>{formatCoordinate(place.latitude)}, {formatCoordinate(place.longitude)}{place.population !== undefined ? ` · population ${place.population.toLocaleString('en')}` : ''}</small></div></li>)}</ol>
    </div>
    <p className="domain-note">Location data is based on GeoNames. This workbench supports place names and postal codes; it does not claim street-address geocoding.</p>
  </div>
}
