import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'packagist-search')
if (!api) throw new Error('Missing Packagist Package Search fixture')
const requestUrl = api.buildUrl({ query: 'monolog', limit: '8' })
const executedRequest = (url = requestUrl, method = 'GET', body?: unknown): ExecutedRequestContext => ({ url, method, body })
const renderPreview = (data: unknown, request = executedRequest()) => render(<ResponseDemoPreview api={api} requestUrl={request.url} executedRequest={request} data={data}/>)

const result = (name = 'monolog/monolog', overrides: Record<string, unknown> = {}) => ({
  name,
  description: `${name} package`,
  url: `https://packagist.org/packages/${name}`,
  repository: `https://github.com/${name}`,
  downloads: 1061138158,
  favers: 22272,
  ...overrides,
})

const fixture = (results: unknown[] = [result()], total = 42, overrides: Record<string, unknown> = {}) => ({
  results,
  total,
  next: total > results.length ? 'https://packagist.org/search.json?q=monolog&page=2&per_page=8' : null,
  ...overrides,
})

const card = () => screen.getByRole('region', { name: 'Packagist Package Search' }).querySelector('[data-domain-card="packagist-package-search"]')

describe('Packagist Package Search semantic preview', () => {
  afterEach(cleanup)

  it('renders numeric Packagist downloads and request-bound package results as ready', () => {
    renderPreview(fixture([result(), result('symfony/monolog-bundle')], 42))
    const preview = screen.getByRole('region', { name: 'Packagist Package Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'composer-package-search')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-search-query', 'monolog')
    expect(card()).toHaveAttribute('data-request-per-page', '8')
    expect(card()).toHaveAttribute('data-request-page', '1')
    expect(card()).toHaveAttribute('data-query-bound', 'true')
    expect(card()).toHaveAttribute('data-provider-total', '42')
    expect(card()).toHaveAttribute('data-provider-result-count', '2')
    expect(card()).toHaveAttribute('data-valid-result-count', '2')
    expect(card()).toHaveAttribute('data-invalid-result-count', '0')
    expect(card()).toHaveAttribute('data-incomplete-result-count', '0')
    expect(card()).toHaveAttribute('data-count-contract', 'true')
    expect(card()).toHaveAttribute('data-pagination-contract', 'true')
    expect(preview).toHaveTextContent('symfony/monolog-bundle')
    expect(preview).toHaveTextContent('1,061,138,158 downloads')
    expect(preview).not.toHaveTextContent('0 downloads')
  })

  it('renders a coherent request-bound zero-match response as empty', () => {
    renderPreview(fixture([], 0))
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveAttribute('data-search-query', 'monolog')
    expect(card()).toHaveAttribute('data-count-contract', 'true')
    expect(card()).toHaveAttribute('data-pagination-contract', 'true')
    expect(screen.getByRole('region', { name: 'Packagist Package Search' })).toHaveTextContent('No Packagist packages matched')
  })

  it('fails closed on a malformed HTTP-success search envelope', () => {
    renderPreview({ total: 1, results: {} })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'Packagist Package Search' })).toHaveTextContent('Invalid Packagist search response')
  })

  it('keeps a mixed valid/malformed batch partial and hides a package with contradictory Packagist identity', () => {
    const bad = result('fabricated/package', { url: 'https://packagist.org/packages/monolog/monolog', downloads: 999999999 })
    renderPreview(fixture([result(), bad], 42))
    const preview = screen.getByRole('region', { name: 'Packagist Package Search' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-provider-result-count', '2')
    expect(card()).toHaveAttribute('data-valid-result-count', '1')
    expect(card()).toHaveAttribute('data-invalid-result-count', '1')
    expect(preview).toHaveTextContent('monolog/monolog')
    expect(preview).not.toHaveTextContent('fabricated/package')
    expect(preview).not.toHaveTextContent('999,999,999')
  })

  it('does not coerce malformed download or favourite counters into plausible zero values', () => {
    const malformed = result('symfony/monolog-bundle', { downloads: '275188098', favers: -1 })
    renderPreview(fixture([result(), malformed], 42))
    const preview = screen.getByRole('region', { name: 'Packagist Package Search' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-valid-result-count', '2')
    expect(card()).toHaveAttribute('data-incomplete-result-count', '1')
    expect(preview).toHaveTextContent('symfony/monolog-bundle')
    expect(preview).toHaveTextContent('Downloads unavailable')
    expect(preview).toHaveTextContent('Unavailable')
    expect(preview).not.toHaveTextContent('275,188,098 downloads')
    expect(preview).not.toHaveTextContent('-1')
  })

  it('keeps trusted rows partial when next-page metadata contradicts the executed search', () => {
    renderPreview(fixture([result()], 42, { next: 'https://packagist.org/search.json?q=other&page=2&per_page=8' }))
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-pagination-contract', 'false')
    expect(screen.getByRole('region', { name: 'Packagist Package Search' })).toHaveTextContent('pagination metadata is inconsistent')
  })

  it('fails closed when the captured URL is not the supported Packagist search endpoint', () => {
    renderPreview(fixture(), executedRequest('https://example.com/search.json?q=monolog&per_page=8'))
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'Packagist Package Search' })).toHaveTextContent('Invalid Packagist search request identity')
  })

  it('fails closed when a canonical URL was executed with the wrong transport identity', () => {
    for (const request of [executedRequest(requestUrl, 'POST'), executedRequest(requestUrl, 'GET', { unexpected: true })]) {
      cleanup()
      renderPreview(fixture([result()], 1), request)
      expect(card()).toHaveAttribute('data-result-state', 'invalid')
      expect(screen.getByRole('region', { name: 'Packagist Package Search' })).toHaveTextContent('Invalid Packagist search request identity')
    }
  })

  it('fails closed when the executed request contains provider-valid but undeclared page state', () => {
    renderPreview(fixture([result()], 1), executedRequest(`${requestUrl}&page=1`))
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'Packagist Package Search' })).toHaveTextContent('Invalid Packagist search request identity')
  })

  it('keeps internally trustworthy results partial when executed-request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={fixture([result()], 1)}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-query-bound', 'false')
    expect(screen.getByRole('region', { name: 'Packagist Package Search' })).toHaveTextContent('executed-request identity is unavailable')
  })
})
