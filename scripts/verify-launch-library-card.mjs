import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const search = 'SpaceX'
const limit = 4
const endpoint = `https://ll.thespacedevs.com/2.3.0/launches/upcoming/?${new URLSearchParams({ search, limit: String(limit), ordering: 'net' }).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'at most one live Launch Library production request plus one synthetic HTTP-200 semantic fixture',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())

const uuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const strictText = (value) => typeof value === 'string' && value.trim() === value && value.length > 0
const rowSearchFields = (row) => {
  const fields = [row?.name, row?.launch_service_provider?.name, row?.mission?.name, row?.pad?.name, row?.pad?.location?.name,
    row?.rocket?.configuration?.name, row?.rocket?.configuration?.manufacturer?.abbrev, row?.rocket?.configuration?.manufacturer?.name,
    row?.rocket?.spacecraftflight?.spacecraft?.name]
  return fields.filter(strictText).map((value) => value.toLowerCase())
}
const matchesSearch = (row) => search.toLowerCase().split(/[\s,]+/).filter(Boolean).every((term) => rowSearchFields(row).some((value) => value.includes(term)))
const trustedLiveRow = (row) => {
  if (!row || typeof row !== 'object' || Array.isArray(row) || !uuid(row.id) || !strictText(row.name)
    || !strictText(row.net) || !Number.isFinite(Date.parse(row.net)) || !row.status || typeof row.status !== 'object'
    || !Number.isSafeInteger(row.status.id) || row.status.id <= 0 || !strictText(row.status.name) || !matchesSearch(row)) return false
  try {
    const url = new URL(row.url)
    return url.protocol === 'https:' && url.hostname === 'll.thespacedevs.com' && !url.username && !url.password
      && url.pathname === `/2.3.0/launches/${row.id}/`
  } catch {
    return false
  }
}

const semantic = (instance) => instance.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="launch-library-upcoming"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', search:card?.dataset.searchTerm||'',
    limit:Number(card?.dataset.requestedLimit||0), order:card?.dataset.requestOrder||'', providerCount:Number(card?.dataset.providerCount||0),
    providerRows:Number(card?.dataset.providerRecordCount||0), trusted:Number(card?.dataset.trustedRecordCount||0),
    malformed:Number(card?.dataset.malformedEvidenceCount||0), duplicates:Number(card?.dataset.duplicateEvidenceCount||0),
    mismatches:Number(card?.dataset.searchMismatchCount||0), primaryId:card?.dataset.primaryLaunchId||'', primaryNet:card?.dataset.primaryNet||'',
    primaryStatus:card?.dataset.primaryStatus||'', primaryProvider:card?.dataset.primaryProvider||'', text:card?.innerText||''
  };
})()`)

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']
const fixtureLaunch = (id, overrides = {}) => ({
  id, url: `https://ll.thespacedevs.com/2.3.0/launches/${id}/`, name: `Falcon 9 | SpaceX fixture ${id.slice(0, 4)}`,
  net: '2026-09-20T12:30:00Z', status: { id: 1, name: 'Go for Launch', abbrev: 'Go' },
  launch_service_provider: { id: 121, name: 'SpaceX' }, pad: { id: 87, name: 'LC-39A', location: { id: 27, name: 'Kennedy Space Center, FL, USA' } },
  mission: { id: 9001, name: 'Fixture mission' }, rocket: { configuration: { id: 164, name: 'Falcon 9 Block 5', manufacturer: { id: 121, name: 'SpaceX', abbrev: 'SpX' } } },
  ...overrides,
})

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('launch-library-upcoming')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const response = await live.run()
  assert.equal(response.ok, true, response.error)
  assert.equal(live.requestCount - before, 1, 'Launch Library verifier must issue exactly one production request')
  assert(response.data && typeof response.data === 'object' && !Array.isArray(response.data))
  assert(Number.isSafeInteger(response.data.count) && response.data.count >= 0, 'Launch Library count wire type drifted')
  assert.equal(response.data.previous, null, 'First-page previous link must be null')
  assert(Array.isArray(response.data.results), 'Launch Library result list drifted')
  assert.equal(response.data.results.length, Math.min(limit, response.data.count), 'Launch Library first-page cardinality drifted')
  assert(response.data.results.every(trustedLiveRow), 'Launch Library native/search identity contract drifted')
  assert.equal(new Set(response.data.results.map((row) => row.id)).size, response.data.results.length, 'Live launch IDs must be unique')

  const dom = await semantic(live)
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract,
    search:dom.search, limit:dom.limit, order:dom.order, providerCount:dom.providerCount, providerRows:dom.providerRows, trusted:dom.trusted,
    malformed:dom.malformed, duplicates:dom.duplicates, mismatches:dom.mismatches, primaryId:dom.primaryId }, {
    layout:'launch-schedule', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-launch-library-upcoming-v1',
    search, limit, order:'net', providerCount:response.data.count, providerRows:response.data.results.length, trusted:response.data.results.length,
    malformed:0, duplicates:0, mismatches:0, primaryId:response.data.results[0]?.id ?? '' })
  if (response.data.results[0]) {
    assert.equal(dom.primaryNet, response.data.results[0].net)
    assert.equal(dom.primaryStatus, response.data.results[0].status.name)
    assert.equal(dom.primaryProvider, response.data.results[0].launch_service_provider?.name ?? '')
    assert(dom.text.includes(response.data.results[0].name), 'Primary launch name missing from semantic DOM')
  }
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'launch-library-upcoming', source:'live provider', exactRequest:endpoint, providerCount:response.data.count,
    returnedRecords:response.data.results.length, primaryLaunchId:response.data.results[0]?.id ?? null, semanticState:dom.state,
    requestBound:dom.requestBound, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active = undefined

  const fixtureBody = { count:4, next:null, previous:null, results:[
    fixtureLaunch(ids[0]), fixtureLaunch(ids[0], { name:'Fabricated duplicate launch' }),
    fixtureLaunch(ids[2], { id:'not-a-uuid', name:'Fabricated malformed launch' }),
    fixtureLaunch(ids[3], { name:'Ariane 6 | Unrelated mission', launch_service_provider:{ id:115, name:'Arianespace' }, mission:{ id:7000, name:'Unrelated payload' },
      pad:{ id:1, name:'ELA-4', location:{ id:1, name:'Kourou, French Guiana' } }, rocket:{ configuration:{ id:999, name:'Ariane 6', manufacturer:{ id:115, name:'ArianeGroup', abbrev:'AG' } } } }),
  ] }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint, { body:fixtureBody }]]) })
  active = fixture
  await fixture.nav('launch-library-upcoming')
  const fixtureBefore = fixture.requestCount
  const fixtureResponse = await fixture.run()
  assert.equal(fixtureResponse.ok, true, fixtureResponse.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({ state:fixtureDom.state, requestBound:fixtureDom.requestBound, trusted:fixtureDom.trusted, malformed:fixtureDom.malformed,
    duplicates:fixtureDom.duplicates, mismatches:fixtureDom.mismatches, primaryId:fixtureDom.primaryId }, {
    state:'partial', requestBound:'true', trusted:1, malformed:1, duplicates:1, mismatches:1, primaryId:ids[0] })
  assert.equal(fixtureDom.text.includes('Fabricated duplicate launch'), false)
  assert.equal(fixtureDom.text.includes('Fabricated malformed launch'), false)
  assert.equal(fixtureDom.text.includes('Ariane 6 | Unrelated mission'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture case must send zero live provider requests')
  assert.deepEqual(fixture.blockedProviders, [])
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ id:'launch-library-upcoming', case:'duplicate/malformed/search-mismatch HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state,
    trustedRecords:1, malformedEvidence:1, duplicateEvidence:1, searchMismatchEvidence:1, fabricatedIdentitiesHidden:true, liveProviderRequests:0 })
  await fixture.close(); active = undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures }
} finally {
  if (active) await active.close()
}
fs.writeFileSync(`${evidence}/launch-library-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/launch-library-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
