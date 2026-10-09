import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { formatNumber } from './previewData'
import { isRecord, nonNegativeSafeInteger } from './semanticValidation'

type KrakenState = 'ready' | 'partial' | 'empty' | 'invalid'

type PairIdentity = {
  providerPair: string
  base: string
  quote: string
}

type KrakenRequest = PairIdentity & {
  pair: string
}

type DecimalEvidence = {
  raw: string
  value: number
}

type KrakenMarket = {
  pair: string
  providerPair: string
  baseCurrency: string
  quoteCurrency: string
  ask?: DecimalEvidence
  bid?: DecimalEvidence
  last?: DecimalEvidence
  open?: DecimalEvidence
  high24h?: DecimalEvidence
  low24h?: DecimalEvidence
  volume24h?: DecimalEvidence
  vwap24h?: DecimalEvidence
  trades24h?: number
}

type KrakenViewModel = {
  state: KrakenState
  reason?: string
  request?: KrakenRequest
  providerPair?: string
  envelopeContract: boolean
  errorContract: boolean
  resultContract: boolean
  pairIdentityContract: boolean
  tickerFieldContract: boolean
  decimalStringContract: boolean
  tradeCountContract: boolean
  providerErrorCount: number
  providerPairCount: number
  unexpectedPairCount: number
  missingFieldCount: number
  malformedFieldCount: number
  unexpectedTickerFieldCount: number
  trustworthyFactCount: number
  market?: KrakenMarket
}

const pairIdentities: Record<string, PairIdentity> = {
  XBTUSD: { providerPair: 'BTC/USD', base: 'BTC', quote: 'USD' },
  ETHUSD: { providerPair: 'ETH/USD', base: 'ETH', quote: 'USD' },
  SOLUSD: { providerPair: 'SOL/USD', base: 'SOL', quote: 'USD' },
  XBTEUR: { providerPair: 'BTC/EUR', base: 'BTC', quote: 'EUR' },
}

const tickerFields = ['a', 'b', 'c', 'v', 'p', 't', 'l', 'h', 'o'] as const

const exactSearchKeys = (url: URL, keys: string[]) => {
  const entries = [...url.searchParams.entries()]
  return entries.length === keys.length
    && entries.every(([key]) => keys.includes(key))
    && keys.every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
}

const catalogPairOptions = (api: ApiDemo) => new Set(
  api.fields.find((field) => field.id === 'pair')?.options?.map((option) => option.value) ?? [],
)

const parseExecutedRequest = (api: ApiDemo, executedRequest?: ExecutedRequestContext): KrakenRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const pair = url.searchParams.get('pair')
    const identity = pair ? pairIdentities[pair] : undefined
    const valid = url.protocol === 'https:'
      && url.hostname === 'api.kraken.com'
      && url.port === ''
      && !url.username
      && !url.password
      && !url.hash
      && url.pathname === '/0/public/Ticker'
      && exactSearchKeys(url, ['pair', 'assetVersion'])
      && url.searchParams.get('assetVersion') === '1'
      && Boolean(pair && identity && catalogPairOptions(api).has(pair))
    return valid && pair && identity ? { pair, ...identity } : undefined
  } catch {
    return undefined
  }
}

const parseDecimal = (value: unknown): DecimalEvidence | undefined => {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? { raw: value, value: parsed } : undefined
}

type FieldResult<T> = {
  kind: 'valid' | 'missing' | 'malformed'
  values?: T[]
}

const parseDecimalArray = (value: unknown, length: number): FieldResult<DecimalEvidence> => {
  if (value === undefined || value === null) return { kind: 'missing' }
  if (!Array.isArray(value) || value.length !== length) return { kind: 'malformed' }
  const values = value.map(parseDecimal)
  return values.every((entry): entry is DecimalEvidence => entry !== undefined)
    ? { kind: 'valid', values }
    : { kind: 'malformed' }
}

const parseTradeArray = (value: unknown): FieldResult<number> => {
  if (value === undefined || value === null) return { kind: 'missing' }
  if (!Array.isArray(value) || value.length !== 2) return { kind: 'malformed' }
  const values = value.map(nonNegativeSafeInteger)
  return values.every((entry): entry is number => entry !== undefined)
    ? { kind: 'valid', values }
    : { kind: 'malformed' }
}

