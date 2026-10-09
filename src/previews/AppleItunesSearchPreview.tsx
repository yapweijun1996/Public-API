import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { finiteNumber, isRecord, nonNegativeSafeInteger, optionalTrimmedText, positiveSafeInteger, trimmedText } from './semanticValidation'

const APPLE_ENTITIES = ['song', 'musicTrack', 'album', 'musicArtist', 'musicVideo', 'mix', 'podcast', 'podcastAuthor'] as const
type AppleEntity = (typeof APPLE_ENTITIES)[number]
type AppleMedia = 'music' | 'podcast'
type AppleRequest = { query: string; entity: AppleEntity; media: AppleMedia; country: string; limit: number }
type AppleItem = {
  identity: string
  title: string
  artist: string
  collection?: string
  genre?: string
  releaseDate?: string
  durationMillis?: number
  explicitness?: string
  country?: string
  currency?: string
  price?: number
  storeUrl?: string
  typeLabel: string
  supplementalMalformed: boolean
}
type AppleResult = {
  items: AppleItem[]
  providerCount: number
  malformedCount: number
  duplicateCount: number
  supplementalMalformedCount: number
  promotionalAssetCount: number
}

const isAppleEntity = (value: string): value is AppleEntity => (APPLE_ENTITIES as readonly string[]).includes(value)
const expectedMedia = (entity: AppleEntity): AppleMedia => entity === 'podcast' || entity === 'podcastAuthor' ? 'podcast' : 'music'

export const parseAppleItunesRequest = (executedRequest?: ExecutedRequestContext): AppleRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const expectedKeys = ['term', 'media', 'entity', 'country', 'limit']
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'itunes.apple.com' || url.port || url.username || url.password || url.hash || url.pathname !== '/search'
      || keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))
      || expectedKeys.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined

    const rawQuery = url.searchParams.get('term') ?? ''
    const query = rawQuery.trim()
    const entityValue = url.searchParams.get('entity') ?? ''
    const mediaValue = url.searchParams.get('media') ?? ''
    const country = url.searchParams.get('country') ?? ''
    const rawLimit = url.searchParams.get('limit') ?? ''
    if (!query || query !== rawQuery || !isAppleEntity(entityValue) || mediaValue !== expectedMedia(entityValue)
      || !/^[a-z]{2}$/.test(country) || !/^[1-9]\d*$/.test(rawLimit)) return undefined
    const limit = Number(rawLimit)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20 || String(limit) !== rawLimit) return undefined
    return { query, entity: entityValue, media: mediaValue, country, limit }
  } catch {
    return undefined
  }
}

const appleStoreUrl = (value: unknown, country: string): { value?: string; malformed: boolean } => {
  const parsed = optionalTrimmedText(value)
  if (!parsed.value) return parsed
  try {
    const url = new URL(parsed.value)
    const allowedHost = url.hostname === 'music.apple.com' || url.hostname === 'podcasts.apple.com' || url.hostname === 'itunes.apple.com'
    const storefrontMatches = url.hostname === 'itunes.apple.com' || url.pathname.startsWith(`/${country}/`)
    if (url.protocol !== 'https:' || url.port || url.username || url.password || !allowedHost || !storefrontMatches) return { malformed: true }
    return { value: url.toString(), malformed: false }
  } catch {
    return { malformed: true }
  }
}

const optionalNativeInteger = (value: unknown) => {
  if (value === undefined || value === null) return { value: undefined, malformed: false }
  const parsed = nonNegativeSafeInteger(value)
  return { value: parsed, malformed: parsed === undefined }
}

const optionalNativeNumber = (value: unknown) => {
  if (value === undefined || value === null) return { value: undefined, malformed: false }
  const parsed = finiteNumber(value)
  return { value: parsed !== undefined && parsed >= 0 ? parsed : undefined, malformed: parsed === undefined || parsed < 0 }
}

