import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.nobelprize.org/2.1/nobelPrizes?nobelPrizeCategory=phy&limit=6&sort=desc'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Nobel Prize API category/limit response plus a synthetic wrong-category HTTP-200 response',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="nobel-prizes"]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',requestedCategory:card?.dataset.requestedCategory||'',requestedLimit:card?.dataset.requestedLimit||'',providerCategory:card?.dataset.providerCategory||'',providerLimit:card?.dataset.providerLimit||'',providerRequestMatch:card?.dataset.providerRequestMatch||'',providerResults:Number(card?.dataset.providerResultCount),validPrizes:Number(card?.dataset.validPrizeCount),invalidPrizes:Number(card?.dataset.invalidPrizeCount),allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
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
  await b.nav('nobel-prizes')
  const limitContract = await b.ev(`(() => {
    const input = document.querySelector('#parameter-limit')
    return { step: input?.getAttribute('step') || '', min: input?.getAttribute('min') || '', max: input?.getAttribute('max') || '' }
  })()`)
  assert.deepEqual(limitContract, { step: '1', min: '1', max: '12' })
  const beforeInvalidInput = b.requestCount
  const invalidInput = await b.ev(`(() => {
    const input = document.querySelector('#parameter-limit')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '6.5')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return { valid: input.checkValidity(), stepMismatch: input.validity.stepMismatch }
  })()`)
  assert.deepEqual(invalidInput, { valid: false, stepMismatch: true })
  await b.ev(`document.querySelector('form.parameter-card').requestSubmit()`)
  await sleep(150)
  assert.equal(b.requestCount, beforeInvalidInput, 'Fractional Nobel Prize limit reached a provider request')
  await b.ev(`(() => {
    const input = document.querySelector('#parameter-limit')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '6')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await sleep(100)
  report.checks.push({ id: 'nobel-prizes', case: 'native integer limit contract', step: 1, min: 1, max: 12, fractionalLimitRejected: true, providerRequests: 0 })
  const before = b.requestCount
  const result = await b.run()
  const providerFetches = b.requestCount - before
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data?.nobelPrizes) && result.data.nobelPrizes.length > 0, 'Nobel Prize API returned no physics prizes')
  assert.equal(result.data?.meta?.nobelPrizeCategory, 'phy')
  assert.equal(result.data?.meta?.limit, 6)
  assert(result.data.nobelPrizes.every((prize) => prize?.category?.en === 'Physics'), 'Nobel Prize API returned a non-Physics row for the Physics filter')
  const dom = await readDom(b)
  assert.equal(dom.layout, 'awards-timeline')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-nobel-prizes-category-limit-bodyless-get')
  assert.equal(dom.requestedCategory, 'phy')
  assert.equal(dom.requestedLimit, '6')
  assert.equal(dom.providerCategory, 'phy')
  assert.equal(dom.providerLimit, '6')
  assert.equal(dom.providerRequestMatch, 'true')
  assert.equal(dom.providerResults, result.data.nobelPrizes.length)
  assert.equal(dom.validPrizes, result.data.nobelPrizes.length)
  assert.equal(dom.invalidPrizes, 0)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(providerFetches, 1)
  assert.equal(dom.overflow, false)
  assert(dom.allText.includes(String(result.data.nobelPrizes[0]?.awardYear)))
  await verifyMobileAx(b)
  report.checks.push({ id: 'nobel-prizes', case: 'live exact Physics/limit response', semanticState: dom.state, requestBound: true, providerPrizes: result.data.nobelPrizes.length, providerFetches, providerCors: 'browser-readable', mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  assert.deepEqual(b.networkFailures, [])
  await b.close()
  b = undefined

  const wrongCategory = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: {
      nobelPrizes: [{ awardYear: '2025', category: { en: 'Chemistry' }, prizeAmount: 11000000, laureates: [{ knownName: { en: 'Injected mismatch' }, motivation: { en: 'should stay hidden' } }] }],
      meta: { offset: 0, limit: 6, nobelPrizeCategory: 'che', count: 125 },
    } }]]),
    blockedProviderPatterns: ['https://api.nobelprize.org/*'],
  })
  try {
    await wrongCategory.nav('nobel-prizes')
    const fixtureResult = await wrongCategory.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await readDom(wrongCategory)
    assert.equal(fixtureDom.state, 'invalid')
    assert.equal(fixtureDom.requestBound, 'true')
    assert.equal(fixtureDom.providerRequestMatch, 'false')
    assert.equal(fixtureDom.allText.includes('Injected mismatch'), false)
    assert.deepEqual(wrongCategory.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(wrongCategory.blockedProviders, [])
    assert.deepEqual(wrongCategory.errors, [])
    report.checks.push({ id: 'nobel-prizes', case: 'synthetic wrong-category HTTP-200 response', semanticState: 'invalid', providerFactsHidden: true, liveProviderRequests: 0 })
  } finally {
    await wrongCategory.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/nobel-prizes-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/nobel-prizes-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
