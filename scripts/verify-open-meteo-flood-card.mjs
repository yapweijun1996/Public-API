import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const dailyVariables = ['river_discharge', 'river_discharge_mean', 'river_discharge_max']
const endpoint = `https://flood-api.open-meteo.com/v1/flood?${new URLSearchParams({
  latitude: '1.3521',
  longitude: '103.8198',
  daily: dailyVariables.join(','),
  forecast_days: '7',
}).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'native integer-input validation plus one live Open-Meteo flood forecast',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const expectedUnits = {
  time: 'iso8601',
  river_discharge: 'm³/s',
  river_discharge_mean: 'm³/s',
  river_discharge_max: 'm³/s',
}

let live
try {
  live = await browser(`${root}/dist`)
  await live.nav('open-meteo-flood')

  const daysContract = await live.ev(`(() => {
    const days = document.querySelector('#parameter-days')
    return { step: days?.getAttribute('step') || '', min: days?.getAttribute('min') || '', max: days?.getAttribute('max') || '' }
  })()`)
  assert.deepEqual(daysContract, { step: '1', min: '1', max: '30' })

  const beforeInvalidHumanInput = live.requestCount
  const invalidHumanInput = await live.ev(`(() => {
    const days = document.querySelector('#parameter-days')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(days, '7.5')
    days.dispatchEvent(new Event('input', { bubbles: true }))
    days.dispatchEvent(new Event('change', { bubbles: true }))
    return { valid: days.checkValidity(), stepMismatch: days.validity.stepMismatch }
  })()`)
  assert.deepEqual(invalidHumanInput, { valid: false, stepMismatch: true })
  await live.ev(`document.querySelector('form.parameter-card').requestSubmit()`)
  await sleep(150)
  assert.equal(live.requestCount, beforeInvalidHumanInput, 'Fractional Open-Meteo Flood forecast days reached a provider request')

  await live.ev(`(() => {
    const days = document.querySelector('#parameter-days')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(days, '7')
    days.dispatchEvent(new Event('input', { bubbles: true }))
    days.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await sleep(100)
  report.checks.push({ id: 'open-meteo-flood', case: 'native integer forecast-days contract', step: 1, min: 1, max: 30, fractionalDaysRejected: true, providerRequests: 0 })

  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  const response = result.data
  assert(response && typeof response === 'object' && !Array.isArray(response), 'Open-Meteo Flood live response is not an object')
  assert.equal(typeof response.latitude, 'number')
  assert.equal(typeof response.longitude, 'number')
  assert.equal(response.timezone, 'GMT')
  assert.equal(response.timezone_abbreviation, 'GMT')
  assert.equal(response.utc_offset_seconds, 0)
  assert.deepEqual(Object.fromEntries(Object.keys(expectedUnits).map((key) => [key, response.daily_units?.[key]])), expectedUnits)
  assert(Array.isArray(response.daily?.time), 'Open-Meteo Flood response is missing daily.time[]')
  assert.equal(response.daily.time.length, 7)
  for (const variable of dailyVariables) {
    assert(Array.isArray(response.daily[variable]), `Open-Meteo Flood response is missing daily.${variable}[]`)
    assert.equal(response.daily[variable].length, response.daily.time.length)
    assert(response.daily[variable].every((value) => typeof value === 'number' && Number.isFinite(value)), `Open-Meteo Flood ${variable} contains a missing or non-number value`)
  }

  const dom = await live.ev(`(() => {
    const shell = document.querySelector('.demo-preview')
    const card = shell?.querySelector('[data-domain-card="flood-forecast"]')
    return {
      layout: shell?.dataset.previewLayout || '', fallback: shell?.dataset.ssotFallback || '', state: card?.dataset.resultState || '',
      requestBound: card?.dataset.requestBound || '', requestLatitude: card?.dataset.requestLatitude || '', requestLongitude: card?.dataset.requestLongitude || '', requestDays: card?.dataset.requestForecastDays || '',
      providerLatitude: card?.dataset.providerLatitude || '', providerLongitude: card?.dataset.providerLongitude || '', timezone: card?.dataset.timezone || '', offset: card?.dataset.utcOffsetSeconds || '',
      providerRows: card?.dataset.providerRowCount || '', validRows: card?.dataset.validRowCount || '', invalidRows: card?.dataset.invalidRowCount || '', missing: card?.dataset.missingMeasurementCount || '', invalid: card?.dataset.invalidMeasurementCount || '',
      arrays: card?.dataset.arrayLengthContract || '', units: card?.dataset.unitContract || '', time: card?.dataset.timeContract || '', cadence: card?.dataset.cadenceContract || '', horizon: card?.dataset.horizonContract || '',
      peakDate: card?.dataset.primaryPeakDate || '', peakDischarge: card?.dataset.primaryPeakDischarge || '', text: card?.innerText || '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }
  })()`)
  assert.equal(dom.layout, 'weather-dashboard')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestLatitude, '1.3521')
  assert.equal(dom.requestLongitude, '103.8198')
  assert.equal(dom.requestDays, '7')
  assert.equal(Number(dom.providerLatitude), response.latitude)
  assert.equal(Number(dom.providerLongitude), response.longitude)
  assert.equal(dom.timezone, response.timezone)
  assert.equal(Number(dom.offset), response.utc_offset_seconds)
  assert.equal(dom.providerRows, '7')
  assert.equal(dom.validRows, '7')
  assert.equal(dom.invalidRows, '0')
  assert.equal(dom.missing, '0')
  assert.equal(dom.invalid, '0')
  assert.equal(dom.arrays, 'true')
  assert.equal(dom.units, 'true')
  assert.equal(dom.time, 'true')
  assert.equal(dom.cadence, 'true')
  assert.equal(dom.horizon, 'true')
  const peakIndex = response.daily.river_discharge_max.indexOf(Math.max(...response.daily.river_discharge_max))
  assert.equal(dom.peakDate, response.daily.time[peakIndex])
  assert.equal(Number(dom.peakDischarge), response.daily.river_discharge_max[peakIndex])
  assert.match(dom.text, /Forecast peak/)

  await live.viewport(390, 844)
  const mobile = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'open-meteo-flood', case: 'live seven-day flood forecast', semanticState: 'ready', providerRows: response.daily.time.length, rawToDomIdentity: 'request, provider grid, timezone, horizon, and peak exact', mobileOverflow: false, unnamedControls: 0 })
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (live) report.errors.push(...live.errors.map(String))
} finally {
  if (live) await live.close()
}

fs.writeFileSync(`${evidence}/open-meteo-flood-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/open-meteo-flood-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
