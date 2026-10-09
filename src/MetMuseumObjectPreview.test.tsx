import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import { parseMetMuseumObjectRequest, parseMetMuseumObjectResponse } from './previews/MetMuseumObjectPreview'

const api = getApiById('met-museum-object-detail')!
const requestUrl = api.buildUrl({})
const executedRequest = { url: requestUrl, method: 'GET' }
const base = (overrides: Record<string, unknown> = {}) => ({
  objectID: 436535,
  accessionNumber: '1993.132',
  isPublicDomain: true,
  primaryImage: 'https://images.metmuseum.org/CRDImages/ep/original/DP-42549-001.jpg',
  primaryImageSmall: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg',
  title: 'Wheat Field with Cypresses',
  artistDisplayName: 'Vincent van Gogh',
  objectDate: '1889',
  medium: 'Oil on canvas',
  dimensions: '28 13/16 × 36 3/4 in. (73.2 × 93.4 cm)',
  classification: 'Paintings',
  creditLine: 'Purchase, The Annenberg Foundation Gift, 1993',
  rightsAndReproduction: '',
  objectURL: 'https://www.metmuseum.org/art/collection/search/436535',
  ...overrides,
})
const card = async () => (await screen.findByRole('region', { name: api.name })).querySelector('[data-domain-card="met-museum-object-detail"]')

describe('Met Museum object detail semantic preview', () => {
  it('accepts only the exact bodyless GET for object 436535', () => {
    expect(parseMetMuseumObjectRequest(executedRequest)).toEqual({ objectId: 436535 })
    expect(parseMetMuseumObjectRequest({ url: `${requestUrl}?foo=bar`, method: 'GET' })).toBeUndefined()
    expect(parseMetMuseumObjectRequest({ url: `${requestUrl}/`, method: 'GET' })).toBeUndefined()
    expect(parseMetMuseumObjectRequest({ url: requestUrl, method: 'POST' })).toBeUndefined()
    expect(parseMetMuseumObjectRequest({ url: requestUrl, method: 'GET', body: {} })).toBeUndefined()
  })

  it('renders the exact public-domain object as request-bound Open Access evidence', async () => {
    render(<ResponseDemoPreview api={api} data={base()} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-contract', 'exact-met-object-436535')
    expect(root).toHaveAttribute('data-object-id', '436535')
    expect(root).toHaveAttribute('data-accession-number', '1993.132')
    expect(root).toHaveAttribute('data-public-domain', 'true')
    expect(root).toHaveAttribute('data-open-access-image', 'true')
    expect(root).toHaveAttribute('data-rights-conflict', 'false')
    expect(root?.querySelectorAll('img')).toHaveLength(1)
    expect(root).toHaveTextContent('CC0')
    expect(root).toHaveTextContent('Vincent van Gogh')
  })

  it('fails closed for wrong/native-string object identity and rights contradictions', () => {
    expect(parseMetMuseumObjectResponse(base({ objectID: 436536 }), executedRequest).state).toBe('invalid')
    expect(parseMetMuseumObjectResponse(base({ objectID: '436535' }), executedRequest).state).toBe('invalid')
    const conflict = parseMetMuseumObjectResponse(base({ rightsAndReproduction: '© Fabricated rights holder' }), executedRequest)
    expect(conflict.state).toBe('invalid')
    expect(conflict.result?.rightsConflict).toBe(true)
    expect(conflict.result?.openAccessImage).toBe(false)
  })

  it('does not embed restricted imagery or claim reusable image rights', async () => {
    render(<ResponseDemoPreview api={api} data={base({ isPublicDomain: false, rightsAndReproduction: '© Rights holder' })} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-public-domain', 'false')
    expect(root).toHaveAttribute('data-open-access-image', 'false')
    expect(root?.querySelectorAll('img')).toHaveLength(0)
    expect(root).toHaveTextContent('does not claim reusable artwork-image rights')
  })

  it('withholds malformed optional image evidence and marks the card partial', async () => {
    render(<ResponseDemoPreview api={api} data={base({ primaryImage: 'http://example.com/fabricated.jpg', artistDisplayName: 123 })} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-image-malformed-count', '1')
    expect(root).toHaveAttribute('data-optional-malformed-count', '1')
    expect(root).toHaveAttribute('data-open-access-image', 'true')
    expect(root?.querySelector('img')).toHaveAttribute('src', 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg')
  })

  it('never promotes an unbound HTTP-success-shaped object to ready', async () => {
    render(<ResponseDemoPreview api={api} data={base()}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-request-bound', 'false')
  })
})
