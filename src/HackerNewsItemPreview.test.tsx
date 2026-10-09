import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ResponseDemoPreview } from './responsePreview'
import { apiCatalog } from './apiCatalog'

afterEach(() => cleanup())

const api = apiCatalog.find((entry) => entry.id === 'hacker-news')!
const request = (id = '8863') => api.buildUrl({ itemId: id })
const executed = (url = request(), method = 'GET', body?: unknown) => ({ url, method, ...(body === undefined ? {} : { body }) })
const story = {
  by: 'dhouston', descendants: 71, id: 8863, kids: [9224, 8917], score: 104, time: 1175714200,
  title: 'My YC app: Dropbox - Throw away your USB drive', type: 'story', url: 'http://www.getdropbox.com/u/2/screencast.html',
}

describe('HackerNewsItemPreview', () => {
  it('renders a coherent request-bound story as ready', () => {
    render(<ResponseDemoPreview api={api} requestUrl={request()} executedRequest={executed()} data={story}/>)
    const region = screen.getByRole('region', { name: 'Hacker News API' })
    expect(region).toHaveAttribute('data-preview-layout', 'hn-item')
    const card = region.querySelector('[data-domain-card="hacker-news-item"]')!
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-item-id', '8863')
    expect(card).toHaveAttribute('data-provider-item-id', '8863')
    expect(card).toHaveAttribute('data-item-type', 'story')
    expect(within(region).getByText('My YC app: Dropbox - Throw away your USB drive')).toBeInTheDocument()
    expect(within(region).getByText('104')).toBeInTheDocument()
    expect(within(region).getByText('71')).toBeInTheDocument()
  })

  it('fails closed when provider item identity contradicts the executed request', () => {
    render(<ResponseDemoPreview api={api} requestUrl={request()} executedRequest={executed()} data={{ ...story, id: 9999, title: 'Fabricated item' }}/>)
    const region = screen.getByRole('region', { name: 'Hacker News API' })
    expect(region.querySelector('[data-domain-card="hacker-news-item"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(within(region).queryByText('Fabricated item')).not.toBeInTheDocument()
  })

  it('maps provider null to semantic empty only when request identity is known', () => {
    render(<ResponseDemoPreview api={api} requestUrl={request('999999999')} executedRequest={executed(request('999999999'))} data={null}/>)
    const region = screen.getByRole('region', { name: 'Hacker News API' })
    expect(region.querySelector('[data-domain-card="hacker-news-item"]')).toHaveAttribute('data-result-state', 'empty')
    expect(within(region).getByText(/item #999999999/)).toBeInTheDocument()
  })

  it('treats an unbound null response as invalid instead of inventing not-found identity', () => {
    render(<ResponseDemoPreview api={api} data={null}/>)
    const region = screen.getByRole('region', { name: 'Hacker News API' })
    expect(region.querySelector('[data-domain-card="hacker-news-item"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('renders comment semantics without manufacturing story score or descendants', () => {
    const comment = { by:'norvig', id:2921983, kids:[2922097], parent:2921506, text:'A comment body', time:1314211127, type:'comment' }
    render(<ResponseDemoPreview api={api} requestUrl={request('2921983')} executedRequest={executed(request('2921983'))} data={comment}/>)
    const region = screen.getByRole('region', { name: 'Hacker News API' })
    expect(region.querySelector('[data-domain-card="hacker-news-item"]')).toHaveAttribute('data-result-state', 'ready')
    expect(within(region).getByText('Parent item')).toBeInTheDocument()
    expect(within(region).getByText('2921506')).toBeInTheDocument()
    expect(within(region).queryByText('Score')).not.toBeInTheDocument()
    expect(within(region).queryByText('Total comments')).not.toBeInTheDocument()
  })

  it('withholds malformed story counters instead of coercing them to zero', () => {
    render(<ResponseDemoPreview api={api} requestUrl={request()} executedRequest={executed()} data={{ ...story, score:'0', descendants:-1 }}/>)
    const region = screen.getByRole('region', { name: 'Hacker News API' })
    const card = region.querySelector('[data-domain-card="hacker-news-item"]')!
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(within(region).getAllByText('Unavailable').length).toBeGreaterThanOrEqual(2)
  })

  it('surfaces provider dead state without discarding trustworthy comment identity', () => {
    const dead = { by:'brett', dead:true, id:8876, parent:8863, text:'', time:1175716226, type:'comment' }
    render(<ResponseDemoPreview api={api} requestUrl={request('8876')} executedRequest={executed(request('8876'))} data={dead}/>)
    const region = screen.getByRole('region', { name: 'Hacker News API' })
    const card = region.querySelector('[data-domain-card="hacker-news-item"]')!
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-item-dead', 'true')
    expect(within(region).getByText('Dead')).toBeInTheDocument()
  })

  it('fails closed when the executed transport is not the supported bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={request()} executedRequest={executed(request(), 'POST')} data={story}/>)
    let region = screen.getByRole('region', { name: 'Hacker News API' })
    expect(region.querySelector('[data-domain-card="hacker-news-item"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={request()} executedRequest={executed(request(), 'GET', { unexpected: true })} data={story}/>)
    region = screen.getByRole('region', { name: 'Hacker News API' })
    expect(region.querySelector('[data-domain-card="hacker-news-item"]')).toHaveAttribute('data-result-state', 'invalid')
  })
})
