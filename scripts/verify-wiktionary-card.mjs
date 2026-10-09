import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://en.wiktionary.org/api/rest_v1/page/definition/hello'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live English Wiktionary definition lookup plus a synthetic multilingual HTTP-200 response',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="wiktionary-entry"]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',requestedWord:card?.dataset.requestedWord||'',providerLanguageCount:Number(card?.dataset.providerLanguageCount),englishEntryCount:Number(card?.dataset.englishEntryCount),invalidEnglishEntryCount:Number(card?.dataset.invalidEnglishEntryCount),ignoredNonEnglishEntryCount:Number(card?.dataset.ignoredNonEnglishEntryCount),allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
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
  await b.nav('wiktionary-entry')
  const before = b.requestCount
  const result = await b.run()
  const providerFetches = b.requestCount - before
  assert.equal(result.ok, true, result.error)
  assert(result.data && typeof result.data === 'object' && !Array.isArray(result.data), 'Wiktionary returned a non-object response')
  assert(Array.isArray(result.data.en) && result.data.en.length > 0, 'Wiktionary returned no English definition entries for hello')
  const dom = await readDom(b)
  assert.equal(dom.layout, 'dictionary-entry')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-wiktionary-english-definition-bodyless-get')
  assert.equal(dom.requestedWord, 'hello')
  assert(dom.providerLanguageCount >= 1)
  assert(dom.englishEntryCount > 0)
  assert.equal(dom.invalidEnglishEntryCount, 0)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(providerFetches, 1)
  assert.equal(dom.overflow, false)
  await verifyMobileAx(b)
  report.checks.push({ id: 'wiktionary-entry', case: 'live exact hello response', semanticState: dom.state, requestBound: true, providerLanguageCount: dom.providerLanguageCount, englishEntryCount: dom.englishEntryCount, ignoredNonEnglishEntryCount: dom.ignoredNonEnglishEntryCount, providerFetches, providerCors: 'browser-readable', mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  assert.deepEqual(b.networkFailures, [])
  await b.close()
  b = undefined

  const multilingual = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: {
      en: [{ language: 'English', partOfSpeech: 'Interjection', definitions: [{ definition: 'Trusted English fixture definition.' }] }],
      fr: [{ language: 'French', partOfSpeech: 'Interjection', definitions: [{ definition: 'Injected French fixture definition.' }] }],
    } }]]),
    blockedProviderPatterns: ['https://en.wiktionary.org/*'],
  })
  try {
    await multilingual.nav('wiktionary-entry')
    const fixtureResult = await multilingual.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await readDom(multilingual)
    assert.equal(fixtureDom.state, 'ready')
    assert.equal(fixtureDom.requestBound, 'true')
    assert.equal(fixtureDom.providerLanguageCount, 2)
    assert.equal(fixtureDom.englishEntryCount, 1)
    assert.equal(fixtureDom.ignoredNonEnglishEntryCount, 1)
    assert(fixtureDom.allText.includes('Trusted English fixture definition.'))
    assert.equal(fixtureDom.allText.includes('Injected French fixture definition.'), false)
    assert.deepEqual(multilingual.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(multilingual.blockedProviders, [])
    assert.deepEqual(multilingual.errors, [])
    report.checks.push({ id: 'wiktionary-entry', case: 'synthetic multilingual HTTP-200 response', semanticState: 'ready', englishFactsVisible: true, nonEnglishFactsHidden: true, liveProviderRequests: 0 })
  } finally {
    await multilingual.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/wiktionary-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/wiktionary-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
