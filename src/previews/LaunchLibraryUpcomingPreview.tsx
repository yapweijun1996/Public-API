import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { DateList, type DateListItem } from './DateList'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger } from './semanticValidation'

export type LaunchLibraryRequest = { search: string; limit: number; order: 'net' }

type TrustedLaunch = {
  id: string
  url: string
  name: string
  net: string
  status: string
  statusAbbrev?: string
  provider?: string
  pad?: string
  location?: string
  mission?: string
  rocket?: string
}

type LaunchLibraryResult = {
  providerCount: number
  providerRecordCount: number
  trustedRecordCount: number
  malformedEvidenceCount: number
  duplicateEvidenceCount: number
  searchMismatchCount: number
  launches: TrustedLaunch[]
}

type ParsedLaunchLibrary = { request?: LaunchLibraryRequest; result?: LaunchLibraryResult; invalidReason?: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REQUEST_KEYS = ['search', 'limit', 'ordering'] as const
const NEXT_KEYS = [...REQUEST_KEYS, 'offset'] as const

const strictText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 && value === value.trim() ? value : undefined

const optionalStrictText = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null || value === '') return { malformed: false }
  const text = strictText(value)
  return text ? { value: text, malformed: false } : { malformed: true }
}

const canonicalPositiveInteger = (value: string, max: number): number | undefined => {
  if (!/^[1-9]\d*$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed <= max && String(parsed) === value ? parsed : undefined
}

const isoDateTime = (value: unknown): string | undefined => {
  const text = strictText(value)
  if (!text || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return undefined
  return Number.isFinite(Date.parse(text)) ? text : undefined
}

export const parseLaunchLibraryRequest = (executedRequest?: ExecutedRequestContext): LaunchLibraryRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'll.thespacedevs.com' || url.port || url.username || url.password
      || url.hash || url.pathname !== '/2.3.0/launches/upcoming/' || keys.length !== REQUEST_KEYS.length
      || !REQUEST_KEYS.every((key) => keys.includes(key))
      || REQUEST_KEYS.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    const rawSearch = url.searchParams.get('search') ?? ''
    const rawLimit = url.searchParams.get('limit') ?? ''
    const limit = canonicalPositiveInteger(rawLimit, 6)
    if (!rawSearch || rawSearch !== rawSearch.trim() || limit === undefined || url.searchParams.get('ordering') !== 'net') return undefined
    return { search: rawSearch, limit, order: 'net' }
  } catch {
    return undefined
  }
}

const exactNextPage = (value: unknown, request: LaunchLibraryRequest): boolean => {
  const text = strictText(value)
  if (!text) return false
  try {
    const url = new URL(text)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'll.thespacedevs.com' || url.port || url.username || url.password
      || url.hash || url.pathname !== '/2.3.0/launches/upcoming/' || keys.length !== NEXT_KEYS.length
      || !NEXT_KEYS.every((key) => keys.includes(key))
      || NEXT_KEYS.some((key) => url.searchParams.getAll(key).length !== 1)) return false
    return url.searchParams.get('search') === request.search
      && url.searchParams.get('limit') === String(request.limit)
      && url.searchParams.get('ordering') === request.order
      && url.searchParams.get('offset') === String(request.limit)
  } catch {
    return false
  }
}

const launchDetailUrl = (value: unknown, id: string): string | undefined => {
  const text = strictText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.hostname !== 'll.thespacedevs.com' || url.port || url.username || url.password
      || url.hash || url.pathname !== `/2.3.0/launches/${id}/`) return undefined
    const keys = [...url.searchParams.keys()]
    if (!keys.length) return url.toString()
    if (keys.length !== 1 || keys[0] !== 'format' || url.searchParams.getAll('format').length !== 1
      || !['api', 'json'].includes(url.searchParams.get('format') ?? '')) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

const nestedName = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  if (!isRecord(value)) return { malformed: true }
  return optionalStrictText(value.name)
}

