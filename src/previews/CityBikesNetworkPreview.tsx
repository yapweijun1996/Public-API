import type { CSSProperties } from 'react'
import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts } from './cardPrimitives'
import { finiteNumber, isRecord, nonNegativeSafeInteger, trimmedText } from './semanticValidation'

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'
type Request = { networkId: string }
type Station = { id: string; name: string; latitude: number; longitude: number; timestamp: string; freeBikes: number; emptySlots: number }
export type CityBikesNetworkViewModel = {
  state: ResultState; reason?: string; requestBound: boolean; request?: Request
  networkName?: string; responseNetworkId?: string; city?: string; country?: string
  providerStationCount: number; validStationCount: number; invalidStationCount: number; duplicateStationCount: number
  freeBikes: number; emptySlots: number; stations: Station[]
}
const prefix = '/v2/networks/'
const allowed = (api: ApiDemo) => api.fields.find((field) => field.id === 'network')?.options?.map((option) => option.value) ?? []

export const parseCityBikesRequest = (api: ApiDemo, requestUrl?: string): Request | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.host !== 'api.citybik.es' || url.username || url.password || url.hash || url.search) return undefined
    if (!url.pathname.startsWith(prefix)) return undefined
    const encodedId = url.pathname.slice(prefix.length)
    if (!encodedId || encodedId.includes('/')) return undefined
    const networkId = decodeURIComponent(encodedId)
    if (!allowed(api).includes(networkId) || `${prefix}${encodeURIComponent(networkId)}` !== url.pathname) return undefined
    return { networkId }
  } catch { return undefined }
}

const station = (value: unknown): Station | undefined => {
  if (!isRecord(value)) return undefined
  const id = trimmedText(value.id); const name = trimmedText(value.name)
  const latitude = finiteNumber(value.latitude); const longitude = finiteNumber(value.longitude)
  const timestamp = trimmedText(value.timestamp)
  const freeBikes = nonNegativeSafeInteger(value.free_bikes); const emptySlots = nonNegativeSafeInteger(value.empty_slots)
  if (!id || !name || latitude === undefined || latitude < -90 || latitude > 90 || longitude === undefined || longitude < -180 || longitude > 180 || !timestamp || freeBikes === undefined || emptySlots === undefined) return undefined
  return { id, name, latitude, longitude, timestamp, freeBikes, emptySlots }
}

const resolveCityBikesTransport = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext) => {
  const displayed = parseCityBikesRequest(api, requestUrl)
  if (!displayed) return { request: undefined, valid: false, bound: false } as const
  if (!executedRequest) return { request: displayed, valid: true, bound: false } as const
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request: undefined, valid: false, bound: false } as const
  }
  const executed = parseCityBikesRequest(api, executedRequest.url)
  if (!executed || executed.networkId !== displayed.networkId) return { request: undefined, valid: false, bound: false } as const
  return { request: displayed, valid: true, bound: true } as const
}

export const buildCityBikesNetworkViewModel = (api: ApiDemo, data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): CityBikesNetworkViewModel => {
  const transport = resolveCityBikesTransport(api, requestUrl, executedRequest)
  const request = transport.request
  const base = { requestBound: transport.bound, request, providerStationCount: 0, validStationCount: 0, invalidStationCount: 0, duplicateStationCount: 0, freeBikes: 0, emptySlots: 0, stations: [] as Station[] }
  if (!transport.valid || !request) return { ...base, state: 'invalid', reason: 'The successful response was not bound to the exact supported bodyless GET CityBikes network request shown to the user.' }
  if (!isRecord(data) || !isRecord(data.network)) return { ...base, state: 'invalid', reason: 'The HTTP-success response did not contain the documented CityBikes network object.' }
  const network = data.network
  const responseNetworkId = trimmedText(network.id)
  const networkName = trimmedText(network.name)
  const href = trimmedText(network.href)
  const location = isRecord(network.location) ? network.location : undefined
  const city = location ? trimmedText(location.city) : undefined
  const country = location ? trimmedText(location.country) : undefined
  const lat = location ? finiteNumber(location.latitude) : undefined
  const lng = location ? finiteNumber(location.longitude) : undefined
  const identity = { responseNetworkId, networkName, city, country }
  if (responseNetworkId !== request.networkId || !networkName || href !== `${prefix}${request.networkId}` || !city || !country || lat === undefined || lat < -90 || lat > 90 || lng === undefined || lng < -180 || lng > 180) {
    return { ...base, ...identity, state: 'invalid', reason: 'CityBikes did not return a coherent network identity and location matching the executed request.' }
  }
  if (!Array.isArray(network.stations)) return { ...base, ...identity, state: 'invalid', reason: 'The CityBikes response did not include the documented stations array.' }
  const providerStationCount = network.stations.length
  if (!providerStationCount) return { ...base, ...identity, state: transport.bound ? 'empty' : 'partial', reason: transport.bound ? 'CityBikes returned the requested network but no station rows.' : 'The CityBikes response is structurally coherent, but zero-result semantics are not trusted without exact executed-request evidence.' }
  const stations: Station[] = []
  const seen = new Set<string>()
  let invalidStationCount = 0
  let duplicateStationCount = 0
  let freeBikes = 0
  let emptySlots = 0
  for (const row of network.stations) {
    const parsed = station(row)
    if (!parsed) { invalidStationCount += 1; continue }
    if (seen.has(parsed.id)) { invalidStationCount += 1; duplicateStationCount += 1; continue }
    seen.add(parsed.id)
    stations.push(parsed)
    freeBikes += parsed.freeBikes
    emptySlots += parsed.emptySlots
  }
  if (!stations.length) return { ...base, ...identity, state: 'invalid', providerStationCount, invalidStationCount, duplicateStationCount, reason: 'CityBikes returned station rows, but none had a unique ID plus native coordinates, availability counts, and timestamp.' }
  const partial = !transport.bound || invalidStationCount > 0
  const reason = [
    !transport.bound ? 'The response matches the displayed CityBikes request, but execution evidence is unavailable.' : undefined,
    invalidStationCount > 0 ? 'Malformed or duplicate station rows were withheld.' : undefined,
  ].filter(Boolean).join(' ') || undefined
  return { ...base, ...identity, state: partial ? 'partial' : 'ready', reason, providerStationCount, validStationCount: stations.length, invalidStationCount, duplicateStationCount, freeBikes, emptySlots, stations }
}

