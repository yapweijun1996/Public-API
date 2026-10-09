import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, DateValue, Facts, isoDate } from './cardPrimitives'
import { finiteNumber, isRecord, nonNegativeInteger, optionalTrimmedText, trimmedText } from './semanticValidation'

const CVE_PATTERN = /^CVE-[0-9]{4}-[0-9]{4,}$/
const METRIC_TYPES = new Set(['Primary', 'Secondary'])
const SEVERITIES = new Set(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const CVSS_V2_TOKEN = /^(?:AV:[NAL]|AC:[LMH]|Au:[MSN]|[CIA]:[NPC]|E:(?:U|POC|F|H|ND)|RL:(?:OF|TF|W|U|ND)|RC:(?:UC|UR|C|ND)|CDP:(?:N|L|LM|MH|H|ND)|TD:(?:N|L|M|H|ND)|[CIA]R:(?:L|M|H|ND))$/
const CVSS_V31_TOKEN = /^(?:AV:[NALP]|AC:[LH]|PR:[NLH]|UI:[NR]|S:[UC]|[CIA]:[NLH]|E:[XUPFH]|RL:[XOTWU]|RC:[XURC]|[CIA]R:[XLMH]|MAV:[XNALP]|MAC:[XLH]|MPR:[XNLH]|MUI:[XNR]|MS:[XUC]|M[CIA]:[XNLH])$/
const CVSS_V30_TOKEN = /^(?:AV:[NALP]|AC:[LH]|PR:[NLH]|UI:[NR]|S:[UC]|[CIA]:[NLH]|E:[XUPFH]|RL:[XOTWU]|RC:[XURC]|[CIA]R:[XLMH]|MAV:[XNALP]|MAC:[XLH]|MPR:[XNLH]|MUI:[XNR]|MS:[XUC]|M[CIA]:[XNLH])$/
const CVSS_V40_VECTOR = /^CVSS:4\.0\/AV:[NALP]\/AC:[LH]\/AT:[NP]\/PR:[NLH]\/UI:[NPA]\/VC:[HLN]\/VI:[HLN]\/VA:[HLN]\/SC:[HLN]\/SI:[HLN]\/SA:[HLN](?:\/E:[XAPU])?(?:\/CR:[XHML])?(?:\/IR:[XHML])?(?:\/AR:[XHML])?(?:\/MAV:[XNALP])?(?:\/MAC:[XLH])?(?:\/MAT:[XNP])?(?:\/MPR:[XNLH])?(?:\/MUI:[XNPA])?(?:\/MVC:[XNLH])?(?:\/MVI:[XNLH])?(?:\/MVA:[XNLH])?(?:\/MSC:[XNLH])?(?:\/MSI:[XNLHS])?(?:\/MSA:[XNLHS])?(?:\/S:[XNP])?(?:\/AU:[XNY])?(?:\/R:[XAUI])?(?:\/V:[XDC])?(?:\/RE:[XLMH])?(?:\/U:(?:X|Clear|Green|Amber|Red))?$/
const CVSS_V2_BASE_METRICS = ['AV', 'AC', 'Au', 'C', 'I', 'A']
const CVSS_V3_BASE_METRICS = ['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A']

type NvdRequestIdentity = { cve: string; valid: true } | { valid: false }
type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'
type Description = { lang: string; value: string }
type CvssMetric = {
  version: string
  vector: string
  baseScore: number
  severity?: string
  source: string
  type: string
  exploitabilityScore?: number
  impactScore?: number
}

export type NvdCveDetailViewModel = {
  state: ResultState
  requestBound: boolean
  requestValid: boolean
  requestedCve?: string
  providerCve?: string
  identityMatch?: boolean
  envelopeValid: boolean
  coreValid: boolean
  metricValid: boolean
  contractValid: boolean
  format?: string
  version?: string
  timestamp?: string
  status?: string
  source?: string
  description?: Description
  descriptionCount?: number
  publishedDate?: string
  modifiedDate?: string
  metric?: CvssMetric
  metricsPresent: boolean
  referenceCount?: number
  weaknessCount?: number
  configurationCount?: number
  affectedCount?: number
  optionalMalformed: boolean
}

const exactText = (value: unknown) => {
  const parsed = trimmedText(value)
  return parsed && parsed === value ? parsed : undefined
}

const nvdRequestIdentity = (executedRequest?: ExecutedRequestContext): NvdRequestIdentity | undefined => {
  if (!executedRequest) return undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return { valid: false }
  const requestUrl = executedRequest.url
  try {
    const url = new URL(requestUrl)
    const cve = url.searchParams.get('cveId')
    if (
      url.protocol !== 'https:'
      || url.origin !== 'https://services.nvd.nist.gov'
      || url.pathname !== '/rest/json/cves/2.0'
      || url.username
      || url.password
      || url.hash
      || url.searchParams.size !== 1
      || !cve
      || !CVE_PATTERN.test(cve)
      || requestUrl !== `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cve}`
    ) return { valid: false }
    return { cve, valid: true }
  } catch {
    return { valid: false }
  }
}

const nvdTimestamp = (value: unknown) => {
  const parsed = exactText(value)
  if (!parsed || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(parsed)) return undefined
  const calendarDate = isoDate(parsed.slice(0, 10))
  const parseable = /(?:Z|[+-]\d{2}:\d{2})$/.test(parsed) ? parsed : `${parsed}Z`
  if (!calendarDate || !Number.isFinite(Date.parse(parseable))) return undefined
  return { raw: parsed, date: calendarDate }
}

const parseDescriptions = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) return { valid: false as const, values: [] as Description[] }
  const values: Description[] = []
  for (const candidate of value) {
    if (!isRecord(candidate)) return { valid: false as const, values: [] as Description[] }
    const lang = exactText(candidate.lang)
    const description = trimmedText(candidate.value)
    if (!lang || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(lang) || !description) {
      return { valid: false as const, values: [] as Description[] }
    }
    values.push({ lang, value: description })
  }
  return { valid: true as const, values }
}

