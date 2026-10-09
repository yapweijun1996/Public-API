import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, optionalTrimmedText, positiveSafeInteger, trimmedText } from './semanticValidation'

type MetMuseumObjectState = 'ready' | 'partial' | 'invalid'
type MetMuseumObjectRequest = { objectId: 436535 }
type MetMuseumObjectResult = {
  objectId: number
  accessionNumber: string
  title: string
  isPublicDomain: boolean
  objectUrl: string
  primaryImage?: string
  primaryImageSmall?: string
  artist?: string
  objectDate?: string
  medium?: string
  dimensions?: string
  classification?: string
  creditLine?: string
  rightsAndReproduction: string
  optionalMalformedCount: number
  imageMalformedCount: number
  rightsConflict: boolean
  openAccessImage: boolean
}
type ParsedMetMuseumObject = { request?: MetMuseumObjectRequest; result?: MetMuseumObjectResult; state: MetMuseumObjectState; invalidReason?: string }

const ORIGIN = 'https://collectionapi.metmuseum.org'
const PATH = '/public/collection/v1/objects/436535'
const OBJECT_ID = 436535

const exactRequestFromUrl = (value: string): MetMuseumObjectRequest | undefined => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.origin !== ORIGIN || url.pathname !== PATH || url.search || url.hash || url.port || url.username || url.password) return undefined
    return { objectId: OBJECT_ID }
  } catch { return undefined }
}

export const parseMetMuseumObjectRequest = (executedRequest?: ExecutedRequestContext): MetMuseumObjectRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  return exactRequestFromUrl(executedRequest.url)
}

const strictHttpsUrl = (value: unknown, host: string, path?: string) => {
  const text = trimmedText(value)
  if (!text) return { malformed: value !== undefined && value !== null && value !== '', value: undefined }
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password || url.port || url.hash || (path && url.pathname !== path)) return { malformed: true, value: undefined }
    return { malformed: false, value: url.href }
  } catch { return { malformed: true, value: undefined } }
}

export const parseMetMuseumObjectResponse = (data: unknown, executedRequest?: ExecutedRequestContext): ParsedMetMuseumObject => {
  const hasRequestEvidence = Boolean(executedRequest)
  const request = parseMetMuseumObjectRequest(executedRequest)
  if (hasRequestEvidence && !request) return { state: 'invalid', invalidReason: 'The successful response was not tied to the exact supported Met object request.' }
  if (!isRecord(data)) return { request, state: 'invalid', invalidReason: 'The Met object response was not a JSON object.' }

  const objectId = positiveSafeInteger(data.objectID)
  const title = trimmedText(data.title)
  const accessionNumber = trimmedText(data.accessionNumber)
  if (objectId !== OBJECT_ID || !title || !accessionNumber || typeof data.isPublicDomain !== 'boolean') {
    return { request, state: 'invalid', invalidReason: 'The Met response did not provide the exact native object identity, title, accession number, and public-domain flag required for this fixed object.' }
  }

  const objectUrl = strictHttpsUrl(data.objectURL, 'www.metmuseum.org', `/art/collection/search/${OBJECT_ID}`)
  if (!objectUrl.value || objectUrl.malformed) return { request, state: 'invalid', invalidReason: 'The Met object page URL did not match the requested provider object identity.' }

  const primaryImage = strictHttpsUrl(data.primaryImage, 'images.metmuseum.org')
  const primaryImageSmall = strictHttpsUrl(data.primaryImageSmall, 'images.metmuseum.org')
  if (typeof data.rightsAndReproduction !== 'string') return { request, state: 'invalid', invalidReason: 'The Met rightsAndReproduction field was missing or was not provider text.' }
  const rights = data.rightsAndReproduction.trim()

  const optional = [
    optionalTrimmedText(data.artistDisplayName), optionalTrimmedText(data.objectDate), optionalTrimmedText(data.medium),
    optionalTrimmedText(data.dimensions), optionalTrimmedText(data.classification), optionalTrimmedText(data.creditLine),
  ]
  const optionalMalformedCount = optional.filter((item) => item.malformed).length
  const imageMalformedCount = Number(primaryImage.malformed) + Number(primaryImageSmall.malformed)
  const rightsConflict = data.isPublicDomain === true && Boolean(rights)
  const common = {
    objectId, accessionNumber, title, isPublicDomain: data.isPublicDomain, objectUrl: objectUrl.value,
    primaryImage: primaryImage.value, primaryImageSmall: primaryImageSmall.value,
    artist: optional[0].value, objectDate: optional[1].value, medium: optional[2].value,
    dimensions: optional[3].value, classification: optional[4].value, creditLine: optional[5].value,
    rightsAndReproduction: rights, optionalMalformedCount, imageMalformedCount, rightsConflict,
  }
  if (rightsConflict) return { request, result: { ...common, openAccessImage: false }, state: 'invalid', invalidReason: 'The Met marked this object public domain but also returned a non-empty copyright/rights credit, so the card will not claim CC0 image reuse.' }

  const trustedImage = primaryImage.value ?? primaryImageSmall.value
  const openAccessImage = data.isPublicDomain === true && Boolean(trustedImage) && !rights
  const result: MetMuseumObjectResult = { ...common, openAccessImage }
  const partial = !request || optionalMalformedCount > 0 || imageMalformedCount > 0 || data.isPublicDomain !== true || !trustedImage || Boolean(rights)
  return { request, result, state: partial ? 'partial' : 'ready' }
}

