import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { apiCatalog } from './apiCatalog'
import { buildDemoPreview, ResponseDemoPreview, selectPreviewLayout, selectWeatherPreviewVariant } from './responsePreview'

const matchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})

describe('catalog live API flow', () => {
  beforeEach(() => {
    window.location.hash = '#/catalog'
    vi.stubGlobal('matchMedia', matchMedia)
    vi.stubGlobal('scrollTo', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('navigates to Request Lab and runs the selected API with one click', async () => {
    const responseData = [
      { page: 1, pages: 1, total: 1 },
      [{ id: 'SGP', name: 'Singapore', capitalCity: 'Singapore', region: { value: 'East Asia & Pacific' } }],
    ]
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Try live API' }))

    expect(window.location.hash).toBe('#/request-lab')
    expect(await screen.findByRole('heading', { name: 'Request lab' })).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/"name": "Singapore"/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Country profile' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Country profile' })).toHaveAttribute('data-preview-layout', 'country-profile')
    expect(screen.getByRole('heading', { name: 'Singapore' })).toBeInTheDocument()
    expect(screen.getByText('East Asia & Pacific')).toBeInTheDocument()
  })
})

describe('demo preview mapping', () => {
  it('creates a useful card for primitive responses', () => {
    expect(buildDemoPreview('ready')).toEqual([
      { title: 'Response value', fields: [{ label: 'Value', value: 'ready' }] },
    ])
  })

  it('selects a purpose-built layout for each API family', () => {
    expect(selectPreviewLayout({ id: 'weather', category: 'Utility' })).toBe('weather-dashboard')
    expect(selectPreviewLayout({ id: 'countries', category: 'Data' })).toBe('country-profile')
    expect(selectPreviewLayout({ id: 'yahoo-finance-sgx-history', category: 'Finance' })).toBe('market-chart')
    expect(selectPreviewLayout({ id: 'dogs', category: 'Nature' })).toBe('media-gallery')
    expect(selectPreviewLayout({ id: 'usgs', category: 'Geo' })).toBe('location-map')
    expect(selectPreviewLayout({ id: 'holidays', category: 'Calendar' })).toBe('calendar-timeline')
    expect(selectPreviewLayout({ id: 'carbon-intensity-gb', category: 'Environment' })).toBe('result-list')
    expect(selectPreviewLayout({ id: 'nws-weather', category: 'Weather' })).toBe('result-list')
    expect(selectPreviewLayout({ id: 'github', category: 'Developer' })).toBe('result-list')
  })
})

describe('data.gov.sg adaptive weather previews', () => {
  afterEach(cleanup)

  const api = (id: string) => {
    const match = apiCatalog.find((candidate) => candidate.id === id)
    if (!match) throw new Error(`Missing API fixture: ${id}`)
    return match
  }

  it('maps four-day nested ranges and forecast records into a daily outlook', () => {
    render(<ResponseDemoPreview api={api('data-gov-4day-forecast')} data={{ items: [{
      update_timestamp: '2026-07-15T05:41:16+08:00',
      forecasts: [
        { date: '2026-07-16', forecast: 'Afternoon thundery showers', temperature: { low: 25, high: 34 }, relative_humidity: { low: 65, high: 95 }, wind: { speed: { low: 10, high: 20 }, direction: 'SSE' } },
        { date: '2026-07-17', forecast: 'Cloudy', temperature: { low: 24, high: 32 }, relative_humidity: { low: 60, high: 90 }, wind: { speed: { low: 8, high: 18 }, direction: 'S' } },
      ],
    }] }}/> )

    const preview = screen.getByRole('region', { name: '4-day outlook' })
    expect(preview).toHaveAttribute('data-preview-variant', 'four-day')
    expect(within(preview).getAllByText('Afternoon thundery showers').length).toBeGreaterThan(0)
    expect(within(preview).getAllByText('65–95%').length).toBeGreaterThan(0)
    expect(within(preview).getByText('10–20 km/h')).toBeInTheDocument()
    expect(within(preview).queryByText('Live reading')).not.toBeInTheDocument()
  })

  it('joins station readings to metadata and calculates network statistics', () => {
    render(<ResponseDemoPreview api={api('data-gov-air-temperature')} data={{
      metadata: { reading_unit: 'deg C', stations: [{ id: 'S107', name: 'East Coast Parkway', location: { latitude: 1.3133, longitude: 103.962 } }, { id: 'S108', name: 'Marina Barrage', location: { latitude: 1.28, longitude: 103.87 } }] },
      items: [{ timestamp: '2026-07-15T07:15:00+08:00', readings: [{ station_id: 'S107', value: 28.8 }, { station_id: 'S108', value: 27.2 }] }],
    }}/>)

    const preview = screen.getByRole('region', { name: 'Station readings' })
    expect(preview).toHaveAttribute('data-preview-variant', 'station-readings')
    expect(within(preview).getByText('28°C')).toBeInTheDocument()
    expect(within(preview).getByText('East Coast Parkway')).toBeInTheDocument()
    expect(within(preview).getByText('Marina Barrage')).toBeInTheDocument()
  })

  it('uses the PSI regional metric instead of the first arbitrary scalar', () => {
    render(<ResponseDemoPreview api={api('data-gov-psi')} data={{ items: [{ timestamp: '2026-07-15T07:00:00+08:00', readings: { pm10_twenty_four_hourly: { north: 27 }, psi_twenty_four_hourly: { north: 55, south: 53, east: 58, west: 59, central: 63 } } }] }}/>)

    const preview = screen.getByRole('region', { name: 'Regional air quality' })
    expect(preview).toHaveAttribute('data-preview-variant', 'regional-air-quality')
    expect(within(preview).getByText('North')).toBeInTheDocument()
    expect(within(preview).getByText('63')).toBeInTheDocument()
    expect(within(preview).getByText('Moderate')).toBeInTheDocument()
  })

  it('selects a stable weather response contract for every Singapore feed family', () => {
    expect(selectWeatherPreviewVariant({ id: 'data-gov-4day-forecast' })).toBe('four-day')
    expect(selectWeatherPreviewVariant({ id: 'data-gov-24hr-forecast' })).toBe('twenty-four-hour')
    expect(selectWeatherPreviewVariant({ id: 'data-gov-forecast-2hr' })).toBe('area-forecast')
    expect(selectWeatherPreviewVariant({ id: 'data-gov-rainfall' })).toBe('station-readings')
    expect(selectWeatherPreviewVariant({ id: 'data-gov-pm25' })).toBe('regional-air-quality')
    expect(selectWeatherPreviewVariant({ id: 'data-gov-uv-index' })).toBe('uv-index')
  })
})
