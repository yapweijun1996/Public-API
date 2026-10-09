import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

type SpaceflightNewsRequest = {
  search: string
  limit: number
  order: '-published_at'
}

type SpaceflightArticle = {
  id: number
  title: string
  source: string
  articleUrl: string
  imageUrl: string
  summary: string
  publishedAt: string
  authorCount: number
  launchCount: number
  eventCount: number
}

type SpaceflightNewsResult = {
  articles: SpaceflightArticle[]
  total: number
  providerCount: number
  malformedCount: number
  duplicateCount: number
  overflowCount: number
}

type ParsedSpaceflightNews = {
  request?: SpaceflightNewsRequest
  result?: SpaceflightNewsResult
  invalidReason?: string
}

const requestKeys = ['search', 'limit', 'ordering'] as const
const nextPageKeys = [...requestKeys, 'offset'] as const

const canonicalPositiveInteger = (value: string, maximum: number): number | undefined => {
  if (!/^[1-9]\d*$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed <= maximum && String(parsed) === value ? parsed : undefined
}

export const parseSpaceflightNewsRequest = (executedRequest?: ExecutedRequestContext): SpaceflightNewsRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'api.spaceflightnewsapi.net' || url.port || url.username || url.password
      || url.hash || url.pathname !== '/v4/articles/' || keys.length !== requestKeys.length
      || !requestKeys.every((key) => keys.includes(key))
      || requestKeys.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined

    const rawSearch = url.searchParams.get('search') ?? ''
    const search = rawSearch.trim()
    const rawLimit = url.searchParams.get('limit') ?? ''
    const limit = canonicalPositiveInteger(rawLimit, 10)
    const order = url.searchParams.get('ordering')
    if (!search || search !== rawSearch || limit === undefined || order !== '-published_at') return undefined
    return { search, limit, order }
  } catch {
    return undefined
  }
}

const exactNextPage = (value: unknown, request: SpaceflightNewsRequest): boolean => {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) return false
  try {
    const url = new URL(value)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'api.spaceflightnewsapi.net' || url.port || url.username || url.password
      || url.hash || url.pathname !== '/v4/articles/' || keys.length !== nextPageKeys.length
      || !nextPageKeys.every((key) => keys.includes(key))
      || nextPageKeys.some((key) => url.searchParams.getAll(key).length !== 1)) return false
    return url.searchParams.get('search') === request.search
      && url.searchParams.get('limit') === String(request.limit)
      && url.searchParams.get('ordering') === request.order
      && url.searchParams.get('offset') === String(request.limit)
  } catch {
    return false
  }
}

const httpsUrl = (value: unknown): string | undefined => {
  const text = trimmedText(value)
  if (!text) return undefined
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.username || url.password) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

const isoDateTime = (value: unknown): string | undefined => {
  const text = trimmedText(value)
  if (!text) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(text)
  if (!match) return undefined
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , , offsetHourText, offsetMinuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText)
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText)
  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const calendarValid = calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day
    && calendar.getUTCHours() === hour && calendar.getUTCMinutes() === minute && calendar.getUTCSeconds() === second
  const offsetValid = offsetHour <= 14 && offsetMinute <= 59 && (offsetHour !== 14 || offsetMinute === 0)
  return calendarValid && offsetValid && Number.isFinite(Date.parse(text)) ? text : undefined
}

const validNamedAuthors = (value: unknown): value is Array<Record<string, unknown>> => Array.isArray(value)
  && value.every((author) => isRecord(author) && Boolean(trimmedText(author.name)))

const validReferenceArray = (value: unknown): value is Array<Record<string, unknown>> => Array.isArray(value) && value.every(isRecord)

const parseArticle = (value: unknown): SpaceflightArticle | undefined => {
  if (!isRecord(value)) return undefined
  const id = positiveSafeInteger(value.id)
  const title = trimmedText(value.title)
  const source = trimmedText(value.news_site)
  const summary = trimmedText(value.summary)
  const articleUrl = httpsUrl(value.url)
  const imageUrl = httpsUrl(value.image_url)
  const publishedAt = isoDateTime(value.published_at)
  const updatedAt = isoDateTime(value.updated_at)
  if (!id || !title || !source || !summary || !articleUrl || !imageUrl || !publishedAt || !updatedAt
    || !validNamedAuthors(value.authors) || !validReferenceArray(value.launches) || !validReferenceArray(value.events)) return undefined
  return {
    id,
    title,
    source,
    articleUrl,
    imageUrl,
    summary,
    publishedAt,
    authorCount: value.authors.length,
    launchCount: value.launches.length,
    eventCount: value.events.length,
  }
}

