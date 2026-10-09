import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { compactNumber, formatNumber } from './previewData'
import { isRecord, nonNegativeSafeInteger, trimmedText } from './semanticValidation'

const API_ORIGIN = 'https://lichess.org'
const REQUEST_CONTRACT = 'exact-lichess-public-user-bodyless-get'

const PERF_LABELS = [
  ['bullet', 'Bullet', '●'],
  ['blitz', 'Blitz', '⚡'],
  ['rapid', 'Rapid', '◷'],
  ['classical', 'Classical', '□'],
  ['correspondence', 'Correspondence', '✉'],
  ['chess960', 'Chess960', '960'],
  ['crazyhouse', 'Crazyhouse', '♜'],
] as const

type RequestIdentity = { username: string }
type RequestBinding = { request?: RequestIdentity; valid: boolean; bound: boolean }
type Perf = { key: string; label: string; symbol: string; games: number; rating: number; rd: number; prog: number; provisional: boolean }

const integer = (value: unknown): number | undefined => typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined

const parseRequestUrl = (api: ApiDemo, value?: string): RequestIdentity | undefined => {
  if (api.id !== 'chess-player-stats' || !value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.origin !== API_ORIGIN || url.username || url.password || url.port || url.search || url.hash) return undefined
    const match = /^\/api\/user\/([^/]+)$/.exec(url.pathname)
    if (!match) return undefined
    const username = decodeURIComponent(match[1]).trim().toLowerCase()
    if (!username) return undefined
    return api.buildUrl({ username }) === value ? { username } : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestBinding => {
  const displayed = parseRequestUrl(api, requestUrl)
  if (!displayed) return { valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return { request: displayed, valid: false, bound: false }
  const executed = parseRequestUrl(api, executedRequest.url)
  return executed?.username === displayed.username
    ? { request: executed, valid: true, bound: true }
    : { request: displayed, valid: false, bound: false }
}

const parseProfileUrl = (value: unknown, providerId: string | undefined): boolean => {
  const raw = trimmedText(value)
  if (!raw || !providerId) return false
  try {
    const url = new URL(raw)
    const match = /^\/@\/([^/]+)$/.exec(url.pathname)
    return url.protocol === 'https:' && url.origin === API_ORIGIN && !url.search && !url.hash && Boolean(match) && decodeURIComponent(match![1]).toLowerCase() === providerId
  } catch {
    return false
  }
}

const parsePerf = (value: unknown, key: string, label: string, symbol: string): Perf | undefined => {
  if (!isRecord(value)) return undefined
  const games = nonNegativeSafeInteger(value.games)
  const rating = integer(value.rating)
  const rd = nonNegativeSafeInteger(value.rd)
  const prog = integer(value.prog)
  const provisional = value.prov === undefined ? false : value.prov
  if (games === undefined || rating === undefined || rd === undefined || prog === undefined || typeof provisional !== 'boolean') return undefined
  return { key, label, symbol, games, rating, rd, prog, provisional }
}

const stateCard = (state: 'partial' | 'empty' | 'invalid', attrs: Record<string, string | undefined>, title: string, detail: string) => (
  <section className="domain-card domain-empty" aria-label="Lichess player-rating response evidence" data-domain-card="lichess-player-ratings" data-result-state={state} {...attrs}>
    <h3>{title}</h3><p>{detail}</p>
  </section>
)

export function LichessPlayerRatingsPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const binding = bindRequest(api, requestUrl, executedRequest)
  const root = isRecord(data) ? data : undefined
  const providerId = root ? trimmedText(root.id)?.toLowerCase() : undefined
  const providerUsername = root ? trimmedText(root.username) : undefined
  const providerIdentityValid = Boolean(providerId && providerUsername && providerUsername.toLowerCase() === providerId && parseProfileUrl(root?.url, providerId))
  const identityMatch = Boolean(binding.request && providerId && binding.request.username === providerId)
  const perfsValue = root?.perfs
  const perfs = perfsValue === undefined ? undefined : isRecord(perfsValue) ? perfsValue : null
  const presentEntries = perfs ? PERF_LABELS.filter(([key]) => Object.hasOwn(perfs, key)) : []
  const validPerfs = perfs ? presentEntries.map(([key, label, symbol]) => parsePerf(perfs[key], key, label, symbol)).filter((item): item is Perf => item !== undefined) : []
  const invalidCount = presentEntries.length - validPerfs.length
  const attrs = {
    'data-request-bound': String(binding.bound),
    'data-request-contract': REQUEST_CONTRACT,
    'data-requested-username': binding.request?.username,
    'data-provider-user-id': providerId,
    'data-provider-username': providerUsername,
    'data-response-identity-match': String(identityMatch),
    'data-valid-perf-count': String(validPerfs.length),
    'data-invalid-perf-count': String(invalidCount),
  }

  if (!binding.valid || !root || !providerIdentityValid || !identityMatch || perfs === null) {
    return stateCard('invalid', attrs, 'Lichess player response not trusted', 'The successful response was not bound to the exact supported public-user request, or the returned user identity/performance envelope contradicted that request.')
  }
  if (!perfs || presentEntries.length === 0) {
    return binding.bound
      ? stateCard('empty', attrs, 'No public ratings returned', `Lichess returned no supported public rating records for “${providerUsername}”.`)
      : stateCard('partial', attrs, 'Unbound Lichess player response', 'The user identity is coherent, but executed-request evidence is incomplete, so the empty rating result is not trusted as final.')
  }
  if (!validPerfs.length) {
    return stateCard('invalid', attrs, 'Lichess rating evidence unavailable', 'Performance records were returned, but none matched the documented games, rating, rating-deviation, and progress contract.')
  }

  const state = binding.bound && invalidCount === 0 ? 'ready' as const : 'partial' as const
  const leader = [...validPerfs].sort((a, b) => b.rating - a.rating)[0]
  const totalGames = validPerfs.reduce((sum, perf) => sum + perf.games, 0)
  return <section className="chess-preview" aria-label="Lichess player-rating response evidence" data-domain-card="lichess-player-ratings" data-result-state={state} {...attrs}>
    {state === 'partial' && <p className="domain-note">Only structurally valid Lichess performance records are shown. Malformed rows or missing executed-request evidence keep this result partial.</p>}
    <header className="chess-hero"><div className="chess-board" aria-hidden="true">♞</div><div><small>{providerUsername} · public profile</small><strong>{formatNumber(leader.rating, 0)}</strong><span>Highest returned rating · {leader.label}</span></div><div><small>Games</small><b>{compactNumber(totalGames)}</b><span>{validPerfs.length} rating modes</span></div></header>
    <div className="chess-rating-grid">{validPerfs.map((perf) => <article key={perf.key}><header><span>{perf.symbol}</span><div><small>{perf.label}</small><strong>{formatNumber(perf.rating, 0)}</strong></div><b>{perf.provisional ? 'Provisional' : `${perf.prog >= 0 ? '+' : ''}${perf.prog}`}</b></header><dl><div><dt>Games</dt><dd>{compactNumber(perf.games)}</dd></div><div><dt>RD</dt><dd>{formatNumber(perf.rd, 0)}</dd></div><div><dt>Progress</dt><dd>{perf.prog >= 0 ? '+' : ''}{perf.prog}</dd></div></dl><p className="domain-note">{compactNumber(perf.games)} games</p></article>)}</div>
  </section>
}
