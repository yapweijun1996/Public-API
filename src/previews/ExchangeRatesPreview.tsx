import { useId, useState } from 'react'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, Facts, finite, isoDate, numericText } from './cardPrimitives'
import { isRecord, trimmedText } from './semanticValidation'

type Rate = { code: string; raw: string; value: number }
type RatesModel = {
  base?: string
  rates: Rate[]
  updated?: string
  nextUpdate?: string
  failed: boolean
  requestedBase?: string
  requestedSymbols?: string[]
  providerSymbols?: string[]
  baseIdentityMatch?: boolean
  symbolsMatch?: boolean
  identityMatch?: boolean
  contractValid?: boolean
  requestBound: boolean
  transportInvalid: boolean
}
const normalizeRates = (value: unknown): Rate[] => Object.entries(asRecord(value)).flatMap(([code, raw]) => {
  const rate = finite(raw)
  return rate !== undefined && rate > 0 ? [{ code, raw: String(raw), value: rate }] : []
}).sort((a, b) => a.code.localeCompare(b.code, 'en'))
const exchangeCurrencyCode = (value: unknown) => {
  const code = trimmedText(value)
  return code && /^[A-Z]{3}$/.test(code) ? code : undefined
}

type FxRequestIdentity = { base: string; symbols?: string[] }
type BoundFxRequest = { identity?: FxRequestIdentity; requestBound: boolean; invalid: boolean }

const bindBodylessGetRequest = (requestUrl: string | undefined, executedRequest: ExecutedRequestContext | undefined, parseUrl: (url: string) => FxRequestIdentity | undefined): BoundFxRequest => {
  const displayed = requestUrl ? parseUrl(requestUrl) : undefined
  if (requestUrl && !displayed) return { identity: undefined, requestBound: false, invalid: true }
  if (!executedRequest) return { identity: displayed, requestBound: false, invalid: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
    return { identity: displayed, requestBound: false, invalid: true }
  }
  const executed = parseUrl(executedRequest.url)
  return executed ? { identity: executed, requestBound: true, invalid: false } : { identity: displayed, requestBound: false, invalid: true }
}

const exchangeRequestIdentity = (requestUrl: string): FxRequestIdentity | undefined => {
  try {
    const url = new URL(requestUrl)
    const match = url.pathname.match(/^\/v6\/latest\/([A-Z]{3})$/)
    if (url.origin !== 'https://open.er-api.com' || url.search || url.hash || url.username || url.password || !match) return undefined
    const base = match[1]
    return requestUrl === `https://open.er-api.com/v6/latest/${base}` ? { base } : undefined
  } catch { return undefined }
}

const strictExchangeRates = (value: unknown) => {
  if (!isRecord(value)) return { rates: [] as Rate[], valid: false }
  const entries = Object.entries(value)
  if (!entries.length) return { rates: [] as Rate[], valid: false }
  const rates: Rate[] = []
  for (const [rawCode, raw] of entries) {
    const code = exchangeCurrencyCode(rawCode)
    if (!code || typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return { rates: [] as Rate[], valid: false }
    rates.push({ code, raw: String(raw), value: raw })
  }
  return { rates: rates.sort((a, b) => a.code.localeCompare(b.code, 'en')), valid: true }
}

export function exchangeRateModel(data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): RatesModel {
  const root = isRecord(data) ? data : {}
  const base = exchangeCurrencyCode(root.base_code)
  const request = bindBodylessGetRequest(requestUrl, executedRequest, exchangeRequestIdentity)
  const requestedBase = request.identity?.base
  const identityMatch = requestedBase !== undefined && base !== undefined && requestedBase === base
  const normalized = strictExchangeRates(root.rates)
  const responseValid = root.result === 'success' && identityMatch && normalized.valid
  return {
    base, requestedBase, identityMatch,
    contractValid: responseValid && request.requestBound,
    requestBound: request.requestBound,
    transportInvalid: request.invalid,
    rates: normalized.rates,
    updated: trimmedText(root.time_last_update_utc),
    nextUpdate: trimmedText(root.time_next_update_utc),
    failed: request.invalid || !responseValid,
  }
}

const coinbaseRequestIdentity = (requestUrl: string): FxRequestIdentity | undefined => {
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    const base = exchangeCurrencyCode(url.searchParams.get('currency'))
    if (url.origin !== 'https://api.coinbase.com' || url.pathname !== '/v2/exchange-rates' || url.hash || url.username || url.password || keys.length !== 1 || keys[0] !== 'currency' || url.searchParams.getAll('currency').length !== 1 || !base) return undefined
    const canonical = `https://api.coinbase.com/v2/exchange-rates?${new URLSearchParams({ currency: base }).toString()}`
    return requestUrl === canonical ? { base } : undefined
  } catch { return undefined }
}

