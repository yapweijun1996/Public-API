import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { compactNumber, formatNumber } from './previewData'
import { finiteNumber, isRecord, optionalTrimmedText } from './semanticValidation'

type CoinPaprikaState = 'ready' | 'partial' | 'empty' | 'invalid'

type CoinPaprikaRequest = {
  coin: string
}

type ClassifiedNumber = {
  kind: 'native' | 'missing' | 'empty' | 'malformed'
  value?: number
}

type ClassifiedTimestamp = {
  kind: 'valid' | 'missing' | 'empty' | 'malformed'
  value?: string
}

type CoinPaprikaMarket = {
  id: string
  name: string
  symbol: string
  price?: number
  volume24h?: number
  marketCap?: number
  change24h?: number
  lastUpdated?: string
}

type CoinPaprikaViewModel = {
  state: CoinPaprikaState
  reason?: string
  request?: CoinPaprikaRequest
  envelopeContract: boolean
  idContract: boolean
  identityTextContract: boolean
  quoteContract: boolean
  nativeNumberContract: boolean
  timestampContract: boolean
  providerTickerCount: number
  validTickerCount: number
  invalidTickerCount: number
  nativeNumberCount: number
  missingMetricCount: number
  emptyStringMetricCount: number
  malformedMetricCount: number
  validTimestampCount: number
  missingTimestampCount: number
  emptyStringTimestampCount: number
  malformedTimestampCount: number
  market?: CoinPaprikaMarket
}

const catalogCoinOptions = (api: ApiDemo) => new Set(
  api.fields.find((field) => field.id === 'coin')?.options?.map((option) => option.value) ?? [],
)

const parseExecutedRequest = (api: ApiDemo, executedRequest?: ExecutedRequestContext): CoinPaprikaRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const coin = [...catalogCoinOptions(api)].find((candidate) => url.pathname === `/v1/tickers/${candidate}`)
    const valid = url.protocol === 'https:'
      && url.hostname === 'api.coinpaprika.com'
      && url.port === ''
      && !url.username
      && !url.password
      && !url.hash
      && url.search === ''
      && Boolean(coin)
      && executedRequest.url === `https://api.coinpaprika.com/v1/tickers/${coin}`
    return valid && coin ? { coin } : undefined
  } catch {
    return undefined
  }
}

const classifyNumber = (value: unknown, allowNegative: boolean): ClassifiedNumber => {
  if (value === undefined || value === null) return { kind: 'missing' }
  if (value === '') return { kind: 'empty' }
  const parsed = finiteNumber(value)
  if (parsed === undefined || (!allowNegative && parsed < 0)) return { kind: 'malformed' }
  return { kind: 'native', value: parsed }
}

const isRealIsoTimestamp = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const offsetHour = match[8] === undefined ? 0 : Number(match[8])
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9])
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  return year > 0
    && month >= 1
    && month <= 12
    && day >= 1
    && day <= (daysInMonth ?? 0)
    && hour <= 23
    && minute <= 59
    && second <= 59
    && offsetHour <= 23
    && offsetMinute <= 59
    && Number.isFinite(Date.parse(value))
}

const classifyTimestamp = (value: unknown): ClassifiedTimestamp => {
  if (value === undefined || value === null) return { kind: 'missing' }
  if (value === '') return { kind: 'empty' }
  if (typeof value !== 'string' || !isRealIsoTimestamp(value)) return { kind: 'malformed' }
  return { kind: 'valid', value: new Date(value).toISOString() }
}

