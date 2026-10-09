import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.wheretheiss.at/v1/satellites/25544'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Where The ISS At request plus exact synthetic HTTP-200 semantic fixture',
  checks: [], errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const validLive = (body) => Boolean(body && typeof body === 'object'
  && body.name === 'iss' && body.id === 25544
  && finite(body.latitude) && body.latitude >= -90 && body.latitude <= 90
  && finite(body.longitude) && body.longitude >= -180 && body.longitude <= 180
  && finite(body.altitude) && body.altitude > 0
  && finite(body.velocity) && body.velocity > 0
  && finite(body.footprint) && body.footprint > 0
  && Number.isSafeInteger(body.timestamp) && body.timestamp > 0
  && typeof body.visibility === 'string' && body.visibility.trim()
  && body.units === 'kilometers'
  && finite(body.daynum)
  && finite(body.solar_lat) && body.solar_lat >= -90 && body.solar_lat <= 90
  && finite(body.solar_lon) && body.solar_lon >= 0 && body.solar_lon <= 360)
const semantic = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="iss-position"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'',
    noradId:Number(card?.dataset.noradId||0), latitude:Number(card?.dataset.latitude||0), longitude:Number(card?.dataset.longitude||0),
    altitude:Number(card?.dataset.altitude||0), velocity:Number(card?.dataset.velocity||0), footprint:Number(card?.dataset.footprint||0),
    timestamp:Number(card?.dataset.timestamp||0), units:card?.dataset.units||'', visibility:card?.dataset.visibility||'', text:card?.innerText||''
  };
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('where-the-iss-at')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'ISS verifier must issue exactly one live provider request')
  assert(validLive(result.data), 'Where The ISS At current-position wire contract drifted')
  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout, fallback: dom.fallback, state: dom.state, requestBound: dom.requestBound,
    requestContract: dom.requestContract, noradId: dom.noradId, latitude: dom.latitude, longitude: dom.longitude,
    altitude: dom.altitude, velocity: dom.velocity, footprint: dom.footprint, timestamp: dom.timestamp,
    units: dom.units, visibility: dom.visibility,
  }, {
    layout: 'iss-position', fallback: 'false', state: 'ready', requestBound: 'true',
    requestContract: 'exact-current-iss-position-get', noradId: 25544, latitude: result.data.latitude,
    longitude: result.data.longitude, altitude: result.data.altitude, velocity: result.data.velocity,
    footprint: result.data.footprint, timestamp: result.data.timestamp, units: 'kilometers', visibility: result.data.visibility,
  })
  assert(dom.text.includes('International Space Station'))
  assert(dom.text.includes('NORAD ID'))
  assert(dom.text.includes('Altitude'))
  assert(dom.text.includes('Velocity'))
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'where-the-iss-at', source: 'live provider', exactRequest: endpoint, noradId: result.data.id, latitude: result.data.latitude, longitude: result.data.longitude, altitude: result.data.altitude, velocity: result.data.velocity, visibility: result.data.visibility, timestamp: result.data.timestamp, semanticState: dom.state, requestBound: dom.requestBound, browserCorsReadable: true, mobileOverflow: false, unnamedControls: 0 })
  await live.close(); active = undefined

  const fixtureBody = {
    name: 'iss', id: 25544, latitude: 1.3521, longitude: 103.8198, altitude: '421.86', velocity: 27575.9,
    visibility: 'daylight', footprint: 4508.7, timestamp: 1789603200, daynum: 2461300.5,
    solar_lat: 2.05, solar_lon: 238.786, units: 'kilometers',
  }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('where-the-iss-at')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run(); assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const fixtureDom = await semantic(fixture)
  assert.equal(fixtureDom.state, 'invalid')
  assert.equal(fixtureDom.requestBound, 'true')
  assert.equal(fixtureDom.altitude, 0)
  assert.equal(fixtureDom.text.includes('421.86'), false, 'Numeric-string altitude must be withheld')
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture ISS case must send zero live provider requests')
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ id: 'where-the-iss-at', case: 'numeric-string altitude HTTP-200 fixture', source: 'synthetic fixture', semanticState: fixtureDom.state, malformedEvidenceHidden: true, liveProviderRequests: 0 })
  await fixture.close(); active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures = active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/where-the-iss-at-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/where-the-iss-at-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
