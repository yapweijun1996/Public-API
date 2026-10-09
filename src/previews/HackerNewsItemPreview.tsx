import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { formatOptionalCount as formatCount, isRecord, isoDateFromEpochSeconds as dateLabel, nonNegativeSafeInteger as nonNegativeInteger, positiveSafeInteger as positiveInteger, trimmedText as text } from './semanticValidation'

type HnItemType = 'job' | 'story' | 'comment' | 'poll' | 'pollopt'
type HnItemRequest = { id: number }
type ParsedItem = {
  id: number
  type?: HnItemType
  author?: string
  title?: string
  text?: string
  url?: string
  score?: number
  descendants?: number
  time?: number
  parent?: number
  poll?: number
  kids: number[]
  parts: number[]
  deleted?: boolean
  dead?: boolean
  incomplete: boolean
}

const itemTypes = new Set<HnItemType>(['job', 'story', 'comment', 'poll', 'pollopt'])
const stripMarkup = (value?: string) => value?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || undefined

const requestIdentity = (executedRequest?: ExecutedRequestContext, requestUrl?: string): HnItemRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.origin !== 'https://hacker-news.firebaseio.com' || url.hash || url.username || url.password) return undefined
    const match = /^\/v0\/item\/([1-9][0-9]*)\.json$/.exec(url.pathname)
    if (!match) return undefined
    const keys = [...url.searchParams.keys()]
    if (keys.some((key) => key !== 'print') || url.searchParams.getAll('print').length !== 1 || url.searchParams.get('print') !== 'pretty') return undefined
    const id = Number(match[1])
    return Number.isSafeInteger(id) && id > 0 ? { id } : undefined
  } catch {
    return undefined
  }
}

const optionalBoolean = (value: unknown): { value?: boolean; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  return typeof value === 'boolean' ? { value, malformed: false } : { malformed: true }
}
const optionalText = (value: unknown, allowEmpty = false): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  if (typeof value !== 'string') return { malformed: true }
  const normalized = value.trim()
  if (!normalized) return allowEmpty ? { value: '', malformed: false } : { malformed: true }
  return { value: normalized, malformed: false }
}
const optionalPositiveInteger = (value: unknown): { value?: number; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  const parsed = positiveInteger(value)
  return parsed === undefined ? { malformed: true } : { value: parsed, malformed: false }
}
const optionalNonNegativeInteger = (value: unknown): { value?: number; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  const parsed = nonNegativeInteger(value)
  return parsed === undefined ? { malformed: true } : { value: parsed, malformed: false }
}
const integerList = (value: unknown): { values: number[]; malformed: boolean } => {
  if (value === undefined || value === null) return { values: [], malformed: false }
  if (!Array.isArray(value)) return { values: [], malformed: true }
  const values: number[] = []
  let malformed = false
  for (const entry of value) {
    const id = positiveInteger(entry)
    if (!id || values.includes(id)) { malformed = true; continue }
    values.push(id)
  }
  return { values, malformed }
}
const externalUrl = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null || value === '') return { malformed: false }
  if (typeof value !== 'string') return { malformed: true }
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { malformed: true }
    return { value: url.toString(), malformed: false }
  } catch {
    return { malformed: true }
  }
}

