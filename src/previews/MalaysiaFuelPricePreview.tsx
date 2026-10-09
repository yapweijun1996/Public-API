import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { Sparkline } from './ChartPrimitives'
import { formatNumber } from './previewData'
import { exactBodylessGetRequestLimit, finiteNumber, isRecord, trimmedText } from './semanticValidation'

type FuelSeriesType = 'level' | 'change_weekly'
type FuelMetricKey = 'ron95' | 'ron97' | 'diesel' | 'diesel_eastmsia' | 'ron95_budi95' | 'ron95_skps'
type FuelRow = {
  date: string
  seriesType: FuelSeriesType
  metrics: Partial<Record<FuelMetricKey, number>>
}

const requestPattern = /^https:\/\/api\.data\.gov\.my\/data-catalogue\/\?id=fuelprice&limit=([1-9]\d*)&sort=-date$/
const fuelKeys: FuelMetricKey[] = ['ron95', 'ron97', 'diesel', 'diesel_eastmsia', 'ron95_budi95', 'ron95_skps']
const isoDate = (value: unknown) => {
  const date = trimmedText(value)
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : undefined
}
const optionalNumber = (value: unknown) => value === undefined || value === null
  ? { malformed: false as const, value: undefined }
  : finiteNumber(value) === undefined
    ? { malformed: true as const, value: undefined }
    : { malformed: false as const, value: finiteNumber(value) }

const parseFuelRow = (value: unknown): FuelRow | undefined => {
  if (!isRecord(value)) return undefined
  const date = isoDate(value.date)
  const seriesType = value.series_type === 'level' || value.series_type === 'change_weekly' ? value.series_type : undefined
  if (!date || !seriesType) return undefined
  const metrics: Partial<Record<FuelMetricKey, number>> = {}
  for (const key of fuelKeys) {
    const parsed = optionalNumber(value[key])
    if (parsed.malformed) return undefined
    if (parsed.value !== undefined) metrics[key] = parsed.value
  }
  return Object.keys(metrics).length ? { date, seriesType, metrics } : undefined
}

const priceLabel = (value?: number) => value === undefined ? '—' : `RM ${formatNumber(value, 2)}`
const movementLabel = (value?: number) => value === undefined
  ? 'Change unavailable'
  : value === 0
    ? 'No weekly change'
    : `${value > 0 ? '↑' : '↓'} RM ${formatNumber(Math.abs(value), 2)}`

const fuels: Array<{ key: FuelMetricKey; label: string; note: string }> = [
  { key: 'ron95', label: 'RON95', note: 'General market' },
  { key: 'ron97', label: 'RON97', note: 'Premium petrol' },
  { key: 'diesel', label: 'Diesel', note: 'Peninsular Malaysia' },
  { key: 'diesel_eastmsia', label: 'East Malaysia diesel', note: 'Sabah · Sarawak · Labuan' },
  { key: 'ron95_budi95', label: 'BUDI95', note: 'Eligible individual subsidy' },
  { key: 'ron95_skps', label: 'SKPS', note: 'Eligible commercial vehicles' },
]

