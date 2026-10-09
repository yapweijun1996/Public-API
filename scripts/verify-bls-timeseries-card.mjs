import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'BLS keyless v1 single-series request binding, response/period/decimal-string contracts, malformed HTTP-200 handling, mobile layout, and accessibility',
  checks: [],
  errors: [],
}

const periodNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Annual']
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const semanticDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="bls-timeseries"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', method:card?.dataset.requestMethod||'', requestSeries:card?.dataset.requestSeries||'', providerSeries:card?.dataset.providerSeries||'',
    responseTime:Number(card?.dataset.responseTimeMs), messages:Number(card?.dataset.providerMessageCount), providerSeriesCount:Number(card?.dataset.providerSeriesCount),
    providerRows:Number(card?.dataset.providerRowCount), validRows:Number(card?.dataset.validRowCount), invalidRows:Number(card?.dataset.invalidRowCount),
    validValues:Number(card?.dataset.validValueCount), missingValues:Number(card?.dataset.missingValueCount), malformedValues:Number(card?.dataset.malformedValueCount),
    envelope:card?.dataset.envelopeContract||'', status:card?.dataset.statusContract||'', responseTimeContract:card?.dataset.responseTimeContract||'', messageContract:card?.dataset.messageContract||'',
    results:card?.dataset.resultsContract||'', resultsShape:card?.dataset.resultsShape||'', seriesIdentity:card?.dataset.seriesIdentityContract||'', rowUniqueness:card?.dataset.rowUniquenessContract||'', rowOrder:card?.dataset.rowOrderContract||'', period:card?.dataset.periodContract||'',
    threeYear:card?.dataset.threeYearContract||'', decimalStrings:card?.dataset.decimalStringContract||'', primaryPeriod:card?.dataset.primaryPeriod||'', primaryValue:card?.dataset.primaryValue||'', text:card?.innerText||'',
  };
})()`)

const endpointContract = (endpoint) => {
  const url = new URL(endpoint)
  const path = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.hostname, 'api.bls.gov')
  assert.equal(url.port, '')
  assert.equal(url.search, '')
  assert.equal(url.hash, '')
  assert.deepEqual(path.slice(0, 4), ['publicAPI', 'v1', 'timeseries', 'data'])
  assert.equal(path.length, 5)
  assert(['LNS14000000', 'CUUR0000SA0', 'CUUR0000SAF1'].includes(path[4]))
  assert.equal(endpoint, `https://api.bls.gov/publicAPI/v1/timeseries/data/${path[4]}`)
  return { series: path[4] }
}

const rowContract = (row) => {
  assert(row && typeof row === 'object' && !Array.isArray(row))
  assert.equal(typeof row.year, 'string')
  assert.match(row.year, /^\d{4}$/)
  assert.equal(typeof row.period, 'string')
  assert.match(row.period, /^M(?:0[1-9]|1[0-3])$/)
  const periodNumber = Number(row.period.slice(1))
  assert.equal(row.periodName, periodNames[periodNumber - 1])
  assert.equal(typeof row.value, 'string')
  const missing = row.value === '-'
  if (!missing) {
    assert.match(row.value, decimalPattern)
    assert(Number.isFinite(Number(row.value)))
  }
  return { key: `${row.year}-${row.period}`, ordinal: Number(row.year) * 13 + periodNumber, missing }
}

const response = (series, rows, overrides = {}) => ({
  status: overrides.status ?? 'REQUEST_SUCCEEDED',
  responseTime: overrides.responseTime ?? 18,
  message: overrides.message ?? [],
  Results: { series: [{ seriesID: overrides.seriesID ?? series, data: rows }] },
})

const documentedArrayResponse = (series, rows) => ({
  status: 'REQUEST_SUCCEEDED',
  responseTime: 18,
  message: [],
  Results: [{ series: [{ seriesID: series, data: rows }] }],
})

