import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, positiveSafeInteger, trimmedText } from './semanticValidation'

type Request = { query: string; limit: number }
type Item = {
  pageId: number
  index: number
  title: string
  imageUrl: string
  descriptionUrl: string
  license: string
  licenseUrl?: string
  artist?: string
  attributionRequired?: boolean
}
type Result = {
  items: Item[]
  providerCount: number
  malformed: number
  duplicates: number
  overflow: number
  licenseGaps: number
}

const FIXED: Record<string, string> = {
  action: 'query', generator: 'search', gsrnamespace: '6', prop: 'imageinfo',
  iiprop: 'url|extmetadata', iiurlwidth: '400', format: 'json', origin: '*',
}
const KEYS = [...Object.keys(FIXED), 'gsrsearch', 'gsrlimit']

export const parseWikimediaCommonsRequest = (requestUrl?: string): Request | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'commons.wikimedia.org' || url.port || url.username || url.password || url.hash || url.pathname !== '/w/api.php') return undefined
    if (keys.length !== KEYS.length || !KEYS.every((key) => keys.includes(key))) return undefined
    if (KEYS.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    if (Object.entries(FIXED).some(([key, value]) => url.searchParams.get(key) !== value)) return undefined
    const rawQuery = url.searchParams.get('gsrsearch') ?? ''
    const query = rawQuery.trim()
    const rawLimit = url.searchParams.get('gsrlimit') ?? ''
    if (!query || rawQuery !== query || !/^[1-9]\d*$/.test(rawLimit)) return undefined
    const limit = Number(rawLimit)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 12 || String(limit) !== rawLimit) return undefined
    return { query, limit }
  } catch { return undefined }
}

type RequestIdentity = { request?: Request; requestBound: boolean; invalidReason?: string }