const evidenceAttrs = (parsed: ParsedMetMuseumObject) => ({
  'data-domain-card': 'met-museum-object-detail',
  'data-result-state': parsed.state,
  'data-request-bound': parsed.request ? 'true' : 'false',
  'data-request-contract': 'exact-met-object-436535',
  'data-object-id': parsed.result?.objectId,
  'data-accession-number': parsed.result?.accessionNumber,
  'data-public-domain': parsed.result ? String(parsed.result.isPublicDomain) : undefined,
  'data-open-access-image': parsed.result ? String(parsed.result.openAccessImage) : undefined,
  'data-rights-conflict': parsed.result ? String(parsed.result.rightsConflict) : undefined,
  'data-image-malformed-count': parsed.result?.imageMalformedCount,
  'data-optional-malformed-count': parsed.result?.optionalMalformedCount,
})

export function MetMuseumObjectPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseMetMuseumObjectResponse(data, executedRequest)
  const attrs = evidenceAttrs(parsed)
  const result = parsed.result
  if (parsed.state === 'invalid' || !result) return <div className="domain-card domain-empty met-museum-object-preview" {...attrs}><h3>Invalid Met Museum object response</h3><p>{parsed.invalidReason ?? 'The object response could not be verified against the supported request and rights contract.'}</p></div>

  const trustedImage = result.primaryImageSmall ?? result.primaryImage
  return <article className="domain-card met-museum-object-preview" {...attrs}>
    <header className="domain-heading"><div><small className="domain-eyebrow">The Metropolitan Museum of Art · Open Access object</small><h3>{result.title}</h3><p>Provider object #{result.objectId} · accession {result.accessionNumber}</p></div><span className="domain-state">{parsed.state === 'ready' ? 'CC0 image verified' : 'Review evidence'}</span></header>
    <div className="ssot-stat-strip" style={{ alignItems: 'start', marginTop: 18 }}>
      {result.openAccessImage && trustedImage ? <a href={result.primaryImage ?? trustedImage} target="_blank" rel="noreferrer" aria-label={`Open full-size image for ${result.title}`} style={{ minWidth: 0, display: 'block', overflow: 'hidden', borderRadius: 12 }}><img src={trustedImage} alt={result.title} loading="lazy" style={{ width: '100%', maxWidth: '100%', maxHeight: 440, display: 'block', objectFit: 'contain' }}/></a> : <div role="note" style={{ minHeight: 210, display: 'grid', placeItems: 'center', padding: 20, textAlign: 'center' }}>Artwork image not embedded because the response did not establish the card's Open Access image-reuse contract.</div>}
      <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <dl className="domain-facts"><div><dt>Object ID</dt><dd>{result.objectId}</dd></div><div><dt>Accession</dt><dd>{result.accessionNumber}</dd></div><div><dt>Artist</dt><dd>{result.artist ?? 'Unavailable'}</dd></div><div><dt>Date</dt><dd>{result.objectDate ?? 'Unavailable'}</dd></div><div><dt>Medium</dt><dd>{result.medium ?? 'Unavailable'}</dd></div><div><dt>Classification</dt><dd>{result.classification ?? 'Unavailable'}</dd></div></dl>
        {result.dimensions && <p className="domain-note"><strong>Dimensions:</strong> {result.dimensions}</p>}
        {result.creditLine && <p className="domain-note"><strong>Credit line:</strong> {result.creditLine}</p>}
        {result.isPublicDomain && result.openAccessImage ? <p className="domain-note">The Met marks this artwork public domain and supplies this image through its Open Access program under CC0. Other third-party rights, including privacy, publicity, or trademark rights, can still require review.</p> : <p className="domain-note">This card does not claim reusable artwork-image rights from the current response. Check the provider record before reuse.</p>}
        {parsed.state === 'partial' && <p className="domain-note">Some optional or rights evidence was unavailable or malformed, so the object identity remains visible but the card is not fully verified.</p>}
        <a className="domain-source-link" href={result.objectUrl} target="_blank" rel="noreferrer">View object at The Met</a>
      </div>
    </div>
  </article>
}
