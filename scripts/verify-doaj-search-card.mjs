import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'climate'
const pageSize = 5
const endpoint = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?${new URLSearchParams({ pageSize: String(pageSize) }).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live DOAJ article search plus exact synthetic HTTP-200 semantic fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const validIdentity = (entry) => Boolean(
  entry && typeof entry === 'object'
    && typeof entry.id === 'string' && entry.id.trim()
    && entry.bibjson && typeof entry.bibjson === 'object'
    && typeof entry.bibjson.title === 'string' && entry.bibjson.title.trim(),
)
const articleDoi = (entry) => Array.isArray(entry?.bibjson?.identifier)
  ? entry.bibjson.identifier.find((identifier) => identifier?.type === 'doi' && typeof identifier?.id === 'string' && identifier.id.trim())?.id?.trim() || ''
  : ''
const semantic = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview')
  const card = shell?.querySelector('[data-domain-card="doaj-search"]')
  return {
    layout: shell?.dataset.previewLayout || '',
    fallback: shell?.dataset.ssotFallback || '',
    state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '',
    requestContract: card?.dataset.requestContract || '',
    requestQuery: card?.dataset.requestQuery || '',
    requestedPageSize: Number(card?.dataset.requestedPageSize || 0),
    queryContract: card?.dataset.queryContract || '',
    countContract: card?.dataset.countContract || '',
    providerTotal: Number(card?.dataset.providerTotal || 0),
    providerPage: Number(card?.dataset.providerPage || 0),
    providerPageSize: Number(card?.dataset.providerPageSize || 0),
    providerRecordCount: Number(card?.dataset.providerRecordCount || 0),
    validRecordCount: Number(card?.dataset.validRecordCount || 0),
    malformedRecordCount: Number(card?.dataset.malformedRecordCount || 0),
    duplicateRecordCount: Number(card?.dataset.duplicateRecordCount || 0),
    overflowRecordCount: Number(card?.dataset.overflowRecordCount || 0),
    primaryArticleId: card?.dataset.primaryArticleId || '',
    visibleArticleIds: [...(card?.querySelectorAll('[data-article-id]') || [])].map((node) => node.dataset.articleId || ''),
    text: card?.innerText || '',
  }
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('doaj-search')
  const renderedEndpoint = await live.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(renderedEndpoint, endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'DOAJ verifier must issue exactly one live provider request')
  assert.equal(result.data?.query, query, 'DOAJ provider query echo drifted')
  assert.equal(Number.isSafeInteger(result.data?.total) && result.data.total >= 0, true, 'DOAJ total must remain a native non-negative integer')
  assert.equal(result.data?.page, 1, 'DOAJ first-page contract drifted')
  assert.equal(result.data?.pageSize, pageSize, 'DOAJ provider pageSize echo drifted')
  assert(Array.isArray(result.data?.results), 'DOAJ live response missing results[]')
  assert.equal(result.data.results.length, Math.min(pageSize, result.data.total), 'DOAJ live result cardinality drifted')
  assert(result.data.results.length > 0, 'DOAJ default search returned no article records')
  assert(result.data.results.every(validIdentity), 'DOAJ article id/title identity contract drifted')
  assert.equal(new Set(result.data.results.map((entry) => entry.id.trim().toLowerCase())).size, result.data.results.length, 'DOAJ returned duplicate article identities on the first page')

  const dom = await semantic(live)
  const articleIds = result.data.results.map((entry) => entry.id.trim())
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    requestQuery: dom.requestQuery,
    requestedPageSize: dom.requestedPageSize,
    queryContract: dom.queryContract,
    countContract: dom.countContract,
    providerTotal: dom.providerTotal,
    providerPage: dom.providerPage,
    providerPageSize: dom.providerPageSize,
    providerRecordCount: dom.providerRecordCount,
    validRecordCount: dom.validRecordCount,
    malformedRecordCount: dom.malformedRecordCount,
    duplicateRecordCount: dom.duplicateRecordCount,
    overflowRecordCount: dom.overflowRecordCount,
    primaryArticleId: dom.primaryArticleId,
    visibleArticleIds: dom.visibleArticleIds,
  }, {
    layout: 'scholarly-search',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-doaj-article-search-first-page',
    requestQuery: query,
    requestedPageSize: pageSize,
    queryContract: 'true',
    countContract: 'true',
    providerTotal: result.data.total,
    providerPage: 1,
    providerPageSize: pageSize,
    providerRecordCount: result.data.results.length,
    validRecordCount: result.data.results.length,
    malformedRecordCount: 0,
    duplicateRecordCount: 0,
    overflowRecordCount: 0,
    primaryArticleId: articleIds[0],
    visibleArticleIds: articleIds,
  })
  assert.equal(dom.text.includes(result.data.results[0].bibjson.title.trim()), true, 'DOAJ primary title missing from semantic DOM')
  const doi = articleDoi(result.data.results[0])
  if (doi) assert.equal(dom.text.includes(doi), true, 'DOAJ provider DOI missing from semantic DOM')
  await live.viewport(390, 844)
  const overflow = await live.ev(`({ documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1 })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'doaj-search', source: 'live provider', exactRequest: endpoint, returnedRecords: result.data.results.length, total: result.data.total, primaryArticleId: articleIds[0], semanticState: dom.state, requestBound: dom.requestBound, providerQueryEcho: result.data.query, browserCorsReadable: true, mobileOverflow: false, unnamedControls: 0 })
  await live.close()
  active = undefined

  const record = (id, title) => ({
    id,
    bibjson: {
      title,
      year: '2026',
      author: [{ name: 'Fixture, Researcher' }],
      journal: { title: 'Fixture Journal', publisher: 'Fixture Publisher' },
      identifier: [{ type: 'doi', id: `10.1234/${id || 'missing'}` }],
    },
  })
  const fixtureBody = {
    total: 3,
    page: 1,
    pageSize,
    timestamp: '2026-09-17T00:00:00Z',
    query,
    results: [
      record('fixture-1', 'Fixture trusted article'),
      record('', 'Fabricated missing identity'),
      record('fixture-1', 'Fabricated duplicate identity'),
    ],
  }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('doaj-search')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({
    state: fixtureDom.state,
    requestBound: fixtureDom.requestBound,
    queryContract: fixtureDom.queryContract,
    countContract: fixtureDom.countContract,
    validRecordCount: fixtureDom.validRecordCount,
    malformedRecordCount: fixtureDom.malformedRecordCount,
    duplicateRecordCount: fixtureDom.duplicateRecordCount,
    visibleArticleIds: fixtureDom.visibleArticleIds,
  }, {
    state: 'partial',
    requestBound: 'true',
    queryContract: 'true',
    countContract: 'true',
    validRecordCount: 1,
    malformedRecordCount: 1,
    duplicateRecordCount: 1,
    visibleArticleIds: ['fixture-1'],
  })
  assert.equal(fixtureDom.text.includes('Fabricated missing identity'), false)
  assert.equal(fixtureDom.text.includes('Fabricated duplicate identity'), false)
  const exactFixtures = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(exactFixtures, 1)
  assert.equal(fixture.requestCount - fixtureBefore, exactFixtures, 'Fixture-only DOAJ case must send zero live provider requests')
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ id: 'doaj-search', case: 'mixed malformed/duplicate article identity HTTP-200 fixture', source: 'synthetic fixture', semanticState: fixtureDom.state, validRecords: 1, malformedRecords: 1, duplicateRecords: 1, fabricatedIdentityHidden: true, liveProviderRequests: 0 })
  await fixture.close()
  active = undefined

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) {
    report.errors.push(...active.errors.map(String))
    report.networkFailures = active.networkFailures
  }
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/doaj-search-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/doaj-search-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