export const coinPaprikaTickerModel = (
  api: ApiDemo,
  data: unknown,
  executedRequest?: ExecutedRequestContext,
): CoinPaprikaViewModel => {
  const request = parseExecutedRequest(api, executedRequest)
  const envelopeContract = isRecord(data)
  const providerTickerCount = envelopeContract ? 1 : 0
  const idContract = Boolean(request && envelopeContract && data.id === request.coin)
  const parsedName = envelopeContract ? optionalTrimmedText(data.name) : { malformed: false }
  const parsedSymbol = envelopeContract ? optionalTrimmedText(data.symbol) : { malformed: false }
  const identityTextContract = Boolean(parsedName.value && parsedSymbol.value && !parsedName.malformed && !parsedSymbol.malformed)
  const quote = envelopeContract && isRecord(data.quotes) && isRecord(data.quotes.USD) ? data.quotes.USD : undefined
  const quoteContract = Boolean(quote)

  const price = classifyNumber(quote?.price, false)
  const volume24h = classifyNumber(quote?.volume_24h, false)
  const marketCap = classifyNumber(quote?.market_cap, false)
  const change24h = classifyNumber(quote?.percent_change_24h, true)
  const metrics = [price, volume24h, marketCap, change24h]
  const nativeNumberCount = metrics.filter((metric) => metric.kind === 'native').length
  const missingMetricCount = metrics.filter((metric) => metric.kind === 'missing').length
  const emptyStringMetricCount = metrics.filter((metric) => metric.kind === 'empty').length
  const malformedMetricCount = metrics.filter((metric) => metric.kind === 'malformed').length
  const nativeNumberContract = quoteContract && malformedMetricCount === 0

  const timestamp = classifyTimestamp(envelopeContract ? data.last_updated : undefined)
  const validTimestampCount = Number(timestamp.kind === 'valid')
  const missingTimestampCount = Number(timestamp.kind === 'missing')
  const emptyStringTimestampCount = Number(timestamp.kind === 'empty')
  const malformedTimestampCount = Number(timestamp.kind === 'malformed')
  const timestampContract = timestamp.kind === 'valid'

  const validTickerCount = Number(envelopeContract && idContract && identityTextContract && quoteContract)
  const invalidTickerCount = providerTickerCount - validTickerCount
  const market = validTickerCount === 1 && request && parsedName.value && parsedSymbol.value
    ? {
        id: request.coin,
        name: parsedName.value,
        symbol: parsedSymbol.value,
        price: price.value,
        volume24h: volume24h.value,
        marketCap: marketCap.value,
        change24h: change24h.value,
        lastUpdated: timestamp.value,
      }
    : undefined

  let state: CoinPaprikaState = 'invalid'
  let reason: string | undefined
  if (!request) {
    reason = 'The executed request is not the exact supported CoinPaprika ticker GET request.'
  } else if (!envelopeContract) {
    reason = 'The HTTP-success payload is not the documented CoinPaprika ticker object envelope.'
  } else if (!idContract || !identityTextContract) {
    reason = 'The provider ticker identity does not exactly match the selected CoinPaprika ticker.'
  } else if (!quoteContract) {
    reason = 'The provider response does not contain the documented quotes.USD object.'
  } else if (
    nativeNumberCount === 0
    && emptyStringMetricCount === metrics.length
    && missingMetricCount === 0
    && malformedMetricCount === 0
  ) {
    state = 'empty'
    reason = 'No USD market values returned for the selected ticker.'
  } else if (nativeNumberCount === 0) {
    reason = 'No trustworthy native-number USD market metrics were returned.'
  } else if (
    nativeNumberCount === metrics.length
    && missingMetricCount === 0
    && emptyStringMetricCount === 0
    && malformedMetricCount === 0
    && timestampContract
  ) {
    state = 'ready'
  } else {
    state = 'partial'
    reason = 'Only request-matching CoinPaprika fields with trustworthy native values are shown; unavailable or malformed evidence is withheld.'
  }

  return {
    state,
    reason,
    request,
    envelopeContract,
    idContract,
    identityTextContract,
    quoteContract,
    nativeNumberContract,
    timestampContract,
    providerTickerCount,
    validTickerCount,
    invalidTickerCount,
    nativeNumberCount,
    missingMetricCount,
    emptyStringMetricCount,
    malformedMetricCount,
    validTimestampCount,
    missingTimestampCount,
    emptyStringTimestampCount,
    malformedTimestampCount,
    market,
  }
}

const displayPrice = (value?: number) => value === undefined
  ? 'Price unavailable'
  : `USD ${formatNumber(value, value < 10 ? 4 : 2)}`

const displayCompact = (value?: number) => value === undefined ? 'Unavailable' : compactNumber(value)

const displayPercent = (value?: number) => value === undefined
  ? 'Unavailable'
  : `${value >= 0 ? '+' : ''}${formatNumber(value, 2)}%`

