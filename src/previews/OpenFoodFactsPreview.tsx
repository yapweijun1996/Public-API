import { buildOpenFoodFactsProductUrl, OPEN_FOOD_FACTS_FIELDS_PARAM } from '../openFoodFactsContract'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { finiteNumber, isRecord, optionalTrimmedText, trimmedText } from './semanticValidation'

type RequestIdentity = { barcode: string; transportBound: boolean }
type NutritionFact = { label: string; value: number; unit: 'kcal' | 'g' }
type ParsedProduct = {
  canonicalBarcode: string
  productName: string
  quantity?: string
  nutriScore?: string
  novaGroup?: number
  imageUrl?: string
  ingredients?: string
  allergens: string[]
  categories: string[]
  nutrition: NutritionFact[]
  optionalContract: boolean
}
type ParsedResponse = { request?: RequestIdentity; result?: ParsedProduct; invalidReason?: string }

const barcodePattern = /^\d+$/

export const parseOpenFoodFactsRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestIdentity | undefined => {
  const candidateUrl = executedRequest?.url ?? requestUrl
  if (!candidateUrl) return undefined
  if (executedRequest && (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined
    || (requestUrl !== undefined && requestUrl !== executedRequest.url))) return undefined
  try {
    const url = new URL(candidateUrl)
    const match = /^\/api\/v3\/product\/(\d+)$/.exec(url.pathname)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'world.openfoodfacts.org' || url.port || url.username || url.password || url.hash
      || !match || keys.length !== 1 || keys[0] !== 'fields' || url.searchParams.getAll('fields').length !== 1
      || url.searchParams.get('fields') !== OPEN_FOOD_FACTS_FIELDS_PARAM
      || candidateUrl !== buildOpenFoodFactsProductUrl(match[1])) return undefined
    return { barcode: match[1], transportBound: Boolean(executedRequest) }
  } catch {
    return undefined
  }
}

const optionalStringArray = (value: unknown) => {
  if (value === undefined || value === null) return { values: [] as string[], malformed: false }
  if (!Array.isArray(value)) return { values: [] as string[], malformed: true }
  const values: string[] = []
  let malformed = false
  for (const entry of value) {
    const text = trimmedText(entry)
    if (!text) { malformed = true; continue }
    if (!values.includes(text)) values.push(text)
  }
  return { values, malformed }
}

const optionalHttpsUrl = (value: unknown) => {
  if (value === undefined || value === null) return { value: undefined as string | undefined, malformed: false }
  const text = trimmedText(value)
  if (!text) return { value: undefined as string | undefined, malformed: typeof value !== 'string' }
  try {
    const url = new URL(text)
    return url.protocol === 'https:' ? { value: url.toString(), malformed: false } : { value: undefined, malformed: true }
  } catch {
    return { value: undefined, malformed: true }
  }
}

const optionalNovaGroup = (value: unknown) => {
  if (value === undefined || value === null) return { value: undefined as number | undefined, malformed: false }
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4
    ? { value, malformed: false }
    : { value: undefined, malformed: true }
}

const optionalNutriScore = (value: unknown) => {
  if (value === undefined || value === null) return { value: undefined as string | undefined, malformed: false }
  const score = trimmedText(value)?.toUpperCase()
  return score && /^[A-E]$/.test(score)
    ? { value: score, malformed: false }
    : { value: undefined, malformed: true }
}

const nutrientDefinitions = [
  ['energy-kcal_100g', 'Energy', 'kcal'],
  ['fat_100g', 'Fat', 'g'],
  ['saturated-fat_100g', 'Saturated fat', 'g'],
  ['carbohydrates_100g', 'Carbohydrates', 'g'],
  ['sugars_100g', 'Sugars', 'g'],
  ['proteins_100g', 'Protein', 'g'],
  ['salt_100g', 'Salt', 'g'],
] as const

const parseNutrition = (value: unknown) => {
  if (value === undefined || value === null) return { facts: [] as NutritionFact[], malformed: false }
  if (!isRecord(value)) return { facts: [] as NutritionFact[], malformed: true }
  const facts: NutritionFact[] = []
  let malformed = false
  for (const [key, label, unit] of nutrientDefinitions) {
    if (!Object.prototype.hasOwnProperty.call(value, key) || value[key] === null) continue
    const numeric = finiteNumber(value[key])
    if (numeric === undefined || numeric < 0) { malformed = true; continue }
    facts.push({ label, value: numeric, unit })
  }
  return { facts, malformed }
}

