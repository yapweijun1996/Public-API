import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty, CardHeading, Facts, asRecord, isoDate, numericText, text } from './cardPrimitives'
import { Sparkline } from './ChartPrimitives'
import { exactBodylessGetRequestLimit, finiteNumber } from './semanticValidation'

type CoreCpiObservation = { date: string; index: number }

const requestPattern = /^https:\/\/api\.data\.gov\.my\/data-catalogue\/\?id=cpi_core&filter=overall%40division&limit=([1-9]\d*)&sort=-date$/
const observation = (value: unknown): CoreCpiObservation | undefined => {
  const record = asRecord(value)
  const date = isoDate(record.date)
  const index = finiteNumber(record.index)
  if (!date || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(date) || text(record.division) !== 'overall' || index === undefined) return undefined
  return { date, index }
}

export function MalaysiaCoreCpiPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = exactBodylessGetRequestLimit(requestUrl, executedRequest, requestPattern, 6, 60)
  if (!request.valid) return <div className="domain-card domain-empty" data-domain-card="core-cpi-index" data-result-state="invalid" data-request-bound="false"><h3>Invalid core CPI request identity</h3><p>The successful response was not bound to the supported exact bodyless GET data.gov.my request.</p></div>
  const requestedLimit = request.limit
  if (!Array.isArray(data)) return <CardEmpty domain="core-cpi-index" title="Invalid core CPI response" detail="data.gov.my returned HTTP-success data without the documented core-CPI observation array." state="invalid"/>
  if (data.length === 0) return request.transportBound
    ? <div className="domain-card domain-empty" data-domain-card="core-cpi-index" data-result-state="empty" data-request-bound={String(request.transportBound)}><h3>Core CPI index unavailable</h3><p>data.gov.my returned no overall monthly core CPI observations for this exact executed request.</p></div>
    : <div className="domain-card domain-empty" data-domain-card="core-cpi-index" data-result-state="partial" data-request-bound="false"><h3>Unbound core CPI response</h3><p>The response is coherent, but executed transport identity is unavailable, so semantic emptiness is not trusted.</p></div>

  const parsedRecords = data.map(observation).filter((record): record is CoreCpiObservation => Boolean(record))
  const seenDates = new Set<string>()
  const records = parsedRecords.filter((record) => seenDates.has(record.date) ? false : (seenDates.add(record.date), true)).sort((a, b) => b.date.localeCompare(a.date))
  const invalidRecordCount = data.length - parsedRecords.length
  const duplicateDateCount = parsedRecords.length - records.length
  if (!records.length) return <CardEmpty domain="core-cpi-index" title="Invalid core CPI response" detail="data.gov.my returned rows without the documented overall division, monthly YYYY-MM-01 date, and native numeric core CPI index." state="invalid"/>

  const rowLimitValid = data.length <= requestedLimit
  const sortValid = parsedRecords.every((record, index) => index === 0 || parsedRecords[index - 1].date > record.date)
  const latest = records[0]
  const state = !request.transportBound || invalidRecordCount || duplicateDateCount || !rowLimitValid || !sortValid ? 'partial' : 'ready'
  const chronological = [...records].reverse()
  const values = chronological.map((record) => record.index)
  const oldest = records.at(-1)

  return <div className="domain-card malaysia-core-cpi-preview" data-domain-card="core-cpi-index" data-result-state={state} data-request-bound={String(request.transportBound)} data-requested-limit={requestedLimit} data-row-limit-contract={rowLimitValid ? 'valid' : 'invalid'} data-sort-contract={sortValid ? 'valid' : 'invalid'} data-provider-record-count={data.length} data-valid-record-count={records.length} data-invalid-record-count={invalidRecordCount} data-duplicate-date-count={duplicateDateCount} data-primary-index={latest.index} data-latest-date={latest.date} data-series-count={records.length} data-division="overall" data-index-base="2010=100">
    <CardHeading eyebrow="Department of Statistics Malaysia · data.gov.my" title={`Core CPI index ${numericText(latest.index)}`} description={`${latest.date} · Overall monthly index · base 2010 = 100`}><span className="domain-state">{state === 'partial' ? 'Partial provider response' : 'Index, not inflation %'}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">The provider response is incomplete or inconsistent with the executed request. Only unique rows with the documented overall division, monthly date, and native numeric index are shown.</p>}
    <Sparkline values={values} label="Malaysia overall core CPI index trend"/>
    <Facts items={[
      { label: 'Latest month', value: latest.date },
      { label: 'Latest index', value: numericText(latest.index) },
      { label: 'Requested rows', value: numericText(requestedLimit) },
      { label: 'Index base', value: '2010 = 100' },
      { label: 'Division', value: 'Overall' },
      { label: 'Valid observations shown', value: numericText(records.length) },
      { label: 'Oldest month in response', value: oldest?.date ?? 'Not supplied' },
    ]}/>
    <section className="cpi-trend" aria-label="Recent Malaysia overall core CPI index values"><h4>Recent monthly index values</h4><ol>{records.slice(0, 12).map((record) => <li key={record.date} data-observation-date={record.date} data-core-cpi-index={record.index}><span>{record.date}</span><strong>{numericText(record.index)}</strong></li>)}</ol></section>
    <p className="domain-note"><strong>Index, not inflation %.</strong> DOSM defines this monthly Core CPI series with base <strong>2010 = 100</strong>. The executed request is bound to <code>id=cpi_core</code>, <code>filter=overall@division</code>, and descending date order, so each trusted row is one national monthly overall-index observation.</p>
  </div>
}
