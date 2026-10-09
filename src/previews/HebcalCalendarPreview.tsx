import type { ReactNode } from 'react'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { DateList, type DateListItem } from './DateList'
import { isRecord, optionalTrimmedText } from './semanticValidation'

const REQUEST_PATH = '/hebcal'
const YEAR_MIN = 5700
const YEAR_MAX = 5800
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const HEBREW_YEAR_PATTERN = /\s(\d{4})$/
const STATIC_PARAMS = new Map([
  ['v', '1'],
  ['cfg', 'json'],
  ['yt', 'H'],
  ['month', 'x'],
  ['maj', 'on'],
  ['min', 'on'],
  ['mod', 'on'],
  ['nx', 'on'],
  ['mf', 'on'],
  ['ss', 'on'],
  ['s', 'on'],
  ['leyning', 'off'],
])

export type HebcalCalendarRequest = {
  year: number
  israel: boolean
  schedule: 'Diaspora' | 'Israel'
}

type HebcalEvent = {
  date: string
  hdate: string
  title: string
  hebrew: string
  category: string
  subcat?: string
  memo?: string
  link?: string
  yomtov?: boolean
  identity: string
  supplementalMalformed: boolean
}

type HebcalCalendarResult = {
  title: string
  rangeStart: string
  rangeEnd: string
  events: HebcalEvent[]
  providerEventCount: number
  malformedEventCount: number
  duplicateEventCount: number
  supplementalMalformedCount: number
  holidayEventCount: number
  parashatEventCount: number
  roshChodeshEventCount: number
  primaryEvent?: HebcalEvent
}

const strictText = (value: unknown): string | undefined => typeof value === 'string' && value === value.trim() && value.length > 0 ? value : undefined

const validCalendarDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || value !== value.trim()) return false
  const match = value.match(DATE_PATTERN)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

const oneParam = (url: URL, key: string): string | undefined => {
  const values = url.searchParams.getAll(key)
  return values.length === 1 ? values[0] : undefined
}

export const parseHebcalCalendarRequest = (executedRequest?: ExecutedRequestContext): HebcalCalendarRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    if (url.protocol !== 'https:' || url.hostname !== 'www.hebcal.com' || url.port || url.username || url.password || url.pathname !== REQUEST_PATH || url.hash) return undefined
    const expectedKeys = new Set([...STATIC_PARAMS.keys(), 'year', 'i'])
    const entries = [...url.searchParams.entries()]
    if (entries.length !== expectedKeys.size || entries.some(([key]) => !expectedKeys.has(key))) return undefined
    for (const [key, expected] of STATIC_PARAMS) if (oneParam(url, key) !== expected) return undefined
    const yearText = oneParam(url, 'year')
    const israelText = oneParam(url, 'i')
    if (!yearText || !/^\d{4}$/.test(yearText) || !['off', 'on'].includes(israelText ?? '')) return undefined
    const year = Number(yearText)
    if (!Number.isSafeInteger(year) || String(year) !== yearText || year < YEAR_MIN || year > YEAR_MAX) return undefined
    const israel = israelText === 'on'
    return { year, israel, schedule: israel ? 'Israel' : 'Diaspora' }
  } catch {
    return undefined
  }
}

const parseOptionalLink = (value: unknown): { value?: string; malformed: boolean } => {
  const parsed = optionalTrimmedText(value)
  if (parsed.malformed || !parsed.value) return parsed
  try {
    const url = new URL(parsed.value)
    if (url.protocol !== 'https:' || !['hebcal.com', 'www.hebcal.com'].includes(url.hostname) || url.username || url.password) return { malformed: true }
    return { value: url.href, malformed: false }
  } catch {
    return { malformed: true }
  }
}

