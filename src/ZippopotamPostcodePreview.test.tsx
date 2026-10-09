import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import { buildZippopotamPostcodeViewModel } from './previews/ZippopotamPostcodePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'zippopotam-postcode')!
const requestUrl = api.buildUrl({ country: 'us', postalCode: '10001' })
const executedRequest = { method: 'GET', url: requestUrl } as const
const place = (overrides: Record<string, unknown> = {}) => ({
  'place name': 'New York', state: 'New York', 'state abbreviation': 'NY', latitude: '40.7128', longitude: '-74.0060', ...overrides,
})
const response = (overrides: Record<string, unknown> = {}) => ({
  'post code': '10001', country: 'United States', 'country abbreviation': 'US', places: [place()], ...overrides,
})

describe('Zippopotam.us postcode semantic preview', () => {
  afterEach(cleanup)

  it('renders documented coordinate strings as a request-bound validated place card', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl }} data={response()}/> )
    const preview = screen.getByRole('region', { name: 'Zippopotam Postcode' })
    const card = preview.querySelector('[data-domain-card="zippopotam-postcode"]')
    expect(preview).toHaveAttribute('data-preview-layout', 'postcode-geolocation')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-country', 'US')
    expect(card).toHaveAttribute('data-requested-postcode', '10001')
    expect(card).toHaveAttribute('data-provider-country-abbreviation', 'US')
    expect(card).toHaveAttribute('data-valid-place-count', '1')
    expect(within(preview).getByRole('img', { name: 'Map with 1 validated Zippopotam.us places' })).toBeInTheDocument()
    expect(within(preview).getByRole('list', { name: 'Validated Zippopotam.us places' })).toHaveTextContent('New York')
    expect(preview).toHaveTextContent('40.7128')
    expect(preview).toHaveTextContent('Zippopotam.us documents latitude and longitude as decimal JSON strings')
  })

  it('fails closed when the displayed postcode URL was actually executed with POST', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ method: 'POST', url: requestUrl }} data={response()}/> )
    const preview = screen.getByRole('region', { name: 'Zippopotam Postcode' })
    const card = preview.querySelector('[data-domain-card="zippopotam-postcode"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('rejects GET bodies and URL disagreement, and stays partial without execution evidence', () => {
    expect(buildZippopotamPostcodeViewModel(api, response(), requestUrl, { method: 'GET', url: requestUrl, body: '{}' })).toMatchObject({ state: 'invalid', requestBound: false })
    const otherUrl = api.buildUrl({ country: 'us', postalCode: '90210' })
    expect(buildZippopotamPostcodeViewModel(api, response(), requestUrl, { method: 'GET', url: otherUrl })).toMatchObject({ state: 'invalid', requestBound: false })
    expect(buildZippopotamPostcodeViewModel(api, response(), requestUrl)).toMatchObject({ state: 'partial', requestBound: false })
  })

  it('rejects query extras, trailing slashes, and duplicate query keys as non-exact requests', () => {
    for (const url of [`${requestUrl}?foo=bar`, `${requestUrl}/`, `${requestUrl}?x=1&x=2`]) {
      expect(buildZippopotamPostcodeViewModel(api, response(), url)).toMatchObject({ state: 'invalid', requestBound: false })
    }
  })

  it('fails closed on provider identity mismatch and preserves coherent empty responses', () => {
    expect(buildZippopotamPostcodeViewModel(api, response({ 'country abbreviation': 'CA' }), requestUrl, executedRequest)).toMatchObject({ state: 'invalid', requestBound: true, validPlaceCount: 0 })
    expect(buildZippopotamPostcodeViewModel(api, response({ places: [] }), requestUrl, executedRequest)).toMatchObject({ state: 'empty', requestBound: true, providerPlaceCount: 0 })
  })

  it('withholds numeric-coordinate and duplicate rows while keeping valid provider evidence partial', () => {
    const model = buildZippopotamPostcodeViewModel(api, response({ places: [
      place(),
      place({ 'place name': 'Numeric Coordinates', latitude: 40.7, longitude: '-74.0' }),
      place({ 'place name': 'Duplicate Row' }),
      place(),
    ] }), requestUrl)
    expect(model).toMatchObject({ state: 'partial', providerPlaceCount: 4, validPlaceCount: 2, invalidPlaceCount: 2, duplicatePlaceCount: 1 })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response({ places: [place(), place({ 'place name': 'Numeric Coordinates', latitude: 40.7, longitude: '-74.0' }), place()] })}/> )
    const preview = screen.getByRole('region', { name: 'Zippopotam Postcode' })
    expect(preview).toHaveTextContent('New York')
    expect(preview).not.toHaveTextContent('Numeric Coordinates')
    expect(preview).toHaveAttribute('data-preview-layout', 'postcode-geolocation')
  })
})
