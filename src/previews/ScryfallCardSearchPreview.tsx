import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, trimmedText } from './semanticValidation'

type ScryfallRequest = { query: string }
type ScryfallCard = {
  id: string
  name: string
  typeLine: string
  set: string
  setName: string
  collectorNumber: string
  scryfallUri: string
  imageUrl: string
}
type ScryfallResult = {
  cards: ScryfallCard[]
  providerCount: number
  totalCards: number
  hasMore: boolean
  nextPage?: string
  warnings: string[]
  malformed: number
  duplicates: number
  imageGaps: number
}
type BoundScryfallRequest = { request?: ScryfallRequest; transportBound: boolean; invalidReason?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const IMAGE_KEYS = ['normal', 'large', 'small', 'png', 'art_crop', 'border_crop'] as const

const httpsUrl = (value: unknown, hostname?: string): string | undefined => {
  const text = trimmedText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:') return undefined
    if (hostname && url.hostname !== hostname && !url.hostname.endsWith(`.${hostname}`)) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

const imageUrlFrom = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined
  for (const key of IMAGE_KEYS) {
    const image = httpsUrl(value[key], 'scryfall.io')
    if (image) return image
  }
  return undefined
}

export const parseScryfallRequest = (requestUrl?: string): ScryfallRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'api.scryfall.com' || url.port || url.username || url.password || url.hash || url.pathname !== '/cards/search') return undefined
    if (keys.length !== 1 || keys[0] !== 'q' || url.searchParams.getAll('q').length !== 1) return undefined
    const rawQuery = url.searchParams.get('q') ?? ''
    const query = rawQuery.trim()
    if (!query || rawQuery !== query) return undefined
    return { query }
  } catch {
    return undefined
  }
}

const bindScryfallRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundScryfallRequest => {
  const request = parseScryfallRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported Scryfall card search request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Scryfall card search request.' }
  }
  const executed = parseScryfallRequest(executedRequest.url)
  if (!executed || executed.query !== request.query) {
    return { request, transportBound: false, invalidReason: 'The displayed Scryfall request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const parseNextPage = (value: unknown, query: string): string | undefined => {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    const keys = [...url.searchParams.keys()]
    const rawQuery = url.searchParams.get('q') ?? ''
    const rawPage = url.searchParams.get('page') ?? ''
    const page = Number(rawPage)
    if (url.protocol !== 'https:' || url.hostname !== 'api.scryfall.com' || url.port || url.username || url.password || url.hash || url.pathname !== '/cards/search') return undefined
    if (!keys.includes('q') || !keys.includes('page') || url.searchParams.getAll('q').length !== 1 || url.searchParams.getAll('page').length !== 1 || rawQuery !== query || !/^[1-9]\d*$/.test(rawPage) || !Number.isSafeInteger(page)) return undefined
    if (keys.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

const parseCard = (value: unknown): { card?: ScryfallCard; malformed: boolean; imageGap: boolean } => {
  if (!isRecord(value)) return { malformed: true, imageGap: false }
  const id = trimmedText(value.id)
  const name = trimmedText(value.name)
  const typeLine = trimmedText(value.type_line)
  const set = trimmedText(value.set)
  const setName = trimmedText(value.set_name)
  const collectorNumber = trimmedText(value.collector_number)
  const scryfallUri = httpsUrl(value.scryfall_uri, 'scryfall.com')
  const baseValid = Boolean(id && UUID.test(id) && value.object === 'card' && name && typeLine && set && setName && collectorNumber && scryfallUri)
  if (!baseValid) return { malformed: true, imageGap: false }

  if (value.image_uris !== undefined && !isRecord(value.image_uris)) return { malformed: true, imageGap: false }
  if (value.card_faces !== undefined && (!Array.isArray(value.card_faces) || value.card_faces.some((face) => !isRecord(face)))) return { malformed: true, imageGap: false }
  const topLevelImage = imageUrlFrom(value.image_uris)
  const faceImage = Array.isArray(value.card_faces)
    ? value.card_faces.map((face) => isRecord(face) ? imageUrlFrom(face.image_uris) : undefined).find((image): image is string => Boolean(image))
    : undefined
  const imageUrl = topLevelImage ?? faceImage
  if (!imageUrl) return { malformed: false, imageGap: true }
  return { card: { id: id!.toLowerCase(), name: name!, typeLine: typeLine!, set: set!, setName: setName!, collectorNumber: collectorNumber!, scryfallUri: scryfallUri!, imageUrl }, malformed: false, imageGap: false }
}

export const parseScryfallResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: ScryfallRequest; result?: ScryfallResult; transportBound: boolean; invalidReason?: string } => {
  const identity = bindScryfallRequest(requestUrl, executedRequest)
  const request = identity.request
  if (!request || identity.invalidReason) return { request, transportBound: false, invalidReason: identity.invalidReason ?? 'The successful response was not tied to the exact supported Scryfall card search request.' }
  if (!isRecord(data) || data.object !== 'list' || !Array.isArray(data.data)) return { request, transportBound: identity.transportBound, invalidReason: 'Scryfall did not return its documented list response.' }
  const totalCards = nonNegativeSafeInteger(data.total_cards)
  if (totalCards === undefined || typeof data.has_more !== 'boolean') return { request, transportBound: identity.transportBound, invalidReason: 'Scryfall list pagination metadata was not represented by native values.' }
  const warnings = data.warnings === undefined
    ? []
    : Array.isArray(data.warnings) && data.warnings.every((warning) => typeof warning === 'string')
      ? data.warnings.map((warning) => warning.trim())
      : undefined
  if (!warnings) return { request, transportBound: identity.transportBound, invalidReason: 'Scryfall warnings were not represented as a native string array.' }
  const cardinalityCoherent = data.data.length <= totalCards && (data.has_more ? data.data.length > 0 && totalCards > data.data.length : data.data.length === totalCards)
  const nextPage = data.next_page === undefined ? undefined : parseNextPage(data.next_page, request.query)
  if (!cardinalityCoherent || (data.has_more && !nextPage) || (!data.has_more && data.next_page !== undefined)) return { request, transportBound: identity.transportBound, invalidReason: 'Scryfall list cardinality or continuation metadata was contradictory.' }

  const parsed = data.data.map(parseCard)
  const seen = new Set<string>()
  const cards: ScryfallCard[] = []
  let duplicates = 0
  for (const entry of parsed) {
    if (!entry.card) continue
    if (seen.has(entry.card.id)) { duplicates += 1; continue }
    seen.add(entry.card.id)
    cards.push(entry.card)
  }
  return { request, transportBound: identity.transportBound, result: {
    cards,
    providerCount: data.data.length,
    totalCards,
    hasMore: data.has_more,
    nextPage,
    warnings,
    malformed: parsed.filter((entry) => entry.malformed).length,
    duplicates,
    imageGaps: parsed.filter((entry) => entry.imageGap).length,
  } }
}


const attrs = (request?: ScryfallRequest, result?: ScryfallResult, transportBound = false) => ({
  'data-domain-card': 'scryfall-card-search',
  'data-request-bound': request && transportBound ? 'true' : 'false',
  'data-request-contract': 'exact-scryfall-card-search-v2',
  'data-request-query': request?.query,
  'data-provider-card-count': result?.providerCount,
  'data-provider-total-cards': result?.totalCards,
  'data-provider-has-more': result?.hasMore,
  'data-valid-card-count': result?.cards.length,
  'data-malformed-card-count': result?.malformed,
  'data-duplicate-card-count': result?.duplicates,
  'data-image-gap-count': result?.imageGaps,
  'data-warning-count': result?.warnings.length,
  'data-next-page-bound': result?.nextPage && transportBound ? 'true' : 'false',
  'data-primary-card-id': result?.cards[0]?.id,
})


export function ScryfallCardSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseScryfallResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request, undefined, parsed.transportBound)} data-result-state="invalid"><h3>Invalid Scryfall card search response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  const partial = !parsed.transportBound || result.warnings.length > 0 || result.malformed > 0 || result.duplicates > 0 || result.imageGaps > 0 || result.cards.length !== result.providerCount
  if (!result.providerCount && result.totalCards === 0) {
    const state = !parsed.transportBound || result.warnings.length ? 'partial' : 'empty'
    const heading = result.warnings.length ? 'Scryfall returned warnings' : parsed.transportBound ? 'No Magic: The Gathering cards matched' : 'Scryfall result not request-bound'
    const detail = result.warnings.length ? result.warnings.join(' ') : parsed.transportBound ? `Scryfall returned a coherent, request-bound zero-result search for “${request.query}”.` : `Scryfall returned a coherent zero-result search for “${request.query}”, but executed request evidence was unavailable, so the result is not claimed as exact-request-bound.`
    return <div className="domain-card domain-empty" {...attrs(request, result, parsed.transportBound)} data-result-state={state}><h3>{heading}</h3><p>{detail}</p></div>
  }
  if (!result.cards.length) return <div className="domain-card domain-empty" {...attrs(request, result, parsed.transportBound)} data-result-state={result.warnings.length ? 'partial' : 'invalid'}><h3>Invalid Scryfall card identities</h3><p>Cards were returned, but none carried trustworthy Scryfall identity, card metadata, a Scryfall page, and valid Scryfall artwork.</p>{result.warnings.length ? <p>{result.warnings.join(' ')}</p> : null}</div>
  return <div className="domain-card scryfall-card-search-preview bounded-media-preview" {...attrs(request, result, parsed.transportBound)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Scryfall · Trading-card search</small><h3>{request.query}</h3><p>{parsed.transportBound ? 'Exact-request-bound card identity, set metadata, collector number, Scryfall page, and provider artwork.' : 'Structurally valid card evidence is visible, but executed request evidence was unavailable, so the result is not claimed as exact-request-bound.'}</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{result.cards.length} trusted cards</span></header>
    {!parsed.transportBound && <p className="domain-note">Executed request evidence was unavailable. The card records remain visible as partial evidence but are not marked ready.</p>}
    {partial && <p className="domain-note">Only cards with valid provider identity, required metadata, a Scryfall page, and valid Scryfall artwork are shown. Malformed, duplicate, and image-gap records are withheld.</p>}
    <dl className="domain-facts"><div><dt>Total matches</dt><dd>{result.totalCards.toLocaleString('en')}</dd></div><div><dt>Cards returned</dt><dd>{result.providerCount}</dd></div><div><dt>Trusted cards</dt><dd>{result.cards.length}</dd></div><div><dt>More available</dt><dd>{result.hasMore ? 'Yes' : 'No'}</dd></div></dl>
    {result.warnings.length ? <p className="domain-note">Provider warnings: {result.warnings.join(' ')}</p> : null}
    {result.hasMore && result.nextPage ? <p className="domain-note"><a href={result.nextPage} target="_blank" rel="noreferrer">Open Scryfall next page</a></p> : null}
    <div className={`media-preview ${result.cards.length === 1 ? 'single' : ''}`}>{result.cards.slice(0, 8).map((card) => <article key={card.id} data-card-id={card.id} data-set={card.set} data-collector-number={card.collectorNumber}><img src={card.imageUrl} alt={`${card.name} — ${card.setName} ${card.collectorNumber}`} loading="lazy"/><div><small>{card.setName} · {card.collectorNumber}</small><h3>{card.name}</h3><p>{card.typeLine}</p><p><a href={card.scryfallUri} target="_blank" rel="noreferrer">Open Scryfall card page</a></p></div></article>)}</div>
  </div>
}
