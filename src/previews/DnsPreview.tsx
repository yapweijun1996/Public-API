import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, Facts, text } from './cardPrimitives'
import { nonNegativeSafeInteger, positiveSafeInteger } from './semanticValidation'

// DNS wire codes, not provider-health verdicts. Unknown codes remain visible.
const dnsTypes: Record<number, string> = { 1: 'A · IPv4', 2: 'NS · Name server', 5: 'CNAME · Alias', 6: 'SOA · Authority', 15: 'MX · Mail', 16: 'TXT · Text', 28: 'AAAA · IPv6', 33: 'SRV · Service', 43: 'DS', 46: 'RRSIG', 48: 'DNSKEY', 65: 'HTTPS', 257: 'CAA' }
const dnsTypeCodes: Record<string, number> = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28 }
const dnsCodes: Record<number, string> = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' }
const typeLabel = (code: number | undefined) => code === undefined ? 'Type not supplied' : dnsTypes[code] ?? `TYPE ${code}`
const normalizeDnsName = (value: string) => value.trim().replace(/\.$/, '').toLowerCase()

type DnsRequestIdentity = { name: string; normalizedName: string; typeCode: number; type: string }
type DnsQuestion = { name: string; typeCode: number }
type DnsAnswer = { name: string; typeCode: number; value: string; ttl: number }

const requestedDns = (requestUrl?: string): DnsRequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    const rawName = url.searchParams.get('name')
    const rawTypeValue = url.searchParams.get('type')
    if (url.protocol !== 'https:' || url.hostname !== 'dns.google' || url.port || url.pathname !== '/resolve' || url.hash) return undefined
    if (keys.length !== 2 || keys.some((key) => key !== 'name' && key !== 'type')) return undefined
    if (url.searchParams.getAll('name').length !== 1 || url.searchParams.getAll('type').length !== 1) return undefined
    if (!rawName || rawName !== rawName.trim() || !rawTypeValue || rawTypeValue !== rawTypeValue.trim()) return undefined
    const rawType = rawTypeValue.toUpperCase()
    const typeCode = dnsTypeCodes[rawType]
    if (typeCode === undefined) return undefined
    return { name: rawName, normalizedName: normalizeDnsName(rawName), typeCode, type: rawType }
  } catch {
    return undefined
  }
}


const dnsQuestion = (value: unknown): DnsQuestion | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const row = asRecord(value)
  const name = text(row.name)
  const typeCode = positiveSafeInteger(row.type)
  if (!name || typeCode === undefined || typeCode > 65535) return undefined
  return { name, typeCode }
}

const dnsAnswer = (value: unknown): DnsAnswer | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const row = asRecord(value)
  const name = text(row.name)
  const typeCode = positiveSafeInteger(row.type)
  const valueText = text(row.data)
  const ttl = nonNegativeSafeInteger(row.TTL)
  if (!name || typeCode === undefined || typeCode > 65535 || !valueText || ttl === undefined) return undefined
  return { name, typeCode, value: valueText, ttl }
}

const executedDnsRequest = (executedRequest?: ExecutedRequestContext, requestUrl?: string) => {
  if (!executedRequest) return { request: undefined, valid: true, bound: false } as const
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return { request: undefined, valid: false, bound: false } as const
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return { request: undefined, valid: false, bound: false } as const
  const request = requestedDns(executedRequest.url)
  return request ? { request, valid: true, bound: true } as const : { request: undefined, valid: false, bound: false } as const
}

export function dnsModel(data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext) {
  const transport = executedDnsRequest(executedRequest, requestUrl)
  const request = transport.request
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { request, state: 'invalid' as const, invalidReason: 'Google Public DNS returned HTTP-success data without the documented JSON response object.', answers: [] as DnsAnswer[] }
  }

  const root = asRecord(data)
  const code = nonNegativeSafeInteger(root.Status)
  const status = code === undefined ? 'Status not supplied' : dnsCodes[code] ?? `RCODE ${code}`
  const questionArray = Array.isArray(root.Question) ? root.Question : undefined
  const question = questionArray?.length === 1 ? dnsQuestion(questionArray[0]) : undefined
  const identityMatch = request && question ? normalizeDnsName(question.name) === request.normalizedName && question.typeCode === request.typeCode : request ? false : undefined

  const answerShapeValid = root.Answer === undefined || Array.isArray(root.Answer)
  const providerAnswers = Array.isArray(root.Answer) ? root.Answer : []
  const answers = providerAnswers.map(dnsAnswer).filter((answer): answer is DnsAnswer => Boolean(answer))
  const invalidAnswerCount = providerAnswers.length - answers.length
  const dnssec = root.AD === true ? 'Validated by resolver' : root.AD === false ? 'Not validated by resolver' : 'Not supplied'
  const truncated = root.TC === true ? true : root.TC === false ? false : undefined
  const comment = text(root.Comment)

  let invalidReason: string | undefined
  if (!transport.valid) invalidReason = 'The executed request is not the supported bodyless GET Google Public DNS request, or it disagrees with the displayed request URL.'
  else if (code === undefined) invalidReason = 'The DNS response does not contain a valid integer Status/RCODE.'
  else if (!questionArray) invalidReason = 'The DNS response does not contain the documented Question array.'
  else if (questionArray.length !== 1 || !question) invalidReason = 'The DNS response does not contain exactly one usable provider Question record for this single-name lookup.'
  else if (request && identityMatch !== true) invalidReason = 'The provider Question identity does not match the requested DNS name and record type.'
  else if (!answerShapeValid) invalidReason = 'The DNS response contains Answer data in an undocumented non-array shape.'
  else if (providerAnswers.length > 0 && answers.length === 0) invalidReason = 'The DNS response contains answer records, but none has a usable provider name, type, TTL, and data value.'

  const state = invalidReason
    ? 'invalid'
    : !transport.bound
      ? 'partial'
      : code !== 0
        ? 'dns-error'
        : answers.length === 0
          ? 'empty'
          : invalidAnswerCount > 0
            ? 'partial'
            : 'ready'

  return {
    request,
    requestBound: transport.bound,
    requestValid: transport.valid,
    code,
    status,
    question,
    identityMatch,
    answers,
    providerAnswerCount: providerAnswers.length,
    invalidAnswerCount,
    dnssec,
    truncated,
    comment,
    state,
    invalidReason,
  }
}

