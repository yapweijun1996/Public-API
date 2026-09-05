import { useId, useState } from 'react'
import { asRecord, CardEmpty, CardHeading, Facts, finite, numericText, text } from './cardPrimitives'

type Rate = { code: string; raw: string; value: number }
type RatesModel = { base?: string; rates: Rate[]; updated?: string; nextUpdate?: string; failed: boolean }
const normalizeRates = (value: unknown): Rate[] => Object.entries(asRecord(value)).flatMap(([code, raw]) => {
  const rate = finite(raw)
  return rate !== undefined && rate > 0 ? [{ code, raw: String(raw), value: rate }] : []
}).sort((a, b) => a.code.localeCompare(b.code, 'en'))
export function exchangeRateModel(data: unknown): RatesModel {
  const root = asRecord(data)
  return { base: text(root.base_code), rates: normalizeRates(root.rates), updated: text(root.time_last_update_utc), nextUpdate: text(root.time_next_update_utc), failed: root.result !== undefined && root.result !== 'success' }
}
export function coinbaseRateModel(data: unknown): RatesModel {
  const root = asRecord(data)
  const payload = asRecord(root.data)
  return { base: text(payload.currency), rates: normalizeRates(payload.rates), failed: Array.isArray(root.errors) && root.errors.length > 0 }
}
function RateBoard({ model, source }: { model: RatesModel; source: 'exchange-rate-api' | 'coinbase' }) {
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
  const preferred = source === 'exchange-rate-api' ? ['MYR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CNY', 'SGD'] : ['USD', 'GBP', 'JPY', 'CHF', 'SGD', 'AUD', 'CAD', 'MYR', 'BTC', 'ETH']
  const ordered = [...otherRates].sort((a, b) => {
    const rank = (code: string) => preferred.includes(code) ? preferred.indexOf(code) : preferred.length
    return rank(a.code) - rank(b.code) || a.code.localeCompare(b.code, 'en')
  })
  const filtered = ordered.filter((rate) => rate.code.toLowerCase().includes(query.trim().toLowerCase()))
  if (!model.base || model.failed || !otherRates.length) return <CardEmpty domain="exchange-rates" title="Exchange rates unavailable" detail="A base currency and valid positive conversion rates are required. No rate or currency has been assumed."/>
  return <div className="domain-card fx-workbench" data-domain-card="exchange-rates" data-result-state="ready" data-base-currency={model.base}>
    <CardHeading eyebrow="Currency conversion" title={`Convert from ${model.base}`} description="Use this response to estimate an amount. Changing the amount or target currency does not send another API request."/>
    <div className="fx-converter">
      <div className="fx-inputs"><label htmlFor={`${id}-amount`}>Amount in {model.base}</label><input id={`${id}-amount`} type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={converted === undefined} aria-describedby={converted === undefined ? `${id}-error` : undefined}/>
        <label htmlFor={`${id}-target`}>Convert to</label><select id={`${id}-target`} value={target?.code} onChange={(event) => setSelected(event.target.value)}>{otherRates.map((rate) => <option key={rate.code} value={rate.code}>{rate.code}</option>)}</select></div>
      <div className="fx-output"><span>Estimated amount</span><output aria-label="Converted amount" data-currency={target?.code} data-value={converted} htmlFor={`${id}-amount ${id}-target`}>{converted === undefined ? '—' : numericText(converted)} <small>{target?.code}</small></output><p>1 {model.base} = <strong>{target?.raw}</strong> {target?.code}</p>{converted === undefined && <p id={`${id}-error`}>Enter a finite, non-negative amount within the calculation range.</p>}</div>
    </div>
    <Facts items={[{ label: 'Rates available', value: otherRates.length }, { label: 'Provider update time', value: model.updated ?? 'Not supplied in this response' }, ...(model.nextUpdate ? [{ label: 'Next provider update', value: model.nextUpdate }] : [])]}/>
    <div className="domain-toolbar"><label htmlFor={`${id}-filter`}>Filter currencies</label><input id={`${id}-filter`} type="search" placeholder="e.g. MYR, USD, BTC" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(8) }}/><span role="status">{Math.min(limit, filtered.length)} of {filtered.length} rates shown</span></div>
    <ul className="fx-rates" role="list" aria-label="Exchange rates from this response">{filtered.slice(0, limit).map((rate) => <li key={rate.code} data-currency={rate.code} data-rate={rate.raw}><span>1 {model.base} → {rate.code}</span><strong>{rate.raw}</strong></li>)}</ul>
    {!filtered.length && <p className="domain-notice">No currency codes match this filter. Clear it to see the available rates.</p>}
    {filtered.length > limit && <button className="domain-more" type="button" onClick={() => setLimit((count) => count + 24)}>Show more rates</button>}
    <p className="domain-note">Reference estimate only; not a trade quote. Fees and spreads are not included. Converted amounts use rounded browser arithmetic; the rate list preserves the supplied values.</p>
    {source === 'exchange-rate-api' && <p className="domain-note"><a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API</a> · Open endpoint updates once per day.</p>}
  </div>
}
export function ExchangeRateApiPreview({ data }: { data: unknown }) {
  const model = exchangeRateModel(data)
  return <RateBoard key={model.base} model={model} source="exchange-rate-api"/>
}
export function CoinbaseRatesPreview({ data }: { data: unknown }) {
  const model = coinbaseRateModel(data)
  return <RateBoard key={model.base} model={model} source="coinbase"/>
}
