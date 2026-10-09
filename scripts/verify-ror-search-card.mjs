import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'stanford'
const endpoint = `https://api.ror.org/v2/organizations?${new URLSearchParams({ query }).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live ROR v2 organization search plus exact synthetic HTTP-200 semantic fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const displayName = (organization) => Array.isArray(organization?.names)
  ? organization.names.find((name) => Array.isArray(name?.types) && name.types.includes('ror_display'))?.value?.trim() || ''
  : ''
const identity = (organization) => ({ id: organization?.id?.trim?.() || '', name: displayName(organization) })
const semantic = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview')
  const card = shell?.querySelector('[data-domain-card="ror-search"]')
  return {
    layout: shell?.dataset.previewLayout || '',
    fallback: shell?.dataset.ssotFallback || '',
    state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '',
    requestContract: card?.dataset.requestContract || '',
    query: card?.dataset.requestQuery || '',
    providerItemCount: Number(card?.dataset.providerItemCount || 0),
    providerTotal: Number(card?.dataset.providerTotal || 0),
    validCount: Number(card?.dataset.validOrganizationCount || 0),
    malformedCount: Number(card?.dataset.malformedOrganizationCount || 0),
    duplicateCount: Number(card?.dataset.duplicateOrganizationCount || 0),
    countContract: card?.dataset.countContract || '',
    primaryId: card?.dataset.primaryRorId || '',
    visibleIds: [...(card?.querySelectorAll('[data-ror-id]') || [])].map((node) => node.dataset.rorId || ''),
    text: card?.innerText || '',
  }
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('ror-search')
  const renderedEndpoint = await live.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(renderedEndpoint, endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'ROR verifier must issue exactly one live provider request')
  assert(Array.isArray(result.data?.items), 'ROR live response missing items[]')
  assert(result.data.items.length > 0 && result.data.items.length <= 20, `ROR default search returned ${result.data.items.length} items`)
  assert(Number.isSafeInteger(result.data?.number_of_results) && result.data.number_of_results >= result.data.items.length, 'ROR number_of_results wire contract drifted')
  assert(typeof result.data?.time_taken === 'number' && Number.isFinite(result.data.time_taken), 'ROR time_taken wire contract drifted')
  assert(result.data?.meta && typeof result.data.meta === 'object' && !Array.isArray(result.data.meta), 'ROR meta wire contract drifted')
  const identities = result.data.items.map(identity)
  assert(identities.every(({ id, name }) => /^https:\/\/ror\.org\/[0-9a-z]{9}$/.test(id) && name), 'ROR ID/display-name identity contract drifted')
  assert(new Set(identities.map(({ id }) => id)).size === identities.length, 'ROR live response returned duplicate IDs')

  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout, fallback: dom.fallback, state: dom.state, requestBound: dom.requestBound,
    requestContract: dom.requestContract, query: dom.query, providerItemCount: dom.providerItemCount,
    providerTotal: dom.providerTotal, validCount: dom.validCount, malformedCount: dom.malformedCount,
    duplicateCount: dom.duplicateCount, countContract: dom.countContract, primaryId: dom.primaryId,
    visibleIds: dom.visibleIds,
  }, {
    layout: 'organization-directory', fallback: 'false', state: 'ready', requestBound: 'true',
    requestContract: 'exact-ror-v2-organizations-search', query, providerItemCount: result.data.items.length,
    providerTotal: result.data.number_of_results, validCount: identities.length, malformedCount: 0,
    duplicateCount: 0, countContract: 'true', primaryId: identities[0].id,
    visibleIds: identities.map(({ id }) => id),
  })
  assert.equal(dom.text.includes('The first result is not auto-selected'), true)
  assert.equal(dom.text.includes(identities[0].name), true)
  await live.viewport(390, 844)
  const overflow = await live.ev(`({ documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1 })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'ror-search', source: 'live provider', exactRequest: endpoint, providerMatches: result.data.number_of_results, returnedItems: identities.length, primaryRorId: identities[0].id, semanticState: dom.state, requestBound: dom.requestBound, browserCorsReadable: true, mobileOverflow: false, unnamedControls: 0, liveProviderRequests: 1 })
  await live.close()
  active = undefined

  const valid = (id, name) => ({ id, names: [{ value: name, types: ['ror_display'] }] })
  const mixedBody = {
    number_of_results: 4,
    time_taken: 0.001,
    meta: {},
    items: [
      valid('https://ror.org/00f54p054', 'Fixture trusted organization'),
      valid('https://example.org/not-ror', 'Fabricated organization'),
      valid('https://ror.org/00f54p054', 'Fabricated duplicate organization'),
      { id: 'https://ror.org/02abc1234', names: [{ value: 'No ROR display name', types: ['ror_variant'] }] },
    ],
  }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: mixedBody }]]) })
  active = mixed
  await mixed.nav('ror-search')
  const mixedBefore = mixed.requestCount
  const mixedResult = await mixed.run()
  assert.equal(mixedResult.ok, true, mixedResult.error)
  const mixedDom = await semantic(mixed)
  assert.deepEqual({ state: mixedDom.state, requestBound: mixedDom.requestBound, validCount: mixedDom.validCount, malformedCount: mixedDom.malformedCount, duplicateCount: mixedDom.duplicateCount, visibleIds: mixedDom.visibleIds }, { state: 'partial', requestBound: 'true', validCount: 1, malformedCount: 2, duplicateCount: 1, visibleIds: ['https://ror.org/00f54p054'] })
  assert.equal(mixedDom.text.includes('Fabricated organization'), false)
  assert.equal(mixedDom.text.includes('Fabricated duplicate organization'), false)
  assert.equal(mixedDom.text.includes('No ROR display name'), false)
  assert.equal(mixed.requestCount - mixedBefore, mixed.fixtureRequests.length, 'Fixture-only ROR case must send zero live provider requests')
  assert.deepEqual(mixed.errors, [])
  report.checks.push({ id: 'ror-search', case: 'mixed malformed/duplicate ROR identity HTTP-200 fixture', source: 'synthetic fixture', semanticState: mixedDom.state, validOrganizations: 1, malformedOrganizations: 2, duplicateOrganizations: 1, fabricatedIdentityHidden: true, liveProviderRequests: 0 })
  await mixed.close()
  active = undefined

  const numericString = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: { ...mixedBody, number_of_results: '4' } }]]) })
  active = numericString
  await numericString.nav('ror-search')
  const numericBefore = numericString.requestCount
  const numericResult = await numericString.run()
  assert.equal(numericResult.ok, true, numericResult.error)
  const numericDom = await semantic(numericString)
  assert.equal(numericDom.state, 'invalid')
  assert.equal(numericDom.requestBound, 'true')
  assert.equal(numericDom.countContract, 'false')
  assert.equal(numericDom.visibleIds.length, 0)
  assert.equal(numericString.requestCount - numericBefore, numericString.fixtureRequests.length, 'Numeric-string fixture must send zero live provider requests')
  assert.deepEqual(numericString.errors, [])
  report.checks.push({ id: 'ror-search', case: 'numeric-string number_of_results HTTP-200 fixture', source: 'synthetic fixture', semanticState: numericDom.state, malformedTotalHidden: true, liveProviderRequests: 0 })
  await numericString.close()
  active = undefined

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/ror-search-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/ror-search-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
