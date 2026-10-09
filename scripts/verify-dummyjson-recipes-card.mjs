import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'pasta'
const limit = 6
const endpoint = `https://dummyjson.com/recipes/search?${new URLSearchParams({ q: query, limit: String(limit) }).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live canonical DummyJSON request plus one synthetic HTTP-200 semantic fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())
const fixtureRecipe = (id, overrides = {}) => ({
  id,
  name: `Fixture pasta recipe ${id}`,
  ingredients: ['Pasta', 'Tomatoes', 'Olive oil'],
  instructions: ['Cook the pasta.', 'Combine the ingredients.'],
  prepTimeMinutes: 10,
  cookTimeMinutes: 15,
  servings: 2,
  difficulty: 'Easy',
  cuisine: 'Italian',
  caloriesPerServing: 420,
  tags: ['Pasta', 'Italian'],
  rating: 4.5,
  reviewCount: 12,
  mealType: ['Dinner'],
  ...overrides,
})
const semantic = (instance) => instance.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="dummyjson-recipes"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', query:card?.dataset.requestQuery||'', requestLimit:Number(card?.dataset.requestLimit||0), total:Number(card?.dataset.providerTotalCount||0), skip:Number(card?.dataset.providerSkip||0), providerLimit:Number(card?.dataset.providerLimit||0), providerCount:Number(card?.dataset.providerRecordCount||0), trustedCount:Number(card?.dataset.trustedRecipeCount||0), malformedCount:Number(card?.dataset.malformedRecipeCount||0), duplicateCount:Number(card?.dataset.duplicateRecipeCount||0), overflowCount:Number(card?.dataset.overflowRecipeCount||0), supplementalMalformedCount:Number(card?.dataset.supplementalMalformedCount||0), primaryRecipeId:Number(card?.dataset.primaryRecipeId||0), images:card?.querySelectorAll('img').length||0, text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('dummyjson-recipes')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const response = await live.run()
  assert.equal(response.ok, true, response.error)
  assert.equal(live.requestCount - before, 1, 'DummyJSON verifier must issue exactly one live provider request')
  assert(Number.isSafeInteger(response.data?.total) && response.data.total >= 0, 'DummyJSON total must be a native non-negative safe integer')
  assert.equal(response.data?.skip, 0)
  const expectedEffectiveLimit = Math.min(response.data.total, limit)
  assert.equal(response.data?.limit, expectedEffectiveLimit)
  assert(Array.isArray(response.data?.recipes))
  assert.equal(response.data.recipes.length, expectedEffectiveLimit)
  assert(expectedEffectiveLimit > 0, 'The canonical pasta verifier requires at least one current recipe identity')
  const liveIds = response.data.recipes.map((row) => {
    assert(row && typeof row === 'object' && Number.isSafeInteger(row.id) && row.id > 0, 'DummyJSON recipe ID contract drifted')
    assert.equal(typeof row.name, 'string')
    assert(row.name.trim(), 'DummyJSON recipe name contract drifted')
    return row.id
  })
  assert.equal(new Set(liveIds).size, liveIds.length, 'DummyJSON returned duplicate recipe identities')
  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    query: dom.query,
    requestLimit: dom.requestLimit,
    total: dom.total,
    skip: dom.skip,
    providerLimit: dom.providerLimit,
    providerCount: dom.providerCount,
    trustedCount: dom.trustedCount,
    malformedCount: dom.malformedCount,
    duplicateCount: dom.duplicateCount,
    overflowCount: dom.overflowCount,
    supplementalMalformedCount: dom.supplementalMalformedCount,
    primaryRecipeId: dom.primaryRecipeId,
    images: dom.images,
  }, {
    layout: 'recipe-search',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-dummyjson-recipe-search-v1',
    query,
    requestLimit: limit,
    total: response.data.total,
    skip: 0,
    providerLimit: expectedEffectiveLimit,
    providerCount: expectedEffectiveLimit,
    trustedCount: expectedEffectiveLimit,
    malformedCount: 0,
    duplicateCount: 0,
    overflowCount: 0,
    supplementalMalformedCount: 0,
    primaryRecipeId: liveIds[0],
    images: response.data.recipes.filter((row) => typeof row.image === 'string' && row.image.startsWith('https://')).length,
  })
  assert(dom.text.includes(response.data.recipes[0].name))
  assert(dom.text.includes('does not establish reuse rights for individual recipe content or images'))
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'dummyjson-recipes', source: 'live provider', exactRequest: endpoint, providerTotal: response.data.total, effectiveProviderLimit: response.data.limit, returnedRecipes: response.data.recipes.length, primaryRecipeId: dom.primaryRecipeId, semanticState: dom.state, requestBound: dom.requestBound, browserCorsReadable: true, mobileOverflow: false, unnamedControls: 0 })
  await live.close(); active = undefined

  const partialBody = { recipes: [
    fixtureRecipe(1, { rating: '4.5', image: 'http://example.com/insecure.webp' }),
    fixtureRecipe(1, { name: 'Fabricated duplicate recipe' }),
    fixtureRecipe('3', { name: 'Fabricated numeric-string recipe' }),
    fixtureRecipe(4),
    fixtureRecipe(5),
    fixtureRecipe(6),
    fixtureRecipe(7, { name: 'Fabricated overflow recipe' }),
  ], total: 7, skip: 0, limit }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: partialBody }]]) })
  active = fixture
  await fixture.nav('dummyjson-recipes')
  const partialBefore = fixture.requestCount
  const partialResponse = await fixture.run()
  assert.equal(partialResponse.ok, true, partialResponse.error)
  const partialDom = await semantic(fixture)
  assert.deepEqual({ state: partialDom.state, requestBound: partialDom.requestBound, providerCount: partialDom.providerCount, trustedCount: partialDom.trustedCount, malformedCount: partialDom.malformedCount, duplicateCount: partialDom.duplicateCount, overflowCount: partialDom.overflowCount, primaryRecipeId: partialDom.primaryRecipeId }, { state: 'partial', requestBound: 'true', providerCount: 7, trustedCount: 4, malformedCount: 1, duplicateCount: 1, overflowCount: 1, primaryRecipeId: 1 })
  assert(partialDom.supplementalMalformedCount > 0)
  assert.equal(partialDom.text.includes('Fabricated duplicate recipe'), false)
  assert.equal(partialDom.text.includes('Fabricated numeric-string recipe'), false)
  assert.equal(partialDom.text.includes('Fabricated overflow recipe'), false)
  const partialFixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(partialFixtureRequests, 1)
  assert.equal(fixture.requestCount - partialBefore, partialFixtureRequests, 'Partial fixture must send zero live provider requests')
  assert.deepEqual(fixture.blockedProviders, [])
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ id: 'dummyjson-recipes', case: 'malformed/duplicate/numeric-string/overflow HTTP-200 fixture', source: 'synthetic fixture', semanticState: partialDom.state, trustedRecipes: partialDom.trustedCount, malformedRecipes: partialDom.malformedCount, duplicateRecipes: partialDom.duplicateCount, overflowRecipes: partialDom.overflowCount, fabricatedIdentitiesHidden: true, liveProviderRequests: 0 })
  await fixture.close(); active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) {
    report.errors.push(...active.errors.map(String))
    report.networkFailures = active.networkFailures
  }
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/dummyjson-recipes-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/dummyjson-recipes-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
