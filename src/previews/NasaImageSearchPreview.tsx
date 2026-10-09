import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, optionalTrimmedText, trimmedText } from './semanticValidation'

type NasaMediaType = 'image' | 'video' | 'audio'
type NasaRequest = { query: string; mediaType: NasaMediaType; limit: 8 }
type NasaRequestIdentity = { request?: NasaRequest; transportBound: boolean; invalidReason?: string }
type NasaMediaItem = { nasaId: string; title: string; mediaType: NasaMediaType; assetCollectionUrl: string; previewUrl?: string; center?: string; dateCreated?: string; description?: string; creator?: string }
type NasaResult = { items: NasaMediaItem[]; providerCount: number; totalHits: number; malformed: number; duplicates: number; overflow: number; previewGaps: number; supplementalMalformed: number }

const REQUEST_KEYS = ['q', 'media_type', 'page_size'] as const
const MEDIA_TYPES = new Set<NasaMediaType>(['image', 'video', 'audio'])
const FIXED_LIMIT = 8 as const
const NASA_USAGE_GUIDELINES = 'https://www.nasa.gov/nasa-brand-center/images-and-media/'

const httpsUrl = (value: unknown) => {
  const text = trimmedText(value)
  if (!text) return undefined
  try { const url = new URL(text); return url.protocol === 'https:' ? url.toString() : undefined } catch { return undefined }
}