const documentedSearchEvidence = (launch: Record<string, unknown>): string[] => {
  const values: Array<string | undefined> = [strictText(launch.name)]
  const provider = isRecord(launch.launch_service_provider) ? launch.launch_service_provider : undefined
  const mission = isRecord(launch.mission) ? launch.mission : undefined
  const pad = isRecord(launch.pad) ? launch.pad : undefined
  const location = pad && isRecord(pad.location) ? pad.location : undefined
  const rocket = isRecord(launch.rocket) ? launch.rocket : undefined
  const configuration = rocket && isRecord(rocket.configuration) ? rocket.configuration : undefined
  const manufacturer = configuration && isRecord(configuration.manufacturer) ? configuration.manufacturer : undefined
  const spacecraftFlight = rocket && isRecord(rocket.spacecraftflight) ? rocket.spacecraftflight : undefined
  const spacecraft = spacecraftFlight && isRecord(spacecraftFlight.spacecraft) ? spacecraftFlight.spacecraft : undefined
  values.push(strictText(provider?.name), strictText(mission?.name), strictText(pad?.name), strictText(location?.name),
    strictText(configuration?.name), strictText(manufacturer?.abbrev), strictText(manufacturer?.name), strictText(spacecraft?.name))
  return values.filter((value): value is string => Boolean(value))
}

const matchesDocumentedSearch = (launch: Record<string, unknown>, search: string): boolean => {
  const terms = search.normalize('NFKC').toLocaleLowerCase('en').split(/[\s,]+/).map((term) => term.trim()).filter(Boolean)
  const values = documentedSearchEvidence(launch).map((value) => value.normalize('NFKC').toLocaleLowerCase('en'))
  return terms.length > 0 && terms.every((term) => values.some((value) => value.includes(term)))
}

const parseLaunch = (value: unknown): { launch?: TrustedLaunch; malformed: number } => {
  if (!isRecord(value)) return { malformed: 1 }
  const id = strictText(value.id)
  const name = strictText(value.name)
  const net = isoDateTime(value.net)
  if (!id || !UUID_PATTERN.test(id) || !name || !net) return { malformed: 1 }
  const url = launchDetailUrl(value.url, id)
  const status = isRecord(value.status) ? value.status : undefined
  const statusId = status ? positiveSafeInteger(status.id) : undefined
  const statusName = status ? strictText(status.name) : undefined
  if (!url || !statusId || !statusName) return { malformed: 1 }
  const statusAbbrev = optionalStrictText(status?.abbrev)
  const provider = nestedName(value.launch_service_provider)
  const pad = nestedName(value.pad)
  const mission = nestedName(value.mission)
  const location = isRecord(value.pad) ? nestedName(value.pad.location) : { malformed: value.pad !== undefined && value.pad !== null }
  const rocketRecord = isRecord(value.rocket) ? value.rocket : undefined
  const configuration = rocketRecord && isRecord(rocketRecord.configuration) ? nestedName(rocketRecord.configuration) : { malformed: value.rocket !== undefined && value.rocket !== null }
  const malformed = Number(statusAbbrev.malformed) + Number(provider.malformed) + Number(pad.malformed)
    + Number(mission.malformed) + Number(location.malformed) + Number(configuration.malformed)
  return { launch: { id, url, name, net, status: statusName, statusAbbrev: statusAbbrev.value, provider: provider.value,
    pad: pad.value, location: location.value, mission: mission.value, rocket: configuration.value }, malformed }
}

export const parseLaunchLibraryResponse = (data: unknown, executedRequest?: ExecutedRequestContext): ParsedLaunchLibrary => {
  const request = parseLaunchLibraryRequest(executedRequest)
  if (!request) return { invalidReason: 'The successful response was not tied to the exact supported Launch Library upcoming-launch request.' }
  if (!isRecord(data) || !Array.isArray(data.results) || !('count' in data) || !('next' in data) || !('previous' in data)) {
    return { request, invalidReason: 'Launch Library did not return the documented pagination envelope.' }
  }
  const providerCount = nonNegativeSafeInteger(data.count)
  if (providerCount === undefined || data.previous !== null || providerCount < data.results.length) {
    return { request, invalidReason: 'Launch Library returned inconsistent first-page count or previous-page evidence.' }
  }
  if (data.results.length !== Math.min(providerCount, request.limit)) {
    return { request, invalidReason: 'Launch Library returned first-page cardinality that contradicted its count and the executed limit.' }
  }
  const shouldHaveNext = providerCount > request.limit
  if ((shouldHaveNext && !exactNextPage(data.next, request)) || (!shouldHaveNext && data.next !== null)) {
    return { request, invalidReason: 'Launch Library pagination did not preserve the exact search, limit, order, and first offset.' }
  }

  const launches: TrustedLaunch[] = []
  const seen = new Set<string>()
  let malformedEvidenceCount = 0
  let duplicateEvidenceCount = 0
  let searchMismatchCount = 0
  for (const row of data.results) {
    const parsed = parseLaunch(row)
    malformedEvidenceCount += parsed.malformed
    if (!parsed.launch || !isRecord(row)) continue
    if (seen.has(parsed.launch.id)) { duplicateEvidenceCount += 1; continue }
    seen.add(parsed.launch.id)
    if (!matchesDocumentedSearch(row, request.search)) { searchMismatchCount += 1; continue }
    launches.push(parsed.launch)
  }

  return { request, result: {
    providerCount,
    providerRecordCount: data.results.length,
    trustedRecordCount: launches.length,
    malformedEvidenceCount,
    duplicateEvidenceCount,
    searchMismatchCount,
    launches,
  } }
}

