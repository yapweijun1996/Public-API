import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import { parseScryfallRequest, parseScryfallResponse } from './previews/ScryfallCardSearchPreview'

const api = getApiById('scryfall-card-search')!
const requestUrl = api.buildUrl({ query: 'dragon' })
const executedRequest = { url: requestUrl, method: 'GET' }
const firstId = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'
const card = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  object: 'card',
  name: 'Dragon Adept',
  type_line: 'Creature — Dragon',
  set: 'tst',
  set_name: 'Fixture Set',
  collector_number: '1',
  scryfall_uri: `https://scryfall.com/card/tst/1/${id}`,
  image_uris: { normal: `https://cards.scryfall.io/normal/front/${id}.jpg` },
  ...overrides,
})
const list = (data: unknown[], overrides: Record<string, unknown> = {}) => ({ object: 'list', total_cards: data.length, has_more: false, data, ...overrides })
const resultCard = async () => (await screen.findByRole('region', { name: 'Scryfall Card Search' })).querySelector('[data-domain-card="scryfall-card-search"]')

describe('Scryfall card search semantic preview', () => {
  it('binds native list/card data to the exact request and renders only the first eight cards', async () => {
    const cards = Array.from({ length: 9 }, (_, index) => card(index === 0 ? firstId : `${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`))
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={list(cards)}/>)
    const root = await resultCard()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-query', 'dragon')
    expect(root).toHaveAttribute('data-provider-total-cards', '9')
    expect(root).toHaveAttribute('data-provider-card-count', '9')
    expect(root).toHaveAttribute('data-valid-card-count', '9')
    expect(root?.querySelectorAll('[data-card-id]')).toHaveLength(8)
    expect(root).toHaveTextContent('Dragon Adept')
    expect(root).toHaveTextContent('Fixture Set')
  })

  it('accepts a valid multiface image fallback and request-bound continuation', async () => {
    const nextPage = 'https://api.scryfall.com/cards/search?page=2&q=dragon'
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={list([card(firstId, { image_uris: undefined, card_faces: [{ image_uris: { normal: 'https://cards.scryfall.io/normal/front/face.jpg' } }] })], { total_cards: 297, has_more: true, next_page: nextPage })}/>)
    const root = await resultCard()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-next-page-bound', 'true')
    expect(root).toHaveAttribute('data-primary-card-id', firstId)
    expect(root).toHaveTextContent('Open Scryfall next page')
  })

  it('fails closed for blank, extra, duplicate, and non-Scryfall requests', async () => {
    expect(parseScryfallRequest(requestUrl)).toEqual({ query: 'dragon' })
    expect(parseScryfallRequest('https://api.scryfall.com/cards/search?q=')).toBeUndefined()
    expect(parseScryfallRequest(`${requestUrl}&foo=bar`)).toBeUndefined()
    expect(parseScryfallRequest(`${requestUrl}&q=angel`)).toBeUndefined()
    expect(parseScryfallRequest('https://example.com/cards/search?q=dragon')).toBeUndefined()
    expect(parseScryfallResponse(list([card(firstId)], { total_cards: '1' }), requestUrl, executedRequest).result).toBeUndefined()
    expect(parseScryfallResponse(list([card(firstId)], { has_more: 'false' }), requestUrl, executedRequest).result).toBeUndefined()
    render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&q=angel`} data={list([card(firstId)])}/>)
    expect(await resultCard()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('requires exact executed transport evidence before claiming request-bound readiness', async () => {
    const body = list([card(firstId)])
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={body}/>)
    let root = await resultCard()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-request-bound', 'false')
    expect(root).toHaveAttribute('data-request-contract', 'exact-scryfall-card-search-v2')
    expect(root).toHaveTextContent('executed request evidence was unavailable')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={body}/>)
    root = await resultCard()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { q: 'dragon' } }} data={body}/>)
    root = await resultCard()
    expect(root).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: api.buildUrl({ query: 'angel' }), method: 'GET' }} data={body}/>)
    root = await resultCard()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds malformed, duplicate, and image-gap cards while exposing full-page counts', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={list([
      card(firstId),
      card(firstId, { name: 'Duplicate card' }),
      card(secondId, { image_uris: { normal: 'https://example.com/not-scryfall.jpg' } }),
      card('33333333-3333-4333-8333-333333333333', { collector_number: 7 }),
    ])}/>)
    const root = await resultCard()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-provider-card-count', '4')
    expect(root).toHaveAttribute('data-valid-card-count', '1')
    expect(root).toHaveAttribute('data-duplicate-card-count', '1')
    expect(root).toHaveAttribute('data-image-gap-count', '1')
    expect(root).toHaveAttribute('data-malformed-card-count', '1')
    expect(root).not.toHaveTextContent('Duplicate card')
  })

  it('maps a coherent zero-result list to empty', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={list([])}/>)
    expect(await resultCard()).toHaveAttribute('data-result-state', 'empty')
  })

  it('maps provider warnings to partial without inventing card data', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={list([card(firstId)], { warnings: ['Fixture warning'] })}/>)
    const root = await resultCard()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-warning-count', '1')
    expect(root).toHaveTextContent('Fixture warning')
  })
})
