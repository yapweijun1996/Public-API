import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'metacpan')
if (!api) throw new Error('Missing MetaCPAN API fixture')
const requestUrl = api.buildUrl({ query: 'Mojolicious', count: '6' })
const executedRequest = { url: requestUrl, method: 'GET' }

const hit = (moduleName = 'Mojolicious', overrides: Record<string, unknown> = {}) => ({
  _index: 'file_01',
  _id: `id-${moduleName}`,
  _score: 17.4,
  _source: {
    id: `source-${moduleName}`,
    author: 'SRI',
    authorized: true,
    date: '2026-08-29T08:45:15',
    distribution: moduleName === 'Mojolicious' ? 'Mojolicious' : 'Fabricated-Dist',
    documentation: moduleName,
    indexed: true,
    module: [{ associated_pod: `SRI/${moduleName}.pm`, authorized: true, indexed: true, name: moduleName, version: '9.49', version_numified: 9.49 }],
    name: `${moduleName}.pm`,
    release: moduleName === 'Mojolicious' ? 'Mojolicious-9.49' : 'Fabricated-Dist-999.0.0',
    status: 'latest',
    version: moduleName === 'Mojolicious' ? '9.49' : '999.0.0',
  },
  ...overrides,
})

const fixture = (hits: unknown[] = [hit()], total = hits.length, overrides: Record<string, unknown> = {}) => ({
  took: 4,
  timed_out: false,
  hits: { total, max_score: 17.4, hits },
  ...overrides,
})

const card = () => screen.getByRole('region', { name: 'MetaCPAN API' }).querySelector('[data-domain-card="metacpan-module-search"]')

describe('MetaCPAN module search semantic preview', () => {
  afterEach(cleanup)

  it('builds an exact latest-module query and renders request-bound results as ready', () => {
    const url = new URL(requestUrl)
    expect(url.pathname).toBe('/v1/module/_search')
    expect(url.searchParams.get('q')).toBe('module.name:"Mojolicious" AND status:latest')
    expect(url.searchParams.get('size')).toBe('6')

    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'MetaCPAN API' })
    expect(preview).toHaveAttribute('data-preview-layout', 'cpan-module-search')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-requested-module', 'Mojolicious')
    expect(card()).toHaveAttribute('data-query-bound', 'true')
    expect(card()).toHaveAttribute('data-provider-total', '1')
    expect(card()).toHaveAttribute('data-provider-hit-count', '1')
    expect(card()).toHaveAttribute('data-valid-hit-count', '1')
    expect(card()).toHaveAttribute('data-invalid-hit-count', '0')
    expect(card()).toHaveAttribute('data-primary-distribution', 'Mojolicious')
    expect(card()).toHaveAttribute('data-primary-release', 'Mojolicious-9.49')
    expect(card()).toHaveAttribute('data-primary-version', '9.49')
    expect(preview).toHaveTextContent('Mojolicious-9.49')
  })

  it('renders a request-bound zero-result provider response as empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={fixture([], 0)}/>)
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveAttribute('data-requested-module', 'Mojolicious')
    expect(screen.getByRole('region', { name: 'MetaCPAN API' })).toHaveTextContent('No current CPAN module match')
  })

  it('fails closed when HTTP-success hits identify a different module', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={fixture([hit('Fabricated::Module')], 1)}/>)
    const preview = screen.getByRole('region', { name: 'MetaCPAN API' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('MetaCPAN module identity mismatch')
    expect(preview).not.toHaveTextContent('Fabricated::Module')
    expect(preview).not.toHaveTextContent('999.0.0')
  })

  it('keeps a mixed valid/mismatched batch partial and hides the bad hit', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={fixture([hit(), hit('Fabricated::Module')], 2)}/>)
    const preview = screen.getByRole('region', { name: 'MetaCPAN API' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-provider-hit-count', '2')
    expect(card()).toHaveAttribute('data-valid-hit-count', '1')
    expect(card()).toHaveAttribute('data-invalid-hit-count', '1')
    expect(preview).toHaveTextContent('Mojolicious-9.49')
    expect(preview).not.toHaveTextContent('Fabricated::Module')
    expect(preview).not.toHaveTextContent('999.0.0')
  })

  it('fails closed on a malformed HTTP-success search envelope', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={{ timed_out: false, hits: { total: 1, hits: {} } }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'MetaCPAN API' })).toHaveTextContent('Invalid MetaCPAN search response')
  })

  it('keeps internally trustworthy results partial when request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-query-bound', 'false')
    expect(card()).toHaveAttribute('data-primary-module', 'Mojolicious')
    expect(screen.getByRole('region', { name: 'MetaCPAN API' })).toHaveTextContent('executed-request identity is unavailable')
  })

  it('fails closed when a canonical URL was executed with a non-GET transport or request body', () => {
    const response = fixture()
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={response}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'MetaCPAN API' })).toHaveTextContent('Invalid MetaCPAN request identity')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { q: 'Mojolicious' } }} data={response}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when the captured URL uses the old unqualified search', () => {
    const wrongUrl = 'https://fastapi.metacpan.org/v1/module/_search?q=Mojolicious&size=6'
    render(<ResponseDemoPreview api={api} requestUrl={wrongUrl} executedRequest={{ url: wrongUrl, method: 'GET' }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'MetaCPAN API' })).toHaveTextContent('Invalid MetaCPAN request identity')
  })
})
