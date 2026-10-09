import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { buildOpenMeteoGeocodingViewModel, OpenMeteoGeocodingPreview, parseOpenMeteoGeocodingRequest } from './previews/OpenMeteoGeocodingPreview'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'geocoding-search')!
const requestUrl = api.buildUrl({ name: 'Singapore', count: '6' })
const place = (overrides: Record<string, unknown> = {}) => ({ id: 1880252, name: 'Singapore', latitude: 1.28967, longitude: 103.85007, elevation: 23, feature_code: 'PPLC', country_code: 'SG', timezone: 'Asia/Singapore', population: 5638700, country: 'Singapore', ...overrides })
const response = (results?: unknown[]) => results === undefined ? { generationtime_ms: 0.42 } : { results, generationtime_ms: 0.42 }
const executedRequest = { method: 'GET', url: requestUrl } as const

describe('Open-Meteo request-bound geocoding preview', () => {
  it('binds exact request and renders provider identity', () => {
    const model = buildOpenMeteoGeocodingViewModel(api, response([place()]), requestUrl, executedRequest)
    expect(model).toMatchObject({ state: 'ready', requestBound: true, providerRecordCount: 1, validRecordCount: 1, invalidRecordCount: 0 })
    render(<OpenMeteoGeocodingPreview api={api} data={response([place()])} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const card = screen.getByRole('heading', { name: '1 validated location' }).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-name', 'Singapore')
    expect(card).toHaveAttribute('data-primary-location-id', '1880252')
    expect(screen.getByRole('img', { name: 'Map with 1 validated Open-Meteo locations' })).toBeInTheDocument()
    expect(screen.getByText(/population 5,638,700/)).toBeInTheDocument()
  })
  it('fails closed when the displayed geocoding URL was actually executed with POST', () => {
    render(<ResponseDemoPreview api={api} data={response([place()])} requestUrl={requestUrl} executedRequest={{ method: 'POST', url: requestUrl }} />)
    const card = screen.getByText('Geocoding evidence unavailable').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })
  it('rejects GET bodies and URL disagreement, and stays partial without execution evidence', () => {
    expect(buildOpenMeteoGeocodingViewModel(api, response([place()]), requestUrl, { method: 'GET', url: requestUrl, body: '{}' })).toMatchObject({ state: 'invalid', requestBound: false })
    const otherUrl = api.buildUrl({ name: 'London', count: '6' })
    expect(buildOpenMeteoGeocodingViewModel(api, response([place()]), requestUrl, { method: 'GET', url: otherUrl })).toMatchObject({ state: 'invalid', requestBound: false })
    expect(buildOpenMeteoGeocodingViewModel(api, response([place()]), requestUrl)).toMatchObject({ state: 'partial', requestBound: false })
  })
  it('rejects tolerated extra or duplicate request semantics', () => {
    expect(parseOpenMeteoGeocodingRequest(api, `${requestUrl}&foo=bar`)).toBeUndefined()
    expect(parseOpenMeteoGeocodingRequest(api, `${requestUrl}&count=2`)).toBeUndefined()
    expect(buildOpenMeteoGeocodingViewModel(api, response([place()]), `${requestUrl}&foo=bar`).state).toBe('invalid')
  })
  it('withholds malformed, duplicate, and over-limit locations', () => {
    const limited = api.buildUrl({ name: 'Singapore', count: '2' })
    const model = buildOpenMeteoGeocodingViewModel(api, response([place(), place({ id: 1880253, name: 'String coordinate', latitude: '1.3' }), place({ id: 1880254, name: 'Overflow location' })]), limited)
    expect(model).toMatchObject({ state: 'partial', providerRecordCount: 3, validRecordCount: 1, invalidRecordCount: 2, overflowRecordCount: 1 })
    expect(model.places.map((entry) => entry.name)).toEqual(['Singapore'])
    const duplicate = buildOpenMeteoGeocodingViewModel(api, response([place(), place({ name: 'Duplicate identity' })]), requestUrl)
    expect(duplicate).toMatchObject({ state: 'partial', duplicateRecordCount: 1, validRecordCount: 1 })
  })
  it('maps documented omitted-results no-match envelope to empty', () => {
    expect(buildOpenMeteoGeocodingViewModel(api, response(), requestUrl, executedRequest)).toMatchObject({ state: 'empty', requestBound: true, providerRecordCount: 0 })
  })
  it('fails closed when success envelope lacks generation timing evidence', () => {
    expect(buildOpenMeteoGeocodingViewModel(api, { results: [place()] }, requestUrl).state).toBe('invalid')
  })
})
