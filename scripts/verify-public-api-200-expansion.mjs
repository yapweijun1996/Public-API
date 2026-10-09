import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const supportedIds = new Set(['open-meteo-seasonal', 'nhtsa-safety-ratings', 'singstat-cpi-monthly', 'openalex-works-search', 'oecd-cli'])
const requestedIds = new Set((process.env.EXPANSION_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean))
for (const id of requestedIds) assert(supportedIds.has(id), `Unknown EXPANSION_IDS entry: ${id}`)
const shouldRun = (id) => requestedIds.size === 0 || requestedIds.has(id)

const selectedIds = requestedIds.size ? [...requestedIds] : [...supportedIds]
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: requestedIds.size
    ? `selected live provider journeys with scoped deterministic regressions for the curated 195→200 catalog expansion: ${selectedIds.join(', ')}`
    : 'five live provider journeys plus deterministic NHTSA VehicleId input and OECD startPeriod regressions for the curated 195→200 catalog expansion',
  scope: selectedIds,
  checks: [],
  errors: [],
}

const oecdEndpoint = 'https://sdmx.oecd.org/public/rest/v1/data/OECD.SDD.STES,DSD_STES@DF_CLI/USA.M.LI...AA...H?startPeriod=2025-01&dimensionAtObservation=AllDimensions&format=jsondata'
const openAlexEndpoint = `https://api.openalex.org/works?${new URLSearchParams({ search: 'artificial intelligence', per_page: '8', select: 'id,title,publication_year,cited_by_count,doi,authorships,open_access' }).toString()}`
const oecdDim = (id, value, name = value) => ({ id, values: [{ id: value, name }] })
const oecdPreStartFixture = {
  errors: [],
  data: {
    structure: { dimensions: { dataset: [], series: [], observation: [oecdDim('REF_AREA', 'USA', 'United States'), oecdDim('FREQ', 'M', 'Monthly'), oecdDim('MEASURE', 'LI'), oecdDim('UNIT_MEASURE', 'IX'), oecdDim('ACTIVITY', '_Z'), oecdDim('ADJUSTMENT', 'AA'), oecdDim('TRANSFORMATION', 'IX'), oecdDim('TIME_HORIZ', '_Z'), oecdDim('METHODOLOGY', 'H'), { id: 'TIME_PERIOD', values: [{ id: '2024-12', name: '2024-12' }, { id: '2026-08', name: '2026-08' }] }] } },
    dataSets: [{ observations: { '0:0:0:0:0:0:0:0:0:0': [999.99], '0:0:0:0:0:0:0:0:0:1': [100.9] } }],
  },
}
const actionableRoles = new Set(['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'])
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && actionableRoles.has(node.role?.value) && !(node.name?.value || '').trim())
const assertMobileAndA11y = async (b, id) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:(()=>{const p=document.querySelector('.demo-preview');return p?p.scrollWidth>p.clientWidth+1:false})()})`)
  assert.equal(overflow.doc || overflow.preview, false, `${id}: mobile overflow ${JSON.stringify(overflow)}`)
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0, `${id}: unnamed actionable controls`)
}

const runLive = async (id, verify) => {
  const b = await browser(`${root}/dist`)
  try {
    await b.nav(id)
    const run = await b.run()
    assert.equal(run.ok, true, `${id}: ${run.error || 'request failed'}`)
    const check = await verify(b, run.data)
    await assertMobileAndA11y(b, id)
    assert.deepEqual(b.errors, [], `${id}: browser errors ${b.errors.join(' | ')}`)
    report.checks.push({ id, ...check, mobileOverflow: false, unnamedControls: 0 })
  } finally {
    await b.close()
  }
}

const verifySeasonalHumanForecastDaysConstraint = async () => {
  const b = await browser(`${root}/dist`)
  try {
    await b.nav('open-meteo-seasonal')
    const inputContract = await b.ev(`(()=>{const input=document.querySelector('input[name="forecastDays"]');return {type:input?.type||'',value:input?.value||'',min:input?.min||'',max:input?.max||'',step:input?.step||'',describedBy:input?.getAttribute('aria-describedby')||''}})()`)
    assert.deepEqual(inputContract, { type: 'number', value: '42', min: '1', max: '46', step: '1', describedBy: 'parameter-forecastDays-help' })
    const beforeInvalidSubmission = b.requestCount
    await b.ev(`(()=>{const input=document.querySelector('input[name="forecastDays"]'),setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'42.5');input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'42.5'}));document.querySelector('form.parameter-card').requestSubmit()})()`)
    await b.wait(`document.querySelector('input[name="forecastDays"]')?.getAttribute('aria-invalid') === 'true'`)
    await sleep(150)
    assert.equal(b.requestCount, beforeInvalidSubmission, 'Fractional human Open-Meteo Seasonal forecast days reached a provider request')
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle')
    assert.deepEqual(b.errors, [], `open-meteo-seasonal invalid input: browser errors ${b.errors.join(' | ')}`)
    report.checks.push({ id: 'open-meteo-seasonal', case: 'human fractional forecast-day pre-network validation', fieldContract: inputContract, rejectedValue: '42.5', providerRequests: 0, stateAfterBlock: 'idle' })
  } finally {
    await b.close()
  }
}

const verifyNhtsaHumanVehicleIdConstraint = async () => {
  const b = await browser(`${root}/dist`)
  try {
    await b.nav('nhtsa-safety-ratings')
    const inputContract = await b.ev(`(()=>{const input=document.querySelector('input[name="vehicleId"]');return {type:input?.type||'',value:input?.value||'',minLength:input?.minLength,maxLength:input?.maxLength,pattern:input?.pattern||'',describedBy:input?.getAttribute('aria-describedby')||''}})()`)
    assert.deepEqual(inputContract, { type: 'text', value: '19426', minLength: 1, maxLength: 6, pattern: '[1-9][0-9]{0,5}', describedBy: 'parameter-vehicleId-help' })
    const beforeInvalidSubmission = b.requestCount
    await b.ev(`(()=>{const input=document.querySelector('input[name="vehicleId"]'),setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'194.9');input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'194.9'}));document.querySelector('form.parameter-card').requestSubmit()})()`)
    await b.wait(`document.querySelector('input[name="vehicleId"]')?.getAttribute('aria-invalid') === 'true'`)
    await sleep(150)
    assert.equal(b.requestCount, beforeInvalidSubmission, 'Decimal human NHTSA VehicleId reached a provider request')
    assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle')
    assert.match(await b.ev(`document.querySelector('#parameter-vehicleId-help')?.textContent || ''`), /canonical positive decimal ID from 1 to 999999/i)
    assert.deepEqual(b.errors, [], `nhtsa-safety-ratings invalid input: browser errors ${b.errors.join(' | ')}`)
    report.checks.push({ id: 'nhtsa-safety-ratings', case: 'human decimal VehicleId pre-network validation', fieldType: inputContract.type, minLength: inputContract.minLength, maxLength: inputContract.maxLength, pattern: inputContract.pattern, rejectedValue: '194.9', providerRequests: 0, stateAfterBlock: 'idle' })
  } finally {
    await b.close()
  }
}

try {
  if (shouldRun('open-meteo-seasonal')) await verifySeasonalHumanForecastDaysConstraint()
  if (shouldRun('open-meteo-seasonal')) await runLive('open-meteo-seasonal', async (b, data) => {
    assert(data && typeof data === 'object' && !Array.isArray(data))
    assert(data.weekly && Array.isArray(data.weekly.time) && data.weekly.time.length > 0)
    const dom = await b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="seasonal-outlook"]');return {layout:s?.dataset.previewLayout||'',state:c?.dataset.resultState||'',bound:c?.dataset.requestBound||'',forecastDays:Number(c?.dataset.requestForecastDays||0),provider:Number(c?.dataset.providerPeriodCount||0),valid:Number(c?.dataset.validPeriodCount||0),invalid:Number(c?.dataset.invalidPeriodCount||0),units:c?.dataset.unitContract||'',arrayLengths:c?.dataset.arrayLengthContract||'',cadence:c?.dataset.weeklyCadenceContract||'',horizon:c?.dataset.horizonCountContract||'',minBuckets:Number(c?.dataset.minimumExpectedBuckets||0),maxBuckets:Number(c?.dataset.maximumExpectedBuckets||0),timezone:c?.dataset.timezone||'',text:c?.innerText||''}})()`)
    const measurementKeys = ['temperature_2m_mean', 'temperature_2m_anomaly', 'precipitation_mean', 'precipitation_anomaly']
    const invalidIndexes = data.weekly.time.map((time, index) => {
      const valid = typeof time === 'string' && measurementKeys.every((key) => typeof data.weekly[key]?.[index] === 'number' && Number.isFinite(data.weekly[key][index]))
      return valid ? -1 : index
    }).filter((index) => index >= 0)
    assert(invalidIndexes.every((index) => index === 0 || index === data.weekly.time.length - 1), `Open-Meteo Seasonal returned an incomplete interior weekly bucket: ${invalidIndexes.join(',')}`)
    const expectedState = invalidIndexes.length ? 'partial' : 'ready'
    const firstValidIndex = data.weekly.time.findIndex((_, index) => !invalidIndexes.includes(index))
    assert.equal(dom.layout, 'seasonal-outlook'); assert.equal(dom.state, expectedState); assert.equal(dom.bound, 'true'); assert.equal(dom.forecastDays, 42)
    assert.equal(dom.provider, data.weekly.time.length); assert.equal(dom.valid, data.weekly.time.length - invalidIndexes.length); assert.equal(dom.invalid, invalidIndexes.length)
    assert.equal(dom.units, 'true'); assert.equal(dom.arrayLengths, 'true'); assert.equal(dom.cadence, 'true'); assert.equal(dom.horizon, 'true'); assert.equal(dom.minBuckets, 6); assert.equal(dom.maxBuckets, 7); assert.equal(dom.timezone, 'Asia/Singapore')
    assert(dom.provider >= dom.minBuckets && dom.provider <= dom.maxBuckets)
    assert(firstValidIndex >= 0); assert(dom.text.includes(data.weekly.time[firstValidIndex])); assert(dom.text.includes('42-day horizon'))
    return { case: 'live 42-day EC46 horizon with calendar-aligned weekly buckets', state: dom.state, requestBound: dom.bound, forecastDays: dom.forecastDays, calendarBuckets: dom.provider, validBuckets: dom.valid, boundaryIncompleteBuckets: invalidIndexes.length, timezone: dom.timezone, liveProviderRequests: b.requestCount, browserCorsReadable: true }
  })

  if (shouldRun('nhtsa-safety-ratings')) await verifyNhtsaHumanVehicleIdConstraint()

  if (shouldRun('nhtsa-safety-ratings')) await runLive('nhtsa-safety-ratings', async (b, data) => {
    assert(data && typeof data === 'object' && Array.isArray(data.Results) && data.Results.length === 1)
    const row = data.Results[0]
    const dom = await b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="vehicle-safety-rating"]');return {layout:s?.dataset.previewLayout||'',state:c?.dataset.resultState||'',requested:Number(c?.dataset.requestedVehicleId||0),provider:Number(c?.dataset.providerVehicleId||0),match:c?.dataset.identityMatch||'',overall:c?.dataset.overallRating||'',scoreMeaning:c?.dataset.overallScoreMeaning||'',overallFrontScope:c?.dataset.overallFrontalComparisonScope||'',sideRolloverScope:c?.dataset.sideRolloverComparisonScope||'',comparisonValidation:c?.dataset.comparisonValidation||'',text:c?.innerText||''}})()`)
    assert.equal(dom.layout, 'vehicle-safety-rating'); assert.equal(dom.state, 'ready'); assert.equal(dom.requested, 19426); assert.equal(dom.provider, row.VehicleId); assert.equal(dom.match, 'true')
    assert.equal(dom.overall, row.OverallRating); assert.equal(dom.scoreMeaning, 'relative-injury-risk'); assert.equal(dom.overallFrontScope, 'same-class-plus-minus-250lb'); assert.equal(dom.sideRolloverScope, 'cross-class'); assert.equal(dom.comparisonValidation, 'unavailable-from-this-response')
    assert(dom.text.includes(row.VehicleDescription)); assert(dom.text.includes('Overall Vehicle Score')); assert(dom.text.includes('same vehicle class and ±250 lb')); assert(dom.text.includes('Side and rollover stars may be compared across classes'))
    return { case: 'live NHTSA VehicleId safety rating with comparison-scope semantics', state: dom.state, vehicleId: dom.provider, overallRating: dom.overall, scoreMeaning: dom.scoreMeaning, overallFrontalComparisonScope: dom.overallFrontScope, sideRolloverComparisonScope: dom.sideRolloverScope }
  })

  if (shouldRun('singstat-cpi-monthly')) await runLive('singstat-cpi-monthly', async (b, data) => {
    assert(data && data.Data && data.Data.id === 'M213752' && Array.isArray(data.Data.row) && data.Data.row.length === 1)
    const columns = data.Data.row[0].columns
    assert(Array.isArray(columns) && columns.length > 0)
    const latest = columns.map((entry) => ({ key: entry.key, value: Number(entry.value) })).filter((entry) => /^\d{4} [A-Z][a-z]{2}$/.test(entry.key) && Number.isFinite(entry.value)).sort((a, b) => {
      const months = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 }
      const [ay, am] = a.key.split(' '); const [by, bm] = b.key.split(' '); return Number(ay)-Number(by) || months[am]-months[bm]
    }).at(-1)
    assert(latest)
    assert.equal(data.Data.limit, '12'); assert.equal(data.Data.sortBy, 'key desc'); assert.equal(columns.length, 12)
    const dom = await b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="singapore-cpi"]');return {layout:s?.dataset.previewLayout||'',state:c?.dataset.resultState||'',resource:c?.dataset.resourceId||'',bound:c?.dataset.queryBound||'',requestLimit:c?.dataset.requestLimit||'',providerLimit:c?.dataset.providerLimit||'',requestSort:c?.dataset.requestSort||'',providerSort:c?.dataset.providerSort||'',queryContract:c?.dataset.queryContract||'',limitContract:c?.dataset.limitContract||'',orderContract:c?.dataset.orderContract||'',provider:Number(c?.dataset.providerObservationCount||0),valid:Number(c?.dataset.validObservationCount||0),invalid:Number(c?.dataset.invalidObservationCount||0),latestPeriod:c?.dataset.latestPeriod||'',latestValue:Number(c?.dataset.latestValue||0),updated:c?.dataset.providerUpdated||'',text:c?.innerText||''}})()`)
    assert.equal(dom.layout, 'singapore-cpi'); assert.equal(dom.state, 'ready'); assert.equal(dom.resource, 'M213752'); assert.equal(dom.bound, 'true')
    assert.equal(dom.requestLimit, '12'); assert.equal(dom.providerLimit, '12'); assert.equal(dom.requestSort, 'key desc'); assert.equal(dom.providerSort, 'key desc'); assert.equal(dom.queryContract, 'true'); assert.equal(dom.limitContract, 'true'); assert.equal(dom.orderContract, 'true')
    assert.equal(dom.provider, 12); assert.equal(dom.valid, 12); assert.equal(dom.invalid, 0); assert.equal(dom.latestPeriod, latest.key); assert.equal(dom.latestValue, latest.value)
    return { case: 'live official Singapore CPI bounded latest-12 series', state: dom.state, observations: dom.provider, requestedLimit: dom.requestLimit, providerLimit: dom.providerLimit, providerSort: dom.providerSort, queryContract: dom.queryContract, latestPeriod: dom.latestPeriod, latestValue: dom.latestValue, providerUpdated: dom.updated }
  })

  if (shouldRun('openalex-works-search')) await runLive('openalex-works-search', async (b, data) => {
    assert(data && data.meta && Array.isArray(data.results) && data.results.length > 0)
    const first = data.results[0]
    assert.equal(await b.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), openAlexEndpoint)
    const dom = await b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="scholarly-graph"]');return {layout:s?.dataset.previewLayout||'',state:c?.dataset.resultState||'',bound:c?.dataset.requestBound||'',query:c?.dataset.searchQuery||'',limit:Number(c?.dataset.requestLimit||0),total:Number(c?.dataset.providerTotal||0),provider:Number(c?.dataset.providerResultCount||0),valid:Number(c?.dataset.validResultCount||0),invalid:Number(c?.dataset.invalidResultCount||0),duplicates:Number(c?.dataset.duplicateResultCount||0),count:c?.dataset.countContract||'',text:c?.innerText||''}})()`)
    assert.equal(dom.layout, 'scholarly-graph'); assert.equal(dom.state, 'ready'); assert.equal(dom.bound, 'true'); assert.equal(dom.query, 'artificial intelligence'); assert.equal(dom.limit, 8)
    assert.equal(dom.provider, data.results.length); assert.equal(dom.valid, data.results.length); assert.equal(dom.invalid, 0); assert.equal(dom.duplicates, 0); assert.equal(dom.count, 'true'); assert.equal(dom.total, data.meta.count)
    assert.equal(data.meta.per_page, 8); assert.equal(b.requestCount, 1)
    assert(dom.text.includes(first.title)); assert(dom.text.includes(first.cited_by_count.toLocaleString('en')))
    return { case: 'live exact OpenAlex search/per_page request', exactRequest: openAlexEndpoint, state: dom.state, requestBound: dom.bound, returned: dom.provider, providerTotal: dom.total, firstWork: first.id, liveProviderRequests: 1, browserCorsReadable: true }
  })

  if (shouldRun('oecd-cli')) await runLive('oecd-cli', async (b, data) => {
    assert(data && data.data && Array.isArray(data.errors) && data.errors.length === 0)
    const periods = data.data.structure?.dimensions?.observation?.find((dimension) => dimension?.id === 'TIME_PERIOD')?.values?.map((entry) => entry?.id).filter(Boolean) ?? []
    assert(periods.length > 0); assert(periods.every((period) => /^\d{4}-\d{2}$/.test(period) && period >= '2025-01'), `OECD live startPeriod drift: ${periods.join(',')}`)
    const dom = await b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="leading-indicator"]');return {layout:s?.dataset.previewLayout||'',state:c?.dataset.resultState||'',requested:c?.dataset.requestedArea||'',requestedStart:c?.dataset.requestedStartPeriod||'',startContract:c?.dataset.startPeriodContract||'',provider:c?.dataset.providerArea||'',providerName:c?.dataset.providerAreaName||'',bound:c?.dataset.queryBound||'',providerCount:Number(c?.dataset.providerObservationCount||0),valid:Number(c?.dataset.validObservationCount||0),invalid:Number(c?.dataset.invalidObservationCount||0),latestPeriod:c?.dataset.latestPeriod||'',latestValue:Number(c?.dataset.latestValue||0),contract:c?.dataset.dimensionContract||'',text:c?.innerText||''}})()`)
    assert.equal(dom.layout, 'leading-indicator'); assert.equal(dom.state, 'ready'); assert.equal(dom.requested, 'USA'); assert.equal(dom.requestedStart, '2025-01'); assert.equal(dom.startContract, 'true'); assert.equal(dom.provider, 'USA'); assert.equal(dom.bound, 'true'); assert.equal(dom.contract, 'true')
    assert(dom.providerCount > 0); assert.equal(dom.valid, dom.providerCount); assert.equal(dom.invalid, 0); assert(/^\d{4}-\d{2}$/.test(dom.latestPeriod)); assert(Number.isFinite(dom.latestValue))
    return { case: 'live OECD harmonised CLI', state: dom.state, referenceArea: dom.providerName || dom.provider, requestedStartPeriod: dom.requestedStart, startPeriodContract: dom.startContract, observations: dom.providerCount, latestPeriod: dom.latestPeriod, latestValue: dom.latestValue }
  })

  if (shouldRun('oecd-cli')) {
    const oecdFilter = await browser(`${root}/dist`, { fixtures: new Map([[oecdEndpoint, { body: oecdPreStartFixture }]]) })
    try {
      await oecdFilter.nav('oecd-cli')
      const run = await oecdFilter.run()
      assert.equal(run.ok, true, run.error)
      const dom = await oecdFilter.ev(`(()=>{const c=document.querySelector('[data-domain-card="leading-indicator"]');return {state:c?.dataset.resultState||'',requestedStart:c?.dataset.requestedStartPeriod||'',startContract:c?.dataset.startPeriodContract||'',providerCount:Number(c?.dataset.providerObservationCount||0),valid:Number(c?.dataset.validObservationCount||0),invalid:Number(c?.dataset.invalidObservationCount||0),text:c?.innerText||''}})()`)
      assert.equal(dom.state, 'partial'); assert.equal(dom.requestedStart, '2025-01'); assert.equal(dom.startContract, 'false')
      assert.equal(dom.providerCount, 2); assert.equal(dom.valid, 1); assert.equal(dom.invalid, 1)
      assert.equal(dom.text.includes('999.99'), false); assert.equal(dom.text.includes('100.90'), true)
      assert.equal(oecdFilter.fixtureRequests.filter((request) => request.url === oecdEndpoint && request.method === 'GET').length, 1)
      await assertMobileAndA11y(oecdFilter, 'oecd-cli-startPeriod-regression')
      assert.deepEqual(oecdFilter.errors, [])
      report.checks.push({ id: 'oecd-cli', case: 'synthetic HTTP-200 pre-start observation', state: dom.state, requestedStartPeriod: dom.requestedStart, startPeriodContract: dom.startContract, providerObservations: dom.providerCount, trustedObservations: dom.valid, rejectedPreStartObservations: dom.invalid, fabricatedValueHidden: true, mobileOverflow: false, unnamedControls: 0 })
    } finally {
      await oecdFilter.close()
    }
  }
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
}

fs.writeFileSync(`${evidence}/public-api-200-expansion.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/public-api-200-expansion.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
