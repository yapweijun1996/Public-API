import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { compactNumber } from './previewData'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

const NOBEL_ORIGIN = 'https://api.nobelprize.org'
const REQUEST_CONTRACT = 'exact-nobel-prizes-category-limit-bodyless-get'

const categoryLabels: Record<string, string> = {
  che: 'Chemistry',
  eco: 'Economic Sciences',
  lit: 'Literature',
  pea: 'Peace',
  phy: 'Physics',
  med: 'Physiology or Medicine',
}

type NobelRequest = { category: string; limit: number }
type NobelTransport = { request?: NobelRequest; valid: boolean; bound: boolean }
type Laureate = { name: string; motivation?: string }
type NobelPrize = { awardYear: string; category: string; prizeAmount: number; laureates: Laureate[]; incomplete: boolean }
type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'

const parseRequestUrl = (api: ApiDemo, value?: string): NobelRequest | undefined => {
  if (api.id !== 'nobel-prizes' || !value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.origin !== NOBEL_ORIGIN || url.username || url.password || url.port || url.hash || url.pathname !== '/2.1/nobelPrizes') return undefined
    const keys = [...url.searchParams.keys()]
    if (keys.length !== 3 || keys[0] !== 'nobelPrizeCategory' || keys[1] !== 'limit' || keys[2] !== 'sort') return undefined
    if (url.searchParams.getAll('nobelPrizeCategory').length !== 1 || url.searchParams.getAll('limit').length !== 1 || url.searchParams.getAll('sort').length !== 1) return undefined
    const category = url.searchParams.get('nobelPrizeCategory') ?? ''
    const limitRaw = url.searchParams.get('limit') ?? ''
    if (!categoryLabels[category] || !/^[1-9]\d*$/.test(limitRaw) || url.searchParams.get('sort') !== 'desc') return undefined
    const limit = Number(limitRaw)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 12) return undefined
    return api.buildUrl({ category, limit: String(limit) }) === value ? { category, limit } : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext): NobelTransport => {
  const displayed = parseRequestUrl(api, requestUrl)
  if (!displayed) return { valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return { request: displayed, valid: false, bound: false }
  const executed = parseRequestUrl(api, executedRequest.url)
  return executed && executed.category === displayed.category && executed.limit === displayed.limit
    ? { request: executed, valid: true, bound: true }
    : { request: displayed, valid: false, bound: false }
}

const englishTranslation = (value: unknown) => isRecord(value) ? trimmedText(value.en) : undefined

const awardYear = (value: unknown): string | undefined => {
  if (typeof value === 'string' && /^\d{4}$/.test(value.trim())) return value.trim()
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1901 && value <= 9999) return String(value)
  return undefined
}

const parseLaureate = (value: unknown): Laureate | undefined => {
  if (!isRecord(value)) return undefined
  const name = englishTranslation(value.knownName) ?? englishTranslation(value.fullName) ?? englishTranslation(value.orgName)
  if (!name) return undefined
  return { name, motivation: englishTranslation(value.motivation) }
}

const parsePrize = (value: unknown, request: NobelRequest): NobelPrize | undefined => {
  if (!isRecord(value)) return undefined
  const year = awardYear(value.awardYear)
  const category = englishTranslation(value.category)
  const prizeAmount = positiveSafeInteger(value.prizeAmount)
  if (!year || category !== categoryLabels[request.category] || prizeAmount === undefined || !Array.isArray(value.laureates)) return undefined
  const laureates = value.laureates.map(parseLaureate).filter((item): item is Laureate => item !== undefined)
  return { awardYear: year, category, prizeAmount, laureates, incomplete: laureates.length !== value.laureates.length || laureates.some((item) => !item.motivation) }
}

const StateCard = ({ state, attrs, title, detail }: { state: Exclude<ResultState, 'ready'>; attrs: Record<string, string | undefined>; title: string; detail: string }) => (
  <section className="domain-card domain-empty" aria-label="Nobel Prize response evidence" data-domain-card="nobel-prizes" data-result-state={state} {...attrs}>
    <h3>{title}</h3><p>{detail}</p>
  </section>
)

