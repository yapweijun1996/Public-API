import { isRecord, nonNegativeSafeInteger, optionalTrimmedText, trimmedText } from './semanticValidation'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'

type MediaType = 'image' | 'audio'
type OpenverseRequest = { query: string; limit: number; mediaType: MediaType; transportBound: boolean }
type OpenverseItem = { id: string; title?: string; creator?: string; license: string; licenseUrl?: string; source: string; sourceUrl: string; mediaUrl: string; thumbnailUrl?: string }
type OpenverseResult = { items: OpenverseItem[]; providerCount: number; total: number; pageCount: number; malformed: number; duplicates: number; overflow: number; licenseGaps: number; supplementalMalformed: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LICENSE = /^[a-z0-9][a-z0-9-]*$/i
const httpsUrl = (value: unknown) => {
  const text = trimmedText(value)
  if (!text) return undefined
  try { const url = new URL(text); return url.protocol === 'https:' ? url.toString() : undefined } catch { return undefined }
}

export const parseOpenverseRequest = (requestUrl?: string): OpenverseRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const mediaType: MediaType | undefined = url.pathname === '/v1/images/' ? 'image' : url.pathname === '/v1/audio/' ? 'audio' : undefined
    const keys = [...url.searchParams.keys()]
    const expected = ['q', 'page_size', 'page']
    if (url.protocol !== 'https:' || url.hostname !== 'api.openverse.org' || url.port || url.username || url.password || url.hash || !mediaType) return undefined
    if (keys.length !== expected.length || !expected.every((key) => keys.includes(key)) || expected.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    if (url.searchParams.get('page') !== '1') return undefined
    const rawQuery = url.searchParams.get('q') ?? ''
    const query = rawQuery.trim()
    const rawLimit = url.searchParams.get('page_size') ?? ''
    if (!query || query !== rawQuery || !/^[1-9]\d*$/.test(rawLimit)) return undefined
    const limit = Number(rawLimit)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20 || String(limit) !== rawLimit) return undefined
    return { query, limit, mediaType, transportBound: false }
  } catch { return undefined }
}

const bindOpenverseRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): OpenverseRequest | null | undefined => {
  const displayed = parseOpenverseRequest(requestUrl)
  if (!displayed) return undefined
  if (!executedRequest) return displayed
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return null
  const executed = parseOpenverseRequest(executedRequest.url)
  return executed && executed.query === displayed.query && executed.limit === displayed.limit && executed.mediaType === displayed.mediaType
    ? { ...executed, transportBound: true }
    : null
}

const parseItem = (value: unknown): { item?: OpenverseItem; malformed: boolean; licenseGap: boolean; supplementalMalformed: boolean } => {
  if (!isRecord(value)) return { malformed: true, licenseGap: false, supplementalMalformed: false }
  const id = trimmedText(value.id)
  const license = trimmedText(value.license)
  const source = trimmedText(value.source) ?? trimmedText(value.provider)
  const sourceUrl = httpsUrl(value.foreign_landing_url)
  const mediaUrl = httpsUrl(value.url)
  if (!id || !UUID.test(id) || !license || !LICENSE.test(license) || !source || !sourceUrl || !mediaUrl) return { malformed: true, licenseGap: !license, supplementalMalformed: false }

  const title = optionalTrimmedText(value.title)
  const creator = optionalTrimmedText(value.creator)
  const provider = optionalTrimmedText(value.provider)
  const licenseVersion = optionalTrimmedText(value.license_version)
  const thumbnail = optionalTrimmedText(value.thumbnail)
  const licenseUrlRaw = optionalTrimmedText(value.license_url)
  const thumbnailUrl = thumbnail.value ? httpsUrl(thumbnail.value) : undefined
  const licenseUrl = licenseUrlRaw.value ? httpsUrl(licenseUrlRaw.value) : undefined
  const supplementalMalformed = title.malformed || creator.malformed || provider.malformed || licenseVersion.malformed || thumbnail.malformed || licenseUrlRaw.malformed || Boolean(thumbnail.value && !thumbnailUrl) || Boolean(licenseUrlRaw.value && !licenseUrl)
  return {
    item: { id: id.toLowerCase(), title: title.value, creator: creator.value, license: license.toLowerCase(), licenseUrl, source, sourceUrl, mediaUrl, thumbnailUrl },
    malformed: false,
    licenseGap: !licenseUrl,
    supplementalMalformed,
  }
}

export const parseOpenverseResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: OpenverseRequest; result?: OpenverseResult; invalidReason?: string } => {
  const displayedRequest = parseOpenverseRequest(requestUrl)
  if (!displayedRequest) return { invalidReason: 'The successful response was not tied to the exact supported Openverse search request.' }
  const request = bindOpenverseRequest(requestUrl, executedRequest)
  if (!request) return { request: displayedRequest, invalidReason: 'The successful response was not bound to the exact bodyless GET Openverse request executed by the workbench.' }
  if (!isRecord(data) || !Array.isArray(data.results)) return { request, invalidReason: 'Openverse did not return the documented paginated search response.' }
  const page = nonNegativeSafeInteger(data.page)
  const pageSize = nonNegativeSafeInteger(data.page_size)
  const pageCount = nonNegativeSafeInteger(data.page_count)
  const total = nonNegativeSafeInteger(data.result_count)
  if (page !== 1 || pageSize !== request.limit || pageCount === undefined || total === undefined) return { request, invalidReason: 'Openverse pagination metadata did not acknowledge the executed first-page request with native integer values.' }
  const expectedPageCount = total === 0 ? 0 : Math.ceil(total / request.limit)
  if (pageCount !== expectedPageCount) return { request, invalidReason: 'Openverse result-count and page-count metadata were contradictory.' }

  const parsed = data.results.map(parseItem)
  const seen = new Set<string>()
  const items: OpenverseItem[] = []
  let duplicates = 0
  let overflow = 0
  for (const entry of parsed) {
    if (!entry.item) continue
    if (seen.has(entry.item.id)) { duplicates += 1; continue }
    seen.add(entry.item.id)
    if (items.length >= request.limit) { overflow += 1; continue }
    items.push(entry.item)
  }
  const providerCount = data.results.length
  const cardinalityMismatch = providerCount !== Math.min(request.limit, total)
  return { request, result: { items, providerCount, total, pageCount, malformed: parsed.filter((entry) => entry.malformed).length, duplicates, overflow, licenseGaps: parsed.filter((entry) => entry.licenseGap).length, supplementalMalformed: parsed.filter((entry) => entry.supplementalMalformed).length + (cardinalityMismatch ? 1 : 0) } }
}

