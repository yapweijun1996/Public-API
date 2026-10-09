import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { finiteNumber, isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

type RequestIdentity = { taxonName: string; perPage: number }
type BoundRequestIdentity = { request?: RequestIdentity; transportBound: boolean; invalidReason?: string }
type Privacy = 'open' | 'obscured' | 'private'
type Photo = { id: number; url: string; licenseCode: string | null; licenseLabel: string; attribution?: string }
type Observation = {
  id: number
  sourceUrl: string
  taxonId: number
  scientificName: string
  commonName?: string
  rank?: string
  observedOnDisplay?: string
  placeDisplay?: string
  privacyMinimized: boolean
  qualityGrade?: string
  privacy: Privacy
  coordinates?: { latitude: number; longitude: number }
  photo: Photo
}
type Result = {
  observations: Observation[]
  total: number
  providerCount: number
  providerPage: number
  providerPerPage: number
  malformed: number
  duplicates: number
  overflow: number
  supplementalMalformed: number
  obscured: number
  privateCount: number
  allRightsReservedPhotos: number
  privacyMinimizedCount: number
  countContract: boolean
}

const REQUEST_KEYS = ['taxon_name', 'per_page', 'photos'] as const
const LICENSES: Record<string, string> = {
  cc0: 'CC0',
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
  'cc-by-nc': 'CC BY-NC',
  'cc-by-nd': 'CC BY-ND',
  'cc-by-nc-sa': 'CC BY-NC-SA',
  'cc-by-nc-nd': 'CC BY-NC-ND',
}
const QUALITY = new Set(['casual', 'needs_id', 'research'])
const PRIVACY = new Set<Privacy>(['open', 'obscured', 'private'])

export const parseINaturalistRequest = (requestUrl?: string): RequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.origin !== 'https://api.inaturalist.org' || url.pathname !== '/v1/observations'
      || url.port || url.username || url.password || url.hash) return undefined
    if (keys.length !== REQUEST_KEYS.length || !REQUEST_KEYS.every((key) => keys.includes(key))
      || REQUEST_KEYS.some((key) => url.searchParams.getAll(key).length !== 1)
      || url.searchParams.get('photos') !== 'true') return undefined
    const rawTaxon = url.searchParams.get('taxon_name') ?? ''
    const taxonName = rawTaxon.trim()
    const rawPerPage = url.searchParams.get('per_page') ?? ''
    if (!taxonName || rawTaxon !== taxonName || !/^[1-9]\d*$/.test(rawPerPage)) return undefined
    const perPage = Number(rawPerPage)
    if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 10 || String(perPage) !== rawPerPage) return undefined
    return { taxonName, perPage }
  } catch {
    return undefined
  }
}

const bindINaturalistRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundRequestIdentity => {
  const request = parseINaturalistRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported iNaturalist observation search request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET iNaturalist observation search request.' }
  }
  const executed = parseINaturalistRequest(executedRequest.url)
  if (!executed || executed.taxonName !== request.taxonName || executed.perPage !== request.perPage) {
    return { request, transportBound: false, invalidReason: 'The displayed iNaturalist request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const httpsUrl = (value: unknown) => {
  const text = trimmedText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const sourceUrl = (value: unknown, id: number) => {
  const href = httpsUrl(value)
  if (!href) return undefined
  try {
    const url = new URL(href)
    return url.hostname === 'www.inaturalist.org' && !url.port && !url.search && !url.hash
      && url.pathname === `/observations/${id}` ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const parseLicense = (value: unknown): { code?: string | null; label?: string; malformed: boolean } => {
  if (value === null) return { code: null, label: 'All rights reserved', malformed: false }
  const code = trimmedText(value)?.toLowerCase()
  if (!code || !LICENSES[code]) return { malformed: true }
  return { code, label: LICENSES[code], malformed: false }
}

const parsePhoto = (value: unknown) => {
  if (!isRecord(value)) return { malformed: true, supplementalMalformed: false }
  const id = positiveSafeInteger(value.id)
  const url = httpsUrl(value.url)
  const license = parseLicense(value.license_code)
  if (!id || !url || license.malformed || license.code === undefined || !license.label) {
    return { malformed: true, supplementalMalformed: false }
  }
  const attribution = value.attribution === undefined || value.attribution === null ? undefined : trimmedText(value.attribution)
  const supplementalMalformed = value.attribution !== undefined && value.attribution !== null && !attribution
  return {
    photo: { id, url, licenseCode: license.code, licenseLabel: license.label, attribution } as Photo,
    malformed: false,
    supplementalMalformed,
  }
}


const restrictedObservedOn = (value?: string) => {
  if (!value) return undefined
  const fullDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (fullDate) return `${fullDate[1]}-${fullDate[2]} (month only)`
  const month = /^(\d{4})-(\d{2})$/.exec(value)
  if (month) return `${month[1]}-${month[2]} (month only)`
  const year = /^(\d{4})$/.exec(value)
  if (year) return `${year[1]} (year only)`
  return 'Date detail withheld'
}

const optionalText = (value: unknown) => {
  if (value === undefined || value === null) return { value: undefined, malformed: false }
  const text = trimmedText(value)
  return { value: text, malformed: !text }
}

const parsePrivacy = (value: Record<string, unknown>) => {
  let malformed = false
  const read = (raw: unknown): Privacy | null | undefined => {
    if (raw === undefined) return undefined
    if (raw === null) return null
    if (typeof raw === 'string' && PRIVACY.has(raw as Privacy)) return raw as Privacy
    malformed = true
    return undefined
  }
  const userPrivacy = read(value.geoprivacy)
  const taxonPrivacy = read(value.taxon_geoprivacy)
  const obscured = value.obscured === undefined ? false
    : typeof value.obscured === 'boolean' ? value.obscured : (malformed = true, false)
  const privacy: Privacy = userPrivacy === 'private' || taxonPrivacy === 'private' ? 'private'
    : obscured || userPrivacy === 'obscured' || taxonPrivacy === 'obscured' ? 'obscured' : 'open'

  let coordinates: { latitude: number; longitude: number } | undefined
  if (value.geojson !== undefined && value.geojson !== null) {
    if (!isRecord(value.geojson) || value.geojson.type !== 'Point'
      || !Array.isArray(value.geojson.coordinates) || value.geojson.coordinates.length !== 2) malformed = true
    else {
      const longitude = finiteNumber(value.geojson.coordinates[0])
      const latitude = finiteNumber(value.geojson.coordinates[1])
      if (longitude === undefined || latitude === undefined || longitude < -180 || longitude > 180
        || latitude < -90 || latitude > 90 || privacy === 'private') malformed = true
      else coordinates = { latitude, longitude }
    }
  }
  return { privacy, coordinates, malformed }
}

const parseObservation = (value: unknown): { observation?: Observation; malformed: boolean; supplementalMalformed: boolean } => {
  if (!isRecord(value) || !isRecord(value.taxon) || !Array.isArray(value.photos)) {
    return { malformed: true, supplementalMalformed: false }
  }
  const id = positiveSafeInteger(value.id)
  const url = id ? sourceUrl(value.uri, id) : undefined
  const taxonId = positiveSafeInteger(value.taxon.id)
  const scientificName = trimmedText(value.taxon.name)
  if (!id || !url || !taxonId || !scientificName) return { malformed: true, supplementalMalformed: false }

  const parsedPhotos = value.photos.map(parsePhoto)
  const photos = parsedPhotos.flatMap((entry) => entry.photo ? [entry.photo] : [])
  if (!photos.length) return { malformed: true, supplementalMalformed: false }
  const seenPhotos = new Set<number>()
  const uniquePhotos = photos.filter((photo) => seenPhotos.has(photo.id) ? false : (seenPhotos.add(photo.id), true))
  const photo = uniquePhotos[0]
  if (!photo) return { malformed: true, supplementalMalformed: false }

  const commonName = optionalText(value.taxon.preferred_common_name)
  const rank = optionalText(value.taxon.rank)
  const observedOn = optionalText(value.observed_on)
  const placeGuess = optionalText(value.place_guess)
  const qualityGrade = optionalText(value.quality_grade)
  const privacy = parsePrivacy(value)
  const privacyMinimized = privacy.privacy !== 'open'
  const observedOnDisplay = privacyMinimized ? restrictedObservedOn(observedOn.value) : observedOn.value
  const placeDisplay = privacyMinimized ? undefined : placeGuess.value
  const observationLicense = value.license_code === undefined ? { malformed: false } : parseLicense(value.license_code)
  const supplementalMalformed = commonName.malformed || rank.malformed || observedOn.malformed || placeGuess.malformed
    || qualityGrade.malformed || Boolean(qualityGrade.value && !QUALITY.has(qualityGrade.value))
    || privacy.malformed || observationLicense.malformed
    || parsedPhotos.some((entry) => entry.malformed || entry.supplementalMalformed)
    || uniquePhotos.length !== photos.length

  return {
    observation: {
      id,
      sourceUrl: url,
      taxonId,
      scientificName,
      commonName: commonName.value,
      rank: rank.value,
      observedOnDisplay,
      placeDisplay,
      privacyMinimized,
      qualityGrade: qualityGrade.value,
      privacy: privacy.privacy,
      coordinates: privacy.coordinates,
      photo,
    },
    malformed: false,
    supplementalMalformed,
  }
}

export const parseINaturalistResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: RequestIdentity; result?: Result; transportBound: boolean; invalidReason?: string } => {
  const identity = bindINaturalistRequest(requestUrl, executedRequest)
  const request = identity.request
  if (!request || identity.invalidReason) return { request, transportBound: identity.transportBound, invalidReason: identity.invalidReason ?? 'The successful response was not tied to the exact supported iNaturalist observation search request.' }
  if (!isRecord(data) || !Array.isArray(data.results)) {
    return { request, transportBound: identity.transportBound, invalidReason: 'iNaturalist did not return the documented observation search envelope.' }
  }
  const total = nonNegativeSafeInteger(data.total_results)
  const providerPage = positiveSafeInteger(data.page)
  const providerPerPage = positiveSafeInteger(data.per_page)
  if (total === undefined || providerPage !== 1 || providerPerPage !== request.perPage) {
    return { request, transportBound: identity.transportBound, invalidReason: 'iNaturalist pagination metadata did not match the executed first-page request.' }
  }

  const parsed = data.results.map(parseObservation)
  const observations: Observation[] = []
  const seen = new Set<number>()
  let duplicates = 0
  let overflow = 0
  for (const entry of parsed) {
    if (!entry.observation) continue
    if (seen.has(entry.observation.id)) { duplicates += 1; continue }
    seen.add(entry.observation.id)
    if (observations.length >= request.perPage) { overflow += 1; continue }
    observations.push(entry.observation)
  }
  const providerCount = data.results.length
  const countContract = providerCount === Math.min(request.perPage, total)
  return {
    request,
    transportBound: identity.transportBound,
    result: {
      observations,
      total,
      providerCount,
      providerPage,
      providerPerPage,
      malformed: parsed.filter((entry) => entry.malformed).length,
      duplicates,
      overflow,
      supplementalMalformed: parsed.filter((entry) => entry.supplementalMalformed).length,
      obscured: observations.filter((entry) => entry.privacy === 'obscured').length,
      privateCount: observations.filter((entry) => entry.privacy === 'private').length,
      allRightsReservedPhotos: observations.filter((entry) => entry.photo.licenseCode === null).length,
      privacyMinimizedCount: observations.filter((entry) => entry.privacyMinimized).length,
      countContract,
    },
  }
}

const attrs = (request?: RequestIdentity, result?: Result, transportBound = false) => ({
  'data-domain-card': 'inaturalist-observations',
  'data-request-bound': request && transportBound ? 'true' : 'false',
  'data-request-contract': 'exact-inaturalist-photo-observations-v2',
  'data-request-taxon-name': request?.taxonName,
  'data-request-per-page': request?.perPage,
  'data-provider-total': result?.total,
  'data-provider-page': result?.providerPage,
  'data-provider-per-page': result?.providerPerPage,
  'data-provider-observation-count': result?.providerCount,
  'data-valid-observation-count': result?.observations.length,
  'data-malformed-observation-count': result?.malformed,
  'data-duplicate-observation-count': result?.duplicates,
  'data-overflow-observation-count': result?.overflow,
  'data-supplemental-malformed-count': result?.supplementalMalformed,
  'data-obscured-observation-count': result?.obscured,
  'data-private-observation-count': result?.privateCount,
  'data-all-rights-reserved-photo-count': result?.allRightsReservedPhotos,
  'data-privacy-minimized-observation-count': result?.privacyMinimizedCount,
  'data-count-contract': result ? String(result.countContract) : undefined,
  'data-primary-observation-id': result?.observations[0]?.id,
  'data-primary-photo-id': result?.observations[0]?.photo.id,
  'data-primary-photo-license': result?.observations[0]?.photo.licenseCode ?? (result?.observations[0] ? 'all-rights-reserved' : undefined),
})

const coordinateLabel = (value?: { latitude: number; longitude: number }) =>
  value ? `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)}` : 'No public coordinates returned'

export function INaturalistObservationsPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseINaturalistResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) {
    return <div className="domain-card domain-empty inaturalist-observations-preview" {...attrs(parsed.request, undefined, parsed.transportBound)} data-result-state="invalid"><h3>Invalid iNaturalist observation response</h3><p>{parsed.invalidReason}</p></div>
  }
  const { request, result, transportBound } = parsed
  if (result.providerCount === 0) {
    const empty = result.total === 0 && result.countContract
    const state = empty ? (transportBound ? 'empty' : 'partial') : 'invalid'
    return <div className="domain-card domain-empty inaturalist-observations-preview" {...attrs(request, result, transportBound)} data-result-state={state}><h3>{empty ? (transportBound ? 'No iNaturalist observations matched' : 'iNaturalist result not request-bound') : 'Invalid iNaturalist empty response'}</h3><p>{empty ? (transportBound ? `iNaturalist returned a coherent, exact-request-bound zero-result search for “${request.taxonName}”.` : `iNaturalist returned a coherent zero-result search for “${request.taxonName}”, but executed request evidence was unavailable.`) : 'The empty HTTP-success response did not match the first-page count contract.'}</p></div>
  }
  if (!result.observations.length) {
    return <div className="domain-card domain-empty inaturalist-observations-preview" {...attrs(request, result, transportBound)} data-result-state="invalid"><h3>Observation identity evidence unavailable</h3><p>Records were returned, but none carried trustworthy observation, taxon, source, and photo-rights identity.</p></div>
  }
  const partial = !transportBound || !result.countContract || result.malformed > 0 || result.duplicates > 0 || result.overflow > 0
    || result.supplementalMalformed > 0 || result.observations.length !== result.providerCount
  return <div className="domain-card inaturalist-observations-preview bounded-media-preview" {...attrs(request, result, transportBound)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">iNaturalist · Public biodiversity observations</small><h3>{request.taxonName}</h3><p>{transportBound ? 'Exact-request-bound' : 'Structurally coherent but not request-bound'} observation identity with per-photo licensing and public-location privacy semantics.</p></div><span className="domain-state">{result.observations.length} trusted observations</span></header>
    {partial && <p className="domain-note">{transportBound ? 'Only unique observations with trusted provider identity, taxon identity, source URL, and photo-rights evidence are shown. Malformed or contradictory evidence is withheld.' : 'The iNaturalist response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}</p>}
    <dl className="domain-facts"><div><dt>Total matches</dt><dd>{result.total.toLocaleString('en')}</dd></div><div><dt>Returned / requested</dt><dd>{result.providerCount} / {request.perPage}</dd></div><div><dt>Obscured public locations</dt><dd>{result.obscured}</dd></div><div><dt>Primary observation</dt><dd>{result.observations[0].id}</dd></div></dl>
    <div className={`media-preview ${result.observations.length === 1 ? 'single' : ''}`}>{result.observations.map((observation) =>
      <article key={observation.id} data-observation-id={observation.id} data-taxon-id={observation.taxonId} data-photo-id={observation.photo.id} data-photo-license={observation.photo.licenseCode ?? 'all-rights-reserved'} data-geoprivacy={observation.privacy}>
        <img src={observation.photo.url} alt={observation.commonName ?? observation.scientificName} loading="lazy"/>
        <div><small>{observation.qualityGrade ?? 'Observation'} · {observation.privacy === 'obscured' ? 'Obscured public location' : observation.privacy === 'private' ? 'Private location' : 'Open public location'}</small><h3>{observation.commonName ?? observation.scientificName}</h3><p><i>{observation.scientificName}</i>{observation.rank ? ` · ${observation.rank}` : ''}{observation.observedOnDisplay ? ` · ${observation.observedOnDisplay}` : ''}</p><p>{observation.privacyMinimized ? 'Sensitive location label withheld' : observation.placeDisplay ?? 'Place label unavailable'} · {coordinateLabel(observation.coordinates)}</p><p>Photo: {observation.photo.licenseLabel}{observation.photo.attribution ? ` · ${observation.photo.attribution}` : ''}</p><p><a href={observation.sourceUrl} target="_blank" rel="noreferrer">Observation source</a></p></div>
      </article>)}</div>
    <p className="domain-note">Photo rights are per media item: a missing Creative Commons license means all rights are reserved and reuse needs permission. For obscured observations, returned coordinates are provider-obscured public display coordinates; do not infer a more precise location.</p>
    {result.privacyMinimizedCount > 0 && <p className="domain-note">Privacy minimization: iNaturalist notes that API responses can still expose exact dates for obscured observations. This semantic preview coarsens restricted dates to month/year and withholds their place labels so it does not amplify location clues; Raw JSON remains the provider response.</p>}
  </div>
}
