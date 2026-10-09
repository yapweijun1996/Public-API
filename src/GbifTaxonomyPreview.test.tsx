import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { GbifTaxonomyPreview, buildGbifTaxonomyViewModel } from './previews/GbifTaxonomyPreview'

const api = getApiById('gbif-species-search')!
const requestUrl = api.buildUrl({ query: 'panthera' })
const validTaxon = {
  key: 2435194,
  nubKey: 2435194,
  scientificName: 'Panthera Oken, 1816',
  canonicalName: 'Panthera',
  kingdom: 'Animalia',
  phylum: 'Chordata',
  class: 'Mammalia',
  order: 'Carnivora',
  family: 'Felidae',
  genus: 'Panthera',
  rank: 'GENUS',
  taxonomicStatus: 'ACCEPTED',
}
const response = (results: unknown[] = [validTaxon], overrides: Record<string, unknown> = {}) => ({
  offset: 0,
  limit: 8,
  endOfRecords: false,
  count: 1757,
  results,
  ...overrides,
})

afterEach(cleanup)

describe('GBIF taxonomy request-bound semantics', () => {
  it('does not claim request-bound readiness from a displayed URL without executed transport evidence', () => {
    const { container } = render(<GbifTaxonomyPreview api={api} data={response()} requestUrl={requestUrl}/>)
    const card = container.querySelector('[data-domain-card="gbif-taxonomy-search"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('withholds malformed rows instead of rendering plausible taxonomy facts', () => {
    const malformed = { family: 'Fabricated family', genus: 'Fabricated genus', rank: 'SPECIES', taxonomicStatus: 'ACCEPTED' }
    const { container } = render(<GbifTaxonomyPreview api={api} data={response([validTaxon, malformed])} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl }}/>)
    expect(container).not.toHaveTextContent('Fabricated family')
    expect(container.querySelector('[data-domain-card="gbif-taxonomy-search"]')).toHaveAttribute('data-result-state', 'partial')
  })

  it('marks only the exact bodyless GET request ready', () => {
    const model = buildGbifTaxonomyViewModel(api, response(), requestUrl, { method: 'GET', url: requestUrl })
    expect(model).toMatchObject({ state: 'ready', requestBound: true, query: 'panthera', providerRecordCount: 1, validRecordCount: 1 })
  })

  it('fails closed for POST, bodies, URL drift, extra keys, and duplicate q parameters', () => {
    expect(buildGbifTaxonomyViewModel(api, response(), requestUrl, { method: 'POST', url: requestUrl }).state).toBe('invalid')
    expect(buildGbifTaxonomyViewModel(api, response(), requestUrl, { method: 'GET', url: requestUrl, body: '{}' }).state).toBe('invalid')
    expect(buildGbifTaxonomyViewModel(api, response(), requestUrl, { method: 'GET', url: api.buildUrl({ query: 'ursus' }) }).state).toBe('invalid')

    const extra = `${requestUrl}&foo=bar`
    expect(buildGbifTaxonomyViewModel(api, response(), extra, { method: 'GET', url: extra }).state).toBe('invalid')
    const duplicate = `${requestUrl}&q=ursus`
    expect(buildGbifTaxonomyViewModel(api, response(), duplicate, { method: 'GET', url: duplicate }).state).toBe('invalid')
  })

  it('rejects contradictory paging metadata and trusts request-bound empty only when count is zero', () => {
    expect(buildGbifTaxonomyViewModel(api, response([validTaxon], { offset: 1 }), requestUrl, { method: 'GET', url: requestUrl }).state).toBe('invalid')
    expect(buildGbifTaxonomyViewModel(api, response([validTaxon], { limit: 20 }), requestUrl, { method: 'GET', url: requestUrl }).state).toBe('invalid')
    expect(buildGbifTaxonomyViewModel(api, response([validTaxon], { count: 1, endOfRecords: false }), requestUrl, { method: 'GET', url: requestUrl }).state).toBe('invalid')
    expect(buildGbifTaxonomyViewModel(api, response([], { count: 0, endOfRecords: true }), requestUrl, { method: 'GET', url: requestUrl }).state).toBe('empty')
    expect(buildGbifTaxonomyViewModel(api, response([], { count: 3, endOfRecords: true }), requestUrl, { method: 'GET', url: requestUrl }).state).toBe('invalid')
  })
})
