import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://lichess.org/api/player/top/5/blitz'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Lichess blitz leaderboard lookup plus a synthetic wrong-performance HTTP-200 response',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="lichess-leaderboard"]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',requestedPerfType:card?.dataset.requestedPerfType||'',requestedCount:Number(card?.dataset.requestedCount),responseCountValid:card?.dataset.responseCountValid||'',validPlayerCount:Number(card?.dataset.validPlayerCount),invalidPlayerCount:Number(card?.dataset.invalidPlayerCount),allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  }
})()`)

const verifyMobileAx = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({document:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.document || overflow.preview, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
}

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('lichess-top-players')
  const before = b.requestCount
  const result = await b.run()
  const providerFetches = b.requestCount - before
  assert.equal(result.ok, true, result.error)
  assert(result.data && typeof result.data === 'object' && !Array.isArray(result.data), 'Lichess returned a non-object leaderboard')
  assert(Array.isArray(result.data.users), 'Lichess leaderboard did not return users[]')
  assert(result.data.users.length <= 5, `Lichess returned ${result.data.users.length} users for nb=5`)
  for (const user of result.data.users) {
    assert(user && typeof user === 'object' && !Array.isArray(user), 'Lichess returned a malformed leaderboard user')
    assert(user.perfs && typeof user.perfs === 'object' && user.perfs.blitz && typeof user.perfs.blitz === 'object', 'Lichess leaderboard user omitted requested blitz performance')
  }
  const dom = await readDom(b)
  assert.equal(dom.layout, 'chess-ratings')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, result.data.users.length ? 'ready' : 'empty')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-lichess-leaderboard-bodyless-get')
  assert.equal(dom.requestedPerfType, 'blitz')
  assert.equal(dom.requestedCount, 5)
  assert.equal(dom.responseCountValid, 'true')
  assert.equal(dom.validPlayerCount, result.data.users.length)
  assert.equal(dom.invalidPlayerCount, 0)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(providerFetches, 1)
  assert.equal(dom.overflow, false)
  await verifyMobileAx(b)
  report.checks.push({ id: 'lichess-top-players', provider: 'Lichess', case: 'live exact blitz leaderboard response', semanticState: dom.state, requestBound: true, validPlayerCount: dom.validPlayerCount, providerFetches, providerCors: 'browser-readable', mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  assert.deepEqual(b.networkFailures, [])
  await b.close()
  b = undefined

  const wrongPerf = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: { users: [{ id: 'wrongperf', username: 'WrongPerf', perfs: { rapid: { rating: 2999, progress: 100 } } }] } }]]),
    blockedProviderPatterns: ['https://lichess.org/*'],
  })
  try {
    await wrongPerf.nav('lichess-top-players')
    const fixtureResult = await wrongPerf.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await readDom(wrongPerf)
    assert.equal(fixtureDom.state, 'invalid')
    assert.equal(fixtureDom.requestBound, 'true')
    assert.equal(fixtureDom.validPlayerCount, 0)
    assert.equal(fixtureDom.invalidPlayerCount, 1)
    assert.equal(fixtureDom.allText.includes('2,999'), false)
    assert.deepEqual(wrongPerf.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(wrongPerf.blockedProviders, [])
    assert.deepEqual(wrongPerf.errors, [])
    report.checks.push({ id: 'lichess-top-players', case: 'synthetic wrong-performance HTTP-200 response', semanticState: 'invalid', wrongPerformanceHidden: true, liveProviderRequests: 0 })
  } finally {
    await wrongPerf.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/lichess-leaderboard-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/lichess-leaderboard-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
