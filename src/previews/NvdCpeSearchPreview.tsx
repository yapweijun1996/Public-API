import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { isRecord, nonNegativeInteger, trimmedText } from './semanticValidation'

type NvdCpeRequest = { valid: true; keyword: string; resultsPerPage: number } | { valid: false }
type CpeTitle = { title: string; lang: string }
type CpeProduct = {
  cpeName: string
  cpeNameId: string
  deprecated: boolean
  created: string
  lastModified: string
  titles: CpeTitle[]
  incomplete: boolean
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CPE_NAME_PATTERN = /^cpe:2\.3:[aho]:/i
const REFERENCE_TYPES = new Set(['Advisory', 'Change Log', 'Product', 'Project', 'Vendor', 'Version'])

const nvdTimestamp = (value: unknown): string | undefined => {
  const parsed = trimmedText(value)
  if (!parsed || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(parsed)) return undefined
  const parseable = /(?:Z|[+-]\d{2}:\d{2})$/.test(parsed) ? parsed : `${parsed}Z`
  return Number.isFinite(Date.parse(parseable)) ? parsed : undefined
}

const requestIdentity = (executedRequest?: ExecutedRequestContext): NvdCpeRequest | undefined => {
  if (!executedRequest) return undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return { valid: false }
  const requestUrl = executedRequest.url
  try {
    const url = new URL(requestUrl)
    const allowed = new Set(['keywordSearch', 'resultsPerPage'])
    const keys = [...url.searchParams.keys()]
    const keyword = url.searchParams.get('keywordSearch')
    const resultsPerPageText = url.searchParams.get('resultsPerPage')
    if (
      url.protocol !== 'https:'
      || url.origin !== 'https://services.nvd.nist.gov'
      || url.pathname !== '/rest/json/cpes/2.0'
      || url.username
      || url.password
      || url.hash
      || keys.some((key) => !allowed.has(key))
      || [...allowed].some((key) => url.searchParams.getAll(key).length !== 1)
      || !keyword
      || keyword !== keyword.trim()
      || !resultsPerPageText
      || !/^\d+$/.test(resultsPerPageText)
    ) return { valid: false }
    const resultsPerPage = Number(resultsPerPageText)
    if (!Number.isInteger(resultsPerPage) || resultsPerPage < 1 || resultsPerPage > 20) return { valid: false }
    const canonical = `https://services.nvd.nist.gov/rest/json/cpes/2.0?${new URLSearchParams({ keywordSearch: keyword, resultsPerPage: String(resultsPerPage) }).toString()}`
    if (requestUrl !== canonical) return { valid: false }
    return { valid: true, keyword, resultsPerPage }
  } catch {
    return { valid: false }
  }
}

const normalizedSearchText = (value: string) => value
  .toLocaleLowerCase('en-US')
  .replace(/\\(.)/g, '$1')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const matchesKeyword = (cpeName: string, keyword: string) => {
  const cpeText = normalizedSearchText(cpeName)
  const queryTokens = normalizedSearchText(keyword).split(' ').filter(Boolean)
  return queryTokens.length > 0 && queryTokens.every((token) => cpeText.includes(token))
}

const optionalArrayShape = (value: unknown, validate: (item: unknown) => boolean) => {
  if (value === undefined) return true
  return Array.isArray(value) && value.every(validate)
}

const parseProduct = (value: unknown): CpeProduct | undefined => {
  if (!isRecord(value) || !isRecord(value.cpe)) return undefined
  const cpe = value.cpe
  const cpeName = trimmedText(cpe.cpeName)
  const cpeNameId = trimmedText(cpe.cpeNameId)
  const created = nvdTimestamp(cpe.created)
  const lastModified = nvdTimestamp(cpe.lastModified)
  if (
    !cpeName
    || !CPE_NAME_PATTERN.test(cpeName)
    || !cpeNameId
    || !UUID_PATTERN.test(cpeNameId)
    || typeof cpe.deprecated !== 'boolean'
    || !created
    || !lastModified
  ) return undefined

  const titles: CpeTitle[] = []
  let incomplete = false
  if (cpe.titles !== undefined) {
    if (!Array.isArray(cpe.titles)) incomplete = true
    else {
      for (const value of cpe.titles) {
        if (!isRecord(value)) { incomplete = true; continue }
        const title = trimmedText(value.title)
        const lang = trimmedText(value.lang)
        if (!title || !lang) { incomplete = true; continue }
        titles.push({ title, lang })
      }
    }
  }

  const refsValid = optionalArrayShape(cpe.refs, (item) => {
    if (!isRecord(item) || !trimmedText(item.ref)) return false
    return item.type === undefined || (typeof item.type === 'string' && REFERENCE_TYPES.has(item.type))
  })
  const relatedNamesValid = (item: unknown) => isRecord(item)
    && (item.cpeName === undefined || Boolean(trimmedText(item.cpeName)))
    && (item.cpeNameId === undefined || (typeof item.cpeNameId === 'string' && UUID_PATTERN.test(item.cpeNameId)))
  if (!refsValid || !optionalArrayShape(cpe.deprecatedBy, relatedNamesValid) || !optionalArrayShape(cpe.deprecates, relatedNamesValid)) incomplete = true

  return { cpeName, cpeNameId, deprecated: cpe.deprecated, created, lastModified, titles, incomplete }
}

const invalid = (title: string, detail: string, request?: Extract<NvdCpeRequest, { valid: true }>) => <div
  className="domain-card domain-empty"
  data-domain-card="nvd-cpe-search"
  data-result-state="invalid"
  data-requested-keyword={request?.keyword}
  data-request-results-per-page={request?.resultsPerPage}
  data-request-bound={request ? 'true' : 'false'}
  data-envelope-contract="false"
>
  <h3>{title}</h3>
  <p>{detail}</p>
</div>

export function NvdCpeSearchPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const request = requestIdentity(executedRequest)
  if (request && !request.valid) return invalid('Invalid NVD CPE request identity', 'The executed URL is not the supported bounded NVD CPE keyword-search request.')

  const boundRequest = request?.valid ? request : undefined
  if (!isRecord(data)) return invalid('Invalid NVD CPE response', 'NVD returned HTTP-success data without the documented CPE API 2.0 response object.', boundRequest)
  const resultsPerPage = nonNegativeInteger(data.resultsPerPage)
  const startIndex = nonNegativeInteger(data.startIndex)
  const totalResults = nonNegativeInteger(data.totalResults)
  const timestamp = nvdTimestamp(data.timestamp)
  if (
    resultsPerPage === undefined
    || startIndex === undefined
    || totalResults === undefined
    || data.format !== 'NVD_CPE'
    || data.version !== '2.0'
    || !timestamp
    || !Array.isArray(data.products)
  ) return invalid('Invalid NVD CPE response envelope', 'The HTTP-success body does not satisfy the required NVD CPE API 2.0 counters, format, version, timestamp, and products array.', boundRequest)

  const returnedCount = data.products.length
  const countContract = resultsPerPage === returnedCount
    && totalResults >= data.products.length
    && startIndex === 0
    && (!boundRequest || (
      returnedCount <= boundRequest.resultsPerPage
      && returnedCount === Math.min(boundRequest.resultsPerPage, totalResults)
    ))

  if (data.products.length === 0) {
    if (!boundRequest || totalResults !== 0 || !countContract) return invalid('Invalid NVD CPE empty response', 'A zero-product HTTP-success response is not a coherent request-bound first page with zero provider matches.', boundRequest)
    return <div className="domain-card domain-empty" data-domain-card="nvd-cpe-search" data-result-state="empty" data-requested-keyword={boundRequest.keyword} data-request-results-per-page={boundRequest.resultsPerPage} data-request-bound="true" data-provider-product-count="0" data-valid-product-count="0" data-invalid-product-count="0" data-incomplete-product-count="0" data-provider-total-results="0" data-envelope-contract="true" data-filter-contract="true" data-count-contract="true"><h3>No matching NVD CPE products</h3><p>NVD returned a contract-valid zero-result CPE page for the executed keyword search.</p></div>
  }

  const trusted: CpeProduct[] = []
  let invalidProductCount = 0
  const seen = new Set<string>()
  for (const value of data.products) {
    const product = parseProduct(value)
    if (!product || seen.has(product.cpeNameId) || (boundRequest && !matchesKeyword(product.cpeName, boundRequest.keyword))) {
      invalidProductCount += 1
      continue
    }
    seen.add(product.cpeNameId)
    trusted.push(product)
  }
  if (!trusted.length) return invalid('Invalid NVD CPE product records', 'None of the returned rows established a unique provider-owned CPE identity matching the executed keyword search.', boundRequest)

  const incompleteProductCount = trusted.filter((product) => product.incomplete).length
  const filterContract = Boolean(boundRequest) && invalidProductCount === 0
  const state = boundRequest && countContract && filterContract && incompleteProductCount === 0 ? 'ready' : 'partial'
  const cards: SemanticCard[] = trusted.map((product) => ({
    title: product.titles.find((title) => title.lang.toLowerCase().startsWith('en'))?.title ?? product.titles[0]?.title ?? product.cpeName,
    eyebrow: 'NVD CPE product identity',
    badge: product.deprecated ? 'Deprecated' : 'Not deprecated',
    metrics: [
      { label: 'CPE name', value: product.cpeName },
      { label: 'CPE name ID', value: product.cpeNameId },
      { label: 'Created', value: product.created.slice(0, 10) },
      { label: 'Modified', value: product.lastModified.slice(0, 10) },
    ],
  }))

  return <div
    className="domain-card"
    data-domain-card="nvd-cpe-search"
    data-ssot-reference="nvd-cpe-search"
    data-result-state={state}
    data-requested-keyword={boundRequest?.keyword}
    data-request-results-per-page={boundRequest?.resultsPerPage}
    data-request-bound={boundRequest ? 'true' : 'false'}
    data-provider-results-per-page={resultsPerPage}
    data-provider-start-index={startIndex}
    data-provider-total-results={totalResults}
    data-provider-product-count={data.products.length}
    data-valid-product-count={trusted.length}
    data-invalid-product-count={invalidProductCount}
    data-incomplete-product-count={incompleteProductCount}
    data-envelope-contract="true"
    data-filter-contract={String(filterContract)}
    data-count-contract={String(countContract)}
    data-nvd-format={data.format}
    data-nvd-version={data.version}
    data-nvd-timestamp={timestamp}
    data-primary-cpe-name={trusted[0].cpeName}
    data-primary-cpe-name-id={trusted[0].cpeNameId}
    data-primary-deprecated={String(trusted[0].deprecated)}
  >
    <div className="domain-note"><strong>{boundRequest ? `NVD CPE search · ${boundRequest.keyword}` : 'NVD CPE products'}</strong> · {trusted.length.toLocaleString('en')} trusted product {trusted.length === 1 ? 'identity' : 'identities'} from {totalResults.toLocaleString('en')} provider matches</div>
    {state === 'partial' && <p className="domain-note">The response is only partially trusted because request binding, pagination, keyword matching, or optional CPE metadata was incomplete. Untrusted rows and values are withheld.</p>}
    <SemanticCards cards={cards} emptyTitle="NVD CPE product records unavailable"/>
  </div>
}
