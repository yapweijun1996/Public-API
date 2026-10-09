import type { ApiDemo } from '../apiCatalog'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { Sparkline } from './ChartPrimitives'
import { formatNumber } from './previewData'
import { finiteNumber, isRecord, trimmedText } from './semanticValidation'

const requestQueryKeys = ['parameters', 'community', 'latitude', 'longitude', 'start', 'end', 'format'] as const
const DAY_MS = 86_400_000
const NASA_POWER_START_EPOCH = Date.UTC(1981, 0, 1)

type NasaPowerRequest = {
  parameters: string[]
  latitude: number
  longitude: number
  start: string
  end: string
  startDate: string
  endDate: string
  expectedDates: string[]
}

type ClimateObservation = {
  date: string
  value: number
}

type ClimateParameter = {
  code: string
  units?: string
  longName?: string
  observations: ClimateObservation[]
}

type ClimateResultState = 'ready' | 'partial' | 'empty' | 'invalid'

type NasaPowerClimateViewModel = {
  state: ClimateResultState
  reason?: string
  request?: NasaPowerRequest
  featureContract: boolean
  geometryContract: boolean
  headerContract: boolean
  headerRangeContract: boolean
  parameterIdentityContract: boolean
  metadataContract: boolean
  dateAlignmentContract: boolean
  providerLongitude?: number
  providerLatitude?: number
  providerElevation?: number
  fillValue?: number
  timeStandard?: string
  apiName?: string
  apiVersion?: string
  providerParameterCount: number
  providerMetadataCount: number
  validParameterCount: number
  invalidParameterCount: number
  expectedMeasurementCount: number
  validMeasurementCount: number
  missingMeasurementCount: number
  malformedMeasurementCount: number
  unexpectedDateKeyCount: number
  malformedDateKeyCount: number
  parameters: ClimateParameter[]
}

const exactQueryKeys = (url: URL) => {
  const entries = [...url.searchParams.entries()]
  return entries.length === requestQueryKeys.length
    && entries.every(([key]) => (requestQueryKeys as readonly string[]).includes(key))
    && requestQueryKeys.every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
}

const boundedQueryNumber = (value: string | null, minimum: number, maximum: number) => {
  if (value === null || !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? numeric : undefined
}

const compactDateEpoch = (value: string | null) => {
  if (value === null || !/^\d{8}$/.test(value)) return undefined
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6))
  const day = Number(value.slice(6, 8))
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return undefined
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.getTime()
    : undefined
}

const compactDate = (epoch: number) => {
  const iso = new Date(epoch).toISOString().slice(0, 10)
  return { compact: iso.replaceAll('-', ''), iso }
}

const parseParameters = (value: string | null) => {
  if (value === null) return undefined
  const parts = value.split(',')
  if (parts.length < 1 || parts.length > 20) return undefined
  const parameters = parts.map((part) => trimmedText(part))
  if (parameters.some((parameter, index) => parameter === undefined || parameter !== parts[index])) return undefined
  const codes = parameters as string[]
  return new Set(codes).size === codes.length ? codes : undefined
}

const parseExecutedRequest = (executedRequest?: ExecutedRequestContext): NasaPowerRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const parameters = parseParameters(url.searchParams.get('parameters'))
    const latitude = boundedQueryNumber(url.searchParams.get('latitude'), -90, 90)
    const longitude = boundedQueryNumber(url.searchParams.get('longitude'), -180, 180)
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')
    const startEpoch = compactDateEpoch(start)
    const endEpoch = compactDateEpoch(end)
    const expectedDayCount = startEpoch !== undefined && endEpoch !== undefined && endEpoch >= startEpoch
      ? ((endEpoch - startEpoch) / DAY_MS) + 1
      : undefined
    const valid = url.protocol === 'https:'
      && url.hostname === 'power.larc.nasa.gov'
      && url.port === ''
      && url.pathname === '/api/temporal/daily/point'
      && !url.username
      && !url.password
      && !url.hash
      && exactQueryKeys(url)
      && url.searchParams.get('community') === 'AG'
      && url.searchParams.get('format') === 'JSON'
      && parameters !== undefined
      && latitude !== undefined
      && longitude !== undefined
      && start !== null
      && end !== null
      && startEpoch !== undefined
      && startEpoch >= NASA_POWER_START_EPOCH
      && endEpoch !== undefined
      && expectedDayCount !== undefined
      && Number.isSafeInteger(expectedDayCount)
      && expectedDayCount > 0
    if (!valid || !parameters || latitude === undefined || longitude === undefined || !start || !end || startEpoch === undefined || expectedDayCount === undefined) return undefined
    const expectedDates = Array.from({ length: expectedDayCount }, (_, index) => compactDate(startEpoch + index * DAY_MS).compact)
    return {
      parameters,
      latitude,
      longitude,
      start,
      end,
      startDate: compactDate(startEpoch).iso,
      endDate: compactDate(startEpoch + (expectedDayCount - 1) * DAY_MS).iso,
      expectedDates,
    }
  } catch {
    return undefined
  }
}

