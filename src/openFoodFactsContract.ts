export const OPEN_FOOD_FACTS_FIELDS = [
  'code',
  'product_name',
  'quantity',
  'nutriscore_grade',
  'nova_group',
  'nutriments',
  'image_front_url',
  'ingredients_text',
  'allergens_tags',
  'categories_tags',
] as const

export const OPEN_FOOD_FACTS_FIELDS_PARAM = OPEN_FOOD_FACTS_FIELDS.join(',')

export const buildOpenFoodFactsProductUrl = (barcode: string) => {
  const normalized = barcode.trim()
  const query = new URLSearchParams({ fields: OPEN_FOOD_FACTS_FIELDS_PARAM })
  return `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(normalized)}?${query.toString()}`
}
