import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { isRecord, nonNegativeInteger, positiveInteger, trimmedText } from './semanticValidation'

type WorksRequest = { query: string; limit: number }
type Work = { id: string; title: string; year?: number; citations: number; doi?: string; authors: string[]; isOa?: boolean; oaStatus?: string; incomplete: boolean }
const SELECT = 'id,title,publication_year,cited_by_count,doi,authorships,open_access'
const REQUEST_KEYS = ['search', 'per_page', 'select'] as const

const canonicalLimit = (value: string | null): number | undefined => {
  if (!value || !/^(?:[1-9]|1\d|20)$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 20 ? parsed : undefined
}

const requestedWorks = (executedRequest?: ExecutedRequestContext): WorksRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:'
      || url.hostname !== 'api.openalex.org'
      || url.port
      || url.pathname !== '/works'
      || url.hash
      || url.username
      || url.password
      || keys.length !== REQUEST_KEYS.length
      || keys.some((key) => !REQUEST_KEYS.includes(key as typeof REQUEST_KEYS[number]))
      || REQUEST_KEYS.some((key) => url.searchParams.getAll(key).length !== 1)
      || url.searchParams.get('select') !== SELECT) return undefined
    const rawQuery = url.searchParams.get('search') ?? ''
    const limit = canonicalLimit(url.searchParams.get('per_page'))
    if (!rawQuery || rawQuery !== rawQuery.trim() || limit === undefined) return undefined
    return { query: rawQuery, limit }
  } catch {
    return undefined
  }
}

const workId = (value: unknown): string | undefined => {
  const id = trimmedText(value)
  return id && /^https:\/\/openalex\.org\/W\d+$/.test(id) ? id : undefined
}
const doiValue = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  const doi = trimmedText(value)
  return doi && /^https:\/\/doi\.org\//.test(doi) ? { value: doi, malformed: false } : { malformed: true }
}
const parseWork = (value: unknown): Work | undefined => {
  if (!isRecord(value)) return undefined
  const id = workId(value.id); const title = trimmedText(value.title); const citations = nonNegativeInteger(value.cited_by_count)
  if (!id || !title || citations === undefined) return undefined
  const year = value.publication_year === null || value.publication_year === undefined ? undefined : positiveInteger(value.publication_year)
  const doi = doiValue(value.doi)
  let authorsMalformed = false; const authors: string[] = []
  if (!Array.isArray(value.authorships)) authorsMalformed = true
  else for (const authorship of value.authorships) {
    if (!isRecord(authorship) || !isRecord(authorship.author)) { authorsMalformed = true; continue }
    const name = trimmedText(authorship.author.display_name)
    if (!name) { authorsMalformed = true; continue }
    if (!authors.includes(name)) authors.push(name)
  }
  let isOa: boolean | undefined; let oaStatus: string | undefined; let oaMalformed = false
  if (value.open_access !== undefined && value.open_access !== null) {
    if (!isRecord(value.open_access)) oaMalformed = true
    else {
      isOa = typeof value.open_access.is_oa === 'boolean' ? value.open_access.is_oa : undefined
      oaStatus = trimmedText(value.open_access.oa_status)
      if (isOa === undefined || !oaStatus) oaMalformed = true
    }
  }
  return { id, title, year, citations, doi: doi.value, authors, isOa, oaStatus, incomplete: year === undefined || doi.malformed || authorsMalformed || !authors.length || oaMalformed }
}
const invalid = (detail: string) => <CardEmpty domain="scholarly-graph" title="Invalid OpenAlex works response" detail={detail} state="invalid"/>

export function OpenAlexWorksPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const request = requestedWorks(executedRequest)
  if (!request) return invalid('The executed request is not the exact supported bodyless OpenAlex works GET using one search, per_page, and select parameter.')
  if (!isRecord(data) || !isRecord(data.meta) || !Array.isArray(data.results)) return invalid('OpenAlex returned HTTP-success data without the documented meta/results search envelope.')

  const total = nonNegativeInteger(data.meta.count); const page = positiveInteger(data.meta.page); const perPage = positiveInteger(data.meta.per_page)
  const countContract = total !== undefined && total >= data.results.length && page === 1 && perPage === request.limit && data.results.length <= request.limit
  if (data.results.length === 0) {
    if (total === 0 && countContract) return <div className="domain-card domain-empty" data-domain-card="scholarly-graph" data-result-state="empty" data-request-bound="true" data-search-query={request.query} data-request-limit={request.limit} data-provider-total="0" data-provider-result-count="0" data-valid-result-count="0" data-invalid-result-count="0" data-duplicate-result-count="0" data-count-contract="true"><h3>No OpenAlex works matched</h3><p>OpenAlex returned a valid zero-result search for “{request.query}”.</p></div>
    return invalid('The provider returned no works without a trustworthy request-bound zero-result contract.')
  }

  const trusted: Work[] = []
  const seenIds = new Set<string>()
  let invalidCount = 0
  let duplicateCount = 0
  for (const candidate of data.results) {
    const work = parseWork(candidate)
    if (!work) {
      invalidCount += 1
      continue
    }
    if (seenIds.has(work.id)) {
      duplicateCount += 1
      continue
    }
    seenIds.add(work.id)
    trusted.push(work)
  }
  if (!trusted.length) return invalid('None of the returned OpenAlex rows carried a unique trustworthy work identity, title, and citation count.')
  const incompleteCount = trusted.filter((entry) => entry.incomplete).length
  const state = countContract && invalidCount === 0 && duplicateCount === 0 && incompleteCount === 0 ? 'ready' : 'partial'
  const cards: SemanticCard[] = trusted.slice(0, 20).map((work) => ({
    title: work.title,
    eyebrow: `OpenAlex ${work.id.split('/').at(-1)}${work.year ? ` · ${work.year}` : ''}`,
    description: work.authors.length ? work.authors.slice(0, 3).join(', ') : 'Authorship unavailable',
    badge: `${work.citations.toLocaleString('en')} citations`,
    metrics: [
      { label: 'DOI', value: work.doi?.replace('https://doi.org/', '') ?? 'Unavailable' },
      { label: 'Open access', value: work.isOa === undefined ? 'Unavailable' : work.isOa ? `Yes · ${work.oaStatus ?? 'status unavailable'}` : `No · ${work.oaStatus ?? 'status unavailable'}` },
      { label: 'Publication year', value: work.year?.toString() ?? 'Unavailable' },
      { label: 'OpenAlex ID', value: work.id.split('/').at(-1) ?? work.id },
    ],
  }))
  return <div data-domain-card="scholarly-graph" data-result-state={state} data-request-bound="true" data-search-query={request.query} data-request-limit={request.limit} data-query-bound="true" data-provider-total={total} data-provider-result-count={data.results.length} data-valid-result-count={trusted.length} data-invalid-result-count={invalidCount} data-duplicate-result-count={duplicateCount} data-incomplete-result-count={incompleteCount} data-count-contract={String(countContract)}>
    <div className="domain-note"><strong>OpenAlex · {request.query}</strong> · {trusted.length} trusted work{trusted.length === 1 ? '' : 's'}{total === undefined ? '' : ` of ${total.toLocaleString('en')} matches`}</div>
    {state === 'partial' && <p className="domain-note">Only unique provider-identified works are shown because counts or one or more response fields are incomplete, malformed, or duplicated.</p>}
    <SemanticCards cards={cards} emptyTitle="OpenAlex works unavailable"/>
  </div>
}
