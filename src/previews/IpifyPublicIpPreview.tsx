import { asRecord, CardEmpty, CardHeading, CopyValue, Facts, text } from './cardPrimitives'

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
  } catch {
    return undefined
  }
}

export function IpifyPublicIpPreview({ data }: { data: unknown }) {
  const root = asRecord(data)
  const providerIp = text(root.ip)?.trim()
  const identity = parseIp(providerIp)
  if (!providerIp || !identity) {
    return <CardEmpty domain="public-ip" title="Invalid public IP response" detail="ipify returned HTTP-success data without a valid IPv4 or IPv6 address in the documented ip field." state="invalid"/>
  }

  const family = identity.family
  return <div className="domain-card ipify-public-ip-preview" data-domain-card="public-ip" data-result-state="ready" data-ip-family={family} data-public-ip={providerIp}>
    <CardHeading eyebrow="ipify · universal IPv4/IPv6 endpoint" title="Public network address" description="The address below is the public IP observed by ipify for this browser request. It is network identity only; this endpoint does not provide geolocation."><span className="domain-state">{family}</span></CardHeading>
    <Facts items={[
      { label: 'Public IP address', value: <code>{providerIp}</code> },
      { label: 'Address family', value: family },
      { label: 'Observation', value: 'Seen by the ipify request endpoint' },
    ]}/>
    <CopyValue label="public IP address" value={providerIp}/>
    <p className="domain-note">The value may identify a shared NAT, VPN, proxy, or other egress network rather than a specific device. Use a geolocation service only when location data is actually required.</p>
  </div>
}
