import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import { parseMetMuseumSearchRequest, parseMetMuseumSearchResponse } from './previews/MetMuseumSearchPreview'

const api = getApiById('met-museum-search')!
const requestUrl = api.buildUrl({})
const executedRequest = { url: requestUrl, method: 'GET' }
const response = (ids: unknown[], total = ids.length) => ({ total, objectIDs: ids })
const card = async () => (await screen.findByRole('region', { name: api.name })).querySelector('[data-domain-card="met-museum-search"]')

describe('Met Museum v1.1 collection search semantic preview', () => {
  it('uses the documented paginated v1.1 first-page request', () => {
    const url = new URL(requestUrl)
    expect(url.origin).toBe('https://collectionapi.metmuseum.org')
    expect(url.pathname).toBe('/public/collection/v1.1/search')
    expect([...url.searchParams.keys()]).toEqual(['hasImages', 'q', 'offset', 'limit'])
    expect(url.searchParams.get('hasImages')).toBe('true')
    expect(url.searchParams.get('q')).toBe('singapore')
    expect(url.searchParams.get('offset')).toBe('0')
    expect(url.searchParams.get('limit')).toBe('12')
    expect(parseMetMuseumSearchRequest(executedRequest)).toEqual({ query: 'singapore', hasImages: true, offset: 0, limit: 12, version: 'v1.1' })
  })

  it('fails closed for the retired v1 path, extra parameters, duplicate parameters, non-GET, and request bodies', () => {
    expect(parseMetMuseumSearchRequest({ url: requestUrl.replace('/v1.1/', '/v1/'), method: 'GET' })).toBeUndefined()
    expect(parseMetMuseumSearchRequest({ url: `${requestUrl}&foo=bar`, method: 'GET' })).toBeUndefined()
    expect(parseMetMuseumSearchRequest({ url: `${requestUrl}&limit=2`, method: 'GET' })).toBeUndefined()
    expect(parseMetMuseumSearchRequest({ url: requestUrl, method: 'POST' })).toBeUndefined()
    expect(parseMetMuseumSearchRequest({ url: requestUrl, method: 'GET', body: {} })).toBeUndefined()
  })

  it('renders only native unique provider object identities as ready for an exact request', async () => {
    const ids = [728323, 264585, 264600]
    render(<ResponseDemoPreview api={api} data={response(ids, 3)} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-endpoint-version', 'v1.1')
    expect(root).toHaveAttribute('data-request-query', 'singapore')
    expect(root).toHaveAttribute('data-request-limit', '12')
    expect(root).toHaveAttribute('data-provider-total', '3')
    expect(root).toHaveAttribute('data-provider-object-count', '3')
    expect(root).toHaveAttribute('data-valid-object-count', '3')
    expect(root).toHaveAttribute('data-primary-object-id', '728323')
    expect(root).toHaveTextContent('728323')
  })

  it('withholds numeric-string and duplicate identities as partial without inventing object metadata', async () => {
    render(<ResponseDemoPreview api={api} data={response([728323, '264585', 728323], 3)} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-valid-object-count', '1')
    expect(root).toHaveAttribute('data-malformed-object-count', '1')
    expect(root).toHaveAttribute('data-duplicate-object-count', '1')
    expect(root).toHaveTextContent('728323')
    expect(root).not.toHaveTextContent('264585')
  })

  it('maps a coherent request-bound zero result to empty and rejects count contradictions', async () => {
    const first = render(<ResponseDemoPreview api={api} data={response([], 0)} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'empty')
    first.unmount()

    const parsed = parseMetMuseumSearchResponse(response([728323], 20), executedRequest)
    expect(parsed.state).toBe('invalid')
    render(<ResponseDemoPreview api={api} data={response([728323], 20)} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    expect(await card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('never promotes an unbound HTTP-success-shaped payload to ready', async () => {
    render(<ResponseDemoPreview api={api} data={response([728323], 1)}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-request-bound', 'false')
  })
})
