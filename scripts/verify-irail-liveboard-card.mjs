import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const departureEndpoint = 'https://api.irail.be/liveboard/?station=Brussels-South&format=json&lang=en&arrdep=departure&alerts=false'
const arrivalEndpoint = 'https://api.irail.be/liveboard/?station=Gent-Sint-Pieters&format=json&lang=en&arrdep=arrival&alerts=false'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live iRail departure board plus request-bound arrival and wrong-station synthetic HTTP-200 fixtures',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setSelect = async (b, name, value) => {
  await b.ev(`(() => { const select=document.querySelector(${JSON.stringify(`#parameter-${name}`)}); if(!select) throw Error('Missing ${name} control'); const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; setter.call(select,${JSON.stringify(value)}); select.dispatchEvent(new Event('change',{bubbles:true})); return select.value })()`)
  await sleep(100)
}
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="irail-liveboard"]'),first=card?.querySelector('[data-service-id]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',reason:card?.dataset.resultReason||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',direction:card?.dataset.boardDirection||'',requestedStation:card?.dataset.requestedStation||'',providerStationId:card?.dataset.providerStationId||'',providerCount:Number(card?.dataset.providerCount),validCount:Number(card?.dataset.validServiceCount),invalidCount:Number(card?.dataset.invalidServiceCount),firstId:first?.dataset.serviceId||'',firstText:first?.innerText||'',allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  }
})()`)
const verifyMobileAx = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({document:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.document || overflow.preview, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
}

const service = (overrides = {}) => ({
  id: '0', time: '1789994580', delay: '0', canceled: '0', station: 'Brugge', vehicle: 'BE.NMBS.IC535', platform: '7', ...overrides,
})
const arrivalFixture = {
  version: '1.4', timestamp: '1789994400', station: 'Ghent-Sint-Pieters',
  stationinfo: { id: 'BE.NMBS.008892007', '@id': 'http://irail.be/stations/NMBS/008892007', name: 'Ghent-Sint-Pieters', standardname: 'Gent-Sint-Pieters' },
  arrivals: { number: '1', arrival: [service()] },
}
const wrongStationFixture = {
  version: '1.4', timestamp: '1789994400', station: 'Antwerp-Central',
  stationinfo: { id: 'BE.NMBS.008821006', '@id': 'http://irail.be/stations/NMBS/008821006', name: 'Antwerp-Central', standardname: 'Antwerpen-Centraal' },
  departures: { number: '1', departure: [service({ station: 'Injected destination' })] },
}

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('irail-liveboard')
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  const rows = result.data?.departures?.departure
  assert(Array.isArray(rows) && rows.length > 0, 'iRail returned no live departures')
  assert.equal(result.data?.stationinfo?.id, 'BE.NMBS.008814001')
  assert.equal(String(result.data?.departures?.number), String(rows.length))
  const dom = await readDom(live)
  assert.deepEqual({ layout: dom.layout, fallback: dom.fallback, state: dom.state, requestBound: dom.requestBound, requestContract: dom.requestContract, direction: dom.direction, requestedStation: dom.requestedStation, providerStationId: dom.providerStationId }, {
    layout: 'transit-board', fallback: 'false', state: 'ready', requestBound: 'true', requestContract: 'exact-irail-liveboard-bodyless-get', direction: 'departure', requestedStation: 'Brussels-South', providerStationId: 'BE.NMBS.008814001',
  })
  assert.equal(dom.endpoint, departureEndpoint)
  assert.equal(dom.providerCount, rows.length)
  assert.equal(dom.validCount, rows.length)
  assert.equal(dom.invalidCount, 0)
  assert.equal(dom.firstId, String(rows[0].id))
  assert(dom.firstText.includes(String(rows[0].station)))
  const providerRequests = await live.ev(`performance.getEntriesByName(${JSON.stringify(departureEndpoint)}).length`)
  assert.equal(providerRequests, 1)
  assert.equal(dom.overflow, false)
  await verifyMobileAx(live)
  report.checks.push({ id: 'irail-liveboard', case: 'live exact departure board', semanticState: 'ready', requestBound: true, providerStationId: dom.providerStationId, services: rows.length, browserCorsReadable: true, providerRequests, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...live.errors.map(String))
  assert.deepEqual(report.errors, [])
  await live.close()
  active = undefined

  const arrival = await browser(`${root}/dist`, { fixtures: new Map([[arrivalEndpoint, { body: arrivalFixture }]]), blockedProviderPatterns: ['https://api.irail.be/*'] })
  active = arrival
  try {
    await arrival.nav('irail-liveboard')
    await setSelect(arrival, 'station', 'Gent-Sint-Pieters')
    await setSelect(arrival, 'direction', 'arrival')
    assert.equal(await arrival.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), arrivalEndpoint)
    const result = await arrival.run()
    assert.equal(result.ok, true, result.error)
    const dom = await readDom(arrival)
    assert.equal(dom.state, 'ready')
    assert.equal(dom.requestBound, 'true')
    assert.equal(dom.direction, 'arrival')
    assert.equal(dom.providerStationId, 'BE.NMBS.008892007')
    assert(dom.firstText.includes('From Brugge'))
    assert.deepEqual(arrival.fixtureRequests.map(({ url, source, status }) => ({ url, source, status })), [{ url: arrivalEndpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(arrival.blockedProviders, [])
    assert.deepEqual(arrival.errors, [])
    report.checks.push({ id: 'irail-liveboard', case: 'synthetic exact arrival HTTP-200 board', semanticState: 'ready', requestBound: true, direction: 'arrival', originSemantics: true, liveProviderRequests: 0 })
  } finally {
    await arrival.close()
    active = undefined
  }

  const wrongStation = await browser(`${root}/dist`, { fixtures: new Map([[departureEndpoint, { body: wrongStationFixture }]]), blockedProviderPatterns: ['https://api.irail.be/*'] })
  active = wrongStation
  try {
    await wrongStation.nav('irail-liveboard')
    const result = await wrongStation.run()
    assert.equal(result.ok, true, result.error)
    const dom = await readDom(wrongStation)
    assert.equal(dom.state, 'invalid')
    assert.equal(dom.requestBound, 'false')
    assert.equal(dom.reason, 'provider-station-mismatch')
    assert.equal(dom.allText.includes('Injected destination'), false)
    assert.deepEqual(wrongStation.fixtureRequests.map(({ url, source, status }) => ({ url, source, status })), [{ url: departureEndpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(wrongStation.blockedProviders, [])
    assert.deepEqual(wrongStation.errors, [])
    report.checks.push({ id: 'irail-liveboard', case: 'synthetic wrong-station HTTP-200 board', semanticState: 'invalid', providerFactsHidden: true, liveProviderRequests: 0 })
  } finally {
    await wrongStation.close()
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

fs.writeFileSync(`${evidence}/irail-liveboard-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/irail-liveboard-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
