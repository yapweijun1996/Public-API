import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'singapore'
const mediaType = 'texts'
const rows = 6
const fields = ['identifier', 'title', 'creator', 'date', 'mediatype', 'rights', 'licenseurl']
const params = new URLSearchParams({ q: `${query} AND mediatype:${mediaType}`, rows: String(rows), page: '1', output: 'json' })
for (const field of fields) params.append('fl[]', field)
const endpoint = `https://archive.org/advancedsearch.php?${params.toString()}`
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'fixture-only Internet Archive policy-safe semantic verification; no live provider request', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const semantic = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="internet-archive-search"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', query:card?.dataset.requestQuery||'', mediaType:card?.dataset.requestMediaType||'', requestedRows:Number(card?.dataset.requestedRowCount||0), providerTotal:Number(card?.dataset.providerTotal||0), providerStart:Number(card?.dataset.providerStart||0), providerCount:Number(card?.dataset.providerRecordCount||0), validCount:Number(card?.dataset.validRecordCount||0), malformed:Number(card?.dataset.malformedRecordCount||0), duplicates:Number(card?.dataset.duplicateRecordCount||0), overflow:Number(card?.dataset.overflowRecordCount||0), optionalWarnings:Number(card?.dataset.optionalWarningCount||0), rightsEvidence:Number(card?.dataset.rightsEvidenceCount||0), licenseEvidence:Number(card?.dataset.licenseEvidenceCount||0), countContract:card?.dataset.countContract||'', primaryIdentifier:card?.dataset.primaryIdentifier||'', text:card?.innerText||'' }; })()`)

const response = (docs) => ({
  responseHeader: { status: 0, params: { qin: `${query} AND mediatype:${mediaType}`, fl: fields.join(','), wt: 'json', rows, start: 0 } },
  response: { numFound: docs.length, start: 0, docs },
})
const item = (identifier, overrides = {}) => ({ identifier, title: `Archive fixture ${identifier}`, creator: 'Fixture creator', date: '2024', mediatype: mediaType, rights: 'Uploader supplied rights statement', licenseurl: 'https://creativecommons.org/licenses/by/4.0/', ...overrides })

