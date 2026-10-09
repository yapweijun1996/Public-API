import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, numericText, text } from './cardPrimitives'
import { finiteNumber, nonNegativeSafeInteger } from './semanticValidation'

type RequestIdentity = { locationId: string; parameterCode: '00060' | '00065' }
type RequestTransport = { request?: RequestIdentity; valid: boolean; bound: boolean }
type DecimalMeasurement = { raw: string; value: number }

const parameterLabel = (code: string | undefined) => {
  if (code === '00060') return 'Streamflow / discharge'
  if (code === '00065') return 'Gage height'
  return code ? `USGS parameter ${code}` : 'Continuous measurement'
}

const qualifiers = (value: unknown) => Array.isArray(value)
  ? value.map((item) => text(item)).filter((item): item is string => Boolean(item))
  : text(value) ? [text(value)!] : []

const decimalMeasurement = (value: unknown): DecimalMeasurement | undefined => {
  if (typeof value !== 'string') return undefined
  const raw = value.trim()
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) return undefined
  const numericValue = Number(raw)
  return Number.isFinite(numericValue) ? { raw, value: numericValue } : undefined
}

const requestIdentity = (requestUrl?: string): RequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'api.waterdata.usgs.gov' || url.port || url.hash || url.pathname !== '/ogcapi/v1/collections/latest-continuous/items') return undefined
    const expectedKeys = ['f', 'limit', 'monitoring_location_id', 'parameter_code']
    const actualKeys = Array.from(url.searchParams.keys()).sort()
    if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) return undefined
    if (expectedKeys.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    if (url.searchParams.get('f') !== 'json' || url.searchParams.get('limit') !== '1') return undefined
    const locationId = url.searchParams.get('monitoring_location_id')?.trim()
    const parameterCode = url.searchParams.get('parameter_code')?.trim()
    if (!locationId || !/^USGS-[0-9]+$/.test(locationId) || (parameterCode !== '00060' && parameterCode !== '00065')) return undefined
    return { locationId, parameterCode }
  } catch {
    return undefined
  }
}

