import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, Facts, finite, numericText, text } from './cardPrimitives'
import { cleanText } from './previewData'
import { nonNegativeSafeInteger, trimmedText } from './semanticValidation'

type OccurrenceModel = {
  scientificName: string
  originalScientificName?: string
  occurrenceId?: string
  eventDate?: string
  occurrenceStatus?: string
  basisOfRecord?: string
  latitude?: number
  longitude?: number
  minimumDepth?: number
  maximumDepth?: number
  datasetName?: string
  scientificNameId?: string
  aphiaId?: number
  flags: string[]
  license?: string
}

const occurrenceModel = (value: unknown): OccurrenceModel | undefined => {
  const row = asRecord(value)
  const occurrenceId = text(row.occurrenceID)
  const scientificName = cleanText(row.scientificName)
  if (!occurrenceId || !scientificName) return undefined
  return {
    scientificName,
    originalScientificName: cleanText(row.originalScientificName),
    occurrenceId,
    eventDate: text(row.eventDate),
    occurrenceStatus: text(row.occurrenceStatus),
    basisOfRecord: text(row.basisOfRecord),
    latitude: finite(row.decimalLatitude),
    longitude: finite(row.decimalLongitude),
    minimumDepth: finite(row.minimumDepthInMeters),
    maximumDepth: finite(row.maximumDepthInMeters),
    datasetName: cleanText(row.datasetName),
    scientificNameId: text(row.scientificNameID),
    aphiaId: finite(row.aphiaID),
    flags: Array.isArray(row.flags) ? row.flags.filter((flag): flag is string => typeof flag === 'string' && Boolean(flag.trim())) : [],
    license: text(row.license),
  }
}

type ObisRequest = { scientificName: string; size: number }
type BoundObisRequest = { request?: ObisRequest; transportBound: boolean; invalidReason?: string }

const exactKeys = (params: URLSearchParams, expected: string[]) => {
  const actual = [...params.keys()].sort()
  const target = [...expected].sort()
  return actual.length === target.length && actual.every((key, index) => key === target[index] && params.getAll(key).length === 1)
}

const parseRequest = (requestUrl?: string): ObisRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'api.obis.org' || url.port || url.username || url.password || url.pathname !== '/v3/occurrence' || url.hash) return undefined
    if (!exactKeys(url.searchParams, ['scientificname', 'size'])) return undefined
    const scientificName = trimmedText(url.searchParams.get('scientificname'))
    const sizeRaw = url.searchParams.get('size') ?? ''
    const size = /^(?:[1-9]|10)$/.test(sizeRaw) ? Number(sizeRaw) : undefined
    return scientificName && size !== undefined ? { scientificName, size } : undefined
  } catch { return undefined }
}
const bindRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundObisRequest => {
  const request = parseRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported OBIS occurrence query.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET OBIS occurrence request.' }
  const executed = parseRequest(executedRequest.url)
  if (!executed || executed.scientificName !== request.scientificName || executed.size !== request.size) return { request, transportBound: false, invalidReason: 'The displayed OBIS request and executed request identity did not match.' }
  return { request, transportBound: true }
}

const coordinate = (latitude?: number, longitude?: number) => latitude === undefined || longitude === undefined ? 'Not supplied' : `${numericText(latitude)}, ${numericText(longitude)}`
const depth = (minimum?: number, maximum?: number) => {
  if (minimum === undefined && maximum === undefined) return 'Not supplied'
  if (minimum !== undefined && maximum !== undefined) return minimum === maximum ? `${numericText(minimum)} m` : `${numericText(minimum)}–${numericText(maximum)} m`
  return `${numericText((minimum ?? maximum)!)} m`
}

