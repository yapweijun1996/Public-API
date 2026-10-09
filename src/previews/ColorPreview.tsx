import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, CopyValue, displayed, Facts, text } from './cardPrimitives'

const canonicalHex = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const clean = value.trim().replace(/^#/, '')
  if (/^[\da-f]{3}$/i.test(clean)) return `#${clean.split('').map((digit) => `${digit}${digit}`).join('')}`.toUpperCase()
  if (/^[\da-f]{6}$/i.test(clean)) return `#${clean.toUpperCase()}`
  return undefined
}

const providerHexValue = (value: unknown) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value.trim()) ? value.trim().toUpperCase() : undefined
const providerHexClean = (value: unknown) => typeof value === 'string' && /^[\da-f]{6}$/i.test(value.trim()) ? value.trim().toUpperCase() : undefined

type ParsedColorRequest = { requestedHex: string; valid: true } | { valid: false }
type ColorRequestIdentity = { requestedHex: string; valid: true; transportBound: boolean } | { valid: false; transportBound: false }

const requestedColor = (requestUrl?: string): ParsedColorRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.origin !== 'https://www.thecolorapi.com' || url.pathname !== '/id' || url.hash || url.username || url.password || url.searchParams.size !== 1 || url.searchParams.getAll('hex').length !== 1) return { valid: false }
    const requestedHex = canonicalHex(url.searchParams.get('hex'))
    return requestedHex ? { requestedHex, valid: true } : { valid: false }
  } catch {
    return { valid: false }
  }
}

const colorRequestIdentity = (requestUrl?: string, executedRequest?: ExecutedRequestContext): ColorRequestIdentity | undefined => {
  const displayedRequest = requestedColor(requestUrl)
  if (requestUrl && (!displayedRequest || !displayedRequest.valid)) return { valid: false, transportBound: false }
  if (!displayedRequest?.valid) return undefined
  if (!executedRequest) return { ...displayedRequest, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return { valid: false, transportBound: false }
  const executed = requestedColor(executedRequest.url)
  if (!executed?.valid || executed.requestedHex !== displayedRequest.requestedHex) return { valid: false, transportBound: false }
  return { ...displayedRequest, transportBound: true }
}

export function colorModel(data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext) {
  const root = asRecord(data)
  const providerHex = asRecord(root.hex)
  const name = asRecord(root.name)
  const value = providerHexValue(providerHex.value)
  const clean = providerHexClean(providerHex.clean)
  const responseValid = Boolean(value && clean && value.slice(1) === clean)
  const request = colorRequestIdentity(requestUrl, executedRequest)
  const requestBound = request?.valid === true && request.transportBound
  const identityMatch = request?.valid && responseValid ? request.requestedHex === value : undefined
  const contractValid = responseValid && requestBound && identityMatch === true
  return {
    hex: responseValid ? value : undefined,
    providerHex: value,
    providerClean: clean,
    requestedHex: request?.valid ? request.requestedHex : undefined,
    requestBound,
    identityMatch,
    responseValid,
    contractValid,
    state: !responseValid || request?.valid === false || identityMatch === false ? 'invalid' as const : requestBound && identityMatch === true ? 'ready' as const : 'partial' as const,
    name: text(name.value),
    match: name.exact_match_name === true ? 'Exact named match' : name.exact_match_name === false ? 'Closest named match' : 'Name match not specified',
    closest: canonicalHex(name.closest_named_hex),
    contrast: canonicalHex(asRecord(root.contrast).value),
    formats: ['rgb', 'hsl', 'hsv', 'cmyk', 'XYZ'].map((key) => ({ label: key.toUpperCase(), value: displayed(asRecord(root[key]).value) })),
  }
}

export function ColorPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = colorModel(data, requestUrl, executedRequest)
  const evidence = {
    'data-requested-hex': model.requestedHex,
    'data-provider-hex': model.providerHex,
    'data-request-bound': String(model.requestBound),
    'data-identity-match': model.identityMatch === undefined ? undefined : String(model.identityMatch),
    'data-contract-valid': String(model.contractValid),
  }
  if (model.state === 'invalid' || !model.hex) return <div className="domain-card domain-empty" data-testid="color-swatch-card" data-domain-card="color-swatch" data-result-state="invalid" {...evidence}>
    <h3>Invalid color response</h3>
    <p>{!model.responseValid ? 'The provider did not return mutually consistent six-digit hex.value and hex.clean fields.' : model.identityMatch === false ? 'The provider color does not match the color in the executed The Color API request.' : 'The successful response was not bound to the exact supported bodyless GET The Color API /id request with one hex parameter.'}</p>
  </div>
  return <div className="domain-card color-workbench" data-testid="color-swatch-card" data-domain-card="color-swatch" data-result-state={model.state} {...evidence}>
    <div className="color-swatch-panel">
      <div className="color-swatch" role="img" aria-label={`Color swatch ${model.hex}`} style={{ backgroundColor: model.hex }}/>
      <div className="color-swatch-caption"><span>Selected color</span><strong>{model.hex}</strong><CopyValue label="HEX" value={model.hex}/></div>
    </div>
    <div className="color-info">
      <CardHeading eyebrow="Color specification" title={model.name ?? model.hex} description={model.match}/>
      {model.state === 'partial' && <p className="domain-note">The provider color is structurally valid, but the executed request identity was unavailable, so this result is not marked ready.</p>}
      {model.closest && model.match === 'Closest named match' && <p className="domain-note">Nearest named color: <code>{model.closest}</code>. The swatch shows your requested color, not the nearest match.</p>}
      <Facts items={model.formats}/>
      {model.contrast && <p className="domain-note">Provider-suggested text color: <code>{model.contrast}</code>. This is not a verified accessibility contrast rating.</p>}
    </div>
  </div>
}
