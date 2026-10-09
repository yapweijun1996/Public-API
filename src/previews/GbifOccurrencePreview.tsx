import type { CSSProperties } from 'react'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { formatNumber } from './previewData'
import { finiteNumber, isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'

type GbifOccurrence = {
  key: number
  scientificName: string
  species?: string
  latitude: number
  longitude: number
  locality?: string
  eventDate?: string
  basisOfRecord?: string
}

type ViewModel = {
  state: ResultState
  requestBound: boolean
  scientificName?: string
  limit?: number
  providerCount?: number
  providerEndOfRecords?: boolean
  validRows: GbifOccurrence[]
  invalidRecordCount: number
  message?: string
}

const exactKeys = (params: URLSearchParams, expected: string[]) => {
  const actual = [...params.keys()].sort()
  const target = [...expected].sort()
  return actual.length === target.length && actual.every((key, index) => key === target[index] && params.getAll(key).length === 1)
}

function parseRequest(executedRequest?: ExecutedRequestContext) {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.protocol !== 'https:' || url.hostname !== 'api.gbif.org' || url.pathname !== '/v1/occurrence/search') return undefined
    if (!exactKeys(url.searchParams, ['scientificName', 'limit', 'hasCoordinate'])) return undefined
    const scientificName = trimmedText(url.searchParams.get('scientificName'))
    const limitRaw = url.searchParams.get('limit') ?? ''
    const limit = /^\d+$/.test(limitRaw) ? Number(limitRaw) : NaN
    if (!scientificName || !Number.isInteger(limit) || limit < 1 || limit > 20 || url.searchParams.get('hasCoordinate') !== 'true') return undefined
    return { scientificName, limit }
  } catch {
    return undefined
  }
}

function parseOccurrence(value: unknown, seen: Set<number>): GbifOccurrence | undefined {
  if (!isRecord(value)) return undefined
  const key = positiveSafeInteger(value.key)
  const scientificName = trimmedText(value.scientificName)
  const latitude = finiteNumber(value.decimalLatitude)
  const longitude = finiteNumber(value.decimalLongitude)
  if (key === undefined || seen.has(key) || !scientificName || latitude === undefined || longitude === undefined) return undefined
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return undefined
  seen.add(key)
  return {
    key,
    scientificName,
    species: trimmedText(value.species),
    latitude,
    longitude,
    locality: trimmedText(value.locality) ?? trimmedText(value.stateProvince) ?? trimmedText(value.country),
    eventDate: trimmedText(value.eventDate),
    basisOfRecord: trimmedText(value.basisOfRecord),
  }
}

export function buildGbifOccurrenceViewModel(data: unknown, executedRequest?: ExecutedRequestContext): ViewModel {
  const request = parseRequest(executedRequest)
  if (!request) return { state: 'invalid', requestBound: false, validRows: [], invalidRecordCount: 0, message: 'The executed request did not match the supported GBIF coordinate-search contract.' }
  if (!isRecord(data) || !Array.isArray(data.results)) return { state: 'invalid', requestBound: true, ...request, validRows: [], invalidRecordCount: 0, message: 'GBIF did not return the expected occurrence-search envelope.' }

  const offset = nonNegativeSafeInteger(data.offset)
  const providerLimit = positiveSafeInteger(data.limit)
  const count = nonNegativeSafeInteger(data.count)
  const endOfRecords = typeof data.endOfRecords === 'boolean' ? data.endOfRecords : undefined
  const results = data.results
  const expectedRows = count === undefined ? undefined : Math.min(request.limit, count)
  const paginationValid = offset === 0 && providerLimit === request.limit && count !== undefined && endOfRecords !== undefined
    && expectedRows === results.length && endOfRecords === (count <= request.limit)
  if (!paginationValid) return {
    state: 'invalid', requestBound: true, ...request, providerCount: count, providerEndOfRecords: endOfRecords,
    validRows: [], invalidRecordCount: results.length, message: 'GBIF pagination did not match the executed first-page request.'
  }
  if (count === 0) return {
    state: 'empty', requestBound: true, ...request, providerCount: 0, providerEndOfRecords: true,
    validRows: [], invalidRecordCount: 0, message: 'No mapped GBIF occurrences matched this scientific-name search.'
  }

  const seen = new Set<number>()
  const validRows: GbifOccurrence[] = []
  let invalidRecordCount = 0
  for (const candidate of results) {
    const parsed = parseOccurrence(candidate, seen)
    if (parsed) validRows.push(parsed)
    else invalidRecordCount += 1
  }
  const state: ResultState = validRows.length === 0 ? 'invalid' : invalidRecordCount > 0 ? 'partial' : 'ready'
  return {
    state, requestBound: true, ...request, providerCount: count, providerEndOfRecords: endOfRecords,
    validRows, invalidRecordCount,
    message: state === 'invalid' ? 'GBIF returned rows, but none had trustworthy native coordinates and unique occurrence identity.'
      : state === 'partial' ? `${invalidRecordCount} occurrence ${invalidRecordCount === 1 ? 'row was' : 'rows were'} withheld because identity or coordinate evidence was malformed.`
      : undefined,
  }
}

