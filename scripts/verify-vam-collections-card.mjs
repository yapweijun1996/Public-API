import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.vam.ac.uk/v2/objects/search?q=eastern&page_size=6'
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'one live V&A request plus exact synthetic HTTP-200 semantic fixture', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const semantic = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="vam-collections"]'), first=card?.querySelector('[data-object-system-number]')
  return {layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', query:card?.dataset.requestQuery||'', pageSize:Number(card?.dataset.requestedPageSize||0), total:Number(card?.dataset.providerTotal||0), providerCount:Number(card?.dataset.providerRecordCount||0), validCount:Number(card?.dataset.validRecordCount||0), malformedCount:Number(card?.dataset.malformedRecordCount||0), duplicateCount:Number(card?.dataset.duplicateRecordCount||0), overflowCount:Number(card?.dataset.overflowRecordCount||0), primarySystemNumber:card?.dataset.primarySystemNumber||'', firstSystemNumber:first?.dataset.objectSystemNumber||'', firstAccession:first?.dataset.accessionNumber||'', text:card?.innerText||''}
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('vam-collections')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'V&A verifier must issue exactly one live provider request')
  assert(result.data && typeof result.data === 'object' && Array.isArray(result.data.records), 'V&A response records missing')
  assert(result.data.info && typeof result.data.info.record_count === 'number', 'V&A record_count must be native')
  assert(result.data.records.length > 0 && result.data.records.length <= 6, 'V&A response cardinality drifted')
  assert(result.data.records.every((record) => record && typeof record.systemNumber === 'string' && record.systemNumber.trim()), 'V&A provider system identity drifted')
  const dom = await semantic(live)
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract, query:dom.query, pageSize:dom.pageSize, total:dom.total, providerCount:dom.providerCount, validCount:dom.validCount, malformedCount:dom.malformedCount, duplicateCount:dom.duplicateCount, primarySystemNumber:dom.primarySystemNumber, firstSystemNumber:dom.firstSystemNumber }, { layout:'collection-index', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-vam-collections-first-page-v2', query:'eastern', pageSize:6, total:result.data.info.record_count, providerCount:result.data.records.length, validCount:result.data.records.length, malformedCount:0, duplicateCount:0, primarySystemNumber:result.data.records[0].systemNumber, firstSystemNumber:result.data.records[0].systemNumber })
  assert(dom.text.includes(result.data.records[0]._primaryTitle || result.data.records[0].objectType), 'Primary V&A object title/type missing from semantic DOM')
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'vam-collections', source:'live provider', exactRequest:endpoint, providerRows:result.data.records.length, providerTotal:result.data.info.record_count, primarySystemNumber:result.data.records[0].systemNumber, semanticState:dom.state, requestBound:dom.requestBound, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active = undefined

  const fixtureBody = { info:{ record_count:3, record_count_exact:true, page:1, page_size:6 }, records:[
    { systemNumber:'Ofixture1', objectType:'Painting', _primaryTitle:'Fixture Object', _images:{ _primary_thumbnail:'https://images.test/vam.jpg' } },
    { systemNumber:'Ofixture1', objectType:'Painting', _primaryTitle:'Fabricated duplicate' },
    { systemNumber:undefined, objectType:'Sculpture', _primaryTitle:'Identity-less object' },
  ] }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint, { body:fixtureBody }]]) })
  active = fixture
  await fixture.nav('vam-collections')
  const fixtureResult = await fixture.run(); assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const fixtureDom = await semantic(fixture)
  assert.equal(fixtureDom.state, 'partial'); assert.equal(fixtureDom.validCount, 1); assert.equal(fixtureDom.duplicateCount, 1); assert.equal(fixtureDom.malformedCount, 1)
  assert.equal(fixtureDom.text.includes('Fabricated duplicate'), false); assert.equal(fixtureDom.text.includes('Identity-less object'), false)
  await fixture.viewport(390, 844); const fixtureOverflow = await fixture.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1`); assert.equal(fixtureOverflow, false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1); assert.deepEqual(fixture.errors, [])
  report.checks.push({ id:'vam-collections', case:'duplicate + identity-less HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, validCount:fixtureDom.validCount, duplicateCount:fixtureDom.duplicateCount, malformedCount:fixtureDom.malformedCount, fabricatedIdentityHidden:true, liveProviderRequests:0 })
  await fixture.close(); active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures = active.networkFailures }
} finally { if (active) await active.close() }

fs.writeFileSync(`${evidence}/vam-collections-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/vam-collections-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