export const parseOpenFoodFactsResponse = (data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext): ParsedResponse => {
  const request = parseOpenFoodFactsRequest(requestUrl, executedRequest)
  if (!request) return { invalidReason: 'The successful response was not tied to the exact supported Open Food Facts v3 product request.' }
  if (!isRecord(data) || data.status !== 'success' || !isRecord(data.result) || data.result.id !== 'product_found' || !isRecord(data.product)) {
    return { request, invalidReason: 'Open Food Facts did not return the documented successful product response envelope.' }
  }

  const topCode = trimmedText(data.code)
  const canonicalBarcode = trimmedText(data.product.code)
  const productName = trimmedText(data.product.product_name)
  if (!topCode || !canonicalBarcode || !barcodePattern.test(topCode) || !barcodePattern.test(canonicalBarcode) || topCode !== canonicalBarcode || !productName) {
    return { request, invalidReason: 'Open Food Facts did not return one coherent provider-owned barcode and product-name identity.' }
  }

  const quantity = optionalTrimmedText(data.product.quantity)
  const nutriScore = optionalNutriScore(data.product.nutriscore_grade)
  const novaGroup = optionalNovaGroup(data.product.nova_group)
  const image = optionalHttpsUrl(data.product.image_front_url)
  const ingredients = optionalTrimmedText(data.product.ingredients_text)
  const allergens = optionalStringArray(data.product.allergens_tags)
  const categories = optionalStringArray(data.product.categories_tags)
  const nutrition = parseNutrition(data.product.nutriments)
  const errorsContract = data.errors === undefined || Array.isArray(data.errors)
  const warningsContract = data.warnings === undefined || Array.isArray(data.warnings)
  const optionalContract = !quantity.malformed && !nutriScore.malformed && !novaGroup.malformed && !image.malformed && !ingredients.malformed
    && !allergens.malformed && !categories.malformed && !nutrition.malformed && errorsContract && warningsContract

  return {
    request,
    result: {
      canonicalBarcode,
      productName,
      quantity: quantity.value,
      nutriScore: nutriScore.value,
      novaGroup: novaGroup.value,
      imageUrl: image.value,
      ingredients: ingredients.value,
      allergens: allergens.values,
      categories: categories.values,
      nutrition: nutrition.facts,
      optionalContract,
    },
  }
}

const readableTag = (value: string) => value.replace(/^[a-z]{2}:/i, '').replace(/[-_]+/g, ' ')
const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))

export function OpenFoodFactsPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const parsed = parseOpenFoodFactsResponse(data, requestUrl, executedRequest)
  if (!parsed.request) return <div className="domain-card domain-empty" data-domain-card="open-food-facts-product" data-result-state="invalid" data-request-bound="false"><h3>Invalid Open Food Facts request</h3><p>{parsed.invalidReason}</p></div>
  if (!parsed.result) return <div className="domain-card domain-empty" data-domain-card="open-food-facts-product" data-result-state="invalid" data-request-bound="true" data-request-barcode={parsed.request.barcode}><h3>Invalid Open Food Facts product identity</h3><p>{parsed.invalidReason}</p></div>

  const { request, result } = parsed
  const normalized = request.barcode !== result.canonicalBarcode
  return <div
    className="domain-card open-food-facts-preview"
    data-domain-card="open-food-facts-product"
    data-result-state={result.optionalContract && request.transportBound ? 'ready' : 'partial'}
    data-request-bound={request.transportBound ? 'true' : 'false'}
    data-request-contract="exact-v3-product-fields"
    data-request-barcode={request.barcode}
    data-canonical-barcode={result.canonicalBarcode}
    data-barcode-normalized={String(normalized)}
    data-identity-contract="true"
    data-optional-contract={String(result.optionalContract)}
    data-nutrition-fact-count={result.nutrition.length}
    data-primary-product-name={result.productName}
  >
    <div className="off-product-hero">
      {result.imageUrl && <img src={result.imageUrl} alt={`${result.productName} package front`} loading="lazy"/>}
      <header className="domain-heading">
        <div>
          <small className="domain-eyebrow">Open Food Facts · Product lookup</small>
          <h3>{result.productName}</h3>
          <p>Request-bound product identity and selected nutrition fields from the executed v3 barcode lookup.</p>
        </div>
        <span className={`domain-state${result.optionalContract && request.transportBound ? '' : ' warning'}`}>{result.optionalContract && request.transportBound ? 'Verified fields' : 'Partial fields'}</span>
      </header>
    </div>

    {!request.transportBound && <p className="domain-note">The response is structurally useful, but executed transport identity is unavailable, so it cannot be marked ready.</p>}
    {!result.optionalContract && <p className="domain-note">The product identity is trustworthy, but one or more optional requested fields had an unexpected wire type or shape and were withheld.</p>}
    <dl className="domain-facts">
      <div><dt>Canonical barcode</dt><dd><code>{result.canonicalBarcode}</code></dd></div>
      <div><dt>Quantity</dt><dd>{result.quantity ?? 'Unavailable'}</dd></div>
      <div><dt>Nutri-Score</dt><dd>{result.nutriScore ? `Nutri-Score ${result.nutriScore}` : 'Unavailable'}</dd></div>
      <div><dt>NOVA group</dt><dd>{result.novaGroup ?? 'Unavailable'}</dd></div>
    </dl>

    {normalized && <p className="domain-note">Requested barcode <code>{request.barcode}</code> was normalized by Open Food Facts to provider identity <code>{result.canonicalBarcode}</code>.</p>}

    {result.nutrition.length > 0 && <section className="off-nutrition" aria-labelledby="off-nutrition-title">
      <header><small className="domain-eyebrow">Per 100 g / ml when supplied by provider</small><h4 id="off-nutrition-title">Nutrition facts</h4></header>
      <dl>{result.nutrition.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{formatNumber(fact.value)} {fact.unit}</dd></div>)}</dl>
    </section>}

    {result.ingredients && <section className="off-copy"><small className="domain-eyebrow">Ingredients</small><p>{result.ingredients}</p></section>}
    {(result.allergens.length > 0 || result.categories.length > 0) && <div className="off-tags">
      {result.allergens.slice(0, 6).map((tag) => <span key={`allergen-${tag}`}>Allergen · {readableTag(tag)}</span>)}
      {result.categories.slice(0, 5).map((tag) => <span key={`category-${tag}`}>{readableTag(tag)}</span>)}
    </div>}

    <p className="domain-note">Open Food Facts is community-contributed data and can be incomplete or incorrect. Use the card for product-data exploration, not medical or dietary advice. Raw JSON retains the provider response.</p>
  </div>
}