export function GbifOccurrencePreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const view = buildGbifOccurrenceViewModel(data, executedRequest)
  const points = view.validRows
  const lats = points.map((point) => point.latitude)
  const lons = points.map((point) => point.longitude)
  const latMin = lats.length ? Math.min(...lats) : 0
  const lonMin = lons.length ? Math.min(...lons) : 0
  const latRange = lats.length ? Math.max(...lats) - latMin || 1 : 1
  const lonRange = lons.length ? Math.max(...lons) - lonMin || 1 : 1
  const primary = points[0]

  return <div
    className="location-preview"
    data-domain-card="gbif-occurrence-map"
    data-result-state={view.state}
    data-request-bound={String(view.requestBound)}
    data-requested-scientific-name={view.scientificName}
    data-requested-limit={view.limit}
    data-provider-count={view.providerCount}
    data-provider-end-of-records={view.providerEndOfRecords === undefined ? undefined : String(view.providerEndOfRecords)}
    data-valid-record-count={points.length}
    data-invalid-record-count={view.invalidRecordCount}
    data-coordinate-contract={String(points.length > 0 && points.every((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)))}
    data-primary-latitude={primary?.latitude}
    data-primary-longitude={primary?.longitude}
  >
    {view.state === 'empty' ? <div className="weather-empty"><strong>No mapped GBIF occurrences</strong><span>{view.message}</span></div> : null}
    {view.state === 'invalid' ? <div className="weather-empty"><strong>GBIF occurrence evidence unavailable</strong><span>{view.message}</span></div> : null}
    {view.state === 'partial' && view.message ? <div className="preview-inline-note"><strong>Partial occurrence evidence</strong><span>{view.message}</span></div> : null}
    {points.length ? <>
      <div className="location-map" role="img" aria-label={`Map with ${points.length} validated GBIF occurrence ${points.length === 1 ? 'location' : 'locations'}`}>
        <span className="map-compass">N</span>
        {points.map((point, index) => <i key={point.key} style={{ '--point-x': `${10 + ((point.longitude - lonMin) / lonRange) * 80}%`, '--point-y': `${90 - ((point.latitude - latMin) / latRange) * 80}%` } as CSSProperties}><b>{index + 1}</b></i>)}
      </div>
      <ol>{points.slice(0, 8).map((point, index) => <li key={point.key} data-occurrence-key={point.key} data-latitude={point.latitude} data-longitude={point.longitude}>
        <span>{index + 1}</span><div><strong>{point.scientificName}</strong><small>{point.locality ?? 'Locality unavailable'} · {point.eventDate ?? 'Observation date unavailable'} · {formatNumber(point.latitude, 4)}, {formatNumber(point.longitude, 4)}</small></div>
      </li>)}</ol>
    </> : null}
  </div>
}
