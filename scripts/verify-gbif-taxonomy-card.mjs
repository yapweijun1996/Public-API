import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.gbif.org/v1/species/search?q=panthera&limit=8'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live GBIF Species API search plus a synthetic malformed-row HTTP-200 response',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="gbif-taxonomy-search"]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',query:card?.dataset.requestedQuery||'',providerCount:card?.dataset.providerCount||'',providerRecordCount:card?.dataset.providerRecordCount||'',validRecordCount:card?.dataset.validRecordCount||'',invalidRecordCount:card?.dataset.invalidRecordCount||'',primaryTaxonKey:card?.dataset.primaryTaxonKey||'',allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
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
  await b.nav('gbif-species-search')
  const before = b.requestCount
  const result = await b.run()
  const providerFetches = b.requestCount - before
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.offset, 0)
  assert.equal(result.data?.limit, 8)
  assert.equal(Array.isArray(result.data?.results), true)
  assert.equal(result.data.results.length > 0 && result.data.results.length <= 8, true)
  const dom = await readDom(b)
  assert.equal(dom.layout, 'taxonomy-directory')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-gbif-species-search-v2-bodyless-get')
  assert.equal(dom.query, 'panthera')
  assert.equal(dom.endpoint, endpoint)
  assert.equal(Number(dom.providerRecordCount), result.data.results.length)
  assert.equal(Number(dom.validRecordCount), result.data.results.length)
  assert.equal(dom.invalidRecordCount, '0')
  assert.equal(Number(dom.primaryTaxonKey), result.data.results[0].key)
  assert.equal(providerFetches, 1)
  assert.equal(dom.overflow, false)
  assert(dom.allText.includes(result.data.results[0].scientificName || result.data.results[0].canonicalName))
  await verifyMobileAx(b)
  report.checks.push({ id: 'gbif-species-search', case: 'live exact species-search response', semanticState: dom.state, requestBound: true, providerRecords: result.data.results.length, providerCount: result.data.count, primaryTaxonKey: result.data.results[0].key, providerFetches, providerCors: 'browser-readable', mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  assert.deepEqual(b.networkFailures, [])
  await b.close()
  b = undefined

  const fixture = {
    offset: 0, limit: 8, endOfRecords: true, count: 2,
    results: [
      { key: 2435194, nubKey: 2435194, scientificName: 'Panthera Oken, 1816', canonicalName: 'Panthera', kingdom: 'Animalia', phylum: 'Chordata', class: 'Mammalia', order: 'Carnivora', family: 'Felidae', genus: 'Panthera', rank: 'GENUS', taxonomicStatus: 'ACCEPTED', synonym: false },
      { family: 'Fabricated family', genus: 'Fabricated genus', rank: 'SPECIES', taxonomicStatus: 'ACCEPTED' },
    ],
  }
  const malformed = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: fixture }]]),
    blockedProviderPatterns: ['https://api.gbif.org/*'],
  })
  try {
    await malformed.nav('gbif-species-search')
    const fixtureResult = await malformed.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await readDom(malformed)
    assert.equal(fixtureDom.state, 'partial')
    assert.equal(fixtureDom.requestBound, 'true')
    assert.equal(fixtureDom.validRecordCount, '1')
    assert.equal(fixtureDom.invalidRecordCount, '1')
    assert.equal(fixtureDom.allText.includes('Panthera Oken, 1816'), true)
    assert.equal(fixtureDom.allText.includes('Fabricated family'), false)
    assert.deepEqual(malformed.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(malformed.blockedProviders, [])
    assert.deepEqual(malformed.errors, [])
    report.checks.push({ id: 'gbif-species-search', case: 'synthetic malformed-row HTTP-200 response', semanticState: 'partial', validRows: 1, invalidRows: 1, fabricatedFactsHidden: true, liveProviderRequests: 0 })
  } finally {
    await malformed.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/gbif-taxonomy-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/gbif-taxonomy-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
