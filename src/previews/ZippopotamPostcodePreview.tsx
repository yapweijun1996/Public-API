import type { CSSProperties } from 'react'
import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts } from './cardPrimitives'
import { finiteNumber, isRecord, optionalTrimmedText, trimmedText } from './semanticValidation'

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'
type ZippopotamRequest = { country: string; postalCode: string }
type ZippopotamPlace = {
  placeName: string
  state?: string
  stateAbbreviation?: string
  latitude: number
  longitude: number
  optionalMalformedCount: number
}

export type ZippopotamPostcodeViewModel = {
  state: ResultState
  reason?: string
  requestBound: boolean
  request?: ZippopotamRequest
  providerCountry?: string
  providerCountryAbbreviation?: string
  providerPostCode?: string
  providerPlaceCount: number
  validPlaceCount: number
  invalidPlaceCount: number
  duplicatePlaceCount: number
  optionalMalformedCount: number
  places: ZippopotamPlace[]
}

const ORIGIN = 'https://api.zippopotam.us'

const normalizePostCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, ' ')

export const parseZippopotamRequest = (api: ApiDemo, requestUrl?: string): ZippopotamRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.origin !== ORIGIN || url.username || url.password || url.hash || url.search) return undefined
    const segments = url.pathname.split('/')
    if (segments.length !== 3 || segments[0] !== '' || segments[1] === '' || segments[2] === '') return undefined
    const country = decodeURIComponent(segments[1])
    const postalCode = decodeURIComponent(segments[2]).trim()
    const countryField = api.fields.find((field) => field.id === 'country')
    const countryPattern = countryField?.pattern ? new RegExp(`^(?:${countryField.pattern})$`) : /^[A-Za-z]{2}$/
    if (!countryPattern.test(country) || country !== country.toLowerCase() || !postalCode) return undefined
    if (countryField?.minLength !== undefined && country.length < countryField.minLength) return undefined
    if (countryField?.maxLength !== undefined && country.length > countryField.maxLength) return undefined
    if (segments[1] !== encodeURIComponent(country) || segments[2] !== encodeURIComponent(postalCode)) return undefined
    const postalField = api.fields.find((field) => field.id === 'postalCode')
    if (postalField?.minLength !== undefined && postalCode.length < postalField.minLength) return undefined
    if (postalField?.maxLength !== undefined && postalCode.length > postalField.maxLength) return undefined
    return { country: country.toUpperCase(), postalCode }
  } catch {
    return undefined
  }
}

const resolveZippopotamRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext) => {
  const displayed = parseZippopotamRequest(api, requestUrl)
  if (requestUrl && !displayed) return { request: undefined, valid: false, bound: false } as const
  if (!executedRequest) return { request: displayed, valid: true, bound: false } as const
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined
    || (requestUrl !== undefined && requestUrl !== executedRequest.url)) return { request: undefined, valid: false, bound: false } as const
  const executed = parseZippopotamRequest(api, executedRequest.url)
  return executed ? { request: executed, valid: true, bound: true } as const : { request: undefined, valid: false, bound: false } as const
}

const providerCoordinate = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const parsed = Number(value.trim())
  return finiteNumber(parsed)
}

const parsePlace = (value: unknown): ZippopotamPlace | undefined => {
  if (!isRecord(value)) return undefined
  const placeName = trimmedText(value['place name'])
  const latitude = providerCoordinate(value.latitude)
  const longitude = providerCoordinate(value.longitude)
  if (!placeName || latitude === undefined || latitude < -90 || latitude > 90 || longitude === undefined || longitude < -180 || longitude > 180) return undefined
  const state = optionalTrimmedText(value.state)
  const stateAbbreviation = optionalTrimmedText(value['state abbreviation'])
  const optionalMalformedCount = Number(state.malformed) + Number(stateAbbreviation.malformed)
  return { placeName, state: state.value, stateAbbreviation: stateAbbreviation.value, latitude, longitude, optionalMalformedCount }
}

