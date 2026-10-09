import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { formatOptionalCount as formatCount, isRecord, nonNegativeInteger, optionalTrimmedText as optionalText, positiveInteger, trimmedText as text } from './semanticValidation'

type GitLabSearchRequest = {
  query: string
  limit: number
  terms: string[]
}

type GitLabProject = {
  id: number
  name: string
  pathWithNamespace: string
  webUrl: string
  description?: string
  stars?: number
  forks?: number
  lastActivity?: string
  topics: string[]
  queryMatch: boolean
  incomplete: boolean
}


const requestedSearch = (executedRequest?: ExecutedRequestContext, requestUrl?: string): GitLabSearchRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.origin !== 'https://gitlab.com' || url.pathname !== '/api/v4/projects' || url.hash || url.username || url.password) return undefined
    const allowed = new Set(['visibility', 'search', 'order_by', 'sort', 'per_page'])
    if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return undefined
    if ([...allowed].some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    if (url.searchParams.get('visibility') !== 'public' || url.searchParams.get('order_by') !== 'star_count' || url.searchParams.get('sort') !== 'desc') return undefined

    const query = (url.searchParams.get('search') ?? '').trim()
    const limitText = url.searchParams.get('per_page') ?? ''
    if (!query || !/^\d+$/.test(limitText)) return undefined
    const limit = Number(limitText)
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) return undefined
    const terms = query.toLocaleLowerCase('en-US').split(/\s+/).filter(Boolean)
    if (!terms.length) return undefined
    return { query, limit, terms }
  } catch {
    return undefined
  }
}

const optionalTimestamp = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  const raw = text(value)
  if (!raw) return { malformed: true }
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? { value: raw, malformed: false } : { malformed: true }
}

const optionalTopics = (value: unknown): { values: string[]; malformed: boolean } => {
  if (value === undefined || value === null) return { values: [], malformed: false }
  if (!Array.isArray(value)) return { values: [], malformed: true }
  const values = value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())).map((entry) => entry.trim())
  return { values, malformed: values.length !== value.length }
}

