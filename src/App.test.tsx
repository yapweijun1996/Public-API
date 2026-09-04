import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { REQUEST_TIMEOUT_MS } from './App'
import { apiCatalog } from './apiCatalog'
import { apiPreviewComponentIds, apiPreviewComponents, apiSsotCardIds, apiSsotCardRegistry, buildDemoPreview, ResponseDemoPreview, selectPreviewLayout, selectWeatherPreviewVariant } from './responsePreview'

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
    vi.useRealTimers()
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

    expect(window.location.hash).toBe('#/request-lab?api=countries')
    expect(await screen.findByRole('heading', { name: 'Request lab' })).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/"name": "Singapore"/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Country Explorer' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Country Explorer' })).toHaveAttribute('data-preview-layout', 'country-profile')
    const ssotPreview = screen.getByRole('region', { name: 'Country Explorer' })
    const labGrid = document.querySelector('.lab-grid')
    expect(labGrid).not.toBeNull()
    expect(Boolean(ssotPreview.compareDocumentPosition(labGrid as Node) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(screen.getByRole('tab', { name: 'Raw JSON' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy JSON' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Singapore' })).toBeInTheDocument()
    expect(screen.getByText('East Asia & Pacific')).toBeInTheDocument()
  }, 8000)
  it('opens a deterministic Request Lab deep link with the requested API selected', () => {
    window.location.hash = '#/request-lab?api=open5e-monster-search'
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Request lab' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Configure Open5e Monster Search' })).toHaveAttribute('data-api-id', 'open5e-monster-search')
    expect(screen.getByRole('textbox', { name: 'Monster search' })).toHaveValue('dragon')
    expect(window.location.hash).toBe('#/request-lab?api=open5e-monster-search')
  })

  it('canonicalizes an invalid Request Lab API id to the current valid selection', async () => {
    window.location.hash = '#/request-lab?api=does-not-exist'
    render(<App />)

    await waitFor(() => expect(window.location.hash).toBe('#/request-lab?api=countries'))
    expect(screen.getByRole('form', { name: 'Configure Country Explorer' })).toHaveAttribute('data-api-id', 'countries')
  })

  it('does not expose no-op catalog controls as actionable buttons', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Page 1, current page' })).not.toBeInTheDocument()
    expect(document.querySelector('.table-footer [aria-current="page"]')).toHaveTextContent('1')
  })

  it('exposes deterministic request state and error semantics for browser agents', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Too many requests' }), {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Try live API' }))

    const alert = await screen.findByRole('alert', { name: 'Request failed: rate-limit' })
    expect(alert).toHaveAttribute('data-error-type', 'rate-limit')
    expect(alert).toHaveAttribute('data-http-status', '429')
    expect(alert).toHaveTextContent('Error type: rate-limit; HTTP 429')
    expect(screen.getByRole('region', { name: 'Country Explorer request output' })).toHaveAttribute('data-request-state', 'error')
    expect(screen.getByRole('region', { name: 'Country Explorer request output' })).toHaveAttribute('data-error-type', 'rate-limit')
    expect(screen.getByRole('form', { name: 'Configure Country Explorer' })).toHaveAttribute('data-api-id', 'countries')
  })

  it('fails a stalled browser request with a deterministic timeout error', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (!signal) return reject(new Error('Missing AbortSignal'))
      signal.addEventListener('abort', () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Try live API' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1)
    })

    const alert = screen.getByRole('alert', { name: 'Request failed: timeout' })
    expect(alert).toHaveAttribute('data-error-type', 'timeout')
    expect(alert).toHaveTextContent('The request timed out after 20 seconds.')
    expect(screen.getByRole('region', { name: 'Country Explorer request output' })).toHaveAttribute('data-request-state', 'error')
  })

  it('cancels an in-flight request when parameters change so stale data cannot overwrite the next run', async () => {
    let firstSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      if (fetchMock.mock.calls.length === 1) {
        firstSignal = init?.signal ?? undefined
        return new Promise<Response>((_resolve, reject) => {
          firstSignal?.addEventListener('abort', () => reject(firstSignal?.reason ?? new DOMException('Aborted', 'AbortError')), { once: true })
        })
      }
      return Promise.resolve(new Response(JSON.stringify([
        { page: 1, pages: 1, total: 1 },
        [{ id: 'MYS', name: 'Malaysia', capitalCity: 'Kuala Lumpur', region: { value: 'East Asia & Pacific' } }],
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Try live API' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const countryCode = await screen.findByRole('textbox', { name: 'Country code' })
    fireEvent.change(countryCode, { target: { value: 'MY' } })
    expect(firstSignal?.aborted).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Try live API' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/\"name\": \"Malaysia\"/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Malaysia' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('implements the Request Lab output as a keyboard-operable ARIA tab set', () => {
    window.location.hash = '#/request-lab'
    render(<App />)
    const rawTab = screen.getByRole('tab', { name: 'Raw JSON' })
    const codeTab = screen.getByRole('tab', { name: 'Fetch code' })
    const panel = screen.getByRole('tabpanel')

    expect(rawTab).toHaveAttribute('aria-controls', 'request-output-panel')
    expect(rawTab).toHaveAttribute('aria-selected', 'true')
    expect(rawTab).toHaveAttribute('tabindex', '0')
    expect(codeTab).toHaveAttribute('tabindex', '-1')
    expect(panel).toHaveAttribute('aria-labelledby', 'request-output-response-tab')

    rawTab.focus()
    fireEvent.keyDown(rawTab, { key: 'ArrowRight' })
    expect(codeTab).toHaveFocus()
    expect(codeTab).toHaveAttribute('aria-selected', 'true')
    expect(codeTab).toHaveAttribute('tabindex', '0')
    expect(rawTab).toHaveAttribute('tabindex', '-1')
    expect(panel).toHaveAttribute('aria-labelledby', 'request-output-code-tab')

    fireEvent.keyDown(codeTab, { key: 'Home' })
    expect(rawTab).toHaveFocus()
    expect(rawTab).toHaveAttribute('aria-selected', 'true')
  })

  it('associates Request Lab field help with native controls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: { common: 'Singapore' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Try live API' }))
    const control = await screen.findByRole('textbox', { name: 'Country code' })
    expect(control).toHaveAttribute('aria-describedby', 'parameter-code-help')
    expect(document.getElementById('parameter-code-help')).toHaveTextContent('Use an ISO 2- or 3-letter country code.')
  })

})


