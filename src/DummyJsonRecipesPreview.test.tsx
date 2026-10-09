import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { parseDummyJsonRecipesRequest, parseDummyJsonRecipesResponse } from './previews/DummyJsonRecipesPreview'
import { ResponseDemoPreview } from './responsePreview'

const api = getApiById('dummyjson-recipes')!
const requestUrl = api.buildUrl({ query: 'Margherita', limit: '2' })
const executedRequest = { method: 'GET' as const, url: requestUrl }

const recipe = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: id === 1 ? 'Classic Margherita Pizza' : `Trusted recipe ${id}`,
  ingredients: ['Pizza dough', 'Tomato sauce', 'Fresh mozzarella'],
  instructions: ['Preheat the oven.', 'Assemble the pizza.', 'Bake until crisp.'],
  prepTimeMinutes: 20,
  cookTimeMinutes: 15,
  servings: 4,
  difficulty: 'Easy',
  cuisine: 'Italian',
  caloriesPerServing: 300,
  tags: ['Pizza', 'Italian'],
  image: `https://cdn.dummyjson.com/recipe-images/${id}.webp`,
  rating: 4.6,
  reviewCount: 98,
  mealType: ['Dinner'],
  ...overrides,
})

const response = (recipes: unknown[], total = recipes.length, limit = Math.min(total, 2), skip = 0) => ({ recipes, total, skip, limit })

const card = async () => {
  const region = await screen.findByRole('region', { name: 'Recipe Explorer' })
  return region.querySelector('[data-domain-card="dummyjson-recipes"]') as HTMLElement
}

