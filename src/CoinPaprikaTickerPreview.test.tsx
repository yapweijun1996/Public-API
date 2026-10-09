import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('coinpaprika-ticker')!

const executedRequest = (
  coin = 'btc-bitcoin',
  overrides: Partial<ExecutedRequestContext> = {},
): ExecutedRequestContext => ({
  method: 'GET',
  url: api.buildUrl({ coin }),
  ...overrides,
})

const usdQuote = (overrides: Record<string, unknown> = {}) => ({
  price: 116234.52,
  volume_24h: 49876543210,
  market_cap: 2314567890123,
  percent_change_24h: -1.25,
  ...overrides,
})

const ticker = (overrides: Record<string, unknown> = {}) => ({
  id: 'btc-bitcoin',
  name: 'Bitcoin',
  symbol: 'BTC',
  last_updated: '2026-09-15T04:05:06Z',
  quotes: { USD: usdQuote() },
  ...overrides,
})

const renderPreview = (data: unknown, request = executedRequest()) => {
  render(<ResponseDemoPreview api={api} data={data} requestUrl={request.url} executedRequest={request}/>)
  const region = screen.getByRole('region', { name: 'CoinPaprika Ticker' })
  const card = region.querySelector('[data-domain-card="coinpaprika-ticker"]')
  expect(card).not.toBeNull()
  return { region, card: card as HTMLElement }
}

afterEach(cleanup)

describe('CoinPaprika Ticker semantic preview', () => {
  it('binds native-number USD market evidence to the exact executed ticker request', () => {
    const { region, card } = renderPreview(ticker())

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-method', 'GET')
    expect(card).toHaveAttribute('data-request-coin', 'btc-bitcoin')
    expect(card).toHaveAttribute('data-request-quote', 'USD')
    expect(card).toHaveAttribute('data-envelope-contract', 'true')
    expect(card).toHaveAttribute('data-id-contract', 'true')
    expect(card).toHaveAttribute('data-quote-contract', 'true')
    expect(card).toHaveAttribute('data-native-number-count', '4')
    expect(card).toHaveAttribute('data-native-number-contract', 'true')
    expect(card).toHaveAttribute('data-timestamp-contract', 'true')
    expect(card).toHaveAttribute('data-primary-id', 'btc-bitcoin')
    expect(card).toHaveAttribute('data-primary-price', '116234.52')
    expect(region).toHaveTextContent('Bitcoin · BTC')
    expect(region).toHaveTextContent('USD 116,234.52')
    expect(region).toHaveTextContent('-1.25%')
    expect(region).toHaveTextContent('2026-09-15T04:05:06.000Z')
  })

  it('supports another catalog-selected coin and requires exact response identity', () => {
    const ethereum = ticker({ id: 'eth-ethereum', name: 'Ethereum', symbol: 'ETH' })
    const { region, card } = renderPreview(ethereum, executedRequest('eth-ethereum'))

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-coin', 'eth-ethereum')
    expect(card).toHaveAttribute('data-primary-id', 'eth-ethereum')
    expect(region).toHaveTextContent('Ethereum · ETH')
  })

  it('withholds numeric strings instead of coercing them into native market evidence', () => {
    const { region, card } = renderPreview(ticker({ quotes: { USD: usdQuote({ price: '99999' }) } }))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-native-number-count', '3')
    expect(card).toHaveAttribute('data-malformed-metric-count', '1')
    expect(card).toHaveAttribute('data-native-number-contract', 'false')
    expect(region).toHaveTextContent('Price unavailable')
    expect(region).not.toHaveTextContent('99,999')
  })

  it('keeps documented empty strings distinct from absent and malformed values', () => {
    const { region, card } = renderPreview(ticker({
      quotes: { USD: usdQuote({ price: '', market_cap: undefined, volume_24h: null }) },
    }))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-empty-string-metric-count', '1')
    expect(card).toHaveAttribute('data-missing-metric-count', '2')
    expect(card).toHaveAttribute('data-malformed-metric-count', '0')
    expect(region).toHaveTextContent('Unavailable')
    expect(region).not.toHaveTextContent('USD 0')
  })

  it('marks an incomplete quote partial when at least one trustworthy metric remains', () => {
    const { region, card } = renderPreview(ticker({
      quotes: { USD: { price: 0, market_cap: undefined } },
    }))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-native-number-count', '1')
    expect(card).toHaveAttribute('data-missing-metric-count', '3')
    expect(card).toHaveAttribute('data-primary-price', '0')
    expect(region).toHaveTextContent('USD 0')
    expect(region).toHaveTextContent('Partial response')
  })

  it('withholds a malformed timestamp without invalidating otherwise trustworthy metrics', () => {
    const { region, card } = renderPreview(ticker({ last_updated: '2026-02-30T04:05:06Z' }))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-timestamp-count', '0')
    expect(card).toHaveAttribute('data-malformed-timestamp-count', '1')
    expect(card).toHaveAttribute('data-timestamp-contract', 'false')
    expect(region).toHaveTextContent('Last updated unavailable')
    expect(region).not.toHaveTextContent('2026-03-02')
  })

  it('fails closed when provider identity does not match the selected path id', () => {
    const { region, card } = renderPreview(ticker({ id: 'eth-ethereum', name: 'Ethereum', symbol: 'ETH' }))

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-id-contract', 'false')
    expect(card).toHaveAttribute('data-valid-ticker-count', '0')
    expect(card).toHaveAttribute('data-invalid-ticker-count', '1')
    expect(region).toHaveTextContent('CoinPaprika evidence unavailable')
    expect(region).not.toHaveTextContent('116,234.52')
  })

  it('fails closed for expanded, non-GET, or body-bearing requests', () => {
    const expanded = executedRequest('btc-bitcoin', { url: `${api.buildUrl({ coin: 'btc-bitcoin' })}?quotes=USD` })
    const nonGet = executedRequest('btc-bitcoin', { method: 'POST' })
    const bodyBearing = executedRequest('btc-bitcoin', { body: '{}' })

    for (const request of [expanded, nonGet, bodyBearing]) {
      const { region, card } = renderPreview(ticker(), request)
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
      expect(region).toHaveTextContent('CoinPaprika evidence unavailable')
      cleanup()
    }
  })

  it('fails closed for malformed HTTP-success envelopes', () => {
    const { region, card } = renderPreview([ticker()])

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-envelope-contract', 'false')
    expect(card).toHaveAttribute('data-valid-ticker-count', '0')
    expect(region).not.toHaveTextContent('116,234.52')
  })

  it('treats a request-bound quote with only documented unavailable values as empty', () => {
    const { region, card } = renderPreview(ticker({
      last_updated: '',
      quotes: { USD: { price: '', volume_24h: '', market_cap: '', percent_change_24h: '' } },
    }))

    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-native-number-count', '0')
    expect(card).toHaveAttribute('data-empty-string-metric-count', '4')
    expect(card).toHaveAttribute('data-empty-string-timestamp-count', '1')
    expect(region).toHaveTextContent('No USD market values returned')
    expect(region).not.toHaveTextContent('USD 0')
  })
})
