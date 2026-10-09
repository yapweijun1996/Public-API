import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { Sparkline } from './ChartPrimitives'
import { asRecord, CardEmpty, CardHeading, Facts, isoDate } from './cardPrimitives'
import { exactBodylessGetRequestLimit, nonNegativeSafeInteger } from './semanticValidation'

const rm = (value: number) => `RM ${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(value)}`

type IncomeObservation = { date: string; mean: number; median: number }
const requestPattern = /^https:\/\/api\.data\.gov\.my\/data-catalogue\/\?id=hh_income&limit=([1-9]\d*)&sort=-date$/
const observation = (value: unknown): IncomeObservation | undefined => {
  const record = asRecord(value)
  const date = isoDate(record.date)
  const mean = nonNegativeSafeInteger(record.income_mean)
  const median = nonNegativeSafeInteger(record.income_median)
  if (!date || !date.endsWith('-01-01') || mean === undefined || median === undefined) return undefined
  return { date, mean, median }
}

export function MalaysiaHouseholdIncomePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = exactBodylessGetRequestLimit(requestUrl, executedRequest, requestPattern, 6, 30)
  if (!request.valid) return <div className="domain-card domain-empty" data-domain-card="household-income" data-result-state="invalid" data-request-bound="false"><h3>Invalid household income request identity</h3><p>The successful response was not bound to the supported exact bodyless GET data.gov.my request.</p></div>
  const requestedLimit = request.limit
  if (!Array.isArray(data)) return <CardEmpty domain="household-income" title="Invalid household income response" detail="data.gov.my returned HTTP-success data without the documented household-income array." state="invalid"/>
  if (data.length === 0) return request.transportBound
    ? <div className="domain-card domain-empty" data-domain-card="household-income" data-result-state="empty" data-request-bound={String(request.transportBound)}><h3>Household income unavailable</h3><p>data.gov.my returned no published HIES household-income observations for this exact executed request.</p></div>
    : <div className="domain-card domain-empty" data-domain-card="household-income" data-result-state="partial" data-request-bound="false"><h3>Unbound household income response</h3><p>The response is coherent, but executed transport identity is unavailable, so semantic emptiness is not trusted.</p></div>

  const parsedRecords = data.map(observation).filter((record): record is IncomeObservation => Boolean(record))
  const seenDates = new Set<string>()
  const records = parsedRecords.filter((record) => seenDates.has(record.date) ? false : (seenDates.add(record.date), true)).sort((a, b) => b.date.localeCompare(a.date))
  const invalidRecordCount = data.length - parsedRecords.length
  const duplicateDateCount = parsedRecords.length - records.length
  if (!records.length) return <CardEmpty domain="household-income" title="Invalid household income response" detail="data.gov.my returned rows without the documented annual date and native integer mean/median RM values." state="invalid"/>

  const rowLimitValid = data.length <= requestedLimit
  const sortValid = parsedRecords.every((record, index) => index === 0 || parsedRecords[index - 1].date > record.date)
  const latest = records[0]
  const state = !request.transportBound || invalidRecordCount || duplicateDateCount || !rowLimitValid || !sortValid ? 'partial' : 'ready'
  const chronological = [...records].reverse()
  return <div className="domain-card household-income-preview" data-domain-card="household-income" data-result-state={state} data-request-bound={String(request.transportBound)} data-requested-limit={requestedLimit} data-row-limit-contract={rowLimitValid ? 'valid' : 'invalid'} data-sort-contract={sortValid ? 'valid' : 'invalid'} data-provider-record-count={data.length} data-valid-record-count={records.length} data-invalid-record-count={invalidRecordCount} data-duplicate-date-count={duplicateDateCount} data-latest-date={latest.date} data-latest-mean-rm={latest.mean} data-latest-median-rm={latest.median} data-observation-count={records.length} data-price-basis="nominal">
    <CardHeading eyebrow="Department of Statistics Malaysia · HIES" title={`${rm(latest.median)} median monthly household income`} description={`${latest.date.slice(0, 4)} survey observation · nominal gross household income`}><span className="domain-state">{state === 'partial' ? 'Partial provider response' : 'Nominal RM'}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">The provider response is incomplete or inconsistent with the executed request. Only unique rows with the documented annual date and native integer mean/median RM values are shown.</p>}
    <Facts items={[
      { label: 'Latest median', value: rm(latest.median) },
      { label: 'Latest mean', value: rm(latest.mean) },
      { label: 'Mean − median gap', value: rm(latest.mean - latest.median) },
      { label: 'Latest survey year', value: <time dateTime={latest.date}>{latest.date.slice(0, 4)}</time> },
      { label: 'Requested observations', value: String(requestedLimit) },
      { label: 'Valid survey observations shown', value: String(records.length) },
      { label: 'Oldest observation shown', value: records.at(-1)?.date.slice(0, 4) ?? 'Not supplied' },
    ]}/>
    <section className="income-trends" aria-label="Malaysia household income survey trends">
      <article><h4>Median monthly income</h4><Sparkline values={chronological.map((record) => record.median)} label="Malaysia median monthly household income trend"/></article>
      <article><h4>Mean monthly income</h4><Sparkline values={chronological.map((record) => record.mean)} label="Malaysia mean monthly household income trend"/></article>
    </section>
    <ol className="income-observations" aria-label="Household income survey observations">{records.map((record) => <li key={record.date} data-observation-date={record.date} data-mean-rm={record.mean} data-median-rm={record.median}><time dateTime={record.date}>{record.date.slice(0, 4)}</time><span>Median <strong>{rm(record.median)}</strong></span><span>Mean <strong>{rm(record.mean)}</strong></span></li>)}</ol>
    <p className="domain-note">DOSM reports these as <strong>nominal</strong> mean and median gross monthly household incomes, so the values are not inflation-adjusted. HIES observations occur in survey years and should not be read as a complete consecutive annual series.</p>
  </div>
}
