import type { CSSProperties } from 'react'
import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, optionalTrimmedText, trimmedText } from './semanticValidation'

type BoardDirection = 'departure' | 'arrival'
type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'

type StationContract = {
  id: string
  atId: string
}

type LiveboardRequest = {
  station: string
  direction: BoardDirection
  stationContract: StationContract
}

type Service = {
  id: string
  time: number
  delay: number
  canceled: boolean
  station: string
  vehicle: string
  platform?: string
  incomplete: boolean
}

type LiveboardModel = {
  state: ResultState
  reason: string
  requestBound: boolean
  request?: LiveboardRequest
  providerStationId?: string
  providerStationName?: string
  providerCount?: number
  validServices: Service[]
  invalidServiceCount: number
  incompleteServiceCount: number
  countCoherent: boolean
  envelopeMetadataValid: boolean
}

const stationContracts: Record<string, StationContract> = {
  'Brussels-South': {
    id: 'BE.NMBS.008814001',
    atId: 'http://irail.be/stations/NMBS/008814001',
  },
  'Gent-Sint-Pieters': {
    id: 'BE.NMBS.008892007',
    atId: 'http://irail.be/stations/NMBS/008892007',
  },
  'Antwerpen-Centraal': {
    id: 'BE.NMBS.008821006',
    atId: 'http://irail.be/stations/NMBS/008821006',
  },
  Brugge: {
    id: 'BE.NMBS.008891009',
    atId: 'http://irail.be/stations/NMBS/008891009',
  },
}

const nonNegativeIntegerText = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

const positiveIntegerText = (value: unknown): number | undefined => {
  const parsed = nonNegativeIntegerText(value)
  return parsed !== undefined && parsed > 0 ? parsed : undefined
}

