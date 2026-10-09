import './specializedCatalogCards.css'
import { getApiResponseType, type ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext, ResponseMediaContext } from '../useApiRequestRuntime'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { CardEmpty } from './cardPrimitives'
import { cleanText, compactNumber, dateParts, formatNumber, isRecord, numberValue, previewValue, recordArray, textArray } from './previewData'
import { nonNegativeSafeInteger, optionalTrimmedText, positiveSafeInteger, trimmedText } from './semanticValidation'

export { MarineForecastPreview } from './OpenMeteoMarinePreview'
export { MetMuseumSearchPreview } from './MetMuseumSearchPreview'
export { MetMuseumObjectPreview } from './MetMuseumObjectPreview'
export { LaunchSchedulePreview } from './LaunchLibraryUpcomingPreview'
export { OpenF1SessionsPreview } from './OpenF1SessionsPreview'
export { NobelPrizePreview } from './NobelPrizePreview'
export { PoetryDbPreview } from './PoetryDbPreview'
export { WiktionaryEntryPreview } from './WiktionaryEntryPreview'
export { LichessPlayerRatingsPreview } from './LichessPlayerRatingsPreview'
export { LichessLeaderboardPreview } from './LichessLeaderboardPreview'
export { BrazilPostcodePreview } from './BrazilPostcodePreview'
export { GbifTaxonomyPreview } from './GbifTaxonomyPreview'
export { DndSpellPreview } from './DndSpellPreview'
export { MalaysiaFuelPricePreview } from './MalaysiaFuelPricePreview'

type CountryRequestIdentity = { code: string; valid: true } | { valid: false }
type CountryRequestTransport = { request?: CountryRequestIdentity; valid: boolean; bound: boolean }

const countryRequestIdentity = (requestUrl?: string): CountryRequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const match = /^\/v2\/country\/([^/]+)$/.exec(url.pathname)
    const queryKeys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.origin !== 'https://api.worldbank.org' || url.username || url.password || url.hash || !match || queryKeys.length !== 1 || queryKeys[0] !== 'format' || url.searchParams.get('format') !== 'json') return { valid: false }
    const code = decodeURIComponent(match[1]).trim().toUpperCase()
    return /^[A-Z]{2,3}$/.test(code) ? { code, valid: true } : { valid: false }
  } catch {
    return { valid: false }
  }
}

const countryRequestTransport = (requestUrl?: string, executedRequest?: ExecutedRequestContext): CountryRequestTransport => {
  const displayed = countryRequestIdentity(requestUrl)
  if (requestUrl && displayed?.valid === false) return { request: displayed, valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
    return { request: displayed, valid: false, bound: false }
  }
  const executed = countryRequestIdentity(executedRequest.url)
  if (!executed?.valid || (displayed?.valid && displayed.code !== executed.code)) return { request: executed ?? displayed, valid: false, bound: false }
  return { request: executed, valid: true, bound: true }
}

const nestedCountryLabel = (value: unknown) => {
  if (value === undefined || value === null) return { malformed: false as const, value: undefined }
  if (!isRecord(value)) return { malformed: true as const, value: undefined }
  const label = optionalTrimmedText(value.value)
  return { malformed: label.malformed, value: label.value }
}

const countryCoordinate = (value: unknown, min: number, max: number) => {
  if (value === undefined || value === null) return { malformed: false as const, value: undefined }
  if (typeof value !== 'string' || !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) return { malformed: true as const, value: undefined }
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= min && numeric <= max
    ? { malformed: false as const, value: value.trim() }
    : { malformed: true as const, value: undefined }
}