export function coinbaseRateModel(data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): RatesModel {
  const root = asRecord(data)
  const payload = asRecord(root.data)
  const base = exchangeCurrencyCode(payload.currency)
  const request = bindBodylessGetRequest(requestUrl, executedRequest, coinbaseRequestIdentity)
  const requestedBase = request.identity?.base
  const identityMatch = requestedBase !== undefined && base !== undefined && requestedBase === base
  const rates = normalizeRates(payload.rates)
  const responseValid = identityMatch && rates.length > 0 && !(Array.isArray(root.errors) && root.errors.length > 0)
  return {
    base, rates, requestedBase, identityMatch,
    contractValid: responseValid && request.requestBound,
    requestBound: request.requestBound,
    transportInvalid: request.invalid,
    failed: request.invalid || !responseValid,
  }
}

const vatcomplyRequestIdentity = (requestUrl: string): FxRequestIdentity | undefined => {
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    const base = exchangeCurrencyCode(url.searchParams.get('base'))
    const rawSymbols = url.searchParams.get('symbols')
    if (url.origin !== 'https://api.vatcomply.com' || url.pathname !== '/rates' || url.hash || url.username || url.password || keys.length !== 2 || keys[0] !== 'base' || keys[1] !== 'symbols' || url.searchParams.getAll('base').length !== 1 || url.searchParams.getAll('symbols').length !== 1 || !base || !rawSymbols) return undefined
    const symbols = rawSymbols.split(',').map(exchangeCurrencyCode)
    if (!symbols.length || symbols.some((symbol) => symbol === undefined)) return undefined
    const typedSymbols = symbols as string[]
    const canonical = `https://api.vatcomply.com/rates?${new URLSearchParams({ base, symbols: typedSymbols.join(',') }).toString()}`
    return requestUrl === canonical ? { base, symbols: typedSymbols } : undefined
  } catch { return undefined }
}

const sameCurrencySet = (left?: string[], right?: string[]) => {
  if (left === undefined || right === undefined || left.length !== right.length) return false
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.every((code, index) => code === sortedRight[index])
}

export function vatcomplyRateModel(data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): RatesModel {
  const root = isRecord(data) ? data : {}
  const base = exchangeCurrencyCode(root.base)
  const request = bindBodylessGetRequest(requestUrl, executedRequest, vatcomplyRequestIdentity)
  const requestedBase = request.identity?.base
  const requestedSymbols = request.identity?.symbols
  const normalized = strictExchangeRates(root.rates)
  const rates = normalized.rates
  const providerSymbols = normalized.valid ? rates.map(({ code }) => code) : undefined
  const baseIdentityMatch = requestedBase !== undefined && base !== undefined && requestedBase === base
  const symbolsMatch = sameCurrencySet(requestedSymbols, providerSymbols)
  const identityMatch = baseIdentityMatch && symbolsMatch
  const updated = isoDate(root.date)
  const responseValid = identityMatch && updated !== undefined && normalized.valid
  return {
    base, rates, updated, requestedBase, requestedSymbols, providerSymbols, baseIdentityMatch, symbolsMatch,
    identityMatch, contractValid: responseValid && request.requestBound,
    requestBound: request.requestBound,
    transportInvalid: request.invalid,
    failed: request.invalid || !responseValid,
  }
}

