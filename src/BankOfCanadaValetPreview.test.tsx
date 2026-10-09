import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('bank-of-canada-valet')!

const executedRequest = (overrides: Partial<{ series: string; start: string; end: string; suffix: string }> = {}): ExecutedRequestContext => ({
  method: 'GET',
  url: `https://www.bankofcanada.ca/valet/observations/${overrides.series ?? 'FXUSDCAD'}/json?start_date=${overrides.start ?? '2026-09-01'}&end_date=${overrides.end ?? '2026-09-05'}${overrides.suffix ?? ''}`,
})

const response = (observations: unknown[], series = 'FXUSDCAD') => ({
  terms: { url: 'https://www.bankofcanada.ca/terms/' },
  seriesDetail: {
    [series]: {
      label: 'USD/CAD',
      description: 'Daily average exchange rate: daily value of the US dollar expressed in Canadian dollars, for 1 unit of US dollar',
      dimension: { key: 'd', name: 'Date' },
    },
  },
  observations,
})

const observation = (date: string, value: unknown, series = 'FXUSDCAD') => ({
  d: date,
  [series]: { v: value },
})

const renderPreview = (data: unknown, request = executedRequest()) => {
  render(<ResponseDemoPreview api={api} data={data} requestUrl={request.url} executedRequest={request}/>)
  const region = screen.getByRole('region', { name: 'Bank of Canada Valet' })
  const card = region.querySelector('[data-domain-card="bank-of-canada-series"]')
  expect(card).not.toBeNull()
  return { region, card: card as HTMLElement }
}

afterEach(cleanup)

describe('Bank of Canada Valet semantic preview', () => {
  it('binds documented decimal-string observations to the exact executed request', () => {
    const { region, card } = renderPreview(response([
      observation('2026-09-01', '1.3896'),
      observation('2026-09-02', '1.3863'),
      observation('2026-09-03', '1.3789'),
      observation('2026-09-04', '1.3840'),
    ]))

    expect(region).toHaveAttribute('data-preview-layout', 'central-bank-series')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-series', 'FXUSDCAD')
    expect(card).toHaveAttribute('data-request-start-date', '2026-09-01')
    expect(card).toHaveAttribute('data-request-end-date', '2026-09-05')
    expect(card).toHaveAttribute('data-provider-series', 'FXUSDCAD')
    expect(card).toHaveAttribute('data-provider-record-count', '4')
    expect(card).toHaveAttribute('data-valid-record-count', '4')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-malformed-value-count', '0')
    expect(card).toHaveAttribute('data-series-identity-contract', 'true')
    expect(card).toHaveAttribute('data-date-range-contract', 'true')
    expect(card).toHaveAttribute('data-decimal-string-contract', 'true')
    expect(card).toHaveAttribute('data-primary-date', '2026-09-04')
    expect(card).toHaveAttribute('data-primary-value', '1.3840')
    expect(region).toHaveTextContent('USD/CAD')
    expect(region).toHaveTextContent('1.3840')
  })

  it('withholds wrong-series rows and non-string numeric values instead of coercing them', () => {
    const { region, card } = renderPreview(response([
      observation('2026-09-01', '1.3896'),
      observation('2026-09-02', 99.9999),
      observation('2026-09-03', '8.8888', 'FXEURCAD'),
      observation('2026-09-04', '1.3840'),
    ]))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-record-count', '2')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveAttribute('data-malformed-value-count', '1')
    expect(card).toHaveAttribute('data-decimal-string-contract', 'false')
    expect(region).not.toHaveTextContent('99.9999')
    expect(region).not.toHaveTextContent('8.8888')
  })

  it('distinguishes an unavailable provider value from a malformed decimal value', () => {
    const { region, card } = renderPreview(response([
      observation('2026-09-01', '1.3896'),
      observation('2026-09-02', null),
      observation('2026-09-03', 'not-a-decimal'),
      observation('2026-09-04', '1.3840'),
    ]))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-record-count', '2')
    expect(card).toHaveAttribute('data-missing-value-count', '1')
    expect(card).toHaveAttribute('data-malformed-value-count', '1')
    expect(card).toHaveAttribute('data-decimal-string-contract', 'false')
    expect(region).not.toHaveTextContent('not-a-decimal')
  })

  it('keeps a valid empty observations array empty without manufacturing a zero', () => {
    const { region, card } = renderPreview(response([]))

    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-provider-record-count', '0')
    expect(region).toHaveTextContent('No observations returned')
    expect(region).not.toHaveTextContent('0.0000')
  })

  it('fails closed when series metadata does not identify the executed series', () => {
    const { region, card } = renderPreview(response([observation('2026-09-01', '1.3896')], 'FXEURCAD'))

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-series-identity-contract', 'false')
    expect(region).toHaveTextContent('Bank of Canada evidence unavailable')
    expect(region).not.toHaveTextContent('1.3896')
  })

  it('fails closed when the executed URL expands the supported request surface', () => {
    const { region, card } = renderPreview(response([observation('2026-09-01', '1.3896')]), executedRequest({ suffix: '&recent=10' }))

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(region).toHaveTextContent('Bank of Canada evidence unavailable')
  })

  it('marks duplicate and out-of-range dates partial while keeping trustworthy rows', () => {
    const { region, card } = renderPreview(response([
      observation('2026-08-31', '9.9999'),
      observation('2026-09-01', '1.3896'),
      observation('2026-09-01', '1.3897'),
      observation('2026-09-04', '1.3840'),
    ]))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-record-count', '2')
    expect(card).toHaveAttribute('data-invalid-record-count', '2')
    expect(card).toHaveAttribute('data-date-range-contract', 'false')
    expect(region).not.toHaveTextContent('9.9999')
  })
})