export function CountryPreview({ data, api, requestUrl, executedRequest }: { data: unknown; api: ApiDemo; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const transport = countryRequestTransport(requestUrl, executedRequest)
  const request = transport.request
  const envelopeValid = Array.isArray(data) && data.length === 2 && isRecord(data[0]) && Array.isArray(data[1])
  const metadata = envelopeValid ? data[0] as Record<string, unknown> : {}
  const providerRows: unknown[] = envelopeValid ? data[1] as unknown[] : []
  const page = positiveSafeInteger(metadata.page)
  const pages = positiveSafeInteger(metadata.pages)
  const total = nonNegativeSafeInteger(metadata.total)
  const perPage = optionalTrimmedText(metadata.per_page)
  const metadataValid = envelopeValid && page === 1 && pages === 1 && total !== undefined && !perPage.malformed && Boolean(perPage.value && /^[1-9][0-9]*$/.test(perPage.value)) && total === providerRows.length && providerRows.length <= 1
  const country = providerRows.length === 1 && isRecord(providerRows[0]) ? providerRows[0] : undefined
  const providerCode = country ? trimmedText(country.id)?.toUpperCase() : undefined
  const providerIso2 = country ? trimmedText(country.iso2Code)?.toUpperCase() : undefined
  const name = country ? trimmedText(country.name) : undefined
  const providerIdentityValid = Boolean(providerCode && /^[A-Z]{3}$/.test(providerCode) && providerIso2 && /^[A-Z]{2}$/.test(providerIso2) && name)
  const identityMatch = request?.valid && providerIdentityValid
    ? request.code === (request.code.length === 2 ? providerIso2 : providerCode)
    : request?.valid === false ? false : undefined

  const region = nestedCountryLabel(country?.region)
  const income = nestedCountryLabel(country?.incomeLevel)
  const lending = nestedCountryLabel(country?.lendingType)
  const capital = optionalTrimmedText(country?.capitalCity)
  const latitude = countryCoordinate(country?.latitude, -90, 90)
  const longitude = countryCoordinate(country?.longitude, -180, 180)
  const optionalMalformed = region.malformed || income.malformed || lending.malformed || capital.malformed || latitude.malformed || longitude.malformed
  const responseValid = metadataValid && (providerRows.length === 0 || providerIdentityValid)
  const requestValid = request?.valid !== false
  const semanticIdentityMatch = transport.bound ? identityMatch : request?.valid === false ? false : undefined
  const structurallyInvalid = !responseValid || !transport.valid || !requestValid || identityMatch === false
  const state = structurallyInvalid
    ? 'invalid' as const
    : providerRows.length === 0
      ? transport.bound ? 'empty' as const : 'partial' as const
      : optionalMalformed || !transport.bound
        ? 'partial' as const
        : 'ready' as const
  const evidence = {
    'data-request-bound': String(transport.bound),
    'data-request-contract': 'exact-world-bank-country-v2',
    'data-requested-country-code': request?.valid ? request.code : undefined,
    'data-provider-country-code': providerCode,
    'data-provider-iso2-code': providerIso2,
    'data-identity-match': semanticIdentityMatch === undefined ? 'unbound' : String(semanticIdentityMatch),
    'data-contract-valid': String(state === 'ready' || state === 'empty'),
    'data-provider-record-count': String(providerRows.length),
  }

  if (state === 'invalid') return <div className="domain-card domain-empty" data-domain-card="country-profile" data-result-state="invalid" {...evidence}>
    <h3>Invalid World Bank country response</h3>
    <p>{!transport.valid
      ? 'The successful response was not bound to the supported exact bodyless GET World Bank country request.'
      : identityMatch === false && request?.valid && providerIdentityValid
        ? 'The returned country identity does not match the country in the executed World Bank request, so country details are withheld.'
        : request?.valid === false
          ? 'The executed request URL is not the supported World Bank V2 single-country JSON endpoint.'
          : 'The HTTP-success payload does not match the documented World Bank V2 country response envelope.'}</p>
  </div>

  if (state === 'empty') return <div className="domain-card domain-empty" data-domain-card="country-profile" data-result-state="empty" {...evidence}><h3>Country profile unavailable</h3><p>World Bank returned a valid empty country collection for this exact executed request.</p></div>
  if (state === 'partial' && providerRows.length === 0) return <div className="domain-card domain-empty" data-domain-card="country-profile" data-result-state="partial" {...evidence}><h3>Unbound country response</h3><p>The empty response is coherent, but executed transport identity is unavailable, so semantic emptiness is not trusted.</p></div>

  const code = providerIso2 ?? providerCode ?? api.monogram
  const facts = [
    ['Capital city', capital.value ?? '—'],
    ['Income group', income.value ?? '—'],
    ['Lending type', lending.value ?? '—'],
    ['Coordinates', latitude.value && longitude.value ? `${latitude.value}, ${longitude.value}` : '—'],
  ]
  return <div className="country-preview" data-domain-card="country-profile" data-result-state={state} {...evidence}>
    <div className="country-hero"><span className="country-code">{code}</span><div><small>World profile</small><h3>{name}</h3><p><span>●</span> {region.value ?? 'Region unavailable'}</p></div><span className="country-globe" aria-hidden="true">◎</span></div>
    {state === 'partial' && <p className="domain-note">{!transport.bound ? 'The country record is structurally usable, but executed-request identity is unavailable, so this result is not marked ready.' : 'Some optional World Bank country fields were malformed and have been withheld.'}</p>}
    <dl className="country-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </div>
}

export function StarWarsPeoplePreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const cards: SemanticCard[] = recordArray(root.results).map((person) => ({
    title: cleanText(person.name) ?? 'Star Wars character',
    eyebrow: `Born ${previewValue(person.birth_year)} · ${cleanText(person.gender) ?? 'Profile'}`,
    badge: textArray(person.species).length ? `${textArray(person.species).length} species link` : 'Human / unknown',
    description: 'Character dossier assembled from SWAPI profile and relationship fields.',
    metrics: [
      { label: 'Height', value: person.height === 'unknown' ? 'Unknown' : `${previewValue(person.height)} cm` },
      { label: 'Mass', value: person.mass === 'unknown' ? 'Unknown' : `${previewValue(person.mass)} kg` },
      { label: 'Films', value: String(Array.isArray(person.films) ? person.films.length : 0) },
      { label: 'Homeworld', value: cleanText(person.homeworld)?.split('/').filter(Boolean).at(-1) ?? 'Unknown' },
    ],
    tags: [cleanText(person.eye_color), cleanText(person.hair_color), cleanText(person.skin_color)].filter((value): value is string => Boolean(value)),
  }))
  return <SemanticCards cards={cards} emptyTitle="Star Wars people unavailable"/>
}

