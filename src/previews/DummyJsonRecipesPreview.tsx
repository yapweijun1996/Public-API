import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { finiteNumber, isRecord, nonNegativeSafeInteger, optionalTrimmedText, positiveSafeInteger, trimmedText } from './semanticValidation'

export type DummyJsonRecipesRequest = {
  query: string
  limit: number
}

type Recipe = {
  id: number
  name: string
  ingredients?: string[]
  instructions?: string[]
  prepTimeMinutes?: number
  cookTimeMinutes?: number
  servings?: number
  difficulty?: string
  cuisine?: string
  caloriesPerServing?: number
  tags?: string[]
  imageUrl?: string
  rating?: number
  reviewCount?: number
  mealTypes?: string[]
}

type DummyJsonRecipesResult = {
  recipes: Recipe[]
  total: number
  skip: number
  limit: number
  providerRecordCount: number
  expectedFirstPageCount: number
  malformedRecipeCount: number
  duplicateRecipeCount: number
  overflowRecipeCount: number
  supplementalMalformedCount: number
}

type OptionalList = { value?: string[]; malformedCount: number }
type OptionalNumber = { value?: number; malformed: boolean }

const REQUEST_KEYS = ['q', 'limit'] as const

export const parseDummyJsonRecipesRequest = (executedRequest?: ExecutedRequestContext): DummyJsonRecipesRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'dummyjson.com' || url.port || url.username || url.password
      || url.pathname !== '/recipes/search' || url.hash || keys.length !== REQUEST_KEYS.length
      || !REQUEST_KEYS.every((key) => keys.includes(key))
      || REQUEST_KEYS.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined

    const rawQuery = url.searchParams.get('q') ?? ''
    const query = rawQuery.trim()
    const rawLimit = url.searchParams.get('limit') ?? ''
    if (!query || query !== rawQuery || !/^(?:[1-9]|10)$/.test(rawLimit)) return undefined
    const limit = Number(rawLimit)
    if (!Number.isSafeInteger(limit) || String(limit) !== rawLimit) return undefined
    return { query, limit }
  } catch {
    return undefined
  }
}

const optionalTextList = (value: unknown): OptionalList => {
  if (value === undefined || value === null) return { malformedCount: 0 }
  if (!Array.isArray(value)) return { malformedCount: 1 }
  const items: string[] = []
  const seen = new Set<string>()
  let malformedCount = 0
  for (const entry of value) {
    const text = trimmedText(entry)
    if (!text) { malformedCount += 1; continue }
    if (seen.has(text)) { malformedCount += 1; continue }
    seen.add(text)
    items.push(text)
  }
  return { value: items, malformedCount }
}

const optionalNativeInteger = (value: unknown, positive = false): OptionalNumber => {
  if (value === undefined || value === null) return { malformed: false }
  const parsed = positive ? positiveSafeInteger(value) : nonNegativeSafeInteger(value)
  return { value: parsed, malformed: parsed === undefined }
}

const optionalRating = (value: unknown): OptionalNumber => {
  if (value === undefined || value === null) return { malformed: false }
  const parsed = finiteNumber(value)
  const valid = parsed !== undefined && parsed >= 0 && parsed <= 5
  return { value: valid ? parsed : undefined, malformed: !valid }
}

const optionalImageUrl = (value: unknown): { value?: string; malformed: boolean } => {
  const parsed = optionalTrimmedText(value)
  if (!parsed.value) return parsed
  try {
    const url = new URL(parsed.value)
    if (url.protocol !== 'https:' || url.username || url.password) return { malformed: true }
    return { value: url.toString(), malformed: false }
  } catch {
    return { malformed: true }
  }
}

const parseRecipe = (value: unknown): { recipe?: Recipe; supplementalMalformedCount: number } => {
  if (!isRecord(value)) return { supplementalMalformedCount: 0 }
  const id = positiveSafeInteger(value.id)
  const name = trimmedText(value.name)
  if (!id || !name) return { supplementalMalformedCount: 0 }

  const ingredients = optionalTextList(value.ingredients)
  const instructions = optionalTextList(value.instructions)
  const prepTime = optionalNativeInteger(value.prepTimeMinutes)
  const cookTime = optionalNativeInteger(value.cookTimeMinutes)
  const servings = optionalNativeInteger(value.servings, true)
  const calories = optionalNativeInteger(value.caloriesPerServing)
  const rating = optionalRating(value.rating)
  const reviewCount = optionalNativeInteger(value.reviewCount)
  const tags = optionalTextList(value.tags)
  const mealTypes = optionalTextList(value.mealType)
  const difficulty = optionalTrimmedText(value.difficulty)
  const cuisine = optionalTrimmedText(value.cuisine)
  const image = optionalImageUrl(value.image)
  const supplementalMalformedCount = ingredients.malformedCount + instructions.malformedCount + tags.malformedCount + mealTypes.malformedCount
    + Number(prepTime.malformed) + Number(cookTime.malformed) + Number(servings.malformed) + Number(calories.malformed)
    + Number(rating.malformed) + Number(reviewCount.malformed) + Number(difficulty.malformed) + Number(cuisine.malformed) + Number(image.malformed)

  return {
    recipe: {
      id,
      name,
      ingredients: ingredients.value,
      instructions: instructions.value,
      prepTimeMinutes: prepTime.value,
      cookTimeMinutes: cookTime.value,
      servings: servings.value,
      difficulty: difficulty.value,
      cuisine: cuisine.value,
      caloriesPerServing: calories.value,
      tags: tags.value,
      imageUrl: image.value,
      rating: rating.value,
      reviewCount: reviewCount.value,
      mealTypes: mealTypes.value,
    },
    supplementalMalformedCount,
  }
}

