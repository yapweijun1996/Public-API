import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.data.gov.sg/v1/transport/taxi-availability'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'exactly one live data.gov.sg request plus one exact synthetic HTTP-200 fixture request',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())

const strictCoordinate = (coordinate) => Array.isArray(coordinate)
  && coordinate.length === 2
  && typeof coordinate[0] === 'number'
  && Number.isFinite(coordinate[0])
  && coordinate[0] >= -180
  && coordinate[0] <= 180
  && typeof coordinate[1] === 'number'
  && Number.isFinite(coordinate[1])
  && coordinate[1] >= -90
  && coordinate[1] <= 90

const semantic = (instance) => instance.ev(`(() => {
  const shell = document.querySelector('.demo-preview');
  const card = shell?.querySelector('[data-domain-card="data-gov-taxi-availability"]');
  const first = card?.querySelector('[data-sample-index="1"]');
  return {
    layout: shell?.dataset.previewLayout || '', fallback: shell?.dataset.ssotFallback || '',
    state: card?.dataset.resultState || '', requestBound: card?.dataset.requestBound || '',
    requestContract: card?.dataset.requestContract || '', envelopeContract: card?.dataset.envelopeContract || '',
    countContract: card?.dataset.countContract || '', timestampContract: card?.dataset.timestampContract || '',
    coordinateContract: card?.dataset.coordinateContract || '', taxiCount: Number(card?.dataset.taxiCount || 0),
    providerCoordinateCount: Number(card?.dataset.providerCoordinateCount || 0),
    validCoordinateCount: Number(card?.dataset.validCoordinateCount || 0),
    invalidCoordinateCount: Number(card?.dataset.invalidCoordinateCount || 0),
    acquisitionTimestamp: card?.dataset.acquisitionTimestamp || '',
    sampleCoordinateCount: Number(card?.dataset.sampleCoordinateCount || 0),
    firstLongitude: Number(first?.dataset.longitude), firstLatitude: Number(first?.dataset.latitude),
    text: card?.innerText || ''
  };
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('data-gov-taxi')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Taxi verifier must issue exactly one live provider request')
  assert.equal(live.blockedProviders.length, 0, 'Taxi live request must not be blocked or rewritten')

  const payload = result.data
  assert.equal(payload?.type, 'FeatureCollection')
  assert(Array.isArray(payload.features) && payload.features.length === 1, 'Taxi response must contain exactly one feature')
  const feature = payload.features[0]
  assert.equal(feature?.type, 'Feature')
  assert.equal(feature?.geometry?.type, 'MultiPoint')
  assert(Array.isArray(feature.geometry.coordinates), 'Taxi response missing coordinates')
  assert(feature.geometry.coordinates.every(strictCoordinate), 'Taxi coordinate wire contract drifted')
  assert.equal(typeof feature.properties?.timestamp, 'string')
  assert(Number.isFinite(Date.parse(feature.properties.timestamp)), 'Taxi timestamp is not parseable')
  assert(Number.isSafeInteger(feature.properties?.taxi_count) && feature.properties.taxi_count >= 0, 'taxi_count is not a native non-negative safe integer')
  assert.equal(feature.properties.taxi_count, feature.geometry.coordinates.length)

  await live.wait(`document.querySelector('[data-domain-card="data-gov-taxi-availability"]')?.dataset.resultState === ${JSON.stringify(feature.properties.taxi_count === 0 ? 'empty' : 'ready')}`)
  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout, fallback: dom.fallback, state: dom.state, requestBound: dom.requestBound,
    requestContract: dom.requestContract, envelopeContract: dom.envelopeContract, countContract: dom.countContract,
    timestampContract: dom.timestampContract, coordinateContract: dom.coordinateContract, taxiCount: dom.taxiCount,
    providerCoordinateCount: dom.providerCoordinateCount, validCoordinateCount: dom.validCoordinateCount,
    invalidCoordinateCount: dom.invalidCoordinateCount, acquisitionTimestamp: dom.acquisitionTimestamp,
    sampleCoordinateCount: dom.sampleCoordinateCount,
  }, {
    layout: 'taxi-availability', fallback: 'false', state: feature.properties.taxi_count === 0 ? 'empty' : 'ready', requestBound: 'true',
    requestContract: 'exact-data-gov-sg-latest-taxi-availability', envelopeContract: 'true', countContract: 'true',
    timestampContract: 'true', coordinateContract: 'true', taxiCount: feature.properties.taxi_count,
    providerCoordinateCount: feature.geometry.coordinates.length, validCoordinateCount: feature.geometry.coordinates.length,
    invalidCoordinateCount: 0, acquisitionTimestamp: feature.properties.timestamp,
    sampleCoordinateCount: Math.min(feature.geometry.coordinates.length, 8),
  })
  if (feature.geometry.coordinates.length > 0) {
    assert.equal(dom.firstLongitude, feature.geometry.coordinates[0][0])
    assert.equal(dom.firstLatitude, feature.geometry.coordinates[0][1])
  }
  assert(dom.text.includes('data.gov.sg acquisition time'))
  assert(dom.text.includes('not a per-taxi observation time'))
  assert(dom.text.includes('not stable taxi identities'))

  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({
    id: 'data-gov-taxi', source: 'live provider', exactRequest: endpoint,
    providerTaxiCount: feature.properties.taxi_count, providerCoordinateCount: feature.geometry.coordinates.length,
    acquisitionTimestamp: feature.properties.timestamp, semanticState: dom.state, requestBound: dom.requestBound,
    browserCorsReadable: true, liveProviderRequests: 1, mobileOverflow: false, unnamedControls: 0,
  })
  await live.close()
  active = undefined

  const fixtureBody = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'MultiPoint', coordinates: [[103.8, 1.3], ['103.81', 1.31], [181, 1.32]] },
      properties: { timestamp: '2026-09-17T12:34:56+08:00', taxi_count: 3, api_info: { status: 'healthy' } },
    }],
  }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('data-gov-taxi')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  await fixture.wait(`document.querySelector('[data-domain-card="data-gov-taxi-availability"]')?.dataset.resultState === 'partial'`)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({
    state: fixtureDom.state, requestBound: fixtureDom.requestBound, taxiCount: fixtureDom.taxiCount,
    providerCoordinateCount: fixtureDom.providerCoordinateCount, validCoordinateCount: fixtureDom.validCoordinateCount,
    invalidCoordinateCount: fixtureDom.invalidCoordinateCount, coordinateContract: fixtureDom.coordinateContract,
  }, {
    state: 'partial', requestBound: 'true', taxiCount: 3, providerCoordinateCount: 3,
    validCoordinateCount: 1, invalidCoordinateCount: 2, coordinateContract: 'false',
  })
  assert(fixtureDom.text.includes('Malformed taxi positions were withheld'))
  assert(fixtureDom.text.includes('Anonymous position 1'))
  assert.equal(fixtureDom.text.includes('Anonymous position 2'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests)
  assert.equal(fixture.blockedProviders.length, 0, 'Synthetic taxi case escaped its exact fixture')
  assert.deepEqual(fixture.errors, [])
  report.checks.push({
    id: 'data-gov-taxi', case: 'mixed malformed-coordinate HTTP-200 fixture', source: 'synthetic fixture',
    semanticState: fixtureDom.state, validCoordinates: 1, invalidCoordinates: 2,
    apiInfoHealthyDidNotPromoteReady: true, liveProviderRequests: 0,
  })
  await fixture.close()
  active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) {
    report.errors.push(...active.errors.map(String))
    report.networkFailures = active.networkFailures
  }
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/data-gov-taxi-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/data-gov-taxi-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
