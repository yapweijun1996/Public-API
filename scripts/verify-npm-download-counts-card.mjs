import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live npm point-download response plus an exact synthetic wrong-package HTTP-200 fixture',
  checks: [],
  errors: [],
}
const actionableRoles = new Set(['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'])
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && actionableRoles.has(node.role?.value) && !(node.name?.value || '').trim())

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('npm-download-counts')
  const endpoint = await b.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert(endpoint, 'npm download endpoint was not exposed')
  const requestUrl = new URL(endpoint)
  assert.equal(requestUrl.origin, 'https://api.npmjs.org')
  assert.equal(requestUrl.pathname, '/downloads/point/last-week/react')

  const live = await b.run()
  assert.equal(live.ok, true, live.error)
  assert.equal(live.data?.package, 'react')
  assert.equal(typeof live.data?.downloads, 'number')
  assert(Number.isSafeInteger(live.data.downloads) && live.data.downloads >= 0)
  assert.match(String(live.data?.start || ''), /^\d{4}-\d{2}-\d{2}$/)
  assert.match(String(live.data?.end || ''), /^\d{4}-\d{2}-\d{2}$/)
  const liveDays = (Date.parse(`${live.data.end}T00:00:00Z`) - Date.parse(`${live.data.start}T00:00:00Z`)) / 86400000 + 1
  assert.equal(liveDays, 7)

  const dom = await b.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="download-summary"]'); return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestedPackage:card?.dataset.requestedPackage||'', providerPackage:card?.dataset.providerPackage||'',
    requestedPeriod:card?.dataset.requestedPeriod||'', providerStart:card?.dataset.providerStart||'', providerEnd:card?.dataset.providerEnd||'',
    windowDays:Number(card?.dataset.windowDays), identityMatch:card?.dataset.identityMatch||'', periodContract:card?.dataset.periodContract||'',
    downloadContract:card?.dataset.downloadContract||'', downloads:Number(card?.querySelector('[data-download-count]')?.dataset.downloadCount),
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  } })()` )
  assert.deepEqual({
    layout:dom.layout, fallback:dom.fallback, state:dom.state, requestedPackage:dom.requestedPackage, providerPackage:dom.providerPackage,
    requestedPeriod:dom.requestedPeriod, providerStart:dom.providerStart, providerEnd:dom.providerEnd, windowDays:dom.windowDays,
    identityMatch:dom.identityMatch, periodContract:dom.periodContract, downloadContract:dom.downloadContract, downloads:dom.downloads,
  }, {
    layout:'download-summary', fallback:'false', state:'ready', requestedPackage:'react', providerPackage:'react',
    requestedPeriod:'last-week', providerStart:live.data.start, providerEnd:live.data.end, windowDays:7,
    identityMatch:'true', periodContract:'true', downloadContract:'true', downloads:live.data.downloads,
  })
  assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0, 'unnamed actionable controls')
  assert.deepEqual(b.errors, [], `browser errors ${b.errors.join(' | ')}`)
  report.checks.push({ id:'npm-download-counts', case:'live request-bound point total', providerPackage:live.data.package, providerWindow:`${live.data.start}:${live.data.end}`, windowDays:7, semanticState:'ready', identityMatch:true, periodContract:true, mobileOverflow:false, unnamedControls:0 })
  await b.close(); b = undefined

  const wrongPackage = { downloads: 987654321, start: live.data.start, end: live.data.end, package: 'lodash' }
  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrongPackage }]]) })
  try {
    await malformed.nav('npm-download-counts')
    const result = await malformed.run()
    assert.equal(result.ok, true, result.error)
    const invalid = await malformed.ev(`(() => { const card=document.querySelector('[data-domain-card="download-summary"]'); return { state:card?.dataset.resultState||'', identityMatch:card?.dataset.identityMatch||'', text:card?.innerText||'', http:document.querySelector('.ssot-runtime b')?.textContent||'' } })()` )
    assert.equal(invalid.state, 'invalid')
    assert.equal(invalid.identityMatch, 'false')
    assert.match(invalid.text, /package identity does not match/i)
    assert.match(invalid.http, /^200/)
    assert.doesNotMatch(invalid.text, /987,654,321/)
    assert.equal(malformed.fixtureRequests.filter((item) => item.url === endpoint && item.method === 'GET').length, 1)
    assert.deepEqual(malformed.errors, [])
    report.checks.push({ id:'npm-download-counts', case:'synthetic wrong-package HTTP-200', transportStatus:200, semanticState:'invalid', plausibleDownloadCountHidden:true, exactProviderFixtureRequests:1 })
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

fs.writeFileSync(`${evidence}/npm-download-counts-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/npm-download-counts-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
