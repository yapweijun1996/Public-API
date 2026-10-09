import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { formatOptionalCount as formatCount, isRecord, nonNegativeInteger, optionalTrimmedText as parseOptionalText, positiveInteger, trimmedText as text } from './semanticValidation'

type DevToRequest = {
  tag: string
  limit: number
  page: 1
}

type DevToArticle = {
  id: number
  title: string
  description?: string
  path: string
  url: string
  username: string
  authorName?: string
  tags: string[]
  reactions?: number
  comments?: number
  readingMinutes?: number
  publishedTimestamp?: string
  incomplete: boolean
}


const requestedArticles = (executedRequest?: ExecutedRequestContext, requestUrl?: string): DevToRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.origin !== 'https://dev.to' || url.pathname !== '/api/articles' || url.hash || url.username || url.password) return undefined
    const allowed = new Set(['tag', 'per_page', 'page'])
    const keys = [...url.searchParams.keys()]
    if (keys.some((key) => !allowed.has(key))) return undefined
    if ([...allowed].some((key) => url.searchParams.getAll(key).length !== 1)) return undefined

    const tag = (url.searchParams.get('tag') ?? '').trim()
    const perPageText = url.searchParams.get('per_page') ?? ''
    const pageText = url.searchParams.get('page') ?? ''
    if (!tag || !/^\d+$/.test(perPageText) || pageText !== '1') return undefined
    const limit = Number(perPageText)
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) return undefined
    return { tag, limit, page: 1 }
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
    if (!values.some((existing) => existing.toLocaleLowerCase('en-US') === tag.toLocaleLowerCase('en-US'))) values.push(tag)
    else malformed = true
  }
  return { values, malformed }
}

const parseTimestamp = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  const raw = text(value)
  if (!raw || Number.isNaN(Date.parse(raw))) return { malformed: true }
  return { value: raw, malformed: false }
}

