import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { formatNumber } from './previewData'
import { finiteNumber, isRecord, optionalTrimmedText, trimmedText } from './semanticValidation'

type EonetRequest = {
  category: string
  days: number
  limit: number
}

type EonetGeometry = {
  date: string
  type: 'Point' | 'Polygon'
  longitude?: number
  latitude?: number
  polygonRingCount?: number
  magnitudeValue?: number
  magnitudeUnit?: string
}

type EonetEvent = {
  id: string
  title: string
  description?: string
  link: string
  categoryId: string
  categoryTitle: string
  geometry: EonetGeometry
  incomplete: boolean
}

type EonetModel = {
  state: 'ready' | 'partial' | 'empty' | 'invalid'
  reason: string
  requestBound: boolean
  request?: EonetRequest
  providerCount?: number
  events: EonetEvent[]
  invalidCount: number
  incompleteCount: number
  duplicateCount: number
}

const EONET_ORIGIN = 'https://eonet.gsfc.nasa.gov'
const EONET_EVENTS_PATH = '/api/v3/events'

const canonicalInteger = (value: string | null, minimum: number, maximum: number) => {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum && String(parsed) === value ? parsed : undefined
}

const parseRequestUrl = (api: ApiDemo, requestUrl: string): EonetRequest | undefined => {
  if (api.id !== 'nasa-eonet-events') return undefined
  const categoryField = api.fields.find((field) => field.id === 'category')
  const daysField = api.fields.find((field) => field.id === 'days')
  const limitField = api.fields.find((field) => field.id === 'limit')
  if (!categoryField?.options || daysField?.min === undefined || daysField.max === undefined || limitField?.min === undefined || limitField.max === undefined) return undefined

  try {
    const url = new URL(requestUrl)
    if (url.origin !== EONET_ORIGIN || url.pathname !== EONET_EVENTS_PATH || url.username || url.password || url.port || url.hash) return undefined
    const allowedKeys = new Set(['status', 'category', 'days', 'limit'])
    const keys = [...url.searchParams.keys()]
    if (keys.some((key) => !allowedKeys.has(key)) || keys.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    if (url.searchParams.get('status') !== 'open') return undefined

    const category = url.searchParams.get('category') ?? 'all'
    const allowedCategories = new Set(categoryField.options.map((option) => option.value))
    if (!allowedCategories.has(category) || (category === 'all' && url.searchParams.has('category'))) return undefined
    const days = canonicalInteger(url.searchParams.get('days'), daysField.min, daysField.max)
    const limit = canonicalInteger(url.searchParams.get('limit'), limitField.min, limitField.max)
    if (days === undefined || limit === undefined) return undefined

    const request = { category, days, limit }
    const canonicalUrl = api.buildUrl({ category, days: String(days), limit: String(limit) })
    return canonicalUrl === requestUrl ? request : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext) => {
  if (!requestUrl) return { requestBound: false as const }
  const request = parseRequestUrl(api, requestUrl)
  if (!request || !executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, requestBound: false as const }
  }
  const executed = parseRequestUrl(api, executedRequest.url)
  if (!executed || executed.category !== request.category || executed.days !== request.days || executed.limit !== request.limit) {
    return { request, requestBound: false as const }
  }
  return { request, requestBound: true as const }
}

const validTimestamp = (value: unknown) => {
  const text = trimmedText(value)
  return text && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(text) && Number.isFinite(Date.parse(text)) ? text : undefined
}

const position = (value: unknown): [number, number] | undefined => {
  if (!Array.isArray(value) || value.length < 2 || value.some((coordinate) => finiteNumber(coordinate) === undefined)) return undefined
  const longitude = finiteNumber(value[0])
  const latitude = finiteNumber(value[1])
  if (longitude === undefined || longitude < -180 || longitude > 180 || latitude === undefined || latitude < -90 || latitude > 90) return undefined
  return [longitude, latitude]
}

const polygonRingCount = (value: unknown) => {
  if (!Array.isArray(value) || !value.length) return undefined
  for (const ring of value) {
    if (!Array.isArray(ring) || ring.length < 4 || ring.some((point) => !position(point))) return undefined
    const first = ring[0] as unknown[]
    const last = ring.at(-1) as unknown[]
    if (first.length !== last.length || first.some((coordinate, index) => coordinate !== last[index])) return undefined
  }
  return value.length
}

const parseGeometry = (value: unknown): { geometry?: EonetGeometry; incomplete: boolean } => {
  if (!isRecord(value)) return { incomplete: false }
  const date = validTimestamp(value.date)
  const type = value.type === 'Point' || value.type === 'Polygon' ? value.type : undefined
  if (!date || !type) return { incomplete: false }

  let geometry: EonetGeometry
  if (type === 'Point') {
    const coordinates = position(value.coordinates)
    if (!coordinates) return { incomplete: false }
    geometry = { date, type, longitude: coordinates[0], latitude: coordinates[1] }
  } else {
    const ringCount = polygonRingCount(value.coordinates)
    if (ringCount === undefined) return { incomplete: false }
    geometry = { date, type, polygonRingCount: ringCount }
  }

  const hasMagnitude = value.magnitudeValue !== undefined && value.magnitudeValue !== null
  const hasMagnitudeUnit = value.magnitudeUnit !== undefined && value.magnitudeUnit !== null
  if (!hasMagnitude && !hasMagnitudeUnit) return { geometry, incomplete: false }
  const magnitudeValue = finiteNumber(value.magnitudeValue)
  const magnitudeUnit = trimmedText(value.magnitudeUnit)
  if (magnitudeValue === undefined || !magnitudeUnit) return { geometry, incomplete: true }
  return { geometry: { ...geometry, magnitudeValue, magnitudeUnit }, incomplete: false }
}

const canonicalEventLink = (value: unknown, id: string) => {
  const link = trimmedText(value)
  if (!link) return undefined
  const expected = `${EONET_ORIGIN}${EONET_EVENTS_PATH}/${encodeURIComponent(id)}`
  return link === expected ? link : undefined
}

const sourceEvidenceMalformed = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) return true
  return value.some((source) => !isRecord(source) || !trimmedText(source.id) || !trimmedText(source.url))
}

