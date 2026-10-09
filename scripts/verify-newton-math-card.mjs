import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live Newton API V2 plus exact synthetic wrong-operation/expression HTTP-200 fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('newton-math-solver')
  const endpoint = await b.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert(endpoint, 'Newton endpoint was not exposed')
  const request = new URL(endpoint)
  assert.equal(request.origin, 'https://newton.vercel.app')
  assert.equal(request.pathname, '/api/v2/simplify/2x%2B2x')

  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(typeof result.data, 'object')
  assert.equal(result.data?.operation, 'simplify')
  assert.equal(result.data?.expression, '2x+2x')
  assert.equal(typeof result.data?.result, 'string')

  const dom = await b.ev(`(() => {
    const shell=document.querySelector('.demo-preview'), card=shell.querySelector('.newton-math-preview')
    const facts=Object.fromEntries([...card.querySelectorAll('.domain-facts > div')].map(row=>[row.querySelector('dt')?.textContent||'',row.querySelector('dd')?.textContent||'']))
    return {
      layout:shell.dataset.previewLayout,fallback:shell.dataset.ssotFallback,domain:card.dataset.domainCard,
      state:card.dataset.resultState,requestBound:card.dataset.requestBound,requestContract:card.dataset.requestContract,identityMatch:card.dataset.identityMatch,contractValid:card.dataset.contractValid,
      requestedOperation:card.dataset.requestedOperation,requestedExpression:card.dataset.requestedExpression,
      providerOperation:card.dataset.providerOperation,providerExpression:card.dataset.providerExpression,
      operation:card.dataset.operation,expression:card.dataset.expression,result:card.dataset.result,facts,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,note:card.querySelector('.domain-note')?.textContent||''
    }
  })()`)
  assert.equal(dom.layout, 'symbolic-math'); assert.equal(dom.fallback, 'false'); assert.equal(dom.domain, 'symbolic-math')
  assert.equal(dom.state, 'ready'); assert.equal(dom.requestBound, 'true'); assert.equal(dom.requestContract, 'exact-newton-symbolic-math-v2'); assert.equal(dom.identityMatch, 'true'); assert.equal(dom.contractValid, 'true')
  assert.equal(dom.requestedOperation, 'simplify'); assert.equal(dom.requestedExpression, '2x+2x')
  assert.equal(dom.providerOperation, result.data.operation); assert.equal(dom.providerExpression, result.data.expression)
  assert.equal(dom.operation, result.data.operation); assert.equal(dom.expression, result.data.expression); assert.equal(dom.result, result.data.result)
  assert.equal(dom.facts.Operation, 'Simplify'); assert.equal(dom.facts['Input expression'], result.data.expression); assert.equal(dom.facts.Result, result.data.result)
  assert.match(dom.note, /community-maintained/); assert.equal(dom.overflow, false)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({id:'newton-math-solver',case:'live exact executed bodyless GET V2 symbolic operation',operation:'simplify',expression:'2x+2x',semanticState:'ready',requestContract:'exact-newton-symbolic-math-v2',requestBound:true,identityMatch:true,mobileOverflow:false,unnamedControls:0})
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const wrongPayload = { operation: 'factor', expression: 'x^2+2x', result: 'x (x + 2)' }
  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrongPayload }]]) })
  try {
    await malformed.nav('newton-math-solver')
    const run = await malformed.run()
    assert.equal(run.ok, true, run.error)
    const invalid = await malformed.ev(`(() => { const card=document.querySelector('.newton-math-preview'); return {
      state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', identityMatch:card?.dataset.identityMatch||'', contractValid:card?.dataset.contractValid||'',
      requestedOperation:card?.dataset.requestedOperation||'', requestedExpression:card?.dataset.requestedExpression||'', providerOperation:card?.dataset.providerOperation||'', providerExpression:card?.dataset.providerExpression||'',
      text:card?.innerText||'', http:document.querySelector('.ssot-runtime b')?.textContent||''
    } })()`)
    assert.equal(invalid.state, 'invalid')
    assert.equal(invalid.requestBound, 'true')
    assert.equal(invalid.requestContract, 'exact-newton-symbolic-math-v2')
    assert.equal(invalid.identityMatch, 'false')
    assert.equal(invalid.contractValid, 'false')
    assert.equal(invalid.requestedOperation, 'simplify')
    assert.equal(invalid.requestedExpression, '2x+2x')
    assert.equal(invalid.providerOperation, 'factor')
    assert.equal(invalid.providerExpression, 'x^2+2x')
    assert.match(invalid.http, /^200/)
    assert.doesNotMatch(invalid.text, /x \(x \+ 2\)/)
    assert.equal(malformed.fixtureRequests.filter((item) => item.url === endpoint && item.method === 'GET').length, 1)
    assert.deepEqual(malformed.errors, [])
    report.checks.push({id:'newton-math-solver',case:'synthetic wrong-identity HTTP-200',transportStatus:200,semanticState:'invalid',identityMatch:false,plausibleResultHidden:true,exactProviderFixtureRequests:1})
  } finally {
    await malformed.close()
  }

  report.verdict='PASS'
} catch (error) { report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String)) }
finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/newton-math-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/newton-math-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
