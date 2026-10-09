import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const model = 'icon_seamless_eps'
const variable = 'temperature_2m'
const unit = '°C'
const perturbedKeys = Array.from({ length: 39 }, (_, index) => `${variable}_member${String(index + 1).padStart(2, '0')}`)
const measurementKeys = [variable, ...perturbedKeys]
const expectedEndpoint = `https://ensemble-api.open-meteo.com/v1/ensemble?${new URLSearchParams({
  latitude: '1.3521',
  longitude: '103.8198',
  models: model,
  hourly: variable,
  forecast_days: '1',
  timezone: 'Asia/Singapore',
}).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Open-Meteo Ensemble request plus one exact synthetic malformed HTTP-200 response',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())

const setForecastDays = async (b, value) => {
  await b.ev(`(() => {
    const input = document.querySelector('input[name="forecastDays"]');
    if (!input) throw Error('Missing forecastDays input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }));
  })()`)
  await sleep(80)
}

const semanticDom = async (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview');
  const card = shell?.querySelector('[data-domain-card="ensemble-forecast"]');
  return {
    layout: shell?.dataset.previewLayout || '',
    fallback: shell?.dataset.ssotFallback || '',
    state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '',
    method: card?.dataset.requestMethod || '',
    model: card?.dataset.requestModel || '',
    variable: card?.dataset.requestVariable || '',
    days: card?.dataset.requestForecastDays || '',
    requestLatitude: card?.dataset.requestLatitude || '',
    requestLongitude: card?.dataset.requestLongitude || '',
    providerLatitude: card?.dataset.providerLatitude || '',
    providerLongitude: card?.dataset.providerLongitude || '',
    timezone: card?.dataset.timezone || '',
    offset: card?.dataset.utcOffsetSeconds || '',
    unit: card?.dataset.unit || '',
    forecasts: card?.dataset.forecastMemberCount || '',
    perturbed: card?.dataset.perturbedMemberCount || '',
    providerHours: card?.dataset.providerHourCount || '',
    validHours: card?.dataset.validHourCount || '',
    invalidHours: card?.dataset.invalidHourCount || '',
    missing: card?.dataset.missingMeasurementCount || '',
    invalid: card?.dataset.invalidMeasurementCount || '',
    members: card?.dataset.memberIdentityContract || '',
    arrays: card?.dataset.arrayLengthContract || '',
    units: card?.dataset.unitContract || '',
    time: card?.dataset.timeContract || '',
    cadence: card?.dataset.cadenceContract || '',
    horizon: card?.dataset.horizonContract || '',
    primaryTime: card?.dataset.primaryTime || '',
    primaryControl: card?.dataset.primaryControl || '',
    primaryMinimum: card?.dataset.primarySpreadMin || '',
    primaryMaximum: card?.dataset.primarySpreadMax || '',
    text: card?.innerText || '',
    http: document.querySelector('.ssot-runtime b')?.textContent || '',
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
})()`)

