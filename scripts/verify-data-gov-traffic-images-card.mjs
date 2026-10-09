import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.data.gov.sg/v1/transport/traffic-images'
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

const isIso = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const validCamera = (camera) => {
  if (!camera || typeof camera !== 'object') return false
  const location = camera.location
  const metadata = camera.image_metadata
  return typeof camera.camera_id === 'string' && camera.camera_id.trim() === camera.camera_id && camera.camera_id.length > 0
    && isIso(camera.timestamp)
    && typeof camera.image === 'string' && (() => { try { const url = new URL(camera.image); return url.protocol === 'https:' && !url.username && !url.password } catch { return false } })()
    && location && typeof location === 'object'
    && typeof location.latitude === 'number' && Number.isFinite(location.latitude) && location.latitude >= -90 && location.latitude <= 90
    && typeof location.longitude === 'number' && Number.isFinite(location.longitude) && location.longitude >= -180 && location.longitude <= 180
    && metadata && typeof metadata === 'object'
    && Number.isSafeInteger(metadata.width) && metadata.width > 0
    && Number.isSafeInteger(metadata.height) && metadata.height > 0
    && typeof metadata.md5 === 'string' && /^[0-9a-f]{32}$/.test(metadata.md5)
}

const semantic = (instance) => instance.ev(`(() => {
  const shell = document.querySelector('.demo-preview')
  const card = shell?.querySelector('[data-domain-card="data-gov-traffic-images"]')
  const first = card?.querySelector('[data-camera-id]')
  return {
    layout: shell?.dataset.previewLayout || '', fallback: shell?.dataset.ssotFallback || '',
    state: card?.dataset.resultState || '', requestBound: card?.dataset.requestBound || '',
    requestContract: card?.dataset.requestContract || '', envelopeContract: card?.dataset.envelopeContract || '',
    snapshotTimestamp: card?.dataset.snapshotTimestamp || '', providerCameraCount: Number(card?.dataset.providerCameraCount || 0),
    validCameraCount: Number(card?.dataset.validCameraCount || 0), malformedCameraCount: Number(card?.dataset.malformedCameraCount || 0),
    duplicateCameraCount: Number(card?.dataset.duplicateCameraCount || 0), primaryCameraId: card?.dataset.primaryCameraId || '',
    firstMd5: first?.dataset.imageMd5 || '', firstLatitude: Number(first?.dataset.latitude), firstLongitude: Number(first?.dataset.longitude),
    text: card?.innerText || '',
  }
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('data-gov-traffic-images')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Traffic-images verifier must issue exactly one live provider request')
  assert.equal(live.blockedProviders.filter((url) => url.startsWith('https://api.data.gov.sg/')).length, 0)

  const payload = result.data
  assert(payload && typeof payload === 'object' && !Array.isArray(payload))
  assert(Array.isArray(payload.items) && payload.items.length === 1, 'Traffic response must contain exactly one snapshot item')
  const item = payload.items[0]
  assert(item && typeof item === 'object' && isIso(item.timestamp), 'Traffic snapshot timestamp is not parseable')
  assert(Array.isArray(item.cameras), 'Traffic snapshot cameras must be an array')
  const ids = new Set()
  for (const camera of item.cameras) {
    assert(validCamera(camera), 'Traffic camera wire contract drifted')
    assert(!ids.has(camera.camera_id), `Duplicate live camera ID: ${camera.camera_id}`)
    ids.add(camera.camera_id)
  }
  const expectedState = item.cameras.length === 0 ? 'empty' : 'ready'
  await live.wait(`document.querySelector('[data-domain-card="data-gov-traffic-images"]')?.dataset.resultState === ${JSON.stringify(expectedState)}`)
  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout, fallback: dom.fallback, state: dom.state, requestBound: dom.requestBound,
    requestContract: dom.requestContract, envelopeContract: dom.envelopeContract,
    snapshotTimestamp: dom.snapshotTimestamp, providerCameraCount: dom.providerCameraCount,
    validCameraCount: dom.validCameraCount, malformedCameraCount: dom.malformedCameraCount,
    duplicateCameraCount: dom.duplicateCameraCount, primaryCameraId: dom.primaryCameraId,
  }, {
    layout: 'traffic-camera-snapshot', fallback: 'false', state: expectedState, requestBound: 'true',
    requestContract: 'exact-data-gov-sg-latest-traffic-images', envelopeContract: 'true',
    snapshotTimestamp: item.timestamp, providerCameraCount: item.cameras.length,
    validCameraCount: item.cameras.length, malformedCameraCount: 0, duplicateCameraCount: 0,
    primaryCameraId: item.cameras[0]?.camera_id || '',
  })
  if (item.cameras.length > 0) {
    const first = item.cameras[0]
    assert.equal(dom.firstMd5, first.image_metadata.md5)
    assert.equal(dom.firstLatitude, first.location.latitude)
    assert.equal(dom.firstLongitude, first.location.longitude)
  }
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'data-gov-traffic-images', source: 'live provider', exactRequest: endpoint,
    providerCameraCount: item.cameras.length, primaryCameraId: item.cameras[0]?.camera_id || null,
    snapshotTimestamp: item.timestamp, semanticState: dom.state, requestBound: dom.requestBound,
    liveProviderRequests: 1, mobileOverflow: false, unnamedControls: 0 })
  await live.close()
  active = undefined

  const fixtureBody = {
    items: [{ timestamp: '2026-09-17T12:34:56+08:00', cameras: [
      { camera_id: '2701', timestamp: '2026-09-17T12:34:56+08:00', image: 'https://images.data.gov.sg/2701.jpg', location: { latitude: 1.3, longitude: 103.8 }, image_metadata: { width: 1920, height: 1080, md5: '0123456789abcdef0123456789abcdef' } },
      { camera_id: '2701', timestamp: '2026-09-17T12:34:56+08:00', image: 'https://images.data.gov.sg/duplicate.jpg', location: { latitude: 1.31, longitude: 103.81 }, image_metadata: { width: 1920, height: 1080, md5: 'fedcba9876543210fedcba9876543210' } },
      { camera_id: '2702', timestamp: '2026-09-17T12:34:56+08:00', image: 'https://images.data.gov.sg/2702.jpg', location: { latitude: '1.32', longitude: 103.82 }, image_metadata: { width: 1920, height: 1080, md5: 'abcdef0123456789abcdef0123456789' } },
    ] }],
  }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('data-gov-traffic-images')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  await fixture.wait(`document.querySelector('[data-domain-card="data-gov-traffic-images"]')?.dataset.resultState === 'partial'`)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({ state: fixtureDom.state, requestBound: fixtureDom.requestBound, providerCameraCount: fixtureDom.providerCameraCount,
    validCameraCount: fixtureDom.validCameraCount, malformedCameraCount: fixtureDom.malformedCameraCount, duplicateCameraCount: fixtureDom.duplicateCameraCount },
  { state: 'partial', requestBound: 'true', providerCameraCount: 3, validCameraCount: 1, malformedCameraCount: 1, duplicateCameraCount: 1 })
  assert.equal(fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
  assert.equal(fixture.requestCount - fixtureBefore, 1)
  assert.equal(fixture.blockedProviders.filter((url) => url.startsWith('https://api.data.gov.sg/')).length, 0)
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ id: 'data-gov-traffic-images', case: 'malformed numeric-string coordinate plus duplicate-ID HTTP-200 fixture', source: 'synthetic fixture', semanticState: fixtureDom.state, validCameras: 1, malformedCameras: 1, duplicateCameras: 1, liveProviderRequests: 0 })
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

fs.writeFileSync(`${evidence}/data-gov-traffic-images-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/data-gov-traffic-images-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
