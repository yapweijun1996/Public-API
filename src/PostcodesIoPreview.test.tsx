import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { buildPostcodesIoViewModel, parsePostcodesIoRequest, PostcodesIoPreview } from './previews/PostcodesIoPreview'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'postcodes-io')!
const requestUrl = api.buildUrl({})
const result = (overrides: Record<string, unknown> = {}) => ({
  postcode: 'SW1A 1AA', quality: 1, eastings: 529090, northings: 179645,
  country: 'England', nhs_ha: 'London', longitude: -0.141563, latitude: 51.50101,
  parliamentary_constituency: 'Cities of London and Westminster', admin_district: 'Westminster',
  admin_ward: 'St James\'s', region: 'London',
  codes: { admin_district: 'E09000033', admin_ward: 'E05013806', parliamentary_constituency: 'E14001172', lsoa: 'E01004736', msoa: 'E02000977', nuts: 'TLI35', nhs_region: 'E40000003' },
  ...overrides,
})
const response = (overrides: Record<string, unknown> = {}) => ({ status: 200, result: result(), ...overrides })
const executedRequest = { method: 'GET', url: requestUrl } as const

describe('Postcodes.io request-bound postcode profile', () => {
  it('binds the exact request and renders provider postcode identity', () => {
    expect(parsePostcodesIoRequest(requestUrl)).toEqual({ compactPostcode: 'SW1A1AA' })
    const model = buildPostcodesIoViewModel(response(), requestUrl, executedRequest)
    expect(model).toMatchObject({ state: 'ready', requestBound: true, supplementalMalformedCount: 0 })
    expect(model.result).toMatchObject({ postcode: 'SW1A 1AA', compactPostcode: 'SW1A1AA', quality: 1, latitude: 51.50101, longitude: -0.141563, country: 'England' })
    render(<PostcodesIoPreview data={response()} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const card = screen.getByRole('heading', { name: 'SW1A 1AA' }).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-postcode', 'SW1A1AA')
    expect(card).toHaveAttribute('data-provider-postcode', 'SW1A 1AA')
    expect(card).toHaveAttribute('data-postcode-quality', '1')
    expect(card).toHaveAttribute('data-admin-district-code', 'E09000033')
    expect(screen.getByRole('img', { name: 'Map point for postcode SW1A 1AA' })).toBeInTheDocument()
    expect(screen.getByText('Cities of London and Westminster')).toBeInTheDocument()
  })

  it('fails closed when the displayed postcode URL was actually executed with POST', () => {
    render(<ResponseDemoPreview api={api} data={response()} requestUrl={requestUrl} executedRequest={{ method: 'POST', url: requestUrl }} />)
    const card = screen.getByText('Postcode evidence unavailable').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('rejects GET bodies and URL disagreement, and stays partial without execution evidence', () => {
    expect(buildPostcodesIoViewModel(response(), requestUrl, { method: 'GET', url: requestUrl, body: '{}' })).toMatchObject({ state: 'invalid', requestBound: false })
    expect(buildPostcodesIoViewModel(response(), requestUrl, { method: 'GET', url: `${requestUrl}?foo=bar` })).toMatchObject({ state: 'invalid', requestBound: false })
    expect(buildPostcodesIoViewModel(response(), requestUrl)).toMatchObject({ state: 'partial', requestBound: false })
  })

  it('rejects provider-tolerated extra or trailing-slash request semantics', () => {
    expect(parsePostcodesIoRequest(`${requestUrl}?foo=bar`)).toBeUndefined()
    expect(parsePostcodesIoRequest(`${requestUrl}/`)).toBeUndefined()
    expect(buildPostcodesIoViewModel(response(), `${requestUrl}?foo=bar`).state).toBe('invalid')
  })

  it('fails closed on numeric-string core evidence or postcode identity mismatch', () => {
    expect(buildPostcodesIoViewModel({ status: 200, result: result({ latitude: '51.50101' }) }, requestUrl).state).toBe('invalid')
    expect(buildPostcodesIoViewModel({ status: 200, result: result({ quality: '1' }) }, requestUrl).state).toBe('invalid')
    expect(buildPostcodesIoViewModel({ status: 200, result: result({ postcode: 'EC1A 1BB' }) }, requestUrl).state).toBe('invalid')
  })

  it('withholds malformed optional administrative evidence as partial', () => {
    const model = buildPostcodesIoViewModel({ status: 200, result: result({ admin_ward: 123, codes: { admin_district: 'E09000033', admin_ward: 456 } }) }, requestUrl)
    expect(model).toMatchObject({ state: 'partial', supplementalMalformedCount: 2 })
    expect(model.result?.adminWard).toBeUndefined()
    expect(model.result?.codes).toEqual([{ label: 'District code', value: 'E09000033' }])
  })

  it('requires the documented HTTP-success envelope and native status', () => {
    expect(buildPostcodesIoViewModel({ status: '200', result: result() }, requestUrl).state).toBe('invalid')
    expect(buildPostcodesIoViewModel({ status: 200, result: null }, requestUrl).state).toBe('invalid')
  })
})
