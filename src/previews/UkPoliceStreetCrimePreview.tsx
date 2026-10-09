import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts } from './cardPrimitives'
import { previewLabel } from './previewData'
import { isRecord, finiteNumber, trimmedText } from './semanticValidation'
import './ukStreetCrimeCards.css'

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'

type StreetCrimeRequest = {
  category: string
  latitude: number
  longitude: number
  latitudeText: string
  longitudeText: string
}

export type UkPoliceStreetCrime = {
  persistentId: string
  category: string
  month: string
  streetName?: string
  latitude: string
  longitude: string
  outcomeStatus?: string
  context?: string
}

export type UkPoliceStreetCrimeViewModel = {
  state: ResultState
  reason?: string
  requestBound: boolean
  request?: StreetCrimeRequest
  providerRecordCount: number
  validRecordCount: number
  invalidRecordCount: number
  duplicateRecordCount: number
  crimes: UkPoliceStreetCrime[]
}

const endpointPrefix = '/api/crimes-street/'

const coordinateField = (api: ApiDemo, id: string) => api.fields.find((field) => field.id === id)

const parseRequest = (api: ApiDemo, executedRequest?: ExecutedRequestContext): StreetCrimeRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const categoryField = api.fields.find((field) => field.id === 'category')
    const categoryOptions = categoryField?.options?.map((option) => option.value) ?? []
    const encodedCategory = url.pathname.slice(endpointPrefix.length)
    const category = decodeURIComponent(encodedCategory)
    const entries = [...url.searchParams.entries()]
    const latitudeText = url.searchParams.get('lat') ?? ''
    const longitudeText = url.searchParams.get('lng') ?? ''
    const latitude = Number(latitudeText)
    const longitude = Number(longitudeText)
    const latitudeDefinition = coordinateField(api, 'latitude')
    const longitudeDefinition = coordinateField(api, 'longitude')
    const exactQuery = entries.length === 2
      && entries.every(([key]) => key === 'lat' || key === 'lng')
      && url.searchParams.getAll('lat').length === 1
      && url.searchParams.getAll('lng').length === 1
    const exactPath = encodedCategory !== ''
      && !encodedCategory.includes('/')
      && `${endpointPrefix}${encodeURIComponent(category)}` === url.pathname
    const coordinatesValid = latitudeText !== ''
      && longitudeText !== ''
      && latitudeText === latitudeText.trim()
      && longitudeText === longitudeText.trim()
      && Number.isFinite(latitude)
      && Number.isFinite(longitude)
      && (latitudeDefinition?.min === undefined || latitude >= latitudeDefinition.min)
      && (latitudeDefinition?.max === undefined || latitude <= latitudeDefinition.max)
      && (longitudeDefinition?.min === undefined || longitude >= longitudeDefinition.min)
      && (longitudeDefinition?.max === undefined || longitude <= longitudeDefinition.max)
    if (url.protocol !== 'https:' || url.origin !== 'https://data.police.uk' || url.username || url.password || url.hash
      || !exactPath || !categoryOptions.includes(category) || !exactQuery || !coordinatesValid) return undefined
    return { category, latitude, longitude, latitudeText, longitudeText }
  } catch {
    return undefined
  }
}

const parseCrime = (value: unknown): UkPoliceStreetCrime | undefined => {
  if (!isRecord(value)) return undefined
  const persistentId = typeof value.persistent_id === 'string' && /^\S{64}$/.test(value.persistent_id) ? value.persistent_id : undefined
  const category = trimmedText(value.category)
  const month = trimmedText(value.month)
  const location = isRecord(value.location) ? value.location : undefined
  const latitude = location && typeof location.latitude === 'string' && location.latitude.trim() ? location.latitude.trim() : undefined
  const longitude = location && typeof location.longitude === 'string' && location.longitude.trim() ? location.longitude.trim() : undefined
  const numericLatitude = latitude === undefined ? undefined : finiteNumber(Number(latitude))
  const numericLongitude = longitude === undefined ? undefined : finiteNumber(Number(longitude))
  const street = location && isRecord(location.street) ? trimmedText(location.street.name) : undefined
  const outcome = isRecord(value.outcome_status) ? trimmedText(value.outcome_status.category) : trimmedText(value.outcome_status)
  if (!persistentId || persistentId.length !== 64 || !category || !month || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)
    || latitude === undefined || longitude === undefined || numericLatitude === undefined || numericLongitude === undefined
    || numericLatitude < -90 || numericLatitude > 90 || numericLongitude < -180 || numericLongitude > 180) return undefined
  return {
    persistentId,
    category,
    month,
    streetName: street,
    latitude,
    longitude,
    outcomeStatus: outcome,
    context: trimmedText(value.context),
  }
}

