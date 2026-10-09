import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { AirQualityForecastPreview } from './previews/WeatherPreviews'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'open-meteo-air-quality')
if (!api) throw new Error('Missing Global Air Quality fixture')

const request = (overrides: Partial<ExecutedRequestContext> = {}): ExecutedRequestContext => ({
  url: api.buildUrl({ latitude: '1.3521', longitude: '103.8198' }),
  method: 'GET',
  ...overrides,
})

const response = (overrides: Record<string, unknown> = {}) => ({
  latitude: 1.35,
  longitude: 103.85,
  timezone: 'Asia/Singapore',
  utc_offset_seconds: 28_800,
  current_units: {
    time: 'iso8601',
    interval: 'seconds',
    us_aqi: 'USAQI',
    pm2_5: 'μg/m³',
    pm10: 'μg/m³',
    nitrogen_dioxide: 'μg/m³',
    ozone: 'μg/m³',
  },
  current: {
    time: '2026-09-10T18:00',
    interval: 3600,
    us_aqi: 66,
    pm2_5: 19.6,
    pm10: 26.5,
    nitrogen_dioxide: 12.6,
    ozone: 56,
  },
  ...overrides,
})

const renderPreview = (data: unknown, executedRequest?: ExecutedRequestContext) => render(
  <AirQualityForecastPreview data={data} executedRequest={executedRequest}/>,
)

describe('AirQualityForecastPreview semantic contract', () => {
  afterEach(cleanup)

  it('renders a fully coherent request-bound Open-Meteo air-quality response as ready', () => {
    const { container } = renderPreview(response(), request())
    const card = container.querySelector('[data-domain-card="open-meteo-air-quality"]')

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-envelope-contract', 'true')
    expect(card).toHaveAttribute('data-valid-measurement-count', '5')
    expect(card).toHaveAttribute('data-request-latitude', '1.3521')
    expect(card).toHaveAttribute('data-request-longitude', '103.8198')
    expect(card).toHaveAttribute('data-provider-latitude', '1.35')
    expect(card).toHaveAttribute('data-provider-longitude', '103.85')
    expect(card).toHaveAttribute('data-us-aqi', '66')
    expect(screen.getByText('U.S. AQI · Moderate')).toBeInTheDocument()
    expect(screen.getByText('Requested coordinates')).toBeInTheDocument()
    expect(screen.getByText('Provider grid')).toBeInTheDocument()
  })

  it('preserves genuine native zero measurements as ready evidence', () => {
    const { container } = renderPreview(response({
      current: { time: '2026-09-10T18:00', interval: 3600, us_aqi: 0, pm2_5: 0, pm10: 0, nitrogen_dioxide: 0, ozone: 0 },
    }), request())
    const card = container.querySelector('[data-domain-card="open-meteo-air-quality"]')

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-us-aqi', '0')
    expect(card).toHaveAttribute('data-pm2-5', '0')
  })

  it.each([
    ['missing request', undefined],
    ['wrong method', request({ method: 'POST' })],
    ['body-bearing request', request({ body: '{}' })],
    ['unexpected query', request({ url: `${request().url}&hourly=pm2_5` })],
    ['duplicate query', request({ url: `${request().url}&longitude=103.8198` })],
    ['explicit port', request({ url: request().url.replace('air-quality-api.open-meteo.com', 'air-quality-api.open-meteo.com:443') })],
    ['out-of-bounds coordinate', request({ url: request().url.replace('longitude=103.8198', 'longitude=181') })],
    ['wrong path', request({ url: request().url.replace('/v1/air-quality', '/v1/forecast') })],
  ])('fails closed for invalid request identity: %s', (_label, executedRequest) => {
    const { container } = renderPreview(response(), executedRequest)
    const card = container.querySelector('[data-domain-card="open-meteo-air-quality"]')

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('rejects numeric strings as zero trusted current evidence', () => {
    const { container } = renderPreview(response({
      current: { time: '2026-09-10T18:00', interval: 3600, us_aqi: '66', pm2_5: '19.6', pm10: '26.5', nitrogen_dioxide: '12.6', ozone: '56' },
    }), request())

    expect(container.querySelector('[data-domain-card="open-meteo-air-quality"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it.each([
    ['missing measurement', { current: { time: '2026-09-10T18:00', interval: 3600, us_aqi: 66, pm2_5: 19.6, pm10: 26.5, nitrogen_dioxide: 12.6 } }],
    ['malformed measurement', { current: { time: '2026-09-10T18:00', interval: 3600, us_aqi: 66, pm2_5: -1, pm10: 26.5, nitrogen_dioxide: 12.6, ozone: 56 } }],
    ['fractional AQI', { current: { time: '2026-09-10T18:00', interval: 3600, us_aqi: 66.5, pm2_5: 19.6, pm10: 26.5, nitrogen_dioxide: 12.6, ozone: 56 } }],
    ['missing time', { current: { interval: 3600, us_aqi: 66, pm2_5: 19.6, pm10: 26.5, nitrogen_dioxide: 12.6, ozone: 56 } }],
    ['malformed time', { current: { time: '2026-09-10T18:00Z', interval: 3600, us_aqi: 66, pm2_5: 19.6, pm10: 26.5, nitrogen_dioxide: 12.6, ozone: 56 } }],
    ['missing provider coordinate', { latitude: undefined }],
    ['malformed provider coordinate', { longitude: '103.85' }],
    ['missing timezone', { timezone: undefined }],
    ['malformed timezone', { timezone: 'local' }],
    ['malformed offset', { utc_offset_seconds: 99_999 }],
    ['malformed existing units', { current_units: { time: 'iso8601', interval: 'seconds', us_aqi: 'USAQI', pm2_5: 'mg/m³', pm10: 'μg/m³', nitrogen_dioxide: 'μg/m³', ozone: 'μg/m³' } }],
  ])('classifies mixed response evidence as partial: %s', (_label, override) => {
    const { container } = renderPreview(response(override), request())
    expect(container.querySelector('[data-domain-card="open-meteo-air-quality"]')).toHaveAttribute('data-result-state', 'partial')
  })

  it('fails closed for an invalid response envelope', () => {
    const { container } = renderPreview([], request())
    const card = container.querySelector('[data-domain-card="open-meteo-air-quality"]')

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-envelope-contract', 'false')
    expect(screen.getByText('Air-quality response unavailable')).toBeInTheDocument()
  })
})
