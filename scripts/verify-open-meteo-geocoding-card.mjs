import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const name = 'Singapore'
const count = 6
const endpoint = `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name, count: String(count), language: 'en', format: 'json' }).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Open-Meteo geocoding request plus exact synthetic HTTP-200 semantic fixture',
  checks: [], errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const validPlace = (row) => Boolean(row && typeof row === 'object'
  && Number.isSafeInteger(row.id) && row.id > 0
  && typeof row.name === 'string' && row.name.trim()
  && typeof row.latitude === 'number' && Number.isFinite(row.latitude) && row.latitude >= -90 && row.latitude <= 90
  && typeof row.longitude === 'number' && Number.isFinite(row.longitude) && row.longitude >= -180 && row.longitude <= 180)
const semantic = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="open-meteo-geocoding"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', requestName:card?.dataset.requestName||'',
    requestCount:Number(card?.dataset.requestCount||0), providerRecordCount:Number(card?.dataset.providerRecordCount||0),
    validRecordCount:Number(card?.dataset.validRecordCount||0), invalidRecordCount:Number(card?.dataset.invalidRecordCount||0),
    duplicateRecordCount:Number(card?.dataset.duplicateRecordCount||0), overflowRecordCount:Number(card?.dataset.overflowRecordCount||0),
    primaryLocationId:Number(card?.dataset.primaryLocationId||0), identityField:card?.dataset.identityField||'', text:card?.innerText||''
  };
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('geocoding-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Open-Meteo geocoding verifier must issue exactly one live provider request')
  assert.equal(typeof result.data?.generationtime_ms, 'number', 'generationtime_ms must remain a native number')
  assert(result.data.generationtime_ms >= 0, 'generationtime_ms must remain non-negative')
  assert(Array.isArray(result.data?.results), 'Default Open-Meteo geocoding response missing results[]')
  assert(result.data.results.length > 0 && result.data.results.length <= count, 'Open-Meteo result cardinality drifted')
  assert(result.data.results.every(validPlace), 'Open-Meteo location ID/WGS84 identity contract drifted')
  assert.equal(new Set(result.data.results.map((row) => row.id)).size, result.data.results.length, 'Open-Meteo returned duplicate location IDs')
  const expectedPrimary = result.data.results[0].id
  const dom = await semantic(live)
  assert.deepEqual({
    layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract,
    requestName:dom.requestName, requestCount:dom.requestCount, providerRecordCount:dom.providerRecordCount, validRecordCount:dom.validRecordCount,
    invalidRecordCount:dom.invalidRecordCount, duplicateRecordCount:dom.duplicateRecordCount, overflowRecordCount:dom.overflowRecordCount,
    primaryLocationId:dom.primaryLocationId, identityField:dom.identityField,
  }, {
    layout:'place-geocoding', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-open-meteo-geocoding',
    requestName:name, requestCount:count, providerRecordCount:result.data.results.length, validRecordCount:result.data.results.length,
    invalidRecordCount:0, duplicateRecordCount:0, overflowRecordCount:0, primaryLocationId:expectedPrimary, identityField:'id',
  })
  assert(dom.text.includes(result.data.results[0].name.trim()), 'Open-Meteo primary place missing from semantic DOM')
  await live.viewport(390,844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'geocoding-search', source:'live provider', exactRequest:endpoint, returnedRecords:result.data.results.length, primaryLocationId:expectedPrimary, semanticState:dom.state, requestBound:dom.requestBound, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active=undefined

  const trusted = { id:1880252, name:'Trusted Singapore fixture', latitude:1.28967, longitude:103.85007, country:'Singapore', country_code:'SG', timezone:'Asia/Singapore', population:5638700 }
  const fixtureBody = { generationtime_ms:0.1, results:[trusted, { ...trusted, id:1880253, name:'Fabricated numeric-string coordinate', latitude:'1.3000' }, { ...trusted, name:'Fabricated duplicate identity' }] }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:fixtureBody}]]) })
  active=fixture
  await fixture.nav('geocoding-search')
  const fixtureBefore=fixture.requestCount
  const fixtureResult=await fixture.run(); assert.equal(fixtureResult.ok,true,fixtureResult.error)
  const fixtureDom=await semantic(fixture)
  assert.deepEqual({ state:fixtureDom.state, requestBound:fixtureDom.requestBound, validRecordCount:fixtureDom.validRecordCount, invalidRecordCount:fixtureDom.invalidRecordCount, duplicateRecordCount:fixtureDom.duplicateRecordCount, overflowRecordCount:fixtureDom.overflowRecordCount, primaryLocationId:fixtureDom.primaryLocationId }, { state:'partial', requestBound:'true', validRecordCount:1, invalidRecordCount:2, duplicateRecordCount:1, overflowRecordCount:0, primaryLocationId:1880252 })
  assert.equal(fixtureDom.text.includes('Fabricated numeric-string coordinate'),false)
  assert.equal(fixtureDom.text.includes('Fabricated duplicate identity'),false)
  const fixtureRequests=fixture.fixtureRequests.filter((request)=>request.url===endpoint && request.method==='GET').length
  assert.equal(fixtureRequests,1)
  assert.equal(fixture.requestCount-fixtureBefore,fixtureRequests,'Fixture Open-Meteo case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({ id:'geocoding-search', case:'mixed numeric-string/duplicate location identity HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, validRecords:1, invalidRecords:2, duplicateRecords:1, fabricatedIdentityHidden:true, liveProviderRequests:0 })
  await fixture.close(); active=undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/open-meteo-geocoding-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/open-meteo-geocoding-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
