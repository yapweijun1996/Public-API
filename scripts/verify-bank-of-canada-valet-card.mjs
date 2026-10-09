import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'Bank of Canada Valet request/series binding, documented decimal-string values, malformed HTTP-200 handling, mobile layout, and accessibility',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setInput = async (b, name, value) => {
  await b.ev(`(() => {
    const input = document.querySelector('input[name=${JSON.stringify(name)}]')
    if (!input) throw new Error('Missing input ' + ${JSON.stringify(name)})
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await sleep(80)
}
const semanticDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="bank-of-canada-series"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', method:card?.dataset.requestMethod||'', requestSeries:card?.dataset.requestSeries||'',
    startDate:card?.dataset.requestStartDate||'', endDate:card?.dataset.requestEndDate||'', providerSeries:card?.dataset.providerSeries||'',
    providerRecords:Number(card?.dataset.providerRecordCount), validRecords:Number(card?.dataset.validRecordCount), invalidRecords:Number(card?.dataset.invalidRecordCount),
    missingValues:Number(card?.dataset.missingValueCount), malformedValues:Number(card?.dataset.malformedValueCount),
    envelope:card?.dataset.envelopeContract||'', seriesIdentity:card?.dataset.seriesIdentityContract||'', dateRange:card?.dataset.dateRangeContract||'', decimalStrings:card?.dataset.decimalStringContract||'',
    primaryDate:card?.dataset.primaryDate||'', primaryValue:card?.dataset.primaryValue||'', text:card?.innerText||'',
  };
})()`)

const isoDay = (value) => {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/)
  const date = new Date(`${value}T00:00:00.000Z`)
  assert.equal(date.toISOString().slice(0, 10), value)
  return Math.floor(date.getTime() / 86400000)
}

const endpointContract = (endpoint) => {
  const url = new URL(endpoint)
  const path = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.hostname, 'www.bankofcanada.ca')
  assert.deepEqual(path.slice(0, 2), ['valet', 'observations'])
  assert.equal(path[3], 'json')
  assert.equal(path.length, 4)
  assert.match(path[2], /^[A-Za-z0-9_.-]+$/)
  assert.deepEqual([...url.searchParams.keys()].sort(), ['end_date', 'start_date'])
  const startDate = url.searchParams.get('start_date')
  const endDate = url.searchParams.get('end_date')
  const startDay = isoDay(startDate)
  const endDay = isoDay(endDate)
  assert(endDay >= startDay)
  return { series: path[2], startDate, endDate, startDay, endDay }
}

