import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord } from './semanticValidation'

export type DogGalleryRequest = {
  count: number
}

type DogImage = {
  url: string
  collection: string
  collectionLabel: string
  filename: string
}

type DogGalleryResult = {
  images: DogImage[]
  providerImageCount: number
  malformedImageCount: number
  duplicateImageCount: number
  overflowImageCount: number
  countContract: boolean
}

const REQUEST_PATH = /^\/api\/breeds\/image\/random\/([1-9]|10)$/
const IMAGE_PATH = /^\/breeds\/([^/]+)\/([^/]+\.jpg)$/

export const parseDogGalleryRequest = (executedRequest?: ExecutedRequestContext): DogGalleryRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.protocol !== 'https:' || url.hostname !== 'dog.ceo' || url.port || url.username || url.password || url.search || url.hash) return undefined
    const path = url.pathname.match(REQUEST_PATH)
    if (!path) return undefined
    const count = Number(path[1])
    if (!Number.isSafeInteger(count) || String(count) !== path[1]) return undefined
    return { count }
  } catch {
    return undefined
  }
}

const decodePathPart = (value: string): string | undefined => {
  if (/%(?:2f|5c)/i.test(value)) return undefined
  try {
    const decoded = decodeURIComponent(value)
    return decoded.trim() && !decoded.includes('/') && !decoded.includes('\\') ? decoded : undefined
  } catch {
    return undefined
  }
}

const parseDogImage = (value: unknown): DogImage | undefined => {
  if (typeof value !== 'string' || value !== value.trim()) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'images.dog.ceo' || url.port || url.username || url.password || url.search || url.hash) return undefined
    const path = url.pathname.match(IMAGE_PATH)
    if (!path) return undefined
    const collection = decodePathPart(path[1])
    const filename = decodePathPart(path[2])
    if (!collection || !filename || filename.length <= 4 || !filename.endsWith('.jpg')) return undefined
    return {
      url: url.href,
      collection,
      collectionLabel: collection.replaceAll('-', ' / '),
      filename,
    }
  } catch {
    return undefined
  }
}

export const parseDogGalleryResponse = (data: unknown, executedRequest?: ExecutedRequestContext): { request?: DogGalleryRequest; result?: DogGalleryResult; invalidReason?: string } => {
  const request = parseDogGalleryRequest(executedRequest)
  if (!request) return { invalidReason: 'The successful response was not tied to the exact supported Dog CEO random-image request.' }
  if (!isRecord(data) || data.status !== 'success' || !Array.isArray(data.message)) {
    return { request, invalidReason: 'Dog CEO did not return the documented success status and image URL array.' }
  }

  const images: DogImage[] = []
  const seen = new Set<string>()
  let malformedImageCount = 0
  let duplicateImageCount = 0
  const providerImageCount = data.message.length
  for (const value of data.message.slice(0, request.count)) {
    const image = parseDogImage(value)
    if (!image) {
      malformedImageCount += 1
      continue
    }
    if (seen.has(image.url)) {
      duplicateImageCount += 1
      continue
    }
    seen.add(image.url)
    images.push(image)
  }

  const countContract = providerImageCount === request.count
    && images.length === request.count
    && malformedImageCount === 0
    && duplicateImageCount === 0
  return { request, result: {
    images,
    providerImageCount,
    malformedImageCount,
    duplicateImageCount,
    overflowImageCount: Math.max(0, providerImageCount - request.count),
    countContract,
  } }
}

const attributes = (request?: DogGalleryRequest, result?: DogGalleryResult) => ({
  'data-domain-card': 'dog-gallery',
  'data-request-bound': request ? 'true' : 'false',
  'data-request-contract': 'exact-dog-ceo-random-count-v1',
  'data-requested-count': request?.count,
  'data-count-contract': result ? String(result.countContract) : undefined,
  'data-provider-image-count': result?.providerImageCount,
  'data-trusted-image-count': result?.images.length,
  'data-malformed-image-count': result?.malformedImageCount,
  'data-duplicate-image-count': result?.duplicateImageCount,
  'data-overflow-image-count': result?.overflowImageCount,
  'data-primary-image-identity': result?.images[0]?.url,
  'data-primary-image-url': result?.images[0]?.url,
  'data-primary-image-filename': result?.images[0]?.filename,
  'data-primary-provider-collection': result?.images[0]?.collection,
})

export function DogGalleryPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseDogGalleryResponse(data, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty dog-gallery-preview" {...attributes(parsed.request)} data-result-state="invalid"><h3>Invalid Dog CEO gallery response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  if (!result.images.length) return <div className="domain-card domain-empty dog-gallery-preview" {...attributes(request, result)} data-result-state="invalid"><h3>No trustworthy dog image identities</h3><p>Dog CEO returned no unique image URL matching its documented HTTPS image-host contract. An empty array is not a documented success for this endpoint.</p></div>

  const partial = !result.countContract
  return <div className="domain-card dog-gallery-preview bounded-media-preview" {...attributes(request, result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Dog CEO · Random image gallery</small><h3>{result.images.length} trusted dog image{result.images.length === 1 ? '' : 's'}</h3><p>Exact-request-bound provider image identities from the documented Dog CEO image host.</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{partial ? 'Partial evidence' : 'Request matched'}</span></header>
    {partial ? <p className="domain-note">The provider count or one or more image identities contradicted the requested gallery contract. Malformed, duplicate, and over-limit values are withheld; Raw JSON retains the complete response.</p> : null}
    <dl className="domain-facts"><div><dt>Requested images</dt><dd>{request.count}</dd></div><div><dt>Provider values</dt><dd>{result.providerImageCount}</dd></div><div><dt>Trusted unique images</dt><dd>{result.images.length}</dd></div><div><dt>Primary filename</dt><dd><code>{result.images[0].filename}</code></dd></div><div><dt>Primary provider collection</dt><dd><code>{result.images[0].collection}</code></dd></div></dl>
    <section className={`media-preview ${result.images.length === 1 ? 'single' : ''}`} aria-label="Dog CEO random image gallery">
      {result.images.map((image) => <article key={image.url} data-image-identity={image.url} data-image-filename={image.filename} data-provider-collection={image.collection}>
        <img src={image.url} alt={`Dog CEO image ${image.filename} from provider collection ${image.collectionLabel}`} loading="lazy"/>
        <div><small>Dog CEO · Provider collection</small><h3>{image.collectionLabel}</h3><p>Provider filename: <code>{image.filename}</code></p></div>
      </article>)}
    </section>
    <p className="domain-note">Dog CEO identifies the Stanford Dogs Dataset as the collection’s original source and describes its collection as open source. That description and the API or repository code licence do not establish reuse rights for each photo; verify image rights before reuse.</p>
  </div>
}
