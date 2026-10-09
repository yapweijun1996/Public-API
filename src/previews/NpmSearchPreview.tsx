import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { formatOptionalCount as formatCount, isRecord, nonNegativeInteger, optionalTrimmedText as parseOptionalText, trimmedText as text } from './semanticValidation'

const SEARCH_PATH = '/-/v1/search'

type NpmSearchRequest = {
  query: string
  size: number
  from?: number
}

type NpmSearchResult = {
  name: string
  version: string
  description?: string
  publisher?: string
  updated?: string
  license?: string
  weekly?: number
  monthly?: number
  score?: number
  keywords: string[]
  incomplete: boolean
}

const nonNegativeNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
const formatScore = (value?: number) => value === undefined ? 'Unavailable' : value.toLocaleString('en', { maximumFractionDigits: 2 })

const requestedSearch = (executedRequest?: ExecutedRequestContext): NpmSearchRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  const requestUrl = executedRequest.url
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org' || url.pathname !== SEARCH_PATH || url.hash) return undefined
    const allowed = new Set(['text', 'size', 'from'])
    const keys = [...url.searchParams.keys()]
    if (keys.some((key) => !allowed.has(key))) return undefined
    if (url.searchParams.getAll('text').length !== 1 || url.searchParams.getAll('size').length !== 1 || url.searchParams.getAll('from').length > 1) return undefined

    const query = (url.searchParams.get('text') ?? '').trim()
    const sizeText = url.searchParams.get('size') ?? ''
    const fromText = url.searchParams.get('from')
    if (!query || !/^\d+$/.test(sizeText) || (fromText !== null && !/^\d+$/.test(fromText))) return undefined
    const size = Number(sizeText)
    const from = fromText === null ? undefined : Number(fromText)
    if (!Number.isInteger(size) || size < 1 || size > 20 || (from !== undefined && (!Number.isInteger(from) || from < 0))) return undefined
    return { query, size, from }
  } catch {
    return undefined
  }
}

const parseKeywords = (value: unknown): { values: string[]; malformed: boolean } => {
  if (value === undefined || value === null) return { values: [], malformed: false }
  if (!Array.isArray(value)) return { values: [], malformed: true }
  const values: string[] = []
  let malformed = false
  for (const item of value) {
    const keyword = text(item)
    if (!keyword) { malformed = true; continue }
    if (!values.includes(keyword)) values.push(keyword)
  }
  return { values, malformed }
}

