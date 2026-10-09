import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://services.swpc.noaa.gov/products/noaa-scales.json'
const scaleText = ['none', 'minor', 'moderate', 'strong', 'severe', 'extreme']
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'NOAA Space Weather fixed-request binding, decimal-string R/S/G scales, missing-vs-zero semantics, mobile layout, and accessibility',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const parseScale = (value) => typeof value === 'string' && /^[0-5]$/.test(value) ? Number(value) : undefined
const validScale = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const scale = parseScale(value.Scale)
  return scale !== undefined && typeof value.Text === 'string' && value.Text.trim().toLowerCase() === scaleText[scale]
}
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const validTime = (value) => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value)
const semanticDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="noaa-space-weather-scales"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', valid:Number(card?.dataset.currentValidScaleCount||0), invalid:Number(card?.dataset.currentInvalidScaleCount||0),
    peak:card?.dataset.currentPeakScale===''?null:Number(card?.dataset.currentPeakScale), observedAt:card?.dataset.currentObservedAt||'',
    forecastValid:Number(card?.dataset.forecastValidCount||0), forecastInvalid:Number(card?.dataset.forecastInvalidCount||0), text:card?.innerText||'',
  };
})()`)

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('noaa-space-weather')
  assert.equal(await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`), endpoint)
  const before = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - before, 1, 'NOAA live journey must issue exactly one provider request')
  assert(result.data && typeof result.data === 'object' && !Array.isArray(result.data), 'NOAA response must be an object')
  const current = result.data['0']
  assert(current && typeof current === 'object' && !Array.isArray(current), 'NOAA current scale row is missing')
  const currentScales = ['R', 'S', 'G'].map((key) => current[key])
  const validCurrentCount = currentScales.filter(validScale).length
  assert(validCurrentCount > 0, 'Live NOAA response contains no trustworthy current scale evidence')
  const peak = Math.max(...currentScales.filter(validScale).map((value) => parseScale(value.Scale)))
  const timestampValid = validDate(current.DateStamp) && validTime(current.TimeStamp)
  const forecastRows = ['1', '2', '3'].filter((key) => result.data[key] !== undefined).map((key) => result.data[key])
  const invalidForecastCount = forecastRows.filter((row) => !(row && typeof row === 'object' && !Array.isArray(row) && validDate(row.DateStamp) && validScale(row.G))).length
  const expectedState = validCurrentCount === 3 && timestampValid && invalidForecastCount === 0 ? 'ready' : 'partial'

  const dom = await semanticDom(active)
  assert.equal(dom.layout, 'space-weather-scales')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.state, expectedState)
  assert.equal(dom.valid, validCurrentCount)
  assert.equal(dom.invalid, 3 - validCurrentCount)
  assert.equal(dom.peak, peak)
  assert.equal(dom.forecastInvalid, invalidForecastCount)
  if (timestampValid) assert.equal(dom.observedAt, `${current.DateStamp}T${current.TimeStamp}Z`)
  for (const [index, key] of ['R', 'S', 'G'].entries()) {
    const value = currentScales[index]
    if (validScale(value)) assert.match(dom.text, new RegExp(`${key}${value.Scale} · ${value.Text}`, 'i'))
  }

  await active.viewport(390, 844)
  const mobile = await active.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1,cardOverflow:document.querySelector('[data-domain-card="noaa-space-weather-scales"]').scrollWidth>document.querySelector('[data-domain-card="noaa-space-weather-scales"]').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await active.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(active.errors, [])
  report.checks.push({ case: 'live NOAA Space Weather Scales product', transportStatus: 200, semanticState: dom.state, currentValidScales: dom.valid, currentInvalidScales: dom.invalid, peakScale: dom.peak, forecastInvalidRows: dom.forecastInvalid, decimalStringScales: true, requestBinding: true, cors: 'browser request succeeded', mobileOverflow: false, unnamedControls: 0, liveProviderRequests: 1, retries: 0 })
  await active.close()
  active = undefined

  const fixture = {
    0: {
      DateStamp: '2026-09-15', TimeStamp: '16:08:00',
      R: { Scale: null, Text: null, MinorProb: null, MajorProb: null },
      S: { Scale: '0', Text: 'none', Prob: null },
      G: { Scale: '1', Text: 'minor' },
    },
    1: { DateStamp: '2026-09-16', TimeStamp: '00:00:00', G: { Scale: '0', Text: 'none' } },
  }
  active = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixture }]]) })
  await active.nav('noaa-space-weather')
  const fixtureBefore = active.requestCount
  const fixtureRun = await active.run()
  assert.equal(fixtureRun.ok, true, fixtureRun.error)
  const fixtureDom = await semanticDom(active)
  assert.equal(fixtureDom.state, 'partial')
  assert.equal(fixtureDom.valid, 2)
  assert.equal(fixtureDom.invalid, 1)
  assert.match(fixtureDom.text, /Radio blackout · Unavailable/)
  assert.doesNotMatch(fixtureDom.text, /Radio blackout · R0/)
  const exactFixtureRequests = active.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(exactFixtureRequests, 1)
  assert.equal(active.requestCount - fixtureBefore, exactFixtureRequests)
  assert.deepEqual(active.errors, [])
  report.checks.push({ case: 'fixture-only missing current R evidence', semanticState: fixtureDom.state, validScales: fixtureDom.valid, invalidScales: fixtureDom.invalid, fabricatedZero: false, exactFixtureRequests, liveProviderRequests: 0 })
  await active.close()
  active = undefined

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/noaa-space-weather-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/noaa-space-weather-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
