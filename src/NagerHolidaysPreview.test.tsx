import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { parseNagerHolidayRequest, parseNagerHolidayResponse } from './previews/NagerHolidaysPreview'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('holidays')!
const year = new Date().getUTCFullYear()
const request = (country = 'SG', selectedYear = year): ExecutedRequestContext => ({
  method: 'GET',
  url: `https://nagerholidays.com/api/v4/Holidays/${country}/${selectedYear}`,
})
const holiday = (overrides: Record<string, unknown> = {}) => ({
  date: `${year}-01-01`,
  name: "New Year's Day",
  countryCode: 'SG',
  nationalHoliday: true,
  subdivisionCodes: null,
  holidayTypes: ['Public'],
  ...overrides,
})

const card = async () => {
  const region = await screen.findByRole('region', { name: 'Holiday Calendar' })
  return region.querySelector('[data-domain-card="nager-holiday-calendar"]') as HTMLElement
}

describe('Nager.Holidays Community API v4 semantics', () => {
  it('renders request-bound native holiday fields as a ready calendar', async () => {
    const payload = [
      holiday(),
      holiday({ date: `${year}-02-17`, name: 'Chinese New Year' }),
      holiday({ date: `${year}-02-18`, name: 'Chinese New Year' }),
    ]
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={payload}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-contract', 'exact-nager-community-v4-holidays')
    expect(root).toHaveAttribute('data-requested-country', 'SG')
    expect(root).toHaveAttribute('data-requested-year', String(year))
    expect(root).toHaveAttribute('data-provider-holiday-count', '3')
    expect(root).toHaveAttribute('data-trusted-holiday-count', '3')
    expect(root).toHaveAttribute('data-national-holiday-count', '3')
    expect(root).toHaveAttribute('data-regional-holiday-count', '0')
    expect(root).toHaveAttribute('data-primary-holiday-date', `${year}-01-01`)
    expect(root).toHaveAttribute('data-primary-holiday-name', "New Year's Day")
    expect(within(root).getAllByRole('listitem')).toHaveLength(3)
    expect(root).toHaveTextContent('Chinese New Year')
    expect(root).toHaveTextContent('National holiday')
  })

  it('accepts only the exact bodyless GET v4 request inside the admitted planning window', () => {
    expect(parseNagerHolidayRequest(request())).toEqual({ country: 'SG', year })
    const rejected: ExecutedRequestContext[] = [
      { method: 'POST', url: request().url },
      { method: 'GET', url: request().url, body: {} },
      { method: 'GET', url: `${request().url}?foo=bar` },
      { method: 'GET', url: `${request().url}/` },
      { method: 'GET', url: `${request().url}#calendar` },
      { method: 'GET', url: `http://nagerholidays.com/api/v4/Holidays/SG/${year}` },
      { method: 'GET', url: `https://date.nager.at/api/v3/PublicHolidays/${year}/SG` },
      { method: 'GET', url: `https://nagerholidays.com/api/v4/Holidays/sg/${year}` },
      { method: 'GET', url: `https://nagerholidays.com/api/v4/Holidays/SG/${year + 6}` },
      { method: 'GET', url: `https://user:pass@nagerholidays.com/api/v4/Holidays/SG/${year}` },
      { method: 'GET', url: `https://nagerholidays.com:8443/api/v4/Holidays/SG/${year}` },
    ]
    for (const candidate of rejected) expect(parseNagerHolidayRequest(candidate), candidate.url).toBeUndefined()
  })

  it('withholds malformed and duplicate provider rows while preserving trusted evidence as partial', async () => {
    const payload = [
      holiday(),
      holiday(),
      holiday({ date: `${year}-03-21`, name: 'Wrong country holiday', countryCode: 'MY' }),
      holiday({ date: `${year}-04-03`, name: 'String boolean holiday', nationalHoliday: 'true' }),
      holiday({ date: `${year}-05-01`, name: 'Unknown type holiday', holidayTypes: ['Fabricated'] }),
    ]
    expect(parseNagerHolidayResponse(payload, request()).result).toMatchObject({
      providerHolidayCount: 5,
      malformedHolidayCount: 3,
      duplicateHolidayCount: 1,
      nationalHolidayCount: 1,
    })
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={payload}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-trusted-holiday-count', '1')
    expect(root).toHaveAttribute('data-malformed-holiday-count', '3')
    expect(root).toHaveAttribute('data-duplicate-holiday-count', '1')
    expect(root).not.toHaveTextContent('Wrong country holiday')
    expect(root).not.toHaveTextContent('String boolean holiday')
    expect(root).not.toHaveTextContent('Unknown type holiday')
  })

  it('preserves documented regional scope and holiday types without inventing a day-off claim', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={[holiday({
      name: 'Regional Observance',
      nationalHoliday: false,
      subdivisionCodes: ['SG-01'],
      holidayTypes: ['Observance', 'Optional'],
    })]}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-regional-holiday-count', '1')
    expect(root).toHaveTextContent('Observance · Optional')
    expect(root).toHaveTextContent('Regional · SG-01')
    expect(root).toHaveTextContent('does not infer days off')
  })

  it('maps an exact empty provider list to empty and unusable non-empty batches to invalid', async () => {
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={request()} data={[]}/>)
    let root = await card()
    expect(root).toHaveAttribute('data-result-state', 'empty')

    rerender(<ResponseDemoPreview api={api} executedRequest={request()} data={[holiday({ countryCode: 'MY', name: 'Fabricated mismatch' })]}/>)
    root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).not.toHaveTextContent('Fabricated mismatch')
  })

  it('fails closed when HTTP-success data is not bound to the admitted request', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={{ method: 'GET', url: `${request().url}?foo=bar` }} data={[holiday({ name: 'Hidden holiday' })]}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-request-bound', 'false')
    expect(root).not.toHaveTextContent('Hidden holiday')
  })
})
