import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { CurrentConditionsPreview } from './previews/WeatherPreviews'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'weather')
if (!api) throw new Error('Missing Live Weather fixture')

const request = (overrides: Partial<ExecutedRequestContext> = {}): ExecutedRequestContext => ({
  url: api.buildUrl({ latitude: '1.3521', longitude: '103.8198' }),
  method: 'GET',
  ...overrides,
})

const response = (overrides: Record<string, unknown> = {}) => ({
  latitude: 1.375,
  longitude: 103.8125,
  timezone: 'Asia/Singapore',
  utc_offset_seconds: 28_800,
  current_units: {
    time: 'iso8601',
    interval: 'seconds',
    temperature_2m: '°C',
    relative_humidity_2m: '%',
    wind_speed_10m: 'km/h',
    weather_code: 'wmo code',
  },
  current: {
    time: '2026-09-10T18:30',
    interval: 900,
    temperature_2m: 29,
    relative_humidity_2m: 76,
    wind_speed_10m: 4,
    weather_code: 3,
  },
  ...overrides,
})

const renderPreview = (data: unknown, executedRequest?: ExecutedRequestContext) => render(
  <CurrentConditionsPreview api={api} data={data} executedRequest={executedRequest}/>,
)

describe('CurrentConditionsPreview semantic contract', () => {
  afterEach(cleanup)

  it('binds the exact Open-Meteo response to the executed request and exposes distinct coordinates', () => {
    const { container } = renderPreview(response(), request())
    const card = container.querySelector('[data-domain-card="current-weather"]')

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-envelope-contract', 'true')
    expect(card).toHaveAttribute('data-time-contract', 'true')
    expect(card).toHaveAttribute('data-units-contract', 'true')
    expect(card).toHaveAttribute('data-valid-measurement-count', '4')
    expect(card).toHaveAttribute('data-request-latitude', '1.3521')
    expect(card).toHaveAttribute('data-request-longitude', '103.8198')
    expect(card).toHaveAttribute('data-provider-latitude', '1.375')
    expect(card).toHaveAttribute('data-provider-longitude', '103.8125')
    expect(card).toHaveAttribute('data-observation-time', '2026-09-10T18:30')
    expect(card).toHaveAttribute('data-observation-interval', '900')
    expect(card).toHaveAttribute('data-temperature-2m', '29')
    expect(card).toHaveAttribute('data-relative-humidity-2m', '76')
    expect(card).toHaveAttribute('data-wind-speed-10m', '4')
    expect(card).toHaveAttribute('data-weather-code', '3')
    expect(screen.getByText('Requested coordinates')).toBeInTheDocument()
    expect(screen.getByText('1.352, 103.82')).toBeInTheDocument()
    expect(screen.getByText('Provider grid')).toBeInTheDocument()
    expect(screen.getByText('1.375, 103.813')).toBeInTheDocument()
    expect(screen.getByText('29°C')).toBeInTheDocument()
    expect(screen.getByText('76%')).toBeInTheDocument()
    expect(screen.getByText('4 km/h')).toBeInTheDocument()
  })

  it('preserves genuine native zero measurements as ready evidence', () => {
    const zero = response({
      current: {
        time: '2026-09-10T18:30',
        interval: 900,
        temperature_2m: 0,
        relative_humidity_2m: 0,
        wind_speed_10m: 0,
        weather_code: 0,
      },
    })
    const { container } = renderPreview(zero, request())
    const card = container.querySelector('[data-domain-card="current-weather"]')

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-temperature-2m', '0')
    expect(card).toHaveAttribute('data-relative-humidity-2m', '0')
    expect(card).toHaveAttribute('data-wind-speed-10m', '0')
    expect(card).toHaveAttribute('data-weather-code', '0')
  })

  it('fails closed without an exact successful executed request', () => {
    const { container } = renderPreview(response())
    const card = container.querySelector('[data-domain-card="current-weather"]')

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(screen.getByText('Current weather response unavailable')).toBeInTheDocument()
  })

  it.each([
    ['wrong method', request({ method: 'POST' })],
    ['body-bearing GET', request({ body: {} })],
    ['unexpected query', request({ url: `${request().url}&forecast_days=1` })],
    ['duplicate query', request({ url: `${request().url}&latitude=1.3521` })],
    ['wrong host', request({ url: request().url.replace('api.open-meteo.com', 'example.com') })],
    ['wrong path', request({ url: request().url.replace('/v1/forecast', '/v1/forecast/') })],
    ['non-HTTPS URL', request({ url: request().url.replace('https:', 'http:') })],
    ['credentials', request({ url: request().url.replace('https://', 'https://user:password@') })],
    ['explicit port', request({ url: request().url.replace('api.open-meteo.com', 'api.open-meteo.com:443') })],
    ['wrong timezone', request({ url: request().url.replace('timezone=auto', 'timezone=UTC') })],
    ['wrong current set', request({ url: request().url.replace('%2Cweather_code', '') })],
    ['out-of-bounds coordinate', request({ url: request().url.replace('latitude=1.3521', 'latitude=91') })],
    ['URL fragment', request({ url: `${request().url}#current` })],
  ])('rejects an inexact executed request: %s', (_label, executedRequest) => {
    const { container } = renderPreview(response(), executedRequest)
    expect(container.querySelector('[data-domain-card="current-weather"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('rejects numeric strings as zero trusted current evidence', () => {
    const numericStrings = response({
      current: {
        time: '2026-09-10T18:30',
        interval: 900,
        temperature_2m: '29',
        relative_humidity_2m: '76',
        wind_speed_10m: '4',
        weather_code: '3',
      },
    })
    const { container } = renderPreview(numericStrings, request())

    expect(container.querySelector('[data-domain-card="current-weather"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByText(/No trusted current-condition measurements/)).toBeInTheDocument()
  })

  it.each([
    ['missing measurement', { current: { time: '2026-09-10T18:30', interval: 900, temperature_2m: 29, relative_humidity_2m: 76, wind_speed_10m: 4 } }],
    ['malformed measurement', { current: { time: '2026-09-10T18:30', interval: 900, temperature_2m: 29, relative_humidity_2m: 101, wind_speed_10m: 4, weather_code: 3 } }],
    ['missing time', { current: { interval: 900, temperature_2m: 29, relative_humidity_2m: 76, wind_speed_10m: 4, weather_code: 3 } }],
    ['malformed time', { current: { time: '10 September 2026', interval: 900, temperature_2m: 29, relative_humidity_2m: 76, wind_speed_10m: 4, weather_code: 3 } }],
    ['missing provider coordinate', { longitude: undefined }],
    ['malformed provider coordinate', { latitude: '1.375' }],
    ['missing timezone', { timezone: undefined }],
    ['malformed timezone', { timezone: ' Singapore ' }],
    ['malformed timezone offset', { utc_offset_seconds: '28800' }],
    ['malformed existing units', { current_units: { time: 'iso8601', interval: 'seconds', temperature_2m: 'F', relative_humidity_2m: '%', wind_speed_10m: 'km/h', weather_code: 'wmo code' } }],
  ])('classifies mixed response evidence as partial: %s', (_label, override) => {
    const { container } = renderPreview(response(override), request())
    expect(container.querySelector('[data-domain-card="current-weather"]')).toHaveAttribute('data-result-state', 'partial')
  })

  it('fails semantically closed when an HTTP-success-shaped body has an invalid envelope', () => {
    const { container } = renderPreview({}, request())
    const card = container.querySelector('[data-domain-card="current-weather"]')

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-envelope-contract', 'false')
    expect(screen.getByText(/No live weather conclusion can be drawn/)).toBeInTheDocument()
  })
})
