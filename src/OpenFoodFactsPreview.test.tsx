import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { OpenFoodFactsPreview, parseOpenFoodFactsRequest, parseOpenFoodFactsResponse } from './previews/OpenFoodFactsPreview'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'open-food-facts')
if (!api) throw new Error('Missing open-food-facts fixture')

const defaultUrl = api.buildUrl({ barcode: '3017620422003' })
const executedRequest = (url = defaultUrl) => ({ url, method: 'GET' })
const product = (overrides: Record<string, unknown> = {}) => ({
  code: '3017620422003',
  product_name: 'Nutella',
  quantity: '400 g e',
  nutriscore_grade: 'e',
  nova_group: 4,
  image_front_url: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.879.400.jpg',
  ingredients_text: 'Sugar, palm oil, hazelnuts, cocoa, milk powder.',
  allergens_tags: ['en:milk', 'en:nuts'],
  categories_tags: ['en:breakfasts', 'en:spreads'],
  nutriments: {
    'energy-kcal_100g': 539,
    fat_100g: 30.9,
    'saturated-fat_100g': 10.6,
    carbohydrates_100g: 57.5,
    sugars_100g: 56.3,
    proteins_100g: 6.3,
    salt_100g: 0.107,
  },
  ...overrides,
})
const response = (p: Record<string, unknown> = product(), overrides: Record<string, unknown> = {}) => ({
  code: p.code,
  errors: [],
  product: p,
  result: { id: 'product_found', lc_name: 'Product found', name: 'Product found' },
  status: 'success',
  warnings: [],
  ...overrides,
})

afterEach(cleanup)

describe('Open Food Facts request-bound product preview', () => {
  it('uses one exact v3 product request with a bounded field projection', () => {
    const parsed = parseOpenFoodFactsRequest(defaultUrl)
    expect(parsed).toMatchObject({ barcode: '3017620422003' })
    const url = new URL(defaultUrl)
    expect(url.origin).toBe('https://world.openfoodfacts.org')
    expect(url.pathname).toBe('/api/v3/product/3017620422003')
    expect(url.searchParams.getAll('fields')).toHaveLength(1)
    expect(url.searchParams.get('fields')).toContain('product_name')
    expect(url.searchParams.get('fields')).toContain('nutriments')
    expect(url.searchParams.get('fields')).not.toBe('all')
    expect(parseOpenFoodFactsRequest(`${defaultUrl}&foo=bar`)).toBeUndefined()
    expect(parseOpenFoodFactsRequest(`${defaultUrl}&fields=code`)).toBeUndefined()
  })

  it('renders trusted product identity and nutrition facts as ready', () => {
    const parsed = parseOpenFoodFactsResponse(response(), defaultUrl)
    expect(parsed.result).toMatchObject({ canonicalBarcode: '3017620422003', optionalContract: true })
    render(<OpenFoodFactsPreview data={response()} requestUrl={defaultUrl} executedRequest={executedRequest()}/>)
    const card = screen.getByText('Nutella', { selector: 'h3' }).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-barcode', '3017620422003')
    expect(card).toHaveAttribute('data-canonical-barcode', '3017620422003')
    expect(card).toHaveAttribute('data-identity-contract', 'true')
    expect(card).toHaveAttribute('data-optional-contract', 'true')
    expect(card).toHaveTextContent('539 kcal')
    expect(card).toHaveTextContent('56.3 g')
    expect(card).toHaveTextContent('Nutri-Score E')
  })

  it('accepts provider barcode normalization without pretending the raw request was identical', () => {
    const normalizedUrl = api.buildUrl({ barcode: '034000470693' })
    const normalizedProduct = product({ code: '0034000470693', product_name: 'Normalized product' })
    render(<OpenFoodFactsPreview data={response(normalizedProduct)} requestUrl={normalizedUrl} executedRequest={executedRequest(normalizedUrl)}/>)
    const card = screen.getByText('Normalized product', { selector: 'h3' }).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-barcode', '034000470693')
    expect(card).toHaveAttribute('data-canonical-barcode', '0034000470693')
    expect(card).toHaveAttribute('data-barcode-normalized', 'true')
  })

  it('fails closed when top-level and product barcode identities contradict', () => {
    const data = response(product({ code: '3017620422003' }), { code: '0000000000000' })
    render(<OpenFoodFactsPreview data={data} requestUrl={defaultUrl} executedRequest={executedRequest()}/>)
    const card = screen.getByText('Invalid Open Food Facts product identity').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('Nutella')
  })

  it('marks malformed optional nutrition evidence partial and withholds the bad value', () => {
    const data = response(product({ nutriments: { 'energy-kcal_100g': '539', sugars_100g: 56.3 } }))
    render(<OpenFoodFactsPreview data={data} requestUrl={defaultUrl} executedRequest={executedRequest()}/>)
    const card = screen.getByText('Nutella', { selector: 'h3' }).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-optional-contract', 'false')
    expect(card).not.toHaveTextContent('539 kcal')
    expect(card).toHaveTextContent('56.3 g')
  })

  it('keeps structurally valid data partial when executed transport identity is unavailable', () => {
    render(<OpenFoodFactsPreview data={response()} requestUrl={defaultUrl}/>)
    const card = screen.getByText('Nutella', { selector: 'h3' }).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveTextContent('executed transport identity is unavailable')
  })

  it('fails closed when the successful payload came from POST or a GET with a body', () => {
    const transports = [
      { url: defaultUrl, method: 'POST' },
      { url: defaultUrl, method: 'GET', body: { unexpected: true } },
    ]
    for (const executedRequest of transports) {
      const { unmount } = render(<ResponseDemoPreview api={api} data={response()} requestUrl={defaultUrl} executedRequest={executedRequest}/>)
      const card = screen.getByText('Invalid Open Food Facts request').closest('[data-domain-card]')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
      expect(card).not.toHaveTextContent('Nutella')
      unmount()
    }
  })

  it('fails closed when a successful body is attached to an undeclared request', () => {
    render(<OpenFoodFactsPreview data={response()} requestUrl={`${defaultUrl}&lc=en`}/>)
    const card = screen.getByText('Invalid Open Food Facts request').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('Nutella')
  })

  it('requires provider-owned barcode and product name identity', () => {
    render(<OpenFoodFactsPreview data={response(product({ code: '', product_name: '' }))} requestUrl={defaultUrl} executedRequest={executedRequest()}/>)
    const card = screen.getByText('Invalid Open Food Facts product identity').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })
})
