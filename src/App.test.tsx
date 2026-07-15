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

  it('registers 93 distinct React component functions with no shared identity', () => {
    const catalogIds = apiCatalog.map((api) => api.id).sort()
    const components = Object.values(apiPreviewComponents).filter((component) => component !== undefined)

    expect([...apiPreviewComponentIds].sort()).toEqual(catalogIds)
    expect(components).toHaveLength(93)
    expect(new Set(components).size).toBe(93)
    expect(new Set(components.map((component) => component.name)).size).toBe(93)
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
    expect(new Set(visualSignatures).size).toBe(93)
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

describe('new specialist API previews', () => {
  afterEach(cleanup)

  const api = (id: string) => {
    const match = apiCatalog.find((candidate) => candidate.id === id)
    if (!match) throw new Error(`Missing API fixture: ${id}`)
    return match
  }

  it('renders official Malaysia fuel levels and weekly movement', () => {
    render(<ResponseDemoPreview api={api('malaysia-fuel-price')} data={[
      { date: '2026-07-09', ron95: 3.37, ron97: 4, diesel: 3.97, ron95_budi95: 1.99, series_type: 'level' },
      { date: '2026-07-01', ron95: 3.47, ron97: 4.1, diesel: 4.07, ron95_budi95: 1.99, series_type: 'level' },
    ]}/> )
    const preview = screen.getByRole('region', { name: 'Malaysia Fuel Price' })
    expect(preview).toHaveAttribute('data-preview-layout', 'fuel-dashboard')
    expect(within(preview).getByText('RM 3.37')).toBeInTheDocument()
    expect(within(preview).getAllByText('↓ RM 0.1')).toHaveLength(3)
    expect(within(preview).getByText('BUDI95')).toBeInTheDocument()
  })

  it('maps marine hourly arrays into wave, temperature, and current readings', () => {
    render(<ResponseDemoPreview api={api('open-meteo-marine')} data={{
      latitude: 1.29, longitude: 103.79, timezone: 'Asia/Singapore', utc_offset_seconds: 28800,
      hourly_units: { wave_height: 'm', wave_period: 's', sea_surface_temperature: '°C', ocean_current_velocity: 'km/h' },
      hourly: { time: ['2026-07-15T06:00', '2026-07-15T09:00'], wave_height: [0.32, 0.32], wave_direction: [155, 155], wave_period: [2.9, 2.9], sea_surface_temperature: [29.8, 29.8], ocean_current_velocity: [1.8, 1.8], ocean_current_direction: [127, 127] },
    }}/>)
    const preview = screen.getByRole('region', { name: 'Marine Weather' })
    expect(preview).toHaveAttribute('data-preview-layout', 'marine-forecast')
    expect(within(preview).getAllByText('0.32', { exact: false }).length).toBeGreaterThan(0)
    expect(within(preview).getByText('29.8°C')).toBeInTheDocument()
    expect(within(preview).getByText('1.8 km/h')).toBeInTheDocument()
  })

  it('renders Nobel laureates and their official motivation', () => {
    render(<ResponseDemoPreview api={api('nobel-prizes')} data={{ nobelPrizes: [{ awardYear: '2024', category: { en: 'Physics' }, prizeAmount: 11000000, laureates: [{ knownName: { en: 'Geoffrey Hinton' }, motivation: { en: 'for foundational discoveries that enable machine learning' } }] }] }}/>)
    const preview = screen.getByRole('region', { name: 'Nobel Prize Explorer' })
    expect(preview).toHaveAttribute('data-preview-layout', 'awards-timeline')
    expect(within(preview).getByText('Geoffrey Hinton')).toBeInTheDocument()
    expect(preview).toHaveTextContent('foundational discoveries')
  })

  it('compares Chess.com ratings and match records by time control', () => {
    render(<ResponseDemoPreview api={api('chess-player-stats')} data={{ fide: 2814, chess_blitz: { last: { rating: 3403 }, best: { rating: 3465 }, record: { win: 35200, loss: 5479, draw: 4312 } }, chess_rapid: { last: { rating: 2839 }, best: { rating: 2927 }, record: { win: 201, loss: 67, draw: 209 } } }}/>)
    const preview = screen.getByRole('region', { name: 'Chess.com Player Ratings' })
    expect(preview).toHaveAttribute('data-preview-layout', 'chess-ratings')
    expect(within(preview).getAllByText('3,403').length).toBeGreaterThan(0)
    expect(within(preview).getByText('FIDE')).toBeInTheDocument()
    expect(within(preview).getByText('Best 3,465')).toBeInTheDocument()
  })

  it('turns Crossref work metadata into DOI research cards', () => {
    render(<ResponseDemoPreview api={api('crossref-works')} data={{ message: { 'total-results': 562402, items: [{ DOI: '10.1007/demo', title: ['Enterprise Agentic AI'], author: [{ given: 'Sumit', family: 'Ranjan' }], published: { 'date-parts': [[2025]] }, publisher: 'Apress', 'is-referenced-by-count': 12, type: 'book-chapter' }] } }}/>)
    const preview = screen.getByRole('region', { name: 'Crossref Works Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'scholarly-search')
    expect(within(preview).getByText('Enterprise Agentic AI')).toBeInTheDocument()
    expect(within(preview).getByText('Sumit Ranjan · Apress')).toBeInTheDocument()
    expect(within(preview).getByText('10.1007/demo')).toBeInTheDocument()
  })
})

describe('next keyless API previews', () => {
  afterEach(cleanup)

  const api = (id: string) => {
    const match = apiCatalog.find((candidate) => candidate.id === id)
    if (!match) throw new Error(`Missing API fixture: ${id}`)
    return match
  }

  it('adapts space weather, flood, climate, and crypto market responses', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('noaa-space-weather')} data={{
      0: { DateStamp: '2026-07-15', TimeStamp: '06:37:00', R: { Scale: '0', Text: 'none' }, S: { Scale: '0', Text: 'none' }, G: { Scale: '1', Text: 'minor' } },
      1: { DateStamp: '2026-07-16', G: { Scale: '1', Text: 'minor' } },
    }}/>)
    expect(screen.getByRole('region', { name: 'NOAA Space Weather' })).toHaveTextContent('Geomagnetic storm')
    expect(screen.getByRole('region', { name: 'NOAA Space Weather' })).toHaveTextContent('Level 1')

    rerender(<ResponseDemoPreview api={api('open-meteo-flood')} data={{ latitude: 1.37, longitude: 103.82, daily_units: { river_discharge: 'm³/s' }, daily: { time: ['2026-07-15', '2026-07-16'], river_discharge: [1, 1.2], river_discharge_mean: [0.99, 1.3], river_discharge_max: [1.86, 2.17] } }}/>)
    expect(screen.getByRole('region', { name: 'Global Flood Forecast' })).toHaveTextContent('Forecast peak')
    expect(screen.getByRole('region', { name: 'Global Flood Forecast' })).toHaveTextContent('2.17 m³/s')

    rerender(<ResponseDemoPreview api={api('open-meteo-history')} data={{ timezone: 'Asia/Singapore', daily_units: { temperature_2m_max: '°C', precipitation_sum: 'mm' }, daily: { time: ['2025-01-01', '2025-01-02'], temperature_2m_max: [31, 32], temperature_2m_min: [24, 25], precipitation_sum: [1.2, 4.8] } }}/>)
    expect(screen.getByRole('region', { name: 'Historical Weather' })).toHaveTextContent('Average high')
    expect(screen.getByRole('region', { name: 'Historical Weather' })).toHaveTextContent('Total rain')

    rerender(<ResponseDemoPreview api={api('kraken-public-ticker')} data={{ result: { XXBTZUSD: { a: ['65010'], b: ['64990'], c: ['65000'], v: ['100', '2500'], l: ['63000', '62000'], h: ['65500', '66000'], o: '64000' } } }}/>)
    expect(screen.getByRole('region', { name: 'Kraken Market Ticker' })).toHaveTextContent('USD 65,000')
    expect(screen.getByRole('region', { name: 'Kraken Market Ticker' })).toHaveTextContent('Bid / ask')
  })

  it('adapts security, regulation, Wikipedia search, and readership responses', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('osv-vulnerability')} data={{ id: 'GHSA-demo-1234', summary: 'Demo dependency vulnerability', published: '2026-07-01', modified: '2026-07-12', aliases: ['CVE-2026-1000'], affected: [{ package: { ecosystem: 'npm', name: 'demo-package' } }] }}/>)
    expect(screen.getByRole('region', { name: 'OSV Vulnerability' })).toHaveTextContent('GHSA-demo-1234')
    expect(screen.getByRole('region', { name: 'OSV Vulnerability' })).toHaveTextContent('demo-package')

    rerender(<ResponseDemoPreview api={api('federal-register-documents')} data={{ count: 1, results: [{ document_number: '2026-10001', publication_date: '2026-07-15', type: 'Proposed Rule', title: 'Artificial Intelligence Safety Framework', abstract: 'A proposed federal framework.', agencies: [{ name: 'Science Office' }] }] }}/>)
    expect(screen.getByRole('region', { name: 'Federal Register Documents' })).toHaveTextContent('Artificial Intelligence Safety Framework')
    expect(screen.getByRole('region', { name: 'Federal Register Documents' })).toHaveTextContent('Science Office')

    rerender(<ResponseDemoPreview api={api('wikipedia-search')} data={{ query: { pages: { 1: { pageid: 1, title: 'Singapore', extract: 'A city-state in Southeast Asia.', thumbnail: { source: 'https://upload.wikimedia.org/demo.jpg' } } } } }}/>)
    expect(screen.getByRole('region', { name: 'Wikipedia Search' })).toHaveTextContent('Singapore')
    expect(screen.getByRole('region', { name: 'Wikipedia Search' })).toHaveTextContent('A city-state in Southeast Asia.')

    rerender(<ResponseDemoPreview api={api('wikimedia-pageviews')} data={{ items: [{ article: 'Singapore', timestamp: '2026070100', views: 12000 }, { article: 'Singapore', timestamp: '2026070200', views: 15000 }] }}/>)
    expect(screen.getByRole('region', { name: 'Wikimedia Pageviews' })).toHaveTextContent('Total views')
    expect(screen.getByRole('region', { name: 'Wikimedia Pageviews' })).toHaveTextContent('27K')
  })

  it('adapts GitLab, UK crime, brewery, and character directory responses', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('gitlab-public-projects')} data={[{ path_with_namespace: 'demo/agent-console', description: 'An agent-ready developer console.', star_count: 420, forks_count: 30, open_issues_count: 4, visibility: 'public', topics: ['agents', 'vite'], last_activity_at: '2026-07-14T10:00:00Z' }]}/>)
    expect(screen.getByRole('region', { name: 'GitLab Public Projects' })).toHaveTextContent('demo/agent-console')
    expect(screen.getByRole('region', { name: 'GitLab Public Projects' })).toHaveTextContent('420 stars')

    rerender(<ResponseDemoPreview api={api('uk-police-street-crime')} data={[{ category: 'burglary', month: '2026-05', location: { latitude: '51.5074', longitude: '-0.1278', street: { name: 'On or near Whitehall' } } }]}/>)
    expect(screen.getByRole('region', { name: 'UK Street Crime' })).toHaveTextContent('On or near Whitehall')
    expect(screen.getByRole('region', { name: 'UK Street Crime' })).toHaveTextContent('Burglary')

    rerender(<ResponseDemoPreview api={api('open-brewery-directory')} data={[{ id: 'brew-1', name: 'Demo Brewing Co', brewery_type: 'micro', city: 'Austin', country: 'United States', latitude: '30.2672', longitude: '-97.7431' }]}/>)
    expect(screen.getByRole('region', { name: 'Open Brewery Directory' })).toHaveTextContent('Demo Brewing Co')
    expect(screen.getByRole('region', { name: 'Open Brewery Directory' })).toHaveTextContent('Micro · Austin')

    rerender(<ResponseDemoPreview api={api('rick-morty-characters')} data={{ results: [{ id: 1, name: 'Rick Sanchez', status: 'Alive', species: 'Human', image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg', location: { name: 'Citadel of Ricks' } }] }}/>)
    expect(screen.getByRole('region', { name: 'Rick and Morty Characters' })).toHaveTextContent('Rick Sanchez')
    expect(screen.getByRole('region', { name: 'Rick and Morty Characters' })).toHaveTextContent('Alive · Human · Citadel of Ricks')
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

describe('new verified keyless API previews', () => {
  afterEach(cleanup)

  const api = (id: string) => {
    const match = apiCatalog.find((candidate) => candidate.id === id)
    if (!match) throw new Error(`Missing API fixture: ${id}`)
    return match
  }

  it('adapts Formula 1, Belgian rail, space news, and launch schedule responses', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('openf1-historical')} data={[{ session_key: 999, meeting_key: 888, meeting_name: 'Singapore Grand Prix', country_name: 'Singapore', location: 'Marina Bay', circuit_short_name: 'Marina Bay', session_name: 'Race', session_type: 'Race', date_start: '2025-10-05T12:00:00Z' }]}/> )
    expect(screen.getByRole('region', { name: 'OpenF1 Race Sessions' })).toHaveTextContent('Singapore Grand Prix')
    expect(screen.getByRole('region', { name: 'OpenF1 Race Sessions' })).toHaveTextContent('Marina Bay')

    rerender(<ResponseDemoPreview api={api('irail-liveboard')} data={{ station: 'Brussels-South/Brussels-Midi', stationinfo: { name: 'Brussels-South/Brussels-Midi' }, departures: { departure: [{ time: '1784102400', delay: '300', canceled: '0', vehicle: 'BE.NMBS.IC123', platform: '4', station: 'Antwerpen-Centraal' }] } }}/> )
    expect(screen.getByRole('region', { name: 'Belgian Rail Liveboard' })).toHaveTextContent('Antwerpen-Centraal')
    expect(screen.getByRole('region', { name: 'Belgian Rail Liveboard' })).toHaveTextContent('Delayed 5 min')

    rerender(<ResponseDemoPreview api={api('spaceflight-news')} data={{ results: [{ id: 1, title: 'Moon mission prepares for launch', news_site: 'Space News', image_url: 'https://example.com/moon.jpg', published_at: '2026-07-15T06:00:00Z' }] }}/> )
    expect(screen.getByRole('region', { name: 'Spaceflight News' })).toHaveTextContent('Moon mission prepares for launch')

    rerender(<ResponseDemoPreview api={api('launch-library-upcoming')} data={{ results: [{ id: 'launch-1', name: 'DemoSat Mission', net: '2026-08-01T12:30:00Z', status: { name: 'Go for Launch' }, launch_service_provider: { name: 'SpaceX' }, pad: { name: 'Pad 39A', location: { name: 'Kennedy Space Center' } }, mission: { name: 'DemoSat' } }] }}/> )
    const launch = screen.getByRole('region', { name: 'Upcoming Space Launches' })
    expect(launch).toHaveTextContent('DemoSat Mission')
    expect(launch).toHaveTextContent('Kennedy Space Center')
  })

  it('adapts Wiktionary, anime quotes, safe jokes, and recipe responses', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('wiktionary-entry')} data={{ en: [{ language: 'English', partOfSpeech: 'Interjection', definitions: [{ definition: '<i>A greeting</i> used when meeting someone.', examples: ['Hello there.'], synonyms: ['hi'] }] }] }}/> )
    const dictionary = screen.getByRole('region', { name: 'Wiktionary Definitions' })
    expect(dictionary).toHaveTextContent('A greeting used when meeting someone.')
    expect(dictionary).toHaveTextContent('Hello there.')

    rerender(<ResponseDemoPreview api={api('animechan-random-quote')} data={{ status: 'success', data: { content: 'To become Hokage is my dream!', anime: { id: 266, name: 'Naruto', altName: 'ナルト' }, character: { id: 123, name: 'Naruto Uzumaki' } } }}/> )
    const animeQuote = screen.getByRole('region', { name: 'Anime Quote Generator' })
    expect(animeQuote).toHaveTextContent('To become Hokage is my dream!')
    expect(animeQuote).toHaveTextContent('Naruto Uzumaki')

    rerender(<ResponseDemoPreview api={api('jokeapi-safe')} data={{ error: false, category: 'Programming', type: 'twopart', setup: 'Why did the developer cross the road?', delivery: 'To reach the other site.', safe: true }}/> )
    const joke = screen.getByRole('region', { name: 'Safe Joke Generator' })
    expect(joke).toHaveTextContent('Why did the developer cross the road?')
    expect(joke).toHaveTextContent('To reach the other site.')

    rerender(<ResponseDemoPreview api={api('dummyjson-recipes')} data={{ recipes: [{ id: 1, name: 'Pasta Primavera', image: 'https://example.com/pasta.jpg', cuisine: 'Italian', rating: 4.8, difficulty: 'Easy' }] }}/> )
    expect(screen.getByRole('region', { name: 'Recipe Explorer' })).toHaveTextContent('Pasta Primavera')
    expect(screen.getByRole('region', { name: 'Recipe Explorer' })).toHaveTextContent('Italian · ★ 4.8 · Easy')
  })

  it('adapts Brazil postcode, poetry, CoinGecko, and Star Wars responses', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('brasilapi-postcode')} data={{ cep: '01310930', state: 'SP', city: 'São Paulo', neighborhood: 'Bela Vista', street: 'Avenida Paulista', timezoneName: 'America/Sao_Paulo', location: { type: 'Point', coordinates: { longitude: '-46.6558', latitude: '-23.5614' } } }}/> )
    const postcode = screen.getByRole('region', { name: 'Brazil Postcode Explorer' })
    expect(postcode).toHaveTextContent('Avenida Paulista')
    expect(postcode).toHaveTextContent('Bela Vista')
    expect(postcode).toHaveTextContent('São Paulo · SP')

    rerender(<ResponseDemoPreview api={api('poetrydb-poems')} data={[{ title: 'Hope is the thing with feathers', author: 'Emily Dickinson', lines: ['Hope is the thing with feathers', 'That perches in the soul'], linecount: '12' }]}/> )
    const poetry = screen.getByRole('region', { name: 'PoetryDB Reader' })
    expect(poetry).toHaveTextContent('Hope is the thing with feathers')
    expect(poetry).toHaveTextContent('12 lines')

    rerender(<ResponseDemoPreview api={api('coingecko-keyless-market')} data={{ bitcoin: { usd: 65000, usd_market_cap: 1280000000000, usd_24h_vol: 35000000000, usd_24h_change: 2.5, last_updated_at: 1784102400 } }}/> )
    const market = screen.getByRole('region', { name: 'CoinGecko Keyless Market' })
    expect(market).toHaveTextContent('Bitcoin · Keyless public market')
    expect(market).toHaveTextContent('+2.5%')

    rerender(<ResponseDemoPreview api={api('swapi-people')} data={{ count: 1, results: [{ name: 'Luke Skywalker', birth_year: '19BBY', gender: 'male', height: '172', mass: '77', homeworld: 'https://swapi.dev/api/planets/1/', films: ['1', '2'], species: [], eye_color: 'blue' }] }}/> )
    const starWars = screen.getByRole('region', { name: 'Star Wars People' })
    expect(starWars).toHaveTextContent('Luke Skywalker')
    expect(starWars).toHaveTextContent('172 cm')
    expect(starWars).toHaveTextContent('2')
  })
})
