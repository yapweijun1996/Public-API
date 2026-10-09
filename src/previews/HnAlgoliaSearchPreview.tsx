import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { formatOptionalCount as formatCount, isRecord, isoDateFromEpochSeconds as dateLabel, nonNegativeInteger, optionalTrimmedText as optionalText, positiveInteger, trimmedText as text } from './semanticValidation'

type HnRequest = { query: string; tags: 'story' | 'comment' | '(story,comment)'; hitsPerPage: number }
type HnHit = {
  objectId: string
  kind: 'story' | 'comment'
  title: string
  author?: string
  description?: string
  providerTags: string[]
  points?: number
  comments?: number
  storyId?: number
  parentId?: number
  createdAt: number
  incomplete: boolean
}

const decimalId = (value: unknown): string | undefined => {
  const candidate = text(value)
  return candidate && /^[1-9]\d*$/.test(candidate) ? candidate : undefined
}

const requestedSearch = (executedRequest?: ExecutedRequestContext, requestUrl?: string): HnRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.protocol !== 'https:' || url.hostname !== 'hn.algolia.com' || url.pathname !== '/api/v1/search' || url.hash || url.username || url.password) return undefined
    const allowed = new Set(['query', 'tags', 'hitsPerPage'])
    const keys = [...url.searchParams.keys()]
    if (keys.some((key) => !allowed.has(key))) return undefined
    if ([...allowed].some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    const query = (url.searchParams.get('query') ?? '').trim()
    const tags = url.searchParams.get('tags')
    const hitsPerPageText = url.searchParams.get('hitsPerPage') ?? ''
    if (!query || !['story', 'comment', '(story,comment)'].includes(tags ?? '') || !/^\d+$/.test(hitsPerPageText)) return undefined
    const hitsPerPage = Number(hitsPerPageText)
    if (!Number.isInteger(hitsPerPage) || hitsPerPage < 1 || hitsPerPage > 20) return undefined
    return { query, tags: tags as HnRequest['tags'], hitsPerPage }
  } catch {
    return undefined
  }
}

const parseTags = (value: unknown): { values: string[]; malformed: boolean } => {
  if (!Array.isArray(value)) return { values: [], malformed: true }
  const values: string[] = []
  let malformed = false
  for (const entry of value) {
    const tag = text(entry)
    if (!tag) { malformed = true; continue }
    if (!values.includes(tag)) values.push(tag)
    else malformed = true
  }
  return { values, malformed }
}

const optionalPositiveInteger = (value: unknown) => {
  if (value === undefined || value === null) return { value: undefined, malformed: false }
  const parsed = positiveInteger(value)
  return parsed === undefined ? { value: undefined, malformed: true } : { value: parsed, malformed: false }
}

const hitKind = (tags: string[]): 'story' | 'comment' | undefined => {
  const story = tags.includes('story')
  const comment = tags.includes('comment')
  return story === comment ? undefined : story ? 'story' : 'comment'
}

const kindAllowed = (kind: 'story' | 'comment', request?: HnRequest) => !request
  || request.tags === '(story,comment)'
  || request.tags === kind

