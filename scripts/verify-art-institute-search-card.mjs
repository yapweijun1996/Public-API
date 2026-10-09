import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'monet'
const limit = 8
const fields = 'id,title,artist_title,date_display,image_id,is_public_domain'
const endpoint = `https://api.artic.edu/api/v1/artworks/search?${new URLSearchParams({ q: query, limit: String(limit), fields, 'query[term][is_public_domain]': 'true' }).toString()}`
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'one live Art Institute public-domain search plus fixture-only negative cases', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const trusted = (row) => Number.isSafeInteger(row?.id) && row.id > 0 && typeof row?.title === 'string' && row.title.trim() && typeof row?.image_id === 'string' && row.image_id.trim() && row?.is_public_domain === true
const semantic = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="art-institute-search"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', query:card?.dataset.requestQuery||'', limit:Number(card?.dataset.requestLimit||0), total:Number(card?.dataset.providerTotal||0), providerLimit:Number(card?.dataset.providerLimit||0), providerOffset:Number(card?.dataset.providerOffset||0), totalPages:Number(card?.dataset.providerTotalPages||0), currentPage:Number(card?.dataset.providerCurrentPage||0), providerCount:Number(card?.dataset.providerArtworkCount||0), validCount:Number(card?.dataset.validArtworkCount||0), malformed:Number(card?.dataset.malformedArtworkCount||0), duplicates:Number(card?.dataset.duplicateArtworkCount||0), overflow:Number(card?.dataset.overflowArtworkCount||0), rightsGaps:Number(card?.dataset.rightsGapCount||0), supplementalMalformed:Number(card?.dataset.supplementalMalformedCount||0), countContract:card?.dataset.countContract||'', iiifBase:card?.dataset.iiifBase||'', primaryArtworkId:Number(card?.dataset.primaryArtworkId||0), primaryImageId:card?.dataset.primaryImageId||'', primaryPublicDomain:card?.dataset.primaryPublicDomain||'', imageSrc:card?.querySelector('img')?.src||'', text:card?.innerText||'' }; })()`)

