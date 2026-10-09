import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const defaultEndpoint = 'https://api.opencitations.net/index/v2/citation-count/doi:10.1109%2F5.771073'
const missingDoi = '10.99999/public-api-nonexistent-20260911'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live OpenCitations Index v2 citation-count responses plus one exact synthetic malformed HTTP-200 fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setInput = (b, selector, value) => b.ev(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`)
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('opencitations-index')
  const live = await b.run()
  assert.equal(live.ok, true, live.error)
  assert(Array.isArray(live.data) && live.data.length === 1, 'OpenCitations citation-count did not return one record')
  const liveCount = Number(live.data[0]?.count)
  assert(Number.isInteger(liveCount) && liveCount >= 0, 'OpenCitations returned an invalid live count')
  const liveDom = await b.ev(`(()=>{const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('.opencitations-preview');return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',records:Number(card?.dataset.providerRecordCount),contract:card?.dataset.countContractValid||'',doi:card?.dataset.primaryDoi||'',count:Number(card?.dataset.incomingCitationCount),direction:card?.dataset.citationDirection||'',index:card?.dataset.citationIndex||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
  assert.deepEqual({ layout:liveDom.layout, fallback:liveDom.fallback, state:liveDom.state, records:liveDom.records, contract:liveDom.contract }, { layout:'citation-count', fallback:'false', state:'ready', records:1, contract:'true' })
  assert.equal(liveDom.doi, '10.1109/5.771073'); assert.equal(liveDom.count, liveCount); assert.equal(liveDom.direction, 'incoming'); assert.equal(liveDom.index, 'OpenCitations Index v2'); assert.equal(liveDom.overflow, false)
  await b.viewport(390,844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  let ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'opencitations-index', case:'live DOI-bound count', count:'exact response match', semanticState:'ready', mobileOverflow:false, unnamedControls:0 })

  await b.nav('opencitations-index')
  await setInput(b, '.parameter-card input[name="doi"]', missingDoi)
  const zero = await b.run()
  assert.equal(zero.ok, true, zero.error)
  assert.deepEqual(zero.data, [{ count:'0' }])
  const zeroDom = await b.ev(`(()=>{const card=document.querySelector('.opencitations-preview');return {state:card?.dataset.resultState||'',doi:card?.dataset.primaryDoi||'',count:Number(card?.dataset.incomingCitationCount),text:card?.innerText||''}})()`)
  assert.equal(zeroDom.state, 'ready'); assert.equal(zeroDom.doi, missingDoi); assert.equal(zeroDom.count, 0); assert.match(zeroDom.text, /0 incoming citations/); assert.match(zeroDom.text, /zero count means the Index currently records no incoming citations/i)
  await b.viewport(390,844); ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'opencitations-index', case:'live unknown DOI', providerCount:0, semanticState:'ready-not-empty', mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[defaultEndpoint, { body: { count:'98' } }]]) })
  try {
    await malformed.nav('opencitations-index')
    const result = await malformed.run()
    assert.equal(result.ok, true, result.error)
    const dom = await malformed.ev(`(()=>{const card=document.querySelector('[data-domain-card="citation-count"]');return {state:card?.dataset.resultState||'',text:card?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(dom.state, 'invalid'); assert.match(dom.text, /documented citation-count result array/); assert.match(dom.http, /^200/)
    assert.equal(malformed.fixtureRequests.filter((request) => request.url === defaultEndpoint && request.method === 'GET').length, 1)
    assert.deepEqual(malformed.errors, [])
    report.checks.push({ id:'opencitations-index', case:'synthetic malformed HTTP-200 envelope', transportStatus:200, semanticState:'invalid', exactProviderFixtureRequests:1 })
  } finally { await malformed.close() }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/opencitations-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/opencitations-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
