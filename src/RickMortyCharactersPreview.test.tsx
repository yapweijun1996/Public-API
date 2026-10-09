import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { RickMortyCharactersPreview, parseRickMortyCharactersRequest, parseRickMortyCharactersResponse } from './previews/RickMortyCharactersPreview'

const api = getApiById('rick-morty-characters')!
const requestUrl = api.buildUrl({ name: 'Rick', status: 'alive' })
const executedRequest = { url: requestUrl, method: 'GET' }

const character = (id = 1, overrides: Record<string, unknown> = {}) => ({
  id,
  name: id === 1 ? 'Rick Sanchez' : `Rick Variant ${id}`,
  status: 'Alive',
  species: 'Human',
  type: '',
  gender: 'Male',
  origin: { name: 'Earth (C-137)', url: 'https://rickandmortyapi.com/api/location/1' },
  location: { name: 'Citadel of Ricks', url: 'https://rickandmortyapi.com/api/location/3' },
  image: `https://rickandmortyapi.com/api/character/avatar/${id}.jpeg`,
  episode: ['https://rickandmortyapi.com/api/episode/1', 'https://rickandmortyapi.com/api/episode/2'],
  url: `https://rickandmortyapi.com/api/character/${id}`,
  created: '2017-11-04T18:48:46.250Z',
  ...overrides,
})

const envelope = (results: unknown[], count = results.length) => ({
  info: { count, pages: Math.ceil(count / 20), next: null, prev: null },
  results,
})

