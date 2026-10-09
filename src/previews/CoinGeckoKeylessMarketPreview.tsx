import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { Sparkline } from './ChartPrimitives'
import { compactNumber, formatNumber, previewLabel } from './previewData'
import { finiteNumber, isRecord, nonNegativeSafeInteger } from './semanticValidation'

type CoinGeckoState = 'ready' | 'partial' | 'empty' | 'invalid'

type CoinGeckoRequest = {
  coin: string
  currency: string
}

type CoinMarket = {
  coin: string
  currency: string
  price?: number
  marketCap?: number
  volume24h?: number
  change24h?: number
  lastUpdatedAt?: number
}

type CoinGeckoViewModel = {
  state: CoinGeckoState
  reason?: string
  request?: CoinGeckoRequest
  envelopeContract: boolean
  coinIdentityContract: boolean
  metricKeyContract: boolean
  nativeNumberContract: boolean
  providerCoinCount: number
  validCoinCount: number
  invalidCoinCount: number
  missingMetricCount: number
  malformedMetricCount: number
  invalidMetricCount: number
  market?: CoinMarket
}

const expectedFlags = {
  include_market_cap: 'true',
  include_24hr_vol: 'true',
  include_24hr_change: 'true',
  include_last_updated_at: 'true',
} as const

const exactSearchKeys = (url: URL, allowedKeys: string[]) => {
  const entries = [...url.searchParams.entries()]
  return entries.length === allowedKeys.length
    && entries.every(([key]) => allowedKeys.includes(key))
    && allowedKeys.every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
}

const fieldOptions = (api: ApiDemo, fieldId: string) => new Set(
  api.fields.find((field) => field.id === fieldId)?.options?.map((option) => option.value) ?? [],
)

const parseExecutedRequest = (api: ApiDemo, executedRequest?: ExecutedRequestContext): CoinGeckoRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const coin = url.searchParams.get('ids')
    const currency = url.searchParams.get('vs_currencies')
    const allowedCoins = fieldOptions(api, 'coin')
    const allowedCurrencies = fieldOptions(api, 'currency')
    const allowedKeys = ['ids', 'vs_currencies', ...Object.keys(expectedFlags)]
    const valid = url.protocol === 'https:'
      && url.hostname === 'api.coingecko.com'
      && url.port === ''
      && !url.username
      && !url.password
      && !url.hash
      && url.pathname === '/api/v3/simple/price'
      && exactSearchKeys(url, allowedKeys)
      && Boolean(coin && allowedCoins.has(coin))
      && Boolean(currency && allowedCurrencies.has(currency))
      && Object.entries(expectedFlags).every(([key, value]) => url.searchParams.get(key) === value)
    return valid && coin && currency ? { coin, currency } : undefined
  } catch {
    return undefined
  }
}

const nonNegativeFiniteNumber = (value: unknown) => {
  const number = finiteNumber(value)
  return number !== undefined && number >= 0 ? number : undefined
}

