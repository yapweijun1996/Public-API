import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = getApiById('cleveland-museum-search')!
const requestUrl = api.buildUrl({ query: 'monet', limit: '2' })
const artwork = (id: number, accessionNumber: string, overrides: Record<string, unknown> = {}) => ({
  id,
  accession_number: accessionNumber,
  title: 'Water Lilies',
  creation_date: '1914–17',
  share_license_status: 'CC0',
  url: `https://clevelandart.org/art/${encodeURIComponent(accessionNumber)}`,
  creators: [{ id: 1844, description: 'Claude Monet (French, 1840–1926)', role: 'artist' }],
  images: { web: { url: `https://openaccess-cdn.clevelandart.org/${encodeURIComponent(accessionNumber)}/${encodeURIComponent(accessionNumber)}_web.jpg` } },
  ...overrides,
})
const response = (rows: unknown[], overrides: Record<string, unknown> = {}) => ({
  info: { total: rows.length, parameters: { skip: 0, limit: 2, q: 'monet', search: 'monet', cc0: '', has_image: '1' } },
  data: rows,
  ...overrides,
})
const card = async () => (await screen.findByRole('region', { name: api.name })).querySelector('[data-domain-card="cleveland-museum-search"]')

describe('Cleveland Museum Open Access semantic preview', () => {
  it('binds unique CC0 artwork identities to the exact image-bearing request', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={response([artwork(135382, '1958.39'), artwork(111111, '1960.1')])}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-query', 'monet')
    expect(root).toHaveAttribute('data-request-limit', '2')
    expect(root).toHaveAttribute('data-valid-artwork-count', '2')
    expect(root).toHaveAttribute('data-primary-accession-number', '1958.39')
    expect(root).toHaveAttribute('data-primary-license', 'CC0')
    expect(root).toHaveTextContent('Claude Monet')
    expect(root).toHaveTextContent('CC0')
  })

  it('fails closed when the executed Cleveland Museum transport is not the exact bodyless GET shown to the user', async () => {
    const payload = response([artwork(135382, '1958.39')], { info: { total: 1, parameters: { skip: 0, limit: 2, q: 'monet', search: 'monet', cc0: '', has_image: '1' } } })
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    expect(await card()).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: `${requestUrl}&drift=1`, method: 'GET' }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('keeps a coherent Cleveland Museum response partial when executed request evidence is unavailable', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([artwork(135382, '1958.39')], { info: { total: 1, parameters: { skip: 0, limit: 2, q: 'monet', search: 'monet', cc0: '', has_image: '1' } } })}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'partial')
    expect(await card()).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails closed for extra or duplicate request semantics', async () => {
    const payload = response([artwork(135382, '1958.39')], { info: { total: 1, parameters: { skip: 0, limit: 2, q: 'monet', search: 'monet', cc0: '', has_image: '1' } } })
    const first = render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&foo=bar`} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    first.unmount()
    render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&limit=1`} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds duplicate, non-CC0, or image-less artwork identities as partial', async () => {
    const valid = artwork(135382, '1958.39')
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([
      valid,
      artwork(135383, '1958.39', { title: 'Duplicate accession' }),
      artwork(135384, '1962.1', { title: 'Fabricated copyrighted work', share_license_status: 'Copyrighted' }),
      artwork(135385, '1963.1', { title: 'Fabricated image-less work', images: null }),
    ], { info: { total: 4, parameters: { skip: 0, limit: 2, q: 'monet', search: 'monet', cc0: '', has_image: '1' } } })}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-valid-artwork-count', '1')
    expect(root).toHaveAttribute('data-duplicate-artwork-count', '1')
    expect(root).not.toHaveTextContent('Fabricated copyrighted work')
    expect(root).not.toHaveTextContent('Fabricated image-less work')
  })

  it('maps a coherent request-bound zero-result response to empty', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={response([], { info: { total: 0, parameters: { skip: 0, limit: 2, q: 'monet', search: 'monet', cc0: '', has_image: '1' } } })}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'empty')
  })

  it('exposes non-empty query and integer result constraints without silent fallback', () => {
    expect(api.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(api.fields.find((field) => field.id === 'limit')?.step).toBe(1)
    const built = new URL(api.buildUrl({ query: '   ', limit: '2.5' }))
    expect(built.searchParams.get('q')).toBe('')
    expect(built.searchParams.get('limit')).toBe('2.5')
    expect(built.searchParams.get('has_image')).toBe('1')
    expect(built.searchParams.has('cc0')).toBe(true)
  })
})
