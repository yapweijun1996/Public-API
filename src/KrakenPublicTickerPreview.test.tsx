import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ApiDemo } from './apiCatalog'
import { KrakenPublicTickerPreview, krakenPublicTickerModel } from './previews/KrakenPublicTickerPreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const pairs = [
  ['XBTUSD', 'BTC/USD', 'BTC', 'USD'],
  ['ETHUSD', 'ETH/USD', 'ETH', 'USD'],
  ['SOLUSD', 'SOL/USD', 'SOL', 'USD'],
  ['XBTEUR', 'BTC/EUR', 'BTC', 'EUR'],
] as const

const providerPairByRequest = Object.fromEntries(pairs.map(([requestPair, providerPair]) => [requestPair, providerPair])) as Record<string, string>

const api: ApiDemo = {
  id: 'kraken-public-ticker',
  name: 'Kraken Public Ticker',
  provider: 'Kraken',
  category: 'Finance',
  description: 'Kraken public ticker snapshot.',
  documentationUrl: 'https://docs.kraken.com/api/docs/rest-api/get-ticker-information/',
  accent: '#5741d9',
  monogram: 'KR',
  fields: [{
    id: 'pair',
    label: 'Pair',
    type: 'select',
    defaultValue: 'XBTUSD',
    help: 'Kraken asset pair.',
    options: pairs.map(([value, label]) => ({ value, label })),
  }],
  buildUrl: ({ pair }) => `https://api.kraken.com/0/public/Ticker?pair=${pair}&assetVersion=1`,
}

const executedRequest = (pair = 'XBTUSD', url = api.buildUrl({ pair })): ExecutedRequestContext => ({
  method: 'GET',
  url,
})

const ticker = (overrides: Record<string, unknown> = {}) => ({
  a: ['65010.10000', '1', '1.000'],
  b: ['65000.00000', '2', '2.000'],
  c: ['65005.50000', '0.12500000'],
  v: ['1000.00000000', '2500.00000000'],
  p: ['64500.00000', '64750.00000'],
  t: [100, 321],
  l: ['63000.00000', '62000.00000'],
  h: ['66000.00000', '67000.00000'],
  o: '64000.00000',
  ...overrides,
})

const response = (pair = 'XBTUSD', value: unknown = ticker()) => ({
  error: [],
  result: { [providerPairByRequest[pair] ?? pair]: value },
})

const renderPreview = (data: unknown, request = executedRequest()) => {
  const rendered = render(<KrakenPublicTickerPreview api={api} data={data} executedRequest={request}/>)
  const card = rendered.container.querySelector('[data-domain-card="kraken-public-ticker"]')
  expect(card).not.toBeNull()
  return card as HTMLElement
}

afterEach(cleanup)

