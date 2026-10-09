import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts, text } from './cardPrimitives'

const operationLabels = {
  simplify: 'Simplify',
  factor: 'Factor',
  derive: 'Differentiate',
  zeroes: 'Find zeroes',
} as const

type NewtonOperation = keyof typeof operationLabels
type NewtonRequestIdentity = { operation: NewtonOperation; expression: string }
type BoundNewtonRequest = { request?: NewtonRequestIdentity; transportBound: boolean; invalidReason?: string }

const REQUEST_CONTRACT = 'exact-newton-symbolic-math-v2'

const newtonRequestIdentity = (requestUrl?: string): NewtonRequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'newton.vercel.app' || url.port || url.username || url.password || url.search || url.hash) return undefined
    const match = url.pathname.match(/^\/api\/v2\/([^/]+)\/([^/]+)$/)
    if (!match) return undefined
    const operation = decodeURIComponent(match[1])
    const expression = decodeURIComponent(match[2])
    if (!(operation in operationLabels) || !expression) return undefined
    const canonical = `https://newton.vercel.app/api/v2/${encodeURIComponent(operation)}/${encodeURIComponent(expression)}`
    if (requestUrl !== canonical) return undefined
    return { operation: operation as NewtonOperation, expression }
  } catch {
    return undefined
  }
}

const bindNewtonRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundNewtonRequest => {
  if (!requestUrl) return { transportBound: false }
  const request = newtonRequestIdentity(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported Newton V2 symbolic-math request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Newton V2 symbolic-math request.' }
  }
  const executed = newtonRequestIdentity(executedRequest.url)
  if (!executed || executed.operation !== request.operation || executed.expression !== request.expression) {
    return { request, transportBound: false, invalidReason: 'The displayed Newton request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const resultText = (value: unknown) => {
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' || typeof item === 'number' ? String(item) : JSON.stringify(item)).join(', ')
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return text(value)
}

const invalidCard = ({
  title,
  detail,
  request,
  providerOperation,
  providerExpression,
  identityMatch,
  requestBound = false,
}: {
  title: string
  detail: string
  request?: NewtonRequestIdentity
  providerOperation?: string
  providerExpression?: string
  identityMatch?: boolean
  requestBound?: boolean
}) => <div
  className="domain-card domain-empty newton-math-preview"
  data-domain-card="symbolic-math"
  data-result-state="invalid"
  data-request-bound={requestBound ? 'true' : 'false'}
  data-request-contract={REQUEST_CONTRACT}
  data-requested-operation={request?.operation ?? ''}
  data-requested-expression={request?.expression ?? ''}
  data-provider-operation={providerOperation ?? ''}
  data-provider-expression={providerExpression ?? ''}
  data-identity-match={identityMatch === undefined ? '' : identityMatch ? 'true' : 'false'}
  data-contract-valid="false"
><h3>{title}</h3><p>{detail}</p></div>

export function NewtonMathPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const binding = bindNewtonRequest(requestUrl, executedRequest)
  const request = binding.request
  if (binding.invalidReason) {
    return invalidCard({ title: 'Invalid Newton request identity', detail: binding.invalidReason, request, requestBound: false })
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return invalidCard({ title: 'Math result unavailable', detail: 'Newton did not return the documented JSON object response.', request, requestBound: binding.transportBound })
  }
  const root = data as Record<string, unknown>
  const operation = text(root.operation)
  const expression = text(root.expression)
  const result = resultText(root.result)
  if (!operation || !expression || !result) {
    return invalidCard({ title: 'Math result unavailable', detail: 'Newton did not return the expected operation, expression, and result fields for this request.', request, providerOperation: operation, providerExpression: expression, requestBound: binding.transportBound })
  }

  const identityMatch = request ? operation === request.operation && expression === request.expression : undefined
  if (identityMatch === false) {
    return invalidCard({ title: 'Newton response identity mismatch', detail: 'The HTTP-success response operation or expression does not match the executed symbolic-math request, so its result is not shown.', request, providerOperation: operation, providerExpression: expression, identityMatch, requestBound: binding.transportBound })
  }

  const operationLabel = operationLabels[operation as NewtonOperation] ?? operation
  const zeroCount = operation === 'zeroes' && Array.isArray(root.result) ? root.result.length : undefined
  const resultState = binding.transportBound ? 'ready' : 'partial'

  return <div
    className="domain-card newton-math-preview"
    data-domain-card="symbolic-math"
    data-result-state={resultState}
    data-request-bound={binding.transportBound ? 'true' : 'false'}
    data-request-contract={REQUEST_CONTRACT}
    data-requested-operation={request?.operation ?? ''}
    data-requested-expression={request?.expression ?? ''}
    data-provider-operation={operation}
    data-provider-expression={expression}
    data-identity-match={identityMatch === undefined ? '' : 'true'}
    data-contract-valid="true"
    data-operation={operation}
    data-expression={expression}
    data-result={result}
  >
    <CardHeading eyebrow="Newton API · symbolic arithmetic" title={`${operationLabel} result`} description="The provider-returned expression and symbolic result are kept explicit so humans and browser agents can distinguish the requested operation from its output."><span className="domain-state">{binding.transportBound ? 'V2 request verified' : 'V2 result · executed request unavailable'}</span></CardHeading>
    {!binding.transportBound && <p className="domain-note">The provider fields are usable, but exact executed-request evidence is unavailable, so this result cannot be claimed as request-bound.</p>}
    <Facts items={[
      { label: 'Operation', value: operationLabel },
      { label: 'Input expression', value: <code>{expression}</code> },
      { label: 'Result', value: <code>{result}</code> },
      ...(zeroCount === undefined ? [] : [{ label: 'Zeroes returned', value: String(zeroCount) }]),
    ]}/>
    <p className="domain-note">Newton is a community-maintained symbolic math service. Public-API calls the current Vercel deployment directly and keeps this demo marked Review rather than treating it as a guaranteed-uptime dependency.</p>
  </div>
}
