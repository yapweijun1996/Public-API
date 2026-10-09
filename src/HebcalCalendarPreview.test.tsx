import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { parseHebcalCalendarRequest, parseHebcalCalendarResponse } from './previews/HebcalCalendarPreview'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('hebcal-calendar')!
const year = 5787
const exactUrl = `https://www.hebcal.com/hebcal?v=1&cfg=json&year=${year}&yt=H&month=x&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&s=on&leyning=off&i=off`
const request = (url = exactUrl): ExecutedRequestContext => ({ method: 'GET', url })
const event = (overrides: Record<string, unknown> = {}) => ({
  title: 'Rosh Hashana 5787',
  date: '2026-09-12',
  hdate: '1 Tishrei 5787',
  category: 'holiday',
  subcat: 'major',
  hebrew: 'ראש השנה 5787',
  link: 'https://hebcal.com/h/rosh-hashana-2026?us=js&um=api',
  memo: 'The Jewish New Year',
  yomtov: true,
  ...overrides,
})
const payload = (items: unknown[] = [event()], overrides: Record<string, unknown> = {}) => ({
  title: 'Hebcal Diaspora 5787',
  date: '2026-09-18T00:00:00.000Z',
  version: '6.9.2-4.2.0',
  location: { geo: 'none' },
  range: { start: '2026-09-11', end: '2027-10-01' },
  items,
  ...overrides,
})

const card = async () => {
  const region = await screen.findByRole('region', { name: 'Hebcal Calendar' })
  return region.querySelector('[data-domain-card="hebcal-jewish-calendar"]') as HTMLElement
}

describe('Hebcal Hebrew-year calendar semantics', () => {
  it('renders exact-request-bound Hebrew/Gregorian event evidence as ready', async () => {
    const items = [
      event({ title: 'Erev Rosh Hashana', date: '2026-09-11', hdate: '29 Elul 5786', hebrew: 'ערב ראש השנה', yomtov: undefined }),
      event(),
      event({ title: 'Parashat Ha’azinu', date: '2026-09-19', hdate: '8 Tishrei 5787', category: 'parashat', subcat: undefined, hebrew: 'פרשת האזינו', yomtov: undefined }),
      event({ title: 'Rosh Chodesh Cheshvan', date: '2026-10-11', hdate: '30 Tishrei 5787', category: 'roshchodesh', subcat: undefined, hebrew: 'ראש חודש חשון', yomtov: undefined }),
    ]
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={payload(items)}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-contract', 'exact-hebcal-hebrew-year-calendar')
    expect(root).toHaveAttribute('data-requested-hebrew-year', String(year))
    expect(root).toHaveAttribute('data-requested-schedule', 'Diaspora')
    expect(root).toHaveAttribute('data-provider-event-count', '4')
    expect(root).toHaveAttribute('data-trusted-event-count', '4')
    expect(root).toHaveAttribute('data-range-start', '2026-09-11')
    expect(root).toHaveAttribute('data-range-end', '2027-10-01')
    expect(root).toHaveAttribute('data-primary-event-title', 'Erev Rosh Hashana')
    expect(within(root).getAllByRole('listitem')).toHaveLength(4)
    expect(root).toHaveTextContent('Hebrew year 5787 · Diaspora')
    expect(root).toHaveTextContent('Rosh Hashana 5787')
    expect(root).toHaveTextContent('ראש השנה 5787')
    expect(root).toHaveTextContent('CC BY 4.0')
  })

  it('accepts only the exact documented full-year Hebrew-calendar request', () => {
    expect(parseHebcalCalendarRequest(request())).toEqual({ year, israel: false, schedule: 'Diaspora' })
    const israelUrl = exactUrl.replace('i=off', 'i=on')
    expect(parseHebcalCalendarRequest(request(israelUrl))).toEqual({ year, israel: true, schedule: 'Israel' })
    const rejected: ExecutedRequestContext[] = [
      { method: 'POST', url: exactUrl },
      { method: 'GET', url: exactUrl, body: {} },
      { method: 'GET', url: `${exactUrl}&foo=bar` },
      { method: 'GET', url: `${exactUrl}&year=5788` },
      { method: 'GET', url: exactUrl.replace('/hebcal?', '/hebcal/?') },
      { method: 'GET', url: exactUrl.replace('yt=H', 'yt=G') },
      { method: 'GET', url: exactUrl.replace('month=x', 'month=0') },
      { method: 'GET', url: exactUrl.replace('year=5787', 'year=5787.0') },
      { method: 'GET', url: exactUrl.replace('i=off', 'i=diaspora') },
      { method: 'GET', url: exactUrl.replace('https:', 'http:') },
      { method: 'GET', url: exactUrl.replace('www.hebcal.com', 'user:pass@www.hebcal.com') },
      { method: 'GET', url: `${exactUrl}#events` },
    ]
    for (const candidate of rejected) expect(parseHebcalCalendarRequest(candidate), candidate.url).toBeUndefined()
  })

  it('withholds malformed and duplicate rows while preserving trustworthy evidence as partial', async () => {
    const trusted = event()
    const data = payload([
      trusted,
      trusted,
      event({ title: 'Malformed Hebrew year', date: '2026-09-20', hdate: '9 Tishrei 9000' }),
      event({ title: 'Supplemental type drift', date: '2026-09-21', hdate: '10 Tishrei 5787', yomtov: 'true' }),
    ])
    expect(parseHebcalCalendarResponse(data, request()).result).toMatchObject({
      providerEventCount: 4,
      malformedEventCount: 1,
      duplicateEventCount: 1,
      supplementalMalformedCount: 1,
    })
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={data}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-trusted-event-count', '2')
    expect(root).toHaveAttribute('data-malformed-event-count', '1')
    expect(root).toHaveAttribute('data-duplicate-event-count', '1')
    expect(root).toHaveAttribute('data-supplemental-malformed-count', '1')
    expect(root).not.toHaveTextContent('Malformed Hebrew year')
    expect(root).toHaveTextContent('Supplemental type drift')
  })

  it('fails closed when the provider title or Gregorian range contradicts the executed Hebrew year', async () => {
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={request()} data={payload([event()], { title: 'Hebcal Diaspora 5786' })}/>)
    let root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).not.toHaveTextContent('Rosh Hashana 5787')

    rerender(<ResponseDemoPreview api={api} executedRequest={request()} data={payload([event()], { range: { start: '5787-01-01', end: '5787-12-31' } })}/>)
    root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).not.toHaveTextContent('Rosh Hashana 5787')
  })

  it('maps a coherent exact empty calendar to empty and provider-tolerated extra query semantics to invalid', async () => {
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={request()} data={payload([])}/>)
    let root = await card()
    expect(root).toHaveAttribute('data-result-state', 'empty')

    rerender(<ResponseDemoPreview api={api} executedRequest={request(`${exactUrl}&foo=bar`)} data={payload([event({ title: 'Hidden event' })])}/>)
    root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-request-bound', 'false')
    expect(root).not.toHaveTextContent('Hidden event')
  })
})
