import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const keyword = 'openssl 0.9.1c'
const endpoint = 'https://services.nvd.nist.gov/rest/json/cpes/2.0?keywordSearch=openssl+0.9.1c&resultsPerPage=8'
const exactCpePrefix = 'cpe:2.3:a:openssl:openssl:0.9.1c:'
const product = {
  cpe: {
    deprecated: false,
    cpeName: `${exactCpePrefix}*:*:*:*:*:*:*`,
    cpeNameId: '11111111-2222-4333-8444-555555555555',
    created: '2026-09-01T00:00:00.000',
    lastModified: '2026-09-14T00:00:00.000',
    titles: [{ title: 'OpenSSL 0.9.1c', lang: 'en' }],
  },
}
const response = {
  resultsPerPage: 1,
  startIndex: 0,
  totalResults: 1,
  format: 'NVD_CPE',
  version: '2.0',
  timestamp: '2026-09-14T16:42:00.000',
  products: [product],
}
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one isolated live NVD CPE keyword-search request plus deterministic intercepted pagination cases',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview')
  const card = shell?.querySelector('[data-domain-card="nvd-cpe-search"]')
  return {
    layout: shell?.dataset.previewLayout || '', fallback: shell?.dataset.ssotFallback || '', state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '', keyword: card?.dataset.requestedKeyword || '', requestLimit: Number(card?.dataset.requestResultsPerPage || 0),
    resultsPerPage: Number(card?.dataset.providerResultsPerPage || 0), startIndex: Number(card?.dataset.providerStartIndex || 0),
    providerProducts: Number(card?.dataset.providerProductCount || 0), validProducts: Number(card?.dataset.validProductCount || 0),
    invalidProducts: Number(card?.dataset.invalidProductCount || 0), incompleteProducts: Number(card?.dataset.incompleteProductCount || 0),
    totalResults: Number(card?.dataset.providerTotalResults || 0), envelope: card?.dataset.envelopeContract || '',
    filter: card?.dataset.filterContract || '', count: card?.dataset.countContract || '', format: card?.dataset.nvdFormat || '', version: card?.dataset.nvdVersion || '',
    primaryCpe: card?.dataset.primaryCpeName || '', primaryCpeNameId: card?.dataset.primaryCpeNameId || '', endpoint: document.querySelector('.endpoint-box code')?.textContent || '',
    text: card?.innerText || '', overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }
})()`)
const setQuery = async (b) => {
  await b.ev(`(() => {
    const input = document.querySelector('input[name="query"]')
    if (!input) throw new Error('Missing NVD CPE keyword control')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(keyword)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await sleep(100)
}
const syntheticBrowser = () => browser(`${root}/dist`, {
  fixtures: new Map([[endpoint, { body: response }]]),
  blockedProviderPatterns: ['https://services.nvd.nist.gov/*'],
})

let live
let synthetic
let liveRunStarted = false
try {
  live = await browser(`${root}/dist`)
  await live.nav('nvd-cpe-search')
  const fieldContract = await live.ev(`(() => {
    const query = document.querySelector('input[name="query"]')
    const limit = document.querySelector('input[name="limit"]')
    return {
      queryMinLength: query?.getAttribute('minlength') || '',
      limitMin: limit?.getAttribute('min') || '',
      limitMax: limit?.getAttribute('max') || '',
      limitStep: limit?.getAttribute('step') || '',
    }
  })()`)
  assert.deepEqual(fieldContract, { queryMinLength: '1', limitMin: '1', limitMax: '20', limitStep: '1' })
  const beforeInvalidInput = live.requestCount
  await live.ev(`(() => {
    const query = document.querySelector('input[name="query"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(query, '   ')
    query.dispatchEvent(new Event('input', { bubbles: true }))
    query.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await live.ev(`document.querySelector('form.parameter-card').requestSubmit()`)
  await sleep(150)
  assert.equal(live.requestCount, beforeInvalidInput, 'Blank NVD CPE keyword reached a provider request')
  const blankQuery = await live.ev(`(() => { const input = document.querySelector('input[name="query"]'); return { invalid: input?.getAttribute('aria-invalid') || '', text: document.querySelector('#parameter-query-help')?.textContent || '' } })()`)
  assert.equal(blankQuery.invalid, 'true')
  assert.match(blankQuery.text, /required/i)
  await setQuery(live)
  await live.ev(`(() => {
    const limit = document.querySelector('input[name="limit"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(limit, '8.5')
    limit.dispatchEvent(new Event('input', { bubbles: true }))
    limit.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  const fractionalLimit = await live.ev(`(() => { const input = document.querySelector('input[name="limit"]'); return { valid: input.checkValidity(), stepMismatch: input.validity.stepMismatch } })()`)
  assert.deepEqual(fractionalLimit, { valid: false, stepMismatch: true })
  await live.ev(`document.querySelector('form.parameter-card').requestSubmit()`)
  await sleep(150)
  assert.equal(live.requestCount, beforeInvalidInput, 'Fractional NVD CPE result limit reached a provider request')
  await live.ev(`(() => {
    const limit = document.querySelector('input[name="limit"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(limit, '8')
    limit.dispatchEvent(new Event('input', { bubbles: true }))
    limit.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await sleep(100)
  report.checks.push({ id: 'nvd-cpe-search', case: 'native exact-input contract', queryMinLength: 1, limitMin: 1, limitMax: 20, limitStep: 1, blankQueryRejected: true, fractionalLimitRejected: true, providerRequests: 0 })
  const contract = await live.ev(`({
    endpoint: document.querySelector('.endpoint-box code')?.textContent || '',
    queryValue: document.querySelector('input[name="query"]')?.value || '',
    limitValue: document.querySelector('input[name="limit"]')?.value || '',
    automatedVerification: document.querySelector('.request-lab')?.dataset.automatedVerification || '',
    minimumInterval: document.querySelector('.request-lab')?.dataset.verificationMinimumIntervalSeconds || '',
  })`)
  assert.equal(contract.endpoint, endpoint)
  assert.equal(contract.queryValue, keyword)
  assert.equal(contract.limitValue, '8')
  assert.equal(contract.automatedVerification, 'cadence-limited')
  assert.equal(contract.minimumInterval, '6')

  liveRunStarted = true
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.format, 'NVD_CPE')
  assert.equal(result.data?.version, '2.0')
  assert.equal(result.data?.startIndex, 0)
  assert(Number.isInteger(result.data?.totalResults) && result.data.totalResults >= 0)
  assert(Array.isArray(result.data?.products), 'live NVD CPE response must contain a products array')
  assert.equal(result.data.resultsPerPage, result.data.products.length)
  assert(result.data.products.length <= 8)
  assert.equal(result.data.products.length, Math.min(8, result.data.totalResults))
  assert(result.data.products.length > 0, 'stable exact-version probe must return its known CPE identity')
  for (const wrapper of result.data.products) {
    assert.equal(typeof wrapper?.cpe?.cpeName, 'string')
    assert(wrapper.cpe.cpeName.toLocaleLowerCase('en-US').startsWith(exactCpePrefix), `unexpected live CPE identity: ${wrapper?.cpe?.cpeName}`)
  }

  const dom = await readDom(live)
  assert.equal(dom.layout, 'cpe-product-search')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.keyword, keyword)
  assert.equal(dom.requestLimit, 8)
  assert.equal(dom.resultsPerPage, result.data.products.length)
  assert.equal(dom.startIndex, 0)
  assert.equal(dom.providerProducts, result.data.products.length)
  assert.equal(dom.validProducts, result.data.products.length)
  assert.equal(dom.invalidProducts, 0)
  assert.equal(dom.incompleteProducts, 0)
  assert.equal(dom.totalResults, result.data.totalResults)
  assert.equal(dom.envelope, 'true')
  assert.equal(dom.filter, 'true')
  assert.equal(dom.count, 'true')
  assert.equal(dom.format, 'NVD_CPE')
  assert.equal(dom.version, '2.0')
  assert.equal(dom.primaryCpe, result.data.products[0].cpe.cpeName)
  assert.equal(dom.primaryCpeNameId, result.data.products[0].cpe.cpeNameId)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.overflow, false)
  const exactNetworkEntries = await live.ev(`performance.getEntriesByType('resource').filter((entry) => entry.name === ${JSON.stringify(endpoint)}).length`)
  assert.equal(exactNetworkEntries, 1, 'the live journey must issue exactly one NVD CPE request with no retry')
  await live.viewport(390, 844)
  const mobile = await live.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
    cardOverflow: document.querySelector('[data-domain-card="nvd-cpe-search"]').scrollWidth > document.querySelector('[data-domain-card="nvd-cpe-search"]').clientWidth + 1,
  })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({
    id: 'nvd-cpe-search', case: 'live exact OpenSSL 0.9.1c CPE search', semanticState: 'ready', liveProviderRequests: 1, noLiveRetry: true,
    requestedCeiling: 8, resultsPerPage: result.data.resultsPerPage, returnedProducts: result.data.products.length, totalResults: result.data.totalResults,
    firstCpe: result.data.products[0].cpe.cpeName, countContract: true, browserCors: 'PASS', mobileOverflow: false, unnamedControls: 0,
  })
  await live.close()
  live = undefined

  synthetic = await syntheticBrowser()
  await synthetic.nav('nvd-cpe-search')
  await setQuery(synthetic)
  const shortResult = await synthetic.run()
  assert.equal(shortResult.ok, true, shortResult.error)
  const shortDom = await readDom(synthetic)
  assert.equal(shortDom.state, 'ready')
  assert.equal(shortDom.requestLimit, 8)
  assert.equal(shortDom.resultsPerPage, 1)
  assert.equal(shortDom.providerProducts, 1)
  assert.equal(shortDom.totalResults, 1)
  assert.equal(shortDom.count, 'true')
  assert.equal(synthetic.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
  assert.deepEqual(synthetic.blockedProviders, [])
  assert.deepEqual(synthetic.errors, [])
  report.checks.push({ id: 'nvd-cpe-search', case: 'synthetic complete final first page below requested ceiling', transportStatus: 200, semanticState: 'ready', requestedCeiling: 8, resultsPerPage: 1, returnedProducts: 1, totalResults: 1, liveProviderRequests: 0, syntheticFixtureRequests: 1, countContract: true })
  await synthetic.close()
  synthetic = undefined

  synthetic = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: { ...response, resultsPerPage: 8 } }]]),
    blockedProviderPatterns: ['https://services.nvd.nist.gov/*'],
  })
  await synthetic.nav('nvd-cpe-search')
  await setQuery(synthetic)
  const inconsistentResult = await synthetic.run()
  assert.equal(inconsistentResult.ok, true, inconsistentResult.error)
  const inconsistentDom = await readDom(synthetic)
  assert.equal(inconsistentDom.state, 'partial')
  assert.equal(inconsistentDom.resultsPerPage, 8)
  assert.equal(inconsistentDom.providerProducts, 1)
  assert.equal(inconsistentDom.count, 'false')
  assert.equal(synthetic.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
  assert.deepEqual(synthetic.blockedProviders, [])
  assert.deepEqual(synthetic.errors, [])
  report.checks.push({ id: 'nvd-cpe-search', case: 'synthetic inconsistent pagination HTTP-200', transportStatus: 200, semanticState: 'partial', resultsPerPage: 8, returnedProducts: 1, totalResults: 1, liveProviderRequests: 0, syntheticFixtureRequests: 1, countContract: false, falseReadyPrevented: true })
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  report.liveRequestStarted = liveRunStarted
  if (live) {
    report.errors.push(...live.errors.map(String))
    report.networkFailures = live.networkFailures
  }
  if (synthetic) report.errors.push(...synthetic.errors.map(String))
} finally {
  if (live) await live.close()
  if (synthetic) await synthetic.close()
}

fs.writeFileSync(`${evidence}/nvd-cpe-search-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/nvd-cpe-search-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
