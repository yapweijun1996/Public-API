import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { DateList, type DateListItem } from './DateList'
import { isRecord } from './semanticValidation'

const HOLIDAY_TYPES = new Set(['Public', 'Bank', 'School', 'Authorities', 'Optional', 'Observance'])
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const REQUEST_PATH = /^\/api\/v4\/Holidays\/([A-Z]{2})\/(\d{4})$/

export type NagerHolidayRequest = {
  country: string
  year: number
}

type HolidayRecord = {
  date: string
  name: string
  countryCode: string
  nationalHoliday: boolean
  subdivisionCodes: string[]
  holidayTypes: string[]
  identity: string
}

type HolidayResult = {
  holidays: HolidayRecord[]
  providerHolidayCount: number
  malformedHolidayCount: number
  duplicateHolidayCount: number
  nationalHolidayCount: number
  regionalHolidayCount: number
}

const currentYear = () => new Date().getUTCFullYear()

const validCalendarDate = (value: unknown, year: number): value is string => {
  if (typeof value !== 'string' || value !== value.trim()) return false
  const match = value.match(DATE_PATTERN)
  if (!match || Number(match[1]) !== year) return false
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

const strictText = (value: unknown): string | undefined => typeof value === 'string' && value === value.trim() && value.length > 0 ? value : undefined

export const parseNagerHolidayRequest = (executedRequest?: ExecutedRequestContext): NagerHolidayRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.protocol !== 'https:' || url.hostname !== 'nagerholidays.com' || url.port || url.username || url.password || url.search || url.hash) return undefined
    const match = url.pathname.match(REQUEST_PATH)
    if (!match) return undefined
    const year = Number(match[2])
    const minimumYear = currentYear()
    if (!Number.isSafeInteger(year) || String(year) !== match[2] || year < minimumYear || year > minimumYear + 5) return undefined
    return { country: match[1], year }
  } catch {
    return undefined
  }
}

const parseStringArray = (value: unknown, allowed?: Set<string>): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const parsed: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const text = strictText(item)
    if (!text || allowed && !allowed.has(text) || seen.has(text)) return undefined
    seen.add(text)
    parsed.push(text)
  }
  return parsed
}

const parseHoliday = (value: unknown, request: NagerHolidayRequest): HolidayRecord | undefined => {
  if (!isRecord(value)) return undefined
  if (!validCalendarDate(value.date, request.year)) return undefined
  const name = strictText(value.name)
  if (!name || value.countryCode !== request.country || typeof value.nationalHoliday !== 'boolean') return undefined
  const subdivisionCodes = value.subdivisionCodes === null ? [] : parseStringArray(value.subdivisionCodes)
  const holidayTypes = parseStringArray(value.holidayTypes, HOLIDAY_TYPES)
  if (!subdivisionCodes || !holidayTypes?.length) return undefined
  const identity = `${value.date}\u0000${name}\u0000${subdivisionCodes.join('|')}`
  return {
    date: value.date,
    name,
    countryCode: request.country,
    nationalHoliday: value.nationalHoliday,
    subdivisionCodes,
    holidayTypes,
    identity,
  }
}

export const parseNagerHolidayResponse = (data: unknown, executedRequest?: ExecutedRequestContext): { request?: NagerHolidayRequest; result?: HolidayResult; invalidReason?: string } => {
  const request = parseNagerHolidayRequest(executedRequest)
  if (!request) return { invalidReason: 'The successful response was not tied to the exact supported Nager.Holidays Community API v4 request.' }
  if (!Array.isArray(data)) return { request, invalidReason: 'Nager.Holidays did not return the documented holiday array.' }

  const holidays: HolidayRecord[] = []
  const seen = new Set<string>()
  let malformedHolidayCount = 0
  let duplicateHolidayCount = 0
  for (const value of data) {
    const holiday = parseHoliday(value, request)
    if (!holiday) {
      malformedHolidayCount += 1
      continue
    }
    if (seen.has(holiday.identity)) {
      duplicateHolidayCount += 1
      continue
    }
    seen.add(holiday.identity)
    holidays.push(holiday)
  }

  return { request, result: {
    holidays,
    providerHolidayCount: data.length,
    malformedHolidayCount,
    duplicateHolidayCount,
    nationalHolidayCount: holidays.filter((holiday) => holiday.nationalHoliday).length,
    regionalHolidayCount: holidays.filter((holiday) => !holiday.nationalHoliday).length,
  } }
}

