import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://www.gov.uk/bank-holidays.json'
const divisions = ['england-and-wales', 'scotland', 'northern-ireland']
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live exact GOV.UK Bank Holidays request plus one synthetic HTTP-200 semantic fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
const validEvent = (value) => value && typeof value === 'object'
  && typeof value.title === 'string' && value.title.trim() === value.title && value.title.length > 0
  && validDate(value.date)
  && typeof value.notes === 'string'
  && typeof value.bunting === 'boolean'
const providerSummary = (data) => {
  assert(data && typeof data === 'object' && !Array.isArray(data), 'GOV.UK response must be a division object')
  let providerCount = 0
  let trustedCount = 0
  for (const division of divisions) {
    const value = data[division]
    assert(value && typeof value === 'object' && value.division === division && Array.isArray(value.events), `Invalid ${division} envelope`)
    assert(value.events.every(validEvent), `Invalid ${division} event contract`)
    providerCount += value.events.length
    trustedCount += value.events.length
    const identities = value.events.map((event) => `${event.date}\u0000${event.title}`)
    assert.equal(new Set(identities).size, identities.length, `Duplicate ${division} event identity`)
  }
  const all = divisions.flatMap((division) => data[division].events.map((event) => ({ ...event, division })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.division.localeCompare(b.division) || a.title.localeCompare(b.title))
  const today = new Date().toISOString().slice(0, 10)
  const primary = all.find((event) => event.date >= today) ?? all.at(-1)
  return { providerCount, trustedCount, primary }
}
const semantic = (instance) => instance.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="govuk-bank-holiday-calendar"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', divisionCount:Number(card?.dataset.divisionCount||0), providerCount:Number(card?.dataset.providerEventCount||0), trustedCount:Number(card?.dataset.trustedEventCount||0), malformedCount:Number(card?.dataset.malformedEventCount||0), duplicateCount:Number(card?.dataset.duplicateEventCount||0), unexpectedRootKeyCount:Number(card?.dataset.unexpectedRootKeyCount||0), unusableDivisionCount:Number(card?.dataset.unusableDivisionCount||0), primaryDate:card?.dataset.primaryEventDate||'', primaryTitle:card?.dataset.primaryEventTitle||'', primaryDivision:card?.dataset.primaryEventDivision||'', englandWalesCount:Number(card?.dataset.englandAndWalesEventCount||0), scotlandCount:Number(card?.dataset.scotlandEventCount||0), northernIrelandCount:Number(card?.dataset.northernIrelandEventCount||0), text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('uk-bank-holidays')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const response = await live.run()
  assert.equal(response.ok, true, response.error)
  assert.equal(live.requestCount - before, 1, 'UK Bank Holidays verifier must issue exactly one live provider request')
  const summary = providerSummary(response.data)
  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    divisionCount: dom.divisionCount,
    providerCount: dom.providerCount,
    trustedCount: dom.trustedCount,
    malformedCount: dom.malformedCount,
    duplicateCount: dom.duplicateCount,
    unexpectedRootKeyCount: dom.unexpectedRootKeyCount,
    unusableDivisionCount: dom.unusableDivisionCount,
    primaryDate: dom.primaryDate,
    primaryTitle: dom.primaryTitle,
    primaryDivision: dom.primaryDivision,
    englandWalesCount: dom.englandWalesCount,
    scotlandCount: dom.scotlandCount,
    northernIrelandCount: dom.northernIrelandCount,
  }, {
    layout: 'uk-bank-holiday-calendar',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-govuk-bank-holidays-json',
    divisionCount: 3,
    providerCount: summary.providerCount,
    trustedCount: summary.trustedCount,
    malformedCount: 0,
    duplicateCount: 0,
    unexpectedRootKeyCount: 0,
    unusableDivisionCount: 0,
    primaryDate: summary.primary?.date ?? '',
    primaryTitle: summary.primary?.title ?? '',
    primaryDivision: summary.primary?.division ?? '',
    englandWalesCount: response.data['england-and-wales'].events.length,
    scotlandCount: response.data.scotland.events.length,
    northernIrelandCount: response.data['northern-ireland'].events.length,
  })
  assert(dom.text.includes('England and Wales'))
  assert(dom.text.includes('Scotland'))
  assert(dom.text.includes('Northern Ireland'))
  assert(dom.text.includes('does not infer leave entitlement'))
  await live.ev(`document.querySelector('[data-domain-card="govuk-bank-holiday-calendar"]')?.scrollIntoView({block:'start',behavior:'instant'})`)
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'uk-bank-holidays', source: 'live provider', exactRequest: endpoint, providerEvents: summary.providerCount, divisions: 3, primaryEvent: `${dom.primaryDate} ${dom.primaryTitle} (${dom.primaryDivision})`, semanticState: dom.state, requestBound: dom.requestBound, browserCorsReadable: true, rawToDomIdentity: true, mobileOverflow: false, unnamedControls: 0 })
  await live.close(); active = undefined

  const good = { title: 'Trusted Holiday', date: '2027-01-01', notes: '', bunting: true }
  const fixtureBody = {
    'england-and-wales': { division: 'england-and-wales', events: [good, { ...good }, { title: 'Malformed bunting', date: '2027-05-01', notes: '', bunting: 'true' }] },
    scotland: { division: 'scotland', events: [{ title: 'Trusted Scotland Holiday', date: '2027-01-02', notes: 'Substitute day', bunting: true }] },
    'northern-ireland': { division: 'northern-ireland', events: [{ title: 'Trusted NI Holiday', date: '2027-03-17', notes: '', bunting: false }] },
    metadata: { ignored: true },
  }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('uk-bank-holidays')
  const fixtureBefore = fixture.requestCount
  const fixtureResponse = await fixture.run()
  assert.equal(fixtureResponse.ok, true, fixtureResponse.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({ state: fixtureDom.state, requestBound: fixtureDom.requestBound, providerCount: fixtureDom.providerCount, trustedCount: fixtureDom.trustedCount, malformedCount: fixtureDom.malformedCount, duplicateCount: fixtureDom.duplicateCount, unexpectedRootKeyCount: fixtureDom.unexpectedRootKeyCount }, { state: 'partial', requestBound: 'true', providerCount: 5, trustedCount: 3, malformedCount: 1, duplicateCount: 1, unexpectedRootKeyCount: 1 })
  assert.equal(fixtureDom.text.includes('Malformed bunting'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'fixture must send zero live provider requests')
  assert.deepEqual(fixture.blockedProviders, [])
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ id: 'uk-bank-holidays', case: 'malformed/duplicate HTTP-200 fixture', source: 'synthetic fixture', semanticState: fixtureDom.state, trustedEvents: fixtureDom.trustedCount, malformedEvents: fixtureDom.malformedCount, duplicateEvents: fixtureDom.duplicateCount, unexpectedRootKeys: fixtureDom.unexpectedRootKeyCount, untrustedEvidenceHidden: true, liveProviderRequests: 0 })
  await fixture.close(); active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) {
    report.errors.push(...active.errors.map(String))
    report.networkFailures = active.networkFailures
  }
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/uk-bank-holidays-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/uk-bank-holidays-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