const parseEvent = (value: unknown, request: EonetRequest): EonetEvent | undefined => {
  if (!isRecord(value)) return undefined
  const id = trimmedText(value.id)
  const title = trimmedText(value.title)
  if (!id || !title || value.closed !== null) return undefined
  const link = canonicalEventLink(value.link, id)
  if (!link || !Array.isArray(value.categories) || !value.categories.length || !Array.isArray(value.geometry) || !value.geometry.length) return undefined

  const categories: Array<{ id: string; title: string }> = []
  const seenCategoryIds = new Set<string>()
  for (const category of value.categories) {
    if (!isRecord(category)) return undefined
    const categoryId = trimmedText(category.id)
    const categoryTitle = trimmedText(category.title)
    if (!categoryId || !categoryTitle || seenCategoryIds.has(categoryId)) return undefined
    seenCategoryIds.add(categoryId)
    categories.push({ id: categoryId, title: categoryTitle })
  }
  if (request.category !== 'all' && !seenCategoryIds.has(request.category)) return undefined

  const geometries = value.geometry.map(parseGeometry)
  if (geometries.some((entry) => !entry.geometry)) return undefined
  const latest = geometries.at(-1)?.geometry
  if (!latest) return undefined
  const requestedCategory = request.category === 'all' ? categories[0] : categories.find((category) => category.id === request.category)
  if (!requestedCategory) return undefined

  const description = optionalTrimmedText(value.description)
  return {
    id,
    title,
    description: description.value,
    link,
    categoryId: requestedCategory.id,
    categoryTitle: requestedCategory.title,
    geometry: latest,
    incomplete: description.malformed || sourceEvidenceMalformed(value.sources) || geometries.some((entry) => entry.incomplete),
  }
}

export const buildNasaEonetEventsModel = (api: ApiDemo, data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): EonetModel => {
  const identity = bindRequest(api, requestUrl, executedRequest)
  const base = { requestBound: identity.requestBound, request: identity.request, events: [], invalidCount: 0, incompleteCount: 0, duplicateCount: 0 }
  if (!identity.requestBound || !identity.request) return { ...base, state: 'invalid', reason: 'missing-or-mismatched-request-evidence' }
  if (!isRecord(data) || !Array.isArray(data.events)) return { ...base, state: 'invalid', reason: 'invalid-response-envelope' }
  const providerCount = data.events.length
  if (providerCount > identity.request.limit) return { ...base, providerCount, invalidCount: providerCount, state: 'invalid', reason: 'provider-count-exceeds-limit' }
  if (providerCount === 0) return { ...base, providerCount, state: 'empty', reason: 'request-bound-empty' }

  const events: EonetEvent[] = []
  const seenIds = new Set<string>()
  let invalidCount = 0
  let incompleteCount = 0
  let duplicateCount = 0
  for (const value of data.events) {
    const event = parseEvent(value, identity.request)
    if (!event || seenIds.has(event.id)) {
      invalidCount += 1
      if (event && seenIds.has(event.id)) duplicateCount += 1
      continue
    }
    seenIds.add(event.id)
    events.push(event)
    if (event.incomplete) incompleteCount += 1
  }
  if (!events.length) return { ...base, providerCount, invalidCount, incompleteCount, duplicateCount, state: 'invalid', reason: 'no-trustworthy-events' }
  const partial = invalidCount > 0 || incompleteCount > 0
  return { ...base, providerCount, events, invalidCount, incompleteCount, duplicateCount, state: partial ? 'partial' : 'ready', reason: partial ? 'partial-event-evidence' : 'trusted-events' }
}

