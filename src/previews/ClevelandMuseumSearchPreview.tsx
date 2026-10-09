import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, optionalTrimmedText, positiveSafeInteger, trimmedText } from './semanticValidation'

type ClevelandRequest = { query: string; limit: number }
type ClevelandRequestIdentity = { request?: ClevelandRequest; transportBound: boolean; invalidReason?: string }
type Artwork = {
  id: number
  accessionNumber: string
  title: string
  imageUrl: string
  sourceUrl: string
  license: 'CC0'
  creators: string[]
  creationDate?: string
  artworkType?: string
  supplementalMalformed: boolean
}
type ClevelandResult = {
  artworks: Artwork[]
  total: number
  providerCount: number
  malformed: number
  duplicates: number
  overflow: number
  licenseGaps: number
  supplementalMalformed: number
  countContract: boolean
}

const ORIGIN = 'https://openaccess-api.clevelandart.org'
const KEYS = ['q', 'limit', 'has_image', 'cc0']

const httpsClevelandUrl = (value: unknown) => {
  const text = trimmedText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    return url.protocol === 'https:' && (url.hostname === 'clevelandart.org' || url.hostname.endsWith('.clevelandart.org')) ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export const parseClevelandMuseumRequest = (requestUrl?: string): ClevelandRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.origin !== ORIGIN || url.pathname !== '/api/artworks/' || url.port || url.username || url.password || url.hash) return undefined
    if (keys.length !== KEYS.length || !KEYS.every((key) => keys.includes(key)) || KEYS.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    if (url.searchParams.get('has_image') !== '1' || url.searchParams.get('cc0') !== '') return undefined
    const rawQuery = url.searchParams.get('q') ?? ''
    const query = rawQuery.trim()
    const rawLimit = url.searchParams.get('limit') ?? ''
    if (!query || query !== rawQuery || !/^[1-9]\d*$/.test(rawLimit)) return undefined
    const limit = Number(rawLimit)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10 || String(limit) !== rawLimit) return undefined
    return { query, limit }
  } catch {
    return undefined
  }
}

const bindClevelandMuseumRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): ClevelandRequestIdentity => {
  const request = parseClevelandMuseumRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The successful response was not tied to the exact supported Cleveland Museum CC0 image search request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Cleveland Museum request.' }
  }
  const executed = parseClevelandMuseumRequest(executedRequest.url)
  if (!executed || executed.query !== request.query || executed.limit !== request.limit) {
    return { request, transportBound: false, invalidReason: 'The displayed Cleveland Museum request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const parseArtwork = (value: unknown): { artwork?: Artwork; malformed: boolean; licenseGap: boolean; supplementalMalformed: boolean } => {
  if (!isRecord(value)) return { malformed: true, licenseGap: false, supplementalMalformed: false }
  const id = positiveSafeInteger(value.id)
  const accessionNumber = trimmedText(value.accession_number)
  const title = trimmedText(value.title)
  const license = trimmedText(value.share_license_status)
  const sourceUrl = httpsClevelandUrl(value.url)
  const images = isRecord(value.images) ? value.images : undefined
  const webImage = images && isRecord(images.web) ? images.web : undefined
  const imageUrl = webImage ? httpsClevelandUrl(webImage.url) : undefined
  const licenseGap = license !== 'CC0'
  if (!id || !accessionNumber || !title || !sourceUrl || !imageUrl || licenseGap) return { malformed: true, licenseGap, supplementalMalformed: false }

  let supplementalMalformed = false
  const creators: string[] = []
  if (value.creators !== undefined && value.creators !== null) {
    if (!Array.isArray(value.creators)) supplementalMalformed = true
    else for (const creator of value.creators) {
      if (!isRecord(creator)) { supplementalMalformed = true; continue }
      const description = optionalTrimmedText(creator.description)
      if (description.malformed) supplementalMalformed = true
      if (description.value) creators.push(description.value)
    }
  }
  const creationDate = optionalTrimmedText(value.creation_date)
  const artworkType = optionalTrimmedText(value.type)
  supplementalMalformed ||= creationDate.malformed || artworkType.malformed

  return {
    artwork: { id, accessionNumber, title, imageUrl, sourceUrl, license: 'CC0', creators, creationDate: creationDate.value, artworkType: artworkType.value, supplementalMalformed },
    malformed: false,
    licenseGap: false,
    supplementalMalformed,
  }
}

export const parseClevelandMuseumResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: ClevelandRequest; result?: ClevelandResult; transportBound: boolean; invalidReason?: string } => {
  const identity = bindClevelandMuseumRequest(requestUrl, executedRequest)
  const request = identity.request
  if (!request || identity.invalidReason) return { request, transportBound: false, invalidReason: identity.invalidReason }
  if (!isRecord(data) || !isRecord(data.info) || !Array.isArray(data.data)) return { request, transportBound: identity.transportBound, invalidReason: 'The museum did not return the documented info plus data response envelope.' }
  const total = nonNegativeSafeInteger(data.info.total)
  const parameters = isRecord(data.info.parameters) ? data.info.parameters : undefined
  if (total === undefined || !parameters) return { request, transportBound: identity.transportBound, invalidReason: 'The museum response did not include native integer total and request-parameter acknowledgement.' }
  const skip = nonNegativeSafeInteger(parameters.skip)
  const limit = positiveSafeInteger(parameters.limit)
  const q = trimmedText(parameters.q)
  const search = trimmedText(parameters.search)
  if (skip !== 0 || limit !== request.limit || q !== request.query || search !== request.query || parameters.has_image !== '1' || parameters.cc0 !== '') {
    return { request, transportBound: identity.transportBound, invalidReason: 'The provider request acknowledgement did not match the executed CC0 image search.' }
  }

  const parsed = data.data.map(parseArtwork)
  const artworks: Artwork[] = []
  const seenIds = new Set<number>()
  const seenAccessions = new Set<string>()
  let duplicates = 0
  let overflow = 0
  for (const entry of parsed) {
    if (!entry.artwork) continue
    if (seenIds.has(entry.artwork.id) || seenAccessions.has(entry.artwork.accessionNumber)) { duplicates += 1; continue }
    seenIds.add(entry.artwork.id)
    seenAccessions.add(entry.artwork.accessionNumber)
    if (artworks.length >= request.limit) { overflow += 1; continue }
    artworks.push(entry.artwork)
  }
  const providerCount = data.data.length
  const countContract = providerCount === Math.min(request.limit, total)
  return { request, transportBound: identity.transportBound, result: {
    artworks, total, providerCount,
    malformed: parsed.filter((entry) => entry.malformed).length,
    duplicates, overflow,
    licenseGaps: parsed.filter((entry) => entry.licenseGap).length,
    supplementalMalformed: parsed.filter((entry) => entry.supplementalMalformed).length,
    countContract,
  } }
}

