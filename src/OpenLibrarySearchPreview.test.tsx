import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { OpenLibrarySearchPreview, parseOpenLibraryRequest, parseOpenLibraryResponse } from './previews/OpenLibrarySearchPreview'

const api = apiCatalog.find((candidate) => candidate.id === 'open-library-search')!
const requestUrl = api.buildUrl({ query: 'artificial intelligence', limit: '2' })
const executedRequest = (url = requestUrl) => ({ url, method: 'GET' })
const work = (overrides: Record<string, unknown> = {}) => ({ key: '/works/OL2896994W', title: 'Artificial intelligence', author_name: ['Stuart J. Russell', 'Peter Norvig'], first_publish_year: 1994, cover_i: 92018, ...overrides })
const response = (docs: unknown[], overrides: Record<string, unknown> = {}) => ({ numFound: docs.length, num_found: docs.length, start: 0, numFoundExact: true, q: 'artificial intelligence', docs, ...overrides })

afterEach(() => { document.body.innerHTML = '' })

describe('Open Library request-bound semantic preview', () => {
  it('renders exact request-bound work identity as ready', () => {
    const data = response([work(), work({ key: '/works/OL2024373W', title: 'Artificial Intelligence: Principles' })])
    expect(parseOpenLibraryResponse(data, requestUrl).result).toMatchObject({ countContract: true, validRecordCount: 2, malformedRecordCount: 0, duplicateRecordCount: 0 })
    render(<OpenLibrarySearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest()}/>)
    const card = screen.getByText('artificial intelligence', { selector: 'h3' }).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-count-contract', 'true')
    expect(card).toHaveAttribute('data-primary-work-key', '/works/OL2896994W')
    expect(card).toHaveTextContent('Stuart J. Russell, Peter Norvig')
    expect(card).toHaveTextContent('/works/OL2024373W')
  })

  it('fails closed when the successful transport is not the exact bodyless GET request', () => {
    const data = response([work(), work({ key: '/works/OL2024373W', title: 'Artificial Intelligence: Principles' })])
    const { rerender } = render(<OpenLibrarySearchPreview data={data} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)
    expect(screen.getByText('Invalid Open Library search response').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<OpenLibrarySearchPreview data={data} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { q: 'artificial intelligence' } }}/>)
    expect(screen.getByText('Invalid Open Library search response').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<OpenLibrarySearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest(`${requestUrl}&page=1`)}/>)
    expect(screen.getByText('Invalid Open Library search response').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('rejects extra, duplicate, or non-canonical executed request parameters', () => {
    expect(parseOpenLibraryRequest(`${requestUrl}&offset=0`)).toBeUndefined()
    expect(parseOpenLibraryRequest(`${requestUrl}&limit=1`)).toBeUndefined()
    const changedFields = new URL(requestUrl); changedFields.searchParams.set('fields', '*')
    expect(parseOpenLibraryRequest(changedFields.toString())).toBeUndefined()
  })

  it('does not coerce numeric-string provider counts into trusted pagination', () => {
    const url = api.buildUrl({ query: 'artificial intelligence', limit: '1' })
    const data = response([work()], { numFound: '1', num_found: undefined })
    expect(parseOpenLibraryResponse(data, url).result).toMatchObject({ countContract: false, validRecordCount: 1 })
    render(<OpenLibrarySearchPreview data={data} requestUrl={url} executedRequest={executedRequest(url)}/>)
    expect(screen.getByText('artificial intelligence', { selector: 'h3' }).closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'partial')
  })

  it('withholds malformed and duplicate work identities', () => {
    const data = response([work(), work({ key: '', title: 'Fabricated missing identity' }), work({ title: 'Fabricated duplicate identity' })], { numFound: 3, num_found: 3 })
    render(<OpenLibrarySearchPreview data={data} requestUrl={api.buildUrl({ query: 'artificial intelligence', limit: '3' })} executedRequest={executedRequest(api.buildUrl({ query: 'artificial intelligence', limit: '3' }))}/>)
    const card = screen.getByText('artificial intelligence', { selector: 'h3' }).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-malformed-record-count', '1')
    expect(card).toHaveAttribute('data-duplicate-record-count', '1')
    expect(card).not.toHaveTextContent('Fabricated missing identity')
    expect(card).not.toHaveTextContent('Fabricated duplicate identity')
  })

  it('fails closed when a provider query acknowledgement contradicts the executed request', () => {
    const parsed = parseOpenLibraryResponse(response([work()], { q: 'different query' }), api.buildUrl({ query: 'artificial intelligence', limit: '1' }))
    expect(parsed.invalidReason).toContain('contradicted')
    expect(parsed.result).toBeUndefined()
  })

  it('maps a coherent request-bound zero-result response to empty', () => {
    render(<OpenLibrarySearchPreview data={response([], { numFound: 0, num_found: 0 })} requestUrl={requestUrl} executedRequest={executedRequest()}/>)
    expect(screen.getByText('No Open Library books matched').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'empty')
  })
})
