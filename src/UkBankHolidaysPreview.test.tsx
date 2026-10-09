import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { isExactUkBankHolidaysRequest, parseUkBankHolidaysResponse } from './previews/UkBankHolidaysPreview'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('uk-bank-holidays')!
const futureYear = new Date().getUTCFullYear() + 1
const exactRequest: ExecutedRequestContext = { method: 'GET', url: 'https://www.gov.uk/bank-holidays.json' }
const event = (title: string, date: string, overrides: Record<string, unknown> = {}) => ({ title, date, notes: '', bunting: true, ...overrides })
const payload = (overrides: Record<string, unknown> = {}) => ({
  'england-and-wales': { division: 'england-and-wales', events: [event("New Year’s Day", `${futureYear}-01-01`)] },
  scotland: { division: 'scotland', events: [event('2nd January', `${futureYear}-01-02`)] },
  'northern-ireland': { division: 'northern-ireland', events: [event("St Patrick’s Day", `${futureYear}-03-17`, { bunting: false })] },
  ...overrides,
})

const card = async () => {
  await screen.findByText('UK bank holidays by division')
  return document.querySelector('[data-domain-card="govuk-bank-holiday-calendar"]') as HTMLElement
}

describe('GOV.UK Bank Holidays semantics', () => {
  it('renders all three documented divisions from the exact successful request', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={exactRequest} data={payload()}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-contract', 'exact-govuk-bank-holidays-json')
    expect(root).toHaveAttribute('data-division-count', '3')
    expect(root).toHaveAttribute('data-provider-event-count', '3')
    expect(root).toHaveAttribute('data-trusted-event-count', '3')
    expect(root).toHaveAttribute('data-england-and-wales-event-count', '1')
    expect(root).toHaveAttribute('data-scotland-event-count', '1')
    expect(root).toHaveAttribute('data-northern-ireland-event-count', '1')
    expect(root).toHaveTextContent('England and Wales')
    expect(root).toHaveTextContent('Scotland')
    expect(root).toHaveTextContent('Northern Ireland')
    expect(root).toHaveTextContent('GOV.UK bunting flag: no')
    expect(root).toHaveTextContent('does not infer leave entitlement')
  })

  it('accepts only the exact bodyless HTTPS GOV.UK JSON request', () => {
    expect(isExactUkBankHolidaysRequest(exactRequest)).toBe(true)
    const rejected: ExecutedRequestContext[] = [
      { method: 'POST', url: exactRequest.url },
      { method: 'GET', url: exactRequest.url, body: {} },
      { method: 'GET', url: `${exactRequest.url}?foo=bar` },
      { method: 'GET', url: `${exactRequest.url}/` },
      { method: 'GET', url: `${exactRequest.url}#calendar` },
      { method: 'GET', url: 'http://www.gov.uk/bank-holidays.json' },
      { method: 'GET', url: 'https://gov.uk/bank-holidays.json' },
      { method: 'GET', url: 'https://user:pass@www.gov.uk/bank-holidays.json' },
      { method: 'GET', url: 'https://www.gov.uk:8443/bank-holidays.json' },
    ]
    for (const request of rejected) expect(isExactUkBankHolidaysRequest(request), request.url).toBe(false)
  })

  it('withholds malformed and duplicate events while preserving trustworthy divisions as partial', async () => {
    const trusted = event("New Year’s Day", `${futureYear}-01-01`)
    const data = payload({
      'england-and-wales': { division: 'england-and-wales', events: [trusted, trusted, event('Malformed bunting', `${futureYear}-05-01`, { bunting: 'true' })] },
      metadata: { ignored: true },
    })
    expect(parseUkBankHolidaysResponse(data, exactRequest).result).toMatchObject({
      providerEventCount: 5,
      trustedEventCount: 3,
      malformedEventCount: 1,
      duplicateEventCount: 1,
      unexpectedRootKeyCount: 1,
    })
    render(<ResponseDemoPreview api={api} executedRequest={exactRequest} data={data}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-malformed-event-count', '1')
    expect(root).toHaveAttribute('data-duplicate-event-count', '1')
    expect(root).toHaveAttribute('data-unexpected-root-key-count', '1')
    expect(root).not.toHaveTextContent('Malformed bunting')
  })

  it('fails closed when a documented division envelope is missing or unusable', async () => {
    const missing = payload()
    delete (missing as Partial<typeof missing>).scotland
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={exactRequest} data={missing}/>)
    await screen.findByText('Invalid GOV.UK Bank Holidays response')
    let root = document.querySelector('[data-domain-card="govuk-bank-holiday-calendar"]') as HTMLElement
    expect(root).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} executedRequest={exactRequest} data={payload({
      scotland: { division: 'scotland', events: [event('Bad date', 'not-a-date')] },
    })}/>)
    await screen.findByText('Incomplete bank holiday evidence')
    root = document.querySelector('[data-domain-card="govuk-bank-holiday-calendar"]') as HTMLElement
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-unusable-division-count', '1')
    expect(root).not.toHaveTextContent('Bad date')
  })

  it('maps a coherent all-division empty response to empty', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={exactRequest} data={payload({
      'england-and-wales': { division: 'england-and-wales', events: [] },
      scotland: { division: 'scotland', events: [] },
      'northern-ireland': { division: 'northern-ireland', events: [] },
    })}/>)
    await screen.findByText('No bank holidays returned')
    const root = document.querySelector('[data-domain-card="govuk-bank-holiday-calendar"]') as HTMLElement
    expect(root).toHaveAttribute('data-result-state', 'empty')
    expect(root).toHaveAttribute('data-trusted-event-count', '0')
  })

  it('does not trust a provider-tolerated URL variant merely because it returned HTTP 200', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={{ method: 'GET', url: `${exactRequest.url}?foo=bar` }} data={payload()}/>)
    await screen.findByText('Invalid GOV.UK Bank Holidays response')
    const root = document.querySelector('[data-domain-card="govuk-bank-holiday-calendar"]') as HTMLElement
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-request-bound', 'false')
    expect(root).not.toHaveTextContent("New Year’s Day")
  })
})
