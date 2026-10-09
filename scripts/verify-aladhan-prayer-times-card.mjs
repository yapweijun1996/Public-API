import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live AlAdhan daily timings plus an exact synthetic wrong-date HTTP-200 fixture',
  checks: [],
  errors: [],
}
const actionableRoles = new Set(['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'])
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && actionableRoles.has(node.role?.value) && !(node.name?.value || '').trim())

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('aladhan-prayer-times')
  const request = await b.ev(`(() => ({
    endpoint: document.querySelector('.endpoint-box code')?.textContent || '',
    date: document.querySelector('#parameter-date')?.value || '',
    method: document.querySelector('#parameter-method')?.value || '',
    latitude: document.querySelector('#parameter-latitude')?.value || '',
    longitude: document.querySelector('#parameter-longitude')?.value || ''
  }))()`)
  assert(request.endpoint, 'AlAdhan endpoint was not exposed')
  const requestUrl = new URL(request.endpoint)
  const [year, month, day] = request.date.split('-')
  const providerDate = `${day}-${month}-${year}`
  assert(requestUrl.pathname.endsWith(`/v1/timings/${providerDate}`))
  assert.equal(requestUrl.searchParams.get('method'), request.method)
  assert.equal(requestUrl.searchParams.get('latitude'), request.latitude)
  assert.equal(requestUrl.searchParams.get('longitude'), request.longitude)

  const live = await b.run()
  assert.equal(live.ok, true, live.error)
  assert.equal(live.data?.code, 200)
  assert.equal(live.data?.status, 'OK')
  assert.equal(live.data?.data?.date?.gregorian?.date, providerDate)
  assert.equal(Number(live.data?.data?.meta?.method?.id), Number(request.method))
  assert.equal(Number(live.data?.data?.meta?.latitude), Number(request.latitude))
  assert.equal(Number(live.data?.data?.meta?.longitude), Number(request.longitude))
  for (const prayer of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
    assert.equal(typeof live.data?.data?.timings?.[prayer], 'string', `missing provider ${prayer}`)
  }

  const dom = await b.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="prayer-schedule"]'); return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    code:card?.dataset.providerCode||'', status:card?.dataset.providerStatus||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', dateMatch:card?.dataset.requestDateMatch||'',
    methodMatch:card?.dataset.requestMethodMatch||'', coordinatesMatch:card?.dataset.requestCoordinatesMatch||'',
    providerDate:card?.dataset.gregorianDate||'', method:card?.dataset.calculationMethodId||'',
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  } })()`)
  assert.deepEqual({ layout: dom.layout, fallback: dom.fallback, state: dom.state, code: dom.code, status: dom.status, requestBound: dom.requestBound, requestContract: dom.requestContract, dateMatch: dom.dateMatch, methodMatch: dom.methodMatch, coordinatesMatch: dom.coordinatesMatch, providerDate: dom.providerDate, method: dom.method }, {
    layout: 'prayer-schedule', fallback: 'false', state: 'ready', code: '200', status: 'OK', requestBound: 'true', requestContract: 'exact-aladhan-daily-timings-v2', dateMatch: 'true', methodMatch: 'true', coordinatesMatch: 'true', providerDate, method: request.method,
  })
  assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0, 'unnamed actionable controls')
  assert.deepEqual(b.errors, [], `browser errors ${b.errors.join(' | ')}`)
  report.checks.push({ id: 'aladhan-prayer-times', case: 'live request-bound prayer schedule', providerDate, method: Number(request.method), semanticState: 'ready', requestBound: true, requestContract: 'exact-aladhan-daily-timings-v2', identity: 'transport+date+method+coordinates matched', mobileOverflow: false, unnamedControls: 0 })
  await b.close(); b = undefined

  const malformedBody = {
    code: 200,
    status: 'OK',
    data: {
      timings: { Fajr: '05:12', Sunrise: '06:58', Dhuhr: '13:05', Asr: '16:25', Maghrib: '19:12', Isha: '20:34' },
      date: { gregorian: { date: providerDate === '01-01-2000' ? '02-01-2000' : '01-01-2000' } },
      meta: { latitude: Number(request.latitude), longitude: Number(request.longitude), timezone: 'Asia/Singapore', method: { id: Number(request.method), name: 'Fixture method' } },
    },
  }
  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[request.endpoint, { body: malformedBody }]]) })
  try {
    await malformed.nav('aladhan-prayer-times')
    const result = await malformed.run()
    assert.equal(result.ok, true, result.error)
    const invalid = await malformed.ev(`(() => { const card=document.querySelector('[data-domain-card="prayer-schedule"]'); return { state:card?.dataset.resultState||'', text:card?.innerText||'', http:document.querySelector('.ssot-runtime b')?.textContent||'' } })()`)
    assert.equal(invalid.state, 'invalid')
    assert.match(invalid.text, /identity mismatch/i)
    assert.match(invalid.http, /^200/)
    assert.doesNotMatch(invalid.text, /05:12/)
    assert.equal(malformed.fixtureRequests.filter((item) => item.url === request.endpoint && item.method === 'GET').length, 1)
    assert.deepEqual(malformed.errors, [])
    report.checks.push({ id: 'aladhan-prayer-times', case: 'synthetic wrong-date HTTP-200', transportStatus: 200, semanticState: 'invalid', plausiblePrayerTimesHidden: true, exactProviderFixtureRequests: 1 })
  } finally {
    await malformed.close()
  }
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/aladhan-prayer-times-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/aladhan-prayer-times-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
