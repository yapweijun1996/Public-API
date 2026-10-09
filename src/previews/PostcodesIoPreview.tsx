import type { CSSProperties } from 'react'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts } from './cardPrimitives'
import { finiteNumber, isRecord, positiveSafeInteger, trimmedText } from './semanticValidation'

type ResultState = 'ready' | 'partial' | 'invalid'
type PostcodeRequest = { compactPostcode: string }
type GeographyCode = { label: string; value: string }

type PostcodeResult = {
  postcode: string
  compactPostcode: string
  quality: number
  latitude: number
  longitude: number
  country: string
  region?: string
  adminDistrict?: string
  adminWard?: string
  adminCounty?: string
  parliamentaryConstituency?: string
  codes: GeographyCode[]
}

export type PostcodesIoViewModel = {
  state: ResultState
  reason?: string
  requestBound: boolean
  request?: PostcodeRequest
  result?: PostcodeResult
  supplementalMalformedCount: number
}

const EXPECTED_COMPACT_POSTCODE = 'SW1A1AA'

export const normalizeUkPostcode = (value: string) => value.toUpperCase().replace(/\s+/g, '')

export const parsePostcodesIoRequest = (requestUrl?: string): PostcodeRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.origin !== 'https://api.postcodes.io' || url.username || url.password || url.hash || url.search) return undefined
    if (url.pathname !== `/postcodes/${EXPECTED_COMPACT_POSTCODE}`) return undefined
    return { compactPostcode: EXPECTED_COMPACT_POSTCODE }
  } catch { return undefined }
}

const resolvePostcodesIoRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext) => {
  const displayed = parsePostcodesIoRequest(requestUrl)
  if (requestUrl && !displayed) return { request: undefined, valid: false, bound: false } as const
  if (!executedRequest) return { request: displayed, valid: true, bound: false } as const
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined
    || (requestUrl !== undefined && requestUrl !== executedRequest.url)) return { request: undefined, valid: false, bound: false } as const
  const executed = parsePostcodesIoRequest(executedRequest.url)
  return executed ? { request: executed, valid: true, bound: true } as const : { request: undefined, valid: false, bound: false } as const
}

const optionalText = (value: unknown) => {
  if (value === undefined || value === null) return { value: undefined as string | undefined, malformed: false }
  const text = trimmedText(value)
  return { value: text, malformed: text === undefined }
}

const codeFields: Array<[string, string]> = [
  ['admin_district', 'District code'],
  ['admin_ward', 'Ward code'],
  ['parliamentary_constituency', 'Constituency code'],
  ['lsoa', 'LSOA code'],
  ['msoa', 'MSOA code'],
  ['nuts', 'NUTS code'],
  ['nhs_region', 'NHS region code'],
]

export const buildPostcodesIoViewModel = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): PostcodesIoViewModel => {
  const transport = resolvePostcodesIoRequest(requestUrl, executedRequest)
  const request = transport.request
  const base = { requestBound: transport.bound, request, supplementalMalformedCount: 0 }
  if (!transport.valid || !request) return { ...base, state: 'invalid', reason: 'The executed request was not the exact supported bodyless GET Postcodes.io postcode lookup, or it disagreed with the displayed request URL.' }
  if (!isRecord(data) || !Number.isSafeInteger(data.status) || data.status !== 200 || !isRecord(data.result)) {
    return { ...base, state: 'invalid', reason: 'The HTTP-success response did not match the Postcodes.io postcode lookup envelope.' }
  }

  const raw = data.result
  const postcode = trimmedText(raw.postcode)
  const quality = positiveSafeInteger(raw.quality)
  const latitude = finiteNumber(raw.latitude)
  const longitude = finiteNumber(raw.longitude)
  const country = trimmedText(raw.country)
  if (!postcode || normalizeUkPostcode(postcode) !== request.compactPostcode || !quality
    || latitude === undefined || latitude < -90 || latitude > 90
    || longitude === undefined || longitude < -180 || longitude > 180 || !country) {
    return { ...base, state: 'invalid', reason: 'Postcodes.io returned a response whose postcode identity, coordinate, quality, or country evidence did not match the supported contract.' }
  }

  let supplementalMalformedCount = 0
  const optional = {
    region: optionalText(raw.region),
    adminDistrict: optionalText(raw.admin_district),
    adminWard: optionalText(raw.admin_ward),
    adminCounty: optionalText(raw.admin_county),
    parliamentaryConstituency: optionalText(raw.parliamentary_constituency),
  }
  Object.values(optional).forEach((entry) => { if (entry.malformed) supplementalMalformedCount += 1 })

  const codes: GeographyCode[] = []
  if (raw.codes !== undefined && raw.codes !== null) {
    const codesRecord = isRecord(raw.codes) ? raw.codes : undefined
    if (!codesRecord) supplementalMalformedCount += 1
    else codeFields.forEach(([key, label]) => {
      const value = codesRecord[key]
      if (value === undefined || value === null) return
      const text = trimmedText(value)
      if (!text) supplementalMalformedCount += 1
      else codes.push({ label, value: text })
    })
  }

  const result: PostcodeResult = {
    postcode,
    compactPostcode: normalizeUkPostcode(postcode),
    quality,
    latitude,
    longitude,
    country,
    region: optional.region.value,
    adminDistrict: optional.adminDistrict.value,
    adminWard: optional.adminWard.value,
    adminCounty: optional.adminCounty.value,
    parliamentaryConstituency: optional.parliamentaryConstituency.value,
    codes,
  }
  return {
    ...base,
    state: supplementalMalformedCount > 0 || !transport.bound ? 'partial' : 'ready',
    reason: !transport.bound
      ? 'The response is structurally useful, but executed transport identity is unavailable, so it cannot be marked ready.'
      : supplementalMalformedCount > 0
        ? 'Core postcode identity and WGS84 coordinates are valid, but malformed optional administrative evidence was withheld.'
        : undefined,
    supplementalMalformedCount,
    result,
  }
}