export function CoinPaprikaTickerPreview({
  api,
  data,
  executedRequest,
}: {
  api: ApiDemo
  data: unknown
  executedRequest?: ExecutedRequestContext
}) {
  const model = coinPaprikaTickerModel(api, data, executedRequest)
  const market = model.market
  const request = model.request
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(request)),
    'data-request-method': request ? 'GET' : undefined,
    'data-request-coin': request?.coin,
    'data-request-quote': request ? 'USD' : undefined,
    'data-envelope-contract': String(model.envelopeContract),
    'data-id-contract': String(model.idContract),
    'data-identity-text-contract': String(model.identityTextContract),
    'data-quote-contract': String(model.quoteContract),
    'data-native-number-contract': String(model.nativeNumberContract),
    'data-timestamp-contract': String(model.timestampContract),
    'data-provider-ticker-count': model.providerTickerCount,
    'data-valid-ticker-count': model.validTickerCount,
    'data-invalid-ticker-count': model.invalidTickerCount,
    'data-native-number-count': model.nativeNumberCount,
    'data-missing-metric-count': model.missingMetricCount,
    'data-empty-string-metric-count': model.emptyStringMetricCount,
    'data-malformed-metric-count': model.malformedMetricCount,
    'data-valid-timestamp-count': model.validTimestampCount,
    'data-missing-timestamp-count': model.missingTimestampCount,
    'data-empty-string-timestamp-count': model.emptyStringTimestampCount,
    'data-malformed-timestamp-count': model.malformedTimestampCount,
  }

  if (model.state === 'invalid') return <div className="market-preview" data-domain-card="coinpaprika-ticker" {...evidence}>
    <div className="market-summary"><div><span>CoinPaprika evidence unavailable</span><strong>—</strong><small>{model.reason}</small></div></div>
  </div>

  if (model.state === 'empty') return <div
    className="market-preview"
    data-domain-card="coinpaprika-ticker"
    data-primary-id={market?.id}
    {...evidence}
  >
    <div className="market-summary"><div><span>{market ? `${market.name} · ${market.symbol}` : request?.coin}</span><strong>—</strong><small>No USD market values returned for the selected ticker.</small></div></div>
    <dl className="sr-only" aria-label="CoinPaprika validated ticker evidence">
      <dt>Ticker id</dt><dd>{market?.id ?? 'Unavailable'}</dd>
      <dt>Quote currency</dt><dd>USD</dd>
      <dt>Price</dt><dd>Unavailable</dd>
    </dl>
  </div>

  return <div
    className="market-preview"
    data-domain-card="coinpaprika-ticker"
    data-primary-id={market?.id}
    data-primary-price={market?.price}
    data-primary-symbol={market?.symbol}
    data-last-updated={market?.lastUpdated}
    {...evidence}
  >
    <div className="market-summary"><div><span>{market ? `${market.name} · ${market.symbol}` : 'CoinPaprika ticker'}</span><strong>{displayPrice(market?.price)}</strong><small>{market?.change24h === undefined ? '24h change unavailable' : `${displayPercent(market.change24h)} over 24h`}</small></div><div className="market-range"><span>CoinPaprika · USD</span><span>{market?.lastUpdated ?? 'Last updated unavailable'}</span></div></div>
    <div className="market-metrics">
      <article><small>24h change</small><strong>{displayPercent(market?.change24h)}</strong></article>
      <article><small>Market cap</small><strong>{displayCompact(market?.marketCap)}</strong></article>
      <article><small>24h volume</small><strong>{displayCompact(market?.volume24h)}</strong></article>
      <article><small>Last updated</small><strong>{market?.lastUpdated ?? 'Unavailable'}</strong></article>
    </div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span></article></div>}
    <dl className="sr-only" aria-label="CoinPaprika validated ticker evidence">
      <dt>Ticker id</dt><dd>{market?.id ?? 'Unavailable'}</dd>
      <dt>Name</dt><dd>{market?.name ?? 'Unavailable'}</dd>
      <dt>Symbol</dt><dd>{market?.symbol ?? 'Unavailable'}</dd>
      <dt>Quote currency</dt><dd>USD</dd>
      <dt>Price</dt><dd>{market?.price ?? 'Unavailable'}</dd>
      <dt>Market cap</dt><dd>{market?.marketCap ?? 'Unavailable'}</dd>
      <dt>24 hour volume</dt><dd>{market?.volume24h ?? 'Unavailable'}</dd>
      <dt>24 hour change</dt><dd>{market?.change24h ?? 'Unavailable'}</dd>
      <dt>Last updated</dt><dd>{market?.lastUpdated ?? 'Unavailable'}</dd>
    </dl>
  </div>
}
