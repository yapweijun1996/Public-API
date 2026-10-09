import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.worldbank.org/v2/country/SGP/indicator/SP.DYN.LE00.IN?format=json&date=2015%3A2025&per_page=141'
const row = (year, value, overrides = {}) => ({
  indicator: { id: 'SP.DYN.LE00.IN', value: 'Life expectancy at birth, total (years)' },
  country: { id: 'SG', value: 'Singapore' },
  countryiso3code: 'SGP',
  date: String(year),
  value,
  unit: '',
  obs_status: '',
  decimal: 1,
  ...overrides,
})
const metadata = (total = 11) => ({ page: 1, pages: 1, per_page: '141', total, sourceid: '2', lastupdated: '2026-06-24' })
const fixtureRows = () => Array.from({ length: 11 }, (_, index) => row(2025 - index, 84 - index / 10))
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'World Bank request-bound indicator series plus strict dual-representation pagination, malformed, numeric-string, and wrong-identity HTTP-200 regressions',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const semanticDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="world-bank-indicator-series"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', method:card?.dataset.requestMethod||'', country:card?.dataset.requestCountryCode||'',
    alpha2:card?.dataset.providerCountryAlpha2||'', alpha3:card?.dataset.providerCountryAlpha3||'', indicator:card?.dataset.requestIndicator||'',
    startYear:Number(card?.dataset.requestStartYear), endYear:Number(card?.dataset.requestEndYear), requestYears:Number(card?.dataset.requestYearCount),
    providerPage:Number(card?.dataset.providerPage), providerPages:Number(card?.dataset.providerPages), providerPerPage:Number(card?.dataset.providerPerPage), providerTotal:Number(card?.dataset.providerTotal),
    providerRecords:Number(card?.dataset.providerRecordCount), validRecords:Number(card?.dataset.validRecordCount), invalidRecords:Number(card?.dataset.invalidRecordCount),
    validObservations:Number(card?.dataset.validObservationCount), missingObservations:Number(card?.dataset.missingObservationCount), malformedObservations:Number(card?.dataset.malformedObservationCount),
    envelope:card?.dataset.envelopeContract||'', pagination:card?.dataset.paginationContract||'', countryIdentity:card?.dataset.countryIdentityContract||'',
    indicatorIdentity:card?.dataset.indicatorIdentityContract||'', yearRange:card?.dataset.yearRangeContract||'', rowIdentity:card?.dataset.rowIdentityContract||'',
    primaryYear:Number(card?.dataset.primaryYear), primaryValue:Number(card?.dataset.primaryValue), text:card?.innerText||'',
  };
})()`)

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('world-bank-indicator-explorer')
  assert.equal(await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`), endpoint)
  assert.deepEqual(await active.ev(`({
    startYear: document.querySelector('#parameter-startYear')?.step,
    endYear: document.querySelector('#parameter-endYear')?.step,
  })`), { startYear: '1', endYear: '1' })
  const requestsBeforeLiveRun = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - requestsBeforeLiveRun, 1, 'The live journey must send exactly one provider fetch')
  assert(Array.isArray(result.data) && result.data.length === 2 && Array.isArray(result.data[1]), 'World Bank did not return the documented two-part indicator envelope')
  const [meta, rows] = result.data
  assert.equal(meta.page, 1)
  assert.equal(meta.pages, 1)
  assert.equal(meta.per_page, 141)
  assert.equal(meta.total, 11)
  assert.equal(rows.length, 11)
  const years = rows.map((item) => Number(item.date))
  assert.equal(new Set(years).size, 11)
  assert(years.every((year) => year >= 2015 && year <= 2025))
  assert(rows.every((item) => item.indicator?.id === 'SP.DYN.LE00.IN' && item.country?.id === 'SG' && item.countryiso3code === 'SGP'))
  assert(rows.every((item) => item.value === null || typeof item.value === 'number'))
  const numericRows = rows.filter((item) => typeof item.value === 'number')
  const missingRows = rows.filter((item) => item.value === null)
  assert(numericRows.length > 0)
  const dom = await semanticDom(active)
  assert.equal(dom.layout, 'indicator-series')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, missingRows.length ? 'partial' : 'ready')
  assert.deepEqual({ requestBound: dom.requestBound, method: dom.method, country: dom.country, alpha2: dom.alpha2, alpha3: dom.alpha3, indicator: dom.indicator }, { requestBound: 'true', method: 'GET', country: 'SGP', alpha2: 'SG', alpha3: 'SGP', indicator: 'SP.DYN.LE00.IN' })
  assert.deepEqual({ startYear: dom.startYear, endYear: dom.endYear, requestYears: dom.requestYears }, { startYear: 2015, endYear: 2025, requestYears: 11 })
  assert.deepEqual({ providerPage: dom.providerPage, providerPages: dom.providerPages, providerPerPage: dom.providerPerPage, providerTotal: dom.providerTotal }, { providerPage: 1, providerPages: 1, providerPerPage: 141, providerTotal: 11 })
  assert.deepEqual({ providerRecords: dom.providerRecords, validRecords: dom.validRecords, invalidRecords: dom.invalidRecords, validObservations: dom.validObservations, missingObservations: dom.missingObservations, malformedObservations: dom.malformedObservations }, { providerRecords: 11, validRecords: 11, invalidRecords: 0, validObservations: numericRows.length, missingObservations: missingRows.length, malformedObservations: 0 })
  assert.deepEqual({ envelope: dom.envelope, pagination: dom.pagination, countryIdentity: dom.countryIdentity, indicatorIdentity: dom.indicatorIdentity, yearRange: dom.yearRange, rowIdentity: dom.rowIdentity }, { envelope: 'true', pagination: 'true', countryIdentity: 'true', indicatorIdentity: 'true', yearRange: 'true', rowIdentity: 'true' })
  const latest = numericRows.reduce((best, item) => Number(item.date) > Number(best.date) ? item : best)
  assert.equal(dom.primaryYear, Number(latest.date))
  assert.equal(dom.primaryValue, latest.value)
  await active.viewport(390, 844)
  const mobile = await active.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1,cardOverflow:document.querySelector('[data-domain-card="world-bank-indicator-series"]').scrollWidth>document.querySelector('[data-domain-card="world-bank-indicator-series"]').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await active.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(active.errors, [])
  report.checks.push({ case: 'live exact World Bank V2 indicator request', transportStatus: 200, semanticState: dom.state, returnedYears: rows.length, numericObservations: numericRows.length, missingObservations: missingRows.length, requestIdentity: 'country/indicator/date/per_page exact', pagination: '1/1 and 11/11 coherent', cors: 'browser request succeeded', mobileOverflow: false, unnamedControls: 0 })
  await active.close()
  active = undefined

  const cases = [
    {
      name: 'canonical documented-string pagination',
      body: [metadata(), fixtureRows()],
      expectedState: 'ready',
      check: (dom) => {
        assert.equal(dom.pagination, 'true')
        assert.equal(dom.providerPerPage, 141)
      },
    },
    {
      name: 'malformed pagination string',
      body: [{ ...metadata(), per_page: '0141' }, fixtureRows()],
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.pagination, 'false')
      },
    },
    {
      name: 'fractional numeric pagination',
      body: [{ ...metadata(), per_page: 141.5 }, fixtureRows()],
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.pagination, 'false')
      },
    },
    {
      name: 'malformed envelope',
      body: { data: fixtureRows() },
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.envelope, 'false')
        assert.doesNotMatch(dom.text, /84/)
      },
    },
    {
      name: 'numeric-string observation',
      body: [metadata(), fixtureRows().map((item, index) => index === 0 ? { ...item, value: '99.9' } : item)],
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.malformedObservations, 1)
        assert.equal(dom.validObservations, 10)
        assert.doesNotMatch(dom.text, /99\.9/)
      },
    },
    {
      name: 'wrong row identity',
      body: [metadata(), fixtureRows().map((item, index) => index === 0 ? row(2025, 84, { indicator: { id: 'SP.POP.TOTL', value: 'Population, total' }, country: { id: 'BR', value: 'Brazil' }, countryiso3code: 'BRA' }) : item)],
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.invalidRecords, 1)
        assert.equal(dom.rowIdentity, 'false')
        assert.doesNotMatch(dom.text, /Brazil|Population, total/)
      },
    },
  ]
  for (const testCase of cases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: testCase.body }]]) })
    active = fixtureBrowser
    await fixtureBrowser.nav('world-bank-indicator-explorer')
    const result = await fixtureBrowser.run()
    assert.equal(result.ok, true, result.error)
    const dom = await semanticDom(fixtureBrowser)
    assert.equal(dom.state, testCase.expectedState)
    testCase.check(dom)
    assert.equal(fixtureBrowser.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(fixtureBrowser.errors, [])
    report.checks.push({ case: `fixture-only ${testCase.name} HTTP-200`, semanticState: dom.state, exactFixtureRequests: 1 })
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

fs.writeFileSync(`${evidence}/world-bank-indicator-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/world-bank-indicator-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