const resolveRequestTransport = (requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestTransport => {
  const displayed = requestIdentity(requestUrl)
  if (requestUrl && !displayed) return { valid: false, bound: false }
  if (!executedRequest) return displayed ? { request: displayed, valid: true, bound: false } : { valid: false, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) return { valid: false, bound: false }
  const executed = requestIdentity(executedRequest.url)
  return executed ? { request: executed, valid: true, bound: true } : { valid: false, bound: false }
}

const requestContractMessage = (state: 'invalid' | 'empty' | 'partial', title: string, detail: string, requestBound: boolean) => <div className="domain-card domain-empty" data-domain-card="water-gauge" data-result-state={state} data-request-bound={String(requestBound)}><h3>{title}</h3><p>{detail}</p></div>

export function UsgsWaterPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const transport = resolveRequestTransport(requestUrl, executedRequest)
  const requested = transport.request
  if (!transport.valid || !requested) return requestContractMessage('invalid', 'Invalid USGS request identity', 'The successful response was not bound to the exact supported bodyless GET USGS Water Data V1 latest-continuous request, or the executed request disagreed with the displayed URL.', false)
  if (!data || typeof data !== 'object' || Array.isArray(data)) return <CardEmpty domain="water-gauge" title="Invalid USGS continuous observation response" detail="USGS returned HTTP-success data without the documented GeoJSON FeatureCollection response object." state="invalid"/>

  const root = asRecord(data)
  const providerFeatures = Array.isArray(root.features) ? root.features : undefined
  if (text(root.type) !== 'FeatureCollection' || !providerFeatures) return <CardEmpty domain="water-gauge" title="Invalid USGS continuous observation response" detail="USGS returned HTTP-success data without the documented FeatureCollection features array." state="invalid"/>

  const hasNumberReturned = Object.prototype.hasOwnProperty.call(root, 'numberReturned')
  const numberReturned = nonNegativeSafeInteger(root.numberReturned)
  const malformedCount = hasNumberReturned && numberReturned === undefined
  const countContractValid = !malformedCount && (numberReturned === undefined || numberReturned === providerFeatures.length)
  if (providerFeatures.length === 0) {
    if (!countContractValid) return <CardEmpty domain="water-gauge" title="Invalid USGS continuous observation response" detail="USGS returned an empty observation list with contradictory or malformed numberReturned metadata." state="invalid"/>
    return transport.bound
      ? requestContractMessage('empty', 'USGS continuous observation unavailable', 'The Water Data API returned no latest-continuous observation for this monitoring location and measurement.', true)
      : requestContractMessage('partial', 'Unbound USGS empty response', 'The provider response is structurally empty, but executed-request evidence is unavailable, so it is not marked as a trustworthy semantic empty result.', false)
  }

  const feature = asRecord(providerFeatures[0])
  const properties = asRecord(feature.properties)
  const measurement = decimalMeasurement(properties.value)
  const locationId = text(properties.monitoring_location_id)
  const parameterCode = text(properties.parameter_code)
  const timeSeriesId = text(properties.time_series_id)
  if (text(feature.type) !== 'Feature' || !measurement || !locationId || !parameterCode || !timeSeriesId) return <CardEmpty domain="water-gauge" title="Invalid USGS continuous observation response" detail="USGS returned an observation without the required time-series, monitoring-location, parameter, and precision-preserving string measurement identity." state="invalid"/>
  if (requested.locationId !== locationId || requested.parameterCode !== parameterCode) return <CardEmpty domain="water-gauge" title="USGS observation identity mismatch" detail="The returned observation does not match the requested monitoring location and measurement, so no sensor value is presented as trustworthy." state="invalid"/>

  const geometry = asRecord(feature.geometry)
  const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : []
  const longitudeCandidate = finiteNumber(coordinates[0])
  const latitudeCandidate = finiteNumber(coordinates[1])
  const longitude = longitudeCandidate !== undefined && longitudeCandidate >= -180 && longitudeCandidate <= 180 ? longitudeCandidate : undefined
  const latitude = latitudeCandidate !== undefined && latitudeCandidate >= -90 && latitudeCandidate <= 90 ? latitudeCandidate : undefined
  const geometryContractValid = text(geometry.type) === 'Point' && longitude !== undefined && latitude !== undefined
  const unit = text(properties.unit_of_measure)
  const observedAt = text(properties.time)
  const approvalStatus = text(properties.approval_status)
  const statisticId = text(properties.statistic_id)
  const qualifierList = qualifiers(properties.qualifier)
  const rowLimitContractValid = providerFeatures.length <= 1
  const approvalStatusValid = approvalStatus === 'Approved' || approvalStatus === 'Provisional'
  const state = transport.bound && countContractValid && rowLimitContractValid && Boolean(unit) && Boolean(observedAt) && approvalStatusValid && geometryContractValid ? 'ready' : 'partial'
  const valueLabel = `${numericText(measurement.value)}${unit ? ` ${unit}` : ''}`
  const locationLabel = locationId.replace(/^USGS-/, '')

  return <div className="domain-card usgs-water-preview" data-domain-card="water-gauge" data-result-state={state} data-request-bound={String(transport.bound)} data-request-contract="exact-v1-latest-continuous" data-requested-monitoring-location-id={requested.locationId} data-requested-parameter-code={requested.parameterCode} data-requested-limit="1" data-provider-record-count={providerFeatures.length} data-provider-number-returned={numberReturned} data-count-contract-valid={String(countContractValid)} data-row-limit-contract-valid={String(rowLimitContractValid)} data-measurement-contract="decimal-string" data-coordinate-contract={geometryContractValid ? 'native-geojson-number' : 'malformed'} data-monitoring-location-id={locationId} data-parameter-code={parameterCode} data-time-series-id={timeSeriesId} data-statistic-id={statisticId} data-primary-value={measurement.raw} data-unit-of-measure={unit} data-observed-at={observedAt} data-approval-status={approvalStatus} data-latitude={latitude} data-longitude={longitude}>
    <CardHeading eyebrow="USGS Water Data API V1" title={`${valueLabel} ${parameterLabel(parameterCode).toLowerCase()}`} description={`Monitoring location ${locationLabel} · latest continuous sensor observation`}><span className="domain-state">{state === 'partial' ? 'Partial provider response' : approvalStatus}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">USGS returned a usable sensor measurement with matching provider identity, but {transport.bound ? 'one or more documented observation, count, row-limit, or GeoJSON context fields are unavailable or inconsistent.' : 'executed-request identity is unavailable, so the measurement is not marked ready.'}</p>}
    <Facts items={[
      { label: 'Monitoring location', value: locationId },
      { label: 'Measurement', value: `${parameterLabel(parameterCode)} (${parameterCode})` },
      { label: 'Time-series ID', value: timeSeriesId },
      { label: 'Statistic ID', value: statisticId ?? 'Not supplied' },
      { label: 'Observed (UTC)', value: observedAt ? <time dateTime={observedAt}>{observedAt}</time> : 'Not supplied' },
      { label: 'Approval status', value: approvalStatus ?? 'Not supplied' },
      { label: 'Qualifier', value: qualifierList.length ? qualifierList.join(', ') : 'None reported' },
      { label: 'Coordinates', value: geometryContractValid ? `${numericText(latitude!)}, ${numericText(longitude!)}` : 'Not supplied' },
    ]}/>
    <p className="domain-note">USGS latest-continuous publishes the newest observation for each sensor time series. Observation values are transmitted as strings in JSON to preserve precision; provisional observations can change after USGS review.</p>
  </div>
}
