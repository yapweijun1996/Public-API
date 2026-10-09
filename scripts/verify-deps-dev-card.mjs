import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.deps.dev/v3/systems/npm/packages/react'
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'live deps.dev GetPackage metadata plus deterministic wrong-package HTTP-200 data', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="deps-dev-package"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',requestBound:c?.dataset.requestBound||'',requestContract:c?.dataset.requestContract||'',requestedSystem:c?.dataset.requestedSystem||'',providerSystem:c?.dataset.providerSystem||'',systemMatch:c?.dataset.systemMatch||'',requestedPackage:c?.dataset.requestedPackage||'',providerPackage:c?.dataset.providerPackage||'',packageMatch:c?.dataset.packageMatch||'',canonicalized:c?.dataset.packageCanonicalized||'',providerVersions:Number(c?.dataset.providerVersionCount||0),validVersions:Number(c?.dataset.validVersionCount||0),invalidVersions:Number(c?.dataset.invalidVersionCount||0),incompleteVersions:Number(c?.dataset.incompleteVersionCount||0),defaultCount:Number(c?.dataset.defaultVersionCount||0),defaultContract:c?.dataset.defaultContract||'',defaultVersion:c?.dataset.defaultVersion||'',deprecatedCount:Number(c?.dataset.deprecatedVersionCount||0),endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('deps-dev')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(run.data && typeof run.data === 'object' && !Array.isArray(run.data), 'live deps.dev response must be an object')
  assert(run.data.packageKey && typeof run.data.packageKey === 'object' && !Array.isArray(run.data.packageKey), 'live deps.dev response must expose packageKey')
  assert(Array.isArray(run.data.versions), 'live deps.dev response must expose versions[]')
  const defaults = run.data.versions.filter((entry) => entry && typeof entry === 'object' && entry.isDefault === true)
  const deprecated = run.data.versions.filter((entry) => entry && typeof entry === 'object' && entry.isDeprecated === true)

  const dom = await readDom(b)
  assert.equal(dom.layout, 'package-insights')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-deps-dev-get-package-v2')
  assert.equal(dom.requestedSystem, 'npm')
  assert.equal(dom.providerSystem, run.data.packageKey.system)
  assert.equal(dom.systemMatch, 'true')
  assert.equal(dom.requestedPackage, 'react')
  assert.equal(dom.providerPackage, run.data.packageKey.name)
  assert.equal(dom.packageMatch, 'true')
  assert.equal(dom.canonicalized, 'false')
  assert.equal(dom.providerVersions, run.data.versions.length)
  assert.equal(dom.validVersions, run.data.versions.length)
  assert.equal(dom.invalidVersions, 0)
  assert.equal(dom.incompleteVersions, 0)
  assert.equal(dom.defaultCount, defaults.length)
  assert.equal(dom.defaultContract, 'true')
  assert.equal(dom.defaultVersion, defaults[0]?.versionKey?.version ?? '')
  assert.equal(dom.deprecatedCount, deprecated.length)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.overflow, false)
  assert.equal(dom.text.includes(run.data.packageKey.name), true)
  if (defaults[0]?.versionKey?.version) assert.equal(dom.text.includes(defaults[0].versionKey.version), true)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id: 'deps-dev', case: 'live exact request-bound GetPackage', state: dom.state, requestBound: true, requestContract: dom.requestContract, package: dom.providerPackage, versions: dom.providerVersions, defaultVersion: dom.defaultVersion, deprecatedVersions: dom.deprecatedCount, corsBrowserExecution: true, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const wrongFixture = { packageKey: { system: 'NPM', name: 'fabricated-package' }, versions: [{ versionKey: { system: 'NPM', name: 'fabricated-package', version: '999.0.0' }, publishedAt: '2026-01-01T00:00:00Z', isDefault: true, isDeprecated: false }] }
  const wrong = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrongFixture }]]) })
  try {
    await wrong.nav('deps-dev')
    const result = await wrong.run()
    assert.equal(result.ok, true, result.error)
    const domWrong = await readDom(wrong)
    assert.equal(domWrong.state, 'invalid')
    assert.equal(domWrong.text.includes('fabricated-package'), false)
    assert.equal(domWrong.text.includes('999.0.0'), false)
    assert.equal(wrong.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(wrong.errors, [])
    report.checks.push({ id: 'deps-dev', case: 'wrong package identity HTTP-200', state: 'invalid', fabricatedFactsHidden: true })
  } finally { await wrong.close() }
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/deps-dev-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/deps-dev-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
