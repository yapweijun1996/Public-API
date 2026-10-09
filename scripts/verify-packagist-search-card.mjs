import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://packagist.org/search.json?q=monolog&per_page=8'
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'live Packagist package search plus deterministic malformed HTTP-200 fixtures', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setControl = async (b, name, value) => {
  await b.ev(`(()=>{const e=document.querySelector('[name=${JSON.stringify(name)}]');if(!e)throw Error('missing control');const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`)
  await sleep(80)
}
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="packagist-package-search"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',query:c?.dataset.searchQuery||'',perPage:Number(c?.dataset.requestPerPage||0),page:Number(c?.dataset.requestPage||0),bound:c?.dataset.queryBound||'',providerTotal:Number(c?.dataset.providerTotal||0),providerResults:Number(c?.dataset.providerResultCount||0),validResults:Number(c?.dataset.validResultCount||0),invalidResults:Number(c?.dataset.invalidResultCount||0),incompleteResults:Number(c?.dataset.incompleteResultCount||0),countContract:c?.dataset.countContract||'',paginationContract:c?.dataset.paginationContract||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
const trustedLiveRow = (row) => {
  if (!row || typeof row !== 'object' || typeof row.name !== 'string' || typeof row.url !== 'string') return false
  if (!Number.isInteger(row.downloads) || row.downloads < 0 || !Number.isInteger(row.favers) || row.favers < 0) return false
  try { const u = new URL(row.url); return u.protocol === 'https:' && u.hostname === 'packagist.org' && decodeURIComponent(u.pathname.replace(/^\/packages\//,'').replace(/\/$/,'')) === row.name } catch { return false }
}
const good = { name:'monolog/monolog', description:'Monolog logging library', url:'https://packagist.org/packages/monolog/monolog', repository:'https://github.com/Seldaek/monolog', downloads:1061138158, favers:22272 }

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('packagist-search')

  const fieldContract = await b.ev(`(() => {
    const query = document.querySelector('[name="query"]')
    const limit = document.querySelector('[name="limit"]')
    return { queryMinLength: query?.minLength, limitMin: limit?.min, limitMax: limit?.max, limitStep: limit?.step }
  })()` )
  assert.deepEqual(fieldContract, { queryMinLength: 1, limitMin: '1', limitMax: '20', limitStep: '1' })

  await setControl(b, 'query', '   ')
  await setControl(b, 'limit', '8')
  const blankBefore = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()` )
  await sleep(180)
  const blankValidation = await b.ev(`(() => { const field=document.querySelector('[name="query"]'); return {state:document.querySelector('.request-lab')?.dataset.requestState,invalid:field?.getAttribute('aria-invalid'),help:document.querySelector('#parameter-query-help')?.textContent||''} })()` )
  assert.equal(b.requestCount - blankBefore, 0, 'Blank Packagist package search must not trigger a provider request')
  assert.equal(blankValidation.state, 'idle')
  assert.equal(blankValidation.invalid, 'true')
  assert.match(blankValidation.help, /Package search is required\./)

  await setControl(b, 'query', 'monolog')
  await setControl(b, 'limit', '8.5')
  const fractionalBefore = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()` )
  await sleep(180)
  const fractionalValidation = await b.ev(`(() => { const field=document.querySelector('[name="limit"]'); return {state:document.querySelector('.request-lab')?.dataset.requestState,invalid:field?.getAttribute('aria-invalid'),help:document.querySelector('#parameter-limit-help')?.textContent||''} })()` )
  assert.equal(b.requestCount - fractionalBefore, 0, 'Fractional Packagist package count must not trigger a provider request')
  assert.equal(fractionalValidation.state, 'idle')
  assert.equal(fractionalValidation.invalid, 'true')
  assert.match(fractionalValidation.help, /Packages must use increments of 1\./)
  report.checks.push({case:'invalid explicit input',queryMinLength:1,limitStep:1,blankQueryProviderRequests:0,fractionalLimitProviderRequests:0,sharedValidation:'fail-closed'})

  await setControl(b, 'limit', '8')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(Array.isArray(run.data?.results) && run.data.results.length === 8)
  assert(Number.isInteger(run.data?.total) && run.data.total >= 8)
  assert(run.data.results.every(trustedLiveRow))
  assert.equal(typeof run.data.next, 'string')
  const dom = await readDom(b)
  assert.equal(dom.layout, 'composer-package-search')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.query, 'monolog')
  assert.equal(dom.perPage, 8)
  assert.equal(dom.page, 1)
  assert.equal(dom.bound, 'true')
  assert.equal(dom.providerTotal, run.data.total)
  assert.equal(dom.providerResults, 8)
  assert.equal(dom.validResults, 8)
  assert.equal(dom.invalidResults, 0)
  assert.equal(dom.incompleteResults, 0)
  assert.equal(dom.countContract, 'true')
  assert.equal(dom.paginationContract, 'true')
  assert.equal(dom.endpoint, endpoint)
  assert(dom.text.includes(run.data.results[0].name))
  assert(dom.text.includes(`${run.data.results[0].downloads.toLocaleString('en')} downloads`))
  assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false)
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({case:'live request-bound package search',state:'ready',query:'monolog',providerTotal:run.data.total,returnedResults:8,firstPackage:run.data.results[0].name,firstDownloads:run.data.results[0].downloads,mobileOverflow:false,unnamedControls:0})
  assert.deepEqual(b.errors, [])
  await b.close(); b = undefined

  const bad = { ...good, name:'fabricated/package', url:'https://packagist.org/packages/monolog/monolog', downloads:999999999 }
  const mixed = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:{results:[good,bad],total:2,next:null}}]]) })
  try {
    await mixed.nav('packagist-search'); await setControl(mixed,'query','monolog'); await setControl(mixed,'limit','8')
    const result = await mixed.run(); assert.equal(result.ok,true,result.error)
    const domMixed = await readDom(mixed)
    assert.equal(domMixed.state,'partial'); assert.equal(domMixed.providerResults,2); assert.equal(domMixed.validResults,1); assert.equal(domMixed.invalidResults,1)
    assert(domMixed.text.includes('monolog/monolog')); assert.equal(domMixed.text.includes('fabricated/package'),false); assert.equal(domMixed.text.includes('999,999,999'),false)
    assert.equal(mixed.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length,1); assert.deepEqual(mixed.errors,[])
    report.checks.push({case:'mixed contradictory package identity HTTP-200',state:'partial',providerResults:2,trustedResults:1,malformedFactsHidden:true})
  } finally { await mixed.close() }

  const invalid = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:{results:{},total:1,next:null}}]]) })
  try {
    await invalid.nav('packagist-search'); await setControl(invalid,'query','monolog'); await setControl(invalid,'limit','8')
    const result = await invalid.run(); assert.equal(result.ok,true,result.error)
    const domInvalid = await readDom(invalid)
    assert.equal(domInvalid.state,'invalid'); assert(domInvalid.text.includes('Invalid Packagist search response')); assert.deepEqual(invalid.errors,[])
    report.checks.push({case:'malformed search envelope HTTP-200',state:'invalid',fabricatedFactsHidden:true})
  } finally { await invalid.close() }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/packagist-search-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/packagist-search-card.json`},null,2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
