import { asRecord, CardEmpty, CardHeading, Facts, text } from './cardPrimitives'
import { finiteNumber } from './semanticValidation'

const intensityValue = (value: number | undefined) => value === undefined ? 'Not supplied' : `${value} gCO₂/kWh`

const indexLabel = (value: string | undefined) => value
  ? value.replace(/\b\w/g, (character) => character.toUpperCase())
  : 'Not supplied'

export function CarbonIntensityPreview({ data }: { data: unknown }) {
  const root = asRecord(data)
  const providerRecords = Array.isArray(root.data) ? root.data : undefined

  if (!providerRecords) {
    return <CardEmpty
      domain="carbon-intensity"
      title="Carbon intensity response invalid"
      detail="NESO returned HTTP-success data without the documented carbon-intensity data array. No live intensity conclusion can be drawn."
      state="invalid"
    />
  }

  if (providerRecords.length === 0) {
    return <CardEmpty
      domain="carbon-intensity"
      title="Carbon intensity unavailable"
      detail="NESO returned no current half-hour carbon-intensity record."
      state="empty"
    />
  }

  const record = asRecord(providerRecords[0])
  const intensity = asRecord(record.intensity)
  const forecast = finiteNumber(intensity.forecast)
  const actual = finiteNumber(intensity.actual)
  const malformedForecast = intensity.forecast !== undefined && intensity.forecast !== null && forecast === undefined
  const malformedActual = intensity.actual !== undefined && intensity.actual !== null && actual === undefined
  const malformedMeasurementCount = Number(malformedForecast) + Number(malformedActual)

  if (forecast === undefined && actual === undefined) {
    return <CardEmpty
      domain="carbon-intensity"
      title="Carbon intensity response invalid"
      detail="NESO returned a current record without a numeric forecast or estimated-actual intensity. No live intensity conclusion can be drawn."
      state="invalid"
    />
  }

  const index = text(intensity.index)
  const from = text(record.from)
  const to = text(record.to)
  const primary = actual ?? forecast
  const measurementContract = malformedMeasurementCount === 0
  const state = from && to && forecast !== undefined && index && measurementContract ? 'ready' : 'partial'

  return <div
    className="domain-card carbon-intensity-preview"
    data-domain-card="carbon-intensity"
    data-result-state={state}
    data-provider-records={providerRecords.length}
    data-primary-intensity-gco2-kwh={primary}
    data-primary-index={index}
    data-forecast-gco2-kwh={forecast}
    data-actual-gco2-kwh={actual}
    data-measurement-contract={String(measurementContract)}
    data-malformed-measurement-count={malformedMeasurementCount}
    data-period-from={from}
    data-period-to={to}
  >
    <CardHeading
      eyebrow="NESO · Great Britain"
      title={`${indexLabel(index)} carbon intensity`}
      description="Current half-hour electricity-generation carbon intensity, preserving the provider forecast and estimated actual independently."
    >
      <span className="domain-state">{state === 'partial' ? 'Partial provider response' : `${primary} gCO₂/kWh`}</span>
    </CardHeading>

    <Facts items={[
      { label: 'Estimated actual', value: intensityValue(actual) },
      { label: 'Forecast', value: intensityValue(forecast) },
      { label: 'Intensity index', value: indexLabel(index) },
      { label: 'Interval start (UTC)', value: from ? <time dateTime={from}>{from}</time> : 'Not supplied' },
      { label: 'Interval end (UTC)', value: to ? <time dateTime={to}>{to}</time> : 'Not supplied' },
    ]}/>

    {state === 'partial' && <p className="domain-note">NESO returned a usable native-number intensity measurement, but one or more documented forecast, estimated-actual, index, or UTC interval fields are unavailable or malformed.</p>}
    <p className="domain-note">NESO documents this endpoint as the current half-hour GB carbon-intensity record. The API reports forecast and estimated actual values in gCO₂/kWh, and all returned interval times are UTC.</p>
  </div>
}
