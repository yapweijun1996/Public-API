import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://hex.pm/api/packages/ecto'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live Hex.pm package metadata plus deterministic malformed HTTP-200 fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="hexpm-package"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',bound:c?.dataset.requestBound||'',requested:c?.dataset.requestedPackage||'',provider:c?.dataset.providerPackage||'',identity:c?.dataset.identityMatch||'',providerReleaseCount:c?.dataset.providerReleaseCount===''||c?.dataset.providerReleaseCount===undefined?null:Number(c.dataset.providerReleaseCount),validReleaseCount:c?.dataset.validReleaseCount===''||c?.dataset.validReleaseCount===undefined?null:Number(c.dataset.validReleaseCount),invalidReleaseCount:c?.dataset.invalidReleaseCount===''||c?.dataset.invalidReleaseCount===undefined?null:Number(c.dataset.invalidReleaseCount),latest:c?.dataset.latestVersion||'',stable:c?.dataset.latestStableVersion||'',downloads:c?.dataset.totalDownloads===''||c?.dataset.totalDownloads===undefined?null:Number(c.dataset.totalDownloads),recent:c?.dataset.recentDownloads===''||c?.dataset.recentDownloads===undefined?null:Number(c.dataset.recentDownloads),owners:Number(c?.dataset.ownerCount||0),licenses:Number(c?.dataset.licenseCount||0),endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('hexpm')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(run.data && typeof run.data === 'object' && !Array.isArray(run.data), 'live Hex.pm response must be an object')
  assert.equal(run.data.name, 'ecto')
  assert.equal(run.data.repository, 'hexpm')
  assert.equal(typeof run.data.latest_version, 'string')
  assert(Array.isArray(run.data.releases), 'live Hex.pm response must expose releases[]')
  assert(run.data.downloads && typeof run.data.downloads === 'object' && !Array.isArray(run.data.downloads), 'live Hex.pm response must expose downloads')
  for (const key of ['all', 'recent', 'week', 'day']) {
    assert.equal(typeof run.data.downloads[key], 'number', `downloads.${key} must be numeric`)
    assert(Number.isFinite(run.data.downloads[key]) && run.data.downloads[key] >= 0, `downloads.${key} must be non-negative`)
  }

  const dom = await readDom(b)
  assert.equal(dom.layout, 'hex-package')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.bound, 'true')
  assert.equal(dom.requested, 'ecto')
  assert.equal(dom.provider, run.data.name)
  assert.equal(dom.identity, 'true')
  assert.equal(dom.providerReleaseCount, run.data.releases.length)
  assert.equal(dom.validReleaseCount, run.data.releases.length)
  assert.equal(dom.invalidReleaseCount, 0)
  assert.equal(dom.latest, run.data.latest_version)
  assert.equal(dom.stable, typeof run.data.latest_stable_version === 'string' ? run.data.latest_stable_version : '')
  assert.equal(dom.downloads, run.data.downloads.all)
  assert.equal(dom.recent, run.data.downloads.recent)
  const expectedOwners = Array.isArray(run.data.owners) ? run.data.owners.filter((owner) => owner && typeof owner === 'object' && typeof owner.username === 'string' && owner.username.trim() && typeof owner.url === 'string' && owner.url.trim()).length : 0
  const expectedLicenses = run.data.meta && typeof run.data.meta === 'object' && Array.isArray(run.data.meta.licenses) ? run.data.meta.licenses.filter((value) => typeof value === 'string' && value.trim()).length : 0
  assert.equal(dom.owners, expectedOwners)
  assert.equal(dom.licenses, expectedLicenses)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.overflow, false)
  assert.equal(dom.text.includes(run.data.name), true)
  assert.equal(dom.text.includes(run.data.latest_version), true)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id: 'hexpm', case: 'live request-bound package metadata', state: dom.state, requestBound: true, package: dom.provider, latest: dom.latest, stable: dom.stable, releases: dom.providerReleaseCount, downloads: dom.downloads, recentDownloads: dom.recent, corsBrowserExecution: true, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close()
  b = undefined

  const wrongFixture = {
    meta: { description: 'Fabricated package metadata', licenses: ['MIT'], links: {} },
    name: 'fabricated_package', repository: 'hexpm', url: 'https://hex.pm/api/packages/fabricated_package',
    latest_version: '999.0.0', latest_stable_version: '999.0.0',
    downloads: { all: 999999999, recent: 999999, week: 99999, day: 9999 },
    releases: [{ version: '999.0.0', url: 'https://hex.pm/api/packages/fabricated_package/releases/999.0.0', has_docs: true, inserted_at: '2026-09-12T00:00:00Z' }],
    configs: {}, inserted_at: '2026-09-12T00:00:00Z', updated_at: '2026-09-12T00:00:00Z', owners: [],
  }
  const wrong = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrongFixture }]]) })
  try {
    await wrong.nav('hexpm')
    const result = await wrong.run()
    assert.equal(result.ok, true, result.error)
    const domWrong = await readDom(wrong)
    assert.equal(domWrong.state, 'invalid')
    assert.equal(domWrong.text.includes('fabricated_package'), false)
    assert.equal(domWrong.text.includes('999.0.0'), false)
    assert.equal(domWrong.text.includes('999,999,999'), false)
    assert.equal(wrong.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(wrong.errors, [])
    report.checks.push({ id: 'hexpm', case: 'wrong package identity HTTP-200', state: 'invalid', fabricatedFactsHidden: true })
  } finally {
    await wrong.close()
  }

  const mixedFixture = {
    meta: { description: 'Ecto package', licenses: ['Apache-2.0'], links: {} },
    name: 'ecto', repository: 'hexpm', url: endpoint,
    latest_version: '3.14.2', latest_stable_version: '3.14.2',
    downloads: { all: 146785342, recent: 4559972, week: 429542, day: 64438 },
    releases: [
      { version: '3.14.2', url: 'https://hex.pm/api/packages/ecto/releases/3.14.2', has_docs: true, inserted_at: '2026-08-14T15:59:20Z' },
      { version: '999.0.0', url: 'https://example.test/fabricated', has_docs: 'yes', inserted_at: '2026-09-12T00:00:00Z' },
    ],
    configs: {}, inserted_at: '2014-04-21T00:00:00Z', updated_at: '2026-08-14T00:00:00Z', owners: [],
  }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: mixedFixture }]]) })
  try {
    await mixed.nav('hexpm')
    const result = await mixed.run()
    assert.equal(result.ok, true, result.error)
    const domMixed = await readDom(mixed)
    assert.equal(domMixed.state, 'partial')
    assert.equal(domMixed.providerReleaseCount, 2)
    assert.equal(domMixed.validReleaseCount, 1)
    assert.equal(domMixed.invalidReleaseCount, 1)
    assert.equal(domMixed.text.includes('3.14.2'), true)
    assert.equal(domMixed.text.includes('999.0.0'), false)
    assert.deepEqual(mixed.errors, [])
    report.checks.push({ id: 'hexpm', case: 'mixed malformed release HTTP-200', state: 'partial', providerReleases: 2, trustedReleases: 1, fabricatedReleaseHidden: true })
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
fs.writeFileSync(`${evidence}/hexpm-package-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/hexpm-package-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
