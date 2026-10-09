import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.jolpi.ca/ergast/f1/2025/1/qualifying/'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Jolpica season/round qualifying response plus exact synthetic wrong-identity and unrelated-envelope HTTP-200 fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const fixtureResponse = {
  MRData: {
    series: 'f1',
    limit: '30',
    offset: '0',
    total: '1',
    RaceTable: {
      season: '2025',
      round: '1',
      Races: [{
        season: '2025',
        round: '1',
        raceName: 'Australian Grand Prix',
        Circuit: {
          circuitId: 'albert_park',
          circuitName: 'Albert Park Grand Prix Circuit',
          Location: { locality: 'Melbourne', country: 'Australia' },
        },
        QualifyingResults: [{
          number: '4',
          position: '1',
          Driver: { driverId: 'norris', code: 'NOR', givenName: 'Lando', familyName: 'Norris', nationality: 'British' },
          Constructor: { constructorId: 'mclaren', name: 'McLaren', nationality: 'British' },
          Q1: '1:15.912',
          Q2: '1:15.415',
          Q3: '1:15.096',
        }],
      }],
    },
  },
}

const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="jolpica-qualifying"]'),first=card?.querySelector('[data-record-index="1"]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',requestedSeason:card?.dataset.requestedSeason||'',requestedRound:card?.dataset.requestedRound||'',providerSeason:card?.dataset.providerSeason||'',providerRound:card?.dataset.providerRound||'',identityMatch:card?.dataset.identityMatch||'',providerTotal:Number(card?.dataset.providerTotal),providerResults:Number(card?.dataset.providerResultCount),validResults:Number(card?.dataset.validResultCount),invalidResults:Number(card?.dataset.invalidResultCount),primaryDriverId:card?.dataset.primaryDriverId||'',firstText:first?.innerText||'',allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  }
})()`)

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
  await b.nav('openf1-historical')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  const race = result.data?.MRData?.RaceTable?.Races?.[0]
  const results = race?.QualifyingResults
  assert(Array.isArray(results) && results.length > 0, 'Jolpica returned no qualifying classification for the default completed race')
  const first = results[0]
  const dom = await readDom(b)
  assert.equal(dom.layout, 'motorsport-results')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-jolpica-season-round-qualifying')
  assert.equal(dom.requestedSeason, '2025')
  assert.equal(dom.requestedRound, '1')
  assert.equal(dom.providerSeason, '2025')
  assert.equal(dom.providerRound, '1')
  assert.equal(dom.identityMatch, 'true')
  assert.equal(dom.providerResults, results.length)
  assert.equal(dom.validResults, results.length)
  assert.equal(dom.invalidResults, 0)
  assert.equal(dom.primaryDriverId, String(first.Driver?.driverId))
  assert(dom.firstText.includes([first.Driver?.givenName, first.Driver?.familyName].filter(Boolean).join(' ')))
  if (first.Q3) assert(dom.firstText.includes(String(first.Q3)))
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.overflow, false)
  await verifyMobileAx(b)
  report.checks.push({ id: 'openf1-historical', case: 'live exact season/round qualifying classification', semanticState: dom.state, requestBound: true, providerResults: results.length, primaryDriverIdentity: 'exact response match', mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close()
  b = undefined

  const wrongIdentityBody = structuredClone(fixtureResponse)
  wrongIdentityBody.MRData.RaceTable.season = '2024'
  wrongIdentityBody.MRData.RaceTable.round = '2'
  wrongIdentityBody.MRData.RaceTable.Races[0].season = '2024'
  wrongIdentityBody.MRData.RaceTable.Races[0].round = '2'
  const wrongIdentity = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: wrongIdentityBody }]]),
    blockedProviderPatterns: ['https://api.jolpi.ca/*'],
  })
  try {
    await wrongIdentity.nav('openf1-historical')
    const result = await wrongIdentity.run()
    assert.equal(result.ok, true, result.error)
    const dom = await readDom(wrongIdentity)
    assert.equal(dom.state, 'invalid')
    assert.equal(dom.identityMatch, 'false')
    assert.equal(dom.allText.includes('Lando Norris'), false)
    assert.deepEqual(wrongIdentity.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(wrongIdentity.blockedProviders, [])
    assert.deepEqual(wrongIdentity.errors, [])
    report.checks.push({ id: 'openf1-historical', case: 'synthetic wrong-season/round HTTP-200 response', semanticState: 'invalid', providerIdentityHidden: true, liveProviderRequests: 0 })
  } finally { await wrongIdentity.close() }

  const unrelatedEnvelope = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: { events: [{ name: 'Injected Grand Prix', competitions: [] }] } }]]),
    blockedProviderPatterns: ['https://api.jolpi.ca/*'],
  })
  try {
    await unrelatedEnvelope.nav('openf1-historical')
    const result = await unrelatedEnvelope.run()
    assert.equal(result.ok, true, result.error)
    const dom = await readDom(unrelatedEnvelope)
    assert.equal(dom.state, 'invalid')
    assert.equal(dom.allText.includes('Injected Grand Prix'), false)
    assert.deepEqual(unrelatedEnvelope.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(unrelatedEnvelope.blockedProviders, [])
    assert.deepEqual(unrelatedEnvelope.errors, [])
    report.checks.push({ id: 'openf1-historical', case: 'synthetic unrelated ESPN-shaped HTTP-200 response', semanticState: 'invalid', unrelatedFactsHidden: true, liveProviderRequests: 0 })
  } finally { await unrelatedEnvelope.close() }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/jolpica-qualifying-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/jolpica-qualifying-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