const commonsRequestIdentity = (requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestIdentity => {
  const request = parseWikimediaCommonsRequest(requestUrl)
  if (!request) return { requestBound: false, invalidReason: 'The successful response was not tied to the exact supported Wikimedia Commons search request.' }
  if (!executedRequest) return { request, requestBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl || !parseWikimediaCommonsRequest(executedRequest.url)) {
    return { request, requestBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Wikimedia Commons search request.' }
  }
  return { request, requestBound: true }
}

const metadataValue = (metadata: Record<string, unknown>, key: string) => {
  const entry = metadata[key]
  return isRecord(entry) ? trimmedText(entry.value) : undefined
}
const stripHtml = (value?: string) => value
  ?.replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#0*39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim() || undefined
const httpsUrl = (value: unknown) => {
  const text = trimmedText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch { return undefined }
}

const parseItem = (value: unknown): { item?: Item; malformed: boolean; licenseGap: boolean } => {
  if (!isRecord(value)) return { malformed: true, licenseGap: true }
  const pageId = positiveSafeInteger(value.pageid)
  const index = positiveSafeInteger(value.index)
  const title = trimmedText(value.title)
  if (!pageId || value.ns !== 6 || !index || !title?.startsWith('File:')) return { malformed: true, licenseGap: true }
  if (!Array.isArray(value.imageinfo) || !isRecord(value.imageinfo[0])) return { malformed: true, licenseGap: true }
  const info = value.imageinfo[0]
  const metadata = isRecord(info.extmetadata) ? info.extmetadata : undefined
  const imageUrl = httpsUrl(info.thumburl) ?? httpsUrl(info.url)
  const descriptionUrl = httpsUrl(info.descriptionurl)
  if (!imageUrl || !descriptionUrl || !metadata) return { malformed: true, licenseGap: true }
  const license = metadataValue(metadata, 'LicenseShortName') ?? metadataValue(metadata, 'License')
  if (!license) return { malformed: true, licenseGap: true }
  const licenseUrl = httpsUrl(metadataValue(metadata, 'LicenseUrl'))
  const artist = stripHtml(metadataValue(metadata, 'Artist'))
  const attributionText = metadataValue(metadata, 'AttributionRequired')?.toLowerCase()
  const attributionRequired = attributionText === 'true' ? true : attributionText === 'false' ? false : undefined
  return {
    item: { pageId, index, title, imageUrl, descriptionUrl, license, licenseUrl, artist, attributionRequired },
    malformed: false,
    licenseGap: attributionRequired === true && !artist,
  }
}

export const parseWikimediaCommonsResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: Request; requestBound: boolean; result?: Result; invalidReason?: string } => {
  const identity = commonsRequestIdentity(requestUrl, executedRequest)
  const { request, requestBound } = identity
  if (!request || identity.invalidReason) return identity
  if (!isRecord(data)) return { request, requestBound, invalidReason: 'Wikimedia Commons did not return the documented Action API response object.' }
  if (!Object.prototype.hasOwnProperty.call(data, 'query')) {
    if (data.batchcomplete === '') return { request, requestBound, result: { items: [], providerCount: 0, malformed: 0, duplicates: 0, overflow: 0, licenseGaps: 0 } }
    return { request, requestBound, invalidReason: 'Wikimedia Commons returned neither a query result nor the completed empty-search envelope.' }
  }
  if (!isRecord(data.query) || !isRecord(data.query.pages)) return { request, requestBound, invalidReason: 'Wikimedia Commons did not return the documented query.pages object.' }
  const rawPages = Object.values(data.query.pages)
  const parsed = rawPages.map(parseItem)
  const candidates = parsed.flatMap((entry) => entry.item ? [entry.item] : []).sort((a, b) => a.index - b.index)
  const seen = new Set<number>()
  const items: Item[] = []
  let duplicates = 0
  let overflow = 0
  for (const item of candidates) {
    if (seen.has(item.pageId)) { duplicates += 1; continue }
    seen.add(item.pageId)
    if (items.length >= request.limit) { overflow += 1; continue }
    items.push(item)
  }
  return { request, requestBound, result: {
    items,
    providerCount: rawPages.length,
    malformed: parsed.filter((entry) => entry.malformed).length,
    duplicates,
    overflow,
    licenseGaps: parsed.filter((entry) => entry.licenseGap).length,
  } }
}

const attrs = (request?: Request, result?: Result, requestBound = false) => ({
  'data-domain-card': 'wikimedia-commons-search',
  'data-request-bound': requestBound ? 'true' : 'false',
  'data-request-contract': 'exact-commons-generator-search-v1',
  'data-request-query': request?.query,
  'data-request-limit': request?.limit,
  'data-provider-record-count': result?.providerCount,
  'data-valid-record-count': result?.items.length,
  'data-malformed-record-count': result?.malformed,
  'data-duplicate-record-count': result?.duplicates,
  'data-overflow-record-count': result?.overflow,
  'data-license-gap-count': result?.licenseGaps,
  'data-primary-page-id': result?.items[0]?.pageId,
  'data-primary-license': result?.items[0]?.license,
})

export function WikimediaCommonsSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseWikimediaCommonsResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request, undefined, parsed.requestBound)} data-result-state="invalid"><h3>Invalid Wikimedia Commons search response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result, requestBound } = parsed
  if (!result.providerCount) {
    const state = requestBound ? 'empty' : 'partial'
    return <div className="domain-card domain-empty" {...attrs(request, result, requestBound)} data-result-state={state}><h3>{requestBound ? 'No Commons media matched' : 'Unbound Commons empty response'}</h3><p>{requestBound ? `Wikimedia Commons returned a completed, exact-request-bound zero-result search for “${request.query}”.` : 'Wikimedia Commons returned a structurally coherent zero-result envelope, but executed transport identity is unavailable, so semantic emptiness is not trusted.'}</p></div>
  }
  if (!result.items.length) return <div className="domain-card domain-empty" {...attrs(request, result, requestBound)} data-result-state="invalid"><h3>Invalid Commons media identities</h3><p>Records were returned, but none carried trustworthy file identity, HTTPS media links, and license metadata.</p></div>
  const partial = !requestBound || result.malformed > 0 || result.duplicates > 0 || result.overflow > 0 || result.licenseGaps > 0 || result.providerCount > request.limit
  return <div className="domain-card wikimedia-commons-search-preview bounded-media-preview" {...attrs(request, result, requestBound)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Wikimedia Commons · Licensed media</small><h3>{request.query}</h3><p>{requestBound ? 'Exact-request-bound Commons files with provider page identity and machine-readable license evidence.' : 'Validated Commons file identities from the displayed canonical request; executed transport identity is unavailable, so the result is not marked ready.'}</p></div><span className="domain-state">{result.items.length} trusted files</span></header>
    {partial && <p className="domain-note">Only records with valid Commons file identity, HTTPS media links, and license evidence are shown. Malformed or duplicate evidence is withheld.</p>}
    <dl className="domain-facts"><div><dt>Returned</dt><dd>{result.providerCount}</dd></div><div><dt>Trusted files</dt><dd>{result.items.length}</dd></div><div><dt>Primary page ID</dt><dd>{result.items[0].pageId}</dd></div><div><dt>Primary license</dt><dd>{result.items[0].license}</dd></div></dl>
    <div className={`media-preview ${result.items.length === 1 ? 'single' : ''}`}>{result.items.map((item) => <article key={item.pageId} data-page-id={item.pageId} data-license={item.license}><img src={item.imageUrl} alt={item.title.replace(/^File:/, '')} loading="lazy"/><div><small>Wikimedia Commons · {item.license}</small><h3>{item.title.replace(/^File:/, '')}</h3><p>{item.artist ? `Creator: ${item.artist}` : 'Creator metadata unavailable'}{item.attributionRequired === true ? ' · Attribution required' : ''}</p><p><a href={item.descriptionUrl} target="_blank" rel="noreferrer">File page</a>{item.licenseUrl ? <> · <a href={item.licenseUrl} target="_blank" rel="noreferrer">License</a></> : null}</p></div></article>)}</div>
    <p className="domain-note">Commons files do not share one universal license. Reuse must follow the license and attribution metadata for each individual file.</p>
  </div>
}