const parseOpen = (value: unknown): FieldResult<DecimalEvidence> => {
  if (value === undefined || value === null) return { kind: 'missing' }
  const parsed = parseDecimal(value)
  return parsed ? { kind: 'valid', values: [parsed] } : { kind: 'malformed' }
}

export const krakenPublicTickerModel = (
  api: ApiDemo,
  data: unknown,
  executedRequest?: ExecutedRequestContext,
): KrakenViewModel => {
  const request = parseExecutedRequest(api, executedRequest)
  const envelope = isRecord(data) ? data : undefined
  const envelopeKeys = envelope ? Object.keys(envelope) : []
  const envelopeKeyContract = Boolean(envelope
    && envelopeKeys.length >= 1
    && envelopeKeys.length <= 2
    && envelopeKeys.includes('error')
    && envelopeKeys.every((key) => key === 'error' || key === 'result'))
  const errorContract = Boolean(envelopeKeyContract
    && Array.isArray(envelope?.error)
    && envelope.error.every((entry) => typeof entry === 'string'))
  const errors = errorContract ? envelope?.error as string[] : []
  const hasResult = Boolean(envelope && Object.prototype.hasOwnProperty.call(envelope, 'result'))
  const resultContract = Boolean(hasResult && isRecord(envelope?.result))
  const envelopeContract = Boolean(errorContract
    && (errors.length > 0
      ? (!hasResult || resultContract)
      : envelopeKeys.length === 2 && resultContract))
  const result = resultContract ? envelope?.result as Record<string, unknown> : undefined
  const providerKeys = result ? Object.keys(result) : []
  const requestedTicker = request && result && Object.prototype.hasOwnProperty.call(result, request.providerPair)
    ? result[request.providerPair]
    : undefined
  const ticker = isRecord(requestedTicker) ? requestedTicker : undefined
  const pairIdentityContract = Boolean(request && envelopeContract && errors.length === 0 && ticker)
  const providerPair = request && ticker
    ? request.providerPair
    : providerKeys.length === 1 ? providerKeys[0] : undefined
  const unexpectedPairCount = request
    ? providerKeys.filter((key) => key !== request.providerPair).length
    : providerKeys.length

  let missingFieldCount = 0
  let malformedFieldCount = 0
  let unexpectedTickerFieldCount = 0
  let decimalStringContract = false
  let tradeCountContract = false
  let market: KrakenMarket | undefined

  if (request && ticker && envelopeContract && errors.length === 0) {
    const fields = {
      ask: parseDecimalArray(ticker.a, 3),
      bid: parseDecimalArray(ticker.b, 3),
      close: parseDecimalArray(ticker.c, 2),
      volume: parseDecimalArray(ticker.v, 2),
      vwap: parseDecimalArray(ticker.p, 2),
      trades: parseTradeArray(ticker.t),
      low: parseDecimalArray(ticker.l, 2),
      high: parseDecimalArray(ticker.h, 2),
      open: parseOpen(ticker.o),
    }
    const results = Object.values(fields)
    missingFieldCount = results.filter((field) => field.kind === 'missing').length
    malformedFieldCount = results.filter((field) => field.kind === 'malformed').length
    unexpectedTickerFieldCount = Object.keys(ticker)
      .filter((key) => !tickerFields.includes(key as typeof tickerFields[number])).length
    decimalStringContract = [fields.ask, fields.bid, fields.close, fields.volume, fields.vwap, fields.low, fields.high, fields.open]
      .every((field) => field.kind !== 'malformed')
    tradeCountContract = fields.trades.kind !== 'malformed'
    market = {
      pair: request.pair,
      providerPair: request.providerPair,
      baseCurrency: request.base,
      quoteCurrency: request.quote,
      ask: fields.ask.values?.[0],
      bid: fields.bid.values?.[0],
      last: fields.close.values?.[0],
      volume24h: fields.volume.values?.[1],
      vwap24h: fields.vwap.values?.[1],
      trades24h: fields.trades.values?.[1],
      low24h: fields.low.values?.[1],
      high24h: fields.high.values?.[1],
      open: fields.open.values?.[0],
    }
  }

  const trustworthyFactCount = market
    ? [market.ask, market.bid, market.last, market.open, market.high24h, market.low24h, market.volume24h, market.vwap24h, market.trades24h]
        .filter((fact) => fact !== undefined).length
    : 0
  const tickerFieldContract = Boolean(pairIdentityContract
    && trustworthyFactCount === tickerFields.length
    && missingFieldCount === 0
    && malformedFieldCount === 0
    && unexpectedTickerFieldCount === 0)

  let state: KrakenState = 'invalid'
  let reason: string | undefined
  if (!request) {
    reason = 'The executed request is not the exact supported Kraken public ticker GET request.'
  } else if (!envelopeContract) {
    reason = 'The HTTP-success payload is not the documented Kraken error/result envelope.'
  } else if (errors.length > 0) {
    reason = 'Kraken returned a provider error for the executed ticker request.'
  } else if (providerKeys.length === 0) {
    state = 'empty'
    reason = `No ticker returned for ${request.providerPair}.`
  } else if (!pairIdentityContract) {
    reason = 'The Kraken result does not contain the exact assetVersion=1 provider pair requested.'
  } else if (trustworthyFactCount === 0) {
    reason = 'No trustworthy Kraken market facts could be bound to the requested pair.'
  } else if (tickerFieldContract && unexpectedPairCount === 0) {
    state = 'ready'
  } else {
    state = 'partial'
    reason = 'Only request-matching Kraken fields with documented decimal-string and integer values are shown; missing, malformed, or unexpected evidence is withheld.'
  }

  return {
    state,
    reason,
    request,
    providerPair,
    envelopeContract,
    errorContract,
    resultContract,
    pairIdentityContract,
    tickerFieldContract,
    decimalStringContract,
    tradeCountContract,
    providerErrorCount: errors.length,
    providerPairCount: providerKeys.length,
    unexpectedPairCount,
    missingFieldCount,
    malformedFieldCount,
    unexpectedTickerFieldCount,
    trustworthyFactCount,
    market,
  }
}

