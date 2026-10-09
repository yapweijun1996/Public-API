import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'Data USA Tesseract 2023 state-population request/pagination/row binding, strict native population evidence, malformed HTTP-200 handling, mobile layout, and accessibility',
  checks: [],
  errors: [],
}

const EXPECTED_COLUMNS = ['State ID', 'State', 'Year', 'Population']
const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())

const endpointContract = (endpoint) => {
  const url = new URL(endpoint)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.hostname, 'api.datausa.io')
  assert.equal(url.port, '')
  assert.equal(url.username, '')
  assert.equal(url.password, '')
  assert.equal(url.hash, '')
  assert.equal(url.pathname, '/tesseract/data.jsonrecords')
  const entries = [...url.searchParams.entries()]
  const keys = ['cube', 'drilldowns', 'measures', 'include', 'limit']
  assert.equal(entries.length, keys.length)
  assert.deepEqual(entries.map(([key]) => key).sort(), [...keys].sort())
  for (const key of keys) assert.equal(entries.filter(([candidate]) => candidate === key).length, 1)
  assert.equal(url.searchParams.get('cube'), 'acs_yg_total_population_5')
  assert.equal(url.searchParams.get('drilldowns'), 'State,Year')
  assert.equal(url.searchParams.get('measures'), 'Population')
  assert.equal(url.searchParams.get('include'), 'Year:2023')
  assert.equal(url.searchParams.get('limit'), '8,0')
  return { endpoint, year: 2023, limit: 8, offset: 0 }
}

