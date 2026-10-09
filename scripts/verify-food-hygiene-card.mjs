import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live Food Standards Agency FHRS API from the Pages origin',
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

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('uk-food-hygiene')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data?.establishments), 'FSA response did not expose establishments')
  assert(result.data.establishments.length > 0, 'FSA returned no establishments for default Cafe search')
  assert.equal(result.data.meta?.itemCount, result.data.establishments.length)
  assert(Number(result.data.meta?.totalCount) >= result.data.establishments.length)

  const first = result.data.establishments[0] || {}
  assert(Number.isFinite(Number(first.FHRSID)), 'First FSA establishment did not expose FHRSID')
  const dom = await b.ev(`(() => {
    const shell = document.querySelector('.demo-preview')
    const card = shell.querySelector('.food-hygiene-preview')
    const row = card.querySelector('[data-establishment-index="1"]')
    return {
      layout: shell.dataset.previewLayout,
      fallback: shell.dataset.ssotFallback,
      state: card.dataset.resultState,
      requestBound: card.dataset.requestBound,
      requestName: card.dataset.requestName,
      requestPageSize: Number(card.dataset.requestPageSize),
      providerPageNumber: Number(card.dataset.providerPageNumber),
      providerPageSize: Number(card.dataset.providerPageSize),
      paginationValid: card.dataset.paginationContractValid,
      queryValid: card.dataset.queryContractValid,
      providerSelfContract: card.dataset.providerSelfContract,
      providerSelfHref: card.dataset.providerSelfHref,
      provider: Number(card.dataset.providerRecordCount),
      valid: Number(card.dataset.validRecordCount),
      invalid: Number(card.dataset.invalidRecordCount),
      total: Number(card.dataset.providerTotalCount),
      itemCount: Number(card.dataset.providerItemCount),
      countValid: card.dataset.countContractValid,
      primary: Number(card.dataset.primaryFhrsId),
      scoreDirection: card.dataset.scoreDirection,
      rowId: Number(row.dataset.fhrsId),
      name: row.dataset.businessName,
      scheme: row.dataset.schemeType,
      rating: row.dataset.ratingValue,
      ratingDate: row.dataset.ratingDate,
      authority: row.dataset.localAuthority,
      latitude: row.dataset.latitude === undefined ? null : Number(row.dataset.latitude),
      longitude: row.dataset.longitude === undefined ? null : Number(row.dataset.longitude),
      text: card.innerText || '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }
  })()`)

  assert.equal(dom.layout, 'food-hygiene-ratings')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestName, 'Cafe')
  assert.equal(dom.requestPageSize, 5)
  assert.equal(dom.providerPageNumber, 1)
  assert(dom.providerPageSize > 0 && dom.providerPageSize <= 5)
  assert.equal(dom.paginationValid, 'true')
  assert.equal(dom.queryValid, 'true')
  assert.equal(dom.providerSelfContract, 'valid')
  assert.equal(new URL(dom.providerSelfHref).searchParams.get('name')?.toLocaleLowerCase('en-GB'), 'cafe')
  assert.equal(dom.provider, result.data.establishments.length)
  assert.equal(dom.valid, result.data.establishments.length)
  assert.equal(dom.invalid, 0)
  assert.equal(dom.total, Number(result.data.meta.totalCount))
  assert.equal(dom.itemCount, Number(result.data.meta.itemCount))
  assert.equal(dom.countValid, 'true')
  assert.equal(dom.primary, Number(first.FHRSID))
  assert.equal(dom.scoreDirection, 'lower-intervention-score-is-better')
  assert.equal(dom.rowId, Number(first.FHRSID))
  assert.equal(dom.name, String(first.BusinessName || ''))
  assert.equal(dom.scheme, String(first.SchemeType || ''))
  assert.equal(dom.rating, String(first.RatingValue || ''))
  assert.equal(dom.ratingDate, String(first.RatingDate || ''))
  assert.equal(dom.authority, String(first.LocalAuthorityName || ''))
  assert.equal(dom.latitude, first.geocode?.latitude == null ? null : Number(first.geocode.latitude))
  assert.equal(dom.longitude, first.geocode?.longitude == null ? null : Number(first.geocode.longitude))
  assert(dom.text.includes('component intervention scores run in the opposite direction'))
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
    id: 'uk-food-hygiene',
    source: 'live provider',
    providerRecords: result.data.establishments.length,
    totalCount: result.data.meta.totalCount,
    identity: 'FHRSID exact response match',
    ratingAndAuthority: 'exact response match',
    semanticState: 'ready',
    requestBinding: 'Cafe / page 1 / pageSize 5 exact request contract',
    providerSearchAcknowledgement: 'provider self link acknowledges Cafe / page 1 / pageSize 5; fuzzy provider matches are preserved',
    mobileOverflow: false,
    unnamedControls: 0,
  })

  await setControl(b, 'name', 'zzzzzzzzzzzzzzzzzzzzunlikely')
  const noMatch = await b.run()
  assert.equal(noMatch.ok, true, noMatch.error)
  assert(Array.isArray(noMatch.data?.establishments), 'No-match FSA response did not expose establishments')
  assert.equal(noMatch.data.establishments.length, 0)
  assert.equal(noMatch.data.meta?.itemCount, 0)
  assert.equal(noMatch.data.meta?.totalCount, 0)
  const noMatchDom = await b.ev(`(() => { const card=document.querySelector('[data-domain-card="food-hygiene-ratings"]'); return { state:card?.dataset.resultState, text:card?.innerText||'' } })()`)
  assert.equal(noMatchDom.state, 'empty')
  assert(noMatchDom.text.includes('request-bound zero-result establishment search'))
  report.checks.push({ id:'uk-food-hygiene', case:'live no-match search', source:'live provider', providerRecords:0, totalCount:0, semanticState:'empty' })

  const mixedUrl = 'https://api.ratings.food.gov.uk/Establishments?name=Cafe&pageNumber=1&pageSize=5'
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[mixedUrl, { body: {
    establishments: [
      { FHRSID: 79912, BusinessName: 'Cafe Cafe', RatingValue: '5', SchemeType: 'FHRS', LocalAuthorityName: 'Rhondda Cynon Taf' },
      { BusinessName: 'Fabricated Establishment', RatingValue: '5', SchemeType: 'FHRS' },
    ],
    meta: { itemCount: 2, totalCount: 2, totalPages: 1, pageSize: 5, pageNumber: 1, returncode: 'OK' },
    links: [{ rel: 'self', href: mixedUrl }],
  }, allowHeaders: 'Content-Type, x-api-version' }]]) })
  try {
    await mixed.nav('uk-food-hygiene')
    const mixedResult = await mixed.run()
    assert.equal(mixedResult.ok, true, mixedResult.error)
    const mixedDom = await mixed.ev(`(() => { const card=document.querySelector('.food-hygiene-preview'); return { state:card?.dataset.resultState, provider:Number(card?.dataset.providerRecordCount), valid:Number(card?.dataset.validRecordCount), invalid:Number(card?.dataset.invalidRecordCount), countValid:card?.dataset.countContractValid, rows:document.querySelectorAll('.food-hygiene-preview [data-fhrs-id]').length, text:card?.innerText||'', overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1 } })()`)
    assert.deepEqual({ state:mixedDom.state, provider:mixedDom.provider, valid:mixedDom.valid, invalid:mixedDom.invalid, countValid:mixedDom.countValid, rows:mixedDom.rows }, { state:'partial', provider:2, valid:1, invalid:1, countValid:'true', rows:1 })
    assert(mixedDom.text.includes('Cafe Cafe'))
    assert.equal(mixedDom.text.includes('Fabricated Establishment'), false)
    assert.equal(mixedDom.text.includes('FHRS IDNot supplied'), false)
    assert.equal(mixedDom.overflow, false)
    assert.deepEqual(mixed.fixtureRequests.filter((request) => request.method === 'GET').map((request) => ({ url:request.url, source:request.source, status:request.status })), [{ url:mixedUrl, source:'synthetic-fixture', status:200 }])
    assert.equal(mixed.fixtureRequests.some((request) => request.method === 'OPTIONS' && request.status === 204), true)
    await mixed.viewport(390, 844)
    const mixedAx = await mixed.call('Accessibility.getFullAXTree')
    assert.equal(unnamed(mixedAx.nodes).length, 0)
    report.checks.push({ id:'uk-food-hygiene', case:'mixed HTTP-200 establishment rows', source:'synthetic fixture', semanticState:'partial', providerRecords:2, validRecords:1, invalidRecords:1, fabricatedIdentityHidden:true, mobileOverflow:false, unnamedControls:0 })
    report.errors.push(...mixed.errors.map(String))
  } finally {
    await mixed.close()
  }

  const wrongQuery = await browser(`${root}/dist`, { fixtures: new Map([[mixedUrl, { body: {
    establishments: [{ FHRSID: 98765, BusinessName: 'Burger House', RatingValue: '5', SchemeType: 'FHRS' }],
    meta: { itemCount: 1, totalCount: 1, totalPages: 1, pageSize: 5, pageNumber: 1, returncode: 'OK' },
    links: [{ rel: 'self', href: 'https://api.ratings.food.gov.uk/establishments?name=burger&pagenumber=1&pagesize=5' }],
  }, allowHeaders: 'Content-Type, x-api-version' }]]) })
  try {
    await wrongQuery.nav('uk-food-hygiene')
    const wrongResult = await wrongQuery.run()
    assert.equal(wrongResult.ok, true, wrongResult.error)
    const wrongDom = await wrongQuery.ev(`(() => { const card=document.querySelector('[data-domain-card=\"food-hygiene-ratings\"]'); return { state:card?.dataset.resultState, text:card?.innerText||'' } })()`)
    assert.equal(wrongDom.state, 'invalid')
    assert.equal(wrongDom.text.includes('Burger House'), false)
    assert.deepEqual(wrongQuery.fixtureRequests.filter((request) => request.method === 'GET').map((request) => ({ url:request.url, source:request.source, status:request.status })), [{ url:mixedUrl, source:'synthetic-fixture', status:200 }])
    report.checks.push({ id:'uk-food-hygiene', case:'wrong business-name HTTP-200 row', source:'synthetic fixture', semanticState:'invalid', wrongBusinessHidden:true })
    report.errors.push(...wrongQuery.errors.map(String))
  } finally {
    await wrongQuery.close()
  }

  const stringPagination = await browser(`${root}/dist`, { fixtures: new Map([[mixedUrl, { body: {
    establishments: [{ FHRSID: 79912, BusinessName: 'Cafe Cafe', RatingValue: '5', SchemeType: 'FHRS' }],
    meta: { itemCount: '1', totalCount: '1', totalPages: '1', pageSize: '5', pageNumber: '1', returncode: 'OK' },
    links: [{ rel: 'self', href: mixedUrl }],
  }, allowHeaders: 'Content-Type, x-api-version' }]]) })
  try {
    await stringPagination.nav('uk-food-hygiene')
    const stringResult = await stringPagination.run()
    assert.equal(stringResult.ok, true, stringResult.error)
    const stringDom = await stringPagination.ev(`(() => { const card=document.querySelector('.food-hygiene-preview'); return { state:card?.dataset.resultState, paginationValid:card?.dataset.paginationContractValid, countValid:card?.dataset.countContractValid } })()`)
    assert.deepEqual(stringDom, { state:'partial', paginationValid:'false', countValid:'false' })
    assert.deepEqual(stringPagination.fixtureRequests.filter((request) => request.method === 'GET').map((request) => ({ url:request.url, source:request.source, status:request.status })), [{ url:mixedUrl, source:'synthetic-fixture', status:200 }])
    report.checks.push({ id:'uk-food-hygiene', case:'numeric-string pagination metadata', source:'synthetic fixture', semanticState:'partial', numericCoercion:false })
    report.errors.push(...stringPagination.errors.map(String))
  } finally {
    await stringPagination.close()
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

fs.writeFileSync(`${evidence}/food-hygiene-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/food-hygiene-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
