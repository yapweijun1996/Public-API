import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty, CardHeading, text } from './cardPrimitives'
import { SemanticCards } from './SemanticCards'
import { isRecord, nonNegativeSafeInteger, trimmedText } from './semanticValidation'

type RequestContract = { query: string; limit: number }
type BoundRequest = { request?: RequestContract; transportBound: boolean; invalidReason?: string }

const parseRequest = (requestUrl?: string): RequestContract | null | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    const exactKeys = keys.length === 3
      && keys.filter((key) => key === 'search').length === 1
      && keys.filter((key) => key === 'limit').length === 1
      && keys.filter((key) => key === 'full').length === 1
    const query = url.searchParams.get('search')?.trim() ?? ''
    const limitRaw = url.searchParams.get('limit') ?? ''
    const limit = /^(?:[1-9]|1[0-9]|2[0-5])$/.test(limitRaw) ? Number(limitRaw) : undefined
    if (url.protocol !== 'https:' || url.hostname !== 'huggingface.co' || url.port || url.username || url.password
      || url.pathname !== '/api/models' || url.hash || !exactKeys || !query || limit === undefined
      || url.searchParams.get('full') !== 'true') return null
    const canonical = `https://huggingface.co/api/models?${new URLSearchParams({ search: query, limit: limitRaw, full: 'true' }).toString()}`
    return requestUrl === canonical ? { query, limit } : null
  } catch {
    return null
  }
}

const bindRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundRequest => {
  if (!requestUrl) return { transportBound: false }
  const request = parseRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported Hugging Face model-search request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Hugging Face model-search request.' }
  }
  const executed = parseRequest(executedRequest.url)
  if (!executed || executed.query !== request.query || executed.limit !== request.limit) {
    return { request, transportBound: false, invalidReason: 'The displayed Hugging Face request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const exactCount = (value: unknown) => nonNegativeSafeInteger(value)?.toLocaleString('en') ?? 'Not supplied'
const dateOnly = (value: unknown) => text(value)?.slice(0, 10) ?? 'Not supplied'
const modelTags = (value: unknown) => Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0) : []
const modelLicense = (model: Record<string, unknown>) => modelTags(model.tags).find((tag) => tag.startsWith('license:'))?.slice('license:'.length) || 'Not declared'
const accessLabel = (model: Record<string, unknown>) => {
  if (model.private === true) return 'Private'
  if (model.gated === true) return 'Gated'
  if (typeof model.gated === 'string' && model.gated.trim()) return `Gated · ${model.gated}`
  return 'Public'
}

export function HuggingFaceModelsPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const binding = bindRequest(requestUrl, executedRequest)
  const request = binding.request
  if (binding.invalidReason) return <div className="domain-card domain-empty" data-domain-card="ai-model-catalog" data-result-state="invalid" data-request-bound="false" data-request-contract="exact-huggingface-model-search-v2"><h3>Invalid Hugging Face model request</h3><p>{binding.invalidReason}</p></div>
  if (!Array.isArray(data)) return <CardEmpty domain="ai-model-catalog" title="Invalid Hugging Face model response" detail="The Hub model-search response was not the documented model list." state="invalid"/>
  if (!data.length) {
    if (!request) return <CardEmpty domain="ai-model-catalog" title="Unbound Hugging Face model response" detail="An empty model list cannot be attributed to a search because displayed request identity is unavailable." state="invalid"/>
    if (!binding.transportBound) return <div className="domain-card domain-empty" data-domain-card="ai-model-catalog" data-result-state="partial" data-request-bound="false" data-request-contract="exact-huggingface-model-search-v2" data-requested-query={request.query} data-requested-limit={request.limit}><h3>Hugging Face result not request-bound</h3><p>The provider returned a coherent zero-result model list for “{request.query}”, but executed request evidence was unavailable.</p></div>
    return <div className="domain-card domain-empty" data-domain-card="ai-model-catalog" data-result-state="empty" data-request-bound="true" data-request-contract="exact-huggingface-model-search-v2" data-requested-query={request.query} data-requested-limit={request.limit}><h3>No Hugging Face models returned</h3><p>The Hub model search returned an exact-request-bound empty model list for “{request.query}”.</p></div>
  }

  const seen = new Set<string>()
  const models: Record<string, unknown>[] = []
  let queryMismatchCount = 0
  let duplicateIdentityCount = 0
  let malformedPopularityCount = 0
  for (const value of data) {
    if (!isRecord(value)) continue
    const id = trimmedText(value.id) ?? trimmedText(value.modelId)
    if (!id) continue
    if (request && !id.toLocaleLowerCase('en').includes(request.query.toLocaleLowerCase('en'))) {
      queryMismatchCount += 1
      continue
    }
    if (seen.has(id)) {
      duplicateIdentityCount += 1
      continue
    }
    seen.add(id)
    if (value.downloads !== undefined && value.downloads !== null && nonNegativeSafeInteger(value.downloads) === undefined) malformedPopularityCount += 1
    if (value.likes !== undefined && value.likes !== null && nonNegativeSafeInteger(value.likes) === undefined) malformedPopularityCount += 1
    models.push(value)
  }
  const invalidRecordCount = data.length - models.length
  if (!models.length) return <CardEmpty domain="ai-model-catalog" title="Invalid Hugging Face model response" detail="The provider returned model rows, but none could be trusted for the executed search." state="invalid"/>

  const responseExceedsLimit = Boolean(request && data.length > request.limit)
  const requestBound = Boolean(request && binding.transportBound)
  const partial = !requestBound || invalidRecordCount > 0 || malformedPopularityCount > 0 || duplicateIdentityCount > 0 || responseExceedsLimit
  const visible = models.slice(0, Math.min(8, request?.limit ?? 8))
  const first = visible[0]
  const firstId = text(first.id) ?? text(first.modelId)!
  const firstLicense = modelLicense(first)
  const firstAccess = accessLabel(first)
  const cards = visible.map((model) => {
    const id = text(model.id) ?? text(model.modelId)!
    const author = text(model.author) ?? id.split('/')[0] ?? 'Hugging Face'
    const tags = modelTags(model.tags)
    const license = modelLicense(model)
    const access = accessLabel(model)
    const task = text(model.pipeline_tag) ?? 'Not declared'
    const library = text(model.library_name) ?? 'Not declared'
    return {
      title: id,
      eyebrow: author,
      badge: access,
      metrics: [
        { label: 'Task', value: task },
        { label: 'Library', value: library },
        { label: 'Access', value: access },
        { label: 'License tag', value: license },
        { label: 'Downloads', value: exactCount(model.downloads) },
        { label: 'Likes', value: exactCount(model.likes) },
        { label: 'Last modified', value: dateOnly(model.lastModified) },
      ],
      tags: tags.filter((tag) => tag !== task && tag !== library && !tag.startsWith('license:')).slice(0, 5),
    }
  })

  return <div className="domain-card huggingface-models-preview" data-domain-card="ai-model-catalog" data-result-state={partial ? 'partial' : 'ready'} data-request-bound={requestBound ? 'true' : 'false'} data-request-contract="exact-huggingface-model-search-v2" data-requested-query={request?.query ?? ''} data-requested-limit={request?.limit ?? ''} data-provider-record-count={data.length} data-valid-record-count={models.length} data-invalid-record-count={invalidRecordCount} data-query-mismatch-count={queryMismatchCount} data-duplicate-identity-count={duplicateIdentityCount} data-malformed-popularity-count={malformedPopularityCount} data-response-exceeds-limit={responseExceedsLimit ? 'true' : 'false'} data-row-count={models.length} data-visible-count={visible.length} data-primary-model-id={firstId} data-primary-access={firstAccess} data-primary-license={firstLicense}>
    <CardHeading eyebrow="Hugging Face · Hub model search" title={`${models.length} model${models.length === 1 ? '' : 's'} returned`} description="Model identity, task/library metadata, access state, provider license tag, popularity, and update time from the live Hub search response."><span className="domain-state">{partial ? 'Partial model list' : `${visible.length} shown`}</span></CardHeading>
    {partial && <p className="domain-note">{binding.transportBound ? 'Only exact-request-bound model identities and strict provider-number evidence are trusted. Query mismatches, duplicate identities, malformed popularity counters, and responses beyond the requested limit are withheld or marked unavailable.' : 'The model rows are structurally usable, but executed request evidence was unavailable, so this result is not claimed as exact-request-bound.'}</p>}
    <SemanticCards cards={cards} emptyTitle="No model records available"/>
    <p className="domain-note">Access and licence values are provider metadata. A public search result is not a statement that every model is ungated, unrestricted, or suitable for a particular use; review the model repository and its licence before reuse.</p>
  </div>
}
