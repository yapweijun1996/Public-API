import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { buildDemoPreview, selectPreviewLayout } from './responsePreview'

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
