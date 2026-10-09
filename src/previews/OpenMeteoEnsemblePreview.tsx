import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { Sparkline } from './ChartPrimitives'
import { formatNumber } from './previewData'
import { finiteNumber, isRecord, trimmedText } from './semanticValidation'

const ENSEMBLE_MODEL = 'icon_seamless_eps'
const MEMBER_COUNT = 39
const HOUR_MS = 3_600_000

const ensembleVariables = ['temperature_2m', 'precipitation', 'wind_speed_10m'] as const
type EnsembleVariable = typeof ensembleVariables[number]
type EnsembleState = 'ready' | 'partial' | 'invalid'

type EnsembleRequest = {
  valid: true
  method: 'GET'
  latitude: string
  longitude: string
  model: typeof ENSEMBLE_MODEL
  variable: EnsembleVariable
  forecastDays: number
} | {
  valid: false
  method?: string
}

type EnsembleHour = {
  time: string
  control: number
  members: number[]
  spreadMinimum: number
  spreadMaximum: number
}

type EnsembleViewModel = {
  state: EnsembleState
  reason?: string
  request: EnsembleRequest
  providerLatitude?: number
  providerLongitude?: number
  timezone?: string
  utcOffsetSeconds?: number
  unit?: string
  forecastMemberCount: number
  perturbedMemberCount: number
  providerHourCount: number
  validHourCount: number
  invalidHourCount: number
  missingArrayCount: number
  invalidArrayCount: number
  missingMeasurementCount: number
  invalidMeasurementCount: number
  memberIdentityContract: boolean
  arrayLengthContract: boolean
  unitContract: boolean
  timeContract: boolean
  cadenceContract: boolean
  horizonContract: boolean
  rows: EnsembleHour[]
}

const variableMetadata: Record<EnsembleVariable, { label: string; unit: string }> = {
  temperature_2m: { label: 'Temperature at 2 m', unit: '°C' },
  precipitation: { label: 'Precipitation', unit: 'mm' },
  wind_speed_10m: { label: 'Wind speed at 10 m', unit: 'km/h' },
}

const memberKeys = (variable: EnsembleVariable) => Array.from(
  { length: MEMBER_COUNT },
  (_, index) => `${variable}_member${String(index + 1).padStart(2, '0')}`,
)

const boundedQueryNumber = (value: string | null, minimum: number, maximum: number) => {
  if (value === null || !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? { raw: value, numeric } : undefined
}

const parseExecutedRequest = (executedRequest?: ExecutedRequestContext): EnsembleRequest => {
  if (!executedRequest) return { valid: false }
  const method = executedRequest.method
  try {
    const url = new URL(executedRequest.url)
    const allowedKeys = new Set(['latitude', 'longitude', 'models', 'hourly', 'forecast_days', 'timezone'])
    const entries = [...url.searchParams.entries()]
    const exactKeys = entries.length === allowedKeys.size
      && entries.every(([key]) => allowedKeys.has(key))
      && [...allowedKeys].every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
    const latitude = boundedQueryNumber(url.searchParams.get('latitude'), -90, 90)
    const longitude = boundedQueryNumber(url.searchParams.get('longitude'), -180, 180)
    const variable = url.searchParams.get('hourly')
    const forecastDays = url.searchParams.get('forecast_days')
    const valid = method === 'GET'
      && executedRequest.body === undefined
      && url.protocol === 'https:'
      && url.hostname === 'ensemble-api.open-meteo.com'
      && url.port === ''
      && url.pathname === '/v1/ensemble'
      && !url.username
      && !url.password
      && !url.hash
      && exactKeys
      && Boolean(latitude)
      && Boolean(longitude)
      && url.searchParams.get('models') === ENSEMBLE_MODEL
      && ensembleVariables.includes(variable as EnsembleVariable)
      && forecastDays !== null
      && /^[1-7]$/.test(forecastDays)
      && url.searchParams.get('timezone') === 'Asia/Singapore'
    return valid && latitude && longitude && variable && forecastDays
      ? {
          valid: true,
          method: 'GET',
          latitude: latitude.raw,
          longitude: longitude.raw,
          model: ENSEMBLE_MODEL,
          variable: variable as EnsembleVariable,
          forecastDays: Number(forecastDays),
        }
      : { valid: false, method }
  } catch {
    return { valid: false, method }
  }
}

const localHourEpoch = (value: unknown) => {
  const time = trimmedText(value)
  if (time === undefined || time !== value || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):00$/.test(time)) return undefined
  const epoch = Date.parse(`${time}:00Z`)
  return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 16) === time ? epoch : undefined
}