const parseSearchIdentity = (url: URL, allowProviderHttpEcho = false): NasaRequest | undefined => {
  const allowedProtocol = url.protocol === 'https:' || (allowProviderHttpEcho && url.protocol === 'http:')
  const keys = [...url.searchParams.keys()]
  if (!allowedProtocol || url.hostname !== 'images-api.nasa.gov' || url.port || url.username || url.password || url.hash || url.pathname !== '/search') return undefined
  if (keys.length !== REQUEST_KEYS.length || !REQUEST_KEYS.every((key) => keys.includes(key)) || REQUEST_KEYS.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
  const rawQuery = url.searchParams.get('q') ?? ''
  const query = rawQuery.trim()
  const mediaType = url.searchParams.get('media_type') as NasaMediaType | null
  if (!query || query !== rawQuery || !mediaType || !MEDIA_TYPES.has(mediaType) || url.searchParams.get('page_size') !== String(FIXED_LIMIT)) return undefined
  return { query, mediaType, limit: FIXED_LIMIT }
}

export const parseNasaImageSearchRequest = (requestUrl?: string): NasaRequest | undefined => {
  if (!requestUrl) return undefined
  try { return parseSearchIdentity(new URL(requestUrl)) } catch { return undefined }
}

const bindNasaImageSearchRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): NasaRequestIdentity => {
  const request = parseNasaImageSearchRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The successful response was not tied to the exact supported NASA Image and Video Library search request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET NASA Image and Video Library request.' }
  }
  const executed = parseNasaImageSearchRequest(executedRequest.url)
  if (!executed || executed.query !== request.query || executed.mediaType !== request.mediaType || executed.limit !== request.limit) {
    return { request, transportBound: false, invalidReason: 'The displayed NASA request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const sameRequest = (left: NasaRequest, right: NasaRequest) => left.query === right.query && left.mediaType === right.mediaType && left.limit === right.limit
const parseProviderEcho = (value: unknown, request: NasaRequest): boolean => {
  const href = trimmedText(value)
  if (!href) return false
  try { const provider = parseSearchIdentity(new URL(href), true); return Boolean(provider && sameRequest(provider, request)) } catch { return false }
}

const assetCollectionIdentity = (value: unknown, mediaType: NasaMediaType, nasaId: string) => {
  const href = httpsUrl(value)
  if (!href) return undefined
  try {
    const url = new URL(href)
    if (url.hostname !== 'images-assets.nasa.gov' || url.port || url.username || url.password || url.search || url.hash) return undefined
    const prefix = `/${mediaType}/`
    const suffix = '/collection.json'
    if (!url.pathname.startsWith(prefix) || !url.pathname.endsWith(suffix)) return undefined
    const encodedIdentity = url.pathname.slice(prefix.length, -suffix.length)
    let decodedIdentity: string
    try { decodedIdentity = decodeURIComponent(encodedIdentity) } catch { return undefined }
    return decodedIdentity === nasaId ? url.toString() : undefined
  } catch { return undefined }
}

const previewImage = (value: unknown) => {
  if (!Array.isArray(value)) return undefined
  for (const candidate of value) {
    if (!isRecord(candidate) || candidate.rel !== 'preview' || candidate.render !== 'image') continue
    const href = httpsUrl(candidate.href)
    if (href) return href
  }
  return undefined
}

const parseItem = (value: unknown, request: NasaRequest): { item?: NasaMediaItem; malformed: boolean; previewGap: boolean; supplementalMalformed: boolean } => {
  if (!isRecord(value) || !Array.isArray(value.data) || value.data.length !== 1 || !isRecord(value.data[0])) return { malformed: true, previewGap: false, supplementalMalformed: false }
  const data = value.data[0]
  const nasaId = trimmedText(data.nasa_id)
  const title = trimmedText(data.title)
  const mediaType = trimmedText(data.media_type)
  if (!nasaId || !title || mediaType !== request.mediaType) return { malformed: true, previewGap: false, supplementalMalformed: false }
  const assetCollectionUrl = assetCollectionIdentity(value.href, request.mediaType, nasaId)
  if (!assetCollectionUrl) return { malformed: true, previewGap: false, supplementalMalformed: false }
  const center = optionalTrimmedText(data.center)
  const dateCreated = optionalTrimmedText(data.date_created)
  const description = optionalTrimmedText(data.description)
  const photographer = optionalTrimmedText(data.photographer)
  const secondaryCreator = optionalTrimmedText(data.secondary_creator)
  const previewUrl = previewImage(value.links)
  return {
    item: { nasaId, title, mediaType: request.mediaType, assetCollectionUrl, previewUrl, center: center.value, dateCreated: dateCreated.value, description: description.value, creator: photographer.value ?? secondaryCreator.value },
    malformed: false,
    previewGap: request.mediaType !== 'audio' && !previewUrl,
    supplementalMalformed: center.malformed || dateCreated.malformed || description.malformed || photographer.malformed || secondaryCreator.malformed || (value.links !== undefined && !Array.isArray(value.links)),
  }
}

export const parseNasaImageSearchResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: NasaRequest; result?: NasaResult; transportBound: boolean; invalidReason?: string } => {
  const identity = bindNasaImageSearchRequest(requestUrl, executedRequest)
  const request = identity.request
  if (!request || identity.invalidReason) return { request, transportBound: false, invalidReason: identity.invalidReason }
  if (!isRecord(data) || !isRecord(data.collection)) return { request, transportBound: identity.transportBound, invalidReason: 'NASA did not return the documented Collection+JSON search envelope.' }
  const collection = data.collection
  if (!['1.0', '1.1'].includes(String(collection.version)) || !Array.isArray(collection.items) || !isRecord(collection.metadata)) return { request, transportBound: identity.transportBound, invalidReason: 'NASA Collection+JSON version, items, or metadata did not match the documented search contract.' }
  if (!parseProviderEcho(collection.href, request)) return { request, transportBound: identity.transportBound, invalidReason: 'NASA did not echo the displayed query, media type, and page size in the search collection identity.' }
  const totalHits = nonNegativeSafeInteger(collection.metadata.total_hits)
  if (totalHits === undefined) return { request, transportBound: identity.transportBound, invalidReason: 'NASA total_hits was missing or was not a native non-negative integer.' }
  if (collection.items.length > totalHits && totalHits < request.limit) return { request, transportBound: identity.transportBound, invalidReason: 'NASA returned more search rows than its total-hit metadata permits.' }
  const parsed = collection.items.map((item) => parseItem(item, request))
  const seen = new Set<string>()
  const items: NasaMediaItem[] = []
  let duplicates = 0
  let overflow = 0
  for (const entry of parsed) {
    if (!entry.item) continue
    if (seen.has(entry.item.nasaId)) { duplicates += 1; continue }
    seen.add(entry.item.nasaId)
    if (items.length >= request.limit) { overflow += 1; continue }
    items.push(entry.item)
  }
  return { request, transportBound: identity.transportBound, result: { items, providerCount: collection.items.length, totalHits, malformed: parsed.filter((entry) => entry.malformed).length, duplicates, overflow, previewGaps: parsed.filter((entry) => entry.previewGap).length, supplementalMalformed: parsed.filter((entry) => entry.supplementalMalformed).length } }
}

const attrs = (request?: NasaRequest, result?: NasaResult, transportBound = false) => ({
  'data-domain-card': 'nasa-image-search',
  'data-request-bound': request && transportBound ? 'true' : 'false',
  'data-request-contract': 'exact-nasa-media-search-v2',
  'data-request-query': request?.query,
  'data-request-media-type': request?.mediaType,
  'data-request-limit': request?.limit,
  'data-provider-record-count': result?.providerCount,
  'data-provider-total-hits': result?.totalHits,
  'data-valid-record-count': result?.items.length,
  'data-malformed-record-count': result?.malformed,
  'data-duplicate-record-count': result?.duplicates,
  'data-overflow-record-count': result?.overflow,
  'data-preview-gap-count': result?.previewGaps,
  'data-supplemental-malformed-count': result?.supplementalMalformed,
  'data-primary-nasa-id': result?.items[0]?.nasaId,
})

const dateLabel = (value?: string) => {
  if (!value) return 'Date unavailable'
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : value
}

export function NasaImageSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseNasaImageSearchResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request, undefined, parsed.transportBound)} data-result-state="invalid"><h3>Invalid NASA media search response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result, transportBound } = parsed
  if (!result.providerCount && result.totalHits === 0) return <div className="domain-card domain-empty" {...attrs(request, result, transportBound)} data-result-state={transportBound ? 'empty' : 'partial'}><h3>{transportBound ? 'No NASA media matched' : 'Unbound NASA media search response'}</h3><p>{transportBound ? `NASA returned a coherent, request-bound zero-result ${request.mediaType} search for “${request.query}”.` : 'NASA returned a coherent zero-result search envelope, but executed request evidence was unavailable, so the result is not marked empty.'}</p></div>
  if (!result.items.length) return <div className="domain-card domain-empty" {...attrs(request, result, transportBound)} data-result-state="invalid"><h3>Invalid NASA media identities</h3><p>Records were returned, but none carried trustworthy NASA ID, media type, title, and asset-collection identity.</p></div>
  const expectedRows = Math.min(request.limit, result.totalHits)
  const partial = !transportBound || result.malformed > 0 || result.duplicates > 0 || result.overflow > 0 || result.previewGaps > 0 || result.supplementalMalformed > 0 || result.providerCount !== expectedRows || result.items.length !== expectedRows
  return <div className="domain-card nasa-image-search-preview bounded-media-preview" {...attrs(request, result, transportBound)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">NASA Image and Video Library · {request.mediaType}</small><h3>{request.query}</h3><p>Exact-request-bound NASA media with provider NASA ID identity, asset-collection evidence, and source metadata.</p></div><span className="domain-state">{result.items.length} trusted assets</span></header>
    {partial && <p className="domain-note">{transportBound ? 'Only records with valid NASA identity and asset-collection evidence are shown. Duplicate, malformed, contradictory, or incomplete preview evidence is withheld or marked partial.' : 'The NASA response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}</p>}
    <dl className="domain-facts"><div><dt>Total matches</dt><dd>{result.totalHits.toLocaleString('en')}</dd></div><div><dt>Trusted assets</dt><dd>{result.items.length}</dd></div><div><dt>Media type</dt><dd>{request.mediaType}</dd></div><div><dt>Primary NASA ID</dt><dd>{result.items[0].nasaId}</dd></div></dl>
    <div className={`media-preview ${result.items.length === 1 ? 'single' : ''}`}>{result.items.map((item) => <article key={item.nasaId} data-nasa-id={item.nasaId} data-media-type={item.mediaType}>
      {item.previewUrl ? <img src={item.previewUrl} alt={item.title} loading="lazy"/> : null}
      <div><small>{item.center ?? 'NASA'} · {dateLabel(item.dateCreated)}</small><h3>{item.title}</h3><p>{item.creator ? `Creator: ${item.creator}` : 'Creator metadata unavailable'}</p>{item.description ? <p>{item.description}</p> : null}<p><a href={item.assetCollectionUrl} target="_blank" rel="noreferrer">Asset collection</a></p></div>
    </article>)}</div>
    <p className="domain-note">NASA content is generally not subject to U.S. copyright, but NASA identifiers and some third-party material have separate restrictions. Acknowledge NASA as the source and review the <a href={NASA_USAGE_GUIDELINES} target="_blank" rel="noreferrer">NASA Media Usage Guidelines</a> before reuse.</p>
  </div>
}