const canonicalArticleUrl = (value: unknown, path: string): string | undefined => {
  const raw = text(value)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.hostname !== 'dev.to' || url.username || url.password || url.search || url.hash) return undefined
    const normalizedPath = path.startsWith('/') ? path.replace(/\/+$/, '') || '/' : `/${path}`.replace(/\/+$/, '') || '/'
    const providerPath = url.pathname.replace(/\/+$/, '') || '/'
    return providerPath === normalizedPath ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const parseArticle = (value: unknown, request?: DevToRequest): DevToArticle | undefined => {
  if (!isRecord(value) || value.type_of !== 'article') return undefined
  const id = positiveInteger(value.id)
  const title = text(value.title)
  const path = text(value.path)
  if (!id || !title || !path || !path.startsWith('/')) return undefined
  const url = canonicalArticleUrl(value.url, path)
  if (!url || !isRecord(value.user)) return undefined
  const username = text(value.user.username)
  if (!username) return undefined

  const tags = parseTags(value.tag_list)
  if (!tags.values.length) return undefined
  if (request && !tags.values.some((tag) => tag.toLocaleLowerCase('en-US') === request.tag.toLocaleLowerCase('en-US'))) return undefined

  const description = parseOptionalText(value.description)
  const authorName = parseOptionalText(value.user.name)
  const published = parseTimestamp(value.published_timestamp)
  const reactions = nonNegativeInteger(value.public_reactions_count)
  const comments = nonNegativeInteger(value.comments_count)
  const readingMinutes = nonNegativeInteger(value.reading_time_minutes)
  const incomplete = tags.malformed
    || description.malformed
    || authorName.malformed
    || published.malformed
    || published.value === undefined
    || reactions === undefined
    || comments === undefined
    || readingMinutes === undefined

  return {
    id,
    title,
    description: description.value,
    path,
    url,
    username,
    authorName: authorName.value,
    tags: tags.values,
    reactions,
    comments,
    readingMinutes,
    publishedTimestamp: published.value,
    incomplete,
  }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="devto-articles" title={title} detail={detail} state="invalid"/>

export function DevToArticlesPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!Array.isArray(data)) {
    return invalid('Invalid DEV article response', 'Forem returned HTTP-success data without the documented published-articles array.')
  }

  const request = requestedArticles(executedRequest, requestUrl)
  if (executedRequest && !request) {
    return invalid('Invalid DEV article request identity', 'The successful response is not bound to the exact supported bodyless GET DEV published-articles contract.')
  }

  if (data.length === 0) {
    if (request) {
      return <div className="domain-card domain-empty" data-domain-card="devto-articles" data-ssot-reference="devto" data-result-state="empty" data-request-tag={request.tag} data-request-limit={request.limit} data-request-page="1" data-request-bound="true" data-provider-result-count="0" data-valid-result-count="0" data-invalid-result-count="0" data-incomplete-result-count="0" data-tag-contract="true" data-count-contract="true"><h3>No DEV articles matched</h3><p>Forem returned a valid zero-result page for the exact “{request.tag}” tag.</p></div>
    }
    return invalid('Invalid unbound DEV empty response', 'An empty provider page cannot be assigned search meaning without executed-request identity.')
  }

  const trusted: DevToArticle[] = []
  let invalidResultCount = 0
  const seenIds = new Set<number>()
  const seenUrls = new Set<string>()
  for (const item of data) {
    const article = parseArticle(item, request)
    if (!article || seenIds.has(article.id) || seenUrls.has(article.url)) {
      invalidResultCount += 1
      continue
    }
    seenIds.add(article.id)
    seenUrls.add(article.url)
    trusted.push(article)
  }

  if (!trusted.length) {
    return invalid('Invalid DEV article results', 'None of the returned records established a trustworthy published DEV article identity consistent with the requested tag.')
  }

  const incompleteResultCount = trusted.filter((article) => article.incomplete).length
  const countContract = !request || data.length <= request.limit
  const tagContract = !request || invalidResultCount === 0
  const state = request && countContract && tagContract && invalidResultCount === 0 && incompleteResultCount === 0 ? 'ready' : 'partial'
  const partialReason = !request
    ? 'Article records are internally identifiable, but executed-request identity is unavailable, so they cannot be fully bound to a DEV tag request.'
    : !countContract
      ? 'The provider returned more articles than the executed page-size contract. Only validated articles are shown.'
      : invalidResultCount > 0
        ? `${invalidResultCount} malformed, duplicate, or tag-contradictory article${invalidResultCount === 1 ? ' was' : 's were'} hidden.`
        : 'One or more article metrics or publication fields are missing or malformed. Article identity remains trustworthy, but untrusted values are withheld.'

  const cards: SemanticCard[] = trusted.slice(0, request?.limit ?? 20).map((article) => ({
    title: article.title,
    eyebrow: `DEV Community · @${article.username}${article.publishedTimestamp ? ` · ${article.publishedTimestamp.slice(0, 10)}` : ''}`,
    description: article.description,
    badge: article.reactions === undefined ? 'Reactions unavailable' : `${article.reactions.toLocaleString('en')} reactions`,
    metrics: [
      { label: 'Comments', value: formatCount(article.comments) },
      { label: 'Reading time', value: article.readingMinutes === undefined ? 'Unavailable' : `${article.readingMinutes.toLocaleString('en')} min` },
      { label: 'Article ID', value: String(article.id) },
      { label: 'Author', value: article.authorName ?? `@${article.username}` },
    ],
    tags: article.tags,
  }))

  return <div data-domain-card="devto-articles" data-ssot-reference="devto" data-result-state={state} data-request-tag={request?.tag} data-request-limit={request?.limit} data-request-page={request?.page} data-request-bound={request ? 'true' : 'false'} data-provider-result-count={data.length} data-valid-result-count={trusted.length} data-invalid-result-count={invalidResultCount} data-incomplete-result-count={incompleteResultCount} data-tag-contract={String(tagContract)} data-count-contract={String(countContract)} data-first-article-id={trusted[0]?.id} data-first-article-url={trusted[0]?.url}>
    <div className="domain-note"><strong>{request ? `DEV articles · #${request.tag}` : 'DEV published articles'}</strong> · {trusted.length.toLocaleString('en')} trusted article{trusted.length === 1 ? '' : 's'}</div>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <SemanticCards cards={cards} emptyTitle="DEV article results unavailable"/>
  </div>
}
