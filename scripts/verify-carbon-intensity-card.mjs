import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.carbonintensity.org.uk/intensity'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live NESO Carbon Intensity /intensity response plus exact synthetic malformed and numeric-string HTTP-200 fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('carbon-intensity-gb')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data?.data) && result.data.data.length > 0, 'NESO returned no current data records')
  const first = result.data.data[0]
  const intensity = first?.intensity || {}
  assert.equal(typeof intensity.forecast, 'number', 'NESO current record is missing numeric forecast')
  assert.equal(typeof intensity.index, 'string', 'NESO current record is missing intensity index')
  assert.equal(typeof first.from, 'string', 'NESO current record is missing interval start')
  assert.equal(typeof first.to, 'string', 'NESO current record is missing interval end')
  const expected = {
    forecast: Number(intensity.forecast),
    actual: typeof intensity.actual === 'number' ? Number(intensity.actual) : null,
    index: String(intensity.index),
    from: String(first.from),
    to: String(first.to),
  }
  const dom = await b.ev(`(() => {
    const shell=document.querySelector('.demo-preview'), card=shell.querySelector('.carbon-intensity-preview')
    return {
      layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',providerRecords:Number(card?.dataset.providerRecords),
      primary:Number(card?.dataset.primaryIntensityGco2Kwh),forecast:Number(card?.dataset.forecastGco2Kwh),actual:card?.dataset.actualGco2Kwh===undefined?null:Number(card.dataset.actualGco2Kwh),
      index:card?.dataset.primaryIndex||'',from:card?.dataset.periodFrom||'',to:card?.dataset.periodTo||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
    }
  })()`)
  assert.equal(dom.layout, 'carbon-intensity'); assert.equal(dom.fallback, 'false'); assert.equal(dom.state, 'ready')
  assert.equal(dom.providerRecords, result.data.data.length); assert.equal(dom.forecast, expected.forecast); assert.equal(dom.actual, expected.actual)
  assert.equal(dom.primary, expected.actual ?? expected.forecast); assert.equal(dom.index, expected.index); assert.equal(dom.from, expected.from); assert.equal(dom.to, expected.to); assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({id:'carbon-intensity-gb',case:'live NESO current half-hour contract',forecast:'exact response match',estimatedActual:'exact response match or provider-unsupplied',index:'exact response match',utcInterval:'exact response match',mobileOverflow:false,unnamedControls:0})
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: { unexpected: [] } }]]) })
  try {
    await malformed.nav('carbon-intensity-gb')
    const malformedResult = await malformed.run()
    assert.equal(malformedResult.ok, true, malformedResult.error)
    const malformedDom = await malformed.ev(`(()=>{const shell=document.querySelector('.demo-preview'),card=shell.querySelector('[data-domain-card=\"carbon-intensity\"]');return {state:card?.dataset.resultState||'',text:card?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(malformedDom.state, 'invalid')
    assert.match(malformedDom.text, /documented carbon-intensity data array/)
    assert.match(malformedDom.http, /^200/)
    assert.equal(malformed.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(malformed.errors, [])
    report.checks.push({id:'carbon-intensity-gb',case:'synthetic malformed HTTP-200 envelope',transportStatus:200,semanticState:'invalid',exactProviderFixtureRequests:1})
  } finally { await malformed.close() }

  const numericString = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: {
      data: [{
        from: '2026-09-08T03:00Z',
        to: '2026-09-08T03:30Z',
        intensity: { forecast: '81', actual: '79', index: 'moderate' },
      }],
    } }]]),
    blockedProviderPatterns: ['https://api.carbonintensity.org.uk/*'],
  })
  try {
    await numericString.nav('carbon-intensity-gb')
    const numericResult = await numericString.run()
    assert.equal(numericResult.ok, true, numericResult.error)
    const numericDom = await numericString.ev(`(()=>{const card=document.querySelector('[data-domain-card=\"carbon-intensity\"]');return {state:card?.dataset.resultState||'',text:card?.innerText||''}})()`)
    assert.equal(numericDom.state, 'invalid')
    assert.equal(numericDom.text.includes('81 gCO₂/kWh'), false)
    assert.equal(numericDom.text.includes('79 gCO₂/kWh'), false)
    assert.equal(numericString.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(numericString.blockedProviders, [])
    assert.deepEqual(numericString.errors, [])
    report.checks.push({id:'carbon-intensity-gb',case:'synthetic numeric-string measurements',transportStatus:200,semanticState:'invalid',numericStringsTrusted:false,exactProviderFixtureRequests:1,liveProviderRequests:0})
  } finally { await numericString.close() }

  report.verdict = 'PASS'
} catch (error) { report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String)) }
finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/carbon-intensity-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/carbon-intensity-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