export const coinGeckoKeylessMarketModel = (api: ApiDemo, data: unknown, executedRequest?: ExecutedRequestContext): CoinGeckoViewModel => {
  const request = parseExecutedRequest(api, executedRequest)
  const envelopeContract = isRecord(data)
  const providerEntries = envelopeContract ? Object.entries(data) : []
  const providerCoinCount = providerEntries.length
  const requestedQuote = request && envelopeContract ? data[request.coin] : undefined
  const quote = isRecord(requestedQuote) ? requestedQuote : undefined
  const validCoinCount = quote ? 1 : 0
  const invalidCoinCount = request && envelopeContract
    ? providerEntries.filter(([coin, value]) => coin !== request.coin || !isRecord(value)).length
    : providerCoinCount
  const coinIdentityContract = Boolean(request && envelopeContract && quote && invalidCoinCount === 0)

  let missingMetricCount = 0
  let malformedMetricCount = 0
  let invalidMetricCount = 0
  let market: CoinMarket | undefined

  if (request && quote) {
    const priceKey = request.currency
    const marketCapKey = `${request.currency}_market_cap`
    const volumeKey = `${request.currency}_24h_vol`
    const changeKey = `${request.currency}_24h_change`
    const expectedMetricKeys = new Set([priceKey, marketCapKey, volumeKey, changeKey, 'last_updated_at'])
    invalidMetricCount = Object.keys(quote).filter((key) => !expectedMetricKeys.has(key)).length

    const parseMetric = (key: string, parser: (value: unknown) => number | undefined) => {
      const raw = quote[key]
      if (raw === undefined || raw === null) {
        missingMetricCount += 1
        return undefined
      }
      const parsed = parser(raw)
      if (parsed === undefined) malformedMetricCount += 1
      return parsed
    }

    market = {
      coin: request.coin,
      currency: request.currency,
      price: parseMetric(priceKey, nonNegativeFiniteNumber),
      marketCap: parseMetric(marketCapKey, nonNegativeFiniteNumber),
      volume24h: parseMetric(volumeKey, nonNegativeFiniteNumber),
      change24h: parseMetric(changeKey, finiteNumber),
      lastUpdatedAt: parseMetric('last_updated_at', nonNegativeSafeInteger),
    }
  }

  const metricKeyContract = Boolean(request && quote && invalidMetricCount === 0)
  const nativeNumberContract = Boolean(request && quote && malformedMetricCount === 0)
  const trustedMetricCount = market
    ? [market.price, market.marketCap, market.volume24h, market.change24h, market.lastUpdatedAt].filter((value) => value !== undefined).length
    : 0

  let state: CoinGeckoState = 'invalid'
  let reason: string | undefined
  if (!request) {
    reason = 'The executed request is not the exact supported CoinGecko Simple Price GET request.'
  } else if (!envelopeContract) {
    reason = 'The HTTP-success payload is not the documented CoinGecko coin-keyed object envelope.'
  } else if (providerCoinCount === 0) {
    state = 'empty'
    reason = 'No market snapshot returned for the requested coin.'
  } else if (!quote || trustedMetricCount === 0) {
    reason = 'No trustworthy market metrics could be bound to the requested CoinGecko asset.'
  } else if (invalidCoinCount === 0 && invalidMetricCount === 0 && missingMetricCount === 0 && malformedMetricCount === 0) {
    state = 'ready'
  } else {
    state = 'partial'
    reason = 'Only request-matching CoinGecko fields with documented native numeric values are shown; missing, malformed, or unexpected evidence is withheld.'
  }

  return {
    state,
    reason,
    request,
    envelopeContract,
    coinIdentityContract,
    metricKeyContract,
    nativeNumberContract,
    providerCoinCount,
    validCoinCount,
    invalidCoinCount,
    missingMetricCount,
    malformedMetricCount,
    invalidMetricCount,
    market,
  }
}

const displayMetric = (value: number | undefined, kind: 'number' | 'compact' | 'percent') => {
  if (value === undefined) return 'Unavailable'
  if (kind === 'compact') return compactNumber(value)
  if (kind === 'percent') return `${value >= 0 ? '+' : ''}${formatNumber(value, 2)}%`
  return formatNumber(value, value < 10 ? 4 : 2)
}

