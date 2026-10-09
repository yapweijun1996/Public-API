import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

type VamRequest = { query: string; pageSize: number }
type BoundVamRequest = { request?: VamRequest; transportBound: boolean; invalidReason?: string }
type VamObject = {
  systemNumber: string
  title: string
  objectType?: string
  maker?: string
  makerAssociation?: string
  date?: string
  place?: string
  accessionNumber?: string
  imageId?: string
  imageUrl?: string
  imageCopyright?: string
  imageSensitive?: boolean
  objectContentWarning?: boolean
  imageContentWarning?: boolean
  malformedOptional: boolean
}
type VamResult = {
  objects: VamObject[]
  providerTotal: number
  providerPage: number
  providerPageSize: number
  providerRecordCount: number
  malformedRecordCount: number
  duplicateRecordCount: number
  overflowRecordCount: number
  optionalWarningCount: number
  countContract: boolean
  supplementalContract: boolean
}

const REQUEST_PATH = '/v2/objects/search'

export const parseVamCollectionsRequest = (requestUrl?: string): VamRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'api.vam.ac.uk' || url.port || url.username || url.password || url.hash
      || url.pathname !== REQUEST_PATH || keys.length !== 2 || !keys.includes('q') || !keys.includes('page_size')
      || url.searchParams.getAll('q').length !== 1 || url.searchParams.getAll('page_size').length !== 1) return undefined
    const rawQuery = url.searchParams.get('q') ?? ''
    const query = rawQuery.trim()
    const rawPageSize = url.searchParams.get('page_size') ?? ''
    if (!query || rawQuery !== query || !/^[1-9]\d*$/.test(rawPageSize)) return undefined
    const pageSize = Number(rawPageSize)
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 20 || String(pageSize) !== rawPageSize) return undefined
    const canonical = `https://api.vam.ac.uk${REQUEST_PATH}?${new URLSearchParams({ q: query, page_size: String(pageSize) }).toString()}`
    return requestUrl === canonical ? { query, pageSize } : undefined
  } catch {
    return undefined
  }
}

const bindVamCollectionsRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundVamRequest => {
  const request = parseVamCollectionsRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported V&A Collections search request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET V&A Collections search request.' }
  }
  const executed = parseVamCollectionsRequest(executedRequest.url)
  if (!executed || executed.query !== request.query || executed.pageSize !== request.pageSize) {
    return { request, transportBound: false, invalidReason: 'The displayed V&A Collections request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const optionalText = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null || value === '') return { malformed: false }
  if (typeof value === 'string') return { value: trimmedText(value), malformed: Boolean(value.trim() === '') }
  if (typeof value === 'number' && Number.isFinite(value)) return { value: String(value), malformed: false }
  return { malformed: true }
}

const imageUrl = (value: unknown): { value?: string; malformed: boolean } => {
  const parsed = optionalText(value)
  if (!parsed.value) return parsed
  try {
    const url = new URL(parsed.value)
    return { value: url.protocol === 'https:' ? url.toString() : undefined, malformed: url.protocol !== 'https:' }
  } catch {
    return { malformed: true }
  }
}

const parseObject = (value: unknown): { object?: VamObject; malformed: boolean } => {
  if (!isRecord(value)) return { malformed: true }
  const systemNumber = trimmedText(value.systemNumber)
  const title = optionalText(value._primaryTitle)
  const objectType = optionalText(value.objectType)
  if (!systemNumber || (!title.value && !objectType.value)) return { malformed: true }

  let malformedOptional = title.malformed || objectType.malformed
  const makerRecord = value._primaryMaker === undefined || value._primaryMaker === null ? undefined : isRecord(value._primaryMaker) ? value._primaryMaker : null
  if (makerRecord === null) malformedOptional = true
  const maker = optionalText(makerRecord?.name)
  const makerAssociation = optionalText(makerRecord?.association)
  const date = optionalText(value._primaryDate)
  const place = optionalText(value._primaryPlace)
  const accessionNumber = optionalText(value.accessionNumber)
  malformedOptional ||= maker.malformed || makerAssociation.malformed || date.malformed || place.malformed || accessionNumber.malformed

  const images = value._images === undefined || value._images === null ? undefined : isRecord(value._images) ? value._images : null
  if (images === null) malformedOptional = true
  const image = imageUrl(images?._primary_thumbnail)
  const imageId = optionalText(value._primaryImageId)
  malformedOptional ||= image.malformed || imageId.malformed
  const imageUrlValue = image.value ?? (imageId.value ? `https://framemark.vam.ac.uk/collections/${encodeURIComponent(imageId.value)}/full/!400,400/0/default.jpg` : undefined)

  const imageMeta = value._imagesMeta === undefined || value._imagesMeta === null ? undefined : Array.isArray(value._imagesMeta) ? value._imagesMeta[0] : null
  if (value._imagesMeta !== undefined && value._imagesMeta !== null && (!Array.isArray(value._imagesMeta) || (imageMeta !== undefined && !isRecord(imageMeta)))) malformedOptional = true
  const meta = isRecord(imageMeta) ? imageMeta : undefined
  const copyright = optionalText(meta?.copyright)
  const sensitive = meta === undefined || meta.sensitiveImage === undefined || meta.sensitiveImage === null
    ? { value: undefined, malformed: false }
    : typeof meta.sensitiveImage === 'boolean' ? { value: meta.sensitiveImage, malformed: false } : { value: undefined, malformed: true }
  const objectWarning = value._objectContentWarning === undefined || value._objectContentWarning === null
    ? { value: undefined, malformed: false }
    : typeof value._objectContentWarning === 'boolean' ? { value: value._objectContentWarning, malformed: false } : { value: undefined, malformed: true }
  const imageWarning = value._imageContentWarning === undefined || value._imageContentWarning === null
    ? { value: undefined, malformed: false }
    : typeof value._imageContentWarning === 'boolean' ? { value: value._imageContentWarning, malformed: false } : { value: undefined, malformed: true }
  malformedOptional ||= copyright.malformed || sensitive.malformed || objectWarning.malformed || imageWarning.malformed

  return { malformed: malformedOptional, object: {
    systemNumber,
    title: title.value ?? objectType.value!,
    objectType: objectType.value,
    maker: maker.value,
    makerAssociation: makerAssociation.value,
    date: date.value,
    place: place.value,
    accessionNumber: accessionNumber.value,
    imageId: imageId.value,
    imageUrl: imageUrlValue,
    imageCopyright: copyright.value,
    imageSensitive: sensitive.value,
    objectContentWarning: objectWarning.value,
    imageContentWarning: imageWarning.value,
    malformedOptional,
  } }
}

export const parseVamCollectionsResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): { request?: VamRequest; result?: VamResult; transportBound: boolean; invalidReason?: string } => {
  const identity = bindVamCollectionsRequest(requestUrl, executedRequest)
  const request = identity.request
  if (!request || identity.invalidReason) return { request, transportBound: false, invalidReason: identity.invalidReason ?? 'The successful response was not tied to the exact supported V&A Collections search request.' }
  if (!isRecord(data) || !Array.isArray(data.records) || !isRecord(data.info)) return { request, transportBound: identity.transportBound, invalidReason: 'V&A did not return the documented records and info response envelope.' }
  const total = nonNegativeSafeInteger(data.info.record_count)
  const page = positiveSafeInteger(data.info.page)
  const pageSize = positiveSafeInteger(data.info.page_size)
  if (total === undefined || page === undefined || pageSize === undefined) return { request, transportBound: identity.transportBound, invalidReason: 'V&A pagination metadata must use native non-negative integer values.' }
  const exactPresent = Object.prototype.hasOwnProperty.call(data.info, 'record_count_exact')
  const supplementalContract = !exactPresent || typeof data.info.record_count_exact === 'boolean'
  const objects: VamObject[] = []
  const seen = new Set<string>()
  let malformedRecordCount = 0
  let duplicateRecordCount = 0
  let overflowRecordCount = 0
  let optionalWarningCount = 0
  for (const raw of data.records) {
    const parsed = parseObject(raw)
    if (!parsed.object) { malformedRecordCount += 1; continue }
    if (seen.has(parsed.object.systemNumber)) { duplicateRecordCount += 1; continue }
    seen.add(parsed.object.systemNumber)
    if (objects.length >= request.pageSize) { overflowRecordCount += 1; continue }
    if (parsed.malformed) { malformedRecordCount += 1; optionalWarningCount += 1 }
    objects.push(parsed.object)
  }
  const providerRecordCount = data.records.length
  const countContract = page === 1 && pageSize === request.pageSize && providerRecordCount <= request.pageSize && providerRecordCount <= total
    && providerRecordCount === Math.min(request.pageSize, total)
  return { request, transportBound: identity.transportBound, result: { objects, providerTotal: total, providerPage: page, providerPageSize: pageSize, providerRecordCount, malformedRecordCount, duplicateRecordCount, overflowRecordCount, optionalWarningCount, countContract, supplementalContract } }
}

const stateAttrs = (request?: VamRequest, result?: VamResult, transportBound = false) => ({
  'data-domain-card': 'vam-collections', 'data-request-bound': request && transportBound ? 'true' : 'false', 'data-request-contract': 'exact-vam-collections-first-page-v2',
  'data-request-query': request?.query, 'data-requested-page-size': request?.pageSize, 'data-count-contract': result ? String(result.countContract) : undefined,
  'data-supplemental-contract': result ? String(result.supplementalContract) : undefined, 'data-provider-total': result?.providerTotal,
  'data-provider-page': result?.providerPage, 'data-provider-page-size': result?.providerPageSize, 'data-provider-record-count': result?.providerRecordCount,
  'data-valid-record-count': result?.objects.length, 'data-malformed-record-count': result?.malformedRecordCount,
  'data-duplicate-record-count': result?.duplicateRecordCount, 'data-overflow-record-count': result?.overflowRecordCount,
  'data-optional-warning-count': result?.optionalWarningCount, 'data-primary-system-number': result?.objects[0]?.systemNumber,
})

