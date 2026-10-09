import { CardEmpty, CardHeading, Facts, asRecord, isoDate, numericText, text } from './cardPrimitives'
import { Sparkline } from './ChartPrimitives'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'

type ClimateRequest = {
  model: string
  startDate: string
  endDate: string
}

type ClimateRow = {
  date: string
  temperature: number
  precipitation: number
}

const finiteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined

const climateModels = new Set([
  'CMCC_CM2_VHR4', 'FGOALS_f3_H', 'HiRAM_SIT_HR', 'MRI_AGCM3_2_S', 'EC_Earth3P_HR', 'MPI_ESM1_2_XR', 'NICAM16_8S',
])

const boundedCoordinate = (value: string | null, minimum: number, maximum: number) => {
  if (value === null || !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? numeric : undefined
}

const requestContext = (requestUrl?: string): ClimateRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.origin !== 'https://climate-api.open-meteo.com' || url.pathname !== '/v1/climate' || url.username || url.password || url.hash) return undefined
    const requiredKeys = ['latitude', 'longitude', 'start_date', 'end_date', 'models', 'daily', 'format'] as const
    const entries = [...url.searchParams.entries()]
    const allowed = new Set<string>(requiredKeys)
    if (entries.length !== requiredKeys.length || entries.some(([key]) => !allowed.has(key)) || requiredKeys.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    if (boundedCoordinate(url.searchParams.get('latitude'), -90, 90) === undefined || boundedCoordinate(url.searchParams.get('longitude'), -180, 180) === undefined) return undefined
    const model = text(url.searchParams.get('models'))
    const startDate = isoDate(url.searchParams.get('start_date'))
    const endDate = isoDate(url.searchParams.get('end_date'))
    if (!model || !climateModels.has(model) || !startDate || !endDate || endDate < startDate) return undefined
    if (url.searchParams.get('daily') !== 'temperature_2m_mean,precipitation_sum' || url.searchParams.get('format') !== 'json') return undefined
    return { model, startDate, endDate }
  } catch {
    return undefined
  }
}

type ClimateTransport = { request?: ClimateRequest; valid: boolean; bound: boolean }

const resolveClimateRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): ClimateTransport => {
  const displayed = requestContext(requestUrl)
  if (requestUrl && !displayed) return { valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) return { valid: false, bound: false }
  const executed = requestContext(executedRequest.url)
  return executed ? { request: executed, valid: true, bound: true } : { valid: false, bound: false }
}

const boundedTrend = (values: number[], maxPoints = 180) => {
  if (values.length <= maxPoints) return values
  const step = Math.ceil(values.length / maxPoints)
  const sampled = values.filter((_, index) => index % step === 0)
  const last = values.at(-1)
  if (last !== undefined && sampled.at(-1) !== last) sampled.push(last)
  return sampled
}

const oneDayMs = 86_400_000
const expectedDayCount = (startDate: string, endDate: string) => Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / oneDayMs) + 1
const hasDailyCadence = (dates: Array<string | undefined>, request?: ClimateRequest) => {
  if (!request || dates.length !== expectedDayCount(request.startDate, request.endDate) || dates.some((date) => !date)) return false
  return dates.every((date, index) => index === 0 || Date.parse(`${date}T00:00:00Z`) - Date.parse(`${dates[index - 1]}T00:00:00Z`) === oneDayMs)
}

