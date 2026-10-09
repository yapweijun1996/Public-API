import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { PoetryDbPreview } from './previews/PoetryDbPreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('poetrydb-poems')
if (!api) throw new Error('Missing poetrydb-poems fixture')

const requestUrl = api.buildUrl({ author: 'Emily Dickinson', count: '3' })
const executedGet: ExecutedRequestContext = { method: 'GET', url: requestUrl }
const poem = (overrides: Record<string, unknown> = {}) => ({
  title: 'A bounded poem',
  author: 'Emily Dickinson',
  lines: ['A first line', '', 'A second line'],
  linecount: '3',
  ...overrides,
})
const preview = (data: unknown, url = requestUrl, executedRequest: ExecutedRequestContext | undefined = executedGet) => (
  <PoetryDbPreview api={api} data={data} requestUrl={url} executedRequest={executedRequest}/>
)

afterEach(cleanup)

describe('PoetryDB request-bound semantic preview', () => {
  it('renders provider poems only for the exact executed author/count request', () => {
    const { container } = render(preview([poem({ title: 'Hope is the thing with feathers', linecount: 3 }), poem({ title: 'Because I could not stop for Death', linecount: 3 }), poem({ title: 'I heard a Fly buzz', linecount: 3 })]))
    const card = container.querySelector('[data-domain-card="poetrydb-poems"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-author', 'Emily Dickinson')
    expect(card).toHaveAttribute('data-requested-count', '3')
    expect(card).toHaveAttribute('data-provider-count', '3')
    expect(card).toHaveAttribute('data-valid-poem-count', '3')
    expect(card).toHaveTextContent('Hope is the thing with feathers')
    expect(card).toHaveTextContent('3 lines')
  })

  it('fails closed when request evidence is absent, non-GET, or drifted', () => {
    const { container, rerender } = render(<PoetryDbPreview api={api} data={[poem()]} requestUrl={requestUrl}/>)
    let card = container.querySelector('[data-domain-card="poetrydb-poems"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).not.toHaveAttribute('data-request-bound', 'true')

    rerender(preview([poem()], requestUrl, { method: 'POST', url: requestUrl }))
    card = container.querySelector('[data-domain-card="poetrydb-poems"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('A bounded poem')

    const wrongUrl = api.buildUrl({ author: 'William Shakespeare', count: '3' })
    rerender(preview([poem()], requestUrl, { method: 'GET', url: wrongUrl }))
    card = container.querySelector('[data-domain-card="poetrydb-poems"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds wrong-author and malformed rows instead of treating them as selected poems', () => {
    const { container } = render(preview([
      poem({ title: 'Trusted poem' }),
      poem({ title: 'Wrong author poem', author: 'William Shakespeare' }),
      poem({ title: 'Malformed poem', linecount: 'not-a-count' }),
    ]))
    const card = container.querySelector('[data-domain-card="poetrydb-poems"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-count', '3')
    expect(card).toHaveAttribute('data-valid-poem-count', '1')
    expect(card).toHaveAttribute('data-invalid-poem-count', '2')
    expect(card).toHaveTextContent('Trusted poem')
    expect(card).not.toHaveTextContent('Wrong author poem')
    expect(card).not.toHaveTextContent('Malformed poem')
  })

  it('does not call a coherent empty or under-count response ready', () => {
    const { container, rerender } = render(preview([]))
    let card = container.querySelector('[data-domain-card="poetrydb-poems"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-request-bound', 'true')

    rerender(preview([poem()]))
    card = container.querySelector('[data-domain-card="poetrydb-poems"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-count-match', 'false')
  })
})
