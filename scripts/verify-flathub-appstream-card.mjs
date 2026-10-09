import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const appId = 'org.gnome.Calculator'
const endpoint = `https://flathub.org/api/v2/appstream/${appId}`
const mismatchId = 'org.gnome.Calendar'
const mismatchEndpoint = `https://flathub.org/api/v2/appstream/${mismatchId}`
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'one live Flathub request plus isolated malformed and provider-identity-mismatch HTTP-200 fixtures', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const semantic = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="flathub-appstream"]'), first=card?.querySelector('[data-screenshot-url]')
  return {layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', requestAppId:card?.dataset.requestAppId||'', providerAppId:card?.dataset.providerAppId||'', stableVersion:card?.dataset.stableReleaseVersion||'', bundle:card?.dataset.bundleIdentity||'', runtime:card?.dataset.runtimeIdentity||'', screenshotCount:Number(card?.dataset.screenshotCount||0), malformed:Number(card?.dataset.malformedEvidenceCount||0), duplicates:Number(card?.dataset.duplicateEvidenceCount||0), firstScreenshot:first?.dataset.screenshotUrl||'', firstWidth:Number(first?.dataset.screenshotWidth||0), firstHeight:Number(first?.dataset.screenshotHeight||0), firstCaption:first?.querySelector('img')?.alt||'', links:card?.querySelectorAll('a').length||0, text:card?.innerText||''}
})()`)
const fixtureBody = (overrides = {}) => ({
  id: appId,
  name: 'Calculator',
  summary: 'Perform arithmetic, scientific or financial calculations',
  developer_name: 'The GNOME Project',
  project_license: 'GPL-3.0-or-later',
  is_free_license: true,
  bundle: { type: 'flatpak', value: `app/${appId}/x86_64/stable`, runtime: 'org.gnome.Platform/x86_64/50' },
  launchable: { type: 'desktop-id', value: `${appId}.desktop` },
  urls: { homepage: 'https://apps.gnome.org/Calculator', vcs_browser: 'https://gitlab.gnome.org/GNOME/gnome-calculator' },
  releases: [{ type: 'stable', version: '50.0', timestamp: '1767225600', description: '<img src=x onerror=alert(1)>' }],
  screenshots: [{ caption: 'Basic Mode', default: true, sizes: [{ src: `https://dl.flathub.org/media/org/gnome/Calculator/fixture/screenshots/basic.png`, width: '410', height: '666' }] }],
  description: '<img src=x onerror=alert(2)>',
  ...overrides,
})
const setAppId = (b, value) => b.ev(`(() => { const input=document.querySelector('#parameter-appId'); if(!input) throw Error('Missing appId control'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('flathub-appstream')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const response = await live.run()
  assert.equal(response.ok, true, response.error)
  assert.equal(live.requestCount - before, 1, 'Flathub verifier must issue exactly one live provider request')
  assert(response.data && typeof response.data === 'object')
  assert.equal(response.data.id, appId)
  assert.equal(typeof response.data.name, 'string')
  assert.equal(typeof response.data.summary, 'string')
  assert.equal(typeof response.data.developer_name, 'string')
  assert.equal(typeof response.data.project_license, 'string')
  assert.equal(typeof response.data.is_free_license, 'boolean')
  assert.equal(response.data.bundle?.type, 'flatpak')
  assert.equal(response.data.bundle?.value?.startsWith(`app/${appId}/`), true)
  assert.equal(typeof response.data.bundle?.runtime, 'string')
  assert(Array.isArray(response.data.releases) && response.data.releases.length > 0)
  assert(response.data.releases.every((release) => typeof release.timestamp === 'string' && /^[1-9]\d*$/.test(release.timestamp)))
  const stable = response.data.releases.find((release) => release.type === 'stable')
  assert(stable && typeof stable.version === 'string' && stable.version.trim())
  assert(Array.isArray(response.data.screenshots) && response.data.screenshots.length > 0)
  assert(response.data.screenshots.every((shot) => typeof shot.caption === 'string' && shot.caption.trim() && Array.isArray(shot.sizes) && shot.sizes.length > 0 && shot.sizes.every((size) => typeof size.width === 'string' && typeof size.height === 'string' && /^https:\/\/dl\.flathub\.org\//.test(size.src))))
  const expectedFirst = [...response.data.screenshots[0].sizes].sort((left, right) => (Number(right.width) * Number(right.height)) - (Number(left.width) * Number(left.height)))[0]
  const dom = await semantic(live)
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract, requestAppId:dom.requestAppId, providerAppId:dom.providerAppId, stableVersion:dom.stableVersion, bundle:dom.bundle, runtime:dom.runtime, screenshotCount:dom.screenshotCount, malformed:dom.malformed, duplicates:dom.duplicates, firstScreenshot:dom.firstScreenshot, firstWidth:dom.firstWidth, firstHeight:dom.firstHeight, firstCaption:dom.firstCaption }, { layout:'appstream-profile', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-flathub-appstream-v1', requestAppId:appId, providerAppId:response.data.id, stableVersion:stable.version, bundle:response.data.bundle.value, runtime:response.data.bundle.runtime, screenshotCount:response.data.screenshots.length, malformed:0, duplicates:0, firstScreenshot:expectedFirst.src, firstWidth:Number(expectedFirst.width), firstHeight:Number(expectedFirst.height), firstCaption:response.data.screenshots[0].caption })
  assert(dom.text.includes(response.data.name) && dom.text.includes(response.data.project_license))
  assert.equal(dom.text.includes('<img'), false)
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'flathub-appstream', source:'live provider', exactRequest:endpoint, providerAppId:response.data.id, stableVersion:stable.version, releaseCount:response.data.releases.length, screenshotCount:response.data.screenshots.length, semanticState:dom.state, requestBound:dom.requestBound, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active = undefined

  const malformedBody = fixtureBody({
    urls: { homepage: 'http://example.test/not-https', vcs_browser: 'javascript:alert(1)' },
    releases: [{ type: 'stable', version: '50.0', timestamp: 1767225600, description: '<img src=x onerror=alert(1)>' }],
    screenshots: [
      { caption: 'Basic Mode', default: true, sizes: [{ src: 'https://dl.flathub.org/media/org/gnome/Calculator/fixture/screenshots/basic.png', width: '410', height: '666' }] },
      { caption: 'Malformed numeric dimensions', sizes: [{ src: 'https://dl.flathub.org/media/org/gnome/Calculator/fixture/screenshots/bad.png', width: 750, height: 666 }] },
    ],
  })
  const malformed = await browser(`${root}/dist`, { fixtures:new Map([[endpoint, { body:malformedBody }]]) })
  active = malformed
  await malformed.nav('flathub-appstream')
  const malformedBefore = malformed.requestCount
  const malformedResponse = await malformed.run(); assert.equal(malformedResponse.ok, true, malformedResponse.error)
  const malformedDom = await semantic(malformed)
  assert.equal(malformedDom.state, 'partial')
  assert.equal(malformedDom.requestBound, 'true')
  assert.equal(malformedDom.screenshotCount, 1)
  assert(malformedDom.malformed >= 4)
  assert.equal(malformedDom.stableVersion, '')
  assert.equal(malformedDom.links, 0)
  assert.equal(malformedDom.text.includes('Malformed numeric dimensions'), false)
  assert.equal(malformedDom.text.includes('javascript:'), false)
  const malformedFixtures = malformed.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(malformedFixtures, 1)
  assert.equal(malformed.requestCount - malformedBefore, malformedFixtures)
  assert.deepEqual(malformed.blockedProviders, [])
  assert.deepEqual(malformed.errors, [])
  report.checks.push({ id:'flathub-appstream', case:'malformed wire types and links HTTP-200 fixture', source:'synthetic fixture', semanticState:malformedDom.state, validScreenshots:1, malformedEvidence:malformedDom.malformed, malformedEvidenceHidden:true, liveProviderRequests:0 })
  await malformed.close(); active = undefined

  const mismatch = await browser(`${root}/dist`, { fixtures:new Map([[mismatchEndpoint, { body:fixtureBody() }]]) })
  active = mismatch
  await mismatch.nav('flathub-appstream')
  await setAppId(mismatch, mismatchId)
  await mismatch.wait(`document.querySelector('.endpoint-box code')?.textContent===${JSON.stringify(mismatchEndpoint)}`)
  const mismatchBefore = mismatch.requestCount
  const mismatchResponse = await mismatch.run(); assert.equal(mismatchResponse.ok, true, mismatchResponse.error)
  const mismatchDom = await semantic(mismatch)
  assert.equal(mismatchDom.state, 'invalid')
  assert.equal(mismatchDom.requestBound, 'true')
  assert.equal(mismatchDom.requestAppId, mismatchId)
  assert.equal(mismatchDom.providerAppId, '')
  assert.equal(mismatchDom.text.includes('Calculator'), false)
  const mismatchFixtures = mismatch.fixtureRequests.filter((request) => request.url === mismatchEndpoint && request.method === 'GET').length
  assert.equal(mismatchFixtures, 1)
  assert.equal(mismatch.requestCount - mismatchBefore, mismatchFixtures)
  assert.deepEqual(mismatch.blockedProviders, [])
  assert.deepEqual(mismatch.errors, [])
  report.checks.push({ id:'flathub-appstream', case:'provider identity mismatch HTTP-200 fixture', source:'synthetic fixture', requestedAppId:mismatchId, providerAppId:appId, semanticState:mismatchDom.state, fabricatedIdentityHidden:true, liveProviderRequests:0 })
  await mismatch.close(); active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures = active.networkFailures }
} finally { if (active) await active.close() }

fs.writeFileSync(`${evidence}/flathub-appstream-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/flathub-appstream-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
