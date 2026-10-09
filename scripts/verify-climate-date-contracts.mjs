import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live Open-Meteo Historical Weather, Open-Meteo Climate, and NASA POWER Daily API responses plus an exact synthetic NASA numeric-string/fill-value fixture',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())

const setInput = async (b, name, value) => {
  await b.ev(`(() => {
    const input = document.querySelector('input[name=${JSON.stringify(name)}]');
    if (!input) throw Error('missing input: ${name}');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }));
  })()`)
  await sleep(80)
}

const compactToIso = (value) => /^\d{8}$/.test(value)
  ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  : value

const nasaSemanticDom = async (b) => b.ev(`(() => {
  const preview = document.querySelector('.demo-preview');
  const card = preview?.querySelector('[data-domain-card="nasa-power-climate"]');
  const range = [...preview.querySelectorAll('.market-range span')].map((node) => node.textContent || '');
  const label = preview.querySelector('.market-summary > div:first-child > span')?.textContent || '';
  const strong = preview.querySelector('.market-summary strong')?.textContent || '';
  const primary = card?.querySelector('[data-parameter-code="T2M"]');
  const primarySpans = [...(primary?.querySelectorAll(':scope > span') || [])].map((node) => node.textContent || '');
  const metrics = Object.fromEntries([...preview.querySelectorAll('.market-metrics article')].map((node) => [node.querySelector('small')?.textContent || '', node.querySelector('strong')?.textContent || '']));
  return {
    layout: preview?.dataset.previewLayout || '',
    fallback: preview?.dataset.ssotFallback || '',
    state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '',
    requestMethod: card?.dataset.requestMethod || '',
    requestStart: card?.dataset.requestStartDate || '',
    requestEnd: card?.dataset.requestEndDate || '',
    requestParameters: card?.dataset.requestParameters || '',
    providerParameters: Number(card?.dataset.providerParameterCount || 0),
    validParameters: Number(card?.dataset.validParameterCount || 0),
    invalidParameters: Number(card?.dataset.invalidParameterCount || 0),
    validMeasurements: Number(card?.dataset.validMeasurementCount || 0),
    missingMeasurements: Number(card?.dataset.missingMeasurementCount || 0),
    malformedMeasurements: Number(card?.dataset.malformedMeasurementCount || 0),
    fillValue: card?.dataset.fillValue || '',
    parameterIdentityContract: card?.dataset.parameterIdentityContract || '',
    dateAlignmentContract: card?.dataset.dateAlignmentContract || '',
    metadataContract: card?.dataset.metadataContract || '',
    headerRangeContract: card?.dataset.headerRangeContract || '',
    geometryContract: card?.dataset.geometryContract || '',
    providerLongitude: card?.dataset.providerLongitude || '',
    providerLatitude: card?.dataset.providerLatitude || '',
    providerElevation: card?.dataset.providerElevation || '',
    timeStandard: card?.dataset.timeStandard || '',
    apiName: card?.dataset.providerApiName || '',
    apiVersion: card?.dataset.providerApiVersion || '',
    range,
    label,
    strong,
    primaryLongName: primary?.querySelector('strong')?.textContent || '',
    primaryValue: primarySpans[0] || '',
    metrics,
    text: card?.innerText || '',
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
})()`)