let live
try {
  live = await browser(`${root}/dist`)
  await live.nav('open-meteo-ensemble')
  const fieldContract = await live.ev(`(() => {
    const input = document.querySelector('input[name="forecastDays"]');
    return { min: input?.min, max: input?.max, step: input?.step };
  })()`);
  assert.deepEqual(fieldContract, { min: '1', max: '7', step: '1' })
  const requestsBeforeFractional = live.requestCount
  await setForecastDays(live, '3.5')
  await live.ev(`document.querySelector('form.parameter-card')?.requestSubmit()`);
  await live.wait(`document.querySelector('input[name="forecastDays"]')?.getAttribute('aria-invalid') === 'true'`)
  await sleep(120)
  assert.equal(live.requestCount, requestsBeforeFractional, 'Fractional forecastDays reached the provider')
  assert.equal(await live.ev(`document.querySelector('.request-lab')?.dataset.requestState`), 'idle')
  report.checks.push({
    id: 'open-meteo-ensemble',
    case: 'fractional forecast-day input rejected before provider execution',
    fieldContract,
    invalidValue: '3.5',
    providerRequests: 0,
  })
  await setForecastDays(live, '1')
  const endpoint = await live.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(endpoint, expectedEndpoint)
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  const response = result.data
  assert(response && typeof response === 'object' && !Array.isArray(response), 'Live Ensemble response is not an object')
  assert.equal(typeof response.latitude, 'number')
  assert.equal(typeof response.longitude, 'number')
  assert.equal(response.timezone, 'Asia/Singapore')
  assert.equal(Number.isInteger(response.utc_offset_seconds), true)
  assert.deepEqual(Object.keys(response.hourly || {}).sort(), ['time', ...measurementKeys].sort())
  assert.deepEqual(Object.keys(response.hourly_units || {}).sort(), ['time', ...measurementKeys].sort())
  assert.equal(response.hourly_units.time, 'iso8601')
  assert(Array.isArray(response.hourly.time), 'Live Ensemble response is missing hourly.time[]')
  assert.equal(response.hourly.time.length, 24)
  for (const key of measurementKeys) {
    assert.equal(response.hourly_units[key], unit, `Unexpected live unit for ${key}`)
    assert(Array.isArray(response.hourly[key]), `Live Ensemble response is missing hourly.${key}[]`)
    assert.equal(response.hourly[key].length, 24, `Live Ensemble ${key} is not aligned to 24 hours`)
    assert(response.hourly[key].every((value) => typeof value === 'number' && Number.isFinite(value)), `Live Ensemble ${key} contains a missing or non-number value`)
  }

  const dom = await semanticDom(live)
  assert.equal(dom.layout, 'ensemble-forecast')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.method, 'GET')
  assert.equal(dom.model, model)
  assert.equal(dom.variable, variable)
  assert.equal(dom.days, '1')
  assert.equal(dom.requestLatitude, '1.3521')
  assert.equal(dom.requestLongitude, '103.8198')
  assert.equal(Number(dom.providerLatitude), response.latitude)
  assert.equal(Number(dom.providerLongitude), response.longitude)
  assert.equal(dom.timezone, response.timezone)
  assert.equal(Number(dom.offset), response.utc_offset_seconds)
  assert.equal(dom.unit, unit)
  assert.equal(dom.forecasts, '40')
  assert.equal(dom.perturbed, '39')
  assert.equal(dom.providerHours, '24')
  assert.equal(dom.validHours, '24')
  assert.equal(dom.invalidHours, '0')
  assert.equal(dom.missing, '0')
  assert.equal(dom.invalid, '0')
  assert.equal(dom.members, 'true')
  assert.equal(dom.arrays, 'true')
  assert.equal(dom.units, 'true')
  assert.equal(dom.time, 'true')
  assert.equal(dom.cadence, 'true')
  assert.equal(dom.horizon, 'true')
  assert.match(dom.http, /^200/)
  assert.equal(dom.overflow, false)

  const primaryIndex = response.hourly.time.indexOf(dom.primaryTime)
  assert(primaryIndex >= 0, 'Primary semantic hour is absent from the live response')
  const primaryValues = measurementKeys.map((key) => response.hourly[key][primaryIndex])
  assert.equal(Number(dom.primaryControl), response.hourly[variable][primaryIndex])
  assert.equal(Number(dom.primaryMinimum), Math.min(...primaryValues))
  assert.equal(Number(dom.primaryMaximum), Math.max(...primaryValues))
  assert.match(dom.text, /1 control \+ 39 perturbed/)

  await live.viewport(390, 844)
  const mobile = await live.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
  })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  const ensembleFailures = live.networkFailures.filter((failure) => failure.url.startsWith('https://ensemble-api.open-meteo.com/'))
  assert.deepEqual(ensembleFailures, [])
  report.checks.push({
    id: 'open-meteo-ensemble',
    case: 'live one-day ICON seamless EPS temperature forecast',
    transportStatus: 200,
    browserCors: 'PASS',
    semanticState: 'ready',
    providerHours: 24,
    forecastMembers: 40,
    rawToDomIdentity: 'request, provider grid, timezone, units, counts, primary control and full-member spread exact',
    mobileOverflow: false,
    unnamedControls: 0,
  })
  await live.close()
  live = undefined

  const times = Array.from({ length: 24 }, (_, index) => `2026-09-15T${String(index).padStart(2, '0')}:00`)
  const values = (value) => Array.from({ length: 24 }, () => value)
  const malformed = values(31)
  malformed[23] = '999.9'
  const fixture = {
    latitude: 1.5,
    longitude: 103.75,
    utc_offset_seconds: 28800,
    timezone: 'Asia/Singapore',
    hourly_units: { time: 'iso8601', ...Object.fromEntries(measurementKeys.map((key) => [key, unit])) },
    hourly: {
      time: times,
      [variable]: values(30),
      ...Object.fromEntries(perturbedKeys.map((key) => [key, key.endsWith('39') ? malformed : values(29)])),
    },
  }
  const synthetic = await browser(`${root}/dist`, { fixtures: new Map([[expectedEndpoint, { body: fixture }]]) })
  try {
    await synthetic.nav('open-meteo-ensemble')
    await setForecastDays(synthetic, '1')
    const run = await synthetic.run()
    assert.equal(run.ok, true, run.error)
    const semantic = await semanticDom(synthetic)
    assert.equal(semantic.state, 'partial')
    assert.equal(semantic.invalid, '1')
    assert.equal(semantic.validHours, '23')
    assert.equal(semantic.text.includes('999.9'), false)
    assert.match(semantic.http, /^200/)
    assert.equal(synthetic.fixtureRequests.filter((request) => request.url === expectedEndpoint && request.method === 'GET').length, 1)
    assert.deepEqual(synthetic.errors, [])
    report.checks.push({
      id: 'open-meteo-ensemble',
      case: 'synthetic numeric-string member measurement HTTP-200',
      transportStatus: 200,
      semanticState: 'partial',
      invalidMeasurements: 1,
      trustedHours: 23,
      fabricatedMeasurementHidden: true,
      exactProviderFixtureRequests: 1,
    })
  } finally {
    await synthetic.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (live) report.errors.push(...live.errors.map(String))
} finally {
  if (live) await live.close()
}

fs.writeFileSync(`${evidence}/open-meteo-ensemble-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/open-meteo-ensemble-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