const semanticDom = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview');
  const card = shell?.querySelector('[data-domain-card="data-usa-state-population"]');
  return {
    layout: shell?.dataset.previewLayout || '', fallback: shell?.dataset.ssotFallback || '', state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '', method: card?.dataset.requestMethod || '', year: Number(card?.dataset.requestYear),
    requestLimit: Number(card?.dataset.requestLimit), requestOffset: Number(card?.dataset.requestOffset),
    providerLimit: Number(card?.dataset.providerLimit), providerOffset: Number(card?.dataset.providerOffset), providerTotal: Number(card?.dataset.providerTotal),
    providerRecords: Number(card?.dataset.providerRecordCount), validRecords: Number(card?.dataset.validRecordCount), invalidRecords: Number(card?.dataset.invalidRecordCount), malformedPopulations: Number(card?.dataset.malformedPopulationCount),
    envelope: card?.dataset.envelopeContract || '', columns: card?.dataset.columnsContract || '', pagination: card?.dataset.paginationContract || '', rowIdentity: card?.dataset.rowIdentityContract || '',
    rows: [...(card?.querySelectorAll('.data-usa-population-rows article') || [])].map((node) => ({
      stateId: node.dataset.stateId || '', year: Number(node.dataset.year), population: Number(node.dataset.population), text: node.textContent || '',
    })),
    runtimeStatus: shell?.querySelector('.ssot-runtime b')?.textContent || '', text: card?.innerText || '',
  };
})()`)

const canonicalResponse = (rows, page = {}) => ({
  annotations: { source_name: 'Census Bureau', dataset_name: 'ACS 5-year Estimate', table_id: 'B01003' },
  page: { limit: 8, offset: 0, total: rows.length, ...page },
  columns: EXPECTED_COLUMNS,
  data: rows,
})
const row = (stateId, state, population, year = 2023) => ({ 'State ID': stateId, State: state, Year: year, Population: population })
const canonicalRows = [row('04000US01', 'Alabama', 5054253), row('04000US02', 'Alaska', 733971), row('04000US04', 'Arizona', 7268175)]

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('data-usa')
  const endpoint = await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const contract = endpointContract(endpoint)

  const beforeLive = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - beforeLive, 1, 'The live journey must send exactly one provider fetch and never retry')
  const payload = result.data
  assert(payload && typeof payload === 'object' && !Array.isArray(payload), 'Data USA did not return its documented object envelope')
  assert.deepEqual(payload.columns, EXPECTED_COLUMNS)
  assert(payload.page && typeof payload.page === 'object' && !Array.isArray(payload.page))
  assert.deepEqual({ limit: payload.page.limit, offset: payload.page.offset }, { limit: contract.limit, offset: contract.offset })
  assert(Number.isSafeInteger(payload.page.total) && payload.page.total >= payload.data.length)
  assert(Array.isArray(payload.data))
  assert.equal(payload.data.length, Math.min(contract.limit, payload.page.total - contract.offset))
  const stateIds = new Set()
  const stateNames = new Set()
  for (const record of payload.data) {
    assert(record && typeof record === 'object' && !Array.isArray(record))
    assert.match(record['State ID'], /^04000US[0-9]{2}$/)
    assert.equal(typeof record.State, 'string')
    assert(record.State.trim())
    assert.equal(record.Year, contract.year)
    assert.equal(typeof record.Population, 'number')
    assert(Number.isSafeInteger(record.Population) && record.Population >= 0)
    assert(!stateIds.has(record['State ID']))
    assert(!stateNames.has(record.State))
    stateIds.add(record['State ID'])
    stateNames.add(record.State)
  }

  const liveDom = await semanticDom(active)
  assert.equal(liveDom.layout, 'state-population')
  assert.equal(liveDom.fallback, 'false')
  assert.equal(liveDom.state, 'ready')
  assert.match(liveDom.runtimeStatus, /^200 OK$/)
  assert.deepEqual(
    { requestBound: liveDom.requestBound, method: liveDom.method, year: liveDom.year, requestLimit: liveDom.requestLimit, requestOffset: liveDom.requestOffset },
    { requestBound: 'true', method: 'GET', year: contract.year, requestLimit: contract.limit, requestOffset: contract.offset },
  )
  assert.deepEqual(
    { providerLimit: liveDom.providerLimit, providerOffset: liveDom.providerOffset, providerTotal: liveDom.providerTotal, providerRecords: liveDom.providerRecords, validRecords: liveDom.validRecords, invalidRecords: liveDom.invalidRecords, malformedPopulations: liveDom.malformedPopulations },
    { providerLimit: payload.page.limit, providerOffset: payload.page.offset, providerTotal: payload.page.total, providerRecords: payload.data.length, validRecords: payload.data.length, invalidRecords: 0, malformedPopulations: 0 },
  )
  assert.deepEqual(
    { envelope: liveDom.envelope, columns: liveDom.columns, pagination: liveDom.pagination, rowIdentity: liveDom.rowIdentity },
    { envelope: 'true', columns: 'true', pagination: 'true', rowIdentity: 'true' },
  )
  assert.equal(liveDom.rows.length, payload.data.length)
  for (const record of payload.data) {
    const domRow = liveDom.rows.find((candidate) => candidate.stateId === record['State ID'])
    assert(domRow, `Missing DOM row for ${record['State ID']}`)
    assert.equal(domRow.year, record.Year)
    assert.equal(domRow.population, record.Population)
    assert.match(domRow.text, new RegExp(record.State.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  await active.viewport(390, 844)
  const mobile = await active.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
    cardOverflow: document.querySelector('[data-domain-card="data-usa-state-population"]').scrollWidth > document.querySelector('[data-domain-card="data-usa-state-population"]').clientWidth + 1,
  })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await active.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(active.errors, [])
  report.checks.push({ case: 'live exact Data USA 2023 state-population first page', transportStatus: 200, semanticState: liveDom.state, returnedRows: payload.data.length, providerTotal: payload.page.total, requestIdentity: 'exact five-key Tesseract GET', rawToDomIdentity: true, cors: 'browser request succeeded', mobileOverflow: false, unnamedControls: 0, liveProviderRequests: 1, retries: 0 })
  await active.close()
  active = undefined

  const cases = [
    {
      name: 'numeric-string population',
      body: canonicalResponse([canonicalRows[0], row('04000US02', 'Alaska', '9999999'), canonicalRows[2]]),
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.validRecords, 2)
        assert.equal(dom.malformedPopulations, 1)
        assert.doesNotMatch(dom.text, /9,999,999/)
      },
    },
    {
      name: 'wrong-year and duplicate-state identities',
      body: canonicalResponse([canonicalRows[0], row('04000US02', 'Alaska', 733971, 2022), row('04000US01', 'Duplicate Alabama', 123)]),
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.validRecords, 1)
        assert.equal(dom.invalidRecords, 2)
        assert.equal(dom.rowIdentity, 'false')
        assert.doesNotMatch(dom.text, /Duplicate Alabama/)
      },
    },
    {
      name: 'malformed pagination',
      body: canonicalResponse(canonicalRows, { limit: '8' }),
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.pagination, 'false')
        assert.equal(dom.validRecords, 3)
      },
    },
    {
      name: 'documented empty first page',
      body: canonicalResponse([], { total: 0 }),
      expectedState: 'empty',
      check: (dom) => {
        assert.equal(dom.validRecords, 0)
        assert.match(dom.text, /No state population records returned/)
        assert.doesNotMatch(dom.text, /0 people/)
      },
    },
  ]

  for (const testCase of cases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: testCase.body }]]) })
    active = fixtureBrowser
    await fixtureBrowser.nav('data-usa')
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
    assert.deepEqual(fixtureBrowser.blockedProviders, [])
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

fs.writeFileSync(`${evidence}/data-usa-population-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/data-usa-population-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