describe('DummyJSON exact-request-bound recipe semantics', () => {
  it('renders recipe identity and all supported cooking evidence from one trusted ViewModel', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response([recipe(1), recipe(2)])}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-contract', 'exact-dummyjson-recipe-search-v1')
    expect(root).toHaveAttribute('data-request-query', 'Margherita')
    expect(root).toHaveAttribute('data-request-limit', '2')
    expect(root).toHaveAttribute('data-provider-total-count', '2')
    expect(root).toHaveAttribute('data-provider-skip', '0')
    expect(root).toHaveAttribute('data-provider-limit', '2')
    expect(root).toHaveAttribute('data-provider-record-count', '2')
    expect(root).toHaveAttribute('data-trusted-recipe-count', '2')
    expect(root).toHaveAttribute('data-primary-recipe-id', '1')
    expect(root).toHaveTextContent('Classic Margherita Pizza')
    expect(root).toHaveTextContent('Italian')
    expect(root).toHaveTextContent('Easy · Dinner')
    expect(root).toHaveTextContent('Preparation20 min')
    expect(root).toHaveTextContent('Cooking15 min')
    expect(root).toHaveTextContent('Calories / serving300')
    expect(root).toHaveTextContent('4.6 / 5')
    expect(root).toHaveTextContent('Reviews98')
    expect(root).toHaveTextContent('Fresh mozzarella')
    expect(root).toHaveTextContent('Bake until crisp.')
    expect(root).toHaveTextContent('does not establish reuse rights for individual recipe content or images')
    expect(within(root).getAllByRole('img')).toHaveLength(2)
  })

  it('accepts the provider effective limit when total is smaller than the requested default limit', async () => {
    const defaultRequest = { method: 'GET' as const, url: api.buildUrl({ query: 'pasta', limit: '6' }) }
    render(<ResponseDemoPreview api={api} executedRequest={defaultRequest} data={response([recipe(1), recipe(2), recipe(3)], 3, 3)}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-query', 'pasta')
    expect(root).toHaveAttribute('data-request-limit', '6')
    expect(root).toHaveAttribute('data-provider-total-count', '3')
    expect(root).toHaveAttribute('data-provider-limit', '3')
    expect(root).toHaveAttribute('data-expected-first-page-count', '3')
    expect(root).toHaveAttribute('data-provider-record-count', '3')
    expect(root).toHaveTextContent('Returned / requested3 / 6')
  })

  it('accepts only the exact bodyless canonical GET request', () => {
    expect(parseDummyJsonRecipesRequest(executedRequest)).toEqual({ query: 'Margherita', limit: 2 })
    expect(parseDummyJsonRecipesRequest({ method: 'POST', url: requestUrl })).toBeUndefined()
    expect(parseDummyJsonRecipesRequest({ method: 'GET', url: requestUrl, body: {} })).toBeUndefined()
    expect(parseDummyJsonRecipesRequest({ method: 'GET', url: `${requestUrl}&foo=bar` })).toBeUndefined()
    expect(parseDummyJsonRecipesRequest({ method: 'GET', url: `${requestUrl}&limit=1` })).toBeUndefined()
    expect(parseDummyJsonRecipesRequest({ method: 'GET', url: 'https://dummyjson.com/recipes/search/?q=Margherita&limit=2' })).toBeUndefined()
    expect(parseDummyJsonRecipesRequest({ method: 'GET', url: 'https://user:pass@dummyjson.com/recipes/search?q=Margherita&limit=2' })).toBeUndefined()
    expect(parseDummyJsonRecipesRequest({ method: 'GET', url: 'https://dummyjson.com:8443/recipes/search?q=Margherita&limit=2' })).toBeUndefined()
    expect(parseDummyJsonRecipesRequest({ method: 'GET', url: 'https://dummyjson.com/recipes/search?q=Margherita&limit=2#recipes' })).toBeUndefined()
    expect(parseDummyJsonRecipesRequest({ method: 'GET', url: 'https://dummyjson.com/recipes/search?q=&limit=2' })).toBeUndefined()
    expect(parseDummyJsonRecipesRequest({ method: 'GET', url: 'https://dummyjson.com/recipes/search?q=Margherita&limit=02' })).toBeUndefined()
    expect(parseDummyJsonRecipesRequest({ method: 'GET', url: 'https://dummyjson.com/recipes/search?q=Margherita&limit=2.5' })).toBeUndefined()
    expect(parseDummyJsonRecipesRequest({ method: 'GET', url: 'https://dummyjson.com/recipes/search?q=Margherita&limit=11' })).toBeUndefined()
  })

  it('maps only a coherent exact-request zero result to empty', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response([], 0)}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'empty')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-provider-limit', '0')
    expect(root).toHaveTextContent('No synthetic recipes matched')
  })

  it.each([
    ['numeric-string total', { recipes: [], total: '0', skip: 0, limit: 0 }],
    ['numeric-string skip', { recipes: [], total: 0, skip: '0', limit: 0 }],
    ['numeric-string limit', { recipes: [], total: 0, skip: 0, limit: '0' }],
    ['non-first-page skip', { recipes: [recipe(1)], total: 1, skip: 1, limit: 1 }],
    ['requested rather than effective provider limit', { recipes: [recipe(1)], total: 1, skip: 0, limit: 2 }],
    ['zero provider limit for non-empty result', { recipes: [recipe(1)], total: 1, skip: 0, limit: 0 }],
    ['negative provider limit', { recipes: [], total: 0, skip: 0, limit: -1 }],
    ['short first page', { recipes: [recipe(1)], total: 2, skip: 0, limit: 2 }],
    ['more rows than total', { recipes: [recipe(1)], total: 0, skip: 0, limit: 2 }],
  ])('fails closed for request/envelope contradiction: %s', async (_label, payload) => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={payload}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).not.toHaveTextContent('Classic Margherita Pizza')
  })

  it('withholds malformed and duplicate recipe identities while preserving trusted rows as partial', async () => {
    const payload = response([
      recipe(1),
      recipe(1, { name: 'Fabricated duplicate recipe' }),
      recipe(3, { id: '3', name: 'Fabricated numeric-string recipe' }),
      recipe(4),
    ], 4, 4)
    const fourRequest = { method: 'GET' as const, url: api.buildUrl({ query: 'Margherita', limit: '4' }) }
    expect(parseDummyJsonRecipesResponse(payload, fourRequest).result).toMatchObject({
      malformedRecipeCount: 1,
      duplicateRecipeCount: 1,
      overflowRecipeCount: 0,
    })
    render(<ResponseDemoPreview api={api} executedRequest={fourRequest} data={payload}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-trusted-recipe-count', '2')
    expect(root).toHaveAttribute('data-malformed-recipe-count', '1')
    expect(root).toHaveAttribute('data-duplicate-recipe-count', '1')
    expect(root).not.toHaveTextContent('Fabricated duplicate recipe')
    expect(root).not.toHaveTextContent('Fabricated numeric-string recipe')
  })

  it('withholds overflow rows and malformed supplemental native values', async () => {
    const payload = response([
      recipe(1, { rating: '4.6', prepTimeMinutes: '20', image: 'http://example.com/insecure.webp', tags: ['Pizza', '', 'Pizza'] }),
      recipe(2),
      recipe(3, { name: 'Fabricated overflow recipe' }),
    ], 3)
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={payload}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-overflow-recipe-count', '1')
    expect(Number(root.dataset.supplementalMalformedCount)).toBeGreaterThan(0)
    expect(root).toHaveTextContent('PreparationUnavailable')
    expect(root).toHaveTextContent('RatingUnavailable')
    expect(root).toHaveTextContent('Recipe image unavailable')
    expect(root).not.toHaveTextContent('Fabricated overflow recipe')
    expect(within(root).getAllByRole('img')).toHaveLength(1)
  })

  it('withholds trailing overflow even when the provider array exceeds its reported total', async () => {
    const payload = response([
      recipe(1),
      recipe(2, { name: 'Fabricated beyond-total overflow recipe' }),
    ], 1, 1)
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={payload}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-provider-total-count', '1')
    expect(root).toHaveAttribute('data-provider-limit', '1')
    expect(root).toHaveAttribute('data-overflow-recipe-count', '1')
    expect(root).toHaveAttribute('data-trusted-recipe-count', '1')
    expect(root).not.toHaveTextContent('Fabricated beyond-total overflow recipe')
  })

  it('treats absent optional recipe evidence as unavailable without downgrading the result', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response([{ id: 1, name: 'Identity-only recipe' }], 1)}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-supplemental-malformed-count', '0')
    expect(root).toHaveTextContent('Identity-only recipe')
    expect(root).toHaveTextContent('Ingredient evidence unavailable.')
    expect(root).toHaveTextContent('Instruction evidence unavailable.')
    expect(root).toHaveTextContent('Recipe image unavailable')
  })

  it('fails closed when a non-empty batch has no trustworthy native identity', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response([recipe(1, { id: '1' })], 1)}/>)
    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveTextContent('No trustworthy recipe identities')
  })
})
