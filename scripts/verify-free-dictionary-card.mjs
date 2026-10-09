import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://freedictionaryapi.com/api/v1/entries/en/hello'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live FreeDictionaryAPI.com word lookup plus a synthetic wrong-word HTTP-200 response',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="free-dictionary"]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',requestedWord:card?.dataset.requestedWord||'',providerWord:card?.dataset.providerWord||'',wordMatch:card?.dataset.responseWordMatch||'',sourceValid:card?.dataset.sourceValid||'',providerEntries:Number(card?.dataset.providerEntryCount),validEntries:Number(card?.dataset.validEntryCount),invalidEntries:Number(card?.dataset.invalidEntryCount),allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
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
  await b.nav('free-dictionary')
  const before = b.requestCount
  const result = await b.run()
  const providerFetches = b.requestCount - before
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.word, 'hello')
  assert(Array.isArray(result.data?.entries) && result.data.entries.length > 0, 'Free Dictionary returned no hello entries')
  assert.equal(result.data.entries.every((entry) => entry?.language?.code === 'en'), true)
  assert.equal(result.data?.source?.license?.name, 'CC BY-SA 4.0')
  const dom = await readDom(b)
  assert.equal(dom.layout, 'dictionary-entry')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-free-dictionary-english-word-bodyless-get')
  assert.equal(dom.requestedWord, 'hello')
  assert.equal(dom.providerWord, 'hello')
  assert.equal(dom.wordMatch, 'true')
  assert.equal(dom.sourceValid, 'true')
  assert.equal(dom.providerEntries, result.data.entries.length)
  assert(dom.validEntries > 0)
  assert.equal(dom.invalidEntries, 0)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(providerFetches, 1)
  assert.equal(dom.overflow, false)
  assert(dom.allText.includes('CC BY-SA 4.0'))
  await verifyMobileAx(b)
  report.checks.push({ id: 'free-dictionary', case: 'live exact hello response', semanticState: dom.state, requestBound: true, providerEntries: result.data.entries.length, validEntries: dom.validEntries, providerFetches, providerCors: 'browser-readable', mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  assert.deepEqual(b.networkFailures, [])
  await b.close()
  b = undefined

  const wrongWord = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: {
      word: 'world',
      entries: [{ language: { code: 'en', name: 'English' }, partOfSpeech: 'noun', senses: [{ definition: 'Injected wrong-word definition.' }] }],
      source: { url: 'https://en.wiktionary.org/wiki/world', license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } },
    } }]]),
    blockedProviderPatterns: ['https://freedictionaryapi.com/*'],
  })
  try {
    await wrongWord.nav('free-dictionary')
    const fixtureResult = await wrongWord.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await readDom(wrongWord)
    assert.equal(fixtureDom.state, 'invalid')
    assert.equal(fixtureDom.requestBound, 'true')
    assert.equal(fixtureDom.wordMatch, 'false')
    assert.equal(fixtureDom.allText.includes('Injected wrong-word definition.'), false)
    assert.deepEqual(wrongWord.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(wrongWord.blockedProviders, [])
    assert.deepEqual(wrongWord.errors, [])
    report.checks.push({ id: 'free-dictionary', case: 'synthetic wrong-word HTTP-200 response', semanticState: 'invalid', providerFactsHidden: true, liveProviderRequests: 0 })
  } finally {
    await wrongWord.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/free-dictionary-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/free-dictionary-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
