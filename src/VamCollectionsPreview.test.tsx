import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { VamCollectionsPreview, parseVamCollectionsRequest, parseVamCollectionsResponse } from './previews/VamCollectionsPreview'

const api = apiCatalog.find((candidate) => candidate.id === 'vam-collections')!
const requestUrl = api.buildUrl({ query: 'eastern', count: '2' })
const executedRequest = { url: requestUrl, method: 'GET' }
const object = (overrides: Record<string, unknown> = {}) => ({
  systemNumber: 'O123456', accessionNumber: 'T.1-2020', objectType: 'Painting', _primaryTitle: 'Eastern Study',
  _primaryMaker: { name: 'Example Maker', association: 'artist' }, _primaryDate: '1920', _primaryPlace: 'London',
  _primaryImageId: 'T.1-2020', _images: { _primary_thumbnail: 'https://images.test/vam.jpg' },
  _imagesMeta: [{ copyright: '© Victoria and Albert Museum, London', sensitiveImage: false }],
  _objectContentWarning: false, _imageContentWarning: false, ...overrides,
})
const response = (records: unknown[], overrides: Record<string, unknown> = {}) => ({
  info: { record_count: records.length, record_count_exact: true, page: 1, page_size: 2 }, records, ...overrides,
})

afterEach(() => { document.body.innerHTML = '' })

describe('V&A Collections request-bound semantic preview', () => {
  it('renders provider object identity, image provenance, and warning metadata', () => {
    const data = response([object(), object({ systemNumber: 'O654321', _primaryTitle: 'Eastern Vessel', _images: null, _primaryImageId: undefined, _imagesMeta: [] })])
    expect(parseVamCollectionsResponse(data, requestUrl, executedRequest).result).toMatchObject({ countContract: true, providerRecordCount: 2, malformedRecordCount: 0 })
    render(<VamCollectionsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const card = screen.getByText('eastern', { selector: 'h3' }).closest('[data-domain-card]')!
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-count-contract', 'true')
    expect(card).toHaveAttribute('data-primary-system-number', 'O123456')
    expect(card).toHaveTextContent('Example Maker')
    expect(card).toHaveTextContent('© Victoria and Albert Museum, London')
    expect(card).toHaveTextContent('Eastern Vessel')
    expect(screen.getByRole('img', { name: 'Eastern Study' })).toHaveAttribute('src', 'https://images.test/vam.jpg')
    expect(card.querySelector('[data-object-system-number="O654321"] .vam-image-unavailable')).toHaveTextContent('Image unavailable')
  })

  it('requires exact bodyless GET execution evidence before reporting request-bound results', () => {
    const data = response([object(), object({ systemNumber: 'O654321', _primaryTitle: 'Eastern Vessel' })])

    render(<VamCollectionsPreview data={data} requestUrl={requestUrl}/>)
    let card = screen.getByText('eastern', { selector: 'h3' }).closest('[data-domain-card]')!
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    document.body.innerHTML = ''
    render(<VamCollectionsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    card = screen.getByText('eastern', { selector: 'h3' }).closest('[data-domain-card]')!
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')

    for (const conflict of [
      { url: requestUrl, method: 'POST' },
      { url: requestUrl, method: 'GET', body: { unexpected: true } },
      { url: api.buildUrl({ query: 'western', count: '2' }), method: 'GET' },
    ]) {
      document.body.innerHTML = ''
      render(<VamCollectionsPreview data={data} requestUrl={requestUrl} executedRequest={conflict}/>)
      card = screen.getByText('Invalid V&A collection response').closest('[data-domain-card]')!
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
    }
  })

  it('rejects undeclared, duplicate, and malformed request shapes', () => {
    expect(parseVamCollectionsRequest(`${requestUrl}&foo=bar`)).toBeUndefined()
    expect(parseVamCollectionsRequest(`${requestUrl}&page_size=1`)).toBeUndefined()
    expect(parseVamCollectionsRequest('https://api.vam.ac.uk/v2/objects/search?page_size=2&q=eastern')).toBeUndefined()
    expect(parseVamCollectionsRequest(requestUrl.replace('page_size=2', 'page_size=2.5'))).toBeUndefined()
    expect(parseVamCollectionsRequest(requestUrl.replace('q=eastern', 'q=%20eastern'))).toBeUndefined()
  })

  it('keeps the shared field contract and request builder fail-closed for explicit malformed values', () => {
    const query = api.fields.find((field) => field.id === 'query')!
    const count = api.fields.find((field) => field.id === 'count')!
    expect(query.minLength).toBe(1)
    expect(count.step).toBe(1)
    const malformedUrl = api.buildUrl({ query: ' ', count: '2.5' })
    expect(new URL(malformedUrl).searchParams.get('q')).toBe('')
    expect(new URL(malformedUrl).searchParams.get('page_size')).toBe('2.5')
    expect(parseVamCollectionsRequest(malformedUrl)).toBeUndefined()
  })

  it('fails closed for numeric-string pagination and malformed envelopes', () => {
    const numericString = { ...response([object()]), info: { record_count: '1', page: 1, page_size: 2 } }
    expect(parseVamCollectionsResponse(numericString, requestUrl, executedRequest).result).toBeUndefined()
    render(<VamCollectionsPreview data={{ records: [object()] }} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    expect(screen.getByText('Invalid V&A collection response').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds duplicate and identity-less records as partial evidence', () => {
    const data = response([object(), object({ systemNumber: 'O123456', _primaryTitle: 'Duplicate identity' }), object({ systemNumber: undefined, _primaryTitle: 'Missing identity' })])
    render(<VamCollectionsPreview data={data} requestUrl={api.buildUrl({ query: 'eastern', count: '3' })} executedRequest={{ url: api.buildUrl({ query: 'eastern', count: '3' }), method: 'GET' }}/>)
    const card = screen.getByText('eastern', { selector: 'h3' }).closest('[data-domain-card]')!
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-duplicate-record-count', '1')
    expect(card).toHaveAttribute('data-malformed-record-count', '1')
    expect(card).not.toHaveTextContent('Duplicate identity')
    expect(card).not.toHaveTextContent('Missing identity')
  })

  it('maps a coherent zero-result response to empty', () => {
    render(<VamCollectionsPreview data={response([], { info: { record_count: 0, record_count_exact: true, page: 1, page_size: 2 } })} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    expect(screen.getByText('No V&A objects matched').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'empty')
  })
})
