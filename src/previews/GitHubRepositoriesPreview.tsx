import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { formatOptionalCount as formatCount, isRecord, nonNegativeInteger, optionalTrimmedText as optionalText, positiveInteger, trimmedText as text } from './semanticValidation'

type GitHubRepoRequest = { owner: string; perPage: number }
type GitHubRepository = {
  id: number; name: string; fullName: string; htmlUrl: string; description?: string
  fork?: boolean; archived?: boolean; disabled?: boolean; stars?: number; forks?: number; openIssues?: number
  language?: string; defaultBranch?: string; updatedAt?: string; pushedAt?: string; topics: string[]; incomplete: boolean
}


const requestIdentity = (executedRequest?: ExecutedRequestContext, requestUrl?: string): GitHubRepoRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.origin !== 'https://api.github.com' || url.hash || url.username || url.password) return undefined
    const match = /^\/users\/([^/]+)\/repos$/.exec(url.pathname)
    if (!match) return undefined
    const owner = decodeURIComponent(match[1]).trim()
    const allowed = new Set(['type', 'sort', 'direction', 'per_page'])
    if (!owner || [...url.searchParams.keys()].some((key) => !allowed.has(key))) return undefined
    if ([...allowed].some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    if (url.searchParams.get('type') !== 'owner' || url.searchParams.get('sort') !== 'full_name' || url.searchParams.get('direction') !== 'asc') return undefined
    const raw = url.searchParams.get('per_page') ?? ''
    if (!/^\d+$/.test(raw)) return undefined
    const perPage = Number(raw)
    return Number.isInteger(perPage) && perPage >= 1 && perPage <= 100 ? { owner, perPage } : undefined
  } catch { return undefined }
}

const optionalBoolean = (value: unknown): { value?: boolean; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  return typeof value === 'boolean' ? { value, malformed: false } : { malformed: true }
}
const optionalTimestamp = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  const raw = text(value)
  return !raw || !Number.isFinite(Date.parse(raw)) ? { malformed: true } : { value: raw, malformed: false }
}
const optionalTopics = (value: unknown): { values: string[]; malformed: boolean } => {
  if (value === undefined || value === null) return { values: [], malformed: false }
  if (!Array.isArray(value)) return { values: [], malformed: true }
  const values: string[] = []; let malformed = false
  for (const item of value) {
    const topic = text(item)
    if (!topic) { malformed = true; continue }
    if (!values.includes(topic)) values.push(topic); else malformed = true
  }
  return { values, malformed }
}
const canonicalRepoUrl = (value: unknown, fullName: string): string | undefined => {
  const raw = text(value); if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.search || url.hash || url.username || url.password) return undefined
    return decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, '')) === fullName ? url.toString() : undefined
  } catch { return undefined }
}