const parseRequestUrl = (api: ApiDemo, value?: string): LiveboardRequest | undefined => {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'api.irail.be' || url.port || url.username || url.password || url.hash || url.pathname !== '/liveboard/') return undefined
    const entries = [...url.searchParams.entries()]
    if (entries.length !== 5 || new Set(entries.map(([key]) => key)).size !== 5) return undefined
    const station = url.searchParams.get('station') ?? ''
    const direction = url.searchParams.get('arrdep')
    const stationContract = stationContracts[station]
    if (!stationContract || (direction !== 'departure' && direction !== 'arrival')) return undefined
    if (url.searchParams.get('format') !== 'json' || url.searchParams.get('lang') !== 'en' || url.searchParams.get('alerts') !== 'false') return undefined
    if (url.toString() !== api.buildUrl({ station, direction })) return undefined
    return { station, direction, stationContract }
  } catch {
    return undefined
  }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext): LiveboardRequest | undefined => {
  const displayed = parseRequestUrl(api, requestUrl)
  if (!displayed || !executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return undefined
  const executed = parseRequestUrl(api, executedRequest.url)
  if (!executed || executed.station !== displayed.station || executed.direction !== displayed.direction) return undefined
  return displayed
}

const parseService = (value: unknown): Service | undefined => {
  if (!isRecord(value)) return undefined
  const id = typeof value.id === 'string' && /^(?:0|[1-9]\d*)$/.test(value.id) ? value.id : undefined
  const time = positiveIntegerText(value.time)
  const delay = nonNegativeIntegerText(value.delay)
  const canceled = value.canceled === '0' ? false : value.canceled === '1' ? true : undefined
  const station = trimmedText(value.station)
  const vehicle = trimmedText(value.vehicle)
  const platform = optionalTrimmedText(value.platform)
  if (!id || time === undefined || delay === undefined || canceled === undefined || !station || !vehicle || platform.malformed) return undefined
  return { id, time, delay, canceled, station, vehicle, platform: platform.value, incomplete: platform.value === undefined }
}

const invalidModel = (reason: string, request?: LiveboardRequest): LiveboardModel => ({
  state: 'invalid',
  reason,
  requestBound: false,
  request,
  validServices: [],
  invalidServiceCount: 0,
  incompleteServiceCount: 0,
  countCoherent: false,
  envelopeMetadataValid: false,
})

const buildModel = (api: ApiDemo, data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): LiveboardModel => {
  const request = bindRequest(api, requestUrl, executedRequest)
  if (!request) return invalidModel('unsupported-executed-request')
  if (!isRecord(data)) return invalidModel('invalid-liveboard-envelope', request)

  const stationInfo = isRecord(data.stationinfo) ? data.stationinfo : undefined
  const providerStationId = stationInfo ? trimmedText(stationInfo.id) : undefined
  const providerStationAtId = stationInfo ? trimmedText(stationInfo['@id']) : undefined
  const providerStationName = stationInfo ? trimmedText(stationInfo.name) : undefined
  const providerStandardName = stationInfo ? trimmedText(stationInfo.standardname) : undefined
  const rootStation = trimmedText(data.station)
  if (
    providerStationId !== request.stationContract.id
    || providerStationAtId !== request.stationContract.atId
    || !providerStationName
    || rootStation !== providerStationName
  ) {
    return { ...invalidModel('provider-station-mismatch', request), providerStationId, providerStationName }
  }

  const boardKey = request.direction === 'departure' ? 'departures' : 'arrivals'
  const rowKey = request.direction
  const oppositeKey = request.direction === 'departure' ? 'arrivals' : 'departures'
  const board = isRecord(data[boardKey]) ? data[boardKey] : undefined
  if (!board || data[oppositeKey] !== undefined || !Array.isArray(board[rowKey])) {
    return { ...invalidModel('invalid-direction-envelope', request), providerStationId, providerStationName }
  }
  const providerCount = nonNegativeIntegerText(board.number)
  if (providerCount === undefined) {
    return { ...invalidModel('invalid-provider-count', request), providerStationId, providerStationName }
  }

  const validServices: Service[] = []
  const seenIds = new Set<string>()
  let invalidServiceCount = 0
  let incompleteServiceCount = 0
  for (const value of board[rowKey]) {
    const parsed = parseService(value)
    if (!parsed || seenIds.has(parsed.id)) {
      invalidServiceCount += 1
      continue
    }
    seenIds.add(parsed.id)
    validServices.push(parsed)
    if (parsed.incomplete) incompleteServiceCount += 1
  }

  const countCoherent = providerCount === board[rowKey].length
  const envelopeMetadataValid = Boolean(trimmedText(data.version)) && positiveIntegerText(data.timestamp) !== undefined && Boolean(providerStandardName)
  if (providerCount === 0 && board[rowKey].length === 0) {
    return {
      state: envelopeMetadataValid ? 'empty' : 'partial',
      reason: envelopeMetadataValid ? 'no-services' : 'incomplete-envelope-metadata',
      requestBound: true,
      request,
      providerStationId,
      providerStationName,
      providerCount,
      validServices,
      invalidServiceCount,
      incompleteServiceCount,
      countCoherent,
      envelopeMetadataValid,
    }
  }
  if (!validServices.length) {
    return {
      ...invalidModel('no-trusted-services', request),
      providerStationId,
      providerStationName,
      providerCount,
      invalidServiceCount,
      countCoherent,
      envelopeMetadataValid,
    }
  }

  const partial = !countCoherent || invalidServiceCount > 0 || incompleteServiceCount > 0 || !envelopeMetadataValid
  return {
    state: partial ? 'partial' : 'ready',
    reason: partial ? 'incomplete-liveboard-evidence' : 'trusted-liveboard',
    requestBound: true,
    request,
    providerStationId,
    providerStationName,
    providerCount,
    validServices,
    invalidServiceCount,
    incompleteServiceCount,
    countCoherent,
    envelopeMetadataValid,
  }
}

const serviceTime = (epochSeconds: number) => new Intl.DateTimeFormat('en-BE', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Europe/Brussels',
}).format(new Date(epochSeconds * 1000))

