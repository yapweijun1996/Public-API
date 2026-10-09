import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://transport.opendata.ch/v1/connections?from=Zurich&to=Geneva&limit=6'
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'shared-validation zero-network checks, one live Swiss Transport request, plus one malformed synthetic HTTP-200 fixture', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setControl = async (b, name, value) => {
  await b.ev(`(()=>{const e=document.querySelector('[name=${JSON.stringify(name)}]');if(!e)throw Error('missing control');const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`)
  await sleep(80)
}
const readDom = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="swiss-transit-connections"]'), first=card?.querySelector('[data-origin-id]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', reason:card?.dataset.resultReason||'', requestBound:card?.dataset.requestBound||'', from:card?.dataset.requestedFrom||'', to:card?.dataset.requestedTo||'', providerCount:Number(card?.dataset.providerConnectionCount), validCount:Number(card?.dataset.validConnectionCount), invalidCount:Number(card?.dataset.invalidConnectionCount), delayUnavailableCount:Number(card?.dataset.delayUnavailableCount), firstOriginId:first?.dataset.originId||'', firstDestinationId:first?.dataset.destinationId||'', firstText:first?.innerText||'', allText:card?.innerText||'', endpoint:document.querySelector('.endpoint-box code')?.textContent||'', overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1 } })()`)
const delayText = (value) => value == null ? 'Delay unavailable' : value > 0 ? `Delayed ${value} min` : 'On schedule'

let active
try {
  const live = await browser(`${root}/dist`); active = live
  await live.nav('swiss-transit-connections')

  const fieldContract = await live.ev(`(() => {
    const from = document.querySelector('[name="from"]')
    const to = document.querySelector('[name="to"]')
    const limit = document.querySelector('[name="limit"]')
    return { fromMinLength: from?.minLength, toMinLength: to?.minLength, limitMin: limit?.min, limitMax: limit?.max, limitStep: limit?.step }
  })()`)
  assert.deepEqual(fieldContract, { fromMinLength:1, toMinLength:1, limitMin:'1', limitMax:'10', limitStep:'1' })

  for (const [values, field, message] of [
    [{ from:'   ', to:'Geneva', limit:'6' }, 'from', /Origin is required\./],
    [{ from:'Zurich', to:'   ', limit:'6' }, 'to', /Destination is required\./],
    [{ from:'Zurich', to:'Geneva', limit:'6.5' }, 'limit', /Connections must use increments of 1\./],
  ]) {
    await setControl(live, 'from', values.from)
    await setControl(live, 'to', values.to)
    await setControl(live, 'limit', values.limit)
    const before = live.requestCount
    await live.ev(`document.querySelector('.parameter-card').requestSubmit()`)
    await sleep(180)
    const validation = await live.ev(`(()=>{const field=document.querySelector('[name=${JSON.stringify(field)}]');return {state:document.querySelector('.request-lab')?.dataset.requestState,invalid:field?.getAttribute('aria-invalid'),help:document.querySelector('#parameter-${field}-help')?.textContent||''}})()`)
    assert.equal(live.requestCount - before, 0, `Invalid Swiss Transit ${field} must not trigger a provider request`)
    assert.equal(validation.state, 'idle')
    assert.equal(validation.invalid, 'true')
    assert.match(validation.help, message)
  }
  report.checks.push({ case:'invalid explicit input', fromMinLength:1, toMinLength:1, limitStep:1, blankOriginProviderRequests:0, blankDestinationProviderRequests:0, fractionalLimitProviderRequests:0, sharedValidation:'fail-closed' })

  await setControl(live, 'from', 'Zurich')
  await setControl(live, 'to', 'Geneva')
  await setControl(live, 'limit', '6')
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  const rows = result.data?.connections
  assert(Array.isArray(rows) && rows.length > 0, 'Swiss Transport returned no live connections')
  const first = rows[0]
  const dom = await readDom(live)
  assert(['ready','partial'].includes(dom.state), JSON.stringify(dom))
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, requestBound:dom.requestBound, from:dom.from, to:dom.to, endpoint:dom.endpoint }, { layout:'swiss-transit-connections', fallback:'false', requestBound:'true', from:'Zurich', to:'Geneva', endpoint })
  assert.equal(dom.providerCount, rows.length)
  assert(dom.validCount > 0)
  assert.equal(dom.firstOriginId, String(first.from?.station?.id))
  assert.equal(dom.firstDestinationId, String(first.to?.station?.id))
  assert(dom.firstText.includes(String(first.from?.station?.name)))
  assert(dom.firstText.includes(String(first.to?.station?.name)))
  assert(dom.firstText.includes(delayText(first.from?.delay)))
  const providerRequests = await live.ev(`performance.getEntriesByName(${JSON.stringify(endpoint)}).length`)
  assert.equal(providerRequests, 1)
  await live.viewport(390, 844)
  const overflow = await live.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1`)
  assert.equal(overflow, false)
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ case:'live exact Swiss connection search', state:dom.state, requestBound:true, connections:rows.length, validConnections:dom.validCount, invalidConnections:dom.invalidCount, delayUnavailable:dom.delayUnavailableCount, browserCorsReadable:true, providerRequests, mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...live.errors.map(String)); assert.deepEqual(report.errors, [])
  await live.close(); active = undefined

  const malformed = { connections: [{ from:{ station:'Injected old shape', departure:'10:05', delay:0 }, to:{ station:'Injected destination', arrival:'11:00' }, duration:'00d00:55:00', products:['IC 1'], sections:[{ journeys:[{ name:'IC 1' }] }] }] }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{ body:malformed }]]), blockedProviderPatterns:['https://transport.opendata.ch/*'] }); active = fixture
  await fixture.nav('swiss-transit-connections')
  const fixtureResult = await fixture.run(); assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const fixtureDom = await readDom(fixture)
  assert.equal(fixtureDom.state, 'invalid')
  assert.equal(fixtureDom.allText.includes('Injected old shape'), false)
  assert.equal(fixtureDom.allText.includes('Injected destination'), false)
  assert.deepEqual(fixture.fixtureRequests.map(({url,source,status})=>({url,source,status})), [{url:endpoint,source:'synthetic-fixture',status:200}])
  assert.deepEqual(fixture.blockedProviders, []); assert.deepEqual(fixture.errors, [])
  report.checks.push({ case:'synthetic malformed HTTP-200 connection shape', state:'invalid', providerFactsHidden:true, liveProviderRequests:0 })
  await fixture.close(); active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error); if (active) report.errors.push(...active.errors.map(String))
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/swiss-transit-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/swiss-transit-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
