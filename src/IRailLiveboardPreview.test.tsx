import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'irail-liveboard')!
const departureUrl = api.buildUrl({ station: 'Brussels-South', direction: 'departure' })
const arrivalUrl = api.buildUrl({ station: 'Gent-Sint-Pieters', direction: 'arrival' })

const request = (url: string, overrides: Partial<ExecutedRequestContext> = {}): ExecutedRequestContext => ({
  url,
  method: 'GET',
  ...overrides,
})

const stationInfo = (id = 'BE.NMBS.008814001', name = 'Brussels-South/Brussels-Midi') => ({
  id,
  '@id': `http://irail.be/stations/NMBS/${id.replace('BE.NMBS.', '')}`,
  name,
  standardname: name,
})

const service = (overrides: Record<string, unknown> = {}) => ({
  id: '0',
  time: '1789994580',
  delay: '300',
  canceled: '0',
  station: 'Antwerp-Central',
  vehicle: 'BE.NMBS.IC123',
  platform: '4',
  ...overrides,
})

const departureResponse = (rows: unknown[] = [service()], number = String(rows.length)) => ({
  version: '1.1',
  timestamp: '1789994400',
  station: 'Brussels-South/Brussels-Midi',
  stationinfo: stationInfo(),
  departures: { number, departure: rows },
})

const preview = (data: unknown, requestUrl = departureUrl, executedRequest: ExecutedRequestContext | undefined = request(requestUrl)) => (
  <ResponseDemoPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>
)

afterEach(cleanup)

describe('iRail liveboard semantic preview', () => {
  it('renders a ready departure board only from an exact bodyless GET and provider-owned station identity', () => {
    const { container } = render(preview(departureResponse()))
    const card = container.querySelector('[data-domain-card="irail-liveboard"]')

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-board-direction', 'departure')
    expect(card).toHaveAttribute('data-requested-station', 'Brussels-South')
    expect(card).toHaveAttribute('data-provider-station-id', 'BE.NMBS.008814001')
    expect(card).toHaveAttribute('data-provider-count', '1')
    expect(card).toHaveAttribute('data-valid-service-count', '1')
    expect(card).toHaveTextContent('Departures at Brussels-South/Brussels-Midi')
    expect(card).toHaveTextContent('Antwerp-Central')
    expect(card).toHaveTextContent('Delayed 5 min')
  })

  it('supports the documented arrival board envelope and labels origins honestly', () => {
    const data = {
      version: '1.1',
      timestamp: '1789994400',
      station: 'Ghent-Sint-Pieters',
      stationinfo: stationInfo('BE.NMBS.008892007', 'Ghent-Sint-Pieters'),
      arrivals: { number: '1', arrival: [service({ station: 'Brugge', vehicle: 'BE.NMBS.IC535', delay: '0' })] },
    }
    const { container } = render(preview(data, arrivalUrl))
    const card = container.querySelector('[data-domain-card="irail-liveboard"]')

    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-board-direction', 'arrival')
    expect(card).toHaveTextContent('Arrivals at Ghent-Sint-Pieters')
    expect(card).toHaveTextContent('From Brugge')
    expect(card).toHaveTextContent('On schedule')
  })

  it('fails closed for wrong methods, request bodies, URL drift, and missing execution evidence', () => {
    const payload = departureResponse([service({ station: 'Injected destination' })])
    const cases: ExecutedRequestContext[] = [
      request(departureUrl, { method: 'POST' }),
      request(departureUrl, { body: { unexpected: true } }),
      request(`${departureUrl}&extra=true`),
    ]
    const { container, rerender } = render(preview(payload, departureUrl, cases[0]))

    for (const executedRequest of cases) {
      rerender(preview(payload, departureUrl, executedRequest))
      const card = container.querySelector('[data-domain-card="irail-liveboard"]')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
      expect(card).not.toHaveTextContent('Injected destination')
    }

    rerender(<ResponseDemoPreview api={api} data={payload} requestUrl={departureUrl}/>)
    const unbound = container.querySelector('[data-domain-card="irail-liveboard"]')
    expect(unbound).toHaveAttribute('data-result-state', 'invalid')
    expect(unbound).toHaveAttribute('data-request-bound', 'false')
    expect(unbound).not.toHaveTextContent('Injected destination')
  })

  it('rejects wrong-station and unrelated transit-shaped HTTP-success payloads', () => {
    const wrongStation = departureResponse([service({ station: 'Injected destination' })])
    wrongStation.stationinfo = stationInfo('BE.NMBS.008821006', 'Antwerp-Central')
    wrongStation.station = 'Antwerp-Central'
    const unrelated = { connections: [{ from: { station: 'Injected origin' }, to: { station: 'Injected destination' } }] }
    const { container, rerender } = render(preview(wrongStation))

    let card = container.querySelector('[data-domain-card="irail-liveboard"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('Injected destination')

    rerender(preview(unrelated))
    card = container.querySelector('[data-domain-card="irail-liveboard"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('Injected origin')
  })

  it('explains incomplete-but-valid service evidence without falsely claiming malformed rows were withheld', () => {
    const { container } = render(preview(departureResponse([service({ platform: undefined })])))
    const card = container.querySelector('[data-domain-card="irail-liveboard"]')

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-invalid-service-count', '0')
    expect(card).toHaveAttribute('data-incomplete-service-count', '1')
    expect(card).toHaveTextContent(/one trusted service has incomplete optional platform evidence/i)
    expect(card).not.toHaveTextContent(/0 malformed services were withheld/i)
  })

  it('distinguishes coherent empty and mixed partial boards without fabricating services', () => {
    const { container, rerender } = render(preview(departureResponse([], '0')))
    let card = container.querySelector('[data-domain-card="irail-liveboard"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveTextContent('No departures reported')

    rerender(preview(departureResponse([service(), service({ id: '1', time: 'not-an-epoch', station: 'Fabricated row' })], '2')))
    card = container.querySelector('[data-domain-card="irail-liveboard"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-service-count', '1')
    expect(card).toHaveAttribute('data-invalid-service-count', '1')
    expect(card).toHaveTextContent('Antwerp-Central')
    expect(card).not.toHaveTextContent('Fabricated row')
    expect(screen.getByText(/one malformed service was withheld/i)).toBeInTheDocument()
  })
})
