import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById, validateParameters } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = getApiById('wikipedia-search')!
const requestUrl = api.buildUrl({ query: 'Singapore', limit: '2' })
const executedGet = { url: requestUrl, method: 'GET' as const }
const page = (pageid: number, index: number, title: string, overrides: Record<string, unknown> = {}) => ({
  pageid,
  ns: 0,
  index,
  title,
  extract: `${title} is an encyclopedia article.`,
  thumbnail: {
    source: `https://upload.wikimedia.org/example/${pageid}.jpg`,
    width: 480,
    height: 320,
  },
  ...overrides,
})
const card = async () => (await screen.findByRole('region', { name: 'Wikipedia Search' })).querySelector('[data-domain-card="wikipedia-search"]')

describe('Wikipedia search semantic preview', () => {
  it('binds trusted article identities to the exact executed search request', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ batchcomplete: '', query: { pages: { 1: page(27318, 1, 'Singapore'), 2: page(57011, 2, 'Economy of Singapore') } } }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-valid-record-count', '2')
    expect(root).toHaveAttribute('data-primary-page-id', '27318')
    expect(root).toHaveTextContent('Singapore')
    expect(root).toHaveTextContent('encyclopedia article')
    expect(root).toHaveTextContent('Image licensing varies by file')
  })

  it('fails closed when the successful payload came from transport drift', async () => {
    const payload = { batchcomplete: '', query: { pages: { 1: page(27318, 1, 'Singapore') } } }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    expect(await card()).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: `${requestUrl}#drift`, method: 'GET' }} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('keeps a coherent response partial when executed transport identity is unavailable', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ batchcomplete: '', query: { pages: { 1: page(27318, 1, 'Singapore') } } }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails closed for extra or duplicate request semantics', async () => {
    const payload = { batchcomplete: '', query: { pages: { 1: page(27318, 1, 'Singapore') } } }
    const { unmount } = render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&foo=bar`} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
    unmount()
    render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&gsrlimit=1`} data={payload}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds malformed and duplicate provider identities as partial', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ batchcomplete: '', query: { pages: {
      1: page(27318, 1, 'Singapore'),
      2: page(27318, 2, 'Fabricated duplicate'),
      3: page(99, 3, 'Fabricated numeric-string identity', { pageid: '99' }),
    } } }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-valid-record-count', '1')
    expect(root).toHaveAttribute('data-duplicate-record-count', '1')
    expect(root).toHaveAttribute('data-malformed-record-count', '1')
    expect(root).not.toHaveTextContent('Fabricated duplicate')
    expect(root).not.toHaveTextContent('Fabricated numeric-string identity')
  })

  it('treats the completed no-query envelope as empty', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ batchcomplete: '' }}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'empty')
  })

  it('keeps article identity while withholding malformed optional evidence', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ query: { pages: {
      1: page(27318, 1, 'Singapore', { extract: 42, thumbnail: { source: 'http://insecure.example/image.jpg' } }),
    } } }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-valid-record-count', '1')
    expect(root).toHaveAttribute('data-malformed-record-count', '1')
    expect(root).toHaveTextContent('Article extract unavailable')
    expect(root).toHaveTextContent('Thumbnail unavailable')
    expect(root?.querySelector('img')).toBeNull()
  })

  it('fails closed when every returned page identity is malformed', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{ query: { pages: {
      1: page(0, 1, 'Not a trusted page'),
      2: page(27318, 0, 'No search index'),
    } } }}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-provider-record-count', '2')
    expect(root).toHaveAttribute('data-valid-record-count', '0')
    expect(root).not.toHaveTextContent('Not a trusted page')
  })

  it('exposes fail-closed field constraints and browser-compatible Wikimedia identification', () => {
    expect(api.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(api.fields.find((field) => field.id === 'limit')?.step).toBe(1)
    expect(validateParameters(api, { query: '   ', limit: '2' })).toHaveProperty('query')
    expect(validateParameters(api, { query: 'Singapore', limit: '2.5' })).toHaveProperty('limit')
    expect(api.headers?.['Api-User-Agent']).toContain('yapweijun1996.github.io/Public-API')
    const built = new URL(api.buildUrl({ query: '   ', limit: '2.5' }))
    expect(built.searchParams.get('gsrsearch')).toBe('')
    expect(built.searchParams.get('gsrlimit')).toBe('2.5')
  })
})
