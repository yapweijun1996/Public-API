import { ART_INSTITUTE_SEARCH_CONTRACT } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, optionalTrimmedText, positiveSafeInteger, trimmedText } from './semanticValidation'

type ArtInstituteRequest = { query: string; limit: number }
type ArtInstituteRequestIdentity = { request?: ArtInstituteRequest; transportBound: boolean; invalidReason?: string }
type Artwork = {
  id: number
  title: string
  artist?: string
  date?: string
  imageId: string
  imageUrl: string
  publicDomain: true
  supplementalMalformed: boolean
}
type ArtInstituteResult = {
  artworks: Artwork[]
  providerTotal: number
  providerLimit: number
  providerOffset: number
  providerTotalPages: number
  providerCurrentPage: number
  providerCount: number
  malformed: number
  duplicates: number
  overflow: number
  rightsGaps: number
  supplementalMalformed: number
  countContract: boolean
  iiifBase: string
}

const ORIGIN = 'https://api.artic.edu'
const PATH = '/api/v1/artworks/search'
const FILTER_KEY = 'query[term][is_public_domain]'
const REQUEST_KEYS = ['q', 'limit', 'fields', FILTER_KEY]

export const parseArtInstituteSearchRequest = (requestUrl?: string): ArtInstituteRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.origin !== ORIGIN || url.pathname !== PATH || url.port || url.username || url.password || url.hash) return undefined
    if (keys.length !== REQUEST_KEYS.length || !REQUEST_KEYS.every((key) => keys.includes(key)) || REQUEST_KEYS.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    const rawQuery = url.searchParams.get('q') ?? ''
    const query = rawQuery.trim()
    const rawLimit = url.searchParams.get('limit') ?? ''
    if (!query || query !== rawQuery || !/^[1-9]\d*$/.test(rawLimit)) return undefined
    const limit = Number(rawLimit)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > ART_INSTITUTE_SEARCH_CONTRACT.maxLimit || String(limit) !== rawLimit) return undefined
    if (url.searchParams.get('fields') !== ART_INSTITUTE_SEARCH_CONTRACT.fields || url.searchParams.get(FILTER_KEY) !== ART_INSTITUTE_SEARCH_CONTRACT.publicDomainFilter) return undefined
    return { query, limit }
  } catch {
    return undefined
  }
}

const bindArtInstituteSearchRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): ArtInstituteRequestIdentity => {
  const request = parseArtInstituteSearchRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The successful response was not tied to the exact supported Art Institute public-domain image search request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Art Institute search request.' }
  }
  const executed = parseArtInstituteSearchRequest(executedRequest.url)
  if (!executed || executed.query !== request.query || executed.limit !== request.limit) {
    return { request, transportBound: false, invalidReason: 'The displayed Art Institute request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const parseIiifBase = (value: unknown) => {
  const text = trimmedText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return undefined
    return url.toString().replace(/\/$/, '')
  } catch {
    return undefined
  }
}

const parseArtwork = (value: unknown, iiifBase: string): { artwork?: Artwork; malformed: boolean; rightsGap: boolean; supplementalMalformed: boolean } => {
  if (!isRecord(value)) return { malformed: true, rightsGap: false, supplementalMalformed: false }
  const id = positiveSafeInteger(value.id)
  const title = trimmedText(value.title)
  const imageId = trimmedText(value.image_id)
  const rightsGap = value.is_public_domain !== true
  if (!id || !title || !imageId || rightsGap) return { malformed: true, rightsGap, supplementalMalformed: false }
  const artist = optionalTrimmedText(value.artist_title)
  const date = optionalTrimmedText(value.date_display)
  const supplementalMalformed = artist.malformed || date.malformed
  return {
    artwork: {
      id,
      title,
      artist: artist.value,
      date: date.value,
      imageId,
      imageUrl: `${iiifBase}/${encodeURIComponent(imageId)}/full/843,/0/default.jpg`,
      publicDomain: true,
      supplementalMalformed,
    },
    malformed: false,
    rightsGap: false,
    supplementalMalformed,
  }
}

