import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog, getAutomatedVerificationPolicy, validateParameters } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'inaturalist-observations')!
const requestUrl = api.buildUrl({ taxonName: 'Panthera', perPage: '2' })
const executedGet = (url = requestUrl) => ({ url, method: 'GET' })

const observation = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  uri: `https://www.inaturalist.org/observations/${id}`,
  observed_on: '2026-09-15',
  place_guess: 'Singapore',
  quality_grade: 'research',
  license_code: 'cc-by-nc',
  geoprivacy: null,
  taxon_geoprivacy: null,
  obscured: false,
  geojson: { type: 'Point', coordinates: [103.8198, 1.3521] },
  taxon: { id: 41977, name: 'Panthera pardus', preferred_common_name: 'Leopard', rank: 'species' },
  user: { id: 42, login: 'observer' },
  photos: [{ id: id * 10, url: `https://inaturalist-open-data.s3.amazonaws.com/photos/${id}/small.jpg`, license_code: 'cc-by-nc', attribution: '(c) observer, some rights reserved (CC BY-NC)' }],
  ...overrides,
})

const response = (results: unknown[], overrides: Record<string, unknown> = {}) => ({
  total_results: results.length,
  page: 1,
  per_page: 2,
  results,
  ...overrides,
})

const card = async () => (await screen.findByRole('region', { name: api.name })).querySelector('[data-domain-card="inaturalist-observations"]')

afterEach(() => { document.body.innerHTML = '' })

describe('iNaturalist request-bound observation semantics', () => {
  it('fails closed when the successful response transport is not the exact bodyless GET request', async () => {
    const payload = response([observation(1001)], { total_results: 1, per_page: 2 })
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={payload}/>)
    let root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-request-bound', 'false')
    expect(root).not.toHaveTextContent('Leopard')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: `${requestUrl}&page=2`, method: 'GET' }} data={payload}/>)
    root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-request-bound', 'false')
  })

  it('keeps coherent observations partial when executed request evidence is unavailable', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([observation(1001)], { total_results: 1, per_page: 2 })}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-request-bound', 'false')
    expect(root).toHaveAttribute('data-request-contract', 'exact-inaturalist-photo-observations-v2')
    expect(root).toHaveTextContent(/executed request evidence was unavailable/i)
  })

  it('binds provider observation, taxon, photo-license, and public-location evidence to the exact request', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet()} data={response([
      observation(1001),
      observation(1002, { observed_on: '2026-09-14', place_guess: 'Sensitive reserve trail', geoprivacy: 'obscured', obscured: true, geojson: { type: 'Point', coordinates: [103.75, 1.31] }, photos: [{ id: 10020, url: 'https://inaturalist-open-data.s3.amazonaws.com/photos/1002/small.jpg', license_code: null, attribution: '(c) observer, all rights reserved' }] }),
    ])}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-taxon-name', 'Panthera')
    expect(root).toHaveAttribute('data-request-per-page', '2')
    expect(root).toHaveAttribute('data-valid-observation-count', '2')
    expect(root).toHaveAttribute('data-primary-observation-id', '1001')
    expect(root).toHaveAttribute('data-obscured-observation-count', '1')
    expect(root).toHaveAttribute('data-all-rights-reserved-photo-count', '1')
    expect(root).toHaveTextContent('Leopard')
    expect(root).toHaveTextContent('CC BY-NC')
    expect(root).toHaveTextContent(/obscured/i)
    expect(root).toHaveTextContent(/public display coordinates/i)
    expect(root).toHaveTextContent(/do not infer/i)
    expect(root).toHaveAttribute('data-privacy-minimized-observation-count', '1')
    expect(root).toHaveTextContent(/2026-09 \(month only\)/i)
    expect(root).toHaveTextContent(/Sensitive location label withheld/i)
    expect(root).not.toHaveTextContent('Sensitive reserve trail')
    expect(root).not.toHaveTextContent('2026-09-14')
  })

  it('fails closed for undeclared, duplicate, or non-canonical request semantics', async () => {
    const payload = response([observation(1001)], { total_results: 1, per_page: 2 })
    const first = render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&foo=bar`} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    first.unmount()
    const second = render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&per_page=1`} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    second.unmount()
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl.replace('per_page=2', 'per_page=2.5')} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds duplicate identities and malformed photo/license evidence as partial', async () => {
    const fourUrl = api.buildUrl({ taxonName: 'Panthera', perPage: '4' })
    render(<ResponseDemoPreview api={api} requestUrl={fourUrl} executedRequest={executedGet(fourUrl)} data={response([
      observation(1001),
      observation(1001, { taxon: { id: 999, name: 'Fabricated duplicate' } }),
      observation(1003, { photos: [{ id: 10030, url: 'https://images.test/photo.jpg', license_code: 123 }] }),
      observation(1004, { geojson: { type: 'Point', coordinates: ['103.8', 1.3] } }),
    ], { total_results: 4, per_page: 4 })}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-valid-observation-count', '2')
    expect(root).toHaveAttribute('data-duplicate-observation-count', '1')
    expect(root).toHaveAttribute('data-malformed-observation-count', '1')
    expect(root).toHaveAttribute('data-supplemental-malformed-count', '1')
    expect(root).not.toHaveTextContent('Fabricated duplicate')
    expect(root?.querySelector('[data-observation-id="1003"]')).toBeNull()
  })

  it('maps a coherent request-bound zero-result response to empty', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet()} data={response([], { total_results: 0, per_page: 2 })}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'empty')
  })

  it('exposes non-empty taxon and integer page-size constraints without silently repairing explicit invalid input', () => {
    const taxon = api.fields.find((field) => field.id === 'taxonName')!
    const perPage = api.fields.find((field) => field.id === 'perPage')!
    expect(taxon.minLength).toBe(1)
    expect(perPage.step).toBe(1)
    expect(validateParameters(api, { taxonName: '   ', perPage: '6' })).toHaveProperty('taxonName')
    expect(validateParameters(api, { taxonName: 'Panthera', perPage: '2.5' })).toEqual({ perPage: 'Observations must use increments of 1.' })
    expect(getAutomatedVerificationPolicy(api)).toMatchObject({ mode: 'enabled', retryOnRateLimit: false, rateLimitStatuses: [429] })
    const malformed = new URL(api.buildUrl({ taxonName: '   ', perPage: '2.5' }))
    expect(malformed.searchParams.get('taxon_name')).toBe('')
    expect(malformed.searchParams.get('per_page')).toBe('2.5')
    expect(malformed.searchParams.get('photos')).toBe('true')
  })
})
