import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

export type RickMortyCharactersRequest = {
  name: string
  status?: 'alive' | 'dead' | 'unknown'
}

type RickMortyCharactersRequestIdentity = { request?: RickMortyCharactersRequest; transportBound: boolean; invalidReason?: string }

type LocationRef = { name: string; url?: string }
type RickMortyCharacter = {
  id: number
  name: string
  status: 'Alive' | 'Dead' | 'unknown'
  species: string
  type?: string
  gender: 'Female' | 'Male' | 'Genderless' | 'unknown'
  origin?: LocationRef
  location?: LocationRef
  imageUrl?: string
  episodeCount: number
  sourceUrl: string
  created?: string
}

type RickMortyCharactersResult = {
  characters: RickMortyCharacter[]
  providerCount: number
  providerPages: number
  providerRecordCount: number
  trustedRecordCount: number
  malformedEvidenceCount: number
  duplicateEvidenceCount: number
  filterMismatchCount: number
}

type ParsedRow = {
  character?: RickMortyCharacter
  malformed: number
  filterMismatch: boolean
}

const admittedStatuses = new Set(['alive', 'dead', 'unknown'])
const providerStatuses = new Set(['Alive', 'Dead', 'unknown'])
const providerGenders = new Set(['Female', 'Male', 'Genderless', 'unknown'])

export const parseRickMortyCharactersRequest = (requestUrl?: string): RickMortyCharactersRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'rickandmortyapi.com' || url.port || url.username || url.password
      || url.pathname !== '/api/character' || url.hash) return undefined
    const keys = [...url.searchParams.keys()]
    if (keys.some((key) => key !== 'name' && key !== 'status')
      || url.searchParams.getAll('name').length !== 1
      || url.searchParams.getAll('status').length > 1
      || keys.length !== (url.searchParams.has('status') ? 2 : 1)) return undefined
    const rawName = url.searchParams.get('name') ?? ''
    const name = rawName.trim()
    if (!name || name !== rawName) return undefined
    const rawStatus = url.searchParams.get('status')
    if (rawStatus === null) return { name }
    if (!admittedStatuses.has(rawStatus)) return undefined
    return { name, status: rawStatus as RickMortyCharactersRequest['status'] }
  } catch {
    return undefined
  }
}

const bindRickMortyCharactersRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): RickMortyCharactersRequestIdentity => {
  const request = parseRickMortyCharactersRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported Rick and Morty character-search request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Rick and Morty character-search request.' }
  }
  const executed = parseRickMortyCharactersRequest(executedRequest.url)
  if (!executed || executed.name !== request.name || executed.status !== request.status) {
    return { request, transportBound: false, invalidReason: 'The displayed Rick and Morty request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const providerResourceUrl = (value: unknown, resource: 'character' | 'location' | 'episode', expectedId?: number): string | undefined => {
  const text = trimmedText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    const match = url.pathname.match(new RegExp(`^/api/${resource}/([1-9]\\d*)$`))
    if (url.protocol !== 'https:' || url.hostname !== 'rickandmortyapi.com' || url.port || url.username || url.password
      || url.search || url.hash || !match) return undefined
    const id = Number(match[1])
    if (!Number.isSafeInteger(id) || id <= 0 || (expectedId !== undefined && id !== expectedId)) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

const providerImageUrl = (value: unknown, id: number): string | undefined => {
  const text = trimmedText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.hostname !== 'rickandmortyapi.com' || url.port || url.username || url.password
      || url.search || url.hash || url.pathname !== `/api/character/avatar/${id}.jpeg`) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

const locationRef = (value: unknown): { value?: LocationRef; malformed: boolean } => {
  if (!isRecord(value)) return { malformed: true }
  const name = trimmedText(value.name)
  if (!name) return { malformed: true }
  if (value.url === '') return name.toLocaleLowerCase('en') === 'unknown'
    ? { value: { name }, malformed: false }
    : { value: { name }, malformed: true }
  const url = providerResourceUrl(value.url, 'location')
  return url ? { value: { name, url }, malformed: false } : { value: { name }, malformed: true }
}

const episodeList = (value: unknown): { count: number; malformed: number; duplicates: number } => {
  if (!Array.isArray(value)) return { count: 0, malformed: 1, duplicates: 0 }
  const seen = new Set<string>()
  let malformed = 0
  let duplicates = 0
  for (const entry of value) {
    const url = providerResourceUrl(entry, 'episode')
    if (!url) { malformed += 1; continue }
    if (seen.has(url)) { duplicates += 1; continue }
    seen.add(url)
  }
  return { count: seen.size, malformed, duplicates }
}

const createdValue = (value: unknown): { value?: string; malformed: boolean } => {
  const text = trimmedText(value)
  if (!text) return { malformed: true }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== text) return { malformed: true }
  return { value: text, malformed: false }
}

const rowMatchesRequest = (name: string, status: string, request: RickMortyCharactersRequest) => {
  if (!name.toLocaleLowerCase('en').includes(request.name.toLocaleLowerCase('en'))) return false
  return request.status ? status.toLocaleLowerCase('en') === request.status : true
}

const parseCharacter = (value: unknown, request: RickMortyCharactersRequest): ParsedRow => {
  if (!isRecord(value)) return { malformed: 1, filterMismatch: false }
  const id = positiveSafeInteger(value.id)
  const name = trimmedText(value.name)
  const status = typeof value.status === 'string' && providerStatuses.has(value.status) ? value.status as RickMortyCharacter['status'] : undefined
  const species = trimmedText(value.species)
  const gender = typeof value.gender === 'string' && providerGenders.has(value.gender) ? value.gender as RickMortyCharacter['gender'] : undefined
  const sourceUrl = id ? providerResourceUrl(value.url, 'character', id) : undefined
  if (!id || !name || !status || !species || !gender || !sourceUrl) return { malformed: 1, filterMismatch: false }
  if (!rowMatchesRequest(name, status, request)) return { malformed: 0, filterMismatch: true }

  let malformed = 0
  let duplicateEvidence = 0
  let type: string | undefined
  if (value.type === '') type = undefined
  else {
    type = trimmedText(value.type)
    if (!type) malformed += 1
  }
  const origin = locationRef(value.origin)
  const location = locationRef(value.location)
  const imageUrl = providerImageUrl(value.image, id)
  const episodes = episodeList(value.episode)
  const created = createdValue(value.created)
  malformed += Number(origin.malformed) + Number(location.malformed) + Number(!imageUrl) + episodes.malformed + Number(created.malformed)
  duplicateEvidence += episodes.duplicates

  return {
    character: {
      id,
      name,
      status,
      species,
      type,
      gender,
      origin: origin.value,
      location: location.value,
      imageUrl,
      episodeCount: episodes.count,
      sourceUrl,
      created: created.value,
    },
    malformed: malformed + duplicateEvidence,
    filterMismatch: false,
  }
}

const paginationLinkMatches = (value: unknown, request: RickMortyCharactersRequest): boolean => {
  const text = trimmedText(value)
  if (!text) return false
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.hostname !== 'rickandmortyapi.com' || url.port || url.username || url.password
      || url.pathname !== '/api/character' || url.hash) return false
    const keys = [...url.searchParams.keys()]
    const expectedKeyCount = request.status ? 3 : 2
    if (keys.length !== expectedKeyCount || keys.some((key) => !['page', 'name', 'status'].includes(key))
      || url.searchParams.getAll('page').length !== 1 || url.searchParams.get('page') !== '2'
      || url.searchParams.getAll('name').length !== 1 || url.searchParams.get('name') !== request.name
      || url.searchParams.getAll('status').length > 1) return false
    return request.status ? url.searchParams.get('status') === request.status : !url.searchParams.has('status')
  } catch {
    return false
  }
}

export const parseRickMortyCharactersResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: RickMortyCharactersRequest; result?: RickMortyCharactersResult; transportBound: boolean; invalidReason?: string } => {
  const identity = bindRickMortyCharactersRequest(requestUrl, executedRequest)
  const request = identity.request
  if (!request || identity.invalidReason) return { request, transportBound: false, invalidReason: identity.invalidReason }
  if (!isRecord(data) || !isRecord(data.info) || !Array.isArray(data.results)) return { request, transportBound: identity.transportBound, invalidReason: 'The provider did not return the documented character pagination envelope.' }

  const providerCount = nonNegativeSafeInteger(data.info.count)
  const providerPages = nonNegativeSafeInteger(data.info.pages)
  if (providerCount === undefined || providerPages === undefined || providerPages !== Math.ceil(providerCount / 20)
    || data.results.length !== Math.min(20, providerCount) || data.info.prev !== null
    || (providerPages > 1 ? !paginationLinkMatches(data.info.next, request) : data.info.next !== null)) {
    return { request, transportBound: identity.transportBound, invalidReason: 'The provider pagination evidence did not match the first page of the displayed character search.' }
  }

  const characters: RickMortyCharacter[] = []
  const seen = new Set<number>()
  let malformedEvidenceCount = 0
  let duplicateEvidenceCount = 0
  let filterMismatchCount = 0
  for (const row of data.results) {
    const parsed = parseCharacter(row, request)
    malformedEvidenceCount += parsed.malformed
    if (parsed.filterMismatch) { filterMismatchCount += 1; continue }
    if (!parsed.character) continue
    if (seen.has(parsed.character.id)) { duplicateEvidenceCount += 1; continue }
    seen.add(parsed.character.id)
    characters.push(parsed.character)
  }

  return { request, transportBound: identity.transportBound, result: {
    characters,
    providerCount,
    providerPages,
    providerRecordCount: data.results.length,
    trustedRecordCount: characters.length,
    malformedEvidenceCount,
    duplicateEvidenceCount,
    filterMismatchCount,
  } }
}

