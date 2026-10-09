import type { CSSProperties } from 'react'
import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts } from './cardPrimitives'
import { finiteNumber, isRecord, optionalTrimmedText, trimmedText } from './semanticValidation'

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'
type BreweryRequest = { country: string; type: string; limit: number }
type BreweryRequestIdentity = { request?: BreweryRequest; transportBound: boolean; invalidReason?: string }
type Brewery = {
  id: string
  name: string
  breweryType: string
  city: string
  stateProvince: string
  postalCode: string
  country: string
  latitude?: number
  longitude?: number
  address?: string
  phone?: string
  websiteUrl?: string
  optionalMalformedCount: number
}

export type OpenBreweryDirectoryViewModel = {
  state: ResultState
  reason?: string
  requestBound: boolean
  request?: BreweryRequest
  providerCount: number
  validCount: number
  invalidCount: number
  duplicateCount: number
  coordinateCount: number
  optionalMalformedCount: number
  breweries: Brewery[]
}

const ORIGIN = 'https://api.openbrewerydb.org'
const LIMIT = 8
const normalizeFilter = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, '_')

const exactSingle = (url: URL, key: string) => {
  const values = url.searchParams.getAll(key)
  return values.length === 1 ? values[0] : undefined
}

export const parseOpenBreweryDirectoryRequest = (api: ApiDemo, requestUrl?: string): BreweryRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.origin !== ORIGIN || url.pathname !== '/v1/breweries' || url.hash || url.username || url.password) return undefined
    const allowedKeys = new Set(['by_country', 'per_page', 'by_type'])
    if ([...url.searchParams.keys()].some((key) => !allowedKeys.has(key))) return undefined
    const country = exactSingle(url, 'by_country')
    const perPage = exactSingle(url, 'per_page')
    const typeValues = url.searchParams.getAll('by_type')
    if (!country || perPage !== String(LIMIT) || typeValues.length > 1) return undefined

    const countryField = api.fields.find((field) => field.id === 'country')
    const typeField = api.fields.find((field) => field.id === 'type')
    const countries = new Set(countryField?.options?.map((option) => option.value) ?? [])
    const types = new Set(typeField?.options?.map((option) => option.value) ?? [])
    if (!countries.has(country)) return undefined
    const type = typeValues[0] ?? 'all'
    if (!types.has(type) || type === 'all' && typeValues.length !== 0) return undefined
    if (type !== 'all' && typeValues.length !== 1) return undefined
    return { country, type, limit: LIMIT }
  } catch {
    return undefined
  }
}

const bindOpenBreweryDirectoryRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext): BreweryRequestIdentity => {
  const request = parseOpenBreweryDirectoryRequest(api, requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported Open Brewery DB directory query.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Open Brewery DB directory request.' }
  }
  const executed = parseOpenBreweryDirectoryRequest(api, executedRequest.url)
  if (!executed || executed.country !== request.country || executed.type !== request.type || executed.limit !== request.limit) {
    return { request, transportBound: false, invalidReason: 'The displayed Open Brewery DB request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const optionalUrl = (value: unknown) => {
  if (value === undefined || value === null) return { value: undefined as string | undefined, malformed: false }
  const text = trimmedText(value)
  if (!text) return { value: undefined as string | undefined, malformed: true }
  try {
    const url = new URL(text)
    return { value: url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined, malformed: url.protocol !== 'http:' && url.protocol !== 'https:' }
  } catch {
    return { value: undefined as string | undefined, malformed: true }
  }
}

const parseBrewery = (value: unknown, request: BreweryRequest): Brewery | undefined => {
  if (!isRecord(value)) return undefined
  const id = trimmedText(value.id)
  const name = trimmedText(value.name)
  const breweryType = trimmedText(value.brewery_type)
  const city = trimmedText(value.city)
  const stateProvince = trimmedText(value.state_province)
  const postalCode = trimmedText(value.postal_code)
  const country = trimmedText(value.country)
  if (!id || !name || !breweryType || !city || !stateProvince || !postalCode || !country) return undefined
  if (normalizeFilter(country) !== request.country) return undefined
  if (request.type !== 'all' && normalizeFilter(breweryType) !== request.type) return undefined

  let optionalMalformedCount = 0
  const latitudeRaw = value.latitude
  const longitudeRaw = value.longitude
  let latitude: number | undefined
  let longitude: number | undefined
  const coordinatesAbsent = (latitudeRaw === null || latitudeRaw === undefined) && (longitudeRaw === null || longitudeRaw === undefined)
  if (!coordinatesAbsent) {
    latitude = finiteNumber(latitudeRaw)
    longitude = finiteNumber(longitudeRaw)
    if (latitude === undefined || latitude < -90 || latitude > 90 || longitude === undefined || longitude < -180 || longitude > 180) {
      latitude = undefined
      longitude = undefined
      optionalMalformedCount += 1
    }
  }

  const address = optionalTrimmedText(value.address_1)
  const phone = optionalTrimmedText(value.phone)
  const website = optionalUrl(value.website_url)
  optionalMalformedCount += Number(address.malformed) + Number(phone.malformed) + Number(website.malformed)

  return {
    id,
    name,
    breweryType,
    city,
    stateProvince,
    postalCode,
    country,
    latitude,
    longitude,
    address: address.value,
    phone: phone.value,
    websiteUrl: website.value,
    optionalMalformedCount,
  }
}

export const buildOpenBreweryDirectoryViewModel = (api: ApiDemo, data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): OpenBreweryDirectoryViewModel => {
  const identity = bindOpenBreweryDirectoryRequest(api, requestUrl, executedRequest)
  const request = identity.request
  const base = { requestBound: identity.transportBound, request, providerCount: 0, validCount: 0, invalidCount: 0, duplicateCount: 0, coordinateCount: 0, optionalMalformedCount: 0, breweries: [] as Brewery[] }
  if (!request || identity.invalidReason) return { ...base, state: 'invalid', reason: identity.invalidReason ?? 'The displayed request was not the exact supported Open Brewery DB directory query.' }
  if (!Array.isArray(data)) return { ...base, state: 'invalid', reason: 'The HTTP-success response was not the documented brewery array.' }
  if (data.length === 0) return identity.transportBound
    ? { ...base, state: 'empty', reason: 'Open Brewery DB returned no breweries for the executed filters.' }
    : { ...base, state: 'partial', reason: 'Open Brewery DB returned a coherent empty brewery array, but executed request evidence was unavailable, so the result is not marked request-bound.' }

  const breweries: Brewery[] = []
  const seen = new Set<string>()
  let invalidCount = 0
  let duplicateCount = 0
  let optionalMalformedCount = 0
  data.forEach((row, index) => {
    if (index >= request.limit) { invalidCount += 1; return }
    const brewery = parseBrewery(row, request)
    if (!brewery) { invalidCount += 1; return }
    if (seen.has(brewery.id)) { duplicateCount += 1; invalidCount += 1; return }
    seen.add(brewery.id)
    optionalMalformedCount += brewery.optionalMalformedCount
    breweries.push(brewery)
  })
  const coordinateCount = breweries.filter((brewery) => brewery.latitude !== undefined && brewery.longitude !== undefined).length
  if (breweries.length === 0) return { ...base, providerCount: data.length, invalidCount, duplicateCount, optionalMalformedCount, state: 'invalid', reason: 'Open Brewery DB returned rows, but none matched the executed country/type filters with trustworthy provider identity.' }
  const semanticPartial = invalidCount > 0 || optionalMalformedCount > 0 || data.length > request.limit
  const partial = !identity.transportBound || semanticPartial
  const reason = !identity.transportBound
    ? semanticPartial
      ? 'The brewery response is structurally coherent, but executed request evidence was unavailable; malformed, duplicate, overflow, or malformed optional evidence was also withheld.'
      : 'The brewery response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'
    : semanticPartial
      ? 'Only unique breweries matching the executed filters are shown; malformed, duplicate, overflow, or malformed optional evidence was withheld.'
      : undefined
  return {
    ...base,
    providerCount: data.length,
    validCount: breweries.length,
    invalidCount,
    duplicateCount,
    coordinateCount,
    optionalMalformedCount,
    breweries,
    state: partial ? 'partial' : 'ready',
    reason,
  }
}

const prettyToken = (value: string) => value.split('_').map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(' ')
const formatCoordinate = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(value)

export function OpenBreweryDirectoryPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildOpenBreweryDirectoryViewModel(api, data, requestUrl, executedRequest)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': 'exact-open-brewery-directory-v2',
    'data-requested-country': model.request?.country,
    'data-requested-type': model.request?.type,
    'data-request-limit': model.request?.limit,
    'data-provider-count': model.providerCount,
    'data-valid-count': model.validCount,
    'data-invalid-count': model.invalidCount,
    'data-duplicate-count': model.duplicateCount,
    'data-coordinate-count': model.coordinateCount,
    'data-optional-malformed-count': model.optionalMalformedCount,
    'data-primary-brewery-id': model.breweries[0]?.id,
  }
  if (model.state === 'invalid' || model.state === 'empty') return <div className="domain-card domain-empty open-brewery-directory-preview" data-domain-card="open-brewery-directory" {...evidence}><h3>{model.state === 'empty' ? 'No breweries returned' : 'Brewery evidence unavailable'}</h3><p>{model.reason}</p></div>

  const points = model.breweries.filter((brewery): brewery is Brewery & { latitude: number; longitude: number } => brewery.latitude !== undefined && brewery.longitude !== undefined)
  const lats = points.map((brewery) => brewery.latitude)
  const lons = points.map((brewery) => brewery.longitude)
  const latMin = points.length ? Math.min(...lats) : 0
  const lonMin = points.length ? Math.min(...lons) : 0
  const latRange = points.length ? Math.max(...lats) - latMin : 0
  const lonRange = points.length ? Math.max(...lons) - lonMin : 0
  const markerPosition = (brewery: Brewery & { latitude: number; longitude: number }): CSSProperties => ({
    '--point-x': `${lonRange === 0 ? 50 : 10 + ((brewery.longitude - lonMin) / lonRange) * 80}%`,
    '--point-y': `${latRange === 0 ? 50 : 90 - ((brewery.latitude - latMin) / latRange) * 80}%`,
  } as CSSProperties)

  return <div className="domain-card open-brewery-directory-preview" data-domain-card="open-brewery-directory" {...evidence}>
    <CardHeading eyebrow="Open Brewery DB · Public brewery directory" title={`${model.validCount} validated brewer${model.validCount === 1 ? 'y' : 'ies'}`} description="Request-bound brewery identities, business types, addresses, websites, and available provider coordinates."><span className={`domain-state${model.state === 'partial' ? ' warning' : ''}`}>{model.state === 'partial' ? 'Partial validated directory' : 'Validated directory'}</span></CardHeading>
    {model.state === 'partial' && <p className="domain-note">{model.reason}</p>}
    <Facts items={[
      { label: 'Country filter', value: model.request ? prettyToken(model.request.country) : 'Unavailable' },
      { label: 'Brewery type', value: model.request?.type === 'all' ? 'All types' : model.request ? prettyToken(model.request.type) : 'Unavailable' },
      { label: 'Provider rows', value: model.providerCount },
      { label: 'Validated breweries', value: model.validCount },
      { label: 'With coordinates', value: model.coordinateCount },
      { label: 'Withheld rows', value: model.invalidCount },
    ]}/>
    <div className="location-preview open-brewery-location-preview">
      {points.length ? <div className="location-map" role="img" aria-label={`Map sample with ${points.length} validated brewery coordinates`}><span className="map-compass">N</span>{points.map((brewery, index) => <i key={brewery.id} style={markerPosition(brewery)}><b>{index + 1}</b></i>)}</div> : <div className="domain-note" role="note">The validated provider rows do not currently include coordinates. Directory identity and address evidence remains available.</div>}
      <ol className="earthquake-list" aria-label="Validated breweries">{model.breweries.map((brewery, index) => <li key={brewery.id} data-brewery-id={brewery.id} data-brewery-type={brewery.breweryType} data-country={brewery.country} data-latitude={brewery.latitude} data-longitude={brewery.longitude}><span>{index + 1}</span><div><strong>{brewery.name}</strong><small>{prettyToken(brewery.breweryType)} · {brewery.city} · {brewery.stateProvince}</small><small>{brewery.address ? `${brewery.address} · ` : ''}{brewery.postalCode} · {brewery.country}</small>{brewery.latitude !== undefined && brewery.longitude !== undefined && <small>{formatCoordinate(brewery.latitude)}, {formatCoordinate(brewery.longitude)}</small>}{brewery.websiteUrl && <small><a href={brewery.websiteUrl} target="_blank" rel="noreferrer">Open brewery website</a></small>}</div></li>)}</ol>
    </div>
    <p className="domain-note">Open Brewery DB documents coordinates as optional. Missing coordinates do not invalidate a brewery identity; malformed optional values are withheld and lower the result to partial. The provider documents rate limiting and instructs clients to honor Retry-After on HTTP 429.</p>
  </div>
}
