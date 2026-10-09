import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts } from './cardPrimitives'
import { finiteNumber, isRecord, optionalTrimmedText, positiveInteger, trimmedText } from './semanticValidation'

export const DATA_GOV_TRAFFIC_IMAGES_URL = 'https://api.data.gov.sg/v1/transport/traffic-images'

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'

type TrafficCamera = {
  id: string
  timestamp: string
  imageUrl: string
  latitude: number
  longitude: number
  width: number
  height: number
  md5: string
}

export type DataGovTrafficImagesViewModel = {
  state: ResultState
  reason?: string
  requestBound: boolean
  envelopeContract: boolean
  apiInfoContract: boolean
  apiInfoStatus?: string
  snapshotTimestamp?: string
  providerCameraCount: number
  validCameraCount: number
  malformedCameraCount: number
  duplicateCameraCount: number
  cameras: TrafficCamera[]
}

const exactRequest = (request?: ExecutedRequestContext) => {
  if (!request || request.method !== 'GET' || request.body !== undefined || request.url !== DATA_GOV_TRAFFIC_IMAGES_URL) return false
  try {
    const url = new URL(request.url)
    return url.protocol === 'https:'
      && url.origin === 'https://api.data.gov.sg'
      && url.pathname === '/v1/transport/traffic-images'
      && url.search === ''
      && url.hash === ''
      && url.username === ''
      && url.password === ''
  } catch {
    return false
  }
}

const isoDateTime = (value: unknown) => {
  const text = trimmedText(value)
  if (!text || text !== value) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(text)
  if (!match) return undefined
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match
  const values = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number)
  const [year, month, day, hour, minute, second] = values
  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const calendarValid = calendar.getUTCFullYear() === year
    && calendar.getUTCMonth() === month - 1
    && calendar.getUTCDate() === day
    && calendar.getUTCHours() === hour
    && calendar.getUTCMinutes() === minute
    && calendar.getUTCSeconds() === second
  const offsetValid = offsetHourText === undefined || (Number(offsetHourText) <= 23 && Number(offsetMinuteText) <= 59)
  return calendarValid && offsetValid && Number.isFinite(Date.parse(text)) ? text : undefined
}

const httpsUrl = (value: unknown) => {
  const text = trimmedText(value)
  if (!text || text !== value) return undefined
  try {
    const url = new URL(text)
    return url.protocol === 'https:' && !url.username && !url.password ? text : undefined
  } catch {
    return undefined
  }
}

const parseCamera = (value: unknown): TrafficCamera | undefined => {
  if (!isRecord(value)) return undefined
  const id = trimmedText(value.camera_id)
  const timestamp = isoDateTime(value.timestamp)
  const imageUrl = httpsUrl(value.image)
  const location = isRecord(value.location) ? value.location : undefined
  const latitude = finiteNumber(location?.latitude)
  const longitude = finiteNumber(location?.longitude)
  const metadata = isRecord(value.image_metadata) ? value.image_metadata : undefined
  const width = positiveInteger(metadata?.width)
  const height = positiveInteger(metadata?.height)
  const md5 = trimmedText(metadata?.md5)
  if (!id || id !== value.camera_id || id.length > 128 || !timestamp || !imageUrl
    || latitude === undefined || latitude < -90 || latitude > 90
    || longitude === undefined || longitude < -180 || longitude > 180
    || width === undefined || height === undefined || !md5 || !/^[0-9a-f]{32}$/.test(md5)) return undefined
  return { id, timestamp, imageUrl, latitude, longitude, width, height, md5 }
}

export const buildDataGovTrafficImagesViewModel = (
  data: unknown,
  executedRequest?: ExecutedRequestContext,
): DataGovTrafficImagesViewModel => {
  const requestBound = exactRequest(executedRequest)
  const root = isRecord(data) ? data : undefined
  const items = root && Array.isArray(root.items) ? root.items : undefined
  const item = items?.length === 1 && isRecord(items[0]) ? items[0] : undefined
  const camerasValue = item && Array.isArray(item.cameras) ? item.cameras : undefined
  const snapshotTimestamp = item ? isoDateTime(item.timestamp) : undefined
  const envelopeContract = Boolean(root && items?.length === 1 && item && camerasValue && snapshotTimestamp)
  const apiInfo = root?.api_info
  const apiInfoStatus = isRecord(apiInfo) ? optionalTrimmedText(apiInfo.status) : { malformed: apiInfo !== undefined, value: undefined }
  const apiInfoContract = apiInfo === undefined || (isRecord(apiInfo) && !apiInfoStatus.malformed)
  const providerCameraCount = camerasValue?.length ?? 0
  const parsed = camerasValue?.map(parseCamera) ?? []
  const seen = new Set<string>()
  const cameras: TrafficCamera[] = []
  let malformedCameraCount = 0
  let duplicateCameraCount = 0
  parsed.forEach((camera) => {
    if (!camera) {
      malformedCameraCount += 1
      return
    }
    if (seen.has(camera.id)) {
      duplicateCameraCount += 1
      return
    }
    seen.add(camera.id)
    cameras.push(camera)
  })
  const base = {
    requestBound,
    envelopeContract,
    apiInfoContract,
    apiInfoStatus: apiInfoStatus.value,
    snapshotTimestamp,
    providerCameraCount,
    validCameraCount: cameras.length,
    malformedCameraCount,
    duplicateCameraCount,
    cameras,
  }

  if (!requestBound) return { ...base, state: 'invalid', reason: 'The response was not tied to the exact supported bodyless traffic-images GET request.' }
  if (!envelopeContract) return { ...base, state: 'invalid', reason: 'The HTTP-success payload was not the documented root/items traffic-camera snapshot envelope.' }
  if (providerCameraCount === 0) return { ...base, state: 'empty', reason: 'data.gov.sg returned a coherent snapshot with no traffic cameras.' }
  if (cameras.length === 0) return { ...base, state: 'invalid', reason: 'Camera rows were returned, but none had a trustworthy native camera ID, HTTPS image, timestamp, WGS84 location, dimensions, and MD5 identity.' }
  if (malformedCameraCount > 0 || duplicateCameraCount > 0 || !apiInfoContract) return { ...base, state: 'partial', reason: !apiInfoContract
    ? 'Camera records were validated, but malformed optional api_info metadata was not accepted as provider health evidence.'
    : 'Malformed or duplicate camera rows were withheld; only unique cameras with complete provider identity are shown.' }
  return { ...base, state: 'ready' }
}