export function MalaysiaFuelPricePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = exactBodylessGetRequestLimit(requestUrl, executedRequest, requestPattern, 12, 104)
  if (!request.valid) return <div className="domain-card domain-empty" data-domain-card="fuel-market" data-result-state="invalid" data-request-bound="false"><h3>Invalid Malaysia fuel-price request identity</h3><p>The successful response was not bound to the supported exact bodyless GET data.gov.my fuelprice request.</p></div>
  if (!Array.isArray(data)) return <div className="domain-card domain-empty" data-domain-card="fuel-market" data-result-state="invalid" data-request-bound={String(request.transportBound)}><h3>Invalid fuel-price response</h3><p>data.gov.my returned HTTP-success data without the documented fuel-price row array.</p></div>
  if (data.length === 0) return request.transportBound
    ? <div className="domain-card domain-empty" data-domain-card="fuel-market" data-result-state="empty" data-request-bound="true" data-requested-limit={request.limit}><h3>Fuel-price history unavailable</h3><p>data.gov.my returned no fuelprice rows for this exact executed request.</p></div>
    : <div className="domain-card domain-empty" data-domain-card="fuel-market" data-result-state="partial" data-request-bound="false" data-requested-limit={request.limit}><h3>Unbound fuel-price response</h3><p>The empty response is coherent, but executed transport identity is unavailable, so semantic emptiness is not trusted.</p></div>

  const parsedRows = data.map(parseFuelRow)
  const validRows = parsedRows.filter((row): row is FuelRow => Boolean(row))
  const invalidRecordCount = data.length - validRows.length
  const seen = new Set<string>()
  const uniqueRows = validRows.filter((row) => {
    const identity = `${row.date}:${row.seriesType}`
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
  const duplicateRecordCount = validRows.length - uniqueRows.length
  const sortValid = validRows.every((row, index) => index === 0 || validRows[index - 1].date >= row.date)
  const rowLimitValid = data.length <= request.limit
  const levels = uniqueRows.filter((row) => row.seriesType === 'level')
  const changes = uniqueRows.filter((row) => row.seriesType === 'change_weekly')
  const latest = levels[0]
  if (!latest) return <div className="domain-card domain-empty" data-domain-card="fuel-market" data-result-state="invalid" data-request-bound={String(request.transportBound)} data-requested-limit={request.limit} data-provider-record-count={data.length} data-valid-record-count={uniqueRows.length} data-invalid-record-count={invalidRecordCount}><h3>Invalid fuel-price response</h3><p>The returned rows do not contain a valid documented <code>series_type=level</code> fuel-price observation.</p></div>

  const latestChange = changes.find((row) => row.date === latest.date)
  const state = !request.transportBound || invalidRecordCount || duplicateRecordCount || !sortValid || !rowLimitValid ? 'partial' : 'ready'
  const ron95History = [...levels].reverse().map((row) => row.metrics.ron95).filter((value): value is number => value !== undefined)

  return <div className="fuel-preview" data-domain-card="fuel-market" data-result-state={state} data-request-bound={String(request.transportBound)} data-requested-limit={request.limit} data-provider-record-count={data.length} data-valid-record-count={uniqueRows.length} data-invalid-record-count={invalidRecordCount} data-duplicate-record-count={duplicateRecordCount} data-level-record-count={levels.length} data-change-record-count={changes.length} data-row-limit-contract={rowLimitValid ? 'valid' : 'invalid'} data-sort-contract={sortValid ? 'valid' : 'invalid'} data-latest-date={latest.date}>
    <header className="fuel-hero"><div><small>Official weekly price · Malaysia</small><strong>{latest.date}</strong><span>Ringgit Malaysia per litre</span></div><div className="fuel-pump" aria-hidden="true"><i/><b>MY</b></div></header>
    {state === 'partial' && <p className="domain-note">The provider response is incomplete, inconsistent with the requested row limit/order, or not bound to executed transport identity. Only unique rows with documented dates, series types, and native numeric fuel values are used.</p>}
    <div className="fuel-price-grid">{fuels.map((fuel) => {
      const value = latest.metrics[fuel.key]
      const change = latestChange?.metrics[fuel.key]
      return <article key={fuel.key} data-fuel={fuel.key} data-fuel-value={value} data-weekly-change={change}><small>{fuel.label}</small><strong>{priceLabel(value)}</strong><span className={change !== undefined && change < 0 ? 'down' : ''}>{movementLabel(change)}</span><em>{fuel.note}</em></article>
    })}</div>
    <div className="fuel-history"><div><small>RON95 level history</small><strong>{ron95History.length} observations</strong></div><Sparkline values={ron95History} label="RON95 price history sparkline"/></div>
    <p className="domain-note">data.gov.my defines <code>series_type=level</code> as RM-per-litre price and <code>series_type=change_weekly</code> as weekly RM movement. The request limit counts returned dataset rows, so one date may contribute both row types.</p>
  </div>
}