const parseHit = (value: unknown, request?: HnRequest): HnHit | undefined => {
  if (!isRecord(value)) return undefined
  const objectId = decimalId(value.objectID)
  const createdAt = positiveInteger(value.created_at_i)
  const tags = parseTags(value._tags)
  const kind = hitKind(tags.values)
  if (!objectId || !createdAt || !kind || !kindAllowed(kind, request)) return undefined

  const author = optionalText(value.author)
  const url = optionalText(value.url)
  const storyText = optionalText(value.story_text)
  const commentText = optionalText(value.comment_text)
  const storyTitle = optionalText(value.story_title)
  const title = optionalText(value.title)
  const storyId = optionalPositiveInteger(value.story_id)
  const parentId = optionalPositiveInteger(value.parent_id)

  if (kind === 'story' && !title.value) return undefined
  if (kind === 'comment' && !commentText.value) return undefined

  const points = kind === 'story' ? nonNegativeInteger(value.points) : undefined
  const comments = kind === 'story' ? nonNegativeInteger(value.num_comments) : undefined
  const metricsMalformed = kind === 'story' && (points === undefined || comments === undefined)
  const incomplete = tags.malformed
    || author.malformed || !author.value
    || url.malformed || storyText.malformed || commentText.malformed || storyTitle.malformed || title.malformed
    || storyId.malformed || parentId.malformed
    || metricsMalformed

  return {
    objectId,
    kind,
    title: kind === 'story' ? title.value! : storyTitle.value ?? `Hacker News comment ${objectId}`,
    author: author.value,
    description: kind === 'story' ? storyText.value ?? url.value : commentText.value,
    providerTags: tags.values,
    points,
    comments,
    storyId: storyId.value,
    parentId: parentId.value,
    createdAt,
    incomplete: incomplete || (kind === 'comment' && storyId.value === undefined),
  }
}

const acknowledgedRequest = (root: Record<string, unknown>, request: HnRequest): boolean => {
  const query = text(root.query)
  const page = nonNegativeInteger(root.page)
  const hitsPerPage = positiveInteger(root.hitsPerPage)
  const paramsText = text(root.params)
  if (query !== request.query || page !== 0 || hitsPerPage !== request.hitsPerPage || !paramsText) return false
  const params = new URLSearchParams(paramsText)
  return params.get('query') === request.query
    && params.get('tags') === request.tags
    && params.get('hitsPerPage') === String(request.hitsPerPage)
}

const invalid = (title: string, detail: string) => <CardEmpty domain="hn-search" title={title} detail={detail} state="invalid"/>