export const buildUkPoliceStreetCrimeViewModel = (api: ApiDemo, data: unknown, executedRequest?: ExecutedRequestContext): UkPoliceStreetCrimeViewModel => {
  const request = parseRequest(api, executedRequest)
  const providerRows = Array.isArray(data) ? data : undefined
  const providerRecordCount = providerRows?.length ?? 0
  const base = {
    requestBound: request !== undefined,
    request,
    providerRecordCount,
    validRecordCount: 0,
    invalidRecordCount: providerRecordCount,
    duplicateRecordCount: 0,
    crimes: [] as UkPoliceStreetCrime[],
  }
  if (!request) return { ...base, state: 'invalid', reason: 'The executed request was not the exact supported HTTPS UK Police street-crime request: one declared category path plus exactly one lat and lng query parameter.' }
  if (!providerRows) return { ...base, state: 'invalid', reason: 'The HTTP-success response was not the documented UK Police street-crime array.' }
  if (providerRows.length === 0) return { ...base, state: 'empty', invalidRecordCount: 0, reason: 'The UK Police API returned no street-crime rows for the exact executed request.' }

  const seenIds = new Set<string>()
  const crimes: UkPoliceStreetCrime[] = []
  let invalidRecordCount = 0
  let duplicateRecordCount = 0
  for (const row of providerRows) {
    const parsed = parseCrime(row)
    if (!parsed) {
      invalidRecordCount += 1
      continue
    }
    if (seenIds.has(parsed.persistentId)) {
      invalidRecordCount += 1
      duplicateRecordCount += 1
      continue
    }
    seenIds.add(parsed.persistentId)
    crimes.push(parsed)
  }
  const validRecordCount = crimes.length
  if (validRecordCount === 0) return {
    ...base,
    state: 'invalid',
    reason: 'The UK Police response contained rows, but none had a unique documented persistent_id, category, month, and usable provider location.',
    validRecordCount,
    invalidRecordCount,
    duplicateRecordCount,
    crimes,
  }
  const partial = invalidRecordCount > 0
  return {
    ...base,
    state: partial ? 'partial' : 'ready',
    reason: partial ? 'Only rows with a unique documented persistent_id and usable provider fields are shown; malformed or duplicate rows are withheld.' : undefined,
    validRecordCount,
    invalidRecordCount,
    duplicateRecordCount,
    crimes,
  }
}

const evidence = (model: UkPoliceStreetCrimeViewModel) => ({
  'data-result-state': model.state,
  'data-request-bound': String(model.requestBound),
  'data-request-contract': 'exact-uk-police-street-crime',
  'data-request-method': model.requestBound ? 'GET' : undefined,
  'data-request-category': model.request?.category,
  'data-request-latitude': model.request?.latitudeText,
  'data-request-longitude': model.request?.longitudeText,
  'data-provider-record-count': model.providerRecordCount,
  'data-valid-record-count': model.validRecordCount,
  'data-invalid-record-count': model.invalidRecordCount,
  'data-duplicate-record-count': model.duplicateRecordCount,
  'data-identity-field': 'persistent_id',
  'data-identity-fallback': 'none',
  'data-anonymised-locations': 'true',
  'data-primary-persistent-id': model.crimes[0]?.persistentId,
})

export function UkPoliceStreetCrimePreview({ api, data, executedRequest }: { api: ApiDemo; data: unknown; executedRequest?: ExecutedRequestContext }) {
  const model = buildUkPoliceStreetCrimeViewModel(api, data, executedRequest)
  const shellEvidence = evidence(model)
  if (model.state === 'invalid' || model.state === 'empty') return <div className="domain-card domain-empty uk-street-crime-preview" data-domain-card="uk-police-street-crime" {...shellEvidence}><h3>{model.state === 'empty' ? 'No street crimes returned' : 'UK Police street-crime evidence unavailable'}</h3><p>{model.reason}</p>{model.state === 'invalid' && <p>No fallback to the API <code>id</code> is used because the provider does not guarantee that field is stable.</p>}</div>

  return <div className="domain-card uk-street-crime-preview" data-domain-card="uk-police-street-crime" {...shellEvidence}>
    <CardHeading
      eyebrow="UK Home Office · Police street-level crime"
      title={`${model.validRecordCount} validated crime${model.validRecordCount === 1 ? '' : 's'}`}
      description={`Category ${previewLabel(model.request?.category ?? 'street crime')} near the requested point. Provider locations are approximate and anonymised.`}
    ><span className={`domain-state${model.state === 'partial' ? ' warning' : ''}`}>{model.state === 'partial' ? 'Partial validated batch' : 'Validated batch'}</span></CardHeading>
    {model.state === 'partial' && <p className="domain-note">{model.reason}</p>}
    <Facts items={[
      { label: 'Requested category', value: model.request?.category },
      { label: 'Requested point', value: `${model.request?.latitudeText}, ${model.request?.longitudeText}` },
      { label: 'Provider rows', value: model.providerRecordCount.toLocaleString('en') },
      { label: 'Validated rows', value: model.validRecordCount.toLocaleString('en') },
      { label: 'Withheld rows', value: model.invalidRecordCount.toLocaleString('en') },
      { label: 'Identity', value: 'persistent_id (64 characters)' },
    ]}/>
    <ol className="uk-street-crime-list" aria-label="Validated UK street-crime records">
      {model.crimes.map((crime) => <li key={crime.persistentId} data-persistent-id={crime.persistentId} data-crime-category={crime.category} data-crime-month={crime.month} data-location-latitude={crime.latitude} data-location-longitude={crime.longitude}>
        <header><div><small>{previewLabel(crime.category)} · {crime.month}</small><h4>{crime.streetName ?? 'Street name unavailable'}</h4></div><code>{crime.persistentId}</code></header>
        <Facts items={[
          { label: 'Category', value: previewLabel(crime.category) },
          { label: 'Month', value: crime.month },
          { label: 'Provider location', value: `${crime.latitude}, ${crime.longitude}` },
          { label: 'Outcome', value: crime.outcomeStatus ?? 'Not supplied' },
          ...(crime.context ? [{ label: 'Context', value: crime.context }] : []),
        ]}/>
      </li>)}
    </ol>
    <p className="domain-note">Locations are approximate/anonymised area-level context, not exact incident addresses or individual-level evidence. The stable identity is the documented <code>persistent_id</code>; rows without it are withheld rather than falling back to the provider <code>id</code>.</p>
  </div>
}
