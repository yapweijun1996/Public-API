import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'doaj-search')
if (!api) throw new Error('Missing doaj-search fixture')

const requestUrl = 'https://doaj.org/api/search/articles/climate?pageSize=2'
const executedRequest = (method = 'GET', body?: unknown, url = requestUrl): ExecutedRequestContext => ({ url, method, body })
const article = (id: string, title = 'Climate adaptation in open science') => ({
  id,
  bibjson: {
    title,
    year: '2026',
    author: [{ name: 'Researcher, Ada' }],
    journal: { title: 'Open Science Journal', publisher: 'Example Publisher' },
    identifier: [{ type: 'doi', id: `10.1234/${id}` }],
  },
})

const response = (results = [article('article-1'), article('article-2')], overrides: Record<string, unknown> = {}) => ({
  total: results.length,
  page: 1,
  pageSize: 2,
  timestamp: '2026-09-16T16:39:08.146277Z',
  query: 'climate',
  results,
  ...overrides,
})

describe('DOAJ article-search semantic preview', () => {
  afterEach(cleanup)

  it('renders ready only for a coherent exact request-bound first page', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response()}/>)
    const preview = screen.getByRole('region', { name: 'DOAJ Open Access Articles' })
    const result = preview.querySelector('[data-domain-card="doaj-search"]')
    expect(result).toHaveAttribute('data-result-state', 'ready')
    expect(result).toHaveAttribute('data-request-bound', 'true')
    expect(result).toHaveAttribute('data-request-query', 'climate')
    expect(result).toHaveAttribute('data-requested-page-size', '2')
    expect(result).toHaveAttribute('data-provider-total', '2')
    expect(result).toHaveAttribute('data-primary-article-id', 'article-1')
    expect(preview).toHaveTextContent('Climate adaptation in open science')
    expect(preview).toHaveTextContent('10.1234/article-1')
  })

  it('fails closed on non-GET/body transport and keeps missing execution context unbound', () => {
    for (const request of [executedRequest('POST'), executedRequest('GET', { unexpected: true }), executedRequest('GET', undefined, 'https://doaj.org/api/search/articles/ocean?pageSize=2')]) {
      cleanup()
      render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={request} data={response()}/>)
      const preview = screen.getByRole('region', { name: 'DOAJ Open Access Articles' })
      const result = preview.querySelector('[data-domain-card="doaj-search"]')
      expect(result).toHaveAttribute('data-result-state', 'invalid')
      expect(result).toHaveAttribute('data-request-bound', 'false')
      expect(preview).not.toHaveTextContent('Climate adaptation in open science')
    }

    cleanup()
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response()}/>)
    const preview = screen.getByRole('region', { name: 'DOAJ Open Access Articles' })
    const result = preview.querySelector('[data-domain-card="doaj-search"]')
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails closed when the executed request adds or duplicates semantics', () => {
    for (const badUrl of [`${requestUrl}&foo=bar`, `${requestUrl}&pageSize=1`]) {
      cleanup()
      render(<ResponseDemoPreview api={api} requestUrl={badUrl} data={response()}/>)
      const preview = screen.getByRole('region', { name: 'DOAJ Open Access Articles' })
      expect(preview.querySelector('[data-domain-card="doaj-search"]')).toHaveAttribute('data-result-state', 'invalid')
      expect(preview).not.toHaveTextContent('Climate adaptation in open science')
    }
  })

  it('fails closed when provider query echo does not acknowledge the executed search', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response(undefined, { query: 'ocean' })}/>)
    const preview = screen.getByRole('region', { name: 'DOAJ Open Access Articles' })
    const result = preview.querySelector('[data-domain-card="doaj-search"]')
    expect(result).toHaveAttribute('data-result-state', 'invalid')
    expect(result).toHaveAttribute('data-query-contract', 'false')
    expect(preview).not.toHaveTextContent('Climate adaptation in open science')
  })

  it('fails closed when pagination metadata uses numeric strings instead of native integers', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response(undefined, { total: '2', page: '1', pageSize: '2' })}/>)
    const preview = screen.getByRole('region', { name: 'DOAJ Open Access Articles' })
    const result = preview.querySelector('[data-domain-card="doaj-search"]')
    expect(result).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Climate adaptation in open science')
  })

  it('withholds malformed and duplicate article identities as partial evidence', () => {
    const valid = article('article-1')
    const malformed = { ...article('article-bad', 'Fabricated missing identity'), id: '' }
    const duplicate = article('article-1', 'Fabricated duplicate identity')
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response([valid, malformed, duplicate], { total: 3 })}/>)
    const preview = screen.getByRole('region', { name: 'DOAJ Open Access Articles' })
    const result = preview.querySelector('[data-domain-card="doaj-search"]')
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-valid-record-count', '1')
    expect(result).toHaveAttribute('data-malformed-record-count', '1')
    expect(result).toHaveAttribute('data-duplicate-record-count', '1')
    expect(preview).not.toHaveTextContent('Fabricated missing identity')
    expect(preview).not.toHaveTextContent('Fabricated duplicate identity')
  })

  it('maps a coherent request-bound zero-result response to semantic empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response([], { total: 0 })}/>)
    const preview = screen.getByRole('region', { name: 'DOAJ Open Access Articles' })
    expect(preview.querySelector('[data-domain-card="doaj-search"]')).toHaveAttribute('data-result-state', 'empty')
  })

  it('declares shared non-empty/integer fields and preserves malformed explicit inputs for pre-network validation', () => {
    expect(api.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(api.fields.find((field) => field.id === 'pageSize')?.step).toBe(1)
    expect(new URL(api.buildUrl({ query: '   ', pageSize: '5' })).pathname).toBe('/api/search/articles/')
    expect(new URL(api.buildUrl({ query: 'climate', pageSize: '2.5' })).searchParams.get('pageSize')).toBe('2.5')
  })
})
