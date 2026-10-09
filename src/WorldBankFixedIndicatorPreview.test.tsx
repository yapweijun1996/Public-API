import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog, type ApiDemo } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const fixedApi = (id: 'world-bank-gdp' | 'world-bank-population') => {
  const match = apiCatalog.find((candidate) => candidate.id === id)
  if (!match) throw new Error(`Missing ${id} fixture`)
  return match
}

const identity = (api: ApiDemo) => api.id === 'world-bank-gdp'
  ? { indicator: 'NY.GDP.MKTP.CD', name: 'GDP (current US$)' }
  : { indicator: 'SP.POP.TOTL', name: 'Population, total' }

const row = (api: ApiDemo, year: number, value: unknown, overrides: Record<string, unknown> = {}) => ({
  indicator: { id: identity(api).indicator, value: identity(api).name },
  country: { id: 'SG', value: 'Singapore' },
  countryiso3code: 'SGP',
  date: String(year),
  value,
  unit: '',
  obs_status: '',
  decimal: api.id === 'world-bank-gdp' ? 0 : 0,
  ...overrides,
})

const rows = (api: ApiDemo, values: unknown[] = Array.from({ length: 8 }, (_, index) => 100 + index)) =>
  values.map((value, index) => row(api, 2025 - index, value))

const response = (api: ApiDemo, values?: unknown[], metadata: Record<string, unknown> = {}): [Record<string, unknown>, Array<Record<string, unknown>>] => [
  { page: 1, pages: 1, per_page: 8, total: 8, sourceid: '2', lastupdated: '2026-07-13', ...metadata },
  rows(api, values),
]

const renderFixed = (api: ApiDemo, data: unknown = response(api), url = api.buildUrl({})) =>
  render(<ResponseDemoPreview api={api} executedRequest={{ url, method: 'GET' }} data={data}/>)

const region = (api: ApiDemo) => screen.getByRole('region', { name: api.name })
const card = (api: ApiDemo) => region(api).querySelector('[data-domain-card="world-bank-indicator-series"]')

describe('fixed World Bank indicator semantic previews', () => {
  afterEach(cleanup)

  it.each([
    ['world-bank-gdp', 'NY.GDP.MKTP.CD'],
    ['world-bank-population', 'SP.POP.TOTL'],
  ] as const)('binds %s to an exact most-recent-eight World Bank V2 request', async (id, indicator) => {
    const api = fixedApi(id)
    const url = new URL(api.buildUrl({}))
    expect(url.searchParams.get('mrv')).toBe('8')
    expect(url.searchParams.get('per_page')).toBe('8')
    renderFixed(api)
    await waitFor(() => expect(card(api)).toBeInTheDocument())

    expect(region(api)).toHaveAttribute('data-preview-layout', 'indicator-series')
    expect(card(api)).toHaveAttribute('data-result-state', 'ready')
    expect(card(api)).toHaveAttribute('data-request-bound', 'true')
    expect(card(api)).toHaveAttribute('data-request-mode', 'mrv')
    expect(card(api)).toHaveAttribute('data-request-country-code', 'SGP')
    expect(card(api)).toHaveAttribute('data-request-indicator', indicator)
    expect(card(api)).toHaveAttribute('data-request-mrv', '8')
    expect(card(api)).toHaveAttribute('data-provider-page', '1')
    expect(card(api)).toHaveAttribute('data-provider-pages', '1')
    expect(card(api)).toHaveAttribute('data-provider-per-page', '8')
    expect(card(api)).toHaveAttribute('data-provider-total', '8')
    expect(card(api)).toHaveAttribute('data-year-order-contract', 'true')
    expect(card(api)).toHaveAttribute('data-row-identity-contract', 'true')
    expect(region(api)).toHaveTextContent('Singapore')
  })

  it('withholds a numeric-string GDP value instead of coercing it or fabricating zero', async () => {
    const api = fixedApi('world-bank-gdp')
    renderFixed(api, response(api, ['999.9', 107, 106, 105, 104, 103, 102, 101]))
    await waitFor(() => expect(card(api)).toBeInTheDocument())

    expect(card(api)).toHaveAttribute('data-result-state', 'partial')
    expect(card(api)).toHaveAttribute('data-malformed-observation-count', '1')
    expect(card(api)).toHaveAttribute('data-valid-observation-count', '7')
    expect(region(api)).not.toHaveTextContent('999.9')
    expect(region(api)).not.toHaveTextContent('0.00')
  })

  it('fails row identity closed for a wrong fixed-route country or indicator', async () => {
    const api = fixedApi('world-bank-population')
    const body = response(api)
    body[1][0] = row(api, 2025, 100, {
      indicator: { id: 'NY.GDP.MKTP.CD', value: 'GDP (current US$)' },
      country: { id: 'BR', value: 'Brazil' },
      countryiso3code: 'BRA',
    })
    renderFixed(api, body)
    await waitFor(() => expect(card(api)).toBeInTheDocument())

    expect(card(api)).toHaveAttribute('data-result-state', 'partial')
    expect(card(api)).toHaveAttribute('data-invalid-record-count', '1')
    expect(card(api)).toHaveAttribute('data-row-identity-contract', 'false')
    expect(region(api)).not.toHaveTextContent('Brazil')
    expect(region(api)).not.toHaveTextContent('GDP (current US$)')
  })

  it('fails closed for incoherent MRV pagination', async () => {
    const api = fixedApi('world-bank-gdp')
    renderFixed(api, response(api, undefined, { pages: 9, total: 66 }))
    await waitFor(() => expect(card(api)).toBeInTheDocument())

    expect(card(api)).toHaveAttribute('data-result-state', 'invalid')
    expect(card(api)).toHaveAttribute('data-pagination-contract', 'false')
    expect(region(api)).not.toHaveTextContent('107')
  })

  it('requires eight unique provider years in strict newest-to-oldest order', async () => {
    const api = fixedApi('world-bank-gdp')
    const body = response(api) as [Record<string, unknown>, Array<Record<string, unknown>>]
    ;[body[1][0], body[1][1]] = [body[1][1], body[1][0]]
    renderFixed(api, body)
    await waitFor(() => expect(card(api)).toBeInTheDocument())

    expect(card(api)).toHaveAttribute('data-result-state', 'partial')
    expect(card(api)).toHaveAttribute('data-year-order-contract', 'false')
    expect(card(api)).toHaveAttribute('data-row-identity-contract', 'false')
  })

  it('represents eight provider-owned null observations as empty without synthesizing zero', async () => {
    const api = fixedApi('world-bank-population')
    renderFixed(api, response(api, Array(8).fill(null)))
    await waitFor(() => expect(card(api)).toBeInTheDocument())

    expect(card(api)).toHaveAttribute('data-result-state', 'empty')
    expect(card(api)).toHaveAttribute('data-missing-observation-count', '8')
    expect(card(api)).toHaveAttribute('data-valid-observation-count', '0')
    expect(region(api)).toHaveTextContent('No observations available')
    expect(region(api)).not.toHaveTextContent('0.00')
  })

  it('rejects an expanded fixed executed request even when the HTTP-200 payload looks valid', async () => {
    const api = fixedApi('world-bank-gdp')
    renderFixed(api, response(api), `${api.buildUrl({})}&page=2`)
    await waitFor(() => expect(card(api)).toBeInTheDocument())

    expect(card(api)).toHaveAttribute('data-result-state', 'invalid')
    expect(card(api)).toHaveAttribute('data-request-bound', 'false')
  })
})
