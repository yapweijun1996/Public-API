import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('openverse-search')!
const requestUrl = api.buildUrl({ query: 'space', contentType: 'image', limit: '2' })
const item = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: 'Space work',
  creator: 'Example creator',
  license: 'by',
  license_version: '4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  foreign_landing_url: `https://example.test/work/${id}`,
  url: `https://example.test/media/${id}.jpg`,
  thumbnail: `https://example.test/thumb/${id}.jpg`,
  source: 'example',
  provider: 'example',
  ...overrides,
})
const first = '11111111-1111-4111-8111-111111111111'
const second = '22222222-2222-4222-8222-222222222222'
const card = async () => (await screen.findByRole('region', { name: 'Openverse Media Search' })).querySelector('[data-domain-card="openverse-search"]')
const executedRequest = (url = requestUrl, method = 'GET', body?: unknown): ExecutedRequestContext => ({ url, method, body })

describe('Openverse search semantic preview', () => {
  it('binds trusted licensed media to the exact image request', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={{ page: 1, page_count: 1, page_size: 2, result_count: 2, results: [item(first), item(second)] }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-method', 'GET')
    expect(root).toHaveAttribute('data-request-media-type', 'image')
    expect(root).toHaveAttribute('data-valid-record-count', '2')
    expect(root).toHaveAttribute('data-primary-media-id', first)
    expect(root).toHaveTextContent('Verify the license and attribution requirements')
    expect(root).toHaveTextContent('Creator: Example creator')
  })

  it('supports the declared audio path without requiring nullable title or creator metadata', async () => {
    const audioUrl = api.buildUrl({ query: 'space', contentType: 'audio', limit: '1' })
    render(<ResponseDemoPreview api={api} requestUrl={audioUrl} executedRequest={executedRequest(audioUrl)} data={{ page: 1, page_count: 1, page_size: 1, result_count: 1, results: [item(first, { title: null, creator: null, thumbnail: null, url: 'https://example.test/media/audio.mp3' })] }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-media-type', 'audio')
    expect(root).toHaveTextContent('Untitled Openverse work')
    expect(root).toHaveTextContent('Creator metadata unavailable')
  })

  it('fails closed for extra, duplicate, or non-native pagination semantics', async () => {
    const payload = { page: 1, page_count: 1, page_size: 2, result_count: 1, results: [item(first)] }
    const firstRender = render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&foo=bar`} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    firstRender.unmount()
    const duplicateRender = render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&page_size=1`} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    duplicateRender.unmount()
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ ...payload, page_size: '2' }}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds malformed, duplicate, and license-gap identities as partial', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ page: 1, page_count: 2, page_size: 2, result_count: 3, results: [
      item(first),
      item(first, { title: 'Duplicate work' }),
      item(second, { title: 'Fabricated no license', license: null }),
    ] }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-valid-record-count', '1')
    expect(root).toHaveAttribute('data-duplicate-record-count', '1')
    expect(root).toHaveAttribute('data-malformed-record-count', '1')
    expect(root).not.toHaveTextContent('Fabricated no license')
  })

  it('maps coherent request-bound zero results to empty', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest()} data={{ page: 1, page_count: 0, page_size: 2, result_count: 0, results: [] }}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'empty')
  })

  it('does not mark canonical displayed URLs ready without the exact successful bodyless GET execution', async () => {
    const payload = { page: 1, page_count: 1, page_size: 2, result_count: 2, results: [item(first), item(second)] }
    for (const request of [
      executedRequest(requestUrl, 'POST'),
      executedRequest(requestUrl, 'GET', { q: 'space' }),
      executedRequest(`${requestUrl}&page=1`),
      undefined,
    ]) {
      const view = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={request} data={payload}/>)
      expect(await card()).not.toHaveAttribute('data-result-state', 'ready')
      expect(await card()).toHaveAttribute('data-request-bound', 'false')
      view.unmount()
    }
  })

  it('exposes non-empty query and integer limit constraints without silent fallback', () => {
    expect(api.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(api.fields.find((field) => field.id === 'limit')?.step).toBe(1)
    const built = new URL(api.buildUrl({ query: '   ', contentType: 'image', limit: '2.5' }))
    expect(built.searchParams.get('q')).toBe('')
    expect(built.searchParams.get('page_size')).toBe('2.5')
  })
})