const displayDecimal = (evidence?: DecimalEvidence) => {
  if (evidence === undefined) return 'Unavailable'
  const absolute = Math.abs(evidence.value)
  if (absolute >= 10) return new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(evidence.value)
  return formatNumber(evidence.value, 6)
}

const rawEvidence = (evidence?: DecimalEvidence) => evidence?.raw ?? 'Unavailable'

function KrakenEvidence({ model }: { model: KrakenViewModel }) {
  const market = model.market
  return <dl className="sr-only" aria-label="Kraken validated ticker evidence">
    <dt>Requested pair</dt><dd>{model.request?.pair ?? 'Unavailable'}</dd>
    <dt>Provider pair</dt><dd>{model.providerPair ?? 'Unavailable'}</dd>
    <dt>Identity match</dt><dd>{model.pairIdentityContract ? 'Yes' : 'No'}</dd>
    <dt>Base currency</dt><dd>{model.request?.base ?? 'Unavailable'}</dd>
    <dt>Quote currency</dt><dd>{model.request?.quote ?? 'Unavailable'}</dd>
    <dt>Last</dt><dd>{rawEvidence(market?.last)}</dd>
    <dt>Bid</dt><dd>{rawEvidence(market?.bid)}</dd>
    <dt>Ask</dt><dd>{rawEvidence(market?.ask)}</dd>
    <dt>Open</dt><dd>{rawEvidence(market?.open)}</dd>
    <dt>High (24h)</dt><dd>{rawEvidence(market?.high24h)}</dd>
    <dt>Low (24h)</dt><dd>{rawEvidence(market?.low24h)}</dd>
    <dt>Volume (24h)</dt><dd>{rawEvidence(market?.volume24h)}</dd>
    <dt>VWAP (24h)</dt><dd>{rawEvidence(market?.vwap24h)}</dd>
    <dt>Trades (24h)</dt><dd>{market?.trades24h ?? 'Unavailable'}</dd>
  </dl>
}