export function VamCollectionsPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseVamCollectionsResponse(data, requestUrl, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...stateAttrs(parsed.request, undefined, parsed.transportBound)} data-result-state="invalid"><h3>Invalid V&A collection response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  if (result.providerRecordCount === 0) {
    const empty = result.providerTotal === 0 && result.countContract
    const state = empty ? (parsed.transportBound ? 'empty' : 'partial') : 'invalid'
    return <div className="domain-card domain-empty" {...stateAttrs(request, result, parsed.transportBound)} data-result-state={state}><h3>{state === 'empty' ? 'No V&A objects matched' : state === 'partial' ? 'V&A result not request-bound' : 'Invalid V&A empty response'}</h3><p>{state === 'empty' ? `V&A returned an exact-request-bound zero-result page for “${request.query}”.` : state === 'partial' ? `V&A returned a coherent zero-result page for “${request.query}”, but executed request evidence was unavailable.` : 'The empty HTTP-success response did not include coherent first-page count evidence.'}</p></div>
  }
  if (!result.objects.length) return <div className="domain-card domain-empty" {...stateAttrs(request, result, parsed.transportBound)} data-result-state="invalid"><h3>Invalid V&A object identities</h3><p>V&A returned records, but none carried a provider system number and object title/type.</p></div>
  const partial = !parsed.transportBound || !result.countContract || !result.supplementalContract || result.malformedRecordCount > 0 || result.duplicateRecordCount > 0 || result.overflowRecordCount > 0
  return <div className="domain-card vam-collections-preview bounded-media-preview" {...stateAttrs(request, result, parsed.transportBound)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">V&A Collections · Object search</small><h3>{request.query}</h3><p>{parsed.transportBound ? 'Exact-request-bound V&A object records with provider IDs, collection metadata, image provenance, and content-warning context.' : 'Structurally valid V&A object evidence is visible, but executed request evidence was unavailable, so the result is not claimed as exact-request-bound.'}</p></div><span className="domain-state">{result.objects.length} trusted objects</span></header>
    {partial && <p className="domain-note">{parsed.transportBound ? 'The request is bound, but pagination or object evidence is incomplete. Malformed, duplicate, and over-limit records are withheld; raw JSON retains the provider response.' : 'Executed request evidence was unavailable. The V&A records remain visible as partial evidence but are not marked ready.'}</p>}
    <dl className="domain-facts"><div><dt>Total matches</dt><dd>{result.providerTotal.toLocaleString('en')}</dd></div><div><dt>Returned objects</dt><dd>{result.providerRecordCount} / {request.pageSize}</dd></div><div><dt>Primary system number</dt><dd><code>{result.objects[0].systemNumber}</code></dd></div><div><dt>Image metadata</dt><dd>{result.objects.filter((object) => object.imageUrl).length} with image evidence</dd></div></dl>
    <div className={`media-preview ${result.objects.length === 1 ? 'single' : ''}`}>
      {result.objects.map((object) => <article key={object.systemNumber} data-object-system-number={object.systemNumber} data-accession-number={object.accessionNumber} data-image-id={object.imageId} data-image-sensitive={object.imageSensitive} data-object-content-warning={object.objectContentWarning} data-image-content-warning={object.imageContentWarning} data-image-copyright={object.imageCopyright}>
        {object.imageUrl ? <img src={object.imageUrl} alt={object.title} loading="lazy"/> : <p className="domain-note vam-image-unavailable" aria-label="V&A image unavailable">Image unavailable</p>}
        <div><small>V&A Collections · {object.objectType ?? 'Object'}</small><h3>{object.title}</h3><p>{[object.maker, object.date, object.place].filter(Boolean).join(' · ') || 'Maker, date, and place unavailable'}</p><p>{object.accessionNumber ? `Accession ${object.accessionNumber}` : 'Accession unavailable'}{object.imageCopyright ? ` · ${object.imageCopyright}` : ''}</p>{object.objectContentWarning || object.imageContentWarning || object.imageSensitive ? <p>Content warning: review V&A object/image guidance before reuse.</p> : null}</div>
      </article>)}
    </div>
    <p className="domain-note">V&A collection data and images remain subject to the museum’s stated terms of use. Image presence is not a license grant; review the provider’s rights and warning metadata before reuse.</p>
  </div>
}