describe('WebMCP discovery contract', () => {
  beforeEach(() => {
    window.location.hash = '#/catalog'
    vi.stubGlobal('matchMedia', matchMedia)
    vi.stubGlobal('scrollTo', vi.fn())
  })

  afterEach(() => {
    cleanup()
    delete (document as Document & { modelContext?: unknown }).modelContext
    vi.unstubAllGlobals()
  })

  it('lets agents search the catalog and discover select options and numeric bounds from the SSOT', async () => {
    const registered = new Map<string, { execute: (input: Record<string, unknown>) => unknown | Promise<unknown> }>()
    const registerTool = vi.fn(async (tool: { name: string; execute: (input: Record<string, unknown>) => unknown | Promise<unknown> }) => {
      registered.set(tool.name, tool)
    })
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool } })

    render(<App />)
    await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(5))

    const listTool = registered.get('list_public_api_demos')
    expect(listTool).toBeDefined()
    const result = await listTool?.execute({ query: 'People Generator', category: 'People' }) as {
      total: number
      count: number
      category: string
      demos: Array<{ category: string; requestLabUrl: string; parameters: Array<{ id: string; min?: number; max?: number; options?: Array<{ label: string; value: string }> }> }>
    }

    expect(result.total).toBe(200)
    expect(result.count).toBe(1)
    expect(result.category).toBe('People')
    expect(result.demos[0]?.category).toBe('People')
    expect(new URL(result.demos[0]?.requestLabUrl ?? 'http://invalid/').hash).toBe('#/request-lab?api=people')
    expect(result.demos[0]?.parameters.find((field) => field.id === 'count')).toMatchObject({ min: 1, max: 10 })
    expect(result.demos[0]?.parameters.find((field) => field.id === 'nationality')?.options).toContainEqual({ label: 'Australia', value: 'au' })
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
    expect(selectPreviewLayout({ id: 'nhtsa-vehicle-recalls', category: 'Vehicle' })).toBe('data-table')
    expect(selectPreviewLayout({ id: 'github', category: 'Developer' })).toBe('developer-feed')
    expect(selectPreviewLayout({ id: 'nvd-cves', category: 'Developer' })).toBe('security-center')
    expect(selectPreviewLayout({ id: 'geoboundaries-admin-boundaries', category: 'Geo' })).toBe('data-table')
    expect(selectPreviewLayout({ id: 'mlb-stats-api', category: 'Sports' })).toBe('data-table')
    expect(selectPreviewLayout({ id: 'europe-pmc-search', category: 'Research' })).toBe('research-library')
    expect(selectPreviewLayout({ id: 'free-dictionary', category: 'Language' })).toBe('dictionary-entry')
  })

  it('maps fourth-round catalog additions to explicit preview layouts', () => {
    const catalogById = Object.fromEntries(apiCatalog.map((api) => [api.id, api]))
    const expected: Record<string, string> = {
      'openssf-scorecard': 'data-table',
      'opencitations-index': 'data-table',
      'vam-collections': 'media-gallery',
      'usaspending': 'data-table',
      'fiscal-data-treasury': 'data-table',
      'wikidata-sparql': 'data-table',
      'met-museum-object-detail': 'media-gallery',
      'met-museum-search': 'data-table',
    }

    for (const [id, layout] of Object.entries(expected)) {
      const api = catalogById[id]
      expect(api, `Missing API ${id}`).toBeDefined()
      if (!api) continue
      expect(selectPreviewLayout({ id, category: api.category })).toBe(layout)
    }
  })

  it('registers every catalog API in the fail-closed SSOT card registry', () => {
    const catalogIds = apiCatalog.map((api) => api.id).sort()
    expect([...apiSsotCardIds].sort()).toEqual(catalogIds)
    expect(apiSsotCardIds).toHaveLength(200)
    for (const id of catalogIds) {
      const definition = apiSsotCardRegistry[id]
      expect(definition, `Missing SSOT card ${id}`).toBeDefined()
      if (!definition) throw new Error(`Missing SSOT card ${id}`)
      expect(definition.id).toBe(id)
      expect(definition.source).toBe('live-response')
      expect(definition.fallbackPolicy).toBe('forbidden')
      expect(definition.Component).toBe(apiPreviewComponents[id])
    }
  })

  it('registers 200 distinct React component functions with no shared identity', () => {
    const catalogIds = apiCatalog.map((api) => api.id).sort()
    const components = Object.values(apiPreviewComponents).filter((component) => component !== undefined)

    expect([...apiPreviewComponentIds].sort()).toEqual(catalogIds)
    expect(components).toHaveLength(200)
    expect(new Set(components).size).toBe(200)
    expect(new Set(components.map((component) => component.name)).size).toBe(200)
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
    expect(new Set(visualSignatures).size).toBe(200)
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

  it('renders AniList media search as a media gallery', () => {
    render(<ResponseDemoPreview api={api('anilist-graphql')} data={{
      data: {
        Page: {
          media: [{
            title: { romaji: 'Cowboy Bebop', english: 'Cowboy Bebop' },
            coverImage: { medium: 'https://images.test/anilist-cowboy-bebop.jpg' },
            type: 'ANIME',
            episodes: 26,
            startDate: '1998',
          }],
        },
      },
    }}/>)
    const preview = screen.getByRole('region', { name: 'AniList Media Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'media-gallery')
    expect(within(preview).getByRole('img')).toHaveAttribute('src', 'https://images.test/anilist-cowboy-bebop.jpg')
    expect(within(preview).getByText('Cowboy Bebop')).toBeInTheDocument()
  })

  it('renders HN search results as developer-feed cards', () => {
    render(<ResponseDemoPreview api={api('hn-search-algolia')} data={{
      hits: [{
        objectID: '321',
        title: 'How to ship offline-first',
        author: 'hacker',
        points: 57,
        num_comments: 12,
        created_at_i: 1722489600,
        story_text: 'A practical discussion for resilient systems.',
        tags: ['story'],
      }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'HN Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'developer-feed')
    expect(within(preview).getByText('How to ship offline-first')).toBeInTheDocument()
    expect(within(preview).getByText('hacker')).toBeInTheDocument()
    expect(within(preview).getByText('12')).toBeInTheDocument()
    expect(within(preview).getByText('57')).toBeInTheDocument()
  })

  it('renders NHTSA recall results as structured table data', () => {
    render(<ResponseDemoPreview api={api('nhtsa-vehicle-recalls')} data={{
      Count: 1,
      results: [{
        Make: 'Honda',
        Model: 'Accord',
        NHTSACampaignNumber: '20V771000',
        Component: 'Engine',
        RecallType: 'Safety Recall',
        ReportReceivedDate: '2020-05-01',
      }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'NHTSA Vehicle Recalls' })
    expect(preview).toHaveAttribute('data-preview-layout', 'data-table')
    expect(within(preview).getByText('20V771000')).toBeInTheDocument()
    expect(within(preview).getByText('Honda')).toBeInTheDocument()
  })

  it('renders AlAdhan prayer times with Hijri/Gregorian context', () => {
    render(<ResponseDemoPreview api={api('aladhan-prayer-times')} data={{
      timings: {
        Fajr: '05:12', Sunrise: '06:58', Dhuhr: '13:05', Asr: '16:25', Maghrib: '19:12', Isha: '20:34',
      },
      date: {
        hijri: { date: '01-01-1448' },
        gregorian: { date: '2026-08-02' },
      },
      meta: { method: { id: 11 } },
    }} />)
    const preview = screen.getByRole('region', { name: 'AlAdhan Prayer Times' })
    expect(preview).toHaveAttribute('data-preview-layout', 'data-table')
    expect(within(preview).getByText('Fajr time')).toBeInTheDocument()
    expect(within(preview).getByText('05:12')).toBeInTheDocument()
    expect(within(preview).getByText('Method 11')).toBeInTheDocument()
    expect(within(preview).getByText('01-01-1448')).toBeInTheDocument()
  })

  it('renders Packagist search results with package metadata', () => {
    render(<ResponseDemoPreview api={api('packagist-search')} data={{
      results: [{
        name: 'laravel/laravel',
        description: 'The Laravel framework.',
        type: 'project',
        repository: 'https://github.com/laravel/laravel',
        maintainer: 'Taylor Otwell',
        downloads: { total: 1200000 },
        favers: 1500,
      }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'Packagist Package Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'developer-feed')
    expect(within(preview).getByText('laravel/laravel')).toBeInTheDocument()
    expect(within(preview).getByText('The Laravel framework.')).toBeInTheDocument()
    expect(within(preview).getByText('project')).toBeInTheDocument()
  })

  it('renders Openverse media results as gallery cards', () => {
    render(<ResponseDemoPreview api={api('openverse-search')} data={{
      results: [{
        title: 'Neon city',
        creator: 'OpenVerse Demo',
        thumbnail: 'https://images.openverse.engineering/neon-city.jpg',
        license: 'CC0',
      }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'Openverse Media Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'media-gallery')
    expect(within(preview).getByRole('img')).toHaveAttribute('src', 'https://images.openverse.engineering/neon-city.jpg')
    expect(within(preview).getByText('Neon city')).toBeInTheDocument()
    expect(within(preview).getByText('CC0')).toBeInTheDocument()
  })

  it('renders Apple iTunes results as media cards', () => {
    render(<ResponseDemoPreview api={api('apple-itunes-search')} data={{
      results: [{
        trackName: 'Bohemian Rhapsody',
        artistName: 'Queen',
        artworkUrl100: 'https://images.test/queen-bohemian.jpg',
        wrapperType: 'track',
        kind: 'song',
      }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'Apple iTunes Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'media-gallery')
    expect(within(preview).getByRole('img')).toHaveAttribute('src', 'https://images.test/queen-bohemian.jpg')
    expect(within(preview).getByText('Bohemian Rhapsody')).toBeInTheDocument()
    expect(within(preview).getByText('Queen')).toBeInTheDocument()
  })

  it('renders Hebcal events as a calendar timeline', () => {
    render(<ResponseDemoPreview api={api('hebcal-calendar')} data={{
      items: [
        {
          date: '2026-09-11',
          title: 'Yom Kippur',
          hebrew: 'יום כיפור',
          category: 'holiday',
          className: 'major',
        },
      ],
    }}/>)
    const preview = screen.getByRole('region', { name: 'Hebcal Calendar' })
    expect(preview).toHaveAttribute('data-preview-layout', 'calendar-timeline')
    expect(within(preview).getByText('Yom Kippur')).toBeInTheDocument()
    expect(within(preview).getByText('Hebcal')).toBeInTheDocument()
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

  it('renders Jolpica F1 sessions as a data table', () => {
    render(<ResponseDemoPreview api={api('jolpica-f1')} data={{
      MRData: {
        RaceTable: {
          Races: [{
            raceName: 'Singapore Grand Prix',
            date: '2026-09-19',
            Circuit: { Location: { locality: 'Marina Bay' } },
          }],
        },
      },
    }}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    expect(preview).toHaveAttribute('data-preview-layout', 'data-table')
    expect(preview).toHaveTextContent('Singapore Grand Prix')
  })

  it('renders Swiss transit connections and new market APIs as dedicated layouts', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('swiss-transit-connections')} data={{
      connections: [{
        from: { station: 'Zurich HB', departure: '10:05', platform: '2' },
        to: { station: 'Bern' },
        sections: [{ journeys: [{ name: 'IC 6', duration: '60', delay: 3 }] }],
        delay: 5,
      }],
    }}/>)
    expect(screen.getByRole('region', { name: 'Swiss Transit Connections' })).toHaveAttribute('data-preview-layout', 'transit-board')
    expect(screen.getByRole('region', { name: 'Swiss Transit Connections' })).toHaveTextContent('Zurich HB → Bern')

    rerender(<ResponseDemoPreview api={api('bank-of-canada-valet')} data={{
      observations: [
        { d: '2026-07-01', FXUSDCAD: '1.3500' },
        { d: '2026-07-02', FXUSDCAD: '1.3600' },
      ],
    }}/>)
    const bankPreview = screen.getByRole('region', { name: 'Bank of Canada Valet' })
    expect(bankPreview).toHaveAttribute('data-preview-layout', 'market-chart')
    expect(bankPreview).toHaveTextContent('1.36')
    expect(bankPreview).toHaveTextContent('Series high')

    rerender(<ResponseDemoPreview api={api('nasa-power-climate')} data={{
      properties: {
        parameters: {
          T2M: {
            data: { '2026-07-01': '28', '2026-07-02': '29' },
            unit: '°C',
            label: '2m Temperature',
          },
        },
      },
    }}/>)
    const climatePreview = screen.getByRole('region', { name: 'NASA POWER Climate' })
    expect(climatePreview).toHaveAttribute('data-preview-layout', 'market-chart')
    expect(climatePreview).toHaveTextContent('NASA POWER')
    expect(climatePreview).toHaveTextContent('29 °C')

    rerender(<ResponseDemoPreview api={api('open-meteo-elevation')} data={{ latitude: 1.3521, longitude: 103.8198, elevation: 16.72 }}/>)
    const elevationPreview = screen.getByRole('region', { name: 'Open-Meteo Elevation' })
    expect(elevationPreview).toHaveAttribute('data-preview-layout', 'data-table')
    expect(elevationPreview).toHaveTextContent('Point 1')
    expect(elevationPreview).toHaveTextContent('16.72 m')
  })

  it('maps Zippopotam postcode results into a location explorer', () => {
    render(<ResponseDemoPreview api={api('zippopotam-postcode')} data={{
      'post code': '10001',
      country: 'United States',
      places: [{
        'place name': 'New York',
        state: 'New York',
        'state abbreviation': 'NY',
        latitude: '40.7128',
        longitude: '-74.0060',
      }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'Zippopotam Postcode' })
    expect(preview).toHaveAttribute('data-preview-layout', 'location-map')
    expect(within(preview).getByRole('img', { name: /Map with 1 response locations/ })).toBeInTheDocument()
    expect(within(preview).getByText('New York')).toBeInTheDocument()
    expect(within(preview).getByText('New York · United States')).toBeInTheDocument()
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


describe('Request Lab SSOT card adapters', () => {
  afterEach(cleanup)

  const api = (id: string) => {
    const match = apiCatalog.find((candidate) => candidate.id === id)
    if (!match) throw new Error(`Missing API fixture: ${id}`)
    return match
  }

  const expectNoGenericFallback = (name: string) => {
    const preview = screen.getByRole('region', { name })
    expect(preview.querySelector('[data-generic-fallback="true"]')).toBeNull()
    return preview
  }

  it('renders Singapore transport responses without generic Result 1 cards', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('data-gov-carpark')} data={{ items: [{ timestamp: '2026-09-04T18:06:37+08:00', carpark_data: [{ carpark_number: 'HE12', update_datetime: '2026-09-04T18:06:22', carpark_info: [{ total_lots: '105', lot_type: 'C', lots_available: '31' }] }] }] }} />)
    expect(expectNoGenericFallback('data.gov.sg Carpark Availability')).toHaveTextContent('Available lots')

    rerender(<ResponseDemoPreview api={api('data-gov-taxi')} data={{ type: 'FeatureCollection', features: [{ geometry: { type: 'MultiPoint', coordinates: [[103.8, 1.30], [103.81, 1.31]] } }] }} />)
    const taxi = expectNoGenericFallback('data.gov.sg Taxi Availability')
    expect(within(taxi).getByRole('img', { name: /Map with 2 response locations/ })).toBeInTheDocument()
    expect(taxi).toHaveTextContent('Available taxi 1')

    rerender(<ResponseDemoPreview api={api('data-gov-traffic-images')} data={{ items: [{ cameras: [{ camera_id: '2701', timestamp: '2026-09-04T18:06:19+08:00', image: 'https://images.test/traffic.jpg', location: { latitude: 1.447, longitude: 103.772 } }] }] }} />)
    const traffic = expectNoGenericFallback('data.gov.sg Traffic Images')
    expect(within(traffic).getByRole('img')).toHaveAttribute('src', 'https://images.test/traffic.jpg')
    expect(traffic).toHaveTextContent('Traffic camera 2701')
  })

  it('renders collection, vehicle, earthquake, and taxonomy responses semantically', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('met-museum-search')} data={{ total: 53, objectIDs: [892409, 908184, 264585] }} />)
    const met = expectNoGenericFallback('Met Museum Search')
    expect(met).toHaveTextContent('53')
    expect(met).toHaveTextContent('892409')

    rerender(<ResponseDemoPreview api={api('nhtsa-vpic')} data={{ Count: 12356, Results: [{ Make_ID: 12858, Make_Name: '#1 ALPINE CUSTOMS' }] }} />)
    const nhtsa = expectNoGenericFallback('NHTSA vPIC Vehicle API')
    expect(nhtsa).toHaveTextContent('#1 ALPINE CUSTOMS')
    expect(nhtsa).toHaveTextContent('12.4K')

    rerender(<ResponseDemoPreview api={api('usgs')} data={{ type: 'FeatureCollection', features: [{ properties: { mag: 3.7, title: 'M 3.7 - off the coast of Oregon', status: 'reviewed' }, geometry: { type: 'Point', coordinates: [-129.0824, 43.6383, 10] } }] }} />)
    const usgs = expectNoGenericFallback('USGS Earthquakes')
    expect(within(usgs).getByRole('img', { name: /Map with 1 response locations/ })).toBeInTheDocument()
    expect(usgs).toHaveTextContent('M 3.7 - off the coast of Oregon')

    rerender(<ResponseDemoPreview api={api('gbif-species-search')} data={{ count: 1759, results: [{ scientificName: 'Panthera', kingdom: 'Animalia', phylum: 'Chordata', class: 'Mammalia', order: 'Carnivora', family: 'Felidae', genus: 'Panthera', rank: 'GENUS', taxonomicStatus: 'ACCEPTED' }] }} />)
    const gbif = expectNoGenericFallback('GBIF Species Search')
    expect(gbif).toHaveTextContent('Panthera')
    expect(gbif).toHaveTextContent('Felidae')
  })

  it('renders media APIs from their actual nested image contracts', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('pokeapi')} data={{ id: 25, name: 'pikachu', sprites: { front_default: 'https://images.test/pikachu.png' }, types: [{ type: { name: 'electric' } }] }} />)
    const poke = expectNoGenericFallback('PokéAPI Explorer')
    expect(within(poke).getByRole('img')).toHaveAttribute('src', 'https://images.test/pikachu.png')
    expect(poke).toHaveTextContent('pikachu')

    rerender(<ResponseDemoPreview api={api('tvmaze-search')} data={[{ score: 0.9, show: { name: 'Severance', status: 'Running', genres: ['Drama'], rating: { average: 7.6 }, image: { medium: 'https://images.test/severance.jpg' } } }]} />)
    const tv = expectNoGenericFallback('TVmaze Show Search')
    expect(within(tv).getByRole('img')).toHaveAttribute('src', 'https://images.test/severance.jpg')
    expect(tv).toHaveTextContent('Severance')

    rerender(<ResponseDemoPreview api={api('open-food-facts')} data={{ product: { product_name: 'Nutella', brands: 'Ferrero', nutriscore_grade: 'e', image_front_url: 'https://images.test/nutella.jpg' } }} />)
    const food = expectNoGenericFallback('Open Food Facts')
    expect(within(food).getByRole('img')).toHaveAttribute('src', 'https://images.test/nutella.jpg')
    expect(food).toHaveTextContent('Nutella')

    rerender(<ResponseDemoPreview api={api('flathub-appstream')} data={{ name: 'Calculator', developer_name: 'The GNOME Project', project_license: 'GPL-3.0-or-later', screenshots: [{ caption: 'Basic Mode', sizes: [{ width: 750, src: 'https://images.test/calculator.png' }] }] }} />)
    const flathub = expectNoGenericFallback('Flathub Appstream')
    expect(within(flathub).getByRole('img')).toHaveAttribute('src', 'https://images.test/calculator.png')
    expect(flathub).toHaveTextContent('Basic Mode')

    rerender(<ResponseDemoPreview api={api('vam-collections')} data={{ records: [{ _primaryTitle: 'The Yorkshire Dales', _primaryDate: 'c.1923', _primaryMaker: { name: 'Brown, F. Gregory' }, _images: { _primary_thumbnail: 'https://images.test/vam.jpg' } }] }} />)
    const vam = expectNoGenericFallback('V&A Collections')
    expect(within(vam).getByRole('img')).toHaveAttribute('src', 'https://images.test/vam.jpg')
    expect(vam).toHaveTextContent('The Yorkshire Dales')
  })

  it('renders parsed Go versions and the jsDelivr reference SSOT card', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('go-module-proxy')} data={{ versions: ['v1.11.0', 'v1.12.0'] }} />)
    const go = expectNoGenericFallback('Go Module Proxy')
    expect(go).toHaveTextContent('Published module versions')
    expect(go).toHaveTextContent('v1.12.0')

    rerender(<ResponseDemoPreview api={api('jsdelivr-package')} requestUrl="https://data.jsdelivr.com/v1/package/npm/react" runtime={{ httpStatus: 200, elapsed: 58, size: 106496 }} data={{ tags: { latest: '19.2.8', rc: '19.0.0-rc.1', next: '19.3.0-canary' }, versions: ['19.2.8', '19.2.7', '19.1.0'] }} />)
    const jsdelivr = expectNoGenericFallback('jsDelivr Package Metadata')
    expect(jsdelivr.querySelector('[data-ssot-reference="jsdelivr-package"]')).not.toBeNull()
    expect(jsdelivr).toHaveTextContent('Latest stable')
    expect(jsdelivr).toHaveTextContent('19.2.8')
    expect(jsdelivr).toHaveTextContent('200 OK')
    expect(jsdelivr).toHaveTextContent('104.0 KB')
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
    const { rerender } = render(<ResponseDemoPreview api={api('openf1-historical')} data={{ MRData: { RaceTable: { Races: [{ raceName: 'Australian Grand Prix', Circuit: { circuitName: 'Albert Park Grand Prix Circuit', Location: { locality: 'Melbourne', country: 'Australia' } }, QualifyingResults: [{ position: '1', number: '4', Driver: { code: 'NOR', givenName: 'Lando', familyName: 'Norris', nationality: 'British' }, Constructor: { name: 'McLaren' }, Q1: '1:15.912', Q2: '1:15.415', Q3: '1:15.096' }] }] } } }}/>)
    expect(screen.getByRole('region', { name: 'Jolpica F1 Qualifying' })).toHaveTextContent('Australian Grand Prix')
    expect(screen.getByRole('region', { name: 'Jolpica F1 Qualifying' })).toHaveTextContent('Lando Norris')

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

describe('Public-API 200 milestone previews', () => {
  afterEach(cleanup)

  const api = (id: string) => {
    const match = apiCatalog.find((candidate) => candidate.id === id)
    if (!match) throw new Error(`Missing API fixture: ${id}`)
    return match
  }

  it('renders GitHub, CIRCL, and DBLP investigation records', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('github-global-advisories')} data={[{
      ghsa_id: 'GHSA-demo-1234', cve_id: 'CVE-2026-7000', severity: 'high', summary: 'Demo package advisory',
      published_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-03T00:00:00Z',
      vulnerabilities: [{ package: { ecosystem: 'npm', name: 'demo-package' } }],
    }]}/>)
    const github = screen.getByRole('region', { name: 'GitHub Global Advisories' })
    expect(github).toHaveTextContent('GHSA-demo-1234')
    expect(github).toHaveTextContent('demo-package')
    expect(github).toHaveTextContent('High')

    rerender(<ResponseDemoPreview api={api('circl-vulnerability')} data={{
      dataType: 'CVE_RECORD', dataVersion: '5.1',
      cveMetadata: { cveId: 'CVE-2021-44228', state: 'PUBLISHED', assignerShortName: 'apache', datePublished: '2021-12-10T00:00:00Z', dateUpdated: '2025-10-21T00:00:00Z' },
      containers: { cna: { descriptions: [{ lang: 'en', value: 'Log4j JNDI remote code execution.' }], affected: [{ vendor: 'Apache', product: 'Log4j' }] } },
    }}/>)
    const circl = screen.getByRole('region', { name: 'CIRCL Vulnerability Lookup' })
    expect(circl).toHaveTextContent('CVE-2021-44228')
    expect(circl).toHaveTextContent('Log4j')

    rerender(<ResponseDemoPreview api={api('dblp-search')} data={{ result: { hits: { hit: [{ info: {
      title: 'Retrieval-Augmented Generation for Enterprise Systems', year: '2026', venue: 'DemoConf', type: 'Conference and Workshop Papers', doi: '10.1/demo',
      authors: { author: [{ text: 'Wei Developer' }, { text: 'AI Researcher' }] },
    } }] } } }}/>)
    const dblp = screen.getByRole('region', { name: 'DBLP Publication Search' })
    expect(dblp).toHaveTextContent('Retrieval-Augmented Generation for Enterprise Systems')
    expect(dblp).toHaveTextContent('Wei Developer')
    expect(dblp).toHaveTextContent('DemoConf')
  })

  it('renders live-location and licensed-media response shapes', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('citybikes-network')} data={{ network: { stations: [{
      name: '示範站', latitude: 25.03, longitude: 121.56, free_bikes: 12, empty_slots: 8, extra: { en: { name: 'Demo Bike Station' } },
    }] } }}/>)
    const bikes = screen.getByRole('region', { name: 'CityBikes Live Stations' })
    expect(bikes).toHaveTextContent('Demo Bike Station')
    expect(bikes).toHaveTextContent('12 bikes · 8 empty docks')

    rerender(<ResponseDemoPreview api={api('nominatim-search')} data={[{ lat: '1.3571', lon: '103.8195', name: 'Singapore', display_name: 'Singapore', type: 'administrative' }]}/>)
    const nominatim = screen.getByRole('region', { name: 'OpenStreetMap Nominatim' })
    expect(nominatim).toHaveTextContent('Singapore')
    expect(within(nominatim).getByRole('img', { name: /Map with 1 response locations/ })).toBeInTheDocument()

    rerender(<ResponseDemoPreview api={api('gbif-occurrence-search')} data={{ results: [{ scientificName: 'Panthera leo', decimalLatitude: -1.3, decimalLongitude: 36.8, locality: 'Nairobi', eventDate: '2026-08-01' }] }}/>)
    const gbif = screen.getByRole('region', { name: 'GBIF Occurrence Search' })
    expect(gbif).toHaveTextContent('Panthera leo')
    expect(gbif).toHaveTextContent('Nairobi · 2026-08-01')

    rerender(<ResponseDemoPreview api={api('wikimedia-commons-search')} data={{ query: { pages: { 1: {
      title: 'File:Singapore skyline.jpg', imageinfo: [{ thumburl: 'https://images.test/sg.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } } }],
    } } } }}/>)
    const commons = screen.getByRole('region', { name: 'Wikimedia Commons Search' })
    expect(within(commons).getByRole('img')).toHaveAttribute('src', 'https://images.test/sg.jpg')
    expect(commons).toHaveTextContent('Singapore skyline.jpg')
    expect(commons).toHaveTextContent('CC BY-SA 4.0')
  })

  it('renders developer, government, and current FX records', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('jsdelivr-package')} data={{ tags: { latest: '19.2.8', rc: '19.0.0-rc.1', next: '19.3.0-canary' }, versions: ['19.2.8', '19.2.7', '19.1.0'] }}/>)
    const jsdelivr = screen.getByRole('region', { name: 'jsDelivr Package Metadata' })
    expect(jsdelivr).toHaveTextContent('19.2.8')
    expect(jsdelivr).toHaveTextContent('3 published versions')

    rerender(<ResponseDemoPreview api={api('canada-open-data-search')} data={{ result: { results: [{ title: 'Artificial Intelligence - ITSAP.00.040', type: 'info', organization: { title: 'Government of Canada' }, date_published: '2025-12-10', notes: 'AI awareness guidance.' }] } }}/>)
    const canada = screen.getByRole('region', { name: 'Canada Open Data Search' })
    expect(canada).toHaveTextContent('Artificial Intelligence - ITSAP.00.040')
    expect(canada).toHaveTextContent('Government of Canada')

    rerender(<ResponseDemoPreview api={api('exchange-rate-current')} data={{ base_code: 'SGD', time_last_update_utc: 'Fri, 04 Sep 2026 00:02:31 +0000', rates: { SGD: 1, MYR: 3.11, USD: 0.789, EUR: 0.68, GBP: 0.59, JPY: 116.5, AUD: 1.09, CNY: 5.31 } }}/>)
    const fx = screen.getByRole('region', { name: 'Current FX Rates' })
    expect(fx).toHaveTextContent('1 SGD → MYR')
    expect(fx).toHaveTextContent('3.11')
  })

  it('renders ensemble uncertainty and selectable World Bank indicators', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('open-meteo-ensemble')} data={{
      timezone: 'Asia/Singapore', hourly_units: { temperature_2m: '°C' },
      hourly: { time: ['2026-09-04T09:00', '2026-09-04T10:00'], temperature_2m: [30, 31], temperature_2m_member01: [29, 30], temperature_2m_member02: [31, 32] },
    }}/>)
    const ensemble = screen.getByRole('region', { name: 'Open-Meteo Ensemble Forecast' })
    expect(ensemble).toHaveTextContent('Ensemble members')
    expect(ensemble).toHaveTextContent('30 – 32 °C')

    rerender(<ResponseDemoPreview api={api('world-bank-indicator-explorer')} data={[
      { page: 1, total: 3 },
      [
        { indicator: { id: 'SP.DYN.LE00.IN', value: 'Life expectancy at birth, total (years)' }, country: { value: 'Singapore' }, countryiso3code: 'SGP', date: '2025', value: 84.1 },
        { indicator: { id: 'SP.DYN.LE00.IN', value: 'Life expectancy at birth, total (years)' }, country: { value: 'Singapore' }, countryiso3code: 'SGP', date: '2024', value: 83.9 },
        { indicator: { id: 'SP.DYN.LE00.IN', value: 'Life expectancy at birth, total (years)' }, country: { value: 'Singapore' }, countryiso3code: 'SGP', date: '2023', value: 83.7 },
      ],
    ]}/>)
    const worldBank = screen.getByRole('region', { name: 'World Bank Indicator Explorer' })
    expect(worldBank).toHaveTextContent('Life expectancy at birth, total (years) · Singapore')
    expect(worldBank).toHaveTextContent('Latest year')
    expect(worldBank).toHaveTextContent('2025')
  })
})

describe('browser-ready health remediation previews', () => {
  afterEach(cleanup)

  const api = (id: string) => {
    const match = apiCatalog.find((candidate) => candidate.id === id)
    if (!match) throw new Error(`Missing API fixture: ${id}`)
    return match
  }

  it('renders remediated dictionary, F1, model, and Dart package contracts', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('free-dictionary')} data={{ word: 'hello', entries: [{ partOfSpeech: 'interjection', pronunciations: [{ type: 'ipa', text: '/həˈloʊ/' }], senses: [{ definition: 'Used as a greeting.', examples: ['Hello there.'], synonyms: ['hi'] }] }] }}/>)
    expect(screen.getByRole('region', { name: 'Free Dictionary' })).toHaveTextContent('Used as a greeting.')
    expect(screen.getByRole('region', { name: 'Free Dictionary' })).toHaveTextContent('/həˈloʊ/')

    rerender(<ResponseDemoPreview api={api('openf1-historical')} data={{ MRData: { RaceTable: { Races: [{ raceName: 'Australian Grand Prix', Circuit: { circuitName: 'Albert Park Grand Prix Circuit', Location: { locality: 'Melbourne', country: 'Australia' } }, QualifyingResults: [{ position: '1', number: '4', Driver: { code: 'NOR', givenName: 'Lando', familyName: 'Norris', nationality: 'British' }, Constructor: { name: 'McLaren' }, Q1: '1:15.912', Q2: '1:15.415', Q3: '1:15.096' }] }] } } }}/>)
    const f1 = screen.getByRole('region', { name: 'Jolpica F1 Qualifying' })
    expect(f1).toHaveTextContent('Australian Grand Prix')
    expect(f1).toHaveTextContent('Lando Norris')
    expect(f1).toHaveTextContent('1:15.096')

    rerender(<ResponseDemoPreview api={api('models-dev')} data={[{ id: 'openai-community/gpt2', pipeline_tag: 'text-generation', library_name: 'transformers', downloads: 14607268, likes: 3618, lastModified: '2026-09-01T00:00:00Z' }]}/>)
    const models = screen.getByRole('region', { name: 'Hugging Face Model Search' })
    expect(models).toHaveTextContent('openai-community/gpt2')
    expect(models).toHaveTextContent('text-generation')

    rerender(<ResponseDemoPreview api={api('pub-dev')} data={{ name: 'riverpod', latest: { version: '3.4.3', published: '2026-09-03T22:14:57Z', pubspec: { name: 'riverpod', version: '3.4.3', description: 'A reactive caching and data-binding framework.', repository: 'https://github.com/rrousselGit/riverpod', topics: ['state-management'], environment: { sdk: '^3.12.0' } } }, versions: [{ version: '3.4.2' }, { version: '3.4.3' }] }}/>)
    const pubdev = screen.getByRole('region', { name: 'pub.dev Package Lookup' })
    expect(pubdev).toHaveTextContent('riverpod')
    expect(pubdev).toHaveTextContent('3.4.3')
    expect(pubdev).toHaveTextContent('^3.12.0')
  })

  it('renders remediated Treasury, FX, UNHCR, IFRC, and citation contracts', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('fiscal-data-treasury')} data={{ fiscal_year: 2026, toptier_code: '020', name: 'Department of the Treasury', abbreviation: 'TREAS', subtier_agency_count: 8, mission: 'Maintain a strong economy and manage the U.S. Government finances effectively.', website: 'https://www.treasury.gov/' }}/>)
    const treasury = screen.getByRole('region', { name: 'U.S. Treasury Agency Profile' })
    expect(treasury).toHaveTextContent('Department of the Treasury')
    expect(treasury).toHaveTextContent('Maintain a strong economy')

    rerender(<ResponseDemoPreview api={api('ecb-fx-rates')} data={{ data: { currency: 'EUR', rates: { USD: '1.1599', GBP: '0.8593', SGD: '1.4708', BTC: '0.000010' } } }}/>)
    const fx = screen.getByRole('region', { name: 'Coinbase Exchange Rates' })
    expect(fx).toHaveTextContent('1 EUR → USD')
    expect(fx).toHaveTextContent('1.1599')

    rerender(<ResponseDemoPreview api={api('unhcr-refugees')} data={{ items: [{ year: 2024, coo: 'SYR', coo_name: 'Syrian Arab Republic', refugees: 6211475, asylum_seekers: 150000, idps: 7200000, stateless: 0 }] }}/>)
    const unhcr = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(unhcr).toHaveTextContent('Syrian Arab Republic')
    expect(unhcr).toHaveTextContent('6,211,475')

    rerender(<ResponseDemoPreview api={api('hdx-humanitarian-datasets')} data={{ results: [{ dtype: { name: 'Flood' }, countries: [{ name: 'Philippines' }], ifrc_severity_level_display: 'Yellow', disaster_start_date: '2026-08-29T00:00:00Z', summary: 'Philippines flood emergency', description: 'Heavy rainfall and flooding.', field_reports: [{ num_affected: 1588424, num_dead: 31, num_displaced: 83580 }] }] }}/>)
    const ifrc = screen.getByRole('region', { name: 'IFRC GO Emergency Events' })
    expect(ifrc).toHaveTextContent('Philippines flood emergency')
    expect(ifrc).toHaveTextContent('1,588,424')
    expect(ifrc).toHaveTextContent('Yellow')

    rerender(<ResponseDemoPreview api={api('opencitations-index')} data={[{ count: '98' }]}/>)
    const citations = screen.getByRole('region', { name: 'OpenCitations Citation Count' })
    expect(citations).toHaveTextContent('Incoming citation count')
    expect(citations).toHaveTextContent('98')


    rerender(<ResponseDemoPreview api={api('geoboundaries-admin-boundaries')} data={{ boundaryName: 'Singapore', boundaryISO: 'SGP', boundaryType: 'ADM0', boundaryYearRepresented: '2016', meanAreaSqKM: '724.2749814174942', boundaryLicense: 'Open Data Commons Open Database License 1.0', boundarySource: 'Urban Redevelopment Authority' }}/>)
    const boundary = screen.getByRole('region', { name: 'geoBoundaries Admin Boundaries' })
    expect(boundary).toHaveTextContent('Singapore')
    expect(boundary).toHaveTextContent('ADM0')
    expect(boundary).toHaveTextContent('Open Data Commons Open Database License 1.0')
  })
})