const attrs = (request?: RickMortyCharactersRequest, result?: RickMortyCharactersResult, transportBound = false) => ({
  'data-domain-card': 'rick-morty-characters',
  'data-request-bound': request && transportBound ? 'true' : 'false',
  'data-request-contract': 'exact-rick-morty-character-search-v2',
  'data-character-query': request?.name,
  'data-status-filter': request?.status ?? 'all',
  'data-provider-count': result?.providerCount,
  'data-provider-pages': result?.providerPages,
  'data-provider-record-count': result?.providerRecordCount,
  'data-trusted-record-count': result?.trustedRecordCount,
  'data-malformed-evidence-count': result?.malformedEvidenceCount,
  'data-duplicate-evidence-count': result?.duplicateEvidenceCount,
  'data-filter-mismatch-count': result?.filterMismatchCount,
  'data-primary-character-id': result?.characters[0]?.id,
})

const locationLabel = (location?: LocationRef) => location?.name ?? 'Unavailable'

export function RickMortyCharactersPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseRickMortyCharactersResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request, undefined, parsed.transportBound)} data-result-state="invalid"><h3>Invalid character-search response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result, transportBound } = parsed
  if (result.providerCount === 0) return <div className="domain-card domain-empty" {...attrs(request, result, transportBound)} data-result-state={transportBound ? 'empty' : 'partial'}><h3>{transportBound ? 'No characters matched' : 'Character result not request-bound'}</h3><p>{transportBound ? <>The provider returned a coherent exact-request-bound empty page for “{request.name}”.</> : <>The provider returned a coherent empty page for “{request.name}”, but executed request evidence was unavailable.</>}</p></div>
  if (!result.characters.length) return <div className="domain-card domain-empty" {...attrs(request, result, transportBound)} data-result-state="invalid"><h3>No trustworthy character identities</h3><p>The response contained rows, but none matched the displayed filters with a trustworthy provider character identity.</p></div>
  const partial = !transportBound || result.malformedEvidenceCount > 0 || result.duplicateEvidenceCount > 0 || result.filterMismatchCount > 0
  return <div className="domain-card rick-morty-characters-preview bounded-media-preview" {...attrs(request, result, transportBound)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Rick and Morty API · Character search</small><h3>Characters matching “{request.name}”</h3><p>Character identities, life status, species, origin, current location, and episode evidence from the displayed search.</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{result.characters.length} trusted character{result.characters.length === 1 ? '' : 's'}</span></header>
    {partial ? <p className="domain-note">{transportBound ? 'Malformed, duplicate, or filter-mismatched evidence is withheld. Raw JSON retains the complete provider response.' : 'The Rick and Morty response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}</p> : null}
    <dl className="domain-facts"><div><dt>Provider matches</dt><dd>{result.providerCount.toLocaleString('en')}</dd></div><div><dt>Pages</dt><dd>{result.providerPages}</dd></div><div><dt>Trusted first-page rows</dt><dd>{result.trustedRecordCount}</dd></div><div><dt>Status filter</dt><dd>{request.status ?? 'all'}</dd></div></dl>
    <div className={`media-preview ${result.characters.length === 1 ? 'single' : ''}`} aria-label={`Rick and Morty characters matching ${request.name}`}>
      {result.characters.map((character) => <article key={character.id} data-character-id={character.id}>
        {character.imageUrl ? <img src={character.imageUrl} alt={`${character.name} character portrait`} loading="lazy"/> : null}
        <div>
          <small>Character #{character.id} · {character.status}</small>
          <h3>{character.name}</h3>
          <p>{character.species}{character.type ? ` · ${character.type}` : ''} · {character.gender}</p>
          <dl className="domain-facts"><div><dt>Origin</dt><dd>{locationLabel(character.origin)}</dd></div><div><dt>Last known location</dt><dd>{locationLabel(character.location)}</dd></div><div><dt>Episodes</dt><dd>{character.episodeCount}</dd></div><div><dt>Created</dt><dd>{character.created ? character.created.slice(0, 10) : 'Unavailable'}</dd></div></dl>
          {!character.imageUrl ? <p>Provider portrait unavailable; character identity and textual evidence remain available.</p> : null}
          <p><a href={character.sourceUrl} target="_blank" rel="noreferrer">Open {character.name} in the Rick and Morty API</a></p>
        </div>
      </article>)}
    </div>
    <p className="domain-note">The API project is open source under BSD, but its official About page says the Rick and Morty data and images are used without an ownership claim and belong to their respective owners. This card makes no media-reuse license claim.</p>
  </div>
}
