import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one isolated live NVD last-modified-window request plus deterministic intercepted pagination cases',
  checks: [], errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const parseNvd = (value) => Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
const readDom = (b) => b.ev(`(()=>{const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card=\"nvd-recent-cves\"]');return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',start:card?.dataset.requestWindowStart||'',end:card?.dataset.requestWindowEnd||'',lookback:Number(card?.dataset.lookbackDays||0),requestLimit:Number(card?.dataset.requestResultsPerPage||0),resultsPerPage:Number(card?.dataset.providerResultsPerPage||0),startIndex:Number(card?.dataset.providerStartIndex||0),providerRecords:Number(card?.dataset.providerRecordCount||0),validRecords:Number(card?.dataset.validRecordCount||0),invalidRecords:Number(card?.dataset.invalidRecordCount||0),incompleteRecords:Number(card?.dataset.incompleteRecordCount||0),total:Number(card?.dataset.providerTotalResults||0),envelope:card?.dataset.envelopeContract||'',filter:card?.dataset.filterContract||'',count:card?.dataset.countContract||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:card?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)


const fixedNow = '2026-09-15T00:00:00.000Z'
const fixedStart = '2026-09-08T00:00:00.000Z'
const syntheticEndpoint = `https://services.nvd.nist.gov/rest/json/cves/2.0?${new URLSearchParams({ lastModStartDate: fixedStart, lastModEndDate: fixedNow, resultsPerPage: '8' }).toString()}`
const syntheticRow = {
  cve: {
    id: 'CVE-2026-12345',
    sourceIdentifier: 'security@example.org',
    published: '2026-09-01T00:00:00.000',
    lastModified: '2026-09-12T12:00:00.000',
    vulnStatus: 'Modified',
    descriptions: [{ lang: 'en', value: 'Synthetic NVD recently modified CVE pagination fixture.' }],
    references: [{ url: 'https://example.org/CVE-2026-12345' }],
  },
}
const withFixedDate = async (b) => b.call('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const RealDate = Date;
  const fixed = ${JSON.stringify(fixedNow)};
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [fixed])); }
    static now() { return RealDate.parse(fixed); }
  };
})()` })
const syntheticBrowser = async (body) => {
  const b = await browser(`${root}/dist`, {
    fixtures: new Map([[syntheticEndpoint, { body }]]),
    blockedProviderPatterns: ['https://services.nvd.nist.gov/*'],
  })
  await withFixedDate(b)
  return b
}

let live
try {
  live = await browser(`${root}/dist`)
  await live.nav('nvd-recent-cves')
  const endpoint = await live.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const endpointUrl = new URL(endpoint)
  assert.equal(endpointUrl.origin, 'https://services.nvd.nist.gov')
  assert.equal(endpointUrl.pathname, '/rest/json/cves/2.0')
  assert.equal(endpointUrl.searchParams.get('resultsPerPage'), '8')
  const requestedStart = endpointUrl.searchParams.get('lastModStartDate')
  const requestedEnd = endpointUrl.searchParams.get('lastModEndDate')
  assert(requestedStart && requestedEnd)
  assert.equal(Date.parse(requestedEnd) - Date.parse(requestedStart), 7 * 86_400_000)

  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.format, 'NVD_CVE')
  assert.equal(result.data?.version, '2.0')
  assert(Array.isArray(result.data?.vulnerabilities) && result.data.vulnerabilities.length > 0 && result.data.vulnerabilities.length <= 8)
  assert.equal(result.data.resultsPerPage, result.data.vulnerabilities.length)
  assert.equal(result.data.startIndex, 0)
  assert.equal(result.data.vulnerabilities.length, Math.min(8, result.data.totalResults))
  for (const wrapper of result.data.vulnerabilities) {
    assert.match(wrapper?.cve?.id ?? '', /^CVE-[0-9]{4}-[0-9]{4,}$/)
    const modified = parseNvd(wrapper?.cve?.lastModified ?? '')
    assert(Number.isFinite(modified) && modified >= Date.parse(requestedStart) && modified <= Date.parse(requestedEnd), `out-of-window live NVD row: ${wrapper?.cve?.id}`)
  }

  const dom = await readDom(live)
  assert.equal(dom.layout, 'nvd-modified-watchlist')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.start, requestedStart)
  assert.equal(dom.end, requestedEnd)
  assert.equal(dom.lookback, 7)
  assert.equal(dom.requestLimit, 8)
  assert.equal(dom.resultsPerPage, result.data.vulnerabilities.length)
  assert.equal(dom.startIndex, 0)
  assert.equal(dom.providerRecords, result.data.vulnerabilities.length)
  assert.equal(dom.validRecords, result.data.vulnerabilities.length)
  assert.equal(dom.invalidRecords, 0)
  assert.equal(dom.incompleteRecords, 0)
  assert.equal(dom.total, result.data.totalResults)
  assert.equal(dom.envelope, 'true')
  assert.equal(dom.filter, 'true')
  assert.equal(dom.count, 'true')
  assert.equal(dom.endpoint, endpoint)
  assert(dom.text.includes(result.data.vulnerabilities[0].cve.id))
  assert.equal(await live.ev(`performance.getEntriesByType('resource').filter((entry) => entry.name === ${JSON.stringify(endpoint)}).length`), 1, 'the live journey must issue exactly one NVD request with no retry')
  assert.equal(dom.overflow, false)
  await live.viewport(390, 844)
  const mobile = await live.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1,card:document.querySelector('[data-domain-card="nvd-recent-cves"]').scrollWidth>document.querySelector('[data-domain-card="nvd-recent-cves"]').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview || mobile.card, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'nvd-recent-cves', case:'live request-bound NVD 7-day modified window', state:'ready', liveProviderRequests:1, noLiveRetry:true, requestedCeiling:8, providerResultsPerPage:result.data.resultsPerPage, returnedRecords:result.data.vulnerabilities.length, totalResults:result.data.totalResults, requestedStart, requestedEnd, filterContract:true, countContract:true, browserCors:'PASS', mobileOverflow:false, unnamedControls:0 })
  await live.close()
  live = undefined

  let synthetic = await syntheticBrowser({
    resultsPerPage: 1, startIndex: 0, totalResults: 1, format: 'NVD_CVE', version: '2.0', timestamp: '2026-09-15T00:00:01.000', vulnerabilities: [syntheticRow],
  })
  try {
    await synthetic.nav('nvd-recent-cves')
    const result = await synthetic.run()
    assert.equal(result.ok, true, result.error)
    const dom = await readDom(synthetic)
    assert.equal(dom.endpoint, syntheticEndpoint)
    assert.equal(dom.state, 'ready')
    assert.equal(dom.requestLimit, 8)
    assert.equal(dom.resultsPerPage, 1)
    assert.equal(dom.providerRecords, 1)
    assert.equal(dom.total, 1)
    assert.equal(dom.count, 'true')
    assert.equal(synthetic.fixtureRequests.filter((request) => request.url === syntheticEndpoint && request.method === 'GET').length, 1)
    assert.deepEqual(synthetic.blockedProviders, [])
    assert.deepEqual(synthetic.errors, [])
    report.checks.push({ id:'nvd-recent-cves', case:'synthetic complete short first page below requested ceiling', transportStatus:200, semanticState:'ready', requestedCeiling:8, providerResultsPerPage:1, returnedRecords:1, totalResults:1, liveProviderRequests:0, syntheticFixtureRequests:1, countContract:true })
  } finally {
    await synthetic.close()
  }

  synthetic = await syntheticBrowser({
    resultsPerPage: 1, startIndex: 0, totalResults: 42, format: 'NVD_CVE', version: '2.0', timestamp: '2026-09-15T00:00:01.000', vulnerabilities: [syntheticRow],
  })
  try {
    await synthetic.nav('nvd-recent-cves')
    const result = await synthetic.run()
    assert.equal(result.ok, true, result.error)
    const dom = await readDom(synthetic)
    assert.equal(dom.state, 'partial')
    assert.equal(dom.resultsPerPage, 1)
    assert.equal(dom.providerRecords, 1)
    assert.equal(dom.total, 42)
    assert.equal(dom.count, 'false')
    assert.equal(synthetic.fixtureRequests.filter((request) => request.url === syntheticEndpoint && request.method === 'GET').length, 1)
    assert.deepEqual(synthetic.blockedProviders, [])
    assert.deepEqual(synthetic.errors, [])
    report.checks.push({ id:'nvd-recent-cves', case:'synthetic internally short non-final first page', transportStatus:200, semanticState:'partial', requestedCeiling:8, providerResultsPerPage:1, returnedRecords:1, totalResults:42, liveProviderRequests:0, syntheticFixtureRequests:1, countContract:false, falseReadyPrevented:true })
  } finally {
    await synthetic.close()
  }

  synthetic = await syntheticBrowser({
    resultsPerPage: 0, startIndex: 0, totalResults: 0, format: 'NVD_CVE', version: '2.0', timestamp: '2026-09-15T00:00:01.000', vulnerabilities: [],
  })
  try {
    await synthetic.nav('nvd-recent-cves')
    const result = await synthetic.run()
    assert.equal(result.ok, true, result.error)
    const dom = await readDom(synthetic)
    assert.equal(dom.state, 'empty')
    assert.equal(dom.resultsPerPage, 0)
    assert.equal(dom.providerRecords, 0)
    assert.equal(dom.total, 0)
    assert.equal(dom.count, 'true')
    assert.equal(synthetic.fixtureRequests.filter((request) => request.url === syntheticEndpoint && request.method === 'GET').length, 1)
    assert.deepEqual(synthetic.blockedProviders, [])
    assert.deepEqual(synthetic.errors, [])
    report.checks.push({ id:'nvd-recent-cves', case:'synthetic zero-result provider page', transportStatus:200, semanticState:'empty', requestedCeiling:8, providerResultsPerPage:0, returnedRecords:0, totalResults:0, liveProviderRequests:0, syntheticFixtureRequests:1, countContract:true })
  } finally {
    await synthetic.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error)
  if (live) report.errors.push(...live.errors.map(String))
} finally {
  if (live) await live.close()
}
fs.writeFileSync(`${evidence}/nvd-recent-cves-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/nvd-recent-cves-card.json` },null,2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
