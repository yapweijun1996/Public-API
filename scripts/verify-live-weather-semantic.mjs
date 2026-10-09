import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'Open-Meteo current weather and air quality: exact one-request live raw-to-DOM identity plus fixture-only fail-closed regressions',
  checks: [],
  errors: [],
}

const urls = {
  weather: 'https://api.open-meteo.com/v1/forecast?latitude=1.3521&longitude=103.8198&current=temperature_2m%2Crelative_humidity_2m%2Cwind_speed_10m%2Cweather_code&timezone=auto',
  airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=1.3521&longitude=103.8198&current=us_aqi%2Cpm2_5%2Cpm10%2Cnitrogen_dioxide%2Cozone&timezone=auto',
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())

const assertCommonRawEnvelope = (data) => {
  assert(data?.current && typeof data.current === 'object' && !Array.isArray(data.current), 'Live provider response must include current')
  assert.equal(typeof data.latitude, 'number')
  assert(Number.isFinite(data.latitude) && data.latitude >= -90 && data.latitude <= 90)
  assert.equal(typeof data.longitude, 'number')
  assert(Number.isFinite(data.longitude) && data.longitude >= -180 && data.longitude <= 180)
  assert.equal(typeof data.timezone, 'string')
  assert(data.timezone.length > 0)
  assert.equal(typeof data.utc_offset_seconds, 'number')
  assert(Number.isInteger(data.utc_offset_seconds))
  assert.equal(typeof data.current.time, 'string')
  assert.match(data.current.time, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/)
  assert.equal(typeof data.current.interval, 'number')
  assert(Number.isInteger(data.current.interval) && data.current.interval > 0)
}

const liveResourceCount = (session, url) => session.ev(`performance.getEntriesByName(${JSON.stringify(url)}).length`)

const mobileAndAccessibility = async (session) => {
  await session.viewport(390, 844)
  assert.equal(await session.ev('document.documentElement.scrollWidth>document.documentElement.clientWidth+1'), false)
  const tree = await session.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(tree.nodes).length, 0)
}

const cardEvidence = (session, selector) => session.ev(`(()=>{const c=document.querySelector(${JSON.stringify(selector)});return {
  state:c?.dataset.resultState||'',
  requestBound:c?.dataset.requestBound||'',
  envelopeContract:c?.dataset.envelopeContract||'',
  providerCoordinateContract:c?.dataset.providerCoordinateContract||'',
  timezoneContract:c?.dataset.timezoneContract||'',
  timeContract:c?.dataset.timeContract||'',
  unitsContract:c?.dataset.unitsContract||'',
  measurementContract:c?.dataset.measurementContract||'',
  validMeasurementCount:c?.dataset.validMeasurementCount||'',
  requestLatitude:c?.dataset.requestLatitude||'',
  requestLongitude:c?.dataset.requestLongitude||'',
  providerLatitude:c?.dataset.providerLatitude||'',
  providerLongitude:c?.dataset.providerLongitude||'',
  time:c?.dataset.observationTime||'',
  interval:c?.dataset.observationInterval||'',
  text:c?.innerText||'',
  http:document.querySelector('.ssot-runtime b')?.textContent||'',
}})()`)

