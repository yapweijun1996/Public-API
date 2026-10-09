import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = `https://rickandmortyapi.com/api/character?${new URLSearchParams({ name: 'Rick' }).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Rick and Morty character search plus one exact synthetic HTTP-200 semantic fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())
const trustedLiveRow = (row) => row && typeof row === 'object'
  && Number.isSafeInteger(row.id) && row.id > 0
  && typeof row.name === 'string' && row.name.toLowerCase().includes('rick')
  && ['Alive', 'Dead', 'unknown'].includes(row.status)
  && typeof row.species === 'string' && row.species.trim()
  && ['Female', 'Male', 'Genderless', 'unknown'].includes(row.gender)
  && row.url === `https://rickandmortyapi.com/api/character/${row.id}`
  && row.image === `https://rickandmortyapi.com/api/character/avatar/${row.id}.jpeg`
  && Array.isArray(row.episode)
const semantic = (instance) => instance.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="rick-morty-characters"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', query:card?.dataset.characterQuery||'', status:card?.dataset.statusFilter||'', providerCount:Number(card?.dataset.providerCount||0), providerPages:Number(card?.dataset.providerPages||0), providerRecordCount:Number(card?.dataset.providerRecordCount||0), trustedCount:Number(card?.dataset.trustedRecordCount||0), malformedCount:Number(card?.dataset.malformedEvidenceCount||0), duplicateCount:Number(card?.dataset.duplicateEvidenceCount||0), mismatchCount:Number(card?.dataset.filterMismatchCount||0), primaryId:Number(card?.dataset.primaryCharacterId||0), text:card?.innerText||'' }; })()`)

const fixtureCharacter = (id, name, overrides = {}) => ({
  id,
  name,
  status: 'Alive',
  species: 'Human',
  type: '',
  gender: 'Male',
  origin: { name: 'Earth (C-137)', url: 'https://rickandmortyapi.com/api/location/1' },
  location: { name: 'Citadel of Ricks', url: 'https://rickandmortyapi.com/api/location/3' },
  image: `https://rickandmortyapi.com/api/character/avatar/${id}.jpeg`,
  episode: ['https://rickandmortyapi.com/api/episode/1'],
  url: `https://rickandmortyapi.com/api/character/${id}`,
  created: '2017-11-04T18:48:46.250Z',
  ...overrides,
})

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('rick-morty-characters')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Rick and Morty verifier must issue exactly one live provider request')
  assert(result.data && typeof result.data === 'object' && !Array.isArray(result.data), 'Rick and Morty live response must be an envelope')
  assert(result.data.info && Number.isSafeInteger(result.data.info.count) && Number.isSafeInteger(result.data.info.pages), 'Provider pagination metadata drifted')
  assert(Array.isArray(result.data.results) && result.data.results.length === Math.min(20, result.data.info.count), 'Provider first-page cardinality drifted')
  assert(result.data.results.every(trustedLiveRow), 'Provider character identity/filter wire contract drifted')
  assert.equal(new Set(result.data.results.map((row) => row.id)).size, result.data.results.length, 'Live response returned duplicate character IDs')
  const primary = result.data.results[0]
  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    query: dom.query,
    status: dom.status,
    providerCount: dom.providerCount,
    providerPages: dom.providerPages,
    providerRecordCount: dom.providerRecordCount,
    trustedCount: dom.trustedCount,
    malformedCount: dom.malformedCount,
    duplicateCount: dom.duplicateCount,
    mismatchCount: dom.mismatchCount,
    primaryId: dom.primaryId,
  }, {
    layout: 'character-search',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-rick-morty-character-search-v2',
    query: 'Rick',
    status: 'all',
    providerCount: result.data.info.count,
    providerPages: result.data.info.pages,
    providerRecordCount: result.data.results.length,
    trustedCount: result.data.results.length,
    malformedCount: 0,
    duplicateCount: 0,
    mismatchCount: 0,
    primaryId: primary.id,
  })
  assert(dom.text.includes(primary.name), 'Primary character name missing from semantic DOM')
  assert(dom.text.includes('no media-reuse license claim'), 'Character-media rights boundary missing from semantic DOM')
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({
    id: 'rick-morty-characters',
    source: 'live provider',
    exactRequest: endpoint,
    providerCount: result.data.info.count,
    providerPages: result.data.info.pages,
    returnedRecords: result.data.results.length,
    primaryCharacterId: primary.id,
    semanticState: dom.state,
    requestBound: dom.requestBound,
    browserCorsReadable: true,
    mobileOverflow: false,
    unnamedControls: 0,
  })
  await live.close(); active = undefined

  const fixtureBody = {
    info: { count: 4, pages: 1, next: null, prev: null },
    results: [
      fixtureCharacter(1, 'Rick Sanchez'),
      fixtureCharacter(1, 'Rick Duplicate'),
      fixtureCharacter(2, 'Morty Smith'),
      fixtureCharacter('3', 'Rick malformed identity', { image: 'https://rickandmortyapi.com/api/character/avatar/3.jpeg', url: 'https://rickandmortyapi.com/api/character/3' }),
    ],
  }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('rick-morty-characters')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({
    state: fixtureDom.state,
    requestBound: fixtureDom.requestBound,
    providerRecordCount: fixtureDom.providerRecordCount,
    trustedCount: fixtureDom.trustedCount,
    malformedCount: fixtureDom.malformedCount,
    duplicateCount: fixtureDom.duplicateCount,
    mismatchCount: fixtureDom.mismatchCount,
    primaryId: fixtureDom.primaryId,
  }, {
    state: 'partial',
    requestBound: 'true',
    providerRecordCount: 4,
    trustedCount: 1,
    malformedCount: 1,
    duplicateCount: 1,
    mismatchCount: 1,
    primaryId: 1,
  })
  assert.equal(fixtureDom.text.includes('Rick Duplicate'), false)
  assert.equal(fixtureDom.text.includes('Morty Smith'), false)
  assert.equal(fixtureDom.text.includes('Rick malformed identity'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture Rick and Morty case must send zero live provider requests')
  assert.deepEqual(fixture.errors, [])
  report.checks.push({
    id: 'rick-morty-characters',
    case: 'mixed duplicate/filter-mismatch/malformed HTTP-200 fixture',
    source: 'synthetic fixture',
    semanticState: fixtureDom.state,
    trustedRecords: 1,
    malformedEvidence: 1,
    duplicateEvidence: 1,
    filterMismatchEvidence: 1,
    fabricatedIdentityHidden: true,
    liveProviderRequests: 0,
  })
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

fs.writeFileSync(`${evidence}/rick-morty-characters-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/rick-morty-characters-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
