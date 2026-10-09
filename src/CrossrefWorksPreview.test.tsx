import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'crossref-works')!
const requestUrl = api.buildUrl({ query: 'agentic AI', rows: '2' })
const executedRequest = (method = 'GET', body?: unknown, url = requestUrl): ExecutedRequestContext => ({ url, method, body })

const works = [
  {
    DOI: '10.1007/979-8-8688-1542-3_1',
    URL: 'https://doi.org/10.1007/979-8-8688-1542-3_1',
    title: ['Introduction to Enterprise Agentic AI'],
    author: [{ given: 'Sumit', family: 'Ranjan' }],
    published: { 'date-parts': [[2025]] },
    publisher: 'Apress',
    'is-referenced-by-count': 0,
    type: 'book-chapter',
  },
  {
    DOI: '10.1007/979-8-8688-1542-3_6',
    URL: 'https://doi.org/10.1007/979-8-8688-1542-3_6',
    title: ['Vector Databases in Enterprise Agentic AI'],
    author: [{ given: 'Timothy', family: 'King' }],
    published: { 'date-parts': [[2025]] },
    publisher: 'Apress',
    'is-referenced-by-count': 2,
    type: 'book-chapter',
  },
]

const response = (items: unknown[] = works, overrides: Record<string, unknown> = {}) => ({
  status: 'ok',
  'message-type': 'work-list',
  'message-version': '1.0.0',
  message: {
    'items-per-page': 2,
    'total-results': 42,
    query: { 'start-index': 0, 'search-terms': 'agentic AI' },
    items,
    ...overrides,
  },
})

const card = () => screen.getByRole('region', { name: 'Crossref Works Search' }).querySelector('[data-domain-card="crossref-works-search"]') as HTMLElement

describe('Crossref Works search semantics', () => {
  afterEach(cleanup)

  it('renders only a request-bound first page with coherent provider pagination', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response()}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-query', 'agentic AI')
    expect(root).toHaveAttribute('data-request-rows', '2')
    expect(root).toHaveAttribute('data-provider-total-results', '42')
    expect(root).toHaveAttribute('data-provider-item-count', '2')
    expect(root).toHaveAttribute('data-query-contract', 'true')
    expect(root).toHaveAttribute('data-count-contract', 'true')
    expect(root).toHaveAttribute('data-primary-doi', works[0].DOI)
    expect(within(root).getByText('0 citations')).toBeInTheDocument()
  })

  it('fails closed when canonical Crossref URL was not executed as the same bodyless GET', () => {
    const rejected = [
      executedRequest('POST'),
      executedRequest('GET', { unexpected: true }),
      executedRequest('GET', undefined, requestUrl.replace('rows=2', 'rows=1')),
    ]
    for (const request of rejected) {
      cleanup()
      render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={request} data={response()}/>)
      expect(card()).toHaveAttribute('data-result-state', 'invalid')
      expect(card()).toHaveAttribute('data-request-bound', 'false')
    }
  })

  it('keeps coherent Crossref data partial when executed transport identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
  })

  it('distinguishes a coherent zero-result search from a malformed HTTP-success envelope', () => {
    const emptyResponse = response([], { 'total-results': 0 })
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={emptyResponse}/>)
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveTextContent('No Crossref works matched')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={{ status: 'ok', 'message-type': 'work-list', 'message-version': '1.0.0', message: { 'total-results': 0 } }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid Crossref works response')
  })

  it('fails closed when Crossref does not acknowledge the executed search', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response(works, { query: { 'start-index': 0, 'search-terms': 'unrelated query' } })}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-query-contract', 'false')
    expect(root).not.toHaveTextContent('Introduction to Enterprise Agentic AI')
  })

  it('does not claim ready for a truncated first page or numeric-string pagination metadata', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response([works[0]])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-count-contract', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response(works, { 'items-per-page': '2', 'total-results': '42' })}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-count-contract', 'false')
  })

  it('withholds identity-less works and malformed citation counts from a mixed provider page', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={response([
      { ...works[0], 'is-referenced-by-count': '12' },
      { ...works[1], DOI: undefined, URL: undefined, title: ['Fabricated scholarly work'] },
    ])}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-valid-item-count', '1')
    expect(root).toHaveAttribute('data-invalid-item-count', '1')
    expect(root).toHaveAttribute('data-incomplete-item-count', '1')
    expect(root).toHaveTextContent('Citation count unavailable')
    expect(root).not.toHaveTextContent('12 citations')
    expect(root).not.toHaveTextContent('Fabricated scholarly work')
  })
})