export function HnAlgoliaSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!isRecord(data) || !Array.isArray(data.hits)) {
    return invalid('Invalid Hacker News search response', 'HN Search returned HTTP-success data without the documented hits array.')
  }

  const request = requestedSearch(executedRequest, requestUrl)
  if (executedRequest && !request) {
    return invalid('Invalid Hacker News search request identity', 'The successful response is not bound to the exact supported bodyless GET HN Search request with trustworthy query, content-type tag, and result-limit parameters.')
  }

  const providerHits = data.hits
  const providerTotal = nonNegativeInteger(data.nbHits)
  const providerPages = nonNegativeInteger(data.nbPages)
  const providerPage = nonNegativeInteger(data.page)
  const providerHitsPerPage = positiveInteger(data.hitsPerPage)
  const processingTime = nonNegativeInteger(data.processingTimeMS)
  const query = text(data.query)
  const params = text(data.params)
  const wrapperValid = providerTotal !== undefined && providerPages !== undefined && providerPage === 0 && providerHitsPerPage !== undefined && processingTime !== undefined && Boolean(query) && Boolean(params)
  const requestAcknowledged = request ? acknowledgedRequest(data, request) : false

  if (!wrapperValid || (request && !requestAcknowledged)) {
    return invalid('Invalid Hacker News search acknowledgement', 'HN Search did not return the documented search metadata matching the executed query, content type, and result limit.')
  }

  const countContract = providerTotal! >= providerHits.length
    && providerHits.length <= providerHitsPerPage!
    && (!request || providerHitsPerPage === request.hitsPerPage)
    && (providerHits.length > 0 ? providerTotal! > 0 && providerPages! > 0 : providerTotal === 0 && providerPages === 0)

  if (providerHits.length === 0) {
    if (request && requestAcknowledged && countContract) {
      return <div className="domain-card domain-empty" data-domain-card="hn-search" data-ssot-reference="hn-algolia-search" data-result-state="empty" data-search-query={request.query} data-request-tags={request.tags} data-request-hits-per-page={request.hitsPerPage} data-query-bound="true" data-request-acknowledged="true" data-provider-total="0" data-provider-hit-count="0" data-valid-hit-count="0" data-invalid-hit-count="0" data-incomplete-hit-count="0" data-count-contract="true"><h3>No Hacker News results matched</h3><p>HN Search returned a valid zero-result response for the executed query and content-type filter.</p></div>
    }
    return invalid('Invalid Hacker News empty search response', 'The provider returned no hits without a trustworthy request-bound zero-result count contract.')
  }

  const trusted: HnHit[] = []
  let invalidHitCount = 0
  const seen = new Set<string>()
  for (const raw of providerHits) {
    const hit = parseHit(raw, request)
    if (!hit || seen.has(hit.objectId)) { invalidHitCount += 1; continue }
    seen.add(hit.objectId)
    trusted.push(hit)
  }
  if (!trusted.length) return invalid('Invalid Hacker News search results', 'None of the returned hits established a trustworthy Hacker News item identity consistent with the executed content-type filter.')

  const incompleteHitCount = trusted.filter((hit) => hit.incomplete).length
  const state = request && requestAcknowledged && countContract && invalidHitCount === 0 && incompleteHitCount === 0 ? 'ready' : 'partial'
  const partialReason = !request
    ? 'Search hits are internally identifiable, but executed-request identity is unavailable, so they cannot be fully bound to the HN Search query.'
    : !countContract
      ? 'Provider total/page metadata is inconsistent with the returned hit batch. Only validated Hacker News items are shown.'
      : invalidHitCount > 0
        ? `${invalidHitCount} malformed, duplicate, or content-type-contradictory hit${invalidHitCount === 1 ? ' was' : 's were'} hidden.`
        : 'One or more optional Hacker News fields are missing or malformed. Item identity remains trustworthy, but untrusted values are withheld.'

  const cards: SemanticCard[] = trusted.slice(0, request?.hitsPerPage ?? 20).map((hit) => ({
    title: hit.title,
    eyebrow: `Hacker News ${hit.kind} · ${hit.author ?? 'author unavailable'}`,
    description: hit.description,
    badge: hit.kind === 'story' ? `${formatCount(hit.points)} points` : 'Comment',
    metrics: hit.kind === 'story' ? [
      { label: 'Comments', value: formatCount(hit.comments) },
      { label: 'Published', value: dateLabel(hit.createdAt) },
      { label: 'Item ID', value: hit.objectId },
    ] : [
      { label: 'Story ID', value: hit.storyId === undefined ? 'Unavailable' : String(hit.storyId) },
      { label: 'Parent ID', value: hit.parentId === undefined ? 'Unavailable' : String(hit.parentId) },
      { label: 'Published', value: dateLabel(hit.createdAt) },
      { label: 'Item ID', value: hit.objectId },
    ],
    tags: hit.providerTags,
  }))
  const primary = trusted[0]

  return <div data-domain-card="hn-search" data-ssot-reference="hn-algolia-search" data-result-state={state} data-search-query={request?.query} data-request-tags={request?.tags} data-request-hits-per-page={request?.hitsPerPage} data-query-bound={request ? 'true' : 'false'} data-request-acknowledged={request ? String(requestAcknowledged) : 'false'} data-provider-total={providerTotal} data-provider-page={providerPage} data-provider-pages={providerPages} data-provider-hits-per-page={providerHitsPerPage} data-provider-processing-ms={processingTime} data-provider-hit-count={providerHits.length} data-valid-hit-count={trusted.length} data-invalid-hit-count={invalidHitCount} data-incomplete-hit-count={incompleteHitCount} data-count-contract={String(countContract)} data-primary-object-id={primary.objectId} data-primary-kind={primary.kind} data-primary-created-at={primary.createdAt} data-primary-points={primary.points} data-primary-comments={primary.comments}>
    <div className="domain-note"><strong>{request ? `HN Search · ${request.query}` : 'Hacker News search'}</strong> · {trusted.length.toLocaleString('en')} trusted hit{trusted.length === 1 ? '' : 's'} of {providerTotal!.toLocaleString('en')} provider matches</div>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <SemanticCards cards={cards} emptyTitle="Hacker News search results unavailable"/>
  </div>
}