export const buildZippopotamPostcodeViewModel = (api: ApiDemo, data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): ZippopotamPostcodeViewModel => {
  const transport = resolveZippopotamRequest(api, requestUrl, executedRequest)
  const request = transport.request
  const base = { requestBound: transport.bound, request, providerPlaceCount: 0, validPlaceCount: 0, invalidPlaceCount: 0, duplicatePlaceCount: 0, optionalMalformedCount: 0, places: [] as ZippopotamPlace[] }
  if (!transport.valid || !request) return { ...base, state: 'invalid', reason: 'The executed request was not the exact supported bodyless GET Zippopotam.us postcode lookup, or it disagreed with the displayed request URL.' }
  if (!isRecord(data)) return { ...base, state: 'invalid', reason: 'The HTTP-success response was not a JSON object.' }

  const providerPostCode = trimmedText(data['post code'])
  const providerCountry = trimmedText(data.country)
  const providerCountryAbbreviation = trimmedText(data['country abbreviation'])
  const rawPlaces = data.places
  const providerPlaceCount = Array.isArray(rawPlaces) ? rawPlaces.length : 0
  const identityValid = Boolean(providerPostCode && normalizePostCode(providerPostCode) === normalizePostCode(request.postalCode)
    && providerCountry && providerCountryAbbreviation && /^[A-Za-z]{2}$/.test(providerCountryAbbreviation)
    && providerCountryAbbreviation.toUpperCase() === request.country)
  if (!identityValid || !Array.isArray(rawPlaces)) {
    return { ...base, providerCountry, providerCountryAbbreviation, providerPostCode, providerPlaceCount, state: 'invalid', reason: 'The response country, country abbreviation, postcode, or places envelope did not match the executed request.' }
  }
  if (rawPlaces.length === 0) return { ...base, providerCountry, providerCountryAbbreviation, providerPostCode, state: transport.bound ? 'empty' : 'partial', reason: transport.bound ? `Zippopotam.us returned no places for ${request.country}/${request.postalCode}.` : 'The response is structurally coherent, but executed transport identity is unavailable, so an empty result cannot be trusted as request-bound.' }

  const places: ZippopotamPlace[] = []
  const seen = new Set<string>()
  let invalidPlaceCount = 0
  let duplicatePlaceCount = 0
  let optionalMalformedCount = 0
  rawPlaces.forEach((rawPlace) => {
    const place = parsePlace(rawPlace)
    if (!place) { invalidPlaceCount += 1; return }
    const identity = `${place.placeName}\u0000${place.state ?? ''}\u0000${place.stateAbbreviation ?? ''}\u0000${place.latitude}\u0000${place.longitude}`
    if (seen.has(identity)) { invalidPlaceCount += 1; duplicatePlaceCount += 1; return }
    seen.add(identity)
    optionalMalformedCount += place.optionalMalformedCount
    places.push(place)
  })
  if (places.length === 0) return { ...base, providerCountry, providerCountryAbbreviation, providerPostCode, providerPlaceCount, invalidPlaceCount, duplicatePlaceCount, optionalMalformedCount, state: 'invalid', reason: 'Zippopotam.us returned places, but none had documented place names and coordinate strings.' }
  const partial = invalidPlaceCount > 0 || optionalMalformedCount > 0 || !transport.bound
  return {
    ...base,
    providerCountry,
    providerCountryAbbreviation,
    providerPostCode,
    providerPlaceCount,
    validPlaceCount: places.length,
    invalidPlaceCount,
    duplicatePlaceCount,
    optionalMalformedCount,
    places,
    state: partial ? 'partial' : 'ready',
    reason: !transport.bound
      ? 'The response is structurally useful, but executed transport identity is unavailable, so it cannot be marked ready.'
      : partial
        ? 'Only unique places with documented coordinate strings are shown; malformed or duplicate evidence was withheld.'
        : undefined,
  }
}

const formatCoordinate = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(value)

