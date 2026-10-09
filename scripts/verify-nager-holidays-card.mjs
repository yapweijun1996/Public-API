import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const year = new Date().getUTCFullYear()
const endpoint = `https://nagerholidays.com/api/v4/Holidays/SG/${year}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live canonical Nager.Holidays Community API v4 request plus one synthetic HTTP-200 semantic fixture',
  checks: [],
  errors: [],
}
const allowedTypes = new Set(['Public', 'Bank', 'School', 'Authorities', 'Optional', 'Observance'])
const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())
const trustedHoliday = (row) => row && typeof row === 'object'
  && typeof row.date === 'string' && row.date.startsWith(`${year}-`)
  && typeof row.name === 'string' && row.name.trim() === row.name && row.name.length > 0
  && row.countryCode === 'SG'
  && typeof row.nationalHoliday === 'boolean'
  && (row.subdivisionCodes === null || Array.isArray(row.subdivisionCodes) && row.subdivisionCodes.every((value) => typeof value === 'string' && value.trim() === value && value.length > 0))
  && Array.isArray(row.holidayTypes) && row.holidayTypes.length > 0 && row.holidayTypes.every((value) => allowedTypes.has(value))
const semantic = (instance) => instance.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="nager-holiday-calendar"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', country:card?.dataset.requestedCountry||'', year:Number(card?.dataset.requestedYear||0), providerCount:Number(card?.dataset.providerHolidayCount||0), trustedCount:Number(card?.dataset.trustedHolidayCount||0), malformedCount:Number(card?.dataset.malformedHolidayCount||0), duplicateCount:Number(card?.dataset.duplicateHolidayCount||0), nationalCount:Number(card?.dataset.nationalHolidayCount||0), regionalCount:Number(card?.dataset.regionalHolidayCount||0), primaryDate:card?.dataset.primaryHolidayDate||'', primaryName:card?.dataset.primaryHolidayName||'', dates:[...(card?.querySelectorAll('time')||[])].map((node)=>node.getAttribute('datetime')), names:[...(card?.querySelectorAll('.calendar-preview h3')||[])].map((node)=>node.textContent), text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('holidays')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const response = await live.run()
  assert.equal(response.ok, true, response.error)
  assert.equal(live.requestCount - before, 1, 'Nager.Holidays verifier must issue exactly one live provider request')
  assert(Array.isArray(response.data), 'Nager.Holidays response must be an array')
  assert(response.data.length > 0, 'Singapore current-year calendar unexpectedly returned no holidays')
  assert(response.data.every(trustedHoliday), 'Nager.Holidays Community API v4 response contract drifted')
  const identities = response.data.map((row) => `${row.date}\u0000${row.name}\u0000${(row.subdivisionCodes ?? []).join('|')}`)
  assert.equal(new Set(identities).size, identities.length, 'Nager.Holidays returned duplicate holiday identities')
  const dom = await semantic(live)
  const nationalCount = response.data.filter((row) => row.nationalHoliday).length
  const regionalCount = response.data.length - nationalCount
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    country: dom.country,
    year: dom.year,
    providerCount: dom.providerCount,
    trustedCount: dom.trustedCount,
    malformedCount: dom.malformedCount,
    duplicateCount: dom.duplicateCount,
    nationalCount: dom.nationalCount,
    regionalCount: dom.regionalCount,
    primaryDate: dom.primaryDate,
    primaryName: dom.primaryName,
    dates: dom.dates,
    names: dom.names,
  }, {
    layout: 'public-holiday-calendar',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-nager-community-v4-holidays',
    country: 'SG',
    year,
    providerCount: response.data.length,
    trustedCount: response.data.length,
    malformedCount: 0,
    duplicateCount: 0,
    nationalCount,
    regionalCount,
    primaryDate: response.data[0].date,
    primaryName: response.data[0].name,
    dates: response.data.map((row) => row.date),
    names: response.data.map((row) => row.name),
  })
  await live.ev(`document.querySelector('[data-domain-card="nager-holiday-calendar"]')?.scrollIntoView({block:'start',behavior:'instant'})`)
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'holidays', source: 'live provider', exactRequest: endpoint, returnedHolidays: response.data.length, primaryHoliday: `${dom.primaryDate} ${dom.primaryName}`, semanticState: dom.state, requestBound: dom.requestBound, browserCorsReadable: true, rawToDomIdentity: true, mobileOverflow: false, unnamedControls: 0 })
  await live.close(); active = undefined

  const trusted = { date: `${year}-01-01`, name: 'Trusted Holiday', countryCode: 'SG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] }
  const fixtureBody = [
    trusted,
    { ...trusted },
    { date: `${year}-02-01`, name: 'Wrong Country Holiday', countryCode: 'MY', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
    { date: `${year}-03-01`, name: 'String Boolean Holiday', countryCode: 'SG', nationalHoliday: 'true', subdivisionCodes: null, holidayTypes: ['Public'] },
    { date: `${year}-04-01`, name: 'Unknown Type Holiday', countryCode: 'SG', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Fabricated'] },
  ]
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('holidays')
  const fixtureBefore = fixture.requestCount
  const fixtureResponse = await fixture.run()
  assert.equal(fixtureResponse.ok, true, fixtureResponse.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({ state: fixtureDom.state, requestBound: fixtureDom.requestBound, providerCount: fixtureDom.providerCount, trustedCount: fixtureDom.trustedCount, malformedCount: fixtureDom.malformedCount, duplicateCount: fixtureDom.duplicateCount, primaryName: fixtureDom.primaryName, dates: fixtureDom.dates, names: fixtureDom.names }, { state: 'partial', requestBound: 'true', providerCount: 5, trustedCount: 1, malformedCount: 3, duplicateCount: 1, primaryName: 'Trusted Holiday', dates: [`${year}-01-01`], names: ['Trusted Holiday'] })
  assert.equal(fixtureDom.text.includes('Wrong Country Holiday'), false)
  assert.equal(fixtureDom.text.includes('String Boolean Holiday'), false)
  assert.equal(fixtureDom.text.includes('Unknown Type Holiday'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Nager.Holidays fixture must send zero live provider requests')
  assert.deepEqual(fixture.blockedProviders, [])
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ id: 'holidays', case: 'malformed/duplicate HTTP-200 fixture', source: 'synthetic fixture', semanticState: fixtureDom.state, trustedHolidays: fixtureDom.trustedCount, malformedHolidays: fixtureDom.malformedCount, duplicateHolidays: fixtureDom.duplicateCount, untrustedIdentitiesHidden: true, liveProviderRequests: 0 })
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

fs.writeFileSync(`${evidence}/nager-holidays-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/nager-holidays-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
