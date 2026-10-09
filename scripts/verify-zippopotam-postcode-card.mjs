import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.zippopotam.us/us/10001'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Zippopotam.us request plus synthetic malformed/duplicate and identity-mismatch HTTP-200 fixtures',
  checks: [], errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const validLive = (body) => Boolean(body && typeof body === 'object'
  && typeof body['post code'] === 'string' && body['post code'].trim() === '10001'
  && typeof body['country abbreviation'] === 'string' && body['country abbreviation'].trim().toUpperCase() === 'US'
  && Array.isArray(body.places) && body.places.length > 0
  && body.places.every((place) => place && typeof place['place name'] === 'string'
    && typeof place.latitude === 'string' && Number.isFinite(Number(place.latitude))
    && typeof place.longitude === 'string' && Number.isFinite(Number(place.longitude))))
const semantic = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="zippopotam-postcode"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'',
    requestedCountry:card?.dataset.requestedCountry||'', requestedPostcode:card?.dataset.requestedPostcode||'',
    providerCountryAbbreviation:card?.dataset.providerCountryAbbreviation||'', providerPostcode:card?.dataset.providerPostcode||'',
    providerPlaceCount:Number(card?.dataset.providerPlaceCount||0), validPlaceCount:Number(card?.dataset.validPlaceCount||0),
    invalidPlaceCount:Number(card?.dataset.invalidPlaceCount||0), duplicatePlaceCount:Number(card?.dataset.duplicatePlaceCount||0),
    text:card?.innerText||''
  };
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('zippopotam-postcode')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Zippopotam.us verifier must issue exactly one live provider request')
  assert(validLive(result.data), 'Zippopotam.us provider postcode/place wire contract drifted')
  const dom = await semantic(live)
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract, requestedCountry:dom.requestedCountry, requestedPostcode:dom.requestedPostcode, providerCountryAbbreviation:dom.providerCountryAbbreviation, providerPostcode:dom.providerPostcode, providerPlaceCount:dom.providerPlaceCount, validPlaceCount:dom.validPlaceCount }, {
    layout:'postcode-geolocation', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-zippopotam-postcode-lookup', requestedCountry:'US', requestedPostcode:'10001', providerCountryAbbreviation:'US', providerPostcode:'10001', providerPlaceCount:result.data.places.length, validPlaceCount:result.data.places.length,
  })
  assert(dom.text.includes(result.data.places[0]['place name']), 'Provider place name missing from semantic DOM')
  await live.viewport(390,844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'zippopotam-postcode', source:'live provider', exactRequest:endpoint, providerPostcode:result.data['post code'], providerCountryAbbreviation:result.data['country abbreviation'], providerPlaceCount:result.data.places.length, semanticState:dom.state, requestBound:dom.requestBound, coordinateWireType:'documented JSON strings', browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active=undefined

  const validPlace = { 'place name':'New York', state:'New York', 'state abbreviation':'NY', latitude:'40.7128', longitude:'-74.0060' }
  const partialFixture = { 'post code':'10001', country:'United States', 'country abbreviation':'US', places:[validPlace, { ...validPlace, 'place name':'Numeric coordinate row', latitude:40.7 }, validPlace] }
  const partial = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:partialFixture}]]) })
  active=partial
  await partial.nav('zippopotam-postcode')
  const partialBefore=partial.requestCount
  const partialResult=await partial.run(); assert.equal(partialResult.ok,true,partialResult.error)
  const partialDom=await semantic(partial)
  assert.equal(partialDom.state,'partial')
  assert.equal(partialDom.requestBound,'true')
  assert.equal(partialDom.validPlaceCount,1)
  assert.equal(partialDom.invalidPlaceCount,2)
  assert.equal(partialDom.duplicatePlaceCount,1)
  assert.equal(partialDom.text.includes('Numeric coordinate row'),false)
  const partialRequests=partial.fixtureRequests.filter((request)=>request.url===endpoint && request.method==='GET').length
  assert.equal(partialRequests,1)
  assert.equal(partial.requestCount-partialBefore,partialRequests,'Synthetic Zippopotam.us fixture must send zero live provider requests')
  assert.deepEqual(partial.blockedProviders,[])
  assert.deepEqual(partial.errors,[])
  report.checks.push({ id:'zippopotam-postcode', case:'malformed coordinate and duplicate HTTP-200 fixture', source:'synthetic fixture', semanticState:partialDom.state, validPlaceCount:partialDom.validPlaceCount, invalidPlaceCount:partialDom.invalidPlaceCount, duplicatePlaceCount:partialDom.duplicatePlaceCount, malformedEvidenceHidden:true, liveProviderRequests:0 })
  await partial.close(); active=undefined

  const identityFixture = { ...partialFixture, 'country abbreviation':'CA' }
  const identity = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:identityFixture}]]) })
  active=identity
  await identity.nav('zippopotam-postcode')
  const identityBefore=identity.requestCount
  const identityResult=await identity.run(); assert.equal(identityResult.ok,true,identityResult.error)
  const identityDom=await semantic(identity)
  assert.equal(identityDom.state,'invalid')
  assert.equal(identityDom.requestBound,'true')
  assert.equal(identityDom.validPlaceCount,0)
  assert.equal(identityDom.text.includes('New York'),false)
  const identityRequests=identity.fixtureRequests.filter((request)=>request.url===endpoint && request.method==='GET').length
  assert.equal(identityRequests,1)
  assert.equal(identity.requestCount-identityBefore,identityRequests,'Identity fixture must send zero live provider requests')
  assert.deepEqual(identity.blockedProviders,[])
  assert.deepEqual(identity.errors,[])
  report.checks.push({ id:'zippopotam-postcode', case:'provider country-identity mismatch HTTP-200 fixture', source:'synthetic fixture', semanticState:identityDom.state, requestBound:identityDom.requestBound, identityEvidenceHidden:true, liveProviderRequests:0 })
  await identity.close(); active=undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures; report.blockedProviders=active.blockedProviders }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/zippopotam-postcode-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/zippopotam-postcode-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
