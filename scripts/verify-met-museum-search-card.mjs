import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&q=singapore&offset=0&limit=12'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Met Collection API v1.1 request plus exact synthetic HTTP-200 identity fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const semantic = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="met-museum-search"]'), first=card?.querySelector('[data-met-object-id]')
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', contract:card?.dataset.requestContract||'', version:card?.dataset.endpointVersion||'',
    query:card?.dataset.requestQuery||'', hasImages:card?.dataset.requestHasImages||'', offset:Number(card?.dataset.requestOffset||-1), limit:Number(card?.dataset.requestLimit||0),
    total:Number(card?.dataset.providerTotal||0), providerCount:Number(card?.dataset.providerObjectCount||0), validCount:Number(card?.dataset.validObjectCount||0),
    malformedCount:Number(card?.dataset.malformedObjectCount||0), duplicateCount:Number(card?.dataset.duplicateObjectCount||0), overflowCount:Number(card?.dataset.overflowObjectCount||0),
    countContract:card?.dataset.countContract||'', primaryId:Number(card?.dataset.primaryObjectId||0), firstId:Number(first?.dataset.metObjectId||0), text:card?.innerText||''
  }
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('met-museum-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Met verifier must issue exactly one live provider request')
  assert(result.data && typeof result.data === 'object' && !Array.isArray(result.data), 'Met search response object missing')
  assert.equal(typeof result.data.total, 'number', 'Met total must be native number')
  assert(Number.isSafeInteger(result.data.total) && result.data.total >= 0, 'Met total must be a non-negative safe integer')
  assert(Array.isArray(result.data.objectIDs), 'Met objectIDs array missing')
  assert.equal(result.data.objectIDs.length, Math.min(12, result.data.total), 'Met v1.1 first-page cardinality drifted')
  assert(result.data.objectIDs.every((id) => Number.isSafeInteger(id) && id > 0), 'Met provider Object ID wire type drifted')
  assert.equal(new Set(result.data.objectIDs).size, result.data.objectIDs.length, 'Met live first page contains duplicate Object IDs')

  const dom = await semantic(live)
  assert.deepEqual(
    { layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, contract:dom.contract, version:dom.version, query:dom.query, hasImages:dom.hasImages, offset:dom.offset, limit:dom.limit, total:dom.total, providerCount:dom.providerCount, validCount:dom.validCount, malformedCount:dom.malformedCount, duplicateCount:dom.duplicateCount, overflowCount:dom.overflowCount, countContract:dom.countContract, primaryId:dom.primaryId, firstId:dom.firstId },
    { layout:'collection-index', fallback:'false', state:'ready', requestBound:'true', contract:'exact-met-collection-v1.1-first-page', version:'v1.1', query:'singapore', hasImages:'true', offset:0, limit:12, total:result.data.total, providerCount:result.data.objectIDs.length, validCount:result.data.objectIDs.length, malformedCount:0, duplicateCount:0, overflowCount:0, countContract:'true', primaryId:result.data.objectIDs[0], firstId:result.data.objectIDs[0] },
  )
  assert(dom.text.includes(String(result.data.objectIDs[0])), 'Primary Met Object ID missing from semantic DOM')
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'met-museum-search', source:'live provider', exactRequest:endpoint, providerTotal:result.data.total, providerRows:result.data.objectIDs.length, primaryObjectId:result.data.objectIDs[0], semanticState:dom.state, requestBound:dom.requestBound, endpointVersion:dom.version, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active = undefined

  const fixtureBody = { total:3, objectIDs:[728323, '264585', 728323] }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint, { body:fixtureBody }]]) })
  active = fixture
  await fixture.nav('met-museum-search')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  assert.equal(fixture.requestCount - fixtureBefore, 1, 'Met fixture must consume exactly one synthetic provider request')
  const fixtureDom = await semantic(fixture)
  assert.equal(fixtureDom.state, 'partial')
  assert.equal(fixtureDom.validCount, 1)
  assert.equal(fixtureDom.malformedCount, 1)
  assert.equal(fixtureDom.duplicateCount, 1)
  assert.equal(fixtureDom.primaryId, 728323)
  assert.equal(fixtureDom.text.includes('264585'), false)
  assert.equal(fixture.blockedProviders.length, 0, `Unexpected live-provider escape: ${JSON.stringify(fixture.blockedProviders)}`)
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ id:'met-museum-search', case:'numeric-string + duplicate Object ID HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, validCount:fixtureDom.validCount, malformedCount:fixtureDom.malformedCount, duplicateCount:fixtureDom.duplicateCount, fabricatedIdentityHidden:true, liveProviderRequests:0 })
  await fixture.close(); active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) {
    report.errors.push(...active.errors.map(String))
    report.networkFailures = active.networkFailures
    report.blockedProviders = active.blockedProviders
  }
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/met-museum-search-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/met-museum-search-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
