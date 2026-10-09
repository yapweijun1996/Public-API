import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'iconify-search')
if (!api) throw new Error('Missing Iconify fixture')

const requestUrl = (query = 'home', limit = '32') => api.buildUrl({ query, limit })
const executedGet = (url = requestUrl()) => ({ url, method: 'GET' })

describe('Iconify semantic search preview', () => {
  afterEach(cleanup)

  it('preserves icon identity and collection licence metadata', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl()} executedRequest={executedGet()} data={{
      icons: ['material-symbols:home', 'lucide:house'], total: 2, limit: 32, start: 0,
      request: { query: 'home', limit: '32' },
      collections: {
        'material-symbols': { name: 'Material Symbols', total: 15618, author: { name: 'Google' }, license: { title: 'Apache 2.0', spdx: 'Apache-2.0' } },
        lucide: { name: 'Lucide', total: 1660, version: '0.468.0', author: { name: 'Lucide Contributors' }, license: { title: 'ISC', spdx: 'ISC' } },
      },
    }}/>)

    const preview = screen.getByRole('region', { name: 'Iconify Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'icon-catalog')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')
    const card = preview.querySelector('.iconify-search-preview')
    expect(card).toHaveAttribute('data-primary-icon-id', 'material-symbols:home')
    expect(card).toHaveAttribute('data-query', 'home')
    expect(card).toHaveAttribute('data-provider-limit', '32')
    const first = card?.querySelector('[data-record-index="1"]')
    expect(first).toHaveAttribute('data-icon-prefix', 'material-symbols')
    expect(first).toHaveAttribute('data-license-spdx', 'Apache-2.0')
    expect(preview).toHaveTextContent('material-symbols:home')
    expect(preview).toHaveTextContent('Google')
    expect(preview).toHaveTextContent('Apache 2.0 · Apache-2.0')
    expect(preview).not.toHaveTextContent('Iconify Search record 1')
  })

  it('distinguishes empty, invalid, and partial HTTP-success responses', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl('zzzz')} executedRequest={executedGet(requestUrl('zzzz'))} data={{ icons: [], total: 0, limit: 32, start: 0, collections: {}, request: { query: 'zzzz', limit: '32' } }}/>)
    expect(screen.getByRole('region', { name: 'Iconify Search' }).querySelector('[data-domain-card="icon-catalog"]')).toHaveAttribute('data-result-state', 'empty')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl()} executedRequest={executedGet()} data={{ total: 0, limit: 32, start: 0, collections: {}, request: { query: 'home', limit: '32' } }}/>)
    expect(screen.getByRole('region', { name: 'Iconify Search' }).querySelector('[data-domain-card="icon-catalog"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl()} executedRequest={executedGet()} data={{ icons: ['lucide:house', 'not-prefixed'], total: 2, limit: 32, start: 0, collections: { lucide: { name: 'Lucide' } }, request: { query: 'home', limit: '32' } }}/>)
    const card = screen.getByRole('region', { name: 'Iconify Search' }).querySelector('.iconify-search-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-icon-count', '1')
    expect(card).toHaveAttribute('data-invalid-icon-count', '1')
    expect(card).toHaveTextContent('lucide:house')
    expect(card).not.toHaveTextContent('not-prefixed')
  })


  const validResponse = {
    icons: ['lucide:house'], total: 1, limit: 32, start: 0,
    collections: { lucide: { name: 'Lucide', total: 1660 } },
    request: { query: 'home', limit: '32' },
  }

  it('rejects an executed request with unsupported extra query keys', () => {
    render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl()}&start=0`} executedRequest={executedGet(`${requestUrl()}&start=0`)} data={validResponse}/>)
    expect(screen.getByRole('region', { name: 'Iconify Search' }).querySelector('[data-domain-card="icon-catalog"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('rejects a provider request echo that does not acknowledge the executed query', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl()} executedRequest={executedGet()} data={{ ...validResponse, request: { query: 'weather', limit: '32' } }}/>)
    expect(screen.getByRole('region', { name: 'Iconify Search' }).querySelector('[data-domain-card="icon-catalog"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('does not coerce numeric-string pagination metadata into trusted numbers', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl()} executedRequest={executedGet()} data={{ ...validResponse, limit: '32' }}/>)
    const card = screen.getByRole('region', { name: 'Iconify Search' }).querySelector('.iconify-search-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-pagination-contract-valid', 'false')
  })

  it('does not claim ready without exact successful transport evidence', () => {
    const url = requestUrl()
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={url} data={validResponse}/>)
    let card = screen.getByRole('region', { name: 'Iconify Search' }).querySelector('[data-domain-card="icon-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-request-contract', 'exact-iconify-search-v2')

    rerender(<ResponseDemoPreview api={api} requestUrl={url} executedRequest={{ url, method: 'POST' }} data={validResponse}/>)
    card = screen.getByRole('region', { name: 'Iconify Search' }).querySelector('[data-domain-card="icon-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={url} executedRequest={{ url, method: 'GET', body: { unexpected: true } }} data={validResponse}/>)
    card = screen.getByRole('region', { name: 'Iconify Search' }).querySelector('[data-domain-card="icon-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={url} executedRequest={{ url: `${url}&start=0`, method: 'GET' }} data={validResponse}/>)
    card = screen.getByRole('region', { name: 'Iconify Search' }).querySelector('[data-domain-card="icon-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={url} executedRequest={{ url, method: 'GET' }} data={validResponse}/>)
    card = screen.getByRole('region', { name: 'Iconify Search' }).querySelector('.iconify-search-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
  })

})
