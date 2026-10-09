import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://rxnav.nlm.nih.gov/REST/drugs.json?name=ibuprofen'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live NLM RxNorm getDrugs API from the Pages origin',
  checks: [],
  errors: [],
}
const supportedTtys = new Set(['SCD', 'SBD', 'GPCK', 'BPCK'])
const concepts = (body) => (body?.drugGroup?.conceptGroup || []).flatMap((group) => (group?.conceptProperties || []).map((concept) => ({
  tty: String(group?.tty || ''),
  rxcui: String(concept?.rxcui || ''),
  name: String(concept?.name || ''),
  conceptTty: String(concept?.tty || ''),
})))
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const semantic = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview')
  const card = shell?.querySelector('.rxnorm-preview, [data-domain-card="rxnorm-drug-terminology"]')
  return {
    layout: shell?.dataset.previewLayout || '',
    fallback: shell?.dataset.ssotFallback || '',
    state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '',
    requestContract: card?.dataset.requestContract || '',
    query: card?.dataset.queryName || '',
    providerCount: Number(card?.dataset.providerConceptCount || 0),
    validCount: Number(card?.dataset.validConceptCount || 0),
    invalidCount: Number(card?.dataset.invalidConceptCount || 0),
    malformedGroups: Number(card?.dataset.malformedGroupCount || 0),
    duplicateRxcuis: Number(card?.dataset.duplicateRxcuiCount || 0),
    primaryRxcui: card?.dataset.primaryRxcui || '',
    primaryName: card?.dataset.primaryConceptName || '',
    primaryTty: card?.dataset.primaryTermType || '',
    text: card?.innerText || '',
  }
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('rxnorm-drug-search')
  const renderedEndpoint = await live.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(renderedEndpoint, endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'RxNorm verifier must issue exactly one live provider request')
  assert(result.data?.drugGroup && typeof result.data.drugGroup === 'object' && !Array.isArray(result.data.drugGroup), 'RxNorm response missing drugGroup')
  assert(result.data.drugGroup.name == null, 'RxNorm getDrugs documentation says drugGroup.name is always empty')
  const providerConcepts = concepts(result.data)
  assert(providerConcepts.length > 0, 'RxNorm returned no concepts for ibuprofen')
  assert(providerConcepts.every((concept) => supportedTtys.has(concept.tty) && concept.rxcui && concept.name && (!concept.conceptTty || concept.conceptTty === concept.tty)), 'Live RxNorm concept identity/TTY contract drifted')
  const expectedPrimary = providerConcepts.find((concept) => concept.tty === 'SCD') || providerConcepts[0]
  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    query: dom.query,
    providerCount: dom.providerCount,
    validCount: dom.validCount,
    invalidCount: dom.invalidCount,
    malformedGroups: dom.malformedGroups,
    duplicateRxcuis: dom.duplicateRxcuis,
  }, {
    layout: 'drug-terminology',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-get-drugs-name',
    query: 'ibuprofen',
    providerCount: providerConcepts.length,
    validCount: providerConcepts.length,
    invalidCount: 0,
    malformedGroups: 0,
    duplicateRxcuis: 0,
  })
  assert.equal(dom.primaryRxcui, expectedPrimary.rxcui)
  assert.equal(dom.primaryName, expectedPrimary.name)
  assert.equal(dom.primaryTty, expectedPrimary.tty)
  assert.equal(dom.text.includes('not as prescribing or medical advice'), true)
  await live.viewport(390, 844)
  const overflow = await live.ev(`({ documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1 })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'rxnorm-drug-search', source: 'live provider', exactRequest: endpoint, providerConcepts: providerConcepts.length, semanticState: dom.state, requestBound: dom.requestBound, browserCorsReadable: true, mobileOverflow: false, unnamedControls: 0 })
  await live.close()
  active = undefined

  const mixedBody = { drugGroup: { name: null, conceptGroup: [{ tty: 'SCD', conceptProperties: [
    { rxcui: '197805', name: 'ibuprofen 400 MG Oral Tablet', synonym: '', tty: 'SCD' },
    { name: 'fabricated identity without RxCUI', synonym: '', tty: 'SCD' },
  ] }] } }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: mixedBody }]]) })
  active = mixed
  await mixed.nav('rxnorm-drug-search')
  const fixtureBefore = mixed.requestCount
  const mixedResult = await mixed.run()
  assert.equal(mixedResult.ok, true, mixedResult.error)
  const mixedDom = await semantic(mixed)
  assert.deepEqual({ state: mixedDom.state, requestBound: mixedDom.requestBound, providerCount: mixedDom.providerCount, validCount: mixedDom.validCount, invalidCount: mixedDom.invalidCount }, { state: 'partial', requestBound: 'true', providerCount: 2, validCount: 1, invalidCount: 1 })
  assert.equal(mixedDom.text.includes('fabricated identity without RxCUI'), false)
  const exactFixtures = mixed.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(exactFixtures, 1)
  assert.equal(mixed.requestCount - fixtureBefore, exactFixtures, 'Fixture-only RxNorm case must send zero live provider requests')
  assert.deepEqual(mixed.errors, [])
  report.checks.push({ id: 'rxnorm-drug-search', case: 'mixed malformed identity HTTP-200 fixture', source: 'synthetic fixture', semanticState: mixedDom.state, validConcepts: 1, invalidConcepts: 1, fabricatedIdentityHidden: true, liveProviderRequests: 0 })
  await mixed.close()
  active = undefined

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/rxnorm-drug-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/rxnorm-drug-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
