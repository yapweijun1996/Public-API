import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=covid&retmode=json&retmax=5'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live NCBI PubMed ESearch API from the Pages origin',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const providerInteger = (value) => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : undefined
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}
const semantic = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview')
  const card = shell?.querySelector('.pubmed-preview, [data-domain-card="pubmed-search"]')
  return {
    layout: shell?.dataset.previewLayout || '',
    fallback: shell?.dataset.ssotFallback || '',
    state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '',
    requestContract: card?.dataset.requestContract || '',
    term: card?.dataset.queryTerm || '',
    requestedRetmax: Number(card?.dataset.requestedRetmax || 0),
    providerCount: Number(card?.dataset.providerCount || 0),
    providerReturned: Number(card?.dataset.providerReturned || 0),
    validPmids: Number(card?.dataset.validPmidCount || 0),
    malformedPmids: Number(card?.dataset.malformedPmidCount || 0),
    duplicatePmids: Number(card?.dataset.duplicatePmidCount || 0),
    primaryPmid: card?.dataset.primaryPmid || '',
    visiblePmids: [...(card?.querySelectorAll('[data-pmid]') || [])].map((node) => node.dataset.pmid || ''),
    text: card?.innerText || '',
  }
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('pubmed-search')
  const renderedEndpoint = await live.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(renderedEndpoint, endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'PubMed verifier must issue exactly one live provider request')
  const count = providerInteger(result.data?.esearchresult?.count)
  const returned = providerInteger(result.data?.esearchresult?.retmax)
  const retstart = providerInteger(result.data?.esearchresult?.retstart)
  const ids = result.data.esearchresult.idlist
  assert(Number.isSafeInteger(count) && count > 0, 'PubMed default query returned no matches')
  assert(Number.isSafeInteger(returned) && returned === 5, 'PubMed default result count drifted')
  assert.equal(retstart, 0, 'PubMed default result offset drifted')
  assert(Array.isArray(ids) && ids.length === returned && ids.every((id) => typeof id === 'string' && /^[1-9]\d*$/.test(id)), 'PubMed PMID identity contract drifted')
  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    term: dom.term,
    requestedRetmax: dom.requestedRetmax,
    providerCount: dom.providerCount,
    providerReturned: dom.providerReturned,
    validPmids: dom.validPmids,
    malformedPmids: dom.malformedPmids,
    duplicatePmids: dom.duplicatePmids,
    primaryPmid: dom.primaryPmid,
    visiblePmids: dom.visiblePmids,
  }, {
    layout: 'research-library',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-pubmed-esearch-json',
    term: 'covid',
    requestedRetmax: 5,
    providerCount: count,
    providerReturned: returned,
    validPmids: ids.length,
    malformedPmids: 0,
    duplicatePmids: 0,
    primaryPmid: ids[0],
    visiblePmids: ids,
  })
  assert.equal(dom.text.includes('not article content or medical advice'), true)
  await live.viewport(390, 844)
  const overflow = await live.ev(`({ documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1 })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'pubmed-search', source: 'live provider', exactRequest: endpoint, providerMatches: count, returnedPmids: ids.length, providerWireTypes: { count: typeof result.data.esearchresult.count, retmax: typeof result.data.esearchresult.retmax, retstart: typeof result.data.esearchresult.retstart }, semanticState: dom.state, requestBound: dom.requestBound, browserCorsReadable: true, mobileOverflow: false, unnamedControls: 0 })
  await live.close()
  active = undefined

  const mixedBody = { header: { type: 'esearch', version: '0.3' }, esearchresult: {
    count: '5', retmax: '5', retstart: '0',
    idlist: ['42745862', 'bad-id', '42745862', '42745795', '42745786'],
    querytranslation: '"covid"[All Fields]',
  } }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: mixedBody }]]) })
  active = mixed
  await mixed.nav('pubmed-search')
  const fixtureBefore = mixed.requestCount
  const mixedResult = await mixed.run()
  assert.equal(mixedResult.ok, true, mixedResult.error)
  const mixedDom = await semantic(mixed)
  assert.deepEqual({ state: mixedDom.state, requestBound: mixedDom.requestBound, validPmids: mixedDom.validPmids, malformedPmids: mixedDom.malformedPmids, duplicatePmids: mixedDom.duplicatePmids }, { state: 'partial', requestBound: 'true', validPmids: 3, malformedPmids: 1, duplicatePmids: 1 })
  assert.equal(mixedDom.text.includes('bad-id'), false)
  const exactFixtures = mixed.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(exactFixtures, 1)
  assert.equal(mixed.requestCount - fixtureBefore, exactFixtures, 'Fixture-only PubMed case must send zero live provider requests')
  assert.deepEqual(mixed.errors, [])
  report.checks.push({ id: 'pubmed-search', case: 'mixed malformed/duplicate PMID HTTP-200 fixture', source: 'synthetic fixture', semanticState: mixedDom.state, validPmids: 3, malformedPmids: 1, duplicatePmids: 1, malformedIdentityHidden: true, liveProviderRequests: 0 })
  await mixed.close()
  active = undefined

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/pubmed-search-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/pubmed-search-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
