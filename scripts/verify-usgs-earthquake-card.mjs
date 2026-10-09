import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'USGS M2.5+ past-day request, GeoJSON metadata/count/row semantics, raw-to-DOM earthquake identity, malformed HTTP-200 handling, mobile layout, and accessibility',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())

const timestamp = (value) => Number.isSafeInteger(value) && value >= 0 && Number.isFinite(new Date(value).getTime())

const endpointContract = (value) => {
  assert.equal(value, endpoint)
  const url = new URL(value)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.hostname, 'earthquake.usgs.gov')
  assert.equal(url.port, '')
  assert.equal(url.username, '')
  assert.equal(url.password, '')
  assert.equal(url.pathname, '/earthquakes/feed/v1.0/summary/2.5_day.geojson')
  assert.equal(url.search, '')
  assert.equal(url.hash, '')
}

const validateFeature = (feature, ids) => {
  assert(feature && typeof feature === 'object' && !Array.isArray(feature))
  assert.equal(feature.type, 'Feature')
  assert.equal(typeof feature.id, 'string')
  assert(feature.id.trim())
  assert(!ids.has(feature.id))
  ids.add(feature.id)
  const properties = feature.properties
  assert(properties && typeof properties === 'object' && !Array.isArray(properties))
  assert.equal(typeof properties.mag, 'number')
  assert(Number.isFinite(properties.mag) && properties.mag >= 2.5)
  for (const key of ['place', 'status']) {
    assert.equal(typeof properties[key], 'string')
    assert(properties[key].trim())
  }
  assert(timestamp(properties.time))
  assert(timestamp(properties.updated))
  assert(properties.updated >= properties.time)
  if (properties.title !== undefined && properties.title !== null) {
    assert.equal(typeof properties.title, 'string')
  }
  const geometry = feature.geometry
  assert(geometry && typeof geometry === 'object' && !Array.isArray(geometry))
  assert.equal(geometry.type, 'Point')
  assert(Array.isArray(geometry.coordinates))
  assert.equal(geometry.coordinates.length, 3)
  const [longitude, latitude, depthKm] = geometry.coordinates
  for (const coordinate of geometry.coordinates) {
    assert.equal(typeof coordinate, 'number')
    assert(Number.isFinite(coordinate))
  }
  assert(longitude >= -180 && longitude <= 180)
  assert(latitude >= -90 && latitude <= 90)
  assert(depthKm >= -100 && depthKm <= 1000)
}

