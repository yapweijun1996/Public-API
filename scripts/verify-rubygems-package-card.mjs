import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://rubygems.org/api/v1/gems/rails.json'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live RubyGems.org package metadata plus a synthetic wrong-gem HTTP-200 fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="rubygems-package"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',requested:c?.dataset.requestedGem||'',provider:c?.dataset.providerGem||'',identity:c?.dataset.identityMatch||'',version:c?.dataset.providerVersion||'',downloads:c?.dataset.totalDownloads===''||c?.dataset.totalDownloads===undefined?null:Number(c.dataset.totalDownloads),versionDownloads:c?.dataset.versionDownloads===''||c?.dataset.versionDownloads===undefined?null:Number(c.dataset.versionDownloads),platform:c?.dataset.platform||'',licenseCount:Number(c?.dataset.licenseCount||0),endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('rubygems-lookup')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(run.data && typeof run.data === 'object' && !Array.isArray(run.data), 'live RubyGems response must be an object')
  assert.equal(typeof run.data.name, 'string')
  assert.equal(typeof run.data.version, 'string')
  assert.equal(typeof run.data.downloads, 'number')
  assert(Number.isFinite(run.data.downloads) && run.data.downloads >= 0)
  assert.equal(typeof run.data.version_downloads, 'number')
  assert(Number.isFinite(run.data.version_downloads) && run.data.version_downloads >= 0)

  const dom = await readDom(b)
  assert.equal(dom.layout, 'package-release')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requested, 'rails')
  assert.equal(dom.provider, run.data.name)
  assert.equal(dom.identity, 'true')
  assert.equal(dom.version, run.data.version)
  assert.equal(dom.downloads, run.data.downloads)
  assert.equal(dom.versionDownloads, run.data.version_downloads)
  assert.equal(dom.platform, typeof run.data.platform === 'string' ? run.data.platform : '')
  const expectedLicenses = Array.isArray(run.data.licenses) ? run.data.licenses.filter((value) => typeof value === 'string' && value.trim()).length : 0
  assert.equal(dom.licenseCount, expectedLicenses)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.overflow, false)
  assert.equal(dom.text.includes(run.data.name), true)
  assert.equal(dom.text.includes(run.data.version), true)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id: 'rubygems-lookup', case: 'live request-bound package metadata', state: dom.state, gem: dom.provider, version: dom.version, downloads: dom.downloads, versionDownloads: dom.versionDownloads, corsBrowserExecution: true, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close()
  b = undefined

  const wrongFixture = {
    name: 'fabricated-gem', version: '999.0.0', downloads: 999999999, version_downloads: 999999,
    platform: 'ruby', authors: 'Fabricated Author', info: 'Fabricated package metadata', licenses: ['MIT'], yanked: false,
  }
  const wrong = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrongFixture }]]) })
  try {
    await wrong.nav('rubygems-lookup')
    const result = await wrong.run()
    assert.equal(result.ok, true, result.error)
    const domWrong = await readDom(wrong)
    assert.equal(domWrong.state, 'invalid')
    assert.equal(domWrong.text.includes('fabricated-gem'), false)
    assert.equal(domWrong.text.includes('999.0.0'), false)
    assert.equal(domWrong.text.includes('999,999,999'), false)
    assert.equal(wrong.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(wrong.errors, [])
    report.checks.push({ id: 'rubygems-lookup', case: 'wrong gem identity HTTP-200', state: 'invalid', fabricatedFactsHidden: true })
  } finally {
    await wrong.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}
fs.writeFileSync(`${evidence}/rubygems-package-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/rubygems-package-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
