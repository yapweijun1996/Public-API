import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { apiCatalog } from './apiCatalog'
import { apiPreviewComponentIds, apiPreviewComponents, buildDemoPreview, ResponseDemoPreview, selectPreviewLayout, selectWeatherPreviewVariant } from './responsePreview'

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
    expect(await screen.findByRole('heading', { name: 'Country Explorer' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Country Explorer' })).toHaveAttribute('data-preview-layout', 'country-profile')
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
    expect(selectPreviewLayout({ id: 'sunrise-sunset', category: 'Calendar' })).toBe('solar-cycle')
    expect(selectPreviewLayout({ id: 'nasa-eonet-events', category: 'Nature' })).toBe('natural-events')
    expect(selectPreviewLayout({ id: 'mbta-transit-routes', category: 'Utility' })).toBe('transit-board')
    expect(selectPreviewLayout({ id: 'open-trivia', category: 'Games' })).toBe('trivia-game')
    expect(selectPreviewLayout({ id: 'geocoding-search', category: 'Geo' })).toBe('location-map')
    expect(selectPreviewLayout({ id: 'carbon-intensity-gb', category: 'Environment' })).toBe('data-table')
    expect(selectPreviewLayout({ id: 'nws-weather', category: 'Weather' })).toBe('data-table')
    expect(selectPreviewLayout({ id: 'github', category: 'Developer' })).toBe('developer-feed')
    expect(selectPreviewLayout({ id: 'nvd-cves', category: 'Developer' })).toBe('security-center')
    expect(selectPreviewLayout({ id: 'europe-pmc-search', category: 'Research' })).toBe('research-library')
    expect(selectPreviewLayout({ id: 'free-dictionary', category: 'Language' })).toBe('dictionary-entry')
  })

  it('registers 64 distinct React component functions with no shared identity', () => {
    const catalogIds = apiCatalog.map((api) => api.id).sort()
    const components = Object.values(apiPreviewComponents).filter((component) => component !== undefined)

    expect([...apiPreviewComponentIds].sort()).toEqual(catalogIds)
    expect(components).toHaveLength(64)
    expect(new Set(components).size).toBe(64)
    expect(new Set(components.map((component) => component.name)).size).toBe(64)
  })

  it('mounts an API-owned visual component for every catalog response', () => {
    const visualSignatures: string[] = []
    for (const candidate of apiCatalog) {
      const { container, unmount } = render(<ResponseDemoPreview api={candidate} data={{}}/>)
      expect(container.querySelector('[data-webmcp-surface="api-demo-preview"]')).toHaveAttribute('data-preview-component', candidate.id)
      const component = container.querySelector(`[data-api-preview-component="${candidate.id}"]`)
      expect(component).toBeInTheDocument()
      visualSignatures.push(component?.getAttribute('data-visual-signature') ?? '')
      expect(container.querySelector('[data-preview-component="generic-fallback"]')).not.toBeInTheDocument()
      unmount()
    }
    expect(new Set(visualSignatures).size).toBe(64)
    expect(visualSignatures.every(Boolean)).toBe(true)
  })
})

describe('new interactive API previews', () => {
  afterEach(cleanup)

  const api = (id: string) => {
    const match = apiCatalog.find((candidate) => candidate.id === id)
    if (!match) throw new Error(`Missing API fixture: ${id}`)
    return match
  }

  it('renders current global air-quality measurements', () => {
    render(<ResponseDemoPreview api={api('open-meteo-air-quality')} data={{ timezone: 'Asia/Singapore', current_units: { pm2_5: 'μg/m³' }, current: { time: '2026-07-15T07:00', us_aqi: 66, pm2_5: 19.6, pm10: 26.5, nitrogen_dioxide: 12.6, ozone: 56 } }}/> )
    const preview = screen.getByRole('region', { name: 'Global Air Quality' })
    expect(preview).toHaveAttribute('data-preview-variant', 'air-quality-forecast')
    expect(within(preview).getByText('U.S. AQI · Moderate')).toBeInTheDocument()
    expect(within(preview).getByText('19.6')).toBeInTheDocument()
  })

  it('renders a solar timeline from sunrise-sunset v2', () => {
    render(<ResponseDemoPreview api={api('sunrise-sunset')} data={{ date: '2026-07-15', tzid: 'Asia/Singapore', lat: 1.3521, lng: 103.8198, sunrise: '2026-07-15T07:03:51+08:00', sunset: '2026-07-15T19:17:33+08:00', solar_noon: '2026-07-15T13:10:42+08:00', first_light: '2026-07-15T05:50:49+08:00', last_light: '2026-07-15T20:30:35+08:00', day_length: 44022, moon_phase: 'New Moon' }}/> )
    const preview = screen.getByRole('region', { name: 'Sunrise & Sunset' })
    expect(within(preview).getByText('12h 14m of daylight')).toBeInTheDocument()
    expect(within(preview).getByText('New Moon', { exact: false })).toBeInTheDocument()
  })

  it('renders NASA events, MBTA routes, and decoded trivia content', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('nasa-eonet-events')} data={{ events: [{ id: 'E1', title: 'Pacific Wildfire', closed: null, categories: [{ title: 'Wildfires' }], geometry: [{ date: '2026-07-13T11:54:00Z', coordinates: [-94.39, 46.24], magnitudeValue: 503, magnitudeUnit: 'acres' }] }] }}/> )
    expect(screen.getByRole('region', { name: 'NASA Natural Events' })).toHaveTextContent('Pacific Wildfire')

    rerender(<ResponseDemoPreview api={api('mbta-transit-routes')} data={{ data: [{ id: 'Red', attributes: { color: 'DA291C', description: 'Rapid Transit', long_name: 'Red Line', direction_destinations: ['Ashmont/Braintree', 'Alewife'] } }] }}/> )
    expect(screen.getByRole('region', { name: 'MBTA Transit Routes' })).toHaveTextContent('Ashmont/Braintree ↔ Alewife')

    rerender(<ResponseDemoPreview api={api('open-trivia')} data={{ response_code: 0, results: [{ category: 'General Knowledge', difficulty: 'medium', question: 'When did Halley&#039;s Comet appear?', correct_answer: '1986', incorrect_answers: ['2001', '1942', '1909'] }] }}/> )
    const trivia = screen.getByRole('region', { name: 'Trivia Challenge' })
    expect(trivia).toHaveTextContent("When did Halley's Comet appear?")
    expect(within(trivia).getByText('1986')).toBeInTheDocument()
  })
})