export const parseArtInstituteSearchResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: ArtInstituteRequest; result?: ArtInstituteResult; transportBound: boolean; invalidReason?: string } => {
  const identity = bindArtInstituteSearchRequest(requestUrl, executedRequest)
  const request = identity.request
  if (!request || identity.invalidReason) return { request, transportBound: false, invalidReason: identity.invalidReason }
  if (!isRecord(data) || !isRecord(data.pagination) || !isRecord(data.config) || !Array.isArray(data.data)) {
    return { request, transportBound: identity.transportBound, invalidReason: 'The Art Institute did not return the documented pagination, data, and config response envelope.' }
  }
  const providerTotal = nonNegativeSafeInteger(data.pagination.total)
  const providerLimit = positiveSafeInteger(data.pagination.limit)
  const providerOffset = nonNegativeSafeInteger(data.pagination.offset)
  const providerTotalPages = nonNegativeSafeInteger(data.pagination.total_pages)
  const providerCurrentPage = positiveSafeInteger(data.pagination.current_page)
  const iiifBase = parseIiifBase(data.config.iiif_url)
  if (providerTotal === undefined || providerLimit === undefined || providerOffset === undefined || providerTotalPages === undefined || providerCurrentPage === undefined || !iiifBase) {
    return { request, transportBound: identity.transportBound, invalidReason: 'Art Institute pagination must use native integers and config must supply a trustworthy HTTPS IIIF base.' }
  }
  const expectedPages = providerTotal === 0 ? 0 : Math.ceil(providerTotal / request.limit)
  if (providerLimit !== request.limit || providerOffset !== 0 || providerCurrentPage !== 1 || providerTotalPages !== expectedPages) {
    return { request, transportBound: identity.transportBound, invalidReason: 'Provider pagination did not acknowledge the executed first-page result limit.' }
  }

  const parsed = data.data.map((value) => parseArtwork(value, iiifBase))
  const artworks: Artwork[] = []
  const seenIds = new Set<number>()
  const seenImageIds = new Set<string>()
  let duplicates = 0
  let overflow = 0
  for (const entry of parsed) {
    if (!entry.artwork) continue
    if (seenIds.has(entry.artwork.id) || seenImageIds.has(entry.artwork.imageId)) { duplicates += 1; continue }
    seenIds.add(entry.artwork.id)
    seenImageIds.add(entry.artwork.imageId)
    if (artworks.length >= request.limit) { overflow += 1; continue }
    artworks.push(entry.artwork)
  }
  const providerCount = data.data.length
  const countContract = providerCount === Math.min(request.limit, providerTotal)
  return { request, transportBound: identity.transportBound, result: {
    artworks,
    providerTotal,
    providerLimit,
    providerOffset,
    providerTotalPages,
    providerCurrentPage,
    providerCount,
    malformed: parsed.filter((entry) => entry.malformed).length,
    duplicates,
    overflow,
    rightsGaps: parsed.filter((entry) => entry.rightsGap).length,
    supplementalMalformed: parsed.filter((entry) => entry.supplementalMalformed).length,
    countContract,
    iiifBase,
  } }
}

const stateAttrs = (request?: ArtInstituteRequest, result?: ArtInstituteResult, transportBound = false) => ({
  'data-domain-card': 'art-institute-search',
  'data-request-bound': request && transportBound ? 'true' : 'false',
  'data-request-contract': 'exact-art-institute-public-domain-image-search-v2',
  'data-request-query': request?.query,
  'data-request-limit': request?.limit,
  'data-provider-total': result?.providerTotal,
  'data-provider-limit': result?.providerLimit,
  'data-provider-offset': result?.providerOffset,
  'data-provider-total-pages': result?.providerTotalPages,
  'data-provider-current-page': result?.providerCurrentPage,
  'data-provider-artwork-count': result?.providerCount,
  'data-valid-artwork-count': result?.artworks.length,
  'data-malformed-artwork-count': result?.malformed,
  'data-duplicate-artwork-count': result?.duplicates,
  'data-overflow-artwork-count': result?.overflow,
  'data-rights-gap-count': result?.rightsGaps,
  'data-supplemental-malformed-count': result?.supplementalMalformed,
  'data-count-contract': result ? String(result.countContract) : undefined,
  'data-iiif-base': result?.iiifBase,
  'data-primary-artwork-id': result?.artworks[0]?.id,
  'data-primary-image-id': result?.artworks[0]?.imageId,
  'data-primary-public-domain': result?.artworks[0] ? 'true' : undefined,
})

