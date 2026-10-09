import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger } from './semanticValidation'

type MetMuseumSearchRequest = {
  query: 'singapore'
  hasImages: true
  offset: 0
  limit: 12
  version: 'v1.1'
}

type MetMuseumSearchResult = {
  total: number
  providerCount: number
  objectIds: number[]
  malformedCount: number
  duplicateCount: number
  overflowCount: number
  countContract: boolean
}

type MetMuseumSearchState = 'ready' | 'partial' | 'empty' | 'invalid'

type ParsedMetMuseumSearch = {
  request?: MetMuseumSearchRequest
  result?: MetMuseumSearchResult
  state: MetMuseumSearchState
  invalidReason?: string
}

const ORIGIN = 'https://collectionapi.metmuseum.org'
const PATH = '/public/collection/v1.1/search'
const QUERY = 'singapore'
const OFFSET = 0
const LIMIT = 12
const KEYS = ['hasImages', 'q', 'offset', 'limit'] as const

const exactRequestFromUrl = (value: string): MetMuseumSearchRequest | undefined => {
  try {
    const url = new URL(value)
    const keys = [...url.searchParams.keys()]
    if (
      url.protocol !== 'https:'
      || url.origin !== ORIGIN
      || url.pathname !== PATH
      || url.port
      || url.username
      || url.password
      || url.hash
      || keys.length !== KEYS.length
      || !KEYS.every((key) => keys.includes(key))
      || KEYS.some((key) => url.searchParams.getAll(key).length !== 1)
      || url.searchParams.get('hasImages') !== 'true'
      || url.searchParams.get('q') !== QUERY
      || url.searchParams.get('offset') !== String(OFFSET)
      || url.searchParams.get('limit') !== String(LIMIT)
    ) return undefined
    return { query: QUERY, hasImages: true, offset: OFFSET, limit: LIMIT, version: 'v1.1' }
  } catch {
    return undefined
  }
}

export const parseMetMuseumSearchRequest = (executedRequest?: ExecutedRequestContext): MetMuseumSearchRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  return exactRequestFromUrl(executedRequest.url)
}

const requestFromInputs = (executedRequest?: ExecutedRequestContext, requestUrl?: string) => {
  if (executedRequest) return parseMetMuseumSearchRequest(executedRequest)
  return requestUrl ? exactRequestFromUrl(requestUrl) : undefined
}

export const parseMetMuseumSearchResponse = (
  data: unknown,
  executedRequest?: ExecutedRequestContext,
  requestUrl?: string,
): ParsedMetMuseumSearch => {
  const hasRequestEvidence = Boolean(executedRequest || requestUrl)
  const request = requestFromInputs(executedRequest, requestUrl)
  if (hasRequestEvidence && !request) {
    return { state: 'invalid', invalidReason: 'The successful response was not tied to the exact supported Met Collection API v1.1 first-page search request.' }
  }
  if (!isRecord(data) || !Array.isArray(data.objectIDs)) {
    return { request, state: 'invalid', invalidReason: 'The Met did not return the documented total plus objectIDs search envelope.' }
  }

  const total = nonNegativeSafeInteger(data.total)
  if (total === undefined) {
    return { request, state: 'invalid', invalidReason: 'The Met search total was missing or was not a native non-negative safe integer.' }
  }

  const providerCount = data.objectIDs.length
  const objectIds: number[] = []
  const seen = new Set<number>()
  let malformedCount = 0
  let duplicateCount = 0
  let overflowCount = 0

  for (const value of data.objectIDs) {
    const id = positiveSafeInteger(value)
    if (id === undefined) {
      malformedCount += 1
      continue
    }
    if (seen.has(id)) {
      duplicateCount += 1
      continue
    }
    seen.add(id)
    if (objectIds.length >= LIMIT) {
      overflowCount += 1
      continue
    }
    objectIds.push(id)
  }

  const expectedProviderCount = Math.min(LIMIT, total)
  const countContract = providerCount === expectedProviderCount
  const result: MetMuseumSearchResult = {
    total,
    providerCount,
    objectIds,
    malformedCount,
    duplicateCount,
    overflowCount,
    countContract,
  }

  if (!countContract) {
    return { request, result, state: 'invalid', invalidReason: `The Met v1.1 first page returned ${providerCount} Object IDs, but ${expectedProviderCount} were required by total=${total} and limit=${LIMIT}.` }
  }
  if (total === 0) return { request, result, state: request ? 'empty' : 'partial' }
  if (!objectIds.length) {
    return { request, result, state: 'invalid', invalidReason: 'The Met returned a non-empty search page, but none of its Object IDs were trustworthy native positive integers.' }
  }

  const partial = !request
    || malformedCount > 0
    || duplicateCount > 0
    || overflowCount > 0
    || objectIds.length !== providerCount
  return { request, result, state: partial ? 'partial' : 'ready' }
}

