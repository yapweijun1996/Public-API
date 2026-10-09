import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { apiCatalog } from './apiCatalog'
import { UI_LOCALE_STORAGE_KEY } from './i18n'
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

const matchMediaAt = (width: number) => (query: string): MediaQueryList => {
  const maxWidth = query.match(/max-width:\s*(\d+)px/)
  return { ...matchMedia(query), matches: maxWidth ? width <= Number(maxWidth[1]) : false }
}

const responsiveMatchMedia = (initialWidth: number) => {
  let width = initialWidth
  const queries = new Map<string, MediaQueryList>()
  const matches = (query: string) => {
    const maxWidth = query.match(/max-width:\s*(\d+)px/)
    return maxWidth ? width <= Number(maxWidth[1]) : false
  }
  const matchMediaForWidth = (query: string): MediaQueryList => {
    const existing = queries.get(query)
    if (existing) return existing
    const queryListeners = new Set<(event: MediaQueryListEvent) => void>()
    const mediaQuery = {
      get matches() { return matches(query) },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === 'function') queryListeners.add(listener as (event: MediaQueryListEvent) => void)
      }),
      removeEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === 'function') queryListeners.delete(listener as (event: MediaQueryListEvent) => void)
      }),
      dispatchEvent: vi.fn((event: Event) => {
        queryListeners.forEach((listener) => listener(event as MediaQueryListEvent))
        return true
      }),
    } as MediaQueryList
    queries.set(query, mediaQuery)
    return mediaQuery
  }
  const setWidth = (nextWidth: number) => {
    const previousMatches = new Map([...queries].map(([query, mediaQuery]) => [query, mediaQuery.matches]))
    width = nextWidth
    for (const [query, mediaQuery] of queries) {
      if (mediaQuery.matches === previousMatches.get(query)) continue
      mediaQuery.dispatchEvent({ matches: mediaQuery.matches, media: query } as MediaQueryListEvent)
    }
  }
  return { matchMedia: matchMediaForWidth, setWidth }
}

const openF1QualifyingFixture = {
  MRData: {
    series: 'f1',
    limit: '30',
    offset: '0',
    total: '1',
    RaceTable: {
      season: '2025',
      round: '1',
      Races: [{
        season: '2025',
        round: '1',
        raceName: 'Australian Grand Prix',
        Circuit: {
          circuitId: 'albert_park',
          circuitName: 'Albert Park Grand Prix Circuit',
          Location: { locality: 'Melbourne', country: 'Australia' },
        },
        QualifyingResults: [{
          position: '1',
          number: '4',
          Driver: { driverId: 'norris', code: 'NOR', givenName: 'Lando', familyName: 'Norris', nationality: 'British' },
          Constructor: { constructorId: 'mclaren', name: 'McLaren' },
          Q1: '1:15.912',
          Q2: '1:15.415',
          Q3: '1:15.096',
        }],
      }],
    },
  },
}

