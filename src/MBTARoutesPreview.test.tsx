import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('mbta-transit-routes')
if (!api) throw new Error('Missing mbta-transit-routes fixture')

const requestUrl = api.buildUrl({ routeType: '0,1' })
const executedGet: ExecutedRequestContext = { method: 'GET', url: requestUrl }
const route = (overrides: Record<string, unknown> = {}) => ({
  type: 'route',
  id: 'Red',
  attributes: {
    color: 'DA291C',
    text_color: 'FFFFFF',
    description: 'Rapid Transit',
    direction_destinations: ['Ashmont/Braintree', 'Alewife'],
    direction_names: ['South', 'North'],
    fare_class: 'Rapid Transit',
    listed_route: true,
    long_name: 'Red Line',
    short_name: '',
    sort_order: 10010,
    type: 1,
  },
  ...overrides,
})

const preview = (data: unknown, url = requestUrl, executedRequest: ExecutedRequestContext | undefined = executedGet) => (
  <ResponseDemoPreview api={api} data={data} requestUrl={url} executedRequest={executedRequest}/>
)

afterEach(cleanup)

describe('MBTA routes semantic preview', () => {
  it('renders request-bound JSON:API route evidence for the selected transit mode', () => {
    const { container } = render(preview({ data: [route()] }))
    const card = container.querySelector('[data-domain-card="mbta-routes"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-route-types', '0,1')
    expect(card).toHaveAttribute('data-valid-route-count', '1')
    expect(card).toHaveTextContent('Red Line')
    expect(card).toHaveTextContent('Ashmont/Braintree ↔ Alewife')
  })

  it('fails closed when execution transport or exact URL identity is missing or drifted', () => {
    const payload = { data: [route()] }
    const { container, rerender } = render(<ResponseDemoPreview api={api} data={payload} requestUrl={requestUrl}/>)
    let card = container.querySelector('[data-domain-card="mbta-routes"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('Red Line')

    rerender(preview(payload, requestUrl, { method: 'POST', url: requestUrl }))
    card = container.querySelector('[data-domain-card="mbta-routes"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    const duplicate = `${requestUrl}&filter%5Btype%5D=3`
    rerender(preview(payload, duplicate, { method: 'GET', url: duplicate }))
    card = container.querySelector('[data-domain-card="mbta-routes"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds route rows whose provider type contradicts the selected filter', () => {
    const bus = route({ id: '741', attributes: { ...(route().attributes as Record<string, unknown>), long_name: 'SL1', short_name: 'SL1', type: 3 } })
    const { container } = render(preview({ data: [route(), bus] }))
    const card = container.querySelector('[data-domain-card="mbta-routes"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-route-count', '1')
    expect(card).toHaveAttribute('data-invalid-route-count', '1')
    expect(card).toHaveTextContent('Red Line')
    expect(card).not.toHaveTextContent('SL1')
  })

  it('fails closed when no returned route belongs to the requested mode', () => {
    const bus = route({ id: '741', attributes: { ...(route().attributes as Record<string, unknown>), long_name: 'SL1', short_name: 'SL1', type: 3 } })
    const { container } = render(preview({ data: [bus] }))
    const card = container.querySelector('[data-domain-card="mbta-routes"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('SL1')
  })

  it('maps an exact request-bound empty route collection to empty', () => {
    const { container } = render(preview({ data: [] }))
    const card = container.querySelector('[data-domain-card="mbta-routes"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveTextContent('No MBTA routes returned')
  })
})