const parseItem = (data: unknown, request?: HnItemRequest): ParsedItem | undefined => {
  if (!isRecord(data)) return undefined
  const id = positiveInteger(data.id)
  if (!id || (request && id !== request.id)) return undefined

  const deleted = optionalBoolean(data.deleted)
  const dead = optionalBoolean(data.dead)
  const rawType = text(data.type)
  const type = rawType && itemTypes.has(rawType as HnItemType) ? rawType as HnItemType : undefined
  if (!type && deleted.value !== true) return undefined

  const author = optionalText(data.by)
  const title = optionalText(data.title)
  const body = optionalText(data.text, true)
  const url = externalUrl(data.url)
  const score = optionalNonNegativeInteger(data.score)
  const descendants = optionalNonNegativeInteger(data.descendants)
  const time = optionalPositiveInteger(data.time)
  const parent = optionalPositiveInteger(data.parent)
  const poll = optionalPositiveInteger(data.poll)
  const kids = integerList(data.kids)
  const parts = integerList(data.parts)

  let contractIncomplete = false
  if (deleted.value !== true) {
    if (!author.value || !time.value) contractIncomplete = true
    if ((type === 'story' || type === 'job' || type === 'poll') && !title.value) contractIncomplete = true
    if ((type === 'story' || type === 'job' || type === 'poll' || type === 'pollopt') && score.value === undefined) contractIncomplete = true
    if (type === 'comment' && parent.value === undefined) contractIncomplete = true
    if (type === 'pollopt' && poll.value === undefined) contractIncomplete = true
    if ((type === 'story' || type === 'poll') && descendants.value === undefined) contractIncomplete = true
  }

  return {
    id,
    type,
    author: author.value,
    title: title.value,
    text: body.value,
    url: url.value,
    score: score.value,
    descendants: descendants.value,
    time: time.value,
    parent: parent.value,
    poll: poll.value,
    kids: kids.values,
    parts: parts.values,
    deleted: deleted.value,
    dead: dead.value,
    incomplete: deleted.malformed || dead.malformed || Boolean(rawType && !type) || author.malformed || title.malformed || body.malformed || url.malformed || score.malformed || descendants.malformed || time.malformed || parent.malformed || poll.malformed || kids.malformed || parts.malformed || contractIncomplete,
  }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="hacker-news-item" title={title} detail={detail} state="invalid"/>

export function HackerNewsItemPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = requestIdentity(executedRequest, requestUrl)
  if (executedRequest && !request) return invalid('Invalid Hacker News item request identity', 'The successful response is not bound to the exact supported bodyless GET Hacker News v0 item contract.')

  if (data === null) {
    if (!request) return invalid('Unbound Hacker News empty response', 'Hacker News returned null without executed-request identity, so the missing item cannot be attributed to a specific lookup.')
    return <div className="domain-card domain-empty" data-domain-card="hacker-news-item" data-ssot-reference="hacker-news" data-result-state="empty" data-requested-item-id={request.id} data-request-bound="true" data-provider-item-present="false" data-identity-match="true"><h3>Hacker News item not found</h3><p>The provider returned its documented JSON null shape for item #{request.id}.</p></div>
  }

  const item = parseItem(data, request)
  if (!item) return invalid('Invalid Hacker News item response', 'The HTTP-success body did not establish a trustworthy Hacker News item identity consistent with the executed lookup.')

  const state = request && !item.incomplete ? 'ready' : 'partial'
  const status = item.deleted ? 'Deleted' : item.dead ? 'Dead' : 'Available'
  const kind = item.type ?? 'deleted item'
  const description = stripMarkup(item.text) ?? item.url
  const metrics: SemanticCard['metrics'] = [
    { label: 'Published', value: dateLabel(item.time) },
    { label: 'Direct children', value: formatCount(item.kids.length) },
  ]
  if (item.type === 'story' || item.type === 'job' || item.type === 'poll' || item.type === 'pollopt') metrics.unshift({ label: 'Score', value: formatCount(item.score) })
  if (item.type === 'story' || item.type === 'poll') metrics.push({ label: 'Total comments', value: formatCount(item.descendants) })
  if (item.type === 'comment') metrics.push({ label: 'Parent item', value: item.parent === undefined ? 'Unavailable' : String(item.parent) })
  if (item.type === 'pollopt') metrics.push({ label: 'Poll item', value: item.poll === undefined ? 'Unavailable' : String(item.poll) })
  if (item.type === 'poll') metrics.push({ label: 'Poll options', value: formatCount(item.parts.length) })

  const card: SemanticCard = {
    title: item.title ?? (item.author ? `${kind === 'comment' ? 'Comment' : 'Hacker News item'} by ${item.author}` : `Hacker News item #${item.id}`),
    eyebrow: `Hacker News ${kind} · #${item.id}`,
    description,
    badge: status,
    metrics,
    tags: [item.author ? `by:${item.author}` : '', item.url ? `external:${new URL(item.url).hostname}` : '', item.deleted ? 'deleted' : '', item.dead ? 'dead' : ''].filter(Boolean),
  }

  const partialReason = !request
    ? 'The item is internally identifiable, but executed-request identity is unavailable.'
    : item.incomplete
      ? 'One or more type-specific or optional Hacker News fields are missing or malformed; only validated facts are shown.'
      : ''

  return <div data-domain-card="hacker-news-item" data-ssot-reference="hacker-news" data-result-state={state} data-requested-item-id={request?.id} data-provider-item-id={item.id} data-request-bound={request ? 'true' : 'false'} data-provider-item-present="true" data-identity-match={request ? String(item.id === request.id) : 'unbound'} data-item-type={item.type} data-item-deleted={item.deleted === undefined ? 'unknown' : String(item.deleted)} data-item-dead={item.dead === undefined ? 'unknown' : String(item.dead)} data-item-kids-count={item.kids.length} data-item-parts-count={item.parts.length} data-item-score={item.score} data-item-descendants={item.descendants} data-item-parent={item.parent} data-item-poll={item.poll}>
    <div className="domain-note"><strong>Hacker News item #{item.id}</strong> · {kind} · {status}</div>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <SemanticCards cards={[card]} emptyTitle="Hacker News item unavailable"/>
  </div>
}
