import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'devto')!
const requestUrl = api.buildUrl({ tag: 'javascript', limit: '8' })
const executed = (url = requestUrl, method = 'GET', body?: unknown) => ({ url, method, ...(body === undefined ? {} : { body }) })

const article = (overrides: Record<string, unknown> = {}) => ({
  type_of: 'article',
  id: 4638269,
  title: 'A trustworthy JavaScript article',
  description: 'A short article summary.',
  readable_publish_date: 'Sep 12',
  tag_list: ['javascript', 'webdev'],
  slug: 'a-trustworthy-javascript-article',
  path: '/example/a-trustworthy-javascript-article',
  url: 'https://dev.to/example/a-trustworthy-javascript-article',
  public_reactions_count: 6,
  comments_count: 2,
  published_timestamp: '2026-09-12T10:24:23Z',
  reading_time_minutes: 5,
  user: { name: 'Example Author', username: 'example' },
  ...overrides,
})

const domain = () => screen.getByRole('region', { name: 'DEV.to / Forem API' }).querySelector('[data-domain-card="devto-articles"]') as HTMLElement

describe('DevToArticlesPreview', () => {
  afterEach(cleanup)

  it('renders a coherent request-bound tagged article batch as ready', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={[article()]}/>)
    const preview = screen.getByRole('region', { name: 'DEV.to / Forem API' })
    expect(preview).toHaveAttribute('data-preview-layout', 'community-articles')
    expect(domain()).toHaveAttribute('data-result-state', 'ready')
    expect(domain()).toHaveAttribute('data-request-tag', 'javascript')
    expect(domain()).toHaveAttribute('data-tag-contract', 'true')
    expect(within(preview).getByText('A trustworthy JavaScript article')).toBeInTheDocument()
    expect(within(preview).getByText(/@example/)).toBeInTheDocument()
    expect(within(preview).getByText('6 reactions')).toBeInTheDocument()
    expect(within(preview).getByText('2')).toBeInTheDocument()
    expect(within(preview).getByText('5 min')).toBeInTheDocument()
  })

  it('withholds malformed engagement metrics instead of manufacturing zeroes', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={[article({ public_reactions_count: '0', comments_count: -1, reading_time_minutes: '5' })]}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'partial')
    expect(domain()).toHaveAttribute('data-incomplete-result-count', '1')
    expect(screen.getByText('Reactions unavailable')).toBeInTheDocument()
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(2)
  })

  it('hides an article that contradicts the exact requested tag', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={[article(), article({ id: 999, title: 'Fabricated Python article', path: '/other/fabricated', url: 'https://dev.to/other/fabricated', tag_list: ['python'], public_reactions_count: 999999 })]}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'partial')
    expect(domain()).toHaveAttribute('data-valid-result-count', '1')
    expect(domain()).toHaveAttribute('data-invalid-result-count', '1')
    expect(screen.queryByText('Fabricated Python article')).not.toBeInTheDocument()
    expect(screen.queryByText('999,999 reactions')).not.toBeInTheDocument()
  })

  it('fails closed on malformed HTTP-success data', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={{ articles: [article()] }}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByText('Invalid DEV article response')).toBeInTheDocument()
  })

  it('treats a request-bound empty page as semantic empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={[]}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'empty')
    expect(screen.getByText(/No DEV articles matched/)).toBeInTheDocument()
  })

  it('fails closed when the executed transport is not the supported bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed(requestUrl, 'POST')} data={[article()]}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed(requestUrl, 'GET', { unexpected: true })} data={[article()]}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'invalid')
  })
})