export function ObisOccurrencePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const identity = bindRequest(requestUrl, executedRequest)
  const request = identity.request
  const baseAttrs = {
    'data-domain-card': 'marine-occurrences',
    'data-request-bound': request && identity.transportBound ? 'true' : 'false',
    'data-request-contract': 'exact-obis-occurrence-v2',
    'data-requested-scientific-name': request?.scientificName,
    'data-requested-size': request?.size,
  }
  if (!request || identity.invalidReason) {
    return <div className="domain-card domain-empty obis-occurrence-preview" {...baseAttrs} data-result-state="invalid"><h3>Invalid OBIS occurrence request identity</h3><p>{identity.invalidReason ?? 'The successful response was not tied to the exact supported OBIS occurrence request.'}</p></div>
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <div className="domain-card domain-empty obis-occurrence-preview" {...baseAttrs} data-result-state="invalid"><h3>Invalid OBIS occurrence response</h3><p>OBIS did not return the expected occurrence response object.</p></div>
  }
  const root = asRecord(data)
  if (!Array.isArray(root.results)) {
    return <div className="domain-card domain-empty obis-occurrence-preview" {...baseAttrs} data-result-state="invalid"><h3>Invalid OBIS occurrence response</h3><p>OBIS did not return the expected results array.</p></div>
  }
  const total = nonNegativeSafeInteger(root.total)
  if (root.results.length === 0) {
    if (total === 0) {
      const state = identity.transportBound ? 'empty' : 'partial'
      return <div className="domain-card domain-empty obis-occurrence-preview" {...baseAttrs} data-result-state={state}><h3>{identity.transportBound ? 'No marine occurrences returned' : 'OBIS result not request-bound'}</h3><p>{identity.transportBound ? 'OBIS reported zero matching occurrences for this exact executed scientific-name request.' : 'OBIS returned a coherent zero-result response, but executed request evidence was unavailable, so the result is not claimed as exact-request-bound.'}</p></div>
    }
    return <div className="domain-card domain-empty obis-occurrence-preview" {...baseAttrs} data-result-state="invalid"><h3>Invalid OBIS occurrence response</h3><p>OBIS returned an empty results array without the expected zero total.</p></div>
  }

  const occurrences = root.results.map(occurrenceModel).filter((row): row is OccurrenceModel => Boolean(row))
  const invalidRecordCount = root.results.length - occurrences.length
  if (!occurrences.length) {
    return <div className="domain-card domain-empty obis-occurrence-preview" {...baseAttrs} data-result-state="invalid"><h3>Invalid OBIS occurrence response</h3><p>OBIS returned occurrence rows without the required occurrenceID and scientificName identity fields.</p></div>
  }
  const countContractValid = total !== undefined && total >= root.results.length
  const rowLimitContractValid = root.results.length <= request.size
  const resultState = invalidRecordCount > 0 || !countContractValid || !rowLimitContractValid || !identity.transportBound ? 'partial' : 'ready'
  const first = occurrences[0]
  return <div className="domain-card obis-occurrence-preview" {...baseAttrs} data-result-state={resultState} data-provider-total={total} data-provider-record-count={root.results.length} data-valid-record-count={occurrences.length} data-invalid-record-count={invalidRecordCount} data-count-contract-valid={String(countContractValid)} data-row-limit-contract-valid={String(rowLimitContractValid)} data-visible-occurrence-count={occurrences.length} data-primary-occurrence-id={first.occurrenceId} data-primary-scientific-name={first.scientificName} data-primary-occurrence-status={first.occurrenceStatus} data-primary-basis-of-record={first.basisOfRecord} data-primary-latitude={first.latitude} data-primary-longitude={first.longitude} data-primary-quality-flags={first.flags.join(',')}>
    <CardHeading eyebrow="OBIS · Darwin Core occurrence records" title={total === undefined ? `${occurrences.length} returned marine occurrence${occurrences.length === 1 ? '' : 's'}` : `${occurrences.length} shown · ${numericText(total)} matching occurrences`} description={identity.transportBound ? `Request-bound occurrence records for scientific-name filter “${request.scientificName}” with size ${request.size}. OBIS may resolve historical or synonym names to a current accepted scientific name; status, provenance and quality flags remain attached to each record.` : `The response is structurally coherent for scientific-name filter “${request.scientificName}”, but executed request evidence was unavailable, so it is not marked ready.`}><span className="domain-state">{resultState === 'ready' ? 'Occurrence evidence' : 'Partial occurrence evidence'}</span></CardHeading>
    {!identity.transportBound && <p className="domain-note">Executed request evidence was unavailable. The occurrence records remain visible as partial evidence but are not claimed as exact-request-bound.</p>}
    {(invalidRecordCount > 0 || !countContractValid || !rowLimitContractValid) && <p className="domain-note">This OBIS response is incomplete or malformed. The card preserves only occurrence rows with provider-owned occurrenceID and scientificName identity, requires native count evidence, and never treats more returned rows than the executed size as complete.</p>}
    <ol className="biodiversity-record-list obis-occurrence-list" aria-label="OBIS marine occurrence records">
      {occurrences.map((occurrence, index) => <li key={`${occurrence.occurrenceId ?? occurrence.scientificName}-${index}`} data-occurrence-index={index + 1} data-occurrence-id={occurrence.occurrenceId} data-scientific-name={occurrence.scientificName} data-occurrence-status={occurrence.occurrenceStatus} data-basis-of-record={occurrence.basisOfRecord} data-latitude={occurrence.latitude} data-longitude={occurrence.longitude} data-quality-flags={occurrence.flags.join(',')}>
        <header><div><small>{occurrence.occurrenceId ?? 'Occurrence ID not supplied'}</small><h4>{occurrence.scientificName}</h4></div><span>{occurrence.occurrenceStatus ?? 'Status not supplied'}</span></header>
        <Facts items={[
          { label: 'Event date', value: occurrence.eventDate ? (occurrence.eventDate.includes('/') ? occurrence.eventDate : <time dateTime={occurrence.eventDate}>{occurrence.eventDate}</time>) : 'Not supplied' },
          { label: 'Basis of record', value: occurrence.basisOfRecord ?? 'Not supplied' },
          { label: 'Coordinates · WGS84', value: coordinate(occurrence.latitude, occurrence.longitude) },
          { label: 'Depth', value: depth(occurrence.minimumDepth, occurrence.maximumDepth) },
          { label: 'Dataset', value: occurrence.datasetName ?? 'Not supplied' },
          { label: 'WoRMS AphiaID', value: occurrence.aphiaId === undefined ? 'Not supplied' : numericText(occurrence.aphiaId) },
        ]}/>
        {occurrence.originalScientificName && occurrence.originalScientificName !== occurrence.scientificName && <p className="biodiversity-note"><strong>Original scientific name:</strong> {occurrence.originalScientificName}</p>}
        {occurrence.scientificNameId && <p className="biodiversity-note"><strong>Scientific name ID:</strong> <code>{occurrence.scientificNameId}</code></p>}
        <div className="biodiversity-flags" aria-label={`Quality flags for ${occurrence.occurrenceId ?? occurrence.scientificName}`}>{occurrence.flags.length ? occurrence.flags.map((flag) => <span key={flag}>{flag}</span>) : <span>No provider QC flags</span>}</div>
        {occurrence.license && <p className="biodiversity-note"><strong>Record license:</strong> {occurrence.license}</p>}
      </li>)}
    </ol>
    <p className="domain-note">OBIS aggregates occurrence records from many datasets. Provider QC flags are useful review signals, not automatic proof that an occurrence is invalid; dataset licensing and the complete source record remain available in Raw JSON.</p>
  </div>
}