const attrs = (m: CityBikesNetworkViewModel) => ({
  'data-result-state': m.state,
  'data-request-bound': String(m.requestBound),
  'data-request-contract': 'exact-citybikes-network-v3',
  'data-request-network': m.request?.networkId,
  'data-response-network': m.responseNetworkId,
  'data-provider-station-count': m.providerStationCount,
  'data-valid-station-count': m.validStationCount,
  'data-invalid-station-count': m.invalidStationCount,
  'data-duplicate-station-count': m.duplicateStationCount,
  'data-primary-station-id': m.stations[0]?.id,
  'data-free-bikes-total': m.freeBikes,
  'data-empty-slots-total': m.emptySlots,
})

export function CityBikesNetworkPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildCityBikesNetworkViewModel(api, data, requestUrl, executedRequest)
  const evidence = attrs(model)
  if (model.state === 'invalid' || model.state === 'empty' || (model.state === 'partial' && model.providerStationCount === 0)) return <div className="domain-card domain-empty citybikes-network-preview" data-domain-card="citybikes-network" {...evidence}><h3>{model.state === 'empty' ? 'No bike stations returned' : model.state === 'partial' ? 'Unbound CityBikes empty response' : 'CityBikes network evidence unavailable'}</h3><p>{model.reason}</p></div>
  const shown = model.stations.slice(0, 8)
  const latMin = Math.min(...shown.map((item) => item.latitude))
  const latRange = Math.max(...shown.map((item) => item.latitude)) - latMin || 1
  const lonMin = Math.min(...shown.map((item) => item.longitude))
  const lonRange = Math.max(...shown.map((item) => item.longitude)) - lonMin || 1
  return <div className="domain-card citybikes-network-preview" data-domain-card="citybikes-network" {...evidence}>
    <CardHeading eyebrow="CityBikes · Live bike-sharing network" title={`${model.networkName} · ${model.city}`} description={`${model.validStationCount.toLocaleString('en')} validated stations for ${model.requestBound ? 'the executed' : 'the displayed'} ${model.request?.networkId} network request.`}>
      <span className={`domain-state${model.state === 'partial' ? ' warning' : ''}`}>{model.state === 'partial' ? 'Partial validated network' : 'Validated network'}</span>
    </CardHeading>
    {model.state === 'partial' && <p className="domain-note">{model.reason}</p>}
    <Facts items={[
      { label: 'Network ID', value: model.responseNetworkId },
      { label: 'Location', value: `${model.city}, ${model.country}` },
      { label: 'Provider stations', value: model.providerStationCount.toLocaleString('en') },
      { label: 'Validated stations', value: model.validStationCount.toLocaleString('en') },
      { label: 'Available bikes', value: model.freeBikes.toLocaleString('en') },
      { label: 'Empty docks', value: model.emptySlots.toLocaleString('en') },
    ]}/>
    <div className="location-preview citybikes-station-map">
      <div className="location-map" role="img" aria-label={`Map with ${shown.length} validated CityBikes stations`}>
        <span className="map-compass">N</span>
        {shown.map((item, index) => <i key={item.id} data-station-id={item.id} style={{ '--point-x': `${10 + ((item.longitude - lonMin) / lonRange) * 80}%`, '--point-y': `${90 - ((item.latitude - latMin) / latRange) * 80}%` } as CSSProperties}><b>{index + 1}</b></i>)}
      </div>
      <ol className="citybikes-station-list" aria-label="Validated CityBikes stations">
        {shown.map((item, index) => <li key={item.id} data-station-id={item.id} data-free-bikes={item.freeBikes} data-empty-slots={item.emptySlots} data-station-latitude={item.latitude} data-station-longitude={item.longitude} data-station-timestamp={item.timestamp}>
          <span>{index + 1}</span><div><strong>{item.name}</strong><small>{item.freeBikes} bikes · {item.emptySlots} empty docks</small><small>{item.latitude}, {item.longitude}</small></div>
        </li>)}
      </ol>
    </div>
    <p className="domain-note">Showing the first {shown.length.toLocaleString('en')} validated station{shown.length === 1 ? '' : 's'} on the map. Availability totals cover all {model.validStationCount.toLocaleString('en')} validated provider stations. Source: <a href="https://citybik.es/" target="_blank" rel="noreferrer">CityBikes</a>.</p>
  </div>
}