describe('catalog-wide semantic previews', () => {
  afterEach(cleanup)

  const api = (id: string) => {
    const match = apiCatalog.find((candidate) => candidate.id === id)
    if (!match) throw new Error(`Missing API fixture: ${id}`)
    return match
  }

  it('turns nested dictionary meanings into definitions, examples, and synonyms', () => {
    render(<ResponseDemoPreview api={api('free-dictionary')} data={[{ word: 'hello', phonetic: '/həˈləʊ/', meanings: [{ partOfSpeech: 'noun', synonyms: ['greeting', 'salutation'], definitions: [{ definition: 'An expression of greeting.', example: 'Hello, how are you?' }] }] }]}/> )
    const preview = screen.getByRole('region', { name: 'Free Dictionary' })
    expect(preview).toHaveAttribute('data-preview-layout', 'dictionary-entry')
    expect(within(preview).getByText('An expression of greeting.')).toBeInTheDocument()
    expect(within(preview).getByText('greeting')).toBeInTheDocument()
    expect(within(preview).queryByText('3 items')).not.toBeInTheDocument()
  })

  it('maps developer, security, research, and structured data families to semantic cards', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('github')} data={[{ full_name: 'octocat/Hello-World', language: 'JavaScript', description: 'Example repository', stargazers_count: 42, forks_count: 8, open_issues_count: 2, topics: ['demo'] }]}/> )
    expect(screen.getByRole('region', { name: 'GitHub Public Repos' })).toHaveTextContent('octocat/Hello-World')

    rerender(<ResponseDemoPreview api={api('nvd-cves')} data={{ vulnerabilities: [{ cve: { id: 'CVE-2026-1234', published: '2026-07-01', lastModified: '2026-07-10', descriptions: [{ lang: 'en', value: 'A representative security issue.' }], metrics: { cvssMetricV31: [{ cvssData: { baseScore: 8.1, baseSeverity: 'HIGH' } }] } } }] }}/> )
    expect(screen.getByRole('region', { name: 'NVD CVE Search' })).toHaveTextContent('CVE-2026-1234')

    rerender(<ResponseDemoPreview api={api('europe-pmc-search')} data={{ resultList: { result: [{ title: 'Agentic systems in practice', authorString: 'A. Developer', pubYear: '2026', journalTitle: 'Demo Journal', citedByCount: 12, isOpenAccess: 'Y', doi: '10.1/demo' }] } }}/> )
    expect(screen.getByRole('region', { name: 'Europe PMC Search' })).toHaveTextContent('Agentic systems in practice')

    rerender(<ResponseDemoPreview api={api('ipify-public-ip')} data={{ ip: '203.0.113.10' }}/> )
    expect(screen.getByRole('region', { name: 'ipify Public IP' })).toHaveTextContent('203.0.113.10')
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

    const preview = screen.getByRole('region', { name: 'data.gov.sg 4-Day Forecast' })
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

    const preview = screen.getByRole('region', { name: 'data.gov.sg Air Temperature' })
    expect(preview).toHaveAttribute('data-preview-variant', 'station-readings')
    expect(within(preview).getByText('28°C')).toBeInTheDocument()
    expect(within(preview).getByText('East Coast Parkway')).toBeInTheDocument()
    expect(within(preview).getByText('Marina Barrage')).toBeInTheDocument()
  })

  it('uses the PSI regional metric instead of the first arbitrary scalar', () => {
    render(<ResponseDemoPreview api={api('data-gov-psi')} data={{ items: [{ timestamp: '2026-07-15T07:00:00+08:00', readings: { pm10_twenty_four_hourly: { north: 27 }, psi_twenty_four_hourly: { north: 55, south: 53, east: 58, west: 59, central: 63 } } }] }}/>)

    const preview = screen.getByRole('region', { name: 'data.gov.sg PSI' })
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
    expect(selectWeatherPreviewVariant({ id: 'open-meteo-air-quality' })).toBe('air-quality-forecast')
  })
})
