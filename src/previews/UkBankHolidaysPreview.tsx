import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { DateList, type DateListItem } from './DateList'
import { isRecord } from './semanticValidation'

const REQUEST_URL = 'https://www.gov.uk/bank-holidays.json'
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DIVISIONS = [
  ['england-and-wales', 'England and Wales'],
  ['scotland', 'Scotland'],
  ['northern-ireland', 'Northern Ireland'],
] as const

type DivisionId = typeof DIVISIONS[number][0]

type BankHolidayEvent = {
  title: string
  date: string
  notes: string
  bunting: boolean
  identity: string
}

type DivisionResult = {
  id: DivisionId
  label: string
  providerEventCount: number
  events: BankHolidayEvent[]
  malformedEventCount: number
  duplicateEventCount: number
}

type BankHolidayResult = {
  divisions: DivisionResult[]
  providerEventCount: number
  trustedEventCount: number
  malformedEventCount: number
  duplicateEventCount: number
  unexpectedRootKeyCount: number
  unusableDivisionCount: number
  primaryEvent?: BankHolidayEvent & { division: DivisionId }
}

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

const strictTitle = (value: unknown): string | undefined => typeof value === 'string' && value === value.trim() && value.length > 0 ? value : undefined

export const isExactUkBankHolidaysRequest = (executedRequest?: ExecutedRequestContext): boolean => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return false
  try {
    const url = new URL(executedRequest.url)
    return url.protocol === 'https:'
      && url.hostname === 'www.gov.uk'
      && !url.port
      && !url.username
      && !url.password
      && url.pathname === '/bank-holidays.json'
      && !url.search
      && !url.hash
      && url.href === REQUEST_URL
  } catch {
    return false
  }
}

const parseEvent = (value: unknown): BankHolidayEvent | undefined => {
  if (!isRecord(value)) return undefined
  const title = strictTitle(value.title)
  if (!title || !validCalendarDate(value.date) || typeof value.notes !== 'string' || typeof value.bunting !== 'boolean') return undefined
  return {
    title,
    date: value.date,
    notes: value.notes,
    bunting: value.bunting,
    identity: `${value.date}\u0000${title}`,
  }
}

