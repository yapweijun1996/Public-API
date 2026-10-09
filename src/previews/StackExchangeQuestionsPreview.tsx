import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { formatOptionalCount as formatCount, isRecord, isoDateFromEpochSeconds as dateLabel, nonNegativeInteger, positiveInteger, trimmedText as text } from './semanticValidation'

type StackExchangeRequest = {
  site: string
  tags: string[]
  order: 'desc'
  sort: 'activity'
  pageSize: number
}

type StackExchangeQuestion = {
  id: number
  title: string
  link: string
  tags: string[]
  score?: number
  answers?: number
  views?: number
  answered?: boolean
  created?: number
  lastActivity?: number
  incomplete: boolean
}

type WrapperFacts = {
  hasMore?: boolean
  quotaMax?: number
  quotaRemaining?: number
  backoff?: number
  malformed: boolean
}

const integer = (value: unknown): number | undefined => typeof value === 'number' && Number.isInteger(value) ? value : undefined

const requestedQuestions = (executedRequest?: ExecutedRequestContext, requestUrl?: string): StackExchangeRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.protocol !== 'https:' || url.hostname !== 'api.stackexchange.com' || url.port !== '' || url.pathname !== '/2.3/questions' || url.hash || url.username || url.password) return undefined
    const allowed = new Set(['order', 'sort', 'tagged', 'site', 'pagesize'])
    const keys = [...url.searchParams.keys()]
    if (keys.some((key) => !allowed.has(key))) return undefined
    if ([...allowed].some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    if (url.searchParams.get('order') !== 'desc' || url.searchParams.get('sort') !== 'activity') return undefined

    const site = (url.searchParams.get('site') ?? '').trim()
    const rawTags = (url.searchParams.get('tagged') ?? '').trim()
    const pageSizeText = url.searchParams.get('pagesize') ?? ''
    if (site !== 'stackoverflow' || !rawTags || !/^\d+$/.test(pageSizeText)) return undefined
    const tags = rawTags.split(';').map((tag) => tag.trim().toLocaleLowerCase('en-US')).filter(Boolean)
    const pageSize = Number(pageSizeText)
    if (!tags.length || tags.length > 5 || new Set(tags).size !== tags.length || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 20) return undefined
    return { site, tags, order: 'desc', sort: 'activity', pageSize }
  } catch {
    return undefined
  }
}

const parseTags = (value: unknown): { values: string[]; malformed: boolean } => {
  if (!Array.isArray(value)) return { values: [], malformed: true }
  const values: string[] = []
  let malformed = false
  for (const entry of value) {
    const tag = text(entry)?.toLocaleLowerCase('en-US')
    if (!tag) { malformed = true; continue }
    if (!values.includes(tag)) values.push(tag)
    else malformed = true
  }
  return { values, malformed }
}

const questionLink = (value: unknown, questionId: number): string | undefined => {
  const raw = text(value)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.hostname !== 'stackoverflow.com' || url.username || url.password) return undefined
    const path = url.pathname.replace(/\/+$/, '')
    if (!new RegExp(`^/(?:questions|q)/${questionId}(?:/|$)`).test(path)) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

const optionalEpoch = (value: unknown): { value?: number; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  const parsed = positiveInteger(value)
  return parsed === undefined ? { malformed: true } : { value: parsed, malformed: false }
}

const parseQuestion = (value: unknown, request?: StackExchangeRequest): StackExchangeQuestion | undefined => {
  if (!isRecord(value)) return undefined
  const id = positiveInteger(value.question_id)
  const title = text(value.title)
  if (!id || !title) return undefined
  const link = questionLink(value.link, id)
  if (!link) return undefined

  const tags = parseTags(value.tags)
  if (!tags.values.length) return undefined
  if (request && !request.tags.every((tag) => tags.values.includes(tag))) return undefined

  const score = integer(value.score)
  const answers = nonNegativeInteger(value.answer_count)
  const views = nonNegativeInteger(value.view_count)
  const answered = typeof value.is_answered === 'boolean' ? value.is_answered : undefined
  const created = optionalEpoch(value.creation_date)
  const lastActivity = optionalEpoch(value.last_activity_date)
  const incomplete = tags.malformed
    || score === undefined
    || answers === undefined
    || views === undefined
    || answered === undefined
    || created.malformed
    || lastActivity.malformed
    || created.value === undefined
    || lastActivity.value === undefined

  return {
    id,
    title,
    link,
    tags: tags.values,
    score,
    answers,
    views,
    answered,
    created: created.value,
    lastActivity: lastActivity.value,
    incomplete,
  }
}