describe('catalog live API flow', () => {
  beforeEach(() => {
    // Establish the initial route without queuing a hashchange that can race a later
    // interaction in the same test (for example, opening the mobile navigation).
    window.history.replaceState({}, '', '#/catalog')
    window.localStorage.removeItem(UI_LOCALE_STORAGE_KEY)
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
      { page: 1, pages: 1, per_page: '50', total: 1 },
      [{ id: 'SGP', iso2Code: 'SG', name: 'Singapore', capitalCity: 'Singapore', region: { value: 'East Asia & Pacific' } }],
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
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Request Lab', level: 1 })).toHaveFocus())
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
  }, 12_000)
  it('opens a deterministic Request Lab deep link with the requested API selected', () => {
    window.location.hash = '#/request-lab?api=open5e-monster-search'
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Request lab' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Configure Open5e Monster Search' })).toHaveAttribute('data-api-id', 'open5e-monster-search')
    expect(screen.getByRole('textbox', { name: 'Monster name contains' })).toHaveValue('dragon')
    expect(window.location.hash).toBe('#/request-lab?api=open5e-monster-search')
  })

  it('canonicalizes an invalid Request Lab API id to the current valid selection', async () => {
    window.location.hash = '#/request-lab?api=does-not-exist'
    render(<App />)

    await waitFor(() => expect(window.location.hash).toBe('#/request-lab?api=countries'))
    expect(screen.getByRole('form', { name: 'Configure Country Explorer' })).toHaveAttribute('data-api-id', 'countries')
  })


  it('switches the primary application chrome between English and Simplified Chinese without changing API IDs or routes', () => {
    render(<App />)

    const language = screen.getByRole('combobox', { name: 'Interface language' })
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(language).toHaveValue('en')

    fireEvent.change(language, { target: { value: 'zh-CN' } })

    expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
    expect(window.localStorage.getItem(UI_LOCALE_STORAGE_KEY)).toBe('zh-CN')
    expect(screen.getByRole('heading', { name: 'API 目录', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '搜索目录' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '选择 Country Explorer' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/catalog')
    const countryRow = document.querySelector('tr[data-api-id="countries"]')
    expect(countryRow).toBeInTheDocument()
    expect(countryRow?.querySelector('td:nth-child(2)')).toHaveAttribute('data-label', 'API')
    expect(countryRow?.querySelector('td:nth-child(3)')).toHaveAttribute('data-label', '提供方 / 来源')
    expect(countryRow?.querySelector('td:nth-child(4)')).toHaveAttribute('data-label', '风险')
    expect(countryRow?.querySelector('td:nth-child(5)')).toHaveAttribute('data-label', '标签')

    fireEvent.change(language, { target: { value: 'en' } })
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('heading', { name: 'API Catalog', level: 1 })).toBeInTheDocument()
  })

  it('localizes supporting workspace chrome while preserving source-English provider and API identity', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Collections' }))
    expect(window.location.hash).toBe('#/collections')
    expect(screen.getByRole('heading', { name: 'Curated workspaces', level: 2 })).toBeInTheDocument()

    const language = screen.getByRole('combobox', { name: 'Interface language' })
    fireEvent.change(language, { target: { value: 'zh-CN' } })
    expect(screen.getByRole('heading', { name: '集合', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '精选工作区', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '免密入门合集', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开 API 目录' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/collections')

    fireEvent.click(screen.getByRole('button', { name: '提供方' }))
    expect(window.location.hash).toBe('#/providers')
    expect(screen.getByRole('heading', { name: '来源目录', level: 2 })).toBeInTheDocument()
    const providerHeading = screen.getAllByRole('heading', { name: 'World Bank', level: 3 })[0]
    expect(providerHeading).toHaveAttribute('lang', 'en')
    const providerCard = providerHeading.closest('article')
    expect(providerCard?.querySelector('p')).toHaveAttribute('lang', 'en')
    expect(providerCard?.querySelector('p')).toHaveTextContent('Country Explorer')

    fireEvent.click(screen.getByRole('button', { name: '健康状态' }))
    expect(window.location.hash).toBe('#/health')
    expect(screen.getByRole('heading', { name: '目录就绪状态', level: 2 })).toBeInTheDocument()
    expect(screen.getByText(/这里只显示静态目录元数据/)).toBeInTheDocument()
    const healthApiHeading = screen.getByRole('heading', { name: 'Country Explorer', level: 3 })
    expect(healthApiHeading).toHaveAttribute('lang', 'en')
    expect(healthApiHeading.closest('article')?.querySelector('p')).toHaveAttribute('lang', 'en')

    fireEvent.click(screen.getByRole('button', { name: '阅读开发者指南' }))
    expect(window.location.hash).toBe('#/documentation')
    expect(screen.getByRole('heading', { name: '开发者指南', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '1. 添加模块', level: 3 })).toBeInTheDocument()
  }, 12_000)

  it('does not fabricate live verification metadata and exposes stable catalog row metadata', () => {
    render(<App />)
    expect(document.querySelector('button[aria-label="Filters"]')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close selected API details' })).not.toBeInTheDocument()
    const currentPage = document.querySelector('.table-footer [aria-current="page"]')
    expect(currentPage).toHaveTextContent('1')
    expect(currentPage?.tagName).toBe('SPAN')
    const table = screen.getByRole('table')
    expect(within(table).queryByRole('columnheader', { name: 'Quality' })).not.toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'Last reviewed' })).not.toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument()
    expect(within(table).queryByText('verified')).not.toBeInTheDocument()
    expect(within(table).queryByText('source-linked')).not.toBeInTheDocument()
    expect(within(table).queryByText(/^2026-07-/)).not.toBeInTheDocument()
    expect(screen.queryByText('demo-ready')).not.toBeInTheDocument()
    expect(screen.getByText('Discover and evaluate curated public APIs')).toBeInTheDocument()

    const countryRow = document.querySelector('tr[data-api-id="countries"]')
    expect(countryRow).toHaveAttribute('data-category', 'Data')
    expect(countryRow).toHaveAttribute('data-provider', 'World Bank')
    expect(countryRow).toHaveAttribute('data-http-method', 'GET')
    expect(countryRow).toHaveAttribute('data-agent-execution', 'enabled')
    expect(countryRow).toHaveAttribute('data-automated-verification', 'enabled')
    expect(countryRow).toHaveAttribute('data-selected', 'true')
    const catalogDocumentationLinks = [...document.querySelectorAll<HTMLAnchorElement>('a[data-api-docs-for]')]
    expect(catalogDocumentationLinks).toHaveLength(50)
    expect(new Set(catalogDocumentationLinks.map((link) => link.getAttribute('aria-label'))).size).toBe(50)
    expect(countryRow?.querySelector('a[data-api-docs-for="countries"]')).toHaveAccessibleName('Open Country Explorer documentation')

    fireEvent.click(screen.getByRole('radio', { name: 'Select Live Weather' }))
    expect(countryRow).toHaveAttribute('data-selected', 'false')
    expect(document.querySelector('tr[data-api-id="weather"]')).toHaveAttribute('data-selected', 'true')
    expect(screen.getByText('Live health')).toBeInTheDocument()
    expect(screen.getByText('Check in Request Lab')).toBeInTheDocument()
  }, 12_000)

  it('paginates the catalog with exact coverage and resets to page one when searching', () => {
    render(<App />)
    const seen = new Set<string>()
    const labels = new Set<string>()
    const collectPage = () => {
      for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-api-docs-for]')) {
        if (link.dataset.apiDocsFor) seen.add(link.dataset.apiDocsFor)
        if (link.getAttribute('aria-label')) labels.add(link.getAttribute('aria-label') as string)
      }
    }

    expect(document.querySelectorAll('tbody tr[data-api-id]')).toHaveLength(50)
    expect(document.querySelector('.table-footer')).toHaveAttribute('data-page-count', '4')
    expect(document.querySelector('.table-footer')).toHaveAttribute('data-page-size', '50')
    expect(screen.getByLabelText('Page 1 of 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous catalog page' })).toBeDisabled()
    collectPage()
    for (let page = 2; page <= 4; page += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next catalog page' }))
      expect(screen.getByLabelText(`Page ${page} of 4`)).toBeInTheDocument()
      collectPage()
    }
    expect(document.querySelectorAll('tbody tr[data-api-id]')).toHaveLength(46)
    expect(screen.getByRole('button', { name: 'Next catalog page' })).toBeDisabled()
    expect(seen.size).toBe(196)
    expect(labels.size).toBe(196)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search catalog' }), { target: { value: 'place name to coordinates' } })
    expect(screen.getByLabelText('Page 1 of 1')).toBeInTheDocument()
    expect(document.querySelectorAll('tbody tr[data-api-id]')).toHaveLength(1)
    expect(document.querySelector('tr[data-api-id="geocoding-search"]')).toHaveAttribute('data-agent-execution', 'enabled')

    fireEvent.change(screen.getByRole('textbox', { name: 'Search catalog' }), { target: { value: 'spell check' } })
    expect(document.querySelectorAll('tbody tr[data-api-id]')).toHaveLength(1)
    expect(document.querySelector('tr[data-api-id="languagetool-grammar-check"]')).toHaveAttribute('data-agent-execution', 'manual-only')

    fireEvent.change(screen.getByRole('textbox', { name: 'Search catalog' }), { target: { value: 'CIRCL Vulnerability' } })
    expect(document.querySelectorAll('tbody tr[data-api-id]')).toHaveLength(1)
    expect(document.querySelector('tr[data-api-id="circl-vulnerability"]')).toHaveAttribute('data-agent-execution', 'manual-only')
  }, 15_000)

  it('preserves focus on catalog filter and pagination controls while their actions replace visible rows', async () => {
    render(<App />)

    const next = screen.getByRole('button', { name: 'Next catalog page' })
    next.focus()
    fireEvent.click(next)
    expect(screen.getByLabelText('Page 2 of 4')).toBeInTheDocument()
    expect(next).toHaveFocus()

    const search = screen.getByRole('textbox', { name: 'Search catalog' })
    search.focus()
    fireEvent.change(search, { target: { value: 'place name to coordinates' } })
    expect(screen.getByLabelText('Page 1 of 1')).toBeInTheDocument()
    expect(search).toHaveFocus()
    expect(document.querySelector('tr[data-api-id="geocoding-search"]')).toBeInTheDocument()
  })

  it('moves focus to the destination page heading for browser history route changes', async () => {
    render(<App />)
    const search = screen.getByRole('textbox', { name: 'Search catalog' })
    search.focus()

    act(() => {
      window.location.hash = '#/documentation'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Documentation', level: 1 })).toHaveFocus())

    act(() => {
      window.location.hash = '#/catalog'
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'API Catalog', level: 1 })).toHaveFocus())
  })

  it('treats the compact selected-API drawer as a modal dialog and restores its invoker', async () => {
    vi.stubGlobal('matchMedia', matchMediaAt(390))
    render(<App />)

    const weatherRadio = screen.getByRole('radio', { name: 'Select Live Weather' })
    weatherRadio.focus()
    fireEvent.click(weatherRadio)

    const dialog = await screen.findByRole('dialog', { name: 'Live Weather details' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(document.querySelector('.admin-main')).toHaveAttribute('inert')
    expect(document.querySelector('#primary-navigation')).toHaveAttribute('inert')
    expect(document.querySelector('.detail-scrim')).toHaveAttribute('aria-hidden', 'true')
    const close = within(dialog).getByRole('button', { name: 'Close selected API details' })
    await waitFor(() => expect(close).toHaveFocus())

    const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    const last = focusable.at(-1)
    expect(last).toBeDefined()
    last?.focus()
    fireEvent.keyDown(last as HTMLElement, { key: 'Tab' })
    expect(close).toHaveFocus()

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()

    fireEvent.keyDown(last as HTMLElement, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Live Weather details' })).not.toBeInTheDocument())
    await waitFor(() => expect(weatherRadio).toHaveFocus())
    expect(document.querySelector('.admin-main')).not.toHaveAttribute('inert')
  })

  it('keeps focus in the selected API context when the compact detail drawer becomes a desktop panel', async () => {
    const viewport = responsiveMatchMedia(900)
    vi.stubGlobal('matchMedia', viewport.matchMedia)
    render(<App />)

    const weatherRadio = screen.getByRole('radio', { name: 'Select Live Weather' })
    weatherRadio.focus()
    fireEvent.click(weatherRadio)

    const dialog = await screen.findByRole('dialog', { name: 'Live Weather details' })
    const close = within(dialog).getByRole('button', { name: 'Close selected API details' })
    await waitFor(() => expect(close).toHaveFocus())

    act(() => viewport.setWidth(1440))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close selected API details' })).not.toBeInTheDocument())
    await waitFor(() => expect(within(document.querySelector('.detail-panel') as HTMLElement).getByRole('heading', { name: 'Live Weather' })).toHaveFocus())
    expect(document.querySelector('.detail-panel')).not.toHaveAttribute('inert')
  })

  it('restores the mobile menu trigger when activating the already-current route closes mobile navigation', async () => {
    vi.stubGlobal('matchMedia', matchMediaAt(390))
    render(<App />)

    const menu = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(menu)
    const navigation = await screen.findByRole('dialog', { name: 'Primary navigation' })
    const close = within(navigation).getByRole('button', { name: 'Close navigation menu' })
    await waitFor(() => expect(close).toHaveFocus())

    fireEvent.click(within(navigation).getByRole('button', { name: 'API Catalog' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Primary navigation' })).not.toBeInTheDocument())
    await waitFor(() => expect(menu).toHaveFocus())
    expect(document.querySelector('#primary-navigation')).toHaveAttribute('inert')
  })

  it('hands focus from the mobile-only navigation close control to the active desktop navigation item at the 760px breakpoint', async () => {
    const viewport = responsiveMatchMedia(390)
    vi.stubGlobal('matchMedia', viewport.matchMedia)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const navigation = await screen.findByRole('dialog', { name: 'Primary navigation' })
    const close = within(navigation).getByRole('button', { name: 'Close navigation menu' })
    await waitFor(() => expect(close).toHaveFocus())

    // Real browsers may blur a control as soon as a media query hides it, before
    // the matchMedia change listener runs. The breakpoint handoff must rely on
    // the open-modal state rather than a timing-sensitive activeElement check.
    close.blur()
    expect(close).not.toHaveFocus()

    act(() => viewport.setWidth(900))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Primary navigation' })).not.toBeInTheDocument())
    const activeNavigationItem = screen.getByRole('button', { name: 'API Catalog' })
    await waitFor(() => expect(activeNavigationItem).toHaveFocus())
    expect(document.querySelector('#primary-navigation')).not.toHaveAttribute('inert')
  })


  it('reflects ordered-range SSOT constraints in native inputs and blocks reversed ranges before provider execution', async () => {
    window.location.hash = '#/request-lab?api=open-meteo-history'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    const startDate = screen.getByLabelText('Start date')
    const endDate = screen.getByLabelText('End date')
    expect(endDate).toHaveAttribute('min', '2025-01-01')

    fireEvent.change(startDate, { target: { value: '2025-01-10' } })
    expect(endDate).toHaveAttribute('min', '2025-01-10')
    fireEvent.change(endDate, { target: { value: '2025-01-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Try live API' }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(endDate).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('End date must be on or after Start date.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Historical Weather request output' })).toHaveAttribute('data-request-state', 'idle')
  })

  it('uses the Canada Open Data field SSOT to block blank keywords and fractional rows for humans and WebMCP before provider execution', async () => {
    window.location.hash = '#/request-lab?api=canada-open-data-search'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    type RegisteredTool = {
      name: string
      execute: (input: Record<string, unknown>) => unknown | Promise<unknown>
    }
    const registered = new Map<string, RegisteredTool>()
    const registerTool = vi.fn(async (tool: RegisteredTool) => { registered.set(tool.name, tool) })
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool } })

    render(<App />)
    await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(5))

    const query = screen.getByRole('textbox', { name: 'Catalogue search' })
    const limit = screen.getByRole('spinbutton', { name: 'Results' })
    expect(query).toHaveAttribute('minlength', '1')
    expect(limit).toHaveAttribute('step', '1')

    fireEvent.change(query, { target: { value: 'climate' } })
    fireEvent.change(limit, { target: { value: '3.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Try live API' }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(limit).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Results must use increments of 1.')).toBeInTheDocument()

    fireEvent.change(limit, { target: { value: '3' } })
    fireEvent.change(query, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Try live API' }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(query).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Catalogue search is required.')).toBeInTheDocument()

    const runTool = registered.get('run_public_api_demo')
    await act(async () => {
      await expect(runTool?.execute({ id: 'canada-open-data-search', parameters: { query: 'climate', limit: '3.5' } })).rejects.toThrow('Results must use increments of 1.')
      await expect(runTool?.execute({ id: 'canada-open-data-search', parameters: { query: '   ', limit: '3' } })).rejects.toThrow('Catalogue search is required.')
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(document.querySelector('.request-lab')).toHaveAttribute('data-request-state', 'idle')
  })

  it('labels the Health workspace as static catalog metadata rather than current provider health', () => {
    window.location.hash = '#/health'
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Health', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Catalog readiness', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Static catalog metadata only. Run an API in Request Lab to verify current provider and browser health.')).toBeInTheDocument()
    expect(screen.getAllByText('Catalog risk: Low').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Open Request Lab' }))
    expect(window.location.hash).toBe('#/request-lab?api=countries')
    expect(screen.getByRole('heading', { name: 'Request lab' })).toBeInTheDocument()
  })

  it('exposes deterministic request state and error semantics for browser agents', async () => {
    window.location.hash = '#/request-lab?api=countries'
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
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByRole('combobox', { name: 'Interface language' }), { target: { value: 'zh-CN' } })
    const localizedAlert = await screen.findByRole('alert', { name: '请求失败：rate-limit' })
    expect(localizedAlert).toHaveTextContent('错误类型：rate-limit; HTTP 429')
    expect(screen.getByRole('region', { name: 'Country Explorer 请求输出' })).toHaveAttribute('data-error-type', 'rate-limit')
    expect(fetchMock).toHaveBeenCalledTimes(1)
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

  it('generates reusable code for non-JSON responses without the removed Yahoo relay parser', () => {
    window.location.hash = '#/request-lab?api=go-module-proxy'
    const { unmount } = render(<App />)
    expect(document.querySelector('.request-lab')).toHaveAttribute('data-response-type', 'text')
    expect(document.querySelector('.request-lab')).toHaveAttribute('data-response-content-types', 'text/plain')
    expect(screen.getByRole('tab', { name: 'Response details' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy details' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Raw JSON' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Fetch code' }))
    let panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent('await response.text()')
    expect(panel).toHaveTextContent("response.headers.get('content-type')")
    expect(panel).toHaveTextContent('text/plain')
    expect(panel).toHaveTextContent('acceptedContentTypes.includes(contentType)')
    expect(panel).not.toHaveTextContent('await response.json()')
    expect(panel).not.toHaveTextContent('Markdown Content:')
    unmount()

    window.location.hash = '#/request-lab?api=qr-code-generator'
    render(<App />)
    expect(document.querySelector('.request-lab')).toHaveAttribute('data-response-type', 'image')
    expect(document.querySelector('.request-lab')).toHaveAttribute('data-response-content-types', 'image/png')
    expect(screen.getByRole('tab', { name: 'Response details' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy details' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Raw JSON' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Fetch code' }))
    panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent('image/png')
    expect(panel).toHaveTextContent('acceptedContentTypes.includes(contentType)')
    expect(panel).toHaveTextContent('Expected response Content-Type: image/png.')
    expect(panel).toHaveTextContent('await response.blob()')
    expect(panel).not.toHaveTextContent('await response.json()')
  })

  it('generates WoRMS fetch code that preserves the provider-documented 204 no-match contract', () => {
    window.location.hash = '#/request-lab?api=worms-species-lookup'
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Fetch code' }))
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveTextContent('response.status')
    expect(panel).toHaveTextContent('204')
    expect(panel).toHaveTextContent('JSON.parse')
  })

  it('associates Request Lab field help with native controls', () => {
    window.location.hash = '#/request-lab?api=countries'
    render(<App />)

    const control = screen.getByRole('textbox', { name: 'Country code' })
    expect(control).toHaveAttribute('aria-describedby', 'parameter-code-help')
    expect(document.getElementById('parameter-code-help')).toHaveTextContent('Use an ISO 3166-1 alpha-2 or alpha-3 country code such as SG or SGP.')
  })

  it('exposes whole-year World Bank constraints on native number controls', () => {
    window.location.hash = '#/request-lab?api=world-bank-indicator-explorer'
    render(<App />)

    expect(screen.getByRole('spinbutton', { name: 'Start year' })).toHaveAttribute('step', '1')
    expect(screen.getByRole('spinbutton', { name: 'End year' })).toHaveAttribute('step', '1')
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

  it('exposes the generated machine catalog as an ordinary DOM fallback for agents', () => {
    window.location.hash = '#/agent-tools'
    render(<App />)
    const link = screen.getByRole('link', { name: /Machine-readable API catalog/ })
    expect(link).toHaveAttribute('href', '/api-catalog.json')
    expect(link).toHaveAttribute('data-agent-catalog', 'api-catalog-json')
    expect(link).toHaveTextContent('JSON · generated from the same API SSOT')
  })

  it('keeps WebMCP registrations stable when the selected API changes', async () => {
    window.location.hash = '#/request-lab?api=countries'
    type RegisteredTool = { execute: (input: Record<string, unknown>) => unknown | Promise<unknown> }
    const registered = new Map<string, RegisteredTool>()
    const registrationSignals: AbortSignal[] = []
    const registerTool = vi.fn(async (tool: RegisteredTool & { name: string }, options?: { signal?: AbortSignal }) => {
      registered.set(tool.name, tool)
      if (options?.signal) registrationSignals.push(options.signal)
    })
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool } })

    render(<App />)
    await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(5))

    await act(async () => {
      await registered.get('open_public_api_demo')?.execute({ id: 'weather' })
    })
    await waitFor(() => expect(screen.getByRole('form', { name: 'Configure Live Weather' })).toHaveAttribute('data-api-id', 'weather'))
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect(registerTool).toHaveBeenCalledTimes(5)
    expect(registrationSignals).toHaveLength(5)
    expect(registrationSignals.every((signal) => !signal.aborted)).toBe(true)
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
      demos: Array<{ category: string; responseType: string; requestLabUrl: string; parameters: Array<{ id: string; min?: number; max?: number; options?: Array<{ label: string; value: string }> }> }>
    }

    expect(result.total).toBe(196)
    expect(result.count).toBe(1)
    expect(result.category).toBe('People')
    expect(result.demos[0]?.category).toBe('People')
    expect(result.demos[0]?.responseType).toBe('json')
    expect(new URL(result.demos[0]?.requestLabUrl ?? 'http://invalid/').hash).toBe('#/request-lab?api=people')
    expect(result.demos[0]?.parameters.find((field) => field.id === 'count')).toMatchObject({ min: 1, max: 10 })
    expect(result.demos[0]?.parameters.find((field) => field.id === 'nationality')?.options).toContainEqual({ label: 'Australia', value: 'au' })

    const geoResult = await listTool?.execute({ query: 'geoBoundaries', category: 'Geo' }) as {
      demos: Array<{ parameters: Array<{ id: string; minLength?: number; maxLength?: number; options?: Array<{ label: string; value: string }> }> }>
    }
    expect(geoResult.demos).toHaveLength(1)
    expect(geoResult.demos[0]?.parameters.find((field) => field.id === 'countryIso')).toMatchObject({ minLength: 3, maxLength: 3 })
    expect(geoResult.demos[0]?.parameters.find((field) => field.id === 'adminLevel')?.options).toContainEqual({ label: 'ADM3', value: 'ADM3' })

    const taskResult = await listTool?.execute({ query: 'package deprecation', category: 'Developer' }) as {
      demos: Array<{ id: string; keywords?: string[] }>
    }
    expect(taskResult.demos.map((demo) => demo.id)).toEqual(['deps-dev'])

    const imageResult = await listTool?.execute({ query: 'QR Code Generator', category: 'Utility' }) as {
      demos: Array<{ id: string; responseType?: string; responseContentTypes?: string[] }>
    }
    expect(imageResult.demos).toEqual([expect.objectContaining({ id: 'qr-code-generator', responseType: 'image', responseContentTypes: ['image/png'] })])

    const textResult = await listTool?.execute({ query: 'Go Module Proxy', category: 'Developer' }) as {
      demos: Array<{ id: string; responseType?: string; responseContentTypes?: string[] }>
    }
    expect(textResult.demos).toEqual([expect.objectContaining({ id: 'go-module-proxy', responseType: 'text', responseContentTypes: ['text/plain'] })])

    const npmSearchResult = await listTool?.execute({ query: 'npm Registry Search', category: 'Developer' }) as {
      demos: Array<{ id: string; parameters: Array<{ id: string; min?: number; max?: number; step?: number }> }>
    }
    expect(npmSearchResult.demos).toHaveLength(1)
    expect(npmSearchResult.demos[0]?.id).toBe('npm-search')
    expect(npmSearchResult.demos[0]?.parameters.find((field) => field.id === 'limit')).toMatchObject({ min: 1, max: 20, step: 1 })

    expect(taskResult.demos[0]?.keywords).toContain('package deprecation')

    const rangeResult = await listTool?.execute({ query: 'Historical Weather', category: 'Weather' }) as {
      demos: Array<{ parameters: Array<{ id: string; minimumFromField?: string }> }>
    }
    expect(rangeResult.demos).toHaveLength(1)
    expect(rangeResult.demos[0]?.parameters.find((field) => field.id === 'endDate')).toMatchObject({ minimumFromField: 'startDate' })

    const worldBankResult = await listTool?.execute({ query: 'World Bank Indicator', category: 'Economy' }) as {
      demos: Array<{ parameters: Array<{ id: string; step?: number }> }>
    }
    expect(worldBankResult.demos).toHaveLength(1)
    expect(worldBankResult.demos[0]?.parameters.find((field) => field.id === 'startYear')).toMatchObject({ step: 1 })
    expect(worldBankResult.demos[0]?.parameters.find((field) => field.id === 'endYear')).toMatchObject({ step: 1 })

    const bankOfCanadaResult = await listTool?.execute({ query: 'Bank of Canada Valet', category: 'Finance' }) as {
      demos: Array<{ parameters: Array<{ id: string; minLength?: number; pattern?: string }> }>
    }
    expect(bankOfCanadaResult.demos).toHaveLength(1)
    expect(bankOfCanadaResult.demos[0]?.parameters.find((field) => field.id === 'series')).toMatchObject({
      minLength: 1,
      pattern: '[A-Za-z0-9_.-]+',
    })
  })

  it('does not auto-run a manual-only provider from the catalog quick action', async () => {
    window.location.hash = '#/catalog'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search catalog' }), { target: { value: 'LanguageTool' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Select LanguageTool Grammar Check' }))
    const quickAction = await screen.findByRole('button', { name: 'Open interactive Request Lab' })
    expect(quickAction).toHaveAttribute('data-agent-execution', 'manual-only')
    expect(screen.queryByRole('button', { name: 'Copy fetch' })).not.toBeInTheDocument()
    fireEvent.click(quickAction)

    await waitFor(() => expect(window.location.hash).toContain('#/request-lab?api=languagetool-grammar-check'))
    await waitFor(() => expect(document.querySelector('.request-lab')).toHaveAttribute('data-request-state', 'idle'))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Agent execution restriction')).toHaveTextContent('prohibits automated requests')
  }, 12000)

  it('exposes enabled OpenAlex 429 backoff policy through ordinary DOM and WebMCP discovery', async () => {
    window.location.hash = '#/request-lab?api=openalex-works-search'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    type RegisteredTool = {
      name: string
      execute: (input: Record<string, unknown>) => unknown | Promise<unknown>
    }
    const registered = new Map<string, RegisteredTool>()
    const registerTool = vi.fn(async (tool: RegisteredTool) => { registered.set(tool.name, tool) })
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool } })

    render(<App />)
    await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(5))
    const lab = document.querySelector('.request-lab')
    expect(lab).toHaveAttribute('data-api-id', 'openalex-works-search')
    expect(lab).toHaveAttribute('data-automated-verification', 'enabled')
    expect(lab).toHaveAttribute('data-verification-retry-on-rate-limit', 'false')

    const listTool = registered.get('list_public_api_demos')
    const discovery = await listTool?.execute({ query: 'OpenAlex', category: 'Research' }) as {
      demos: Array<{ automatedVerification: { mode: string; retryOnRateLimit?: boolean; policyUrl?: string } }>
    }
    expect(discovery.demos).toHaveLength(1)
    expect(discovery.demos[0]?.automatedVerification).toMatchObject({
      mode: 'enabled',
      retryOnRateLimit: false,
      policyUrl: 'https://help.openalex.org/api/errors/',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('exposes GitHub 403/429 rate-limit backoff statuses through ordinary DOM and WebMCP discovery', async () => {
    window.location.hash = '#/request-lab?api=github'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    type RegisteredTool = {
      name: string
      execute: (input: Record<string, unknown>) => unknown | Promise<unknown>
    }
    const registered = new Map<string, RegisteredTool>()
    const registerTool = vi.fn(async (tool: RegisteredTool) => { registered.set(tool.name, tool) })
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool } })

    render(<App />)
    await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(5))
    const lab = document.querySelector('.request-lab')
    expect(lab).toHaveAttribute('data-api-id', 'github')
    expect(lab).toHaveAttribute('data-automated-verification', 'enabled')
    expect(lab).toHaveAttribute('data-verification-retry-on-rate-limit', 'false')
    expect(lab).toHaveAttribute('data-verification-rate-limit-statuses', '403,429')

    const listTool = registered.get('list_public_api_demos')
    const discovery = await listTool?.execute({ query: 'GitHub Public Repos', category: 'Developer' }) as {
      demos: Array<{ automatedVerification: { mode: string; retryOnRateLimit?: boolean; rateLimitStatuses?: number[]; policyUrl?: string } }>
    }
    expect(discovery.demos).toHaveLength(1)
    expect(discovery.demos[0]?.automatedVerification).toMatchObject({
      mode: 'enabled',
      retryOnRateLimit: false,
      rateLimitStatuses: [403, 429],
      policyUrl: 'https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('publishes manual-only provider policy to agents and blocks structured execution without blocking human use', async () => {
    window.location.hash = '#/request-lab?api=languagetool-grammar-check'
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ matches: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    type RegisteredTool = {
      name: string
      inputSchema: { properties?: { id?: { enum?: string[] } } }
      execute: (input: Record<string, unknown>) => unknown | Promise<unknown>
    }
    const registered = new Map<string, RegisteredTool>()
    const registerTool = vi.fn(async (tool: RegisteredTool) => { registered.set(tool.name, tool) })
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool } })

    render(<App />)
    await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(5))

    const form = screen.getByRole('form', { name: 'Configure LanguageTool Grammar Check' })
    expect(form).toHaveAttribute('data-agent-execution', 'manual-only')
    expect(document.querySelector('.request-lab')).toHaveAttribute('data-agent-execution', 'manual-only')
    const restriction = screen.getByLabelText('Agent execution restriction')
    expect(restriction).toHaveTextContent('Interactive use only')
    expect(restriction).toHaveTextContent('prohibits automated requests')
    expect(within(restriction).getByRole('link', { name: /Provider policy/ })).toHaveAttribute('href', 'https://dev.languagetool.org/public-http-api.html')
    const humanRun = screen.getByRole('button', { name: 'Try live API' })
    expect(humanRun).toHaveAttribute('data-agent-execution', 'manual-only')
    expect(humanRun).toHaveAttribute('aria-describedby', 'agent-execution-policy-languagetool-grammar-check')
    expect(screen.queryByRole('tab', { name: 'Fetch code' })).not.toBeInTheDocument()

    const listTool = registered.get('list_public_api_demos')
    const discovery = await listTool?.execute({ query: 'LanguageTool', category: 'Language' }) as {
      demos: Array<{ id: string; usageNote?: string; agentExecution: { mode: string; reason?: string; policyUrl?: string } }>
    }
    expect(discovery.demos).toHaveLength(1)
    expect(discovery.demos[0]).toMatchObject({ id: 'languagetool-grammar-check', agentExecution: { mode: 'manual-only' } })
    expect(discovery.demos[0]?.agentExecution.reason).toContain('prohibits automated requests')
    expect(discovery.demos[0]?.agentExecution.policyUrl).toBe('https://dev.languagetool.org/public-http-api.html')
    expect(discovery.demos[0]?.usageNote).toContain('interactive, human-driven checks')

    const archiveDiscovery = await listTool?.execute({ query: 'Internet Archive Search', category: 'Media' }) as {
      demos: Array<{ id: string; usageNote?: string; agentExecution: { mode: string; reason?: string; policyUrl?: string } }>
    }
    expect(archiveDiscovery.demos).toHaveLength(1)
    expect(archiveDiscovery.demos[0]).toMatchObject({
      id: 'internet-archive-search',
      agentExecution: { mode: 'manual-only', policyUrl: 'https://archive.org/developers/bots.html' },
    })
    expect(archiveDiscovery.demos[0]?.agentExecution.reason).toContain('descriptive User-Agent')
    expect(archiveDiscovery.demos[0]?.usageNote).toContain('Human-triggered interactive searches')

    const runTool = registered.get('run_public_api_demo')
    expect(runTool?.inputSchema.properties?.id?.enum).not.toContain('languagetool-grammar-check')
    expect(runTool?.inputSchema.properties?.id?.enum).not.toContain('nominatim-search')
    expect(runTool?.inputSchema.properties?.id?.enum).not.toContain('circl-vulnerability')
    expect(runTool?.inputSchema.properties?.id?.enum).not.toContain('internet-archive-search')
    expect(runTool?.inputSchema.properties?.id?.enum).toContain('color-api')
    await expect(runTool?.execute({ id: 'languagetool-grammar-check' })).rejects.toThrow('AGENT_EXECUTION_BLOCKED')
    await expect(runTool?.execute({ id: 'internet-archive-search' })).rejects.toThrow('AGENT_EXECUTION_BLOCKED')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(document.querySelector('.request-lab')).toHaveAttribute('data-request-state', 'idle')

    fireEvent.click(humanRun)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(document.querySelector('.request-lab')).toHaveAttribute('data-request-state', 'success'))
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
    expect(selectPreviewLayout({ id: 'dogs', category: 'Nature' })).toBe('dog-gallery')
    expect(selectPreviewLayout({ id: 'rick-morty-characters', category: 'Entertainment' })).toBe('character-search')
    expect(selectPreviewLayout({ id: 'wikipedia-search', category: 'Knowledge' })).toBe('encyclopedia-search')
    expect(selectPreviewLayout({ id: 'usgs', category: 'Geo' })).toBe('location-map')
    expect(selectPreviewLayout({ id: 'where-the-iss-at', category: 'Geo' })).toBe('iss-position')
    expect(selectPreviewLayout({ id: 'holidays', category: 'Calendar' })).toBe('public-holiday-calendar')
    expect(selectPreviewLayout({ id: 'sunrise-sunset', category: 'Calendar' })).toBe('solar-cycle')
    expect(selectPreviewLayout({ id: 'nasa-eonet-events', category: 'Nature' })).toBe('natural-events')
    expect(selectPreviewLayout({ id: 'inaturalist-observations', category: 'Biodiversity' })).toBe('species-observations')
    expect(selectPreviewLayout({ id: 'mbta-transit-routes', category: 'Utility' })).toBe('transit-board')
    expect(selectPreviewLayout({ id: 'open-trivia', category: 'Games' })).toBe('trivia-game')
    expect(selectPreviewLayout({ id: 'jokeapi-safe', category: 'Games' })).toBe('joke-stage')
    expect(selectPreviewLayout({ id: 'poetrydb-poems', category: 'Books' })).toBe('poetry-reading-room')
    expect(selectPreviewLayout({ id: 'geocoding-search', category: 'Geo' })).toBe('place-geocoding')
    expect(selectPreviewLayout({ id: 'carbon-intensity-gb', category: 'Environment' })).toBe('carbon-intensity')
    expect(selectPreviewLayout({ id: 'usgs-water-legacy', category: 'Environment' })).toBe('water-gauge')
    expect(selectPreviewLayout({ id: 'uk-police-street-crime', category: 'Government' })).toBe('street-crime')
    expect(selectPreviewLayout({ id: 'nhtsa-vehicle-recalls', category: 'Vehicle' })).toBe('vehicle-recalls')
    expect(selectPreviewLayout({ id: 'github', category: 'Developer' })).toBe('repository-list')
    expect(selectPreviewLayout({ id: 'nvd-cves', category: 'Developer' })).toBe('nvd-cve-search')
    expect(selectPreviewLayout({ id: 'nvd-recent-cves', category: 'Developer' })).toBe('nvd-modified-watchlist')
    expect(selectPreviewLayout({ id: 'geoboundaries-admin-boundaries', category: 'Geo' })).toBe('boundary-layer')
    expect(selectPreviewLayout({ id: 'ipwhois-lookup', category: 'Developer' })).toBe('ip-geolocation')
    expect(selectPreviewLayout({ id: 'fiscal-data-treasury', category: 'Finance' })).toBe('federal-agency-overview')
    expect(selectPreviewLayout({ id: 'usaspending', category: 'Government' })).toBe('federal-awards')
    expect(selectPreviewLayout({ id: 'uk-flood-monitoring', category: 'Environment' })).toBe('flood-stations')
    expect(selectPreviewLayout({ id: 'fema-disasters', category: 'Government' })).toBe('disaster-declared-areas')
    expect(selectPreviewLayout({ id: 'malaysia-core-cpi', category: 'Economy' })).toBe('core-cpi-index')
    expect(selectPreviewLayout({ id: 'malaysia-household-income', category: 'Economy' })).toBe('household-income')
    expect(selectPreviewLayout({ id: 'malaysia-population', category: 'Economy' })).toBe('population-total')
    expect(selectPreviewLayout({ id: 'hdx-humanitarian-datasets', category: 'Data' })).toBe('humanitarian-events')
    expect(selectPreviewLayout({ id: 'uk-food-hygiene', category: 'Food' })).toBe('food-hygiene-ratings')
    expect(selectPreviewLayout({ id: 'eurostat-population', category: 'Economy' })).toBe('population-statistic')
    expect(selectPreviewLayout({ id: 'unhcr-refugees', category: 'Data' })).toBe('refugee-population')
    expect(selectPreviewLayout({ id: 'mlb-stats-api', category: 'Sports' })).toBe('baseball-schedule')
    expect(selectPreviewLayout({ id: 'free-dictionary', category: 'Language' })).toBe('dictionary-entry')
  })

  it('maps fourth-round catalog additions to explicit preview layouts', () => {
    const catalogById = Object.fromEntries(apiCatalog.map((api) => [api.id, api]))
    const expected: Record<string, string> = {
      'openssf-scorecard': 'security-scorecard',
      'opencitations-index': 'citation-count',
      'vam-collections': 'collection-index',
      'art-institute-search': 'public-domain-art-search',
      'usaspending': 'federal-awards',
      'fiscal-data-treasury': 'federal-agency-overview',
      'wikidata-sparql': 'knowledge-entities',
      'met-museum-object-detail': 'met-open-access-object',
      'met-museum-search': 'collection-index',
    }

    for (const [id, layout] of Object.entries(expected)) {
      const api = catalogById[id]
      expect(api, `Missing API ${id}`).toBeDefined()
      if (!api) continue
      expect(selectPreviewLayout({ id, category: api.category })).toBe(layout)
    }
  })

  it('keeps dedicated semantic adapters aligned with domain-meaningful machine layout metadata', () => {
    const expected: Record<string, string> = {
      'data-gov-carpark': 'availability-board',
      'met-museum-search': 'collection-index',
      'nhtsa-vpic': 'manufacturer-directory',
      'gbif-species-search': 'taxonomy-directory',
      'openf1-historical': 'motorsport-results',
      'animechan-random-quote': 'quote-card',
      'swapi-people': 'character-dossier',
      'noaa-tides': 'coastal-water-level',
      'openligadb-matches': 'football-matchday',
      'mlb-stats-api': 'baseball-schedule',
      'go-module-proxy': 'go-module-versions',
      'jsdelivr-package': 'cdn-package',
      devto: 'community-articles',
      'nvd-cpe-search': 'cpe-product-search',
      'nvd-cve-detail': 'nvd-vulnerability',
      'nvd-cves': 'nvd-cve-search',
      'ror-search': 'organization-directory',
    }

    for (const [id, layout] of Object.entries(expected)) {
      const api = apiCatalog.find((candidate) => candidate.id === id)
      expect(api, `Missing API ${id}`).toBeDefined()
      if (!api) continue
      expect(selectPreviewLayout({ id, category: api.category })).toBe(layout)
    }
  })

  it('registers every catalog API in the fail-closed SSOT card registry', () => {
    const catalogIds = apiCatalog.map((api) => api.id).sort()
    expect([...apiSsotCardIds].sort()).toEqual(catalogIds)
    expect(apiSsotCardIds).toHaveLength(196)
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

  it('registers one distinct React component function for every catalog API', () => {
    const catalogIds = apiCatalog.map((api) => api.id).sort()
    const components = Object.values(apiPreviewComponents).filter((component) => component !== undefined)

    expect([...apiPreviewComponentIds].sort()).toEqual(catalogIds)
    expect(components).toHaveLength(196)
    expect(new Set(components).size).toBe(196)
    expect(new Set(components.map((component) => component.name)).size).toBe(196)
  })

  it('mounts an API-owned visual component for every catalog response', () => {
    const visualSignatures: string[] = []
    for (const candidate of apiCatalog) {
      const { container, unmount } = render(<ResponseDemoPreview api={candidate} data={{}}/>)
      const shell = container.querySelector('[data-webmcp-surface="api-demo-preview"]')
      expect(shell).toHaveAttribute('data-preview-component', candidate.id)
      expect(shell).toHaveAttribute('data-ssot-design', 'result-card-v2')
      expect(shell).toHaveAttribute('data-ssot-source', 'live-response')
      expect(shell).toHaveAttribute('data-provider', candidate.provider)
      expect(shell).toHaveAttribute('data-category', candidate.category)
      const component = container.querySelector(`[data-api-preview-component="${candidate.id}"]`)
      expect(component).toBeInTheDocument()
      expect(component).toHaveAttribute('data-card-design', 'api-owned-v2')
      expect(component).not.toHaveAttribute('style')
      visualSignatures.push(component?.getAttribute('data-visual-signature') ?? '')
      expect(container.querySelector('[data-preview-component="generic-fallback"]')).not.toBeInTheDocument()
      unmount()
    }
    expect(new Set(visualSignatures).size).toBe(196)
    expect(visualSignatures.every(Boolean)).toBe(true)
  })

  it('uses a user-facing result shell while keeping SSOT internals machine-readable', () => {
    const candidate = apiCatalog.find((api) => api.id === 'countries')
    if (!candidate) throw new Error('Missing countries fixture')
    const { container } = render(<ResponseDemoPreview api={candidate} data={{}} runtime={{ httpStatus: 200, elapsed: 128, size: 1536 }}/>)
    const preview = screen.getByRole('region', { name: 'Country Explorer' })

    expect(within(preview).getByText('Live response')).toBeInTheDocument()
    expect(within(preview).getByText('Country intelligence profile')).toBeInTheDocument()
    expect(within(preview).getByLabelText('API context')).toHaveTextContent('Provider · World Bank')
    expect(within(preview).getByLabelText('API context')).toHaveTextContent('Category · Data')
    expect(within(preview).getByLabelText('HTTP status 200')).toHaveTextContent('200 OK')
    expect(within(preview).getByLabelText('Response time 128 milliseconds')).toHaveTextContent('128 ms')
    expect(within(preview).getByLabelText('Response size 1.5 KB')).toHaveTextContent('1.5 KB')
    expect(container.querySelector('.demo-preview-note')).not.toBeInTheDocument()
    expect(within(preview).queryByText(/SSOT adapter:/)).not.toBeInTheDocument()
    expect(within(preview).getByRole('status')).toHaveTextContent('Live response received for Country Explorer.')
    expect(preview).not.toHaveAttribute('aria-live')
    expect(preview).toHaveAttribute('data-ssot-adapter', 'CountriesPreview')
  })

  it('localizes result-shell chrome without translating source-faithful API metadata or claiming semantic readiness', () => {
    const candidate = apiCatalog.find((api) => api.id === 'countries')
    if (!candidate) throw new Error('Missing countries fixture')
    render(<ResponseDemoPreview api={candidate} data={{}} runtime={{ httpStatus: 200, elapsed: 128, size: 1536 }} locale="zh-CN"/>)
    const preview = screen.getByRole('region', { name: 'Country Explorer' })

    expect(within(preview).getByRole('status')).toHaveTextContent('已收到 Country Explorer 的实时响应。')
    expect(within(preview).getByText('实时响应')).toBeInTheDocument()
    expect(within(preview).getByLabelText('API 上下文')).toHaveTextContent('提供方 · World Bank')
    expect(within(preview).getByLabelText('API 上下文')).toHaveTextContent('类别 · Data')
    expect(within(preview).getByLabelText('实时请求元数据')).toBeInTheDocument()
    expect(within(preview).getByLabelText('HTTP 状态 200')).toHaveTextContent('200 OK')
    expect(within(preview).getByLabelText('响应时间 128 毫秒')).toHaveTextContent('128 ms')
    expect(within(preview).getByLabelText('响应大小 1.5 KB')).toHaveTextContent('1.5 KB')
    expect(within(preview).getByRole('heading', { name: 'Country Explorer' })).toHaveAttribute('lang', 'en')
    expect(within(preview).getByText(candidate.description)).toHaveAttribute('lang', 'en')
    expect(within(preview).queryByText(/结果已就绪|result ready/i)).not.toBeInTheDocument()
  })

  it('gives single semantic records a full-width readable card contract', () => {
    const candidate = apiCatalog.find((api) => api.id === 'gbif-species-search')
    if (!candidate) throw new Error('Missing GBIF fixture')
    const requestUrl = candidate.buildUrl({ query: 'Felis catus' })
    const { container } = render(<ResponseDemoPreview api={candidate} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl }} data={{ offset: 0, limit: 8, endOfRecords: true, count: 1, results: [{ key: 2435099, scientificName: 'Felis catus', rank: 'SPECIES', taxonomicStatus: 'ACCEPTED', family: 'Felidae', genus: 'Felis' }] }}/>)
    const grid = container.querySelector('.semantic-card-grid')

    expect(grid).toHaveClass('single')
    expect(grid).toHaveAttribute('data-record-count', '1')
    expect(grid).toHaveAttribute('aria-label', 'Semantic response records')
    expect(grid?.querySelector('[data-record-index="1"]')).toBeInTheDocument()
    expect(within(grid as HTMLElement).getByText('Felis catus')).toBeInTheDocument()
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
    const candidate = api('open-meteo-air-quality')
    const executedRequest = { url: candidate.buildUrl({ latitude: '1.3521', longitude: '103.8198' }), method: 'GET' }
    render(<ResponseDemoPreview api={candidate} executedRequest={executedRequest} data={{
      latitude: 1.35,
      longitude: 103.85,
      timezone: 'Asia/Singapore',
      utc_offset_seconds: 28_800,
      current_units: { time: 'iso8601', interval: 'seconds', us_aqi: 'USAQI', pm2_5: 'μg/m³', pm10: 'μg/m³', nitrogen_dioxide: 'μg/m³', ozone: 'μg/m³' },
      current: { time: '2026-07-15T07:00', interval: 3600, us_aqi: 66, pm2_5: 19.6, pm10: 26.5, nitrogen_dioxide: 12.6, ozone: 56 },
    }}/>)
    const preview = screen.getByRole('region', { name: 'Global Air Quality' })
    expect(preview).toHaveAttribute('data-preview-variant', 'air-quality-forecast')
    expect(within(preview).getByText('U.S. AQI · Moderate')).toBeInTheDocument()
    expect(within(preview).getByText('19.6')).toBeInTheDocument()
  })

  it('renders a solar timeline from sunrise-sunset v2', () => {
    render(<ResponseDemoPreview api={api('sunrise-sunset')} data={{ date: '2026-07-15', tzid: 'Asia/Singapore', lat: 1.3521, lng: 103.8197, sunrise: '2026-07-15T07:03:51+08:00', sunset: '2026-07-15T19:17:33+08:00', solar_noon: '2026-07-15T13:10:42+08:00', first_light: '2026-07-15T05:50:49+08:00', last_light: '2026-07-15T20:30:35+08:00', day_length: 44022, moon_phase: 'New Moon' }} requestUrl={api('sunrise-sunset').buildUrl({ latitude: '1.3521', longitude: '103.8197', date: '2026-07-15' })} executedRequest={{ url: api('sunrise-sunset').buildUrl({ latitude: '1.3521', longitude: '103.8197', date: '2026-07-15' }), method: 'GET' }}/> )
    const preview = screen.getByRole('region', { name: 'Sunrise & Sunset' })
    expect(within(preview).getByText('12h 14m of daylight')).toBeInTheDocument()
    expect(within(preview).getByText('New Moon', { exact: false })).toBeInTheDocument()
  })

  it('renders NASA events, MBTA routes, and decoded trivia content', () => {
    const eonet = api('nasa-eonet-events')
    const eonetUrl = eonet.buildUrl({ category: 'wildfires', days: '30', limit: '6' })
    const { rerender } = render(<ResponseDemoPreview api={eonet} requestUrl={eonetUrl} executedRequest={{ method: 'GET', url: eonetUrl }} data={{ events: [{ id: 'EONET_7001', title: 'Pacific Wildfire', description: null, link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_7001', closed: null, categories: [{ id: 'wildfires', title: 'Wildfires' }], sources: [{ id: 'InciWeb', url: 'https://inciweb.wildfire.gov/' }], geometry: [{ date: '2026-07-13T11:54:00Z', type: 'Point', coordinates: [-94.39, 46.24], magnitudeValue: 503, magnitudeUnit: 'acres' }] }] }}/> )
    expect(screen.getByRole('region', { name: 'NASA Natural Events' })).toHaveTextContent('Pacific Wildfire')

    const mbta = api('mbta-transit-routes')
    const mbtaUrl = mbta.buildUrl({ routeType: '0,1' })
    rerender(<ResponseDemoPreview api={mbta} requestUrl={mbtaUrl} executedRequest={{ method: 'GET', url: mbtaUrl }} data={{ data: [{ type: 'route', id: 'Red', attributes: { type: 1, color: 'DA291C', text_color: 'FFFFFF', description: 'Rapid Transit', long_name: 'Red Line', short_name: '', direction_destinations: ['Ashmont/Braintree', 'Alewife'], direction_names: ['South', 'North'] } }] }}/> )
    expect(screen.getByRole('region', { name: 'MBTA Transit Routes' })).toHaveTextContent('Ashmont/Braintree ↔ Alewife')

    const triviaApi = api('open-trivia')
    const triviaUrl = triviaApi.buildUrl({ amount: '6', category: '9', difficulty: 'medium' })
    rerender(<ResponseDemoPreview api={triviaApi} requestUrl={triviaUrl} executedRequest={{ method: 'GET', url: triviaUrl }} data={{ response_code: 0, results: [{ type: 'multiple', category: 'General Knowledge', difficulty: 'medium', question: 'When did Halley&#039;s Comet appear?', correct_answer: '1976', incorrect_answers: ['2001', '1942', '1909'] }] }}/> )
    const trivia = screen.getByRole('region', { name: 'Trivia Challenge' })
    expect(trivia).toHaveTextContent("When did Halley's Comet appear?")
    expect(within(trivia).getByText('1976')).toBeInTheDocument()
  })
})

describe('new specialist API previews', () => {
  afterEach(cleanup)

  const api = (id: string) => {
    const match = apiCatalog.find((candidate) => candidate.id === id)
    if (!match) throw new Error(`Missing API fixture: ${id}`)
    return match
  }

  it('renders request-bound official Malaysia fuel levels and provider weekly movement', () => {
    const fuelApi = api('malaysia-fuel-price')
    const requestUrl = fuelApi.buildUrl({ limit: '12' })
    render(<ResponseDemoPreview api={fuelApi} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl }} data={[
      { date: '2026-07-09', ron95: 3.37, ron97: 4, diesel: 3.97, diesel_eastmsia: 2.15, ron95_budi95: 1.99, ron95_skps: 2.05, series_type: 'level' },
      { date: '2026-07-09', ron95: -0.1, ron97: -0.1, diesel: -0.1, diesel_eastmsia: 0, ron95_budi95: 0, ron95_skps: 0, series_type: 'change_weekly' },
      { date: '2026-07-01', ron95: 3.47, ron97: 4.1, diesel: 4.07, diesel_eastmsia: 2.15, ron95_budi95: 1.99, ron95_skps: 2.05, series_type: 'level' },
    ]}/> )
    const preview = screen.getByRole('region', { name: 'Malaysia Fuel Price' })
    expect(preview).toHaveAttribute('data-preview-layout', 'fuel-dashboard')
    expect(preview.querySelector('.fuel-preview')).toHaveAttribute('data-result-state', 'ready')
    expect(preview.querySelector('.fuel-preview')).toHaveAttribute('data-request-bound', 'true')
    expect(within(preview).getByText('RM 3.37')).toBeInTheDocument()
    expect(within(preview).getAllByText('↓ RM 0.1')).toHaveLength(3)
    expect(within(preview).getByText('East Malaysia diesel')).toBeInTheDocument()
    expect(within(preview).getByText('BUDI95')).toBeInTheDocument()
    expect(within(preview).getByText('SKPS')).toBeInTheDocument()
    expect(within(preview).getByRole('img', { name: 'RON95 price history sparkline' })).toBeInTheDocument()
  })

  it('maps marine hourly arrays into wave, temperature, and current readings', () => {
    const marineApi = api('open-meteo-marine')
    const hourlyTimes = Array.from({ length: 72 }, (_, index) => new Date(Date.UTC(2026, 6, 15, index)).toISOString().slice(0, 16))
    const hourlyValues = (value: number) => Array.from({ length: 72 }, () => value)
    render(<ResponseDemoPreview api={marineApi} requestUrl={marineApi.buildUrl({})} data={{
      latitude: 1.29, longitude: 103.79, timezone: 'Asia/Singapore', utc_offset_seconds: 28800,
      hourly_units: { time: 'iso8601', wave_height: 'm', wave_direction: '°', wave_period: 's', sea_surface_temperature: '°C', ocean_current_velocity: 'km/h', ocean_current_direction: '°' },
      hourly: { time: hourlyTimes, wave_height: hourlyValues(0.32), wave_direction: hourlyValues(155), wave_period: hourlyValues(2.9), sea_surface_temperature: hourlyValues(29.8), ocean_current_velocity: hourlyValues(1.8), ocean_current_direction: hourlyValues(127) },
    }}/>)
    const preview = screen.getByRole('region', { name: 'Marine Weather' })
    expect(preview).toHaveAttribute('data-preview-layout', 'marine-forecast')
    expect(within(preview).getAllByText('0.32', { exact: false }).length).toBeGreaterThan(0)
    expect(within(preview).getByText('29.8°C')).toBeInTheDocument()
    expect(within(preview).getByText('1.8 km/h')).toBeInTheDocument()
  })

  it('renders Nobel laureates and their official motivation', () => {
    const nobel = api('nobel-prizes')
    const requestUrl = nobel.buildUrl({ category: 'phy', limit: '6' })
    render(<ResponseDemoPreview api={nobel} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl }} data={{ nobelPrizes: [{ awardYear: '2024', category: { en: 'Physics' }, prizeAmount: 11000000, laureates: [{ knownName: { en: 'Geoffrey Hinton' }, motivation: { en: 'for foundational discoveries that enable machine learning' } }] }], meta: { offset: 0, limit: 6, nobelPrizeCategory: 'phy', count: 125 } }}/>)
    const preview = screen.getByRole('region', { name: 'Nobel Prize Explorer' })
    expect(preview).toHaveAttribute('data-preview-layout', 'awards-timeline')
    expect(within(preview).getByText('Geoffrey Hinton')).toBeInTheDocument()
    expect(preview).toHaveTextContent('foundational discoveries')
  })

  it('fails closed when a Nobel HTTP-success response contradicts the exact requested category', () => {
    const nobel = api('nobel-prizes')
    const requestUrl = nobel.buildUrl({ category: 'phy', limit: '2' })
    render(<ResponseDemoPreview api={nobel} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl }} data={{
      nobelPrizes: [{ awardYear: '2025', category: { en: 'Chemistry' }, prizeAmount: 11000000, laureates: [{ knownName: { en: 'Provider mismatch' } }] }],
      meta: { offset: 0, limit: 2, nobelPrizeCategory: 'che', count: 125 },
    }}/>)
    const preview = screen.getByRole('region', { name: 'Nobel Prize Explorer' })
    expect(preview.querySelector('[data-domain-card="nobel-prizes"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Provider mismatch')
  })

  it('binds AniList GraphQL media results to the executed POST variables', () => {
    const aniList = api('anilist-graphql')
    const parameters = { query: 'Cowboy Bebop', mediaType: 'ANIME', page: '1', limit: '2' }
    const executedRequest = { url: aniList.buildUrl(parameters), method: 'POST', body: aniList.buildBody?.(parameters) }
    render(<ResponseDemoPreview api={aniList} executedRequest={executedRequest} data={{
      data: {
        Page: {
          pageInfo: { total: 12, perPage: 2, currentPage: 1, hasNextPage: true },
          media: [{
            id: 1,
            title: { romaji: 'Cowboy Bebop', english: 'Cowboy Bebop' },
            coverImage: { medium: 'https://images.test/anilist-cowboy-bebop.jpg' },
            type: 'ANIME',
            format: 'TV',
            status: 'FINISHED',
            episodes: 26,
            startDate: { year: 1998, month: 4, day: 3 },
          }],
        },
      },
    }}/>)
    const preview = screen.getByRole('region', { name: 'AniList Media Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'anime-media-search')
    const card = preview.querySelector('[data-domain-card="anilist-media-search"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-search', 'Cowboy Bebop')
    expect(card).toHaveAttribute('data-requested-media-type', 'ANIME')
    expect(card).toHaveAttribute('data-page-match', 'true')
    expect(card).toHaveAttribute('data-per-page-match', 'true')
    expect(card).toHaveAttribute('data-valid-media-count', '1')
    expect(within(preview).getByRole('img')).toHaveAttribute('src', 'https://images.test/anilist-cowboy-bebop.jpg')
    expect(within(preview).getByText('Cowboy Bebop')).toBeInTheDocument()
  })

  it('fails AniList HTTP-success results closed when the provider media type contradicts the executed search', () => {
    const aniList = api('anilist-graphql')
    const parameters = { query: 'Cowboy Bebop', mediaType: 'ANIME', page: '1', limit: '1' }
    const executedRequest = { url: aniList.buildUrl(parameters), method: 'POST', body: aniList.buildBody?.(parameters) }
    render(<ResponseDemoPreview api={aniList} executedRequest={executedRequest} data={{
      data: { Page: { pageInfo: { perPage: 1, currentPage: 1, hasNextPage: false }, media: [{ id: 999, title: { romaji: 'Plausible but wrong manga' }, type: 'MANGA', coverImage: { medium: 'https://images.test/wrong.jpg' } }] } },
    }}/>)
    const preview = screen.getByRole('region', { name: 'AniList Media Search' })
    const card = preview.querySelector('[data-domain-card="anilist-media-search"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(within(preview).queryByText('Plausible but wrong manga')).not.toBeInTheDocument()
    expect(within(preview).queryByRole('img', { name: 'Plausible but wrong manga' })).not.toBeInTheDocument()
  })

  it('rejects AniList executed bodies that carry variables but do not use the bounded media-search contract', () => {
    const aniList = api('anilist-graphql')
    const parameters = { query: 'Cowboy Bebop', mediaType: 'ANIME', page: '1', limit: '1' }
    const built = aniList.buildBody?.(parameters) as { variables?: unknown }
    const executedRequest = { url: aniList.buildUrl(parameters), method: 'POST', body: { query: 'query { Page { media(type: MANGA) { id title { romaji } } } }', variables: built.variables } }
    render(<ResponseDemoPreview api={aniList} executedRequest={executedRequest} data={{
      data: { Page: { pageInfo: { perPage: 1, currentPage: 1, hasNextPage: false }, media: [{ id: 999, title: { romaji: 'Wrong contract result' }, type: 'MANGA', coverImage: { medium: 'https://images.test/wrong.jpg' } }] } },
    }}/>)
    const preview = screen.getByRole('region', { name: 'AniList Media Search' })
    const card = preview.querySelector('[data-domain-card="anilist-media-search"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(within(preview).queryByText('Wrong contract result')).not.toBeInTheDocument()
  })

  it('marks AniList GraphQL partial-data responses partial instead of ready', () => {
    const aniList = api('anilist-graphql')
    const parameters = { query: 'Cowboy Bebop', mediaType: 'ANIME', page: '1', limit: '1' }
    const executedRequest = { url: aniList.buildUrl(parameters), method: 'POST', body: aniList.buildBody?.(parameters) }
    render(<ResponseDemoPreview api={aniList} executedRequest={executedRequest} data={{
      errors: [{ message: 'One field resolver failed.' }],
      data: { Page: { pageInfo: { perPage: 1, currentPage: 1, hasNextPage: false }, media: [{ id: 1, title: { romaji: 'Cowboy Bebop' }, type: 'ANIME', coverImage: { medium: 'https://images.test/anilist-cowboy-bebop.jpg' } }] } },
    }}/>)
    const preview = screen.getByRole('region', { name: 'AniList Media Search' })
    const card = preview.querySelector('[data-domain-card="anilist-media-search"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-graphql-error-count', '1')
    expect(within(preview).getByText('Cowboy Bebop')).toBeInTheDocument()
  })

  it('renders HN search results through the dedicated request-bound composition', () => {
    const hn = api('hn-search-algolia')
    const requestUrl = hn.buildUrl({ query: 'OpenAI', tag: 'story', limit: '6' })
    render(<ResponseDemoPreview api={hn} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{
      hits: [{
        objectID: '321',
        title: 'How to ship offline-first',
        author: 'hacker',
        points: 57,
        num_comments: 12,
        created_at_i: 1722489600,
        story_text: 'A practical discussion for resilient systems.',
        _tags: ['story', 'author_hacker', 'story_321'],
      }],
      page: 0,
      nbHits: 1,
      nbPages: 1,
      hitsPerPage: 6,
      processingTimeMS: 2,
      query: 'OpenAI',
      params: 'query=OpenAI&tags=story&hitsPerPage=6',
    }}/>)
    const preview = screen.getByRole('region', { name: 'HN Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'hn-search')
    expect(preview.querySelector('[data-domain-card="hn-search"]')).toHaveAttribute('data-result-state', 'ready')
    expect(within(preview).getByText('How to ship offline-first')).toBeInTheDocument()
    expect(within(preview).getByText(/Hacker News story · hacker/)).toBeInTheDocument()
    expect(within(preview).getByText('12')).toBeInTheDocument()
    expect(within(preview).getByText('57 points')).toBeInTheDocument()
  })

  it('renders a Hacker News item through the request-bound type-aware composition', () => {
    const hn = api('hacker-news')
    const requestUrl = hn.buildUrl({ itemId: '8863' })
    render(<ResponseDemoPreview api={hn} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{
      by: 'dhouston', descendants: 71, id: 8863, kids: [9224, 8917], score: 104, time: 1175714200,
      title: 'My YC app: Dropbox - Throw away your USB drive', type: 'story', url: 'http://www.getdropbox.com/u/2/screencast.html',
    }}/>)
    const preview = screen.getByRole('region', { name: 'Hacker News API' })
    expect(preview).toHaveAttribute('data-preview-layout', 'hn-item')
    expect(preview.querySelector('[data-domain-card="hacker-news-item"]')).toHaveAttribute('data-result-state', 'ready')
    expect(within(preview).getByText('My YC app: Dropbox - Throw away your USB drive')).toBeInTheDocument()
    expect(within(preview).getByText('71')).toBeInTheDocument()
  })

  it('renders NHTSA campaign identity through the dedicated recall composition', () => {
    const recallApi = api('nhtsa-vehicle-recalls')
    const recallUrl = recallApi.buildUrl({ make: 'Honda', model: 'Accord', year: '2020' })
    render(<ResponseDemoPreview api={recallApi} requestUrl={recallUrl} executedRequest={{ url: recallUrl, method: 'GET' }} data={{
      Count: 1,
      results: [{
        Make: 'Honda',
        Model: 'Accord',
        ModelYear: '2020',
        NHTSACampaignNumber: '20V771000',
        Component: 'Engine',
        RecallType: 'Safety Recall',
        ReportReceivedDate: '2020-05-01',
      }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'NHTSA Vehicle Recalls' })
    expect(preview).toHaveAttribute('data-preview-layout', 'vehicle-recalls')
    expect(within(preview).getByText('20V771000')).toBeInTheDocument()
    expect(within(preview).getByText('Honda')).toBeInTheDocument()
  })

  it('renders AlAdhan prayer times with a request-bound daily schedule and calendar context', () => {
    const prayerApi = api('aladhan-prayer-times')
    const requestUrl = prayerApi.buildUrl({ latitude: '1.3521', longitude: '103.8198', method: '11', date: '2026-08-02' })
    render(<ResponseDemoPreview api={prayerApi} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{
      code: 200,
      status: 'OK',
      data: {
        timings: {
          Fajr: '05:12', Sunrise: '06:58', Dhuhr: '13:05', Asr: '16:25', Maghrib: '19:12', Isha: '20:34', Imsak: '05:02', Midnight: '01:05',
        },
        date: {
          readable: '02 Aug 2026',
          hijri: { date: '17-02-1448', year: '1448', month: { en: 'Safar' }, designation: { abbreviated: 'AH' } },
          gregorian: { date: '02-08-2026' },
        },
        meta: { latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore', school: 'STANDARD', method: { id: 11, name: 'Majlis Ugama Islam Singapura, Singapore' } },
      },
    }} />)
    const preview = screen.getByRole('region', { name: 'AlAdhan Prayer Times' })
    const schedule = within(preview).getByRole('list', { name: 'Daily prayer schedule' })
    expect(preview).toHaveAttribute('data-preview-layout', 'prayer-schedule')
    expect(preview.querySelector('.prayer-times-preview')).toHaveAttribute('data-result-state', 'ready')
    expect(preview.querySelector('.prayer-times-preview')).toHaveAttribute('data-request-date-match', 'true')
    expect(preview.querySelector('.prayer-times-preview')).toHaveAttribute('data-request-method-match', 'true')
    expect(preview.querySelector('.prayer-times-preview')).toHaveAttribute('data-request-coordinates-match', 'true')
    expect(preview.querySelector('.prayer-times-preview')).toHaveAttribute('data-primary-fajr-time', '05:12')
    expect(preview.querySelector('.prayer-times-preview')).toHaveAttribute('data-gregorian-date', '02-08-2026')
    expect(within(schedule).getByText('Fajr')).toBeInTheDocument()
    expect(within(schedule).getByText('05:12')).toBeInTheDocument()
    expect(within(preview).getByText('Majlis Ugama Islam Singapura, Singapore')).toBeInTheDocument()
    expect(within(preview).getByText('17-02-1448 AH')).toBeInTheDocument()
    expect(within(preview).getByText('Asia/Singapore')).toBeInTheDocument()
    expect(within(preview).getByText(/Hijri dates as mathematically calculated/)).toBeInTheDocument()
  })

  it('fails AlAdhan HTTP-success data closed when provider identity disagrees with the executed request', () => {
    const prayerApi = api('aladhan-prayer-times')
    const requestUrl = prayerApi.buildUrl({ latitude: '1.3521', longitude: '103.8198', method: '11', date: '2026-08-02' })
    render(<ResponseDemoPreview api={prayerApi} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{
      code: 200,
      status: 'OK',
      data: {
        timings: { Fajr: '05:12', Sunrise: '06:58', Dhuhr: '13:05', Asr: '16:25', Maghrib: '19:12', Isha: '20:34' },
        date: { gregorian: { date: '03-08-2026' } },
        meta: { latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore', method: { id: 11, name: 'Majlis Ugama Islam Singapura, Singapore' } },
      },
    }} />)
    const result = screen.getByRole('region', { name: 'AlAdhan Prayer Times' }).querySelector('[data-domain-card="prayer-schedule"]')
    expect(result).toHaveAttribute('data-result-state', 'invalid')
  })


  it('renders Packagist search results with package metadata', () => {
    render(<ResponseDemoPreview api={api('packagist-search')} requestUrl="https://packagist.org/search.json?q=laravel&per_page=8" data={{
      results: [{
        name: 'laravel/laravel',
        description: 'The Laravel framework.',
        url: 'https://packagist.org/packages/laravel/laravel',
        repository: 'https://github.com/laravel/laravel',
        downloads: 1200000,
        favers: 1500,
      }],
      total: 1,
      next: null,
    }}/>)
    const preview = screen.getByRole('region', { name: 'Packagist Package Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'composer-package-search')
    expect(within(preview).getByText('laravel/laravel')).toBeInTheDocument()
    expect(within(preview).getByText('The Laravel framework.')).toBeInTheDocument()
    expect(within(preview).getByText('1,200,000 downloads')).toBeInTheDocument()
  })

  it('renders request-bound Openverse licensed media results', async () => {
    const openverse = api('openverse-search')
    const requestUrl = openverse.buildUrl({ query: 'space', contentType: 'image', limit: '8' })
    render(<ResponseDemoPreview api={openverse} requestUrl={requestUrl} data={{
      page: 1, page_count: 1, page_size: 8, result_count: 1,
      results: [{
        id: '11111111-1111-4111-8111-111111111111', title: 'Neon city', creator: 'OpenVerse Demo',
        thumbnail: 'https://images.openverse.engineering/neon-city.jpg', url: 'https://images.openverse.engineering/neon-city-full.jpg',
        foreign_landing_url: 'https://example.test/neon-city', license: 'cc0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/', source: 'example', provider: 'example',
      }],
    }}/>)
    const preview = await screen.findByRole('region', { name: 'Openverse Media Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'licensed-media-search')
    expect(within(preview).getByRole('img')).toHaveAttribute('src', 'https://images.openverse.engineering/neon-city.jpg')
    expect(within(preview).getByText('Neon city')).toBeInTheDocument()
    expect(within(preview).getAllByText('cc0').length).toBeGreaterThan(0)
  })

  it('renders Apple iTunes results as request-bound semantic catalog cards without promotional media', async () => {
    const apple = api('apple-itunes-search')
    const requestUrl = apple.buildUrl({ query: 'Queen', entity: 'song', country: 'sg', limit: '1' })
    render(<ResponseDemoPreview api={apple} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl }} data={{
      resultCount: 1,
      results: [{
        trackId: 123,
        trackName: 'Bohemian Rhapsody',
        artistName: 'Queen',
        artworkUrl100: 'https://images.test/queen-bohemian.jpg',
        wrapperType: 'track',
        kind: 'song',
        trackViewUrl: 'https://music.apple.com/sg/album/example/123?i=123',
      }],
    }}/>)
    const preview = await screen.findByRole('region', { name: 'Apple iTunes Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'itunes-media-search')
    expect(preview.querySelector('[data-domain-card="apple-itunes-search"]')).toHaveAttribute('data-result-state', 'ready')
    expect(within(preview).queryByRole('img')).not.toBeInTheDocument()
    expect(within(preview).getByText('Bohemian Rhapsody')).toBeInTheDocument()
    expect(within(preview).getAllByText('Queen').length).toBeGreaterThan(0)
  })

  it('renders Hebcal through the dedicated request-bound Hebrew-year calendar', async () => {
    const requestUrl = 'https://www.hebcal.com/hebcal?v=1&cfg=json&year=5787&yt=H&month=x&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&s=on&leyning=off&i=off'
    render(<ResponseDemoPreview api={api('hebcal-calendar')} executedRequest={{ method: 'GET', url: requestUrl }} data={{
      title: 'Hebcal Diaspora 5787',
      range: { start: '2026-09-11', end: '2027-10-01' },
      items: [{
        date: '2026-09-12',
        hdate: '1 Tishrei 5787',
        title: 'Rosh Hashana 5787',
        hebrew: 'ראש השנה 5787',
        category: 'holiday',
        subcat: 'major',
        yomtov: true,
      }],
    }}/>)
    const preview = await screen.findByRole('region', { name: 'Hebcal Calendar' })
    expect(preview).toHaveAttribute('data-preview-layout', 'jewish-calendar')
    expect(preview.querySelector('[data-domain-card="hebcal-jewish-calendar"]')).toHaveAttribute('data-result-state', 'ready')
    expect(within(preview).getByText('Rosh Hashana 5787')).toBeInTheDocument()
    expect(within(preview).getByText('ראש השנה 5787')).toBeInTheDocument()
  })

  it('compares request-bound Lichess public ratings by chess mode', () => {
    const lichess = api('chess-player-stats')
    const requestUrl = lichess.buildUrl({ username: 'thibault' })
    render(<ResponseDemoPreview api={lichess} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{ id: 'thibault', username: 'thibault', url: 'https://lichess.org/@/thibault', perfs: { blitz: { games: 11856, rating: 1718, rd: 45, prog: 7 }, rapid: { games: 915, rating: 1802, rd: 68, prog: -75 } } }}/>)
    const preview = screen.getByRole('region', { name: 'Lichess Player Ratings' })
    expect(preview).toHaveAttribute('data-preview-layout', 'chess-ratings')
    expect(preview.querySelector('[data-domain-card="lichess-player-ratings"]')).toHaveAttribute('data-result-state', 'ready')
    expect(within(preview).getAllByText('1,802').length).toBeGreaterThan(0)
    expect(within(preview).getByText('Rapid')).toBeInTheDocument()
    expect(within(preview).getByText('915 games')).toBeInTheDocument()
  })

  it('turns Crossref work metadata into DOI research cards', () => {
    const crossref = api('crossref-works')
    const requestUrl = crossref.buildUrl({ query: 'agentic AI', rows: '1' })
    render(<ResponseDemoPreview api={crossref} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{
      status: 'ok',
      'message-type': 'work-list',
      'message-version': '1.0.0',
      message: {
        'items-per-page': 1,
        'total-results': 562402,
        query: { 'start-index': 0, 'search-terms': 'agentic AI' },
        items: [{ DOI: '10.1007/demo', URL: 'https://doi.org/10.1007/demo', title: ['Enterprise Agentic AI'], author: [{ given: 'Sumit', family: 'Ranjan' }], published: { 'date-parts': [[2025]] }, publisher: 'Apress', 'is-referenced-by-count': 12, type: 'book-chapter' }],
      },
    }}/>)
    const preview = screen.getByRole('region', { name: 'Crossref Works Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'scholarly-search')
    expect(preview.querySelector('[data-domain-card="crossref-works-search"]')).toHaveAttribute('data-result-state', 'ready')
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
    const noaaApi = api('noaa-space-weather')
    const noaaUrl = noaaApi.buildUrl({})
    const { rerender } = render(<ResponseDemoPreview api={noaaApi} requestUrl={noaaUrl} executedRequest={{ method: 'GET', url: noaaUrl }} data={{
      0: { DateStamp: '2026-07-15', TimeStamp: '06:37:00', R: { Scale: '0', Text: 'none' }, S: { Scale: '0', Text: 'none' }, G: { Scale: '1', Text: 'minor' } },
      1: { DateStamp: '2026-07-16', G: { Scale: '1', Text: 'minor' } },
    }}/>)
    expect(screen.getByRole('region', { name: 'NOAA Space Weather' })).toHaveTextContent('Geomagnetic storm')
    expect(screen.getByRole('region', { name: 'NOAA Space Weather' })).toHaveTextContent('Level 1')

    const floodApi = api('open-meteo-flood')
    rerender(<ResponseDemoPreview api={floodApi} requestUrl={floodApi.buildUrl({ latitude: '1.3521', longitude: '103.8198', days: '2' })} data={{ latitude: 1.375, longitude: 103.825, utc_offset_seconds: 0, timezone: 'GMT', timezone_abbreviation: 'GMT', daily_units: { time: 'iso8601', river_discharge: 'm³/s', river_discharge_mean: 'm³/s', river_discharge_max: 'm³/s' }, daily: { time: ['2026-07-15', '2026-07-16'], river_discharge: [1, 1.2], river_discharge_mean: [0.99, 1.3], river_discharge_max: [1.86, 2.17] } }}/>)
    expect(screen.getByRole('region', { name: 'Global Flood Forecast' })).toHaveTextContent('Forecast peak')
    expect(screen.getByRole('region', { name: 'Global Flood Forecast' })).toHaveTextContent('2.17 m³/s')
    expect(within(screen.getByRole('region', { name: 'Global Flood Forecast' })).getByRole('img', { name: 'Validated river discharge forecast sparkline' })).toBeInTheDocument()

    rerender(<ResponseDemoPreview api={api('open-meteo-history')} requestUrl={api('open-meteo-history').buildUrl({ startDate: '2025-01-01', endDate: '2025-01-02' })} data={{ latitude: 1.37, longitude: 103.8, utc_offset_seconds: 28800, timezone: 'Asia/Singapore', daily_units: { time: 'iso8601', temperature_2m_max: '°C', temperature_2m_min: '°C', precipitation_sum: 'mm' }, daily: { time: ['2025-01-01', '2025-01-02'], temperature_2m_max: [31, 32], temperature_2m_min: [24, 25], precipitation_sum: [1.2, 4.8] } }}/>)
    expect(screen.getByRole('region', { name: 'Historical Weather' })).toHaveTextContent('Average high')
    expect(screen.getByRole('region', { name: 'Historical Weather' })).toHaveTextContent('Total rain')
    expect(within(screen.getByRole('region', { name: 'Historical Weather' })).getByRole('img', { name: 'Response trend sparkline' })).toBeInTheDocument()

    const krakenApi = api('kraken-public-ticker')
    const krakenUrl = krakenApi.buildUrl({ pair: 'XBTUSD' })
    rerender(<ResponseDemoPreview api={krakenApi} requestUrl={krakenUrl} executedRequest={{ method: 'GET', url: krakenUrl }} data={{ error: [], result: { 'BTC/USD': { a: ['65010', '1', '1.000'], b: ['64990', '1', '1.000'], c: ['65000', '0.25'], v: ['100', '2500'], p: ['64500', '64250'], t: [100, 2500], l: ['63000', '62000'], h: ['65500', '66000'], o: '64000' } } }}/>)
    expect(screen.getByRole('region', { name: 'Kraken Market Ticker' })).toHaveTextContent('USD 65,000')
    expect(screen.getByRole('region', { name: 'Kraken Market Ticker' })).toHaveTextContent('Bid 64,990.00 · Ask 65,010.00')
    expect(screen.getByRole('region', { name: 'Kraken Market Ticker' }).querySelector('[data-domain-card="kraken-public-ticker"]')).toHaveAttribute('data-result-state', 'ready')
  })

  it('adapts security, regulation, Wikipedia search, and readership responses', async () => {
    const { rerender } = render(<ResponseDemoPreview api={api('osv-vulnerability')} data={{ id: 'GHSA-demo-1234', summary: 'Demo dependency vulnerability', published: '2026-07-01T00:00:00Z', modified: '2026-07-12T00:00:00Z', aliases: ['CVE-2026-1000'], affected: [{ package: { ecosystem: 'npm', name: 'demo-package' } }] }}/>)
    expect(screen.getByRole('region', { name: 'OSV Vulnerability' })).toHaveTextContent('GHSA-demo-1234')
    expect(screen.getByRole('region', { name: 'OSV Vulnerability' })).toHaveTextContent('demo-package')

    const federalRegisterApi = api('federal-register-documents')
    const federalRegisterUrl = federalRegisterApi.buildUrl({ query: 'artificial intelligence', limit: '8' })
    rerender(<ResponseDemoPreview api={federalRegisterApi} requestUrl={federalRegisterUrl} data={{ description: "Documents matching 'artificial intelligence'", count: 1, total_pages: 1, next_page_url: null, results: [{ document_number: '2026-10001', publication_date: '2026-07-15', type: 'Proposed Rule', title: 'Artificial Intelligence Safety Framework', abstract: 'A proposed federal framework.', agencies: [{ name: 'Science Office' }], html_url: 'https://www.federalregister.gov/documents/2026/07/15/2026-10001/artificial-intelligence-safety-framework' }] }}/>)
    const federalRegister = screen.getByRole('region', { name: 'Federal Register Documents' })
    expect(federalRegister).toHaveAttribute('data-preview-layout', 'federal-rulemaking')
    expect(federalRegister).toHaveTextContent('Artificial Intelligence Safety Framework')
    expect(federalRegister).toHaveTextContent('Science Office')

    const wikipediaApi = api('wikipedia-search')
    rerender(<ResponseDemoPreview api={wikipediaApi} requestUrl={wikipediaApi.buildUrl({ query: 'Singapore', limit: '8' })} data={{ batchcomplete: '', query: { pages: { 1: { pageid: 1, ns: 0, index: 1, title: 'Singapore', extract: 'A city-state in Southeast Asia.', thumbnail: { source: 'https://upload.wikimedia.org/demo.jpg' } } } } }}/>)
    const wikipedia = await screen.findByRole('region', { name: 'Wikipedia Search' })
    expect(wikipedia).toHaveTextContent('Singapore')
    expect(wikipedia).toHaveTextContent('A city-state in Southeast Asia.')

    rerender(<ResponseDemoPreview api={api('wikimedia-pageviews')} executedRequest={{ method: 'GET', url: 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Singapore/daily/20260701/20260707' }} data={{ items: [
      { project: 'en.wikipedia', article: 'Singapore', granularity: 'daily', timestamp: '2026070100', access: 'all-access', agent: 'user', views: 3000 },
      { project: 'en.wikipedia', article: 'Singapore', granularity: 'daily', timestamp: '2026070200', access: 'all-access', agent: 'user', views: 4000 },
      { project: 'en.wikipedia', article: 'Singapore', granularity: 'daily', timestamp: '2026070300', access: 'all-access', agent: 'user', views: 5000 },
      { project: 'en.wikipedia', article: 'Singapore', granularity: 'daily', timestamp: '2026070400', access: 'all-access', agent: 'user', views: 3500 },
      { project: 'en.wikipedia', article: 'Singapore', granularity: 'daily', timestamp: '2026070500', access: 'all-access', agent: 'user', views: 4500 },
      { project: 'en.wikipedia', article: 'Singapore', granularity: 'daily', timestamp: '2026070600', access: 'all-access', agent: 'user', views: 2500 },
      { project: 'en.wikipedia', article: 'Singapore', granularity: 'daily', timestamp: '2026070700', access: 'all-access', agent: 'user', views: 4500 },
    ] }}/>)
    expect(screen.getByRole('region', { name: 'Wikimedia Pageviews' })).toHaveTextContent('Total views')
    expect(screen.getByRole('region', { name: 'Wikimedia Pageviews' })).toHaveTextContent('27K')
  })

  it('adapts GitLab, UK crime, brewery, and character directory responses', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('gitlab-public-projects')} data={[{ id: 42, name: 'agent-console', path: 'agent-console', path_with_namespace: 'demo/agent-console', web_url: 'https://gitlab.com/demo/agent-console', description: 'An agent-ready developer console.', star_count: 420, forks_count: 30, visibility: 'public', topics: ['agents', 'vite'], last_activity_at: '2026-07-14T10:00:00Z' }]}/>)
    expect(screen.getByRole('region', { name: 'GitLab Public Projects' })).toHaveTextContent('demo/agent-console')
    expect(screen.getByRole('region', { name: 'GitLab Public Projects' })).toHaveTextContent('420 stars')

    rerender(<ResponseDemoPreview api={api('uk-police-street-crime')} executedRequest={{ method: 'GET', url: 'https://data.police.uk/api/crimes-street/burglary?lat=51.5074&lng=-0.1278' }} data={[{ persistent_id: 'a'.repeat(64), category: 'burglary', month: '2026-05', location: { latitude: '51.5074', longitude: '-0.1278', street: { name: 'On or near Whitehall' } } }]}/>)
    expect(screen.getByRole('region', { name: 'UK Street Crime' })).toHaveAttribute('data-preview-layout', 'street-crime')
    expect(screen.getByRole('region', { name: 'UK Street Crime' })).toHaveTextContent('On or near Whitehall')
    expect(screen.getByRole('region', { name: 'UK Street Crime' })).toHaveTextContent('Burglary')

    rerender(<ResponseDemoPreview api={api('open-brewery-directory')} requestUrl="https://api.openbrewerydb.org/v1/breweries?by_country=united_states&per_page=8" data={[{ id: 'brew-1', name: 'Demo Brewing Co', brewery_type: 'micro', address_1: '100 Demo St', city: 'Austin', state_province: 'Texas', postal_code: '78701', country: 'United States', latitude: 30.2672, longitude: -97.7431, phone: null, website_url: 'https://example.com' }]}/>)
    expect(screen.getByRole('region', { name: 'Open Brewery Directory' })).toHaveAttribute('data-preview-layout', 'brewery-directory')
    expect(screen.getByRole('region', { name: 'Open Brewery Directory' })).toHaveTextContent('Demo Brewing Co')
    expect(screen.getByRole('region', { name: 'Open Brewery Directory' })).toHaveTextContent('Micro · Austin · Texas')

    const rickApi = api('rick-morty-characters')
    rerender(<ResponseDemoPreview api={rickApi} requestUrl={rickApi.buildUrl({ name: 'Rick', status: 'all' })} data={{ info: { count: 1, pages: 1, next: null, prev: null }, results: [{ id: 1, name: 'Rick Sanchez', status: 'Alive', species: 'Human', type: '', gender: 'Male', origin: { name: 'Earth (C-137)', url: 'https://rickandmortyapi.com/api/location/1' }, location: { name: 'Citadel of Ricks', url: 'https://rickandmortyapi.com/api/location/3' }, image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg', episode: ['https://rickandmortyapi.com/api/episode/1'], url: 'https://rickandmortyapi.com/api/character/1', created: '2017-11-04T18:48:46.250Z' }] }} />)
    expect(screen.getByRole('region', { name: 'Rick and Morty Characters' })).toHaveTextContent('Rick Sanchez')
    expect(screen.getByRole('region', { name: 'Rick and Morty Characters' })).toHaveTextContent('Earth (C-137)')
    expect(screen.getByRole('region', { name: 'Rick and Morty Characters' })).toHaveAttribute('data-preview-layout', 'character-search')
  })

  it('renders Jolpica F1 season data through the dataset-aware semantic layout', () => {
    render(<ResponseDemoPreview api={api('jolpica-f1')} data={{
      MRData: {
        series: 'f1',
        limit: '8',
        offset: '0',
        total: '24',
        RaceTable: {
          season: '2026',
          Races: [{
            season: '2026',
            round: '18',
            raceName: 'Singapore Grand Prix',
            date: '2026-09-19',
            time: '12:00:00Z',
            Circuit: {
              circuitId: 'marina_bay',
              circuitName: 'Marina Bay Street Circuit',
              Location: { lat: '1.2914', long: '103.8640', locality: 'Marina Bay', country: 'Singapore' },
            },
          }],
        },
      },
    }}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    expect(preview).toHaveAttribute('data-preview-layout', 'f1-season-catalog')
    expect(preview.querySelector('.jolpica-f1-preview')).toHaveAttribute('data-dataset', 'races')
    expect(preview.querySelector('[data-round="18"]')).toHaveAttribute('data-circuit-id', 'marina_bay')
    expect(preview).toHaveTextContent('Singapore Grand Prix')
    expect(preview).toHaveTextContent('Marina Bay Street Circuit')
  })

  it('renders Swiss transit connections and new market APIs as dedicated layouts', () => {
    const swissApi = api('swiss-transit-connections')
    const swissUrl = swissApi.buildUrl({ from: 'Zurich', to: 'Geneva', limit: '2' })
    const { rerender } = render(<ResponseDemoPreview api={swissApi} requestUrl={swissUrl} executedRequest={{ method: 'GET', url: swissUrl }} data={{
      connections: [{
        from: { station: { id: '8503000', name: 'Zürich HB' }, departure: '2026-09-21T18:32:00+0200', delay: 5, platform: '12' },
        to: { station: { id: '8501008', name: 'Genève' }, arrival: '2026-09-21T21:25:00+0200', delay: null, platform: '4' },
        duration: '00d02:53:00', products: ['IC 1'],
        sections: [{ journey: { name: '000730', category: 'IC', number: '1', to: 'Genève-Aéroport' } }],
      }],
    }}/>)
    expect(screen.getByRole('region', { name: 'Swiss Transit Connections' })).toHaveAttribute('data-preview-layout', 'swiss-transit-connections')
    expect(screen.getByRole('region', { name: 'Swiss Transit Connections' })).toHaveTextContent('Zürich HB → Genève')
    expect(screen.getByRole('region', { name: 'Swiss Transit Connections' })).toHaveTextContent('Delayed 5 min')

    const bankApi = api('bank-of-canada-valet')
    const bankUrl = bankApi.buildUrl({ series: 'FXUSDCAD', startDate: '2026-07-01', endDate: '2026-07-02' })
    rerender(<ResponseDemoPreview api={bankApi} requestUrl={bankUrl} executedRequest={{ method: 'GET', url: bankUrl }} data={{
      seriesDetail: {
        FXUSDCAD: {
          label: 'USD/CAD',
          description: 'Daily average exchange rate',
          dimension: { key: 'd', name: 'Date' },
        },
      },
      observations: [
        { d: '2026-07-01', FXUSDCAD: { v: '1.3500' } },
        { d: '2026-07-02', FXUSDCAD: { v: '1.3600' } },
      ],
    }}/>)
    const bankPreview = screen.getByRole('region', { name: 'Bank of Canada Valet' })
    expect(bankPreview).toHaveAttribute('data-preview-layout', 'central-bank-series')
    expect(bankPreview).toHaveTextContent('1.3600')
    expect(bankPreview).toHaveTextContent('Series high')

    const nasaPowerApi = api('nasa-power-climate')
    const nasaPowerUrl = nasaPowerApi.buildUrl({
      latitude: '1.3521',
      longitude: '103.8198',
      startDate: '2026-06-30',
      endDate: '2026-07-02',
      parameters: 'T2M',
    })
    rerender(<ResponseDemoPreview api={nasaPowerApi} requestUrl={nasaPowerUrl} executedRequest={{ method: 'GET', url: nasaPowerUrl }} data={{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [103.82, 1.352, 25.8] },
      properties: {
        parameter: {
          T2M: { '20260630': -999, '20260701': 28, '20260702': 29 },
        },
      },
      header: {
        start: '20260630',
        end: '20260702',
        fill_value: -999,
        time_standard: 'LST',
        api: { name: 'POWER Daily API', version: 'v2.9.7' },
      },
      parameters: {
        T2M: { units: 'C', longname: 'Temperature at 2 Meters' },
      },
    }}/>)
    const climatePreview = screen.getByRole('region', { name: 'NASA POWER Climate' })
    expect(climatePreview).toHaveAttribute('data-preview-layout', 'climate-series')
    expect(climatePreview).toHaveTextContent('NASA POWER')
    expect(climatePreview).toHaveTextContent('Temperature at 2 Meters')
    expect(climatePreview).toHaveTextContent('29 C')
    expect(climatePreview).toHaveTextContent('2026-07-02')
    expect(climatePreview.querySelector('[data-domain-card="nasa-power-climate"]')).toHaveAttribute('data-result-state', 'partial')
    expect(climatePreview.querySelector('[data-domain-card="nasa-power-climate"]')).toHaveAttribute('data-valid-measurement-count', '2')
    expect(climatePreview.querySelector('[data-domain-card="nasa-power-climate"]')).toHaveAttribute('data-missing-measurement-count', '1')
    expect(climatePreview).not.toHaveTextContent('-999')

    rerender(<ResponseDemoPreview api={api('open-meteo-elevation')} data={{ elevation: [16.72] }} requestUrl="https://api.open-meteo.com/v1/elevation?latitude=1.3521&longitude=103.8198"/>)
    const elevationPreview = screen.getByRole('region', { name: 'Open-Meteo Elevation' })
    expect(elevationPreview).toHaveAttribute('data-preview-layout', 'terrain-elevation')
    expect(elevationPreview).toHaveTextContent('16.72 m terrain elevation')
    expect(elevationPreview).toHaveTextContent('WGS84 1.3521, 103.8198')
  })

  it('maps Zippopotam postcode results into a request-bound geolocation card', () => {
    const zippopotam = api('zippopotam-postcode')
    const requestUrl = zippopotam.buildUrl({ country: 'us', postalCode: '10001' })
    render(<ResponseDemoPreview api={zippopotam} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl }} data={{
      'post code': '10001',
      country: 'United States',
      'country abbreviation': 'US',
      places: [{
        'place name': 'New York',
        state: 'New York',
        'state abbreviation': 'NY',
        latitude: '40.7128',
        longitude: '-74.0060',
      }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'Zippopotam Postcode' })
    expect(preview).toHaveAttribute('data-preview-layout', 'postcode-geolocation')
    expect(within(preview).getByRole('img', { name: 'Map with 1 validated Zippopotam.us places' })).toBeInTheDocument()
    expect(within(preview).getByText('New York')).toBeInTheDocument()
    expect(within(preview).getByText('New York · NY · United States')).toBeInTheDocument()
  })
})

describe('catalog-wide semantic previews', () => {
  afterEach(cleanup)

  const api = (id: string) => {
    const match = apiCatalog.find((candidate) => candidate.id === id)
    if (!match) throw new Error(`Missing API fixture: ${id}`)
    return match
  }

  it('turns request-bound dictionary meanings into definitions, examples, and synonyms', () => {
    const dictionaryApi = api('free-dictionary')
    const dictionaryRequest = dictionaryApi.buildUrl({ word: 'hello' })
    render(<ResponseDemoPreview api={dictionaryApi} requestUrl={dictionaryRequest} executedRequest={{ method: 'GET', url: dictionaryRequest }} data={{
      word: 'hello',
      entries: [{
        language: { code: 'en', name: 'English' },
        partOfSpeech: 'noun',
        pronunciations: [{ type: 'ipa', text: '/həˈləʊ/' }],
        senses: [{ definition: 'An expression of greeting.', examples: ['Hello, how are you?'], synonyms: ['greeting', 'salutation'] }],
      }],
      source: { url: 'https://en.wiktionary.org/wiki/hello', license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } },
    }}/>)
    const preview = screen.getByRole('region', { name: 'Free Dictionary' })
    expect(preview).toHaveAttribute('data-preview-layout', 'dictionary-entry')
    expect(within(preview).getByText('An expression of greeting.')).toBeInTheDocument()
    expect(within(preview).getByText('greeting')).toBeInTheDocument()
    expect(within(preview).queryByText('3 items')).not.toBeInTheDocument()
  })

  it('renders RDAP registration semantics instead of truncating the domain record to status and handle', () => {
    render(<ResponseDemoPreview api={api('rdap-domain-lookup')} data={{
      ldhName: 'GOOGLE.COM',
      handle: '2138514_DOMAIN_COM-VRSN',
      status: ['client delete prohibited', 'client transfer prohibited', 'server update prohibited'],
      nameservers: [{ ldhName: 'NS1.GOOGLE.COM' }, { ldhName: 'NS2.GOOGLE.COM' }],
      events: [
        { eventAction: 'registration', eventDate: '1997-09-15T04:00:00Z' },
        { eventAction: 'expiration', eventDate: '2028-09-14T04:00:00Z' },
        { eventAction: 'last changed', eventDate: '2019-09-09T15:39:04Z' },
      ],
      entities: [{ roles: ['registrar'], handle: '292', vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'MarkMonitor Inc.']]] }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'RDAP Domain Lookup' })
    expect(preview).toHaveAttribute('data-preview-layout', 'domain-registration')
    expect(preview).toHaveTextContent('GOOGLE.COM')
    expect(preview).toHaveTextContent('MarkMonitor Inc.')
    expect(preview).toHaveTextContent('1997-09-15')
    expect(preview).toHaveTextContent('2028-09-14')
    expect(preview).toHaveTextContent('NS1.GOOGLE.COM, NS2.GOOGLE.COM')
    expect(preview).toHaveTextContent('client delete prohibited, client transfer prohibited, server update prohibited')
    expect(preview).toHaveTextContent('2138514_DOMAIN_COM-VRSN')
    expect(preview).not.toHaveTextContent('RDAP Domain Lookup record 1')
  })

  it('renders OSRM route distance, duration, geometry size, snapped endpoints, and turn steps semantically', () => {
    render(<ResponseDemoPreview api={api('osrm-route')} data={{
      code: 'Ok',
      waypoints: [
        { name: 'Start Road', location: [103.8198, 1.3521] },
        { name: 'Destination Road', location: [103.851959, 1.29027] },
      ],
      routes: [{
        distance: 11480.8, duration: 1174.9, weight: 4444.6, weight_name: 'routability',
        geometry: { type: 'LineString', coordinates: [[103.8198, 1.3521], [103.835, 1.32], [103.851959, 1.29027]] },
        legs: [{ distance: 11480.8, duration: 1174.9, steps: [
          { distance: 120.4, duration: 28.2, name: 'Start Road', maneuver: { type: 'depart', modifier: 'straight' } },
          { distance: 840.2, duration: 95.1, name: 'Orchard Road', maneuver: { type: 'turn', modifier: 'left' } },
        ] }],
      }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'OSRM Route' })
    expect(preview).toHaveAttribute('data-preview-layout', 'route-summary')
    const route = preview.querySelector('.route-summary-preview')
    expect(route).toHaveAttribute('data-primary-distance-m', '11480.8')
    expect(route).toHaveAttribute('data-primary-duration-s', '1174.9')
    expect(route).toHaveAttribute('data-primary-step-count', '2')
    expect(route).toHaveAttribute('data-primary-geometry-point-count', '3')
    expect(preview).toHaveTextContent('11.48 km')
    expect(preview).toHaveTextContent('19 min 35 sec')
    expect(preview).toHaveTextContent('Start Road · 1.3521, 103.8198')
    expect(preview).toHaveTextContent('Destination Road · 1.29027, 103.85196')
    expect(within(preview).getByRole('heading', { name: 'Turn-by-turn steps' })).toBeInTheDocument()
    expect(preview).toHaveTextContent('depart · straight')
    expect(preview).toHaveTextContent('turn · left')
    expect(preview).toHaveTextContent('Orchard Road')
    expect(preview).not.toHaveTextContent('OSRM Route record 1')
  })

  it('renders GLEIF legal-entity identity and registration facts instead of nested property counts', () => {
    render(<ResponseDemoPreview api={api('gleif-lei')} data={{
      data: [{
        type: 'lei-records',
        id: 'ES7IP3U3RHIGC71XBU11',
        attributes: {
          lei: 'ES7IP3U3RHIGC71XBU11',
          entity: {
            legalName: { name: 'Royal Bank of Canada' },
            headquartersAddress: { addressLines: ['1 place Ville-Marie'], city: 'Montreal', region: 'CA-QC', country: 'CA', postalCode: 'H3B 3A9' },
            jurisdiction: 'CA',
            status: 'ACTIVE',
          },
          registration: { initialRegistrationDate: '2012-06-06T15:52:00Z', nextRenewalDate: '2027-01-09T18:00:18Z', status: 'ISSUED' },
          bic: ['ROYCAEA1XXX', 'ROYCCAT2XXX'],
        },
        relationships: {
          'direct-children': { links: { related: 'https://api.gleif.org/api/v1/lei-records/ES7IP3U3RHIGC71XBU11/direct-children' } },
          'ultimate-children': { links: { related: 'https://api.gleif.org/api/v1/lei-records/ES7IP3U3RHIGC71XBU11/ultimate-children' } },
        },
      }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'GLEIF LEI Explorer' })
    expect(preview).toHaveAttribute('data-preview-layout', 'legal-entity')
    const entity = preview.querySelector('.legal-entity-preview')
    expect(entity).toHaveAttribute('data-primary-lei', 'ES7IP3U3RHIGC71XBU11')
    expect(entity).toHaveAttribute('data-primary-legal-name', 'Royal Bank of Canada')
    expect(entity).toHaveAttribute('data-primary-entity-status', 'ACTIVE')
    expect(entity).toHaveAttribute('data-primary-registration-status', 'ISSUED')
    expect(preview).toHaveTextContent('Royal Bank of Canada')
    expect(preview).toHaveTextContent('1 place Ville-Marie, Montreal, CA-QC, H3B 3A9, CA')
    expect(preview).toHaveTextContent('2012-06-06')
    expect(preview).toHaveTextContent('2027-01-09')
    expect(preview).toHaveTextContent('ROYCAEA1XXX, ROYCCAT2XXX')
    expect(preview).toHaveTextContent('Direct children relation')
    expect(preview).toHaveTextContent('Ultimate children relation')
    expect(preview).not.toHaveTextContent('GLEIF LEI Explorer record 1')
    expect(preview).not.toHaveTextContent('10 properties')
  })

  it('renders FDIC institution search results as bank identity and financial facts instead of nested property counts', () => {
    const fdicApi = api('fdic-bankfind')
    render(<ResponseDemoPreview api={fdicApi} requestUrl={fdicApi.buildUrl({ bankName: 'Wells Fargo', count: '6' })} data={{
      meta: { total: 35, parameters: { search: 'NAME: WELLS FARGO', limit: '6' } },
      data: [{
        data: {
          NAME: 'Wells Fargo Bank, National Association', CERT: 3511, ACTIVE: 1, INACTIVE: 0,
          ADDRESS: '3201 N 4th Ave', CITY: 'Sioux Falls', STALP: 'SD', ZIP: '57104',
          ESTYMD: '01/01/1870', INSDATE: '01/01/1934', ASSET: 1907928000, DEP: 1563534000,
          DEPDOM: 1554614000, OFFICES: 4184, REGAGNT: 'OCC', REPDTE: '06/30/2026',
          BKCLASS: 'N', FDICREGN: 'Kansas City', INSFDIC: 1,
        },
        score: 1091.1737,
      }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'FDIC BankFind Suite' })
    expect(preview).toHaveAttribute('data-preview-layout', 'bank-institution')
    const bank = preview.querySelector('.bank-institution-preview')
    expect(bank).toHaveAttribute('data-result-state', 'ready')
    expect(bank).toHaveAttribute('data-requested-search', 'NAME: WELLS FARGO')
    expect(bank).toHaveAttribute('data-requested-limit', '6')
    expect(bank).toHaveAttribute('data-provider-search', 'NAME: WELLS FARGO')
    expect(bank).toHaveAttribute('data-provider-limit', '6')
    expect(bank).toHaveAttribute('data-acknowledgement-match', 'true')
    expect(bank).toHaveAttribute('data-request-contract-valid', 'true')
    expect(bank).toHaveAttribute('data-provider-total', '35')
    expect(bank).toHaveAttribute('data-provider-match-count', '35')
    expect(bank).toHaveAttribute('data-primary-bank-name', 'Wells Fargo Bank, National Association')
    expect(bank).toHaveAttribute('data-primary-fdic-certificate', '3511')
    expect(bank).toHaveAttribute('data-primary-status', 'Active')
    expect(bank).toHaveAttribute('data-primary-active', 'true')
    expect(bank).toHaveAttribute('data-primary-assets-thousands', '1907928000')
    expect(bank).toHaveAttribute('data-primary-deposits-thousands', '1563534000')
    expect(bank).toHaveAttribute('data-primary-office-count', '4184')
    expect(preview).toHaveTextContent('Wells Fargo Bank, National Association')
    expect(preview).toHaveTextContent('3201 N 4th Ave, Sioux Falls SD 57104')
    expect(preview).toHaveTextContent('1,907,928,000')
    expect(preview).toHaveTextContent('1,563,534,000')
    expect(preview).toHaveTextContent('4,184')
    expect(preview).toHaveTextContent('OCC')
    expect(preview).not.toHaveTextContent('FDIC BankFind Suite record 1')
    expect(preview).not.toHaveTextContent('139 properties')
  })

  it('renders mempool.space recommended fee rates without claiming unsupported chain-health semantics', () => {
    const mempoolApi = api('mempool-space-btc')
    render(<ResponseDemoPreview api={mempoolApi} requestUrl={mempoolApi.buildUrl({})} data={{
      fastestFee: 7, halfHourFee: 5, hourFee: 4, economyFee: 2, minimumFee: 1,
    }}/>)
    const preview = screen.getByRole('region', { name: 'mempool.space Bitcoin' })
    expect(preview).toHaveAttribute('data-preview-layout', 'transaction-fees')
    const fees = preview.querySelector('.transaction-fees-preview')
    expect(fees).toHaveAttribute('data-primary-fee-sat-vb', '7')
    expect(fees).toHaveAttribute('data-half-hour-fee-sat-vb', '5')
    expect(fees).toHaveAttribute('data-hour-fee-sat-vb', '4')
    expect(fees).toHaveAttribute('data-economy-fee-sat-vb', '2')
    expect(fees).toHaveAttribute('data-minimum-fee-sat-vb', '1')
    expect(preview).toHaveTextContent('Recommended Bitcoin fee rates')
    expect(preview).toHaveTextContent('7 sat/vB')
    expect(preview).toHaveTextContent('5 sat/vB')
    expect(preview).toHaveTextContent('4 sat/vB')
    expect(preview).toHaveTextContent('2 sat/vB')
    expect(preview).toHaveTextContent('1 sat/vB')
    expect(preview).toHaveTextContent('6 sat/vB')
    expect(preview).not.toHaveTextContent('mempool.space Bitcoin record 1')
    expect(preview).not.toHaveTextContent('chain health signals')
  })

  it('maps developer, security, research, and structured data families to semantic cards', () => {
    const githubApi = api('github')
    const { rerender } = render(<ResponseDemoPreview api={githubApi} requestUrl={githubApi.buildUrl({})} data={[{
      id: 1296269, name: 'Hello-World', full_name: 'octocat/Hello-World', owner: { login: 'octocat' }, private: false,
      html_url: 'https://github.com/octocat/Hello-World', description: 'Example repository', fork: false, archived: false, disabled: false,
      language: 'JavaScript', default_branch: 'master', updated_at: '2026-09-11T12:00:00Z', pushed_at: '2026-09-10T12:00:00Z',
      stargazers_count: 42, forks_count: 8, open_issues_count: 2, topics: ['demo'], visibility: 'public',
    }]}/> )
    expect(screen.getByRole('region', { name: 'GitHub Public Repos' })).toHaveTextContent('octocat/Hello-World')

    const nvdSearchApi = api('nvd-cves')
    rerender(<ResponseDemoPreview api={nvdSearchApi} requestUrl={nvdSearchApi.buildUrl({ query: 'postgresql', limit: '8' })} data={{
      resultsPerPage: 1, startIndex: 0, totalResults: 1, format: 'NVD_CVE', version: '2.0', timestamp: '2026-09-08T00:00:01.000',
      vulnerabilities: [{ cve: {
        id: 'CVE-2026-1234', sourceIdentifier: 'security@example.org', published: '2026-07-01T00:00:00.000', lastModified: '2026-07-10T00:00:00.000', vulnStatus: 'Analyzed',
        descriptions: [{ lang: 'en', value: 'A representative PostgreSQL security issue.' }], references: [{ url: 'https://example.org/CVE-2026-1234' }],
        metrics: { cvssMetricV31: [{ source: 'security@example.org', type: 'Primary', cvssData: { baseScore: 8.1, baseSeverity: 'HIGH' } }] },
      } }],
    }}/> )
    expect(screen.getByRole('region', { name: 'NVD CVE Search' })).toHaveTextContent('CVE-2026-1234')

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

    const taxiApi = api('data-gov-taxi')
    const taxiUrl = taxiApi.buildUrl({})
    rerender(<ResponseDemoPreview api={taxiApi} requestUrl={taxiUrl} executedRequest={{ method: 'GET', url: taxiUrl }} data={{
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'MultiPoint', coordinates: [[103.8, 1.30], [103.81, 1.31]] },
        properties: { timestamp: '2026-09-17T12:34:56+08:00', taxi_count: 2 },
      }],
    }} />)
    const taxi = expectNoGenericFallback('data.gov.sg Taxi Availability')
    expect(taxi).toHaveAttribute('data-preview-layout', 'taxi-availability')
    const taxiCard = taxi.querySelector('[data-domain-card="data-gov-taxi-availability"]')
    expect(taxiCard).toHaveAttribute('data-result-state', 'ready')
    expect(taxiCard).toHaveAttribute('data-request-bound', 'true')
    expect(taxiCard).toHaveAttribute('data-taxi-count', '2')
    expect(within(taxi).getByRole('img', { name: /Map sample of 2 anonymous available taxi positions/ })).toBeInTheDocument()
    expect(taxi).toHaveTextContent('Available taxis')
    expect(taxi).toHaveTextContent('data.gov.sg acquisition time')

    const trafficApi = api('data-gov-traffic-images')
    const trafficUrl = trafficApi.buildUrl({})
    rerender(<ResponseDemoPreview api={trafficApi} executedRequest={{ method: 'GET', url: trafficUrl }} data={{ items: [{ timestamp: '2026-09-04T18:06:19+08:00', cameras: [{ camera_id: '2701', timestamp: '2026-09-04T18:06:19+08:00', image: 'https://images.test/traffic.jpg', location: { latitude: 1.447, longitude: 103.772 }, image_metadata: { width: 1920, height: 1080, md5: '0123456789abcdef0123456789abcdef' } }] }], api_info: { status: 'healthy' } }} />)
    const traffic = expectNoGenericFallback('data.gov.sg Traffic Images')
    expect(traffic).toHaveAttribute('data-preview-layout', 'traffic-camera-snapshot')
    expect(traffic.querySelector('[data-domain-card="data-gov-traffic-images"]')).toHaveAttribute('data-result-state', 'ready')
    expect(within(traffic).getByRole('img')).toHaveAttribute('src', 'https://images.test/traffic.jpg')
    expect(traffic).toHaveTextContent('Camera ID 2701')
  })

  it('renders collection, vehicle, earthquake, and taxonomy responses semantically', () => {
    const metApi = api('met-museum-search')
    const metRequestUrl = metApi.buildUrl({})
    const { rerender } = render(<ResponseDemoPreview api={metApi} data={{ total: 3, objectIDs: [892409, 908184, 264585] }} requestUrl={metRequestUrl} executedRequest={{ url: metRequestUrl, method: 'GET' }} />)
    const met = expectNoGenericFallback('Met Museum Search')
    expect(met).toHaveTextContent('3')
    expect(met).toHaveTextContent('892409')

    rerender(<ResponseDemoPreview api={api('nhtsa-vpic')} data={{ Count: 12356, Results: [{ Make_ID: 12858, Make_Name: '#1 ALPINE CUSTOMS' }] }} />)
    const nhtsa = expectNoGenericFallback('NHTSA vPIC Vehicle API')
    expect(nhtsa).toHaveTextContent('#1 ALPINE CUSTOMS')
    expect(nhtsa).toHaveTextContent('12.4K')

    const usgsApi = api('usgs')
    const usgsUrl = usgsApi.buildUrl({})
    rerender(<ResponseDemoPreview api={usgsApi} requestUrl={usgsUrl} executedRequest={{ method: 'GET', url: usgsUrl }} data={{
      type: 'FeatureCollection',
      metadata: { generated: 1_789_430_400_000, url: usgsUrl, title: 'USGS Magnitude 2.5+ Earthquakes, Past Day', api: '1.14.1', count: 1, status: 200 },
      features: [{ type: 'Feature', id: 'us7000test1', properties: { mag: 3.7, place: 'Off the coast of Oregon', time: 1_789_426_800_000, updated: 1_789_427_100_000, status: 'reviewed', title: 'M 3.7 - Off the coast of Oregon' }, geometry: { type: 'Point', coordinates: [-129.0824, 43.6383, 10] } }],
    }} />)
    const usgs = expectNoGenericFallback('USGS Earthquakes')
    expect(within(usgs).getByRole('img', { name: /Map with 1 validated USGS earthquake location/ })).toBeInTheDocument()
    expect(usgs.querySelector('[data-domain-card="usgs-earthquake-feed"]')).toHaveAttribute('data-result-state', 'ready')
    expect(usgs).toHaveTextContent('M 3.7 · Off the coast of Oregon')

    const gbifApi = api('gbif-species-search')
    const gbifUrl = gbifApi.buildUrl({ query: 'panthera' })
    rerender(<ResponseDemoPreview api={gbifApi} requestUrl={gbifUrl} executedRequest={{ method: 'GET', url: gbifUrl }} data={{ offset: 0, limit: 8, endOfRecords: false, count: 1759, results: [{ key: 2435194, scientificName: 'Panthera', kingdom: 'Animalia', phylum: 'Chordata', class: 'Mammalia', order: 'Carnivora', family: 'Felidae', genus: 'Panthera', rank: 'GENUS', taxonomicStatus: 'ACCEPTED' }] }} />)
    const gbif = expectNoGenericFallback('GBIF Species Search')
    expect(gbif).toHaveTextContent('Panthera')
    expect(gbif).toHaveTextContent('Felidae')
  })

  it('renders media APIs from their actual nested image contracts', () => {
    const pokeApi = api('pokeapi')
    const pokeUrl = pokeApi.buildUrl({ pokemon: 'pikachu' })
    const { rerender } = render(<ResponseDemoPreview api={pokeApi} requestUrl={pokeUrl} executedRequest={{ url: pokeUrl, method: 'GET' }} data={{
      id: 25, name: 'pikachu', base_experience: 112, height: 4, weight: 60, is_default: true,
      sprites: { front_default: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png' },
      types: [{ slot: 1, type: { name: 'electric', url: 'https://pokeapi.co/api/v2/type/13/' } }],
      abilities: [{ slot: 1, is_hidden: false, ability: { name: 'static', url: 'https://pokeapi.co/api/v2/ability/9/' } }],
      stats: [{ base_stat: 35, effort: 0, stat: { name: 'hp', url: 'https://pokeapi.co/api/v2/stat/1/' } }],
    }} />)
    const poke = expectNoGenericFallback('PokéAPI Explorer')
    expect(within(poke).getByRole('img')).toHaveAttribute('src', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png')
    expect(poke).toHaveTextContent('Pikachu')
    expect(poke.querySelector('[data-domain-card="pokeapi-pokemon"]')).toHaveAttribute('data-result-state', 'ready')

    const tvmazeApi = api('tvmaze-search')
    const tvmazeUrl = tvmazeApi.buildUrl({ show: 'severance' })
    rerender(<ResponseDemoPreview api={tvmazeApi} requestUrl={tvmazeUrl} executedRequest={{ url: tvmazeUrl, method: 'GET' }} data={[{ score: 0.9, show: { id: 44933, url: 'https://www.tvmaze.com/shows/44933/severance', name: 'Severance', status: 'Running', type: 'Scripted', language: 'English', genres: ['Drama'], rating: { average: 7.6 }, runtime: 50, premiered: '2022-02-18', ended: null, schedule: { time: '09:00', days: ['Friday'] }, network: null, webChannel: { id: 310, name: 'Apple TV+', country: null, officialSite: 'https://tv.apple.com/' }, officialSite: 'https://tv.apple.com/show/severance', image: { medium: 'https://static.tvmaze.com/uploads/images/medium_portrait/450/1126221.jpg' } } }]} />)
    const tv = expectNoGenericFallback('TVmaze Show Search')
    expect(within(tv).getByRole('img')).toHaveAttribute('src', 'https://static.tvmaze.com/uploads/images/medium_portrait/450/1126221.jpg')
    expect(tv).toHaveTextContent('Severance')
    expect(tv).toHaveAttribute('data-preview-layout', 'tv-show-search')
    expect(tv.querySelector('[data-domain-card="tvmaze-search"]')).toHaveAttribute('data-result-state', 'ready')

    const rickMortyApi = api('rick-morty-characters')
    const rickMortyUrl = rickMortyApi.buildUrl({ name: 'Rick', status: 'alive' })
    rerender(<ResponseDemoPreview api={rickMortyApi} requestUrl={rickMortyUrl} executedRequest={{ url: rickMortyUrl, method: 'GET' }} data={{ info: { count: 1, pages: 1, next: null, prev: null }, results: [{ id: 1, name: 'Rick Sanchez', status: 'Alive', species: 'Human', type: '', gender: 'Male', origin: { name: 'Earth (C-137)', url: 'https://rickandmortyapi.com/api/location/1' }, location: { name: 'Citadel of Ricks', url: 'https://rickandmortyapi.com/api/location/3' }, image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg', episode: ['https://rickandmortyapi.com/api/episode/1'], url: 'https://rickandmortyapi.com/api/character/1', created: '2017-11-04T18:48:46.250Z' }] }} />)
    const rickMorty = expectNoGenericFallback('Rick and Morty Characters')
    expect(rickMorty).toHaveAttribute('data-preview-layout', 'character-search')
    expect(within(rickMorty).getByRole('img')).toHaveAttribute('src', 'https://rickandmortyapi.com/api/character/avatar/1.jpeg')
    expect(rickMorty).toHaveTextContent('Rick Sanchez')
    expect(rickMorty.querySelector('[data-domain-card="rick-morty-characters"]')).toHaveAttribute('data-result-state', 'ready')

    const flathubApi = api('flathub-appstream')
    const flathubUrl = flathubApi.buildUrl({ appId: 'org.gnome.Calculator' })
    rerender(<ResponseDemoPreview api={flathubApi} executedRequest={{ method: 'GET', url: flathubUrl }} data={{ id: 'org.gnome.Calculator', name: 'Calculator', summary: 'Perform calculations', developer_name: 'The GNOME Project', project_license: 'GPL-3.0-or-later', is_free_license: true, bundle: { type: 'flatpak', value: 'app/org.gnome.Calculator/x86_64/stable', runtime: 'org.gnome.Platform/x86_64/49' }, launchable: { type: 'desktop-id', value: 'org.gnome.Calculator.desktop' }, urls: { homepage: 'https://apps.gnome.org/Calculator', vcs_browser: 'https://gitlab.gnome.org/GNOME/gnome-calculator' }, releases: [{ type: 'stable', version: '49.0', timestamp: '1757376000' }], screenshots: [{ caption: 'Basic Mode', sizes: [{ width: '750', height: '666', src: 'https://dl.flathub.org/media/org/gnome/Calculator/fixture.png' }] }] }} />)
    const flathub = expectNoGenericFallback('Flathub Appstream')
    expect(flathub).toHaveAttribute('data-preview-layout', 'appstream-profile')
    expect(within(flathub).getByRole('img')).toHaveAttribute('src', 'https://dl.flathub.org/media/org/gnome/Calculator/fixture.png')
    expect(flathub).toHaveTextContent('Basic Mode')

    const vamApi = api('vam-collections')
    const vamUrl = vamApi.buildUrl({ query: 'eastern', count: '1' })
    rerender(<ResponseDemoPreview api={vamApi} requestUrl={vamUrl} data={{ info: { record_count: 1, record_count_exact: true, page: 1, page_size: 1 }, records: [{ systemNumber: 'O123456', objectType: 'Painting', _primaryTitle: 'The Yorkshire Dales', _primaryDate: 'c.1923', _primaryMaker: { name: 'Brown, F. Gregory' }, _images: { _primary_thumbnail: 'https://images.test/vam.jpg' } }] }} />)
    const vam = expectNoGenericFallback('V&A Collections')
    expect(within(vam).getByRole('img')).toHaveAttribute('src', 'https://images.test/vam.jpg')
    expect(vam).toHaveTextContent('The Yorkshire Dales')
  })

  it('renders parsed Go versions and the jsDelivr reference SSOT card', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('go-module-proxy')} data={{ versions: ['v1.11.0', 'v1.12.0'] }} />)
    const go = expectNoGenericFallback('Go Module Proxy')
    expect(go).toHaveAttribute('data-preview-layout', 'go-module-versions')
    expect(go).toHaveTextContent('Published module versions')
    expect(go).toHaveTextContent('v1.12.0')

    rerender(<ResponseDemoPreview api={api('jsdelivr-package')} requestUrl="https://data.jsdelivr.com/v1/packages/npm/react" executedRequest={{ url: "https://data.jsdelivr.com/v1/packages/npm/react", method: 'GET' }} runtime={{ httpStatus: 200, elapsed: 58, size: 106496 }} data={{ type: 'npm', name: 'react', tags: { latest: '19.2.8' }, versions: [{ version: '19.2.8', links: { self: 'https://data.jsdelivr.com/v1/packages/npm/react@19.2.8', stats: 'https://data.jsdelivr.com/v1/stats/packages/npm/react@19.2.8' } }, { version: '19.2.7', links: { self: 'https://data.jsdelivr.com/v1/packages/npm/react@19.2.7', stats: 'https://data.jsdelivr.com/v1/stats/packages/npm/react@19.2.7' } }, { version: '19.1.0', links: { self: 'https://data.jsdelivr.com/v1/packages/npm/react@19.1.0', stats: 'https://data.jsdelivr.com/v1/stats/packages/npm/react@19.1.0' } }], links: { stats: 'https://data.jsdelivr.com/v1/stats/packages/npm/react' } }} />)
    const jsdelivr = expectNoGenericFallback('jsDelivr Package Metadata')
    expect(jsdelivr).toHaveAttribute('data-preview-layout', 'cdn-package')
    expect(jsdelivr.querySelector('[data-ssot-reference="exact-jsdelivr-npm-package-v2"]')).not.toBeNull()
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
    const openF1Api = api('openf1-historical')
    const openF1Request = openF1Api.buildUrl({ season: '2025', round: '1' })
    const { rerender } = render(<ResponseDemoPreview api={openF1Api} data={openF1QualifyingFixture} requestUrl={openF1Request} executedRequest={{ url: openF1Request, method: 'GET' }}/>)
    expect(screen.getByRole('region', { name: 'Jolpica F1 Qualifying' })).toHaveTextContent('Australian Grand Prix')
    expect(screen.getByRole('region', { name: 'Jolpica F1 Qualifying' })).toHaveTextContent('Lando Norris')

    const irailApi = api('irail-liveboard')
    const irailRequest = irailApi.buildUrl({ station: 'Brussels-South', direction: 'departure' })
    rerender(<ResponseDemoPreview api={irailApi} requestUrl={irailRequest} executedRequest={{ url: irailRequest, method: 'GET' }} data={{ version: '1.4', timestamp: '1784102100', station: 'Brussels-South/Brussels-Midi', stationinfo: { id: 'BE.NMBS.008814001', '@id': 'http://irail.be/stations/NMBS/008814001', name: 'Brussels-South/Brussels-Midi', standardname: 'Brussel-Zuid/Bruxelles-Midi' }, departures: { number: '1', departure: [{ id: '0', time: '1784102400', delay: '300', canceled: '0', vehicle: 'BE.NMBS.IC123', platform: '4', station: 'Antwerpen-Centraal' }] } }}/> )
    expect(screen.getByRole('region', { name: 'Belgian Rail Liveboard' })).toHaveTextContent('Antwerpen-Centraal')
    expect(screen.getByRole('region', { name: 'Belgian Rail Liveboard' })).toHaveTextContent('Delayed 5 min')

    const spaceflightRequest = api('spaceflight-news').buildUrl({ query: 'NASA', limit: '6' })
    rerender(<ResponseDemoPreview api={api('spaceflight-news')} requestUrl={spaceflightRequest} executedRequest={{ method: 'GET', url: spaceflightRequest }} data={{ count: 1, next: null, previous: null, results: [{ id: 1, title: 'Moon mission prepares for launch', news_site: 'Space News', url: 'https://spacenews.example/moon-mission', image_url: 'https://spacenews.example/moon.jpg', summary: 'A lunar mission completes its final launch preparations.', published_at: '2026-07-15T06:00:00Z', updated_at: '2026-07-15T07:00:00Z', authors: [{ name: 'A. Reporter' }], launches: [{ launch_id: 'launch-1' }], events: [] }] }}/> )
    const spaceflight = screen.getByRole('region', { name: 'Spaceflight News' })
    const spaceflightCard = spaceflight.querySelector('[data-domain-card="spaceflight-news"]')
    expect(spaceflightCard).toHaveAttribute('data-result-state', 'ready')
    expect(spaceflightCard).toHaveAttribute('data-request-bound', 'true')
    expect(spaceflightCard).toHaveAttribute('data-primary-article-id', '1')
    expect(spaceflight).toHaveTextContent('Moon mission prepares for launch')
    expect(spaceflight).toHaveTextContent('Space News')
    expect(spaceflight).toHaveTextContent('1 author · 1 launch · 0 events')

    const launchId = '11111111-1111-4111-8111-111111111111'
    const launchRequest = api('launch-library-upcoming').buildUrl({ query: 'SpaceX', limit: '4' })
    rerender(<ResponseDemoPreview api={api('launch-library-upcoming')} requestUrl={launchRequest} executedRequest={{ method: 'GET', url: launchRequest }} data={{ count: 1, next: null, previous: null, results: [{ id: launchId, url: `https://ll.thespacedevs.com/2.3.0/launches/${launchId}/`, name: 'DemoSat Mission by SpaceX', net: '2026-08-01T12:30:00Z', status: { id: 1, name: 'Go for Launch', abbrev: 'Go' }, launch_service_provider: { name: 'SpaceX' }, pad: { name: 'Pad 39A', location: { name: 'Kennedy Space Center' } }, mission: { name: 'DemoSat' }, rocket: { configuration: { name: 'Falcon 9', manufacturer: { name: 'SpaceX', abbrev: 'SpX' } } } }] }}/> )
    const launch = screen.getByRole('region', { name: 'Upcoming Space Launches' })
    expect(launch).toHaveAttribute('data-preview-layout', 'launch-schedule')
    expect(launch.querySelector('[data-domain-card="launch-library-upcoming"]')).toHaveAttribute('data-result-state', 'ready')
    expect(launch).toHaveTextContent('DemoSat Mission by SpaceX')
    expect(launch).toHaveTextContent('Kennedy Space Center')
  })

  it('adapts Wiktionary, anime quotes, safe jokes, and recipe responses', () => {
    const wiktionaryApi = api('wiktionary-entry')
    const wiktionaryRequest = wiktionaryApi.buildUrl({ word: 'hello' })
    const { rerender } = render(<ResponseDemoPreview api={wiktionaryApi} requestUrl={wiktionaryRequest} executedRequest={{ method: 'GET', url: wiktionaryRequest }} data={{ en: [{ language: 'English', partOfSpeech: 'Interjection', definitions: [{ definition: '<i>A greeting</i> used when meeting someone.', examples: ['Hello there.'], synonyms: ['hi'] }] }] }}/> )
    const dictionary = screen.getByRole('region', { name: 'Wiktionary Definitions' })
    expect(dictionary).toHaveTextContent('A greeting used when meeting someone.')
    expect(dictionary).toHaveTextContent('Hello there.')

    rerender(<ResponseDemoPreview api={api('animechan-random-quote')} data={{ status: 'success', data: { content: 'To become Hokage is my dream!', anime: { id: 266, name: 'Naruto', altName: 'ナルト' }, character: { id: 123, name: 'Naruto Uzumaki' } } }}/> )
    const animeQuote = screen.getByRole('region', { name: 'Anime Quote Generator' })
    expect(animeQuote).toHaveTextContent('To become Hokage is my dream!')
    expect(animeQuote).toHaveTextContent('Naruto Uzumaki')
    expect(animeQuote.querySelector('[data-domain-card="anime-quote"]')).toHaveAttribute('data-result-state', 'ready')
    expect(animeQuote.querySelector('[data-domain-card="anime-quote"]')).toHaveAttribute('data-provider-status', 'success')

    rerender(<ResponseDemoPreview api={api('animechan-random-quote')} data={{ status: 'error', data: { content: 'Fabricated quote', anime: { id: 266, name: 'Naruto' }, character: { id: 123, name: 'Naruto Uzumaki' } } }}/> )
    const invalidAnimeQuote = screen.getByRole('region', { name: 'Anime Quote Generator' })
    expect(invalidAnimeQuote.querySelector('[data-domain-card="anime-quote"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(invalidAnimeQuote).not.toHaveTextContent('Fabricated quote')

    const jokeApi = api('jokeapi-safe')
    const jokeRequest = jokeApi.buildUrl({ category: 'Programming', type: 'twopart' })
    rerender(<ResponseDemoPreview api={jokeApi} requestUrl={jokeRequest} executedRequest={{ method: 'GET', url: jokeRequest }} data={{ error: false, category: 'Programming', type: 'twopart', setup: 'Why did the developer cross the road?', delivery: 'To reach the other site.', flags: { nsfw: false, religious: false, political: false, racist: false, sexist: false, explicit: false }, id: 42, safe: true, lang: 'en' }}/> )
    const joke = screen.getByRole('region', { name: 'Safe Joke Generator' })
    expect(joke).toHaveTextContent('Why did the developer cross the road?')
    expect(joke).toHaveTextContent('To reach the other site.')

    const recipeApi = api('dummyjson-recipes')
    const recipeUrl = recipeApi.buildUrl({ query: 'pasta', limit: '1' })
    rerender(<ResponseDemoPreview api={recipeApi} executedRequest={{ method: 'GET', url: recipeUrl }} data={{ total: 1, skip: 0, limit: 1, recipes: [{ id: 1, name: 'Pasta Primavera', image: 'https://example.com/pasta.jpg', cuisine: 'Italian', rating: 4.8, difficulty: 'Easy', ingredients: ['Pasta', 'Vegetables'], instructions: ['Cook pasta.', 'Add vegetables.'], prepTimeMinutes: 10, cookTimeMinutes: 20, servings: 2, caloriesPerServing: 420, tags: ['Pasta'], reviewCount: 12, mealType: ['Dinner'] }] }}/> )
    const recipe = screen.getByRole('region', { name: 'Recipe Explorer' })
    expect(recipe.querySelector('[data-domain-card="dummyjson-recipes"]')).toHaveAttribute('data-result-state', 'ready')
    expect(recipe).toHaveTextContent('Pasta Primavera')
    expect(recipe).toHaveTextContent('Italian')
    expect(recipe).toHaveTextContent('Pasta')
    expect(recipe).toHaveTextContent('Cook pasta.')
  })

  it('adapts Brazil postcode, poetry, CoinGecko, and Star Wars responses', () => {
    const brasilApi = api('brasilapi-postcode')
    const brasilRequest = brasilApi.buildUrl({ postcode: '01310-930' })
    const brasilResponse = { cep: '01310930', state: 'SP', city: 'São Paulo', neighborhood: 'Bela Vista', street: 'Avenida Paulista', service: 'open-cep', timezoneName: 'America/Sao_Paulo', location: { type: 'Point', coordinates: { longitude: '-46.6558', latitude: '-23.5614' } } }
    const { rerender } = render(<ResponseDemoPreview api={brasilApi} requestUrl={brasilRequest} executedRequest={{ method: 'GET', url: brasilRequest }} data={brasilResponse}/> )
    const postcode = screen.getByRole('region', { name: 'Brazil Postcode Explorer' })
    expect(postcode.querySelector('[data-domain-card="brasilapi-postcode"]')).toHaveAttribute('data-result-state', 'ready')
    expect(postcode.querySelector('[data-domain-card="brasilapi-postcode"]')).toHaveAttribute('data-request-bound', 'true')
    expect(postcode).toHaveTextContent('Avenida Paulista')
    expect(postcode).toHaveTextContent('Bela Vista')
    expect(postcode).toHaveTextContent('São Paulo · SP')

    const otherBrasilRequest = brasilApi.buildUrl({ postcode: '01001000' })
    rerender(<ResponseDemoPreview api={brasilApi} requestUrl={otherBrasilRequest} executedRequest={{ method: 'GET', url: otherBrasilRequest }} data={brasilResponse}/> )
    expect(postcode.querySelector('[data-domain-card="brasilapi-postcode"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(postcode).not.toHaveTextContent('Avenida Paulista')

    const poetryApi = api('poetrydb-poems')
    const poetryRequest = poetryApi.buildUrl({ author: 'Emily Dickinson', count: '3' })
    rerender(<ResponseDemoPreview api={poetryApi} requestUrl={poetryRequest} executedRequest={{ method: 'GET', url: poetryRequest }} data={[{ title: 'Hope is the thing with feathers', author: 'Emily Dickinson', lines: ['Hope is the thing with feathers', 'That perches in the soul'], linecount: '2' }, { title: 'Because I could not stop for Death', author: 'Emily Dickinson', lines: ['Because I could not stop for Death'], linecount: 1 }, { title: 'I heard a Fly buzz', author: 'Emily Dickinson', lines: ['I heard a Fly buzz'], linecount: '1' }]}/> )
    const poetry = screen.getByRole('region', { name: 'PoetryDB Reader' })
    expect(poetry).toHaveTextContent('Hope is the thing with feathers')
    expect(poetry).toHaveTextContent('2 lines')

    rerender(<ResponseDemoPreview api={api('coingecko-keyless-market')} executedRequest={{ method: 'GET', url: api('coingecko-keyless-market').buildUrl({ coin: 'bitcoin', currency: 'usd' }) }} data={{ bitcoin: { usd: 65000, usd_market_cap: 1280000000000, usd_24h_vol: 35000000000, usd_24h_change: 2.5, last_updated_at: 1784102400 } }}/> )
    const market = screen.getByRole('region', { name: 'CoinGecko Keyless Market' })
    expect(market).toHaveTextContent('Bitcoin · USD')
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

  it('renders GitHub, NVD, CIRCL, and DBLP investigation records', () => {
    const githubApi = api('github-global-advisories')
    const { rerender } = render(<ResponseDemoPreview api={githubApi} executedRequest={{ url: githubApi.buildUrl({ ecosystem: 'npm', severity: 'high', limit: '6' }), method: 'GET' }} data={[{
      ghsa_id: 'GHSA-demo-1234', cve_id: 'CVE-2026-7000', type: 'reviewed', severity: 'high', summary: 'Demo package advisory',
      published_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-03T00:00:00Z',
      vulnerabilities: [{ package: { ecosystem: 'npm', name: 'demo-package' } }],
    }]}/>)
    const github = screen.getByRole('region', { name: 'GitHub Global Advisories' })
    expect(github).toHaveTextContent('GHSA-demo-1234')
    expect(github).toHaveTextContent('demo-package')
    expect(github).toHaveTextContent('High')

    rerender(<ResponseDemoPreview
      api={api('nvd-cve-detail')}
      executedRequest={{ url: 'https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2024-3094', method: 'GET' }}
      data={{
        resultsPerPage: 1, startIndex: 0, totalResults: 1, format: 'NVD_CVE', version: '2.0', timestamp: '2026-09-14T08:40:01.048',
        vulnerabilities: [{ cve: {
          id: 'CVE-2024-3094', published: '2024-03-29T17:15:25.123', lastModified: '2026-06-17T17:15:24.893',
          descriptions: [{ lang: 'en', value: 'Malicious code was discovered in upstream xz release tarballs.' }],
          references: [{ url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-3094' }],
        } }],
      }}
    />)
    const nvd = screen.getByRole('region', { name: 'NVD CVE Detail' })
    expect(nvd).toHaveAttribute('data-preview-layout', 'nvd-vulnerability')
    expect(nvd.querySelector('[data-domain-card="nvd-cve-detail"]')).toHaveAttribute('data-result-state', 'ready')
    expect(nvd).toHaveTextContent('CVE-2024-3094')
    expect(nvd).toHaveTextContent('Malicious code was discovered')

    rerender(<ResponseDemoPreview api={api('circl-vulnerability')} data={{
      dataType: 'CVE_RECORD', dataVersion: '5.1',
      cveMetadata: { cveId: 'CVE-2021-44228', state: 'PUBLISHED', assignerShortName: 'apache', datePublished: '2021-12-10T00:00:00Z', dateUpdated: '2025-10-21T00:00:00Z' },
      containers: { cna: { descriptions: [{ lang: 'en', value: 'Log4j JNDI remote code execution.' }], affected: [{ vendor: 'Apache', product: 'Log4j' }] } },
    }}/>)
    const circl = screen.getByRole('region', { name: 'CIRCL Vulnerability Lookup' })
    expect(circl).toHaveTextContent('CVE-2021-44228')
    expect(circl).toHaveTextContent('Log4j')

    const dblpApi = api('dblp-search')
    const dblpRequestUrl = dblpApi.buildUrl({ query: 'retrieval', limit: '6' })
    rerender(<ResponseDemoPreview api={dblpApi} requestUrl={dblpRequestUrl} executedRequest={{ url: dblpRequestUrl, method: 'GET' }} data={{
      head: { vars: ['publ', 'title', 'year', 'venue', 'doi', 'authorName'] },
      results: { bindings: [
        { publ: { type: 'uri', value: 'https://dblp.org/rec/conf/demo/Rag26' }, title: { type: 'literal', value: 'Retrieval-Augmented Generation for Enterprise Systems' }, year: { type: 'literal', value: '2026' }, venue: { type: 'literal', value: 'DemoConf' }, doi: { type: 'uri', value: 'https://doi.org/10.1/demo' }, authorName: { type: 'literal', value: 'Wei Developer' } },
        { publ: { type: 'uri', value: 'https://dblp.org/rec/conf/demo/Rag26' }, title: { type: 'literal', value: 'Retrieval-Augmented Generation for Enterprise Systems' }, year: { type: 'literal', value: '2026' }, venue: { type: 'literal', value: 'DemoConf' }, doi: { type: 'uri', value: 'https://doi.org/10.1/demo' }, authorName: { type: 'literal', value: 'AI Researcher' } },
      ] },
    }}/>)
    const dblp = screen.getByRole('region', { name: 'DBLP Publication Search' })
    expect(dblp).toHaveAttribute('data-preview-layout', 'dblp-publications')
    expect(dblp.querySelector('[data-domain-card="dblp-search"]')).toHaveAttribute('data-result-state', 'ready')
    expect(dblp.querySelector('[data-domain-card="dblp-search"]')).toHaveAttribute('data-request-bound', 'true')
    expect(dblp).toHaveTextContent('Retrieval-Augmented Generation for Enterprise Systems')
    expect(dblp).toHaveTextContent('Wei Developer, AI Researcher')
    expect(dblp).toHaveTextContent('DemoConf')
    expect(dblp).toHaveTextContent('10.1/demo')
    expect(dblp).toHaveTextContent('https://dblp.org/rec/conf/demo/Rag26')
  })

  it('fails closed when GitHub advisory rows contradict the executed filters', () => {
    const githubApi = api('github-global-advisories')
    const requestUrl = githubApi.buildUrl({ ecosystem: 'npm', severity: 'high', limit: '6' })
    const advisory = {
      ghsa_id: 'GHSA-demo-1234', cve_id: 'CVE-2026-7000', type: 'reviewed', severity: 'high', summary: 'Trusted npm advisory',
      published_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-03T00:00:00Z',
      vulnerabilities: [{ package: { ecosystem: 'npm', name: 'trusted-package' }, first_patched_version: '2.0.0', vulnerable_version_range: '< 2.0.0' }],
    }
    const { rerender } = render(<ResponseDemoPreview api={githubApi} executedRequest={{ url: requestUrl, method: 'GET' }} data={[advisory]}/>)
    const github = screen.getByRole('region', { name: 'GitHub Global Advisories' })
    expect(github).toHaveAttribute('data-preview-layout', 'global-security-advisories')
    expect(github.querySelector('[data-domain-card="github-global-advisories"]')).toHaveAttribute('data-result-state', 'ready')
    expect(github).toHaveTextContent('trusted-package')

    rerender(<ResponseDemoPreview api={githubApi} executedRequest={{ url: requestUrl, method: 'GET' }} data={[{ ...advisory, severity: 'critical', summary: 'Wrong severity advisory', vulnerabilities: [{ package: { ecosystem: 'npm', name: 'wrong-severity-package' } }] }]}/>)
    expect(github.querySelector('[data-domain-card="github-global-advisories"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(github).not.toHaveTextContent('wrong-severity-package')

    rerender(<ResponseDemoPreview api={githubApi} executedRequest={{ url: requestUrl, method: 'GET' }} data={[{ ...advisory, summary: 'Wrong ecosystem advisory', vulnerabilities: [{ package: { ecosystem: 'pip', name: 'wrong-ecosystem-package' } }] }]}/>)
    expect(github.querySelector('[data-domain-card="github-global-advisories"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(github).not.toHaveTextContent('wrong-ecosystem-package')

    rerender(<ResponseDemoPreview api={githubApi} data={[advisory]}/>)
    expect(github.querySelector('[data-domain-card="github-global-advisories"]')).toHaveAttribute('data-result-state', 'partial')
  })

  it('renders live-location and licensed-media response shapes', () => {
    const cityBikesApi = api('citybikes-network')
    const cityBikesRequest = cityBikesApi.buildUrl({ network: 'youbike-taipei' })
    const { rerender } = render(<ResponseDemoPreview api={cityBikesApi} requestUrl={cityBikesRequest} data={{ network: {
      id: 'youbike-taipei', name: 'YouBike', href: '/v2/networks/youbike-taipei', location: { latitude: 25.0329636, longitude: 121.5654268, city: 'Taipei', country: 'TW' },
      stations: [{ id: 'demo-station', name: 'Demo Bike Station', latitude: 25.03, longitude: 121.56, timestamp: '2026-09-16T21:00:00+00:00Z', free_bikes: 12, empty_slots: 8 }],
    } }}/>)
    const bikes = screen.getByRole('region', { name: 'CityBikes Live Stations' })
    expect(bikes).toHaveTextContent('Demo Bike Station')
    expect(bikes).toHaveTextContent('12 bikes · 8 empty docks')

    const geocodingApi = api('geocoding-search')
    const geocodingRequest = geocodingApi.buildUrl({ name: 'Singapore', count: '6' })
    rerender(<ResponseDemoPreview api={geocodingApi} requestUrl={geocodingRequest} executedRequest={{ url: geocodingRequest, method: 'GET' }} data={{ generationtime_ms: 0.42, results: [{ id: 1880252, name: 'Singapore', latitude: 1.28967, longitude: 103.85007, country_code: 'SG', timezone: 'Asia/Singapore', population: 5638700, country: 'Singapore' }] }}/>)
    const geocoding = screen.getByRole('region', { name: 'Global Geocoding' })
    expect(geocoding).toHaveTextContent('Singapore')
    expect(within(geocoding).getByRole('img', { name: /Map with 1 validated Open-Meteo locations/ })).toBeInTheDocument()
    expect(geocoding.querySelector('[data-domain-card="open-meteo-geocoding"]')).toHaveAttribute('data-result-state', 'ready')

    const gbifApi = api('gbif-occurrence-search')
    rerender(<ResponseDemoPreview api={gbifApi} executedRequest={{ url: gbifApi.buildUrl({ scientificName: 'Panthera leo', limit: '6' }), method: 'GET' }} data={{ offset: 0, limit: 6, endOfRecords: true, count: 1, results: [{ key: 123, scientificName: 'Panthera leo', species: 'Panthera leo', decimalLatitude: -1.3, decimalLongitude: 36.8, locality: 'Nairobi', eventDate: '2026-08-01' }] }}/>)
    const gbif = screen.getByRole('region', { name: 'GBIF Occurrence Search' })
    expect(gbif).toHaveTextContent('Panthera leo')
    expect(gbif).toHaveTextContent('Nairobi · 2026-08-01')

    const commonsApi = api('wikimedia-commons-search')
    rerender(<ResponseDemoPreview api={commonsApi} requestUrl={commonsApi.buildUrl({ query: 'Singapore skyline', limit: '6' })} data={{ query: { pages: { 1: {
      pageid: 1, ns: 6, index: 1, title: 'File:Singapore skyline.jpg', imageinfo: [{ thumburl: 'https://images.test/sg.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Singapore_skyline.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' }, Artist: { value: 'Example Artist' }, AttributionRequired: { value: 'true' } } }],
    } } } }}/>)
    const commons = screen.getByRole('region', { name: 'Wikimedia Commons Search' })
    expect(commons).toHaveAttribute('data-preview-layout', 'commons-media-search')
    expect(within(commons).getByRole('img')).toHaveAttribute('src', 'https://images.test/sg.jpg')
    expect(commons).toHaveTextContent('Singapore skyline.jpg')
    expect(commons).toHaveTextContent('CC BY-SA 4.0')
  })

  it('renders developer, government, and current FX records', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('jsdelivr-package')} data={{ type: 'npm', name: 'react', tags: { latest: '19.2.8' }, versions: [{ version: '19.2.8', links: { self: 'https://data.jsdelivr.com/v1/packages/npm/react@19.2.8', stats: 'https://data.jsdelivr.com/v1/stats/packages/npm/react@19.2.8' } }, { version: '19.2.7', links: { self: 'https://data.jsdelivr.com/v1/packages/npm/react@19.2.7', stats: 'https://data.jsdelivr.com/v1/stats/packages/npm/react@19.2.7' } }, { version: '19.1.0', links: { self: 'https://data.jsdelivr.com/v1/packages/npm/react@19.1.0', stats: 'https://data.jsdelivr.com/v1/stats/packages/npm/react@19.1.0' } }], links: { stats: 'https://data.jsdelivr.com/v1/stats/packages/npm/react' } }}/>)
    const jsdelivr = screen.getByRole('region', { name: 'jsDelivr Package Metadata' })
    expect(jsdelivr).toHaveTextContent('19.2.8')
    expect(jsdelivr).toHaveTextContent('3 published versions')

    rerender(<ResponseDemoPreview api={api('canada-open-data-search')} requestUrl={api('canada-open-data-search').buildUrl({ query: 'artificial intelligence', limit: '6' })} data={{ success: true, result: { count: 1, results: [{ id: 'ai-guidance-1', name: 'ai-guidance-1', title: 'Artificial Intelligence - ITSAP.00.040', type: 'info', organization: { title: 'Government of Canada' }, date_published: '2025-12-10', notes: 'AI awareness guidance.' }] } }}/>)
    const canada = screen.getByRole('region', { name: 'Canada Open Data Search' })
    expect(canada).toHaveTextContent('Artificial Intelligence - ITSAP.00.040')
    expect(canada).toHaveTextContent('Government of Canada')

    rerender(<ResponseDemoPreview api={api('exchange-rate-current')} requestUrl={api('exchange-rate-current').buildUrl({ base: 'SGD' })} data={{ result: 'success', base_code: 'SGD', time_last_update_utc: 'Fri, 04 Sep 2026 00:02:31 +0000', rates: { SGD: 1, MYR: 3.11, USD: 0.789, EUR: 0.68, GBP: 0.59, JPY: 116.5, AUD: 1.09, CNY: 5.31 } }}/>)
    const fx = screen.getByRole('region', { name: 'Current FX Rates' })
    expect(fx).toHaveTextContent('1 SGD → MYR')
    expect(fx).toHaveTextContent('3.11')
  })

  it('renders ensemble uncertainty and selectable World Bank indicators', () => {
    const ensembleApi = api('open-meteo-ensemble')
    const ensembleTimes = Array.from({ length: 24 }, (_, index) => `2026-09-04T${String(index).padStart(2, '0')}:00`)
    const ensembleMembers = Array.from({ length: 39 }, (_, index) => `temperature_2m_member${String(index + 1).padStart(2, '0')}`)
    const { rerender } = render(<ResponseDemoPreview api={ensembleApi} executedRequest={{ url: ensembleApi.buildUrl({ forecastDays: '1' }), method: 'GET' }} data={{
      latitude: 1.5, longitude: 103.75, utc_offset_seconds: 28800, timezone: 'Asia/Singapore',
      hourly_units: { time: 'iso8601', temperature_2m: '°C', ...Object.fromEntries(ensembleMembers.map((key) => [key, '°C'])) },
      hourly: { time: ensembleTimes, temperature_2m: ensembleTimes.map(() => 30), ...Object.fromEntries(ensembleMembers.map((key, index) => [key, ensembleTimes.map(() => 29 + (index % 3))])) },
    }}/>)
    const ensemble = screen.getByRole('region', { name: 'Open-Meteo Ensemble Forecast' })
    expect(ensemble).toHaveAttribute('data-preview-layout', 'ensemble-forecast')
    expect(ensemble.querySelector('[data-domain-card="ensemble-forecast"]')).toHaveAttribute('data-result-state', 'ready')
    expect(ensemble).toHaveTextContent('Forecast members')
    expect(ensemble).toHaveTextContent('1 control + 39 perturbed')
    expect(ensemble).toHaveTextContent('29 – 31 °C')

    const worldBankApi = api('world-bank-indicator-explorer')
    rerender(<ResponseDemoPreview api={worldBankApi} executedRequest={{ url: worldBankApi.buildUrl({ startYear: '2023', endYear: '2025' }), method: 'GET' }} data={[
      { page: 1, pages: 1, per_page: '141', total: 3 },
      [
        { indicator: { id: 'SP.DYN.LE00.IN', value: 'Life expectancy at birth, total (years)' }, country: { id: 'SG', value: 'Singapore' }, countryiso3code: 'SGP', date: '2025', value: 84.1 },
        { indicator: { id: 'SP.DYN.LE00.IN', value: 'Life expectancy at birth, total (years)' }, country: { id: 'SG', value: 'Singapore' }, countryiso3code: 'SGP', date: '2024', value: 83.9 },
        { indicator: { id: 'SP.DYN.LE00.IN', value: 'Life expectancy at birth, total (years)' }, country: { id: 'SG', value: 'Singapore' }, countryiso3code: 'SGP', date: '2023', value: 83.7 },
      ],
    ]}/>)
    const worldBank = screen.getByRole('region', { name: 'World Bank Indicator Explorer' })
    expect(worldBank).toHaveAttribute('data-preview-layout', 'indicator-series')
    expect(worldBank.querySelector('[data-domain-card="world-bank-indicator-series"]')).toHaveAttribute('data-result-state', 'ready')
    expect(worldBank).toHaveTextContent('Life expectancy at birth, total (years) · Singapore')
    expect(worldBank).toHaveTextContent('Latest observation')
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
    const dictionaryApi = api('free-dictionary')
    const dictionaryRequest = dictionaryApi.buildUrl({ word: 'hello' })
    const { rerender } = render(<ResponseDemoPreview api={dictionaryApi} requestUrl={dictionaryRequest} executedRequest={{ method: 'GET', url: dictionaryRequest }} data={{
      word: 'hello',
      entries: [{ language: { code: 'en', name: 'English' }, partOfSpeech: 'interjection', pronunciations: [{ type: 'ipa', text: '/həˈloʊ/' }], senses: [{ definition: 'Used as a greeting.', examples: ['Hello there.'], synonyms: ['hi'] }] }],
      source: { url: 'https://en.wiktionary.org/wiki/hello', license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } },
    }}/>)
    expect(screen.getByRole('region', { name: 'Free Dictionary' })).toHaveTextContent('Used as a greeting.')
    expect(screen.getByRole('region', { name: 'Free Dictionary' })).toHaveTextContent('/həˈloʊ/')

    const openF1Api = api('openf1-historical')
    const openF1Request = openF1Api.buildUrl({ season: '2025', round: '1' })
    rerender(<ResponseDemoPreview api={openF1Api} data={openF1QualifyingFixture} requestUrl={openF1Request} executedRequest={{ url: openF1Request, method: 'GET' }}/>)
    const f1 = screen.getByRole('region', { name: 'Jolpica F1 Qualifying' })
    expect(f1).toHaveTextContent('Australian Grand Prix')
    expect(f1).toHaveTextContent('Lando Norris')
    expect(f1).toHaveTextContent('1:15.096')

    rerender(<ResponseDemoPreview api={api('models-dev')} data={[{ id: 'openai-community/gpt2', pipeline_tag: 'text-generation', library_name: 'transformers', downloads: 14607268, likes: 3618, lastModified: '2026-09-01T00:00:00Z' }]}/>)
    const models = screen.getByRole('region', { name: 'Hugging Face Model Search' })
    expect(models).toHaveTextContent('openai-community/gpt2')
    expect(models).toHaveTextContent('text-generation')

    rerender(<ResponseDemoPreview api={api('pub-dev')} requestUrl="https://pub.dev/api/packages/riverpod" data={{ name: 'riverpod', latest: { version: '3.4.3', archive_url: 'https://pub.dev/api/archives/riverpod-3.4.3.tar.gz', published: '2026-09-03T22:14:57Z', pubspec: { name: 'riverpod', version: '3.4.3', description: 'A reactive caching and data-binding framework.', repository: 'https://github.com/rrousselGit/riverpod', topics: ['state-management'], environment: { sdk: '^3.12.0' } } }, versions: [{ version: '3.4.2', archive_url: 'https://pub.dev/api/archives/riverpod-3.4.2.tar.gz', pubspec: { name: 'riverpod', version: '3.4.2' } }, { version: '3.4.3', archive_url: 'https://pub.dev/api/archives/riverpod-3.4.3.tar.gz', pubspec: { name: 'riverpod', version: '3.4.3' } }] }}/>)
    const pubdev = screen.getByRole('region', { name: 'pub.dev Package Lookup' })
    expect(pubdev).toHaveTextContent('riverpod')
    expect(pubdev).toHaveTextContent('3.4.3')
    expect(pubdev).toHaveTextContent('^3.12.0')
  })

  it('renders remediated Treasury, FX, UNHCR, IFRC, and citation contracts', () => {
    const { rerender } = render(<ResponseDemoPreview api={api('fiscal-data-treasury')} data={{ fiscal_year: 2026, toptier_code: '020', name: 'Department of the Treasury', abbreviation: 'TREAS', agency_id: 456, subtier_agency_count: 8, mission: 'Maintain a strong economy and manage the U.S. Government finances effectively.', website: 'https://www.treasury.gov/', congressional_justification_url: 'https://www.treasury.gov/cj', def_codes: [{ code: 'N', title: 'CARES Act', public_law: 'Emergency P.L. 116-136', disaster: 'covid_19' }] }}/>)
    const treasury = screen.getByRole('region', { name: 'U.S. Treasury Agency Overview' })
    expect(treasury).toHaveAttribute('data-preview-layout', 'federal-agency-overview')
    expect(treasury).toHaveTextContent('Department of the Treasury')
    expect(treasury).toHaveTextContent('Maintain a strong economy')
    expect(treasury).toHaveTextContent('Overview, not spending totals')
    expect(treasury).toHaveTextContent('CARES Act')

    rerender(<ResponseDemoPreview api={api('usaspending')} data={{ spending_level: 'awards', limit: 1, results: [{ internal_id: 1, 'Award ID': 'FA521525P0037', 'Recipient Name': 'MCS OF TAMPA, INC.', 'Award Amount': 437441.54, 'Base Obligation Date': '2025-09-30', 'Awarding Agency': 'Department of Defense', 'Awarding Sub Agency': 'Department of the Air Force', 'Funding Agency': 'Department of Defense', 'Funding Sub Agency': 'Department of the Air Force', 'Contract Award Type': 'PURCHASE ORDER', Description: 'Installation of communications hardware and software.' }], page_metadata: { page: 1, hasNext: true }, messages: ['Search coverage note.'] }}/>)
    const awards = screen.getByRole('region', { name: 'USAspending Contract Awards' })
    expect(awards).toHaveAttribute('data-preview-layout', 'federal-awards')
    expect(awards).toHaveTextContent('MCS OF TAMPA, INC.')
    expect(awards).toHaveTextContent('$437,441.54')
    expect(awards).toHaveTextContent('Base obligation date')
    expect(awards).toHaveTextContent('PURCHASE ORDER')
    expect(awards).not.toHaveTextContent('USAspending Contract Awards record 1')

    rerender(<ResponseDemoPreview api={api('ecb-fx-rates')} requestUrl="https://api.coinbase.com/v2/exchange-rates?currency=EUR" data={{ data: { currency: 'EUR', rates: { USD: '1.1599', GBP: '0.8593', SGD: '1.4708', BTC: '0.000010' } } }}/>)
    const fx = screen.getByRole('region', { name: 'Coinbase Exchange Rates' })
    expect(fx).toHaveTextContent('1 EUR → USD')
    expect(fx).toHaveTextContent('1.1599')

    rerender(<ResponseDemoPreview api={api('vatcomply')} requestUrl="https://api.vatcomply.com/rates?base=EUR&symbols=USD%2CSGD%2CGBP" data={{ date: '2026-09-04', base: 'EUR', rates: { USD: 1.1622, GBP: 0.85898, SGD: 1.4724 } }}/>)
    const vatRates = screen.getByRole('region', { name: 'VATComply Exchange Rates' })
    expect(vatRates).toHaveAttribute('data-preview-layout', 'exchange-rates')
    expect(vatRates).toHaveTextContent('1 EUR → USD')
    expect(vatRates).not.toHaveTextContent('VATComply API record 1')

    rerender(<ResponseDemoPreview api={api('unhcr-refugees')} data={{ items: [{ year: 2025, coo: 'SYR', coo_iso: 'SYR', coo_name: 'Syrian Arab Rep.', refugees: 4865764, asylum_seekers: 154355, returned_refugees: 1341148, idps: 5542227, returned_idps: 1964201, stateless: '0' }] }}/>)
    const unhcr = screen.getByRole('region', { name: 'UNHCR Refugee Statistics' })
    expect(unhcr).toHaveAttribute('data-preview-layout', 'refugee-population')
    expect(unhcr).toHaveTextContent('Syrian Arab Rep. · 2025')
    expect(unhcr).toHaveTextContent('4,865,764')
    expect(unhcr).toHaveTextContent('1,341,148')
    expect(unhcr).toHaveTextContent('1,964,201')

    rerender(<ResponseDemoPreview api={api('hdx-humanitarian-datasets')} executedRequest={{ url: api('hdx-humanitarian-datasets').buildUrl({}), method: 'GET' }} data={{ count: 1, results: [{ id: 8079, name: 'PHL: Flood - 08-2026', dtype: { name: 'Flood' }, countries: [{ name: 'Philippines' }], ifrc_severity_level_display: 'Yellow', disaster_start_date: '2026-08-29T00:00:00Z', summary: 'Philippines flood emergency', description: 'Heavy rainfall and flooding.', field_reports: [{ num_affected: 1588424, num_dead: 31, num_displaced: '83580' }] }] }}/>)
    const ifrc = screen.getByRole('region', { name: 'IFRC GO Emergency Events' })
    expect(ifrc).toHaveTextContent('Philippines flood emergency')
    expect(ifrc).toHaveTextContent('1,588,424')
    expect(ifrc).toHaveTextContent('Yellow')

    rerender(<ResponseDemoPreview api={api('opencitations-index')} data={[{ count: '98' }]} requestUrl="https://api.opencitations.net/index/v2/citation-count/doi:10.1109%2F5.771073"/>)
    const citations = screen.getByRole('region', { name: 'OpenCitations Citation Count' })
    expect(citations).toHaveAttribute('data-preview-layout', 'citation-count')
    expect(citations).toHaveTextContent('98 incoming citations')
    expect(citations).toHaveTextContent('10.1109/5.771073')


    rerender(<ResponseDemoPreview api={api('geoboundaries-admin-boundaries')} data={{ boundaryID: 'SGP-ADM0-21272760', boundaryName: 'Singapore', boundaryISO: 'SGP', boundaryType: 'ADM0', boundaryYearRepresented: '2016', admUnitCount: '1', meanAreaSqKM: '724.2749814174942', boundaryLicense: 'Open Data Commons Open Database License 1.0', boundarySource: 'Urban Redevelopment Authority', gjDownloadURL: 'https://example.test/sgp.geojson' }}/>)
    const boundary = screen.getByRole('region', { name: 'geoBoundaries Admin Boundaries' })
    expect(boundary).toHaveAttribute('data-preview-layout', 'boundary-layer')
    expect(boundary).toHaveTextContent('Singapore · ADM0')
    expect(boundary).toHaveTextContent('Mean administrative-unit area')
    expect(boundary).toHaveTextContent('ADM0')
    expect(boundary).toHaveTextContent('Open Data Commons Open Database License 1.0')
  })
})
