import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeInteger, optionalTrimmedText, trimmedText } from './semanticValidation'

type RequestIdentity = { from: string; to: string; limit: number }
type DelayEvidence = { value?: number; unavailable: boolean; malformed: boolean }
type ConnectionRow = { originId: string; origin: string; destinationId: string; destination: string; departure: string; arrival: string; platform?: string; duration: string; service: string; delay: DelayEvidence; incomplete: boolean }
type State = 'ready' | 'partial' | 'empty' | 'invalid'
type Model = { state: State; reason: string; requestBound: boolean; request?: RequestIdentity; providerCount: number; rows: ConnectionRow[]; invalidCount: number; delayUnavailableCount: number }

const parseRequestUrl = (api: ApiDemo, value?: string): RequestIdentity | undefined => {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'transport.opendata.ch' || url.port || url.username || url.password || url.hash || url.pathname !== '/v1/connections') return undefined
    const entries = [...url.searchParams.entries()]
    if (entries.length !== 3 || new Set(entries.map(([key]) => key)).size !== 3) return undefined
    const from = url.searchParams.get('from')?.trim() ?? ''
    const to = url.searchParams.get('to')?.trim() ?? ''
    const limitText = url.searchParams.get('limit') ?? ''
    if (!from || !to || !/^[1-9]\d*$/.test(limitText)) return undefined
    const limit = Number(limitText)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10 || url.toString() !== api.buildUrl({ from, to, limit: limitText })) return undefined
    return { from, to, limit }
  } catch { return undefined }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executed?: ExecutedRequestContext) => {
  const displayed = parseRequestUrl(api, requestUrl)
  if (!displayed || !executed || executed.method.toUpperCase() !== 'GET' || executed.body !== undefined || executed.url !== requestUrl) return undefined
  const actual = parseRequestUrl(api, executed.url)
  return actual && actual.from === displayed.from && actual.to === displayed.to && actual.limit === displayed.limit ? displayed : undefined
}

const parseDelay = (value: unknown): DelayEvidence => {
  if (value === null || value === undefined) return { unavailable: true, malformed: false }
  const parsed = nonNegativeInteger(value)
  return parsed === undefined ? { unavailable: true, malformed: true } : { value: parsed, unavailable: false, malformed: false }
}

const getService = (value: Record<string, unknown>) => {
  if (Array.isArray(value.products)) {
    const products = value.products.map(trimmedText)
    if (products.every((product): product is string => Boolean(product))) return { label: products.length ? products.join(' + ') : 'Walking connection', incomplete: false }
  }
  const journeys = (Array.isArray(value.sections) ? value.sections.filter(isRecord) : []).flatMap((section) => {
    if (!isRecord(section.journey)) return []
    const label = [trimmedText(section.journey.category), trimmedText(section.journey.number)].filter(Boolean).join(' ') || trimmedText(section.journey.name)
    return label ? [label] : []
  })
  return journeys.length ? { label: journeys.join(' + '), incomplete: true } : { label: 'Service details unavailable', incomplete: true }
}

const parseConnection = (value: unknown): ConnectionRow | undefined => {
  if (!isRecord(value) || !isRecord(value.from) || !isRecord(value.to)) return undefined
  const fromStation = isRecord(value.from.station) ? value.from.station : undefined
  const toStation = isRecord(value.to.station) ? value.to.station : undefined
  const originId = trimmedText(fromStation?.id), origin = trimmedText(fromStation?.name)
  const destinationId = trimmedText(toStation?.id), destination = trimmedText(toStation?.name)
  const departure = trimmedText(value.from.departure), arrival = trimmedText(value.to.arrival), duration = trimmedText(value.duration)
  if (!originId || !origin || !destinationId || !destination || !departure || !arrival || !duration || !/^\d{2}d\d{2}:\d{2}:\d{2}$/.test(duration)) return undefined
  const platform = optionalTrimmedText(value.from.platform)
  if (platform.malformed) return undefined
  const delay = parseDelay(value.from.delay), service = getService(value)
  return { originId, origin, destinationId, destination, departure, arrival, platform: platform.value, duration, service: service.label, delay, incomplete: delay.unavailable || delay.malformed || service.incomplete }
}

const invalidModel = (reason: string, request?: RequestIdentity): Model => ({ state: 'invalid', reason, requestBound: false, request, providerCount: 0, rows: [], invalidCount: 0, delayUnavailableCount: 0 })

