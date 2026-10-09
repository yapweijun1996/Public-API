import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('nasa-eonet-events')
if (!api) throw new Error('Missing nasa-eonet-events fixture')

const requestUrl = api.buildUrl({ category: 'wildfires', days: '30', limit: '2' })
const executedGet: ExecutedRequestContext = { method: 'GET', url: requestUrl }
const event = (overrides: Record<string, unknown> = {}) => ({
  id: 'EONET_7001',
  title: 'Pacific Wildfire',
  description: null,
  link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_7001',
  closed: null,
  categories: [{ id: 'wildfires', title: 'Wildfires' }],
  sources: [{ id: 'InciWeb', url: 'https://inciweb.wildfire.gov/' }],
  geometry: [{ date: '2026-09-21T00:00:00Z', type: 'Point', coordinates: [-121.51, 39.76], magnitudeValue: 503, magnitudeUnit: 'acres' }],
  ...overrides,
})

const preview = (data: unknown, url = requestUrl, executedRequest: ExecutedRequestContext | undefined = executedGet) => (
  <ResponseDemoPreview api={api} data={data} requestUrl={url} executedRequest={executedRequest}/>
)

afterEach(cleanup)

describe('NASA EONET events semantic preview', () => {
  it('renders exact-request-bound open event evidence for the selected category', () => {
    const { container } = render(preview({ events: [event()] }))
    const card = container.querySelector('[data-domain-card="nasa-eonet-events"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-category', 'wildfires')
    expect(card).toHaveAttribute('data-requested-days', '30')
    expect(card).toHaveAttribute('data-requested-limit', '2')
    expect(card).toHaveAttribute('data-valid-event-count', '1')
    expect(card).toHaveTextContent('Pacific Wildfire')
    expect(card).toHaveTextContent('39.76, -121.51')
  })

  it('degrades documented missing or empty source evidence instead of reporting ready', () => {
    const missingSource = event({ sources: undefined })
    const emptySource = event({ id: 'EONET_7002', title: 'Source-less wildfire', link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_7002', sources: [] })
    const twoEventUrl = api.buildUrl({ category: 'wildfires', days: '30', limit: '2' })
    const { container } = render(preview({ events: [missingSource, emptySource] }, twoEventUrl, { method: 'GET', url: twoEventUrl }))
    const card = container.querySelector('[data-domain-card="nasa-eonet-events"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-event-count', '2')
    expect(card).toHaveAttribute('data-incomplete-event-count', '2')
    expect(card).toHaveTextContent('Pacific Wildfire')
    expect(card).toHaveTextContent('Source-less wildfire')
  })

  it('fails closed when execution transport or exact URL identity is missing or drifted', () => {
    const payload = { events: [event()] }
    const { container, rerender } = render(<ResponseDemoPreview api={api} data={payload} requestUrl={requestUrl}/>)
    let card = container.querySelector('[data-domain-card="nasa-eonet-events"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('Pacific Wildfire')

    for (const executedRequest of [
      { method: 'POST', url: requestUrl },
      { method: 'GET', url: requestUrl, body: { unexpected: true } },
      { method: 'GET', url: api.buildUrl({ category: 'volcanoes', days: '30', limit: '2' }) },
    ] satisfies ExecutedRequestContext[]) {
      rerender(preview(payload, requestUrl, executedRequest))
      card = container.querySelector('[data-domain-card="nasa-eonet-events"]')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).not.toHaveTextContent('Pacific Wildfire')
    }

    for (const nonCanonicalUrl of [
      'https://eonet.gsfc.nasa.gov/api/v3/events?days=30&status=open&limit=2&category=wildfires',
      'https://eonet.gsfc.nasa.gov/api/v3/events?status=closed&days=30&limit=2&category=wildfires',
      'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=030&limit=2&category=wildfires',
    ]) {
      rerender(preview(payload, nonCanonicalUrl, { method: 'GET', url: nonCanonicalUrl }))
      card = container.querySelector('[data-domain-card="nasa-eonet-events"]')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
      expect(card).not.toHaveTextContent('Pacific Wildfire')
    }
  })

  it('renders documented Polygon geometry without inventing a point location', () => {
    const polygon = event({
      geometry: [{
        date: '2026-09-21T00:00:00Z',
        type: 'Polygon',
        coordinates: [[[-121.5, 39.7], [-121.4, 39.7], [-121.4, 39.8], [-121.5, 39.7]]],
        magnitudeValue: null,
        magnitudeUnit: null,
      }],
    })
    const { container } = render(preview({ events: [polygon] }))
    const card = container.querySelector('[data-domain-card="nasa-eonet-events"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    const row = container.querySelector('[data-event-id="EONET_7001"]')
    expect(row).toHaveAttribute('data-geometry-type', 'Polygon')
    expect(row).not.toHaveAttribute('data-latitude')
    expect(row).not.toHaveAttribute('data-longitude')
    expect(row).toHaveTextContent('Polygon geometry · 1 ring')
  })

  it('withholds events whose status or category contradicts the executed request', () => {
    const volcano = event({ id: 'EONET_7002', title: 'Wrong-category volcano', link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_7002', categories: [{ id: 'volcanoes', title: 'Volcanoes' }] })
    const closed = event({ id: 'EONET_7003', title: 'Closed wildfire', link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_7003', closed: '2026-09-21T10:00:00Z' })
    const threeEventUrl = api.buildUrl({ category: 'wildfires', days: '30', limit: '3' })
    const { container } = render(preview({ events: [event(), volcano, closed] }, threeEventUrl, { method: 'GET', url: threeEventUrl }))
    const card = container.querySelector('[data-domain-card="nasa-eonet-events"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-event-count', '1')
    expect(card).toHaveAttribute('data-invalid-event-count', '2')
    expect(card).toHaveTextContent('Pacific Wildfire')
    expect(card).not.toHaveTextContent('Wrong-category volcano')
    expect(card).not.toHaveTextContent('Closed wildfire')
  })

  it('fails closed when an HTTP-200 event collection exceeds the requested limit', () => {
    const rows = [event(), event({ id: 'EONET_7002', title: 'Second wildfire', link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_7002' }), event({ id: 'EONET_7003', title: 'Third wildfire', link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_7003' })]
    const { container } = render(preview({ events: rows }))
    const card = container.querySelector('[data-domain-card="nasa-eonet-events"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-result-reason', 'provider-count-exceeds-limit')
    expect(card).not.toHaveTextContent('Pacific Wildfire')
  })

  it('reports partial evidence for duplicate IDs, malformed rows, or malformed optional values', () => {
    const duplicate = event({ title: 'Duplicate identity' })
    const incomplete = event({ id: 'EONET_7002', title: 'Incomplete wildfire', link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_7002', description: 42, geometry: [{ date: '2026-09-21T00:00:00Z', type: 'Point', coordinates: [-122.2, 40.1], magnitudeValue: '503', magnitudeUnit: 'acres' }] })
    const { container } = render(preview({ events: [event(), duplicate, incomplete] }, api.buildUrl({ category: 'wildfires', days: '30', limit: '3' }), { method: 'GET', url: api.buildUrl({ category: 'wildfires', days: '30', limit: '3' }) }))
    const card = container.querySelector('[data-domain-card="nasa-eonet-events"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-event-count', '2')
    expect(card).toHaveAttribute('data-invalid-event-count', '1')
    expect(card).toHaveAttribute('data-incomplete-event-count', '1')
    expect(card).not.toHaveTextContent('Duplicate identity')
    expect(card).toHaveTextContent('Magnitude unavailable')
  })

  it('maps only an exact request-bound empty collection to empty', () => {
    const { container } = render(preview({ events: [] }))
    const card = container.querySelector('[data-domain-card="nasa-eonet-events"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveTextContent('No active NASA EONET events matched')
  })
})