const parseItem = (value: unknown, request: AppleRequest): { item?: AppleItem; malformed: boolean; promotionalAssets: number } => {
  if (!isRecord(value)) return { malformed: true, promotionalAssets: 0 }
  const promotionalAssets = ['artworkUrl30', 'artworkUrl60', 'artworkUrl100', 'previewUrl'].filter((key) => value[key] !== undefined && value[key] !== null).length
  const wrapper = trimmedText(value.wrapperType)
  const kind = trimmedText(value.kind)
  const artist = trimmedText(value.artistName)

  let id: number | undefined
  let title: string | undefined
  let storeLinkValue: unknown
  let typeLabel: string
  if (request.entity === 'album' || request.entity === 'mix') {
    if (wrapper !== 'collection') return { malformed: true, promotionalAssets }
    id = positiveSafeInteger(value.collectionId)
    title = trimmedText(value.collectionName)
    storeLinkValue = value.collectionViewUrl
    typeLabel = request.entity === 'album' ? 'Album' : 'Mix'
  } else if (request.entity === 'musicArtist' || request.entity === 'podcastAuthor') {
    if (wrapper !== 'artist') return { malformed: true, promotionalAssets }
    id = positiveSafeInteger(value.artistId)
    title = artist
    storeLinkValue = value.artistViewUrl
    typeLabel = request.entity === 'musicArtist' ? 'Music artist' : 'Podcast author'
  } else {
    const expectedKinds = request.entity === 'musicTrack' ? ['song', 'music-video'] : request.entity === 'musicVideo' ? ['music-video'] : [request.entity]
    if (wrapper !== 'track' || !kind || !expectedKinds.includes(kind)) return { malformed: true, promotionalAssets }
    id = positiveSafeInteger(value.trackId)
    title = trimmedText(value.trackName)
    storeLinkValue = value.trackViewUrl
    typeLabel = request.entity === 'podcast' ? 'Podcast' : kind === 'music-video' ? 'Music video' : 'Song'
  }
  if (!id || !title || !artist) return { malformed: true, promotionalAssets }

  const storeUrl = appleStoreUrl(storeLinkValue, request.country)
  const linkRequired = wrapper !== 'artist'
  if (linkRequired && !storeUrl.value) return { malformed: true, promotionalAssets }

  const collection = optionalTrimmedText(value.collectionName)
  const genre = optionalTrimmedText(value.primaryGenreName)
  const release = optionalTrimmedText(value.releaseDate)
  const duration = optionalNativeInteger(value.trackTimeMillis)
  const explicitness = optionalTrimmedText(value.trackExplicitness ?? value.collectionExplicitness)
  const country = optionalTrimmedText(value.country)
  const currency = optionalTrimmedText(value.currency)
  const price = optionalNativeNumber(value.trackPrice ?? value.collectionPrice)
  const releaseValid = !release.value || !Number.isNaN(Date.parse(release.value))
  const explicitnessValid = !explicitness.value || ['explicit', 'cleaned', 'notExplicit'].includes(explicitness.value)
  const countryValid = !country.value || /^[A-Z]{3}$/.test(country.value)
  const currencyValid = !currency.value || /^[A-Z]{3}$/.test(currency.value)
  const supplementalMalformed = storeUrl.malformed || collection.malformed || genre.malformed || release.malformed || duration.malformed
    || explicitness.malformed || country.malformed || currency.malformed || price.malformed || !releaseValid || !explicitnessValid || !countryValid || !currencyValid

  return {
    item: {
      identity: `${wrapper}:${id}`,
      title,
      artist,
      collection: collection.value,
      genre: genre.value,
      releaseDate: releaseValid ? release.value : undefined,
      durationMillis: duration.value,
      explicitness: explicitnessValid ? explicitness.value : undefined,
      country: countryValid ? country.value : undefined,
      currency: currencyValid ? currency.value : undefined,
      price: price.value,
      storeUrl: storeUrl.value,
      typeLabel,
      supplementalMalformed,
    },
    malformed: false,
    promotionalAssets,
  }
}

export const parseAppleItunesResponse = (data: unknown, executedRequest?: ExecutedRequestContext): { request?: AppleRequest; result?: AppleResult; invalidReason?: string } => {
  const request = parseAppleItunesRequest(executedRequest)
  if (!request) return { invalidReason: 'The successful response was not tied to the exact supported Apple Search API request.' }
  if (!isRecord(data) || !Array.isArray(data.results)) return { request, invalidReason: 'Apple did not return the documented resultCount and results response envelope.' }
  const providerCount = nonNegativeSafeInteger(data.resultCount)
  if (providerCount === undefined || providerCount !== data.results.length || providerCount > request.limit) {
    return { request, invalidReason: 'Apple resultCount must be a native non-negative integer matching the returned array and executed limit.' }
  }

  const parsed = data.results.map((value) => parseItem(value, request))
  const items: AppleItem[] = []
  const seen = new Set<string>()
  let duplicateCount = 0
  for (const entry of parsed) {
    if (!entry.item) continue
    if (seen.has(entry.item.identity)) { duplicateCount += 1; continue }
    seen.add(entry.item.identity)
    items.push(entry.item)
  }
  return { request, result: {
    items,
    providerCount,
    malformedCount: parsed.filter((entry) => entry.malformed).length,
    duplicateCount,
    supplementalMalformedCount: parsed.filter((entry) => entry.item?.supplementalMalformed).length,
    promotionalAssetCount: parsed.reduce((total, entry) => total + entry.promotionalAssets, 0),
  } }
}

