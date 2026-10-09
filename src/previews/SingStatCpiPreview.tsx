import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { isRecord, nonNegativeInteger, trimmedText } from './semanticValidation'

const RESOURCE_ID = 'M213752'
const REQUEST_PATH = `/api/table/tabledata/${RESOURCE_ID}`
const REQUEST_LIMIT = '12'
const REQUEST_SORT = 'key desc'
const monthIndex: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
type CpiPeriod = { key: string; year: number; month: number }
type CpiPoint = CpiPeriod & { value: number }

const SINGSTAT_REQUEST_URL = `https://tablebuilder.singstat.gov.sg${REQUEST_PATH}?${new URLSearchParams({ seriesNoORrowNo: '1', limit: REQUEST_LIMIT, sortBy: REQUEST_SORT }).toString()}`

const exactSingStatRequestUrl = (requestUrl?: string): boolean => requestUrl === SINGSTAT_REQUEST_URL

type SingStatTransport = { valid: boolean; bound: boolean }
const resolveSingStatTransport = (requestUrl?: string, executedRequest?: ExecutedRequestContext): SingStatTransport => {
  if (requestUrl !== undefined && !exactSingStatRequestUrl(requestUrl)) return { valid: false, bound: false }
  if (!executedRequest) return { valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) return { valid: false, bound: false }
  return exactSingStatRequestUrl(executedRequest.url) ? { valid: true, bound: true } : { valid: false, bound: false }
}
const parsePeriod = (value: unknown): CpiPeriod | undefined => {
  if (!isRecord(value)) return undefined
  const key = trimmedText(value.key)
  const match = key && /^(\d{4}) ([A-Z][a-z]{2})$/.exec(key)
  if (!match || !(match[2] in monthIndex)) return undefined
  return { key, year: Number(match[1]), month: monthIndex[match[2]] }
}
const parsePoint = (value: unknown): CpiPoint | undefined => {
  const period = parsePeriod(value)
  if (!period || !isRecord(value)) return undefined
  const raw = trimmedText(value.value)
  if (!raw) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  return { ...period, value: n }
}
const ordinal = (point: CpiPeriod) => point.year * 12 + point.month
const strictDescendingPeriods = (columns: unknown[]): boolean => {
  const periods = columns.map(parsePeriod)
  if (periods.some((period) => !period)) return false
  return periods.every((period, index) => index === 0 || ordinal(period as CpiPeriod) < ordinal(periods[index - 1] as CpiPeriod))
}
const invalid = (detail: string) => <CardEmpty domain="singapore-cpi" title="Invalid SingStat CPI response" detail={detail} state="invalid"/>

export function SingStatCpiPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const transport = resolveSingStatTransport(requestUrl, executedRequest)
  if (!transport.valid) return <div className="domain-card domain-empty" data-domain-card="singapore-cpi" data-result-state="invalid" data-request-bound="false" data-query-bound="false"><h3>Invalid SingStat CPI request</h3><p>The successful response was not bound to the exact supported bodyless GET SingStat M213752 latest-12 request.</p></div>
  if (!isRecord(data) || !isRecord(data.Data)) return invalid('SingStat returned HTTP-success data without the documented Data table envelope.')
  const root = data.Data
  const status = nonNegativeInteger(data.StatusCode)
  const id = trimmedText(root.id); const title = trimmedText(root.title); const frequency = trimmedText(root.frequency); const datasource = trimmedText(root.datasource); const updated = trimmedText(root.dataLastUpdated)
  if (status !== 200 || id !== RESOURCE_ID || frequency !== 'Monthly' || !title?.includes('Consumer Price Index') || !datasource?.includes('SINGAPORE DEPARTMENT OF STATISTICS')) return invalid('The returned table identity does not match the official monthly Singapore CPI contract.')
  if (!Array.isArray(root.row) || root.row.length !== 1 || !isRecord(root.row[0])) return invalid('The all-items request did not return exactly one identifiable CPI series.')
  const series = root.row[0]
  if (trimmedText(series.seriesNo) !== '1' || trimmedText(series.rowText) !== 'All Items' || trimmedText(series.uoM) !== 'Index' || !Array.isArray(series.columns)) return invalid('The provider row does not identify the All Items Index series.')

  const providerLimit = trimmedText(root.limit)
  const providerSort = trimmedText(root.sortBy)
  const queryContract = providerLimit === REQUEST_LIMIT && providerSort === REQUEST_SORT
  const limitContract = series.columns.length > 0 && series.columns.length <= Number(REQUEST_LIMIT)
  const orderContract = strictDescendingPeriods(series.columns)
  if (!queryContract || !limitContract || !orderContract) return invalid('SingStat did not acknowledge or satisfy the bounded latest-12 key-descending request contract.')

  const parsed = series.columns.map(parsePoint)
  const trusted = parsed.filter((point): point is CpiPoint => Boolean(point))
  const invalidCount = series.columns.length - trusted.length
  if (!trusted.length) return invalid('None of the provider CPI observations contained a trustworthy month and index value.')
  const dedup = new Map<string, CpiPoint>(); let duplicateCount = 0
  for (const point of trusted) { if (dedup.has(point.key)) duplicateCount += 1; else dedup.set(point.key, point) }
  const sorted = [...dedup.values()].sort((a, b) => a.year - b.year || a.month - b.month)
  const recent = sorted.slice(-12).reverse()
  const bound = transport.bound
  const state = bound && invalidCount === 0 && duplicateCount === 0 && Boolean(updated) ? 'ready' : 'partial'
  const cards: SemanticCard[] = recent.map((point) => ({ title: point.key, eyebrow: 'Singapore CPI · 2024=100', badge: point.value.toFixed(3), metrics: [{ label: 'All Items Index', value: point.value.toFixed(3) }, { label: 'Period', value: point.key }], }))
  const latest = sorted.at(-1)
  return <div data-domain-card="singapore-cpi" data-result-state={state} data-resource-id={id} data-query-bound={bound ? 'true' : 'false'} data-request-bound={bound ? 'true' : 'false'} data-request-limit={REQUEST_LIMIT} data-provider-limit={providerLimit} data-request-sort={REQUEST_SORT} data-provider-sort={providerSort} data-query-contract={String(queryContract)} data-limit-contract={String(limitContract)} data-order-contract={String(orderContract)} data-provider-observation-count={series.columns.length} data-valid-observation-count={sorted.length} data-invalid-observation-count={invalidCount} data-duplicate-observation-count={duplicateCount} data-latest-period={latest?.key} data-latest-value={latest?.value} data-provider-updated={updated}>
    <div className="domain-note"><strong>{title}</strong> · latest {latest?.key ?? 'period unavailable'}{updated ? ` · provider updated ${updated}` : ''}</div>
    {state === 'partial' && <p className="domain-note">Only validated All Items CPI observations are shown because update metadata, duplicate periods, or one or more provider values are incomplete.</p>}
    <SemanticCards cards={cards} emptyTitle="Singapore CPI observations unavailable"/>
  </div>
}
