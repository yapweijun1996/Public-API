import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'datacite-search')
if (!api) throw new Error('Missing datacite-search fixture')

const requestUrl = 'https://api.datacite.org/dois?query=climate+change&page%5Bsize%5D=2'
const executedRequest = (method = 'GET', body?: unknown, url = requestUrl): ExecutedRequestContext => ({ url, method, body })
const doiRecord = (doi: string, title = 'Representative climate dataset') => ({
  id: doi,
  type: 'dois',
  attributes: {
    doi,
    titles: [{ title }],
    creators: [{ name: 'Researcher, Ada' }],
    publisher: 'Example Repository',
    publicationYear: 2026,
    types: { resourceTypeGeneral: 'Dataset' },
    url: `https://example.org/records/${encodeURIComponent(doi)}`,
  },
})

const response = (data = [doiRecord('10.1234/example.1'), doiRecord('10.1234/example.2')], self = requestUrl) => ({
  data,
  links: { self },
  meta: { total: data.length, totalPages: data.length ? 1 : 0, page: 1 },
})

describe('DataCite DOI search semantic preview', () => {
  afterEach(cleanup)

  it('renders ready only for a coherent exact request-bound DOI page', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response()}/>)
    const preview = screen.getByRole('region', { name: 'DataCite DOI Search' })
    const result = preview.querySelector('[data-domain-card="datacite-search"]')
    expect(result).toHaveAttribute('data-result-state', 'ready')
    expect(result).toHaveAttribute('data-request-bound', 'true')
    expect(result).toHaveAttribute('data-request-query', 'climate change')
    expect(result).toHaveAttribute('data-requested-page-size', '2')
    expect(result).toHaveAttribute('data-primary-doi', '10.1234/example.1')
    expect(preview).toHaveTextContent('Representative climate dataset')
  })

  it('fails closed when canonical DataCite URL was not executed as the same bodyless GET', () => {
    const rejected = [
      executedRequest('POST'),
      executedRequest('GET', { unexpected: true }),
      executedRequest('GET', undefined, requestUrl.replace('page%5Bsize%5D=2', 'page%5Bsize%5D=1')),
    ]
    for (const request of rejected) {
      cleanup()
      render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={request} data={response()}/>)
      const preview = screen.getByRole('region', { name: 'DataCite DOI Search' })
      expect(preview.querySelector('[data-domain-card="datacite-search"]')).toHaveAttribute('data-result-state', 'invalid')
      expect(preview.querySelector('[data-domain-card="datacite-search"]')).toHaveAttribute('data-request-bound', 'false')
    }
  })

  it('keeps coherent DataCite data partial when executed transport identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response()}/>)
    const preview = screen.getByRole('region', { name: 'DataCite DOI Search' })
    expect(preview.querySelector('[data-domain-card="datacite-search"]')).toHaveAttribute('data-result-state', 'partial')
    expect(preview.querySelector('[data-domain-card="datacite-search"]')).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails closed when the executed request adds or duplicates search semantics', () => {
    for (const badUrl of [`${requestUrl}&foo=bar`, `${requestUrl}&page%5Bsize%5D=1`]) {
      cleanup()
      render(<ResponseDemoPreview api={api} requestUrl={badUrl} data={response([], badUrl)}/>)
      const preview = screen.getByRole('region', { name: 'DataCite DOI Search' })
      expect(preview.querySelector('[data-domain-card="datacite-search"]')).toHaveAttribute('data-result-state', 'invalid')
    }
  })

  it('fails closed when provider self does not echo the executed request semantics', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response(undefined, 'https://api.datacite.org/dois?query=unrelated&page%5Bsize%5D=2')}/>)
    const preview = screen.getByRole('region', { name: 'DataCite DOI Search' })
    expect(preview.querySelector('[data-domain-card="datacite-search"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Representative climate dataset')
  })

  it('fails closed when provider pagination metadata uses the wrong JSON wire type', () => {
    const malformed = { ...response(), meta: { total: '2', totalPages: 1, page: 1 } }
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={malformed}/>)
    const preview = screen.getByRole('region', { name: 'DataCite DOI Search' })
    expect(preview.querySelector('[data-domain-card="datacite-search"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Representative climate dataset')
  })

  it('withholds malformed and duplicate DOI identities as partial evidence', () => {
    const valid = doiRecord('10.1234/example.1')
    const malformed = { ...doiRecord('10.1234/bad'), id: '10.1234/other', attributes: { ...doiRecord('10.1234/bad').attributes, titles: [{ title: 'Fabricated mismatched identity' }] } }
    const duplicate = { ...doiRecord('10.1234/example.1'), attributes: { ...valid.attributes, titles: [{ title: 'Fabricated duplicate identity' }] } }
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={{
      data: [valid, malformed, duplicate],
      links: { self: requestUrl },
      meta: { total: 3, totalPages: 2, page: 1 },
    }}/>)
    const preview = screen.getByRole('region', { name: 'DataCite DOI Search' })
    const result = preview.querySelector('[data-domain-card="datacite-search"]')
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-valid-record-count', '1')
    expect(result).toHaveAttribute('data-malformed-record-count', '1')
    expect(result).toHaveAttribute('data-duplicate-doi-count', '1')
    expect(preview).not.toHaveTextContent('Fabricated mismatched identity')
    expect(preview).not.toHaveTextContent('Fabricated duplicate identity')
  })

  it('maps a coherent request-bound zero-result page to semantic empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response([])}/>)
    const preview = screen.getByRole('region', { name: 'DataCite DOI Search' })
    expect(preview.querySelector('[data-domain-card="datacite-search"]')).toHaveAttribute('data-result-state', 'empty')
  })

  it('declares non-empty/integer shared fields and preserves explicit malformed values for pre-network validation', () => {
    expect(api.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(api.fields.find((field) => field.id === 'count')?.step).toBe(1)
    expect(new URL(api.buildUrl({ query: '   ', count: '5' })).searchParams.get('query')).toBe('')
    expect(new URL(api.buildUrl({ query: 'climate change', count: '2.5' })).searchParams.get('page[size]')).toBe('2.5')
  })
})
