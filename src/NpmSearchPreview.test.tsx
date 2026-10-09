import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'npm-search')
if (!api) throw new Error('Missing npm Registry Search fixture')
const requestUrl = api.buildUrl({ query: 'react', limit: '8' })
const executedRequest = { url: requestUrl, method: 'GET' }

const result = (name = 'react', overrides: Record<string, unknown> = {}) => ({
  downloads: { monthly: 120000000, weekly: 30000000 },
  dependents: 100000,
  updated: '2026-09-10T12:00:00.000Z',
  searchScore: 1234.5,
  package: {
    name,
    version: '19.1.1',
    description: `${name} package`,
    sanitized_name: name,
    publisher: { username: 'npm-publisher' },
    maintainers: [{ username: 'npm-maintainer' }],
    license: 'MIT',
    date: '2026-09-10T12:00:00.000Z',
    keywords: ['react', 'ui'],
    links: { npm: `https://www.npmjs.com/package/${encodeURIComponent(name)}` },
  },
  score: { final: 1234.5, detail: { popularity: 1, quality: 1, maintenance: 1 } },
  flags: { insecure: 0 },
  ...overrides,
})

const fixture = (objects: unknown[] = [result()], total = 42, overrides: Record<string, unknown> = {}) => ({
  objects,
  total,
  time: '2026-09-12T11:30:00.000Z',
  ...overrides,
})

const card = () => screen.getByRole('region', { name: 'npm Registry Search' }).querySelector('[data-domain-card="npm-package-search"]')

describe('npm Registry Search semantic preview', () => {
  afterEach(cleanup)

  it('renders request-bound search results as ready without pretending the package name must equal the query', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={fixture([result('react'), result('react-dom')], 42)}/>)
    const preview = screen.getByRole('region', { name: 'npm Registry Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'npm-package-search')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-search-query', 'react')
    expect(card()).toHaveAttribute('data-request-size', '8')
    expect(card()).toHaveAttribute('data-query-bound', 'true')
    expect(card()).toHaveAttribute('data-provider-total', '42')
    expect(card()).toHaveAttribute('data-provider-result-count', '2')
    expect(card()).toHaveAttribute('data-valid-result-count', '2')
    expect(card()).toHaveAttribute('data-invalid-result-count', '0')
    expect(card()).toHaveAttribute('data-incomplete-result-count', '0')
    expect(preview).toHaveTextContent('react-dom')
    expect(preview).toHaveTextContent('30,000,000')
  })

  it('renders a request-bound zero-match response as empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={fixture([], 0)}/>)
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveAttribute('data-search-query', 'react')
    expect(screen.getByRole('region', { name: 'npm Registry Search' })).toHaveTextContent('No npm packages matched')
  })

  it('fails closed on a malformed HTTP-success search envelope', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={{ total: 1, objects: {} }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'npm Registry Search' })).toHaveTextContent('Invalid npm search response')
  })

  it('keeps a mixed valid/malformed batch partial and hides the malformed package', () => {
    const bad = result('fabricated-package', { package: { version: '999.0.0', description: 'Fabricated package.' } })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={fixture([result('react'), bad], 42)}/>)
    const preview = screen.getByRole('region', { name: 'npm Registry Search' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-provider-result-count', '2')
    expect(card()).toHaveAttribute('data-valid-result-count', '1')
    expect(card()).toHaveAttribute('data-invalid-result-count', '1')
    expect(preview).toHaveTextContent('react package')
    expect(preview).not.toHaveTextContent('fabricated-package')
    expect(preview).not.toHaveTextContent('999.0.0')
  })

  it('does not coerce malformed download counters or search scores into plausible facts', () => {
    const malformed = result('react-dom', { downloads: { monthly: '120000000', weekly: -1 }, searchScore: '1234.5' })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={fixture([result('react'), malformed], 42)}/>)
    const preview = screen.getByRole('region', { name: 'npm Registry Search' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-valid-result-count', '2')
    expect(card()).toHaveAttribute('data-incomplete-result-count', '1')
    expect(preview).toHaveTextContent('react-dom')
    expect(preview).not.toHaveTextContent('-1 weekly')
    expect(preview).not.toHaveTextContent('1234.5')
  })

  it('fails closed when a canonical URL was executed with a non-GET transport or request body', () => {
    const response = fixture()
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={response}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'npm Registry Search' })).toHaveTextContent('Invalid npm search request identity')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { text: 'react' } }} data={response}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when the captured URL is not the supported npm registry search endpoint', () => {
    render(<ResponseDemoPreview api={api} requestUrl="https://example.com/-/v1/search?text=react&size=8" executedRequest={{ url: 'https://example.com/-/v1/search?text=react&size=8', method: 'GET' }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'npm Registry Search' })).toHaveTextContent('Invalid npm search request identity')
  })

  it('keeps internally trustworthy results partial when executed-request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-query-bound', 'false')
    expect(screen.getByRole('region', { name: 'npm Registry Search' })).toHaveTextContent('executed-request identity is unavailable')
  })
})
