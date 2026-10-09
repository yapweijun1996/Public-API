import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, numericText, text } from './cardPrimitives'

const yesNo = (value: unknown) => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : 'Not supplied'
const locationText = (city?: string, region?: string, country?: string) => [city, region, country].filter(Boolean).join(', ') || 'Location not supplied'
const coordinateText = (latitude?: number, longitude?: number) => latitude === undefined || longitude === undefined ? 'Not supplied' : `${numericText(latitude)}, ${numericText(longitude)}`

type IpIdentity = { value: string; family: 'IPv4' | 'IPv6' }

const parseIpv4 = (candidate: string): IpIdentity | undefined => {
  const parts = candidate.split('.')
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return undefined
  const octets = parts.map(Number)
  if (octets.some((part) => part < 0 || part > 255)) return undefined
  return { value: octets.join('.'), family: 'IPv4' }
}

const parseIp = (value: unknown): IpIdentity | undefined => {
  const candidate = text(value)?.trim()
  if (!candidate) return undefined
  if (!candidate.includes(':')) return parseIpv4(candidate)
  try {
    const hostname = new URL(`http://[${candidate}]/`).hostname
    if (!hostname.startsWith('[') || !hostname.endsWith(']')) return undefined
    return { value: hostname.slice(1, -1).toLowerCase(), family: 'IPv6' }
  } catch { return undefined }
}

const requestedIp = (requestUrl?: string) => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.hostname !== 'ipwho.is') return undefined
    const raw = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ''))
    return parseIp(raw)
  } catch { return undefined }
}

const providerNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined

