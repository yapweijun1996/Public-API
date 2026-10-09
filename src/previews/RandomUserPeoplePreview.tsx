import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

export type RandomUserRequest = { count: number; nationality: string }
type RandomUserRequestIdentity = { request?: RandomUserRequest; transportBound: boolean; invalidReason?: string }

type SyntheticProfile = {
  uuid: string
  name: string
  nationality: string
  portraitUrl: string
  gender?: 'female' | 'male'
  age?: number
}

type RandomUserResult = {
  providerVersion: string
  providerSeed: string
  providerCount: number
  profiles: SyntheticProfile[]
  malformed: number
  duplicates: number
  wrongNationality: number
  supplementalMalformed: number
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const nationalityOptions = (api: ApiDemo): Set<string> => {
  const field = api.fields.find((candidate) => candidate.id === 'nationality')
  return new Set((field?.options ?? []).map(({ value }) => value))
}

export const parseRandomUserRequest = (requestUrl: string | undefined, api: ApiDemo): RandomUserRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'randomuser.me' || url.port || url.username || url.password || url.pathname !== '/api/1.4/' || url.hash) return undefined
    const keys = [...url.searchParams.keys()]
    if (keys.length !== 2 || keys.some((key) => key !== 'results' && key !== 'nat')) return undefined
    const resultsValues = url.searchParams.getAll('results')
    const nationalityValues = url.searchParams.getAll('nat')
    if (resultsValues.length !== 1 || nationalityValues.length !== 1) return undefined
    const countText = resultsValues[0]
    if (!/^[1-9]\d*$/.test(countText)) return undefined
    const count = Number(countText)
    const countField = api.fields.find((candidate) => candidate.id === 'count')
    const min = countField?.min ?? 1
    const max = countField?.max ?? Number.MAX_SAFE_INTEGER
    if (!Number.isSafeInteger(count) || count < min || count > max) return undefined
    const nationality = nationalityValues[0]
    if (!nationality || nationality !== nationality.toLowerCase() || !nationalityOptions(api).has(nationality)) return undefined
    return { count, nationality }
  } catch {
    return undefined
  }
}

