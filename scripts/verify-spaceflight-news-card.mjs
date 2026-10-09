import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const search = 'NASA'
const limit = 6
const endpoint = `https://api.spaceflightnewsapi.net/v4/articles/?${new URLSearchParams({ search, limit: String(limit), ordering: '-published_at' }).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Spaceflight News API request plus one synthetic HTTP-200 semantic fixture',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())

const isHttpsUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

const trustedArticle = (row) => row && typeof row === 'object'
  && Number.isSafeInteger(row.id) && row.id > 0
  && typeof row.title === 'string' && row.title.trim()
  && typeof row.news_site === 'string' && row.news_site.trim()
  && typeof row.summary === 'string' && row.summary.trim()
  && isHttpsUrl(row.url) && isHttpsUrl(row.image_url)
  && typeof row.published_at === 'string' && Number.isFinite(Date.parse(row.published_at))
  && typeof row.updated_at === 'string' && Number.isFinite(Date.parse(row.updated_at))
  && Array.isArray(row.authors) && row.authors.every((author) => author && typeof author === 'object' && typeof author.name === 'string' && author.name.trim())
  && Array.isArray(row.launches) && row.launches.every((launch) => launch && typeof launch === 'object' && !Array.isArray(launch))
  && Array.isArray(row.events) && row.events.every((event) => event && typeof event === 'object' && !Array.isArray(event))

const semantic = (activeBrowser) => activeBrowser.ev(`(() => {
  const shell = document.querySelector('.demo-preview');
  const card = shell?.querySelector('[data-domain-card="spaceflight-news"]');
  const rows = [...(card?.querySelectorAll('[data-article-id]') || [])].map((row) => ({
    id: Number(row.dataset.articleId || 0),
    source: row.dataset.articleSource || '',
    publishedAt: row.dataset.articlePublishedAt || '',
  }));
  return {
    layout: shell?.dataset.previewLayout || '',
    fallback: shell?.dataset.ssotFallback || '',
    state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '',
    requestContract: card?.dataset.requestContract || '',
    search: card?.dataset.requestSearch || '',
    limit: Number(card?.dataset.requestLimit || 0),
    order: card?.dataset.requestOrder || '',
    total: Number(card?.dataset.providerTotalCount || 0),
    providerCount: Number(card?.dataset.providerRecordCount || 0),
    validCount: Number(card?.dataset.validRecordCount || 0),
    malformed: Number(card?.dataset.malformedRecordCount || 0),
    duplicates: Number(card?.dataset.duplicateRecordCount || 0),
    overflow: Number(card?.dataset.overflowRecordCount || 0),
    primaryId: Number(card?.dataset.primaryArticleId || 0),
    primarySource: card?.dataset.primarySource || '',
    primaryPublishedAt: card?.dataset.primaryPublishedAt || '',
    rows,
    text: card?.innerText || '',
  };
})()`)

const article = (id, overrides = {}) => ({
  id,
  title: `Fixture NASA article ${id}`,
  url: `https://example.com/articles/${id}`,
  image_url: 'https://yapweijun1996.github.io/Public-API/favicon.svg',
  news_site: 'Fixture Space News',
  summary: `Trusted fixture summary for article ${id}.`,
  published_at: '2026-09-17T12:00:00Z',
  updated_at: '2026-09-17T13:00:00Z',
  authors: [{ name: 'Fixture Reporter' }],
  launches: [],
  events: [],
  ...overrides,
})

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('spaceflight-news')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`), endpoint)
  const before = live.requestCount
  const response = await live.run()
  assert.equal(response.ok, true, response.error)
  assert.equal(live.requestCount - before, 1, 'Spaceflight News verifier must issue exactly one live provider request')
  assert(response.data && typeof response.data === 'object' && !Array.isArray(response.data))
  assert(Number.isSafeInteger(response.data.count) && response.data.count >= limit, 'Spaceflight News count must be a native integer covering the requested page')
  assert.equal(response.data.previous, null)
  assert(Array.isArray(response.data.results))
  assert.equal(response.data.results.length, limit)
  assert(response.data.results.every(trustedArticle), 'Spaceflight News native article contract drifted')
  assert.equal(new Set(response.data.results.map((row) => row.id)).size, response.data.results.length, 'Live article IDs must be unique')

  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    search: dom.search,
    limit: dom.limit,
    order: dom.order,
    total: dom.total,
    providerCount: dom.providerCount,
    validCount: dom.validCount,
    malformed: dom.malformed,
    duplicates: dom.duplicates,
    overflow: dom.overflow,
    primaryId: dom.primaryId,
    primarySource: dom.primarySource,
    primaryPublishedAt: dom.primaryPublishedAt,
  }, {
    layout: 'spaceflight-news',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-snapi-articles-v1',
    search,
    limit,
    order: '-published_at',
    total: response.data.count,
    providerCount: response.data.results.length,
    validCount: response.data.results.length,
    malformed: 0,
    duplicates: 0,
    overflow: 0,
    primaryId: response.data.results[0].id,
    primarySource: response.data.results[0].news_site,
    primaryPublishedAt: response.data.results[0].published_at,
  })
  assert.deepEqual(dom.rows.map((row) => row.id), response.data.results.map((row) => row.id))
  assert.deepEqual(dom.rows.map((row) => row.source), response.data.results.map((row) => row.news_site))
  assert.deepEqual(dom.rows.map((row) => row.publishedAt), response.data.results.map((row) => row.published_at))

  await live.viewport(390, 844)
  const mobile = await live.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
  })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({
    id: 'spaceflight-news',
    source: 'live provider',
    exactRequest: endpoint,
    returnedRecords: response.data.results.length,
    providerTotal: response.data.count,
    primaryArticleId: response.data.results[0].id,
    semanticState: dom.state,
    requestBound: dom.requestBound,
    browserCorsReadable: true,
    mobileOverflow: false,
    unnamedControls: 0,
  })
  await live.close()
  active = undefined

  const fixtureBody = {
    count: 3,
    next: null,
    previous: null,
    results: [
      article(501),
      article(501, { title: 'Fabricated duplicate article' }),
      article(503, { id: '503', title: 'Fabricated numeric-string identity' }),
    ],
  }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('spaceflight-news')
  assert.equal(await fixture.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`), endpoint)
  const fixtureBefore = fixture.requestCount
  const fixtureResponse = await fixture.run()
  assert.equal(fixtureResponse.ok, true, fixtureResponse.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({
    state: fixtureDom.state,
    requestBound: fixtureDom.requestBound,
    validCount: fixtureDom.validCount,
    malformed: fixtureDom.malformed,
    duplicates: fixtureDom.duplicates,
    overflow: fixtureDom.overflow,
    primaryId: fixtureDom.primaryId,
  }, {
    state: 'partial',
    requestBound: 'true',
    validCount: 1,
    malformed: 1,
    duplicates: 1,
    overflow: 0,
    primaryId: 501,
  })
  assert.equal(fixtureDom.text.includes('Fabricated duplicate article'), false)
  assert.equal(fixtureDom.text.includes('Fabricated numeric-string identity'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture Spaceflight News case must send zero live provider requests')
  assert.deepEqual(fixture.blockedProviders, [])
  assert.deepEqual(fixture.networkFailures, [])
  assert.deepEqual(fixture.errors, [])
  report.checks.push({
    id: 'spaceflight-news',
    case: 'duplicate/malformed native identity HTTP-200 fixture',
    source: 'synthetic fixture',
    exactRequest: endpoint,
    semanticState: fixtureDom.state,
    validRecords: 1,
    malformedRecords: 1,
    duplicateRecords: 1,
    fabricatedIdentitiesHidden: true,
    liveProviderRequests: 0,
  })
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

fs.writeFileSync(`${evidence}/spaceflight-news-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/spaceflight-news-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