export function KrakenPublicTickerPreview({
  api,
  data,
  executedRequest,
}: {
  api: ApiDemo
  data: unknown
  executedRequest?: ExecutedRequestContext
}) {
  const model = krakenPublicTickerModel(api, data, executedRequest)
  const market = model.market
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(model.request)),
    'data-request-method': model.request ? 'GET' : undefined,
    'data-request-pair': model.request?.pair,
    'data-provider-pair': model.providerPair,
    'data-pair-identity-contract': String(model.pairIdentityContract),
    'data-base-currency': model.request?.base,
    'data-quote-currency': model.request?.quote,
    'data-envelope-contract': String(model.envelopeContract),
    'data-error-contract': String(model.errorContract),
    'data-result-contract': String(model.resultContract),
    'data-ticker-field-contract': String(model.tickerFieldContract),
    'data-decimal-string-contract': String(model.decimalStringContract),
    'data-trade-count-contract': String(model.tradeCountContract),
    'data-provider-error-count': model.providerErrorCount,
    'data-provider-pair-count': model.providerPairCount,
    'data-unexpected-pair-count': model.unexpectedPairCount,
    'data-missing-field-count': model.missingFieldCount,
    'data-malformed-field-count': model.malformedFieldCount,
    'data-unexpected-ticker-field-count': model.unexpectedTickerFieldCount,
    'data-trustworthy-fact-count': model.trustworthyFactCount,
    'data-primary-last': market?.last?.raw,
    'data-primary-bid': market?.bid?.raw,
    'data-primary-ask': market?.ask?.raw,
    'data-open': market?.open?.raw,
    'data-high-24h': market?.high24h?.raw,
    'data-low-24h': market?.low24h?.raw,
    'data-volume-24h': market?.volume24h?.raw,
    'data-vwap-24h': market?.vwap24h?.raw,
    'data-trades-24h': market?.trades24h,
  }

  if (model.state === 'invalid') return <div className="market-preview" data-domain-card="kraken-public-ticker" {...evidence}>
    <div className="market-summary"><div><span>Kraken evidence unavailable</span><strong>—</strong><small>{model.reason}</small></div></div>
    <KrakenEvidence model={model}/>
  </div>

  if (model.state === 'empty') return <div className="market-preview" data-domain-card="kraken-public-ticker" {...evidence}>
    <div className="market-summary"><div><span>{model.request?.providerPair} · Kraken</span><strong>—</strong><small>{model.reason}</small></div></div>
    <KrakenEvidence model={model}/>
  </div>

  return <div className="market-preview" data-domain-card="kraken-public-ticker" {...evidence}>
    <div className="market-summary">
      <div>
        <span>{market?.providerPair} · Kraken</span>
        <strong>{market?.last ? `${market.quoteCurrency} ${displayDecimal(market.last)}` : 'Last unavailable'}</strong>
        <small>Bid {displayDecimal(market?.bid)} · Ask {displayDecimal(market?.ask)}</small>
      </div>
      <div className="market-range"><span>Open {displayDecimal(market?.open)}</span><span>24h range {displayDecimal(market?.low24h)} – {displayDecimal(market?.high24h)}</span></div>
    </div>
    <div className="market-metrics">
      <article><small>Bid</small><strong>{displayDecimal(market?.bid)}</strong></article>
      <article><small>Ask</small><strong>{displayDecimal(market?.ask)}</strong></article>
      <article><small>Open</small><strong>{displayDecimal(market?.open)}</strong></article>
      <article><small>High (24h)</small><strong>{displayDecimal(market?.high24h)}</strong></article>
      <article><small>Low (24h)</small><strong>{displayDecimal(market?.low24h)}</strong></article>
      <article><small>Volume (24h)</small><strong>{displayDecimal(market?.volume24h)}</strong></article>
      <article><small>VWAP (24h)</small><strong>{displayDecimal(market?.vwap24h)}</strong></article>
      <article><small>Trades (24h)</small><strong>{market?.trades24h ?? 'Unavailable'}</strong></article>
    </div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span></article></div>}
    <KrakenEvidence model={model}/>
  </div>
}
