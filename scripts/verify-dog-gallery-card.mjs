import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const count = 4
const endpoint = `https://dog.ceo/api/breeds/image/random/${count}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live canonical Dog CEO request plus one synthetic HTTP-200 semantic fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())
const trustedImage = (value) => typeof value === 'string'
  && /^https:\/\/images\.dog\.ceo\/breeds\/[^/?#]+\/[^/?#]+\.jpg$/.test(value)
const identity = (url) => {
  const parts = new URL(url).pathname.split('/')
  return { collection: decodeURIComponent(parts[2]), filename: decodeURIComponent(parts[3]) }
}
const semantic = (instance) => instance.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="dog-gallery"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', requestedCount:Number(card?.dataset.requestedCount||0), countContract:card?.dataset.countContract||'', providerCount:Number(card?.dataset.providerImageCount||0), trustedCount:Number(card?.dataset.trustedImageCount||0), malformedCount:Number(card?.dataset.malformedImageCount||0), duplicateCount:Number(card?.dataset.duplicateImageCount||0), overflowCount:Number(card?.dataset.overflowImageCount||0), primaryUrl:card?.dataset.primaryImageUrl||'', primaryFilename:card?.dataset.primaryImageFilename||'', primaryCollection:card?.dataset.primaryProviderCollection||'', imageUrls:[...(card?.querySelectorAll('img')||[])].map((image)=>image.src), text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('dogs')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const response = await live.run()
  assert.equal(response.ok, true, response.error)
  assert.equal(live.requestCount - before, 1, 'Dog CEO verifier must issue exactly one live provider request')
  assert.equal(response.data?.status, 'success')
  assert(Array.isArray(response.data?.message), 'Dog CEO message must be an array')
  assert.equal(response.data.message.length, count)
  assert(response.data.message.every(trustedImage), 'Dog CEO image-host contract drifted')
  assert.equal(new Set(response.data.message).size, count, 'Dog CEO returned duplicate image identities')
  const primary = identity(response.data.message[0])
  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    requestedCount: dom.requestedCount,
    countContract: dom.countContract,
    providerCount: dom.providerCount,
    trustedCount: dom.trustedCount,
    malformedCount: dom.malformedCount,
    duplicateCount: dom.duplicateCount,
    overflowCount: dom.overflowCount,
    primaryUrl: dom.primaryUrl,
    primaryFilename: dom.primaryFilename,
    primaryCollection: dom.primaryCollection,
    imageUrls: dom.imageUrls,
  }, {
    layout: 'dog-gallery',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-dog-ceo-random-count-v1',
    requestedCount: count,
    countContract: 'true',
    providerCount: count,
    trustedCount: count,
    malformedCount: 0,
    duplicateCount: 0,
    overflowCount: 0,
    primaryUrl: response.data.message[0],
    primaryFilename: primary.filename,
    primaryCollection: primary.collection,
    imageUrls: response.data.message,
  })
  await live.ev(`document.querySelector('[data-domain-card="dog-gallery"]')?.scrollIntoView({block:'start',behavior:'instant'})`)
  await live.wait(`[...document.querySelectorAll('[data-domain-card="dog-gallery"] img')].length===${count} && [...document.querySelectorAll('[data-domain-card="dog-gallery"] img')].every((image)=>image.complete&&image.naturalWidth>0)`)
  assert(dom.text.includes(primary.filename))
  assert(dom.text.includes('do not establish reuse rights for each photo'))
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'dogs', source: 'live provider', exactRequest: endpoint, returnedImages: count, primaryImageUrl: dom.primaryUrl, semanticState: dom.state, requestBound: dom.requestBound, browserCorsReadable: true, rawToDomIdentity: true, mobileOverflow: false, unnamedControls: 0 })
  await live.close(); active = undefined

  const first = 'https://images.dog.ceo/breeds/akita/fixture-one.jpg'
  const second = 'https://images.dog.ceo/breeds/hound-afghan/fixture-two.jpg'
  const fixtureBody = { status: 'success', message: [
    first,
    first,
    'https://evil.example/breeds/akita/fabricated.jpg',
    second,
    'https://images.dog.ceo/breeds/terrier/fabricated-overflow.jpg',
  ] }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([
    [endpoint, { body: fixtureBody }],
    [first, { body: { fixture: 'dog-image-one' } }],
    [second, { body: { fixture: 'dog-image-two' } }],
  ]) })
  active = fixture
  await fixture.nav('dogs')
  const fixtureBefore = fixture.requestCount
  const fixtureResponse = await fixture.run()
  assert.equal(fixtureResponse.ok, true, fixtureResponse.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({ state: fixtureDom.state, requestBound: fixtureDom.requestBound, countContract: fixtureDom.countContract, providerCount: fixtureDom.providerCount, trustedCount: fixtureDom.trustedCount, malformedCount: fixtureDom.malformedCount, duplicateCount: fixtureDom.duplicateCount, overflowCount: fixtureDom.overflowCount, primaryUrl: fixtureDom.primaryUrl, imageUrls: fixtureDom.imageUrls }, { state: 'partial', requestBound: 'true', countContract: 'false', providerCount: 5, trustedCount: 2, malformedCount: 1, duplicateCount: 1, overflowCount: 1, primaryUrl: first, imageUrls: [first, second] })
  assert.equal(fixtureDom.text.includes('fabricated.jpg'), false)
  assert.equal(fixtureDom.text.includes('fabricated-overflow.jpg'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Dog gallery fixture must send zero live provider requests')
  await fixture.ev(`document.querySelector('[data-domain-card="dog-gallery"]')?.scrollIntoView({block:'start',behavior:'instant'})`)
  await fixture.wait(`new Set([...document.querySelectorAll('[data-domain-card="dog-gallery"] img')].map((image)=>image.src)).size===2 && [...document.querySelectorAll('[data-domain-card="dog-gallery"] img')].every((image)=>image.complete)`)
  assert.deepEqual(fixture.fixtureRequests.map((request) => request.url).sort(), [endpoint, first, second].sort())
  assert.deepEqual(fixture.blockedProviders, [])
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ id: 'dogs', case: 'malformed/duplicate/count-contradiction HTTP-200 fixture', source: 'synthetic fixture', semanticState: fixtureDom.state, trustedImages: fixtureDom.trustedCount, malformedImages: fixtureDom.malformedCount, duplicateImages: fixtureDom.duplicateCount, overflowImages: fixtureDom.overflowCount, untrustedIdentitiesHidden: true, liveProviderRequests: 0 })
  await fixture.close(); active = undefined
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

fs.writeFileSync(`${evidence}/dog-gallery-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/dog-gallery-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
