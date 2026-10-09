import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://query.wikidata.org/sparql?query=SELECT%20%3Fitem%20%3FitemLabel%20WHERE%20%7B%20%3Fitem%20wdt%3AP31%20wd%3AQ515%20.%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22en%22%20.%20%7D%20%7D%20LIMIT%208&format=json'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live Wikidata Query Service response plus synthetic HTTP-200 SPARQL contract fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const qid = (uri) => String(uri || '').match(/^https?:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/i)?.[1]?.toUpperCase() || ''
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('wikidata-sparql')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert.deepEqual(result.data?.head?.vars, ['item', 'itemLabel'])
  assert(Array.isArray(result.data?.results?.bindings) && result.data.results.bindings.length > 0, 'WDQS returned no city bindings')
  const expected = result.data.results.bindings.map((binding) => ({
    qid: qid(binding?.item?.value),
    uri: String(binding?.item?.value || ''),
    label: String(binding?.itemLabel?.value || ''),
    language: String(binding?.itemLabel?.['xml:lang'] || ''),
  }))
  assert(expected.every((entry) => entry.qid && entry.label), 'WDQS live binding lost entity identity or label')

  const dom = await b.ev(`(() => {
    const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('.wikidata-entity-preview')
    const entries=[...(card?.querySelectorAll('.wikidata-entity-list>li')||[])].map((row)=>({qid:row.dataset.qid||'',uri:row.dataset.entityUri||'',label:row.dataset.label||'',language:row.dataset.labelLanguage||''}))
    return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',provider:Number(card?.dataset.providerBindingCount),valid:Number(card?.dataset.validBindingCount),invalid:Number(card?.dataset.invalidBindingCount),english:Number(card?.dataset.englishLabelCount),variables:card?.dataset.sparqlVariables||'',variablesValid:card?.dataset.queryVariablesValid||'',entries,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}
  })()`)
  assert.equal(dom.layout, 'knowledge-entities'); assert.equal(dom.fallback, 'false'); assert.equal(dom.state, 'ready')
  assert.equal(dom.provider, expected.length); assert.equal(dom.valid, expected.length); assert.equal(dom.invalid, 0); assert.equal(dom.english, expected.length)
  assert.equal(dom.variables, 'item,itemLabel'); assert.equal(dom.variablesValid, 'true'); assert.deepEqual(dom.entries, expected); assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'wikidata-sparql', case:'live bounded SPARQL contract', semanticState:'ready', bindings:expected.length, identity:'QID/URI/label/language exact response match', variables:'item,itemLabel exact', mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: { head:{ vars:['item','itemLabel'] }, results:{ unexpected:[] } }, allowHeaders:'Api-User-Agent, Content-Type' }]]) })
  try {
    await malformed.nav('wikidata-sparql')
    const malformedResult = await malformed.run(); assert.equal(malformedResult.ok, true, malformedResult.error)
    const malformedDom = await malformed.ev(`(()=>{const card=document.querySelector('[data-domain-card="knowledge-entities"]');return {state:card?.dataset.resultState||'',text:card?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(malformedDom.state, 'invalid'); assert.match(malformedDom.text, /results\.bindings array/); assert.match(malformedDom.http, /^200/)
    assert.equal(malformed.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1); assert.deepEqual(malformed.errors, [])
    report.checks.push({ id:'wikidata-sparql', case:'synthetic malformed HTTP-200 envelope', transportStatus:200, semanticState:'invalid', exactProviderFixtureRequests:1 })
  } finally { await malformed.close() }

  const mixedBody = { head:{ vars:['item','itemLabel'] }, results:{ bindings:[
    { item:{ type:'uri', value:'http://www.wikidata.org/entity/Q60' }, itemLabel:{ 'xml:lang':'en', type:'literal', value:'New York City' } },
    { item:{ type:'literal', value:'Q999' }, itemLabel:{ type:'literal', value:'Fabricated City' } },
  ] } }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: mixedBody, allowHeaders:'Api-User-Agent, Content-Type' }]]) })
  try {
    await mixed.nav('wikidata-sparql')
    const mixedResult = await mixed.run(); assert.equal(mixedResult.ok, true, mixedResult.error)
    const mixedDom = await mixed.ev(`(()=>{const card=document.querySelector('.wikidata-entity-preview');return {state:card?.dataset.resultState||'',provider:Number(card?.dataset.providerBindingCount),valid:Number(card?.dataset.validBindingCount),invalid:Number(card?.dataset.invalidBindingCount),rows:card?.querySelectorAll('.wikidata-entity-list>li').length||0,text:card?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
    assert.deepEqual({state:mixedDom.state,provider:mixedDom.provider,valid:mixedDom.valid,invalid:mixedDom.invalid,rows:mixedDom.rows},{state:'partial',provider:2,valid:1,invalid:1,rows:1})
    assert(mixedDom.text.includes('New York City')); assert.equal(mixedDom.text.includes('Fabricated City'), false); assert.equal(mixedDom.overflow, false); assert.deepEqual(mixed.errors, [])
    report.checks.push({ id:'wikidata-sparql', case:'synthetic mixed HTTP-200 bindings', semanticState:'partial', providerBindings:2, validBindings:1, invalidBindings:1, fabricatedIdentityHidden:true })
  } finally { await mixed.close() }
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/wikidata-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/wikidata-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
