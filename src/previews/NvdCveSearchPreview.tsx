import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { finiteNumber, isRecord, nonNegativeInteger, optionalTrimmedText, trimmedText } from './semanticValidation'

const CVE_PATTERN = /^CVE-[0-9]{4}-[0-9]{4,}$/
const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const METRIC_TYPES = new Set(['Primary', 'Secondary'])
const SEVERITIES = new Set(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

type NvdCveSearchRequest = { valid: true; keyword: string; resultsPerPage: number } | { valid: false }
type CvssSummary = { version: string; score: number; severity?: string }
type SearchCve = {
  id: string
  description: string
  descriptions: string[]
  published: string
  modified: string
  status?: string
  source?: string
  cvss?: CvssSummary
  incomplete: boolean
}

const exactText = (value: unknown) => {
  const parsed = trimmedText(value)
  return parsed && parsed === value ? parsed : undefined
}

const nvdTimestamp = (value: unknown) => {
  const raw = exactText(value)
  if (!raw || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(raw)) return undefined
  const parseable = /(?:Z|[+-]\d{2}:\d{2})$/.test(raw) ? raw : `${raw}Z`
  return Number.isFinite(Date.parse(parseable)) ? { raw, date: raw.slice(0, 10) } : undefined
}

const requestIdentity = (executedRequest?: ExecutedRequestContext): NvdCveSearchRequest | undefined => {
  if (!executedRequest) return undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return { valid: false }
  const requestUrl = executedRequest.url
  try {
    const url = new URL(requestUrl)
    const allowed = new Set(['keywordSearch', 'resultsPerPage'])
    const keys = [...url.searchParams.keys()]
    const keyword = url.searchParams.get('keywordSearch')
    const resultsPerPageText = url.searchParams.get('resultsPerPage')
    if (url.origin !== 'https://services.nvd.nist.gov' || url.pathname !== '/rest/json/cves/2.0' || url.username || url.password || url.hash
      || keys.length !== 2 || keys.some((key) => !allowed.has(key)) || [...allowed].some((key) => url.searchParams.getAll(key).length !== 1)
      || !keyword || keyword !== keyword.trim() || keyword.length > 100 || !resultsPerPageText || !/^\d+$/.test(resultsPerPageText)) return { valid: false }
    const resultsPerPage = Number(resultsPerPageText)
    if (!Number.isInteger(resultsPerPage) || resultsPerPage < 1 || resultsPerPage > 20) return { valid: false }
    const canonical = `https://services.nvd.nist.gov/rest/json/cves/2.0?${new URLSearchParams({ keywordSearch: keyword, resultsPerPage: String(resultsPerPage) }).toString()}`
    if (requestUrl !== canonical) return { valid: false }
    return { valid: true, keyword, resultsPerPage }
  } catch {
    return { valid: false }
  }
}

const parseDescriptions = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const descriptions: Array<{ lang: string; value: string }> = []
  for (const candidate of value) {
    if (!isRecord(candidate)) return undefined
    const lang = exactText(candidate.lang)
    const description = trimmedText(candidate.value)
    if (!lang || !LANGUAGE_PATTERN.test(lang) || !description) return undefined
    descriptions.push({ lang, value: description })
  }
  return descriptions
}

const referencesValid = (value: unknown) => Array.isArray(value) && value.every((candidate) => {
  if (!isRecord(candidate)) return false
  const url = exactText(candidate.url)
  if (!url) return false
  try { new URL(url); return true } catch { return false }
})

const parseCvss = (value: unknown) => {
  if (value === undefined || value === null) return { valid: true, summary: undefined }
  if (!isRecord(value)) return { valid: false, summary: undefined }
  const candidates: Array<[string, string]> = [
    ['cvssMetricV40', '4.0'],
    ['cvssMetricV31', '3.1'],
    ['cvssMetricV30', '3.0'],
    ['cvssMetricV2', '2.0'],
  ]
  let summary: CvssSummary | undefined
  for (const [key, version] of candidates) {
    const rows = value[key]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) return { valid: false, summary: undefined }
    for (const row of rows) {
      if (!isRecord(row) || !isRecord(row.cvssData) || !exactText(row.source) || !METRIC_TYPES.has(String(row.type))) return { valid: false, summary: undefined }
      const score = finiteNumber(row.cvssData.baseScore)
      const severityValue = version === '2.0' ? row.baseSeverity : row.cvssData.baseSeverity
      const severity = severityValue === undefined ? undefined : exactText(severityValue)
      if (score === undefined || score < 0 || score > 10 || (severity !== undefined && !SEVERITIES.has(severity))) return { valid: false, summary: undefined }
      if (!summary) summary = { version, score, severity }
    }
  }
  return { valid: true, summary }
}

