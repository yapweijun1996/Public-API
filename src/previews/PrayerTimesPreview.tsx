import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, finite, text } from './cardPrimitives'

type PrayerKey = 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha'
type PrayerRequestIdentity = { date: string; method: number; latitude: number; longitude: number }
type BoundPrayerRequest = { request?: PrayerRequestIdentity; transportBound: boolean; invalidReason?: string }

const primarySchedule: Array<{ key: PrayerKey; label: string; kind: string }> = [
  { key: 'Fajr', label: 'Fajr', kind: 'Prayer' },
  { key: 'Sunrise', label: 'Sunrise', kind: 'Solar marker' },
  { key: 'Dhuhr', label: 'Dhuhr', kind: 'Prayer' },
  { key: 'Asr', label: 'Asr', kind: 'Prayer' },
  { key: 'Maghrib', label: 'Maghrib', kind: 'Prayer' },
  { key: 'Isha', label: 'Isha', kind: 'Prayer' },
]
const requiredPrayerKeys: PrayerKey[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

const timeValue = (timings: Record<string, unknown>, key: string) => text(timings[key])
const closeNumber = (left: number, right: number) => Math.abs(left - right) <= 0.000001

const requestedIdentity = (requestUrl?: string): PrayerRequestIdentity | null | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'api.aladhan.com' || url.port || url.hash || url.username || url.password) return null
    const match = url.pathname.match(/^\/v1\/timings\/(\d{2}-\d{2}-\d{4})$/)
    const keys = [...url.searchParams.keys()]
    if (!match || keys.length !== 3 || keys[0] !== 'latitude' || keys[1] !== 'longitude' || keys[2] !== 'method') return null
    const latitudeText = url.searchParams.get('latitude')
    const longitudeText = url.searchParams.get('longitude')
    const methodText = url.searchParams.get('method')
    if (!latitudeText || !longitudeText || !methodText) return null
    const method = Number(methodText)
    const latitude = Number(latitudeText)
    const longitude = Number(longitudeText)
    if (!Number.isInteger(method) || method < 0 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null
    const [day, month, year] = match[1].split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
    const canonical = `https://api.aladhan.com/v1/timings/${match[1]}?${new URLSearchParams({ latitude: latitudeText, longitude: longitudeText, method: methodText }).toString()}`
    return requestUrl === canonical ? { date: match[1], method, latitude, longitude } : null
  } catch {
    return null
  }
}

const bindPrayerRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundPrayerRequest => {
  if (!requestUrl) return { transportBound: false }
  const request = requestedIdentity(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported AlAdhan daily timings request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET AlAdhan daily timings request.' }
  }
  const executed = requestedIdentity(executedRequest.url)
  if (!executed || executed.date !== request.date || executed.method !== request.method || !closeNumber(executed.latitude, request.latitude) || !closeNumber(executed.longitude, request.longitude)) {
    return { request, transportBound: false, invalidReason: 'The displayed AlAdhan request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

export function PrayerTimesPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <CardEmpty domain="prayer-schedule" title="Invalid prayer-times response" detail="AlAdhan did not return the documented response object." state="invalid"/>
  }

  const root = asRecord(data)
  const code = finite(root.code)
  const status = text(root.status)
  const payload = asRecord(root.data)
  if (code !== 200 || status !== 'OK' || !Object.keys(payload).length) {
    return <CardEmpty domain="prayer-schedule" title="Invalid prayer-times response" detail="AlAdhan did not return the documented code 200, status OK, and data envelope." state="invalid"/>
  }

  const binding = bindPrayerRequest(requestUrl, executedRequest)
  const request = binding.request
  if (binding.invalidReason) {
    return <div className="domain-card domain-empty" data-domain-card="prayer-schedule" data-result-state="invalid" data-request-bound="false" data-request-contract="exact-aladhan-daily-timings-v2"><h3>Invalid prayer-times request identity</h3><p>{binding.invalidReason}</p></div>
  }

  const timings = asRecord(payload.timings)
  const date = asRecord(payload.date)
  const gregorian = asRecord(date.gregorian)
  const hijri = asRecord(date.hijri)
  const meta = asRecord(payload.meta)
  const method = asRecord(meta.method)
  const methodId = finite(method.id)
  const methodName = text(method.name)
  const timezone = text(meta.timezone)
  const gregorianDate = text(gregorian.date)
  const hijriDate = text(hijri.date)
  const readableDate = text(date.readable) ?? gregorianDate
  const hijriMonth = text(asRecord(hijri.month).en)
  const hijriYear = text(hijri.year)
  const hijriDesignation = text(asRecord(hijri.designation).abbreviated)
  const latitude = finite(meta.latitude)
  const longitude = finite(meta.longitude)
  const primaryTimes = Object.fromEntries(primarySchedule.map(({ key }) => [key, timeValue(timings, key)])) as Record<PrayerKey, string | undefined>
  const availablePrimary = primarySchedule.filter(({ key }) => primaryTimes[key])
  const availableRequiredPrayerCount = requiredPrayerKeys.filter((key) => primaryTimes[key]).length

  if (!availableRequiredPrayerCount) {
    return <CardEmpty domain="prayer-schedule" title="Invalid prayer-times response" detail="AlAdhan returned the success envelope without any of the five daily prayer timing fields documented for this endpoint." state="invalid"/>
  }

  const dateMatch = request ? gregorianDate === request.date : undefined
  const methodMatch = request ? methodId === request.method : undefined
  const coordinatesMatch = request
    ? latitude !== undefined && longitude !== undefined && closeNumber(latitude, request.latitude) && closeNumber(longitude, request.longitude)
    : undefined
  if (request && (!dateMatch || !methodMatch || !coordinatesMatch)) {
    return <CardEmpty domain="prayer-schedule" title="Prayer-times identity mismatch" detail="AlAdhan returned HTTP-success data whose Gregorian date, calculation method, or coordinates do not match the executed request, so the timings are not presented as trustworthy." state="invalid"/>
  }

  const additional = [
    { label: 'Imsak', value: timeValue(timings, 'Imsak') },
    { label: 'Sunset', value: timeValue(timings, 'Sunset') },
    { label: 'Midnight', value: timeValue(timings, 'Midnight') },
    { label: 'First third', value: timeValue(timings, 'Firstthird') },
    { label: 'Last third', value: timeValue(timings, 'Lastthird') },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value))

  const dateDescription = [
    hijriDate ? `${hijriDate}${hijriDesignation ? ` ${hijriDesignation}` : ''}` : undefined,
    hijriMonth && hijriYear ? `${hijriMonth} ${hijriYear}` : undefined,
  ].filter(Boolean).join(' · ')

  const primaryComplete = availablePrimary.length === primarySchedule.length
  const contextComplete = Boolean(gregorianDate && timezone && methodId !== undefined && latitude !== undefined && longitude !== undefined)
  const identityVerified = Boolean(binding.transportBound && request && dateMatch && methodMatch && coordinatesMatch)
  const resultState = primaryComplete && contextComplete && identityVerified ? 'ready' : 'partial'

  return <div
    className="domain-card prayer-times-preview"
    data-domain-card="prayer-schedule"
    data-result-state={resultState}
    data-provider-code={code}
    data-provider-status={status}
    data-request-bound={String(binding.transportBound)}
    data-request-contract="exact-aladhan-daily-timings-v2"
    data-request-date={request?.date}
    data-request-method={request?.method}
    data-request-latitude={request?.latitude}
    data-request-longitude={request?.longitude}
    data-request-date-match={dateMatch === undefined ? undefined : String(dateMatch)}
    data-request-method-match={methodMatch === undefined ? undefined : String(methodMatch)}
    data-request-coordinates-match={coordinatesMatch === undefined ? undefined : String(coordinatesMatch)}
    data-primary-fajr-time={primaryTimes.Fajr}
    data-primary-dhuhr-time={primaryTimes.Dhuhr}
    data-primary-asr-time={primaryTimes.Asr}
    data-primary-maghrib-time={primaryTimes.Maghrib}
    data-primary-isha-time={primaryTimes.Isha}
    data-gregorian-date={gregorianDate}
    data-hijri-date={hijriDate}
    data-timezone={timezone}
    data-calculation-method-id={methodId}
  >
    <CardHeading
      eyebrow="Daily prayer schedule"
      title={readableDate ?? 'Prayer times'}
      description={dateDescription || 'Prayer timings returned for the selected coordinates.'}
    >
      <span className="domain-state">{resultState === 'ready' ? (methodId === undefined ? 'Request identity verified' : `Method ${methodId} · request verified`) : 'Partial prayer schedule'}</span>
    </CardHeading>

    {resultState === 'partial' && <p className="domain-note">The provider success envelope contains usable prayer timings, but the full displayed schedule, response context, or executed-request identity is incomplete. Missing values remain unavailable rather than being inferred.</p>}

    <ol className="prayer-time-list" aria-label="Daily prayer schedule">
      {availablePrimary.map(({ key, label, kind }, index) => <li key={key} data-prayer={key.toLowerCase()} data-time={primaryTimes[key]}>
        <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <div><strong>{label}</strong><small>{kind}</small></div>
        <time dateTime={primaryTimes[key]}>{primaryTimes[key]}</time>
      </li>)}
    </ol>

    <Facts items={[
      { label: 'Gregorian date', value: gregorianDate ?? 'Not supplied' },
      { label: 'Hijri date', value: hijriDate ? `${hijriDate}${hijriDesignation ? ` ${hijriDesignation}` : ''}` : 'Not supplied' },
      { label: 'Timezone', value: timezone ?? 'Not supplied' },
      { label: 'Calculation method', value: methodName ?? (methodId === undefined ? 'Not supplied' : `Method ${methodId}`) },
      { label: 'Coordinates', value: latitude !== undefined && longitude !== undefined ? `${latitude}, ${longitude}` : 'Not supplied' },
      { label: 'Asr school', value: text(meta.school) ?? 'Not supplied' },
    ]}/>

    {additional.length > 0 && <section className="prayer-extra" aria-labelledby="prayer-extra-heading">
      <h4 id="prayer-extra-heading">Additional timing markers</h4>
      <dl>{additional.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd><time dateTime={value}>{value}</time></dd></div>)}</dl>
    </section>}

    <p className="domain-note">Prayer times are provider-calculated for the selected coordinates and calculation method. AlAdhan documents its Hijri dates as mathematically calculated and notes they can differ from locally adopted dates. Raw JSON retains the complete response, including method parameters and calendar metadata.</p>
  </div>
}
