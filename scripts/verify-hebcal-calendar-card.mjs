import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const year = 5787
const endpoint = `https://www.hebcal.com/hebcal?v=1&cfg=json&year=${year}&yt=H&month=x&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&s=on&leyning=off&i=off`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live canonical Hebcal Hebrew-year request plus one synthetic HTTP-200 semantic fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())
const isoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
const trustedEvent = (row, range) => row && typeof row === 'object'
  && isoDate(row.date) && row.date >= range.start && row.date <= range.end
  && typeof row.title === 'string' && row.title.trim() === row.title && row.title.length > 0
  && typeof row.hdate === 'string' && new RegExp(`\\s(?:${year - 1}|${year})$`).test(row.hdate)
  && typeof row.hebrew === 'string' && row.hebrew.trim() === row.hebrew && row.hebrew.length > 0
  && typeof row.category === 'string' && row.category.trim() === row.category && row.category.length > 0
  && (row.subcat === undefined || typeof row.subcat === 'string')
  && (row.memo === undefined || typeof row.memo === 'string')
  && (row.link === undefined || typeof row.link === 'string' && /^https:\/\/(?:www\.)?hebcal\.com\//.test(row.link))
  && (row.yomtov === undefined || typeof row.yomtov === 'boolean')
const semantic = (instance) => instance.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="hebcal-jewish-calendar"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', year:Number(card?.dataset.requestedHebrewYear||0), schedule:card?.dataset.requestedSchedule||'', providerCount:Number(card?.dataset.providerEventCount||0), trustedCount:Number(card?.dataset.trustedEventCount||0), malformedCount:Number(card?.dataset.malformedEventCount||0), duplicateCount:Number(card?.dataset.duplicateEventCount||0), supplementalMalformedCount:Number(card?.dataset.supplementalMalformedCount||0), rangeStart:card?.dataset.rangeStart||'', rangeEnd:card?.dataset.rangeEnd||'', primaryDate:card?.dataset.primaryEventDate||'', primaryTitle:card?.dataset.primaryEventTitle||'', dates:[...(card?.querySelectorAll('time')||[])].map((node)=>node.getAttribute('datetime')), titles:[...(card?.querySelectorAll('.calendar-preview h3')||[])].map((node)=>node.textContent), text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('hebcal-calendar')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const response = await live.run()
  assert.equal(response.ok, true, response.error)
  assert.equal(live.requestCount - before, 1, 'Hebcal verifier must issue exactly one live provider request')
  assert(response.data && typeof response.data === 'object' && !Array.isArray(response.data), 'Hebcal response must be an object')
  assert.equal(response.data.title, `Hebcal Diaspora ${year}`)
  assert(response.data.range && isoDate(response.data.range.start) && isoDate(response.data.range.end), 'Hebcal range drifted')
  assert.equal(response.data.range.start.slice(0, 4), String(year - 3761))
  assert.equal(response.data.range.end.slice(0, 4), String(year - 3760))
  assert(Array.isArray(response.data.items) && response.data.items.length > 0, 'Hebcal calendar unexpectedly returned no events')
  assert(response.data.items.every((row) => trustedEvent(row, response.data.range)), 'Hebcal event wire contract drifted')
  const identities = response.data.items.map((row) => `${row.date}\u0000${row.category}\u0000${row.title}\u0000${row.hdate}`)
  assert.equal(new Set(identities).size, identities.length, 'Hebcal returned duplicate event identities')
  assert(response.data.items.some((row) => row.hdate.endsWith(` ${year}`)), 'Hebcal response did not contain requested Hebrew-year evidence')

  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    year: dom.year,
    schedule: dom.schedule,
    providerCount: dom.providerCount,
    trustedCount: dom.trustedCount,
    malformedCount: dom.malformedCount,
    duplicateCount: dom.duplicateCount,
    supplementalMalformedCount: dom.supplementalMalformedCount,
    rangeStart: dom.rangeStart,
    rangeEnd: dom.rangeEnd,
    primaryDate: dom.primaryDate,
    primaryTitle: dom.primaryTitle,
    dates: dom.dates,
    titles: dom.titles,
  }, {
    layout: 'jewish-calendar',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-hebcal-hebrew-year-calendar',
    year,
    schedule: 'Diaspora',
    providerCount: response.data.items.length,
    trustedCount: response.data.items.length,
    malformedCount: 0,
    duplicateCount: 0,
    supplementalMalformedCount: 0,
    rangeStart: response.data.range.start,
    rangeEnd: response.data.range.end,
    primaryDate: response.data.items[0].date,
    primaryTitle: response.data.items[0].title,
    dates: response.data.items.slice(0, 12).map((row) => row.date),
    titles: response.data.items.slice(0, 12).map((row) => row.title),
  })
  assert(dom.text.includes('CC BY 4.0'))
  await live.ev(`document.querySelector('[data-domain-card="hebcal-jewish-calendar"]')?.scrollIntoView({block:'start',behavior:'instant'})`)
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'hebcal-calendar', source: 'live provider', exactRequest: endpoint, returnedEvents: response.data.items.length, range: response.data.range, primaryEvent: `${dom.primaryDate} ${dom.primaryTitle}`, semanticState: dom.state, requestBound: dom.requestBound, browserCorsReadable: true, rawToDomIdentity: true, mobileOverflow: false, unnamedControls: 0 })
  await live.close(); active = undefined

  const trusted = { title: `Rosh Hashana ${year}`, date: '2026-09-12', hdate: `1 Tishrei ${year}`, category: 'holiday', subcat: 'major', hebrew: `ראש השנה ${year}`, yomtov: true }
  const fixtureBody = {
    title: `Hebcal Diaspora ${year}`,
    date: '2026-09-18T00:00:00.000Z',
    version: 'fixture',
    location: { geo: 'none' },
    range: { start: '2026-09-11', end: '2027-10-01' },
    items: [
      trusted,
      { ...trusted },
      { ...trusted, title: 'Malformed Hebrew year', date: '2026-09-20', hdate: '9 Tishrei 9000' },
      { ...trusted, title: 'Supplemental type drift', date: '2026-09-21', hdate: `10 Tishrei ${year}`, yomtov: 'true' },
    ],
  }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('hebcal-calendar')
  const fixtureBefore = fixture.requestCount
  const fixtureResponse = await fixture.run()
  assert.equal(fixtureResponse.ok, true, fixtureResponse.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({ state: fixtureDom.state, requestBound: fixtureDom.requestBound, providerCount: fixtureDom.providerCount, trustedCount: fixtureDom.trustedCount, malformedCount: fixtureDom.malformedCount, duplicateCount: fixtureDom.duplicateCount, supplementalMalformedCount: fixtureDom.supplementalMalformedCount, primaryTitle: fixtureDom.primaryTitle }, { state: 'partial', requestBound: 'true', providerCount: 4, trustedCount: 2, malformedCount: 1, duplicateCount: 1, supplementalMalformedCount: 1, primaryTitle: `Rosh Hashana ${year}` })
  assert.equal(fixtureDom.text.includes('Malformed Hebrew year'), false)
  assert.equal(fixtureDom.text.includes('Supplemental type drift'), true)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Hebcal fixture must send zero live provider requests')
  assert.deepEqual(fixture.blockedProviders, [])
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ id: 'hebcal-calendar', case: 'malformed/duplicate HTTP-200 fixture', source: 'synthetic fixture', semanticState: fixtureDom.state, trustedEvents: fixtureDom.trustedCount, malformedEvents: fixtureDom.malformedCount, duplicateEvents: fixtureDom.duplicateCount, supplementalMalformed: fixtureDom.supplementalMalformedCount, untrustedIdentityHidden: true, liveProviderRequests: 0 })
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

fs.writeFileSync(`${evidence}/hebcal-calendar-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/hebcal-calendar-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
