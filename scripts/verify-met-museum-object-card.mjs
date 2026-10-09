import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://collectionapi.metmuseum.org/public/collection/v1/objects/436535'
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', source:'one live Met Collection API object request plus one synthetic rights-conflict fixture', checks:[], errors:[] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const semantic = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="met-museum-object-detail"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', objectId:Number(card?.dataset.objectId||0), accession:card?.dataset.accessionNumber||'', publicDomain:card?.dataset.publicDomain||'', openAccessImage:card?.dataset.openAccessImage||'', rightsConflict:card?.dataset.rightsConflict||'', imageMalformed:Number(card?.dataset.imageMalformedCount||0), optionalMalformed:Number(card?.dataset.optionalMalformedCount||0), images:card?.querySelectorAll('img').length||0, metLinks:card?.querySelectorAll('a[href*="metmuseum.org"]').length||0, text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('met-museum-object-detail')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const response = await live.run()
  assert.equal(response.ok, true, response.error)
  assert.equal(live.requestCount - before, 1, 'Met verifier must issue exactly one live provider request')
  assert.equal(response.data?.objectID, 436535)
  assert.equal(response.data?.isPublicDomain, true)
  assert.equal(response.data?.accessionNumber, '1993.132')
  assert.equal(typeof response.data?.title, 'string')
  assert(/^https:\/\/images\.metmuseum\.org\//.test(response.data?.primaryImageSmall || response.data?.primaryImage || ''))
  assert.equal(response.data?.rightsAndReproduction, '')
  const dom = await semantic(live)
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract, objectId:dom.objectId, accession:dom.accession, publicDomain:dom.publicDomain, openAccessImage:dom.openAccessImage, rightsConflict:dom.rightsConflict, imageMalformed:dom.imageMalformed, optionalMalformed:dom.optionalMalformed, images:dom.images }, { layout:'met-open-access-object', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-met-object-436535', objectId:436535, accession:'1993.132', publicDomain:'true', openAccessImage:'true', rightsConflict:'false', imageMalformed:0, optionalMalformed:0, images:1 })
  assert(dom.metLinks >= 2)
  assert(dom.text.includes('CC0'))
  await live.viewport(390,844)
  const mobile = await live.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'met-museum-object-detail', source:'live provider', exactRequest:endpoint, objectId:response.data.objectID, accessionNumber:response.data.accessionNumber, title:response.data.title, semanticState:dom.state, requestBound:dom.requestBound, publicDomain:true, openAccessImage:true, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active=undefined

  const fixtureBody = { ...response.data, rightsAndReproduction:'© Fabricated rights holder', isPublicDomain:true }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{ body:fixtureBody }]]) })
  active = fixture
  await fixture.nav('met-museum-object-detail')
  const fixtureBefore = fixture.requestCount
  const fixtureResponse = await fixture.run(); assert.equal(fixtureResponse.ok,true,fixtureResponse.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({ state:fixtureDom.state, requestBound:fixtureDom.requestBound, objectId:fixtureDom.objectId, publicDomain:fixtureDom.publicDomain, openAccessImage:fixtureDom.openAccessImage, rightsConflict:fixtureDom.rightsConflict, images:fixtureDom.images }, { state:'invalid', requestBound:'true', objectId:436535, publicDomain:'true', openAccessImage:'false', rightsConflict:'true', images:0 })
  assert.equal(fixtureDom.text.includes('CC0 image verified'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests,1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture Met case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({ id:'met-museum-object-detail', case:'public-domain/rights-conflict HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, rightsConflict:true, openAccessImage:false, embeddedImages:0, liveProviderRequests:0 })
  await fixture.close(); active=undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/met-museum-object-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/met-museum-object-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