const attrs = (request?: ClevelandRequest, result?: ClevelandResult, transportBound = false) => ({
  'data-domain-card': 'cleveland-museum-search',
  'data-request-bound': request && transportBound ? 'true' : 'false',
  'data-request-contract': 'exact-cleveland-cc0-image-search-v2',
  'data-request-query': request?.query,
  'data-request-limit': request?.limit,
  'data-provider-total': result?.total,
  'data-provider-artwork-count': result?.providerCount,
  'data-valid-artwork-count': result?.artworks.length,
  'data-malformed-artwork-count': result?.malformed,
  'data-duplicate-artwork-count': result?.duplicates,
  'data-overflow-artwork-count': result?.overflow,
  'data-license-gap-count': result?.licenseGaps,
  'data-supplemental-malformed-count': result?.supplementalMalformed,
  'data-count-contract': result ? String(result.countContract) : undefined,
  'data-primary-artwork-id': result?.artworks[0]?.id,
  'data-primary-accession-number': result?.artworks[0]?.accessionNumber,
  'data-primary-license': result?.artworks[0]?.license,
})

export function ClevelandMuseumSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseClevelandMuseumResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty cleveland-museum-search-preview" {...attrs(parsed.request, undefined, parsed.transportBound)} data-result-state="invalid"><h3>Invalid Cleveland Museum search response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result, transportBound } = parsed
  if (result.total === 0 && result.providerCount === 0) return <div className="domain-card domain-empty cleveland-museum-search-preview" {...attrs(request, result, transportBound)} data-result-state={transportBound ? 'empty' : 'partial'}><h3>{transportBound ? 'No CC0 artworks matched' : 'Unbound Cleveland Museum empty response'}</h3><p>{transportBound ? `The museum returned a coherent, request-bound zero-result search for “${request.query}”.` : 'The museum returned a coherent zero-result envelope, but executed request evidence was unavailable, so the result is not marked empty.'}</p></div>
  if (!result.artworks.length) return <div className="domain-card domain-empty cleveland-museum-search-preview" {...attrs(request, result, transportBound)} data-result-state="invalid"><h3>Artwork evidence unavailable</h3><p>Records were returned, but none carried trustworthy CMA artwork identity, CC0 status, source URL, and web-image evidence.</p></div>
  const partial = !transportBound || result.malformed > 0 || result.duplicates > 0 || result.overflow > 0 || result.licenseGaps > 0 || result.supplementalMalformed > 0 || !result.countContract || result.artworks.length !== result.providerCount
  return <div className="domain-card cleveland-museum-search-preview bounded-media-preview" {...attrs(request, result, transportBound)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Cleveland Museum of Art · CC0 open access</small><h3>{request.query}</h3><p>Exact-request-bound image-bearing artworks with provider inventory identity and explicit CC0 designation.</p></div><span className="domain-state">{result.artworks.length} trusted artworks</span></header>
    {partial && <p className="domain-note">{transportBound ? 'Only unique records with valid CMA artwork identity, CC0 status, source URL, and web-image evidence are shown. Contradictory or malformed evidence is withheld.' : 'The Cleveland Museum response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}</p>}
    <dl className="domain-facts"><div><dt>Total matches</dt><dd>{result.total.toLocaleString('en')}</dd></div><div><dt>Returned</dt><dd>{result.providerCount}</dd></div><div><dt>Trusted artworks</dt><dd>{result.artworks.length}</dd></div><div><dt>Primary accession</dt><dd>{result.artworks[0].accessionNumber}</dd></div></dl>
    <div className={`media-preview ${result.artworks.length === 1 ? 'single' : ''}`}>{result.artworks.map((artwork) => <article key={artwork.accessionNumber} data-artwork-id={artwork.id} data-accession-number={artwork.accessionNumber} data-license={artwork.license}><img src={artwork.imageUrl} alt={artwork.title} loading="lazy"/><div><small>Cleveland Museum of Art · {artwork.license}</small><h3>{artwork.title}</h3><p>{artwork.creators.length ? artwork.creators.join(', ') : 'Creator metadata unavailable'}{artwork.creationDate ? ` · ${artwork.creationDate}` : ''}</p><p>Accession {artwork.accessionNumber}{artwork.artworkType ? ` · ${artwork.artworkType}` : ''}</p><p><a href={artwork.sourceUrl} target="_blank" rel="noreferrer">Artwork source</a></p></div></article>)}</div>
    <p className="domain-note">CMA designates these returned records and image assets CC0. Its terms still disclaim warranties about third-party rights, so verify the source artwork page before reuse.</p>
  </div>
}