const bindRandomUserRequest = (requestUrl: string | undefined, api: ApiDemo, executedRequest?: ExecutedRequestContext): RandomUserRequestIdentity => {
  const request = parseRandomUserRequest(requestUrl, api)
  if (!request) return { transportBound: false, invalidReason: 'The successful response was not tied to the exact supported Random User v1.4 request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Random User v1.4 request.' }
  }
  const executed = parseRandomUserRequest(executedRequest.url, api)
  if (!executed || executed.count !== request.count || executed.nationality !== request.nationality) {
    return { request, transportBound: false, invalidReason: 'The displayed Random User request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const portraitUrl = (value: unknown): string | undefined => {
  const text = trimmedText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.hostname !== 'randomuser.me' || url.port || url.username || url.password || url.search || url.hash) return undefined
    if (!/^\/api\/portraits\/(?:men|women)\/\d+\.jpg$/.test(url.pathname)) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

const parseProfile = (value: unknown, request: RandomUserRequest): { profile?: SyntheticProfile; wrongNationality: boolean; supplementalMalformed: number } => {
  if (!isRecord(value)) return { wrongNationality: false, supplementalMalformed: 0 }
  const login = isRecord(value.login) ? value.login : undefined
  const uuid = trimmedText(login?.uuid)?.toLowerCase()
  const name = isRecord(value.name) ? value.name : undefined
  const first = trimmedText(name?.first)
  const last = trimmedText(name?.last)
  const nationality = trimmedText(value.nat)
  const picture = isRecord(value.picture) ? value.picture : undefined
  const portrait = portraitUrl(picture?.large)
  const wrongNationality = Boolean(nationality && nationality.toLowerCase() !== request.nationality)
  if (!uuid || !uuidPattern.test(uuid) || !first || !last || !nationality || wrongNationality || !portrait) return { wrongNationality, supplementalMalformed: 0 }

  let supplementalMalformed = 0
  let gender: SyntheticProfile['gender']
  if (value.gender !== undefined && value.gender !== null) {
    if (value.gender === 'female' || value.gender === 'male') gender = value.gender
    else supplementalMalformed += 1
  }
  let age: number | undefined
  if (value.dob !== undefined && value.dob !== null) {
    if (!isRecord(value.dob)) supplementalMalformed += 1
    else if (value.dob.age !== undefined && value.dob.age !== null) {
      age = positiveSafeInteger(value.dob.age)
      if (age === undefined) supplementalMalformed += 1
    }
  }

  return {
    profile: { uuid, name: `${first} ${last}`, nationality: nationality.toUpperCase(), portraitUrl: portrait, gender, age },
    wrongNationality: false,
    supplementalMalformed,
  }
}

export const parseRandomUserResponse = (data: unknown, api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: RandomUserRequest; result?: RandomUserResult; transportBound: boolean; invalidReason?: string } => {
  const identity = bindRandomUserRequest(requestUrl, api, executedRequest)
  const request = identity.request
  if (!request || identity.invalidReason) return { request, transportBound: false, invalidReason: identity.invalidReason }
  if (!isRecord(data) || !Array.isArray(data.results) || !isRecord(data.info)) return { request, transportBound: identity.transportBound, invalidReason: 'Random User did not return its documented results and info envelope.' }

  const providerCount = nonNegativeSafeInteger(data.info.results)
  const page = positiveSafeInteger(data.info.page)
  const providerVersion = trimmedText(data.info.version)
  const providerSeed = trimmedText(data.info.seed)
  if (providerCount === undefined || providerCount !== request.count || data.results.length !== request.count || page !== 1 || providerVersion !== '1.4' || !providerSeed) {
    return { request, transportBound: identity.transportBound, invalidReason: 'Random User did not acknowledge the executed result count, first page, or pinned v1.4 provider contract.' }
  }

  const profiles: SyntheticProfile[] = []
  const seen = new Set<string>()
  let malformed = 0
  let duplicates = 0
  let wrongNationality = 0
  let supplementalMalformed = 0
  for (const row of data.results) {
    const parsed = parseProfile(row, request)
    supplementalMalformed += parsed.supplementalMalformed
    if (parsed.wrongNationality) { wrongNationality += 1; continue }
    if (!parsed.profile) { malformed += 1; continue }
    if (seen.has(parsed.profile.uuid)) { duplicates += 1; continue }
    seen.add(parsed.profile.uuid)
    profiles.push(parsed.profile)
  }
  if (!profiles.length) return { request, transportBound: identity.transportBound, invalidReason: 'Random User returned no trustworthy generated-profile UUID identity for the executed request.' }

  return { request, transportBound: identity.transportBound, result: { providerVersion, providerSeed, providerCount, profiles, malformed, duplicates, wrongNationality, supplementalMalformed } }
}

const attrs = (request?: RandomUserRequest, result?: RandomUserResult, transportBound = false) => ({
  'data-domain-card': 'random-user-people',
  'data-request-bound': request && transportBound ? 'true' : 'false',
  'data-request-contract': 'exact-randomuser-1.4-v2',
  'data-request-count': request?.count,
  'data-request-nationality': request?.nationality,
  'data-provider-record-count': result?.providerCount,
  'data-valid-profile-count': result?.profiles.length,
  'data-malformed-profile-count': result?.malformed,
  'data-duplicate-profile-count': result?.duplicates,
  'data-wrong-nationality-count': result?.wrongNationality,
  'data-supplemental-malformed-count': result?.supplementalMalformed,
  'data-primary-profile-uuid': result?.profiles[0]?.uuid,
})

const genderLabel = (value?: SyntheticProfile['gender']) => value ? `${value[0].toUpperCase()}${value.slice(1)}` : undefined

export function RandomUserPeoplePreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseRandomUserResponse(data, api, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request, undefined, parsed.transportBound)} data-result-state="invalid"><h3>Invalid generated-profile response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result, transportBound } = parsed
  const partial = !transportBound || result.malformed > 0 || result.duplicates > 0 || result.wrongNationality > 0 || result.supplementalMalformed > 0 || result.profiles.length !== request.count
  return <div className="domain-card random-user-people-preview bounded-media-preview" {...attrs(request, result, transportBound)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Random User · synthetic test profiles</small><h3>{result.profiles.length} generated placeholder profile{result.profiles.length === 1 ? '' : 's'}</h3><p>These identities are generated test data for prototypes and demos. Do not treat the names or profile details as real-person records.</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{partial ? 'Partial evidence' : 'Verified generated set'}</span></header>
    {partial ? <p className="domain-note">{transportBound ? 'Only generated profiles with unique provider UUIDs, matching nationality, and trusted provider portraits are shown. Malformed or conflicting evidence is withheld.' : 'The Random User response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}</p> : null}
    <dl className="domain-facts"><div><dt>Requested profiles</dt><dd>{request.count}</dd></div><div><dt>Validated profiles</dt><dd>{result.profiles.length}</dd></div><div><dt>Nationality filter</dt><dd>{request.nationality.toUpperCase()}</dd></div><div><dt>Provider version</dt><dd>{result.providerVersion}</dd></div></dl>
    <div className={`media-preview ${result.profiles.length === 1 ? 'single' : ''}`} aria-label="Generated placeholder profiles">
      {result.profiles.map((profile) => <article key={profile.uuid} data-profile-uuid={profile.uuid}><img src={profile.portraitUrl} alt={`Generated placeholder profile for ${profile.name}`} loading="lazy"/><div><small>Synthetic profile · {profile.nationality}</small><h3>{profile.name}</h3><p>{[genderLabel(profile.gender), profile.age !== undefined ? `Age ${profile.age}` : undefined].filter(Boolean).join(' · ') || 'Generated identity'}</p></div></article>)}
    </div>
    <p className="domain-note">Primary presentation intentionally omits generated email, phone, street address, login credentials/hashes, and national-ID-like fields. Raw JSON remains available for developer inspection.</p>
    <p className="domain-note">Portrait reuse rights are separate from the generated profile data. Review Random User copyright and its UI Faces guidance before redistributing portraits.</p>
  </div>
}
