import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById, validateParameters } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = getApiById('art-institute-search')!
const requestUrl = api.buildUrl({ query: 'monet', limit: '2' })
const artwork = (id: number, imageId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: 'Water Lilies',
  artist_title: 'Claude Monet',
  date_display: '1906',
  image_id: imageId,
  is_public_domain: true,
  ...overrides,
})
const response = (rows: unknown[], overrides: Record<string, unknown> = {}) => ({
  pagination: { total: rows.length, limit: 2, offset: 0, total_pages: rows.length ? 1 : 0, current_page: 1 },
  data: rows,
  config: { iiif_url: 'https://www.artic.edu/iiif/2' },
  ...overrides,
})
const card = async () => (await screen.findByRole('region', { name: api.name })).querySelector('[data-domain-card="art-institute-search"]')

describe('Art Institute public-domain semantic preview', () => {
  it('binds unique public-domain artwork and image identities to the exact search request', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={response([
      artwork(16568, '11111111-1111-1111-1111-111111111111'),
      artwork(81558, '22222222-2222-2222-2222-222222222222', { title: 'Stacks of Wheat' }),
    ])}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-query', 'monet')
    expect(root).toHaveAttribute('data-request-limit', '2')
    expect(root).toHaveAttribute('data-provider-total', '2')
    expect(root).toHaveAttribute('data-valid-artwork-count', '2')
    expect(root).toHaveAttribute('data-primary-artwork-id', '16568')
    expect(root).toHaveAttribute('data-primary-image-id', '11111111-1111-1111-1111-111111111111')
    expect(root).toHaveAttribute('data-primary-public-domain', 'true')
    expect(screen.getByRole('img', { name: 'Water Lilies' })).toHaveAttribute('src', 'https://www.artic.edu/iiif/2/11111111-1111-1111-1111-111111111111/full/843,/0/default.jpg')
    expect(root).toHaveTextContent('Claude Monet')
    expect(root).toHaveTextContent('Public domain')
  })

  it('fails closed when the executed Art Institute transport is not the exact bodyless GET shown to the user', async () => {
    const payload = response([artwork(16568, '11111111-1111-1111-1111-111111111111')])
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    expect(await card()).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: `${requestUrl}&drift=1`, method: 'GET' }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('keeps a coherent Art Institute response partial when executed request evidence is unavailable', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([artwork(16568, '11111111-1111-1111-1111-111111111111')])}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'partial')
    expect(await card()).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails closed for extra, duplicate, or altered request semantics', async () => {
    const payload = response([artwork(16568, '11111111-1111-1111-1111-111111111111')])
    const first = render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&foo=bar`} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    first.unmount()
    const second = render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&limit=1`} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    second.unmount()
    const altered = new URL(requestUrl)
    altered.searchParams.set('query[term][is_public_domain]', 'false')
    render(<ResponseDemoPreview api={api} requestUrl={altered.toString()} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds duplicate, rights-ambiguous, image-less, and malformed identities as partial', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([
      artwork(16568, '11111111-1111-1111-1111-111111111111'),
      artwork(16568, '22222222-2222-2222-2222-222222222222', { title: 'Duplicate artwork' }),
      artwork(81558, '33333333-3333-3333-3333-333333333333', { title: 'Rights ambiguous', is_public_domain: false }),
      artwork(81559, '', { title: 'Image unavailable' }),
    ], { pagination: { total: 4, limit: 2, offset: 0, total_pages: 2, current_page: 1 } })}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-valid-artwork-count', '1')
    expect(root).toHaveAttribute('data-duplicate-artwork-count', '1')
    expect(root).toHaveAttribute('data-rights-gap-count', '1')
    expect(root).toHaveAttribute('data-malformed-artwork-count', '2')
    expect(root).not.toHaveTextContent('Duplicate artwork')
    expect(root).not.toHaveTextContent('Rights ambiguous')
    expect(root).not.toHaveTextContent('Image unavailable')
  })

  it('maps a coherent request-bound zero-result response to empty', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={response([])}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'empty')
  })

  it('rejects malformed pagination, config, and native identity wire types', async () => {
    const row = artwork(16568, '11111111-1111-1111-1111-111111111111')
    const first = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([row], { pagination: { total: '1', limit: 2, offset: 0, total_pages: 1, current_page: 1 } })}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    first.unmount()
    const second = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([row], { config: { iiif_url: 'http://www.artic.edu/iiif/2' } })}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    second.unmount()
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([{ ...row, id: '16568' }])}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('exposes exact fields, public-domain filtering, and shared pre-network constraints without silent rewriting', () => {
    const url = new URL(requestUrl)
    expect(url.searchParams.get('q')).toBe('monet')
    expect(url.searchParams.get('limit')).toBe('2')
    expect(url.searchParams.get('fields')).toBe('id,title,artist_title,date_display,image_id,is_public_domain')
    expect(url.searchParams.get('query[term][is_public_domain]')).toBe('true')
    expect(api.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(api.fields.find((field) => field.id === 'limit')?.step).toBe(1)
    expect(validateParameters(api, { query: '   ', limit: '2' })).toHaveProperty('query')
    expect(validateParameters(api, { query: 'monet', limit: '2.5' })).toHaveProperty('limit')
    expect(validateParameters(api, { query: 'monet', limit: '0' })).toHaveProperty('limit')
    expect(validateParameters(api, { query: 'monet', limit: '21' })).toHaveProperty('limit')
    const malformed = new URL(api.buildUrl({ query: '   ', limit: '2.5' }))
    expect(malformed.searchParams.get('q')).toBe('')
    expect(malformed.searchParams.get('limit')).toBe('2.5')
  })
})
