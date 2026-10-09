import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('coingecko-keyless-market')!

const executedRequest = (coin = 'bitcoin', currency = 'usd', suffix = ''): ExecutedRequestContext => ({
  method: 'GET',
  url: `${api.buildUrl({ coin, currency })}${suffix}`,
})

const quote = (currency = 'usd', overrides: Record<string, unknown> = {}) => ({
  [currency]: 65000,
  [`${currency}_market_cap`]: 1280000000000,
  [`${currency}_24h_vol`]: 35000000000,
  [`${currency}_24h_change`]: 2.5,
  last_updated_at: 1789438053,
  ...overrides,
})

const renderPreview = (data: unknown, request = executedRequest()) => {
  render(<ResponseDemoPreview api={api} data={data} requestUrl={request.url} executedRequest={request}/>)
  const region = screen.getByRole('region', { name: 'CoinGecko Keyless Market' })
  const card = region.querySelector('[data-domain-card="coingecko-keyless-market"]')
  expect(card).not.toBeNull()
  return { region, card: card as HTMLElement }
}

afterEach(cleanup)

describe('CoinGecko Keyless Market semantic preview', () => {
  it('binds native-number market metrics to the exact executed coin/currency request', () => {
    const { region, card } = renderPreview({ bitcoin: quote() })

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-coin', 'bitcoin')
    expect(card).toHaveAttribute('data-request-currency', 'usd')
    expect(card).toHaveAttribute('data-provider-coin-count', '1')
    expect(card).toHaveAttribute('data-valid-coin-count', '1')
    expect(card).toHaveAttribute('data-invalid-coin-count', '0')
    expect(card).toHaveAttribute('data-malformed-metric-count', '0')
    expect(card).toHaveAttribute('data-native-number-contract', 'true')
    expect(card).toHaveAttribute('data-primary-coin', 'bitcoin')
    expect(card).toHaveAttribute('data-primary-price', '65000')
    expect(region).toHaveTextContent('Bitcoin · USD')
    expect(region).toHaveTextContent('+2.5%')
  })

  it('withholds numeric-string metrics instead of coercing them into trusted market evidence', () => {
    const { region, card } = renderPreview({ bitcoin: quote('usd', { usd: '99999' }) })

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-coin-count', '1')
    expect(card).toHaveAttribute('data-malformed-metric-count', '1')
    expect(card).toHaveAttribute('data-native-number-contract', 'false')
    expect(region).not.toHaveTextContent('99,999')
  })

  it('does not manufacture zero for missing market metrics', () => {
    const { region, card } = renderPreview({ bitcoin: quote('usd', { usd_market_cap: undefined, usd_24h_vol: null }) })

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-missing-metric-count', '2')
    expect(region).toHaveTextContent('Unavailable')
    expect(region).not.toHaveTextContent('$0')
  })

  it('fails closed when the payload contains only the wrong coin identity', () => {
    const { region, card } = renderPreview({ ethereum: quote() })

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-valid-coin-count', '0')
    expect(card).toHaveAttribute('data-invalid-coin-count', '1')
    expect(region).not.toHaveTextContent('65,000')
  })

  it('marks unexpected extra coin identities partial while keeping the requested coin', () => {
    const { region, card } = renderPreview({ bitcoin: quote(), ethereum: quote() })

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-coin-count', '1')
    expect(card).toHaveAttribute('data-invalid-coin-count', '1')
    expect(region).not.toHaveTextContent('Ethereum')
  })

  it('keeps a structurally valid empty snapshot empty instead of fabricating zero', () => {
    const { region, card } = renderPreview({})

    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-provider-coin-count', '0')
    expect(region).toHaveTextContent('No market snapshot returned')
    expect(region).not.toHaveTextContent('$0')
  })

  it('fails closed when the executed request expands or changes the supported contract', () => {
    const { region, card } = renderPreview({ bitcoin: quote() }, executedRequest('bitcoin', 'usd', '&precision=full'))

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(region).toHaveTextContent('CoinGecko evidence unavailable')
  })

  it('binds a supported alternate currency without trusting the wrong metric keys', () => {
    const { region, card } = renderPreview({ bitcoin: quote('sgd', { usd: 99999 }) }, executedRequest('bitcoin', 'sgd'))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-currency', 'sgd')
    expect(card).toHaveAttribute('data-primary-price', '65000')
    expect(card).toHaveAttribute('data-invalid-metric-count', '1')
    expect(region).toHaveTextContent('Bitcoin · SGD')
    expect(region).not.toHaveTextContent('99,999')
  })
})
