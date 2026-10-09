import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.openbrewerydb.org/v1/breweries?by_country=united_states&per_page=8'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Open Brewery DB request plus exact synthetic HTTP-200 semantic fixture',
  checks: [], errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const norm = (value) => typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s-]+/g, '_') : ''
const validCore = (row) => Boolean(row && typeof row === 'object'
  && typeof row.id === 'string' && row.id.trim()
  && typeof row.name === 'string' && row.name.trim()
  && typeof row.brewery_type === 'string' && row.brewery_type.trim()
  && typeof row.city === 'string' && row.city.trim()
  && typeof row.state_province === 'string' && row.state_province.trim()
  && typeof row.postal_code === 'string' && row.postal_code.trim()
  && norm(row.country) === 'united_states')
const semantic = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="open-brewery-directory"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'',
    requestedCountry:card?.dataset.requestedCountry||'', requestedType:card?.dataset.requestedType||'', requestLimit:Number(card?.dataset.requestLimit||0),
    providerCount:Number(card?.dataset.providerCount||0), validCount:Number(card?.dataset.validCount||0), invalidCount:Number(card?.dataset.invalidCount||0),
    duplicateCount:Number(card?.dataset.duplicateCount||0), coordinateCount:Number(card?.dataset.coordinateCount||0), optionalMalformedCount:Number(card?.dataset.optionalMalformedCount||0),
    primaryId:card?.dataset.primaryBreweryId||'', text:card?.innerText||''
  };
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('open-brewery-directory')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Open Brewery DB verifier must issue exactly one live provider request')
  assert(Array.isArray(result.data) && result.data.length > 0 && result.data.length <= 8, 'Open Brewery DB list cardinality drifted')
  assert(result.data.every(validCore), 'Open Brewery DB core brewery identity/filter contract drifted')
  const ids = result.data.map((row) => row.id.trim())
  assert.equal(new Set(ids).size, ids.length, 'Open Brewery DB live response contains duplicate brewery IDs')
  const coordinateRows = result.data.filter((row) => typeof row.latitude === 'number' && Number.isFinite(row.latitude) && typeof row.longitude === 'number' && Number.isFinite(row.longitude))
  const malformedCoordinates = result.data.filter((row) => {
    const absent = (row.latitude == null) && (row.longitude == null)
    const valid = typeof row.latitude === 'number' && Number.isFinite(row.latitude) && row.latitude >= -90 && row.latitude <= 90
      && typeof row.longitude === 'number' && Number.isFinite(row.longitude) && row.longitude >= -180 && row.longitude <= 180
    return !absent && !valid
  })
  assert.equal(malformedCoordinates.length, 0, 'Open Brewery DB live optional coordinate contract drifted')
  const dom = await semantic(live)
  assert.deepEqual({
    layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract,
    requestedCountry:dom.requestedCountry, requestedType:dom.requestedType, requestLimit:dom.requestLimit,
    providerCount:dom.providerCount, validCount:dom.validCount, invalidCount:dom.invalidCount, duplicateCount:dom.duplicateCount,
    coordinateCount:dom.coordinateCount, optionalMalformedCount:dom.optionalMalformedCount, primaryId:dom.primaryId,
  }, {
    layout:'brewery-directory', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-open-brewery-directory-v2',
    requestedCountry:'united_states', requestedType:'all', requestLimit:8,
    providerCount:result.data.length, validCount:result.data.length, invalidCount:0, duplicateCount:0,
    coordinateCount:coordinateRows.length, optionalMalformedCount:0, primaryId:result.data[0].id.trim(),
  })
  assert(dom.text.includes(result.data[0].name.trim()), 'Primary brewery name missing from semantic DOM')
  await live.viewport(390,844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'open-brewery-directory', source:'live provider', exactRequest:endpoint, providerRows:result.data.length, coordinateRows:coordinateRows.length, primaryBreweryId:result.data[0].id.trim(), semanticState:dom.state, requestBound:dom.requestBound, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active=undefined

  const fixtureRows = [
    { id:'brew-fixture-1', name:'Fixture Brewing', brewery_type:'micro', address_1:'1 Fixture St', address_2:null, address_3:null, city:'Austin', state_province:'Texas', postal_code:'78701', country:'United States', latitude:'30.2672', longitude:'-97.7431', phone:null, website_url:'https://example.com' },
    { id:'brew-fixture-1', name:'Fabricated Duplicate', brewery_type:'micro', address_1:'2 Fake St', city:'Austin', state_province:'Texas', postal_code:'78702', country:'United States', latitude:30.27, longitude:-97.74, phone:null, website_url:null },
  ]
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:fixtureRows}]]) })
  active=fixture
  await fixture.nav('open-brewery-directory')
  const fixtureBefore=fixture.requestCount
  const fixtureResult=await fixture.run(); assert.equal(fixtureResult.ok,true,fixtureResult.error)
  const fixtureDom=await semantic(fixture)
  assert.equal(fixtureDom.state,'partial')
  assert.equal(fixtureDom.requestBound,'true')
  assert.equal(fixtureDom.validCount,1)
  assert.equal(fixtureDom.invalidCount,1)
  assert.equal(fixtureDom.duplicateCount,1)
  assert.equal(fixtureDom.optionalMalformedCount,1)
  assert.equal(fixtureDom.coordinateCount,0)
  assert.equal(fixtureDom.text.includes('Fabricated Duplicate'),false,'Duplicate brewery identity must be withheld')
  const fixtureRequests=fixture.fixtureRequests.filter((request)=>request.url===endpoint && request.method==='GET').length
  assert.equal(fixtureRequests,1)
  assert.equal(fixture.requestCount-fixtureBefore,fixtureRequests,'Fixture Open Brewery DB case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({ id:'open-brewery-directory', case:'numeric-string coordinates + duplicate identity HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, validCount:fixtureDom.validCount, invalidCount:fixtureDom.invalidCount, duplicateCount:fixtureDom.duplicateCount, optionalMalformedCount:fixtureDom.optionalMalformedCount, fabricatedIdentityHidden:true, liveProviderRequests:0 })
  await fixture.close(); active=undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/open-brewery-directory-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/open-brewery-directory-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
