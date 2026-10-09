import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import { buildCityBikesNetworkViewModel, CityBikesNetworkPreview, parseCityBikesRequest } from './previews/CityBikesNetworkPreview'

const api = apiCatalog.find((candidate) => candidate.id === 'citybikes-network')!
const requestUrl = api.buildUrl({ network: 'youbike-taipei' })
const executedGet = { url: requestUrl, method: 'GET' } as const
const station = (overrides: Record<string, unknown> = {}) => ({ id: 'station-1', name: 'Demo Station', latitude: 25.03, longitude: 121.56, timestamp: '2026-09-16T21:00:00+00:00Z', free_bikes: 12, empty_slots: 8, ...overrides })
const response = (stations: unknown[], overrides: Record<string, unknown> = {}) => ({ network: { id: 'youbike-taipei', name: 'YouBike', href: '/v2/networks/youbike-taipei', location: { latitude: 25.0329636, longitude: 121.5654268, city: 'Taipei', country: 'TW' }, stations, ...overrides } })

describe('CityBikes request-bound network preview', () => {
  it('fails closed when the executed transport is not the exact bodyless GET shown to the user', async () => {
    const { container, rerender } = render(<ResponseDemoPreview api={api} data={response([station()])} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)
    await screen.findByRole('heading', { name: 'CityBikes network evidence unavailable' })
    expect(container.querySelector('[data-domain-card="citybikes-network"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} data={response([station()])} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }}/>)
    expect(container.querySelector('[data-domain-card="citybikes-network"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} data={response([station()])} requestUrl={requestUrl} executedRequest={{ url: `${requestUrl}?drift=1`, method: 'GET' }}/>)
    expect(container.querySelector('[data-domain-card="citybikes-network"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('binds the declared network request and renders native availability', () => {
    const model = buildCityBikesNetworkViewModel(api, response([station(), station({ id: 'station-2', name: 'Second Station', free_bikes: 4, empty_slots: 6 })]), requestUrl, executedGet)
    expect(model).toMatchObject({ state: 'ready', requestBound: true, providerStationCount: 2, validStationCount: 2, invalidStationCount: 0, freeBikes: 16, emptySlots: 14 })
    render(<CityBikesNetworkPreview api={api} data={response([station()])} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const card = screen.getByRole('heading', { name: 'YouBike · Taipei' }).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-network', 'youbike-taipei')
    expect(card).toHaveAttribute('data-primary-station-id', 'station-1')
    expect(card).toHaveTextContent('12 bikes · 8 empty docks')
    expect(screen.getByRole('link', { name: 'CityBikes' })).toHaveAttribute('href', 'https://citybik.es/')
  })

  it('keeps valid displayed request evidence partial until a real execution binds it', () => {
    expect(buildCityBikesNetworkViewModel(api, response([station()]), requestUrl)).toMatchObject({ state: 'partial', requestBound: false })
    expect(buildCityBikesNetworkViewModel(api, response([]), requestUrl)).toMatchObject({ state: 'partial', requestBound: false, providerStationCount: 0 })
  })

  it('rejects extra query semantics and undeclared network paths', () => {
    expect(parseCityBikesRequest(api, `${requestUrl}?foo=bar`)).toBeUndefined()
    expect(parseCityBikesRequest(api, 'https://api.citybik.es/v2/networks/another-network')).toBeUndefined()
    expect(buildCityBikesNetworkViewModel(api, response([station()]), `${requestUrl}?fields=stations`).state).toBe('invalid')
  })

  it('rejects response network identity drift', () => {
    expect(buildCityBikesNetworkViewModel(api, response([station()], { id: 'velib', href: '/v2/networks/velib' }), requestUrl, executedGet)).toMatchObject({ state: 'invalid', requestBound: true, responseNetworkId: 'velib' })
  })

  it('withholds malformed native availability and duplicate station identities', () => {
    const model = buildCityBikesNetworkViewModel(api, response([station(), station({ id: 'station-2', free_bikes: '12' }), station({ name: 'Duplicate Station' })]), requestUrl, executedGet)
    expect(model).toMatchObject({ state: 'partial', providerStationCount: 3, validStationCount: 1, invalidStationCount: 2, duplicateStationCount: 1 })
    expect(model.stations.map((entry) => entry.name)).toEqual(['Demo Station'])
  })

  it('maps an exact network with no stations to semantic empty', () => {
    expect(buildCityBikesNetworkViewModel(api, response([]), requestUrl, executedGet)).toMatchObject({ state: 'empty', requestBound: true, providerStationCount: 0 })
  })
})
