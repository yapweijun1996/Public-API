import type { CSSProperties } from 'react'
import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, optionalTrimmedText, trimmedText } from './semanticValidation'

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'
type RouteRequest = { routeType: string; allowedTypes: number[]; label: string }
type RouteRow = { id: string; type: number; longName: string; shortName?: string; description?: string; destinations: string[]; color?: string; incomplete: boolean }
type RouteModel = { state: ResultState; reason: string; requestBound: boolean; request?: RouteRequest; providerCount: number; rows: RouteRow[]; invalidCount: number; incompleteCount: number }

const routeTypeLabel: Record<number, string> = { 0: 'Light rail', 1: 'Subway', 2: 'Commuter rail', 3: 'Bus', 4: 'Ferry' }

const routeTypeContract = (api: ApiDemo, routeType: string): RouteRequest | undefined => {
  const field = api.fields.find((candidate) => candidate.id === 'routeType')
  const option = field?.options?.find((candidate) => candidate.value === routeType)
  if (!option) return undefined
  const parts = routeType.split(',')
  if (!parts.length || parts.some((part) => !/^[0-4]$/.test(part))) return undefined
  const allowedTypes = parts.map(Number)
  if (new Set(allowedTypes).size !== allowedTypes.length) return undefined
  return { routeType, allowedTypes, label: option.label }
}

const parseRequestUrl = (api: ApiDemo, value?: string): RouteRequest | undefined => {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'api-v3.mbta.com' || url.port || url.username || url.password || url.hash || url.pathname !== '/routes') return undefined
    const entries = [...url.searchParams.entries()]
    if (entries.length !== 1 || entries[0]?.[0] !== 'filter[type]') return undefined
    const request = routeTypeContract(api, entries[0][1])
    if (!request || url.toString() !== api.buildUrl({ routeType: request.routeType })) return undefined
    return request
  } catch { return undefined }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext): RouteRequest | undefined => {
  const displayed = parseRequestUrl(api, requestUrl)
  if (!displayed || !executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return undefined
  const executed = parseRequestUrl(api, executedRequest.url)
  return executed?.routeType === displayed.routeType ? displayed : undefined
}

const parseStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return undefined
  const parsed = value.map(trimmedText)
  return parsed.every((item): item is string => Boolean(item)) ? parsed : undefined
}

const parseRoute = (value: unknown, request: RouteRequest): RouteRow | undefined => {
  if (!isRecord(value) || value.type !== 'route' || !isRecord(value.attributes)) return undefined
  const id = trimmedText(value.id), longName = trimmedText(value.attributes.long_name), type = value.attributes.type
  if (!id || !longName || typeof type !== 'number' || !Number.isInteger(type) || !request.allowedTypes.includes(type)) return undefined
  const shortName = optionalTrimmedText(value.attributes.short_name), description = optionalTrimmedText(value.attributes.description)
  const destinations = parseStringArray(value.attributes.direction_destinations), directionNames = parseStringArray(value.attributes.direction_names)
  const rawColor = optionalTrimmedText(value.attributes.color)
  const color = rawColor.value && /^[\da-f]{6}$/i.test(rawColor.value) ? `#${rawColor.value}` : undefined
  const incomplete = shortName.malformed || description.malformed || !destinations?.length || !directionNames || directionNames.length !== destinations?.length || rawColor.malformed || Boolean(rawColor.value && !color)
  return { id, type, longName, shortName: shortName.value, description: description.value, destinations: destinations ?? [], color, incomplete }
}

const invalidModel = (reason: string, request?: RouteRequest): RouteModel => ({ state: 'invalid', reason, requestBound: false, request, providerCount: 0, rows: [], invalidCount: 0, incompleteCount: 0 })
const buildModel = (api: ApiDemo, data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): RouteModel => {
  const request = bindRequest(api, requestUrl, executedRequest)
  if (!request) return invalidModel('unsupported-executed-request')
  if (!isRecord(data) || !Array.isArray(data.data)) return invalidModel('invalid-jsonapi-route-envelope', request)
  const providerCount = data.data.length
  if (!providerCount) return { state: 'empty', reason: 'no-routes', requestBound: true, request, providerCount, rows: [], invalidCount: 0, incompleteCount: 0 }
  const rows: RouteRow[] = [], seenIds = new Set<string>()
  let invalidCount = 0, incompleteCount = 0
  for (const value of data.data) {
    const row = parseRoute(value, request)
    if (!row || seenIds.has(row.id)) { invalidCount += 1; continue }
    seenIds.add(row.id); rows.push(row); if (row.incomplete) incompleteCount += 1
  }
  if (!rows.length) return { ...invalidModel('no-request-matching-routes', request), providerCount, invalidCount }
  const partial = invalidCount > 0 || incompleteCount > 0
  return { state: partial ? 'partial' : 'ready', reason: partial ? 'incomplete-route-evidence' : 'trusted-routes', requestBound: true, request, providerCount, rows, invalidCount, incompleteCount }
}

export function MBTARoutesPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildModel(api, data, requestUrl, executedRequest)
  const attrs = { 'data-domain-card': 'mbta-routes', 'data-result-state': model.state, 'data-result-reason': model.reason, 'data-request-bound': String(model.requestBound), 'data-request-contract': 'exact-mbta-routes-bodyless-get', 'data-requested-route-types': model.request?.routeType, 'data-provider-route-count': model.providerCount, 'data-valid-route-count': model.rows.length, 'data-invalid-route-count': model.invalidCount, 'data-incomplete-route-count': model.incompleteCount }
  if (model.state === 'invalid') return <section {...attrs} className="weather-empty" aria-label="MBTA route evidence"><strong>MBTA route response not trusted</strong><span>The successful response did not match the exact supported route request or documented JSON:API route shape.</span></section>
  if (model.state === 'empty') return <section {...attrs} className="weather-empty" aria-label="MBTA route evidence"><strong>No MBTA routes returned</strong><span>The provider returned a request-bound empty route list for {model.request?.label}.</span></section>
  const shown = model.rows.slice(0, 10)
  return <section {...attrs} className="transit-preview" aria-label="MBTA route evidence"><div className="transit-summary"><span>Boston network</span><strong>{model.rows.length}</strong><b>trusted {model.request?.label} routes</b><small>Request-bound MBTA JSON:API route catalogue</small></div>{model.state === 'partial' ? <p role="status">Partial route evidence: {[model.invalidCount > 0 ? model.invalidCount === 1 ? 'one malformed or filter-mismatched route was withheld' : `${model.invalidCount} malformed or filter-mismatched routes were withheld` : undefined, model.incompleteCount > 0 ? model.incompleteCount === 1 ? 'one trusted route has incomplete optional presentation metadata' : `${model.incompleteCount} trusted routes have incomplete optional presentation metadata` : undefined].filter(Boolean).join('; ')}.</p> : null}<div className="transit-routes">{shown.map((route) => <article key={route.id} data-route-id={route.id} data-route-type={route.type} style={route.color ? ({ '--route-color': route.color } as CSSProperties) : undefined}><span>{route.shortName || route.id.slice(0, 3)}</span><div><small>{route.description ?? routeTypeLabel[route.type] ?? 'MBTA service'}</small><h3>{route.longName}</h3><p>{route.destinations.length ? route.destinations.join(' ↔ ') : 'Destination information unavailable'}</p></div><em>{routeTypeLabel[route.type] ?? `Type ${route.type}`}</em></article>)}</div>{model.rows.length > shown.length ? <small>Showing the first {shown.length} of {model.rows.length} trusted routes.</small> : null}</section>
}