export function ZippopotamPostcodePreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildZippopotamPostcodeViewModel(api, data, requestUrl, executedRequest)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': 'exact-zippopotam-postcode-lookup',
    'data-requested-country': model.request?.country,
    'data-requested-postcode': model.request?.postalCode,
    'data-provider-country': model.providerCountry,
    'data-provider-country-abbreviation': model.providerCountryAbbreviation,
    'data-provider-postcode': model.providerPostCode,
    'data-provider-place-count': model.providerPlaceCount,
    'data-valid-place-count': model.validPlaceCount,
    'data-invalid-place-count': model.invalidPlaceCount,
    'data-duplicate-place-count': model.duplicatePlaceCount,
    'data-optional-malformed-count': model.optionalMalformedCount,
    'data-primary-place': model.places[0]?.placeName,
  }
  if (model.state === 'invalid' || model.state === 'empty' || model.places.length === 0) return <div className="domain-card domain-empty zippopotam-postcode-preview" data-domain-card="zippopotam-postcode" {...evidence}><h3>{model.state === 'empty' ? 'No places returned' : model.state === 'partial' ? 'Postcode evidence unbound' : 'Postcode evidence unavailable'}</h3><p>{model.reason}</p></div>

  const displayed = model.places.slice(0, 8)
  const lats = displayed.map((place) => place.latitude)
  const lons = displayed.map((place) => place.longitude)
  const latMin = Math.min(...lats); const latRange = Math.max(...lats) - latMin
  const lonMin = Math.min(...lons); const lonRange = Math.max(...lons) - lonMin
  const markerPosition = (place: ZippopotamPlace): CSSProperties => ({
    '--point-x': `${lonRange === 0 ? 50 : 10 + ((place.longitude - lonMin) / lonRange) * 80}%`,
    '--point-y': `${latRange === 0 ? 50 : 90 - ((place.latitude - latMin) / latRange) * 80}%`,
  } as CSSProperties)
  return <div className="domain-card zippopotam-postcode-preview" data-domain-card="zippopotam-postcode" {...evidence}>
    <CardHeading eyebrow="Zippopotam.us · Postal geolocation" title={`${model.validPlaceCount} place${model.validPlaceCount === 1 ? '' : 's'} for ${model.providerPostCode}`} description="Request-bound postcode location metadata and WGS84 coordinate context."><span className={`domain-state${model.state === 'partial' ? ' warning' : ''}`}>{model.state === 'partial' ? 'Partial validated result' : 'Validated result'}</span></CardHeading>
    {model.state === 'partial' && <p className="domain-note">{model.reason}</p>}
    <Facts items={[
      { label: 'Requested country', value: model.request?.country },
      { label: 'Provider country', value: `${model.providerCountry} (${model.providerCountryAbbreviation})` },
      { label: 'Postcode identity', value: model.providerPostCode },
      { label: 'Provider places', value: model.providerPlaceCount },
      { label: 'Validated places', value: model.validPlaceCount },
      { label: 'Withheld rows', value: model.invalidPlaceCount },
    ]}/>
    <div className="location-preview zippopotam-postcode-location-preview">
      <div className="location-map" role="img" aria-label={`Map with ${model.validPlaceCount} validated Zippopotam.us places`}><span className="map-compass">N</span>{displayed.map((place, index) => <i key={`${place.placeName}-${place.latitude}-${place.longitude}`} style={markerPosition(place)}><b>{index + 1}</b></i>)}</div>
      <ol aria-label="Validated Zippopotam.us places">{displayed.map((place, index) => <li key={`${place.placeName}-${place.latitude}-${place.longitude}`} data-place-name={place.placeName} data-latitude={place.latitude} data-longitude={place.longitude}><span>{index + 1}</span><div><strong>{place.placeName}</strong><small>{[place.state, place.stateAbbreviation, model.providerCountry].filter(Boolean).join(' · ') || 'Place metadata unavailable'}</small><small>{formatCoordinate(place.latitude)}, {formatCoordinate(place.longitude)}</small></div></li>)}</ol>
    </div>
    {model.validPlaceCount > displayed.length && <p className="domain-note">Showing {displayed.length} of {model.validPlaceCount} validated provider places.</p>}
    <p className="domain-note">Zippopotam.us documents latitude and longitude as decimal JSON strings. This card parses those strings as finite WGS84 coordinates and does not claim street-address precision.</p>
  </div>
}
