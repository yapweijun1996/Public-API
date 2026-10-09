import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.postcodes.io/postcodes/SW1A1AA'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Postcodes.io request plus exact synthetic HTTP-200 semantic fixture',
  checks: [], errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const normalize = (value) => typeof value === 'string' ? value.toUpperCase().replace(/\s+/g, '') : ''
const validLive = (body) => Boolean(body && typeof body === 'object' && Number.isSafeInteger(body.status) && body.status === 200
  && body.result && typeof body.result === 'object'
  && normalize(body.result.postcode) === 'SW1A1AA'
  && Number.isSafeInteger(body.result.quality) && body.result.quality > 0
  && typeof body.result.latitude === 'number' && Number.isFinite(body.result.latitude) && body.result.latitude >= -90 && body.result.latitude <= 90
  && typeof body.result.longitude === 'number' && Number.isFinite(body.result.longitude) && body.result.longitude >= -180 && body.result.longitude <= 180
  && typeof body.result.country === 'string' && body.result.country.trim())
const semantic = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="postcodes-io"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'',
    requestedPostcode:card?.dataset.requestedPostcode||'', providerPostcode:card?.dataset.providerPostcode||'',
    quality:Number(card?.dataset.postcodeQuality||0), latitude:Number(card?.dataset.latitude||0), longitude:Number(card?.dataset.longitude||0),
    supplementalMalformedCount:Number(card?.dataset.supplementalMalformedCount||0),
    adminDistrictCode:card?.dataset.adminDistrictCode||'', adminWardCode:card?.dataset.adminWardCode||'', text:card?.innerText||''
  };
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('postcodes-io')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Postcodes.io verifier must issue exactly one live provider request')
  assert(validLive(result.data), 'Postcodes.io core postcode/coordinate wire contract drifted')
  const dom = await semantic(live)
  assert.deepEqual({
    layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract,
    requestedPostcode:dom.requestedPostcode, providerPostcode:normalize(dom.providerPostcode), quality:dom.quality,
    latitude:dom.latitude, longitude:dom.longitude, supplementalMalformedCount:dom.supplementalMalformedCount,
  }, {
    layout:'postcode-profile', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-postcodes-io-lookup',
    requestedPostcode:'SW1A1AA', providerPostcode:'SW1A1AA', quality:result.data.result.quality,
    latitude:result.data.result.latitude, longitude:result.data.result.longitude, supplementalMalformedCount:0,
  })
  assert(dom.text.includes(result.data.result.postcode.trim()), 'Provider postcode missing from semantic DOM')
  if (typeof result.data.result.admin_district === 'string' && result.data.result.admin_district.trim()) assert(dom.text.includes(result.data.result.admin_district.trim()), 'Administrative district missing from semantic DOM')
  await live.viewport(390,844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'postcodes-io', source:'live provider', exactRequest:endpoint, postcode:result.data.result.postcode, quality:result.data.result.quality, latitude:result.data.result.latitude, longitude:result.data.result.longitude, semanticState:dom.state, requestBound:dom.requestBound, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active=undefined

  const trusted = {
    postcode:'SW1A 1AA', quality:1, longitude:-0.141563, latitude:51.50101, country:'England', region:'London',
    admin_district:'Westminster', admin_ward:123,
    codes:{ admin_district:'E09000033', admin_ward:456, parliamentary_constituency:'E14001172' }
  }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:{status:200,result:trusted}}]]) })
  active=fixture
  await fixture.nav('postcodes-io')
  const fixtureBefore=fixture.requestCount
  const fixtureResult=await fixture.run(); assert.equal(fixtureResult.ok,true,fixtureResult.error)
  const fixtureDom=await semantic(fixture)
  assert.equal(fixtureDom.state,'partial')
  assert.equal(fixtureDom.requestBound,'true')
  assert.equal(fixtureDom.supplementalMalformedCount,2)
  assert.equal(fixtureDom.text.includes('123'),false,'Malformed ward value must be withheld')
  assert.equal(fixtureDom.text.includes('456'),false,'Malformed ward code must be withheld')
  const fixtureRequests=fixture.fixtureRequests.filter((request)=>request.url===endpoint && request.method==='GET').length
  assert.equal(fixtureRequests,1)
  assert.equal(fixture.requestCount-fixtureBefore,fixtureRequests,'Fixture Postcodes.io case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({ id:'postcodes-io', case:'malformed optional administrative HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, supplementalMalformedCount:fixtureDom.supplementalMalformedCount, malformedEvidenceHidden:true, liveProviderRequests:0 })
  await fixture.close(); active=undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/postcodes-io-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/postcodes-io-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