const parseReferences = (value: unknown) => {
  if (!Array.isArray(value)) return { valid: false as const, count: undefined }
  for (const candidate of value) {
    if (!isRecord(candidate)) return { valid: false as const, count: undefined }
    const url = exactText(candidate.url)
    if (!url) return { valid: false as const, count: undefined }
    try {
      new URL(url)
    } catch {
      return { valid: false as const, count: undefined }
    }
  }
  return { valid: true as const, count: value.length }
}

const optionalArrayCount = (value: unknown) => value === undefined || value === null
  ? { count: undefined, malformed: false }
  : Array.isArray(value) && value.every(isRecord)
    ? { count: value.length, malformed: false }
    : { count: undefined, malformed: true }

const cvssMetricTokensValid = (tokens: string[], tokenPattern: RegExp, requiredBaseMetrics: string[]) => {
  if (tokens.length === 0 || !tokens.every((token) => tokenPattern.test(token))) return false
  const names = tokens.map((token) => token.slice(0, token.indexOf(':')))
  if (new Set(names).size !== names.length) return false
  return requiredBaseMetrics.every((metric) => names.includes(metric))
}

const cvssVectorValid = (vector: string, version: string) => {
  if (version === '4.0') return CVSS_V40_VECTOR.test(vector)
  if (version === '2.0') return cvssMetricTokensValid(vector.split('/'), CVSS_V2_TOKEN, CVSS_V2_BASE_METRICS)
  const [prefix, ...tokens] = vector.split('/')
  const tokenPattern = version === '3.1' ? CVSS_V31_TOKEN : CVSS_V30_TOKEN
  return prefix === `CVSS:${version}` && cvssMetricTokensValid(tokens, tokenPattern, CVSS_V3_BASE_METRICS)
}