describe('Rick and Morty exact-request-bound character semantics', () => {
  it('renders provider identity, character facts, episode evidence, and rights boundary from one trusted model', () => {
    const data = envelope([character()])
    expect(parseRickMortyCharactersResponse(data, requestUrl, executedRequest).result).toMatchObject({
      providerCount: 1,
      providerPages: 1,
      providerRecordCount: 1,
      trustedRecordCount: 1,
      malformedEvidenceCount: 0,
      duplicateEvidenceCount: 0,
      filterMismatchCount: 0,
    })
    render(<RickMortyCharactersPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const card = screen.getByText('Characters matching “Rick”').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-character-query', 'Rick')
    expect(card).toHaveAttribute('data-status-filter', 'alive')
    expect(card).toHaveAttribute('data-primary-character-id', '1')
    expect(card).toHaveTextContent('Earth (C-137)')
    expect(card).toHaveTextContent('Citadel of Ricks')
    expect(card).toHaveTextContent('Episodes2')
    expect(card).toHaveTextContent('belong to their respective owners')
    expect(screen.getByRole('img', { name: 'Rick Sanchez character portrait' })).toHaveAttribute('src', 'https://rickandmortyapi.com/api/character/avatar/1.jpeg')
    expect(screen.getByRole('link', { name: 'Open Rick Sanchez in the Rick and Morty API' })).toHaveAttribute('href', 'https://rickandmortyapi.com/api/character/1')
  })

  it('accepts only the exact admitted name/status request and rejects provider-tolerated variants', () => {
    expect(parseRickMortyCharactersRequest(requestUrl)).toEqual({ name: 'Rick', status: 'alive' })
    expect(parseRickMortyCharactersRequest(api.buildUrl({ name: 'Rick', status: 'all' }))).toEqual({ name: 'Rick' })
    expect(parseRickMortyCharactersRequest(`${requestUrl}&foo=bar`)).toBeUndefined()
    expect(parseRickMortyCharactersRequest(`${requestUrl}&name=Morty`)).toBeUndefined()
    expect(parseRickMortyCharactersRequest('https://rickandmortyapi.com/api/character/?name=Rick&status=alive')).toBeUndefined()
    expect(parseRickMortyCharactersRequest('https://user:pass@rickandmortyapi.com/api/character?name=Rick&status=alive')).toBeUndefined()
    expect(parseRickMortyCharactersRequest('https://rickandmortyapi.com:8443/api/character?name=Rick&status=alive')).toBeUndefined()
    expect(parseRickMortyCharactersRequest('https://rickandmortyapi.com/api/character?name=%20Rick%20&status=alive')).toBeUndefined()
    expect(parseRickMortyCharactersRequest('https://rickandmortyapi.com/api/character?name=Rick&status=Alive')).toBeUndefined()
  })

  it('maps a coherent exact-request empty envelope to empty', () => {
    render(<RickMortyCharactersPreview data={envelope([], 0)} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    expect(screen.getByText('No characters matched').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'empty')
  })

  it('requires exact bodyless GET execution evidence before reporting request-bound results', () => {
    const data = envelope([character()])
    const withoutExecution = parseRickMortyCharactersResponse(data, requestUrl)
    expect(withoutExecution.transportBound).toBe(false)
    render(<RickMortyCharactersPreview data={data} requestUrl={requestUrl}/>)
    const partial = screen.getByText('Characters matching “Rick”').closest('[data-domain-card]')
    expect(partial).toHaveAttribute('data-result-state', 'partial')
    expect(partial).toHaveAttribute('data-request-bound', 'false')

    for (const conflict of [
      { url: requestUrl, method: 'POST' },
      { url: requestUrl, method: 'GET', body: { unexpected: true } },
      { url: api.buildUrl({ name: 'Morty', status: 'alive' }), method: 'GET' },
    ]) {
      document.body.innerHTML = ''
      render(<RickMortyCharactersPreview data={data} requestUrl={requestUrl} executedRequest={conflict}/>)
      const invalid = screen.getByText('Invalid character-search response').closest('[data-domain-card]')
      expect(invalid).toHaveAttribute('data-result-state', 'invalid')
      expect(invalid).toHaveAttribute('data-request-bound', 'false')
    }
  })

  it('fails closed for pagination contradictions and batches without trustworthy identity', () => {
    expect(parseRickMortyCharactersResponse({ info: { count: 1, pages: 1, next: null, prev: null }, results: [] }, requestUrl, executedRequest).result).toBeUndefined()
    expect(parseRickMortyCharactersResponse({ info: { count: 21, pages: 2, next: 'https://rickandmortyapi.com/api/character?page=2&name=Morty&status=alive', prev: null }, results: Array.from({ length: 20 }, (_, index) => character(index + 1)) }, requestUrl, executedRequest).result).toBeUndefined()
    const malformed = envelope([character(1, { id: '1' })])
    render(<RickMortyCharactersPreview data={malformed} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    expect(screen.getByText('No trustworthy character identities').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds duplicate, filter-mismatched, and malformed identities and marks mixed evidence partial', () => {
    const data = envelope([
      character(1),
      character(1, { name: 'Rick Duplicate' }),
      character(2, { name: 'Morty Smith' }),
      character(3, { id: '3', name: 'Rick malformed wire identity' }),
    ])
    const parsed = parseRickMortyCharactersResponse(data, requestUrl, executedRequest).result
    expect(parsed).toMatchObject({
      providerRecordCount: 4,
      trustedRecordCount: 1,
      malformedEvidenceCount: 1,
      duplicateEvidenceCount: 1,
      filterMismatchCount: 1,
    })
    render(<RickMortyCharactersPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const card = screen.getByText('Characters matching “Rick”').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-malformed-evidence-count', '1')
    expect(card).toHaveAttribute('data-duplicate-evidence-count', '1')
    expect(card).toHaveAttribute('data-filter-mismatch-count', '1')
    expect(card).not.toHaveTextContent('Rick Duplicate')
    expect(card).not.toHaveTextContent('Morty Smith')
    expect(card).not.toHaveTextContent('Rick malformed wire identity')
  })

  it('keeps a trusted identity while withholding malformed optional portrait and location evidence', () => {
    const data = envelope([character(1, {
      image: 'https://example.com/not-provider-owned.jpeg',
      origin: { name: 'Earth (C-137)', url: 'https://example.com/location/1' },
      episode: ['https://rickandmortyapi.com/api/episode/1', 'not-a-url'],
    })])
    render(<RickMortyCharactersPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const card = screen.getByText('Characters matching “Rick”').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveTextContent('Provider portrait unavailable')
    expect(card?.querySelector('img')).toBeNull()
  })
})
