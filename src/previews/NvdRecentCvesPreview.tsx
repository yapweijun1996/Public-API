import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { isRecord, nonNegativeInteger, trimmedText } from './semanticValidation'

const CVE_PATTERN = /^CVE-[0-9]{4}-[0-9]{4,}$/
const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const ALLOWED_LOOKBACK_DAYS = new Set([1, 7, 30, 90, 120])
const DAY_MS = 86_400_000

type NvdRecentRequest = { valid: true; start: string; end: string; startMs: number; endMs: number; lookbackDays: number; resultsPerPage: number } | { valid: false }
type RecentCve = { id: string; description: string; published: string; modified: string; modifiedMs: number; status?: string; source?: string; incomplete: boolean }

const exactText = (value: unknown) => {
  const parsed = trimmedText(value)
  return parsed && parsed === value ? parsed : undefined
}

const parseNvdTimestamp = (value: unknown) => {
  const raw = exactText(value)
  if (!raw || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(raw)) return undefined
  const parseable = /(?:Z|[+-]\d{2}:\d{2})$/.test(raw) ? raw : `${raw}Z`
  const epoch = Date.parse(parseable)
  return Number.isFinite(epoch) ? { raw, epoch, date: raw.slice(0, 10) } : undefined
}

const requestIdentity = (executedRequest?: ExecutedRequestContext): NvdRecentRequest | undefined => {
  if (!executedRequest) return undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return { valid: false }
  const requestUrl = executedRequest.url
  try {
    const url = new URL(requestUrl)
    const allowed = new Set(['lastModStartDate', 'lastModEndDate', 'resultsPerPage'])
    const keys = [...url.searchParams.keys()]
    const startRaw = url.searchParams.get('lastModStartDate')
    const endRaw = url.searchParams.get('lastModEndDate')
    const resultsPerPageRaw = url.searchParams.get('resultsPerPage')
    const start = parseNvdTimestamp(startRaw)
    const end = parseNvdTimestamp(endRaw)
    if (url.origin !== 'https://services.nvd.nist.gov' || url.pathname !== '/rest/json/cves/2.0' || url.username || url.password || url.hash
      || keys.length !== 3 || keys.some((key) => !allowed.has(key)) || [...allowed].some((key) => url.searchParams.getAll(key).length !== 1)
      || !startRaw || !endRaw || !start || !end || !resultsPerPageRaw || !/^\d+$/.test(resultsPerPageRaw)) return { valid: false }
    const resultsPerPage = Number(resultsPerPageRaw)
    const lookbackDays = (end.epoch - start.epoch) / DAY_MS
    if (resultsPerPage !== 8 || !Number.isInteger(lookbackDays) || !ALLOWED_LOOKBACK_DAYS.has(lookbackDays)) return { valid: false }
    const canonical = `https://services.nvd.nist.gov/rest/json/cves/2.0?${new URLSearchParams({ lastModStartDate: startRaw, lastModEndDate: endRaw, resultsPerPage: String(resultsPerPage) }).toString()}`
    if (requestUrl !== canonical) return { valid: false }
    return { valid: true, start: startRaw, end: endRaw, startMs: start.epoch, endMs: end.epoch, lookbackDays, resultsPerPage }
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

const optionalText = (value: unknown) => {
  if (value === undefined || value === null) return { malformed: false, value: undefined }
  const parsed = exactText(value)
  return parsed ? { malformed: false, value: parsed } : { malformed: true, value: undefined }
}

const parseCve = (value: unknown): RecentCve | undefined => {
  if (!isRecord(value) || !isRecord(value.cve)) return undefined
  const cve = value.cve
  const id = exactText(cve.id)
  const published = parseNvdTimestamp(cve.published)
  const modified = parseNvdTimestamp(cve.lastModified)
  const descriptions = parseDescriptions(cve.descriptions)
  if (!id || !CVE_PATTERN.test(id) || !published || !modified || !descriptions || !referencesValid(cve.references)) return undefined
  const status = optionalText(cve.vulnStatus)
  const source = optionalText(cve.sourceIdentifier)
  return {
    id, published: published.date, modified: modified.date, modifiedMs: modified.epoch,
    description: descriptions.find(({ lang }) => lang.toLowerCase() === 'en')?.value ?? descriptions[0].value,
    status: status.value, source: source.value, incomplete: status.malformed || source.malformed,
  }
}

const invalid = (title: string, detail: string, request?: Extract<NvdRecentRequest, { valid: true }>, evidence: Record<string, string | number | undefined> = {}) => <div
  className="domain-card domain-empty" data-domain-card="nvd-recent-cves" data-result-state="invalid"
  data-request-bound={request ? 'true' : 'false'} data-request-window-start={request?.start} data-request-window-end={request?.end}
  data-lookback-days={request?.lookbackDays} data-envelope-contract={evidence['data-envelope-contract'] ?? 'false'} data-filter-contract={evidence['data-filter-contract'] ?? 'false'} {...evidence}
><h3>{title}</h3><p>{detail}</p></div>

export function NvdRecentCvesPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const request = requestIdentity(executedRequest)
  if (request && !request.valid) return invalid('Invalid NVD recently modified request', 'The executed URL is not the supported bounded NVD last-modified-window request.')
  const boundRequest = request?.valid ? request : undefined
  if (!isRecord(data)) return invalid('Invalid NVD recently modified response', 'NVD returned HTTP-success data without the documented CVE API 2.0 response object.', boundRequest)

  const resultsPerPage = nonNegativeInteger(data.resultsPerPage)
  const startIndex = nonNegativeInteger(data.startIndex)
  const totalResults = nonNegativeInteger(data.totalResults)
  const timestamp = parseNvdTimestamp(data.timestamp)
  const rows = Array.isArray(data.vulnerabilities) ? data.vulnerabilities : undefined
  const envelopeValid = resultsPerPage !== undefined && startIndex !== undefined && totalResults !== undefined
    && data.format === 'NVD_CVE' && data.version === '2.0' && timestamp !== undefined && rows !== undefined
  if (!envelopeValid || !rows) return invalid('Invalid NVD recently modified response', 'The HTTP-success body does not satisfy the required NVD CVE API 2.0 counters, format, version, timestamp, and vulnerabilities array.', boundRequest)

  const returnedCount = rows.length
  const countContract = resultsPerPage === returnedCount && totalResults >= startIndex + returnedCount && startIndex === 0
    && (!boundRequest || (
      returnedCount <= boundRequest.resultsPerPage
      && returnedCount === Math.min(boundRequest.resultsPerPage, totalResults)
    ))
  if (rows.length === 0) {
    if (!boundRequest || totalResults !== 0 || !countContract) return invalid('Invalid NVD recently modified empty response', 'A zero-record HTTP-success response is not a coherent request-bound first page with zero provider matches.', boundRequest, { 'data-envelope-contract': 'true', 'data-count-contract': String(countContract) })
    return <div className="domain-card domain-empty" data-domain-card="nvd-recent-cves" data-result-state="empty" data-request-bound="true"
      data-request-window-start={boundRequest.start} data-request-window-end={boundRequest.end} data-lookback-days={boundRequest.lookbackDays} data-request-results-per-page={boundRequest.resultsPerPage}
      data-provider-results-per-page={resultsPerPage} data-provider-start-index={startIndex} data-provider-record-count="0" data-valid-record-count="0" data-invalid-record-count="0" data-incomplete-record-count="0" data-provider-total-results="0"
      data-envelope-contract="true" data-filter-contract="true" data-count-contract="true">
      <h3>No CVEs modified in this window</h3><p>NVD returned a contract-valid zero-result page for the exact executed last-modified window.</p>
    </div>
  }

  const trusted: RecentCve[] = []
  let invalidRecordCount = 0
  const seen = new Set<string>()
  for (const value of rows) {
    const cve = parseCve(value)
    const withinWindow = Boolean(cve && boundRequest && cve.modifiedMs >= boundRequest.startMs && cve.modifiedMs <= boundRequest.endMs)
    if (!cve || seen.has(cve.id) || (boundRequest && !withinWindow)) { invalidRecordCount += 1; continue }
    seen.add(cve.id); trusted.push(cve)
  }

  const filterContract = Boolean(boundRequest) && invalidRecordCount === 0
  if (!trusted.length) return invalid('Invalid NVD recently modified records', 'None of the returned rows established a unique NVD CVE record inside the exact executed last-modified window.', boundRequest, {
    'data-envelope-contract': 'true', 'data-filter-contract': String(filterContract), 'data-count-contract': String(countContract),
    'data-provider-record-count': rows.length, 'data-valid-record-count': 0, 'data-invalid-record-count': invalidRecordCount,
  })

  const incompleteRecordCount = trusted.filter(({ incomplete }) => incomplete).length
  const state = boundRequest && countContract && filterContract && incompleteRecordCount === 0 ? 'ready' : 'partial'
  const cards: SemanticCard[] = trusted.map((cve) => ({ title: cve.id, eyebrow: 'NVD recently modified CVE', description: cve.description, badge: cve.status ?? 'Status not supplied', metrics: [
    { label: 'Last modified', value: cve.modified }, { label: 'Published', value: cve.published }, { label: 'Source', value: cve.source ?? 'Not supplied' },
  ] }))
  const latestModified = trusted.reduce((latest, cve) => cve.modifiedMs > latest.modifiedMs ? cve : latest)

  return <div className="domain-card" data-domain-card="nvd-recent-cves" data-ssot-reference="nvd-recent-cves" data-result-state={state}
    data-request-bound={boundRequest ? 'true' : 'false'} data-request-window-start={boundRequest?.start} data-request-window-end={boundRequest?.end} data-lookback-days={boundRequest?.lookbackDays} data-request-results-per-page={boundRequest?.resultsPerPage}
    data-provider-results-per-page={resultsPerPage} data-provider-start-index={startIndex} data-provider-total-results={totalResults} data-provider-record-count={rows.length}
    data-valid-record-count={trusted.length} data-invalid-record-count={invalidRecordCount} data-incomplete-record-count={incompleteRecordCount}
    data-envelope-contract="true" data-filter-contract={String(filterContract)} data-count-contract={String(countContract)} data-nvd-format={data.format} data-nvd-version={data.version}
    data-nvd-timestamp={timestamp.raw} data-latest-modified={latestModified.modified}>
    <div className="domain-note"><strong>{boundRequest ? `NVD modified window · last ${boundRequest.lookbackDays} ${boundRequest.lookbackDays === 1 ? 'day' : 'days'}` : 'NVD modified CVEs'}</strong> · {trusted.length.toLocaleString('en')} trusted {trusted.length === 1 ? 'record' : 'records'} from {totalResults.toLocaleString('en')} provider matches</div>
    {state === 'partial' && <p className="domain-note">The page is only partially trusted because request binding, pagination, modified-window matching, or optional CVE metadata was incomplete. Untrusted rows and values are withheld.</p>}
    <SemanticCards cards={cards} emptyTitle="NVD recently modified CVE records unavailable"/>
  </div>
}