export function NobelPrizePreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const transport = bindRequest(api, requestUrl, executedRequest)
  const root = isRecord(data) ? data : undefined
  const rows = root && Array.isArray(root.nobelPrizes) ? root.nobelPrizes : undefined
  const meta = root && isRecord(root.meta) ? root.meta : undefined
  const metaLimit = meta ? positiveSafeInteger(meta.limit) : undefined
  const metaCategory = meta ? trimmedText(meta.nobelPrizeCategory) : undefined
  const totalCount = meta ? nonNegativeSafeInteger(meta.count) : undefined
  const metaMatches = Boolean(transport.request && metaLimit === transport.request.limit && metaCategory === transport.request.category && totalCount !== undefined)
  const parsed = transport.request ? (rows ?? []).map((row) => parsePrize(row, transport.request as NobelRequest)) : []
  const prizes = parsed.filter((item): item is NobelPrize => item !== undefined)
  const invalidCount = parsed.length - prizes.length
  const incompleteCount = prizes.filter((prize) => prize.incomplete).length
  const providerCount = rows?.length ?? 0
  const attrs = {
    'data-request-bound': String(transport.bound),
    'data-request-contract': REQUEST_CONTRACT,
    'data-requested-category': transport.request?.category,
    'data-requested-limit': transport.request ? String(transport.request.limit) : undefined,
    'data-provider-category': metaCategory,
    'data-provider-limit': metaLimit === undefined ? undefined : String(metaLimit),
    'data-provider-result-count': String(providerCount),
    'data-provider-total-count': totalCount === undefined ? undefined : String(totalCount),
    'data-valid-prize-count': String(prizes.length),
    'data-invalid-prize-count': String(invalidCount),
    'data-incomplete-prize-count': String(incompleteCount),
    'data-provider-request-match': String(metaMatches),
  }

  if (!transport.valid || !transport.bound || !rows || !meta || !metaMatches || providerCount > (transport.request?.limit ?? 0)) {
    return <StateCard state="invalid" attrs={attrs} title="Nobel Prize response not trusted" detail="The successful response was not bound to the exact supported category/limit request, or the provider metadata contradicted that request."/>
  }
  if (!providerCount) return <StateCard state="empty" attrs={attrs} title="No Nobel Prize records returned" detail={`The provider confirmed an empty ${categoryLabels[transport.request!.category]} result for this request.`}/>
  if (!prizes.length) return <StateCard state="invalid" attrs={attrs} title="Nobel Prize evidence unavailable" detail="Rows were returned, but none matched the requested category with the documented prize fields required for a semantic result."/>

  const state: ResultState = invalidCount || incompleteCount ? 'partial' : 'ready'
  const first = prizes[0]
  const laureateCount = prizes.reduce((total, prize) => total + prize.laureates.length, 0)
  return <section className="nobel-preview" aria-label="Nobel Prize response evidence" data-domain-card="nobel-prizes" data-result-state={state} {...attrs}>
    {state === 'partial' && <p className="domain-note">Only request-matching prize records with valid identity and amount evidence are shown; incomplete laureate details are not fabricated.</p>}
    <div className="nobel-summary"><span aria-hidden="true">N</span><div><small>Latest {first.category} awards</small><strong>{prizes.length} prize years</strong><p>{laureateCount} verified laureate{laureateCount === 1 ? '' : 's'} represented in this response</p></div><b>{first.awardYear}</b></div>
    <ol className="nobel-timeline">{prizes.slice(0, 6).map((prize, index) => <li key={`${prize.awardYear}-${index}`}><time>{prize.awardYear}</time><i/><article><header><small>{prize.category}</small><b>{compactNumber(prize.prizeAmount)} SEK</b></header><h3>{prize.laureates.map((laureate) => laureate.name).join(' · ') || 'Recipient unavailable'}</h3><p>{prize.laureates.find((laureate) => laureate.motivation)?.motivation ?? 'Official motivation unavailable.'}</p></article></li>)}</ol>
  </section>
}
