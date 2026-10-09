import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = `https://api.fdic.gov/banks/institutions?${new URLSearchParams({
  search: 'NAME: WELLS FARGO',
  limit: '6',
  format: 'json',
}).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live FDIC institution-name search plus exact synthetic wrong-identity and wrong-acknowledgement HTTP-200 fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const positiveInteger = (value) => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : ''
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return ''
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? String(number) : ''
}
const formatted = (value) => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(Number(value))

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('fdic-bankfind')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data?.data), 'FDIC live response missing data[]')
  assert(result.data.data.length > 0, 'FDIC default institution-name search unexpectedly empty')
  assert(Number.isSafeInteger(result.data?.meta?.total) && result.data.meta.total >= result.data.data.length, 'FDIC live response has incoherent meta.total')
  assert.equal(result.data?.meta?.parameters?.search, 'NAME: WELLS FARGO')
  assert.equal(result.data?.meta?.parameters?.limit, '6')
  assert(result.data.data.length <= 6, 'FDIC returned more rows than the requested limit')
  const firstWrapper = result.data.data[0]
  assert(firstWrapper && typeof firstWrapper === 'object' && !Array.isArray(firstWrapper), 'FDIC first result is not a nested wrapper')
  const first = firstWrapper.data
  assert(first && typeof first === 'object' && !Array.isArray(first), 'FDIC first wrapper missing data object')
  const certificate = positiveInteger(first.CERT)
  assert(certificate, 'FDIC first result missing a positive integer certificate')
  if (Object.hasOwn(first, 'ID')) assert.equal(positiveInteger(first.ID), certificate, 'FDIC first result CERT/ID mismatch')
  const providerName = String(first.NAME || '').trim()
  assert(providerName, 'FDIC first result missing bank name')

  const dom = await b.ev(`(() => {
    const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('.bank-institution-preview')
    const first=card?.querySelector('[data-record-index="1"]')
    const metrics=Object.fromEntries([...first.querySelectorAll('dl > div')].map((row)=>[row.querySelector('dt')?.textContent||'',row.querySelector('dd')?.textContent||'']))
    return {
      layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
      requestedSearch:card?.dataset.requestedSearch||'', requestedLimit:card?.dataset.requestedLimit||'', providerSearch:card?.dataset.providerSearch||'', providerLimit:card?.dataset.providerLimit||'', acknowledgement:card?.dataset.acknowledgementMatch||'', requestValid:card?.dataset.requestContractValid||'',
      providerTotal:card?.dataset.providerTotal||'', providerMatchCount:card?.dataset.providerMatchCount||'', providerCount:card?.dataset.providerRecordCount||'', validCount:card?.dataset.validRecordCount||'', invalidCount:card?.dataset.invalidRecordCount||'', incompleteCount:card?.dataset.incompleteRecordCount||'',
      primaryName:card?.dataset.primaryBankName||'', certificate:card?.dataset.primaryFdicCertificate||'', status:card?.dataset.primaryStatus||'', active:card?.dataset.primaryActive||'', assets:card?.dataset.primaryAssetsThousands||'', deposits:card?.dataset.primaryDepositsThousands||'', offices:card?.dataset.primaryOfficeCount||'',
      title:first?.querySelector('h3')?.textContent||'', metricAssets:metrics['Total assets ($000s)']||'', metricDeposits:metrics['Total deposits ($000s)']||'', metricOffices:metrics.Offices||'',
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
    }
  })()`)
  assert.equal(dom.layout, 'bank-institution')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestedSearch, 'NAME: WELLS FARGO')
  assert.equal(dom.requestedLimit, '6')
  assert.equal(dom.providerSearch, result.data.meta.parameters.search)
  assert.equal(dom.providerLimit, result.data.meta.parameters.limit)
  assert.equal(dom.acknowledgement, 'true')
  assert.equal(dom.requestValid, 'true')
  assert.equal(Number(dom.providerTotal), result.data.meta.total)
  assert.equal(dom.providerMatchCount, dom.providerTotal)
  assert.equal(Number(dom.providerCount), result.data.data.length)
  assert.equal(Number(dom.validCount), result.data.data.length)
  assert.equal(dom.invalidCount, '0')
  assert.equal(dom.incompleteCount, '0')
  assert.equal(dom.primaryName, providerName)
  assert.equal(dom.certificate, certificate)
  assert.equal(dom.status, Number(first.ACTIVE) === 1 ? 'Active' : 'Former / inactive')
  assert.equal(dom.active, Number(first.ACTIVE) === 1 ? 'true' : 'false')
  assert.equal(Number(dom.assets), Number(first.ASSET))
  assert.equal(Number(dom.deposits), Number(first.DEP))
  assert.equal(Number(dom.offices), Number(first.OFFICES ?? first.OFFDOM))
  assert.equal(dom.title, providerName)
  assert.equal(dom.metricAssets, formatted(first.ASSET))
  assert.equal(dom.metricDeposits, formatted(first.DEP))
  assert.equal(dom.metricOffices, formatted(first.OFFICES ?? first.OFFDOM))
  assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id: 'fdic-bankfind', case: 'live fuzzy institution-name search contract', semanticState: 'ready', requestAcknowledgement: 'search and limit exact response match', certificateIdentity: 'CERT positive; ID matches when present', resultCount: result.data.data.length, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close()
  b = undefined

  const mixedFixture = {
    meta: { ...result.data.meta, total: 2, parameters: { ...result.data.meta.parameters, search: 'NAME: WELLS FARGO', limit: '6' } },
    data: [
      firstWrapper,
      { data: { ...first, CERT: 27389, ID: '3511', NAME: 'Fabricated Bank' }, score: 999 },
    ],
  }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: mixedFixture }]]) })
  try {
    await mixed.nav('fdic-bankfind')
    const run = await mixed.run()
    assert.equal(run.ok, true, run.error)
    const value = await mixed.ev(`(()=>{const c=document.querySelector('.bank-institution-preview');return {state:c?.dataset.resultState||'',provider:c?.dataset.providerRecordCount||'',valid:c?.dataset.validRecordCount||'',invalid:c?.dataset.invalidRecordCount||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(value.state, 'partial')
    assert.equal(value.provider, '2')
    assert.equal(value.valid, '1')
    assert.equal(value.invalid, '1')
    assert.equal(value.text.includes('Fabricated Bank'), false)
    assert.match(value.http, /^200/)
    assert.equal(mixed.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(mixed.errors, [])
    report.checks.push({ id: 'fdic-bankfind', case: 'synthetic mixed wrong-ID HTTP-200', transportStatus: 200, semanticState: 'partial', providerRecords: 2, validRecords: 1, invalidRecords: 1, fabricatedBankHidden: true, exactProviderFixtureRequests: 1 })
  } finally {
    await mixed.close()
  }

  const wrongAckFixture = {
    meta: { ...result.data.meta, total: 1, parameters: { ...result.data.meta.parameters, search: 'NAME: BANK OF AMERICA', limit: '6' } },
    data: [firstWrapper],
  }
  const wrongAck = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrongAckFixture }]]) })
  try {
    await wrongAck.nav('fdic-bankfind')
    const run = await wrongAck.run()
    assert.equal(run.ok, true, run.error)
    const value = await wrongAck.ev(`(()=>{const c=document.querySelector('.bank-institution-preview');return {state:c?.dataset.resultState||'',acknowledgement:c?.dataset.acknowledgementMatch||'',requestValid:c?.dataset.requestContractValid||'',primaryName:c?.dataset.primaryBankName||'',certificate:c?.dataset.primaryFdicCertificate||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(value.state, 'invalid')
    assert.equal(value.acknowledgement, 'false')
    assert.equal(value.requestValid, 'false')
    assert.equal(value.primaryName, '')
    assert.equal(value.certificate, '')
    assert.equal(value.text.includes(providerName), false)
    assert.match(value.http, /^200/)
    assert.equal(wrongAck.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(wrongAck.errors, [])
    report.checks.push({ id: 'fdic-bankfind', case: 'synthetic wrong-search acknowledgement HTTP-200', transportStatus: 200, semanticState: 'invalid', bankDetailsHidden: true, exactProviderFixtureRequests: 1 })
  } finally {
    await wrongAck.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}
fs.writeFileSync(`${evidence}/fdic-bank-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/fdic-bank-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
