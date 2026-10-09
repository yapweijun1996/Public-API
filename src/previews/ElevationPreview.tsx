import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, numericText } from './cardPrimitives'
import { finiteNumber } from './semanticValidation'

type ElevationRequestContext = {
  transportBound: boolean
  latitude: number
  longitude: number
}

const singleCoordinate = (value: string | null, minimum: number, maximum: number) => {
  if (!value || value.includes(',')) return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : undefined
}

const parseElevationRequestUrl = (requestUrl?: string) => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const latitudeText = url.searchParams.get('latitude')
    const longitudeText = url.searchParams.get('longitude')
    const latitude = singleCoordinate(latitudeText, -90, 90)
    const longitude = singleCoordinate(longitudeText, -180, 180)
    const keys = [...url.searchParams.keys()]
    if (
      url.protocol !== 'https:'
      || url.hostname !== 'api.open-meteo.com'
      || url.port
      || url.username
      || url.password
      || url.pathname !== '/v1/elevation'
      || url.hash
      || keys.length !== 2
      || url.searchParams.getAll('latitude').length !== 1
      || url.searchParams.getAll('longitude').length !== 1
      || keys.some((key) => key !== 'latitude' && key !== 'longitude')
      || latitudeText === null
      || longitudeText === null
      || latitude === undefined
      || longitude === undefined
    ) return undefined
    const canonical = `https://api.open-meteo.com/v1/elevation?${new URLSearchParams({ latitude: latitudeText, longitude: longitudeText }).toString()}`
    return requestUrl === canonical ? { latitude, longitude } : undefined
  } catch {
    return undefined
  }
}

const elevationRequestContext = (requestUrl?: string, executedRequest?: ExecutedRequestContext): ElevationRequestContext | undefined | null => {
  const displayed = parseElevationRequestUrl(requestUrl)
  if (requestUrl && !displayed) return null
  if (!displayed) return undefined
  if (!executedRequest) return { ...displayed, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return null
  return parseElevationRequestUrl(executedRequest.url) ? { ...displayed, transportBound: true } : null
}

const coordinateLabel = (value: number | undefined) => value === undefined ? 'Not supplied' : numericText(value)
const elevationLabel = (value: number | undefined) => value === undefined ? 'Not supplied' : `${numericText(value)} m`

export function ElevationPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const root = asRecord(data)
  const values = Array.isArray(root.elevation) ? root.elevation : undefined
  const elevation = values?.length === 1 ? finiteNumber(values[0]) : undefined

  if (!values || values.length !== 1 || elevation === undefined) {
    return <CardEmpty
      domain="terrain-elevation"
      title="Terrain elevation response invalid"
      detail="Open-Meteo documents a successful elevation lookup as exactly one JSON-number elevation for this single-coordinate request. Inspect Raw JSON for provider drift or malformed data."
      state="invalid"
    />
  }

  const request = elevationRequestContext(requestUrl, executedRequest)
  if (request === null) {
    return <CardEmpty domain="terrain-elevation" title="Invalid elevation request identity" detail="This elevation result was not produced by the exact supported bodyless GET request shown in Request Lab." state="invalid"/>
  }
  const coordinateSummary = request
    ? `WGS84 ${coordinateLabel(request?.latitude)}, ${coordinateLabel(request?.longitude)}${request.transportBound ? '' : ' · executed transport identity unavailable'}`
    : 'Requested coordinates were not captured with this response.'
  const resultState = request?.transportBound ? 'ready' : 'partial'

  return <div
    className="domain-card elevation-preview"
    data-domain-card="terrain-elevation"
    data-result-state={resultState}
    data-request-bound={String(Boolean(request?.transportBound))}
    data-primary-elevation-meters={elevation}
    data-request-latitude={request?.latitude}
    data-request-longitude={request?.longitude}
    data-provider-elevation-count={values.length}
    data-provider-contract-valid="true"
    data-dem-resolution-meters="90"
    data-source-dataset="Copernicus DEM 2021 GLO-90"
  >
    <CardHeading
      eyebrow="Open-Meteo · Copernicus GLO-90"
      title={`${elevationLabel(elevation)} terrain elevation`}
      description={coordinateSummary}
    >
      <span className="domain-state">{request?.transportBound ? '90 m DEM · request verified' : '90 m DEM · request unbound'}</span>
    </CardHeading>

    <Facts items={[
      { label: 'Terrain elevation', value: elevationLabel(elevation) },
      { label: 'Requested latitude', value: coordinateLabel(request?.latitude) },
      { label: 'Requested longitude', value: coordinateLabel(request?.longitude) },
      { label: 'DEM resolution', value: '90 m' },
      { label: 'Dataset', value: 'Copernicus DEM 2021 GLO-90' },
    ]}/>

    <p className="domain-note">Open-Meteo returns only an elevation array from this endpoint, so a ready result binds the measurement to the successful request URL. Open-Meteo requires attribution to both the Copernicus programme and Open-Meteo when using this elevation data.</p>
  </div>
}