const attrs = (request?: NagerHolidayRequest, result?: HolidayResult) => ({
  'data-domain-card': 'nager-holiday-calendar',
  'data-request-bound': request ? 'true' : 'false',
  'data-request-contract': 'exact-nager-community-v4-holidays',
  'data-requested-country': request?.country,
  'data-requested-year': request?.year,
  'data-provider-holiday-count': result?.providerHolidayCount,
  'data-trusted-holiday-count': result?.holidays.length,
  'data-malformed-holiday-count': result?.malformedHolidayCount,
  'data-duplicate-holiday-count': result?.duplicateHolidayCount,
  'data-national-holiday-count': result?.nationalHolidayCount,
  'data-regional-holiday-count': result?.regionalHolidayCount,
  'data-primary-holiday-date': result?.holidays[0]?.date,
  'data-primary-holiday-name': result?.holidays[0]?.name,
})

const dateListItem = (holiday: HolidayRecord): DateListItem => {
  const date = new Date(`${holiday.date}T00:00:00Z`)
  const scope = holiday.nationalHoliday ? 'National holiday' : holiday.subdivisionCodes.length ? `Regional · ${holiday.subdivisionCodes.join(', ')}` : 'Regional holiday'
  return {
    key: holiday.identity,
    dateText: holiday.date,
    day: String(date.getUTCDate()).padStart(2, '0'),
    month: date.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }),
    eyebrow: `${holiday.countryCode} · ${holiday.holidayTypes.join(' · ')}`,
    title: holiday.name,
    description: scope,
  }
}

export function NagerHolidaysPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseNagerHolidayResponse(data, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request)} data-result-state="invalid"><h3>Invalid Nager.Holidays response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  if (result.providerHolidayCount === 0) return <div className="domain-card domain-empty" {...attrs(request, result)} data-result-state="empty"><h3>No holidays returned</h3><p>Nager.Holidays returned an empty holiday list for {request.country} in {request.year}.</p></div>
  if (!result.holidays.length) return <div className="domain-card domain-empty" {...attrs(request, result)} data-result-state="invalid"><h3>No trustworthy holiday records</h3><p>The provider returned records, but none matched the executed country/year and Community API v4 response contract.</p></div>

  const partial = result.malformedHolidayCount > 0 || result.duplicateHolidayCount > 0
  return <div className="domain-card" {...attrs(request, result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Nager.Holidays · Community API v4</small><h3>{request.country} public holiday calendar · {request.year}</h3><p>Exact-request-bound holiday names, dates, national/regional scope, subdivisions, and provider holiday types.</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{partial ? 'Partial evidence' : 'Request matched'}</span></header>
    {partial ? <p className="domain-note">Malformed or duplicate provider rows were withheld. Raw JSON retains the complete response.</p> : null}
    <dl className="domain-facts"><div><dt>Provider rows</dt><dd>{result.providerHolidayCount}</dd></div><div><dt>Trusted holidays</dt><dd>{result.holidays.length}</dd></div><div><dt>National holidays</dt><dd>{result.nationalHolidayCount}</dd></div><div><dt>Regional holidays</dt><dd>{result.regionalHolidayCount}</dd></div></dl>
    <DateList items={result.holidays.map(dateListItem)} className="nager-holiday-calendar"/>
    <p className="domain-note">Community API v4 distinguishes national holidays from subdivision-scoped dates and classifies holiday types such as Public, Bank, School, Authorities, Optional, and Observance. This workbench does not infer days off beyond the provider fields.</p>
  </div>
}