const attrs = (request?: OpenverseRequest, result?: OpenverseResult) => ({
  'data-domain-card': 'openverse-search', 'data-request-bound': request?.transportBound ? 'true' : 'false', 'data-request-method': request?.transportBound ? 'GET' : undefined, 'data-request-contract': 'exact-openverse-search-v1',
  'data-request-query': request?.query, 'data-request-media-type': request?.mediaType, 'data-request-limit': request?.limit,
  'data-provider-record-count': result?.providerCount, 'data-provider-total': result?.total, 'data-provider-page-count': result?.pageCount,
  'data-valid-record-count': result?.items.length, 'data-malformed-record-count': result?.malformed, 'data-duplicate-record-count': result?.duplicates,
  'data-overflow-record-count': result?.overflow, 'data-license-gap-count': result?.licenseGaps, 'data-supplemental-malformed-count': result?.supplementalMalformed,
  'data-primary-media-id': result?.items[0]?.id, 'data-primary-license': result?.items[0]?.license,
})

export function OpenverseSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseOpenverseResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request)} data-result-state="invalid"><h3>Invalid Openverse search response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  if (!result.providerCount && result.total === 0) return <div className="domain-card domain-empty" {...attrs(request, result)} data-result-state={request.transportBound ? 'empty' : 'partial'}><h3>{request.transportBound ? 'No Openverse media matched' : 'Unbound Openverse empty response'}</h3><p>{request.transportBound ? `Openverse returned a coherent, request-bound zero-result ${request.mediaType} search for “${request.query}”.` : 'Openverse returned a coherent zero-result envelope, but executed transport identity is unavailable, so semantic emptiness is not trusted.'}</p></div>
  if (!result.items.length) return <div className="domain-card domain-empty" {...attrs(request, result)} data-result-state="invalid"><h3>Invalid Openverse media identities</h3><p>Records were returned, but none carried trustworthy Openverse identity, license, source, and HTTPS media evidence.</p></div>
  const expectedRows = Math.min(request.limit, result.total)
  const partial = !request.transportBound || result.malformed > 0 || result.duplicates > 0 || result.overflow > 0 || result.licenseGaps > 0 || result.supplementalMalformed > 0 || result.providerCount !== expectedRows || result.items.length !== expectedRows
  const mediaLabel = request.mediaType === 'image' ? 'images' : 'audio works'
  return <div className="domain-card openverse-search-preview bounded-media-preview" {...attrs(request, result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Openverse · Openly licensed {mediaLabel}</small><h3>{request.query}</h3><p>{request.transportBound ? 'Exact-request-bound media with Openverse UUID identity, source evidence, and per-work license metadata.' : 'Validated Openverse media records from the displayed search URL; executed transport identity is unavailable, so the result is not marked ready.'}</p></div><span className="domain-state">{result.items.length} trusted works</span></header>
    {partial && <p className="domain-note">{!request.transportBound ? 'The response is structurally useful, but executed transport identity is unavailable, so it cannot be marked ready. ' : ''}Only records with valid Openverse identity, license, source, and HTTPS media evidence are shown. Incomplete or duplicate evidence is withheld or marked partial.</p>}
    <dl className="domain-facts"><div><dt>Total matches</dt><dd>{result.total.toLocaleString('en')}</dd></div><div><dt>Trusted works</dt><dd>{result.items.length}</dd></div><div><dt>Media type</dt><dd>{request.mediaType}</dd></div><div><dt>Primary license</dt><dd>{result.items[0].license}</dd></div></dl>
    <div className={`media-preview ${result.items.length === 1 ? 'single' : ''}`}>{result.items.map((item) => <article key={item.id} data-media-id={item.id} data-license={item.license} data-source={item.source}>
      {request.mediaType === 'image' ? <img src={item.thumbnailUrl ?? item.mediaUrl} alt={item.title ?? 'Openverse media preview'} loading="lazy"/> : item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy"/> : null}
      <div><small>{item.source} · {item.license}</small><h3>{item.title ?? 'Untitled Openverse work'}</h3><p>{item.creator ? `Creator: ${item.creator}` : 'Creator metadata unavailable'}</p><p><a href={item.sourceUrl} target="_blank" rel="noreferrer">Source work</a>{item.licenseUrl ? <> · <a href={item.licenseUrl} target="_blank" rel="noreferrer">License</a></> : null} · <a href={item.mediaUrl} target="_blank" rel="noreferrer">Media file</a></p></div>
    </article>)}</div>
    <p className="domain-note">Openverse aggregates license metadata but does not guarantee its accuracy. Verify the license and attribution requirements on the source work before reuse.</p>
  </div>
}
