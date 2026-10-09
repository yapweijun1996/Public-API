import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = getApiById('wikimedia-commons-search')!
const requestUrl = api.buildUrl({ query: 'Singapore skyline', limit: '2' })
const executedGet = { url: requestUrl, method: 'GET' as const }
const page = (pageid: number, index: number, title: string, overrides: Record<string, unknown> = {}) => ({
  pageid, ns: 6, index, title,
  imageinfo: [{
    url: `https://upload.wikimedia.org/example/${pageid}.jpg`,
    thumburl: `https://upload.wikimedia.org/example/${pageid}-thumb.jpg`,
    descriptionurl: `https://commons.wikimedia.org/wiki/File:${pageid}.jpg`,
    extmetadata: {
      LicenseShortName: { value: 'CC BY-SA 4.0' },
      LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
      Artist: { value: '<b>Example Artist</b>' },
      AttributionRequired: { value: 'true' },
    },
  }],
  ...overrides,
})
const card = async () => (await screen.findByRole('region', { name: 'Wikimedia Commons Search' })).querySelector('[data-domain-card="wikimedia-commons-search"]')

describe('Wikimedia Commons search semantic preview', () => {
  it('binds trusted files to the exact request and license identity', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ batchcomplete: '', query: { pages: { 10: page(10, 1, 'File:One.jpg'), 20: page(20, 2, 'File:Two.jpg') } } }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-valid-record-count', '2')
    expect(root).toHaveAttribute('data-primary-page-id', '10')
    expect(root).toHaveTextContent('CC BY-SA 4.0')
    expect(root).toHaveTextContent('Example Artist')
  })

  it('fails closed when the successful payload came from transport drift', async () => {
    const payload = { batchcomplete: '', query: { pages: { 10: page(10, 1, 'File:One.jpg') } } }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    expect(await card()).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: `${requestUrl}#drift`, method: 'GET' }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('keeps a coherent response partial when executed transport identity is unavailable', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ batchcomplete: '', query: { pages: { 10: page(10, 1, 'File:One.jpg') } } }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails closed for extra or duplicate request semantics', async () => {
    const { unmount } = render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&foo=bar`} data={{ batchcomplete: '', query: { pages: { 10: page(10, 1, 'File:One.jpg') } } }}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    unmount()
    render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&gsrlimit=1`} data={{ batchcomplete: '', query: { pages: { 10: page(10, 1, 'File:One.jpg') } } }}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds malformed and duplicate provider identities as partial', async () => {
    const noLicense = { imageinfo: [{ url: 'https://upload.wikimedia.org/example/12.jpg', thumburl: 'https://upload.wikimedia.org/example/12-thumb.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:12.jpg', extmetadata: {} }] }
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ batchcomplete: '', query: { pages: {
      10: page(10, 1, 'File:One.jpg'), 11: page(10, 2, 'File:Duplicate.jpg'), 12: page(12, 3, 'File:No-license.jpg', noLicense),
    } } }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-valid-record-count', '1')
    expect(root).toHaveAttribute('data-duplicate-record-count', '1')
    expect(root).toHaveAttribute('data-malformed-record-count', '1')
    expect(root).not.toHaveTextContent('No-license')
  })

  it('treats the completed no-query envelope as empty', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ batchcomplete: '' }}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'empty')
  })

  it('exposes non-empty query and integer limit constraints without silent fallback', () => {
    expect(api.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(api.fields.find((field) => field.id === 'limit')?.step).toBe(1)
    const built = new URL(api.buildUrl({ query: '   ', limit: '2.5' }))
    expect(built.searchParams.get('gsrsearch')).toBe('')
    expect(built.searchParams.get('gsrlimit')).toBe('2.5')
  })
})