const cvssSeverityMatchesScore = (score: number, severity: string) => {
  if (Math.abs(score * 10 - Math.round(score * 10)) > Number.EPSILON * 10) return false
  if (score === 0) return severity === 'NONE'
  if (score <= 3.9) return severity === 'LOW'
  if (score <= 6.9) return severity === 'MEDIUM'
  if (score <= 8.9) return severity === 'HIGH'
  return severity === 'CRITICAL'
}

const boundedOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null) return { value: undefined, malformed: false }
  const parsed = finiteNumber(value)
  return parsed !== undefined && parsed >= 0 && parsed <= 10
    ? { value: parsed, malformed: false }
    : { value: undefined, malformed: true }
}

const parseCvssMetric = (value: unknown, expectedVersion: string): CvssMetric | undefined => {
  if (!isRecord(value) || !isRecord(value.cvssData)) return undefined
  const source = exactText(value.source)
  const type = exactText(value.type)
  const version = exactText(value.cvssData.version)
  const vector = exactText(value.cvssData.vectorString)
  const baseScore = finiteNumber(value.cvssData.baseScore)
  const severitySource = expectedVersion === '2.0' ? value.baseSeverity : value.cvssData.baseSeverity
  const severity = severitySource === undefined ? undefined : exactText(severitySource)
  const exploitability = boundedOptionalNumber(value.exploitabilityScore)
  const impact = boundedOptionalNumber(value.impactScore)
  if (
    !source
    || !type
    || !METRIC_TYPES.has(type)
    || version !== expectedVersion
    || !vector
    || !cvssVectorValid(vector, expectedVersion)
    || baseScore === undefined
    || baseScore < 0
    || baseScore > 10
    || (expectedVersion !== '2.0' && (!severity || !SEVERITIES.has(severity) || !cvssSeverityMatchesScore(baseScore, severity)))
    || exploitability.malformed
    || impact.malformed
  ) return undefined
  return {
    version,
    vector,
    baseScore,
    severity,
    source,
    type,
    exploitabilityScore: exploitability.value,
    impactScore: impact.value,
  }
}

const parseMetrics = (value: unknown) => {
  if (value === undefined || value === null) return { present: false, valid: true, metric: undefined }
  if (!isRecord(value)) return { present: true, valid: false, metric: undefined }
  const candidates: Array<[string, string]> = [
    ['cvssMetricV40', '4.0'],
    ['cvssMetricV31', '3.1'],
    ['cvssMetricV30', '3.0'],
    ['cvssMetricV2', '2.0'],
  ]
  let selected: CvssMetric | undefined
  for (const [key, version] of candidates) {
    const rows = value[key]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) return { present: true, valid: false, metric: undefined }
    const parsed = rows.map((row) => parseCvssMetric(row, version))
    if (parsed.some((metric) => metric === undefined)) return { present: true, valid: false, metric: undefined }
    if (!selected && parsed[0]) selected = parsed[0]
  }
  return { present: true, valid: true, metric: selected }
}

