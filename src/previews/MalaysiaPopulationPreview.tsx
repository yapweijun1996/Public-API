import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { Sparkline } from './ChartPrimitives'
import { CardEmpty, CardHeading, Facts, asRecord, isoDate, numericText } from './cardPrimitives'
import { exactBodylessGetRequestLimit, finiteNumber } from './semanticValidation'

type PopulationObservation = { date: string; populationThousand: number }
const requestPattern = /^https:\/\/api\.data\.gov\.my\/data-catalogue\/\?id=population_malaysia&filter=both%40sex%2Coverall%40age%2Coverall%40ethnicity&limit=([1-9]\d*)&sort=-date$/
const observation = (value: unknown): PopulationObservation | undefined => {
  const record = asRecord(value)
  const date = isoDate(record.date)
  const populationThousand = finiteNumber(record.population)
  if (!date || !/^\d{4}-01-01$/.test(date) || record.sex !== 'both' || record.age !== 'overall' || record.ethnicity !== 'overall' || populationThousand === undefined || populationThousand < 0) return undefined
  return { date, populationThousand }
}

export function MalaysiaPopulationPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = exactBodylessGetRequestLimit(requestUrl, executedRequest, requestPattern, 6, 57)
  if (!request.valid) return <div className="domain-card domain-empty" data-domain-card="population-total" data-result-state="invalid" data-request-bound="false"><h3>Invalid Malaysia population request identity</h3><p>The successful response was not bound to the supported exact bodyless GET data.gov.my request.</p></div>
  const requestedLimit = request.limit
  if (!Array.isArray(data)) return <CardEmpty domain="population-total" title="Invalid Malaysia population response" detail="data.gov.my returned HTTP-success data without the documented national-population observation array." state="invalid"/>
  if (data.length === 0) return request.transportBound
    ? <div className="domain-card domain-empty" data-domain-card="population-total" data-result-state="empty" data-request-bound={String(request.transportBound)}><h3>Malaysia population total unavailable</h3><p>data.gov.my returned no national total population observations for this exact executed request.</p></div>
    : <div className="domain-card domain-empty" data-domain-card="population-total" data-result-state="partial" data-request-bound="false"><h3>Unbound Malaysia population response</h3><p>The response is coherent, but executed transport identity is unavailable, so semantic emptiness is not trusted.</p></div>

  const parsedRecords = data.map(observation).filter((record): record is PopulationObservation => Boolean(record))
  const seenDates = new Set<string>()
  const records = parsedRecords.filter((record) => seenDates.has(record.date) ? false : (seenDates.add(record.date), true)).sort((a, b) => b.date.localeCompare(a.date))
  const invalidRecordCount = data.length - parsedRecords.length
  const duplicateDateCount = parsedRecords.length - records.length
  if (!records.length) return <CardEmpty domain="population-total" title="Invalid Malaysia population response" detail="data.gov.my returned rows without the documented annual date, overall demographic dimensions, and native numeric population value." state="invalid"/>

  const rowLimitValid = data.length <= requestedLimit
  const sortValid = parsedRecords.every((record, index) => index === 0 || parsedRecords[index - 1].date > record.date)
  const latest = records[0]
  const populationPeople = latest.populationThousand * 1000
  const chronological = [...records].reverse()
  const series = chronological.map((record) => record.populationThousand * 1000)
  const state = !request.transportBound || invalidRecordCount || duplicateDateCount || !rowLimitValid || !sortValid ? 'partial' : 'ready'

  return <div className="domain-card malaysia-population-preview" data-domain-card="population-total" data-result-state={state} data-request-bound={String(request.transportBound)} data-requested-limit={requestedLimit} data-row-limit-contract={rowLimitValid ? 'valid' : 'invalid'} data-sort-contract={sortValid ? 'valid' : 'invalid'} data-provider-record-count={data.length} data-valid-record-count={records.length} data-invalid-record-count={invalidRecordCount} data-duplicate-date-count={duplicateDateCount} data-latest-date={latest.date} data-primary-population-thousand={latest.populationThousand} data-primary-population-people={populationPeople} data-series-count={records.length} data-sex="both" data-age="overall" data-ethnicity="overall">
    <CardHeading eyebrow="Department of Statistics Malaysia · National population" title={`${numericText(populationPeople)} people`} description={`${latest.date.slice(0, 4)} estimate · both sexes · all ages · all ethnicities`}><span className="domain-state">{state === 'partial' ? 'Partial provider response' : "Provider unit: '000 people"}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">The provider response is incomplete or inconsistent with the executed request. Only unique rows with the documented annual date, national-total demographic dimensions, and native numeric population are shown.</p>}
    <Sparkline values={series} label="Malaysia total population trend"/>
    <Facts items={[
      { label: 'Latest population', value: numericText(populationPeople) },
      { label: "Provider raw ('000 people)", value: numericText(latest.populationThousand) },
      { label: 'Reference year', value: <time dateTime={latest.date}>{latest.date.slice(0, 4)}</time> },
      { label: 'Requested years', value: numericText(requestedLimit) },
      { label: 'Sex dimension', value: 'Both sexes' },
      { label: 'Age dimension', value: 'All ages' },
      { label: 'Ethnicity dimension', value: 'All ethnicities' },
      { label: 'Valid observations shown', value: numericText(records.length) },
    ]}/>
    <ol className="population-observations" aria-label="Malaysia total population observations">{records.map((record) => <li key={record.date} data-observation-date={record.date} data-population-thousand={record.populationThousand}><time dateTime={record.date}>{record.date.slice(0, 4)}</time><strong>{numericText(record.populationThousand * 1000)}</strong></li>)}</ol>
    <p className="domain-note">The source dataset is multidimensional. This demo deliberately requests only <code>sex=both</code>, <code>age=overall</code>, and <code>ethnicity=overall</code>, so each trusted row is one national total rather than an arbitrary demographic slice. DOSM publishes population in thousands of people.</p>
  </div>
}
