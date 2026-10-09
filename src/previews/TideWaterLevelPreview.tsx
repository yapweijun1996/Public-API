import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty, CardHeading, Facts, finite, text } from './cardPrimitives'

type RequestContext = { station: string; datum: 'MLLW'; units: 'metric'; timeZone: 'gmt'; dateMode: 'latest' }
type RequestTransport = { request?: RequestContext; valid: boolean; bound: boolean }
type WaterLevelReading = { observedAt: string; waterLevel: number; sigma?: number; qualityCode: 'p' | 'v'; rawFlags?: string }

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const REQUEST_KEYS = ['application', 'date', 'datum', 'format', 'product', 'station', 'time_zone', 'units'] as const
const requestContext = (requestUrl?: string): RequestContext | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()].sort()
    const exactKeys = keys.length === REQUEST_KEYS.length
      && keys.every((key, index) => key === REQUEST_KEYS[index])
      && REQUEST_KEYS.every((key) => url.searchParams.getAll(key).length === 1)
    const station = url.searchParams.get('station')?.trim()
    const valid = url.protocol === 'https:'
      && url.hostname === 'api.tidesandcurrents.noaa.gov'
      && url.port === ''
      && !url.username
      && !url.password
      && !url.hash
      && url.pathname === '/api/prod/datagetter'
      && exactKeys
      && Boolean(station && /^\d{7}$/.test(station))
      && url.searchParams.get('product') === 'water_level'
      && url.searchParams.get('date') === 'latest'
      && url.searchParams.get('datum') === 'MLLW'
      && url.searchParams.get('units') === 'metric'
      && url.searchParams.get('time_zone') === 'gmt'
      && url.searchParams.get('application') === 'Public_API_Workbench'
      && url.searchParams.get('format') === 'json'
    return valid && station ? { station, datum: 'MLLW', units: 'metric', timeZone: 'gmt', dateMode: 'latest' } : undefined
  } catch { return undefined }
}
const resolveRequestTransport = (requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestTransport => {
  const displayed = requestContext(requestUrl)
  if (requestUrl && !displayed) return { valid: false, bound: false }
  if (!executedRequest) return displayed ? { request: displayed, valid: true, bound: false } : { valid: false, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) return { valid: false, bound: false }
  const executed = requestContext(executedRequest.url)
  return executed ? { request: executed, valid: true, bound: true } : { valid: false, bound: false }
}
const requestContractMessage = (state: 'invalid' | 'empty' | 'partial', title: string, detail: string, requestBound: boolean) => <div className="domain-card domain-empty" data-domain-card="coastal-water-level" data-result-state={state} data-request-bound={String(requestBound)}><h3>{title}</h3><p>{detail}</p></div>
const heightUnit = (units: string) => units === 'english' ? 'ft' : 'm'
const timeZoneLabel = (zone: string) => zone === 'gmt' ? 'GMT' : zone === 'lst_ldt' ? 'Local time (DST-adjusted)' : zone === 'lst' ? 'Local standard time' : zone.toUpperCase()
const datumLabel = (datum: string) => datum === 'MLLW' ? 'Mean Lower Low Water (MLLW)' : datum
const qualityLabel = (quality?: string) => quality === 'p' ? 'Preliminary' : quality === 'v' ? 'Verified' : quality ? quality : 'Not supplied'
const providerDateTime = (value?: string, timeZone?: string) => timeZone === 'gmt' && value && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}:00Z` : undefined
const flagValue = (value: string | undefined) => value === undefined || value === '' ? 'Not supplied' : value === '1' ? 'Yes' : value === '0' ? 'No' : value
const validObservedAt = (value: unknown) => {
  const candidate = text(value)
  if (!candidate || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(candidate)) return undefined
  const parsed = new Date(`${candidate.replace(' ', 'T')}:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 16).replace('T', ' ') === candidate ? candidate : undefined
}
const readingModel = (value: unknown): WaterLevelReading | undefined => {
  if (!isRecord(value)) return undefined
  const observedAt = validObservedAt(value.t)
  const waterLevel = finite(value.v)
  const qualityCode = text(value.q)?.toLowerCase()
  if (!observedAt || waterLevel === undefined || (qualityCode !== 'p' && qualityCode !== 'v')) return undefined
  return { observedAt, waterLevel, sigma: finite(value.s), qualityCode, rawFlags: typeof value.f === 'string' ? value.f : undefined }
}

