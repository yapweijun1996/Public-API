import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'open-meteo-marine')
if (!api) throw new Error('Missing open-meteo-marine fixture')

const requestUrl = 'https://marine-api.open-meteo.com/v1/marine?latitude=1.3521&longitude=103.8198&hourly=wave_height%2Cwave_direction%2Cwave_period%2Csea_surface_temperature%2Cocean_current_velocity%2Cocean_current_direction&timezone=auto&forecast_days=3'
const executedGet = { url: requestUrl, method: 'GET' } as const
const hourlyTimes = Array.from({ length: 72 }, (_, index) => new Date(Date.UTC(2026, 8, 15, index)).toISOString().slice(0, 16))
const hourlyValues = (value: unknown) => Array.from({ length: 72 }, () => value)

const marineResponse = (hourlyOverrides: Record<string, unknown> = {}) => ({
  latitude: 1.375,
  longitude: 103.875,
  generationtime_ms: 0.12,
  utc_offset_seconds: 28800,
  timezone: 'Asia/Singapore',
  timezone_abbreviation: 'GMT+8',
  hourly_units: {
    time: 'iso8601',
    wave_height: 'm',
    wave_direction: '°',
    wave_period: 's',
    sea_surface_temperature: '°C',
    ocean_current_velocity: 'km/h',
    ocean_current_direction: '°',
  },
  hourly: {
    time: hourlyTimes,
    wave_height: hourlyValues(0.82),
    wave_direction: hourlyValues(95),
    wave_period: hourlyValues(7.4),
    sea_surface_temperature: hourlyValues(29.1),
    ocean_current_velocity: hourlyValues(0.4),
    ocean_current_direction: hourlyValues(130),
    ...hourlyOverrides,
  },
})

const preview = () => screen.getByRole('region', { name: 'Marine Weather' })
const card = () => preview().querySelector('[data-domain-card="marine-forecast"]')

describe('Open-Meteo Marine semantic preview', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('binds a documented hourly response to the exact executed marine request', () => {
    expect(api.buildUrl({})).toBe(requestUrl)
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={marineResponse()}/>)

    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-request-bound', 'true')
    expect(card()).toHaveAttribute('data-request-latitude', '1.3521')
    expect(card()).toHaveAttribute('data-request-longitude', '103.8198')
    expect(card()).toHaveAttribute('data-request-forecast-days', '3')
    expect(card()).toHaveAttribute('data-provider-latitude', '1.375')
    expect(card()).toHaveAttribute('data-provider-longitude', '103.875')
    expect(card()).toHaveAttribute('data-timezone', 'Asia/Singapore')
    expect(card()).toHaveAttribute('data-utc-offset-seconds', '28800')
    expect(card()).toHaveAttribute('data-provider-hour-count', '72')
    expect(card()).toHaveAttribute('data-valid-hour-count', '72')
    expect(card()).toHaveAttribute('data-invalid-hour-count', '0')
    expect(card()).toHaveAttribute('data-missing-measurement-count', '0')
    expect(card()).toHaveAttribute('data-invalid-measurement-count', '0')
    expect(card()).toHaveAttribute('data-array-length-contract', 'true')
    expect(card()).toHaveAttribute('data-unit-contract', 'true')
    expect(card()).toHaveAttribute('data-time-contract', 'true')
    expect(card()).toHaveAttribute('data-cadence-contract', 'true')
    expect(card()).toHaveAttribute('data-horizon-contract', 'true')
    expect(card()).toHaveAttribute('data-wave-direction-semantics', 'from')
    expect(card()).toHaveAttribute('data-current-direction-semantics', 'toward')
    expect(preview()).toHaveTextContent('95° from')
    expect(preview()).toHaveTextContent('130° toward')
  })

  it('keeps a structurally valid marine payload partial when execution evidence is missing', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={marineResponse()}/>)

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(preview()).toHaveTextContent('exact executed request is unavailable')
  })

  it('fails closed when the displayed marine URL disagrees with the actual transport', () => {
    const invalidRequests = [
      { url: requestUrl, method: 'POST' },
      { url: requestUrl, method: 'GET', body: { unexpected: true } },
      { url: `${requestUrl}&extra=1`, method: 'GET' },
    ]
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={invalidRequests[0]} data={marineResponse()}/>)

    for (const executedRequest of invalidRequests) {
      rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={marineResponse()}/>)
      expect(card()).toHaveAttribute('data-result-state', 'invalid')
      expect(card()).toHaveAttribute('data-request-bound', 'false')
      expect(preview()).toHaveTextContent('executed request')
      expect(preview()).not.toHaveTextContent('0.82m')
    }
  })

  it('withholds a missing provider measurement instead of manufacturing a zero', () => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-09-15T06:00:00Z')
    const waveHeights = hourlyValues(0.82)
    waveHeights[14] = null
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={marineResponse({ wave_height: waveHeights })}/>)

    expect(preview()).not.toHaveTextContent(/(?:^|\D)0(?:\.0+)?\s*m(?:\D|$)/)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-missing-measurement-count', '1')
    expect(card()).toHaveAttribute('data-invalid-measurement-count', '0')
    expect(card()).toHaveAttribute('data-valid-hour-count', '71')
    expect(card()).toHaveAttribute('data-invalid-hour-count', '1')
  })

  it('withholds a numeric-string measurement instead of coercing it into a trusted float', () => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-09-15T06:00:00Z')
    const waveHeights = hourlyValues(0.82)
    waveHeights[14] = '9.99'
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={marineResponse({ wave_height: waveHeights })}/>)

    expect(preview()).not.toHaveTextContent('9.99m')
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-invalid-measurement-count', '1')
    expect(card()).toHaveAttribute('data-missing-measurement-count', '0')
    expect(card()).toHaveAttribute('data-valid-hour-count', '71')
    expect(card()).toHaveAttribute('data-invalid-hour-count', '1')
  })

  it('rejects a request URL that expands the exact catalog query surface', () => {
    render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&model=best_match`} executedRequest={{ url: `${requestUrl}&model=best_match`, method: 'GET' }} data={marineResponse()}/>)

    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(preview()).toHaveTextContent('exact supported bodyless GET Open-Meteo marine request')
    expect(preview()).not.toHaveTextContent('0.82m')
  })

  it('does not mark a one-hour payload ready for an executed three-day forecast', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={marineResponse({
      time: hourlyTimes.slice(0, 1),
      wave_height: [0.82],
      wave_direction: [95],
      wave_period: [7.4],
      sea_surface_temperature: [29.1],
      ocean_current_velocity: [0.4],
      ocean_current_direction: [130],
    })}/>)

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'true')
    expect(card()).toHaveAttribute('data-provider-hour-count', '1')
    expect(card()).toHaveAttribute('data-array-length-contract', 'true')
    expect(card()).toHaveAttribute('data-time-contract', 'true')
    expect(card()).toHaveAttribute('data-cadence-contract', 'true')
    expect(card()).toHaveAttribute('data-horizon-contract', 'false')
  })
})