export const parseDummyJsonRecipesResponse = (data: unknown, executedRequest?: ExecutedRequestContext): { request?: DummyJsonRecipesRequest; result?: DummyJsonRecipesResult; invalidReason?: string } => {
  const request = parseDummyJsonRecipesRequest(executedRequest)
  if (!request) return { invalidReason: 'The successful response was not tied to the exact supported DummyJSON recipe-search request.' }
  if (!isRecord(data) || !Array.isArray(data.recipes)) {
    return { request, invalidReason: 'DummyJSON did not return the documented recipes response envelope.' }
  }
  const total = nonNegativeSafeInteger(data.total)
  const skip = nonNegativeSafeInteger(data.skip)
  const limit = nonNegativeSafeInteger(data.limit)
  if (total === undefined || skip === undefined || limit === undefined || skip !== 0) {
    return { request, invalidReason: 'DummyJSON total, skip, limit, and recipe count must be coherent native integers for the executed first page.' }
  }
  const expectedFirstPageCount = Math.min(total, request.limit)
  if (limit !== expectedFirstPageCount) {
    return { request, invalidReason: 'DummyJSON did not report the effective first-page limit implied by its total and the executed requested limit.' }
  }
  if (data.recipes.length < expectedFirstPageCount) {
    return { request, invalidReason: 'DummyJSON returned fewer first-page recipes than its total and executed limit require.' }
  }
  if (total === 0 && data.recipes.length > 0) {
    return { request, invalidReason: 'DummyJSON returned recipe rows while reporting zero total matches.' }
  }

  const firstPage = data.recipes.slice(0, expectedFirstPageCount)
  const recipes: Recipe[] = []
  const seen = new Set<number>()
  let malformedRecipeCount = 0
  let duplicateRecipeCount = 0
  let supplementalMalformedCount = 0
  for (const value of firstPage) {
    const parsed = parseRecipe(value)
    if (!parsed.recipe) { malformedRecipeCount += 1; continue }
    if (seen.has(parsed.recipe.id)) { duplicateRecipeCount += 1; continue }
    seen.add(parsed.recipe.id)
    recipes.push(parsed.recipe)
    supplementalMalformedCount += parsed.supplementalMalformedCount
  }

  return { request, result: {
    recipes,
    total,
    skip,
    limit,
    providerRecordCount: data.recipes.length,
    expectedFirstPageCount,
    malformedRecipeCount,
    duplicateRecipeCount,
    overflowRecipeCount: data.recipes.length - expectedFirstPageCount,
    supplementalMalformedCount,
  } }
}

const attributes = (request?: DummyJsonRecipesRequest, result?: DummyJsonRecipesResult) => ({
  'data-domain-card': 'dummyjson-recipes',
  'data-request-bound': request ? 'true' : 'false',
  'data-request-contract': 'exact-dummyjson-recipe-search-v1',
  'data-request-query': request?.query,
  'data-request-limit': request?.limit,
  'data-provider-total-count': result?.total,
  'data-provider-skip': result?.skip,
  'data-provider-limit': result?.limit,
  'data-provider-record-count': result?.providerRecordCount,
  'data-expected-first-page-count': result?.expectedFirstPageCount,
  'data-trusted-recipe-count': result?.recipes.length,
  'data-malformed-recipe-count': result?.malformedRecipeCount,
  'data-duplicate-recipe-count': result?.duplicateRecipeCount,
  'data-overflow-recipe-count': result?.overflowRecipeCount,
  'data-supplemental-malformed-count': result?.supplementalMalformedCount,
  'data-primary-recipe-id': result?.recipes[0]?.id,
})

const numberLabel = (value: number | undefined, suffix = '') => value === undefined ? 'Unavailable' : `${value.toLocaleString('en')}${suffix}`
const listLabel = (values: string[] | undefined) => values?.length ? values.join(' · ') : 'Unavailable'

