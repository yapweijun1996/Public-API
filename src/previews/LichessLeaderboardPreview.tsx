import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { isRecord, trimmedText } from './semanticValidation'

const API_ORIGIN = 'https://lichess.org'
const REQUEST_CONTRACT = 'exact-lichess-leaderboard-bodyless-get'

type RequestIdentity = { perfType: string; count: number }
type RequestBinding = { request?: RequestIdentity; valid: boolean; bound: boolean }
type LeaderboardPlayer = { id: string; username: string; title?: string; rating: number; progress: number; patronActive: boolean; rank: number }

const safeInteger = (value: unknown): number | undefined => typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined

const parseRequestUrl = (api: ApiDemo, value?: string): RequestIdentity | undefined => {
  if (api.id !== 'lichess-top-players' || !value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.origin !== API_ORIGIN || url.username || url.password || url.port || url.search || url.hash) return undefined
    const match = /^\/api\/player\/top\/(\d+)\/([^/]+)$/.exec(url.pathname)
    if (!match) return undefined
    const count = Number(match[1])
    const perfType = decodeURIComponent(match[2])
    const perfField = api.fields.find((field) => field.id === 'perfType')
    const countField = api.fields.find((field) => field.id === 'count')
    const perfAllowed = perfField?.options?.some((option) => option.value === perfType) ?? false
    const countAllowed = Number.isSafeInteger(count)
      && count >= (countField?.min ?? 1)
      && count <= (countField?.max ?? Number.MAX_SAFE_INTEGER)
    if (!perfAllowed || !countAllowed) return undefined
    return api.buildUrl({ perfType, count: String(count) }) === value ? { perfType, count } : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestBinding => {
  const displayed = parseRequestUrl(api, requestUrl)
  if (!displayed) return { valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request: displayed, valid: false, bound: false }
  }
  const executed = parseRequestUrl(api, executedRequest.url)
  return executed && executed.perfType === displayed.perfType && executed.count === displayed.count
    ? { request: executed, valid: true, bound: true }
    : { request: displayed, valid: false, bound: false }
}

const parsePlayer = (value: unknown, perfType: string, rank: number): LeaderboardPlayer | undefined => {
  if (!isRecord(value)) return undefined
  const id = trimmedText(value.id)
  const username = trimmedText(value.username)
  const perfs = isRecord(value.perfs) ? value.perfs : undefined
  const perf = perfs && isRecord(perfs[perfType]) ? perfs[perfType] : undefined
  const rating = safeInteger(perf?.rating)
  const progress = safeInteger(perf?.progress)
  const title = value.title === undefined ? undefined : trimmedText(value.title)
  const patronColor = value.patronColor === undefined ? undefined : safeInteger(value.patronColor)
  const patronColorValid = patronColor === undefined || (patronColor >= 1 && patronColor <= 10)
  if (!id || !username || !perf || rating === undefined || progress === undefined || (value.title !== undefined && !title) || !patronColorValid) return undefined
  return { id, username, title, rating, progress, patronActive: patronColor !== undefined, rank }
}

const stateCard = (state: 'partial' | 'empty' | 'invalid', attrs: Record<string, string | undefined>, title: string, detail: string) => (
  <section className="domain-card domain-empty" aria-label="Lichess leaderboard response evidence" data-domain-card="lichess-leaderboard" data-result-state={state} {...attrs}>
    <h3>{title}</h3><p>{detail}</p>
  </section>
)

export function LichessLeaderboardPreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const binding = bindRequest(api, requestUrl, executedRequest)
  const root = isRecord(data) ? data : undefined
  const users = root && Array.isArray(root.users) ? root.users : undefined
  const responseCountValid = Boolean(binding.request && users && users.length <= binding.request.count)
  const validPlayers = binding.request && users ? users.map((item, index) => parsePlayer(item, binding.request!.perfType, index + 1)).filter((item): item is LeaderboardPlayer => item !== undefined) : []
  const invalidCount = users ? users.length - validPlayers.length : 0
  const attrs = {
    'data-request-bound': String(binding.bound),
    'data-request-contract': REQUEST_CONTRACT,
    'data-requested-perf-type': binding.request?.perfType,
    'data-requested-count': binding.request ? String(binding.request.count) : undefined,
    'data-response-count-valid': String(responseCountValid),
    'data-valid-player-count': String(validPlayers.length),
    'data-invalid-player-count': String(invalidCount),
  }

  if (!binding.valid || !users || !responseCountValid) {
    return stateCard('invalid', attrs, 'Lichess leaderboard response not trusted', 'The successful response was not bound to the exact supported leaderboard request, its response envelope was malformed, or it exceeded the requested player count.')
  }
  if (users.length === 0) {
    return binding.bound
      ? stateCard('empty', attrs, 'No leaderboard players returned', `Lichess returned an empty ${binding.request?.perfType ?? ''} leaderboard.`)
      : stateCard('partial', attrs, 'Unbound Lichess leaderboard response', 'The response is structurally empty, but executed-request evidence is incomplete, so the result is not trusted as final.')
  }
  if (validPlayers.length === 0) {
    return stateCard('invalid', attrs, 'Lichess leaderboard evidence unavailable', `Returned players did not contain valid ${binding.request?.perfType ?? 'requested'} rating/progress evidence.`)
  }

  const state = binding.bound && invalidCount === 0 ? 'ready' as const : 'partial' as const
  const cards: SemanticCard[] = validPlayers.map((player) => ({
    title: player.username,
    eyebrow: player.title ?? 'Lichess player',
    badge: `Rating ${player.rating.toLocaleString('en-US')}`,
    metrics: [
      { label: 'Rank', value: String(player.rank) },
      { label: 'Progress', value: `${player.progress >= 0 ? '+' : ''}${player.progress}` },
      { label: 'Patron', value: player.patronActive ? 'Active' : 'Not indicated' },
    ],
  }))

  return <section aria-label="Lichess leaderboard response evidence" data-domain-card="lichess-leaderboard" data-result-state={state} {...attrs}>
    {state === 'partial' && <p className="domain-note">Only players with valid requested-performance evidence are shown. Malformed rows or missing executed-request evidence keep this result partial.</p>}
    <SemanticCards cards={cards} emptyTitle="Lichess leaderboard unavailable"/>
  </section>
}