const keywordTokens = (value: string) => value.toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu) ?? []

const matchesKeyword = (descriptions: string[], keyword: string) => {
  const requested = keywordTokens(keyword)
  const supplied = descriptions.flatMap(keywordTokens)
  return requested.length > 0 && requested.every((token) => supplied.some((word) => word.startsWith(token)))
}

const parseCve = (value: unknown): SearchCve | undefined => {
  if (!isRecord(value) || !isRecord(value.cve)) return undefined
  const cve = value.cve
  const id = exactText(cve.id)
  const published = nvdTimestamp(cve.published)
  const modified = nvdTimestamp(cve.lastModified)
  const descriptions = parseDescriptions(cve.descriptions)
  if (!id || !CVE_PATTERN.test(id) || !published || !modified || !descriptions || !referencesValid(cve.references)) return undefined
  const status = optionalTrimmedText(cve.vulnStatus)
  const source = optionalTrimmedText(cve.sourceIdentifier)
  const cvss = parseCvss(cve.metrics)
  return {
    id,
    published: published.date,
    modified: modified.date,
    description: descriptions.find(({ lang }) => lang.toLowerCase() === 'en')?.value ?? descriptions[0].value,
    descriptions: descriptions.map(({ value }) => value),
    status: status.value,
    source: source.value,
    cvss: cvss.summary,
    incomplete: status.malformed || source.malformed || !cvss.valid,
  }
}

const invalid = (
  title: string,
  detail: string,
  request?: Extract<NvdCveSearchRequest, { valid: true }>,
  evidence: Record<string, string | number | undefined> = {},
) => <div
  className="domain-card domain-empty"
  data-domain-card="nvd-cve-search"
  data-result-state="invalid"
  data-requested-keyword={request?.keyword}
  data-request-results-per-page={request?.resultsPerPage}
  data-request-bound={request ? 'true' : 'false'}
  data-envelope-contract={evidence['data-envelope-contract'] ?? 'false'}
  data-filter-contract={evidence['data-filter-contract'] ?? 'false'}
  {...evidence}
><h3>{title}</h3><p>{detail}</p></div>