const parseEvent = (value: unknown, request: HebcalCalendarRequest, rangeStart: string, rangeEnd: string): HebcalEvent | undefined => {
  if (!isRecord(value) || !validCalendarDate(value.date) || value.date < rangeStart || value.date > rangeEnd) return undefined
  const title = strictText(value.title)
  const hdate = strictText(value.hdate)
  const hebrew = strictText(value.hebrew)
  const category = strictText(value.category)
  if (!title || !hdate || !hebrew || !category) return undefined
  const hYearMatch = hdate.match(HEBREW_YEAR_PATTERN)
  if (!hYearMatch) return undefined
  const hYear = Number(hYearMatch[1])
  if (hYear !== request.year && hYear !== request.year - 1) return undefined

  const subcat = optionalTrimmedText(value.subcat)
  const memo = optionalTrimmedText(value.memo)
  const link = parseOptionalLink(value.link)
  const yomtovMalformed = value.yomtov !== undefined && typeof value.yomtov !== 'boolean'
  const supplementalMalformed = subcat.malformed || memo.malformed || link.malformed || yomtovMalformed
  return {
    date: value.date,
    hdate,
    title,
    hebrew,
    category,
    subcat: subcat.value,
    memo: memo.value,
    link: link.value,
    yomtov: typeof value.yomtov === 'boolean' ? value.yomtov : undefined,
    identity: `${value.date}\u0000${category}\u0000${title}\u0000${hdate}`,
    supplementalMalformed,
  }
}

const expectedGregorianRange = (year: number, start: string, end: string): boolean => {
  if (!validCalendarDate(start) || !validCalendarDate(end) || start > end) return false
  const startYear = Number(start.slice(0, 4))
  const endYear = Number(end.slice(0, 4))
  return startYear === year - 3761 && endYear === year - 3760
}

export const parseHebcalCalendarResponse = (data: unknown, executedRequest?: ExecutedRequestContext): { request?: HebcalCalendarRequest; result?: HebcalCalendarResult; invalidReason?: string } => {
  const request = parseHebcalCalendarRequest(executedRequest)
  if (!request) return { invalidReason: 'The successful response was not tied to the exact supported Hebcal Hebrew-year request.' }
  if (!isRecord(data) || !Array.isArray(data.items) || !isRecord(data.range)) return { request, invalidReason: 'Hebcal did not return the documented calendar envelope.' }

  const title = strictText(data.title)
  const rangeStart = strictText(data.range.start)
  const rangeEnd = strictText(data.range.end)
  const expectedTitle = `Hebcal ${request.schedule} ${request.year}`
  if (title !== expectedTitle || !rangeStart || !rangeEnd || !expectedGregorianRange(request.year, rangeStart, rangeEnd)) {
    return { request, invalidReason: 'Hebcal response title or Gregorian range did not match the executed Hebrew year and schedule.' }
  }

  const events: HebcalEvent[] = []
  const seen = new Set<string>()
  let malformedEventCount = 0
  let duplicateEventCount = 0
  let supplementalMalformedCount = 0
  for (const raw of data.items) {
    const event = parseEvent(raw, request, rangeStart, rangeEnd)
    if (!event) {
      malformedEventCount += 1
      continue
    }
    if (seen.has(event.identity)) {
      duplicateEventCount += 1
      continue
    }
    seen.add(event.identity)
    if (event.supplementalMalformed) supplementalMalformedCount += 1
    events.push(event)
  }
  if (events.length > 0 && !events.some((event) => event.hdate.endsWith(` ${request.year}`))) {
    return { request, invalidReason: 'Hebcal returned events without Hebrew-year evidence for the executed request.' }
  }

  return { request, result: {
    title,
    rangeStart,
    rangeEnd,
    events,
    providerEventCount: data.items.length,
    malformedEventCount,
    duplicateEventCount,
    supplementalMalformedCount,
    holidayEventCount: events.filter((event) => event.category === 'holiday').length,
    parashatEventCount: events.filter((event) => event.category === 'parashat').length,
    roshChodeshEventCount: events.filter((event) => event.category === 'roshchodesh').length,
    primaryEvent: events[0],
  } }
}

