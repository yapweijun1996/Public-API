import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://opentdb.com/api.php?amount=6&category=9&difficulty=medium&type=multiple'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'native integer-input validation, one live Open Trivia DB request, plus one exact-request synthetic contradiction fixture',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="open-trivia"]'),first=card?.querySelector('[data-question-difficulty]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',reason:card?.dataset.resultReason||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',amount:Number(card?.dataset.requestedAmount),category:card?.dataset.requestedCategory||'',difficulty:card?.dataset.requestedDifficulty||'',type:card?.dataset.requestedType||'',responseCode:Number(card?.dataset.providerResponseCode),providerCount:Number(card?.dataset.providerQuestionCount),validCount:Number(card?.dataset.validQuestionCount),invalidCount:Number(card?.dataset.invalidQuestionCount),firstCategory:first?.dataset.questionCategory||'',firstDifficulty:first?.dataset.questionDifficulty||'',firstText:first?.innerText||'',allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  }
})()`)

const contradictoryFixture = {
  response_code: 0,
  results: [{
    type: 'multiple',
    difficulty: 'hard',
    category: 'General Knowledge',
    question: 'Synthetic wrong-difficulty question',
    correct_answer: 'A',
    incorrect_answers: ['B', 'C', 'D'],
  }],
}

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('open-trivia')
  const amountContract = await live.ev(`(() => {
    const amount = document.querySelector('#parameter-amount')
    return { step: amount?.getAttribute('step') || '', min: amount?.getAttribute('min') || '', max: amount?.getAttribute('max') || '' }
  })()`)
  assert.deepEqual(amountContract, { step: '1', min: '1', max: '10' })
  const beforeInvalidHumanInput = live.requestCount
  const invalidHumanInput = await live.ev(`(() => {
    const amount = document.querySelector('#parameter-amount')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(amount, '6.5')
    amount.dispatchEvent(new Event('input', { bubbles: true }))
    amount.dispatchEvent(new Event('change', { bubbles: true }))
    return { valid: amount.checkValidity(), stepMismatch: amount.validity.stepMismatch }
  })()`)
  assert.deepEqual(invalidHumanInput, { valid: false, stepMismatch: true })
  await live.ev(`document.querySelector('form.parameter-card').requestSubmit()`)
  await sleep(150)
  assert.equal(live.requestCount, beforeInvalidHumanInput, 'Fractional Open Trivia amount reached a provider request')
  await live.ev(`(() => {
    const amount = document.querySelector('#parameter-amount')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(amount, '6')
    amount.dispatchEvent(new Event('input', { bubbles: true }))
    amount.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await sleep(100)
  report.checks.push({ case: 'native integer amount contract', step: 1, min: 1, max: 10, fractionalAmountRejected: true, providerRequests: 0 })
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.response_code, 0, `Open Trivia provider response_code=${result.data?.response_code}`)
  assert(Array.isArray(result.data?.results), 'Open Trivia DB did not return the documented results array')
  assert(result.data.results.length <= 6, 'Open Trivia DB exceeded the exact requested amount')
  const dom = await readDom(live)
  assert.deepEqual({ layout: dom.layout, fallback: dom.fallback, requestBound: dom.requestBound, requestContract: dom.requestContract, amount: dom.amount, category: dom.category, difficulty: dom.difficulty, type: dom.type, endpoint: dom.endpoint }, {
    layout: 'trivia-game', fallback: 'false', requestBound: 'true', requestContract: 'exact-open-trivia-multiple-bodyless-get', amount: 6, category: '9', difficulty: 'medium', type: 'multiple', endpoint,
  })
  assert.equal(dom.responseCode, 0)
  assert.equal(dom.providerCount, result.data.results.length)
  assert.equal(dom.validCount + dom.invalidCount, dom.providerCount)
  if (result.data.results.length === 0) {
    assert.equal(dom.state, 'empty')
  } else {
    assert(['ready', 'partial'].includes(dom.state), JSON.stringify(dom))
    assert(dom.validCount > 0, 'No trustworthy live Open Trivia question reached the semantic card')
    const firstRenderedText = dom.firstText
    assert(firstRenderedText, 'No rendered trivia card was found')
    assert(result.data.results.some((question) => question?.difficulty === dom.firstDifficulty && String(question?.category) === dom.firstCategory), 'Rendered question metadata was not present in provider response')
  }
  const providerRequests = await live.ev(`performance.getEntriesByName(${JSON.stringify(endpoint)}).length`)
  assert.equal(providerRequests, 1)
  await live.viewport(390, 844)
  assert.equal(await live.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1`), false)
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  const screenshot = `${evidence}/open-trivia-card.png`
  await live.screenshot(screenshot)
  report.checks.push({ case: 'live exact Open Trivia multiple-choice request', state: dom.state, requestBound: true, providerQuestions: dom.providerCount, validQuestions: dom.validCount, invalidQuestions: dom.invalidCount, browserCorsReadable: true, providerRequests, mobileOverflow: false, unnamedControls: 0, screenshot })
  report.errors.push(...live.errors.map(String))
  assert.deepEqual(report.errors, [])
  await live.close()
  active = undefined

  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: contradictoryFixture }]]), blockedProviderPatterns: ['https://opentdb.com/*'] })
  active = fixture
  await fixture.nav('open-trivia')
  const fixtureResult = await fixture.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const fixtureDom = await readDom(fixture)
  assert.equal(fixtureDom.state, 'invalid')
  assert.equal(fixtureDom.reason, 'no-trustworthy-questions')
  assert.equal(fixtureDom.allText.includes('Synthetic wrong-difficulty question'), false)
  assert.deepEqual(fixture.fixtureRequests.map(({ url, source, status }) => ({ url, source, status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
  assert.deepEqual(fixture.blockedProviders, [])
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ case: 'synthetic wrong-difficulty HTTP-200 trivia payload', state: 'invalid', providerFactsHidden: true, liveProviderRequests: 0 })
  await fixture.close()
  active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/open-trivia-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/open-trivia-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