const serviceLabel = (service: Service) => service.vehicle.replace(/^BE\.NMBS\./, '')

export function IRailLiveboardPreview({ api, data, requestUrl, executedRequest }: {
  api: ApiDemo
  data: unknown
  requestUrl?: string
  executedRequest?: ExecutedRequestContext
}) {
  const model = buildModel(api, data, requestUrl, executedRequest)
  const direction = model.request?.direction
  const pluralDirection = direction === 'arrival' ? 'arrivals' : 'departures'
  const attrs = {
    'data-domain-card': 'irail-liveboard',
    'data-result-state': model.state,
    'data-result-reason': model.reason,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': 'exact-irail-liveboard-bodyless-get',
    'data-board-direction': direction,
    'data-requested-station': model.request?.station,
    'data-provider-station-id': model.providerStationId,
    'data-provider-count': model.providerCount,
    'data-valid-service-count': model.validServices.length,
    'data-invalid-service-count': model.invalidServiceCount,
    'data-incomplete-service-count': model.incompleteServiceCount,
    'data-count-coherent': String(model.countCoherent),
  }

  if (model.state === 'invalid') {
    return <section {...attrs} className="weather-empty" aria-label="iRail liveboard evidence">
      <strong>Liveboard response not trusted</strong>
      <span>The response did not match the exact iRail request, station identity, or board envelope.</span>
    </section>
  }
  if (model.state === 'empty') {
    return <section {...attrs} className="weather-empty" aria-label="iRail liveboard evidence">
      <strong>No {pluralDirection} reported</strong>
      <span>iRail returned a request-bound empty board for {model.providerStationName}.</span>
    </section>
  }

  const shown = model.validServices.slice(0, 10)
  const heading = direction === 'arrival' ? 'Arrivals' : 'Departures'
  return <section {...attrs} className="transit-preview" aria-label="iRail liveboard evidence">
    <div className="transit-summary">
      <span>Belgian rail liveboard</span>
      <strong>{model.validServices.length}</strong>
      <b>{heading} at {model.providerStationName}</b>
      <small>Request-bound platform, timing, delay, and cancellation evidence</small>
    </div>
    {model.state === 'partial' ? <p role="status">
      Partial liveboard: {[
        model.invalidServiceCount > 0
          ? model.invalidServiceCount === 1 ? 'one malformed service was withheld' : `${model.invalidServiceCount} malformed services were withheld`
          : undefined,
        model.incompleteServiceCount > 0
          ? model.incompleteServiceCount === 1 ? 'one trusted service has incomplete optional platform evidence' : `${model.incompleteServiceCount} trusted services have incomplete optional platform evidence`
          : undefined,
        !model.countCoherent ? 'the provider count does not match the returned service list' : undefined,
        !model.envelopeMetadataValid ? 'the liveboard envelope metadata is incomplete' : undefined,
      ].filter(Boolean).join('; ')}.
    </p> : null}
    <div className="transit-routes">
      {shown.map((service) => <article
        key={service.id}
        data-service-id={service.id}
        data-service-status={service.canceled ? 'cancelled' : service.delay > 0 ? 'delayed' : 'on-schedule'}
        style={{ '--route-color': service.canceled ? '#b42318' : service.delay > 0 ? '#d97706' : '#16805b' } as CSSProperties}
      >
        <span>{service.platform ?? '—'}</span>
        <div>
          <small>{service.canceled ? 'Cancelled' : service.delay > 0 ? `Delayed ${Math.round(service.delay / 60)} min` : 'On schedule'}</small>
          <h3>{direction === 'arrival' ? 'From ' : 'To '}{service.station}</h3>
          <p>{serviceLabel(service)} · {serviceTime(service.time)}</p>
        </div>
        <em>{direction === 'arrival' ? 'Arrival' : 'Departure'}</em>
      </article>)}
    </div>
    {model.validServices.length > shown.length ? <small>Showing the first {shown.length} of {model.validServices.length} trusted services.</small> : null}
  </section>
}