const parseWrapper = (root: Record<string, unknown>): WrapperFacts => {
  const hasMore = typeof root.has_more === 'boolean' ? root.has_more : undefined
  const quotaMax = nonNegativeInteger(root.quota_max)
  const quotaRemaining = nonNegativeInteger(root.quota_remaining)
  const backoff = root.backoff === undefined || root.backoff === null ? undefined : positiveInteger(root.backoff)
  const malformed = hasMore === undefined
    || quotaMax === undefined
    || quotaRemaining === undefined
    || quotaRemaining > quotaMax
    || ((root.backoff !== undefined && root.backoff !== null) && backoff === undefined)
  return { hasMore, quotaMax, quotaRemaining, backoff, malformed }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="stack-exchange-questions" title={title} detail={detail} state="invalid"/>

export function StackExchangeQuestionsPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!isRecord(data) || !Array.isArray(data.items)) {
    return invalid('Invalid Stack Exchange response', 'Stack Exchange returned HTTP-success data without the documented common-wrapper items array.')
  }

  const request = requestedQuestions(executedRequest, requestUrl)
  if (executedRequest && !request) {
    return invalid('Invalid Stack Exchange request identity', 'The successful response is not bound to the exact supported bodyless GET Stack Overflow questions request with trustworthy site, tags, activity sorting, order, and bounded page-size parameters.')
  }

  const wrapper = parseWrapper(data)
  const providerItems = data.items
  const countContract = !request || providerItems.length <= request.pageSize

  if (providerItems.length === 0) {
    if (request && !wrapper.malformed && wrapper.hasMore === false && countContract) {
      return <div className="domain-card domain-empty" data-domain-card="stack-exchange-questions" data-ssot-reference="stack-exchange" data-result-state="empty" data-site={request.site} data-request-tags={request.tags.join(';')} data-request-sort={request.sort} data-request-order={request.order} data-request-page-size={request.pageSize} data-query-bound="true" data-provider-result-count="0" data-valid-result-count="0" data-invalid-result-count="0" data-incomplete-result-count="0" data-tag-contract="true" data-count-contract="true" data-wrapper-contract="true" data-has-more="false" data-quota-remaining={wrapper.quotaRemaining} data-quota-max={wrapper.quotaMax} data-backoff-seconds={wrapper.backoff}><h3>No Stack Overflow questions matched</h3><p>Stack Exchange returned a valid zero-result response for the requested tag constraint.</p></div>
    }
    return invalid('Invalid Stack Exchange empty response', 'The provider returned no questions without a trustworthy request-bound wrapper proving a semantic zero result.')
  }

  const parsed = providerItems.map((entry) => parseQuestion(entry, request))
  const trusted = parsed.filter((entry): entry is StackExchangeQuestion => Boolean(entry))
  const invalidResultCount = providerItems.length - trusted.length
  if (!trusted.length) {
    return invalid('Invalid Stack Exchange question results', 'None of the returned records established a trustworthy Stack Overflow question identity consistent with the requested tag constraint.')
  }

  const incompleteResultCount = trusted.filter((entry) => entry.incomplete).length
  const tagContract = !request || invalidResultCount === 0
  const state = request && !wrapper.malformed && countContract && tagContract && invalidResultCount === 0 && incompleteResultCount === 0 ? 'ready' : 'partial'
  const partialReason = !request
    ? 'Question records are internally identifiable, but executed-request identity is unavailable, so they cannot be fully bound to the Stack Exchange query.'
    : wrapper.malformed
      ? 'The Stack Exchange common-wrapper quota, pagination, or backoff metadata is missing or malformed. Trusted question records remain visible.'
      : !countContract
        ? 'The provider returned more questions than the executed page-size contract. Only validated question records are shown.'
        : invalidResultCount > 0
          ? `${invalidResultCount} malformed or tag-contradictory question${invalidResultCount === 1 ? ' was' : 's were'} hidden.`
          : 'One or more question metrics are missing or malformed. Question identity remains trustworthy, but untrusted values are withheld.'

  const cards: SemanticCard[] = trusted.slice(0, request?.pageSize ?? 20).map((question) => ({
    title: question.title,
    eyebrow: `Stack Overflow · active ${dateLabel(question.lastActivity)}`,
    badge: question.answered === undefined ? 'Answer state unavailable' : question.answered ? 'Answered' : 'Open',
    metrics: [
      { label: 'Score', value: formatCount(question.score) },
      { label: 'Answers', value: formatCount(question.answers) },
      { label: 'Views', value: formatCount(question.views) },
      { label: 'Question ID', value: String(question.id) },
    ],
    tags: question.tags,
  }))

  return <div data-domain-card="stack-exchange-questions" data-ssot-reference="stack-exchange" data-result-state={state} data-site={request?.site} data-request-tags={request?.tags.join(';')} data-request-sort={request?.sort} data-request-order={request?.order} data-request-page-size={request?.pageSize} data-query-bound={request ? 'true' : 'false'} data-provider-result-count={providerItems.length} data-valid-result-count={trusted.length} data-invalid-result-count={invalidResultCount} data-incomplete-result-count={incompleteResultCount} data-tag-contract={String(tagContract)} data-count-contract={String(countContract)} data-wrapper-contract={String(!wrapper.malformed)} data-has-more={wrapper.hasMore === undefined ? undefined : String(wrapper.hasMore)} data-quota-remaining={wrapper.quotaRemaining} data-quota-max={wrapper.quotaMax} data-backoff-seconds={wrapper.backoff}>
    <div className="domain-note"><strong>{request ? `Stack Overflow · ${request.tags.join(' + ')}` : 'Stack Overflow questions'}</strong> · {trusted.length.toLocaleString('en')} trusted question{trusted.length === 1 ? '' : 's'}{wrapper.quotaRemaining === undefined || wrapper.quotaMax === undefined ? '' : ` · API quota ${wrapper.quotaRemaining.toLocaleString('en')} / ${wrapper.quotaMax.toLocaleString('en')}`}</div>
    {wrapper.backoff !== undefined && <p className="domain-note">Provider backoff: wait {wrapper.backoff.toLocaleString('en')} seconds before calling this Stack Exchange method again.</p>}
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <SemanticCards cards={cards} emptyTitle="Stack Overflow question results unavailable"/>
  </div>
}