const row = (year, period, periodName, value) => ({ year, period, periodName, value, footnotes: [{}] })

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('bls-timeseries')
  const endpoint = await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const contract = endpointContract(endpoint)
  assert.equal(contract.series, 'LNS14000000')
  const seriesControl = await active.ev(`(() => { const select=document.querySelector('select[name="seriesId"]'); return { value:select?.value, options:[...(select?.options||[])].map(option=>option.value) }; })()`)
  assert.deepEqual(seriesControl, { value: contract.series, options: ['LNS14000000', 'CUUR0000SA0', 'CUUR0000SAF1'] })

  const requestsBeforeLiveRun = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - requestsBeforeLiveRun, 1, 'The live journey must send exactly one provider fetch')
  assert(result.data && typeof result.data === 'object' && !Array.isArray(result.data), 'BLS did not return an object envelope')
  assert.equal(result.data.status, 'REQUEST_SUCCEEDED')
  assert(Number.isSafeInteger(result.data.responseTime) && result.data.responseTime >= 0)
  assert(Array.isArray(result.data.message) && result.data.message.every((message) => typeof message === 'string'))
  assert.equal(result.data.message.length, 0)
  const liveResultsShape = Array.isArray(result.data.Results) ? 'array' : 'object'
  const liveResults = liveResultsShape === 'array'
    ? (assert.equal(result.data.Results.length, 1), result.data.Results[0])
    : result.data.Results
  assert(liveResults && typeof liveResults === 'object' && !Array.isArray(liveResults))
  assert(Array.isArray(liveResults.series))
  assert.equal(liveResults.series.length, 1)
  const series = liveResults.series[0]
  assert.equal(series.seriesID, contract.series)
  assert(Array.isArray(series.data))
  assert(series.data.length > 0, 'The default BLS series should contain observations from the past three years')
  const identities = series.data.map(rowContract)
  const missingValueCount = identities.filter(({ missing }) => missing).length
  assert.equal(new Set(identities.map(({ key }) => key)).size, identities.length)
  assert(identities.every(({ ordinal }, index) => index === 0 || identities[index - 1].ordinal > ordinal), 'BLS rows are not newest-first')
  const years = series.data.map(({ year }) => Number(year))
  assert(Math.max(...years) - Math.min(...years) <= 2, 'BLS single-series GET exceeded its documented three-year calendar span')

  const liveDom = await semanticDom(active)
  assert.equal(liveDom.layout, 'labor-timeseries')
  assert.equal(liveDom.fallback, 'false')
  assert.equal(liveDom.state, missingValueCount > 0 ? 'partial' : 'ready')
  assert.deepEqual({ requestBound: liveDom.requestBound, method: liveDom.method, requestSeries: liveDom.requestSeries, providerSeries: liveDom.providerSeries }, { requestBound: 'true', method: 'GET', requestSeries: contract.series, providerSeries: contract.series })
  assert.equal(liveDom.responseTime, result.data.responseTime)
  assert.equal(liveDom.messages, 0)
  assert.equal(liveDom.providerSeriesCount, 1)
  assert.equal(liveDom.providerRows, series.data.length)
  assert.equal(liveDom.validRows, series.data.length)
  assert.equal(liveDom.invalidRows, 0)
  assert.equal(liveDom.validValues, series.data.length - missingValueCount)
  assert.equal(liveDom.missingValues, missingValueCount)
  assert.equal(liveDom.malformedValues, 0)
  assert.equal(liveDom.resultsShape, liveResultsShape)
  assert.deepEqual({ envelope: liveDom.envelope, status: liveDom.status, responseTime: liveDom.responseTimeContract, message: liveDom.messageContract, results: liveDom.results, seriesIdentity: liveDom.seriesIdentity, rowUniqueness: liveDom.rowUniqueness, rowOrder: liveDom.rowOrder, period: liveDom.period, threeYear: liveDom.threeYear, decimalStrings: liveDom.decimalStrings }, { envelope: 'true', status: 'true', responseTime: 'true', message: 'true', results: 'true', seriesIdentity: 'true', rowUniqueness: 'true', rowOrder: 'true', period: 'true', threeYear: 'true', decimalStrings: 'true' })
  assert.equal(liveDom.primaryPeriod, identities[0].key)
  assert.equal(liveDom.primaryValue, series.data[0].value === '-' ? '' : series.data[0].value)

  await active.viewport(390, 844)
  const mobile = await active.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1,cardOverflow:document.querySelector('[data-domain-card="bls-timeseries"]').scrollWidth>document.querySelector('[data-domain-card="bls-timeseries"]').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await active.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(active.errors, [])
  report.checks.push({ case: 'live exact BLS keyless v1 single-series request', transportStatus: 200, semanticState: liveDom.state, series: contract.series, resultsShape: liveResultsShape, observations: series.data.length, decimalStringValues: series.data.length - missingValueCount, missingValues: missingValueCount, newestFirst: true, threeYearSpan: true, identityBinding: true, cors: 'browser request succeeded', mobileOverflow: false, unnamedControls: 0, liveProviderRequests: 1, retries: 0 })
  await active.close()
  active = undefined

  const canonicalRows = [
    row('2026', 'M02', 'February', '4.1'),
    row('2026', 'M01', 'January', '4.0'),
    row('2025', 'M13', 'Annual', '4.2'),
    row('2025', 'M12', 'December', '4.1'),
  ]
  const cases = [
    {
      name: 'annual-average period and true zero',
      body: response(contract.series, [row('2026', 'M01', 'January', '0.0'), ...canonicalRows.slice(2)]),
      expectedState: 'ready',
      check: (dom) => {
        assert.equal(dom.primaryValue, '0.0')
        assert.match(dom.text, /Annual 2025/)
      },
    },
    {
      name: 'official v1 documented Results array wrapper',
      body: documentedArrayResponse(contract.series, canonicalRows),
      expectedState: 'ready',
      check: (dom) => {
        assert.equal(dom.resultsShape, 'array')
        assert.equal(dom.seriesIdentity, 'true')
      },
    },
    {
      name: 'missing and native-number values',
      body: response(contract.series, [row('2026', 'M02', 'February', '-'), row('2026', 'M01', 'January', 9.9), row('2025', 'M12', 'December', '4.1')]),
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.missingValues, 1)
        assert.equal(dom.malformedValues, 1)
        assert.equal(dom.validValues, 1)
        assert.equal(dom.primaryPeriod, '2026-M02')
        assert.equal(dom.primaryValue, '')
        assert.doesNotMatch(dom.text, /9\.9/)
      },
    },
    {
      name: 'duplicate and out-of-order periods',
      body: response(contract.series, [row('2026', 'M01', 'January', '4.0'), row('2026', 'M03', 'March', '99.9'), row('2026', 'M01', 'January', '88.8')]),
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.rowOrder, 'false')
        assert.equal(dom.rowUniqueness, 'false')
        assert.equal(dom.validRows, 1)
        assert.equal(dom.invalidRows, 2)
        assert.doesNotMatch(dom.text, /88\.8/)
      },
    },
    {
      name: 'wrong response series identity',
      body: response(contract.series, canonicalRows, { seriesID: 'CUUR0000SA0' }),
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.seriesIdentity, 'false')
        assert.doesNotMatch(dom.text, /4\.1|4\.2/)
      },
    },
    {
      name: 'provider-domain message',
      body: response(contract.series, [], { message: [`Invalid Series for Series ${contract.series}`] }),
      expectedState: 'invalid',
      check: (dom) => assert.equal(dom.messageContract, 'false'),
    },
    {
      name: 'coherent empty series',
      body: response(contract.series, []),
      expectedState: 'empty',
      check: (dom) => {
        assert.equal(dom.providerRows, 0)
        assert.match(dom.text, /No observations returned/)
        assert.doesNotMatch(dom.text, /0\.00/)
      },
    },
  ]

  for (const testCase of cases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: testCase.body }]]) })
    active = fixtureBrowser
    await fixtureBrowser.nav('bls-timeseries')
    assert.equal(await fixtureBrowser.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`), endpoint)
    const before = fixtureBrowser.requestCount
    const fixtureResult = await fixtureBrowser.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await semanticDom(fixtureBrowser)
    assert.equal(fixtureDom.state, testCase.expectedState)
    testCase.check(fixtureDom)
    const exactFixtureRequests = fixtureBrowser.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
    assert.equal(exactFixtureRequests, 1)
    assert.equal(fixtureBrowser.requestCount - before, exactFixtureRequests, 'Fixture-only cases must not send additional live provider requests')
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

fs.writeFileSync(`${evidence}/bls-timeseries-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/bls-timeseries-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