const trustedResult = (value: unknown): NpmSearchResult | undefined => {
  if (!isRecord(value) || !isRecord(value.package)) return undefined
  const pkg = value.package
  const name = text(pkg.name)
  const version = text(pkg.version)
  if (!name || !version) return undefined

  const description = parseOptionalText(pkg.description)
  const license = parseOptionalText(pkg.license)
  const date = parseOptionalText(pkg.date)
  const updated = parseOptionalText(value.updated)
  const publisherRaw = pkg.publisher
  const publisher = publisherRaw === undefined || publisherRaw === null
    ? { value: undefined, malformed: false }
    : isRecord(publisherRaw)
      ? parseOptionalText(publisherRaw.username)
      : { value: undefined, malformed: true }
  const keywords = parseKeywords(pkg.keywords)

  let weekly: number | undefined
  let monthly: number | undefined
  let downloadsMalformed = value.downloads === undefined || value.downloads === null
  if (value.downloads !== undefined && value.downloads !== null) {
    if (!isRecord(value.downloads)) {
      downloadsMalformed = true
    } else {
      const weeklyRaw = value.downloads.weekly
      const monthlyRaw = value.downloads.monthly
      weekly = nonNegativeInteger(weeklyRaw)
      monthly = nonNegativeInteger(monthlyRaw)
      if ((weeklyRaw !== undefined && weeklyRaw !== null && weekly === undefined) || (monthlyRaw !== undefined && monthlyRaw !== null && monthly === undefined)) downloadsMalformed = true
    }
  }

  const scoreRaw = value.searchScore
  const score = nonNegativeNumber(scoreRaw)
  const scoreMalformed = score === undefined
  const incomplete = description.malformed || license.malformed || date.malformed || updated.malformed || publisher.malformed || !publisher.value || keywords.malformed || downloadsMalformed || weekly === undefined || monthly === undefined || scoreMalformed || !(updated.value ?? date.value)

  return {
    name,
    version,
    description: description.value,
    publisher: publisher.value,
    updated: updated.value ?? date.value,
    license: license.value,
    weekly,
    monthly,
    score,
    keywords: keywords.values,
    incomplete,
  }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="npm-package-search" title={title} detail={detail} state="invalid"/>

export function NpmSearchPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  if (!isRecord(data) || !Array.isArray(data.objects)) {
    return invalid('Invalid npm search response', 'npm returned HTTP-success data without the documented objects search-results array.')
  }

  const request = requestedSearch(executedRequest)
  if (executedRequest && !request) {
    return invalid('Invalid npm search request identity', 'The executed URL is not the supported npm registry search endpoint with a trustworthy text/size request.')
  }

  const providerResults = data.objects
  const providerTotal = nonNegativeInteger(data.total)
  const providerTime = parseOptionalText(data.time)
  const countContractValid = providerTotal !== undefined
    && providerTotal >= providerResults.length
    && (!request || providerResults.length <= request.size)
    && (!request?.from || providerTotal >= request.from + providerResults.length)

  if (providerResults.length === 0) {
    if (request && providerTotal === 0 && !providerTime.malformed) {
      return <div className="domain-card domain-empty" data-domain-card="npm-package-search" data-ssot-reference="npm-registry-search" data-result-state="empty" data-search-query={request.query} data-request-size={request.size} data-request-from={request.from} data-query-bound="true" data-provider-total="0" data-provider-result-count="0" data-valid-result-count="0" data-invalid-result-count="0" data-incomplete-result-count="0" data-count-contract="true"><h3>No npm packages matched</h3><p>npm returned a valid zero-result search for “{request.query}”.</p></div>
    }
    return invalid('Invalid npm empty search response', 'The provider returned no package results without a trustworthy request-bound zero-result count contract.')
  }

  const parsed = providerResults.map(trustedResult)
  const trusted = parsed.filter((entry): entry is NpmSearchResult => Boolean(entry))
  const invalidResultCount = providerResults.length - trusted.length
  if (!trusted.length) {
    return invalid('Invalid npm package results', 'None of the returned search records contained a trustworthy package name and version identity.')
  }

  const incompleteResultCount = trusted.filter((entry) => entry.incomplete).length
  const state = request && countContractValid && !providerTime.malformed && invalidResultCount === 0 && incompleteResultCount === 0 ? 'ready' : 'partial'
  const partialReason = !request
    ? 'The provider package records are internally identifiable, but executed-request identity is unavailable, so they cannot be fully bound to an npm search.'
    : !countContractValid
      ? 'Provider result-count metadata is missing or inconsistent with the executed search. Only validated package records are shown.'
      : providerTime.malformed
        ? 'The provider search-time metadata is malformed. Only validated package records are shown.'
        : invalidResultCount > 0
          ? `${invalidResultCount} malformed provider result${invalidResultCount === 1 ? ' was' : 's were'} hidden.`
          : 'One or more optional package metrics are malformed. Package identity remains trustworthy, but malformed values are withheld.'

  const cards: SemanticCard[] = trusted.slice(0, 20).map((entry) => ({
    title: entry.name,
    eyebrow: `npm package · v${entry.version}`,
    description: entry.description,
    badge: entry.weekly === undefined ? 'Weekly downloads unavailable' : `${entry.weekly.toLocaleString('en')} weekly`,
    metrics: [
      { label: 'Monthly downloads', value: formatCount(entry.monthly) },
      { label: 'Publisher', value: entry.publisher ?? 'Unavailable' },
      { label: 'Updated', value: entry.updated ?? 'Unavailable' },
      { label: 'Search score', value: formatScore(entry.score) },
    ],
    tags: entry.keywords.slice(0, 8),
  }))

  return <div data-domain-card="npm-package-search" data-ssot-reference="npm-registry-search" data-result-state={state} data-search-query={request?.query} data-request-size={request?.size} data-request-from={request?.from} data-query-bound={request ? 'true' : 'false'} data-provider-total={providerTotal} data-provider-result-count={providerResults.length} data-valid-result-count={trusted.length} data-invalid-result-count={invalidResultCount} data-incomplete-result-count={incompleteResultCount} data-count-contract={String(countContractValid)}>
    <div className="domain-note"><strong>{request ? `npm search · ${request.query}` : 'npm registry search'}</strong> · {trusted.length.toLocaleString('en')} trusted result{trusted.length === 1 ? '' : 's'}{providerTotal === undefined ? '' : ` of ${providerTotal.toLocaleString('en')} provider matches`}</div>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <SemanticCards cards={cards} emptyTitle="npm package results unavailable"/>
  </div>
}