const buildModel = (api: ApiDemo, data: unknown, requestUrl?: string, executed?: ExecutedRequestContext): Model => {
  const request = bindRequest(api, requestUrl, executed)
  if (!request) return invalidModel('unsupported-executed-request')
  if (!isRecord(data) || !Array.isArray(data.connections)) return invalidModel('invalid-connections-envelope', request)
  const providerCount = data.connections.length
  if (!providerCount) return { state: 'empty', reason: 'no-connections', requestBound: true, request, providerCount, rows: [], invalidCount: 0, delayUnavailableCount: 0 }
  const rows: ConnectionRow[] = []
  let invalidCount = 0
  for (const value of data.connections) {
    const row = parseConnection(value)
    if (row) rows.push(row)
    else invalidCount += 1
  }
  if (!rows.length) return { ...invalidModel('no-trusted-connections', request), providerCount, invalidCount }
  const delayUnavailableCount = rows.filter((row) => row.delay.unavailable).length
  const partial = invalidCount > 0 || rows.some((row) => row.incomplete)
  return { state: partial ? 'partial' : 'ready', reason: partial ? 'incomplete-connection-evidence' : 'trusted-connections', requestBound: true, request, providerCount, rows, invalidCount, delayUnavailableCount }
}

const localClock = (value: string) => /T(\d{2}:\d{2})/.exec(value)?.[1] ?? value
const durationLabel = (value: string) => {
  const match = /^(\d{2})d(\d{2}):(\d{2}):(\d{2})$/.exec(value)
  if (!match) return value
  const days = Number(match[1]), hours = Number(match[2]), minutes = Number(match[3])
  return [days ? `${days}d` : '', hours ? `${hours}h` : '', `${minutes}m`].filter(Boolean).join(' ')
}
const delayLabel = (delay: DelayEvidence) => delay.value === undefined ? 'Delay unavailable' : delay.value > 0 ? `Delayed ${delay.value} min` : 'On schedule'

export function SwissTransitConnectionsPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildModel(api, data, requestUrl, executedRequest)
  const attrs = {
    'data-domain-card': 'swiss-transit-connections', 'data-result-state': model.state, 'data-result-reason': model.reason,
    'data-request-bound': String(model.requestBound), 'data-request-contract': 'exact-swiss-connections-bodyless-get',
    'data-requested-from': model.request?.from, 'data-requested-to': model.request?.to, 'data-request-limit': model.request?.limit,
    'data-provider-connection-count': model.providerCount, 'data-valid-connection-count': model.rows.length,
    'data-invalid-connection-count': model.invalidCount, 'data-delay-unavailable-count': model.delayUnavailableCount,
  }
  if (model.state === 'invalid') return <section {...attrs} className="weather-empty" aria-label="Swiss transit connection evidence"><strong>Swiss transit response not trusted</strong><span>The successful response did not match the exact supported request or documented connection/checkpoint shape.</span></section>
  if (model.state === 'empty') return <section {...attrs} className="weather-empty" aria-label="Swiss transit connection evidence"><strong>No Swiss transit connections returned</strong><span>The provider returned a request-bound empty connection list for {model.request?.from} → {model.request?.to}.</span></section>
  const shown = model.rows.slice(0, 10)
  return <section {...attrs} className="transit-preview" aria-label="Swiss transit connection evidence">
    <div className="transit-summary"><span>Swiss public transport</span><strong>{model.rows.length}</strong><b>trusted connections</b><small>{model.request?.from} → {model.request?.to} · timetable plus available departure-delay evidence</small></div>
    {model.state === 'partial' ? <p role="status">Partial connection evidence: {[
      model.invalidCount > 0 ? model.invalidCount === 1 ? 'one malformed connection was withheld' : `${model.invalidCount} malformed connections were withheld` : undefined,
      model.delayUnavailableCount > 0 ? model.delayUnavailableCount === 1 ? 'one connection has no departure-delay prognosis' : `${model.delayUnavailableCount} connections have no departure-delay prognosis` : undefined,
      model.rows.some((row) => row.service === 'Service details unavailable') ? 'some service identity is unavailable' : undefined,
    ].filter(Boolean).join('; ')}.</p> : null}
    <div className="transit-routes">{shown.map((row, index) => <article key={`${row.originId}-${row.destinationId}-${row.departure}-${index}`} data-origin-id={row.originId} data-destination-id={row.destinationId} data-delay-minutes={row.delay.value}>
      <span>{row.platform ?? '—'}</span><div><small>{delayLabel(row.delay)}</small><h3>{row.origin} → {row.destination}</h3><p>{row.service} · {localClock(row.departure)}–{localClock(row.arrival)} · {durationLabel(row.duration)}</p></div><em>{localClock(row.arrival)}</em>
    </article>)}</div>
    {model.rows.length > shown.length ? <small>Showing the first {shown.length} of {model.rows.length} trusted connections.</small> : null}
  </section>
}