const canonicalProjectUrl = (value: unknown, pathWithNamespace: string): string | undefined => {
  const raw = text(value)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.hostname !== 'gitlab.com' || url.search || url.hash || url.username || url.password) return undefined
    const decodedPath = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ''))
    return decodedPath === pathWithNamespace ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const parseProject = (value: unknown, request?: GitLabSearchRequest): GitLabProject | undefined => {
  if (!isRecord(value)) return undefined
  const id = positiveInteger(value.id)
  const name = text(value.name)
  const pathWithNamespace = text(value.path_with_namespace)
  if (!id || !name || !pathWithNamespace || value.visibility !== 'public') return undefined
  const webUrl = canonicalProjectUrl(value.web_url, pathWithNamespace)
  if (!webUrl) return undefined

  const description = optionalText(value.description)
  const lastActivity = optionalTimestamp(value.last_activity_at)
  const topics = optionalTopics(value.topics ?? value.tag_list)
  const stars = nonNegativeInteger(value.star_count)
  const forks = nonNegativeInteger(value.forks_count)
  const starsMalformed = stars === undefined
  const forksMalformed = forks === undefined

  const searchable = [value.name, value.path, value.path_with_namespace, value.description]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLocaleLowerCase('en-US')
  const queryMatch = request ? request.terms.every((term) => searchable.includes(term)) : true

  return {
    id,
    name,
    pathWithNamespace,
    webUrl,
    description: description.value,
    stars,
    forks,
    lastActivity: lastActivity.value,
    topics: topics.values,
    queryMatch,
    incomplete: description.malformed || lastActivity.malformed || topics.malformed || starsMalformed || forksMalformed,
  }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="gitlab-project-search" title={title} detail={detail} state="invalid"/>

export function GitLabProjectSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!Array.isArray(data)) {
    return invalid('Invalid GitLab projects response', 'GitLab returned HTTP-success data without the documented project result array.')
  }

  const request = requestedSearch(executedRequest, requestUrl)
  if (executedRequest && !request) {
    return invalid('Invalid GitLab project search request identity', 'The successful response is not bound to the exact supported bodyless GET GitLab Projects search contract.')
  }

  if (data.length === 0) {
    if (request) {
      return <div className="domain-card domain-empty" data-domain-card="gitlab-project-search" data-ssot-reference="gitlab-public-projects" data-result-state="empty" data-search-query={request.query} data-request-limit={request.limit} data-query-bound="true" data-provider-result-count="0" data-valid-result-count="0" data-invalid-result-count="0" data-incomplete-result-count="0" data-query-contract="true" data-count-contract="true"><h3>No GitLab projects matched</h3><p>GitLab returned a valid zero-result public project search for “{request.query}”.</p></div>
    }
    return invalid('Invalid GitLab empty search response', 'The provider returned no project records without executed-request identity, so a semantic zero-result claim cannot be established.')
  }

  const parsed = data.map((entry) => parseProject(entry, request))
  const identifiable = parsed.filter((entry): entry is GitLabProject => Boolean(entry))
  const queryMatched = identifiable.filter((entry) => entry.queryMatch)
  const invalidResultCount = data.length - queryMatched.length
  if (!queryMatched.length) {
    return invalid('Invalid GitLab project results', 'None of the returned records established a trustworthy public project identity consistent with the documented search semantics.')
  }

  const incompleteResultCount = queryMatched.filter((entry) => entry.incomplete).length
  const countContract = !request || data.length <= request.limit
  const queryContract = !request || identifiable.every((entry) => entry.queryMatch)
  const state = request && countContract && queryContract && invalidResultCount === 0 && incompleteResultCount === 0 ? 'ready' : 'partial'
  const partialReason = !request
    ? 'The provider project records are internally identifiable, but executed-request identity is unavailable, so they cannot be fully bound to the GitLab search.'
    : !countContract
      ? 'The provider returned more project records than the executed per-page limit. Only validated project records are shown.'
      : !queryContract
        ? 'One or more provider records contradict the documented search terms. Contradictory records are hidden.'
        : invalidResultCount > 0
          ? `${invalidResultCount} malformed or contradictory provider result${invalidResultCount === 1 ? ' was' : 's were'} hidden.`
          : 'One or more project metrics are missing or malformed. Project identity remains trustworthy, but untrusted values are withheld.'

  const cards: SemanticCard[] = queryMatched.slice(0, 20).map((entry) => ({
    title: entry.pathWithNamespace,
    eyebrow: entry.lastActivity ? `GitLab public project · active ${entry.lastActivity.slice(0, 10)}` : 'GitLab public project',
    description: entry.description,
    badge: entry.stars === undefined ? 'Stars unavailable' : `${entry.stars.toLocaleString('en')} stars`,
    metrics: [
      { label: 'Forks', value: formatCount(entry.forks) },
      { label: 'Project ID', value: String(entry.id) },
      { label: 'Project page', value: entry.webUrl },
    ],
    tags: entry.topics,
  }))

  return <div data-domain-card="gitlab-project-search" data-ssot-reference="gitlab-public-projects" data-result-state={state} data-search-query={request?.query} data-request-limit={request?.limit} data-query-bound={request ? 'true' : 'false'} data-provider-result-count={data.length} data-valid-result-count={queryMatched.length} data-invalid-result-count={invalidResultCount} data-incomplete-result-count={incompleteResultCount} data-query-contract={String(queryContract)} data-count-contract={String(countContract)}>
    <div className="domain-note"><strong>{request ? `GitLab project search · ${request.query}` : 'GitLab public project search'}</strong> · {queryMatched.length.toLocaleString('en')} trusted project{queryMatched.length === 1 ? '' : 's'}</div>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <SemanticCards cards={cards} emptyTitle="GitLab project results unavailable"/>
  </div>
}
