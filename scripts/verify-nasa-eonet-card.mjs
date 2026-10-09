import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=6'
const wildfireEndpoint = `${endpoint}&category=wildfires`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live NASA EONET request, native integer-input validation, plus one wrong-category synthetic HTTP-200 fixture',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setSelect = async (b, id, value) => {
  await b.ev(`(() => { const select=document.querySelector(${JSON.stringify(`#parameter-${id}`)}); if(!select) throw Error('Missing ${id} control'); const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; setter.call(select,${JSON.stringify(value)}); select.dispatchEvent(new Event('change',{bubbles:true})); return select.value })()`)
  await sleep(100)
}
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="nasa-eonet-events"]'),first=card?.querySelector('[data-event-id]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',reason:card?.dataset.resultReason||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',category:card?.dataset.requestedCategory||'',days:Number(card?.dataset.requestedDays),limit:Number(card?.dataset.requestedLimit),providerCount:Number(card?.dataset.providerEventCount),validCount:Number(card?.dataset.validEventCount),invalidCount:Number(card?.dataset.invalidEventCount),incompleteCount:Number(card?.dataset.incompleteEventCount),firstId:first?.dataset.eventId||'',firstCategory:first?.dataset.categoryId||'',firstStatus:first?.dataset.eventStatus||'',firstText:first?.innerText||'',allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  }
})()`)

const wrongCategoryFixture = {
  events: [{
    id: 'EONET_9999',
    title: 'Injected volcano event',
    description: null,
    link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_9999',
    closed: null,
    categories: [{ id: 'volcanoes', title: 'Volcanoes' }],
    sources: [{ id: 'EO', url: 'https://earthobservatory.nasa.gov/' }],
    geometry: [{ date: '2026-09-21T00:00:00Z', type: 'Point', coordinates: [120.9, 14.1], magnitudeValue: null, magnitudeUnit: null }],
  }],
}

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('nasa-eonet-events')
  const integerInputs = await live.ev(`(() => {
    const days = document.querySelector('#parameter-days')
    const limit = document.querySelector('#parameter-limit')
    return { daysStep: days?.getAttribute('step') || '', limitStep: limit?.getAttribute('step') || '' }
  })()`)
  assert.deepEqual(integerInputs, { daysStep: '1', limitStep: '1' })
  const beforeInvalidHumanInput = live.requestCount
  const invalidHumanInput = await live.ev(`(() => {
    const days = document.querySelector('#parameter-days')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(days, '30.5')
    days.dispatchEvent(new Event('input', { bubbles: true }))
    days.dispatchEvent(new Event('change', { bubbles: true }))
    return { valid: days.checkValidity(), stepMismatch: days.validity.stepMismatch }
  })()`)
  assert.deepEqual(invalidHumanInput, { valid: false, stepMismatch: true })
  live.ev(`document.querySelector('form.parameter-card').requestSubmit()`)
  await sleep(150)
  assert.equal(live.requestCount, beforeInvalidHumanInput, 'Fractional NASA EONET day input reached a provider request')
  await live.ev(`(() => {
    const days = document.querySelector('#parameter-days')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(days, '30')
    days.dispatchEvent(new Event('input', { bubbles: true }))
    days.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await sleep(100)
  report.checks.push({ case: 'native integer parameter contract', daysStep: 1, limitStep: 1, fractionalDaysRejected: true, providerRequests: 0 })
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data?.events), 'NASA EONET did not return the documented events array')
  assert(result.data.events.length <= 6, 'NASA EONET exceeded the exact requested limit')
  assert(result.data.events.every((event) => event?.closed === null), 'NASA EONET returned a closed event for status=open')
  const dom = await readDom(live)
  assert.deepEqual({ layout: dom.layout, fallback: dom.fallback, requestBound: dom.requestBound, requestContract: dom.requestContract, category: dom.category, days: dom.days, limit: dom.limit, endpoint: dom.endpoint }, {
    layout: 'natural-events', fallback: 'false', requestBound: 'true', requestContract: 'exact-eonet-open-events-bodyless-get', category: 'all', days: 30, limit: 6, endpoint,
  })
  assert.equal(dom.providerCount, result.data.events.length)
  assert.equal(dom.validCount + dom.invalidCount, dom.providerCount)
  if (result.data.events.length === 0) {
    assert.equal(dom.state, 'empty')
  } else {
    assert(['ready', 'partial'].includes(dom.state), JSON.stringify(dom))
    assert(dom.validCount > 0, 'No trustworthy live EONET event reached the semantic card')
    const providerEvent = result.data.events.find((event) => String(event?.id) === dom.firstId)
    assert(providerEvent, 'The first semantic event identity was absent from the provider response')
    assert.equal(dom.firstStatus, 'open')
    assert(providerEvent.categories?.some((category) => category?.id === dom.firstCategory))
    assert(dom.firstText.includes(String(providerEvent.title)))
  }
  const providerRequests = await live.ev(`performance.getEntriesByName(${JSON.stringify(endpoint)}).length`)
  assert.equal(providerRequests, 1)
  await live.viewport(390, 844)
  assert.equal(await live.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1`), false)
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  const screenshot = `${evidence}/nasa-eonet-card.png`
  await live.screenshot(screenshot)
  report.checks.push({ case: 'live exact NASA EONET open-events request', state: dom.state, requestBound: true, providerEvents: dom.providerCount, validEvents: dom.validCount, invalidEvents: dom.invalidCount, incompleteEvents: dom.incompleteCount, browserCorsReadable: true, providerRequests, mobileOverflow: false, unnamedControls: 0, screenshot })
  report.errors.push(...live.errors.map(String))
  assert.deepEqual(report.errors, [])
  await live.close()
  active = undefined

  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[wildfireEndpoint, { body: wrongCategoryFixture }]]), blockedProviderPatterns: ['https://eonet.gsfc.nasa.gov/*'] })
  active = fixture
  await fixture.nav('nasa-eonet-events')
  await setSelect(fixture, 'category', 'wildfires')
  assert.equal(await fixture.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), wildfireEndpoint)
  const fixtureResult = await fixture.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const fixtureDom = await readDom(fixture)
  assert.equal(fixtureDom.state, 'invalid')
  assert.equal(fixtureDom.reason, 'no-trustworthy-events')
  assert.equal(fixtureDom.allText.includes('Injected volcano event'), false)
  assert.deepEqual(fixture.fixtureRequests.map(({ url, source, status }) => ({ url, source, status })), [{ url: wildfireEndpoint, source: 'synthetic-fixture', status: 200 }])
  assert.deepEqual(fixture.blockedProviders, [])
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ case: 'synthetic wrong-category HTTP-200 event payload', state: 'invalid', providerFactsHidden: true, liveProviderRequests: 0 })
  await fixture.close()
  active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/nasa-eonet-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/nasa-eonet-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
