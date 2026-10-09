import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://mempool.space/api/v1/fees/recommended'
const feeKeys = ['fastestFee', 'halfHourFee', 'hourFee', 'economyFee', 'minimumFee']
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'live mempool.space recommended fees plus exact synthetic malformed HTTP-200 fixtures', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())

const readDom = async (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('.transaction-fees-preview');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',bound:c?.dataset.requestBound||'',provider:c?.dataset.providerFeeFieldCount||'',valid:c?.dataset.validFeeFieldCount||'',invalid:c?.dataset.invalidFeeFieldCount||'',missing:c?.dataset.missingFeeFieldCount||'',fastest:c?.dataset.primaryFeeSatVb||'',halfHour:c?.dataset.halfHourFeeSatVb||'',hour:c?.dataset.hourFeeSatVb||'',economy:c?.dataset.economyFeeSatVb||'',minimum:c?.dataset.minimumFeeSatVb||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('mempool-space-btc')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  for (const key of feeKeys) {
    assert.equal(typeof result.data?.[key], 'number', `live mempool.space ${key} must be numeric`)
    assert(Number.isFinite(result.data[key]) && result.data[key] >= 0, `live mempool.space ${key} must be finite and non-negative`)
  }
  const dom = await readDom(b)
  assert.equal(dom.layout, 'transaction-fees')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.bound, 'true')
  assert.equal(dom.provider, '5')
  assert.equal(dom.valid, '5')
  assert.equal(dom.invalid, '0')
  assert.equal(dom.missing, '0')
  assert.equal(Number(dom.fastest), result.data.fastestFee)
  assert.equal(Number(dom.halfHour), result.data.halfHourFee)
  assert.equal(Number(dom.hour), result.data.hourFee)
  assert.equal(Number(dom.economy), result.data.economyFee)
  assert.equal(Number(dom.minimum), result.data.minimumFee)
  assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'mempool-space-btc', case:'live recommended-fee contract', state:'ready', feeFacts:'exact response match', mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const mixedFixture = { fastestFee: 7, halfHourFee: -99, hourFee: '4', economyFee: 2 }
  const mixed = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:mixedFixture}]]) })
  try {
    await mixed.nav('mempool-space-btc'); const run=await mixed.run(); assert.equal(run.ok,true,run.error)
    const value=await readDom(mixed)
    assert.deepEqual({state:value.state,bound:value.bound,provider:value.provider,valid:value.valid,invalid:value.invalid,missing:value.missing},{state:'partial',bound:'true',provider:'4',valid:'2',invalid:'2',missing:'1'})
    assert.equal(value.fastest,'7'); assert.equal(value.economy,'2'); assert.equal(value.halfHour,''); assert.equal(value.hour,''); assert.equal(value.minimum,'')
    assert.equal(value.text.includes('-99 sat/vB'),false); assert.equal(value.text.includes('4 sat/vB'),false)
    assert.equal(mixed.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length,1); assert.deepEqual(mixed.errors,[])
    report.checks.push({id:'mempool-space-btc',case:'mixed malformed fee HTTP-200',state:'partial',invalidFeeFactsHidden:true})
  } finally { await mixed.close() }

  const invalidFixture = { fastestFee:'7', halfHourFee:-5, hourFee:null, economyFee:'not-a-number' }
  const invalid = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:invalidFixture}]]) })
  try {
    await invalid.nav('mempool-space-btc'); const run=await invalid.run(); assert.equal(run.ok,true,run.error)
    const value=await readDom(invalid)
    assert.equal(value.state,'invalid'); assert.equal(value.valid,'0'); assert.equal(value.fastest,''); assert.equal(value.minimum,'')
    assert.equal(value.text.includes('Recommended Bitcoin fee rates'),false)
    assert.equal(invalid.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length,1); assert.deepEqual(invalid.errors,[])
    report.checks.push({id:'mempool-space-btc',case:'unusable fee HTTP-200',state:'invalid',feeFactsHidden:true})
  } finally { await invalid.close() }
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}
fs.writeFileSync(`${evidence}/mempool-fees-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/mempool-fees-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
