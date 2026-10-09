import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = `https://www.federalregister.gov/api/v1/documents.json?${new URLSearchParams({ per_page: '8', order: 'newest', 'conditions[term]': 'artificial intelligence' }).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Federal Register document search plus one exact synthetic HTTP-200 semantic fixture',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())

const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
const trustedLiveRow = (row) => {
  if (!row || typeof row !== 'object' || Array.isArray(row)
    || typeof row.document_number !== 'string' || !row.document_number.trim()
    || !validDate(row.publication_date)
    || typeof row.type !== 'string' || !row.type.trim()
    || typeof row.title !== 'string' || !row.title.trim()) return false
  try {
    const url = new URL(row.html_url)
    const [year, month, day] = row.publication_date.split('-')
    return url.protocol === 'https:' && url.hostname === 'www.federalregister.gov'
      && !url.search && !url.hash
      && url.pathname.startsWith(`/documents/${year}/${month}/${day}/${row.document_number}/`)
  } catch {
    return false
  }
}

const semantic = (instance) => instance.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="federal-register-documents"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', query:card?.dataset.searchTerm||'', requestedLimit:Number(card?.dataset.requestedLimit||0), providerCount:Number(card?.dataset.providerCount||0), providerTotalPages:Number(card?.dataset.providerTotalPages||0), providerRecordCount:Number(card?.dataset.providerRecordCount||0), trustedCount:Number(card?.dataset.trustedRecordCount||0), malformedCount:Number(card?.dataset.malformedEvidenceCount||0), duplicateCount:Number(card?.dataset.duplicateEvidenceCount||0), primaryDocumentNumber:card?.dataset.primaryDocumentNumber||'', primaryPublicationDate:card?.dataset.primaryPublicationDate||'', primaryDocumentType:card?.dataset.primaryDocumentType||'', text:card?.innerText||'' }; })()`)

const fixtureDocument = (documentNumber, publicationDate, overrides = {}) => ({
  document_number: documentNumber,
  publication_date: publicationDate,
  type: 'Proposed Rule',
  title: `Trusted Federal Register ${documentNumber}`,
  abstract: 'Fixture provider abstract.',
  agencies: [{ name: 'Environmental Protection Agency' }],
  html_url: `https://www.federalregister.gov/documents/${publicationDate.replaceAll('-', '/')}/${documentNumber}/trusted-federal-register-${documentNumber}`,
  ...overrides,
})

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('federal-register-documents')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Federal Register verifier must issue exactly one live provider request')
  assert(result.data && typeof result.data === 'object' && !Array.isArray(result.data), 'Federal Register live response must be an envelope')
  assert.equal(result.data.description, "Documents matching 'artificial intelligence'", 'Provider search acknowledgement drifted')
  assert(Number.isSafeInteger(result.data.count) && result.data.count >= 0, 'Provider count wire type drifted')
  assert(Array.isArray(result.data.results), 'Provider result list drifted')
  assert.equal(result.data.results.length, Math.min(8, result.data.count), 'Provider first-page cardinality drifted')
  assert(result.data.results.every(trustedLiveRow), 'Federal Register document identity wire contract drifted')
  assert.equal(new Set(result.data.results.map((row) => row.document_number)).size, result.data.results.length, 'Live response returned duplicate document numbers')
  const primary = result.data.results[0]
  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    query: dom.query,
    requestedLimit: dom.requestedLimit,
    providerCount: dom.providerCount,
    providerRecordCount: dom.providerRecordCount,
    trustedCount: dom.trustedCount,
    malformedCount: dom.malformedCount,
    duplicateCount: dom.duplicateCount,
    primaryDocumentNumber: dom.primaryDocumentNumber,
    primaryPublicationDate: dom.primaryPublicationDate,
    primaryDocumentType: dom.primaryDocumentType,
  }, {
    layout: 'federal-rulemaking',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-federal-register-document-search-v2',
    query: 'artificial intelligence',
    requestedLimit: 8,
    providerCount: result.data.count,
    providerRecordCount: result.data.results.length,
    trustedCount: result.data.results.length,
    malformedCount: 0,
    duplicateCount: 0,
    primaryDocumentNumber: primary.document_number,
    primaryPublicationDate: primary.publication_date,
    primaryDocumentType: primary.type,
  })
  assert(dom.text.includes(primary.title), 'Primary Federal Register title missing from semantic DOM')
  assert(dom.text.includes('unofficial informational resource'), 'Federal Register legal-status boundary missing from semantic DOM')
  await live.viewport(390, 844)
  const overflow = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({
    id: 'federal-register-documents',
    source: 'live provider',
    exactRequest: endpoint,
    providerCount: result.data.count,
    providerTotalPages: result.data.total_pages,
    returnedRecords: result.data.results.length,
    primaryDocumentNumber: primary.document_number,
    primaryPublicationDate: primary.publication_date,
    semanticState: dom.state,
    requestBound: dom.requestBound,
    browserCorsReadable: true,
    mobileOverflow: false,
    unnamedControls: 0,
  })
  await live.close(); active = undefined

  const first = fixtureDocument('2026-19072', '2026-09-17')
  const fixtureBody = {
    description: "Documents matching 'artificial intelligence'",
    count: 3,
    total_pages: 1,
    next_page_url: null,
    results: [
      first,
      { ...first, title: 'Fabricated duplicate title' },
      fixtureDocument('2026-19070', '2026-09-16', { title: 'Fabricated malformed source', html_url: 'https://example.com/not-federal-register' }),
    ],
  }
  const fixture = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: fixtureBody }]]) })
  active = fixture
  await fixture.nav('federal-register-documents')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run()
  assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({
    state: fixtureDom.state,
    requestBound: fixtureDom.requestBound,
    providerRecordCount: fixtureDom.providerRecordCount,
    trustedCount: fixtureDom.trustedCount,
    malformedCount: fixtureDom.malformedCount,
    duplicateCount: fixtureDom.duplicateCount,
    primaryDocumentNumber: fixtureDom.primaryDocumentNumber,
  }, {
    state: 'partial',
    requestBound: 'true',
    providerRecordCount: 3,
    trustedCount: 1,
    malformedCount: 1,
    duplicateCount: 1,
    primaryDocumentNumber: '2026-19072',
  })
  assert.equal(fixtureDom.text.includes('Fabricated duplicate title'), false)
  assert.equal(fixtureDom.text.includes('Fabricated malformed source'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests, 1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture Federal Register case must send zero live provider requests')
  assert.deepEqual(fixture.errors, [])
  report.checks.push({
    id: 'federal-register-documents',
    case: 'mixed duplicate/malformed HTTP-200 fixture',
    source: 'synthetic fixture',
    semanticState: fixtureDom.state,
    trustedRecords: 1,
    malformedEvidence: 1,
    duplicateEvidence: 1,
    fabricatedIdentityHidden: true,
    liveProviderRequests: 0,
  })
  await fixture.close(); active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) {
    report.errors.push(...active.errors.map(String))
    report.networkFailures = active.networkFailures
  }
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/federal-register-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/federal-register-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
