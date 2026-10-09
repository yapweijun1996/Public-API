import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const barcode = '3017620422003'
const fields = 'code,product_name,quantity,nutriscore_grade,nova_group,nutriments,image_front_url,ingredients_text,allergens_tags,categories_tags'
const endpoint = `https://world.openfoodfacts.org/api/v3/product/${barcode}?${new URLSearchParams({ fields }).toString()}`
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', source:'one live Open Food Facts v3 product read plus exact synthetic HTTP-200 semantic fixture', checks:[], errors:[] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const semantic = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="open-food-facts-product"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', requestBarcode:card?.dataset.requestBarcode||'', canonicalBarcode:card?.dataset.canonicalBarcode||'', barcodeNormalized:card?.dataset.barcodeNormalized||'', identityContract:card?.dataset.identityContract||'', optionalContract:card?.dataset.optionalContract||'', nutritionFactCount:Number(card?.dataset.nutritionFactCount||0), productName:card?.dataset.primaryProductName||'', text:card?.innerText||'' }; })()`)
const nativeNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('open-food-facts')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Open Food Facts verifier must issue exactly one live product Fetch')
  assert.equal(result.data?.status, 'success')
  assert.equal(result.data?.result?.id, 'product_found')
  assert.equal(typeof result.data?.code, 'string')
  assert.equal(result.data?.product?.code, result.data?.code)
  assert.equal(typeof result.data?.product?.product_name, 'string')
  assert(result.data.product.product_name.trim(), 'Open Food Facts live response missing product_name')
  const nutritionKeys = ['energy-kcal_100g','fat_100g','saturated-fat_100g','carbohydrates_100g','sugars_100g','proteins_100g','salt_100g']
  const expectedNutritionCount = nutritionKeys.filter((key) => result.data.product.nutriments?.[key] !== undefined && result.data.product.nutriments?.[key] !== null).length
  assert(nutritionKeys.every((key) => result.data.product.nutriments?.[key] === undefined || result.data.product.nutriments?.[key] === null || nativeNumber(result.data.product.nutriments[key])), 'Open Food Facts live nutrition wire type drifted')
  const dom = await semantic(live)
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract, requestBarcode:dom.requestBarcode, canonicalBarcode:dom.canonicalBarcode, identityContract:dom.identityContract, optionalContract:dom.optionalContract, nutritionFactCount:dom.nutritionFactCount, productName:dom.productName }, { layout:'food-product', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-v3-product-fields', requestBarcode:barcode, canonicalBarcode:result.data.product.code, identityContract:'true', optionalContract:'true', nutritionFactCount:expectedNutritionCount, productName:result.data.product.product_name.trim() })
  assert(dom.text.includes(result.data.product.product_name.trim()))
  assert(dom.text.includes(result.data.product.code))
  await live.viewport(390,844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'open-food-facts', source:'live provider', exactRequest:endpoint, providerStatus:result.data.status, canonicalBarcode:result.data.product.code, productName:result.data.product.product_name.trim(), nutritionFactCount:expectedNutritionCount, semanticState:dom.state, requestBound:dom.requestBound, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active=undefined

  const fixtureBody = {
    code:barcode, errors:[], result:{ id:'product_found', name:'Product found' }, status:'success', warnings:[],
    product:{ code:barcode, product_name:'Fixture Product', quantity:'100 g', nutriscore_grade:'a', nova_group:2, ingredients_text:'Fixture ingredient', allergens_tags:['en:milk'], categories_tags:['en:snacks'], nutriments:{ 'energy-kcal_100g':'999', sugars_100g:4.2 } },
  }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:fixtureBody}]]) })
  active=fixture
  await fixture.nav('open-food-facts')
  const fixtureBefore=fixture.requestCount
  const fixtureResult=await fixture.run(); assert.equal(fixtureResult.ok,true,fixtureResult.error)
  const fixtureDom=await semantic(fixture)
  assert.deepEqual({ state:fixtureDom.state, requestBound:fixtureDom.requestBound, identityContract:fixtureDom.identityContract, optionalContract:fixtureDom.optionalContract, nutritionFactCount:fixtureDom.nutritionFactCount, canonicalBarcode:fixtureDom.canonicalBarcode }, { state:'partial', requestBound:'true', identityContract:'true', optionalContract:'false', nutritionFactCount:1, canonicalBarcode:barcode })
  assert.equal(fixtureDom.text.includes('999 kcal'),false)
  assert.equal(fixtureDom.text.includes('4.2 g'),true)
  const fixtureRequests=fixture.fixtureRequests.filter((request)=>request.url===endpoint&&request.method==='GET').length
  assert.equal(fixtureRequests,1)
  assert.equal(fixture.requestCount-fixtureBefore,fixtureRequests,'Fixture Open Food Facts case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({ id:'open-food-facts', case:'numeric-string nutrition HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, trustedNutritionFacts:1, malformedNutritionWithheld:true, liveProviderRequests:0 })
  await fixture.close(); active=undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/open-food-facts-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/open-food-facts-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
