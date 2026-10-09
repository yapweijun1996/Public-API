import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('bls-timeseries')!

const executedRequest = (series = 'LNS14000000', suffix = ''): ExecutedRequestContext => ({
  method: 'GET',
  url: `https://api.bls.gov/publicAPI/v1/timeseries/data/${series}${suffix}`,
})

const row = (year: unknown, period: unknown, periodName: unknown, value: unknown) => ({
  year,
  period,
  periodName,
  value,
  footnotes: [{}],
})

const response = (
  rows: unknown[],
  overrides: Partial<{ status: unknown; responseTime: unknown; message: unknown; seriesID: string }> = {},
) => ({
  status: overrides.status ?? 'REQUEST_SUCCEEDED',
  responseTime: overrides.responseTime ?? 18,
  message: overrides.message ?? [],
  Results: {
    series: [{ seriesID: overrides.seriesID ?? 'LNS14000000', data: rows }],
  },
})

const documentedArrayResponse = (rows: unknown[]) => ({
  status: 'REQUEST_SUCCEEDED',
  responseTime: 18,
  message: [],
  Results: [{
    series: [{ seriesID: 'LNS14000000', data: rows }],
  }],
})

const renderPreview = (data: unknown, request = executedRequest()) => {
  render(<ResponseDemoPreview api={api} data={data} requestUrl={request.url} executedRequest={request}/>)
  const region = screen.getByRole('region', { name: 'BLS Labor Statistics' })
  const card = region.querySelector('[data-domain-card="bls-timeseries"]')
  expect(card).not.toBeNull()
  return { region, card: card as HTMLElement }
}

afterEach(cleanup)

describe('BLS time-series semantic preview', () => {
  it('binds documented decimal-string rows to the exact executed series request', () => {
    const { region, card } = renderPreview(response([
      row('2026', 'M02', 'February', '4.1'),
      row('2026', 'M01', 'January', '4.0'),
      row('2025', 'M13', 'Annual', '4.2'),
      row('2025', 'M12', 'December', '4.1'),
    ]))

    expect(region).toHaveAttribute('data-preview-layout', 'labor-timeseries')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-series', 'LNS14000000')
    expect(card).toHaveAttribute('data-provider-series', 'LNS14000000')
    expect(card).toHaveAttribute('data-status-contract', 'true')
    expect(card).toHaveAttribute('data-results-shape', 'object')
    expect(card).toHaveAttribute('data-message-contract', 'true')
    expect(card).toHaveAttribute('data-response-time-contract', 'true')
    expect(card).toHaveAttribute('data-series-identity-contract', 'true')
    expect(card).toHaveAttribute('data-row-uniqueness-contract', 'true')
    expect(card).toHaveAttribute('data-row-order-contract', 'true')
    expect(card).toHaveAttribute('data-period-contract', 'true')
    expect(card).toHaveAttribute('data-decimal-string-contract', 'true')
    expect(card).toHaveAttribute('data-provider-row-count', '4')
    expect(card).toHaveAttribute('data-valid-row-count', '4')
    expect(card).toHaveAttribute('data-primary-period', '2026-M02')
    expect(card).toHaveAttribute('data-primary-value', '4.1')
    expect(region).toHaveTextContent('February 2026')
    expect(region).toHaveTextContent('Annual 2025')
  })

  it('also accepts the one-element Results array shown by the official Version 1.0 signature documentation', () => {
    const { card } = renderPreview(documentedArrayResponse([
      row('2026', 'M01', 'January', '4.0'),
    ]))

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-results-shape', 'array')
    expect(card).toHaveAttribute('data-series-identity-contract', 'true')
  })

  it('distinguishes missing values from malformed numbers and preserves trusted rows', () => {
    const { region, card } = renderPreview(response([
      row('2026', 'M03', 'March', '-'),
      row('2026', 'M02', 'February', 9.9),
      row('2026', 'M01', 'January', '-0.1'),
    ]))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-row-count', '3')
    expect(card).toHaveAttribute('data-valid-value-count', '1')
    expect(card).toHaveAttribute('data-missing-value-count', '1')
    expect(card).toHaveAttribute('data-malformed-value-count', '1')
    expect(card).toHaveAttribute('data-decimal-string-contract', 'false')
    expect(card).toHaveAttribute('data-primary-period', '2026-M03')
    expect(card).not.toHaveAttribute('data-primary-value')
    expect(region).toHaveTextContent('Value unavailable')
    expect(region).not.toHaveTextContent('9.9')
  })

  it('keeps a canonical provider zero instead of treating it as absent', () => {
    const { region, card } = renderPreview(response([
      row('2026', 'M01', 'January', '0.0'),
    ]))

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-primary-value', '0.0')
    expect(region).toHaveTextContent('0.0')
  })

  it('keeps a coherent empty series empty without manufacturing zero', () => {
    const { region, card } = renderPreview(response([]))

    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-provider-row-count', '0')
    expect(region).toHaveTextContent('No observations returned')
    expect(region).not.toHaveTextContent('0.00')
  })

  it('fails closed when the provider series does not match the executed request', () => {
    const { region, card } = renderPreview(response([
      row('2026', 'M01', 'January', '4.0'),
    ], { seriesID: 'CUUR0000SA0' }))

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-series-identity-contract', 'false')
    expect(region).toHaveTextContent('BLS evidence unavailable')
    expect(region).not.toHaveTextContent('4.0')
  })

  it('fails closed for a provider-domain message despite an HTTP-success status', () => {
    const { region, card } = renderPreview(response([], {
      message: ['Invalid Series for Series LNS14000000'],
    }))

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-message-contract', 'false')
    expect(region).toHaveTextContent('BLS evidence unavailable')
  })

  it.each([
    ['wrong status', response([row('2026', 'M01', 'January', '4.0')], { status: 'REQUEST_FAILED' })],
    ['string response time', response([row('2026', 'M01', 'January', '4.0')], { responseTime: '18' })],
    ['malformed Results envelope', { status: 'REQUEST_SUCCEEDED', responseTime: 18, message: [], Results: [] }],
  ])('fails closed for a malformed %s envelope', (_label, data) => {
    const { region, card } = renderPreview(data)

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(region).toHaveTextContent('BLS evidence unavailable')
    expect(region).not.toHaveTextContent('4.0')
  })

  it('marks duplicate, out-of-order, and period-name-invalid rows partial without misaligning values', () => {
    const { region, card } = renderPreview(response([
      row('2026', 'M01', 'January', '4.0'),
      row('2026', 'M03', 'March', '99.9'),
      row('2026', 'M01', 'January', '88.8'),
      row('2025', 'M12', 'Not December', '77.7'),
    ]))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-row-order-contract', 'false')
    expect(card).toHaveAttribute('data-row-uniqueness-contract', 'false')
    expect(card).toHaveAttribute('data-period-contract', 'false')
    expect(card).toHaveAttribute('data-valid-row-count', '1')
    expect(card).toHaveAttribute('data-invalid-row-count', '3')
    expect(card).toHaveAttribute('data-primary-period', '2026-M03')
    expect(card).toHaveAttribute('data-primary-value', '99.9')
    expect(region).not.toHaveTextContent('88.8')
    expect(region).not.toHaveTextContent('77.7')
  })

  it('rejects an expanded or non-catalog executed request before trusting provider data', () => {
    const { region, card } = renderPreview(
      response([row('2026', 'M01', 'January', '4.0')]),
      executedRequest('LNS14000000', '?latest=true'),
    )

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(region).not.toHaveTextContent('4.0')
  })
})