const evidenceAttrs = (parsed: ParsedMetMuseumSearch) => ({
  'data-domain-card': 'met-museum-search',
  'data-result-state': parsed.state,
  'data-request-bound': parsed.request ? 'true' : 'false',
  'data-request-contract': 'exact-met-collection-v1.1-first-page',
  'data-endpoint-version': parsed.request?.version ?? 'v1.1',
  'data-request-query': parsed.request?.query,
  'data-request-has-images': parsed.request ? String(parsed.request.hasImages) : undefined,
  'data-request-offset': parsed.request?.offset,
  'data-request-limit': parsed.request?.limit,
  'data-provider-total': parsed.result?.total,
  'data-provider-object-count': parsed.result?.providerCount,
  'data-valid-object-count': parsed.result?.objectIds.length,
  'data-malformed-object-count': parsed.result?.malformedCount,
  'data-duplicate-object-count': parsed.result?.duplicateCount,
  'data-overflow-object-count': parsed.result?.overflowCount,
  'data-count-contract': parsed.result ? String(parsed.result.countContract) : undefined,
  'data-primary-object-id': parsed.result?.objectIds[0],
})

export function MetMuseumSearchPreview({
  data,
  executedRequest,
  requestUrl,
}: {
  data: unknown
  executedRequest?: ExecutedRequestContext
  requestUrl?: string
}) {
  const parsed = parseMetMuseumSearchResponse(data, executedRequest, requestUrl)
  const attrs = evidenceAttrs(parsed)
  const { result } = parsed

  if (parsed.state === 'invalid' || !result) {
    return <div className="domain-card domain-empty met-museum-search-preview" {...attrs}>
      <h3>Invalid Met Museum search response</h3>
      <p>{parsed.invalidReason ?? 'The Met response could not be verified against the supported paginated search contract.'}</p>
    </div>
  }

  if (parsed.state === 'empty') {
    return <div className="domain-card domain-empty met-museum-search-preview" {...attrs}>
      <h3>No Met collection objects matched</h3>
      <p>The exact v1.1 first-page search returned a coherent zero-result response for image-bearing Singapore records.</p>
    </div>
  }

  return <div className="domain-card met-museum-search-preview" {...attrs}>
    <header className="domain-heading">
      <div>
        <small className="domain-eyebrow">The Metropolitan Museum of Art · Collection API v1.1</small>
        <h3>Singapore collection index</h3>
        <p>Paginated, request-bound provider Object IDs for image-bearing collection records.</p>
      </div>
      <span className="domain-state">{result.objectIds.length} trusted IDs</span>
    </header>
    {parsed.state === 'partial' && <p className="domain-note">Only native unique Met Object IDs are shown. Unbound, malformed, duplicate, or overflow evidence is withheld rather than presented as verified collection identity.</p>}
    <dl className="domain-facts">
      <div><dt>Total matches</dt><dd>{result.total.toLocaleString('en')}</dd></div>
      <div><dt>First-page IDs</dt><dd>{result.providerCount}</dd></div>
      <div><dt>Trusted IDs</dt><dd>{result.objectIds.length}</dd></div>
      <div><dt>Page window</dt><dd>offset 0 · limit 12</dd></div>
    </dl>
    <div className="ssot-id-grid" aria-label="Met Museum object IDs">
      {result.objectIds.map((id) => <code key={id} data-met-object-id={id}>{id}</code>)}
    </div>
    <p className="domain-note">The Met retired the unbounded v1 search contract in favor of paginated v1.1. These IDs are search identities only; fetch an object record before making artwork, image, or rights claims.</p>
  </div>
}
