import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = getApiById('spaceflight-news')!
const requestUrl = api.buildUrl({ query: 'NASA', limit: '6' })
const executedRequest = { url: requestUrl, method: 'GET' as const }

const article = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `NASA article ${id}`,
  url: `https://example.com/articles/${id}`,
  image_url: `https://example.com/images/${id}.jpg`,
  news_site: 'Fixture Space News',
  summary: `Trusted summary for NASA article ${id}.`,
  published_at: '2026-09-17T12:00:00Z',
  updated_at: '2026-09-17T13:00:00Z',
  authors: [{ name: 'Fixture Reporter' }],
  launches: [{ launch_id: `launch-${id}` }],
  events: [{ event_id: id }],
  ...overrides,
})

const nextPage = (search = 'NASA', limit = 6) => `https://api.spaceflightnewsapi.net/v4/articles/?${new URLSearchParams({
  search,
  limit: String(limit),
  ordering: '-published_at',
  offset: String(limit),
}).toString()}`

const response = (results: unknown[], count = results.length, next: unknown = count > 6 ? nextPage() : null) => ({
  count,
  next,
  previous: null,
  results,
})

const card = async () => {
  const region = await screen.findByRole('region', { name: 'Spaceflight News' })
  return region.querySelector('[data-domain-card="spaceflight-news"]') as HTMLElement
}

describe('Spaceflight News semantic preview', () => {
  it('binds trusted native article identities and counts to the exact executed request', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={response([article(101), article(102)])}/>)

    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-contract', 'exact-snapi-articles-v1')
    expect(root).toHaveAttribute('data-request-search', 'NASA')
    expect(root).toHaveAttribute('data-request-limit', '6')
    expect(root).toHaveAttribute('data-request-order', '-published_at')
    expect(root).toHaveAttribute('data-provider-total-count', '2')
    expect(root).toHaveAttribute('data-provider-record-count', '2')
    expect(root).toHaveAttribute('data-valid-record-count', '2')
    expect(root).toHaveAttribute('data-primary-article-id', '101')
    expect(root).toHaveAttribute('data-primary-source', 'Fixture Space News')
    expect(within(root).getAllByRole('link', { name: /Read at Fixture Space News/i })).toHaveLength(2)
    expect(root).toHaveTextContent('NASA article 101')
    expect(root).toHaveTextContent('1 author · 1 launch · 1 event')
  })

  it('maps a coherent request-bound zero-result first page to empty', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response([], 0)}/>)

    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'empty')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-provider-total-count', '0')
    expect(root).toHaveAttribute('data-provider-record-count', '0')
    expect(root).toHaveTextContent('No spaceflight articles matched')
  })

  it('withholds duplicate and malformed native identities and reports over-limit rows as partial', async () => {
    const threeUrl = api.buildUrl({ query: 'NASA', limit: '3' })
    render(<ResponseDemoPreview api={api} executedRequest={{ method: 'GET', url: threeUrl }} data={response([
      article(101),
      article(101, { title: 'Fabricated duplicate article' }),
      article(103, { id: '103', title: 'Fabricated numeric-string identity' }),
      article(104, { title: 'Fabricated overflow article' }),
    ], 4, nextPage('NASA', 3))}/>)

    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-provider-record-count', '3')
    expect(root).toHaveAttribute('data-valid-record-count', '1')
    expect(root).toHaveAttribute('data-duplicate-record-count', '1')
    expect(root).toHaveAttribute('data-malformed-record-count', '1')
    expect(root).toHaveAttribute('data-overflow-record-count', '1')
    expect(root).toHaveAttribute('data-primary-article-id', '101')
    expect(root).not.toHaveTextContent('Fabricated duplicate article')
    expect(root).not.toHaveTextContent('Fabricated numeric-string identity')
    expect(root).not.toHaveTextContent('Fabricated overflow article')
  })

  it('rejects extra and duplicate request parameters and never renders unbound data as ready', async () => {
    const payload = response([article(101)])
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={payload}/>)

    let root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-request-bound', 'false')
    expect(root).not.toHaveTextContent('NASA article 101')

    rerender(<ResponseDemoPreview api={api} executedRequest={{ method: 'GET', url: `${requestUrl}&offset=0` }} data={payload}/>)
    root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} executedRequest={{ method: 'GET', url: `${requestUrl}&limit=6` }} data={payload}/>)
    root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-request-bound', 'false')
  })

  it.each([
    ['numeric-string count', { ...response([article(101)]), count: '1' }],
    ['non-null previous page', { ...response([article(101)]), previous: nextPage() }],
    ['short first page', response([article(101)], 2)],
    ['missing required next page', response([article(101), article(102), article(103), article(104), article(105), article(106)], 7, null)],
    ['inexact next-page offset', response([article(101), article(102), article(103), article(104), article(105), article(106)], 7, nextPage('NASA', 5))],
    ['unexpected next page', response([article(101)], 1, nextPage())],
  ])('fails closed for invalid pagination: %s', async (_label, payload) => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={payload}/>)

    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).not.toHaveTextContent('NASA article 101')
  })
})
