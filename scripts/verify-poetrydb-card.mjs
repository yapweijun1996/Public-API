import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://poetrydb.org/author,random/Emily%20Dickinson;3/title,author,lines,linecount'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live PoetryDB author/count response plus a synthetic wrong-author HTTP-200 response',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="poetrydb-poems"]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',requestedAuthor:card?.dataset.requestedAuthor||'',requestedCount:card?.dataset.requestedCount||'',providerCount:Number(card?.dataset.providerCount),validPoems:Number(card?.dataset.validPoemCount),invalidPoems:Number(card?.dataset.invalidPoemCount),countMatch:card?.dataset.countMatch||'',allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
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
  await b.nav('poetrydb-poems')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data) && result.data.length > 0, 'PoetryDB returned no default poems')
  assert(result.data.every((poem) => poem?.author === 'Emily Dickinson'), 'PoetryDB returned a poem for a different author')
  const first = result.data[0]
  const dom = await readDom(b)
  assert.equal(dom.layout, 'poetry-reading-room')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-poetrydb-author-random-bodyless-get')
  assert.equal(dom.requestedAuthor, 'Emily Dickinson')
  assert.equal(dom.requestedCount, '3')
  assert.equal(dom.providerCount, result.data.length)
  assert.equal(dom.validPoems, result.data.length)
  assert.equal(dom.invalidPoems, 0)
  assert.equal(dom.countMatch, 'true')
  assert(dom.allText.includes(String(first.title)))
  assert(dom.allText.includes(String(first.author)))
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.overflow, false)
  await verifyMobileAx(b)
  report.checks.push({ id: 'poetrydb-poems', case: 'live exact author/count response', semanticState: dom.state, requestBound: true, providerPoems: result.data.length, providerCors: 'browser-readable', mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close()
  b = undefined

  const wrongAuthor = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: [{ title: 'Injected unrelated poem', author: 'William Shakespeare', lines: ['Injected line'], linecount: 1 }] }]]),
    blockedProviderPatterns: ['https://poetrydb.org/*'],
  })
  try {
    await wrongAuthor.nav('poetrydb-poems')
    const fixtureResult = await wrongAuthor.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await readDom(wrongAuthor)
    assert.equal(fixtureDom.state, 'invalid')
    assert.equal(fixtureDom.requestBound, 'true')
    assert.equal(fixtureDom.validPoems, 0)
    assert.equal(fixtureDom.invalidPoems, 1)
    assert.equal(fixtureDom.allText.includes('Injected unrelated poem'), false)
    assert.deepEqual(wrongAuthor.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(wrongAuthor.blockedProviders, [])
    assert.deepEqual(wrongAuthor.errors, [])
    report.checks.push({ id: 'poetrydb-poems', case: 'synthetic wrong-author HTTP-200 response', semanticState: 'invalid', providerFactsHidden: true, liveProviderRequests: 0 })
  } finally {
    await wrongAuthor.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/poetrydb-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/poetrydb-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