export function CoinGeckoKeylessMarketPreview({ api, data, executedRequest }: { api: ApiDemo; data: unknown; executedRequest?: ExecutedRequestContext }) {
  const model = coinGeckoKeylessMarketModel(api, data, executedRequest)
  const market = model.market
  const request = model.request
  const previousPrice = market?.price !== undefined && market.change24h !== undefined && market.change24h > -100
    ? market.price / (1 + market.change24h / 100)
    : undefined
  const points = previousPrice !== undefined && market?.price !== undefined ? [previousPrice, market.price] : market?.price !== undefined ? [market.price] : []
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(request)),
    'data-request-method': request ? 'GET' : undefined,
    'data-request-coin': request?.coin,
    'data-request-currency': request?.currency,
    'data-provider-coin-count': model.providerCoinCount,
    'data-valid-coin-count': model.validCoinCount,
    'data-invalid-coin-count': model.invalidCoinCount,
    'data-missing-metric-count': model.missingMetricCount,
    'data-malformed-metric-count': model.malformedMetricCount,
    'data-invalid-metric-count': model.invalidMetricCount,
    'data-envelope-contract': String(model.envelopeContract),
    'data-coin-identity-contract': String(model.coinIdentityContract),
    'data-metric-key-contract': String(model.metricKeyContract),
    'data-native-number-contract': String(model.nativeNumberContract),
  }

  if (model.state === 'invalid') return <div className="market-preview" data-domain-card="coingecko-keyless-market" {...evidence}>
    <div className="market-summary"><div><span>CoinGecko evidence unavailable</span><strong>—</strong><small>{model.reason}</small></div></div>
  </div>

  if (model.state === 'empty') return <div className="market-preview" data-domain-card="coingecko-keyless-market" {...evidence}>
    <div className="market-summary"><div><span>{request ? `${previewLabel(request.coin)} · ${request.currency.toUpperCase()}` : 'CoinGecko market'}</span><strong>—</strong><small>No market snapshot returned for the requested coin.</small></div></div>
  </div>

  return <div
    className="market-preview"
    data-domain-card="coingecko-keyless-market"
    data-primary-coin={market?.coin}
    data-primary-price={market?.price}
    data-primary-currency={market?.currency}
    data-last-updated-at={market?.lastUpdatedAt}
    {...evidence}
  >
    <div className="market-summary"><div><span>{market ? `${previewLabel(market.coin)} · ${market.currency.toUpperCase()}` : 'CoinGecko market'}</span><strong>{market?.price === undefined ? 'Unavailable' : `${market.currency.toUpperCase()} ${displayMetric(market.price, 'number')}`}</strong><small>{market?.change24h === undefined ? '24h change unavailable' : `${displayMetric(market.change24h, 'percent')} over 24h`}</small></div><div className="market-range"><span>24 hours ago</span><span>Latest</span></div></div>
    {points.length > 0 && <Sparkline values={points} label={`${previewLabel(market?.coin ?? 'coin')} CoinGecko price evidence`}/>}
    <div className="market-metrics">
      <article><small>24h change</small><strong>{displayMetric(market?.change24h, 'percent')}</strong></article>
      <article><small>Market cap</small><strong>{displayMetric(market?.marketCap, 'compact')}</strong></article>
      <article><small>24h volume</small><strong>{displayMetric(market?.volume24h, 'compact')}</strong></article>
      <article><small>Last updated</small><strong>{market?.lastUpdatedAt === undefined ? 'Unavailable' : new Date(market.lastUpdatedAt * 1000).toISOString()}</strong></article>
    </div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span></article></div>}
    <dl className="sr-only" aria-label="CoinGecko validated market evidence">
      <dt>Coin</dt><dd>{market?.coin ?? 'Unavailable'}</dd>
      <dt>Currency</dt><dd>{market?.currency ?? 'Unavailable'}</dd>
      <dt>Price</dt><dd>{market?.price ?? 'Unavailable'}</dd>
      <dt>Market cap</dt><dd>{market?.marketCap ?? 'Unavailable'}</dd>
      <dt>24 hour volume</dt><dd>{market?.volume24h ?? 'Unavailable'}</dd>
      <dt>24 hour change</dt><dd>{market?.change24h ?? 'Unavailable'}</dd>
      <dt>Last updated epoch</dt><dd>{market?.lastUpdatedAt ?? 'Unavailable'}</dd>
    </dl>
  </div>
}
