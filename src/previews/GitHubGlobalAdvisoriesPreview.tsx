import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { isRecord, optionalTrimmedText as optionalText, trimmedText as text } from './semanticValidation'

type AdvisoryRequest = { ecosystem: string; severity: string; perPage: number }
type AffectedPackage = { ecosystem: string; name: string }
type Advisory = {
  ghsaId: string
  cveId?: string
  severity: string
  summary: string
  publishedAt: string
  updatedAt: string
  packages: AffectedPackage[]
  incomplete: boolean
}

const SUPPORTED_ECOSYSTEMS = new Set(['npm', 'pip', 'maven', 'nuget', 'rubygems', 'composer', 'go', 'rust'])
const SUPPORTED_SEVERITIES = new Set(['low', 'medium', 'high', 'critical'])
const PROVIDER_SEVERITIES = new Set(['unknown', 'low', 'medium', 'high', 'critical'])

const timestamp = (value: unknown): string | undefined => {
  const candidate = text(value)
  return candidate && /^\d{4}-\d{2}-\d{2}T/.test(candidate) && Number.isFinite(Date.parse(candidate)) ? candidate : undefined
}

const requestIdentity = (executedRequest?: ExecutedRequestContext): AdvisoryRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  const requestUrl = executedRequest.url
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.origin !== 'https://api.github.com' || url.pathname !== '/advisories' || url.hash || url.username || url.password) return undefined
    const allowed = new Set(['ecosystem', 'severity', 'per_page'])
    const keys = [...url.searchParams.keys()]
    if (keys.some((key) => !allowed.has(key))) return undefined
    if ([...allowed].some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    const ecosystem = url.searchParams.get('ecosystem') ?? ''
    const severity = url.searchParams.get('severity') ?? ''
    const perPageText = url.searchParams.get('per_page') ?? ''
    if (!SUPPORTED_ECOSYSTEMS.has(ecosystem) || !SUPPORTED_SEVERITIES.has(severity) || !/^[1-9]\d*$/.test(perPageText)) return undefined
    const perPage = Number(perPageText)
    if (!Number.isInteger(perPage) || perPage < 1 || perPage > 20 || String(perPage) !== perPageText) return undefined
    const canonical = `https://api.github.com/advisories?${new URLSearchParams({ ecosystem, severity, per_page: perPageText }).toString()}`
    if (requestUrl !== canonical) return undefined
    return { ecosystem, severity, perPage }
  } catch {
    return undefined
  }
}

const parsePackages = (value: unknown) => {
  if (!Array.isArray(value)) return { packages: [] as AffectedPackage[], malformed: true }
  const packages: AffectedPackage[] = []
  let malformed = false
  for (const entry of value) {
    if (!isRecord(entry) || !isRecord(entry.package)) { malformed = true; continue }
    const ecosystem = text(entry.package.ecosystem)
    const name = text(entry.package.name)
    if (!ecosystem || !name) { malformed = true; continue }
    packages.push({ ecosystem, name })
  }
  return { packages, malformed }
}

const parseAdvisory = (value: unknown, request?: AdvisoryRequest): Advisory | undefined => {
  if (!isRecord(value)) return undefined
  const ghsaId = text(value.ghsa_id)
  const severity = text(value.severity)
  const summary = text(value.summary)
  const publishedAt = timestamp(value.published_at)
  const updatedAt = timestamp(value.updated_at)
  const type = text(value.type)
  const packages = parsePackages(value.vulnerabilities)
  if (!ghsaId || !severity || !PROVIDER_SEVERITIES.has(severity) || !summary || !publishedAt || !updatedAt || type !== 'reviewed' || !packages.packages.length) return undefined
  if (request && (severity !== request.severity || !packages.packages.some((item) => item.ecosystem === request.ecosystem))) return undefined

  const cveId = optionalText(value.cve_id)
  const description = optionalText(value.description)
  const withdrawnAt = optionalText(value.withdrawn_at)
  return {
    ghsaId,
    cveId: cveId.value,
    severity,
    summary,
    publishedAt,
    updatedAt,
    packages: packages.packages,
    incomplete: packages.malformed || cveId.malformed || description.malformed || withdrawnAt.malformed,
  }
}

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const invalid = (title: string, detail: string) => <CardEmpty domain="github-global-advisories" title={title} detail={detail} state="invalid"/>

export function GitHubGlobalAdvisoriesPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  if (!Array.isArray(data)) return invalid('Invalid GitHub advisory response', 'GitHub returned HTTP-success data without the documented advisory array.')

  const request = requestIdentity(executedRequest)
  if (executedRequest && !request) return invalid('Invalid GitHub advisory request identity', 'The successful response is not bound to the exact supported bodyless GET GitHub global-advisory request with bounded ecosystem, severity, and result-limit filters.')

  if (data.length === 0) {
    if (!request) return invalid('Unbound GitHub advisory empty response', 'A zero-result advisory response cannot be attributed to an ecosystem and severity filter without executed-request identity.')
    return <div className="domain-card domain-empty" data-domain-card="github-global-advisories" data-result-state="empty" data-requested-ecosystem={request.ecosystem} data-requested-severity={request.severity} data-request-per-page={request.perPage} data-request-bound="true" data-provider-result-count="0" data-valid-result-count="0" data-invalid-result-count="0" data-incomplete-result-count="0" data-filter-contract="true" data-count-contract="true"><h3>No matching GitHub advisories</h3><p>GitHub returned a valid zero-result reviewed-advisory list for {request.ecosystem} at {request.severity} severity.</p></div>
  }

  const trusted: Advisory[] = []
  let invalidResultCount = 0
  const seen = new Set<string>()
  for (const value of data) {
    const advisory = parseAdvisory(value, request)
    if (!advisory || seen.has(advisory.ghsaId)) { invalidResultCount += 1; continue }
    seen.add(advisory.ghsaId)
    trusted.push(advisory)
  }
  if (!trusted.length) return invalid('GitHub advisory filters did not match the response', 'None of the returned advisories established a trustworthy reviewed GHSA identity matching the executed ecosystem and severity filters.')

  const incompleteResultCount = trusted.filter((advisory) => advisory.incomplete).length
  const countContract = !request || data.length <= request.perPage
  const filterContract = !request || invalidResultCount === 0
  const state = request && countContract && filterContract && incompleteResultCount === 0 ? 'ready' : 'partial'
  const partialReason = !request
    ? 'Advisories are internally identifiable, but executed-request identity is unavailable, so the ecosystem and severity filters cannot be fully bound.'
    : !countContract
      ? 'GitHub returned more advisories than the executed per-page request. Validated rows are shown, but the response is not fully trusted.'
      : invalidResultCount > 0
        ? `${invalidResultCount} malformed, duplicate, or filter-contradictory advisory ${invalidResultCount === 1 ? 'was' : 'records were'} hidden.`
        : 'One or more optional advisory fields are malformed. Trusted identity and filter facts remain visible while untrusted values are withheld.'

  const cards: SemanticCard[] = trusted.map((advisory) => {
    const matchingPackages = request ? advisory.packages.filter((item) => item.ecosystem === request.ecosystem) : advisory.packages
    return {
      title: advisory.ghsaId,
      eyebrow: advisory.cveId ?? 'GitHub reviewed advisory',
      description: advisory.summary,
      badge: titleCase(advisory.severity),
      metrics: [
        { label: 'Affected packages', value: String(matchingPackages.length) },
        { label: 'Published', value: advisory.publishedAt.slice(0, 10) },
        { label: 'Updated', value: advisory.updatedAt.slice(0, 10) },
      ],
      tags: [...new Set(matchingPackages.map((item) => `${item.ecosystem}:${item.name}`))].slice(0, 5),
    }
  })

  return <div className="domain-card" data-domain-card="github-global-advisories" data-ssot-reference="github-global-advisories" data-result-state={state} data-requested-ecosystem={request?.ecosystem} data-requested-severity={request?.severity} data-request-per-page={request?.perPage} data-request-bound={request ? 'true' : 'false'} data-provider-result-count={data.length} data-valid-result-count={trusted.length} data-invalid-result-count={invalidResultCount} data-incomplete-result-count={incompleteResultCount} data-filter-contract={String(filterContract)} data-count-contract={String(countContract)} data-primary-ghsa-id={trusted[0].ghsaId} data-primary-severity={trusted[0].severity}>
    <div className="domain-note"><strong>{request ? `GitHub advisories · ${request.ecosystem} · ${request.severity}` : 'GitHub global advisories'}</strong> · {trusted.length.toLocaleString('en')} trusted reviewed advisor{trusted.length === 1 ? 'y' : 'ies'}</div>
    {state === 'partial' && <p className="domain-note">{partialReason}</p>}
    <SemanticCards cards={cards} emptyTitle="GitHub advisory records unavailable"/>
  </div>
}
