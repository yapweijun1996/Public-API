import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { finiteNumber, isRecord, optionalTrimmedText, positiveSafeInteger, trimmedText } from './semanticValidation'

export type TvmazeSearchRequest = { query: string }
type TvmazeSearchRequestIdentity = { request?: TvmazeSearchRequest; transportBound: boolean; invalidReason?: string }

type TvmazeSchedule = { time?: string; days: string[] }
type TvmazeChannel = { id: number; name: string; country?: string; officialSite?: string }
type TvmazeShow = {
  id: number
  name: string
  url: string
  relevance: number
  status?: string
  type?: string
  language?: string
  genres: string[]
  rating?: number
  runtime?: number
  premiered?: string
  ended?: string
  schedule?: TvmazeSchedule
  network?: TvmazeChannel
  webChannel?: TvmazeChannel
  officialSite?: string
  imageUrl?: string
}

type TvmazeSearchResult = {
  shows: TvmazeShow[]
  providerRecordCount: number
  trustedRecordCount: number
  malformedEvidenceCount: number
  duplicateEvidenceCount: number
}

type Evidence<T> = { value?: T; malformed: number; duplicates: number }

export const parseTvmazeSearchRequest = (requestUrl?: string): TvmazeSearchRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'api.tvmaze.com' || url.port || url.username || url.password
      || url.pathname !== '/search/shows' || url.hash || keys.length !== 1 || keys[0] !== 'q'
      || url.searchParams.getAll('q').length !== 1) return undefined
    const rawQuery = url.searchParams.get('q') ?? ''
    const query = rawQuery.trim()
    return query && query === rawQuery ? { query } : undefined
  } catch {
    return undefined
  }
}

const bindTvmazeSearchRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): TvmazeSearchRequestIdentity => {
  const request = parseTvmazeSearchRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported TVmaze show-search request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET TVmaze show-search request.' }
  }
  const executed = parseTvmazeSearchRequest(executedRequest.url)
  if (!executed || executed.query !== request.query) {
    return { request, transportBound: false, invalidReason: 'The displayed TVmaze request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const providerShowUrl = (value: unknown, id: number): string | undefined => {
  const text = trimmedText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    const match = url.pathname.match(/^\/shows\/([1-9]\d*)(?:\/[^/]+)?$/)
    if (url.protocol !== 'https:' || url.hostname !== 'www.tvmaze.com' || url.port || url.username || url.password
      || url.search || url.hash || !match || Number(match[1]) !== id) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

const optionalWebUrl = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  const text = trimmedText(value)
  if (!text) return { malformed: true }
  try {
    const url = new URL(text)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { malformed: true }
    return { value: url.toString(), malformed: false }
  } catch {
    return { malformed: true }
  }
}

const optionalDate = (value: unknown): { value?: string; malformed: boolean } => {
  const parsed = optionalTrimmedText(value)
  if (parsed.malformed || !parsed.value) return parsed
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.value)) return { malformed: true }
  const date = new Date(`${parsed.value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === parsed.value
    ? { value: parsed.value, malformed: false }
    : { malformed: true }
}

const optionalNumber = (value: unknown): { value?: number; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  const parsed = finiteNumber(value)
  return parsed === undefined ? { malformed: true } : { value: parsed, malformed: false }
}

const textList = (value: unknown): Evidence<string[]> => {
  if (value === undefined || value === null) return { value: [], malformed: 0, duplicates: 0 }
  if (!Array.isArray(value)) return { value: [], malformed: 1, duplicates: 0 }
  const items: string[] = []
  const seen = new Set<string>()
  let malformed = 0
  let duplicates = 0
  for (const entry of value) {
    const text = trimmedText(entry)
    if (!text) { malformed += 1; continue }
    const identity = text.toLocaleLowerCase('en')
    if (seen.has(identity)) { duplicates += 1; continue }
    seen.add(identity)
    items.push(text)
  }
  return { value: items, malformed, duplicates }
}

const ratingValue = (value: unknown): { value?: number; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  if (!isRecord(value)) return { malformed: true }
  return optionalNumber(value.average)
}

const scheduleValue = (value: unknown): Evidence<TvmazeSchedule> => {
  if (value === undefined || value === null) return { malformed: 0, duplicates: 0 }
  if (!isRecord(value)) return { malformed: 1, duplicates: 0 }
  const time = optionalTrimmedText(value.time)
  const validTime = !time.value || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time.value)
  const days = textList(value.days)
  return {
    value: { time: validTime ? time.value : undefined, days: days.value ?? [] },
    malformed: Number(time.malformed || !validTime) + days.malformed,
    duplicates: days.duplicates,
  }
}

const channelValue = (value: unknown): Evidence<TvmazeChannel> => {
  if (value === undefined || value === null) return { malformed: 0, duplicates: 0 }
  if (!isRecord(value)) return { malformed: 1, duplicates: 0 }
  const id = positiveSafeInteger(value.id)
  const name = trimmedText(value.name)
  if (!id || !name) return { malformed: 1, duplicates: 0 }
  let malformed = 0
  let country: string | undefined
  if (value.country !== undefined && value.country !== null) {
    if (!isRecord(value.country)) malformed += 1
    else {
      const countryName = optionalTrimmedText(value.country.name)
      const countryCode = optionalTrimmedText(value.country.code)
      malformed += Number(countryName.malformed) + Number(countryCode.malformed)
      country = countryName.value ?? countryCode.value
    }
  }
  const officialSite = optionalWebUrl(value.officialSite)
  malformed += Number(officialSite.malformed)
  return { value: { id, name, country, officialSite: officialSite.value }, malformed, duplicates: 0 }
}

const imageValue = (value: unknown): Evidence<string> => {
  if (value === undefined || value === null) return { malformed: 0, duplicates: 0 }
  if (!isRecord(value)) return { malformed: 1, duplicates: 0 }
  const candidates = ['medium', 'original'] as const
  let malformed = 0
  let selected: string | undefined
  let present = 0
  for (const key of candidates) {
    if (value[key] === undefined || value[key] === null) continue
    present += 1
    const text = trimmedText(value[key])
    try {
      const url = text ? new URL(text) : undefined
      if (!url || url.protocol !== 'https:' || url.hostname !== 'static.tvmaze.com' || url.username || url.password) malformed += 1
      else selected ??= url.toString()
    } catch {
      malformed += 1
    }
  }
  if (!present) malformed += 1
  return { value: selected, malformed, duplicates: 0 }
}

const parseShow = (value: unknown): { show?: TvmazeShow; malformed: number; duplicates: number } => {
  if (!isRecord(value)) return { malformed: 1, duplicates: 0 }
  const relevance = finiteNumber(value.score)
  if (relevance === undefined || !isRecord(value.show)) return { malformed: 1, duplicates: 0 }
  const source = value.show
  const id = positiveSafeInteger(source.id)
  const name = trimmedText(source.name)
  if (!id || !name) return { malformed: 1, duplicates: 0 }
  const url = providerShowUrl(source.url, id)
  if (!url) return { malformed: 1, duplicates: 0 }

  const status = optionalTrimmedText(source.status)
  const type = optionalTrimmedText(source.type)
  const language = optionalTrimmedText(source.language)
  const genres = textList(source.genres)
  const rating = ratingValue(source.rating)
  const runtime = optionalNumber(source.runtime)
  const premiered = optionalDate(source.premiered)
  const ended = optionalDate(source.ended)
  const schedule = scheduleValue(source.schedule)
  const network = channelValue(source.network)
  const webChannel = channelValue(source.webChannel)
  const officialSite = optionalWebUrl(source.officialSite)
  const image = imageValue(source.image)
  const malformed = Number(status.malformed) + Number(type.malformed) + Number(language.malformed)
    + genres.malformed + Number(rating.malformed) + Number(runtime.malformed) + Number(premiered.malformed)
    + Number(ended.malformed) + schedule.malformed + network.malformed + webChannel.malformed
    + Number(officialSite.malformed) + image.malformed
  const duplicates = genres.duplicates + schedule.duplicates

  return {
    show: {
      id,
      name,
      url,
      relevance,
      status: status.value,
      type: type.value,
      language: language.value,
      genres: genres.value ?? [],
      rating: rating.value,
      runtime: runtime.value,
      premiered: premiered.value,
      ended: ended.value,
      schedule: schedule.value,
      network: network.value,
      webChannel: webChannel.value,
      officialSite: officialSite.value,
      imageUrl: image.value,
    },
    malformed,
    duplicates,
  }
}

export const parseTvmazeSearchResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: TvmazeSearchRequest; result?: TvmazeSearchResult; transportBound: boolean; invalidReason?: string } => {
  const identity = bindTvmazeSearchRequest(requestUrl, executedRequest)
  const request = identity.request
  if (!request || identity.invalidReason) return { request, transportBound: false, invalidReason: identity.invalidReason }
  if (!Array.isArray(data)) return { request, transportBound: identity.transportBound, invalidReason: 'TVmaze did not return the documented show-search result array.' }

  const shows: TvmazeShow[] = []
  const seen = new Set<number>()
  let malformedEvidenceCount = 0
  let duplicateEvidenceCount = 0
  for (const row of data) {
    const parsed = parseShow(row)
    if (!parsed.show) { malformedEvidenceCount += parsed.malformed; continue }
    if (seen.has(parsed.show.id)) { duplicateEvidenceCount += 1; continue }
    seen.add(parsed.show.id)
    malformedEvidenceCount += parsed.malformed
    duplicateEvidenceCount += parsed.duplicates
    shows.push(parsed.show)
  }
  return { request, transportBound: identity.transportBound, result: {
    shows,
    providerRecordCount: data.length,
    trustedRecordCount: shows.length,
    malformedEvidenceCount,
    duplicateEvidenceCount,
  } }
}

const attrs = (request?: TvmazeSearchRequest, result?: TvmazeSearchResult, transportBound = false) => ({
  'data-domain-card': 'tvmaze-search',
  'data-request-bound': request && transportBound ? 'true' : 'false',
  'data-request-contract': 'exact-tvmaze-show-search-v2',
  'data-query': request?.query,
  'data-request-query': request?.query,
  'data-provider-record-count': result?.providerRecordCount,
  'data-trusted-record-count': result?.trustedRecordCount,
  'data-malformed-evidence-count': result?.malformedEvidenceCount,
  'data-duplicate-evidence-count': result?.duplicateEvidenceCount,
  'data-primary-show-id': result?.shows[0]?.id,
  'data-primary-relevance': result?.shows[0]?.relevance,
})

const unavailable = 'Unavailable'
const scheduleLabel = (schedule?: TvmazeSchedule) => {
  if (!schedule) return unavailable
  const parts = [schedule.days.length ? schedule.days.join(', ') : undefined, schedule.time]
  return parts.filter(Boolean).join(' at ') || 'Not announced'
}
const channelLabel = (channel?: TvmazeChannel) => channel ? `${channel.name}${channel.country ? ` · ${channel.country}` : ''}` : unavailable

export function TvmazeSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseTvmazeSearchResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request, undefined, parsed.transportBound)} data-result-state="invalid"><h3>Invalid TVmaze search response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result, transportBound } = parsed
  if (result.providerRecordCount === 0) return <div className="domain-card domain-empty" {...attrs(request, result, transportBound)} data-result-state={transportBound ? 'empty' : 'partial'}><h3>{transportBound ? 'No TVmaze shows matched' : 'TVmaze result not request-bound'}</h3><p>{transportBound ? <>TVmaze returned an exact-request-bound empty result for “{request.query}”.</> : <>TVmaze returned a coherent empty search array for “{request.query}”, but executed request evidence was unavailable.</>}</p></div>
  if (!result.shows.length) return <div className="domain-card domain-empty" {...attrs(request, result, transportBound)} data-result-state="invalid"><h3>Invalid TVmaze show identities</h3><p>TVmaze returned rows, but none carried a trustworthy show ID, name, source URL, and native relevance score.</p></div>
  const partial = !transportBound || result.malformedEvidenceCount > 0 || result.duplicateEvidenceCount > 0
  return <div className="domain-card tvmaze-search-preview bounded-media-preview" {...attrs(request, result, transportBound)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">TVmaze · Fuzzy show search</small><h3>Shows for “{request.query}”</h3><p>Exact-request-bound TVmaze identities ranked by the provider's native relevance score.</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{result.shows.length} trusted show{result.shows.length === 1 ? '' : 's'}</span></header>
    {partial ? <p className="domain-note">{transportBound ? 'Malformed or duplicate identity and optional evidence is withheld. Raw JSON retains the complete provider response.' : 'The TVmaze response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}</p> : null}
    <dl className="domain-facts"><div><dt>Provider rows</dt><dd>{result.providerRecordCount}</dd></div><div><dt>Trusted shows</dt><dd>{result.trustedRecordCount}</dd></div><div><dt>Primary TVmaze ID</dt><dd>{result.shows[0].id}</dd></div><div><dt>Primary relevance</dt><dd>{result.shows[0].relevance.toLocaleString('en', { maximumFractionDigits: 7 })}</dd></div></dl>
    <div className={`media-preview ${result.shows.length === 1 ? 'single' : ''}`} aria-label={`TVmaze results for ${request.query}`}>
      {result.shows.map((show) => <article key={show.id} data-tvmaze-show-id={show.id} data-tvmaze-relevance={show.relevance}>
        {show.imageUrl ? <img src={show.imageUrl} alt={`${show.name} TVmaze poster`} loading="lazy"/> : null}
        <div>
          <small>TVmaze #{show.id} · relevance {show.relevance.toLocaleString('en', { maximumFractionDigits: 7 })}</small>
          <h3>{show.name}</h3>
          <p>{[show.status, show.type, show.language].filter(Boolean).join(' · ') || 'Status, type, and language unavailable'}</p>
          <p><strong>Genres:</strong> {show.genres.length ? show.genres.join(', ') : unavailable}</p>
          <dl className="domain-facts"><div><dt>Rating</dt><dd>{show.rating ?? unavailable}</dd></div><div><dt>Runtime</dt><dd>{show.runtime === undefined ? unavailable : `${show.runtime} min`}</dd></div><div><dt>Schedule</dt><dd>{scheduleLabel(show.schedule)}</dd></div><div><dt>Premiered</dt><dd>{show.premiered ?? unavailable}</dd></div><div><dt>Ended</dt><dd>{show.ended ?? unavailable}</dd></div><div><dt>Network</dt><dd>{channelLabel(show.network)}</dd></div><div><dt>Web channel</dt><dd>{channelLabel(show.webChannel)}</dd></div></dl>
          {!show.imageUrl ? <p>TVmaze returned no show image; identity and schedule evidence remain available.</p> : null}
          <p><a href={show.url} target="_blank" rel="noreferrer">View {show.name} on TVmaze</a>{show.officialSite ? <> · <a href={show.officialSite} target="_blank" rel="noreferrer">Official show site</a></> : null}</p>
        </div>
      </article>)}
    </div>
    <p className="domain-note">TVmaze is the source. Its public API data is CC BY-SA and requires attribution and ShareAlike. Show images may be absent, and this card makes no separate image-reuse-rights claim.</p>
  </div>
}