export function DummyJsonRecipesPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseDummyJsonRecipesResponse(data, executedRequest)
  if (!parsed.request || !parsed.result) return <div className="domain-card domain-empty dummyjson-recipes-preview" {...attributes(parsed.request)} data-result-state="invalid"><h3>Invalid recipe-search response</h3><p>{parsed.invalidReason}</p></div>
  const { request, result } = parsed
  if (result.total === 0) return <div className="domain-card domain-empty dummyjson-recipes-preview" {...attributes(request, result)} data-result-state="empty"><h3>No synthetic recipes matched</h3><p>DummyJSON returned a coherent, exact-request-bound empty first page for “{request.query}”.</p></div>
  if (!result.recipes.length) return <div className="domain-card domain-empty dummyjson-recipes-preview" {...attributes(request, result)} data-result-state="invalid"><h3>No trustworthy recipe identities</h3><p>The response contained recipe rows, but none had a positive native safe-integer ID and non-empty name.</p></div>
  const partial = result.malformedRecipeCount > 0 || result.duplicateRecipeCount > 0 || result.overflowRecipeCount > 0
    || result.supplementalMalformedCount > 0 || result.recipes.length !== result.expectedFirstPageCount
  return <div className="domain-card dummyjson-recipes-preview bounded-media-preview" {...attributes(request, result)} data-result-state={partial ? 'partial' : 'ready'}>
    <header className="domain-heading"><div><small className="domain-eyebrow">DummyJSON · Synthetic recipe search</small><h3>{request.query}</h3><p>Exact-request-bound placeholder recipe identities with provider cooking, nutrition, rating, ingredient, and instruction evidence.</p></div><span className={`domain-state${partial ? ' warning' : ''}`}>{result.recipes.length} trusted recipe{result.recipes.length === 1 ? '' : 's'}</span></header>
    {partial ? <p className="domain-note">Malformed, duplicate, over-limit, or malformed supplemental evidence is withheld. Raw JSON retains the complete synthetic provider response.</p> : null}
    <dl className="domain-facts"><div><dt>Total matches</dt><dd>{result.total.toLocaleString('en')}</dd></div><div><dt>Returned / requested</dt><dd>{result.providerRecordCount} / {request.limit}</dd></div><div><dt>Provider effective limit</dt><dd>{result.limit}</dd></div><div><dt>First-page offset</dt><dd>{result.skip}</dd></div><div><dt>Primary recipe ID</dt><dd><code>{result.recipes[0].id}</code></dd></div></dl>
    <section className={`media-preview ${result.recipes.length === 1 ? 'single' : ''}`} aria-label={`Synthetic recipes matching ${request.query}`}>
      {result.recipes.map((recipe) => <article key={recipe.id} data-recipe-id={recipe.id}>
        {recipe.imageUrl ? <img src={recipe.imageUrl} alt={`${recipe.name} recipe`} loading="lazy"/> : null}
        <div>
          <small>Recipe #{recipe.id} · {recipe.cuisine ?? 'Cuisine unavailable'}</small>
          <h3>{recipe.name}</h3>
          <p>{recipe.difficulty ?? 'Difficulty unavailable'} · {listLabel(recipe.mealTypes)}</p>
          <dl className="domain-facts"><div><dt>Preparation</dt><dd>{numberLabel(recipe.prepTimeMinutes, ' min')}</dd></div><div><dt>Cooking</dt><dd>{numberLabel(recipe.cookTimeMinutes, ' min')}</dd></div><div><dt>Servings</dt><dd>{numberLabel(recipe.servings)}</dd></div><div><dt>Calories / serving</dt><dd>{numberLabel(recipe.caloriesPerServing)}</dd></div><div><dt>Rating</dt><dd>{recipe.rating === undefined ? 'Unavailable' : `${recipe.rating.toLocaleString('en', { maximumFractionDigits: 2 })} / 5`}</dd></div><div><dt>Reviews</dt><dd>{numberLabel(recipe.reviewCount)}</dd></div></dl>
          <p><strong>Tags:</strong> {listLabel(recipe.tags)}</p>
          <section aria-label={`${recipe.name} ingredients`}><h4>Ingredients</h4>{recipe.ingredients?.length ? <ul>{recipe.ingredients.map((ingredient, index) => <li key={`${ingredient}-${index}`}>{ingredient}</li>)}</ul> : <p>Ingredient evidence unavailable.</p>}</section>
          <section aria-label={`${recipe.name} instructions`}><h4>Instructions</h4>{recipe.instructions?.length ? <ol>{recipe.instructions.map((instruction, index) => <li key={`${instruction}-${index}`}>{instruction}</li>)}</ol> : <p>Instruction evidence unavailable.</p>}</section>
          {!recipe.imageUrl ? <p>Recipe image unavailable; textual recipe evidence remains available.</p> : null}
        </div>
      </article>)}
    </section>
    <p className="domain-note">DummyJSON supplies synthetic placeholder data for prototypes. The repository code licence does not establish reuse rights for individual recipe content or images, and this card makes no such rights claim. The response does not echo the query, so provider ordering is shown without inventing a relevance claim.</p>
  </div>
}