const measurement = (value: unknown, variable: EnsembleVariable) => {
  if (value === null || value === undefined) return { kind: 'missing' as const }
  const numeric = finiteNumber(value)
  if (numeric === undefined) return { kind: 'invalid' as const }
  if ((variable === 'precipitation' || variable === 'wind_speed_10m') && numeric < 0) return { kind: 'invalid' as const }
  return { kind: 'valid' as const, value: numeric }
}

const exactKeySet = (record: Record<string, unknown> | undefined, keys: string[]) => {
  if (!record) return false
  const actualKeys = Object.keys(record)
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key))
}

export const openMeteoEnsembleModel = (data: unknown, executedRequest?: ExecutedRequestContext): EnsembleViewModel => {
  const request = parseExecutedRequest(executedRequest)
  const variable = request.valid ? request.variable : undefined
  const root = isRecord(data) ? data : undefined
  const hourly = root && isRecord(root.hourly) ? root.hourly : undefined
  const units = root && isRecord(root.hourly_units) ? root.hourly_units : undefined
  const expectedMemberKeys = variable ? memberKeys(variable) : []
  const expectedKeys = variable ? ['time', variable, ...expectedMemberKeys] : []
  const memberIdentityContract = Boolean(variable && exactKeySet(hourly, expectedKeys) && exactKeySet(units, expectedKeys))

  const arrays = variable
    ? Object.fromEntries(expectedKeys.map((key) => [key, Array.isArray(hourly?.[key]) ? hourly[key] as unknown[] : undefined])) as Record<string, unknown[] | undefined>
    : {}
  const missingArrayCount = variable ? expectedKeys.filter((key) => hourly?.[key] === undefined).length : 0
  const invalidArrayCount = variable ? expectedKeys.filter((key) => hourly?.[key] !== undefined && !Array.isArray(hourly[key])).length : 0
  const lengths = variable ? expectedKeys.map((key) => arrays[key]?.length ?? 0) : []
  const providerHourCount = arrays.time?.length ?? 0
  const providerRowCount = lengths.length ? Math.max(...lengths) : 0
  const arrayLengthContract = memberIdentityContract
    && providerHourCount > 0
    && lengths.every((length) => length === providerHourCount)

  const providerLatitude = finiteNumber(root?.latitude)
  const providerLongitude = finiteNumber(root?.longitude)
  const offset = finiteNumber(root?.utc_offset_seconds)
  const utcOffsetSeconds = offset !== undefined && Number.isInteger(offset) && offset >= -86_400 && offset <= 86_400 ? offset : undefined
  const timezoneValue = trimmedText(root?.timezone)
  const timezone = timezoneValue !== undefined && timezoneValue === root?.timezone ? timezoneValue : undefined
  const providerContextValid = providerLatitude !== undefined && providerLatitude >= -90 && providerLatitude <= 90
    && providerLongitude !== undefined && providerLongitude >= -180 && providerLongitude <= 180
    && timezone === 'Asia/Singapore'
    && utcOffsetSeconds !== undefined

  const expectedUnit = variable ? variableMetadata[variable].unit : undefined
  const unitContract = Boolean(variable && expectedUnit && memberIdentityContract && expectedKeys.every((key) => units?.[key] === (key === 'time' ? 'iso8601' : expectedUnit)))

  let missingMeasurementCount = 0
  let invalidMeasurementCount = 0
  const timeEpochs: Array<number | undefined> = []
  const rows: EnsembleHour[] = []
  const firstEpoch = localHourEpoch(arrays.time?.[0])

  if (variable && memberIdentityContract) {
    for (let index = 0; index < providerRowCount; index += 1) {
      const time = arrays.time?.[index]
      const epoch = localHourEpoch(time)
      timeEpochs.push(epoch)
      const expectedEpoch = firstEpoch === undefined ? undefined : firstEpoch + index * HOUR_MS
      const timeValid = epoch !== undefined && expectedEpoch !== undefined && epoch === expectedEpoch
      const control = measurement(arrays[variable]?.[index], variable)
      if (control.kind === 'missing') missingMeasurementCount += 1
      if (control.kind === 'invalid') invalidMeasurementCount += 1
      const members = expectedMemberKeys.map((key) => {
        const parsed = measurement(arrays[key]?.[index], variable)
        if (parsed.kind === 'missing') missingMeasurementCount += 1
        if (parsed.kind === 'invalid') invalidMeasurementCount += 1
        return parsed
      })
      if (!timeValid || typeof time !== 'string' || control.kind !== 'valid' || members.some((member) => member.kind !== 'valid')) continue
      const memberValues = members.map((member) => member.value as number)
      const forecastValues = [control.value, ...memberValues]
      rows.push({
        time,
        control: control.value,
        members: memberValues,
        spreadMinimum: Math.min(...forecastValues),
        spreadMaximum: Math.max(...forecastValues),
      })
    }
  }

  const firstTimeStartsAtMidnight = typeof arrays.time?.[0] === 'string' && arrays.time[0].endsWith('T00:00')
  const timeContract = memberIdentityContract
    && providerHourCount > 0
    && timeEpochs.length === providerRowCount
    && timeEpochs.every((epoch, index) => epoch !== undefined && firstEpoch !== undefined && epoch === firstEpoch + index * HOUR_MS)
  const cadenceContract = timeContract && timeEpochs.every((epoch, index) => index === 0 || (epoch as number) - (timeEpochs[index - 1] as number) === HOUR_MS)
  const horizonContract = request.valid
    && providerHourCount === request.forecastDays * 24
    && firstTimeStartsAtMidnight
    && cadenceContract
  const validHourCount = rows.length
  const invalidHourCount = Math.max(0, providerRowCount - validHourCount)

  let state: EnsembleState = 'partial'
  let reason: string | undefined
  if (!request.valid) {
    state = 'invalid'
    reason = 'The successful run is not bound to the exact supported Open-Meteo Ensemble GET request.'
  } else if (!root || !hourly || !units) {
    state = 'invalid'
    reason = 'The response does not contain the documented Open-Meteo Ensemble hourly objects.'
  } else if (!providerContextValid) {
    state = 'invalid'
    reason = 'The response grid coordinates, timezone, or UTC offset are malformed.'
  } else if (!memberIdentityContract) {
    state = 'invalid'
    reason = 'The response does not expose the live-evidenced control and member01–member39 identities exactly.'
  } else if (!unitContract) {
    state = 'invalid'
    reason = 'The response does not declare the documented unit for the selected control and every ensemble member.'
  } else if (providerHourCount === 0 || validHourCount === 0) {
    state = 'invalid'
    reason = 'No complete hourly control and ensemble-member measurements could be validated.'
  } else if (arrayLengthContract && timeContract && cadenceContract && horizonContract && missingMeasurementCount === 0 && invalidMeasurementCount === 0 && invalidHourCount === 0) {
    state = 'ready'
  } else {
    reason = 'Only complete, aligned request-matching hours contribute to the displayed control forecast and ensemble spread.'
  }

  return {
    state,
    reason,
    request,
    providerLatitude,
    providerLongitude,
    timezone,
    utcOffsetSeconds,
    unit: expectedUnit,
    forecastMemberCount: variable ? expectedMemberKeys.length + 1 : 0,
    perturbedMemberCount: expectedMemberKeys.length,
    providerHourCount,
    validHourCount,
    invalidHourCount,
    missingArrayCount,
    invalidArrayCount,
    missingMeasurementCount,
    invalidMeasurementCount,
    memberIdentityContract,
    arrayLengthContract,
    unitContract,
    timeContract,
    cadenceContract,
    horizonContract,
    rows,
  }
}

export function OpenMeteoEnsemblePreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const model = openMeteoEnsembleModel(data, executedRequest)
  const request = model.request.valid ? model.request : undefined
  const latest = model.rows.at(-1)
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(request)),
    'data-request-method': model.request.method,
    'data-request-model': request?.model,
    'data-request-variable': request?.variable,
    'data-request-forecast-days': request?.forecastDays,
    'data-request-latitude': request?.latitude,
    'data-request-longitude': request?.longitude,
    'data-provider-latitude': model.providerLatitude,
    'data-provider-longitude': model.providerLongitude,
    'data-timezone': model.timezone,
    'data-utc-offset-seconds': model.utcOffsetSeconds,
    'data-unit': model.unit,
    'data-forecast-member-count': model.forecastMemberCount,
    'data-perturbed-member-count': model.perturbedMemberCount,
    'data-provider-hour-count': model.providerHourCount,
    'data-valid-hour-count': model.validHourCount,
    'data-invalid-hour-count': model.invalidHourCount,
    'data-missing-array-count': model.missingArrayCount,
    'data-invalid-array-count': model.invalidArrayCount,
    'data-missing-measurement-count': model.missingMeasurementCount,
    'data-invalid-measurement-count': model.invalidMeasurementCount,
    'data-member-identity-contract': String(model.memberIdentityContract),
    'data-array-length-contract': String(model.arrayLengthContract),
    'data-unit-contract': String(model.unitContract),
    'data-time-contract': String(model.timeContract),
    'data-cadence-contract': String(model.cadenceContract),
    'data-horizon-contract': String(model.horizonContract),
    'data-primary-time': latest?.time,
    'data-primary-control': latest?.control,
    'data-primary-spread-min': latest?.spreadMinimum,
    'data-primary-spread-max': latest?.spreadMaximum,
  }

  if (model.state === 'invalid' || !request || !latest || !model.unit || !model.timezone) {
    return <div className="market-preview" data-domain-card="ensemble-forecast" {...evidence}>
      <div className="market-summary"><div><span>Ensemble forecast unavailable</span><strong>—</strong><small>{model.reason}</small></div></div>
    </div>
  }

  const variable = variableMetadata[request.variable]
  const values = model.rows.map((row) => row.control)
  const value = (measurementValue: number) => `${formatNumber(measurementValue, 2)} ${model.unit}`
  const spread = `${formatNumber(latest.spreadMinimum, 2)} – ${formatNumber(latest.spreadMaximum, 2)} ${model.unit}`

  return <div className="market-preview" data-domain-card="ensemble-forecast" {...evidence}>
    <div className="market-summary">
      <div><span>{model.timezone.replaceAll('_', ' ')} · {variable.label}</span><strong>{value(latest.control)}</strong><small>{latest.time} · latest complete ensemble hour</small></div>
      <div className="market-range"><span>{model.rows[0].time}</span><span>{latest.time}</span></div>
    </div>
    <Sparkline values={values} label={`${variable.label} control forecast trend`}/>
    <div className="market-metrics">
      <article><small>Control forecast</small><strong>{value(latest.control)}</strong></article>
      <article><small>Ensemble spread</small><strong>{spread}</strong></article>
      <article><small>Forecast members</small><strong>{model.forecastMemberCount}</strong><span>1 control + {model.perturbedMemberCount} perturbed</span><span>{model.validHourCount} / {model.providerHourCount} complete hours</span></article>
    </div>
    {model.state === 'partial' && <div className="market-metrics"><article><small>Validation</small><strong>Partial response</strong><span>{model.reason}</span></article></div>}
  </div>
}