export function ArtInstituteSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseArtInstituteSearchResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty art-institute-search-preview" {...stateAttrs(parsed.request, undefined, parsed.transportBound)} data-result-state="invalid"><h3>Invalid Art Institute search response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result, transportBound } = parsed
  if (result.providerCount === 0) {
    const coherentEmpty = result.providerTotal === 0 && result.countContract
    const state = coherentEmpty ? (transportBound ? 'empty' : 'partial') : 'invalid'
    return <div className="domain-card domain-empty art-institute-search-preview" {...stateAttrs(request, result, transportBound)} data-result-state={state}><h3>{state === 'empty' ? 'No public-domain artworks matched' : state === 'partial' ? 'Unbound Art Institute empty response' : 'Invalid Art Institute empty response'}</h3><p>{state === 'empty' ? `The Art Institute returned a coherent, request-bound zero-result search for “${request.query}”.` : state === 'partial' ? 'The Art Institute returned a coherent zero-result envelope, but executed request evidence was unavailable, so the result is not marked empty.' : 'The empty HTTP-success response did not include coherent first-page count evidence.'}</p></div>
  }
  if (!result.artworks.length) return <div className="domain-card domain-empty art-institute-search-preview" {...stateAttrs(request, result, transportBound)} data-result-state="invalid"><h3>Artwork evidence unavailable</h3><p>Records were returned, but none carried trustworthy native artwork identity, title, image identity, and explicit public-domain evidence.</p></div>
  const partial = !transportBound || !result.countContract || result.malformed > 0 || result.duplicates > 0 || result.overflow > 0 || result.rightsGaps > 0 || result.supplementalMalformed > 0 || result.artworks.length !== result.providerCount
  return <div className="domain-card art-institute-search-preview bounded-media-preview" {...stateAttrs(request, result, transportBound)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Art Institute of Chicago · Public-domain image search</small><h3>{request.query}</h3><p>Exact-request-bound artwork identities with provider-configured IIIF images and explicit public-domain evidence.</p></div><span className="domain-state">{result.artworks.length} trusted artworks</span></header>
    {partial && <p className="domain-note">{transportBound ? 'The request is bound, but some artwork, rights, or count evidence is incomplete. Malformed, duplicate, image-less, rights-ambiguous, and over-limit rows are withheld; Raw JSON retains the provider response.' : 'The Art Institute response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}</p>}
    <dl className="domain-facts"><div><dt>Total matches</dt><dd>{result.providerTotal.toLocaleString('en')}</dd></div><div><dt>Returned artworks</dt><dd>{result.providerCount} / {request.limit}</dd></div><div><dt>Primary artwork ID</dt><dd><code>{result.artworks[0].id}</code></dd></div><div><dt>Image rights</dt><dd>Public domain</dd></div></dl>
    <div className={`media-preview ${result.artworks.length === 1 ? 'single' : ''}`}>
      {result.artworks.map((artwork) => <article key={artwork.id} data-artwork-id={artwork.id} data-image-id={artwork.imageId} data-public-domain="true">
        <img src={artwork.imageUrl} alt={artwork.title} loading="lazy"/>
        <div><small>Art Institute of Chicago · Public domain</small><h3>{artwork.title}</h3><p>{[artwork.artist, artwork.date].filter(Boolean).join(' · ') || 'Artist and date unavailable'}</p><p>Artwork ID {artwork.id} · Image ID {artwork.imageId}</p></div>
      </article>)}
    </div>
    <p className="domain-note">Only records explicitly marked public domain are shown. The API response data is CC0 subject to provider terms; images are derived from the response’s IIIF configuration. Review the museum artwork record before downstream reuse.</p>
  </div>
}
