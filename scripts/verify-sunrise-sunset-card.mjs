import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Sunrise-Sunset API v2 request plus an exact synthetic wrong-location HTTP-200 fixture',
  checks: [],
  errors: [],
}
const actionableRoles = new Set(['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'])
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && actionableRoles.has(node.role?.value) && !(node.name?.value || '').trim())

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('sunrise-sunset')
  const endpoint = await b.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert(endpoint, 'Sunrise-Sunset endpoint was not exposed')
  const request = new URL(endpoint)
  assert.equal(request.origin, 'https://api.sunrise-sunset.org')
  assert.equal(request.pathname, '/v2')
  assert.deepEqual([...request.searchParams.keys()].sort(), ['date', 'lat', 'lng'])
  const requested = {
    date: request.searchParams.get('date'),
    latitude: Number(request.searchParams.get('lat')),
    longitude: Number(request.searchParams.get('lng')),
  }
  assert.match(requested.date || '', /^\d{4}-\d{2}-\d{2}$/)
  assert(Number.isFinite(requested.latitude) && requested.latitude >= -90 && requested.latitude <= 90)
  assert(Number.isFinite(requested.longitude) && requested.longitude >= -180 && requested.longitude <= 180)

  const live = await b.run()
  assert.equal(live.ok, true, live.error)
  assert.equal(live.data?.date, requested.date)
  assert.equal(Number(live.data?.lat), requested.latitude)
  assert.equal(Number(live.data?.lng), requested.longitude)
  assert.equal(typeof live.data?.sunrise, 'string')
  assert.equal(typeof live.data?.sunset, 'string')

  const dom = await b.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="solar-cycle"]'); return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', identityMatch:card?.dataset.identityMatch||'',
    requestedDate:card?.dataset.requestDate||'', requestedLatitude:Number(card?.dataset.requestLatitude), requestedLongitude:Number(card?.dataset.requestLongitude),
    providerDate:card?.dataset.providerDate||'', providerLatitude:Number(card?.dataset.providerLatitude), providerLongitude:Number(card?.dataset.providerLongitude),
    text:card?.innerText||'', overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  } })()`)
  assert.equal(dom.layout, 'solar-cycle')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-sunrise-sunset-v2')
  assert.equal(dom.identityMatch, 'true')
  assert.equal(dom.requestedDate, requested.date)
  assert.equal(dom.requestedLatitude, requested.latitude)
  assert.equal(dom.requestedLongitude, requested.longitude)
  assert.equal(dom.providerDate, live.data.date)
  assert.equal(dom.providerLatitude, Number(live.data.lat))
  assert.equal(dom.providerLongitude, Number(live.data.lng))
  assert.match(dom.text, /daylight/i)
  assert.equal(dom.overflow, false)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0, 'unnamed actionable controls')
  assert.deepEqual(b.errors, [], `browser errors ${b.errors.join(' | ')}`)
  report.checks.push({ id:'sunrise-sunset', case:'live exact v2 bodyless GET', semanticState:'ready', requestContract:'exact-sunrise-sunset-v2', requestBound:true, identityMatch:true, providerDate:live.data.date, mobileOverflow:false, unnamedControls:0 })
  await b.close(); b = undefined

  const wrongPayload = {
    ...live.data,
    lat: requested.latitude === 0 ? 1 : 0,
    lng: requested.longitude === 0 ? 1 : 0,
  }
  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrongPayload }]]) })
  try {
    await malformed.nav('sunrise-sunset')
    const result = await malformed.run()
    assert.equal(result.ok, true, result.error)
    const invalid = await malformed.ev(`(() => { const card=document.querySelector('[data-domain-card="solar-cycle"]'); return {
      state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', identityMatch:card?.dataset.identityMatch||'',
      text:card?.innerText||'', http:document.querySelector('.ssot-runtime b')?.textContent||''
    } })()`)
    assert.equal(invalid.state, 'invalid')
    assert.equal(invalid.requestBound, 'true')
    assert.equal(invalid.requestContract, 'exact-sunrise-sunset-v2')
    assert.equal(invalid.identityMatch, 'false')
    assert.match(invalid.http, /^200/)
    assert.match(invalid.text, /does not match/i)
    assert.doesNotMatch(invalid.text, /daylight/i)
    assert.equal(malformed.fixtureRequests.filter((item) => item.url === endpoint && item.method === 'GET').length, 1)
    assert.deepEqual(malformed.errors, [])
    report.checks.push({ id:'sunrise-sunset', case:'synthetic wrong-coordinate HTTP-200', transportStatus:200, semanticState:'invalid', requestBound:true, identityMatch:false, plausibleSolarIdentityHidden:true, exactProviderFixtureRequests:1 })
  } finally {
    await malformed.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}
fs.writeFileSync(`${evidence}/sunrise-sunset-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/sunrise-sunset-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
