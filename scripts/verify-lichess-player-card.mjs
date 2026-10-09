import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://lichess.org/api/user/thibault'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Lichess public-user lookup plus a synthetic wrong-user HTTP-200 response',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="lichess-player-ratings"]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',requestedUsername:card?.dataset.requestedUsername||'',providerUserId:card?.dataset.providerUserId||'',identityMatch:card?.dataset.responseIdentityMatch||'',validPerfCount:Number(card?.dataset.validPerfCount),invalidPerfCount:Number(card?.dataset.invalidPerfCount),allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
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
  await b.nav('chess-player-stats')
  const before = b.requestCount
  const result = await b.run()
  const providerFetches = b.requestCount - before
  assert.equal(result.ok, true, result.error)
  assert(result.data && typeof result.data === 'object' && !Array.isArray(result.data), 'Lichess returned a non-object response')
  assert.equal(String(result.data.id || '').toLowerCase(), 'thibault')
  assert.equal(typeof result.data.perfs, 'object')
  const dom = await readDom(b)
  assert.equal(dom.layout, 'chess-ratings')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-lichess-public-user-bodyless-get')
  assert.equal(dom.requestedUsername, 'thibault')
  assert.equal(dom.providerUserId, 'thibault')
  assert.equal(dom.identityMatch, 'true')
  assert(dom.validPerfCount > 0)
  assert.equal(dom.invalidPerfCount, 0)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(providerFetches, 1)
  assert.equal(dom.overflow, false)
  await verifyMobileAx(b)
  report.checks.push({ id: 'chess-player-stats', provider: 'Lichess', case: 'live exact public-user response', semanticState: dom.state, requestBound: true, validPerfCount: dom.validPerfCount, providerFetches, providerCors: 'browser-readable', mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  assert.deepEqual(b.networkFailures, [])
  await b.close()
  b = undefined

  const wrongIdentity = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: {
      id: 'someoneelse', username: 'SomeoneElse', url: 'https://lichess.org/@/SomeoneElse',
      perfs: { rapid: { games: 10, rating: 2999, rd: 50, prog: 100 } },
    } }]]),
    blockedProviderPatterns: ['https://lichess.org/*'],
  })
  try {
    await wrongIdentity.nav('chess-player-stats')
    const fixtureResult = await wrongIdentity.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await readDom(wrongIdentity)
    assert.equal(fixtureDom.state, 'invalid')
    assert.equal(fixtureDom.requestBound, 'true')
    assert.equal(fixtureDom.identityMatch, 'false')
    assert.equal(fixtureDom.allText.includes('2,999'), false)
    assert.deepEqual(wrongIdentity.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(wrongIdentity.blockedProviders, [])
    assert.deepEqual(wrongIdentity.errors, [])
    report.checks.push({ id: 'chess-player-stats', case: 'synthetic wrong-user HTTP-200 response', semanticState: 'invalid', wrongIdentityHidden: true, liveProviderRequests: 0 })
  } finally {
    await wrongIdentity.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/lichess-player-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/lichess-player-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
