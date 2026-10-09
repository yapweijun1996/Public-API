import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'severance'
const endpoint = `https://api.tvmaze.com/search/shows?${new URLSearchParams({ q: query }).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live TVmaze show search plus one exact synthetic HTTP-200 semantic fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())
const showUrlMatches = (value, id) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'www.tvmaze.com' && !url.port && !url.username && !url.password
      && !url.search && !url.hash && new RegExp(`^/shows/${id}(?:/[^/]+)?$`).test(url.pathname)
  } catch { return false }
}
const trustedRow = (row) => row && typeof row === 'object' && Number.isFinite(row.score)
  && row.show && typeof row.show === 'object' && Number.isSafeInteger(row.show.id) && row.show.id > 0
  && typeof row.show.name === 'string' && row.show.name.trim()
  && showUrlMatches(row.show.url, row.show.id)
const semantic = (instance) => instance.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="tvmaze-search"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', query:card?.dataset.query||'', providerCount:Number(card?.dataset.providerRecordCount||0), trustedCount:Number(card?.dataset.trustedRecordCount||0), malformedCount:Number(card?.dataset.malformedEvidenceCount||0), duplicateCount:Number(card?.dataset.duplicateEvidenceCount||0), primaryShowId:Number(card?.dataset.primaryShowId||0), primaryRelevance:Number(card?.dataset.primaryRelevance||0), text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('tvmaze-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'TVmaze verifier must issue exactly one live provider request')
  assert(Array.isArray(result.data), 'TVmaze live response must remain an array')
  assert(result.data.length > 0, 'TVmaze canonical search returned no shows')
  assert(result.data.every(trustedRow), 'TVmaze live show identity or native relevance contract drifted')
  assert.equal(new Set(result.data.map((row) => row.show.id)).size, result.data.length, 'TVmaze live search returned duplicate show IDs')
  const primary = result.data[0]
  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    query: dom.query,
    providerCount: dom.providerCount,
    trustedCount: dom.trustedCount,
    malformedCount: dom.malformedCount,
    duplicateCount: dom.duplicateCount,
    primaryShowId: dom.primaryShowId,
    primaryRelevance: dom.primaryRelevance,
  }, {
    layout: 'tv-show-search',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-tvmaze-show-search-v2',
    query,
    providerCount: result.data.length,
    trustedCount: result.data.length,
    malformedCount: 0,
    duplicateCount: 0,
    primaryShowId: primary.show.id,
    primaryRelevance: primary.score,
  })
  assert(dom.text.includes(primary.show.name.trim()), 'TVmaze primary show name missing from semantic DOM')
  assert(dom.text.toLowerCase().includes(`tvmaze #${primary.show.id}`), 'TVmaze primary provider identity missing from semantic DOM')
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({
    id: 'tvmaze-search',
    source: 'live provider',
    exactRequest: endpoint,
    returnedRecords: result.data.length,
    primaryShowId: primary.show.id,
    primaryRelevance: primary.score,
    semanticState: dom.state,
    requestBound: dom.requestBound,
    browserCorsReadable: true,
    mobileOverflow: false,
    unnamedControls: 0,
  })
  await live.close(); active = undefined

  const fixtureShow = (id, name, overrides = {}) => ({
    id,
    url: `https://www.tvmaze.com/shows/${id}/${name.toLowerCase().replaceAll(' ', '-')}`,
    name,
    type: 'Scripted',
    language: 'English',
    genres: ['Drama'],
    status: 'Running',
    runtime: 50,
    premiered: '2022-02-18',
    ended: null,
    officialSite: null,
    schedule: { time: '09:00', days: ['Friday'] },
    rating: { average: 8.1 },
    network: null,
    webChannel: null,
    image: null,
    ...overrides,
  })
  const fixtureBody = [
    { score: 0.9, show: fixtureShow(44933, 'Trusted fixture show') },
    { score: 0.8, show: fixtureShow('bad-id', 'Fabricated malformed identity') },
    { score: 0.7, show: fixtureShow(44933, 'Fabricated duplicate identity') },
    { score: 0.6, show: fixtureShow(50000, 'Strict optional evidence', { rating: { average: '7.5' } }) },
  ]
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('tvmaze-search')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({
    state: fixtureDom.state,
    requestBound: fixtureDom.requestBound,
    providerCount: fixtureDom.providerCount,
    trustedCount: fixtureDom.trustedCount,
    malformedCount: fixtureDom.malformedCount,
    duplicateCount: fixtureDom.duplicateCount,
    primaryShowId: fixtureDom.primaryShowId,
  }, {
    state: 'partial',
    requestBound: 'true',
    providerCount: 4,
    trustedCount: 2,
    malformedCount: 2,
    duplicateCount: 1,
    primaryShowId: 44933,
  })
  assert.equal(fixtureDom.text.includes('Fabricated malformed identity'), false)
  assert.equal(fixtureDom.text.includes('Fabricated duplicate identity'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture TVmaze case must send zero live provider requests')
  assert.deepEqual(fixture.errors, [])
  report.checks.push({
    id: 'tvmaze-search',
    case: 'mixed malformed/duplicate/native-number HTTP-200 fixture',
    source: 'synthetic fixture',
    semanticState: fixtureDom.state,
    trustedRecords: 2,
    malformedEvidence: 2,
    duplicateEvidence: 1,
    fabricatedIdentityHidden: true,
    liveProviderRequests: 0,
  })
  await fixture.close(); active = undefined
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

fs.writeFileSync(`${evidence}/tvmaze-search-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/tvmaze-search-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
