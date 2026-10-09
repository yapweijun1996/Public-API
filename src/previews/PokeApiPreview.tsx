import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

type PokeApiRequest = { token: string; pokemonId?: number; pokemonName?: string }
type PokeApiRequestIdentity = { request?: PokeApiRequest; transportBound: boolean; invalidReason?: string }
type NamedSlot = { name: string; slot: number; hidden?: boolean }
type PokemonStat = { name: string; baseStat: number; effort: number }
type PokeApiResult = {
  id: number
  name: string
  baseExperience?: number
  height: number
  weight: number
  spriteUrl?: string
  types: NamedSlot[]
  abilities: NamedSlot[]
  stats: PokemonStat[]
  malformed: number
  duplicates: number
  spriteGap: boolean
}

const httpsUrl = (value: unknown, host: string): string | undefined => {
  const text = trimmedText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

const namedResource = (value: unknown, resource: string): string | undefined => {
  if (!isRecord(value)) return undefined
  const name = trimmedText(value.name)
  const url = trimmedText(value.url)
  if (!name || !url) return undefined
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'pokeapi.co' || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) return undefined
    if (!parsed.pathname.startsWith(`/api/v2/${resource}/`)) return undefined
    return name
  } catch {
    return undefined
  }
}

export const parsePokeApiRequest = (requestUrl?: string): PokeApiRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'pokeapi.co' || url.port || url.username || url.password || url.search || url.hash) return undefined
    const match = url.pathname.match(/^\/api\/v2\/pokemon\/([^/]+)$/)
    if (!match) return undefined
    const decoded = decodeURIComponent(match[1]).trim()
    if (!decoded || decoded !== decodeURIComponent(match[1])) return undefined
    if (/^[1-9]\d*$/.test(decoded)) {
      const pokemonId = Number(decoded)
      if (!Number.isSafeInteger(pokemonId)) return undefined
      return { token: decoded, pokemonId }
    }
    if (!/^[a-z0-9-]+$/i.test(decoded)) return undefined
    const pokemonName = decoded.toLowerCase()
    return { token: pokemonName, pokemonName }
  } catch {
    return undefined
  }
}

const bindPokeApiRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): PokeApiRequestIdentity => {
  const request = parsePokeApiRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The successful response was not tied to the exact supported PokéAPI Pokémon request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET PokéAPI Pokémon request.' }
  }
  const executed = parsePokeApiRequest(executedRequest.url)
  if (!executed || executed.token !== request.token) {
    return { request, transportBound: false, invalidReason: 'The displayed PokéAPI request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const parseNamedSlots = (value: unknown, resource: string, hiddenFlag: boolean): { items: NamedSlot[]; malformed: number; duplicates: number } => {
  if (!Array.isArray(value)) return { items: [], malformed: 1, duplicates: 0 }
  const items: NamedSlot[] = []
  const seen = new Set<string>()
  let malformed = 0
  let duplicates = 0
  for (const entry of value) {
    if (!isRecord(entry)) { malformed += 1; continue }
    const slot = positiveSafeInteger(entry.slot)
    const nested = entry[resource]
    const name = namedResource(nested, resource)
    const hidden = hiddenFlag ? entry.is_hidden : undefined
    if (!slot || !name || (hiddenFlag && typeof hidden !== 'boolean')) { malformed += 1; continue }
    if (seen.has(name)) { duplicates += 1; continue }
    seen.add(name)
    items.push(hiddenFlag ? { name, slot, hidden: hidden as boolean } : { name, slot })
  }
  return { items, malformed, duplicates }
}

const parseStats = (value: unknown): { items: PokemonStat[]; malformed: number; duplicates: number } => {
  if (!Array.isArray(value)) return { items: [], malformed: 1, duplicates: 0 }
  const items: PokemonStat[] = []
  const seen = new Set<string>()
  let malformed = 0
  let duplicates = 0
  for (const entry of value) {
    if (!isRecord(entry)) { malformed += 1; continue }
    const name = namedResource(entry.stat, 'stat')
    const baseStat = nonNegativeSafeInteger(entry.base_stat)
    const effort = nonNegativeSafeInteger(entry.effort)
    if (!name || baseStat === undefined || effort === undefined) { malformed += 1; continue }
    if (seen.has(name)) { duplicates += 1; continue }
    seen.add(name)
    items.push({ name, baseStat, effort })
  }
  return { items, malformed, duplicates }
}

export const parsePokeApiResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: PokeApiRequest; result?: PokeApiResult; transportBound: boolean; invalidReason?: string } => {
  const identity = bindPokeApiRequest(requestUrl, executedRequest)
  const request = identity.request
  if (!request || identity.invalidReason) return { request, transportBound: false, invalidReason: identity.invalidReason }
  if (!isRecord(data)) return { request, transportBound: identity.transportBound, invalidReason: 'PokéAPI did not return a Pokémon resource object.' }

  const id = positiveSafeInteger(data.id)
  const name = trimmedText(data.name)
  const height = positiveSafeInteger(data.height)
  const weight = positiveSafeInteger(data.weight)
  if (!id || !name || !height || !weight) return { request, transportBound: identity.transportBound, invalidReason: 'PokéAPI core Pokémon identity or physical measurements were not represented by native values.' }
  if (request.pokemonId !== undefined ? id !== request.pokemonId : name.toLowerCase() !== request.pokemonName) {
    return { request, transportBound: identity.transportBound, invalidReason: 'The provider Pokémon identity did not match the executed lookup.' }
  }
  if (typeof data.is_default !== 'boolean') return { request, transportBound: identity.transportBound, invalidReason: 'PokéAPI did not return a native default-form flag.' }

  const baseExperience = data.base_experience === null || data.base_experience === undefined ? undefined : nonNegativeSafeInteger(data.base_experience)
  let malformed = data.base_experience !== null && data.base_experience !== undefined && baseExperience === undefined ? 1 : 0
  const types = parseNamedSlots(data.types, 'type', false)
  const abilities = parseNamedSlots(data.abilities, 'ability', true)
  const stats = parseStats(data.stats)
  malformed += types.malformed + abilities.malformed + stats.malformed
  const duplicates = types.duplicates + abilities.duplicates + stats.duplicates

  let spriteUrl: string | undefined
  let spriteGap = false
  if (!isRecord(data.sprites)) {
    malformed += 1
    spriteGap = true
  } else if (data.sprites.front_default === null || data.sprites.front_default === undefined) {
    spriteGap = true
  } else {
    spriteUrl = httpsUrl(data.sprites.front_default, 'raw.githubusercontent.com')
    if (!spriteUrl) { malformed += 1; spriteGap = true }
  }

  return { request, transportBound: identity.transportBound, result: {
    id,
    name,
    baseExperience,
    height,
    weight,
    spriteUrl,
    types: types.items,
    abilities: abilities.items,
    stats: stats.items,
    malformed,
    duplicates,
    spriteGap,
  } }
}

