import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, DateValue, Facts, isoDate } from './cardPrimitives'
import { isRecord, nonNegativeInteger, positiveInteger, trimmedText } from './semanticValidation'

const CVE_PATTERN = /^CVE-[0-9]{4}-[0-9]{4,}$/

type EpssRequestIdentity = { cve: string; valid: true } | { valid: false }

type EpssRecord = {
  cve: string
  epss: number
  percentile: number
  date: string
}

const epssRequestIdentity = (executedRequest?: ExecutedRequestContext, requestUrl?: string): EpssRequestIdentity | undefined => {
  if (!executedRequest) return undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return { valid: false }
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return { valid: false }
  try {
    const url = new URL(executedRequest.url)
    if (
      url.protocol !== 'https:'
      || url.origin !== 'https://api.first.org'
      || url.pathname !== '/data/v1/epss'
      || url.hash
      || url.username
      || url.password
      || url.searchParams.size !== 1
      || url.searchParams.getAll('cve').length !== 1
    ) return { valid: false }
    const cve = url.searchParams.get('cve') ?? ''
    return CVE_PATTERN.test(cve) ? { cve, valid: true } : { valid: false }
  } catch {
    return { valid: false }
  }
}

const unitIntervalDecimal = (value: unknown) => {
  if (typeof value !== 'string' || value !== value.trim() || !/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(value)) return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : undefined
}

const epssRecord = (value: unknown): EpssRecord | undefined => {
  if (!isRecord(value)) return undefined
  const cve = trimmedText(value.cve)
  const epss = unitIntervalDecimal(value.epss)
  const percentile = unitIntervalDecimal(value.percentile)
  const date = isoDate(value.date)
  if (!cve || !CVE_PATTERN.test(cve) || epss === undefined || percentile === undefined || !date) return undefined
  return { cve, epss, percentile, date }
}

export function firstEpssModel(data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext) {
  const rootValid = isRecord(data)
  const root = rootValid ? data : {}
  const request = epssRequestIdentity(executedRequest, requestUrl)
  const rowsShapeValid = Array.isArray(root.data)
  const providerRows: unknown[] = Array.isArray(root.data) ? root.data : []
  const records = providerRows.flatMap((value) => {
    const parsed = epssRecord(value)
    return parsed ? [parsed] : []
  })
  const statusValid = root.status === 'OK' && root['status-code'] === 200
  const total = nonNegativeInteger(root.total)
  const offset = nonNegativeInteger(root.offset)
  const limit = positiveInteger(root.limit)
  const envelopeValid = rootValid
    && statusValid
    && rowsShapeValid
    && total !== undefined
    && offset === 0
    && limit !== undefined
    && total === providerRows.length
  const recordCountValid = providerRows.length <= 1
  const recordsValid = records.length === providerRows.length
  const providerRecord = records[0]
  const identityMatch = request?.valid && providerRecord
    ? request.cve === providerRecord.cve
    : request?.valid === false
      ? false
      : undefined
  const structuralValid = envelopeValid && recordCountValid && recordsValid
  const contractValid = structuralValid && providerRows.length === 1 && identityMatch === true
  const state = !structuralValid || request?.valid === false || identityMatch === false
    ? 'invalid' as const
    : providerRows.length === 0
      ? request?.valid === true ? 'empty' as const : 'partial' as const
      : identityMatch === true
        ? 'ready' as const
        : 'partial' as const
  return {
    state,
    contractValid,
    envelopeValid,
    recordCountValid,
    recordsValid,
    requestBound: request?.valid === true,
    requestValid: request?.valid !== false,
    requestedCve: request?.valid ? request.cve : undefined,
    providerCve: providerRecord?.cve,
    identityMatch,
    providerRecordCount: providerRows.length,
    total,
    epss: providerRecord?.epss,
    percentile: providerRecord?.percentile,
    date: providerRecord?.date,
  }
}

const formatPercent = (value: number) => new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 5 }).format(value)
const formatScore = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 9, useGrouping: false }).format(value)

export function FirstEpssPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = firstEpssModel(data, requestUrl, executedRequest)
  const evidence = {
    'data-request-bound': String(model.requestBound),
    'data-requested-cve': model.requestedCve,
    'data-provider-cve': model.providerCve,
    'data-identity-match': model.identityMatch === undefined ? undefined : String(model.identityMatch),
    'data-contract-valid': String(model.contractValid),
    'data-provider-record-count': String(model.providerRecordCount),
    'data-epss-probability': model.epss === undefined ? undefined : String(model.epss),
    'data-percentile': model.percentile === undefined ? undefined : String(model.percentile),
    'data-model-date': model.date,
  }

  if (model.state === 'invalid') return <div className="domain-card domain-empty" data-domain-card="epss-risk" data-result-state="invalid" {...evidence}>
    <h3>{model.identityMatch === false && model.providerCve ? 'EPSS response identity mismatch' : 'Invalid EPSS response'}</h3>
    <p>{model.identityMatch === false && model.providerCve
      ? 'The HTTP-success EPSS row does not match the CVE in the executed FIRST request, so its probability and percentile are withheld.'
      : !model.requestValid
        ? 'The executed request URL is not the supported FIRST EPSS single-CVE endpoint.'
        : !model.envelopeValid
          ? 'FIRST did not return the documented successful EPSS response envelope for this single-CVE lookup.'
          : !model.recordCountValid
            ? 'FIRST returned more than one row for a single-CVE lookup, so no arbitrary row is trusted.'
            : 'The EPSS row did not contain a canonical CVE, bounded decimal-string probability and percentile, and valid model date.'}</p>
  </div>

  if (model.state === 'empty') return <div className="domain-card domain-empty" data-domain-card="epss-risk" data-result-state="empty" {...evidence}>
    <h3>No EPSS score returned</h3>
    <p>{model.requestedCve ? `FIRST returned no EPSS row for ${model.requestedCve}.` : 'FIRST returned no EPSS rows for this request.'} No exploitation probability has been inferred.</p>
  </div>

  if (model.state === 'partial' && model.providerRecordCount === 0) return <div className="domain-card domain-empty" data-domain-card="epss-risk" data-result-state="partial" {...evidence}>
    <h3>EPSS request identity unavailable</h3>
    <p>FIRST returned zero rows, but the executed request transport is unavailable, so this response is not trusted as a request-bound no-match result.</p>
  </div>

  if (!model.providerCve || model.epss === undefined || model.percentile === undefined || !model.date) return null

  return <div className="domain-card" data-domain-card="epss-risk" data-result-state={model.state} {...evidence}>
    <CardHeading
      eyebrow="FIRST.org · Exploit Prediction Scoring System"
      title={model.providerCve}
      description="EPSS estimates the probability that a published CVE will be exploited in the wild; percentile shows its relative rank among scored CVEs."
    ><span className="domain-state">{formatPercent(model.epss)} probability</span></CardHeading>
    {model.state === 'partial' && <p className="domain-note">The provider row is structurally valid, but executed-request identity is unavailable, so this result is not marked ready.</p>}
    <Facts items={[
      { label: 'Exploitation probability', value: formatPercent(model.epss) },
      { label: 'EPSS score', value: formatScore(model.epss) },
      { label: 'Percentile', value: formatPercent(model.percentile) },
      { label: 'Model date', value: <DateValue value={model.date}/> },
    ]}/>
    <p className="domain-note">EPSS is a probability estimate, not a guarantee of exploitation. Use it with vulnerability severity, asset exposure, and evidence such as CISA KEV when prioritizing remediation.</p>
  </div>
}
