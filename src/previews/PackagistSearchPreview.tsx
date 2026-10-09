import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { formatOptionalCount as formatCount, isRecord, nonNegativeInteger, optionalTrimmedText as parseOptionalText, trimmedText as text } from './semanticValidation'

type PackagistSearchRequest = {
  query: string
  perPage: number
  page: number
}

type PackagistSearchResult = {
  name: string
  description?: string
  packageUrl: string
  repository?: string
  downloads?: number
  favers?: number
  incomplete: boolean
}


const requestedSearch = (executedRequest?: ExecutedRequestContext): PackagistSearchRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  const requestUrl = executedRequest.url
  try {
    const url = new URL(requestUrl)
    if (url.origin !== 'https://packagist.org' || url.pathname !== '/search.json' || url.hash || url.username || url.password) return undefined
    const keys = [...url.searchParams.keys()]
    if (keys.some((key) => key !== 'q' && key !== 'per_page')) return undefined
    if (url.searchParams.getAll('q').length !== 1 || url.searchParams.getAll('per_page').length !== 1) return undefined

    const query = (url.searchParams.get('q') ?? '').trim()
    const perPageText = url.searchParams.get('per_page') ?? ''
    if (!query || !/^\d+$/.test(perPageText)) return undefined
    const perPage = Number(perPageText)
    if (!Number.isInteger(perPage) || perPage < 1 || perPage > 20) return undefined

    const canonical = `https://packagist.org/search.json?${new URLSearchParams({ q: query, per_page: String(perPage) }).toString()}`
    if (requestUrl !== canonical) return undefined
    return { query, perPage, page: 1 }
  } catch {
    return undefined
  }
}

const canonicalPackageUrl = (value: unknown, packageName: string): string | undefined => {
  const raw = text(value)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.hostname !== 'packagist.org' || url.search || url.hash || url.username || url.password) return undefined
    const prefix = '/packages/'
    if (!url.pathname.startsWith(prefix)) return undefined
    const encodedIdentity = url.pathname.slice(prefix.length).replace(/\/$/, '')
    if (!encodedIdentity) return undefined
    return decodeURIComponent(encodedIdentity) === packageName ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const optionalRepository = (value: unknown): { value?: string; malformed: boolean } => {
  if (value === undefined || value === null) return { malformed: false }
  const raw = text(value)
  if (!raw) return { malformed: typeof value !== 'string' }
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return { malformed: true }
    return { value: url.toString(), malformed: false }
  } catch {
    return { malformed: true }
  }
}

const trustedResult = (value: unknown): PackagistSearchResult | undefined => {
  if (!isRecord(value)) return undefined
  const name = text(value.name)
  if (!name) return undefined
  const packageUrl = canonicalPackageUrl(value.url, name)
  if (!packageUrl) return undefined

  const description = parseOptionalText(value.description)
  const repository = optionalRepository(value.repository)
  const downloads = nonNegativeInteger(value.downloads)
  const favers = nonNegativeInteger(value.favers)
  const downloadsMalformed = downloads === undefined
  const faversMalformed = favers === undefined

  return {
    name,
    description: description.value,
    packageUrl,
    repository: repository.value,
    downloads,
    favers,
    incomplete: description.malformed || repository.malformed || downloadsMalformed || faversMalformed,
  }
}

const nextPageContract = (value: unknown, request: PackagistSearchRequest): boolean => {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'packagist.org' || url.pathname !== '/search.json' || url.hash || url.username || url.password) return false
    const allowed = new Set(['q', 'per_page', 'page'])
    const keys = [...url.searchParams.keys()]
    if (keys.some((key) => !allowed.has(key))) return false
    if (url.searchParams.getAll('q').length !== 1 || url.searchParams.getAll('per_page').length !== 1 || url.searchParams.getAll('page').length !== 1) return false
    const perPage = url.searchParams.get('per_page') ?? ''
    const page = url.searchParams.get('page') ?? ''
    return (url.searchParams.get('q') ?? '').trim() === request.query
      && perPage === String(request.perPage)
      && page === String(request.page + 1)
  } catch {
    return false
  }
}

const invalid = (title: string, detail: string) => <CardEmpty domain="packagist-package-search" title={title} detail={detail} state="invalid"/>