export function DnsPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = dnsModel(data, requestUrl, executedRequest)
  const requestName = model.request?.name
  const requestType = model.request?.type
  const questionName = 'question' in model ? model.question?.name : undefined
  const questionTypeCode = 'question' in model ? model.question?.typeCode : undefined
  const identityMatch = 'identityMatch' in model ? model.identityMatch : undefined
  const providerAnswerCount = 'providerAnswerCount' in model ? (model.providerAnswerCount ?? 0) : 0
  const invalidAnswerCount = 'invalidAnswerCount' in model ? (model.invalidAnswerCount ?? 0) : 0

  if (model.state === 'invalid') {
    return <div
      className="domain-card domain-empty"
      data-domain-card="dns-records"
      data-result-state="invalid"
      data-request-bound={String(model.requestBound)}
      data-requested-dns-name={requestName}
      data-requested-dns-type={requestType}
      data-question-name={questionName}
      data-question-type={questionTypeCode}
      data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)}
      data-provider-answer-count={providerAnswerCount}
      data-valid-answer-count={model.answers.length}
      data-invalid-answer-count={invalidAnswerCount}
    >
      <h3>Invalid DNS response</h3>
      <p>{model.invalidReason}</p>
    </div>
  }

  const completeness = model.truncated === true ? 'Truncated by resolver' : model.truncated === false ? 'No truncation reported' : 'Truncation flag not supplied'
  return <div
    className="domain-card dns-workbench"
    data-domain-card="dns-records"
    data-result-state={model.state}
    data-request-bound={String(model.requestBound)}
    data-dns-status={model.code}
    data-requested-dns-name={requestName}
    data-requested-dns-type={requestType}
    data-question-name={model.question?.name}
    data-question-type={model.question?.typeCode}
    data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)}
    data-provider-answer-count={providerAnswerCount}
    data-valid-answer-count={model.answers.length}
    data-invalid-answer-count={invalidAnswerCount}
  >
    <CardHeading eyebrow="DNS resolution" title={model.question?.name ?? 'Resolver response'} description={typeLabel(model.question?.typeCode)}>
      <span className={`domain-state ${model.code === 0 ? 'neutral' : 'warning'}`}>{model.status}</span>
    </CardHeading>
    <Facts items={[{ label: 'Answer records', value: model.answers.length }, { label: 'DNSSEC', value: model.dnssec }, { label: 'Response completeness', value: completeness }]}/>
    {invalidAnswerCount > 0 && <p className="domain-notice">{invalidAnswerCount} malformed provider answer {invalidAnswerCount === 1 ? 'record was' : 'records were'} omitted from the trusted result.</p>}
    {!model.answers.length && <p className="domain-notice">{model.code === 3 ? 'The resolver reports that this domain does not exist.' : model.code === 0 ? 'The query completed, but no answer records were returned for this record type.' : 'The DNS query did not return answer records. Check the resolver status above.'}</p>}
    {model.answers.length > 0 && <ol className="dns-records" role="list" aria-label="DNS answer records">{model.answers.map((answer, index) => <li key={`${answer.name}-${answer.typeCode}-${answer.value}-${index}`} data-answer-name={answer.name} data-answer-type={answer.typeCode} data-answer-ttl={answer.ttl}>
      <header><strong>{typeLabel(answer.typeCode)}</strong><span>TTL {answer.ttl} seconds</span></header>
      <code>{answer.value}</code><small>{answer.name}</small>
    </li>)}</ol>}
    {model.comment && <details className="domain-disclosure"><summary>Resolver diagnostic</summary><p>{model.comment}</p></details>}
    <p className="domain-note">TTL is the DNS cache lifetime in seconds. A completed HTTP request does not by itself mean the domain resolved.</p>
  </div>
}