export function nvdCveDetailModel(data: unknown, executedRequest?: ExecutedRequestContext): NvdCveDetailViewModel {
  const rootValid = isRecord(data)
  const root: Record<string, unknown> = rootValid ? data : {}
  const request = nvdRequestIdentity(executedRequest)
  const format = exactText(root.format)
  const version = exactText(root.version)
  const timestamp = nvdTimestamp(root.timestamp)
  const resultsPerPage = nonNegativeInteger(root.resultsPerPage)
  const startIndex = nonNegativeInteger(root.startIndex)
  const totalResults = nonNegativeInteger(root.totalResults)
  const rows = Array.isArray(root.vulnerabilities) ? root.vulnerabilities : undefined
  const envelopeValid = rootValid
    && format === 'NVD_CVE'
    && version === '2.0'
    && timestamp !== undefined
    && resultsPerPage !== undefined
    && startIndex === 0
    && totalResults !== undefined
    && rows !== undefined
    && rows.length <= 1
    && resultsPerPage === rows.length
    && totalResults === rows.length

  const wrapper = rows?.length === 1 && isRecord(rows[0]) ? rows[0] : undefined
  const cve = wrapper && isRecord(wrapper.cve) ? wrapper.cve : undefined
  const providerCve = cve ? exactText(cve.id) : undefined
  const published = cve ? nvdTimestamp(cve.published) : undefined
  const modified = cve ? nvdTimestamp(cve.lastModified) : undefined
  const parsedDescriptions = cve ? parseDescriptions(cve.descriptions) : { valid: false as const, values: [] as Description[] }
  const references = cve ? parseReferences(cve.references) : { valid: false as const, count: undefined }
  const coreValid = Boolean(
    envelopeValid
    && rows?.length === 1
    && wrapper
    && cve
    && providerCve
    && CVE_PATTERN.test(providerCve)
    && published
    && modified
    && parsedDescriptions.valid
    && references.valid,
  )
  const metrics = parseMetrics(cve?.metrics)
  const source = optionalTrimmedText(cve?.sourceIdentifier)
  const status = optionalTrimmedText(cve?.vulnStatus)
  const weaknesses = optionalArrayCount(cve?.weaknesses)
  const configurations = optionalArrayCount(cve?.configurations)
  const affected = optionalArrayCount(cve?.affected)
  const optionalMalformed = source.malformed
    || status.malformed
    || weaknesses.malformed
    || configurations.malformed
    || affected.malformed
  const identityMatch = request?.valid
    ? providerCve !== undefined && request.cve === providerCve
    : request?.valid === false
      ? false
      : undefined
  const empty = envelopeValid && rows?.length === 0
  const state: ResultState = request?.valid === false || !envelopeValid || (!empty && !coreValid) || (!empty && identityMatch === false)
    ? 'invalid'
    : empty && request?.valid
      ? 'empty'
      : empty || identityMatch !== true || !metrics.valid || optionalMalformed
        ? 'partial'
        : 'ready'
  const contractValid = state === 'ready' || state === 'empty'
  const preferredDescription = parsedDescriptions.values.find(({ lang }) => lang.toLowerCase() === 'en')
    ?? parsedDescriptions.values[0]

  return {
    state,
    requestBound: Boolean(executedRequest),
    requestValid: request?.valid !== false,
    requestedCve: request?.valid ? request.cve : undefined,
    providerCve,
    identityMatch,
    envelopeValid,
    coreValid,
    metricValid: metrics.valid,
    contractValid,
    format,
    version,
    timestamp: timestamp?.raw,
    status: status.value,
    source: source.value,
    description: preferredDescription,
    descriptionCount: parsedDescriptions.valid ? parsedDescriptions.values.length : undefined,
    publishedDate: published?.date,
    modifiedDate: modified?.date,
    metric: metrics.metric,
    metricsPresent: metrics.present,
    referenceCount: references.count,
    weaknessCount: weaknesses.count,
    configurationCount: configurations.count,
    affectedCount: affected.count,
    optionalMalformed,
  }
}

const sentenceCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()