export function AnimeQuotePreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const status = trimmedText(root.status)
  const quote = isRecord(root.data) ? root.data : undefined
  const anime = quote && isRecord(quote.anime) ? quote.anime : undefined
  const character = quote && isRecord(quote.character) ? quote.character : undefined
  const rawContent = quote ? trimmedText(quote.content) : undefined
  const content = rawContent ? cleanText(rawContent) : undefined
  const animeId = anime ? positiveSafeInteger(anime.id) : undefined
  const animeName = anime ? trimmedText(anime.name) : undefined
  const altName = optionalTrimmedText(anime?.altName)
  const characterId = character ? positiveSafeInteger(character.id) : undefined
  const characterName = character ? trimmedText(character.name) : undefined
  const contractValid = status === 'success' && Boolean(content && animeId && animeName && characterId && characterName) && !altName.malformed

  if (!contractValid) return <div className="domain-card domain-empty" data-domain-card="anime-quote" data-result-state="invalid" data-provider-status={status ?? ''} data-contract-valid="false"><h3>Anime quote unavailable</h3><p>AnimeChan returned a response that does not match its documented Quote contract.</p></div>

  return <div className="dictionary-preview anime-quote-preview" data-domain-card="anime-quote" data-result-state="ready" data-provider-status={status} data-contract-valid="true" data-anime-id={animeId} data-character-id={characterId}><div className="dictionary-hero"><div><span>Anime quote stage</span><strong>{animeName}</strong><b>{characterName}</b></div><span aria-hidden="true">“</span></div><div className="dictionary-meanings"><section><header><span>AQ</span><h3>{characterName}</h3></header><ol><li><p>“{content}”</p><blockquote>{altName.value ?? animeName}</blockquote></li></ol></section></div></div>
}

type SsotStat = { label: string; value: string; note?: string }

export function SsotStatStrip({ eyebrow, title, stats }: { eyebrow: string; title: string; stats: SsotStat[] }) {
  return <div className="ssot-stat-strip"><div className="ssot-stat-heading"><small>{eyebrow}</small><strong>{title}</strong></div><div className="ssot-stat-grid">{stats.map((stat) => <article key={stat.label}><small>{stat.label}</small><strong>{stat.value}</strong>{stat.note && <span>{stat.note}</span>}</article>)}</div></div>
}

