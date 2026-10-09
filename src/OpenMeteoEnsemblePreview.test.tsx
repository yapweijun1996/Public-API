import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'open-meteo-ensemble')
if (!api) throw new Error('Missing open-meteo-ensemble fixture')

const memberKeys = Array.from({ length: 39 }, (_, index) => `temperature_2m_member${String(index + 1).padStart(2, '0')}`)
const hours = Array.from({ length: 24 }, (_, index) => `2026-09-15T${String(index).padStart(2, '0')}:00`)

const ensembleResponse = (variable = 'temperature_2m', unit = '°C') => {
  const variableMemberKeys = memberKeys.map((key) => key.replace('temperature_2m', variable))
  return {
    latitude: 1.5,
    longitude: 103.75,
    utc_offset_seconds: 28800,
    timezone: 'Asia/Singapore',
    hourly_units: {
      time: 'iso8601',
      [variable]: unit,
      ...Object.fromEntries(variableMemberKeys.map((key) => [key, unit])),
    },
    hourly: {
      time: [...hours],
      [variable]: hours.map(() => 28),
      ...Object.fromEntries(variableMemberKeys.map((key, index) => [key, hours.map(() => 29 + (index % 3))])),
    },
  }
}

const executedRequest = (variable = 'temperature_2m', forecastDays = '1', method = 'GET') => ({
  url: api.buildUrl({ variable, forecastDays }),
  method,
})

const region = () => screen.getByRole('region', { name: 'Open-Meteo Ensemble Forecast' })
const card = () => region().querySelector('[data-domain-card="ensemble-forecast"]')

describe('Open-Meteo Ensemble semantic preview', () => {
  afterEach(cleanup)

  it('binds the documented model and complete member set to the successful GET request', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest()} data={ensembleResponse()}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(region()).toHaveAttribute('data-preview-layout', 'ensemble-forecast')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-request-bound', 'true')
    expect(card()).toHaveAttribute('data-request-method', 'GET')
    expect(card()).toHaveAttribute('data-request-model', 'icon_seamless_eps')
    expect(card()).toHaveAttribute('data-request-variable', 'temperature_2m')
    expect(card()).toHaveAttribute('data-member-identity-contract', 'true')
    expect(card()).toHaveAttribute('data-array-length-contract', 'true')
    expect(card()).toHaveAttribute('data-time-contract', 'true')
    expect(card()).toHaveAttribute('data-cadence-contract', 'true')
    expect(card()).toHaveAttribute('data-horizon-contract', 'true')
    expect(card()).toHaveAttribute('data-forecast-member-count', '40')
    expect(card()).toHaveAttribute('data-perturbed-member-count', '39')
    expect(card()).toHaveAttribute('data-valid-hour-count', '24')
    expect(region()).toHaveTextContent('Control forecast')
    expect(region()).toHaveTextContent('Ensemble spread')
    expect(region()).toHaveTextContent('1 control + 39 perturbed')
    expect(region()).toHaveTextContent('28 – 31 °C')
  })

  it('fails closed for a method mismatch or expanded executed URL', async () => {
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={executedRequest('temperature_2m', '1', 'POST')} data={ensembleResponse()}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(region()).not.toHaveTextContent('28 – 31 °C')

    const request = executedRequest()
    rerender(<ResponseDemoPreview api={api} executedRequest={{ ...request, url: `${request.url}&temperature_unit=fahrenheit` }} data={ensembleResponse()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} executedRequest={{ ...request, body: { hidden: true } }} data={ensembleResponse()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
  })

  it('rejects numeric-string member measurements without contaminating the displayed spread', async () => {
    const response = ensembleResponse()
    const member = response.hourly.temperature_2m_member39
    member[23] = '99.9' as unknown as number
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest()} data={response}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-invalid-measurement-count', '1')
    expect(card()).toHaveAttribute('data-valid-hour-count', '23')
    expect(region()).not.toHaveTextContent('99.9')

    const controlResponse = ensembleResponse()
    controlResponse.hourly.temperature_2m[23] = '88.8' as unknown as number
    const request = executedRequest()
    cleanup()
    render(<ResponseDemoPreview api={api} executedRequest={request} data={controlResponse}/>)
    await waitFor(() => expect(card()).toHaveAttribute('data-result-state', 'partial'))
    expect(card()).toHaveAttribute('data-invalid-measurement-count', '1')
    expect(region()).not.toHaveTextContent('88.8')
  })

  it('distinguishes a missing member array from a misaligned member series', async () => {
    const missingArrayResponse = ensembleResponse()
    delete missingArrayResponse.hourly.temperature_2m_member39
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={executedRequest()} data={missingArrayResponse}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-member-identity-contract', 'false')
    expect(card()).toHaveAttribute('data-missing-array-count', '1')

    const misalignedResponse = ensembleResponse()
    misalignedResponse.hourly.temperature_2m_member39 = misalignedResponse.hourly.temperature_2m_member39.slice(0, 23)
    rerender(<ResponseDemoPreview api={api} executedRequest={executedRequest()} data={misalignedResponse}/>)

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-array-length-contract', 'false')
    expect(card()).toHaveAttribute('data-missing-measurement-count', '1')
    expect(card()).toHaveAttribute('data-valid-hour-count', '23')
  })

  it('fails closed when provider units do not match the selected variable', async () => {
    const response = ensembleResponse()
    response.hourly_units.temperature_2m = 'F'
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest()} data={response}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-unit-contract', 'false')
    expect(region()).not.toHaveTextContent('28 – 31 °C')
  })

  it('marks malformed timestamps and a truncated horizon partial', async () => {
    const malformedTimeResponse = ensembleResponse()
    malformedTimeResponse.hourly.time[23] = '2026-09-15 23:00'
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={executedRequest()} data={malformedTimeResponse}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-time-contract', 'false')
    expect(card()).toHaveAttribute('data-valid-hour-count', '23')

    const shortResponse = ensembleResponse()
    Object.keys(shortResponse.hourly).forEach((key) => {
      shortResponse.hourly[key as keyof typeof shortResponse.hourly] = shortResponse.hourly[key as keyof typeof shortResponse.hourly].slice(0, 23) as never
    })
    rerender(<ResponseDemoPreview api={api} executedRequest={executedRequest()} data={shortResponse}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-horizon-contract', 'false')
    expect(card()).toHaveAttribute('data-valid-hour-count', '23')
  })

  it.each([
    ['precipitation', 'mm'],
    ['wind_speed_10m', 'km/h'],
  ])('uses the documented %s unit from the selected request', async (variable, unit) => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest(variable)} data={ensembleResponse(variable, unit)}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-request-variable', variable)
    expect(card()).toHaveAttribute('data-unit', unit)
    expect(region()).toHaveTextContent(`28 – 31 ${unit}`)
  })
})