const dateLabel = (value: string) => new Date(value).toISOString()

export function NasaEonetEventsPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildNasaEonetEventsModel(api, data, requestUrl, executedRequest)
  const primary = model.events[0]
  const attrs = {
    'data-domain-card': 'nasa-eonet-events',
    'data-result-state': model.state,
    'data-result-reason': model.reason,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': 'exact-eonet-open-events-bodyless-get',
    'data-request-status': model.request ? 'open' : undefined,
    'data-requested-category': model.request?.category,
    'data-requested-days': model.request?.days,
    'data-requested-limit': model.request?.limit,
    'data-provider-event-count': model.providerCount,
    'data-valid-event-count': model.providerCount === undefined ? undefined : model.events.length,
    'data-invalid-event-count': model.providerCount === undefined ? undefined : model.invalidCount,
    'data-incomplete-event-count': model.providerCount === undefined ? undefined : model.incompleteCount,
    'data-duplicate-event-count': model.providerCount === undefined ? undefined : model.duplicateCount,
    'data-count-contract': model.request && model.providerCount !== undefined ? String(model.providerCount <= model.request.limit) : undefined,
    'data-primary-event-id': primary?.id,
    'data-primary-event-link': primary?.link,
    'data-primary-category': primary?.categoryId,
    'data-primary-geometry-type': primary?.geometry.type,
  }

  if (model.state === 'invalid') return <section className="weather-empty" aria-label="NASA EONET event evidence" {...attrs}><strong>NASA EONET event evidence unavailable</strong><span>{model.reason === 'provider-count-exceeds-limit' ? 'NASA EONET returned more events than the exact executed request limit, so all event evidence is withheld.' : 'The successful response was not bound to the exact supported request or did not contain trustworthy EONET open-event evidence.'}</span></section>
  if (model.state === 'empty') return <section className="weather-empty" aria-label="NASA EONET event evidence" {...attrs}><strong>No active NASA EONET events matched</strong><span>NASA EONET returned a valid empty collection for the exact executed category, days, and limit request.</span></section>

  return <section className="domain-card natural-events-preview" aria-label="NASA EONET event evidence" {...attrs}>
    <div className="event-overview"><div><span>NASA EONET monitor · {model.request?.category}</span><strong>{model.events.length}</strong><b>validated open natural {model.events.length === 1 ? 'event' : 'events'}</b></div><div className="event-globe" aria-hidden="true">◎<i/><i/><i/></div></div>
    {model.state === 'partial' ? <p className="domain-note" role="status">Only events with unique EONET identity, canonical provider link, open status, matching category, and valid Point or Polygon geometry are shown. Missing source references or malformed optional values degrade the evidence and are marked incomplete.</p> : null}
    <div className="event-grid">{model.events.map((event) => {
      const geometry = event.geometry
      const location = geometry.type === 'Point' && geometry.latitude !== undefined && geometry.longitude !== undefined
        ? `${formatNumber(geometry.latitude, 4)}, ${formatNumber(geometry.longitude, 4)}`
        : `Polygon geometry · ${geometry.polygonRingCount} ${geometry.polygonRingCount === 1 ? 'ring' : 'rings'}`
      const magnitude = geometry.magnitudeValue !== undefined && geometry.magnitudeUnit
        ? `${formatNumber(geometry.magnitudeValue, 3)} ${geometry.magnitudeUnit}`
        : 'Magnitude unavailable'
      return <article key={event.id} data-event-id={event.id} data-event-link={event.link} data-event-status="open" data-category-id={event.categoryId} data-geometry-type={geometry.type} data-observed-at={dateLabel(geometry.date)} data-longitude={geometry.longitude} data-latitude={geometry.latitude} data-polygon-ring-count={geometry.polygonRingCount} data-magnitude-value={geometry.magnitudeValue} data-magnitude-unit={geometry.magnitudeUnit} data-incomplete={String(event.incomplete)}><span aria-hidden="true">◒</span><div><small>{event.categoryTitle} · <time dateTime={dateLabel(geometry.date)}>{dateLabel(geometry.date)}</time></small><h3><a href={event.link} target="_blank" rel="noreferrer">{event.title}</a></h3><p>{location} · {magnitude}</p>{event.description ? <p>{event.description}</p> : null}</div><em>Open</em></article>
    })}</div>
  </section>
}
