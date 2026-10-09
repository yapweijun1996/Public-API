import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import { parsePokeApiRequest, parsePokeApiResponse } from './previews/PokeApiPreview'

const api = getApiById('pokeapi')!
const requestUrl = api.buildUrl({ pokemon: 'pikachu' })
const executedRequest = { url: requestUrl, method: 'GET' }
const resource = (kind: string, id: number, name: string) => ({ name, url: `https://pokeapi.co/api/v2/${kind}/${id}/` })
const pokemon = (overrides: Record<string, unknown> = {}) => ({
  id: 25,
  name: 'pikachu',
  base_experience: 112,
  height: 4,
  is_default: true,
  weight: 60,
  abilities: [
    { is_hidden: false, slot: 1, ability: resource('ability', 9, 'static') },
    { is_hidden: true, slot: 3, ability: resource('ability', 31, 'lightning-rod') },
  ],
  types: [{ slot: 1, type: resource('type', 13, 'electric') }],
  stats: [
    { base_stat: 35, effort: 0, stat: resource('stat', 1, 'hp') },
    { base_stat: 55, effort: 0, stat: resource('stat', 2, 'attack') },
    { base_stat: 90, effort: 2, stat: resource('stat', 6, 'speed') },
  ],
  sprites: { front_default: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png' },
  ...overrides,
})

const card = async () => {
  await screen.findByText('Types')
  return document.querySelector('[data-domain-card="pokeapi-pokemon"]') as HTMLElement
}

describe('PokéAPI Pokémon semantic preview', () => {
  it('binds native provider identity, types, abilities, stats, and measurements to the exact request', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={pokemon()}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-contract', 'exact-pokeapi-pokemon-v2')
    expect(root).toHaveAttribute('data-request-pokemon', 'pikachu')
    expect(root).toHaveAttribute('data-pokemon-id', '25')
    expect(root).toHaveAttribute('data-pokemon-name', 'pikachu')
    expect(root).toHaveAttribute('data-type-count', '1')
    expect(root).toHaveAttribute('data-ability-count', '2')
    expect(root).toHaveAttribute('data-stat-count', '3')
    expect(root).toHaveTextContent('Electric')
    expect(root).toHaveTextContent('Static')
    expect(root).toHaveTextContent('Lightning Rod (hidden)')
    expect(root).toHaveTextContent('0.4 m')
    expect(root).toHaveTextContent('6 kg')
    expect(root.querySelectorAll('[data-stat-name]')).toHaveLength(3)
    expect(root.querySelector('[data-pokemon-sprite="front-default"] img')).toHaveAttribute('src', expect.stringContaining('/25.png'))
  })

  it('requires exact bodyless GET execution evidence before reporting a ready request-bound result', async () => {
    const missing = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={pokemon()}/>)
    let root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-request-bound', 'false')
    missing.unmount()

    const conflicts = [
      { url: requestUrl, method: 'POST' },
      { url: requestUrl, method: 'GET', body: { unexpected: true } },
      { url: api.buildUrl({ pokemon: 'raichu' }), method: 'GET' },
    ]
    for (const conflict of conflicts) {
      const view = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={conflict} data={pokemon()}/>)
      await waitFor(() => expect(document.querySelector('[data-domain-card="pokeapi-pokemon"]')).toHaveAttribute('data-result-state', 'invalid'))
      root = document.querySelector('[data-domain-card="pokeapi-pokemon"]') as HTMLElement
      expect(root).toHaveAttribute('data-request-bound', 'false')
      view.unmount()
    }
  })

  it('binds positive numeric resource IDs and rejects wrong provider identity', () => {
    const numericUrl = api.buildUrl({ pokemon: '25' })
    expect(parsePokeApiRequest(numericUrl)).toEqual({ token: '25', pokemonId: 25 })
    expect(parsePokeApiResponse(pokemon(), numericUrl).result?.id).toBe(25)
    expect(parsePokeApiResponse(pokemon({ id: 26, name: 'raichu' }), numericUrl).result).toBeUndefined()
    expect(parsePokeApiResponse(pokemon({ id: 25, name: 'raichu' }), requestUrl).result).toBeUndefined()
  })

  it('fails closed for extra query semantics, trailing-slash variants, credentials, and malformed core wire types', async () => {
    expect(parsePokeApiRequest(requestUrl)).toEqual({ token: 'pikachu', pokemonName: 'pikachu' })
    expect(parsePokeApiRequest(`${requestUrl}?foo=bar`)).toBeUndefined()
    expect(parsePokeApiRequest(`${requestUrl}/`)).toBeUndefined()
    expect(parsePokeApiRequest('https://user:pass@pokeapi.co/api/v2/pokemon/pikachu')).toBeUndefined()
    expect(parsePokeApiResponse(pokemon({ id: '25' }), requestUrl).result).toBeUndefined()
    expect(parsePokeApiResponse(pokemon({ height: '4' }), requestUrl).result).toBeUndefined()
    render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}?foo=bar`} data={pokemon()}/>)
    await waitFor(() => expect(document.querySelector('[data-domain-card="pokeapi-pokemon"]')).toHaveAttribute('data-result-state', 'invalid'))
  })

  it('withholds malformed and duplicate domain evidence as partial instead of fabricating a clean profile', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={pokemon({
      abilities: [
        { is_hidden: false, slot: 1, ability: resource('ability', 9, 'static') },
        { is_hidden: false, slot: 2, ability: resource('ability', 9, 'static') },
        { is_hidden: 'false', slot: 3, ability: resource('ability', 31, 'lightning-rod') },
      ],
      types: [
        { slot: 1, type: resource('type', 13, 'electric') },
        { slot: '2', type: resource('type', 10, 'fire') },
      ],
      stats: [
        { base_stat: 35, effort: 0, stat: resource('stat', 1, 'hp') },
        { base_stat: '90', effort: 2, stat: resource('stat', 6, 'speed') },
      ],
    })}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-malformed-evidence-count', '3')
    expect(root).toHaveAttribute('data-duplicate-evidence-count', '1')
    expect(root).toHaveAttribute('data-ability-count', '1')
    expect(root).not.toHaveTextContent('Lightning Rod')
    expect(root).not.toHaveTextContent('Fire')
    expect(root).not.toHaveTextContent('Speed')
  })

  it('keeps a semantically useful partial profile when sprite evidence is absent', async () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={pokemon({ sprites: { front_default: null } })}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-sprite-gap', 'true')
    expect(root).toHaveTextContent('semantic profile remains readable without image evidence')
  })
})
