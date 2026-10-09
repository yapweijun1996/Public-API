import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.data.gov.my/data-catalogue/?id=fuelprice&limit=12&sort=-date'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live data.gov.my fuelprice request plus a synthetic malformed-row HTTP-200 response',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="fuel-market"]')
  const fuel=(key)=>{const node=card?.querySelector('[data-fuel="'+key+'"]');return {value:node?.dataset.fuelValue||'',change:node?.dataset.weeklyChange||'',text:node?.innerText||''}}
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestedLimit:Number(card?.dataset.requestedLimit),providerCount:Number(card?.dataset.providerRecordCount),validCount:Number(card?.dataset.validRecordCount),invalidCount:Number(card?.dataset.invalidRecordCount),levelCount:Number(card?.dataset.levelRecordCount),changeCount:Number(card?.dataset.changeRecordCount),rowLimit:card?.dataset.rowLimitContract||'',sort:card?.dataset.sortContract||'',latestDate:card?.dataset.latestDate||'',ron95:fuel('ron95'),ron97:fuel('ron97'),diesel:fuel('diesel'),eastDiesel:fuel('diesel_eastmsia'),budi95:fuel('ron95_budi95'),skps:fuel('ron95_skps'),allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  }
})()`)

const parseNumber = (value) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const validRow = (row) => row && typeof row === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(row.date || '') && ['level', 'change_weekly'].includes(row.series_type) && ['ron95','ron97','diesel','diesel_eastmsia','ron95_budi95','ron95_skps'].some((key) => parseNumber(row[key]) !== undefined)
const verifyMobileAx = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({document:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.document || overflow.preview, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
}

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('malaysia-fuel-price')
  await b.ev(`(()=>{const input=document.querySelector('.parameter-card input[name="limit"]'); if(!input) throw new Error('limit input missing'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,'12'); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  const before = b.requestCount
  const result = await b.run()
  const providerFetches = b.requestCount - before
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data), 'fuelprice provider response must be an array')
  assert(result.data.length > 0 && result.data.length <= 12, `unexpected row count ${result.data.length}`)
  assert(result.data.every(validRow), 'live fuelprice response contains an undocumented row shape')
  const levels = result.data.filter((row) => row.series_type === 'level')
  const changes = result.data.filter((row) => row.series_type === 'change_weekly')
  assert(levels.length > 0, 'live fuelprice response has no level rows')
  const latest = levels[0]
  const latestChange = changes.find((row) => row.date === latest.date)
  const dom = await readDom(b)
  assert.equal(dom.layout, 'fuel-dashboard')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestedLimit, 12)
  assert.equal(dom.providerCount, result.data.length)
  assert.equal(dom.validCount, result.data.length)
  assert.equal(dom.invalidCount, 0)
  assert.equal(dom.levelCount, levels.length)
  assert.equal(dom.changeCount, changes.length)
  assert.equal(dom.rowLimit, 'valid')
  assert.equal(dom.sort, 'valid')
  assert.equal(dom.latestDate, latest.date)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(providerFetches, 1)
  if (parseNumber(latest.ron95) !== undefined) assert.equal(Number(dom.ron95.value), latest.ron95)
  if (parseNumber(latest.ron97) !== undefined) assert.equal(Number(dom.ron97.value), latest.ron97)
  if (parseNumber(latest.diesel) !== undefined) assert.equal(Number(dom.diesel.value), latest.diesel)
  if (parseNumber(latest.diesel_eastmsia) !== undefined) assert.equal(Number(dom.eastDiesel.value), latest.diesel_eastmsia)
  if (parseNumber(latest.ron95_budi95) !== undefined) assert.equal(Number(dom.budi95.value), latest.ron95_budi95)
  if (parseNumber(latest.ron95_skps) !== undefined) assert.equal(Number(dom.skps.value), latest.ron95_skps)
  if (latestChange && parseNumber(latestChange.ron97) !== undefined) assert.equal(Number(dom.ron97.change), latestChange.ron97)
  assert.equal(dom.overflow, false)
  await verifyMobileAx(b)
  report.checks.push({ id: 'malaysia-fuel-price', case: 'live exact data.gov.my fuelprice request', semanticState: dom.state, requestBound: true, requestedRows: 12, providerRows: result.data.length, levelRows: levels.length, changeRows: changes.length, latestDate: latest.date, providerFetches, providerCors: 'browser-readable', mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  assert.deepEqual(b.networkFailures, [])
  await b.close()
  b = undefined

  const fixtureRows = [
    { date: '2026-09-17', series_type: 'level', ron95: 2.6, ron97: 3.4, diesel: 2.95, diesel_eastmsia: 2.15, ron95_budi95: 1.99, ron95_skps: 2.05 },
    { date: '2026-09-17', series_type: 'change_weekly', ron95: 0, ron97: '999.99', diesel: -0.02 },
    { date: '2026-09-10', series_type: 'level', ron95: 2.6, ron97: 3.45, diesel: 2.97 },
  ]
  const fixture = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: fixtureRows }]]),
    blockedProviderPatterns: ['https://api.data.gov.my/*'],
  })
  try {
    await fixture.nav('malaysia-fuel-price')
    await fixture.ev(`(()=>{const input=document.querySelector('.parameter-card input[name="limit"]'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,'12'); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));})()`)
    const fixtureResult = await fixture.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await readDom(fixture)
    assert.equal(fixtureDom.state, 'partial')
    assert.equal(fixtureDom.requestBound, 'true')
    assert.equal(fixtureDom.providerCount, 3)
    assert.equal(fixtureDom.validCount, 2)
    assert.equal(fixtureDom.invalidCount, 1)
    assert.equal(fixtureDom.allText.includes('999.99'), false)
    assert.deepEqual(fixture.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(fixture.blockedProviders, [])
    assert.deepEqual(fixture.errors, [])
    report.checks.push({ id: 'malaysia-fuel-price', case: 'synthetic malformed numeric-string HTTP-200 row', semanticState: 'partial', requestBound: true, providerRows: 3, validRows: 2, invalidRows: 1, malformedProviderFactHidden: true, liveProviderRequests: 0 })
  } finally {
    await fixture.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/malaysia-fuel-price-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/malaysia-fuel-price-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