export const parseSpaceflightNewsResponse = (data: unknown, executedRequest?: ExecutedRequestContext): ParsedSpaceflightNews => {
  const request = parseSpaceflightNewsRequest(executedRequest)
  if (!request) return { invalidReason: 'The successful response was not tied to the exact supported Spaceflight News API request.' }
  if (!isRecord(data) || !Array.isArray(data.results) || !('count' in data) || !('next' in data) || !('previous' in data)) {
    return { request, invalidReason: 'Spaceflight News API did not return the documented pagination envelope.' }
  }
  const total = nonNegativeSafeInteger(data.count)
  if (total === undefined || data.previous !== null || total < data.results.length) {
    return { request, invalidReason: 'Spaceflight News API returned inconsistent first-page count or previous-page evidence.' }
  }
  const expectedProviderCount = Math.min(total, request.limit)
  if (data.results.length < expectedProviderCount) {
    return { request, invalidReason: 'Spaceflight News API returned fewer first-page records than its documented count and limit require.' }
  }
  const shouldHaveNextPage = total > request.limit
  if ((shouldHaveNextPage && !exactNextPage(data.next, request)) || (!shouldHaveNextPage && data.next !== null)) {
    return { request, invalidReason: 'Spaceflight News API returned pagination that does not preserve the exact search, limit, order, and first offset.' }
  }

  const providerRows = data.results.slice(0, request.limit)
  const overflowCount = data.results.length - providerRows.length
  const articles: SpaceflightArticle[] = []
  const seen = new Set<number>()
  let malformedCount = 0
  let duplicateCount = 0
  for (const value of providerRows) {
    const article = parseArticle(value)
    if (!article) { malformedCount += 1; continue }
    if (seen.has(article.id)) { duplicateCount += 1; continue }
    seen.add(article.id)
    articles.push(article)
  }
  return {
    request,
    result: {
      articles,
      total,
      providerCount: providerRows.length,
      malformedCount,
      duplicateCount,
      overflowCount,
    },
  }
}

const attributes = (request?: SpaceflightNewsRequest, result?: SpaceflightNewsResult) => ({
  'data-domain-card': 'spaceflight-news',
  'data-request-bound': request ? 'true' : 'false',
  'data-request-contract': 'exact-snapi-articles-v1',
  'data-request-search': request?.search,
  'data-request-limit': request?.limit,
  'data-request-order': request?.order,
  'data-provider': 'Spaceflight News API',
  'data-provider-total-count': result?.total,
  'data-provider-record-count': result?.providerCount,
  'data-valid-record-count': result?.articles.length,
  'data-malformed-record-count': result?.malformedCount,
  'data-duplicate-record-count': result?.duplicateCount,
  'data-overflow-record-count': result?.overflowCount,
  'data-primary-article-id': result?.articles[0]?.id,
  'data-primary-source': result?.articles[0]?.source,
  'data-primary-published-at': result?.articles[0]?.publishedAt,
})

const boundedSummary = (value: string, maximum = 360) => {
  if (value.length <= maximum) return value
  const candidate = value.slice(0, maximum + 1)
  const boundary = candidate.lastIndexOf(' ')
  return `${candidate.slice(0, boundary >= maximum * 0.7 ? boundary : maximum).trimEnd()}…`
}

const timestampLabel = (value: string) => new Date(value).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
const countLabel = (count: number, singular: string) => `${count} ${singular}${count === 1 ? '' : 's'}`

export function SpaceflightNewsPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseSpaceflightNewsResponse(data, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attributes(parsed.request)} data-result-state="invalid"><h3>Invalid spaceflight news response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  if (result.total === 0) return <div className="domain-card domain-empty" {...attributes(request, result)} data-result-state="empty"><h3>No spaceflight articles matched</h3><p>The provider returned a coherent empty first page for “{request.search}”.</p></div>
  if (!result.articles.length) return <div className="domain-card domain-empty" {...attributes(request, result)} data-result-state="invalid"><h3>Invalid spaceflight article identities</h3><p>The provider returned records, but none had a unique native article ID and all documented required article evidence.</p></div>
  const partial = result.malformedCount > 0 || result.duplicateCount > 0 || result.overflowCount > 0 || result.articles.length !== result.providerCount
  return <div className="domain-card spaceflight-news-preview" {...attributes(request, result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Spaceflight News API · publication order</small><h3>{request.search}</h3><p>Exact-request-bound publisher articles ordered by the provider’s published-at field.</p></div><span className="domain-state">{result.articles.length} trusted articles</span></header>
    {partial && <p className="domain-note">Malformed, duplicate, or over-limit records are withheld. Raw JSON retains the provider response.</p>}
    <dl className="domain-facts"><div><dt>Total matches</dt><dd>{result.total.toLocaleString('en')}</dd></div><div><dt>Returned</dt><dd>{result.providerCount} / {request.limit}</dd></div><div><dt>Order</dt><dd><code>{request.order}</code></dd></div><div><dt>Primary article ID</dt><dd><code>{result.articles[0].id}</code></dd></div></dl>
    <ol className="spaceflight-news-list">{result.articles.map((article) => <li key={article.id} data-article-id={article.id} data-article-source={article.source} data-article-published-at={article.publishedAt}>
      <article>
        <img src={article.imageUrl} alt={`Article image for ${article.title}`} loading="lazy"/>
        <div><small>{article.source}</small><h3>{article.title}</h3><p className="spaceflight-news-summary">{boundedSummary(article.summary)}</p><dl><div><dt>Published</dt><dd><time dateTime={article.publishedAt}>{timestampLabel(article.publishedAt)}</time></dd></div><div><dt>References</dt><dd>{countLabel(article.authorCount, 'author')} · {countLabel(article.launchCount, 'launch')} · {countLabel(article.eventCount, 'event')}</dd></div></dl><a href={article.articleUrl} target="_blank" rel="noreferrer">Read at {article.source}</a></div>
      </article>
    </li>)}</ol>
  </div>
}