export function PackagistSearchPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  if (!isRecord(data) || !Array.isArray(data.results)) {
    return invalid('Invalid Packagist search response', 'Packagist returned HTTP-success data without the documented results search array.')
  }

  const providerTotal = nonNegativeInteger(data.total)
  if (providerTotal === undefined) {
    return invalid('Invalid Packagist search response', 'Packagist returned HTTP-success data without a trustworthy non-negative total result count.')
  }

  const request = requestedSearch(executedRequest)
  if (executedRequest && !request) {
    return invalid('Invalid Packagist search request identity', 'The successful response is not bound to the exact supported bodyless GET Packagist search request from the catalog SSOT.')
  }

  const providerResults = data.results
  const offset = request ? (request.page - 1) * request.perPage : 0
  const countContractValid = providerTotal >= providerResults.length
    && (!request || (providerResults.length <= request.perPage && providerTotal >= offset + providerResults.length))

  const hasNext = data.next !== undefined && data.next !== null
  const paginationContractValid = request
    ? hasNext
      ? nextPageContract(data.next, request)
      : providerTotal <= offset + providerResults.length
    : !hasNext

  if (providerResults.length === 0) {
    if (request && providerTotal === 0 && countContractValid && paginationContractValid) {
      return <div className="domain-card domain-empty" data-domain-card="packagist-package-search" data-ssot-reference="packagist-search" data-result-state="empty" data-search-query={request.query} data-request-per-page={request.perPage} data-request-page={request.page} data-query-bound="true" data-provider-total="0" data-provider-result-count="0" data-valid-result-count="0" data-invalid-result-count="0" data-incomplete-result-count="0" data-count-contract="true" data-pagination-contract="true"><h3>No Packagist packages matched</h3><p>Packagist returned a valid zero-result search for “{request.query}”.</p></div>
    }
    return invalid('Invalid Packagist empty search response', 'The provider returned no package results without a coherent request-bound zero-result count and pagination contract.')
  }

  const parsed = providerResults.map(trustedResult)
  const trusted = parsed.filter((entry): entry is PackagistSearchResult => Boolean(entry))
  const invalidResultCount = providerResults.length - trusted.length
  if (!trusted.length) {
    return invalid('Invalid Packagist package results', 'None of the returned search records contained a trustworthy package name and matching Packagist package URL identity.')
  }

  const incompleteResultCount = trusted.filter((entry) => entry.incomplete).length
  const state = request && countContractValid && paginationContractValid && invalidResultCount === 0 && incompleteResultCount === 0 ? 'ready' : 'partial'
  const partialReason = !request
    ? 'The provider package records are internally identifiable, but executed-request identity is unavailable, so they cannot be fully bound to a Packagist search.'
    : !countContractValid
      ? 'Provider result-count metadata is inconsistent with the executed search. Only validated package records are shown.'
      : !paginationContractValid
        ? 'Provider pagination metadata is inconsistent with the executed search. Only validated package records are shown.'
        : invalidResultCount > 0
          ? `${invalidResultCount} malformed provider result${invalidResultCount === 1 ? ' was' : 's were'} hidden.`
          : 'One or more package metrics are missing or malformed. Package identity remains trustworthy, but untrusted values are withheld.'

  const cards: SemanticCard[] = trusted.slice(0, 20).map((entry) => ({
    title: entry.name,
    eyebrow: 'Composer package · Packagist',
    description: entry.description,
    badge: entry.downloads === undefined ? 'Downloads unavailable' : `${entry.downloads.toLocaleString('en')} downloads`,
    metrics: [
      { label: 'Favourites', value: formatCount(entry.favers) },
      { label: 'Repository', value: entry.repository ?? 'Unavailable' },
      { label: 'Package page', value: entry.packageUrl },
    ],
  }))

  return <div data-domain-card="packagist-package-search" data-ssot-reference="packagist-search" data-result-state={state} data-search-query={request?.query} data-request-per-page={request?.perPage} data-request-page={request?.page} data-query-bound={request ? 'true' : 'false'} data-provider-total={providerTotal} data-provider-result-count={providerResults.length} data-valid-result-count={trusted.length} data-invalid-result-count={invalidResultCount} data-incomplete-result-count={incompleteResultCount} data-count-contract={String(countContractValid)} data-pagination-contract={String(paginationContractValid)}>
    <div className="domain-note"><strong>{request ? `Packagist search · ${request.query}` : 'Packagist package search'}</strong> · {trusted.length.toLocaleString('en')} trusted result{trusted.length === 1 ? '' : 's'} of {providerTotal.toLocaleString('en')} provider matches</div>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <SemanticCards cards={cards} emptyTitle="Packagist package results unavailable"/>
  </div>
}
