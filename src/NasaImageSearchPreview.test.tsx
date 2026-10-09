import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = getApiById('nasa-image-search')!
const requestUrl = api.buildUrl({ query: 'moon', mediaType: 'image' })
const item = (id: string, overrides: Record<string, unknown> = {}) => ({
  data: [{
    nasa_id: id,
    title: `NASA media ${id}`,
    media_type: 'image',
    date_created: '2026-09-16T00:00:00Z',
    center: 'JSC',
    description: 'Verified NASA media description.',
    secondary_creator: 'NASA fixture creator',
  }],
  href: `https://images-assets.nasa.gov/image/${encodeURIComponent(id)}/collection.json`,
  links: [{ href: `https://images-assets.nasa.gov/image/${encodeURIComponent(id)}/${encodeURIComponent(id)}~thumb.jpg`, rel: 'preview', render: 'image' }],
  ...overrides,
})
const response = (items: unknown[], totalHits = items.length, href = 'http://images-api.nasa.gov/search?q=moon&media_type=image&page_size=8') => ({
  collection: { href, items, metadata: { total_hits: totalHits }, version: '1.0' },
})
const card = async () => (await screen.findByRole('region', { name: 'NASA Image & Video Library' })).querySelector('[data-domain-card="nasa-image-search"]')

describe('NASA Image and Video Library semantic preview', () => {
  it('binds trusted NASA media identities to the exact executed search', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={response([item('NASA-ONE'), item('NASA-TWO')], 2)}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-contract', 'exact-nasa-media-search-v2')
    expect(root).toHaveAttribute('data-request-media-type', 'image')
    expect(root).toHaveAttribute('data-valid-record-count', '2')
    expect(root).toHaveAttribute('data-primary-nasa-id', 'NASA-ONE')
    expect(root).toHaveTextContent('NASA media NASA-ONE')
    expect(root).toHaveTextContent('NASA fixture creator')
    expect(root).toHaveTextContent('Media Usage Guidelines')
  })

  it('fails closed when the NASA response came from a non-bodyless-GET executed transport', async () => {
    const payload = response([item('NASA-ONE')], 1)
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    expect(await card()).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl.replace('q=moon', 'q=mars'), method: 'GET' }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('keeps a structurally valid NASA response partial when executed request evidence is unavailable', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([item('NASA-ONE')], 1)}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'partial')
    expect(await card()).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails closed for extra, duplicate, or provider-echo request semantics', async () => {
    const payload = response([item('NASA-ONE')], 1)
    const first = render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&foo=bar`} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    first.unmount()
    const second = render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&page_size=2`} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    second.unmount()
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([item('NASA-ONE')], 1, 'http://images-api.nasa.gov/search?q=mars&media_type=image&page_size=8')}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds duplicate and media-type-mismatched provider identities as partial', async () => {
    const mismatched = item('NASA-BAD', { data: [{ nasa_id: 'NASA-BAD', title: 'Fabricated video', media_type: 'video' }], href: 'https://images-assets.nasa.gov/video/NASA-BAD/collection.json' })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={response([item('NASA-ONE'), item('NASA-ONE'), mismatched], 3)}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-valid-record-count', '1')
    expect(root).toHaveAttribute('data-duplicate-record-count', '1')
    expect(root).toHaveAttribute('data-malformed-record-count', '1')
    expect(root).not.toHaveTextContent('Fabricated video')
  })

  it('maps a coherent request-bound zero-result Collection+JSON response to empty', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={response([], 0)}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'empty')
  })

  it('exposes non-empty query validation without silently restoring the default', () => {
    expect(api.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    const built = new URL(api.buildUrl({ query: '   ', mediaType: 'image' }))
    expect(built.searchParams.get('q')).toBe('')
  })
})
