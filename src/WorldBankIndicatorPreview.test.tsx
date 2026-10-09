import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'world-bank-indicator-explorer')
if (!api) throw new Error('Missing world-bank-indicator-explorer fixture')

const request = (country = 'SGP', startYear = '2020', endYear = '2022', method = 'GET') => ({
  url: api.buildUrl({ country, indicator: 'SP.DYN.LE00.IN', startYear, endYear }),
  method,
})

const row = (year: number, value: unknown, overrides: Record<string, unknown> = {}) => ({
  indicator: { id: 'SP.DYN.LE00.IN', value: 'Life expectancy at birth, total (years)' },
  country: { id: 'SG', value: 'Singapore' },
  countryiso3code: 'SGP',
  date: String(year),
  value,
  unit: '',
  obs_status: '',
  decimal: 1,
  ...overrides,
})

const response = (rows: unknown[], metadata: Record<string, unknown> = {}) => [
  { page: 1, pages: 1, per_page: '141', total: rows.length, sourceid: '2', lastupdated: '2026-06-24', ...metadata },
  rows,
]

const region = () => screen.getByRole('region', { name: 'World Bank Indicator Explorer' })
const card = () => region().querySelector('[data-domain-card="world-bank-indicator-series"]')

describe('World Bank Indicator Explorer semantic preview', () => {
  afterEach(cleanup)

  it('binds a complete V2 indicator series to the exact executed GET request', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={response([
      row(2022, 83.2), row(2021, 82.9), row(2020, 82.4),
    ])}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(region()).toHaveAttribute('data-preview-layout', 'indicator-series')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-request-bound', 'true')
    expect(card()).toHaveAttribute('data-request-method', 'GET')
    expect(card()).toHaveAttribute('data-request-country-code', 'SGP')
    expect(card()).toHaveAttribute('data-provider-country-alpha2', 'SG')
    expect(card()).toHaveAttribute('data-provider-country-alpha3', 'SGP')
    expect(card()).toHaveAttribute('data-request-indicator', 'SP.DYN.LE00.IN')
    expect(card()).toHaveAttribute('data-request-start-year', '2020')
    expect(card()).toHaveAttribute('data-request-end-year', '2022')
    expect(card()).toHaveAttribute('data-request-year-count', '3')
    expect(card()).toHaveAttribute('data-provider-record-count', '3')
    expect(card()).toHaveAttribute('data-valid-observation-count', '3')
    expect(card()).toHaveAttribute('data-envelope-contract', 'true')
    expect(card()).toHaveAttribute('data-pagination-contract', 'true')
    expect(card()).toHaveAttribute('data-year-range-contract', 'true')
    expect(card()).toHaveAttribute('data-row-identity-contract', 'true')
    expect(region()).toHaveTextContent('Life expectancy at birth, total (years)')
    expect(region()).toHaveTextContent('Singapore')
    expect(region()).toHaveTextContent('Latest observation')
    expect(region()).toHaveTextContent('83.2')
  })

  it('accepts an alpha-2 request only when every provider row has matching alpha-2 identity', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request('SG', '2021', '2022')} data={response([
      row(2022, 83.2), row(2021, 82.9),
    ])}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-request-country-code', 'SG')
    expect(card()).toHaveAttribute('data-country-identity-contract', 'true')
  })

  it('distinguishes missing observations from malformed values without fabricating zero', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={response([
      row(2022, null), row(2021, undefined), row(2020, 82.4),
    ])}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-missing-observation-count', '2')
    expect(card()).toHaveAttribute('data-malformed-observation-count', '0')
    expect(card()).toHaveAttribute('data-valid-observation-count', '1')
    expect(region()).not.toHaveTextContent('0.00')
  })

  it('rejects a numeric-string observation instead of coercing it into the chart', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={response([
      row(2022, '99.9'), row(2021, 82.9), row(2020, 82.4),
    ])}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-malformed-observation-count', '1')
    expect(card()).toHaveAttribute('data-valid-observation-count', '2')
    expect(region()).not.toHaveTextContent('99.9')
  })

  it('represents a complete all-null provider series as empty', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={response([
      row(2022, null), row(2021, null), row(2020, null),
    ])}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveAttribute('data-missing-observation-count', '3')
    expect(region()).toHaveTextContent('No observations available')
    expect(region()).not.toHaveTextContent('Latest observation')
  })

  it('withholds records carrying the wrong country and indicator identity', async () => {
    const wrongIdentity = row(2022, 83.2, {
      indicator: { id: 'SP.POP.TOTL', value: 'Population, total' },
      country: { id: 'BR', value: 'Brazil' },
      countryiso3code: 'BRA',
    })
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={response([
      wrongIdentity, row(2021, 82.9), row(2020, 82.4),
    ])}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-invalid-record-count', '1')
    expect(card()).toHaveAttribute('data-row-identity-contract', 'false')
    expect(card()).toHaveAttribute('data-year-range-contract', 'false')
    expect(region()).not.toHaveTextContent('Brazil')
    expect(region()).not.toHaveTextContent('Population, total')
  })

  it('marks a duplicate valid provider year partial and withholds the duplicate', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={response([
      row(2022, 83.2), row(2022, 83.1), row(2020, 82.4),
    ])}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-invalid-record-count', '1')
    expect(card()).toHaveAttribute('data-valid-record-count', '2')
    expect(card()).toHaveAttribute('data-year-range-contract', 'false')
  })

  it('accepts native numeric and canonical documented-string per_page metadata', async () => {
    const rows = [row(2022, 83.2), row(2021, 82.9), row(2020, 82.4)]
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={request()} data={response(rows)}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-provider-per-page', '141')

    rerender(<ResponseDemoPreview api={api} executedRequest={request()} data={response(rows, { per_page: 141 })}/>)
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-pagination-contract', 'true')
    expect(card()).toHaveAttribute('data-provider-per-page', '141')
  })

  it('fails closed for malformed pagination or an expanded/non-GET executed request', async () => {
    const rows = [row(2022, 83.2), row(2021, 82.9), row(2020, 82.4)]
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={request()} data={response(rows, { total: 42 })}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-pagination-contract', 'false')
    expect(region()).not.toHaveTextContent('83.2')

    for (const perPage of ['0141', '141.0', 141.5, 0, -141, true, Number.MAX_SAFE_INTEGER + 1]) {
      rerender(<ResponseDemoPreview api={api} executedRequest={request()} data={response(rows, { per_page: perPage })}/>)
      expect(card()).toHaveAttribute('data-result-state', 'invalid')
      expect(card()).toHaveAttribute('data-pagination-contract', 'false')
    }

    rerender(<ResponseDemoPreview api={api} executedRequest={request('SGP', '2020', '2022', 'POST')} data={response(rows)}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')

    const expanded = request()
    rerender(<ResponseDemoPreview api={api} executedRequest={{ ...expanded, url: `${expanded.url}&page=2` }} data={response(rows)}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')

    const outOfBoundsUrl = 'https://api.worldbank.org/v2/country/SGP/indicator/SP.DYN.LE00.IN?format=json&date=1900%3A1902&per_page=141'
    rerender(<ResponseDemoPreview api={api} executedRequest={{ url: outOfBoundsUrl, method: 'GET' }} data={response([
      row(1902, 51.2), row(1901, 51.1), row(1900, 51),
    ])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
  })

  it('does not claim provider identity when the V2 envelope is malformed', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={{ rows: [row(2022, 83.2)] }}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-envelope-contract', 'false')
    expect(card()).toHaveAttribute('data-country-identity-contract', 'false')
    expect(card()).toHaveAttribute('data-indicator-identity-contract', 'false')
  })
})
