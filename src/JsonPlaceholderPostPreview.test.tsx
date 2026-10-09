import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ResponseDemoPreview } from './responsePreview'
import { apiCatalog } from './apiCatalog'

afterEach(() => cleanup())

const api = apiCatalog.find((entry) => entry.id === 'posts')!
const request = (id = '7') => api.buildUrl({ postId: id })
const executedRequest = (url = request(), method = 'GET', body?: unknown) => ({ url, method, body })
const post = {
  userId: 1,
  id: 7,
  title: 'magnam facilis autem',
  body: 'dolore placeat quibusdam ea quo vitae',
}

describe('JsonPlaceholderPostPreview', () => {
  it('renders a coherent request-bound post as ready', () => {
    render(<ResponseDemoPreview api={api} requestUrl={request()} executedRequest={executedRequest()} data={post}/>)
    const region = screen.getByRole('region', { name: 'Post Sandbox' })
    expect(region).toHaveAttribute('data-preview-layout', 'rest-post')
    const card = region.querySelector('[data-domain-card="jsonplaceholder-post"]')!
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-post-id', '7')
    expect(card).toHaveAttribute('data-provider-post-id', '7')
    expect(card).toHaveAttribute('data-author-user-id', '1')
    expect(within(region).getByText('magnam facilis autem')).toBeInTheDocument()
    expect(within(region).getByText('dolore placeat quibusdam ea quo vitae')).toBeInTheDocument()
  })

  it('fails closed when provider post identity contradicts the executed request', () => {
    render(<ResponseDemoPreview api={api} requestUrl={request()} executedRequest={executedRequest()} data={{ ...post, id: 8, title: 'Fabricated post' }}/>)
    const region = screen.getByRole('region', { name: 'Post Sandbox' })
    expect(region.querySelector('[data-domain-card="jsonplaceholder-post"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(within(region).queryByText('Fabricated post')).not.toBeInTheDocument()
  })

  it('treats an empty HTTP-success object as invalid rather than a semantic empty post', () => {
    render(<ResponseDemoPreview api={api} requestUrl={request()} data={{}}/>)
    const region = screen.getByRole('region', { name: 'Post Sandbox' })
    expect(region.querySelector('[data-domain-card="jsonplaceholder-post"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('keeps a valid provider post partial when executed-request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={request()} data={post}/>)
    const region = screen.getByRole('region', { name: 'Post Sandbox' })
    expect(region.querySelector('[data-domain-card="jsonplaceholder-post"]')).toHaveAttribute('data-result-state', 'partial')
    expect(within(region).getByText('magnam facilis autem')).toBeInTheDocument()
  })

  it('withholds malformed author identity instead of rendering a plausible user value', () => {
    render(<ResponseDemoPreview api={api} requestUrl={request()} executedRequest={executedRequest()} data={{ ...post, userId: '1' }}/>)
    const region = screen.getByRole('region', { name: 'Post Sandbox' })
    const card = region.querySelector('[data-domain-card="jsonplaceholder-post"]')!
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(within(region).getByText('Author user ID')).toBeInTheDocument()
    expect(within(region).getByText('Unavailable')).toBeInTheDocument()
  })

  it('withholds malformed content while preserving trustworthy post identity', () => {
    render(<ResponseDemoPreview api={api} requestUrl={request()} executedRequest={executedRequest()} data={{ ...post, title: 123, body: null }}/>)
    const region = screen.getByRole('region', { name: 'Post Sandbox' })
    const card = region.querySelector('[data-domain-card="jsonplaceholder-post"]')!
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(within(region).getByText('Post #7')).toBeInTheDocument()
    expect(within(region).getByText('Content unavailable')).toBeInTheDocument()
  })

  it.each([
    ['POST transport', executedRequest(request(), 'POST')],
    ['GET transport with a body', executedRequest(request(), 'GET', { postId: 7 })],
    ['executed URL drift', executedRequest(request('8'))],
  ])('fails closed when %s contradicts the displayed GET request', (_label, actualRequest) => {
    render(<ResponseDemoPreview api={api} requestUrl={request()} executedRequest={actualRequest} data={post}/>)
    const region = screen.getByRole('region', { name: 'Post Sandbox' })
    expect(region.querySelector('[data-domain-card="jsonplaceholder-post"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(within(region).queryByText('magnam facilis autem')).not.toBeInTheDocument()
  })
})
