import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const configs = [
  { id: 'world-bank-gdp', indicator: 'NY.GDP.MKTP.CD', indicatorName: 'GDP (current US$)', endpoint: 'https://api.worldbank.org/v2/country/SGP/indicator/NY.GDP.MKTP.CD?format=json&mrv=8&per_page=8' },
  { id: 'world-bank-population', indicator: 'SP.POP.TOTL', indicatorName: 'Population, total', endpoint: 'https://api.worldbank.org/v2/country/SGP/indicator/SP.POP.TOTL?format=json&mrv=8&per_page=8' },
]
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', scope: 'fixed World Bank GDP/population MRV request-bound indicator series', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const row = (config, year, value, overrides = {}) => ({ indicator: { id: config.indicator, value: config.indicatorName }, country: { id: 'SG', value: 'Singapore' }, countryiso3code: 'SGP', date: String(year), value, unit: '', obs_status: '', decimal: 0, ...overrides })
const fixtureRows = (config, values = Array.from({ length: 8 }, (_, index) => 100 + index)) => values.map((value, index) => row(config, 2025 - index, value))
const metadata = (overrides = {}) => ({ page: 1, pages: 1, per_page: 8, total: 8, sourceid: '2', lastupdated: '2026-07-13', ...overrides })
const dom = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="world-bank-indicator-series"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', mode:card?.dataset.requestMode||'', country:card?.dataset.requestCountryCode||'', indicator:card?.dataset.requestIndicator||'', mrv:Number(card?.dataset.requestMrv), page:Number(card?.dataset.providerPage), pages:Number(card?.dataset.providerPages), perPage:Number(card?.dataset.providerPerPage), total:Number(card?.dataset.providerTotal), records:Number(card?.dataset.providerRecordCount), valid:Number(card?.dataset.validObservationCount), missing:Number(card?.dataset.missingObservationCount), malformed:Number(card?.dataset.malformedObservationCount), invalid:Number(card?.dataset.invalidRecordCount), pagination:card?.dataset.paginationContract||'', identity:card?.dataset.rowIdentityContract||'', yearOrder:card?.dataset.yearOrderContract||'', primaryYear:Number(card?.dataset.primaryYear), primaryValue:Number(card?.dataset.primaryValue), text:card?.innerText||'' }; })()`)

let active
try {
  for (const config of configs) {
    active = await browser(`${root}/dist`)
    await active.nav(config.id)
    assert.equal(await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`), config.endpoint)
    const before = active.requestCount
    const result = await active.run()
    assert.equal(result.ok, true, result.error)
    assert.equal(active.requestCount - before, 1, `${config.id} must send exactly one provider request`)
    assert(Array.isArray(result.data) && result.data.length === 2 && Array.isArray(result.data[1]))
    const [meta, rows] = result.data
    assert.deepEqual({ page: meta.page, pages: meta.pages, per_page: meta.per_page, total: meta.total }, { page: 1, pages: 1, per_page: 8, total: 8 })
    assert.equal(rows.length, 8)
    const years = rows.map((item) => Number(item.date))
    assert.equal(new Set(years).size, 8)
    assert(years.every((year, index) => index === 0 || years[index - 1] > year), 'MRV rows must be newest-to-oldest')
    assert(rows.every((item) => item.indicator?.id === config.indicator && item.country?.id === 'SG' && item.countryiso3code === 'SGP'))
    assert(rows.every((item) => item.value === null || typeof item.value === 'number'))
    const numeric = rows.filter((item) => typeof item.value === 'number')
    const missing = rows.filter((item) => item.value === null)
    assert(numeric.length > 0)
    const model = await dom(active)
    assert.equal(model.layout, 'indicator-series')
    assert.equal(model.fallback, 'false')
    assert.equal(model.state, missing.length ? 'partial' : 'ready')
    assert.deepEqual({ requestBound: model.requestBound, mode: model.mode, country: model.country, indicator: model.indicator, mrv: model.mrv }, { requestBound: 'true', mode: 'mrv', country: 'SGP', indicator: config.indicator, mrv: 8 })
    assert.deepEqual({ page: model.page, pages: model.pages, perPage: model.perPage, total: model.total, records: model.records }, { page: 1, pages: 1, perPage: 8, total: 8, records: 8 })
    assert.deepEqual({ pagination: model.pagination, identity: model.identity, yearOrder: model.yearOrder }, { pagination: 'true', identity: 'true', yearOrder: 'true' })
    const latest = numeric.reduce((best, item) => Number(item.date) > Number(best.date) ? item : best)
    assert.equal(model.primaryYear, Number(latest.date)); assert.equal(model.primaryValue, latest.value)
    await active.viewport(390, 844)
    const mobile = await active.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1, cardOverflow:document.querySelector('[data-domain-card="world-bank-indicator-series"]').scrollWidth>document.querySelector('[data-domain-card="world-bank-indicator-series"]').clientWidth+1 })`)
    assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
    const ax = await active.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0); assert.deepEqual(active.errors, [])
    report.checks.push({ case: `live ${config.id}`, transportStatus: 200, semanticState: model.state, rows: 8, numericObservations: numeric.length, missingObservations: missing.length, requestIdentity: 'SGP/indicator/MRV=8/per_page=8 exact', cors: 'browser request succeeded', mobileOverflow: false, unnamedControls: 0 })
    await active.close(); active = undefined
  }

  const config = configs[0]
  const cases = [
    { name: 'numeric-string observation', body: [metadata(), fixtureRows(config, ['999.9', 107, 106, 105, 104, 103, 102, 101])], state: 'partial', check: (m) => { assert.equal(m.malformed, 1); assert.doesNotMatch(m.text, /999\.9/) } },
    { name: 'wrong identity', body: [metadata(), fixtureRows(config).map((item, index) => index ? item : row(config, 2025, 100, { indicator: { id: 'SP.POP.TOTL', value: 'Population, total' }, country: { id: 'BR', value: 'Brazil' }, countryiso3code: 'BRA' }))], state: 'partial', check: (m) => { assert.equal(m.invalid, 1); assert.equal(m.identity, 'false') } },
    { name: 'out-of-order year', body: (() => { const r=fixtureRows(config); [r[0],r[1]]=[r[1],r[0]]; return [metadata(),r] })(), state: 'partial', check: (m) => assert.equal(m.yearOrder, 'false') },
    { name: 'malformed pagination', body: [metadata({ pages: 9, total: 66 }), fixtureRows(config)], state: 'invalid', check: (m) => assert.equal(m.pagination, 'false') },
    { name: 'all unavailable', body: [metadata(), fixtureRows(config, Array(8).fill(null))], state: 'empty', check: (m) => { assert.equal(m.missing, 8); assert.doesNotMatch(m.text, /0\.00/) } },
  ]
  for (const testCase of cases) {
    active = await browser(`${root}/dist`, { fixtures: new Map([[config.endpoint, { body: testCase.body }]]) })
    await active.nav(config.id)
    const result = await active.run(); assert.equal(result.ok, true, result.error)
    const model = await dom(active); assert.equal(model.state, testCase.state); testCase.check(model)
    assert.equal(active.fixtureRequests.filter((request) => request.url === config.endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(active.errors, [])
    report.checks.push({ case: `fixture-only ${testCase.name} HTTP-200`, semanticState: model.state, exactFixtureRequests: 1 })
    await active.close(); active = undefined
  }
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error); if (active) report.errors.push(...active.errors.map(String))
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/world-bank-fixed-indicators-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/world-bank-fixed-indicators-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