const fixtureArtwork = (id, imageId, overrides = {}) => ({ id, title: 'Fixture artwork', artist_title: 'Fixture artist', date_display: '1900', image_id: imageId, is_public_domain: true, ...overrides })
const fixturePagination = (total) => ({ total, limit, offset: 0, total_pages: total === 0 ? 0 : Math.ceil(total / limit), current_page: 1 })

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('art-institute-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Art Institute verifier must issue exactly one live API request')
  const pagination = result.data?.pagination
  const rows = result.data?.data || []
  const iiifBase = result.data?.config?.iiif_url
  assert(Number.isSafeInteger(pagination?.total) && pagination.total >= 0)
  assert.equal(pagination?.limit, limit)
  assert.equal(pagination?.offset, 0)
  assert.equal(pagination?.current_page, 1)
  assert.equal(pagination?.total_pages, pagination.total === 0 ? 0 : Math.ceil(pagination.total / limit))
  assert.equal(rows.length, Math.min(limit, pagination.total))
  assert(rows.every(trusted), 'Art Institute native artwork/image/public-domain identity contract drifted')
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length)
  assert.equal(new Set(rows.map((row) => row.image_id)).size, rows.length)
  assert.match(iiifBase, /^https:\/\//)
  const dom = await semantic(live)
  assert.deepEqual({ layout: dom.layout, fallback: dom.fallback, state: dom.state, requestBound: dom.requestBound, requestContract: dom.requestContract, query: dom.query, limit: dom.limit, total: dom.total, providerLimit: dom.providerLimit, providerOffset: dom.providerOffset, totalPages: dom.totalPages, currentPage: dom.currentPage, providerCount: dom.providerCount, validCount: dom.validCount, malformed: dom.malformed, duplicates: dom.duplicates, overflow: dom.overflow, rightsGaps: dom.rightsGaps, supplementalMalformed: dom.supplementalMalformed, countContract: dom.countContract, iiifBase: dom.iiifBase, primaryArtworkId: dom.primaryArtworkId, primaryImageId: dom.primaryImageId, primaryPublicDomain: dom.primaryPublicDomain }, { layout: 'public-domain-art-search', fallback: 'false', state: 'ready', requestBound: 'true', requestContract: 'exact-art-institute-public-domain-image-search-v2', query, limit, total: pagination.total, providerLimit: limit, providerOffset: 0, totalPages: pagination.total_pages, currentPage: 1, providerCount: rows.length, validCount: rows.length, malformed: 0, duplicates: 0, overflow: 0, rightsGaps: 0, supplementalMalformed: 0, countContract: 'true', iiifBase: iiifBase.replace(/\/$/, ''), primaryArtworkId: rows[0]?.id || 0, primaryImageId: rows[0]?.image_id || '', primaryPublicDomain: rows.length ? 'true' : '' })
  if (rows.length) assert.equal(dom.imageSrc, `${iiifBase.replace(/\/$/, '')}/${encodeURIComponent(rows[0].image_id)}/full/843,/0/default.jpg`)
  assert(dom.text.includes('CC0 subject to provider terms'), 'Art Institute response-data/rights caveat missing from semantic DOM')
  await live.viewport(390, 844)
  const mobile = await live.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'art-institute-search', source: 'live provider', exactRequest: endpoint, providerTotal: pagination.total, returnedRecords: rows.length, primaryArtworkId: rows[0]?.id, primaryImageId: rows[0]?.image_id, semanticState: dom.state, requestBound: dom.requestBound, browserCorsReadable: true, mobileOverflow: false, unnamedControls: 0, apiRequests: 1 })
  await live.close(); active = undefined

  const fixtureBase = 'https://fixture.invalid/iiif/2'
  const mixedBody = { pagination: fixturePagination(4), config: { iiif_url: fixtureBase }, data: [
    fixtureArtwork(1, 'image-1'),
    fixtureArtwork(1, 'image-2', { title: 'Duplicate artwork' }),
    fixtureArtwork(3, 'image-3', { title: 'Rights ambiguous', is_public_domain: false }),
    fixtureArtwork(4, '', { title: 'Image unavailable' }),
  ] }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: mixedBody }]]), blockedProviderPatterns: ['https://api.artic.edu/*', 'https://fixture.invalid/*'] })
  active = mixed
  await mixed.nav('art-institute-search')
  const mixedBefore = mixed.requestCount
  const mixedResult = await mixed.run(); assert.equal(mixedResult.ok, true, mixedResult.error)
  const mixedDom = await semantic(mixed)
  assert.deepEqual({ state: mixedDom.state, requestBound: mixedDom.requestBound, validCount: mixedDom.validCount, malformed: mixedDom.malformed, duplicates: mixedDom.duplicates, rightsGaps: mixedDom.rightsGaps, primaryArtworkId: mixedDom.primaryArtworkId, primaryImageId: mixedDom.primaryImageId }, { state: 'partial', requestBound: 'true', validCount: 1, malformed: 2, duplicates: 1, rightsGaps: 1, primaryArtworkId: 1, primaryImageId: 'image-1' })
  assert.equal(mixedDom.text.includes('Duplicate artwork'), false)
  assert.equal(mixedDom.text.includes('Rights ambiguous'), false)
  assert.equal(mixedDom.text.includes('Image unavailable'), false)
  const mixedApiFixtures = mixed.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(mixedApiFixtures, 1)
  assert.equal(mixed.requestCount - mixedBefore, mixedApiFixtures, 'Mixed fixture case must send zero live API requests')
  assert.equal(mixed.blockedProviders.every((url) => url.startsWith('https://fixture.invalid/')), true)
  assert.deepEqual(mixed.errors, [])
  report.checks.push({ id: 'art-institute-search', case: 'duplicate/rights/image HTTP-200 fixture', source: 'synthetic fixture', semanticState: mixedDom.state, validRecords: 1, malformedRecords: 2, duplicateRecords: 1, rightsGaps: 1, fabricatedIdentityHidden: true, liveProviderRequests: 0 })
  await mixed.close(); active = undefined

  const invalidBody = { pagination: { ...fixturePagination(1), total: '1' }, config: { iiif_url: fixtureBase }, data: [fixtureArtwork(1, 'image-1')] }
  const invalid = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: invalidBody }]]), blockedProviderPatterns: ['https://api.artic.edu/*', 'https://fixture.invalid/*'] })
  active = invalid
  await invalid.nav('art-institute-search')
  const invalidBefore = invalid.requestCount
  const invalidResult = await invalid.run(); assert.equal(invalidResult.ok, true, invalidResult.error)
  const invalidDom = await semantic(invalid)
  assert.equal(invalidDom.state, 'invalid')
  assert.equal(invalidDom.text.includes('Fixture artwork'), false)
  const invalidApiFixtures = invalid.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(invalidApiFixtures, 1)
  assert.equal(invalid.requestCount - invalidBefore, invalidApiFixtures, 'Malformed-pagination fixture must send zero live API requests')
  assert.equal(invalid.blockedProviders.length, 0)
  assert.deepEqual(invalid.errors, [])
  report.checks.push({ id: 'art-institute-search', case: 'numeric-string pagination HTTP-200 fixture', source: 'synthetic fixture', semanticState: invalidDom.state, fabricatedIdentityHidden: true, liveProviderRequests: 0 })
  await invalid.close(); active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures = active.networkFailures; report.blockedProviders = active.blockedProviders }
} finally { if (active) await active.close() }

fs.writeFileSync(`${evidence}/art-institute-search-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/art-institute-search-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
