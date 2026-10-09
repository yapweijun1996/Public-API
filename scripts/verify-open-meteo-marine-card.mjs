import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const hourlyVariables = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'sea_surface_temperature',
  'ocean_current_velocity',
  'ocean_current_direction',
]
const endpoint = `https://marine-api.open-meteo.com/v1/marine?${new URLSearchParams({
  latitude: '1.3521',
  longitude: '103.8198',
  hourly: hourlyVariables.join(','),
  timezone: 'auto',
  forecast_days: '3',
}).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'native integer-input validation, one live Open-Meteo marine forecast, plus an exact synthetic HTTP-200 numeric-string regression',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const expectedUnits = {
  time: 'iso8601',
  wave_height: 'm',
  wave_direction: '°',
  wave_period: 's',
  sea_surface_temperature: '°C',
  ocean_current_velocity: 'km/h',
  ocean_current_direction: '°',
}

let live
try {
  live = await browser(`${root}/dist`)
  await live.nav('open-meteo-marine')
  const daysContract = await live.ev(`(() => {
    const days = document.querySelector('#parameter-days')
    return { step: days?.getAttribute('step') || '', min: days?.getAttribute('min') || '', max: days?.getAttribute('max') || '' }
  })()` )
  assert.deepEqual(daysContract, { step: '1', min: '1', max: '7' })
  const beforeInvalidHumanInput = live.requestCount
  const invalidHumanInput = await live.ev(`(() => {
    const days = document.querySelector('#parameter-days')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(days, '3.5')
    days.dispatchEvent(new Event('input', { bubbles: true }))
    days.dispatchEvent(new Event('change', { bubbles: true }))
    return { valid: days.checkValidity(), stepMismatch: days.validity.stepMismatch }
  })()` )
  assert.deepEqual(invalidHumanInput, { valid: false, stepMismatch: true })
  await live.ev(`document.querySelector('form.parameter-card').requestSubmit()` )
  await sleep(150)
  assert.equal(live.requestCount, beforeInvalidHumanInput, 'Fractional Open-Meteo Marine forecast days reached a provider request')
  await live.ev(`(() => {
    const days = document.querySelector('#parameter-days')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(days, '3')
    days.dispatchEvent(new Event('input', { bubbles: true }))
    days.dispatchEvent(new Event('change', { bubbles: true }))
  })()` )
  await sleep(100)
  report.checks.push({ id: 'open-meteo-marine', case: 'native integer forecast-days contract', step: 1, min: 1, max: 7, fractionalDaysRejected: true, providerRequests: 0 })
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  const response = result.data
  assert(response && typeof response === 'object' && !Array.isArray(response), 'Open-Meteo live response is not an object')
  assert.equal(typeof response.latitude, 'number')
  assert.equal(typeof response.longitude, 'number')
  assert.equal(typeof response.timezone, 'string')
  assert.equal(Number.isInteger(response.utc_offset_seconds), true)
  assert.deepEqual(Object.fromEntries(Object.keys(expectedUnits).map((key) => [key, response.hourly_units?.[key]])), expectedUnits)
  assert(Array.isArray(response.hourly?.time), 'Open-Meteo live response is missing hourly.time[]')
  assert.equal(response.hourly.time.length, 72)
  for (const variable of hourlyVariables) {
    assert(Array.isArray(response.hourly[variable]), `Open-Meteo live response is missing hourly.${variable}[]`)
    assert.equal(response.hourly[variable].length, response.hourly.time.length)
    assert(response.hourly[variable].every((value) => typeof value === 'number' && Number.isFinite(value)), `Open-Meteo live ${variable} contains a missing or non-number value`)
  }

  const dom = await live.ev(`(() => {
    const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="marine-forecast"]')
    return {
      layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
      requestBound:card?.dataset.requestBound||'', requestLatitude:card?.dataset.requestLatitude||'', requestLongitude:card?.dataset.requestLongitude||'', requestDays:card?.dataset.requestForecastDays||'',
      providerLatitude:card?.dataset.providerLatitude||'', providerLongitude:card?.dataset.providerLongitude||'', timezone:card?.dataset.timezone||'', offset:card?.dataset.utcOffsetSeconds||'',
      providerHours:card?.dataset.providerHourCount||'', validHours:card?.dataset.validHourCount||'', invalidHours:card?.dataset.invalidHourCount||'', missing:card?.dataset.missingMeasurementCount||'', invalid:card?.dataset.invalidMeasurementCount||'',
      arrays:card?.dataset.arrayLengthContract||'', units:card?.dataset.unitContract||'', time:card?.dataset.timeContract||'', cadence:card?.dataset.cadenceContract||'', horizon:card?.dataset.horizonContract||'',
      waveDirection:card?.dataset.waveDirectionSemantics||'', currentDirection:card?.dataset.currentDirectionSemantics||'', primaryTime:card?.dataset.primaryTime||'', primaryWaveHeight:card?.dataset.primaryWaveHeight||'', text:card?.innerText||'',
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
    }
  })()`)
  assert.equal(dom.layout, 'marine-forecast'); assert.equal(dom.fallback, 'false'); assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true'); assert.equal(dom.requestLatitude, '1.3521'); assert.equal(dom.requestLongitude, '103.8198'); assert.equal(dom.requestDays, '3')
  assert.equal(Number(dom.providerLatitude), response.latitude); assert.equal(Number(dom.providerLongitude), response.longitude)
  assert.equal(dom.timezone, response.timezone); assert.equal(Number(dom.offset), response.utc_offset_seconds)
  assert.equal(dom.providerHours, '72'); assert.equal(dom.validHours, '72'); assert.equal(dom.invalidHours, '0'); assert.equal(dom.missing, '0'); assert.equal(dom.invalid, '0')
  assert.equal(dom.arrays, 'true'); assert.equal(dom.units, 'true'); assert.equal(dom.time, 'true'); assert.equal(dom.cadence, 'true'); assert.equal(dom.horizon, 'true')
  assert.equal(dom.waveDirection, 'from'); assert.equal(dom.currentDirection, 'toward'); assert.equal(dom.overflow, false)
  const primaryIndex = response.hourly.time.indexOf(dom.primaryTime)
  assert(primaryIndex >= 0, 'Primary marine hour is not present in the provider response')
  assert.equal(Number(dom.primaryWaveHeight), response.hourly.wave_height[primaryIndex])
  assert.match(dom.text, /° from/); assert.match(dom.text, /° toward/)
  await live.viewport(390, 844)
  const mobile = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'open-meteo-marine', case: 'live three-day hourly marine forecast', semanticState: 'ready', providerHours: response.hourly.time.length, rawToDomIdentity: 'request, provider grid, timezone, counts, primary hour and wave height exact', mobileOverflow: false, unnamedControls: 0 })
  await live.close(); live = undefined

  const times = Array.from({ length: 72 }, (_, index) => new Date(Date.UTC(2026, 8, 15, index)).toISOString().slice(0, 16))
  const values = (value) => Array.from({ length: 72 }, () => value)
  const numericStrings = values(0.82); numericStrings[14] = '9.99'
  const fixture = {
    latitude: 1.375,
    longitude: 103.875,
    utc_offset_seconds: 28800,
    timezone: 'Asia/Singapore',
    hourly_units: expectedUnits,
    hourly: {
      time: times,
      wave_height: numericStrings,
      wave_direction: values(95),
      wave_period: values(7.4),
      sea_surface_temperature: values(29.1),
      ocean_current_velocity: values(0.4),
      ocean_current_direction: values(130),
    },
  }
  const synthetic = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixture }]]) })
  try {
    await synthetic.nav('open-meteo-marine')
    const run = await synthetic.run()
    assert.equal(run.ok, true, run.error)
    const semantic = await synthetic.ev(`(() => { const c=document.querySelector('[data-domain-card="marine-forecast"]'); return {state:c?.dataset.resultState||'',invalid:c?.dataset.invalidMeasurementCount||'',validHours:c?.dataset.validHourCount||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''} })()`)
    assert.equal(semantic.state, 'partial'); assert.equal(semantic.invalid, '1'); assert.equal(semantic.validHours, '71')
    assert.equal(semantic.text.includes('9.99'), false); assert.match(semantic.http, /^200/)
    assert.equal(synthetic.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(synthetic.errors, [])
    report.checks.push({ id: 'open-meteo-marine', case: 'synthetic numeric-string measurement HTTP-200', transportStatus: 200, semanticState: 'partial', invalidMeasurements: 1, trustedHours: 71, fabricatedMeasurementHidden: true, exactProviderFixtureRequests: 1 })
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

fs.writeFileSync(`${evidence}/open-meteo-marine-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/open-meteo-marine-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