export function OpenMeteoClimatePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const root = asRecord(data)
  const daily = asRecord(root.daily)
  const units = asRecord(root.daily_units)
  const rawDates = Array.isArray(daily.time) ? daily.time : []
  const rawTemperatures = Array.isArray(daily.temperature_2m_mean) ? daily.temperature_2m_mean : []
  const rawPrecipitation = Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum : []
  const parsedDates = rawDates.map(isoDate)
  const providerRecordCount = Math.max(rawDates.length, rawTemperatures.length, rawPrecipitation.length)
  const rows: ClimateRow[] = []
  for (let index = 0; index < providerRecordCount; index += 1) {
    const date = isoDate(rawDates[index])
    const temperature = finiteNumber(rawTemperatures[index])
    const precipitation = finiteNumber(rawPrecipitation[index])
    if (date && temperature !== undefined && precipitation !== undefined) rows.push({ date, temperature, precipitation })
  }

  const transport = resolveClimateRequest(requestUrl, executedRequest)
  const request = transport.request
  const arrayLengthContract = rawDates.length > 0 && rawDates.length === rawTemperatures.length && rawDates.length === rawPrecipitation.length
  const dateRangeContract = Boolean(request && parsedDates[0] === request.startDate && parsedDates.at(-1) === request.endDate)
  const dailyCadenceContract = hasDailyCadence(parsedDates, request)
  const unitContract = text(units.time) === 'iso8601' && text(units.temperature_2m_mean) === '°C' && text(units.precipitation_sum) === 'mm'
  const latitude = finiteNumber(root.latitude)
  const longitude = finiteNumber(root.longitude)
  const coordinatesValid = latitude !== undefined && longitude !== undefined && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
  const elevation = finiteNumber(root.elevation)
  const invalidRecordCount = providerRecordCount - rows.length

  if (!transport.valid) {
    return <div className="domain-card domain-empty open-meteo-climate-preview" data-domain-card="climate-projection" data-result-state="invalid" data-request-bound="false"><h3>Climate request identity unavailable</h3><p>The executed request was not the exact supported bodyless GET Open-Meteo Climate request, or it disagreed with the displayed request URL.</p></div>
  }

  if (!providerRecordCount || !rows.length) {
    return <CardEmpty domain="climate-projection" title="Climate projection unavailable" detail="Open-Meteo returned HTTP-success data without a usable daily climate series. No projection values are inferred from an empty or malformed payload." state="invalid"/>
  }

  if (request && !dateRangeContract) {
    return <div
      className="domain-card domain-empty open-meteo-climate-preview"
      data-domain-card="climate-projection"
      data-result-state="invalid"
      data-primary-model={request.model}
      data-request-bound={String(transport.bound)}
      data-request-start={request.startDate}
      data-request-end={request.endDate}
      data-period-start={parsedDates[0]}
      data-period-end={parsedDates.at(-1)}
      data-date-range-contract="false"
      data-array-length-contract={String(arrayLengthContract)}
      data-daily-cadence-contract={String(dailyCadenceContract)}
      data-unit-contract={String(unitContract)}
      data-provider-record-count={providerRecordCount}
      data-valid-record-count={rows.length}
      data-invalid-record-count={invalidRecordCount}
    >
      <h3>Climate projection identity mismatch</h3>
      <p>Open-Meteo returned a dated climate series, but its response range does not match the executed request. The measurements are hidden rather than being presented as the requested projection.</p>
    </div>
  }

  const resultState = transport.bound && request && dateRangeContract && arrayLengthContract && dailyCadenceContract && unitContract && coordinatesValid && invalidRecordCount === 0 ? 'ready' : 'partial'
  const values = rows.map((entry) => entry.temperature)
  const firstDate = rows[0].date
  const lastDate = rows.at(-1)!.date
  const latestTemperature = values.at(-1)!
  const completeMeasurements = arrayLengthContract && invalidRecordCount === 0 && unitContract
  const averageTemperature = completeMeasurements ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined
  const totalPrecipitation = completeMeasurements ? rows.reduce((sum, entry) => sum + entry.precipitation, 0) : undefined
  const temperatureUnit = text(units.temperature_2m_mean)
  const precipitationUnit = text(units.precipitation_sum)

  return <div
    className="domain-card open-meteo-climate-preview"
    data-domain-card="climate-projection"
    data-result-state={resultState}
    data-primary-model={request?.model}
    data-request-bound={String(transport.bound)}
    data-request-start={request?.startDate}
    data-request-end={request?.endDate}
    data-period-start={firstDate}
    data-period-end={lastDate}
    data-provider-record-count={providerRecordCount}
    data-observation-count={rows.length}
    data-valid-record-count={rows.length}
    data-invalid-record-count={invalidRecordCount}
    data-date-range-contract={String(dateRangeContract)}
    data-array-length-contract={String(arrayLengthContract)}
    data-daily-cadence-contract={String(dailyCadenceContract)}
    data-unit-contract={String(unitContract)}
    data-provider-latitude={latitude}
    data-provider-longitude={longitude}
    data-latest-temperature={latestTemperature}
    data-temperature-unit={temperatureUnit}
    data-precipitation-unit={precipitationUnit}
  >
    <CardHeading
      eyebrow="Open-Meteo · HighResMIP / CMIP6 climate projection"
      title={request?.model ? `${request.model} climate projection` : 'Climate model projection'}
      description={`${firstDate} → ${lastDate}${coordinatesValid ? ` · ${numericText(latitude)}, ${numericText(longitude)}` : ''}`}
    ><span className="domain-state">{resultState === 'ready' ? 'Modelled, not observed' : 'Partial climate response'}</span></CardHeading>
    {resultState === 'partial' && <p className="domain-note">The response contains usable daily climate rows, but request binding, daily array shape, date cadence, units, coordinates, or one or more provider values are incomplete. Only validated rows are shown; full-period aggregates are withheld when the measurement series is incomplete.</p>}
    <Sparkline values={boundedTrend(values)} label={`${request?.model ?? 'Open-Meteo climate model'} validated daily mean temperature trend`}/>
    <Facts items={[
      { label: 'Model', value: request?.model ?? 'Executed request identity unavailable' },
      { label: 'Response range', value: `${firstDate} → ${lastDate}` },
      { label: resultState === 'ready' ? 'Latest daily mean' : 'Latest validated daily mean', value: temperatureUnit ? `${numericText(latestTemperature)} ${temperatureUnit}` : `${numericText(latestTemperature)} · unit unavailable` },
      ...(averageTemperature === undefined || !temperatureUnit ? [] : [{ label: 'Period mean', value: `${numericText(averageTemperature)} ${temperatureUnit}` }]),
      ...(totalPrecipitation === undefined || !precipitationUnit ? [] : [{ label: 'Total precipitation', value: `${numericText(totalPrecipitation)} ${precipitationUnit}` }]),
      { label: resultState === 'ready' ? 'Returned days' : 'Validated days', value: numericText(rows.length) },
      ...(elevation === undefined ? [] : [{ label: 'Downscaled elevation', value: `${numericText(elevation)} m` }]),
    ]}/>
    <p className="domain-note">The model identity comes from the executed request because this response does not repeat the selected model. Open-Meteo describes this Climate API as downscaled HighResMIP climate-model output; retain the model and date range when interpreting the projection.</p>
  </div>
}
