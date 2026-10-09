import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('frankfurter-sgd-myr-history')!

const executedRequest = (suffix = '', group: 'month' | 'week' = 'month'): ExecutedRequestContext => ({
  method: 'GET',
  url: `https://api.frankfurter.dev/v2/rates?from=2026-01-01&to=2026-03-31&base=SGD&quotes=MYR&providers=ECB&group=${group}${suffix}`,
})

const rate = (date: string, value: unknown, base = 'SGD', quote = 'MYR') => ({
  date,
  base,
  quote,
  rate: value,
})

const renderPreview = (data: unknown, request = executedRequest()) => {
  render(<ResponseDemoPreview api={api} data={data} requestUrl={request.url} executedRequest={request}/>)
  const region = screen.getByRole('region', { name: 'SGD/MYR FX History' })
  const card = region.querySelector('[data-domain-card="frankfurter-fx-history"]')
  expect(card).not.toBeNull()
  return { region, card: card as HTMLElement }
}

afterEach(cleanup)

describe('Frankfurter SGD/MYR history semantic preview', () => {
  it('binds valid flat rate rows to the exact executed request', () => {
    const { region, card } = renderPreview([
      rate('2026-01-30', 3.1457),
      rate('2026-02-27', 3.1542),
      rate('2026-03-31', 3.1618),
    ])

    expect(region).toHaveAttribute('data-preview-layout', 'fx-history')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-method', 'GET')
    expect(card).toHaveAttribute('data-request-start-date', '2026-01-01')
    expect(card).toHaveAttribute('data-request-end-date', '2026-03-31')
    expect(card).toHaveAttribute('data-request-group', 'month')
    expect(card).toHaveAttribute('data-request-base', 'SGD')
    expect(card).toHaveAttribute('data-request-quote', 'MYR')
    expect(card).toHaveAttribute('data-request-provider', 'ECB')
    expect(card).toHaveAttribute('data-provider-record-count', '3')
    expect(card).toHaveAttribute('data-valid-record-count', '3')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-row-identity-contract', 'true')
    expect(card).toHaveAttribute('data-date-range-contract', 'true')
    expect(card).toHaveAttribute('data-unique-date-contract', 'true')
    expect(card).toHaveAttribute('data-native-positive-rate-contract', 'true')
    expect(card).toHaveAttribute('data-primary-date', '2026-03-31')
    expect(card).toHaveAttribute('data-primary-rate', '3.1618')
    expect(region).toHaveTextContent('SGD/MYR · ECB')
    expect(within(region).getByRole('list', { name: 'Frankfurter validated SGD/MYR rate evidence' })).toHaveTextContent('2026-03-31: 1 SGD = 3.1618 MYR; provider ECB')
  })

  it('withholds numeric-string rates instead of coercing them', () => {
    const { region, card } = renderPreview([
      rate('2026-01-30', 3.1457),
      rate('2026-02-27', '9.9999'),
      rate('2026-03-31', 3.1618),
    ])

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-record-count', '2')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveAttribute('data-malformed-rate-count', '1')
    expect(card).toHaveAttribute('data-native-positive-rate-contract', 'false')
    expect(region).not.toHaveTextContent('9.9999')
  })

  it('withholds wrong currency-pair rows while keeping exact identities', () => {
    const { region, card } = renderPreview([
      rate('2026-01-30', 3.1457),
      rate('2026-02-27', 9.9999, 'EUR', 'MYR'),
      rate('2026-03-31', 3.1618),
    ])

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-record-count', '2')
    expect(card).toHaveAttribute('data-wrong-identity-count', '1')
    expect(card).toHaveAttribute('data-row-identity-contract', 'false')
    expect(region).not.toHaveTextContent('9.9999')
  })

  it('withholds duplicate and out-of-range dates without inferring cadence', () => {
    const { region, card } = renderPreview([
      rate('2025-12-31', 9.9991),
      rate('2026-01-30', 3.1457),
      rate('2026-01-30', 9.9992),
      rate('2026-03-31', 3.1618),
    ])

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-record-count', '2')
    expect(card).toHaveAttribute('data-invalid-record-count', '2')
    expect(card).toHaveAttribute('data-out-of-range-count', '1')
    expect(card).toHaveAttribute('data-duplicate-date-count', '1')
    expect(card).toHaveAttribute('data-date-range-contract', 'false')
    expect(card).toHaveAttribute('data-unique-date-contract', 'false')
    expect(region).not.toHaveTextContent('9.9991')
    expect(region).not.toHaveTextContent('9.9992')
  })

  it('keeps a valid empty array empty without manufacturing a zero rate', () => {
    const { region, card } = renderPreview([])

    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-provider-record-count', '0')
    expect(card).toHaveAttribute('data-valid-record-count', '0')
    expect(region).toHaveTextContent('No rates returned')
    expect(region).not.toHaveTextContent('0.0000')
  })

  it('fails closed for a malformed non-array envelope', () => {
    const { region, card } = renderPreview({ rates: [rate('2026-01-30', 3.1457)] })

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-envelope-contract', 'false')
    expect(card).toHaveAttribute('data-valid-record-count', '0')
    expect(region).toHaveTextContent('Frankfurter evidence unavailable')
    expect(region).not.toHaveTextContent('3.1457')
  })

  it('fails closed when the executed URL contains an unexpected query key', () => {
    const { region, card } = renderPreview([rate('2026-01-30', 3.1457)], executedRequest('&limit=10'))

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-valid-record-count', '0')
    expect(region).toHaveTextContent('Frankfurter evidence unavailable')
    expect(region).not.toHaveTextContent('3.1457')
  })

  it('fails closed when a nonempty array has no trustworthy rows', () => {
    const { region, card } = renderPreview([
      rate('2026-01-30', '3.1457'),
      rate('2026-02-27', 0),
      rate('2026-03-31', -1),
    ])

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-provider-record-count', '3')
    expect(card).toHaveAttribute('data-valid-record-count', '0')
    expect(card).toHaveAttribute('data-invalid-record-count', '3')
    expect(card).toHaveAttribute('data-malformed-rate-count', '3')
    expect(region).not.toHaveTextContent('3.1457')
    expect(region).not.toHaveTextContent('MYR 0')
  })
})
