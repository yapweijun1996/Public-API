import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'artificial intelligence'
const limit = 8
const fields = 'key,title,author_name,first_publish_year,cover_i'
const endpoint = `https://openlibrary.org/search.json?${new URLSearchParams({ q: query, limit: String(limit), fields }).toString()}`
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'one live Open Library search plus exact synthetic HTTP-200 semantic fixture', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const workKey = (value) => typeof value === 'string' && /^\/?(?:works\/)?OL\d+W$/i.test(value) ? (value.startsWith('/') ? value : `/works/${value}`) : ''
const validWork = (row) => Boolean(row && typeof row === 'object' && workKey(row.key) && typeof row.title === 'string' && row.title.trim())
const semantic = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="open-library-search"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', requestQuery:card?.dataset.requestQuery||'', requestLimit:Number(card?.dataset.requestLimit||0), queryEchoContract:card?.dataset.queryEchoContract||'', countContract:card?.dataset.countContract||'', providerTotal:Number(card?.dataset.providerTotal||0), providerStart:Number(card?.dataset.providerStart||0), providerRecordCount:Number(card?.dataset.providerRecordCount||0), validRecordCount:Number(card?.dataset.validRecordCount||0), malformedRecordCount:Number(card?.dataset.malformedRecordCount||0), duplicateRecordCount:Number(card?.dataset.duplicateRecordCount||0), overflowRecordCount:Number(card?.dataset.overflowRecordCount||0), primaryWorkKey:card?.dataset.primaryWorkKey||'', text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('open-library-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Open Library verifier must issue exactly one live provider request')
  assert.equal(result.data?.q, query, 'Open Library query acknowledgement drifted')
  const total = Number.isSafeInteger(result.data?.numFound) ? result.data.numFound : result.data?.num_found
  assert.equal(Number.isSafeInteger(total) && total >= 0, true, 'Open Library total must remain a native non-negative integer')
  assert.equal(result.data?.start, 0, 'Open Library first-page start drifted')
  assert(Array.isArray(result.data?.docs), 'Open Library live response missing docs[]')
  assert.equal(result.data.docs.length, Math.min(limit, total), 'Open Library live result cardinality drifted')
  assert(result.data.docs.length > 0, 'Open Library default search returned no work records')
  assert(result.data.docs.every(validWork), 'Open Library work key/title identity contract drifted')
  const expectedPrimary = workKey(result.data.docs[0].key)
  const dom = await semantic(live)
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract, requestQuery:dom.requestQuery, requestLimit:dom.requestLimit, queryEchoContract:dom.queryEchoContract, countContract:dom.countContract, providerTotal:dom.providerTotal, providerStart:dom.providerStart, providerRecordCount:dom.providerRecordCount, validRecordCount:dom.validRecordCount, malformedRecordCount:dom.malformedRecordCount, duplicateRecordCount:dom.duplicateRecordCount, overflowRecordCount:dom.overflowRecordCount, primaryWorkKey:dom.primaryWorkKey }, { layout:'book-search', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-open-library-search-first-page', requestQuery:query, requestLimit:limit, queryEchoContract:'true', countContract:'true', providerTotal:total, providerStart:0, providerRecordCount:result.data.docs.length, validRecordCount:result.data.docs.length, malformedRecordCount:0, duplicateRecordCount:0, overflowRecordCount:0, primaryWorkKey:expectedPrimary })
  assert(dom.text.includes(result.data.docs[0].title.trim()), 'Open Library primary title missing from semantic DOM')
  assert(dom.text.includes(expectedPrimary), 'Open Library primary work identity missing from semantic DOM')
  await live.viewport(390,844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'open-library-search', source:'live provider', exactRequest:endpoint, returnedRecords:result.data.docs.length, total, primaryWorkKey:expectedPrimary, semanticState:dom.state, requestBound:dom.requestBound, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active=undefined

  const record = (key,title) => ({ key, title, author_name:['Fixture Author'], first_publish_year:2026, cover_i:123 })
  const fixtureBody = { numFound:3, num_found:3, start:0, numFoundExact:true, q:query, docs:[record('/works/OL1W','Trusted fixture work'), record('','Fabricated missing identity'), record('/works/OL1W','Fabricated duplicate identity')] }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:fixtureBody}]]) })
  active=fixture
  await fixture.nav('open-library-search')
  const fixtureBefore=fixture.requestCount
  const fixtureResult=await fixture.run(); assert.equal(fixtureResult.ok,true,fixtureResult.error)
  const fixtureDom=await semantic(fixture)
  assert.deepEqual({ state:fixtureDom.state, requestBound:fixtureDom.requestBound, countContract:fixtureDom.countContract, validRecordCount:fixtureDom.validRecordCount, malformedRecordCount:fixtureDom.malformedRecordCount, duplicateRecordCount:fixtureDom.duplicateRecordCount, primaryWorkKey:fixtureDom.primaryWorkKey }, { state:'partial', requestBound:'true', countContract:'true', validRecordCount:1, malformedRecordCount:1, duplicateRecordCount:1, primaryWorkKey:'/works/OL1W' })
  assert.equal(fixtureDom.text.includes('Fabricated missing identity'),false)
  assert.equal(fixtureDom.text.includes('Fabricated duplicate identity'),false)
  const fixtureRequests=fixture.fixtureRequests.filter((request)=>request.url===endpoint && request.method==='GET').length
  assert.equal(fixtureRequests,1)
  assert.equal(fixture.requestCount-fixtureBefore,fixtureRequests,'Fixture Open Library case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({ id:'open-library-search', case:'mixed malformed/duplicate work identity HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, validRecords:1, malformedRecords:1, duplicateRecords:1, fabricatedIdentityHidden:true, liveProviderRequests:0 })
  await fixture.close(); active=undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/open-library-search-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/open-library-search-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
