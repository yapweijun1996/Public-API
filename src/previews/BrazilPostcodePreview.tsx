import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { SemanticCards } from './SemanticCards'
import { isRecord, optionalTrimmedText, trimmedText } from './semanticValidation'

const ORIGIN = 'https://brasilapi.com.br'
const REQUEST_CONTRACT = 'exact-brasilapi-cep-v2-bodyless-get'

type ResultState = 'ready' | 'partial' | 'invalid'
type BrazilPostcodeRequest = { postcode: string }
type BrazilPostcodeViewModel = {
  state: ResultState
  reason?: string
  requestBound: boolean
  requestedPostcode?: string
  providerPostcode?: string
  stateCode?: string
  city?: string
  neighborhood?: string
  street?: string
  service?: string
  timezoneName?: string
  locationType?: string
  latitude?: string
  longitude?: string
  coordinatesValid: boolean
  optionalMalformedCount: number
}

const parseRequestUrl = (api: ApiDemo, requestUrl?: string): BrazilPostcodeRequest | undefined => {
  if (api.id !== 'brasilapi-postcode' || !requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.origin !== ORIGIN || url.username || url.password || url.port || url.search || url.hash) return undefined
    const match = /^\/api\/cep\/v2\/(\d{8})$/.exec(url.pathname)
    if (!match) return undefined
    const postcode = match[1]
    return api.buildUrl({ postcode }) === requestUrl ? { postcode } : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (api: ApiDemo, requestUrl?: string, executedRequest?: ExecutedRequestContext) => {
  const displayed = parseRequestUrl(api, requestUrl)
  if (requestUrl && !displayed) return { request: undefined, valid: false, bound: false } as const
  if (!executedRequest) return { request: displayed, valid: true, bound: false } as const
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
    return { request: displayed, valid: false, bound: false } as const
  }
  const executed = parseRequestUrl(api, executedRequest.url)
  if (!executed || (displayed && displayed.postcode !== executed.postcode)) return { request: executed ?? displayed, valid: false, bound: false } as const
  return { request: executed, valid: true, bound: true } as const
}

const coordinate = (value: unknown, min: number, max: number) => {
  if (value === undefined || value === null || value === '') return { value: undefined, malformed: false }
  if (typeof value !== 'string' || !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) return { value: undefined, malformed: true }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return { value: undefined, malformed: true }
  return { value: value.trim(), malformed: false }
}