export function IpWhoisPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <CardEmpty domain="ip-geolocation" title="Invalid IP geolocation response" detail="ipwho.is returned HTTP-success data without the documented response object." state="invalid"/>
  }

  const root = asRecord(data)
  if (executedRequest && (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && requestUrl !== executedRequest.url))) {
    return <CardEmpty domain="ip-geolocation" title="Invalid IP geolocation request transport" detail="The successful response is not bound to the displayed exact bodyless GET request." state="invalid"/>
  }
  const success = root.success === true
  if (!success) {
    const message = text(root.message) ?? 'The provider did not return a successful IP geolocation result.'
    return <CardEmpty domain="ip-geolocation" title="IP lookup not completed" detail={`ipwho.is returned: ${message}`} state="invalid"/>
  }

  const providerIpText = text(root.ip)
  const providerIp = parseIp(providerIpText)
  if (!providerIp || !providerIpText) {
    return <CardEmpty domain="ip-geolocation" title="Invalid IP geolocation identity" detail="ipwho.is reported success without a valid provider-owned IPv4 or IPv6 query identity." state="invalid"/>
  }

  const providerType = text(root.type)
  if (providerType !== providerIp.family) {
    return <CardEmpty domain="ip-geolocation" title="Invalid IP geolocation identity" detail="ipwho.is returned an IP address type that does not match the provider-owned IP identity." state="invalid"/>
  }

  const requested = executedRequest ? requestedIp(executedRequest.url) : undefined
  if (executedRequest && !requested) {
    return <CardEmpty domain="ip-geolocation" title="Invalid IP geolocation request identity" detail="The executed URL is not one direct ipwho.is IP lookup." state="invalid"/>
  }
  const identityMatch = requested ? requested.value === providerIp.value : undefined
  if (identityMatch === false) {
    return <CardEmpty domain="ip-geolocation" title="IP geolocation identity mismatch" detail="The IP returned by ipwho.is does not match the executed direct lookup, so no location or network details are presented as trustworthy." state="invalid"/>
  }

  const connection = asRecord(root.connection)
  const timezone = asRecord(root.timezone)
  const country = text(root.country)
  const rawCountryCode = text(root.country_code)
  const countryCode = rawCountryCode && /^[A-Z]{2}$/.test(rawCountryCode) ? rawCountryCode : undefined
  const region = text(root.region)
  const regionCode = text(root.region_code)
  const city = text(root.city)
  const rawLatitude = providerNumber(root.latitude)
  const rawLongitude = providerNumber(root.longitude)
  const coordinatesValid = rawLatitude !== undefined && rawLatitude >= -90 && rawLatitude <= 90 && rawLongitude !== undefined && rawLongitude >= -180 && rawLongitude <= 180
  const latitude = coordinatesValid ? rawLatitude : undefined
  const longitude = coordinatesValid ? rawLongitude : undefined
  const timezoneId = text(timezone.id)
  const timezoneUtc = text(timezone.utc)
  const rawAsn = providerNumber(connection.asn)
  const asn = rawAsn !== undefined && Number.isInteger(rawAsn) && rawAsn >= 0 ? rawAsn : undefined
  const organization = text(connection.org)
  const isp = text(connection.isp)
  const networkDomain = text(connection.domain)
  const contextComplete = Boolean(requested && identityMatch && country && countryCode && coordinatesValid && timezoneId && asn !== undefined && (organization || isp))
  const state = contextComplete ? 'ready' : 'partial'

  return <div className="domain-card ipwhois-preview" data-domain-card="ip-geolocation" data-result-state={state} data-requested-ip={requested?.value} data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)} data-primary-ip={providerIpText} data-ip-type={providerType} data-country-code={countryCode} data-region-code={regionCode} data-latitude={latitude} data-longitude={longitude} data-timezone-id={timezoneId} data-asn={asn} data-isp={isp} data-geolocation-basis="approximate-network-derived">
    <CardHeading eyebrow="ipwho.is · IP geolocation" title={providerIpText} description="Approximate network-derived geolocation and network ownership for this IP address. These coordinates are not device GPS or a precise personal address."><span className="domain-state">{state === 'ready' ? `${providerType} identity verified` : 'Partial provider response'}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">The provider-owned IP identity is usable, but {requested ? 'one or more expected geolocation/network fields are unavailable or malformed' : 'request identity is unavailable, so this response cannot be bound to a specific executed lookup'}. Only trustworthy fields are shown.</p>}
    <div className="ipwhois-summary">
      <section aria-labelledby="ipwhois-location-heading">
        <h4 id="ipwhois-location-heading">Approximate location</h4>
        <strong>{locationText(city, region, country)}</strong>
        <Facts items={[
          { label: 'Country code', value: countryCode ?? 'Not supplied' },
          { label: 'Region code', value: regionCode ?? 'Not supplied' },
          { label: 'Coordinates · WGS84 approximate', value: coordinateText(latitude, longitude) },
          { label: 'Postal code', value: text(root.postal) ?? 'Not supplied' },
          { label: 'Timezone', value: timezoneId ?? 'Not supplied' },
          { label: 'UTC offset', value: timezoneUtc ?? 'Not supplied' },
          { label: 'Daylight saving active', value: yesNo(timezone.is_dst) },
        ]}/>
      </section>
      <section aria-labelledby="ipwhois-network-heading">
        <h4 id="ipwhois-network-heading">Network identity</h4>
        <strong>{organization ?? isp ?? 'Network organization not supplied'}</strong>
        <Facts items={[
          { label: 'ASN', value: asn === undefined ? 'Not supplied' : `AS${numericText(asn)}` },
          { label: 'Organization', value: organization ?? 'Not supplied' },
          { label: 'ISP', value: isp ?? 'Not supplied' },
          { label: 'Network domain', value: networkDomain ?? 'Not supplied' },
          { label: 'Continent', value: text(root.continent) ?? 'Not supplied' },
          { label: 'EU-associated country', value: yesNo(root.is_eu) },
        ]}/>
      </section>
    </div>
    <p className="domain-note">The free ipwho.is endpoint allows 1,000 requests per day. For browser CORS traffic, the provider counts requests per domain, so Public-API shares that daily domain quota. IP geolocation is approximate and can reflect routing or network registration rather than a person's physical location.</p>
  </div>
}
