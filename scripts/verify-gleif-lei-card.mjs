import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = `https://api.gleif.org/api/v1/lei-records?${new URLSearchParams({
  'filter[entity.legalName]': 'Royal Bank of Canada',
  'page[size]': '8',
}).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'exactly one live GLEIF legal-name request plus request-bound synthetic HTTP-200 fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const lei = (value) => /^[A-Z0-9]{20}$/.test(String(value || '').toUpperCase()) ? String(value).toUpperCase() : ''
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('gleif-lei')
  assert.equal(await b.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const liveBefore = b.requestCount
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(b.requestCount - liveBefore, 1, 'GLEIF verifier must issue exactly one production request')
  assert(Array.isArray(result.data?.data), 'GLEIF live response missing data[]')
  assert(result.data.data.length > 0, 'GLEIF default legal-name search unexpectedly empty')
  const pagination = result.data?.meta?.pagination
  assert.equal(pagination?.currentPage, 1)
  assert.equal(pagination?.perPage, 8)
  assert.equal(pagination?.from, 1)
  assert.equal(pagination?.to, result.data.data.length)
  assert.equal(pagination?.lastPage, Math.ceil(pagination.total / pagination.perPage))
  assert.equal(result.data.data.length, Math.min(pagination.perPage, pagination.total))
  const first = result.data.data[0]
  const providerLei = lei(first?.attributes?.lei)
  assert(providerLei, 'GLEIF first record missing valid provider LEI')
  assert.equal(lei(first?.id), providerLei, 'GLEIF record id/attributes.lei mismatch')
  assert.equal(first?.type, 'lei-records')
  const providerName = String(first?.attributes?.entity?.legalName?.name || '')
  assert(providerName, 'GLEIF first record missing legal name')

  const dom = await b.ev(`(() => {
    const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('.legal-entity-preview')
    const first=card?.querySelector('[data-record-index="1"]')
    const metrics=Object.fromEntries([...first.querySelectorAll('dl > div')].map((row)=>[row.querySelector('dt')?.textContent||'',row.querySelector('dd')?.textContent||'']))
    return {
      layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'',
      requested:card?.dataset.requestedLegalName||'', requestedSize:card?.dataset.requestedPageSize||'', providerCurrentPage:card?.dataset.providerCurrentPage||'', providerSize:card?.dataset.providerPageSize||'',
      providerFrom:card?.dataset.providerFrom||'', providerTo:card?.dataset.providerTo||'', providerTotal:card?.dataset.providerMatchCount||'', providerLastPage:card?.dataset.providerLastPage||'', paginationValid:card?.dataset.paginationContractValid||'',
      providerCount:card?.dataset.providerRecordCount||'', validCount:card?.dataset.validRecordCount||'', invalidCount:card?.dataset.invalidRecordCount||'', incompleteCount:card?.dataset.incompleteRecordCount||'',
      primaryLei:card?.dataset.primaryLei||'', primaryName:card?.dataset.primaryLegalName||'', entityStatus:card?.dataset.primaryEntityStatus||'', registrationStatus:card?.dataset.primaryRegistrationStatus||'',
      title:first?.querySelector('h3')?.textContent||'', metricLei:metrics.LEI||'', headquarters:metrics.Headquarters||'',
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
    }
  })()`)
  assert.equal(dom.layout, 'legal-entity'); assert.equal(dom.fallback, 'false'); assert.equal(dom.state, 'ready'); assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requested, 'Royal Bank of Canada'); assert.equal(dom.requestedSize, '8'); assert.equal(dom.providerCurrentPage, '1'); assert.equal(dom.providerSize, '8')
  assert.equal(dom.providerFrom, '1'); assert.equal(dom.providerTo, String(result.data.data.length)); assert.equal(dom.providerTotal, String(pagination.total)); assert.equal(dom.providerLastPage, String(pagination.lastPage)); assert.equal(dom.paginationValid, 'true')
  assert.equal(Number(dom.providerCount), result.data.data.length); assert.equal(Number(dom.validCount), result.data.data.length); assert.equal(dom.invalidCount, '0'); assert.equal(dom.incompleteCount, '0')
  assert.equal(dom.primaryLei, providerLei); assert.equal(dom.primaryName, providerName); assert.equal(dom.title, providerName); assert.equal(dom.metricLei, providerLei)
  assert.equal(dom.entityStatus, String(first.attributes.entity.status || '')); assert.equal(dom.registrationStatus, String(first.attributes.registration.status || '')); assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'gleif-lei', case:'live legal-name search contract', semanticState:'ready', requestBound:true, leiIdentity:'record.id === attributes.lei', pagination:'first-page current/from/to/total/lastPage/count coherence', legalName:'provider result', browserCorsReadable:true, liveProviderRequests:1, mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const fixture = {
    data: [
      first,
      {
        type: 'lei-records', id: '5493008WOGQAQLWW1073',
        attributes: { lei: 'ES7IP3U3RHIGC71XBU11', entity: { legalName: { name: 'Fabricated Entity' }, status: 'ACTIVE' }, registration: { status: 'ISSUED' } },
      },
    ],
    meta: { pagination: { currentPage: 1, perPage: 8, from: 1, to: 2, total: 2, lastPage: 1 } },
  }
  const mismatch = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixture }]]) })
  try {
    await mismatch.nav('gleif-lei'); const fixtureBefore = mismatch.requestCount; const run = await mismatch.run(); assert.equal(run.ok, true, run.error)
    const x = await mismatch.ev(`(()=>{const c=document.querySelector('.legal-entity-preview');return {state:c?.dataset.resultState||'',requestBound:c?.dataset.requestBound||'',provider:c?.dataset.providerRecordCount||'',valid:c?.dataset.validRecordCount||'',invalid:c?.dataset.invalidRecordCount||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(x.state, 'partial'); assert.equal(x.requestBound, 'true'); assert.equal(x.provider, '2'); assert.equal(x.valid, '1'); assert.equal(x.invalid, '1'); assert.equal(x.text.includes('Fabricated Entity'), false); assert.match(x.http, /^200/)
    const fixtureRequests = mismatch.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
    assert.equal(fixtureRequests, 1); assert.equal(mismatch.requestCount - fixtureBefore, fixtureRequests, 'Fixture case must send zero live provider requests'); assert.deepEqual(mismatch.errors, [])
    report.checks.push({ id:'gleif-lei', case:'synthetic mixed wrong-LEI HTTP-200', transportStatus:200, semanticState:'partial', requestBound:true, providerRecords:2, validRecords:1, invalidRecords:1, fabricatedEntityHidden:true, liveProviderRequests:0 })
  } finally { await mismatch.close() }

  const paginationCases = [
    {
      name: 'synthetic coherent short first page',
      body: { data: [first], meta: { pagination: { currentPage: 1, perPage: 8, from: 1, to: 1, total: 1, lastPage: 1 } } },
      expectedState: 'ready',
      expectedContract: 'true',
    },
    {
      name: 'synthetic truncated first page HTTP-200',
      body: { data: [first], meta: { pagination: { currentPage: 1, perPage: 8, from: 1, to: 1, total: 17, lastPage: 3 } } },
      expectedState: 'partial',
      expectedContract: 'false',
    },
    {
      name: 'synthetic numeric-string pagination HTTP-200',
      body: { data: [first], meta: { pagination: { currentPage: '1', perPage: '8', from: '1', to: '1', total: '1', lastPage: '1' } } },
      expectedState: 'partial',
      expectedContract: 'false',
    },
  ]
  for (const testCase of paginationCases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: testCase.body }]]) })
    try {
      await fixtureBrowser.nav('gleif-lei')
      const run = await fixtureBrowser.run()
      assert.equal(run.ok, true, run.error)
      const state = await fixtureBrowser.ev(`(()=>{const c=document.querySelector('.legal-entity-preview');return {state:c?.dataset.resultState||'',paginationValid:c?.dataset.paginationContractValid||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
      assert.equal(state.state, testCase.expectedState)
      assert.equal(state.paginationValid, testCase.expectedContract)
      assert.match(state.http, /^200/)
      assert.equal(fixtureBrowser.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
      assert.deepEqual(fixtureBrowser.errors, [])
      report.checks.push({ id:'gleif-lei', case:testCase.name, transportStatus:200, semanticState:testCase.expectedState, paginationContractValid:testCase.expectedContract === 'true', exactProviderFixtureRequests:1 })
    } finally {
      await fixtureBrowser.close()
    }
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/gleif-lei-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/gleif-lei-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
