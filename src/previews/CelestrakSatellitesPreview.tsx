import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, Facts, finite, numericText, text } from './cardPrimitives'
import { cleanText } from './previewData'

type SatelliteModel = {
  name: string; objectId?: string; noradId?: number; epoch?: string; meanMotion?: number; eccentricity?: number;
  inclination?: number; rightAscension?: number; argumentOfPericenter?: number; meanAnomaly?: number;
  classification?: string; elementSet?: number; revolutionAtEpoch?: number
}

const satelliteModel = (value: unknown): SatelliteModel | undefined => {
  const row = asRecord(value)
  const noradId = finite(row.NORAD_CAT_ID)
  const epoch = text(row.EPOCH)
  const meanMotion = finite(row.MEAN_MOTION)
  const eccentricity = finite(row.ECCENTRICITY)
  const inclination = finite(row.INCLINATION)
  const rightAscension = finite(row.RA_OF_ASC_NODE)
  const argumentOfPericenter = finite(row.ARG_OF_PERICENTER)
  const meanAnomaly = finite(row.MEAN_ANOMALY)
  const name = cleanText(row.OBJECT_NAME) ?? (noradId !== undefined ? `NORAD ${noradId}` : undefined)
  if (noradId === undefined || !name || !epoch || meanMotion === undefined || eccentricity === undefined || inclination === undefined || rightAscension === undefined || argumentOfPericenter === undefined || meanAnomaly === undefined) return undefined
  return {
    name, noradId, objectId: text(row.OBJECT_ID), epoch, meanMotion,
    eccentricity, inclination, rightAscension,
    argumentOfPericenter, meanAnomaly,
    classification: text(row.CLASSIFICATION_TYPE), elementSet: finite(row.ELEMENT_SET_NO), revolutionAtEpoch: finite(row.REV_AT_EPOCH),
  }
}

type CelestrakRequest = { group: 'stations' | 'gps-ops' }
type CelestrakRequestIdentity = { request?: CelestrakRequest; transportBound: boolean; invalidReason?: string }

const parseCelestrakRequest = (requestUrl?: string): CelestrakRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'celestrak.org' || url.pathname !== '/NORAD/elements/gp.php' || url.hash) return undefined
    const group = url.searchParams.get('GROUP')
    if (group !== 'stations' && group !== 'gps-ops') return undefined
    if (url.searchParams.getAll('GROUP').length !== 1 || url.searchParams.getAll('FORMAT').length !== 1 || url.searchParams.get('FORMAT') !== 'json') return undefined
    if ([...url.searchParams.keys()].length !== 2) return undefined
    const canonical = `https://celestrak.org/NORAD/elements/gp.php?${new URLSearchParams({ GROUP: group, FORMAT: 'json' }).toString()}`
    return requestUrl === canonical ? { group } : undefined
  } catch {
    return undefined
  }
}

const bindCelestrakRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): CelestrakRequestIdentity => {
  const request = parseCelestrakRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported bounded CelesTrak GP JSON query.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET CelesTrak GP request.' }
  }
  const executed = parseCelestrakRequest(executedRequest.url)
  if (!executed || executed.group !== request.group) {
    return { request, transportBound: false, invalidReason: 'The displayed CelesTrak request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}
const degree = (value?: number) => value === undefined ? 'Not supplied' : `${numericText(value)}°`
const number = (value?: number) => value === undefined ? 'Not supplied' : numericText(value)

export function CelestrakSatellitesPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const identity = bindCelestrakRequest(requestUrl, executedRequest)
  const request = identity.request
  const requestAttrs = {
    'data-domain-card': 'satellite-orbits',
    'data-request-bound': request && identity.transportBound ? 'true' : 'false',
    'data-request-contract': 'exact-celestrak-gp-group-v2',
    'data-requested-group': request?.group,
  }
  if (!request || identity.invalidReason) return <div className="domain-card domain-empty celestrak-satellites-preview" {...requestAttrs} data-result-state="invalid"><h3>Invalid CelesTrak request evidence</h3><p>{identity.invalidReason ?? 'The successful response could not be tied to the bounded CelesTrak GP JSON request used by this demo.'}</p></div>
  if (!Array.isArray(data)) return <div className="domain-card domain-empty celestrak-satellites-preview" {...requestAttrs} data-result-state="invalid"><h3>Invalid CelesTrak GP response</h3><p>CelesTrak returned HTTP-success data without the documented JSON array of OMM-style GP records.</p></div>
  if (data.length === 0) return <div className="domain-card domain-empty celestrak-satellites-preview" {...requestAttrs} data-result-state={identity.transportBound ? "empty" : "partial"}><h3>{identity.transportBound ? "No GP orbital elements returned" : "CelesTrak result not request-bound"}</h3><p>{identity.transportBound ? "CelesTrak returned an empty GP JSON array for this bounded group request." : "CelesTrak returned a coherent empty GP JSON array, but executed request evidence was unavailable."}</p></div>
  const satellites = data.map(satelliteModel).filter((satellite): satellite is SatelliteModel => Boolean(satellite))
  const invalidRecordCount = data.length - satellites.length
  if (!satellites.length) return <div className="domain-card domain-empty celestrak-satellites-preview" {...requestAttrs} data-result-state="invalid"><h3>Invalid CelesTrak GP response</h3><p>CelesTrak returned GP rows without the required NORAD identity, epoch, and core OMM mean-element values.</p></div>
  const group = request.group
  const first = satellites[0]
  const visible = satellites.slice(0, 12)
  const state = !identity.transportBound || invalidRecordCount ? 'partial' : 'ready'
  return <div className="domain-card celestrak-satellites-preview" {...requestAttrs} data-result-state={state} data-provider-record-count={data.length} data-valid-record-count={satellites.length} data-invalid-record-count={invalidRecordCount} data-satellite-count={satellites.length} data-visible-satellite-count={visible.length} data-primary-norad-id={first.noradId} data-primary-object-id={first.objectId} data-primary-epoch={first.epoch} data-primary-mean-motion-rev-day={first.meanMotion} data-primary-inclination-degrees={first.inclination}>
    <CardHeading eyebrow="CelesTrak · General Perturbations data" title={`${satellites.length} orbital-element record${satellites.length === 1 ? '' : 's'}`} description={`${identity.transportBound ? 'Exact-request-bound' : 'Structurally coherent but not request-bound'} CelesTrak JSON using CCSDS OMM field names. These are orbital elements at their supplied epoch, not real-time satellite positions.`}><span className="domain-state">{state === 'partial' ? 'Partial GP evidence' : `GROUP=${group}`}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">{identity.transportBound ? `The provider response contains ${invalidRecordCount} malformed GP record${invalidRecordCount === 1 ? '' : 's'}. Only rows with a NORAD catalog identity, epoch, and the core OMM mean-element values are shown.` : 'The CelesTrak response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}</p>}
    <ol className="satellite-orbit-list" aria-label="CelesTrak satellite orbital elements">
      {visible.map((satellite, index) => <li key={`${satellite.noradId ?? satellite.objectId ?? satellite.name}-${index}`} data-satellite-index={index + 1} data-norad-id={satellite.noradId} data-object-id={satellite.objectId} data-epoch={satellite.epoch} data-mean-motion-rev-day={satellite.meanMotion} data-inclination-degrees={satellite.inclination}>
        <header><div><small>{satellite.objectId ?? 'International designator not supplied'}</small><h4>{satellite.name}</h4></div><span>{satellite.noradId === undefined ? 'NORAD ID not supplied' : `NORAD ${numericText(satellite.noradId)}`}</span></header>
        <Facts items={[
          { label: 'Epoch · UTC', value: satellite.epoch ? <time dateTime={`${satellite.epoch}Z`}>{satellite.epoch}</time> : 'Not supplied' },
          { label: 'Mean motion', value: satellite.meanMotion === undefined ? 'Not supplied' : `${numericText(satellite.meanMotion)} rev/day` },
          { label: 'Inclination', value: degree(satellite.inclination) }, { label: 'Eccentricity', value: number(satellite.eccentricity) },
          { label: 'RA of ascending node', value: degree(satellite.rightAscension) }, { label: 'Argument of pericenter', value: degree(satellite.argumentOfPericenter) },
          { label: 'Mean anomaly', value: degree(satellite.meanAnomaly) }, { label: 'Classification', value: satellite.classification ?? 'Not supplied' },
          { label: 'Element set', value: number(satellite.elementSet) }, { label: 'Revolution at epoch', value: number(satellite.revolutionAtEpoch) },
        ]}/>
      </li>)}
    </ol>
    {satellites.length > visible.length && <p className="domain-note">Showing the first {visible.length} of {satellites.length} returned orbital-element records. Raw JSON retains the complete provider response.</p>}
    <p className="domain-note">CelesTrak asks GP clients to download data only once per update. Automated verification remains cadence-limited by the catalog SSOT; this semantic card does not weaken that provider policy.</p>
  </div>
}