export function CarparkAvailabilityPreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const snapshot = recordArray(root.items)[0] ?? {}
  const carparks = recordArray(snapshot.carpark_data)
  const normalized = carparks.map((carpark) => {
    const lotTypes = recordArray(carpark.carpark_info)
    const total = lotTypes.reduce((sum, info) => sum + (numberValue(info.total_lots) ?? 0), 0)
    const available = lotTypes.reduce((sum, info) => sum + (numberValue(info.lots_available) ?? 0), 0)
    const labels = lotTypes.map((info) => cleanText(info.lot_type)).filter((value): value is string => Boolean(value))
    return { carpark, total, available, lotTypes: labels, occupancy: total > 0 ? ((total - available) / total) * 100 : 0 }
  })
  const totalLots = normalized.reduce((sum, item) => sum + item.total, 0)
  const totalAvailable = normalized.reduce((sum, item) => sum + item.available, 0)
  const occupancy = totalLots > 0 ? ((totalLots - totalAvailable) / totalLots) * 100 : 0
  const cards: SemanticCard[] = normalized.slice(0, 8).map(({ carpark, total, available, lotTypes, occupancy: itemOccupancy }) => ({
    title: cleanText(carpark.carpark_number) ?? 'Carpark',
    eyebrow: `Updated ${cleanText(carpark.update_datetime) ?? 'recently'}`,
    badge: `${formatNumber(itemOccupancy, 0)}% occupied`,
    metrics: [
      { label: 'Available lots', value: compactNumber(available) },
      { label: 'Total lots', value: compactNumber(total) },
      { label: 'Lot types', value: lotTypes.join(', ') || '—' },
    ],
  }))
  if (!cards.length) return <div className="weather-empty"><strong>Carpark availability unavailable</strong><span>No carpark records were returned.</span></div>
  return <div className="ssot-stack"><SsotStatStrip eyebrow="Singapore public carpark network" title={dateParts(snapshot.timestamp).full || previewValue(snapshot.timestamp)} stats={[
    { label: 'Carparks', value: compactNumber(carparks.length), note: 'live records' },
    { label: 'Available lots', value: compactNumber(totalAvailable), note: 'across returned carparks' },
    { label: 'Network occupancy', value: `${formatNumber(occupancy, 1)}%`, note: 'computed from lot totals' },
  ]}/><SemanticCards cards={cards} emptyTitle="Carpark records unavailable"/></div>
}

export function NhtsaMakesPreview({ data }: { data: unknown }) {
  const root = isRecord(data) ? data : {}
  const results = recordArray(root.Results)
  const cards: SemanticCard[] = results.slice(0, 8).map((make) => ({
    title: cleanText(make.Make_Name) ?? 'Vehicle make',
    eyebrow: 'NHTSA vPIC manufacturer registry',
    badge: `ID ${previewValue(make.Make_ID)}`,
    metrics: [{ label: 'Make ID', value: previewValue(make.Make_ID) }],
  }))
  return <div className="ssot-stack"><SsotStatStrip eyebrow="U.S. vehicle product information catalog" title="Manufacturer directory" stats={[
    { label: 'Registry count', value: compactNumber(numberValue(root.Count) ?? results.length), note: 'manufacturers' },
    { label: 'Previewed', value: String(Math.min(results.length, 8)), note: 'first records' },
  ]}/><SemanticCards cards={cards} emptyTitle="Vehicle makes unavailable"/></div>
}

const GO_MODULE_VERSION = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+incompatible)?$/
const GO_PSEUDO_VERSION = /-(?:[0-9A-Za-z-]+\.)*\d{14}-[0-9A-Za-z]{12,}(?:\+incompatible)?$/

type GoModuleVersion = { raw: string; major: bigint; minor: bigint; patch: bigint; prerelease: string[] }

const parseGoModuleVersion = (value: unknown): GoModuleVersion | undefined => {
  if (typeof value !== 'string' || value.trim() !== value || GO_PSEUDO_VERSION.test(value)) return undefined
  const match = GO_MODULE_VERSION.exec(value)
  if (!match) return undefined
  const prerelease = match[4]?.split('.') ?? []
  if (prerelease.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0'))) return undefined
  return { raw: value, major: BigInt(match[1]), minor: BigInt(match[2]), patch: BigInt(match[3]), prerelease }
}

const compareGoPrerelease = (left: string[], right: string[]): number => {
  if (!left.length && !right.length) return 0
  if (!left.length) return 1
  if (!right.length) return -1
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index]
    const b = right[index]
    if (a === undefined) return -1
    if (b === undefined) return 1
    if (a === b) continue
    const aNumeric = /^\d+$/.test(a)
    const bNumeric = /^\d+$/.test(b)
    if (aNumeric && bNumeric) return BigInt(a) < BigInt(b) ? -1 : 1
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1
    return a < b ? -1 : 1
  }
  return 0
}