export function NvdCveDetailPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const model = nvdCveDetailModel(data, executedRequest)
  const evidence = {
    'data-request-bound': String(model.requestBound),
    'data-request-valid': String(model.requestValid),
    'data-requested-cve': model.requestedCve ?? '',
    'data-provider-cve': model.providerCve ?? '',
    'data-identity-match': model.identityMatch === undefined ? 'unknown' : String(model.identityMatch),
    'data-envelope-contract-valid': String(model.envelopeValid),
    'data-core-contract-valid': String(model.coreValid),
    'data-metric-contract-valid': String(model.metricValid),
    'data-contract-valid': String(model.contractValid),
    'data-nvd-format': model.format,
    'data-nvd-version': model.version,
    'data-cvss-version': model.state === 'invalid' ? undefined : model.metric?.version,
    'data-cvss-base-score': model.state === 'invalid' ? undefined : model.metric?.baseScore,
    'data-description-count': model.state === 'invalid' ? undefined : model.descriptionCount,
    'data-reference-count': model.state === 'invalid' ? undefined : model.referenceCount,
  }

  if (model.state === 'invalid') return <div className="domain-card domain-empty" data-domain-card="nvd-cve-detail" data-result-state="invalid" {...evidence}>
    <h3>{model.identityMatch === false && model.requestValid && model.envelopeValid ? 'NVD CVE identity mismatch' : 'Invalid NVD CVE response'}</h3>
    <p>{model.identityMatch === false && model.requestValid && model.envelopeValid
      ? 'The HTTP-success NVD record does not match the CVE in the exact executed request, so vulnerability details are withheld.'
      : !model.requestValid
        ? 'The executed request is not the exact supported bodyless GET NVD CVE detail request.'
        : !model.envelopeValid
          ? 'NVD did not return a valid single-result CVE API 2.0 envelope with strict numeric counters. Vulnerability details are withheld.'
          : 'NVD did not return a valid CVE core record with a canonical identifier, provider timestamps, descriptions, and references. Vulnerability details are withheld.'}</p>
  </div>

  if (model.state === 'empty') return <div className="domain-card domain-empty" data-domain-card="nvd-cve-detail" data-result-state="empty" {...evidence}>
    <h3>No NVD CVE record found</h3>
    <p>NVD returned a contract-valid empty result for {model.requestedCve}.</p>
  </div>

  if (!model.providerCve) return <div className="domain-card domain-empty" data-domain-card="nvd-cve-detail" data-result-state="partial" {...evidence}>
    <h3>Unbound NVD empty result</h3>
    <p>The response is structurally empty, but the exact executed CVE request is unavailable, so the absence cannot be bound to an identifier.</p>
  </div>

  const cvss = model.metric
  const severity = cvss?.severity ? sentenceCase(cvss.severity) : 'Severity not supplied'
  return <div className="domain-card" data-domain-card="nvd-cve-detail" data-result-state={model.state} {...evidence}>
    <CardHeading
      eyebrow={`NIST NVD · CVE API ${model.version}`}
      title={model.providerCve}
      description={model.description?.value}
    ><span className="domain-state">{model.status ?? 'Status not supplied'}</span></CardHeading>
    {model.identityMatch !== true && <p className="domain-note">The provider record is structurally valid, but executed-request identity is unavailable, so this result is not marked ready.</p>}
    {!model.metricValid && <p className="domain-note">CVSS metrics were present but malformed; score details are withheld.</p>}
    {model.metricValid && !cvss && <p className="domain-note">CVSS metrics were not supplied in this response.</p>}
    {model.optionalMalformed && <p className="domain-note">One or more optional NVD fields were malformed and are withheld.</p>}
    <Facts items={[
      { label: 'NVD status', value: model.status ?? 'Not supplied' },
      { label: 'NVD source', value: model.source ?? 'Not supplied' },
      { label: 'Published', value: <DateValue value={model.publishedDate}/> },
      { label: 'Last modified', value: <DateValue value={model.modifiedDate}/> },
      { label: 'CVSS base score', value: cvss ? `${cvss.baseScore} · ${severity}` : 'Not supplied' },
      { label: 'CVSS version', value: cvss?.version ?? 'Not supplied' },
      { label: 'CVSS source', value: cvss ? `${cvss.type} · ${cvss.source}` : 'Not supplied' },
      { label: 'CVSS vector', value: cvss?.vector ?? 'Not supplied' },
      { label: 'Exploitability score', value: cvss?.exploitabilityScore ?? 'Not supplied' },
      { label: 'Impact score', value: cvss?.impactScore ?? 'Not supplied' },
      { label: 'References', value: model.referenceCount ?? 'Not supplied' },
      { label: 'Weakness groups', value: model.weaknessCount ?? 'Not supplied' },
      { label: 'Configurations', value: model.configurationCount ?? 'Not supplied' },
      { label: 'Affected entries', value: model.affectedCount ?? 'Not supplied' },
    ]}/>
    <p className="domain-note">CVSS source and type are shown because NVD may publish multiple assessments. Confirm affected versions and remediation guidance with the vendor before taking action.</p>
  </div>
}
