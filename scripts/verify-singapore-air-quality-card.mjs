import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoints = {
  'data-gov-psi': 'https://api.data.gov.sg/v1/environment/psi',
  'data-gov-pm25': 'https://api.data.gov.sg/v1/environment/pm25',
}
const contracts = {
  'data-gov-psi': {
    metricKey: 'psi_twenty_four_hourly',
    unit: 'PSI',
    band: (value) => value <= 50 ? 'Good' : value <= 100 ? 'Moderate' : value <= 200 ? 'Unhealthy' : value <= 300 ? 'Very unhealthy' : 'Hazardous',
  },
  'data-gov-pm25': {
    metricKey: 'pm25_one_hourly',
    unit: 'µg/m³',
    band: (value) => value <= 55 ? 'Normal' : value <= 150 ? 'Elevated' : value <= 250 ? 'High' : 'Very High',
  },
}
const reportingRegions = ['north', 'south', 'east', 'west', 'central']
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'live data.gov.sg regional PSI/PM2.5 raw-response identity plus synthetic wrong-metric HTTP-200 fail-closed regression',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())

let live
let malformed
try {
  live = await browser(`${root}/dist`)
  for (const id of Object.keys(contracts)) {
    const contract = contracts[id]
    await live.nav(id)
    const result = await live.run()
    assert.equal(result.ok, true, `${id}: ${result.error}`)
    assert(Array.isArray(result.data?.items) && result.data.items.length > 0, `${id}: provider response is missing items`)
    const item = result.data.items[0]
    const regional = item?.readings?.[contract.metricKey]
    assert(regional && typeof regional === 'object' && !Array.isArray(regional), `${id}: provider response is missing ${contract.metricKey}`)
    const values = reportingRegions.map((region) => regional[region])
    assert(values.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0), `${id}: provider regional measurements are not finite non-negative JSON numbers`)
    const maximum = Math.max(...values)
    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    const expectedBand = contract.band(maximum)
    const dom = await live.ev(`(() => {
      const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="regional-air-quality"]')
      return {
        layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
        metricKey:card?.dataset.metricKey||'', providerCount:Number(card?.dataset.providerRegionCount), validCount:Number(card?.dataset.validRegionCount),
        invalidCount:Number(card?.dataset.invalidRegionCount), missingCount:Number(card?.dataset.missingRegionCount), unit:card?.dataset.unit||'', band:card?.dataset.band||'',
        bandBasis:card?.dataset.bandBasis||'', maximum:Number(card?.dataset.highestRegionalReading), average:Number(card?.dataset.derivedRegionalAverage),
        observationTime:card?.dataset.observationTime||'', updateTime:card?.dataset.updateTime||'',
        regionValues:Object.fromEntries([...card?.querySelectorAll('.regional-reading-grid article')||[]].map((entry)=>[entry.querySelector('span')?.textContent?.toLowerCase()||'', Number(entry.querySelector('strong')?.textContent)])),
        text:card?.innerText||'', overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      }
    })()`)
    assert.equal(dom.layout, 'weather-dashboard')
    assert.equal(dom.fallback, 'false')
    assert.equal(dom.state, 'ready')
    assert.equal(dom.metricKey, contract.metricKey)
    assert.equal(dom.providerCount, 5)
    assert.equal(dom.validCount, 5)
    assert.equal(dom.invalidCount, 0)
    assert.equal(dom.missingCount, 0)
    assert.equal(dom.unit, contract.unit)
    assert.equal(dom.band, expectedBand)
    assert.equal(dom.bandBasis, 'highest-regional-reading')
    assert.equal(dom.maximum, maximum)
    assert.equal(dom.average, average)
    assert.equal(dom.observationTime, String(item.timestamp))
    assert.equal(dom.updateTime, String(item.update_timestamp))
    reportingRegions.forEach((region, index) => assert.equal(dom.regionValues[region], values[index], `${id}: ${region} DOM value mismatch`))
    assert.match(dom.text, /Derived regional average/)
    assert.equal(dom.overflow, false)
    report.checks.push({ id, case: 'live regional air-quality contract', metricKey: contract.metricKey, semanticState: dom.state, band: expectedBand, rawToDomIdentity: 'five regional values, timestamps, maximum, and derived average exact', cors: 'browser request succeeded', desktopOverflow: false })
  }
  await live.viewport(390, 844)
  const mobile = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'data-gov-pm25', case: 'mobile and accessibility contract', viewport: '390x844', mobileOverflow: false, unnamedControls: 0 })
  await live.close()
  live = undefined

  const wrongMetricBody = {
    api_info: { status: 'healthy' },
    items: [{
      timestamp: '2026-09-14T10:00:00+08:00',
      update_timestamp: '2026-09-14T10:08:52+08:00',
      readings: { pm10_twenty_four_hourly: { north: 27, south: 28, east: 29, west: 30, central: 31 } },
    }],
  }
  malformed = await browser(`${root}/dist`, { fixtures: new Map([[endpoints['data-gov-psi'], { body: wrongMetricBody }]]) })
  await malformed.nav('data-gov-psi')
  const malformedResult = await malformed.run()
  assert.equal(malformedResult.ok, true, malformedResult.error)
  const malformedDom = await malformed.ev(`(() => {
    const card=document.querySelector('[data-domain-card="regional-air-quality"]')
    return { state:card?.dataset.resultState||'', metricKey:card?.dataset.metricKey||'', validCount:Number(card?.dataset.validRegionCount), text:card?.innerText||'', http:document.querySelector('.ssot-runtime b')?.textContent||'' }
  })()`)
  assert.equal(malformedDom.state, 'invalid')
  assert.equal(malformedDom.metricKey, 'psi_twenty_four_hourly')
  assert.equal(malformedDom.validCount, 0)
  assert.match(malformedDom.text, /required items\[0\]\.readings\.psi_twenty_four_hourly/)
  assert.doesNotMatch(malformedDom.text, /\b(?:27|28|29|30|31)\b/)
  assert.doesNotMatch(malformedDom.text, /\b(?:Good|Moderate|Unhealthy|Hazardous)\b/)
  assert.match(malformedDom.http, /^200/)
  assert.equal(malformed.fixtureRequests.filter((request) => request.url === endpoints['data-gov-psi'] && request.method === 'GET').length, 1)
  assert.deepEqual(malformed.errors, [])
  report.checks.push({ id: 'data-gov-psi', case: 'synthetic wrong-metric HTTP-200 body', transportStatus: 200, semanticState: malformedDom.state, fabricatedPsiValues: false, exactProviderFixtureRequests: 1 })
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (live) report.errors.push(...live.errors.map(String))
  if (malformed) report.errors.push(...malformed.errors.map(String))
} finally {
  if (live) await live.close()
  if (malformed) await malformed.close()
}

fs.writeFileSync(`${evidence}/singapore-air-quality-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/singapore-air-quality-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