const compareGoModuleVersions = (left: GoModuleVersion, right: GoModuleVersion): number => {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1
  }
  return compareGoPrerelease(left.prerelease, right.prerelease)
}

const escapeGoProxyPath = (value: string): string =>
  [...value].map((character) => /[A-Z]/.test(character) ? `!${character.toLowerCase()}` : character).join('')

const unescapeGoProxyPath = (value: string): string | undefined => {
  let result = ''
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character !== '!') { result += character; continue }
    const next = value[index + 1]
    if (!next || !/[a-z]/.test(next)) return undefined
    result += next.toUpperCase()
    index += 1
  }
  return result || undefined
}

const requestedGoModule = (requestUrl?: string): string | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'proxy.golang.org' || url.port || url.username || url.password || url.search || url.hash) return undefined
    const suffix = '/@v/list'
    if (!url.pathname.startsWith('/') || !url.pathname.endsWith(suffix)) return undefined
    const encodedPath = url.pathname.slice(1, -suffix.length)
    if (!encodedPath) return undefined
    const escapedPath = decodeURIComponent(encodedPath)
    const modulePath = unescapeGoProxyPath(escapedPath)
    if (!modulePath || escapeGoProxyPath(modulePath) !== escapedPath) return undefined
    const canonicalPath = encodeURIComponent(escapedPath).replace(/%2F/gi, '/')
    const canonical = `https://proxy.golang.org/${canonicalPath}/@v/list`
    return requestUrl === canonical ? modulePath : undefined
  } catch { return undefined }
}

const GO_MODULE_REQUEST_CONTRACT = 'exact-go-module-version-list-v2'

const bindGoModuleRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext) => {
  const displayedModule = requestedGoModule(requestUrl)
  if (requestUrl && !displayedModule) return { module: undefined, bound: false, invalid: true }
  if (!executedRequest) return { module: displayedModule, bound: false, invalid: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || !requestUrl || executedRequest.url !== requestUrl) {
    return { module: displayedModule, bound: false, invalid: true }
  }
  const executedModule = requestedGoModule(executedRequest.url)
  if (!executedModule || executedModule !== displayedModule) return { module: executedModule ?? displayedModule, bound: false, invalid: true }
  return { module: executedModule, bound: true, invalid: false }
}