const attributes = (request?: LaunchLibraryRequest, result?: LaunchLibraryResult) => ({
  'data-domain-card': 'launch-library-upcoming',
  'data-request-bound': request ? 'true' : 'false',
  'data-request-contract': 'exact-launch-library-upcoming-v1',
  'data-search-term': request?.search,
  'data-requested-limit': request?.limit,
  'data-request-order': request?.order,
  'data-provider-count': result?.providerCount,
  'data-provider-record-count': result?.providerRecordCount,
  'data-trusted-record-count': result?.trustedRecordCount,
  'data-malformed-evidence-count': result?.malformedEvidenceCount,
  'data-duplicate-evidence-count': result?.duplicateEvidenceCount,
  'data-search-mismatch-count': result?.searchMismatchCount,
  'data-primary-launch-id': result?.launches[0]?.id,
  'data-primary-net': result?.launches[0]?.net,
  'data-primary-status': result?.launches[0]?.status,
  'data-primary-provider': result?.launches[0]?.provider,
})

const itemForLaunch = (launch: TrustedLaunch): DateListItem => {
  const date = new Date(launch.net)
  return {
    key: launch.id,
    dateText: launch.net,
    day: date.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'UTC' }),
    month: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    eyebrow: `${launch.provider ?? 'Provider unavailable'} · ${launch.statusAbbrev ?? launch.status}`,
    title: <a href={launch.url} target="_blank" rel="noreferrer">{launch.name}</a>,
    description: `${launch.location ?? launch.pad ?? 'Launch site unavailable'} · ${launch.rocket ?? launch.mission ?? 'Vehicle or mission unavailable'} · ${date.toLocaleString('en-SG', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })}`,
  }
}

export function LaunchSchedulePreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseLaunchLibraryResponse(data, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attributes(parsed.request)} data-result-state="invalid"><h3>Invalid Launch Library response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  if (result.providerCount === 0) return <div className="domain-card domain-empty" {...attributes(request, result)} data-result-state="empty"><h3>No upcoming launches matched</h3><p>The provider returned a coherent exact-request-bound empty result for “{request.search}”.</p></div>
  if (!result.launches.length) return <div className="domain-card domain-empty" {...attributes(request, result)} data-result-state="invalid"><h3>No trustworthy launch identities</h3><p>The provider returned rows, but none matched the documented search evidence with a valid native launch identity, status, time, and canonical source URL.</p></div>

  const partial = result.malformedEvidenceCount > 0 || result.duplicateEvidenceCount > 0 || result.searchMismatchCount > 0
  return <div className="domain-card launch-library-preview" {...attributes(request, result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Launch Library 2 · Upcoming launches</small><h3>Upcoming launches matching “{request.search}”</h3><p>Exact-request-bound launch identity, schedule, status, provider, vehicle, and launch-site context.</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{partial ? 'Partial evidence' : 'Request matched'}</span></header>
    {partial ? <p className="domain-note">Malformed, duplicate, or search-mismatched provider evidence was withheld. Raw JSON retains the complete response.</p> : null}
    <dl className="domain-facts"><div><dt>Provider matches</dt><dd>{result.providerCount.toLocaleString('en')}</dd></div><div><dt>Returned rows</dt><dd>{result.providerRecordCount}</dd></div><div><dt>Trusted rows</dt><dd>{result.trustedRecordCount}</dd></div><div><dt>Page size</dt><dd>{request.limit}</dd></div></dl>
    <DateList items={result.launches.map(itemForLaunch)} className="launch-schedule-preview"/>
    <p className="domain-note">Launch times and statuses can change. The anonymous production API is limited to 15 requests per hour; automated verification stays deliberately sparse.</p>
  </div>
}
