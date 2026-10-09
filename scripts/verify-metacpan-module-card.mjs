import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'module.name:"Mojolicious" AND status:latest'
const endpoint = `https://fastapi.metacpan.org/v1/module/_search?${new URLSearchParams({ q: query, size: '6' }).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live MetaCPAN exact latest-module search plus deterministic malformed HTTP-200 fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="metacpan-module-search"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',requested:c?.dataset.requestedModule||'',requestSize:Number(c?.dataset.requestSize||0),providerTotal:Number(c?.dataset.providerTotal||0),providerHits:Number(c?.dataset.providerHitCount||0),validHits:Number(c?.dataset.validHitCount||0),invalidHits:Number(c?.dataset.invalidHitCount||0),incompleteHits:Number(c?.dataset.incompleteHitCount||0),queryBound:c?.dataset.queryBound||'',timedOut:c?.dataset.providerTimedOut||'',countContract:c?.dataset.countContract||'',primaryModule:c?.dataset.primaryModule||'',distribution:c?.dataset.primaryDistribution||'',release:c?.dataset.primaryRelease||'',version:c?.dataset.primaryVersion||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

const validLiveHit = (hit) => hit && typeof hit === 'object' && typeof hit._id === 'string' && hit._id.trim() && hit._source && typeof hit._source === 'object' && hit._source.status === 'latest' && typeof hit._source.distribution === 'string' && hit._source.distribution.trim() && typeof hit._source.release === 'string' && hit._source.release.trim() && typeof hit._source.version === 'string' && hit._source.version.trim() && Array.isArray(hit._source.module) && hit._source.module.some((entry) => entry && typeof entry === 'object' && entry.name === 'Mojolicious')

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('metacpan')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(run.data && typeof run.data === 'object' && !Array.isArray(run.data), 'live MetaCPAN response must be an object')
  assert.equal(run.data.timed_out, false)
  assert(run.data.hits && typeof run.data.hits === 'object' && !Array.isArray(run.data.hits), 'live response must expose hits')
  assert.equal(typeof run.data.hits.total, 'number')
  assert(Array.isArray(run.data.hits.hits), 'live response must expose hits.hits[]')
  assert(run.data.hits.hits.length > 0, 'default Mojolicious exact search must return at least one current module hit')
  assert(run.data.hits.hits.every(validLiveHit), 'every returned live hit must identify the requested latest module')

  const primary = run.data.hits.hits[0]._source
  const dom = await readDom(b)
  assert.equal(dom.layout, 'cpan-module-search')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requested, 'Mojolicious')
  assert.equal(dom.requestSize, 6)
  assert.equal(dom.providerTotal, run.data.hits.total)
  assert.equal(dom.providerHits, run.data.hits.hits.length)
  assert.equal(dom.validHits, run.data.hits.hits.length)
  assert.equal(dom.invalidHits, 0)
  assert.equal(dom.incompleteHits, 0)
  assert.equal(dom.queryBound, 'true')
  assert.equal(dom.timedOut, 'false')
  assert.equal(dom.countContract, 'true')
  assert.equal(dom.primaryModule, 'Mojolicious')
  assert.equal(dom.distribution, primary.distribution)
  assert.equal(dom.release, primary.release)
  assert.equal(dom.version, primary.version)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.text.includes(primary.release), true)
  assert.equal(dom.text.includes(primary.version), true)
  assert.equal(dom.overflow, false)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id: 'metacpan', case: 'live exact latest-module search', state: dom.state, module: dom.primaryModule, distribution: dom.distribution, release: dom.release, version: dom.version, providerTotal: dom.providerTotal, returnedHits: dom.providerHits, corsBrowserExecution: true, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close()
  b = undefined

  const goodHit = {
    _index: 'file_01', _id: 'good-mojolicious', _score: 18,
    _source: { id: 'good-mojolicious', author: 'SRI', date: '2026-08-29T08:45:15', distribution: 'Mojolicious', documentation: 'Mojolicious', module: [{ name: 'Mojolicious', version: '9.49', authorized: true, indexed: true }], name: 'Mojolicious.pm', release: 'Mojolicious-9.49', status: 'latest', version: '9.49' },
  }
  const badHit = {
    _index: 'file_01', _id: 'fabricated-hit', _score: 99,
    _source: { id: 'fabricated-hit', author: 'BAD', date: '2026-09-12T00:00:00', distribution: 'Fabricated-Dist', documentation: 'Fabricated::Module', module: [{ name: 'Fabricated::Module', version: '999.0.0' }], name: 'Fabricated.pm', release: 'Fabricated-Dist-999.0.0', status: 'latest', version: '999.0.0' },
  }
  const wrongBody = { took: 1, timed_out: false, hits: { total: 1, max_score: 99, hits: [badHit] } }
  const wrong = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrongBody }]]) })
  try {
    await wrong.nav('metacpan')
    const result = await wrong.run()
    assert.equal(result.ok, true, result.error)
    const domWrong = await readDom(wrong)
    assert.equal(domWrong.state, 'invalid')
    assert.equal(domWrong.text.includes('Fabricated::Module'), false)
    assert.equal(domWrong.text.includes('999.0.0'), false)
    assert.equal(wrong.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(wrong.errors, [])
    report.checks.push({ id: 'metacpan', case: 'wrong module identity HTTP-200', state: 'invalid', fabricatedFactsHidden: true })
  } finally { await wrong.close() }

  const mixedBody = { took: 1, timed_out: false, hits: { total: 2, max_score: 99, hits: [goodHit, badHit] } }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: mixedBody }]]) })
  try {
    await mixed.nav('metacpan')
    const result = await mixed.run()
    assert.equal(result.ok, true, result.error)
    const domMixed = await readDom(mixed)
    assert.equal(domMixed.state, 'partial')
    assert.equal(domMixed.providerHits, 2)
    assert.equal(domMixed.validHits, 1)
    assert.equal(domMixed.invalidHits, 1)
    assert.equal(domMixed.text.includes('Mojolicious-9.49'), true)
    assert.equal(domMixed.text.includes('Fabricated::Module'), false)
    assert.equal(domMixed.text.includes('999.0.0'), false)
    assert.deepEqual(mixed.errors, [])
    report.checks.push({ id: 'metacpan', case: 'mixed mismatched hit HTTP-200', state: 'partial', providerHits: 2, trustedHits: 1, fabricatedHitHidden: true })
  } finally { await mixed.close() }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}
fs.writeFileSync(`${evidence}/metacpan-module-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/metacpan-module-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
