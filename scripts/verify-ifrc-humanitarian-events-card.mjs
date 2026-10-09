import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const canonicalUrl = 'https://goadmin.ifrc.org/api/v2/event/?limit=6&ordering=-disaster_start_date'
const providerBlockPatterns = ['https://goadmin.ifrc.org/*', 'http://goadmin.ifrc.org/*']
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live IFRC GO event request plus isolated synthetic contract fixtures',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const nativeCountOrNull = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
const baseEvent = (overrides = {}) => ({
  id: 8081,
  name: 'BIH: Fire',
  dtype: { name: 'Fire' },
  countries: [{ name: 'Bosnia and Herzegovina', iso3: 'BIH' }],
  ifrc_severity_level_display: 'Yellow',
  disaster_start_date: '2026-09-04T00:00:00Z',
  num_affected: 0,
  active_deployments: 0,
  field_reports: [{
    report_date: '2026-09-06T21:46:09Z',
    num_affected: 0,
    num_dead: 0,
    num_displaced: '0',
    gov_num_affected: 0,
    gov_num_dead: 0,
    gov_num_displaced: 0,
    other_num_affected: 50000,
    other_num_dead: 0,
    other_num_displaced: 0,
  }],
  ...overrides,
})

const readCard = async (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview')
  const card = shell?.querySelector('[data-domain-card="humanitarian-events"]')
  const event = card?.querySelector('[data-event-index="1"]')
  const opt = (key) => event?.dataset[key] === undefined ? null : Number(event.dataset[key])
  return {
    layout: shell?.dataset.previewLayout,
    fallback: shell?.dataset.ssotFallback,
    state: card?.dataset.resultState,
    requestBound: card?.dataset.requestBound,
    requestMethod: card?.dataset.requestMethod,
    requestLimit: card?.dataset.requestLimit,
    requestOrdering: card?.dataset.requestOrdering,
    providerTotal: Number(card?.dataset.providerTotal),
    countContract: card?.dataset.countContract,
    nativeNumberContract: card?.dataset.nativeNumberContract,
    malformedNumeric: Number(card?.dataset.malformedNumericCount),
    duplicates: Number(card?.dataset.duplicateEventCount),
    provider: Number(card?.dataset.providerEventCount),
    valid: Number(card?.dataset.validEventCount),
    invalid: Number(card?.dataset.invalidEventCount),
    incomplete: Number(card?.dataset.incompleteEventCount),
    primaryId: card?.dataset.primaryEventId,
    id: event?.dataset.eventId,
    name: event?.dataset.eventName,
    start: event?.dataset.startDate,
    type: event?.dataset.disasterType || '',
    countryIso3: event?.dataset.countryIso3 || '',
    severity: event?.dataset.severity || '',
    reportDate: event?.dataset.latestReportDate || '',
    ifrcAffected: opt('ifrcAffected'),
    govAffected: opt('governmentAffected'),
    otherAffected: opt('otherAffected'),
    events: card?.querySelectorAll('[data-event-id]').length || 0,
    text: card?.innerText || '',
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }
})()`)

const assertExactFixtureTraffic = (b) => {
  assert.deepEqual(b.fixtureRequests, [{ url: canonicalUrl, method: 'GET', source: 'synthetic-fixture', status: 200 }])
  assert.deepEqual(b.blockedProviders, [], `Unexpected IFRC provider escape: ${JSON.stringify(b.blockedProviders)}`)
}

const runFixture = async (name, body, check, mutate) => {
  const b = await browser(`${root}/dist`, {
    fixtures: new Map([[canonicalUrl, { body }]]),
    blockedProviderPatterns: providerBlockPatterns,
  })
  try {
    await b.nav('hdx-humanitarian-datasets')
    const startRequests = b.requestCount
    const result = await b.run()
    assert.equal(result.ok, true, result.error)
    assert.equal(b.requestCount - startRequests, 1, `${name} retried or issued another fetch`)
    if (mutate) await mutate(b)
    const dom = await readCard(b)
    await check(dom, result.data, b)
    assert.equal(dom.overflow, false)
    await b.viewport(390, 844)
    const mobileOverflow = await b.ev(`({
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
    })`)
    assert.equal(mobileOverflow.documentOverflow || mobileOverflow.previewOverflow, false, JSON.stringify(mobileOverflow))
    const ax = await b.call('Accessibility.getFullAXTree')
    assert.equal(unnamed(ax.nodes).length, 0)
    assertExactFixtureTraffic(b)
    assert.deepEqual(b.errors, [])
    report.checks.push({ id: 'hdx-humanitarian-datasets', case: name, source: 'synthetic fixture', semanticState: dom.state, providerRequestCount: 1, retryCount: 0, mobileOverflow: false, unnamedControls: 0 })
  } finally {
    report.errors.push(...b.errors.map(String))
    await b.close()
  }
}

let live
try {
  live = await browser(`${root}/dist`)
  await live.nav('hdx-humanitarian-datasets')
  const liveStartRequests = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - liveStartRequests, 1, 'Live IFRC execution retried or issued another fetch')
  assert(Array.isArray(result.data?.results), 'IFRC GO response did not expose results[]')
  assert(result.data.results.length > 0, 'IFRC GO returned no recent emergency events')
  assert.equal(typeof result.data.count, 'number', 'IFRC GO count was not a native number')
  assert(Number.isSafeInteger(result.data.count) && result.data.count >= result.data.results.length)
  assert(result.data.results.length <= 6)

  const resourceUrls = await live.ev(`performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => url.startsWith('https://goadmin.ifrc.org/'))`)
  assert.deepEqual(resourceUrls, [canonicalUrl], 'Live IFRC request URL was not exact or the request was retried')

  const first = result.data.results[0] || {}
  assert.equal(typeof first.id, 'number', 'IFRC GO first event did not include numeric GO emergency ID')
  assert(Number.isSafeInteger(first.id) && first.id > 0)
  assert.equal(typeof first.name, 'string', 'IFRC GO first event did not include official event name')
  assert(first.name.trim().length > 0)
  const reports = [...(Array.isArray(first.field_reports) ? first.field_reports : [])].sort((a, c) => String(c?.report_date || c?.updated_at || '').localeCompare(String(a?.report_date || a?.updated_at || '')))
  const latest = reports[0]
  const expected = {
    id: String(first.id),
    name: first.name.trim(),
    start: String(first.disaster_start_date),
    type: String(first.dtype?.name || '').trim(),
    countryIso3: (Array.isArray(first.countries) ? first.countries : []).map((country) => typeof country?.iso3 === 'string' ? country.iso3.trim() : '').filter(Boolean).join(','),
    severity: String(first.ifrc_severity_level_display).trim(),
    reportDate: typeof latest?.report_date === 'string' ? latest.report_date.trim() : '',
    ifrcAffected: nativeCountOrNull(latest?.num_affected),
    govAffected: nativeCountOrNull(latest?.gov_num_affected),
    otherAffected: nativeCountOrNull(latest?.other_num_affected),
  }
  const dom = await readCard(live)
  assert.equal(dom.layout, 'humanitarian-events')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.deepEqual({ bound: dom.requestBound, method: dom.requestMethod, limit: dom.requestLimit, ordering: dom.requestOrdering }, { bound: 'true', method: 'GET', limit: '6', ordering: '-disaster_start_date' })
  assert.equal(dom.providerTotal, result.data.count)
  assert.equal(dom.countContract, 'true')
  assert.equal(dom.nativeNumberContract, 'true')
  assert.equal(dom.malformedNumeric, 0)
  assert.equal(dom.duplicates, 0)
  assert.equal(dom.provider, result.data.results.length)
  assert.equal(dom.valid, result.data.results.length)
  assert.equal(dom.invalid, 0)
  assert.equal(dom.incomplete, 0)
  assert.deepEqual({ id: dom.id, primaryId: dom.primaryId, name: dom.name, start: dom.start, type: dom.type, countryIso3: dom.countryIso3, severity: dom.severity, reportDate: dom.reportDate }, { id: expected.id, primaryId: expected.id, name: expected.name, start: expected.start, type: expected.type, countryIso3: expected.countryIso3, severity: expected.severity, reportDate: expected.reportDate })
  assert.equal(dom.ifrcAffected, expected.ifrcAffected)
  assert.equal(dom.govAffected, expected.govAffected)
  assert.equal(dom.otherAffected, expected.otherAffected)
  assert(dom.text.includes('GO emergency ID'))
  assert.equal(dom.overflow, false)
  await live.viewport(390, 844)
  const liveMobileOverflow = await live.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
  })`)
  assert.equal(liveMobileOverflow.documentOverflow || liveMobileOverflow.previewOverflow, false, JSON.stringify(liveMobileOverflow))
  const liveAx = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(liveAx.nodes).length, 0)
  report.checks.push({
    id: 'hdx-humanitarian-datasets',
    source: 'live provider',
    requestUrl: canonicalUrl,
    requestMethod: 'GET',
    providerRequestCount: 1,
    retryCount: 0,
    providerTotal: result.data.count,
    providerEvents: result.data.results.length,
    identityAndCount: 'raw response exactly matched request-bound DOM evidence',
    sourceSeparatedImpacts: 'exact latest-field-report response match',
    semanticState: 'ready',
    browserCors: 'success',
    mobileOverflow: false,
    unnamedControls: 0,
  })
  report.errors.push(...live.errors.map(String))
  await live.close()
  live = undefined

  await runFixture('wrong executed request', { count: 1, results: [baseEvent()] }, async (fixtureDom) => {
    assert.equal(fixtureDom.state, 'invalid')
    assert.equal(fixtureDom.requestBound, 'false')
    assert.equal(fixtureDom.events, 0)
    assert.equal(fixtureDom.text.includes('BIH: Fire'), false)
  }, async (b) => {
    const mutated = await b.ev(`(() => {
      const shell = document.querySelector('.demo-preview')
      const fiberKey = shell && Object.keys(shell).find((key) => key.startsWith('__reactFiber$'))
      let fiber = fiberKey ? shell[fiberKey] : null
      while (fiber && !fiber.memoizedProps?.executedRequest) fiber = fiber.return
      if (!fiber?.memoizedProps?.executedRequest) return false
      fiber.memoizedProps.executedRequest.url = ${JSON.stringify(`${canonicalUrl}&page=2`)}
      const select = document.querySelector('.locale-control select')
      select.value = select.value === 'en' ? 'zh-CN' : 'en'
      select.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
    assert.equal(mutated, true, 'Could not mutate the fixture-only executed-request context')
    await b.wait(`document.querySelector('[data-domain-card="humanitarian-events"]')?.dataset.requestBound === 'false'`)
  })

  await runFixture('numeric-string identities and metrics', { count: 2, results: [
    baseEvent({ id: '8081', name: 'String identity must stay hidden' }),
    baseEvent({ id: 8082, name: 'Trusted numeric identity', num_affected: '12', field_reports: [{ report_date: '2026-09-06T21:46:09Z', num_affected: '34' }] }),
  ] }, async (fixtureDom) => {
    assert.equal(fixtureDom.state, 'partial')
    assert.equal(fixtureDom.valid, 1)
    assert.equal(fixtureDom.invalid, 1)
    assert.equal(fixtureDom.nativeNumberContract, 'false')
    assert.equal(fixtureDom.malformedNumeric, 3)
    assert.equal(fixtureDom.events, 1)
    assert.equal(fixtureDom.text.includes('String identity must stay hidden'), false)
    assert(fixtureDom.text.includes('Trusted numeric identity'))
    assert.equal(fixtureDom.ifrcAffected, null)
  })

  await runFixture('mixed invalid and duplicate identities', { count: 4, results: [
    baseEvent({ id: 9001, name: 'Duplicate A' }),
    baseEvent({ id: 9001, name: 'Duplicate B' }),
    baseEvent({ id: null, name: 'Missing identity' }),
    baseEvent({ id: 9002, name: 'Only trusted unique event' }),
  ] }, async (fixtureDom) => {
    assert.equal(fixtureDom.state, 'partial')
    assert.equal(fixtureDom.provider, 4)
    assert.equal(fixtureDom.valid, 1)
    assert.equal(fixtureDom.invalid, 3)
    assert.equal(fixtureDom.duplicates, 2)
    assert.equal(fixtureDom.events, 1)
    assert(fixtureDom.text.includes('Only trusted unique event'))
    assert.equal(fixtureDom.text.includes('Duplicate A'), false)
    assert.equal(fixtureDom.text.includes('Duplicate B'), false)
    assert.equal(fixtureDom.text.includes('Missing identity'), false)
  })

  await runFixture('count-incoherent envelope', { count: 1, results: [baseEvent({ id: 9101 }), baseEvent({ id: 9102 })] }, async (fixtureDom) => {
    assert.equal(fixtureDom.state, 'invalid')
    assert.equal(fixtureDom.countContract, 'false')
    assert.equal(fixtureDom.events, 0)
    assert.equal(fixtureDom.text.includes('BIH: Fire'), false)
  })

  assert.deepEqual(report.errors, [])
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (live) report.errors.push(...live.errors.map(String))
} finally {
  if (live) await live.close()
}

fs.writeFileSync(`${evidence}/ifrc-humanitarian-events-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/ifrc-humanitarian-events-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