const seriesDetail = (series) => ({
  [series]: {
    label: 'USD/CAD',
    description: 'Daily average exchange rate: daily value of the US dollar expressed in Canadian dollars, for 1 unit of US dollar',
    dimension: { key: 'd', name: 'Date' },
  },
})

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('bank-of-canada-valet')
  const endpoint = await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const contract = endpointContract(endpoint)
  assert.equal(contract.series, 'FXUSDCAD')
  const nativeSeriesContract = await active.ev(`(() => { const input=document.querySelector('input[name="series"]'); return { minLength:input?.minLength, pattern:input?.pattern, value:input?.value }; })()`)
  assert.deepEqual(nativeSeriesContract, { minLength: 1, pattern: '[A-Za-z0-9_.-]+', value: 'FXUSDCAD' })

  await setInput(active, 'series', 'FXUSDCAD,FXEURCAD')
  const requestsBeforeInvalidSeries = active.requestCount
  await active.ev(`document.querySelector('form.parameter-card').requestSubmit()`)
  await active.wait(`document.querySelector('input[name="series"]')?.getAttribute('aria-invalid') === 'true'`)
  const invalidSeries = await active.ev(`(() => ({ state: document.querySelector('.request-lab')?.dataset.requestState || '', help: document.querySelector('#parameter-series-help')?.textContent || '' }))()`)
  assert.equal(active.requestCount, requestsBeforeInvalidSeries, 'Invalid multi-series product input reached the provider')
  assert.equal(invalidSeries.state, 'idle')
  assert.match(invalidSeries.help, /one Bank of Canada series code/i)

  await setInput(active, 'series', 'FXUSDCAD')
  report.checks.push({ case: 'invalid explicit multi-series product input', providerRequests: 0, sharedValidation: 'fail-closed' })

  const requestsBeforeLiveRun = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - requestsBeforeLiveRun, 1, 'The live journey must send exactly one provider fetch')
  assert(result.data && typeof result.data === 'object' && !Array.isArray(result.data), 'Valet did not return an object envelope')
  const detailKeys = Object.keys(result.data.seriesDetail ?? {})
  assert.deepEqual(detailKeys, [contract.series])
  const detail = result.data.seriesDetail[contract.series]
  assert.equal(typeof detail.label, 'string')
  assert(detail.label.trim())
  assert.equal(typeof detail.description, 'string')
  assert(detail.description.trim())
  assert.deepEqual(detail.dimension, { key: 'd', name: 'Date' })
  assert(Array.isArray(result.data.observations))
  assert(result.data.observations.length > 0, 'The default rolling range should include at least one published observation')
  const seen = new Set()
  for (const row of result.data.observations) {
    assert.deepEqual(Object.keys(row).sort(), ['d', contract.series].sort())
    const day = isoDay(row.d)
    assert(day >= contract.startDay && day <= contract.endDay)
    assert(!seen.has(row.d), `duplicate live Valet observation date ${row.d}`)
    seen.add(row.d)
    assert.equal(typeof row[contract.series]?.v, 'string')
    assert.match(row[contract.series].v, /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/)
    assert(Number.isFinite(Number(row[contract.series].v)))
  }

  const liveDom = await semanticDom(active)
  assert.equal(liveDom.layout, 'central-bank-series')
  assert.equal(liveDom.fallback, 'false')
  assert.equal(liveDom.state, 'ready')
  assert.deepEqual({ requestBound: liveDom.requestBound, method: liveDom.method, requestSeries: liveDom.requestSeries, providerSeries: liveDom.providerSeries }, { requestBound: 'true', method: 'GET', requestSeries: contract.series, providerSeries: contract.series })
  assert.deepEqual({ startDate: liveDom.startDate, endDate: liveDom.endDate }, { startDate: contract.startDate, endDate: contract.endDate })
  assert.equal(liveDom.providerRecords, result.data.observations.length)
  assert.equal(liveDom.validRecords, result.data.observations.length)
  assert.equal(liveDom.invalidRecords, 0)
  assert.equal(liveDom.missingValues, 0)
  assert.equal(liveDom.malformedValues, 0)
  assert.deepEqual({ envelope: liveDom.envelope, seriesIdentity: liveDom.seriesIdentity, dateRange: liveDom.dateRange, decimalStrings: liveDom.decimalStrings }, { envelope: 'true', seriesIdentity: 'true', dateRange: 'true', decimalStrings: 'true' })
  const latest = [...result.data.observations].sort((left, right) => left.d.localeCompare(right.d)).at(-1)
  assert.equal(liveDom.primaryDate, latest.d)
  assert.equal(liveDom.primaryValue, latest[contract.series].v)

  await active.viewport(390, 844)
  const mobile = await active.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1,cardOverflow:document.querySelector('[data-domain-card="bank-of-canada-series"]').scrollWidth>document.querySelector('[data-domain-card="bank-of-canada-series"]').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await active.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(active.errors, [])
  report.checks.push({ case: 'live exact Bank of Canada Valet series request', transportStatus: 200, semanticState: liveDom.state, series: contract.series, observations: result.data.observations.length, decimalStringValues: true, identityBinding: true, cors: 'browser request succeeded', mobileOverflow: false, unnamedControls: 0, liveProviderRequests: 1, retries: 0 })
  await active.close()
  active = undefined

  const canonicalRows = [
    { d: contract.startDate, [contract.series]: { v: '1.3500' } },
    { d: contract.endDate, [contract.series]: { v: '1.3600' } },
  ]
  const cases = [
    {
      name: 'native JSON number instead of documented decimal string',
      body: { seriesDetail: seriesDetail(contract.series), observations: canonicalRows.map((row, index) => index === 0 ? { ...row, [contract.series]: { v: 9.9999 } } : row) },
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.malformedValues, 1)
        assert.equal(dom.validRecords, 1)
        assert.equal(dom.decimalStrings, 'false')
        assert.doesNotMatch(dom.text, /9\.9999/)
      },
    },
    {
      name: 'wrong observation series identity',
      body: { seriesDetail: seriesDetail(contract.series), observations: canonicalRows.map((row, index) => index === 0 ? { d: row.d, FXEURCAD: { v: '8.8888' } } : row) },
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.invalidRecords, 1)
        assert.equal(dom.dateRange, 'false')
        assert.doesNotMatch(dom.text, /8\.8888/)
      },
    },
    {
      name: 'empty observations',
      body: { seriesDetail: seriesDetail(contract.series), observations: [] },
      expectedState: 'empty',
      check: (dom) => {
        assert.equal(dom.validRecords, 0)
        assert.match(dom.text, /No observations returned/)
        assert.doesNotMatch(dom.text, /0\.0000/)
      },
    },
    {
      name: 'wrong seriesDetail identity',
      body: { seriesDetail: seriesDetail('FXEURCAD'), observations: canonicalRows },
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.seriesIdentity, 'false')
        assert.doesNotMatch(dom.text, /1\.3500|1\.3600/)
      },
    },
    {
      name: 'malformed observations envelope',
      body: { seriesDetail: seriesDetail(contract.series), observations: {} },
      expectedState: 'invalid',
      check: (dom) => assert.equal(dom.envelope, 'false'),
    },
  ]

  for (const testCase of cases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: testCase.body }]]) })
    active = fixtureBrowser
    await fixtureBrowser.nav('bank-of-canada-valet')
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

fs.writeFileSync(`${evidence}/bank-of-canada-valet-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/bank-of-canada-valet-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