const attrs = (request?: HebcalCalendarRequest, result?: HebcalCalendarResult) => ({
  'data-domain-card': 'hebcal-jewish-calendar',
  'data-request-bound': request ? 'true' : 'false',
  'data-request-contract': 'exact-hebcal-hebrew-year-calendar',
  'data-requested-hebrew-year': request?.year,
  'data-requested-schedule': request?.schedule,
  'data-provider-event-count': result?.providerEventCount,
  'data-trusted-event-count': result?.events.length,
  'data-malformed-event-count': result?.malformedEventCount,
  'data-duplicate-event-count': result?.duplicateEventCount,
  'data-supplemental-malformed-count': result?.supplementalMalformedCount,
  'data-range-start': result?.rangeStart,
  'data-range-end': result?.rangeEnd,
  'data-primary-event-date': result?.primaryEvent?.date,
  'data-primary-event-title': result?.primaryEvent?.title,
})

const eventItem = (event: HebcalEvent): DateListItem => {
  const date = new Date(`${event.date}T00:00:00Z`)
  const category = event.subcat ? `${event.category} · ${event.subcat}` : event.category
  const hebrew: ReactNode = <><span lang="he" dir="rtl">{event.hebrew}</span> · {event.hdate}{event.memo ? ` · ${event.memo}` : ''}</>
  return {
    key: event.identity,
    dateText: event.date,
    day: String(date.getUTCDate()).padStart(2, '0'),
    month: date.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }),
    eyebrow: `${category}${event.yomtov === true ? ' · Yom Tov' : ''}`,
    title: event.title,
    description: hebrew,
  }
}

const visibleEvents = (events: HebcalEvent[]) => events.slice(0, 12)

export function HebcalCalendarPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseHebcalCalendarResponse(data, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty" {...attrs(parsed.request)} data-result-state="invalid"><h3>Invalid Hebcal calendar response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  if (result.providerEventCount === 0) return <div className="domain-card domain-empty" {...attrs(request, result)} data-result-state="empty"><h3>No calendar events returned</h3><p>Hebcal returned an empty full-year calendar for Hebrew year {request.year} ({request.schedule}).</p></div>
  if (!result.events.length) return <div className="domain-card domain-empty" {...attrs(request, result)} data-result-state="invalid"><h3>No trustworthy Hebcal events</h3><p>The provider returned events, but none matched the documented calendar event contract.</p></div>

  const partial = result.malformedEventCount > 0 || result.duplicateEventCount > 0 || result.supplementalMalformedCount > 0
  const shown = visibleEvents(result.events)
  return <div className="domain-card" {...attrs(request, result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">Hebcal · Jewish Calendar API</small><h3>Hebrew year {request.year} · {request.schedule}</h3><p>Exact-request-bound Jewish holidays, weekly Torah portions, Rosh Chodesh, and modern observances across {result.rangeStart} to {result.rangeEnd}.</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{partial ? 'Partial evidence' : 'Request matched'}</span></header>
    {partial ? <p className="domain-note">Malformed, duplicate, or malformed supplemental provider evidence was withheld. Raw JSON retains the complete response.</p> : null}
    <dl className="domain-facts"><div><dt>Provider events</dt><dd>{result.providerEventCount}</dd></div><div><dt>Trusted events</dt><dd>{result.events.length}</dd></div><div><dt>Holiday events</dt><dd>{result.holidayEventCount}</dd></div><div><dt>Parashat</dt><dd>{result.parashatEventCount}</dd></div></dl>
    <p className="domain-note">Showing {shown.length} of {result.events.length} trusted events. Rosh Chodesh events: {result.roshChodeshEventCount}.</p>
    <DateList items={shown.map(eventItem)} className="hebcal-jewish-calendar"/>
    <p className="domain-note">Hebcal-generated API content is licensed under CC BY 4.0 and requires attribution. Event categories and Yom Tov flags are provider fields; this workbench does not infer religious practice, work restrictions, or legal holiday status.</p>
  </div>
}
