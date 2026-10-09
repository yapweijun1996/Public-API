import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live openFDA Food Enforcement API from the Pages origin plus fixture-only semantic regressions',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setControl = async (b, name, value) => {
  await b.ev(`(() => {
    const element = document.querySelector('[name=${JSON.stringify(name)}]')
    if (!element) throw new Error('Missing control ' + ${JSON.stringify(name)})
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)})
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })()`)
  await sleep(80)
}

const semanticDom = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview')
  const card = shell?.querySelector('.food-recall-preview')
  return {
    layout: shell?.dataset.previewLayout,
    fallback: shell?.dataset.ssotFallback,
    state: card?.dataset.resultState,
    requestBound: card?.dataset.requestBound,
    requestedQuery: card?.dataset.requestedQuery,
    requestedLimit: Number(card?.dataset.requestedLimit),
    providerRecords: Number(card?.dataset.providerRecordCount),
    validRecords: Number(card?.dataset.validRecordCount),
    invalidRecords: Number(card?.dataset.invalidRecordCount),
    queryMismatches: Number(card?.dataset.queryMismatchCount),
    malformedIdentities: Number(card?.dataset.malformedIdentityCount),
    paginationCoherent: card?.dataset.paginationCoherent,
    providerTotal: card?.dataset.providerMatchCount === '' ? null : Number(card?.dataset.providerMatchCount),
    recallNumber: card?.dataset.primaryRecallNumber,
    text: shell?.innerText || '',
  }
})()`)

const matchesNeedle = (record, needle) => [record?.product_description, record?.reason_for_recall]
  .some((value) => typeof value === 'string' && value.toLocaleLowerCase('en').includes(needle))

const verifyMobileAx = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview')?.scrollWidth > document.querySelector('.demo-preview')?.clientWidth + 1,
    cardOverflow: document.querySelector('.food-recall-preview')?.scrollWidth > document.querySelector('.food-recall-preview')?.clientWidth + 1,
  })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow || overflow.cardOverflow, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
}

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('openfda-food-recalls')
  await setControl(active, 'query', 'peanut')
  await setControl(active, 'limit', '5')
  const endpoint = await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const parsed = new URL(endpoint)
  assert.equal(parsed.origin, 'https://api.fda.gov')
  assert.equal(parsed.pathname, '/food/enforcement.json')
  assert.deepEqual([...parsed.searchParams.keys()].sort(), ['limit', 'search'])
  assert.equal(parsed.searchParams.get('search'), 'product_description:"peanut" OR reason_for_recall:"peanut"')
  assert.equal(parsed.searchParams.get('limit'), '5')

  const before = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - before, 1, 'Food recall verifier must issue exactly one live provider request')
  assert(Array.isArray(result.data?.results), 'openFDA did not return results[]')
  assert(result.data.results.length > 0, 'openFDA returned no live peanut food-recall rows')
  assert(result.data.results.length <= 5)
  assert.equal(result.data.meta?.results?.skip, 0)
  assert.equal(result.data.meta?.results?.limit, 5)
  assert.equal(typeof result.data.meta?.results?.total, 'number')
  for (const row of result.data.results) {
    assert.equal(typeof row?.recall_number, 'string')
    assert(row.recall_number.trim())
    assert(matchesNeedle(row, 'peanut'), `Provider row ${row.recall_number} did not acknowledge the executed product/reason phrase search`)
  }

  const dom = await semanticDom(active)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestedQuery: dom.requestedQuery,
    requestedLimit: dom.requestedLimit,
    providerRecords: dom.providerRecords,
    validRecords: dom.validRecords,
    invalidRecords: dom.invalidRecords,
    queryMismatches: dom.queryMismatches,
    malformedIdentities: dom.malformedIdentities,
    paginationCoherent: dom.paginationCoherent,
  }, {
    layout: 'food-recalls', fallback: 'false', state: 'ready', requestBound: 'true', requestedQuery: 'peanut', requestedLimit: 5,
    providerRecords: result.data.results.length, validRecords: result.data.results.length, invalidRecords: 0, queryMismatches: 0, malformedIdentities: 0, paginationCoherent: 'true',
  })
  assert.equal(dom.providerTotal, result.data.meta.results.total)
  assert.equal(dom.recallNumber, result.data.results[0].recall_number)
  assert.equal(dom.text.includes('openFDA Food Recalls record 1'), false)
  await verifyMobileAx(active)
  assert.deepEqual(active.errors, [])
  report.checks.push({ id: 'openfda-food-recalls', case: 'live product/reason phrase search', liveProviderRequests: 1, retries: 0, transportStatus: 200, browserCorsReadable: true, semanticState: dom.state, rows: result.data.results.length, providerTotal: result.data.meta.results.total, mobileOverflow: false, unnamedControls: 0 })
  await active.close(); active = undefined

  const baseUrl = 'https://api.fda.gov/food/enforcement.json?search=product_description%3A%22peanut%22+OR+reason_for_recall%3A%22peanut%22&limit=5'
  const good = { recall_number: 'F-GOOD', classification: 'Class I', status: 'Ongoing', recalling_firm: 'Good Foods', product_description: 'Peanut snack bites', reason_for_recall: 'Possible contamination.' }
  const wrong = { recall_number: 'F-WRONG', classification: 'Class II', status: 'Completed', recalling_firm: 'Other Foods', product_description: 'Vanilla wafers', reason_for_recall: 'Undeclared milk.' }
  const cases = [
    { name: 'mixed wrong-query + numeric-string pagination', body: { meta: { last_updated: '2026-09-15', results: { skip: 0, limit: 5, total: '2' } }, results: [good, wrong] }, expected: 'partial', check: (dom) => { assert.equal(dom.validRecords, 1); assert.equal(dom.invalidRecords, 1); assert.equal(dom.queryMismatches, 1); assert.equal(dom.paginationCoherent, 'false'); assert.equal(dom.providerTotal, null); assert.equal(dom.text.includes('Vanilla wafers'), false) } },
    { name: 'all wrong-query rows', body: { meta: { last_updated: '2026-09-15', results: { skip: 0, limit: 5, total: 1 } }, results: [wrong] }, expected: 'invalid', check: (dom) => assert.equal(dom.text.includes('Vanilla wafers'), false) },
    { name: 'coherent zero-result response', body: { meta: { last_updated: '2026-09-15', results: { skip: 0, limit: 5, total: 0 } }, results: [] }, expected: 'empty', check: (dom) => assert(dom.text.includes('No openFDA food recalls returned')) },
  ]
  for (const testCase of cases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[baseUrl, { body: testCase.body }]]) })
    active = fixtureBrowser
    await fixtureBrowser.nav('openfda-food-recalls')
    await setControl(fixtureBrowser, 'query', 'peanut')
    await setControl(fixtureBrowser, 'limit', '5')
    const fixtureBefore = fixtureBrowser.requestCount
    const fixtureResult = await fixtureBrowser.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const dom = await semanticDom(fixtureBrowser)
    if (testCase.expected === 'invalid' || testCase.expected === 'empty') {
      const shellText = await fixtureBrowser.ev(`document.querySelector('.demo-preview')?.innerText || ''`)
      assert(shellText.includes(testCase.expected === 'invalid' ? 'Invalid openFDA food-recall response' : 'No openFDA food recalls returned'))
      testCase.check({ ...dom, text: shellText })
    } else {
      assert.equal(dom.state, testCase.expected)
      testCase.check(dom)
    }
    const exactFixtureRequests = fixtureBrowser.fixtureRequests.filter((request) => request.url === baseUrl && request.method === 'GET').length
    assert.equal(exactFixtureRequests, 1)
    assert.equal(fixtureBrowser.requestCount - fixtureBefore, exactFixtureRequests, 'Fixture-only cases must not send live provider requests')
    assert.deepEqual(fixtureBrowser.errors, [])
    report.checks.push({ id: 'openfda-food-recalls', case: `fixture-only ${testCase.name}`, semanticState: testCase.expected, liveProviderRequests: 0 })
    await fixtureBrowser.close(); active = undefined
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close().catch((error) => report.errors.push(String(error)))
}

fs.writeFileSync(`${evidence}/openfda-food-recall-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/openfda-food-recall-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
