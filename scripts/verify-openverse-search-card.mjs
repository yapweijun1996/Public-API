import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'space'
const limit = 8
const endpoint = `https://api.openverse.org/v1/images/?${new URLSearchParams({ q:query, page_size:String(limit), page:'1' }).toString()}`
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', source:'one live Openverse image search plus one synthetic HTTP-200 semantic fixture', checks:[], errors:[] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const trusted = (row) => uuid.test(row?.id || '') && typeof row?.license === 'string' && row.license.trim() && /^https:\/\//.test(row?.foreign_landing_url || '') && /^https:\/\//.test(row?.url || '') && typeof (row?.source || row?.provider) === 'string'
const semantic = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="openverse-search"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestMethod:card?.dataset.requestMethod||'', requestContract:card?.dataset.requestContract||'', query:card?.dataset.requestQuery||'', mediaType:card?.dataset.requestMediaType||'', limit:Number(card?.dataset.requestLimit||0), providerCount:Number(card?.dataset.providerRecordCount||0), total:Number(card?.dataset.providerTotal||0), pageCount:Number(card?.dataset.providerPageCount||0), validCount:Number(card?.dataset.validRecordCount||0), malformed:Number(card?.dataset.malformedRecordCount||0), duplicates:Number(card?.dataset.duplicateRecordCount||0), overflow:Number(card?.dataset.overflowRecordCount||0), licenseGaps:Number(card?.dataset.licenseGapCount||0), supplementalMalformed:Number(card?.dataset.supplementalMalformedCount||0), primaryMediaId:card?.dataset.primaryMediaId||'', primaryLicense:card?.dataset.primaryLicense||'', text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('openverse-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Openverse verifier must issue exactly one live provider request')
  assert.equal(result.data?.page, 1)
  assert.equal(result.data?.page_size, limit)
  assert(Number.isSafeInteger(result.data?.page_count) && result.data.page_count >= 0)
  assert(Number.isSafeInteger(result.data?.result_count) && result.data.result_count >= 0)
  assert.equal(result.data?.page_count, result.data.result_count === 0 ? 0 : Math.ceil(result.data.result_count / limit))
  const rows = result.data?.results || []
  assert.equal(rows.length, Math.min(limit, result.data.result_count))
  assert(rows.every(trusted), 'Openverse media identity/license/source contract drifted')
  const expectedPrimary = rows[0]
  const dom = await semantic(live)
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestMethod:dom.requestMethod, requestContract:dom.requestContract, query:dom.query, mediaType:dom.mediaType, limit:dom.limit, providerCount:dom.providerCount, total:dom.total, pageCount:dom.pageCount, validCount:dom.validCount, malformed:dom.malformed, duplicates:dom.duplicates, overflow:dom.overflow, licenseGaps:dom.licenseGaps, supplementalMalformed:dom.supplementalMalformed, primaryMediaId:dom.primaryMediaId, primaryLicense:dom.primaryLicense }, { layout:'licensed-media-search', fallback:'false', state:'ready', requestBound:'true', requestMethod:'GET', requestContract:'exact-openverse-search-v1', query, mediaType:'image', limit, providerCount:rows.length, total:result.data.result_count, pageCount:result.data.page_count, validCount:rows.length, malformed:0, duplicates:0, overflow:0, licenseGaps:0, supplementalMalformed:0, primaryMediaId:expectedPrimary.id.toLowerCase(), primaryLicense:expectedPrimary.license.toLowerCase() })
  assert(dom.text.includes(expectedPrimary.license), 'Primary Openverse license missing from semantic DOM')
  assert(dom.text.includes('Verify the license and attribution requirements'), 'Openverse license verification caveat missing')
  await live.viewport(390,844)
  const mobile = await live.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'openverse-search', source:'live provider', exactRequest:endpoint, executedMethod:dom.requestMethod, returnedRecords:rows.length, providerTotal:result.data.result_count, primaryMediaId:expectedPrimary.id, primaryLicense:expectedPrimary.license, semanticState:dom.state, requestBound:dom.requestBound, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active=undefined

  const valid = (id, title='Trusted work') => ({ id, title, creator:'Fixture creator', license:'by', license_version:'4.0', license_url:'https://creativecommons.org/licenses/by/4.0/', foreign_landing_url:`https://example.test/work/${id}`, url:`https://example.test/media/${id}.jpg`, thumbnail:`https://example.test/thumb/${id}.jpg`, source:'fixture', provider:'fixture' })
  const first='11111111-1111-4111-8111-111111111111'
  const second='22222222-2222-4222-8222-222222222222'
  const fixtureBody = { page:1, page_count:1, page_size:limit, result_count:3, results:[ valid(first), valid(first,'Duplicate work'), { ...valid(second,'Fabricated no license'), license:null } ] }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{ body:fixtureBody }]]) })
  active = fixture
  await fixture.nav('openverse-search')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run(); assert.equal(fixtureResult.ok,true,fixtureResult.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({ state:fixtureDom.state, requestBound:fixtureDom.requestBound, validCount:fixtureDom.validCount, malformed:fixtureDom.malformed, duplicates:fixtureDom.duplicates, licenseGaps:fixtureDom.licenseGaps, primaryMediaId:fixtureDom.primaryMediaId }, { state:'partial', requestBound:'true', validCount:1, malformed:1, duplicates:1, licenseGaps:1, primaryMediaId:first })
  assert.equal(fixtureDom.text.includes('Fabricated no license'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests,1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture Openverse case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({ id:'openverse-search', case:'mixed duplicate/missing-license HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, validRecords:1, malformedRecords:1, duplicateRecords:1, licenseGaps:1, fabricatedIdentityHidden:true, liveProviderRequests:0 })
  await fixture.close(); active=undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/openverse-search-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/openverse-search-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
