import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'climate change'
const pageSize = 5
const endpoint = `https://api.datacite.org/dois?${new URLSearchParams({ query, 'page[size]': String(pageSize) }).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live DataCite DOI search plus exact synthetic HTTP-200 semantic fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const validIdentity = (entry) => {
  const attributes = entry?.attributes
  const title = Array.isArray(attributes?.titles) ? attributes.titles.find((item) => typeof item?.title === 'string' && item.title.trim())?.title?.trim() : ''
  return entry?.type === 'dois'
    && typeof entry?.id === 'string' && entry.id.trim()
    && typeof attributes?.doi === 'string' && attributes.doi.trim()
    && entry.id.trim().toLowerCase() === attributes.doi.trim().toLowerCase()
    && typeof title === 'string' && title
}
const completeMinimumMetadata = (entry) => {
  const attributes = entry?.attributes
  return validIdentity(entry)
    && Array.isArray(attributes?.creators) && attributes.creators.length > 0 && attributes.creators.every((creator) => typeof creator?.name === 'string' && creator.name.trim())
    && typeof attributes?.publisher === 'string' && attributes.publisher.trim()
    && Number.isSafeInteger(attributes?.publicationYear) && attributes.publicationYear > 0 && attributes.publicationYear <= 9999
    && typeof attributes?.types?.resourceTypeGeneral === 'string' && attributes.types.resourceTypeGeneral.trim()
}
const semantic = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview')
  const card = shell?.querySelector('[data-domain-card="datacite-search"]')
  const requestLab = document.querySelector('.request-lab')
  return {
    layout: shell?.dataset.previewLayout || '',
    fallback: shell?.dataset.ssotFallback || '',
    state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '',
    requestContract: card?.dataset.requestContract || '',
    requestQuery: card?.dataset.requestQuery || '',
    requestedPageSize: Number(card?.dataset.requestedPageSize || 0),
    selfContract: card?.dataset.selfContract || '',
    countContract: card?.dataset.countContract || '',
    providerTotal: Number(card?.dataset.providerTotal || 0),
    providerTotalPages: Number(card?.dataset.providerTotalPages || 0),
    providerPage: Number(card?.dataset.providerPage || 0),
    providerRecordCount: Number(card?.dataset.providerRecordCount || 0),
    validRecordCount: Number(card?.dataset.validRecordCount || 0),
    malformedRecordCount: Number(card?.dataset.malformedRecordCount || 0),
    duplicateDoiCount: Number(card?.dataset.duplicateDoiCount || 0),
    incompleteRecordCount: Number(card?.dataset.incompleteRecordCount || 0),
    overflowRecordCount: Number(card?.dataset.overflowRecordCount || 0),
    primaryDoi: card?.dataset.primaryDoi || '',
    visibleDois: [...(card?.querySelectorAll('[data-doi]') || [])].map((node) => node.dataset.doi || ''),
    retryOnRateLimit: requestLab?.dataset.verificationRetryOnRateLimit || '',
    text: card?.innerText || '',
  }
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('datacite-search')
  const renderedEndpoint = await live.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(renderedEndpoint, endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'DataCite verifier must issue exactly one live provider request')
  assert(Array.isArray(result.data?.data), 'DataCite live response missing data[]')
  assert(result.data.data.length > 0 && result.data.data.length <= pageSize, `DataCite default search returned ${result.data.data.length} records`)
  assert.equal(Number.isSafeInteger(result.data?.meta?.total) && result.data.meta.total >= result.data.data.length, true, 'DataCite meta.total wire contract drifted')
  assert.equal(Number.isSafeInteger(result.data?.meta?.totalPages) && result.data.meta.totalPages >= 0, true, 'DataCite meta.totalPages wire contract drifted')
  assert.equal(result.data?.meta?.page, 1)
  assert.equal(typeof result.data?.links?.self, 'string')
  assert.equal(result.data.data.length, Math.min(pageSize, result.data.meta.total))
  assert(result.data.data.every(validIdentity), 'DataCite DOI/title identity contract drifted')
  assert(result.data.data.every(completeMinimumMetadata), 'DataCite minimum metadata contract drifted')

  const dom = await semantic(live)
  const dois = result.data.data.map((entry) => entry.attributes.doi.trim())
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    requestQuery: dom.requestQuery,
    requestedPageSize: dom.requestedPageSize,
    selfContract: dom.selfContract,
    countContract: dom.countContract,
    providerTotal: dom.providerTotal,
    providerTotalPages: dom.providerTotalPages,
    providerPage: dom.providerPage,
    providerRecordCount: dom.providerRecordCount,
    validRecordCount: dom.validRecordCount,
    malformedRecordCount: dom.malformedRecordCount,
    duplicateDoiCount: dom.duplicateDoiCount,
    incompleteRecordCount: dom.incompleteRecordCount,
    overflowRecordCount: dom.overflowRecordCount,
    primaryDoi: dom.primaryDoi,
    visibleDois: dom.visibleDois,
    retryOnRateLimit: dom.retryOnRateLimit,
  }, {
    layout: 'scholarly-search',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-datacite-dois-first-page',
    requestQuery: query,
    requestedPageSize: pageSize,
    selfContract: 'true',
    countContract: 'true',
    providerTotal: result.data.meta.total,
    providerTotalPages: result.data.meta.totalPages,
    providerPage: 1,
    providerRecordCount: result.data.data.length,
    validRecordCount: result.data.data.length,
    malformedRecordCount: 0,
    duplicateDoiCount: 0,
    incompleteRecordCount: 0,
    overflowRecordCount: 0,
    primaryDoi: dois[0],
    visibleDois: dois,
    retryOnRateLimit: 'false',
  })
  assert.equal(dom.text.includes(result.data.data[0].attributes.titles[0].title), true)
  assert.equal(dom.text.includes(dois[0]), true)
  await live.viewport(390, 844)
  const overflow = await live.ev(`({ documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1 })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'datacite-search', source: 'live provider', exactRequest: endpoint, returnedRecords: result.data.data.length, total: result.data.meta.total, primaryDoi: dois[0], semanticState: dom.state, requestBound: dom.requestBound, browserCorsReadable: true, retryOnRateLimit: false, mobileOverflow: false, unnamedControls: 0 })
  await live.close()
  active = undefined

  const record = (doi, title) => ({
    id: doi,
    type: 'dois',
    attributes: {
      doi,
      titles: [{ title }],
      creators: [{ name: 'Fixture, Researcher' }],
      publisher: 'Fixture Repository',
      publicationYear: 2026,
      types: { resourceTypeGeneral: 'Dataset' },
      url: `https://example.org/${encodeURIComponent(doi)}`,
    },
  })
  const valid = record('10.1234/fixture.1', 'Fixture trusted DOI')
  const fixtureBody = {
    data: [
      valid,
      { ...record('10.1234/bad', 'Fabricated mismatched identity'), id: '10.1234/other' },
      { ...record('10.1234/fixture.1', 'Fabricated duplicate identity') },
    ],
    links: { self: endpoint },
    meta: { total: 3, totalPages: 1, page: 1 },
  }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('datacite-search')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({
    state: fixtureDom.state,
    requestBound: fixtureDom.requestBound,
    selfContract: fixtureDom.selfContract,
    countContract: fixtureDom.countContract,
    validRecordCount: fixtureDom.validRecordCount,
    malformedRecordCount: fixtureDom.malformedRecordCount,
    duplicateDoiCount: fixtureDom.duplicateDoiCount,
    incompleteRecordCount: fixtureDom.incompleteRecordCount,
    visibleDois: fixtureDom.visibleDois,
  }, {
    state: 'partial',
    requestBound: 'true',
    selfContract: 'true',
    countContract: 'true',
    validRecordCount: 1,
    malformedRecordCount: 1,
    duplicateDoiCount: 1,
    incompleteRecordCount: 0,
    visibleDois: ['10.1234/fixture.1'],
  })
  assert.equal(fixtureDom.text.includes('Fabricated mismatched identity'), false)
  assert.equal(fixtureDom.text.includes('Fabricated duplicate identity'), false)
  const exactFixtures = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(exactFixtures, 1)
  assert.equal(fixture.requestCount - fixtureBefore, exactFixtures, 'Fixture-only DataCite case must send zero live provider requests')
  assert.deepEqual(fixture.errors, [])
  report.checks.push({ id: 'datacite-search', case: 'mixed malformed/duplicate DOI identity HTTP-200 fixture', source: 'synthetic fixture', semanticState: fixtureDom.state, validRecords: 1, malformedRecords: 1, duplicateRecords: 1, fabricatedIdentityHidden: true, liveProviderRequests: 0 })
  await fixture.close()
  active = undefined

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/datacite-search-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/datacite-search-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