const semanticDom = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview');
  const card = shell?.querySelector('[data-domain-card="usgs-earthquake-feed"]');
  return {
    layout: shell?.dataset.previewLayout || '', fallback: shell?.dataset.ssotFallback || '', state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '', requestMethod: card?.dataset.requestMethod || '', requestUrl: card?.dataset.requestUrl || '',
    envelope: card?.dataset.envelopeContract || '', metadata: card?.dataset.metadataContract || '', countContract: card?.dataset.countContract || '',
    rowIdentity: card?.dataset.rowIdentityContract || '', geometry: card?.dataset.geometryContract || '', nativeNumbers: card?.dataset.nativeNumberContract || '',
    providerCount: Number(card?.dataset.providerCount), providerFeatures: Number(card?.dataset.providerFeatureCount), validRecords: Number(card?.dataset.validRecordCount), invalidRecords: Number(card?.dataset.invalidRecordCount), optionalIssues: Number(card?.dataset.optionalIssueCount), displayedRecords: Number(card?.dataset.displayedRecordCount),
    feedGenerated: card?.dataset.feedGenerated || '', feedUrl: card?.dataset.feedUrl || '', feedApi: card?.dataset.feedApiVersion || '',
    primaryEventId: card?.dataset.primaryEventId || '', primaryMagnitude: Number(card?.dataset.primaryMagnitude), primaryLongitude: Number(card?.dataset.primaryLongitude), primaryLatitude: Number(card?.dataset.primaryLatitude), primaryDepthKm: Number(card?.dataset.primaryDepthKm), primaryEventTime: card?.dataset.primaryEventTime || '',
    rows: [...(card?.querySelectorAll('.earthquake-list li[data-event-id]') || [])].map((node) => ({
      id: node.dataset.eventId || '', magnitude: Number(node.dataset.magnitude), place: node.dataset.place || '', eventTime: node.dataset.eventTime || '', updatedTime: node.dataset.updatedTime || '', status: node.dataset.status || '', longitude: Number(node.dataset.longitude), latitude: Number(node.dataset.latitude), depthKm: Number(node.dataset.depthKm), text: node.textContent || '',
    })),
    mapLabel: card?.querySelector('.location-map')?.getAttribute('aria-label') || '', text: card?.innerText || '',
  };
})()`)

const feature = (overrides = {}) => ({
  type: 'Feature',
  id: 'us7000fixture1',
  properties: { mag: 3.7, place: 'Off the coast of Oregon', time: 1_789_426_800_000, updated: 1_789_427_100_000, status: 'reviewed', title: 'M 3.7 - Off the coast of Oregon' },
  geometry: { type: 'Point', coordinates: [-129.0824, 43.6383, 10] },
  ...overrides,
})
const feed = (features, metadata = {}) => ({
  type: 'FeatureCollection',
  metadata: { generated: 1_789_430_400_000, url: endpoint, title: 'USGS Magnitude 2.5+ Earthquakes, Past Day', api: '1.14.1', count: features.length, status: 200, ...metadata },
  features,
})

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('usgs')
  const displayedEndpoint = await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  endpointContract(displayedEndpoint)

  const beforeLive = active.requestCount
  const liveResult = await active.run()
  assert.equal(liveResult.ok, true, liveResult.error)
  assert.equal(active.requestCount - beforeLive, 1, 'The live journey must send exactly one USGS request and never retry')
  await active.wait(`document.querySelector('[data-domain-card="usgs-earthquake-feed"]')`)
  const payload = liveResult.data
  assert(payload && typeof payload === 'object' && !Array.isArray(payload))
  assert.equal(payload.type, 'FeatureCollection')
  assert(payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata))
  assert(Array.isArray(payload.features))
  assert(timestamp(payload.metadata.generated))
  assert.equal(payload.metadata.url, endpoint)
  assert.equal(typeof payload.metadata.title, 'string')
  assert(payload.metadata.title.trim())
  assert.equal(typeof payload.metadata.api, 'string')
  assert(payload.metadata.api.trim())
  assert.equal(payload.metadata.status, 200)
  assert(Number.isSafeInteger(payload.metadata.count) && payload.metadata.count >= 0)
  assert.equal(payload.metadata.count, payload.features.length)
  const ids = new Set()
  for (const event of payload.features) validateFeature(event, ids)

  const liveDom = await semanticDom(active)
  assert.equal(liveDom.layout, 'location-map')
  assert.equal(liveDom.fallback, 'false')
  assert.equal(liveDom.state, payload.features.length ? 'ready' : 'empty')
  assert.deepEqual(
    { requestBound: liveDom.requestBound, method: liveDom.requestMethod, url: liveDom.requestUrl },
    { requestBound: 'true', method: 'GET', url: endpoint },
  )
  assert.deepEqual(
    { envelope: liveDom.envelope, metadata: liveDom.metadata, count: liveDom.countContract, identity: liveDom.rowIdentity, geometry: liveDom.geometry, nativeNumbers: liveDom.nativeNumbers },
    { envelope: 'true', metadata: 'true', count: 'true', identity: 'true', geometry: 'true', nativeNumbers: 'true' },
  )
  assert.deepEqual(
    { providerCount: liveDom.providerCount, providerFeatures: liveDom.providerFeatures, validRecords: liveDom.validRecords, invalidRecords: liveDom.invalidRecords, optionalIssues: liveDom.optionalIssues },
    { providerCount: payload.metadata.count, providerFeatures: payload.features.length, validRecords: payload.features.length, invalidRecords: 0, optionalIssues: 0 },
  )
  assert.equal(liveDom.feedGenerated, new Date(payload.metadata.generated).toISOString())
  assert.equal(liveDom.feedUrl, payload.metadata.url)
  assert.equal(liveDom.feedApi, payload.metadata.api)
  assert.equal(liveDom.displayedRecords, Math.min(8, payload.features.length))
  assert.equal(liveDom.rows.length, Math.min(8, payload.features.length))
  for (const event of payload.features.slice(0, 8)) {
    const row = liveDom.rows.find((candidate) => candidate.id === event.id)
    assert(row, `Missing semantic DOM evidence for USGS event ${event.id}`)
    assert.deepEqual(
      { magnitude: row.magnitude, place: row.place, eventTime: row.eventTime, updatedTime: row.updatedTime, status: row.status, longitude: row.longitude, latitude: row.latitude, depthKm: row.depthKm },
      { magnitude: event.properties.mag, place: event.properties.place.trim(), eventTime: new Date(event.properties.time).toISOString(), updatedTime: new Date(event.properties.updated).toISOString(), status: event.properties.status.trim(), longitude: event.geometry.coordinates[0], latitude: event.geometry.coordinates[1], depthKm: event.geometry.coordinates[2] },
    )
  }
  if (payload.features.length) {
    const primary = payload.features[0]
    assert.deepEqual(
      { id: liveDom.primaryEventId, magnitude: liveDom.primaryMagnitude, longitude: liveDom.primaryLongitude, latitude: liveDom.primaryLatitude, depthKm: liveDom.primaryDepthKm, eventTime: liveDom.primaryEventTime },
      { id: primary.id.trim(), magnitude: primary.properties.mag, longitude: primary.geometry.coordinates[0], latitude: primary.geometry.coordinates[1], depthKm: primary.geometry.coordinates[2], eventTime: new Date(primary.properties.time).toISOString() },
    )
    assert.match(liveDom.mapLabel, new RegExp(`Map with ${Math.min(8, payload.features.length)} validated USGS earthquake`))
  }

  await active.viewport(390, 844)
  const mobile = await active.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
    cardOverflow: document.querySelector('[data-domain-card="usgs-earthquake-feed"]').scrollWidth > document.querySelector('[data-domain-card="usgs-earthquake-feed"]').clientWidth + 1,
  })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await active.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(active.errors, [])
  report.checks.push({ case: 'live exact USGS M2.5+ past-day GeoJSON feed', transportStatus: 200, semanticState: liveDom.state, providerFeatures: payload.features.length, requestIdentity: 'exact fixed HTTPS GET with no query or body', rawToDomIdentityAndMeasurements: true, cors: 'browser request succeeded', mobileOverflow: false, unnamedControls: 0, liveProviderRequests: 1, retries: 0 })
  await active.close()
  active = undefined

  const valid = feature()
  const fixtureCases = [
    {
      name: 'numeric-string magnitude and coordinates',
      body: feed([
        valid,
        feature({ id: 'us7000badmag', properties: { ...valid.properties, mag: '4.9', place: 'Untrusted magnitude' } }),
        feature({ id: 'us7000badcoord', properties: { ...valid.properties, place: 'Untrusted coordinate' }, geometry: { type: 'Point', coordinates: ['0', 10, 2] } }),
      ]),
      expectedState: 'partial',
      check: (dom) => { assert.equal(dom.validRecords, 1); assert.equal(dom.invalidRecords, 2); assert.equal(dom.nativeNumbers, 'false'); assert.doesNotMatch(dom.text, /Untrusted magnitude|Untrusted coordinate/) },
    },
    {
      name: 'malformed geometry and identity',
      body: feed([
        valid,
        feature({ id: '', properties: { ...valid.properties, place: 'Missing identity' } }),
        feature({ id: 'us7000line', properties: { ...valid.properties, place: 'Wrong geometry' }, geometry: { type: 'LineString', coordinates: [-122, 40, 5] } }),
      ]),
      expectedState: 'partial',
      check: (dom) => { assert.equal(dom.validRecords, 1); assert.equal(dom.invalidRecords, 2); assert.doesNotMatch(dom.text, /Missing identity|Wrong geometry/) },
    },
    {
      name: 'non-empty feed with zero trustworthy rows',
      body: feed([feature({ properties: { ...valid.properties, mag: '3.7' } })]),
      expectedState: 'invalid',
      check: (dom) => { assert.equal(dom.providerCount, 1); assert.equal(dom.validRecords, 0); assert.equal(dom.invalidRecords, 1); assert.doesNotMatch(dom.text, /Off the coast of Oregon/) },
    },
    {
      name: 'metadata count mismatch',
      body: feed([valid], { count: 2 }),
      expectedState: 'invalid',
      check: (dom) => { assert.equal(dom.countContract, 'false'); assert.equal(dom.validRecords, 0); assert.doesNotMatch(dom.text, /Off the coast of Oregon/) },
    },
    {
      name: 'coherent empty FeatureCollection',
      body: feed([]),
      expectedState: 'empty',
      check: (dom) => { assert.equal(dom.providerCount, 0); assert.equal(dom.validRecords, 0); assert.match(dom.text, /No M2.5\+ earthquakes returned/) },
    },
    {
      name: 'malformed GeoJSON envelope',
      body: { type: 'Feature', metadata: { count: 0 }, features: [] },
      expectedState: 'invalid',
      check: (dom) => { assert.equal(dom.envelope, 'false'); assert.equal(dom.validRecords, 0); assert.match(dom.text, /USGS earthquake evidence unavailable/) },
    },
  ]

  for (const testCase of fixtureCases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: testCase.body }]]) })
    active = fixtureBrowser
    await fixtureBrowser.nav('usgs')
    endpointContract(await fixtureBrowser.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`))
    const before = fixtureBrowser.requestCount
    const fixtureResult = await fixtureBrowser.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    await fixtureBrowser.wait(`document.querySelector('[data-domain-card="usgs-earthquake-feed"]')`)
    const dom = await semanticDom(fixtureBrowser)
    assert.equal(dom.state, testCase.expectedState)
    testCase.check(dom)
    const exactFixtureRequests = fixtureBrowser.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
    assert.equal(exactFixtureRequests, 1)
    assert.equal(fixtureBrowser.requestCount - before, exactFixtureRequests, 'Fixture-only cases must send zero live provider requests')
    assert.deepEqual(fixtureBrowser.blockedProviders, [])
    assert.deepEqual(fixtureBrowser.errors, [])
    report.checks.push({ case: `fixture-only ${testCase.name} HTTP-200`, semanticState: dom.state, exactFixtureRequests, liveProviderRequests: 0 })
    await fixtureBrowser.close()
    active = undefined
  }
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/usgs-earthquake-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/usgs-earthquake-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
