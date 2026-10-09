import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live UNHCR Refugee Statistics population API from the Pages origin',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const nonNegativeSafeIntegerOrNull = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
const positiveSafeIntegerOrNull = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
const integerFields = ['coo_id', 'refugees', 'asylum_seekers', 'idps', 'stateless', 'returned_refugees', 'returned_idps']

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('unhcr-refugees')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data?.items), 'UNHCR response did not expose items[]')
  assert(result.data.items.length > 0, 'UNHCR returned no population row for the default SYR/2025 request')

  const first = result.data.items[0] || {}
  assert.equal(nonNegativeSafeIntegerOrNull(first.year), 2025, 'UNHCR first population row did not match the requested integer reporting year')
  assert.equal(first.coo_iso, 'SYR', 'UNHCR first population row did not match the requested ISO3 origin')

  const malformedIntegerCount = integerFields.filter((field) => {
    const value = first[field]
    if (value === undefined || value === null) return false
    return field === 'coo_id' ? positiveSafeIntegerOrNull(value) === null : nonNegativeSafeIntegerOrNull(value) === null
  }).length

  const expected = {
    originId: positiveSafeIntegerOrNull(first.coo_id),
    originIso: String(first.coo_iso || ''),
    originCode: String(first.coo || ''),
    year: nonNegativeSafeIntegerOrNull(first.year),
    refugees: nonNegativeSafeIntegerOrNull(first.refugees),
    asylumSeekers: nonNegativeSafeIntegerOrNull(first.asylum_seekers),
    idps: nonNegativeSafeIntegerOrNull(first.idps),
    stateless: nonNegativeSafeIntegerOrNull(first.stateless),
    returnedRefugees: nonNegativeSafeIntegerOrNull(first.returned_refugees),
    returnedIdps: nonNegativeSafeIntegerOrNull(first.returned_idps),
  }

  const dom = await b.ev(`(() => {
    const shell = document.querySelector('.demo-preview')
    const card = shell.querySelector('.refugee-population-preview')
    const num = (key) => card?.dataset[key] === undefined ? null : Number(card.dataset[key])
    return {
      layout: shell.dataset.previewLayout,
      fallback: shell.dataset.ssotFallback,
      state: card?.dataset.resultState,
      provider: Number(card?.dataset.providerItemCount),
      valid: Number(card?.dataset.validItemCount),
      invalid: Number(card?.dataset.invalidItemCount),
      extra: Number(card?.dataset.extraTrustedItemCount),
      incomplete: Number(card?.dataset.incompleteIdentityCount),
      malformedIntegers: Number(card?.dataset.malformedIntegerCount),
      requestBound: card?.dataset.requestBound,
      requestedOriginIso: card?.dataset.requestedOriginIso || '',
      requestedYear: num('requestedYear'),
      identityMatch: card?.dataset.identityMatch,
      originId: num('primaryOriginId'),
      originIso: card?.dataset.primaryOriginIso || '',
      originCode: card?.dataset.originUnhcrCode || '',
      year: num('reportingYear'),
      refugees: num('refugees'),
      asylumSeekers: num('asylumSeekers'),
      idps: num('idps'),
      stateless: num('stateless'),
      returnedRefugees: num('returnedRefugees'),
      returnedIdps: num('returnedIdps'),
      text: card?.innerText || '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }
  })()`)

  assert.equal(dom.layout, 'refugee-population')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, malformedIntegerCount > 0 ? 'partial' : 'ready')
  assert.equal(dom.provider, result.data.items.length)
  assert.equal(dom.valid, result.data.items.length)
  assert.equal(dom.invalid, 0)
  assert.equal(dom.extra, 0)
  assert.equal(dom.incomplete, 0)
  assert.equal(dom.malformedIntegers, malformedIntegerCount)
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestedOriginIso, 'SYR')
  assert.equal(dom.requestedYear, 2025)
  assert.equal(dom.identityMatch, 'true')
  assert.equal(dom.originId, expected.originId)
  assert.equal(dom.originIso, expected.originIso)
  assert.equal(dom.originCode, expected.originCode)
  assert.equal(dom.year, expected.year)
  assert.equal(dom.refugees, expected.refugees)
  assert.equal(dom.asylumSeekers, expected.asylumSeekers)
  assert.equal(dom.idps, expected.idps)
  assert.equal(dom.stateless, expected.stateless)
  assert.equal(dom.returnedRefugees, expected.returnedRefugees)
  assert.equal(dom.returnedIdps, expected.returnedIdps)
  assert(dom.text.includes('UNHCR origin ID'))
  assert.equal(dom.overflow, false)

  await b.viewport(390, 844)
  const overflow = await b.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
  })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({
    id: 'unhcr-refugees',
    source: 'live provider',
    providerItems: result.data.items.length,
    identity: 'UNHCR origin id / ISO / code + reporting year exact response match',
    displacementMetrics: 'only OpenAPI-conformant JSON integers copied from raw response to semantic DOM',
    semanticState: dom.state,
    requestBinding: 'exact bodyless GET + displayed/executed URL identity + ISO3 origin/year response match',
    malformedOpenApiIntegerFields: malformedIntegerCount,
    providerSchemaDrift: malformedIntegerCount > 0 ? 'one or more documented integer fields arrived with a non-integer JSON type and were withheld' : 'none observed',
    mobileOverflow: false,
    unnamedControls: 0,
  })

  const defaultUrl = 'https://api.unhcr.org/population/v1/population/?yearFrom=2025&yearTo=2025&coo=SYR&cf_type=ISO&limit=1'
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[defaultUrl, { body: {
    page: 1,
    'short-url': 'fixture',
    maxPages: 1,
    total: [],
    items: [
      {
        year: 2025,
        coo_id: 185,
        coo_name: 'Syrian Arab Rep.',
        coo: 'SYR',
        coo_iso: 'SYR',
        refugees: 4865764,
        asylum_seekers: 154355,
        returned_refugees: 1341148,
        idps: 5542227,
        returned_idps: 1964201,
        stateless: 0,
      },
      {
        year: 2025,
        coo_name: 'Fabricated Origin',
        refugees: 999999999,
      },
    ],
  } }]]) })

  try {
    await mixed.nav('unhcr-refugees')
    const mixedResult = await mixed.run()
    assert.equal(mixedResult.ok, true, mixedResult.error)
    const mixedDom = await mixed.ev(`(() => {
      const card = document.querySelector('.refugee-population-preview')
      return {
        state: card?.dataset.resultState,
        provider: Number(card?.dataset.providerItemCount),
        valid: Number(card?.dataset.validItemCount),
        invalid: Number(card?.dataset.invalidItemCount),
        originId: Number(card?.dataset.primaryOriginId),
        text: card?.innerText || '',
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      }
    })()`)
    assert.deepEqual({ state: mixedDom.state, provider: mixedDom.provider, valid: mixedDom.valid, invalid: mixedDom.invalid, originId: mixedDom.originId }, { state: 'partial', provider: 2, valid: 1, invalid: 1, originId: 185 })
    assert(mixedDom.text.includes('Syrian Arab Rep. · 2025'))
    assert.equal(mixedDom.text.includes('Fabricated Origin'), false)
    assert.equal(mixedDom.text.includes('999,999,999'), false)
    assert.equal(mixedDom.overflow, false)
    assert.deepEqual(mixed.fixtureRequests.filter((request) => request.method === 'GET').map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: defaultUrl, source: 'synthetic-fixture', status: 200 }])
    await mixed.viewport(390, 844)
    const mixedAx = await mixed.call('Accessibility.getFullAXTree')
    assert.equal(unnamed(mixedAx.nodes).length, 0)
    report.checks.push({
      id: 'unhcr-refugees',
      case: 'mixed HTTP-200 population rows',
      source: 'synthetic fixture',
      semanticState: 'partial',
      providerItems: 2,
      validItems: 1,
      invalidItems: 1,
      fabricatedIdentityHidden: true,
      mobileOverflow: false,
      unnamedControls: 0,
    })
    report.errors.push(...mixed.errors.map(String))
  } finally {
    await mixed.close()
  }


  const mismatched = await browser(`${root}/dist`, { fixtures: new Map([[defaultUrl, { body: {
    page: 1,
    'short-url': 'fixture',
    maxPages: 1,
    total: [],
    items: [{
      year: 2025,
      coo_id: 2,
      coo_name: 'Afghanistan',
      coo: 'AFG',
      coo_iso: 'AFG',
      refugees: 5800000,
    }],
  } }]]) })

  try {
    await mismatched.nav('unhcr-refugees')
    const mismatchResult = await mismatched.run()
    assert.equal(mismatchResult.ok, true, mismatchResult.error)
    const mismatchDom = await mismatched.ev(`(() => {
      const card = document.querySelector('[data-domain-card="refugee-population"]')
      return {
        state: card?.dataset.resultState,
        text: card?.innerText || '',
        leakedOrigin: (card?.innerText || '').includes('Afghanistan'),
        leakedMetric: (card?.innerText || '').includes('5,800,000'),
      }
    })()`)
    assert.equal(mismatchDom.state, 'invalid')
    assert(mismatchDom.text.includes('do not match the executed origin and year'))
    assert.equal(mismatchDom.leakedOrigin, false)
    assert.equal(mismatchDom.leakedMetric, false)
    assert.deepEqual(mismatched.fixtureRequests.filter((request) => request.method === 'GET').map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: defaultUrl, source: 'synthetic-fixture', status: 200 }])
    report.checks.push({
      id: 'unhcr-refugees',
      case: 'wrong-origin HTTP-200 population row',
      source: 'synthetic fixture',
      semanticState: 'invalid',
      requestedOrigin: 'SYR',
      returnedOrigin: 'AFG',
      providerIdentityHidden: true,
      providerMetricsHidden: true,
    })
    report.errors.push(...mismatched.errors.map(String))
  } finally {
    await mismatched.close()
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

fs.writeFileSync(`${evidence}/unhcr-refugee-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/unhcr-refugee-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
