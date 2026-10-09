import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://www.dnd5eapi.co/api/2014/spells/fireball'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live D&D 5e API 2014 spell lookup plus a synthetic wrong-spell HTTP-200 response',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="dnd5e-spell"]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',requestedSpellIndex:card?.dataset.requestedSpellIndex||'',providerSpellIndex:card?.dataset.providerSpellIndex||'',providerResourceUrl:card?.dataset.providerResourceUrl||'',spellIndexMatch:card?.dataset.spellIndexMatch||'',allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
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
  await b.nav('dnd5e-spell-lookup')
  const before = b.requestCount
  const result = await b.run()
  const providerFetches = b.requestCount - before
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.index, 'fireball')
  assert.equal(result.data?.url, '/api/2014/spells/fireball')
  assert.equal(result.data?.name, 'Fireball')
  const dom = await readDom(b)
  assert.equal(dom.layout, 'dictionary-entry')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-dnd5e-2014-spell-bodyless-get')
  assert.equal(dom.requestedSpellIndex, 'fireball')
  assert.equal(dom.providerSpellIndex, 'fireball')
  assert.equal(dom.providerResourceUrl, '/api/2014/spells/fireball')
  assert.equal(dom.spellIndexMatch, 'true')
  assert.equal(dom.endpoint, endpoint)
  assert.equal(providerFetches, 1)
  assert.equal(dom.overflow, false)
  assert(dom.allText.includes(result.data.name))
  assert(dom.allText.includes(result.data.range))
  assert(dom.allText.includes(result.data.casting_time))
  await verifyMobileAx(b)
  report.checks.push({ id: 'dnd5e-spell-lookup', case: 'live exact 2014 spell resource', semanticState: dom.state, requestBound: true, spellIndex: result.data.index, providerResourceUrl: result.data.url, providerFetches, providerCors: 'browser-readable', mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  assert.deepEqual(b.networkFailures, [])
  await b.close()
  b = undefined

  const wrongSpell = {
    index: 'magic-missile', name: 'Magic Missile', desc: ['Synthetic wrong spell.'], higher_level: [], range: '120 feet', components: ['V', 'S'], ritual: false, duration: 'Instantaneous', concentration: false, casting_time: '1 action', level: 1,
    school: { index: 'evocation', name: 'Evocation', url: '/api/2014/magic-schools/evocation' },
    classes: [{ index: 'wizard', name: 'Wizard', url: '/api/2014/classes/wizard' }], subclasses: [], url: '/api/2014/spells/magic-missile',
  }
  const fixture = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: wrongSpell }]]),
    blockedProviderPatterns: ['https://www.dnd5eapi.co/*'],
  })
  try {
    await fixture.nav('dnd5e-spell-lookup')
    const fixtureResult = await fixture.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await readDom(fixture)
    assert.equal(fixtureDom.state, 'invalid')
    assert.equal(fixtureDom.requestBound, 'true')
    assert.equal(fixtureDom.requestedSpellIndex, 'fireball')
    assert.equal(fixtureDom.providerSpellIndex, 'magic-missile')
    assert.equal(fixtureDom.spellIndexMatch, 'false')
    assert.equal(fixtureDom.allText.includes('Magic Missile'), false)
    assert.equal(fixtureDom.allText.includes('120 feet'), false)
    assert.deepEqual(fixture.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(fixture.blockedProviders, [])
    assert.deepEqual(fixture.errors, [])
    report.checks.push({ id: 'dnd5e-spell-lookup', case: 'synthetic wrong-spell HTTP-200 response', semanticState: 'invalid', requestBound: true, requestedSpellIndex: 'fireball', providerSpellIndex: 'magic-missile', providerFactsHidden: true, liveProviderRequests: 0 })
  } finally {
    await fixture.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/dnd5e-spell-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/dnd5e-spell-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