const primaryEvent = (divisions: DivisionResult[]): BankHolidayResult['primaryEvent'] => {
  const all = divisions.flatMap((division) => division.events.map((event) => ({ ...event, division: division.id })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.division.localeCompare(b.division) || a.title.localeCompare(b.title))
  if (!all.length) return undefined
  const today = new Date().toISOString().slice(0, 10)
  return all.find((event) => event.date >= today) ?? all.at(-1)
}

export const parseUkBankHolidaysResponse = (data: unknown, executedRequest?: ExecutedRequestContext): { result?: BankHolidayResult; invalidReason?: string } => {
  if (!isExactUkBankHolidaysRequest(executedRequest)) return { invalidReason: 'The successful response was not tied to the exact supported GOV.UK Bank Holidays JSON request.' }
  if (!isRecord(data)) return { invalidReason: 'GOV.UK did not return the documented division object.' }

  const expectedKeys = new Set<string>(DIVISIONS.map(([id]) => id))
  const unexpectedRootKeyCount = Object.keys(data).filter((key) => !expectedKeys.has(key)).length
  const divisions: DivisionResult[] = []
  let unusableDivisionCount = 0

  for (const [id, label] of DIVISIONS) {
    const raw = data[id]
    if (!isRecord(raw) || raw.division !== id || !Array.isArray(raw.events)) {
      return { invalidReason: `GOV.UK did not return the documented ${label} division envelope.` }
    }

    const events: BankHolidayEvent[] = []
    const seen = new Set<string>()
    let malformedEventCount = 0
    let duplicateEventCount = 0
    for (const rawEvent of raw.events) {
      const event = parseEvent(rawEvent)
      if (!event) {
        malformedEventCount += 1
        continue
      }
      if (seen.has(event.identity)) {
        duplicateEventCount += 1
        continue
      }
      seen.add(event.identity)
      events.push(event)
    }
    events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    if (raw.events.length > 0 && events.length === 0) unusableDivisionCount += 1
    divisions.push({ id, label, providerEventCount: raw.events.length, events, malformedEventCount, duplicateEventCount })
  }

  const providerEventCount = divisions.reduce((sum, division) => sum + division.providerEventCount, 0)
  const trustedEventCount = divisions.reduce((sum, division) => sum + division.events.length, 0)
  const malformedEventCount = divisions.reduce((sum, division) => sum + division.malformedEventCount, 0)
  const duplicateEventCount = divisions.reduce((sum, division) => sum + division.duplicateEventCount, 0)
  return { result: {
    divisions,
    providerEventCount,
    trustedEventCount,
    malformedEventCount,
    duplicateEventCount,
    unexpectedRootKeyCount,
    unusableDivisionCount,
    primaryEvent: primaryEvent(divisions),
  } }
}

const eventItem = (division: DivisionResult, event: BankHolidayEvent): DateListItem => {
  const date = new Date(`${event.date}T00:00:00Z`)
  return {
    key: `${division.id}-${event.identity}`,
    dateText: event.date,
    day: String(date.getUTCDate()).padStart(2, '0'),
    month: date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
    eyebrow: `${division.label} · GOV.UK bunting flag: ${event.bunting ? 'yes' : 'no'}`,
    title: event.title,
    description: event.notes || 'No additional provider note',
  }
}

const visibleEvents = (events: BankHolidayEvent[]): BankHolidayEvent[] => {
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter((event) => event.date >= today)
  return (upcoming.length ? upcoming.slice(0, 4) : events.slice(-4))
}

const attrs = (result?: BankHolidayResult) => ({
  'data-domain-card': 'govuk-bank-holiday-calendar',
  'data-request-bound': result ? 'true' : 'false',
  'data-request-contract': 'exact-govuk-bank-holidays-json',
  'data-division-count': result?.divisions.length,
  'data-provider-event-count': result?.providerEventCount,
  'data-trusted-event-count': result?.trustedEventCount,
  'data-malformed-event-count': result?.malformedEventCount,
  'data-duplicate-event-count': result?.duplicateEventCount,
  'data-unexpected-root-key-count': result?.unexpectedRootKeyCount,
  'data-unusable-division-count': result?.unusableDivisionCount,
  'data-primary-event-date': result?.primaryEvent?.date,
  'data-primary-event-title': result?.primaryEvent?.title,
  'data-primary-event-division': result?.primaryEvent?.division,
  'data-england-and-wales-event-count': result?.divisions.find((division) => division.id === 'england-and-wales')?.events.length,
  'data-scotland-event-count': result?.divisions.find((division) => division.id === 'scotland')?.events.length,
  'data-northern-ireland-event-count': result?.divisions.find((division) => division.id === 'northern-ireland')?.events.length,
})

export function UkBankHolidaysPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseUkBankHolidaysResponse(data, executedRequest)
  if (!parsed.result) return <div className="domain-card domain-empty" {...attrs()} data-result-state="invalid"><h3>Invalid GOV.UK Bank Holidays response</h3><p>{parsed.invalidReason}</p></div>
  const result = parsed.result
  if (result.providerEventCount === 0) return <div className="domain-card domain-empty" {...attrs(result)} data-result-state="empty"><h3>No bank holidays returned</h3><p>GOV.UK returned all three documented divisions with empty event lists.</p></div>
  if (result.unusableDivisionCount > 0 || result.trustedEventCount === 0) return <div className="domain-card domain-empty" {...attrs(result)} data-result-state="invalid"><h3>Incomplete bank holiday evidence</h3><p>At least one documented UK division returned events but no trustworthy event records.</p></div>

  const partial = result.malformedEventCount > 0 || result.duplicateEventCount > 0 || result.unexpectedRootKeyCount > 0
  return <div className="domain-card" {...attrs(result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">GOV.UK · Bank Holidays API</small><h3>UK bank holidays by division</h3><p>Exact-request-bound dates for England and Wales, Scotland, and Northern Ireland.</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{partial ? 'Partial evidence' : 'Request matched'}</span></header>
    {partial ? <p className="domain-note">Malformed, duplicate, or unexpected provider evidence was withheld. Raw JSON retains the complete response.</p> : null}
    <dl className="domain-facts"><div><dt>Divisions</dt><dd>{result.divisions.length}</dd></div><div><dt>Provider events</dt><dd>{result.providerEventCount}</dd></div><div><dt>Trusted events</dt><dd>{result.trustedEventCount}</dd></div><div><dt>Withheld rows</dt><dd>{result.malformedEventCount + result.duplicateEventCount}</dd></div></dl>
    {result.divisions.map((division) => <section key={division.id} data-bank-holiday-division={division.id} data-provider-event-count={division.providerEventCount} data-trusted-event-count={division.events.length}>
      <h4>{division.label}</h4>
      <p className="domain-note">{division.events.length} trusted events · showing {Math.min(4, division.events.length)} {division.events.some((event) => event.date >= new Date().toISOString().slice(0, 10)) ? 'upcoming' : 'most recent'} dates.</p>
      <DateList items={visibleEvents(division.events).map((event) => eventItem(division, event))} className="govuk-bank-holiday-calendar"/>
    </section>)}
    <p className="domain-note">A GOV.UK “Substitute day” note is preserved when supplied. The provider bunting boolean is shown only as a source field; this workbench does not infer leave entitlement. GOV.UK states that employers do not have to give paid leave on bank or public holidays.</p>
  </div>
}