const coordinate = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(value)

export function DataGovTrafficImagesPreview({
  data,
  executedRequest,
}: {
  data: unknown
  executedRequest?: ExecutedRequestContext
}) {
  const model = buildDataGovTrafficImagesViewModel(data, executedRequest)
  const sample = model.cameras.slice(0, 8)
  const evidence = {
    'data-domain-card': 'data-gov-traffic-images',
    'data-result-state': model.state,
    'data-request-bound': String(model.requestBound),
    'data-request-contract': 'exact-data-gov-sg-latest-traffic-images',
    'data-envelope-contract': String(model.envelopeContract),
    'data-api-info-contract': String(model.apiInfoContract),
    'data-api-info-status': model.apiInfoStatus,
    'data-snapshot-timestamp': model.snapshotTimestamp,
    'data-provider-camera-count': model.providerCameraCount,
    'data-valid-camera-count': model.validCameraCount,
    'data-malformed-camera-count': model.malformedCameraCount,
    'data-duplicate-camera-count': model.duplicateCameraCount,
    'data-sample-camera-count': sample.length,
    'data-primary-camera-id': sample[0]?.id,
  }

  if (model.state === 'invalid') return <div className="domain-card domain-empty data-gov-traffic-images-preview" {...evidence}>
    <h3>Traffic camera evidence unavailable</h3>
    <p>{model.reason}</p>
  </div>

  if (model.state === 'empty') return <div className="domain-card domain-empty data-gov-traffic-images-preview" {...evidence}>
    <h3>No traffic cameras in this snapshot</h3>
    <p>{model.reason}</p>
  </div>

  return <div className="domain-card data-gov-traffic-images-preview" {...evidence}>
    <CardHeading
      eyebrow="data.gov.sg · LTA traffic images"
      title={`${model.providerCameraCount.toLocaleString('en')} traffic cameras in provider snapshot`}
      description="Request-bound traffic-camera images with provider camera identity, observation time, WGS84 coordinates, dimensions, and MD5 evidence."
    >
      <span className={`domain-state${model.state === 'partial' ? ' warning' : ''}`}>{model.state === 'partial' ? 'Partial validated snapshot' : 'Validated snapshot'}</span>
    </CardHeading>
    {model.state === 'partial' && <p className="domain-note">{model.reason}</p>}
    <Facts items={[
      { label: 'Provider camera rows', value: model.providerCameraCount.toLocaleString('en') },
      { label: 'Validated unique cameras', value: model.validCameraCount.toLocaleString('en') },
      { label: 'Withheld rows', value: (model.malformedCameraCount + model.duplicateCameraCount).toLocaleString('en') },
      { label: 'Snapshot time', value: model.snapshotTimestamp },
    ]}/>
    <div className={`traffic-camera-grid ${sample.length === 1 ? 'single' : ''}`} aria-label="Validated traffic camera sample">
      {sample.map((camera) => <article key={camera.id} data-camera-id={camera.id} data-image-md5={camera.md5} data-latitude={camera.latitude} data-longitude={camera.longitude}>
        <img src={camera.imageUrl} alt={`Traffic camera ${camera.id}`} loading="lazy" width={camera.width} height={camera.height}/>
        <div><small>Camera ID {camera.id}</small><h3>{camera.timestamp}</h3><dl>
          <div><dt>Coordinates</dt><dd>{coordinate(camera.latitude)}, {coordinate(camera.longitude)}</dd></div>
          <div><dt>Image size</dt><dd>{camera.width} × {camera.height}</dd></div>
          <div><dt>MD5</dt><dd><code>{camera.md5}</code></dd></div>
        </dl></div>
      </article>)}
    </div>
    <p className="domain-note">At most 8 validated cameras are shown; provider and validated totals cover the complete returned camera array. The optional api_info status is exposed only as provider metadata and is not used as proof that camera records are ready.</p>
  </div>
}