const formatCoordinate = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(value)

export function PostcodesIoPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = buildPostcodesIoViewModel(data, requestUrl, executedRequest)
  const result = model.result
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': 'exact-postcodes-io-lookup',
    'data-requested-postcode': model.request?.compactPostcode,
    'data-provider-postcode': result?.postcode,
    'data-postcode-quality': result?.quality,
    'data-latitude': result?.latitude,
    'data-longitude': result?.longitude,
    'data-supplemental-malformed-count': model.supplementalMalformedCount,
    'data-admin-district-code': result?.codes.find((entry) => entry.label === 'District code')?.value,
    'data-admin-ward-code': result?.codes.find((entry) => entry.label === 'Ward code')?.value,
  }
  if (!result) return <div className="domain-card domain-empty postcodes-io-preview" data-domain-card="postcodes-io" {...evidence}><h3>Postcode evidence unavailable</h3><p>{model.reason}</p></div>

  const markerPosition = { '--point-x': '50%', '--point-y': '50%' } as CSSProperties
  const placeLine = [result.adminDistrict, result.adminCounty, result.region, result.country].filter(Boolean).join(' · ')
  return <div className="domain-card postcodes-io-preview" data-domain-card="postcodes-io" {...evidence}>
    <CardHeading eyebrow="Postcodes.io · UK open postcode data" title={result.postcode} description="Request-bound UK postcode location and administrative geography."><span className={`domain-state${model.state === 'partial' ? ' warning' : ''}`}>{model.state === 'partial' ? 'Partial validated profile' : 'Validated profile'}</span></CardHeading>
    {model.state === 'partial' && <p className="domain-note">{model.reason}</p>}
    <Facts items={[
      { label: 'Postcode identity', value: result.postcode },
      { label: 'Country', value: result.country },
      { label: 'Grid-reference quality code', value: result.quality },
      { label: 'Latitude', value: formatCoordinate(result.latitude) },
      { label: 'Longitude', value: formatCoordinate(result.longitude) },
      { label: 'Withheld optional fields', value: model.supplementalMalformedCount },
    ]}/>
    <div className="location-preview postcode-location-preview">
      <div className="location-map" role="img" aria-label={`Map point for postcode ${result.postcode}`}><span className="map-compass">N</span><i style={markerPosition}><b>1</b></i></div>
      <ol aria-label="Validated postcode location"><li data-postcode={result.postcode} data-latitude={result.latitude} data-longitude={result.longitude}><span>1</span><div><strong>{result.postcode}</strong><small>{placeLine || result.country}</small><small>{formatCoordinate(result.latitude)}, {formatCoordinate(result.longitude)}</small></div></li></ol>
    </div>
    <section className="semantic-section" aria-label="Administrative geography"><h4>Administrative geography</h4><dl className="semantic-definition-list">
      {result.adminDistrict && <div><dt>District</dt><dd>{result.adminDistrict}</dd></div>}
      {result.adminWard && <div><dt>Ward</dt><dd>{result.adminWard}</dd></div>}
      {result.parliamentaryConstituency && <div><dt>Parliamentary constituency</dt><dd>{result.parliamentaryConstituency}</dd></div>}
      {result.codes.map((entry) => <div key={entry.label}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}
    </dl></section>
    <p className="domain-note">Postcodes.io serves open UK postcode and administrative geography data from sources including the ONS Postcode Directory and Ordnance Survey Open Names. The quality value is exposed as the provider's grid-reference quality code; this card does not invent a precision meaning for it.</p>
  </div>
}
