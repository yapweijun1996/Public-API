import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live UK Police street-crime API from the Pages origin plus fixture-only semantic regressions',
  checks: [],
  errors: [],
}

const endpoint = 'https://data.police.uk/api/crimes-street/burglary?lat=51.5074&lng=-0.1278'
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const validCrime = (persistentId = 'a'.repeat(64)) => ({
  persistent_id: persistentId,
  id: 123,
  category: 'burglary',
  month: '2026-07',
  location: { latitude: '51.49', longitude: '-0.12', street: { name: 'On or near Whitehall' } },
})
const setControl = async (b, name, value) => {
  await b.ev(`(() => {
    const element = document.querySelector('[name=${JSON.stringify(name)}]')
    if (!element) throw new Error('Missing control ' + ${JSON.stringify(name)})
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)})
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })()`)
}
const semanticDom = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview')
  const card = shell?.querySelector('[data-domain-card="uk-police-street-crime"]')
  const row = card?.querySelector('[data-persistent-id]')
  return {
    layout: shell?.dataset.previewLayout,
    fallback: shell?.dataset.ssotFallback,
    state: card?.dataset.resultState,
    requestBound: card?.dataset.requestBound,
    requestCategory: card?.dataset.requestCategory,
    requestLatitude: card?.dataset.requestLatitude,
    requestLongitude: card?.dataset.requestLongitude,
    providerRecords: Number(card?.dataset.providerRecordCount),
    validRecords: Number(card?.dataset.validRecordCount),
    invalidRecords: Number(card?.dataset.invalidRecordCount),
    duplicateRecords: Number(card?.dataset.duplicateRecordCount),
    identityField: card?.dataset.identityField,
    identityFallback: card?.dataset.identityFallback,
    primaryId: card?.dataset.primaryPersistentId,
    rowId: row?.dataset.persistentId,
    rowLatitude: row?.dataset.locationLatitude,
    rowLongitude: row?.dataset.locationLongitude,
    text: card?.innerText || '',
  }
})()`)
const verifyMobileAx = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview')?.scrollWidth > document.querySelector('.demo-preview')?.clientWidth + 1,
    cardOverflow: document.querySelector('[data-domain-card="uk-police-street-crime"]')?.scrollWidth > document.querySelector('[data-domain-card="uk-police-street-crime"]')?.clientWidth + 1,
  })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow || overflow.cardOverflow, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
}

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('uk-police-street-crime')
  const shownEndpoint = await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(shownEndpoint, endpoint)
  const parsedEndpoint = new URL(shownEndpoint)
  assert.equal(parsedEndpoint.protocol, 'https:')
  assert.equal(parsedEndpoint.origin, 'https://data.police.uk')
  assert.equal(parsedEndpoint.pathname, '/api/crimes-street/burglary')
  assert.deepEqual([...parsedEndpoint.searchParams.keys()], ['lat', 'lng'])
  assert.equal(parsedEndpoint.searchParams.get('lat'), '51.5074')
  assert.equal(parsedEndpoint.searchParams.get('lng'), '-0.1278')

  const before = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - before, 1, 'UK Police verifier must issue exactly one live provider request')
  assert(Array.isArray(result.data), 'UK Police response was not an array')
  assert(result.data.length > 0, 'UK Police returned no burglary rows for the default London point')
  for (const row of result.data) {
    assert.equal(typeof row?.persistent_id, 'string')
    assert.equal(row.persistent_id.length, 64)
    assert.equal(typeof row?.category, 'string')
    assert.match(row.month, /^\d{4}-\d{2}$/)
    assert.equal(typeof row?.location?.latitude, 'string')
    assert.equal(typeof row?.location?.longitude, 'string')
  }
  const liveDom = await semanticDom(active)
  assert.deepEqual(
    { layout: liveDom.layout, fallback: liveDom.fallback, state: liveDom.state, requestBound: liveDom.requestBound, requestCategory: liveDom.requestCategory, requestLatitude: liveDom.requestLatitude, requestLongitude: liveDom.requestLongitude },
    { layout: 'street-crime', fallback: 'false', state: 'ready', requestBound: 'true', requestCategory: 'burglary', requestLatitude: '51.5074', requestLongitude: '-0.1278' },
  )
  assert.equal(liveDom.providerRecords, result.data.length)
  assert.equal(liveDom.validRecords, result.data.length)
  assert.equal(liveDom.invalidRecords, 0)
  assert.equal(liveDom.duplicateRecords, 0)
  assert.equal(liveDom.identityField, 'persistent_id')
  assert.equal(liveDom.identityFallback, 'none')
  assert.equal(liveDom.primaryId, result.data[0].persistent_id)
  assert.equal(liveDom.rowId, result.data[0].persistent_id)
  assert.equal(liveDom.rowLatitude, result.data[0].location.latitude)
  assert.equal(liveDom.rowLongitude, result.data[0].location.longitude)
  assert(liveDom.text.includes('approximate/anonymised'))
  await verifyMobileAx(active)
  assert.deepEqual(active.errors, [])
  report.checks.push({ id: 'uk-police-street-crime', case: 'live exact burglary request', source: 'live provider', liveProviderRequests: 1, transportStatus: 200, semanticState: liveDom.state, returnedRows: result.data.length, rawToDomIdentity: true, approximateCoordinatesPreserved: true, mobileOverflow: false, unnamedControls: 0 })
  await active.close()
  active = undefined

  const matching = validCrime('b'.repeat(64))
  const duplicate = validCrime('b'.repeat(64))
  const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: [matching, { ...validCrime('c'.repeat(64)), persistent_id: '' }, duplicate] }]]) })
  active = fixtureBrowser
  await fixtureBrowser.nav('uk-police-street-crime')
  const fixtureBefore = fixtureBrowser.requestCount
  const fixtureResult = await fixtureBrowser.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  assert.equal(fixtureBrowser.requestCount - fixtureBefore, 1)
  const fixtureDom = await semanticDom(fixtureBrowser)
  assert.equal(fixtureDom.state, 'partial')
  assert.equal(fixtureDom.providerRecords, 3)
  assert.equal(fixtureDom.validRecords, 1)
  assert.equal(fixtureDom.invalidRecords, 2)
  assert.equal(fixtureDom.duplicateRecords, 1)
  assert.equal(fixtureDom.identityFallback, 'none')
  assert(fixtureDom.text.includes('On or near Whitehall'))
  assert.deepEqual(fixtureBrowser.blockedProviders, [])
  assert.deepEqual(fixtureBrowser.errors, [])
  assert.equal(fixtureBrowser.fixtureRequests.filter((item) => item.url === endpoint && item.method === 'GET').length, 1)
  report.checks.push({ id: 'uk-police-street-crime', case: 'fixture-only malformed and duplicate identity batch', source: 'synthetic HTTP-200 fixture', liveProviderRequests: 0, exactFixtureRequests: 1, semanticState: fixtureDom.state, withheldRows: fixtureDom.invalidRecords, duplicateIdentities: fixtureDom.duplicateRecords })
  await fixtureBrowser.close()
  active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close().catch((error) => report.errors.push(String(error)))
}

fs.writeFileSync(`${evidence}/uk-police-street-crime-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/uk-police-street-crime-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