const hasOwn = (record: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(record, key)

const exactKeyIdentity = (record: Record<string, unknown> | undefined, expected: string[]) => {
  if (!record) return false
  const keys = Object.keys(record)
  return keys.length === expected.length
    && expected.every((key) => hasOwn(record, key))
    && keys.every((key) => expected.includes(key))
}

export const nasaPowerClimateModel = (data: unknown, executedRequest?: ExecutedRequestContext): NasaPowerClimateViewModel => {
  const request = parseExecutedRequest(executedRequest)
  const root = isRecord(data) ? data : undefined
  const properties = root && isRecord(root.properties) ? root.properties : undefined
  const providerSeries = properties && isRecord(properties.parameter) ? properties.parameter : undefined
  const providerMetadata = root && isRecord(root.parameters) ? root.parameters : undefined
  const geometry = root && isRecord(root.geometry) ? root.geometry : undefined
  const coordinates = geometry && Array.isArray(geometry.coordinates) ? geometry.coordinates : undefined
  const coordinateNumbers = coordinates?.map(finiteNumber)
  const providerLongitude = coordinateNumbers?.[0]
  const providerLatitude = coordinateNumbers?.[1]
  const providerElevation = coordinateNumbers?.[2]
  const featureContract = Boolean(root && root.type === 'Feature' && properties && providerSeries)
  const geometryContract = Boolean(
    geometry?.type === 'Point'
    && coordinates
    && coordinates.length >= 2
    && coordinateNumbers?.every((coordinate) => coordinate !== undefined)
    && providerLongitude !== undefined
    && providerLongitude >= -180
    && providerLongitude <= 180
    && providerLatitude !== undefined
    && providerLatitude >= -90
    && providerLatitude <= 90,
  )

  const header = root && isRecord(root.header) ? root.header : undefined
  const headerApi = header && isRecord(header.api) ? header.api : undefined
  const fillValue = finiteNumber(header?.fill_value)
  const timeStandard = trimmedText(header?.time_standard)
  const apiName = trimmedText(headerApi?.name)
  const apiVersion = trimmedText(headerApi?.version)
  const headerRangeContract = Boolean(request && header?.start === request.start && header?.end === request.end)
  const headerContract = Boolean(headerRangeContract && fillValue !== undefined && timeStandard === 'LST' && apiName && apiVersion)

  const requestedParameters = request?.parameters ?? []
  const seriesIdentityContract = exactKeyIdentity(providerSeries, requestedParameters)
  const metadataIdentityContract = exactKeyIdentity(providerMetadata, requestedParameters)
  const parameterIdentityContract = Boolean(request && seriesIdentityContract && metadataIdentityContract)
  const metadataContract = Boolean(request && metadataIdentityContract && requestedParameters.every((code) => {
    const metadata = providerMetadata && isRecord(providerMetadata[code]) ? providerMetadata[code] : undefined
    return trimmedText(metadata?.units) !== undefined && trimmedText(metadata?.longname) !== undefined
  }))

  let dateAlignmentContract = Boolean(request && providerSeries)
  let validMeasurementCount = 0
  let missingMeasurementCount = 0
  let malformedMeasurementCount = 0
  let unexpectedDateKeyCount = 0
  let malformedDateKeyCount = 0
  let validParameterCount = 0
  let invalidRequestedParameterCount = 0
  const expectedDateSet = new Set(request?.expectedDates ?? [])
  const parameters: ClimateParameter[] = []

  for (const code of requestedParameters) {
    const series = providerSeries && isRecord(providerSeries[code]) ? providerSeries[code] : undefined
    const metadata = providerMetadata && isRecord(providerMetadata[code]) ? providerMetadata[code] : undefined
    const units = trimmedText(metadata?.units)
    const longName = trimmedText(metadata?.longname)
    const observations: ClimateObservation[] = []
    const seriesKeys = series ? Object.keys(series) : []
    const parameterContract = Boolean(
      series
      && units
      && longName
      && seriesKeys.length === (request?.expectedDates.length ?? 0)
      && seriesKeys.every((date) => expectedDateSet.has(date)),
    )
    if (parameterContract) validParameterCount += 1
    else invalidRequestedParameterCount += 1

    if (!series) {
      dateAlignmentContract = false
      missingMeasurementCount += request?.expectedDates.length ?? 0
      parameters.push({ code, units, longName, observations })
      continue
    }

    for (const dateKey of Object.keys(series)) {
      if (!expectedDateSet.has(dateKey)) {
        dateAlignmentContract = false
        if (compactDateEpoch(dateKey) === undefined) malformedDateKeyCount += 1
        else unexpectedDateKeyCount += 1
      }
    }

    for (const date of request?.expectedDates ?? []) {
      if (!hasOwn(series, date)) {
        dateAlignmentContract = false
        missingMeasurementCount += 1
        continue
      }
      const value = finiteNumber(series[date])
      if (value === undefined || fillValue === undefined) {
        malformedMeasurementCount += 1
      } else if (value === fillValue) {
        missingMeasurementCount += 1
      } else {
        validMeasurementCount += 1
        observations.push({ date, value })
      }
    }
    parameters.push({ code, units, longName, observations })
  }

  const expectedMeasurementCount = (request?.expectedDates.length ?? 0) * requestedParameters.length
  const unrequestedProviderCodes = new Set([
    ...Object.keys(providerSeries ?? {}),
    ...Object.keys(providerMetadata ?? {}),
  ].filter((code) => !requestedParameters.includes(code)))
  const invalidParameterCount = invalidRequestedParameterCount + unrequestedProviderCodes.size
  const fullContracts = Boolean(
    request
    && featureContract
    && geometryContract
    && headerContract
    && parameterIdentityContract
    && metadataContract
    && dateAlignmentContract
    && unexpectedDateKeyCount === 0
    && malformedDateKeyCount === 0,
  )

  let state: ClimateResultState = 'invalid'
  let reason: string | undefined
  if (!request) {
    reason = 'The executed request is not the exact supported NASA POWER daily point GET request.'
  } else if (!featureContract || !providerSeries) {
    reason = 'The HTTP-success payload is not a documented NASA POWER Feature with daily parameter series.'
  } else if (fullContracts && validMeasurementCount > 0 && missingMeasurementCount === 0 && malformedMeasurementCount === 0) {
    state = 'ready'
  } else if (fullContracts && validMeasurementCount === 0 && missingMeasurementCount === expectedMeasurementCount && malformedMeasurementCount === 0) {
    state = 'empty'
  } else if (validMeasurementCount > 0) {
    state = 'partial'
    reason = 'Only request-matching native JSON-number measurements are shown; incomplete or inconsistent provider evidence is withheld.'
  } else {
    reason = 'No request-bound native JSON-number climate measurements could be validated.'
  }

  return {
    state,
    reason,
    request,
    featureContract,
    geometryContract,
    headerContract,
    headerRangeContract,
    parameterIdentityContract,
    metadataContract,
    dateAlignmentContract,
    providerLongitude,
    providerLatitude,
    providerElevation,
    fillValue,
    timeStandard,
    apiName,
    apiVersion,
    providerParameterCount: providerSeries ? Object.keys(providerSeries).length : 0,
    providerMetadataCount: providerMetadata ? Object.keys(providerMetadata).length : 0,
    validParameterCount,
    invalidParameterCount,
    expectedMeasurementCount,
    validMeasurementCount,
    missingMeasurementCount,
    malformedMeasurementCount,
    unexpectedDateKeyCount,
    malformedDateKeyCount,
    parameters,
  }
}

export function NasaPowerClimatePreview({ api, data, executedRequest }: { api: ApiDemo; data: unknown; executedRequest?: ExecutedRequestContext }) {
  const model = nasaPowerClimateModel(data, executedRequest)
  const request = model.request
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(request)),
    'data-request-method': request ? 'GET' : undefined,
    'data-request-community': request ? 'AG' : undefined,
    'data-request-format': request ? 'JSON' : undefined,
    'data-request-start-date': request?.startDate,
    'data-request-end-date': request?.endDate,
    'data-request-parameters': request?.parameters.join(','),
    'data-request-latitude': request?.latitude,
    'data-request-longitude': request?.longitude,
    'data-provider-parameter-count': model.providerParameterCount,
    'data-provider-metadata-count': model.providerMetadataCount,
    'data-valid-parameter-count': model.validParameterCount,
    'data-invalid-parameter-count': model.invalidParameterCount,
    'data-expected-measurement-count': model.expectedMeasurementCount,
    'data-valid-measurement-count': model.validMeasurementCount,
    'data-missing-measurement-count': model.missingMeasurementCount,
    'data-malformed-measurement-count': model.malformedMeasurementCount,
    'data-unexpected-date-key-count': model.unexpectedDateKeyCount,
    'data-malformed-date-key-count': model.malformedDateKeyCount,
    'data-feature-contract': String(model.featureContract),
    'data-parameter-identity-contract': String(model.parameterIdentityContract),
    'data-date-alignment-contract': String(model.dateAlignmentContract),
    'data-metadata-contract': String(model.metadataContract),
    'data-header-contract': String(model.headerContract),
    'data-header-range-contract': String(model.headerRangeContract),
    'data-geometry-contract': String(model.geometryContract),
    'data-provider-longitude': model.providerLongitude,
    'data-provider-latitude': model.providerLatitude,
    'data-provider-elevation': model.providerElevation,
    'data-fill-value': model.fillValue,
    'data-time-standard': model.timeStandard,
    'data-provider-api-name': model.apiName,
    'data-provider-api-version': model.apiVersion,
  }

  if (model.state === 'invalid') return <div className="market-preview" data-domain-card="nasa-power-climate" data-api-name={api.name} {...evidence}>
    <div className="market-summary"><div><span>NASA POWER climate unavailable</span><strong>—</strong><small>{model.reason}</small></div></div>
  </div>

  if (model.state === 'empty') return <div className="market-preview" data-domain-card="nasa-power-climate" data-api-name={api.name} {...evidence}>
    <div className="market-summary"><div><span>NASA POWER climate</span><strong>—</strong><small>No reported measurements for {request?.startDate}–{request?.endDate}.</small></div></div>
  </div>

  return <div className="market-preview" data-domain-card="nasa-power-climate" data-api-name={api.name} {...evidence}>
    <div className="market-summary">
      <div><span>NASA POWER · {model.apiName ?? 'API'}{model.apiVersion ? ` ${model.apiVersion}` : ''}</span><strong>{model.validMeasurementCount} measurements</strong><small>{model.timeStandard === 'LST' ? 'Local Solar Time' : 'Time standard unavailable'}</small></div>
      <div className="market-range"><span>{request?.startDate}</span><span>{request?.endDate}</span></div>
    </div>
    <div className="market-metrics">
      {model.parameters.map((parameter) => {
        const latest = parameter.observations.at(-1)
        const values = parameter.observations.map((observation) => observation.value)
        const value = latest
          ? `${formatNumber(latest.value, 2)}${parameter.units ? ` ${parameter.units}` : ''}`
          : '—'
        return <article key={parameter.code} data-parameter-code={parameter.code} data-valid-measurement-count={parameter.observations.length}>
          <small>{parameter.code}</small>
          <strong>{parameter.longName ?? parameter.code}</strong>
          <span>{value}</span>
          {latest && <span>{latest.date.slice(0, 4)}-{latest.date.slice(4, 6)}-{latest.date.slice(6, 8)} · latest reported</span>}
          {values.length > 0 && <Sparkline values={values} label={`${parameter.longName ?? parameter.code} validated daily trend`}/>}
        </article>
      })}
    </div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span><span>{model.missingMeasurementCount} missing · {model.malformedMeasurementCount} malformed</span></article></div>}
    <ol className="sr-only" aria-label="NASA POWER request-bound climate measurement evidence">
      {model.parameters.flatMap((parameter) => parameter.observations.map((observation) => <li key={`${parameter.code}-${observation.date}`}>{parameter.code} on {observation.date.slice(0, 4)}-{observation.date.slice(4, 6)}-{observation.date.slice(6, 8)}: {formatNumber(observation.value, 4)}{parameter.units ? ` ${parameter.units}` : ''}</li>))}
    </ol>
  </div>
}