const attributes = (request?: AppleRequest, result?: AppleResult) => ({
  'data-domain-card': 'apple-itunes-search',
  'data-request-bound': request ? 'true' : 'false',
  'data-request-contract': 'exact-apple-itunes-search-v1',
  'data-request-query': request?.query,
  'data-request-entity': request?.entity,
  'data-request-media': request?.media,
  'data-request-country': request?.country,
  'data-request-limit': request?.limit,
  'data-provider-record-count': result?.providerCount,
  'data-valid-record-count': result?.items.length,
  'data-malformed-record-count': result?.malformedCount,
  'data-duplicate-record-count': result?.duplicateCount,
  'data-supplemental-malformed-count': result?.supplementalMalformedCount,
  'data-promotional-asset-field-count': result?.promotionalAssetCount,
  'data-promotional-assets-embedded': 'false',
  'data-primary-media-identity': result?.items[0]?.identity,
})

const durationLabel = (milliseconds?: number) => {
  if (milliseconds === undefined) return undefined
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

const releaseLabel = (value?: string) => value ? new Date(value).toISOString().slice(0, 10) : undefined

export function AppleItunesSearchPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseAppleItunesResponse(data, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attributes(parsed.request)} data-result-state="invalid"><h3>Invalid Apple media response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  if (result.providerCount === 0) return <div className="domain-card domain-empty" {...attributes(request, result)} data-result-state="empty"><h3>No Apple media matched</h3><p>Apple returned a coherent zero-result {request.entity} search for “{request.query}” in the {request.country.toUpperCase()} storefront.</p></div>
  if (!result.items.length) return <div className="domain-card domain-empty" {...attributes(request, result)} data-result-state="invalid"><h3>Invalid Apple media identities</h3><p>Apple returned records, but none matched the executed result entity with native provider IDs and required Apple Store identity.</p></div>
  const partial = result.malformedCount > 0 || result.duplicateCount > 0 || result.supplementalMalformedCount > 0 || result.items.length !== result.providerCount
  return <div className="domain-card apple-itunes-search-preview" {...attributes(request, result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Apple Search API · {request.entity}</small><h3>{request.query}</h3><p>Exact-request-bound Apple catalog identities for the {request.country.toUpperCase()} storefront, without embedding promotional artwork or preview media.</p></div><span className="domain-state">{result.items.length} trusted results</span></header>
    {partial && <p className="domain-note">Malformed, duplicate, wrong-entity, or supplemental evidence is withheld or marked partial. Raw JSON retains the provider response.</p>}
    <dl className="domain-facts"><div><dt>Result type</dt><dd>{request.entity}</dd></div><div><dt>Storefront</dt><dd>{request.country.toUpperCase()}</dd></div><div><dt>Returned</dt><dd>{result.providerCount} / {request.limit}</dd></div><div><dt>Primary identity</dt><dd><code>{result.items[0].identity}</code></dd></div></dl>
    <ol className="itunes-media-list">{result.items.map((item) => <li key={item.identity} data-media-identity={item.identity} data-media-type={item.typeLabel}>
      <article><header><div><small>{item.typeLabel}{item.genre ? ` · ${item.genre}` : ''}</small><h3>{item.title}</h3></div><code>{item.identity}</code></header><p>{item.artist}{item.collection && item.collection !== item.title ? ` · ${item.collection}` : ''}</p><dl><div><dt>Release</dt><dd>{releaseLabel(item.releaseDate) ?? 'Unavailable'}</dd></div><div><dt>Duration</dt><dd>{durationLabel(item.durationMillis) ?? 'Unavailable'}</dd></div><div><dt>Explicitness</dt><dd>{item.explicitness ?? 'Unavailable'}</dd></div><div><dt>Store</dt><dd>{[item.country, item.currency, item.price === undefined ? undefined : item.price.toLocaleString('en', { maximumFractionDigits: 4 })].filter(Boolean).join(' · ') || 'Unavailable'}</dd></div></dl>{item.storeUrl ? <a href={item.storeUrl} target="_blank" rel="noreferrer">View on Apple</a> : <span>Apple Store link unavailable</span>}</article>
    </li>)}</ol>
    <p className="domain-note">Apple does not echo the search query in this response, so the card validates the exact executed request and returned provider identities without claiming relevance beyond Apple’s ordering. Artwork and audio/video previews are intentionally not embedded because Apple’s promotional-content terms require specific store-promotion, badge, attribution, streaming, and placement conditions.</p>
  </div>
}