export const buildBrazilPostcodeViewModel = (api: ApiDemo, data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): BrazilPostcodeViewModel => {
  const transport = bindRequest(api, requestUrl, executedRequest)
  const requestedPostcode = transport.request?.postcode
  const base = { requestBound: transport.bound, requestedPostcode, coordinatesValid: false, optionalMalformedCount: 0 }
  if (!transport.valid || !requestedPostcode) return { ...base, state: 'invalid', reason: 'The successful response was not bound to the exact supported bodyless GET BrasilAPI CEP v2 request.' }
  if (!isRecord(data)) return { ...base, state: 'invalid', reason: 'BrasilAPI returned an HTTP-success response that was not a CEP object.' }

  const providerPostcode = trimmedText(data.cep)
  const stateCode = trimmedText(data.state)
  const city = trimmedText(data.city)
  const service = trimmedText(data.service)
  if (providerPostcode !== requestedPostcode || !stateCode || !/^[A-Z]{2}$/.test(stateCode) || !city || !service) {
    return { ...base, providerPostcode, stateCode, city, service, state: 'invalid', reason: 'The provider CEP identity or required address fields contradicted the executed request or documented CEP v2 response.' }
  }

  const neighborhood = optionalTrimmedText(data.neighborhood)
  const street = optionalTrimmedText(data.street)
  const timezoneName = optionalTrimmedText(data.timezoneName)
  const location = data.location === undefined || data.location === null ? undefined : isRecord(data.location) ? data.location : null
  const locationType = location && location !== null ? optionalTrimmedText(location.type) : { value: undefined, malformed: location === null }
  const coordinates = location && location !== null && location.coordinates !== undefined && location.coordinates !== null
    ? isRecord(location.coordinates) ? location.coordinates : null
    : undefined
  const latitude = coordinates && coordinates !== null ? coordinate(coordinates.latitude, -90, 90) : { value: undefined, malformed: coordinates === null }
  const longitude = coordinates && coordinates !== null ? coordinate(coordinates.longitude, -180, 180) : { value: undefined, malformed: coordinates === null }
  const coordinatePairComplete = Boolean(latitude.value && longitude.value)
  const coordinatePairPartial = Boolean(latitude.value) !== Boolean(longitude.value)
  const locationTypeMalformed = locationType.malformed || (locationType.value !== undefined && locationType.value !== 'Point')
  const optionalMalformedCount = Number(neighborhood.malformed) + Number(street.malformed) + Number(timezoneName.malformed)
    + Number(location === null) + Number(locationTypeMalformed) + Number(latitude.malformed) + Number(longitude.malformed) + Number(coordinatePairPartial)
  const partial = !transport.bound || optionalMalformedCount > 0

  return {
    ...base,
    providerPostcode,
    stateCode,
    city,
    service,
    neighborhood: neighborhood.value,
    street: street.value,
    timezoneName: timezoneName.value,
    locationType: locationType.value,
    latitude: coordinatePairComplete ? latitude.value : undefined,
    longitude: coordinatePairComplete ? longitude.value : undefined,
    coordinatesValid: coordinatePairComplete && !latitude.malformed && !longitude.malformed,
    optionalMalformedCount,
    state: partial ? 'partial' : 'ready',
    reason: !transport.bound
      ? 'The address payload is structurally usable, but executed-request evidence is unavailable, so it cannot be marked request-bound.'
      : optionalMalformedCount > 0
        ? 'The CEP identity is trusted, but malformed optional address/location evidence was withheld.'
        : undefined,
  }
}

export function BrazilPostcodePreview({ api, data, requestUrl, executedRequest }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildBrazilPostcodeViewModel(api, data, requestUrl, executedRequest)
  const attrs = {
    'data-domain-card': 'brasilapi-postcode',
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': REQUEST_CONTRACT,
    'data-requested-postcode': model.requestedPostcode,
    'data-provider-postcode': model.providerPostcode,
    'data-postcode-match': String(Boolean(model.requestedPostcode && model.providerPostcode === model.requestedPostcode)),
    'data-coordinate-evidence': model.coordinatesValid ? 'valid-pair' : 'unavailable',
    'data-optional-malformed-count': String(model.optionalMalformedCount),
  }

  if (model.state === 'invalid') {
    return <section className="domain-card domain-empty" aria-label="BrasilAPI CEP response evidence" {...attrs}><h3>Brazilian postcode response not trusted</h3><p>{model.reason}</p></section>
  }

  const coordinateText = model.coordinatesValid ? `${model.latitude}, ${model.longitude}` : 'Not supplied'
  return <section aria-label="BrasilAPI CEP response evidence" {...attrs}>
    {model.state === 'partial' && <p className="domain-note">{model.reason}</p>}
    <SemanticCards cards={[{
      title: model.street ?? model.providerPostcode ?? 'Brazilian postcode',
      eyebrow: `CEP ${model.providerPostcode} · ${model.city}`,
      badge: model.stateCode,
      description: [model.neighborhood, model.city, model.stateCode].filter(Boolean).join(' · '),
      metrics: [
        { label: 'City', value: model.city ?? '—' },
        { label: 'Neighbourhood', value: model.neighborhood ?? 'Not supplied' },
        { label: 'Coordinates', value: coordinateText },
        { label: 'Timezone', value: model.timezoneName ?? 'Not supplied' },
        { label: 'Source service', value: model.service ?? '—' },
      ],
      tags: ['Address profile', model.locationType].filter((value): value is string => Boolean(value)),
    }]} emptyTitle="Brazilian postcode unavailable"/>
  </section>
}
