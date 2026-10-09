import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'Wikimedia per-article daily pageviews request binding, native integer counts, omitted-day evidence, identity filtering, mobile layout, and accessibility',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const semanticDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="wikimedia-pageviews"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', method:card?.dataset.requestMethod||'', article:card?.dataset.requestArticle||'',
    startDate:card?.dataset.requestStartDate||'', endDate:card?.dataset.requestEndDate||'', requestDays:Number(card?.dataset.requestDayCount),
    providerRecords:Number(card?.dataset.providerRecordCount), validRecords:Number(card?.dataset.validRecordCount), invalidRecords:Number(card?.dataset.invalidRecordCount),
    malformedViews:Number(card?.dataset.malformedViewCount), missingDays:Number(card?.dataset.missingDayCount),
    envelope:card?.dataset.envelopeContract||'', identity:card?.dataset.rowIdentityContract||'', dateRange:card?.dataset.dateRangeContract||'', nativeViews:card?.dataset.nativeViewContract||'',
    primaryDate:card?.dataset.primaryDate||'', primaryValue:Number(card?.dataset.primaryValue), text:card?.innerText||'',
  };
})()`)

const parseCompact = (value) => {
  assert.match(value, /^\d{8}$/)
  return Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8)))
}
const compact = (time) => new Date(time).toISOString().slice(0, 10).replaceAll('-', '')
const endpointContract = (endpoint) => {
  const url = new URL(endpoint)
  const path = url.pathname.split('/').filter(Boolean)
  assert.deepEqual(path.slice(0, 8), ['api', 'rest_v1', 'metrics', 'pageviews', 'per-article', 'en.wikipedia.org', 'all-access', 'user'])
  assert.equal(path[9], 'daily')
  assert.equal(path.length, 12)
  assert.equal(url.search, '')
  const start = path[10]
  const end = path[11]
  const startMs = parseCompact(start)
  const endMs = parseCompact(end)
  const days = Math.round((endMs - startMs) / 86400000) + 1
  assert(days >= 7 && days <= 90)
  return { article: decodeURIComponent(path[8]), start, end, startMs, endMs, days }
}
const fixtureRows = (contract) => Array.from({ length: contract.days }, (_, index) => {
  const date = compact(contract.startMs + index * 86400000)
  return {
    project: 'en.wikipedia',
    article: contract.article,
    granularity: 'daily',
    timestamp: `${date}00`,
    access: 'all-access',
    agent: 'user',
    views: 10000 + index * 137,
  }
})

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('wikimedia-pageviews')
  const endpoint = await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const contract = endpointContract(endpoint)
  assert.equal(contract.article, 'Singapore')
  const requestsBeforeLiveRun = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - requestsBeforeLiveRun, 1, 'The live journey must send exactly one provider fetch')
  assert(result.data && Array.isArray(result.data.items), 'Wikimedia did not return the documented items envelope')
  const items = result.data.items
  const seen = new Set()
  for (const row of items) {
    assert.equal(row.project, 'en.wikipedia')
    assert.equal(row.article, contract.article)
    assert.equal(row.granularity, 'daily')
    assert.equal(row.access, 'all-access')
    assert.equal(row.agent, 'user')
    assert.match(row.timestamp, /^\d{10}$/)
    assert.equal(row.timestamp.slice(-2), '00')
    const day = row.timestamp.slice(0, 8)
    assert(parseCompact(day) >= contract.startMs && parseCompact(day) <= contract.endMs)
    assert(!seen.has(day), `duplicate live Wikimedia day ${day}`)
    seen.add(day)
    assert(Number.isSafeInteger(row.views) && row.views >= 0, 'live views must be native non-negative safe integers')
  }
  const expectedMissingDays = contract.days - items.length
  assert(expectedMissingDays >= 0)
  const dom = await semanticDom(active)
  assert.equal(dom.layout, 'market-chart')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, items.length === 0 ? 'empty' : expectedMissingDays === 0 ? 'ready' : 'partial')
  assert.deepEqual({ requestBound: dom.requestBound, method: dom.method, article: dom.article }, { requestBound: 'true', method: 'GET', article: contract.article })
  assert.equal(dom.requestDays, contract.days)
  assert.equal(dom.providerRecords, items.length)
  assert.equal(dom.validRecords, items.length)
  assert.equal(dom.invalidRecords, 0)
  assert.equal(dom.malformedViews, 0)
  assert.equal(dom.missingDays, expectedMissingDays)
  assert.deepEqual({ envelope: dom.envelope, identity: dom.identity, dateRange: dom.dateRange, nativeViews: dom.nativeViews }, { envelope: 'true', identity: 'true', dateRange: 'true', nativeViews: 'true' })
  if (items.length) {
    const latest = [...items].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).at(-1)
    assert.equal(dom.primaryDate, `${latest.timestamp.slice(0, 4)}-${latest.timestamp.slice(4, 6)}-${latest.timestamp.slice(6, 8)}`)
    assert.equal(dom.primaryValue, latest.views)
  }
  await active.viewport(390, 844)
  const mobile = await active.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1,cardOverflow:document.querySelector('[data-domain-card="wikimedia-pageviews"]').scrollWidth>document.querySelector('[data-domain-card="wikimedia-pageviews"]').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await active.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(active.errors, [])
  report.checks.push({ case: 'live exact Wikimedia per-article daily request', transportStatus: 200, semanticState: dom.state, returnedDays: items.length, requestedDays: contract.days, missingDays: expectedMissingDays, nativeIntegerViews: true, identityBinding: true, cors: 'browser request succeeded', mobileOverflow: false, unnamedControls: 0 })
  await active.close()
  active = undefined

  const canonical = fixtureRows(contract)
  const cases = [
    {
      name: 'complete native-integer series',
      body: { items: canonical },
      expectedState: 'ready',
      check: (fixtureDom) => {
        assert.equal(fixtureDom.validRecords, contract.days)
        assert.equal(fixtureDom.missingDays, 0)
      },
    },
    {
      name: 'numeric-string view',
      body: { items: canonical.map((row, index) => index === 0 ? { ...row, views: '99999' } : row) },
      expectedState: 'partial',
      check: (fixtureDom) => {
        assert.equal(fixtureDom.malformedViews, 1)
        assert.equal(fixtureDom.validRecords, contract.days - 1)
        assert.equal(fixtureDom.missingDays, 1)
        assert.doesNotMatch(fixtureDom.text, /99,999|99999/)
      },
    },
    {
      name: 'wrong row identity',
      body: { items: canonical.map((row, index) => index === 0 ? { ...row, article: 'Wrong_Article', views: 88000 } : row) },
      expectedState: 'partial',
      check: (fixtureDom) => {
        assert.equal(fixtureDom.invalidRecords, 1)
        assert.equal(fixtureDom.identity, 'false')
        assert.equal(fixtureDom.missingDays, 1)
        assert.doesNotMatch(fixtureDom.text, /88,000|88000|Wrong Article/)
      },
    },
    {
      name: 'provider-omitted day',
      body: { items: canonical.slice(1) },
      expectedState: 'partial',
      check: (fixtureDom) => {
        assert.equal(fixtureDom.validRecords, contract.days - 1)
        assert.equal(fixtureDom.missingDays, 1)
      },
    },
    {
      name: 'empty items',
      body: { items: [] },
      expectedState: 'empty',
      check: (fixtureDom) => {
        assert.equal(fixtureDom.validRecords, 0)
        assert.match(fixtureDom.text, /No pageview observations returned/)
        assert.doesNotMatch(fixtureDom.text, /0 views/)
      },
    },
  ]

  for (const testCase of cases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: testCase.body }]]) })
    active = fixtureBrowser
    await fixtureBrowser.nav('wikimedia-pageviews')
    assert.equal(await fixtureBrowser.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`), endpoint)
    const before = fixtureBrowser.requestCount
    const fixtureResult = await fixtureBrowser.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureFetchCount = fixtureBrowser.requestCount - before
    const fixtureDom = await semanticDom(fixtureBrowser)
    assert.equal(fixtureDom.state, testCase.expectedState)
    testCase.check(fixtureDom)
    const exactFixtureRequests = fixtureBrowser.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
    assert.equal(exactFixtureRequests, 1)
    assert.equal(fixtureFetchCount, exactFixtureRequests, 'Fixture-only cases must not send additional live provider requests')
    assert.deepEqual(fixtureBrowser.errors, [])
    report.checks.push({ case: `fixture-only ${testCase.name} HTTP-200`, semanticState: fixtureDom.state, exactFixtureRequests, liveProviderRequests: 0 })
    await fixtureBrowser.close()
    active = undefined
  }
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/wikimedia-pageviews-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/wikimedia-pageviews-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
