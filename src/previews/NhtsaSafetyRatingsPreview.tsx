import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { isRecord, nonNegativeInteger, positiveInteger, trimmedText } from './semanticValidation'

const requestedVehicleId = (executedRequest?: ExecutedRequestContext): number | undefined => {
  if (!executedRequest) return undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const queryEntries = [...url.searchParams.entries()]
    if (url.protocol !== 'https:' || url.hostname !== 'api.nhtsa.gov' || url.port || url.hash || url.username || url.password
      || queryEntries.length !== 1 || queryEntries[0][0] !== 'format' || queryEntries[0][1] !== 'json') return undefined
    const match = /^\/SafetyRatings\/VehicleId\/(\d+)$/.exec(url.pathname)
    if (!match) return undefined
    const id = Number(match[1])
    return Number.isSafeInteger(id) && id > 0 && String(id) === match[1] ? id : undefined
  } catch { return undefined }
}

const rating = (value: unknown): string | undefined => {
  const text = trimmedText(value)
  if (!text) return undefined
  if (text === 'Not Rated') return text
  const n = Number(text)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? String(n) : undefined
}
const probability = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined
const invalid = (detail: string) => <CardEmpty domain="vehicle-safety-rating" title="Invalid NHTSA safety response" detail={detail} state="invalid"/>

export function NhtsaSafetyRatingsPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  if (!isRecord(data) || !Array.isArray(data.Results)) return invalid('NHTSA returned HTTP-success data without the documented Results array.')
  const requestId = requestedVehicleId(executedRequest)
  if (executedRequest && requestId === undefined) return invalid('The executed URL is not the supported NHTSA VehicleId safety-rating request.')
  const count = nonNegativeInteger(data.Count)
  if (data.Results.length === 0) {
    if (requestId !== undefined && count === 0) return <div className="domain-card domain-empty" data-domain-card="vehicle-safety-rating" data-result-state="empty" data-request-bound="true" data-requested-vehicle-id={requestId} data-provider-result-count="0"><h3>No NHTSA safety record found</h3><p>NHTSA returned a valid zero-result response for VehicleId {requestId}.</p></div>
    return invalid('The provider returned no rating row without a trustworthy zero-result count contract.')
  }
  const row = data.Results.length === 1 && isRecord(data.Results[0]) ? data.Results[0] : undefined
  if (!row) return invalid('NHTSA VehicleId lookups must resolve to one identifiable safety-rating record.')
  const providerId = positiveInteger(row.VehicleId)
  if (!providerId || (requestId !== undefined && providerId !== requestId)) return invalid('The provider VehicleId is missing or does not match the executed lookup.')
  const description = trimmedText(row.VehicleDescription)
  const year = positiveInteger(row.ModelYear)
  const make = trimmedText(row.Make)
  const model = trimmedText(row.Model)
  if (!description || !year || !make || !model) return invalid('The safety record is missing core provider-owned vehicle identity.')
  const overall = rating(row.OverallRating)
  const front = rating(row.OverallFrontCrashRating)
  const side = rating(row.OverallSideCrashRating)
  const rollover = rating(row.RolloverRating)
  const rolloverChance = probability(row.RolloverPossibility)
  const complaints = nonNegativeInteger(row.ComplaintsCount)
  const recalls = nonNegativeInteger(row.RecallsCount)
  const investigations = nonNegativeInteger(row.InvestigationCount)
  const stability = trimmedText(row.NHTSAElectronicStabilityControl)
  const forwardCollision = trimmedText(row.NHTSAForwardCollisionWarning)
  const laneDeparture = trimmedText(row.NHTSALaneDepartureWarning)
  const countContract = count === 1 && data.Results.length === 1
  const incomplete = !overall || !front || !side || !rollover || rolloverChance === undefined || complaints === undefined || recalls === undefined || investigations === undefined
  const state = requestId !== undefined && countContract && !incomplete ? 'ready' : 'partial'
  const cards: SemanticCard[] = [{
    title: description,
    eyebrow: `${year} ${make} ${model} · NHTSA VehicleId ${providerId}`,
    badge: overall === 'Not Rated' ? 'Overall Vehicle Score · Not Rated' : overall ? `Overall Vehicle Score · ${overall}/5 stars` : 'Overall Vehicle Score unavailable',
    metrics: [
      { label: 'Overall frontal crash', value: front === 'Not Rated' ? 'Not Rated' : front ? `${front}/5 stars` : 'Unavailable' },
      { label: 'Overall side crash', value: side === 'Not Rated' ? 'Not Rated' : side ? `${side}/5 stars` : 'Unavailable' },
      { label: 'Rollover', value: rollover === 'Not Rated' ? 'Not Rated' : rollover ? `${rollover}/5 stars` : 'Unavailable' },
      { label: 'Rollover possibility', value: rolloverChance === undefined ? 'Unavailable' : `${(rolloverChance * 100).toFixed(1)}%` },
      { label: 'Complaints', value: complaints === undefined ? 'Unavailable' : complaints.toLocaleString('en') },
      { label: 'Recalls / investigations', value: recalls === undefined || investigations === undefined ? 'Unavailable' : `${recalls} / ${investigations}` },
    ],
    tags: [stability && `ESC: ${stability}`, forwardCollision && `FCW: ${forwardCollision}`, laneDeparture && `LDW: ${laneDeparture}`].filter((value): value is string => Boolean(value)),
  }]
  return <div data-domain-card="vehicle-safety-rating" data-result-state={state} data-request-bound={String(requestId !== undefined)} data-requested-vehicle-id={requestId} data-provider-vehicle-id={providerId} data-identity-match={requestId === undefined ? 'unbound' : String(requestId === providerId)} data-provider-result-count={data.Results.length} data-count-contract={String(countContract)} data-overall-rating={overall} data-overall-score-meaning="relative-injury-risk" data-overall-frontal-comparison-scope="same-class-plus-minus-250lb" data-side-rollover-comparison-scope="cross-class" data-comparison-validation="unavailable-from-this-response">
    <div className="domain-note"><strong>NHTSA New Car Assessment Program</strong> · provider ratings and safety record counts for one VehicleId</div>
    <p className="domain-note"><strong>Comparison scope:</strong> Overall Vehicle Score and frontal crash stars are only comparable within the same vehicle class and ±250 lb. Side and rollover stars may be compared across classes. This response does not include the curb-weight/class facts needed to validate an Overall/frontal comparison.</p>
    {state === 'partial' && <p className="domain-note">Vehicle identity is trustworthy, but request binding, result count, or one or more rating/counter fields are incomplete.</p>}
    <SemanticCards cards={cards} emptyTitle="Safety rating unavailable"/>
  </div>
}
