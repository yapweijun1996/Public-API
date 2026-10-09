import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('swiss-transit-connections')
if (!api) throw new Error('Missing swiss-transit-connections fixture')

const requestUrl = api.buildUrl({ from: 'Zurich', to: 'Geneva', limit: '2' })
const executedGet: ExecutedRequestContext = { method: 'GET', url: requestUrl }

const connection = (overrides: Record<string, unknown> = {}) => ({
  from: {
    station: { id: '8503000', name: 'Zürich HB' },
    departure: '2026-09-21T18:32:00+0200',
    delay: 5,
    platform: '12',
  },
  to: {
    station: { id: '8501008', name: 'Genève' },
    arrival: '2026-09-21T21:25:00+0200',
    delay: null,
    platform: '4',
  },
  duration: '00d02:53:00',
  transfers: 0,
  products: ['IC 1'],
  sections: [{
    journey: { name: '000730', category: 'IC', number: '1', to: 'Genève-Aéroport' },
    walk: null,
    departure: { station: { id: '8503000', name: 'Zürich HB' }, delay: 5 },
    arrival: { station: { id: '8501008', name: 'Genève' }, delay: null },
  }],
  ...overrides,
})

const preview = (data: unknown, url = requestUrl, executedRequest: ExecutedRequestContext | undefined = executedGet) => (
  <ResponseDemoPreview api={api} data={data} requestUrl={url} executedRequest={executedRequest}/>
)

afterEach(cleanup)

describe('Swiss transit connections semantic preview', () => {
  it('renders documented connection/checkpoint/journey fields from an exact bodyless GET', () => {
    const { container } = render(preview({ connections: [connection()] }))
    const card = container.querySelector('[data-domain-card="swiss-transit-connections"]')

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-from', 'Zurich')
    expect(card).toHaveAttribute('data-requested-to', 'Geneva')
    expect(card).toHaveAttribute('data-valid-connection-count', '1')
    expect(card).toHaveTextContent('Zürich HB → Genève')
    expect(card).toHaveTextContent('IC 1')
    expect(card).toHaveTextContent('Delayed 5 min')
    expect(card).not.toHaveTextContent('Transit connection')
  })

  it('does not manufacture On schedule when the documented checkpoint delay is unavailable', () => {
    const { container } = render(preview({ connections: [connection({
      from: {
        station: { id: '8503000', name: 'Zürich HB' },
        departure: '2026-09-21T18:32:00+0200',
        delay: null,
        platform: '12',
      },
    })] }))
    const card = container.querySelector('[data-domain-card="swiss-transit-connections"]')

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-delay-unavailable-count', '1')
    expect(card).toHaveTextContent('Delay unavailable')
    expect(card).not.toHaveTextContent('On schedule')
  })

  it('fails closed for missing or drifted execution evidence and withholds provider facts', () => {
    const payload = { connections: [connection()] }
    const { container, rerender } = render(<ResponseDemoPreview api={api} data={payload} requestUrl={requestUrl}/>)

    let card = container.querySelector('[data-domain-card="swiss-transit-connections"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).not.toHaveTextContent('Zürich HB')

    rerender(preview(payload, requestUrl, { method: 'POST', url: requestUrl }))
    card = container.querySelector('[data-domain-card="swiss-transit-connections"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('Genève')

    rerender(preview(payload, requestUrl, { method: 'GET', url: `${requestUrl}&page=1` }))
    card = container.querySelector('[data-domain-card="swiss-transit-connections"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('maps a coherent request-bound zero-connection response to empty', () => {
    const { container } = render(preview({ connections: [] }))
    const card = container.querySelector('[data-domain-card="swiss-transit-connections"]')

    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveTextContent('No Swiss transit connections returned')
  })

  it('withholds malformed rows while keeping trusted rows explicitly partial', () => {
    const malformed = connection({
      from: { station: { id: 'bad', name: '' }, departure: 123, delay: '0' },
    })
    const { container } = render(preview({ connections: [connection(), malformed] }))
    const card = container.querySelector('[data-domain-card="swiss-transit-connections"]')

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-connection-count', '1')
    expect(card).toHaveAttribute('data-invalid-connection-count', '1')
    expect(card).toHaveTextContent('one malformed connection was withheld')
  })
})