let live
let fixtures
try {
  live = await browser(`${root}/dist`)

  await live.nav('weather')
  const weatherResult = await live.run()
  assert.equal(weatherResult.ok, true, weatherResult.error)
  assertCommonRawEnvelope(weatherResult.data)
  const weatherCurrent = weatherResult.data.current
  for (const key of ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'weather_code']) {
    assert.equal(typeof weatherCurrent[key], 'number', `${key} must be a native JSON number`)
    assert(Number.isFinite(weatherCurrent[key]), `${key} must be finite`)
  }
  assert.equal(await liveResourceCount(live, urls.weather), 1, 'Weather route must make exactly one provider request')
  const weatherDom = await cardEvidence(live, '[data-domain-card="current-weather"]')
  assert.equal(weatherDom.state, 'ready')
  assert.equal(weatherDom.requestBound, 'true')
  assert.equal(weatherDom.envelopeContract, 'true')
  assert.equal(weatherDom.providerCoordinateContract, 'true')
  assert.equal(weatherDom.timezoneContract, 'true')
  assert.equal(weatherDom.timeContract, 'true')
  assert.equal(weatherDom.unitsContract, 'true')
  assert.equal(weatherDom.measurementContract, 'true')
  assert.equal(weatherDom.validMeasurementCount, '4')
  assert.equal(weatherDom.requestLatitude, '1.3521')
  assert.equal(weatherDom.requestLongitude, '103.8198')
  assert.equal(weatherDom.providerLatitude, String(weatherResult.data.latitude))
  assert.equal(weatherDom.providerLongitude, String(weatherResult.data.longitude))
  assert.equal(weatherDom.time, String(weatherCurrent.time))
  assert.equal(weatherDom.interval, String(weatherCurrent.interval))
  assert.match(weatherDom.text, /Requested coordinates/)
  assert.match(weatherDom.text, /Provider grid/)
  assert.match(weatherDom.http, /^200/)
  const weatherValues = await live.ev(`(()=>{const c=document.querySelector('[data-domain-card="current-weather"]');return {
    temperature:c?.getAttribute('data-temperature-2m')||'', humidity:c?.getAttribute('data-relative-humidity-2m')||'', wind:c?.getAttribute('data-wind-speed-10m')||'', code:c?.getAttribute('data-weather-code')||'',
  }})()`)
  assert.equal(weatherValues.temperature, String(weatherCurrent.temperature_2m))
  assert.equal(weatherValues.humidity, String(weatherCurrent.relative_humidity_2m))
  assert.equal(weatherValues.wind, String(weatherCurrent.wind_speed_10m))
  assert.equal(weatherValues.code, String(weatherCurrent.weather_code))
  await mobileAndAccessibility(live)
  report.checks.push({
    id: 'weather',
    source: 'live Open-Meteo provider',
    attempts: 1,
    providerRequests: 1,
    corsReadable: true,
    httpStatus: 200,
    semanticState: weatherDom.state,
    rawToDomIdentity: 'request coordinates, provider grid, time, interval, temperature, humidity, wind speed, and weather code exact',
    mobileViewport: '390x844',
    mobileOverflow: false,
    unnamedControls: 0,
  })

  await live.nav('open-meteo-air-quality')
  const airResult = await live.run()
  assert.equal(airResult.ok, true, airResult.error)
  assertCommonRawEnvelope(airResult.data)
  const airCurrent = airResult.data.current
  for (const key of ['us_aqi', 'pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone']) {
    assert.equal(typeof airCurrent[key], 'number', `${key} must be a native JSON number`)
    assert(Number.isFinite(airCurrent[key]), `${key} must be finite`)
  }
  assert(Number.isInteger(airCurrent.us_aqi) && airCurrent.us_aqi >= 0)
  assert.equal(await liveResourceCount(live, urls.airQuality), 1, 'Air-quality route must make exactly one provider request')
  const airDom = await cardEvidence(live, '[data-domain-card="open-meteo-air-quality"]')
  assert.equal(airDom.state, 'ready')
  assert.equal(airDom.requestBound, 'true')
  assert.equal(airDom.envelopeContract, 'true')
  assert.equal(airDom.providerCoordinateContract, 'true')
  assert.equal(airDom.timezoneContract, 'true')
  assert.equal(airDom.timeContract, 'true')
  assert.equal(airDom.unitsContract, 'true')
  assert.equal(airDom.measurementContract, 'true')
  assert.equal(airDom.validMeasurementCount, '5')
  assert.equal(airDom.requestLatitude, '1.3521')
  assert.equal(airDom.requestLongitude, '103.8198')
  assert.equal(airDom.providerLatitude, String(airResult.data.latitude))
  assert.equal(airDom.providerLongitude, String(airResult.data.longitude))
  assert.equal(airDom.time, String(airCurrent.time))
  assert.equal(airDom.interval, String(airCurrent.interval))
  assert.match(airDom.text, /Requested coordinates/)
  assert.match(airDom.text, /Provider grid/)
  assert.match(airDom.http, /^200/)
  const airValues = await live.ev(`(()=>{const c=document.querySelector('[data-domain-card="open-meteo-air-quality"]');return {
    aqi:c?.getAttribute('data-us-aqi')||'', pm25:c?.getAttribute('data-pm2-5')||'', pm10:c?.getAttribute('data-pm10')||'', nitrogenDioxide:c?.getAttribute('data-nitrogen-dioxide')||'', ozone:c?.getAttribute('data-ozone')||'',
  }})()`)
  assert.equal(airValues.aqi, String(airCurrent.us_aqi))
  assert.equal(airValues.pm25, String(airCurrent.pm2_5))
  assert.equal(airValues.pm10, String(airCurrent.pm10))
  assert.equal(airValues.nitrogenDioxide, String(airCurrent.nitrogen_dioxide))
  assert.equal(airValues.ozone, String(airCurrent.ozone))
  await mobileAndAccessibility(live)
  assert.deepEqual(live.errors, [])
  report.checks.push({
    id: 'open-meteo-air-quality',
    source: 'live Open-Meteo provider',
    attempts: 1,
    providerRequests: 1,
    corsReadable: true,
    httpStatus: 200,
    semanticState: airDom.state,
    rawToDomIdentity: 'request coordinates, provider grid, time, interval, AQI, PM2.5, PM10, nitrogen dioxide, and ozone exact',
    mobileViewport: '390x844',
    mobileOverflow: false,
    unnamedControls: 0,
  })

  await live.close()
  live = undefined

  fixtures = await browser(`${root}/dist`, {
    fixtures: new Map([
      [urls.weather, { body: {} }],
      [urls.airQuality, { body: {} }],
    ]),
    blockedProviderPatterns: ['https://api.open-meteo.com/*', 'https://air-quality-api.open-meteo.com/*'],
  })

  for (const fixtureCase of [
    { id: 'weather', url: urls.weather, selector: '[data-domain-card="current-weather"]', text: /No live weather conclusion can be drawn/ },
    { id: 'open-meteo-air-quality', url: urls.airQuality, selector: '[data-domain-card="open-meteo-air-quality"]', text: /required current air-quality response envelope/ },
  ]) {
    await fixtures.nav(fixtureCase.id)
    const result = await fixtures.run()
    assert.equal(result.ok, true, result.error)
    const dom = await cardEvidence(fixtures, fixtureCase.selector)
    assert.equal(dom.state, 'invalid')
    assert.equal(dom.requestBound, 'true')
    assert.equal(dom.envelopeContract, 'false')
    assert.match(dom.text, fixtureCase.text)
    assert.match(dom.http, /^200/)
    assert.equal(await liveResourceCount(fixtures, fixtureCase.url), 1)
    await mobileAndAccessibility(fixtures)
    report.checks.push({
      id: fixtureCase.id,
      source: 'synthetic fixture only',
      case: 'malformed HTTP-200 JSON envelope',
      attempts: 1,
      fixtureRequests: 1,
      transportStatus: 200,
      semanticState: dom.state,
      mobileViewport: '390x844',
      mobileOverflow: false,
      unnamedControls: 0,
    })
  }

  assert.equal(fixtures.fixtureRequests.filter((request) => request.url === urls.weather && request.method === 'GET').length, 1)
  assert.equal(fixtures.fixtureRequests.filter((request) => request.url === urls.airQuality && request.method === 'GET').length, 1)
  assert.equal(fixtures.fixtureRequests.length, 2)
  assert.deepEqual(fixtures.blockedProviders, [], 'No non-fixture Open-Meteo request may escape the fail-closed cases')
  assert.deepEqual(fixtures.errors, [])

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (live) report.errors.push(...live.errors.map(String))
  if (fixtures) report.errors.push(...fixtures.errors.map(String))
} finally {
  if (live) await live.close()
  if (fixtures) await fixtures.close()
}

fs.writeFileSync(`${evidence}/live-weather-semantic-verification.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ ...report, evidence: `${evidence}/live-weather-semantic-verification.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
