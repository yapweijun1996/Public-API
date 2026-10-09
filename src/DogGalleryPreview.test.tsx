import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { parseDogGalleryRequest, parseDogGalleryResponse } from './previews/DogGalleryPreview'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('dogs')!
const request = (count = 4): ExecutedRequestContext => ({
  method: 'GET',
  url: `https://dog.ceo/api/breeds/image/random/${count}`,
})
const image = (collection: string, filename: string) => `https://images.dog.ceo/breeds/${collection}/${filename}.jpg`
const response = (message: unknown[], status: unknown = 'success') => ({ message, status })

const card = async () => {
  const region = await screen.findByRole('region', { name: 'Dog Gallery' })
  return region.querySelector('[data-domain-card="dog-gallery"]') as HTMLElement
}

describe('Dog CEO exact-request-bound gallery semantics', () => {
  it('renders exactly requested native string identities as a ready gallery', async () => {
    const urls = [
      image('hound-afghan', 'n02088094_1003'),
      image('akita', 'An_Akita_Inu_resting'),
      image('terrier-border', 'n02093754_1122'),
      image('poodle-standard', 'n02113799_2280'),
    ]
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={response(urls)}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-contract', 'exact-dog-ceo-random-count-v1')
    expect(root).toHaveAttribute('data-requested-count', '4')
    expect(root).toHaveAttribute('data-count-contract', 'true')
    expect(root).toHaveAttribute('data-provider-image-count', '4')
    expect(root).toHaveAttribute('data-trusted-image-count', '4')
    expect(root).toHaveAttribute('data-malformed-image-count', '0')
    expect(root).toHaveAttribute('data-duplicate-image-count', '0')
    expect(root).toHaveAttribute('data-primary-image-identity', urls[0])
    expect(root).toHaveAttribute('data-primary-image-filename', 'n02088094_1003.jpg')
    expect(root).toHaveAttribute('data-primary-provider-collection', 'hound-afghan')
    expect(root).toHaveTextContent('hound / afghan')
    expect(root).toHaveTextContent('do not establish reuse rights for each photo')
    expect(within(root).getAllByRole('img')).toHaveLength(4)
    expect(within(root).getAllByRole('img')[0]).toHaveAttribute('src', urls[0])
  })

  it('accepts only the exact canonical bodyless GET request', () => {
    expect(parseDogGalleryRequest(request())).toEqual({ count: 4 })
    const rejected: ExecutedRequestContext[] = [
      { method: 'POST', url: request().url },
      { method: 'get', url: request().url },
      { method: 'GET', url: request().url, body: {} },
      { method: 'GET', url: `${request().url}?foo=bar` },
      { method: 'GET', url: `${request().url}/` },
      { method: 'GET', url: `${request().url}#gallery` },
      { method: 'GET', url: 'http://dog.ceo/api/breeds/image/random/4' },
      { method: 'GET', url: 'https://images.dog.ceo/api/breeds/image/random/4' },
      { method: 'GET', url: 'https://dog.ceo.example/api/breeds/image/random/4' },
      { method: 'GET', url: 'https://user:pass@dog.ceo/api/breeds/image/random/4' },
      { method: 'GET', url: 'https://dog.ceo:8443/api/breeds/image/random/4' },
      { method: 'GET', url: 'https://dog.ceo/api/breeds/image/random/04' },
      { method: 'GET', url: 'https://dog.ceo/api/breeds/image/random/0' },
      { method: 'GET', url: 'https://dog.ceo/api/breeds/image/random/11' },
      { method: 'GET', url: 'https://dog.ceo/api/breeds/image/random/2.5' },
    ]
    for (const candidate of rejected) expect(parseDogGalleryRequest(candidate), candidate.url).toBeUndefined()
  })

  it('withholds malformed and duplicate image values while preserving trusted evidence as partial', async () => {
    const trusted = image('akita', 'trusted')
    const payload = response([
      trusted,
      trusted,
      'https://images.dog.ceo/breeds/akita/fabricated.png',
      'https://evil.example/breeds/akita/hidden.jpg',
    ])
    expect(parseDogGalleryResponse(payload, request()).result).toMatchObject({
      providerImageCount: 4,
      malformedImageCount: 2,
      duplicateImageCount: 1,
      countContract: false,
    })
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={payload}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-trusted-image-count', '1')
    expect(root).toHaveAttribute('data-malformed-image-count', '2')
    expect(root).toHaveAttribute('data-duplicate-image-count', '1')
    expect(within(root).getAllByRole('img')).toHaveLength(1)
    expect(root.innerHTML).not.toContain('fabricated.png')
    expect(root.innerHTML).not.toContain('evil.example')
  })

  it('withholds over-limit identities and records a count contradiction', async () => {
    const admitted = [image('akita', 'one'), image('hound', 'two')]
    const overflow = image('terrier', 'fabricated-overflow')
    render(<ResponseDemoPreview api={api} executedRequest={request(2)} data={response([...admitted, overflow])}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-provider-image-count', '3')
    expect(root).toHaveAttribute('data-trusted-image-count', '2')
    expect(root).toHaveAttribute('data-overflow-image-count', '1')
    expect(root).toHaveAttribute('data-count-contract', 'false')
    expect(within(root).getAllByRole('img')).toHaveLength(2)
    expect(root.innerHTML).not.toContain('fabricated-overflow')
  })

  it('marks a short but trustworthy provider array partial rather than fabricating the requested count', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request(3)} data={response([image('akita', 'only')])}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-provider-image-count', '1')
    expect(root).toHaveAttribute('data-trusted-image-count', '1')
    expect(root).toHaveAttribute('data-count-contract', 'false')
  })

  it.each([
    ['empty success', response([])],
    ['provider error status', response([image('akita', 'hidden')], 'error')],
    ['non-native status', response([image('akita', 'hidden')], new String('success'))],
    ['non-array message', { status: 'success', message: image('akita', 'hidden') }],
    ['missing envelope', {}],
    ['array root', []],
    ['all malformed URLs', response([
      'http://images.dog.ceo/breeds/akita/insecure.jpg',
      'https://images.dog.ceo/breeds/akita/query.jpg?foo=bar',
      'https://images.dog.ceo:8443/breeds/akita/port.jpg',
      'https://user:pass@images.dog.ceo/breeds/akita/credentials.jpg',
    ])],
    ['non-native image values', response([1, null, {}, new String(image('akita', 'hidden'))])],
  ])('fails closed for an unusable success contract: %s', async (_label, payload) => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={payload}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(within(root).queryByRole('img')).not.toBeInTheDocument()
  })

  it('fails closed when the response is not bound to the admitted request', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={{ method: 'GET', url: `${request().url}?foo=bar` }} data={response([image('akita', 'hidden')])}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-request-bound', 'false')
    expect(root.innerHTML).not.toContain('hidden.jpg')
  })
})