export function NvdCveSearchPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const request = requestIdentity(executedRequest)
  if (request && !request.valid) return invalid('Invalid NVD CVE search request', 'The executed URL is not the supported bounded NVD CVE keyword-search request.')
  const boundRequest = request?.valid ? request : undefined
  if (!isRecord(data)) return invalid('Invalid NVD CVE search response', 'NVD returned HTTP-success data without the documented CVE API 2.0 response object.', boundRequest)

  const resultsPerPage = nonNegativeInteger(data.resultsPerPage)
  const startIndex = nonNegativeInteger(data.startIndex)
  const totalResults = nonNegativeInteger(data.totalResults)
  const timestamp = nvdTimestamp(data.timestamp)
  const rows = Array.isArray(data.vulnerabilities) ? data.vulnerabilities : undefined
  const envelopeValid = resultsPerPage !== undefined && startIndex !== undefined && totalResults !== undefined
    && data.format === 'NVD_CVE' && data.version === '2.0' && timestamp !== undefined && rows !== undefined
  if (!envelopeValid || !rows) return invalid('Invalid NVD CVE search response', 'The HTTP-success body does not satisfy the required NVD CVE API 2.0 counters, format, version, timestamp, and vulnerabilities array.', boundRequest)

  const countContract = resultsPerPage === rows.length && totalResults >= startIndex + rows.length && startIndex === 0
    && (!boundRequest || (
      rows.length <= boundRequest.resultsPerPage
      && rows.length === Math.min(boundRequest.resultsPerPage, totalResults)
    ))
  if (rows.length === 0) {
    if (!boundRequest || totalResults !== 0 || !countContract) return invalid('Invalid NVD CVE search empty response', 'A zero-record HTTP-success response is not a coherent request-bound first page with zero provider matches.', boundRequest, { 'data-envelope-contract': 'true', 'data-count-contract': String(countContract) })
    return <div className="domain-card domain-empty" data-domain-card="nvd-cve-search" data-result-state="empty"
      data-requested-keyword={boundRequest.keyword} data-request-results-per-page={boundRequest.resultsPerPage} data-request-bound="true"
      data-provider-record-count="0" data-valid-record-count="0" data-invalid-record-count="0" data-incomplete-record-count="0" data-provider-total-results="0"
      data-envelope-contract="true" data-filter-contract="true" data-count-contract="true">
      <h3>No matching NVD CVEs</h3><p>NVD returned a contract-valid zero-result page for the exact executed keyword search.</p>
    </div>
  }

  const trusted: SearchCve[] = []
  let invalidRecordCount = 0
  const seen = new Set<string>()
  for (const value of rows) {
    const cve = parseCve(value)
    if (!cve || seen.has(cve.id) || (boundRequest && !matchesKeyword(cve.descriptions, boundRequest.keyword))) {
      invalidRecordCount += 1
      continue
    }
    seen.add(cve.id)
    trusted.push(cve)
  }
  const filterContract = Boolean(boundRequest) && invalidRecordCount === 0
  if (!trusted.length) return invalid('Invalid NVD CVE search records', 'None of the returned rows established a unique NVD CVE record matching the exact executed keyword search.', boundRequest, {
    'data-envelope-contract': 'true', 'data-filter-contract': String(filterContract), 'data-count-contract': String(countContract),
    'data-provider-record-count': rows.length, 'data-valid-record-count': 0, 'data-invalid-record-count': invalidRecordCount,
  })

  const incompleteRecordCount = trusted.filter(({ incomplete }) => incomplete).length
  const state = boundRequest && countContract && filterContract && incompleteRecordCount === 0 ? 'ready' : 'partial'
  const cards: SemanticCard[] = trusted.map((cve) => ({
    title: cve.id,
    eyebrow: 'NVD keyword-matched CVE',
    description: cve.description,
    badge: cve.status ?? cve.cvss?.severity ?? 'Status not supplied',
    metrics: [
      { label: 'Published', value: cve.published },
      { label: 'Modified', value: cve.modified },
      { label: 'Source', value: cve.source ?? 'Not supplied' },
      { label: cve.cvss ? `CVSS ${cve.cvss.version}` : 'CVSS', value: cve.cvss ? `${cve.cvss.score}${cve.cvss.severity ? ` · ${cve.cvss.severity}` : ''}` : 'Not supplied' },
    ],
  }))

  return <div className="domain-card" data-domain-card="nvd-cve-search" data-ssot-reference="nvd-cves" data-result-state={state}
    data-requested-keyword={boundRequest?.keyword} data-request-results-per-page={boundRequest?.resultsPerPage} data-request-bound={boundRequest ? 'true' : 'false'}
    data-provider-results-per-page={resultsPerPage} data-provider-start-index={startIndex} data-provider-total-results={totalResults} data-provider-record-count={rows.length}
    data-valid-record-count={trusted.length} data-invalid-record-count={invalidRecordCount} data-incomplete-record-count={incompleteRecordCount}
    data-envelope-contract="true" data-filter-contract={String(filterContract)} data-count-contract={String(countContract)} data-nvd-format={data.format} data-nvd-version={data.version}
    data-nvd-timestamp={timestamp.raw} data-primary-cve={trusted[0].id} data-primary-cvss-score={trusted[0].cvss?.score}>
    <div className="domain-note"><strong>{boundRequest ? `NVD CVE search · ${boundRequest.keyword}` : 'NVD CVE search results'}</strong> · {trusted.length.toLocaleString('en')} trusted {trusted.length === 1 ? 'record' : 'records'} from {totalResults.toLocaleString('en')} provider matches</div>
    {state === 'partial' && <p className="domain-note">The page is only partially trusted because request binding, pagination, keyword matching, optional metadata, or CVSS data was incomplete. Untrusted rows and values are withheld.</p>}
    <SemanticCards cards={cards} emptyTitle="NVD CVE search records unavailable"/>
  </div>
}