const parseRepository = (value: unknown, request?: GitHubRepoRequest): GitHubRepository | undefined => {
  if (!isRecord(value) || !isRecord(value.owner)) return undefined
  const id = positiveInteger(value.id), name = text(value.name), fullName = text(value.full_name), ownerLogin = text(value.owner.login)
  if (!id || !name || !fullName || !ownerLogin || value.private !== false || fullName !== `${ownerLogin}/${name}`) return undefined
  if (request && ownerLogin.toLowerCase() !== request.owner.toLowerCase()) return undefined
  if (value.visibility !== undefined && value.visibility !== 'public') return undefined
  const htmlUrl = canonicalRepoUrl(value.html_url, fullName); if (!htmlUrl) return undefined
  const description = optionalText(value.description), fork = optionalBoolean(value.fork), archived = optionalBoolean(value.archived), disabled = optionalBoolean(value.disabled)
  const language = optionalText(value.language), defaultBranch = optionalText(value.default_branch), updatedAt = optionalTimestamp(value.updated_at), pushedAt = optionalTimestamp(value.pushed_at), topics = optionalTopics(value.topics)
  const stars = nonNegativeInteger(value.stargazers_count), forks = nonNegativeInteger(value.forks_count), openIssues = nonNegativeInteger(value.open_issues_count)
  return {
    id, name, fullName, htmlUrl, description: description.value, fork: fork.value, archived: archived.value, disabled: disabled.value,
    stars, forks, openIssues, language: language.value, defaultBranch: defaultBranch.value, updatedAt: updatedAt.value, pushedAt: pushedAt.value, topics: topics.values,
    incomplete: description.malformed || fork.malformed || fork.value === undefined || archived.malformed || archived.value === undefined || disabled.malformed || disabled.value === undefined || language.malformed || defaultBranch.malformed || !defaultBranch.value || updatedAt.malformed || !updatedAt.value || pushedAt.malformed || topics.malformed || stars === undefined || forks === undefined || openIssues === undefined,
  }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="github-repositories" title={title} detail={detail} state="invalid"/>

export function GitHubRepositoriesPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!Array.isArray(data)) return invalid('Invalid GitHub repository response', 'GitHub returned HTTP-success data without the documented repository array.')
  const request = requestIdentity(executedRequest, requestUrl)
  if (executedRequest && !request) return invalid('Invalid GitHub repository request identity', 'The successful response is not bound to the exact supported bodyless GET GitHub owned-repository listing contract.')
  if (!data.length) {
    if (request) return <div className="domain-card domain-empty" data-domain-card="github-repositories" data-ssot-reference="github" data-result-state="empty" data-request-owner={request.owner} data-request-per-page={request.perPage} data-request-bound="true" data-provider-result-count="0" data-valid-result-count="0" data-invalid-result-count="0" data-incomplete-result-count="0" data-owner-contract="true" data-count-contract="true"><h3>No public repositories returned</h3><p>GitHub returned a valid zero-result owned-repository listing for {request.owner}.</p></div>
    return invalid('Invalid GitHub empty repository response', 'The provider returned no repository rows without executed-request identity, so a semantic zero-result claim cannot be established.')
  }
  const trusted = data.map((entry) => parseRepository(entry, request)).filter((entry): entry is GitHubRepository => Boolean(entry))
  const invalidResultCount = data.length - trusted.length
  if (!trusted.length) return invalid('Invalid GitHub repository identities', 'None of the returned records established a trustworthy public repository identity owned by the executed GitHub user request.')
  const incompleteResultCount = trusted.filter((entry) => entry.incomplete).length
  const countContract = !request || data.length <= request.perPage
  const ownerContract = !request || invalidResultCount === 0
  const state = request && countContract && ownerContract && incompleteResultCount === 0 ? 'ready' : 'partial'
  const partialReason = !request ? 'Repository rows are internally identifiable, but executed-request identity is unavailable.' : !countContract ? 'GitHub returned more repository rows than the executed per-page request.' : invalidResultCount ? `${invalidResultCount} malformed or owner-contradictory repository ${invalidResultCount === 1 ? 'was' : 'records were'} hidden.` : 'One or more repository status, activity, or popularity fields are missing or malformed; untrusted values are withheld.'
  const cards: SemanticCard[] = trusted.slice(0, request?.perPage ?? 20).map((repo) => ({
    title: repo.fullName,
    eyebrow: `GitHub public repository · ${repo.fork === undefined ? 'repository type unavailable' : repo.fork ? 'Fork' : 'Source'}`,
    description: repo.description,
    badge: repo.disabled === true ? 'Disabled' : repo.archived === undefined ? 'Archive state unavailable' : repo.archived ? 'Archived' : 'Not archived',
    metrics: [{ label: 'Stars', value: formatCount(repo.stars) }, { label: 'Forks', value: formatCount(repo.forks) }, { label: 'Open issues / PRs', value: formatCount(repo.openIssues) }, { label: 'Language', value: repo.language ?? 'Unavailable' }],
    tags: [...repo.topics, repo.defaultBranch ? `default:${repo.defaultBranch}` : '', repo.updatedAt ? `updated:${repo.updatedAt.slice(0, 10)}` : ''].filter(Boolean),
  }))
  return <div data-domain-card="github-repositories" data-ssot-reference="github" data-result-state={state} data-request-owner={request?.owner} data-request-per-page={request?.perPage} data-request-bound={request ? 'true' : 'false'} data-provider-result-count={data.length} data-valid-result-count={trusted.length} data-invalid-result-count={invalidResultCount} data-incomplete-result-count={incompleteResultCount} data-owner-contract={String(ownerContract)} data-count-contract={String(countContract)}>
    <div className="domain-note"><strong>{request ? `GitHub repositories · ${request.owner}` : 'GitHub public repositories'}</strong> · {trusted.length.toLocaleString('en')} trusted repositor{trusted.length === 1 ? 'y' : 'ies'}</div>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <SemanticCards cards={cards} emptyTitle="GitHub repository records unavailable"/>
  </div>
}
