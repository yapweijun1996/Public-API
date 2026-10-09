import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://pub.dev/api/packages/riverpod'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live pub.dev Hosted Pub v2 package metadata plus deterministic malformed HTTP-200 fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="pubdev-package"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',requested:c?.dataset.requestedPackage||'',provider:c?.dataset.providerPackage||'',bound:c?.dataset.requestBound||'',identity:c?.dataset.identityMatch||'',providerVersionCount:Number(c?.dataset.providerVersionCount||0),validVersionCount:Number(c?.dataset.validVersionCount||0),invalidVersionCount:Number(c?.dataset.invalidVersionCount||0),incompleteVersionCount:Number(c?.dataset.incompleteVersionCount||0),latest:c?.dataset.latestVersion||'',latestPresent:c?.dataset.latestPresentInVersions||'',published:c?.dataset.latestPublished||'',sdk:c?.dataset.sdkConstraint||'',discontinued:c?.dataset.discontinued||'',replacedBy:c?.dataset.replacedBy||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('pub-dev')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(run.data && typeof run.data === 'object' && !Array.isArray(run.data), 'live pub.dev response must be an object')
  assert.equal(run.data.name, 'riverpod')
  assert(run.data.latest && typeof run.data.latest === 'object' && !Array.isArray(run.data.latest), 'live pub.dev response must expose latest')
  assert.equal(typeof run.data.latest.version, 'string')
  assert(Array.isArray(run.data.versions), 'live pub.dev response must expose versions[]')
  assert(run.data.versions.length > 0, 'live pub.dev package must contain version history')
  assert(run.data.versions.some((entry) => entry && typeof entry === 'object' && entry.version === run.data.latest.version), 'latest version must be represented in versions[]')

  const dom = await readDom(b)
  assert.equal(dom.layout, 'dart-package')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requested, 'riverpod')
  assert.equal(dom.provider, run.data.name)
  assert.equal(dom.bound, 'true')
  assert.equal(dom.identity, 'true')
  assert.equal(dom.providerVersionCount, run.data.versions.length)
  assert.equal(dom.validVersionCount, run.data.versions.length)
  assert.equal(dom.invalidVersionCount, 0)
  assert.equal(dom.incompleteVersionCount, 0)
  assert.equal(dom.latest, run.data.latest.version)
  assert.equal(dom.latestPresent, 'true')
  assert.equal(dom.published, typeof run.data.latest.published === 'string' ? run.data.latest.published : '')
  assert.equal(dom.sdk, typeof run.data.latest?.pubspec?.environment?.sdk === 'string' ? run.data.latest.pubspec.environment.sdk : '')
  assert.equal(dom.discontinued, String(run.data.isDiscontinued === true))
  assert.equal(dom.replacedBy, typeof run.data.replacedBy === 'string' ? run.data.replacedBy : '')
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.overflow, false)
  assert.equal(dom.text.includes(run.data.name), true)
  assert.equal(dom.text.includes(run.data.latest.version), true)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id: 'pub-dev', case: 'live request-bound Hosted Pub v2 package', state: dom.state, package: dom.provider, latest: dom.latest, versions: dom.providerVersionCount, corsBrowserExecution: true, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close()
  b = undefined

  const version = (packageName, value, overrides = {}) => ({
    version: value,
    pubspec: { name: packageName, version: value, description: `${packageName} package` },
    archive_url: `https://pub.dev/api/archives/${packageName}-${value}.tar.gz`,
    archive_sha256: 'a'.repeat(64),
    published: '2026-09-03T22:14:57.641244Z',
    ...overrides,
  })
  const wrongLatest = version('fabricated_package', '999.0.0')
  const wrongFixture = { name: 'fabricated_package', latest: wrongLatest, versions: [wrongLatest] }
  const wrong = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrongFixture }]]) })
  try {
    await wrong.nav('pub-dev')
    const result = await wrong.run()
    assert.equal(result.ok, true, result.error)
    const domWrong = await readDom(wrong)
    assert.equal(domWrong.state, 'invalid')
    assert.equal(domWrong.text.includes('fabricated_package'), false)
    assert.equal(domWrong.text.includes('999.0.0'), false)
    assert.equal(wrong.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(wrong.errors, [])
    report.checks.push({ id: 'pub-dev', case: 'wrong package identity HTTP-200', state: 'invalid', fabricatedFactsHidden: true })
  } finally {
    await wrong.close()
  }

  const current = version('riverpod', '3.4.3', { pubspec: { name: 'riverpod', version: '3.4.3', description: 'Trusted package', environment: { sdk: '^3.12.0' } } })
  const malformed = version('riverpod', '999.0.0', { pubspec: { name: 'fabricated_package', version: '999.0.0' }, archive_url: 'http://example.test/fabricated.tar.gz' })
  const mixedFixture = { name: 'riverpod', latest: current, versions: [current, malformed] }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: mixedFixture }]]) })
  try {
    await mixed.nav('pub-dev')
    const result = await mixed.run()
    assert.equal(result.ok, true, result.error)
    const domMixed = await readDom(mixed)
    assert.equal(domMixed.state, 'partial')
    assert.equal(domMixed.providerVersionCount, 2)
    assert.equal(domMixed.validVersionCount, 1)
    assert.equal(domMixed.invalidVersionCount, 1)
    assert.equal(domMixed.text.includes('3.4.3'), true)
    assert.equal(domMixed.text.includes('999.0.0'), false)
    assert.equal(domMixed.text.includes('fabricated_package'), false)
    assert.deepEqual(mixed.errors, [])
    report.checks.push({ id: 'pub-dev', case: 'mixed malformed version HTTP-200', state: 'partial', providerVersions: 2, trustedVersions: 1, fabricatedVersionHidden: true })
  } finally {
    await mixed.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}
fs.writeFileSync(`${evidence}/pubdev-package-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/pubdev-package-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
