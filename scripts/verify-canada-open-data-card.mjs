import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live Government of Canada Open Government CKAN API from the Pages origin',
  checks: [], errors: [],
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
const unique = (values) => [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))]

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('canada-open-data-search')

  const fieldContract = await b.ev(`(() => {
    const query = document.querySelector('[name="query"]')
    const limit = document.querySelector('[name="limit"]')
    return { queryMinLength: query?.minLength, limitMin: limit?.min, limitMax: limit?.max, limitStep: limit?.step }
  })()`)
  assert.deepEqual(fieldContract, { queryMinLength: 1, limitMin: '1', limitMax: '20', limitStep: '1' })

  await setControl(b, 'query', 'climate')
  await setControl(b, 'limit', '3.5')
  const fractionalRequestCountBefore = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()` )
  await sleep(180)
  const fractionalValidation = await b.ev(`(() => {
    const field = document.querySelector('[name="limit"]')
    return { requestState: document.querySelector('.request-lab')?.dataset.requestState, invalid: field?.getAttribute('aria-invalid'), help: document.querySelector('#parameter-limit-help')?.textContent || '' }
  })()`)
  assert.equal(b.requestCount - fractionalRequestCountBefore, 0, 'Fractional Canada rows must not trigger a provider request')
  assert.deepEqual(fractionalValidation, { requestState: 'idle', invalid: 'true', help: 'Results must use increments of 1.' })

  await setControl(b, 'limit', '3')
  await setControl(b, 'query', '   ')
  const blankRequestCountBefore = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()` )
  await sleep(180)
  const blankValidation = await b.ev(`(() => {
    const field = document.querySelector('[name="query"]')
    return { requestState: document.querySelector('.request-lab')?.dataset.requestState, invalid: field?.getAttribute('aria-invalid'), help: document.querySelector('#parameter-query-help')?.textContent || '' }
  })()`)
  assert.equal(b.requestCount - blankRequestCountBefore, 0, 'Blank Canada query must not trigger a provider request')
  assert.deepEqual(blankValidation, { requestState: 'idle', invalid: 'true', help: 'Catalogue search is required.' })
  report.checks.push({ id: 'canada-open-data-search', case: 'invalid explicit input', queryMinLength: 1, rowStep: 1, fractionalRowsProviderRequests: 0, blankQueryProviderRequests: 0, sharedValidation: 'fail-closed' })

  await setControl(b, 'query', 'climate')
  await setControl(b, 'limit', '3')
  const liveRequestCountBefore = b.requestCount
  const result = await b.run()
  assert.equal(b.requestCount - liveRequestCountBefore, 1, 'Expected exactly one live Canada CKAN request')
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.success, true, 'CKAN response did not report success')
  const records = result.data?.result?.results || []
  assert.equal(records.length, 3, `Expected exactly 3 provider records, got ${records.length}`)
  assert.equal(typeof result.data?.result?.count, 'number', 'Provider total count must be a native JSON number')
  assert(Number.isSafeInteger(result.data?.result?.count) && result.data.result.count >= records.length, 'Provider total count is missing or inconsistent')
  const first = records[0] || {}
  assert(first.id, 'First Canada catalogue record has no stable ID')
  assert(first.type || first.collection, 'First Canada catalogue record has no provider type/collection identity')
  assert(first.license_title, 'First Canada catalogue record has no licence metadata')
  const resources = Array.isArray(first.resources) ? first.resources : []
  const formats = unique(resources.map((resource) => resource?.format))
  const languages = unique(resources.flatMap((resource) => Array.isArray(resource?.language) ? resource.language : []))
  const resourceTypes = unique(resources.map((resource) => resource?.resource_type))
  const expectedTitle = first.title_translated?.en || first.title
  const expectedFrenchTitle = first.title_translated?.fr
  const expectedPublisher = first.organization?.title || first.org_title_at_publication?.en || 'Publisher not supplied'

  const dom = await b.ev(`(() => {
    const shell = document.querySelector('.demo-preview')
    const card = shell.querySelector('.canada-open-data-preview')
    const firstRecord = card.querySelector('[data-record-index="1"]')
    const facts = Object.fromEntries([...firstRecord.querySelectorAll('.domain-facts > div')].map((item) => [item.querySelector('dt')?.textContent || '', item.querySelector('dd')?.textContent || '']))
    return {
      layout: shell.dataset.previewLayout,
      fallback: shell.dataset.ssotFallback,
      domain: card.dataset.domainCard,
      state: card.dataset.resultState,
      requestContractValid: card.dataset.requestContractValid,
      requestBound: card.dataset.requestBound,
      requestContract: card.dataset.requestContract,
      requestedQuery: card.dataset.requestedQuery,
      requestedRows: Number(card.dataset.requestedRows),
      countContract: card.dataset.countContract,
      rowLimitContract: card.dataset.rowLimitContract,
      rowCount: Number(card.dataset.rowCount),
      visibleCount: Number(card.dataset.visibleCount),
      totalResults: Number(card.dataset.totalResults),
      primaryRecordId: card.dataset.primaryRecordId,
      recordId: firstRecord.dataset.recordId,
      recordType: firstRecord.dataset.recordType,
      collection: firstRecord.dataset.collection,
      license: firstRecord.dataset.license,
      restrictions: firstRecord.dataset.restrictions,
      resourceCount: Number(firstRecord.dataset.resourceCount),
      heading: firstRecord.querySelector('h4')?.innerText || '',
      frenchTitle: firstRecord.querySelector('p[lang="fr"]')?.innerText || '',
      facts,
      generic: (shell.innerText || '').includes('Canada Open Data Search record 1'),
    }
  })()`)

  assert.equal(dom.layout, 'open-data-catalog')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.domain, 'open-data-catalog')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestContractValid, 'true')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-canada-open-data-package-search-v2')
  assert.equal(dom.requestedQuery, 'climate')
  assert.equal(dom.requestedRows, 3)
  assert.equal(dom.countContract, 'valid')
  assert.equal(dom.rowLimitContract, 'valid')
  assert.equal(dom.rowCount, records.length)
  assert.equal(dom.visibleCount, records.length)
  assert.equal(dom.totalResults, Number(result.data.result.count))
  assert.equal(dom.primaryRecordId, String(first.id))
  assert.equal(dom.recordId, String(first.id))
  assert.equal(dom.recordType, String(first.type || 'Not supplied'))
  assert.equal(dom.collection, String(first.collection || 'Not supplied'))
  assert.equal(dom.license, String(first.license_title))
  assert.equal(dom.restrictions, String(first.restrictions || 'Not supplied'))
  assert.equal(dom.resourceCount, resources.length)
  assert.equal(dom.heading, String(expectedTitle))
  if (expectedFrenchTitle && expectedFrenchTitle !== expectedTitle) assert.equal(dom.frenchTitle, String(expectedFrenchTitle))
  assert.equal(dom.facts.Publisher, String(expectedPublisher))
  assert.equal(dom.facts['Provider type'], String(first.type || 'Not supplied'))
  assert.equal(dom.facts.Collection, String(first.collection || 'Not supplied'))
  assert.equal(dom.facts.Resources, resources.length.toLocaleString('en'))
  assert.equal(dom.facts.Formats, formats.length ? formats.join(' · ') : 'Not supplied')
  assert.equal(dom.facts.Languages, languages.length ? languages.join(' · ') : 'Not supplied')
  assert.equal(dom.facts['Resource types'], resourceTypes.length ? resourceTypes.join(' · ') : 'Not supplied')
  assert.equal(dom.generic, false)

  await b.viewport(390, 844)
  const overflow = await b.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
  })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)

  report.checks.push({ id: 'canada-open-data-search', query: 'climate', requestedRows: 3, liveProviderRequests: 1, semanticState: dom.state, requestBound: true, returnedRecords: records.length, totalMatches: result.data.result.count, primaryRecordId: first.id, providerType: first.type, collection: first.collection, license: first.license_title, resourceFormats: formats, languages, rawToSemanticDom: 'exact match', mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  await b.close()
  b = undefined

  const fixtureUrl = 'https://open.canada.ca/data/api/3/action/package_search?q=climate&rows=3'
  const fixture = { success: true, result: { count: 2, results: [
    { id: 'provider-record-1', name: 'provider-record-1', title: 'Provider record one', type: 'dataset', collection: 'primary', license_title: 'Open Government Licence - Canada' },
    { type: 'dataset', collection: 'primary', notes: 'Missing CKAN package id/name.' },
  ] } }
  b = await browser(`${root}/dist`, { fixtures: new Map([[fixtureUrl, { body: fixture }]]) })
  await b.nav('canada-open-data-search')
  await setControl(b, 'query', 'climate')
  await setControl(b, 'limit', '3')
  const fixtureResult = await b.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const partialDom = await b.ev(`(() => {
    const shell = document.querySelector('.demo-preview')
    const card = shell.querySelector('.canada-open-data-preview')
    return {
      state: card?.dataset.resultState,
      providerCount: Number(card?.dataset.providerRecordCount),
      usableCount: Number(card?.dataset.usableRecordCount),
      malformedCount: Number(card?.dataset.malformedRecordCount),
      countContract: card?.dataset.countContract,
      ids: [...(card?.querySelectorAll('[data-record-id]') || [])].map((node) => node.dataset.recordId),
      text: card?.innerText || '',
    }
  })()`)
  assert.deepEqual({ state: partialDom.state, providerCount: partialDom.providerCount, usableCount: partialDom.usableCount, malformedCount: partialDom.malformedCount, countContract: partialDom.countContract }, { state: 'partial', providerCount: 2, usableCount: 1, malformedCount: 1, countContract: 'valid' })
  assert.deepEqual(partialDom.ids, ['provider-record-1'])
  assert(partialDom.text.includes('Provider record one'))
  assert(!partialDom.text.includes('Catalogue record 2'))
  assert.deepEqual(b.fixtureRequests.map((entry) => ({ url: entry.url, source: entry.source, status: entry.status })), [{ url: fixtureUrl, source: 'synthetic-fixture', status: 200 }])
  await b.viewport(390, 844)
  assert.equal(await b.ev(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 1`), false)
  assert.equal(unnamed((await b.call('Accessibility.getFullAXTree')).nodes).length, 0)
  report.checks.push({ id: 'canada-open-data-search', case: 'mixed HTTP-200 CKAN records', semanticState: 'partial', providerRecords: 2, usableRecords: 1, malformedRecords: 1, fabricatedIdentity: false, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  await b.close()
  b = undefined

  const stringCountFixture = { success: true, result: { count: '1', results: [{ id: 'provider-record-1', name: 'provider-record-1', title: 'Provider record one', type: 'dataset', collection: 'primary' }] } }
  b = await browser(`${root}/dist`, { fixtures: new Map([[fixtureUrl, { body: stringCountFixture }]]) })
  await b.nav('canada-open-data-search')
  await setControl(b, 'query', 'climate')
  await setControl(b, 'limit', '3')
  const stringCountResult = await b.run()
  assert.equal(stringCountResult.ok, true, stringCountResult.error)
  const stringCountDom = await b.ev(`(() => { const card = document.querySelector('.canada-open-data-preview'); return { state: card?.dataset.resultState, countContract: card?.dataset.countContract, totalResults: card?.dataset.totalResults ?? '' } })()`)
  assert.deepEqual(stringCountDom, { state: 'partial', countContract: 'invalid', totalResults: '' })
  assert.deepEqual(b.fixtureRequests.map((entry) => ({ url: entry.url, source: entry.source, status: entry.status })), [{ url: fixtureUrl, source: 'synthetic-fixture', status: 200 }])
  report.checks.push({ id: 'canada-open-data-search', case: 'numeric-string CKAN count HTTP-200', semanticState: 'partial', strictNativeIntegerCount: true, liveProviderRequests: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }

fs.writeFileSync(`${evidence}/canada-open-data-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/canada-open-data-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