export function TideWaterLevelPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const transport = resolveRequestTransport(requestUrl, executedRequest)
  const context = transport.request
  if (!transport.valid || !context) return requestContractMessage('invalid', 'Invalid NOAA request identity', 'The successful response could not be bound to the exact supported NOAA CO-OPS water-level request: it must be a bodyless GET and agree with the displayed URL.', false)
  if (!isRecord(data)) return <CardEmpty domain="coastal-water-level" title="Invalid NOAA water-level response" detail="The HTTP-success body did not contain the documented NOAA response object." state="invalid"/>
  const root = data
  const metadata = isRecord(root.metadata) ? root.metadata : undefined
  const stationId = metadata ? text(metadata.id) : undefined
  const identityMatch = Boolean(context.station && stationId && context.station === stationId)
  if (!metadata || !stationId || !identityMatch) return <CardEmpty domain="coastal-water-level" title="Invalid NOAA station identity" detail="The HTTP-success response did not identify the same NOAA CO-OPS station requested by this demo." state="invalid"/>
  if (!Array.isArray(root.data)) return <CardEmpty domain="coastal-water-level" title="Invalid NOAA water-level response" detail="The HTTP-success response did not include the documented water-level data array." state="invalid"/>
  if (root.data.length === 0) return transport.bound
    ? requestContractMessage('empty', 'Water-level observation unavailable', 'NOAA returned a valid station response with no water-level observation for this request.', true)
    : requestContractMessage('partial', 'Unbound NOAA empty response', 'NOAA returned a structurally valid zero-observation response, but executed-request evidence is unavailable, so it is not marked as a trustworthy semantic empty result.', false)

  const readings = root.data.map(readingModel).filter((reading): reading is WaterLevelReading => Boolean(reading))
  const invalidRecordCount = root.data.length - readings.length
  if (!readings.length) return <CardEmpty domain="coastal-water-level" title="Invalid NOAA water-level observation" detail="NOAA returned water-level records, but none contained the documented observation time, measured value, and QA/QC identity." state="invalid"/>

  const reading = readings[0]
  const stationName = text(metadata.name) ?? stationId
  const latitude = finite(metadata.lat)
  const longitude = finite(metadata.lon)
  const { waterLevel, sigma, observedAt, qualityCode, rawFlags } = reading
  const flags = rawFlags?.split(',').map((value) => value.trim()) ?? []
  const unit = heightUnit(context.units)
  const observedDateTime = providerDateTime(observedAt, context.timeZone)
  const quality = qualityLabel(qualityCode)
  const firstFlagLabel = qualityCode === 'p' ? 'Samples outside 3σ band' : 'Inferred value'
  const firstFlagValue = qualityCode === 'p' ? (flags[0] || 'Not supplied') : flagValue(flags[0])
  const incompleteRecordCount = readings.filter((item) => item.sigma === undefined || item.rawFlags === undefined).length
  const countContractValid = context.dateMode !== 'latest' || root.data.length === 1
  const resultState = !transport.bound || invalidRecordCount > 0 || incompleteRecordCount > 0 || !countContractValid || latitude === undefined || longitude === undefined ? 'partial' : 'ready'

  return <div className="domain-card tide-water-level-preview" data-domain-card="coastal-water-level" data-result-state={resultState} data-request-bound={String(transport.bound)} data-request-contract="exact-water-level-latest-mllw-metric-gmt-json" data-requested-station-id={context.station} data-identity-match="true" data-provider-record-count={root.data.length} data-valid-record-count={readings.length} data-invalid-record-count={invalidRecordCount} data-incomplete-record-count={incompleteRecordCount} data-count-contract-valid={String(countContractValid)} data-station-id={stationId} data-station-name={stationName} data-primary-water-level={waterLevel} data-water-level-unit={unit} data-observed-at={observedAt} data-quality-level={qualityCode} data-datum={context.datum} data-time-zone={context.timeZone} data-sigma={sigma} data-flags={rawFlags} data-latitude={latitude} data-longitude={longitude}>
    <CardHeading eyebrow="NOAA CO-OPS water level" title={stationName} description={`Station ${stationId} · Latest returned coastal water-level observation`}><span className={`domain-state${qualityCode === 'p' ? ' warning' : ''}`}>{resultState === 'partial' ? `Partial · ${quality}` : quality}</span></CardHeading>
    {resultState === 'partial' && <p className="domain-note">{transport.bound ? 'NOAA returned an incomplete or mixed observation response. The card shows only records with provider time, measured value, and QA/QC identity; missing quality details remain unavailable.' : 'NOAA returned a coherent station measurement, but executed-request identity is unavailable, so the result is not marked ready.'}</p>}
    <section className="tide-reading" aria-labelledby="tide-reading-heading"><div><span id="tide-reading-heading">Water level</span><strong>{waterLevel.toLocaleString('en', { maximumSignificantDigits: 12 })} <small>{unit}</small></strong><p>Relative to {datumLabel(context.datum)}</p></div><dl><div><dt>Observed</dt><dd><time dateTime={observedDateTime}>{observedAt} {timeZoneLabel(context.timeZone)}</time></dd></div><div><dt>QA/QC level</dt><dd>{quality}</dd></div><div><dt>1-second sample σ</dt><dd>{sigma === undefined ? 'Not supplied' : `${sigma.toLocaleString('en', { maximumSignificantDigits: 12 })} ${unit}`}</dd></div></dl></section>
    <Facts items={[{ label: 'Station ID', value: stationId }, { label: 'Coordinates', value: latitude !== undefined && longitude !== undefined ? `${latitude}, ${longitude}` : 'Not supplied' }, { label: 'Datum', value: datumLabel(context.datum) }, { label: 'Units', value: 'Metric' }, { label: 'Time zone', value: timeZoneLabel(context.timeZone) }, { label: 'Request window', value: context.dateMode === 'latest' ? 'Latest point available within 18 minutes' : context.dateMode }]}/>
    {flags.length > 0 && <section className="tide-quality" aria-labelledby="tide-quality-heading"><h4 id="tide-quality-heading">Quality-control flags</h4><dl><div><dt>{firstFlagLabel}</dt><dd>{firstFlagValue}</dd></div><div><dt>Flat tolerance exceeded</dt><dd>{flagValue(flags[1])}</dd></div><div><dt>Rate-of-change tolerance exceeded</dt><dd>{flagValue(flags[2])}</dd></div><div><dt>Expected water-level limit exceeded</dt><dd>{flagValue(flags[3])}</dd></div></dl></section>}
    <p className="domain-note">NOAA defines <code>date=latest</code> as the last data point available within 18 minutes. Water-level values use the requested datum and units; the provider's QA/QC code determines whether the observation is preliminary or verified. Raw JSON retains the original sigma and flag fields.</p>
  </div>
}