function RateBoard({ model, source }: { model: RatesModel; source: 'exchange-rate-api' | 'coinbase' | 'vatcomply' }) {
  const id = useId()
  const [amount, setAmount] = useState('100')
  const [selected, setSelected] = useState(source === 'exchange-rate-api' ? 'MYR' : 'USD')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(8)
  const otherRates = model.rates.filter((rate) => rate.code !== model.base)
  const target = otherRates.find((rate) => rate.code === selected) ?? otherRates[0]
  const input = finite(amount)
  const product = input !== undefined && input >= 0 && target ? input * target.value : undefined
  const converted = product !== undefined && Number.isFinite(product) ? product : undefined
  const preferred = source === 'exchange-rate-api' ? ['MYR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CNY', 'SGD'] : source === 'vatcomply' ? ['USD', 'SGD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'MYR'] : ['USD', 'GBP', 'JPY', 'CHF', 'SGD', 'AUD', 'CAD', 'MYR', 'BTC', 'ETH']
  const ordered = [...otherRates].sort((a, b) => {
    const rank = (code: string) => preferred.includes(code) ? preferred.indexOf(code) : preferred.length
    return rank(a.code) - rank(b.code) || a.code.localeCompare(b.code, 'en')
  })
  const filtered = ordered.filter((rate) => rate.code.toLowerCase().includes(query.trim().toLowerCase()))
  const identityMetadata = {
    'data-request-bound': String(model.requestBound),
    'data-requested-base-currency': model.requestedBase,
    'data-provider-base-currency': model.base,
    'data-requested-symbols': model.requestedSymbols?.join(','),
    'data-provider-symbols': model.providerSymbols?.join(','),
    'data-base-identity-match': model.baseIdentityMatch === undefined ? undefined : String(model.baseIdentityMatch),
    'data-symbols-match': model.symbolsMatch === undefined ? undefined : String(model.symbolsMatch),
    'data-identity-match': model.identityMatch === undefined ? undefined : String(model.identityMatch),
    'data-contract-valid': model.contractValid === undefined ? undefined : String(model.contractValid),
  }
  if (!model.base || model.failed || !otherRates.length) return <div className="domain-card domain-empty" data-domain-card="exchange-rates" data-result-state="invalid" {...identityMetadata}><h3>Exchange rates unavailable</h3><p>{model.transportInvalid ? 'The successful response was not bound to the exact supported bodyless GET request for this exchange-rate demo.' : source === 'exchange-rate-api' ? 'The provider response must report success, match the base currency in the executed request, and contain only positive numeric rate values.' : source === 'vatcomply' ? 'The provider response must match the executed base and target-currency filter, include a valid reference date, and contain only positive numeric rate values.' : 'A base currency and valid positive conversion rates are required. No rate or currency has been assumed.'}</p></div>
  const resultState = model.requestBound ? 'ready' : 'partial'
  return <div className="domain-card fx-workbench" data-domain-card="exchange-rates" data-result-state={resultState} data-base-currency={model.base} {...identityMetadata}>
    <CardHeading eyebrow="Currency conversion" title={`Convert from ${model.base}`} description="Use this response to estimate an amount. Changing the amount or target currency does not send another API request."/>
    <div className="fx-converter">
      <div className="fx-inputs"><label htmlFor={`${id}-amount`}>Amount in {model.base}</label><input id={`${id}-amount`} type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={converted === undefined} aria-describedby={converted === undefined ? `${id}-error` : undefined}/>
        <label htmlFor={`${id}-target`}>Convert to</label><select id={`${id}-target`} value={target?.code} onChange={(event) => setSelected(event.target.value)}>{otherRates.map((rate) => <option key={rate.code} value={rate.code}>{rate.code}</option>)}</select></div>
      <div className="fx-output"><span>Estimated amount</span><output aria-label="Converted amount" data-currency={target?.code} data-value={converted} htmlFor={`${id}-amount ${id}-target`}>{converted === undefined ? '—' : numericText(converted)} <small>{target?.code}</small></output><p>1 {model.base} = <strong>{target?.raw}</strong> {target?.code}</p>{converted === undefined && <p id={`${id}-error`}>Enter a finite, non-negative amount within the calculation range.</p>}</div>
    </div>
    <Facts items={[{ label: 'Rates available', value: otherRates.length }, { label: source === 'vatcomply' ? 'Reference date' : 'Provider update time', value: model.updated ?? 'Not supplied in this response' }, ...(model.nextUpdate ? [{ label: 'Next provider update', value: model.nextUpdate }] : [])]}/>
    <div className="domain-toolbar"><label htmlFor={`${id}-filter`}>Filter currencies</label><input id={`${id}-filter`} type="search" placeholder="e.g. MYR, USD, BTC" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(8) }}/><span role="status">{Math.min(limit, filtered.length)} of {filtered.length} rates shown</span></div>
    <ul className="fx-rates" role="list" aria-label="Exchange rates from this response">{filtered.slice(0, limit).map((rate) => <li key={rate.code} data-currency={rate.code} data-rate={rate.raw}><span>1 {model.base} → {rate.code}</span><strong>{rate.raw}</strong></li>)}</ul>
    {!filtered.length && <p className="domain-notice">No currency codes match this filter. Clear it to see the available rates.</p>}
    {filtered.length > limit && <button className="domain-more" type="button" onClick={() => setLimit((count) => count + 24)}>Show more rates</button>}
    {!model.requestBound && <p className="domain-note">The rate payload matches the displayed request identity, but executed transport identity is unavailable, so this result is not marked ready.</p>}
    <p className="domain-note">Reference estimate only; not a trade quote. Fees and spreads are not included. Converted amounts use rounded browser arithmetic; the rate list preserves the supplied values.</p>
    {source === 'exchange-rate-api' && <p className="domain-note"><a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API</a> · Open endpoint updates once per day.</p>}
    {source === 'vatcomply' && <p className="domain-note">This card reflects VATComply's <code>/rates</code> response only. VAT-number and IBAN validation are separate provider endpoints and are not implied by this result.</p>}
  </div>
}
export function ExchangeRateApiPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = exchangeRateModel(data, requestUrl, executedRequest)
  return <RateBoard key={model.base} model={model} source="exchange-rate-api"/>
}
export function CoinbaseRatesPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = coinbaseRateModel(data, requestUrl, executedRequest)
  return <RateBoard key={model.base} model={model} source="coinbase"/>
}
export function VatcomplyRatesPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = vatcomplyRateModel(data, requestUrl, executedRequest)
  return <RateBoard key={model.base} model={model} source="vatcomply"/>
}