let b
let synthetic
try {
  b = await browser(`${root}/dist`)

  await b.nav('open-meteo-history')
  const openMeteoInputs = await b.ev(`({
    startType: document.querySelector('input[name="startDate"]')?.type,
    endType: document.querySelector('input[name="endDate"]')?.type,
    endMin: document.querySelector('input[name="endDate"]')?.min,
  })`)
  assert.deepEqual(openMeteoInputs, { startType: 'date', endType: 'date', endMin: '2025-01-01' })
  await setInput(b, 'startDate', '2026-08-07')
  await setInput(b, 'endDate', '2026-08-03')
  assert.equal(await b.ev(`document.querySelector('input[name="endDate"]')?.min`), '2026-08-07')
  const beforeOpenMeteoInvalidRange = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()`)
  await sleep(150)
  assert.equal(b.requestCount, beforeOpenMeteoInvalidRange, 'Reversed Open-Meteo history range reached provider network')
  assert.equal(await b.ev(`document.querySelector('input[name="endDate"]')?.getAttribute('aria-invalid')`), 'true')
  assert.match(await b.ev(`document.querySelector('#parameter-endDate-help')?.textContent || ''`), /on or after Start date/)
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle')
  await setInput(b, 'startDate', '2026-08-03')
  await setInput(b, 'endDate', '2026-08-07')
  const openMeteoEndpoint = await b.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const openMeteoUrl = new URL(openMeteoEndpoint)
  assert.equal(openMeteoUrl.searchParams.get('start_date'), '2026-08-03')
  assert.equal(openMeteoUrl.searchParams.get('end_date'), '2026-08-07')

  const openMeteo = await b.run()
  assert.equal(openMeteo.ok, true, openMeteo.error)
  assert.equal(openMeteo.data?.daily?.time?.[0], '2026-08-03')
  assert.equal(openMeteo.data?.daily?.time?.at(-1), '2026-08-07')
  const openMeteoDom = await b.ev(`(() => {
    const preview = document.querySelector('.demo-preview');
    const card = preview?.querySelector('[data-domain-card="historical-weather"]');
    const range = [...preview.querySelectorAll('.market-range span')].map((node) => node.textContent || '');
    const strong = preview.querySelector('.market-summary strong')?.textContent || '';
    return {
      layout: preview?.dataset.previewLayout || '',
      state: card?.dataset.resultState || '',
      requestBound: card?.dataset.requestBound || '',
      requestedStart: card?.dataset.requestStartDate || '',
      requestedEnd: card?.dataset.requestEndDate || '',
      requestedDays: Number(card?.dataset.requestDayCount || 0),
      providerDays: Number(card?.dataset.providerDayCount || 0),
      validDays: Number(card?.dataset.validDayCount || 0),
      invalidDays: Number(card?.dataset.invalidDayCount || 0),
      missingMeasurements: Number(card?.dataset.missingMeasurementCount || 0),
      invalidMeasurements: Number(card?.dataset.invalidMeasurementCount || 0),
      dateRangeContract: card?.dataset.dateRangeContract || '',
      arrayLengthContract: card?.dataset.arrayLengthContract || '',
      unitContract: card?.dataset.unitContract || '',
      providerLatitude: Number(card?.dataset.providerLatitude),
      providerLongitude: Number(card?.dataset.providerLongitude),
      timezone: card?.dataset.timezone || '',
      utcOffsetSeconds: Number(card?.dataset.utcOffsetSeconds),
      range,
      strong,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  })()`)
  assert.equal(openMeteoDom.layout, 'historical-weather')
  assert.equal(openMeteoDom.state, 'ready')
  assert.equal(openMeteoDom.requestBound, 'true')
  assert.equal(openMeteoDom.requestedStart, '2026-08-03')
  assert.equal(openMeteoDom.requestedEnd, '2026-08-07')
  assert.equal(openMeteoDom.requestedDays, 5)
  assert.equal(openMeteoDom.providerDays, 5)
  assert.equal(openMeteoDom.validDays, 5)
  assert.equal(openMeteoDom.invalidDays, 0)
  assert.equal(openMeteoDom.missingMeasurements, 0)
  assert.equal(openMeteoDom.invalidMeasurements, 0)
  assert.equal(openMeteoDom.dateRangeContract, 'true')
  assert.equal(openMeteoDom.arrayLengthContract, 'true')
  assert.equal(openMeteoDom.unitContract, 'true')
  assert.equal(openMeteoDom.providerLatitude, openMeteo.data.latitude)
  assert.equal(openMeteoDom.providerLongitude, openMeteo.data.longitude)
  assert.equal(openMeteoDom.timezone, openMeteo.data.timezone)
  assert.equal(openMeteoDom.utcOffsetSeconds, openMeteo.data.utc_offset_seconds)
  assert.deepEqual(openMeteoDom.range, ['2026-08-03', '2026-08-07'])
  assert.equal(Number(openMeteoDom.strong.replace(/[^0-9.-]/g, '')), Number(openMeteo.data.daily.temperature_2m_max.at(-1)))
  assert.equal(openMeteoDom.overflow, false)
  await b.viewport(390, 844)
  let mobile = await b.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
  })`)
  if (mobile.previewOverflow) {
    const overflowDetails = await b.ev(`(() => {
      const preview = document.querySelector('.demo-preview');
      return [...preview.querySelectorAll('*')].map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, className: typeof element.className === 'string' ? element.className : '', scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, left: rect.left, right: rect.right, width: rect.width, text: (element.textContent || '').trim().slice(0, 80) };
      }).filter((entry) => entry.scrollWidth > entry.clientWidth + 1 || entry.right > innerWidth + 0.5 || entry.left < -0.5).slice(0, 30);
    })()`);
    console.log(JSON.stringify({ openMeteoMobileOverflowDetails: overflowDetails }, null, 2));
  }
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  let ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({
    id: 'open-meteo-history',
    nativeDateInputs: true,
    wireFormat: 'YYYY-MM-DD',
    state: openMeteoDom.state,
    requestBound: true,
    providerReturnedRange: [openMeteo.data.daily.time[0], openMeteo.data.daily.time.at(-1)],
    providerDays: openMeteoDom.providerDays,
    semanticRangeMatches: true,
    arrayLengthContract: true,
    unitContract: true,
    providerGrid: [openMeteo.data.latitude, openMeteo.data.longitude],
    timezone: openMeteo.data.timezone,
    mobileOverflow: false,
    unnamedControls: 0,
  })
  await b.viewport(1440, 1000)
  await b.nav('nasa-power-climate')
  const nasaInputs = await b.ev(`({
    startType: document.querySelector('input[name="startDate"]')?.type,
    endType: document.querySelector('input[name="endDate"]')?.type,
  })`)
  assert.deepEqual(nasaInputs, { startType: 'date', endType: 'date' })
  await setInput(b, 'parameters', '')
  const beforeInvalidNasaParameters = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()`)
  await sleep(150)
  assert.equal(b.requestCount, beforeInvalidNasaParameters, 'Blank NASA POWER parameters reached provider network')
  assert.equal(await b.ev(`document.querySelector('input[name="parameters"]')?.getAttribute('aria-invalid')`), 'true')
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle')
  await setInput(b, 'parameters', 'T2M,PRECTOTCORR,WS10M,RH2M,ALLSKY_SFC_SW_DWN')
  await setInput(b, 'startDate', '2026-08-03')
  await setInput(b, 'endDate', '2026-08-07')
  const nasaEndpoint = await b.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const nasaUrl = new URL(nasaEndpoint)
  assert.equal(nasaUrl.searchParams.get('start'), '20260803')
  assert.equal(nasaUrl.searchParams.get('end'), '20260807')

  const nasa = await b.run()
  assert.equal(nasa.ok, true, nasa.error)
  assert.equal(nasa.data?.header?.start, '20260803')
  assert.equal(nasa.data?.header?.end, '20260807')
  const t2m = nasa.data?.properties?.parameter?.T2M
  assert.equal(typeof t2m, 'object')
  const nasaDates = Object.keys(t2m || {})
  assert.equal(nasaDates[0], '20260803')
  assert.equal(nasaDates.at(-1), '20260807')
  const nasaLatest = Number(t2m[nasaDates.at(-1)])
  assert(Number.isFinite(nasaLatest))
  const nasaMetadata = nasa.data?.parameters?.T2M
  assert.equal(typeof nasaMetadata?.longname, 'string')
  assert.equal(typeof nasaMetadata?.units, 'string')

  const nasaDom = await nasaSemanticDom(b)
  const nasaParameterCodes = nasaUrl.searchParams.get('parameters').split(',')
  const nasaMeasurementCount = nasaParameterCodes.length * nasaDates.length
  assert.equal(nasaDom.layout, 'climate-series')
  assert.equal(nasaDom.fallback, 'false')
  assert.equal(nasaDom.state, 'ready')
  assert.equal(nasaDom.requestBound, 'true')
  assert.equal(nasaDom.requestMethod, 'GET')
  assert.equal(nasaDom.requestStart, '2026-08-03')
  assert.equal(nasaDom.requestEnd, '2026-08-07')
  assert.equal(nasaDom.requestParameters, nasaParameterCodes.join(','))
  assert.equal(nasaDom.providerParameters, nasaParameterCodes.length)
  assert.equal(nasaDom.validParameters, nasaParameterCodes.length)
  assert.equal(nasaDom.invalidParameters, 0)
  assert.equal(nasaDom.validMeasurements, nasaMeasurementCount)
  assert.equal(nasaDom.missingMeasurements, 0)
  assert.equal(nasaDom.malformedMeasurements, 0)
  assert.equal(Number(nasaDom.fillValue), nasa.data.header.fill_value)
  assert.equal(nasaDom.parameterIdentityContract, 'true')
  assert.equal(nasaDom.dateAlignmentContract, 'true')
  assert.equal(nasaDom.metadataContract, 'true')
  assert.equal(nasaDom.headerRangeContract, 'true')
  assert.equal(nasaDom.geometryContract, 'true')
  assert.equal(Number(nasaDom.providerLongitude), nasa.data.geometry.coordinates[0])
  assert.equal(Number(nasaDom.providerLatitude), nasa.data.geometry.coordinates[1])
  assert.equal(Number(nasaDom.providerElevation), nasa.data.geometry.coordinates[2])
  assert.equal(nasaDom.timeStandard, nasa.data.header.time_standard)
  assert.equal(nasaDom.apiName, nasa.data.header.api.name)
  assert.equal(nasaDom.apiVersion, nasa.data.header.api.version)
  assert.deepEqual(nasaDom.range, [compactToIso(nasaDates[0]), compactToIso(nasaDates.at(-1))])
  assert.equal(nasaDom.primaryLongName, nasaMetadata.longname)
  assert.equal(Number(nasaDom.primaryValue.replace(nasaMetadata.units, '').trim()), nasaLatest)
  assert.equal(nasaDom.overflow, false)

  await b.viewport(390, 844)
  mobile = await b.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
  })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({
    id: 'nasa-power-climate',
    nativeDateInputs: true,
    humanDateFormat: 'YYYY-MM-DD',
    providerWireFormat: 'YYYYMMDD',
    providerHeaderRange: [nasa.data.header.start, nasa.data.header.end],
    responseShape: 'properties.parameter.<code>.<YYYYMMDD>',
    semanticState: nasaDom.state,
    requestBound: true,
    parameterIdentityContract: true,
    dateAlignmentContract: true,
    metadataContract: true,
    geometryContract: true,
    providerGrid: nasa.data.geometry.coordinates,
    timeStandard: nasa.data.header.time_standard,
    measurements: nasaDom.validMeasurements,
    semanticSeriesMatches: true,
    semanticMetadataJoin: true,
    mobileOverflow: false,
    unnamedControls: 0,
  })

  await b.viewport(1440, 1000)
  await b.nav('open-meteo-climate')
  const climateModelContract = await b.ev(`(() => {
    const select = document.querySelector('select[name="model"]');
    return {
      value: select?.value || '',
      options: [...(select?.options || [])].map((option) => option.value),
    };
  })()`)
  assert.deepEqual(climateModelContract, {
    value: 'CMCC_CM2_VHR4',
    options: ['CMCC_CM2_VHR4', 'FGOALS_f3_H', 'HiRAM_SIT_HR', 'MRI_AGCM3_2_S', 'EC_Earth3P_HR', 'MPI_ESM1_2_XR', 'NICAM16_8S'],
  })
  assert.equal(await b.ev(`document.querySelector('input[name="endYear"]')?.min`), '2020')
  await setInput(b, 'startYear', '2030')
  await setInput(b, 'endYear', '2020')
  assert.equal(await b.ev(`document.querySelector('input[name="endYear"]')?.min`), '2030')
  const beforeClimateInvalidRange = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()`)
  await sleep(150)
  assert.equal(b.requestCount, beforeClimateInvalidRange, 'Reversed Open-Meteo Climate year range reached provider network')
  assert.equal(await b.ev(`document.querySelector('input[name="endYear"]')?.getAttribute('aria-invalid')`), 'true')
  assert.match(await b.ev(`document.querySelector('#parameter-endYear-help')?.textContent || ''`), /greater than or equal to Start year/)
  assert.equal(await b.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle')
  await setInput(b, 'startYear', '2025')
  await setInput(b, 'endYear', '2025')
  await b.ev(`(() => {
    const select = document.querySelector('select[name="model"]');
    select.value = 'MPI_ESM1_2_XR';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
  await sleep(80)
  const climateEndpoint = await b.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const climateUrl = new URL(climateEndpoint)
  assert.equal(climateUrl.searchParams.get('models'), 'MPI_ESM1_2_XR')
  assert.equal(climateUrl.searchParams.get('start_date'), '2025-01-01')
  assert.equal(climateUrl.searchParams.get('end_date'), '2025-12-31')

  const climate = await b.run()
  assert.equal(climate.ok, true, climate.error)
  assert.equal(climate.data?.daily?.time?.[0], '2025-01-01')
  assert.equal(climate.data?.daily?.time?.at(-1), '2025-12-31')
  const climateTemps = climate.data?.daily?.temperature_2m_mean || []
  const climatePrecipitation = climate.data?.daily?.precipitation_sum || []
  assert.equal(climateTemps.length, climate.data.daily.time.length)
  assert.equal(climatePrecipitation.length, climate.data.daily.time.length)
  assert(climateTemps.every((value) => typeof value === 'number' && Number.isFinite(value)))
  assert(climatePrecipitation.every((value) => typeof value === 'number' && Number.isFinite(value)))
  assert.deepEqual(climate.data?.daily_units, { time: 'iso8601', temperature_2m_mean: '°C', precipitation_sum: 'mm' })
  assert(Number.isFinite(climate.data?.latitude))
  assert(Number.isFinite(climate.data?.longitude))
  const climateDom = await b.ev(`(() => {
    const preview = document.querySelector('.demo-preview');
    const card = preview?.querySelector('[data-domain-card="climate-projection"]');
    return {
      layout: preview?.dataset.previewLayout || '',
      model: card?.dataset.primaryModel || '',
      requestBound: card?.dataset.requestBound || '',
      requestedStart: card?.dataset.requestStart || '',
      requestedEnd: card?.dataset.requestEnd || '',
      start: card?.dataset.periodStart || '',
      end: card?.dataset.periodEnd || '',
      count: Number(card?.dataset.observationCount || 0),
      providerCount: Number(card?.dataset.providerRecordCount || 0),
      invalidCount: Number(card?.dataset.invalidRecordCount || 0),
      dateRangeContract: card?.dataset.dateRangeContract || '',
      arrayLengthContract: card?.dataset.arrayLengthContract || '',
      dailyCadenceContract: card?.dataset.dailyCadenceContract || '',
      unitContract: card?.dataset.unitContract || '',
      providerLatitude: Number(card?.dataset.providerLatitude),
      providerLongitude: Number(card?.dataset.providerLongitude),
      resultState: card?.dataset.resultState || '',
      text: card?.textContent || '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  })()`)
  assert.equal(climateDom.layout, 'market-chart')
  assert.equal(climateDom.model, 'MPI_ESM1_2_XR')
  assert.equal(climateDom.requestBound, 'true')
  assert.equal(climateDom.requestedStart, '2025-01-01')
  assert.equal(climateDom.requestedEnd, '2025-12-31')
  assert.equal(climateDom.start, '2025-01-01')
  assert.equal(climateDom.end, '2025-12-31')
  assert.equal(climateDom.count, climate.data.daily.time.length)
  assert.equal(climateDom.providerCount, climate.data.daily.time.length)
  assert.equal(climateDom.invalidCount, 0)
  assert.equal(climateDom.dateRangeContract, 'true')
  assert.equal(climateDom.arrayLengthContract, 'true')
  assert.equal(climateDom.dailyCadenceContract, 'true')
  assert.equal(climateDom.unitContract, 'true')
  assert.equal(climateDom.providerLatitude, climate.data.latitude)
  assert.equal(climateDom.providerLongitude, climate.data.longitude)
  assert.equal(climateDom.resultState, 'ready')
  assert.match(climateDom.text, /ModelMPI_ESM1_2_XR/)
  assert.match(climateDom.text, /Returned days365/)
  assert.equal(climateDom.overflow, false)

  await b.viewport(390, 844)
  mobile = await b.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
  })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({
    id: 'open-meteo-climate',
    documentedModelOptions: climateModelContract.options,
    selectedModel: 'MPI_ESM1_2_XR',
    providerReturnedRange: [climate.data.daily.time[0], climate.data.daily.time.at(-1)],
    semanticModelMatchesRequest: true,
    semanticDateRangeMatchesRequest: true,
    semanticArrayLengthsMatch: true,
    semanticDailyCadenceMatches: true,
    semanticUnitsMatch: true,
    semanticSeriesMatches: true,
    mobileOverflow: false,
    unnamedControls: 0,
  })

  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])

  await b.close()
  b = undefined

  const nasaFixture = structuredClone(nasa.data)
  nasaFixture.properties.parameter.T2M[nasaDates[0]] = '999.99'
  nasaFixture.properties.parameter.T2M[nasaDates[1]] = nasaFixture.header.fill_value
  synthetic = await browser(`${root}/dist`, { fixtures: new Map([[nasaEndpoint, { body: nasaFixture }]]) })
  await synthetic.nav('nasa-power-climate')
  await setInput(synthetic, 'startDate', '2026-08-03')
  await setInput(synthetic, 'endDate', '2026-08-07')
  const syntheticEndpoint = await synthetic.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(syntheticEndpoint, nasaEndpoint)
  const syntheticRun = await synthetic.run()
  assert.equal(syntheticRun.ok, true, syntheticRun.error)
  const syntheticDom = await nasaSemanticDom(synthetic)
  assert.equal(syntheticDom.state, 'partial')
  assert.equal(syntheticDom.validMeasurements, nasaMeasurementCount - 2)
  assert.equal(syntheticDom.missingMeasurements, 1)
  assert.equal(syntheticDom.malformedMeasurements, 1)
  assert.equal(syntheticDom.text.includes('999.99'), false)
  assert.equal(syntheticDom.text.includes(String(nasaFixture.header.fill_value)), false)
  assert.equal(synthetic.fixtureRequests.filter((request) => request.url === nasaEndpoint && request.method === 'GET').length, 1)
  assert.deepEqual(synthetic.errors, [])
  report.checks.push({
    id: 'nasa-power-climate',
    case: 'synthetic numeric-string and fill-value HTTP-200',
    transportStatus: 200,
    semanticState: 'partial',
    validMeasurements: nasaMeasurementCount - 2,
    missingMeasurements: 1,
    malformedMeasurements: 1,
    fabricatedMeasurementsHidden: true,
    exactProviderFixtureRequests: 1,
  })
  await synthetic.close()
  synthetic = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
  if (synthetic) report.errors.push(...synthetic.errors.map(String))
} finally {
  if (b) await b.close()
  if (synthetic) await synthetic.close()
}

fs.writeFileSync(`${evidence}/climate-date-contracts.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/climate-date-contracts.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