const attrs = (request?: PokeApiRequest, result?: PokeApiResult, transportBound = false) => ({
  'data-domain-card': 'pokeapi-pokemon',
  'data-request-bound': request && transportBound ? 'true' : 'false',
  'data-request-contract': 'exact-pokeapi-pokemon-v2',
  'data-request-pokemon': request?.token,
  'data-pokemon-id': result?.id,
  'data-pokemon-name': result?.name,
  'data-type-count': result?.types.length,
  'data-ability-count': result?.abilities.length,
  'data-stat-count': result?.stats.length,
  'data-malformed-evidence-count': result?.malformed,
  'data-duplicate-evidence-count': result?.duplicates,
  'data-sprite-gap': result?.spriteGap ? 'true' : 'false',
})

const label = (value: string) => value.split('-').map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(' ')

export function PokeApiPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parsePokeApiResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request, undefined, parsed.transportBound)} data-result-state="invalid"><h3>Invalid PokéAPI Pokémon response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result, transportBound } = parsed
  const partial = !transportBound || result.malformed > 0 || result.duplicates > 0 || result.spriteGap || !result.types.length || !result.abilities.length || !result.stats.length
  return <div className="domain-card pokeapi-pokemon-preview bounded-media-preview" {...attrs(request, result, transportBound)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">PokéAPI · Pokémon profile</small><h3>{label(result.name)} <span aria-label={`National Pokédex number ${result.id}`}>#{result.id}</span></h3><p>Exact-request-bound Pokémon identity with native types, abilities, base stats, and physical measurements.</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{partial ? 'Partial evidence' : 'Verified profile'}</span></header>
    {partial ? <p className="domain-note">{transportBound ? 'Only provider fields that passed strict native-type and identity checks are shown. Malformed or duplicate type, ability, stat, and sprite evidence is withheld.' : 'The Pokémon response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}</p> : null}
    <dl className="domain-facts"><div><dt>Pokédex ID</dt><dd>{result.id}</dd></div><div><dt>Height</dt><dd>{(result.height / 10).toLocaleString('en', { maximumFractionDigits: 1 })} m</dd></div><div><dt>Weight</dt><dd>{(result.weight / 10).toLocaleString('en', { maximumFractionDigits: 1 })} kg</dd></div><div><dt>Base experience</dt><dd>{result.baseExperience ?? 'Unavailable'}</dd></div></dl>
    <section aria-label="Pokémon types"><h4>Types</h4><p>{result.types.length ? [...result.types].sort((a, b) => a.slot - b.slot).map((entry) => label(entry.name)).join(' · ') : 'Unavailable'}</p></section>
    <section aria-label="Pokémon abilities"><h4>Abilities</h4><p>{result.abilities.length ? [...result.abilities].sort((a, b) => a.slot - b.slot).map((entry) => `${label(entry.name)}${entry.hidden ? ' (hidden)' : ''}`).join(' · ') : 'Unavailable'}</p></section>
    <section aria-label="Pokémon base stats"><h4>Base stats</h4><dl className="domain-facts">{result.stats.map((stat) => <div key={stat.name} data-stat-name={stat.name}><dt>{label(stat.name)}</dt><dd>{stat.baseStat}{stat.effort ? ` · effort ${stat.effort}` : ''}</dd></div>)}</dl></section>
    {result.spriteUrl ? <div className="media-preview single"><article data-pokemon-sprite="front-default"><img src={result.spriteUrl} alt={`${label(result.name)} front sprite`} loading="lazy"/><div><small>PokéAPI sprite</small><h3>{label(result.name)}</h3><p>Provider front-default sprite for Pokémon #{result.id}.</p></div></article></div> : <p className="domain-note">A trusted front-default sprite was not available; the semantic profile remains readable without image evidence.</p>}
  </div>
}