describe('Kraken Public Ticker semantic preview', () => {
  it('binds every documented ticker fact to the exact executed pair request', () => {
    const card = renderPreview(response())

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-pair', 'XBTUSD')
    expect(card).toHaveAttribute('data-provider-pair', 'BTC/USD')
    expect(card).toHaveAttribute('data-pair-identity-contract', 'true')
    expect(card).toHaveAttribute('data-base-currency', 'BTC')
    expect(card).toHaveAttribute('data-quote-currency', 'USD')
    expect(card).toHaveAttribute('data-primary-last', '65005.50000')
    expect(card).toHaveAttribute('data-primary-bid', '65000.00000')
    expect(card).toHaveAttribute('data-primary-ask', '65010.10000')
    expect(card).toHaveAttribute('data-open', '64000.00000')
    expect(card).toHaveAttribute('data-high-24h', '67000.00000')
    expect(card).toHaveAttribute('data-low-24h', '62000.00000')
    expect(card).toHaveAttribute('data-volume-24h', '2500.00000000')
    expect(card).toHaveAttribute('data-vwap-24h', '64750.00000')
    expect(card).toHaveAttribute('data-trades-24h', '321')
    expect(card).toHaveAttribute('data-missing-field-count', '0')
    expect(card).toHaveAttribute('data-malformed-field-count', '0')
    expect(card).toHaveTextContent('BTC/USD')
    expect(card).toHaveTextContent('65,005.50')
    expect(screen.getByText('Requested pair').nextElementSibling).toHaveTextContent('XBTUSD')
    expect(screen.getByText('Provider pair').nextElementSibling).toHaveTextContent('BTC/USD')
    expect(screen.getByText('Identity match').nextElementSibling).toHaveTextContent('Yes')
  })

  it.each(pairs)('maps %s to the stable %s identity', (pair, displayPair, base, quote) => {
    const card = renderPreview(response(pair), executedRequest(pair))

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-pair', pair)
    expect(card).toHaveAttribute('data-provider-pair', displayPair)
    expect(card).toHaveAttribute('data-base-currency', base)
    expect(card).toHaveAttribute('data-quote-currency', quote)
    expect(card).toHaveTextContent(displayPair)
  })

  it('keeps a valid requested ticker partial when unexpected result identities are present', () => {
    const card = renderPreview({ error: [], result: { 'BTC/USD': ticker(), 'ETH/USD': ticker({ c: ['99999', '1'] }) } })

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-pair-count', '2')
    expect(card).toHaveAttribute('data-unexpected-pair-count', '1')
    expect(card).toHaveAttribute('data-primary-last', '65005.50000')
    expect(card).not.toHaveTextContent('99,999')
  })

  it('fails closed when the result contains only the wrong ticker identity', () => {
    const card = renderPreview(response('ETHUSD'))

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-pair-identity-contract', 'false')
    expect(card).toHaveAttribute('data-provider-pair-count', '1')
    expect(card).toHaveAttribute('data-unexpected-pair-count', '1')
    expect(card).not.toHaveTextContent('65,005.50')
  })

  it('does not accept the internal request alias as the assetVersion=1 provider key', () => {
    const card = renderPreview({ error: [], result: { XBTUSD: ticker() } })

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-pair', 'XBTUSD')
    expect(card).toHaveAttribute('data-provider-pair', 'XBTUSD')
    expect(card).toHaveAttribute('data-pair-identity-contract', 'false')
  })

  it('treats a nonempty provider error array as domain-invalid even when result data exists', () => {
    const card = renderPreview({ error: ['EQuery:Unknown asset pair'], result: { 'BTC/USD': ticker() } })

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-provider-error-count', '1')
    expect(card).toHaveTextContent('Kraken returned a provider error')
    expect(card).not.toHaveTextContent('65,005.50')
  })

  it('recognizes the documented error-only failure envelope as a provider-domain error', () => {
    const card = renderPreview({ error: ['EGeneral:Internal error'] })

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-envelope-contract', 'true')
    expect(card).toHaveAttribute('data-error-contract', 'true')
    expect(card).toHaveAttribute('data-result-contract', 'false')
    expect(card).toHaveAttribute('data-provider-error-count', '1')
    expect(card).toHaveTextContent('Kraken returned a provider error')
  })

  it.each([
    ['non-record envelope', []],
    ['extra envelope key', { error: [], result: {}, warning: [] }],
    ['non-array error', { error: 'EGeneral:Invalid arguments', result: {} }],
    ['non-string error member', { error: [42], result: {} }],
    ['non-record result', { error: [], result: [] }],
  ])('fails closed for a malformed %s', (_label, data) => {
    const card = renderPreview(data)

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-envelope-contract', 'false')
    expect(card).not.toHaveTextContent('65,005.50')
  })

  it('keeps envelope validation distinct from a malformed requested ticker object', () => {
    const card = renderPreview({ error: [], result: { 'BTC/USD': [] } })

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-envelope-contract', 'true')
    expect(card).toHaveAttribute('data-pair-identity-contract', 'false')
  })

  it.each([
    ['native number', 65005],
    ['grouped decimal', '65,005.5'],
    ['leading-zero decimal', '065005.5'],
    ['negative decimal', '-1'],
    ['non-finite exponent', '1e9999'],
  ])('withholds a malformed %s instead of coercing it into last-price evidence', (_label, last) => {
    const card = renderPreview(response('XBTUSD', ticker({ c: [last, '0.125'] })))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-malformed-field-count', '1')
    expect(card).not.toHaveAttribute('data-primary-last')
    expect(card).toHaveTextContent('Last unavailable')
    expect(card).not.toHaveTextContent('65,005.00')
  })

  it.each([
    ['wrong ask slot count', { a: ['65010', '1'] }],
    ['scalar bid', { b: '65000' }],
    ['wrong close slot count', { c: ['65005'] }],
    ['numeric-string trade counts', { t: ['100', '321'] }],
    ['negative trade count', { t: [100, -1] }],
    ['fractional trade count', { t: [100, 1.5] }],
    ['unsafe trade count', { t: [100, Number.MAX_SAFE_INTEGER + 1] }],
  ])('marks %s malformed while preserving other trustworthy market facts', (label, overrides) => {
    const card = renderPreview(response('XBTUSD', ticker(overrides)))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-malformed-field-count', '1')
    if (label === 'wrong close slot count') expect(card).not.toHaveAttribute('data-primary-last')
    else expect(card).toHaveAttribute('data-primary-last', '65005.50000')
  })

  it('does not fabricate last, open, or zero when required fields are missing', () => {
    const card = renderPreview(response('XBTUSD', ticker({ c: undefined, o: undefined })))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-missing-field-count', '2')
    expect(card).not.toHaveAttribute('data-primary-last')
    expect(card).not.toHaveAttribute('data-open')
    expect(card).toHaveTextContent('Last unavailable')
    expect(card).toHaveTextContent('Unavailable')
    expect(card).not.toHaveTextContent('USD 0')
  })

  it('preserves documented true zero values, including trade counts', () => {
    const card = renderPreview(response('XBTUSD', ticker({
      a: ['0', '0', '0'],
      b: ['0', '0', '0'],
      c: ['0', '0'],
      v: ['0', '0'],
      p: ['0', '0'],
      t: [0, 0],
      l: ['0', '0'],
      h: ['0', '0'],
      o: '0',
    })))

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-primary-last', '0')
    expect(card).toHaveAttribute('data-open', '0')
    expect(card).toHaveAttribute('data-trades-24h', '0')
    expect(card).toHaveTextContent('USD 0')
  })

  it('fails closed when no trustworthy market fact remains', () => {
    const card = renderPreview(response('XBTUSD', {
      a: null,
      b: null,
      c: null,
      v: null,
      p: null,
      t: null,
      l: null,
      h: null,
      o: null,
    }))

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-trustworthy-fact-count', '0')
    expect(card).not.toHaveTextContent('USD 0')
  })

  it('keeps a coherent empty result empty without manufacturing a ticker or zero', () => {
    const card = renderPreview({ error: [], result: {} })

    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-provider-pair-count', '0')
    expect(card).toHaveTextContent('No ticker returned for BTC/USD')
    expect(card).not.toHaveTextContent('USD 0')
  })

  it.each([
    ['non-GET', { method: 'POST', url: api.buildUrl({ pair: 'XBTUSD' }) }],
    ['body-bearing', { method: 'GET', url: api.buildUrl({ pair: 'XBTUSD' }), body: {} }],
    ['HTTP', { method: 'GET', url: 'http://api.kraken.com/0/public/Ticker?pair=XBTUSD&assetVersion=1' }],
    ['wrong host', { method: 'GET', url: 'https://example.com/0/public/Ticker?pair=XBTUSD&assetVersion=1' }],
    ['explicit port', { method: 'GET', url: 'https://api.kraken.com:444/0/public/Ticker?pair=XBTUSD&assetVersion=1' }],
    ['credentials', { method: 'GET', url: 'https://user:pass@api.kraken.com/0/public/Ticker?pair=XBTUSD&assetVersion=1' }],
    ['wrong path', { method: 'GET', url: 'https://api.kraken.com/0/public/Tickers?pair=XBTUSD&assetVersion=1' }],
    ['hash', { method: 'GET', url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD&assetVersion=1#result' }],
    ['missing pair', { method: 'GET', url: 'https://api.kraken.com/0/public/Ticker?assetVersion=1' }],
    ['duplicate pair', { method: 'GET', url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD&pair=ETHUSD&assetVersion=1' }],
    ['unsupported pair', { method: 'GET', url: 'https://api.kraken.com/0/public/Ticker?pair=DOGEUSD&assetVersion=1' }],
    ['missing asset version', { method: 'GET', url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD' }],
    ['wrong asset version', { method: 'GET', url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD&assetVersion=2' }],
    ['duplicate asset version', { method: 'GET', url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD&assetVersion=1&assetVersion=1' }],
    ['extra query key', { method: 'GET', url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD&assetVersion=1&interval=1' }],
  ] satisfies [string, ExecutedRequestContext][])('rejects an inexact executed request: %s', (_label, request) => {
    const model = krakenPublicTickerModel(api, response(), request)

    expect(model.state).toBe('invalid')
    expect(model.request).toBeUndefined()
  })
})