export function GoModuleVersionsPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <CardEmpty domain="go-module-versions" title="Invalid Go module proxy response" detail="The parsed HTTP-success response was not the expected Go module version-list object." state="invalid"/>
  }
  const root = data as Record<string, unknown>
  if (!Array.isArray(root.versions)) {
    return <CardEmpty domain="go-module-versions" title="Invalid Go module proxy response" detail="The parsed response did not contain the expected versions array." state="invalid"/>
  }
  const binding = bindGoModuleRequest(requestUrl, executedRequest)
  if (binding.invalid) {
    return <CardEmpty domain="go-module-versions" title="Invalid Go module request identity" detail="The successful response is not bound to the exact canonical bodyless GET proxy.golang.org module version-list request." state="invalid"/>
  }
  const requestModule = binding.module

  const providerVersionCount = root.versions.length
  const trustedVersions: GoModuleVersion[] = []
  const seen = new Set<string>()
  let invalidVersionCount = 0
  for (const candidate of root.versions) {
    const parsed = parseGoModuleVersion(candidate)
    if (!parsed || seen.has(parsed.raw)) { invalidVersionCount += 1; continue }
    seen.add(parsed.raw)
    trustedVersions.push(parsed)
  }

  if (providerVersionCount === 0) {
    const state = binding.bound ? 'empty' : 'partial'
    return <div className="domain-card domain-empty" data-domain-card="go-module-versions" data-ssot-reference="go-module-proxy" data-result-state={state} data-request-contract={GO_MODULE_REQUEST_CONTRACT} data-request-bound={String(binding.bound)} data-requested-module={requestModule} data-provider-version-count="0" data-valid-version-count="0" data-invalid-version-count="0"><h3>No tagged module versions listed</h3><p>{binding.bound && requestModule ? `The Go module proxy returned a valid exact-request-bound empty @v/list response for ${requestModule}.` : 'The parsed @v/list response is empty, but executed-request identity is unavailable.'}</p></div>
  }
  if (!trustedVersions.length) {
    return <CardEmpty domain="go-module-versions" title="Invalid Go module version list" detail="None of the returned @v/list entries are trustworthy canonical tagged module versions." state="invalid"/>
  }

  const sorted = [...trustedVersions].sort((left, right) => compareGoModuleVersions(right, left))
  const highest = sorted[0]?.raw
  const releaseCount = trustedVersions.filter((version) => version.prerelease.length === 0).length
  const prereleaseCount = trustedVersions.length - releaseCount
  const state = binding.bound && requestModule && invalidVersionCount === 0 ? 'ready' : 'partial'

  return <div className="ssot-stack" data-domain-card="go-module-versions" data-ssot-reference="go-module-proxy" data-result-state={state} data-request-contract={GO_MODULE_REQUEST_CONTRACT} data-requested-module={requestModule} data-request-bound={String(binding.bound)} data-provider-version-count={providerVersionCount} data-valid-version-count={trustedVersions.length} data-invalid-version-count={invalidVersionCount} data-release-version-count={releaseCount} data-prerelease-version-count={prereleaseCount} data-highest-listed-version={highest}>
    <SsotStatStrip eyebrow="Official Go module proxy" title="Published module versions" stats={[
      { label: 'Trusted versions', value: compactNumber(trustedVersions.length), note: `${invalidVersionCount} invalid hidden` },
      { label: 'Tagged releases', value: compactNumber(releaseCount), note: `${prereleaseCount} prerelease${prereleaseCount === 1 ? '' : 's'}` },
      { label: 'Highest listed', value: highest ?? '—', note: 'semantic version order' },
    ]}/>
    {state === 'partial' && <p className="domain-note">{!binding.bound ? 'The version list is structurally valid, but executed-request identity is unavailable, so it cannot be bound to a specific module lookup.' : 'Some returned version lines were malformed or inconsistent with the @v/list tagged-version contract, so only validated versions are shown.'}</p>}
    <div className="ssot-version-grid">{sorted.slice(0, 24).map((version) => <code key={version.raw}>{version.raw}</code>)}</div>
  </div>
}


export { DatamuseWordPreview } from './DatamuseWordPreview'
export { IconifySearchPreview } from './IconifySearchPreview'
export { Open5eMonsterPreview } from './Open5eMonsterPreview'
export { NewtonMathPreview } from './NewtonMathPreview'
export { IpifyPublicIpPreview } from './IpifyPublicIpPreview'
export { CatFactPreview } from './CatFactPreview'

export function GeneratedImagePreview({ api, requestUrl, executedRequest, responseMedia }: { api: ApiDemo; requestUrl?: string; executedRequest?: ExecutedRequestContext; responseMedia?: ResponseMediaContext }) {
  const requestBound = Boolean(
    requestUrl
    && executedRequest
    && executedRequest.method.toUpperCase() === 'GET'
    && executedRequest.body === undefined
    && executedRequest.url === requestUrl,
  )
  const mediaValid = getApiResponseType(api) === 'image' && Boolean(responseMedia?.objectUrl) && Boolean(responseMedia?.contentType.startsWith('image/'))

  if (!requestBound || !mediaValid || !responseMedia) {
    return <div className="media-preview single" data-domain-card="generated-image" data-result-state="invalid" data-request-bound={String(requestBound)}><article><div><small>{api.category}</small><h3>Invalid generated image response</h3><p>The fetched response could not be bound to the exact supported image request.</p></div></article></div>
  }

  return <div className="media-preview single" data-domain-card="generated-image" data-result-state="ready" data-request-bound="true" data-content-type={responseMedia.contentType}><article><img src={responseMedia.objectUrl} alt={api.name}/><div><small>{api.category}</small><h3>{api.name}</h3><p>Rendered from the exact fetched response body without a second provider request.</p></div></article></div>
}

export { OpenMeteoSeasonalPreview } from './OpenMeteoSeasonalPreview'

export { NhtsaSafetyRatingsPreview } from './NhtsaSafetyRatingsPreview'

export { SingStatCpiPreview } from './SingStatCpiPreview'

export { OpenAlexWorksPreview } from './OpenAlexWorksPreview'

export { OecdCliPreview } from './OecdCliPreview'