let active
try {
  const primary = 'singapore_history_fixture'
  const readyBody = response([item(primary), item('singapore_text_fixture_2', { rights: undefined, licenseurl: undefined })])
  const readyFixtures = new Map([
    [endpoint, { body: readyBody }],
    [`https://archive.org/services/img/${primary}`, { status: 204, body: {} }],
    ['https://archive.org/services/img/singapore_text_fixture_2', { status: 204, body: {} }],
  ])
  const ready = await browser(`${root}/dist`, { fixtures: readyFixtures, blockedProviderPatterns: ['https://archive.org/*'] })
  active = ready
  await ready.nav('internet-archive-search')
  assert.equal(await ready.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = ready.requestCount
  const result = await ready.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.responseHeader?.params?.qin, `${query} AND mediatype:${mediaType}`)
  assert.equal(result.data?.response?.docs?.length, 2)
  const dom = await semantic(ready)
  assert.deepEqual({ layout: dom.layout, fallback: dom.fallback, state: dom.state, requestBound: dom.requestBound, requestContract: dom.requestContract, query: dom.query, mediaType: dom.mediaType, requestedRows: dom.requestedRows, providerTotal: dom.providerTotal, providerStart: dom.providerStart, providerCount: dom.providerCount, validCount: dom.validCount, malformed: dom.malformed, duplicates: dom.duplicates, overflow: dom.overflow, optionalWarnings: dom.optionalWarnings, rightsEvidence: dom.rightsEvidence, licenseEvidence: dom.licenseEvidence, countContract: dom.countContract, primaryIdentifier: dom.primaryIdentifier }, { layout: 'archive-search', fallback: 'false', state: 'ready', requestBound: 'true', requestContract: 'exact-internet-archive-advanced-search-v1', query, mediaType, requestedRows: rows, providerTotal: 2, providerStart: 0, providerCount: 2, validCount: 2, malformed: 0, duplicates: 0, overflow: 0, optionalWarnings: 0, rightsEvidence: 1, licenseEvidence: 1, countContract: 'true', primaryIdentifier: primary })
  assert(dom.text.includes('does not guarantee copyright status'), 'Official Internet Archive rights caveat missing from semantic DOM')
  assert.equal(ready.requestCount - before, 1, 'Ready fixture must issue exactly one application fetch and zero live provider fetches')
  assert.equal(ready.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
  assert.deepEqual(ready.blockedProviders, [], 'Every Archive.org request must be handled locally by the fixture map')
  await ready.viewport(390, 844)
  const mobile = await ready.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await ready.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(ready.errors, [])
  report.checks.push({ id: 'internet-archive-search', case: 'trusted fixture', exactRequest: endpoint, semanticState: dom.state, requestBound: dom.requestBound, primaryIdentifier: primary, rightsEvidence: dom.rightsEvidence, licenseEvidence: dom.licenseEvidence, liveProviderRequests: 0, mobileOverflow: false, unnamedControls: 0 })
  await ready.close(); active = undefined

  const partialPrimary = 'singapore_partial_fixture'
  const partialBody = response([
    item(partialPrimary, { creator: 42, rights: { unsafe: true }, licenseurl: 'https://example.com/unrecognized' }),
    item(partialPrimary, { title: 'Duplicate identity' }),
    item('../unsafe', { title: 'Fabricated unsafe identity' }),
    item('singapore_partial_fixture_2', { rights: undefined, licenseurl: undefined }),
  ])
  const partialFixtures = new Map([
    [endpoint, { body: partialBody }],
    [`https://archive.org/services/img/${partialPrimary}`, { status: 204, body: {} }],
    ['https://archive.org/services/img/singapore_partial_fixture_2', { status: 204, body: {} }],
  ])
  const partial = await browser(`${root}/dist`, { fixtures: partialFixtures, blockedProviderPatterns: ['https://archive.org/*'] })
  active = partial
  await partial.nav('internet-archive-search')
  const partialBefore = partial.requestCount
  const partialResult = await partial.run()
  assert.equal(partialResult.ok, true, partialResult.error)
  const partialDom = await semantic(partial)
  assert.deepEqual({ state: partialDom.state, requestBound: partialDom.requestBound, validCount: partialDom.validCount, malformed: partialDom.malformed, duplicates: partialDom.duplicates, optionalWarnings: partialDom.optionalWarnings, rightsEvidence: partialDom.rightsEvidence, licenseEvidence: partialDom.licenseEvidence, primaryIdentifier: partialDom.primaryIdentifier }, { state: 'partial', requestBound: 'true', validCount: 2, malformed: 1, duplicates: 1, optionalWarnings: 1, rightsEvidence: 0, licenseEvidence: 0, primaryIdentifier: partialPrimary })
  assert.equal(partialDom.text.includes('Fabricated unsafe identity'), false)
  assert.equal(partialDom.text.includes('https://example.com/unrecognized'), false)
  assert.equal(partial.requestCount - partialBefore, 1, 'Partial fixture must issue exactly one application fetch and zero live provider fetches')
  assert.equal(partial.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
  assert.deepEqual(partial.blockedProviders, [], 'Every Archive.org request must be handled locally by the fixture map')
  assert.deepEqual(partial.errors, [])
  report.checks.push({ id: 'internet-archive-search', case: 'malformed/duplicate fixture', semanticState: partialDom.state, validRecords: partialDom.validCount, malformedRecords: partialDom.malformed, duplicateRecords: partialDom.duplicates, optionalWarnings: partialDom.optionalWarnings, unsafeIdentityHidden: true, unsafeLicenseHidden: true, liveProviderRequests: 0 })
  await partial.close(); active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.blockedProviders = active.blockedProviders; report.networkFailures = active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/internet-archive-search-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/internet-archive-search-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
