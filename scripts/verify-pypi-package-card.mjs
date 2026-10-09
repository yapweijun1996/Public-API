import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://pypi.org/pypi/requests/json'
const normalize = (value) => value.toLowerCase().replace(/[-_.]+/g, '-')
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live PyPI project JSON metadata plus deterministic wrong-project HTTP-200 data',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="pypi-package"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',bound:c?.dataset.requestBound||'',requested:c?.dataset.requestedPackage||'',provider:c?.dataset.providerPackage||'',normalizedRequested:c?.dataset.normalizedRequestedPackage||'',normalizedProvider:c?.dataset.normalizedProviderPackage||'',identity:c?.dataset.identityMatch||'',version:c?.dataset.providerVersion||'',yanked:c?.dataset.yanked||'',vulnerabilityCount:c?.dataset.vulnerabilityCount===''||c?.dataset.vulnerabilityCount===undefined?null:Number(c.dataset.vulnerabilityCount),endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('pypi-json')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(run.data && typeof run.data === 'object' && !Array.isArray(run.data), 'live PyPI response must be an object')
  assert(run.data.info && typeof run.data.info === 'object' && !Array.isArray(run.data.info), 'live PyPI response must expose info')
  assert.equal(typeof run.data.info.name, 'string')
  assert.equal(typeof run.data.info.version, 'string')
  assert.equal(typeof run.data.info.yanked, 'boolean')
  assert(Array.isArray(run.data.vulnerabilities), 'live PyPI response must expose vulnerabilities[]')

  const dom = await readDom(b)
  assert.equal(dom.layout, 'python-package')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.bound, 'true')
  assert.equal(dom.requested, 'requests')
  assert.equal(dom.provider, run.data.info.name)
  assert.equal(dom.normalizedRequested, 'requests')
  assert.equal(dom.normalizedProvider, normalize(run.data.info.name))
  assert.equal(dom.identity, 'true')
  assert.equal(dom.version, run.data.info.version)
  assert.equal(dom.yanked, String(run.data.info.yanked))
  assert.equal(dom.vulnerabilityCount, run.data.vulnerabilities.length)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.overflow, false)
  assert.equal(dom.text.includes(run.data.info.name), true)
  assert.equal(dom.text.includes(run.data.info.version), true)
  if (typeof run.data.info.summary === 'string' && run.data.info.summary.trim()) assert.equal(dom.text.includes(run.data.info.summary.trim()), true)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id: 'pypi-json', case: 'live request-bound project JSON', state: dom.state, requestBound: true, project: dom.provider, version: dom.version, vulnerabilities: dom.vulnerabilityCount, corsBrowserExecution: true, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close()
  b = undefined

  const wrongFixture = {
    info: {
      name: 'fabricated-project', version: '999.0.0', summary: 'Fabricated package metadata.', requires_python: '>=99',
      license: 'Fabricated-License', license_expression: null, author: 'Fabricated Author', maintainer: null, yanked: false, yanked_reason: null,
      downloads: { last_day: -1, last_week: -1, last_month: -1 }, has_sig: false, bugtrack_url: null,
    },
    releases: { '999.0.0': [] },
    vulnerabilities: [],
  }
  const wrong = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrongFixture }]]) })
  try {
    await wrong.nav('pypi-json')
    const result = await wrong.run()
    assert.equal(result.ok, true, result.error)
    const domWrong = await readDom(wrong)
    assert.equal(domWrong.state, 'invalid')
    assert.equal(domWrong.text.includes('fabricated-project'), false)
    assert.equal(domWrong.text.includes('999.0.0'), false)
    assert.equal(domWrong.text.includes('Fabricated package metadata.'), false)
    assert.equal(wrong.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(wrong.errors, [])
    report.checks.push({ id: 'pypi-json', case: 'wrong normalized project identity HTTP-200', state: 'invalid', fabricatedFactsHidden: true })
  } finally { await wrong.close() }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}
fs.writeFileSync(`${evidence}/pypi-package-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/pypi-package-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
