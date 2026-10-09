import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live openFDA Drug Label API from the Pages origin',
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
const brands = (record) => Array.isArray(record?.openfda?.brand_name) ? record.openfda.brand_name.filter((value) => typeof value === 'string' && value.trim()) : []

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('openfda-drug-labels')
  await setControl(b, 'brand', 'Advil Dual Action')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(Array.isArray(result.data?.results), true, 'openFDA did not return a results array')
  assert(result.data.results.length > 0, 'openFDA returned no labels for the live phrase-search fixture')
  assert.equal(result.data.meta?.results?.skip, 0)
  assert.equal(result.data.meta?.results?.limit, 8)
  assert.equal(typeof result.data.meta?.results?.total, 'number')
  assert(result.data.results.every((record) => brands(record).some((brand) => brand.toLowerCase().includes('advil dual action'))), 'Provider returned a label whose harmonized brand names do not acknowledge the executed phrase search')

  const first = result.data.results[0]
  const expectedBrand = brands(first).find((brand) => brand.toLowerCase().includes('advil dual action'))
  assert(expectedBrand, 'First provider row has no matching brand identity')
  const dom = await b.ev(`(() => {
    const shell = document.querySelector('.demo-preview')
    const card = shell?.querySelector('.drug-label-preview')
    return {
      layout: shell?.dataset.previewLayout,
      fallback: shell?.dataset.ssotFallback,
      state: card?.dataset.resultState,
      requestBound: card?.dataset.requestBound,
      requestedBrand: card?.dataset.requestedBrand,
      requestedLimit: Number(card?.dataset.requestedLimit),
      providerRecordCount: Number(card?.dataset.providerRecordCount),
      validRecordCount: Number(card?.dataset.validRecordCount),
      invalidRecordCount: Number(card?.dataset.invalidRecordCount),
      queryMismatchCount: Number(card?.dataset.queryMismatchCount),
      paginationCoherent: card?.dataset.paginationCoherent,
      primaryBrand: card?.dataset.primaryBrandName,
      providerMatchCount: Number(card?.dataset.providerMatchCount),
      generic: (shell?.innerText || '').includes('openFDA Drug Labels record 1'),
      text: card?.innerText || '',
    }
  })()`)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestedBrand: dom.requestedBrand,
    requestedLimit: dom.requestedLimit,
    providerRecordCount: dom.providerRecordCount,
    validRecordCount: dom.validRecordCount,
    invalidRecordCount: dom.invalidRecordCount,
    queryMismatchCount: dom.queryMismatchCount,
    paginationCoherent: dom.paginationCoherent,
  }, {
    layout: 'drug-label',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestedBrand: 'Advil Dual Action',
    requestedLimit: 8,
    providerRecordCount: result.data.results.length,
    validRecordCount: result.data.results.length,
    invalidRecordCount: 0,
    queryMismatchCount: 0,
    paginationCoherent: 'true',
  })
  assert.equal(dom.primaryBrand, expectedBrand)
  assert.equal(dom.providerMatchCount, result.data.meta.results.total)
  assert.equal(dom.generic, false)
  assert.equal(dom.text.includes('Do not use openFDA results for medical decisions.'), true)

  await b.viewport(390, 844)
  const overflow = await b.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
  })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)

  report.checks.push({
    id: 'openfda-drug-labels',
    source: 'live provider',
    requestedBrand: 'Advil Dual Action',
    providerRows: result.data.results.length,
    providerTotal: result.data.meta.results.total,
    semanticState: dom.state,
    requestBound: dom.requestBound,
    browserCorsReadable: true,
    mobileOverflow: false,
    unnamedControls: 0,
  })

  const syntheticUrl = 'https://api.fda.gov/drug/label.json?search=openfda.brand_name%3A%22Advil+Dual+Action%22&limit=8'
  const syntheticBody = {
    meta: { last_updated: '2026-09-11', results: { skip: 0, limit: 8, total: '5' } },
    results: [
      { id: 'good-record', openfda: { brand_name: ['ADVIL DUAL ACTION WITH ACETAMINOPHEN'], generic_name: ['IBUPROFEN, ACETAMINOPHEN'] }, warnings: ['Read the complete label before use.'] },
      { id: 'wrong-record', openfda: { brand_name: ['Tylenol'], generic_name: ['ACETAMINOPHEN'] } },
    ],
  }
  const synthetic = await browser(`${root}/dist`, { fixtures: new Map([[syntheticUrl, { body: syntheticBody }]]) })
  try {
    await synthetic.nav('openfda-drug-labels')
    await setControl(synthetic, 'brand', 'Advil Dual Action')
    const syntheticResult = await synthetic.run()
    assert.equal(syntheticResult.ok, true, syntheticResult.error)
    const semantic = await synthetic.ev(`(() => {
      const card = document.querySelector('.drug-label-preview')
      return {
        state: card?.dataset.resultState,
        requestBound: card?.dataset.requestBound,
        requestedBrand: card?.dataset.requestedBrand,
        providerCount: Number(card?.dataset.providerRecordCount),
        validCount: Number(card?.dataset.validRecordCount),
        invalidCount: Number(card?.dataset.invalidRecordCount),
        queryMismatchCount: Number(card?.dataset.queryMismatchCount),
        paginationCoherent: card?.dataset.paginationCoherent,
        matchCount: card?.dataset.providerMatchCount,
        text: card?.innerText || '',
      }
    })()`)
    assert.deepEqual({
      state: semantic.state,
      requestBound: semantic.requestBound,
      requestedBrand: semantic.requestedBrand,
      providerCount: semantic.providerCount,
      validCount: semantic.validCount,
      invalidCount: semantic.invalidCount,
      queryMismatchCount: semantic.queryMismatchCount,
      paginationCoherent: semantic.paginationCoherent,
      matchCount: semantic.matchCount,
    }, {
      state: 'partial',
      requestBound: 'true',
      requestedBrand: 'Advil Dual Action',
      providerCount: 2,
      validCount: 1,
      invalidCount: 1,
      queryMismatchCount: 1,
      paginationCoherent: 'false',
      matchCount: '',
    })
    assert.equal(semantic.text.includes('Tylenol'), false)
    assert.equal(semantic.text.includes('Only records tied to the executed brand-name search are trusted.'), true)
    assert.deepEqual(synthetic.fixtureRequests.map((entry) => ({ url: entry.url, source: entry.source, status: entry.status })), [{ url: syntheticUrl, source: 'synthetic-fixture', status: 200 }])
    report.checks.push({ id: 'openfda-drug-labels', case: 'wrong-brand + numeric-string pagination HTTP-200 fixture', source: 'synthetic fixture', semanticState: semantic.state, validRecords: 1, invalidRecords: 1, queryMismatches: 1, fabricatedIdentity: false })
    report.errors.push(...synthetic.errors.map(String))
  } finally {
    await synthetic.close()
  }

  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/openfda-drug-label-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/openfda-drug-label-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
