import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'dragon'
const endpoint = `https://api.scryfall.com/cards/search?${new URLSearchParams({ q: query }).toString()}`
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'one live Scryfall search plus one synthetic HTTP-200 semantic fixture', checks: [], errors: [] }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const imageUrl = (card) => {
  const values = [card?.image_uris, ...(Array.isArray(card?.card_faces) ? card.card_faces.map((face) => face?.image_uris) : [])]
  for (const images of values) {
    for (const key of ['normal', 'large', 'small', 'png', 'art_crop', 'border_crop']) {
      const value = images?.[key]
      try {
        const url = new URL(value)
        if (url.protocol === 'https:' && (url.hostname === 'cards.scryfall.io' || url.hostname.endsWith('.scryfall.io'))) return url.href
      } catch {}
    }
  }
  return undefined
}
const trusted = (card) => UUID.test(card?.id || '') && card?.object === 'card' && [card?.name, card?.type_line, card?.set, card?.set_name, card?.collector_number].every((value) => typeof value === 'string' && value.trim()) && (() => { try { const url = new URL(card.scryfall_uri); return url.protocol === 'https:' && (url.hostname === 'scryfall.com' || url.hostname.endsWith('.scryfall.com')) } catch { return false } })() && imageUrl(card)
const semantic = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="scryfall-card-search"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', contract:card?.dataset.requestContract||'', query:card?.dataset.requestQuery||'', providerCount:Number(card?.dataset.providerCardCount||0), total:Number(card?.dataset.providerTotalCards||0), hasMore:card?.dataset.providerHasMore||'', valid:Number(card?.dataset.validCardCount||0), malformed:Number(card?.dataset.malformedCardCount||0), duplicates:Number(card?.dataset.duplicateCardCount||0), imageGaps:Number(card?.dataset.imageGapCount||0), warnings:Number(card?.dataset.warningCount||0), nextPageBound:card?.dataset.nextPageBound||'', primaryId:card?.dataset.primaryCardId||'', rendered:card?.querySelectorAll('[data-card-id]').length||0, primarySetText:card?.querySelector('[data-card-id] small')?.textContent||'', text:card?.innerText||'' }; })()`)
const mobileAndA11y = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1, cardOverflow:document.querySelector('[data-domain-card="scryfall-card-search"]')?.scrollWidth>document.querySelector('[data-domain-card="scryfall-card-search"]')?.clientWidth+1 })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow || overflow.cardOverflow, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
}

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('scryfall-card-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Scryfall verifier must issue exactly one live provider request')
  assert.equal(live.fixtureRequests.length, 0)
  assert.equal(result.data?.object, 'list')
  assert(Array.isArray(result.data?.data) && result.data.data.length > 0)
  assert(Number.isSafeInteger(result.data?.total_cards) && result.data.total_cards >= result.data.data.length)
  assert.equal(result.data?.has_more, true)
  assert(result.data.data.every(trusted), 'Scryfall card identity/artwork contract drifted')
  const dom = await semantic(live)
  const expectedPrimary = result.data.data[0]
  assert.deepEqual({ layout: dom.layout, fallback: dom.fallback, state: dom.state, requestBound: dom.requestBound, contract: dom.contract, query: dom.query, providerCount: dom.providerCount, total: dom.total, hasMore: dom.hasMore, valid: dom.valid, malformed: dom.malformed, duplicates: dom.duplicates, imageGaps: dom.imageGaps, warnings: dom.warnings, nextPageBound: dom.nextPageBound, primaryId: dom.primaryId, rendered: dom.rendered }, { layout: 'trading-card-search', fallback: 'false', state: 'ready', requestBound: 'true', contract: 'exact-scryfall-card-search-v2', query, providerCount: result.data.data.length, total: result.data.total_cards, hasMore: 'true', valid: result.data.data.length, malformed: 0, duplicates: 0, imageGaps: 0, warnings: 0, nextPageBound: 'true', primaryId: expectedPrimary.id.toLowerCase(), rendered: Math.min(8, result.data.data.length) })
  assert(dom.text.includes(expectedPrimary.name), 'Primary Scryfall card name missing from semantic DOM')
  assert(dom.primarySetText.includes(expectedPrimary.set_name), 'Primary Scryfall set name missing from semantic DOM')
  await mobileAndA11y(live)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'scryfall-card-search', source: 'live provider', exactRequest: endpoint, returnedCards: result.data.data.length, totalCards: result.data.total_cards, primaryCardId: expectedPrimary.id, semanticState: dom.state, requestBound: dom.requestBound, nextPageBound: dom.nextPageBound, browserCorsReadable: true, renderedCards: dom.rendered, mobileOverflow: false, unnamedControls: 0, liveProviderRequests: 1, retryOn429: false })
  await live.close(); active = undefined

  const valid = (id, overrides = {}) => ({ id, object: 'card', name: 'Trusted Fixture Dragon', type_line: 'Creature — Dragon', set: 'tst', set_name: 'Fixture Set', collector_number: '1', scryfall_uri: `https://scryfall.com/card/tst/1/${id}`, image_uris: { normal: `https://cards.scryfall.io/normal/front/${id}.jpg` }, ...overrides })
  const first = '11111111-1111-4111-8111-111111111111'
  const second = '22222222-2222-4222-8222-222222222222'
  const fixtureBody = { object: 'list', total_cards: 4, has_more: false, data: [valid(first), valid(first, { name: 'Duplicate fixture card' }), valid(second, { image_uris: { normal: 'https://example.test/not-scryfall.jpg' } }), valid('33333333-3333-4333-8333-333333333333', { collector_number: 7 })] }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('scryfall-card-search')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({ state: fixtureDom.state, requestBound: fixtureDom.requestBound, valid: fixtureDom.valid, malformed: fixtureDom.malformed, duplicates: fixtureDom.duplicates, imageGaps: fixtureDom.imageGaps, primaryId: fixtureDom.primaryId }, { state: 'partial', requestBound: 'true', valid: 1, malformed: 1, duplicates: 1, imageGaps: 1, primaryId: first })
  assert.equal(fixtureDom.text.includes('Duplicate fixture card'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture Scryfall case must send zero live provider requests')
  assert.deepEqual(fixture.blockedProviders, [])
  await mobileAndA11y(fixture)
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ id: 'scryfall-card-search', case: 'mixed malformed/duplicate/image-gap HTTP-200 fixture', source: 'synthetic fixture', semanticState: fixtureDom.state, validRecords: fixtureDom.valid, malformedRecords: fixtureDom.malformed, duplicateRecords: fixtureDom.duplicates, imageGapRecords: fixtureDom.imageGaps, fabricatedIdentityHidden: true, liveProviderRequests: 0, mobileOverflow: false, unnamedControls: 0 })
  await fixture.close(); active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures = active.networkFailures }
} finally {
  if (active) await active.close()
}
fs.writeFileSync(`${evidence}/scryfall-card-search.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/scryfall-card-search.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
