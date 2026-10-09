import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live FEMA OpenFEMA DisasterDeclarationsSummaries API from the Pages origin',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('fema-disasters')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data?.DisasterDeclarationsSummaries), 'OpenFEMA response did not expose DisasterDeclarationsSummaries[]')
  assert(result.data.DisasterDeclarationsSummaries.length > 0, 'OpenFEMA returned no recent declared-area rows')

  const first = result.data.DisasterDeclarationsSummaries[0] || {}
  assert.equal(typeof first.id, 'string', 'OpenFEMA first row did not include provider-owned record id')
  assert(first.id.length > 0)
  const dom = await b.ev(`(() => {
    const shell = document.querySelector('.demo-preview')
    const card = shell.querySelector('.fema-disaster-preview')
    const row = card.querySelector('[data-declaration-index="1"]')
    const facts = Object.fromEntries([...row.querySelectorAll('.domain-facts>div')].map((node) => [node.querySelector('dt')?.textContent || '', node.querySelector('dd')?.textContent || '']))
    return {
      layout: shell.dataset.previewLayout,
      fallback: shell.dataset.ssotFallback,
      state: card.dataset.resultState,
      requestedLimit: Number(card.dataset.requestedLimit),
      requestBound: card.dataset.requestBound,
      metadataContract: card.dataset.metadataContract,
      rowCountContract: card.dataset.rowCountContract,
      provider: Number(card.dataset.providerRecordCount),
      valid: Number(card.dataset.validRecordCount),
      invalid: Number(card.dataset.invalidRecordCount),
      incomplete: Number(card.dataset.incompleteRecordCount),
      primaryRecordId: card.dataset.primaryRecordId,
      primaryDeclarationId: card.dataset.primaryDeclarationId,
      recordId: row.dataset.recordId,
      declarationId: row.dataset.declarationId,
      disasterNumber: row.dataset.disasterNumber,
      area: row.dataset.designatedArea,
      stateCode: row.dataset.state,
      incidentType: row.dataset.incidentType,
      declarationDate: row.dataset.declarationDate,
      facts,
      text: card.innerText || '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }
  })()`)

  assert.equal(dom.layout, 'disaster-declared-areas')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestedLimit, 5)
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.metadataContract, 'true')
  assert.equal(dom.rowCountContract, 'true')
  assert.equal(result.data.metadata?.top, 5)
  assert.equal(result.data.metadata?.skip, 0)
  assert.equal(result.data.metadata?.entityname, 'DisasterDeclarationsSummaries')
  assert.equal(result.data.metadata?.version, 'v2')
  assert.equal(result.data.metadata?.orderby, 'declarationDate DESC')
  assert.equal(result.data.metadata?.url, '/api/open/v2/DisasterDeclarationsSummaries?%24top=5&%24orderby=declarationDate+desc')
  assert.equal(dom.provider, result.data.DisasterDeclarationsSummaries.length)
  assert.equal(dom.valid, result.data.DisasterDeclarationsSummaries.length)
  assert.equal(dom.invalid, 0)
  assert.equal(dom.incomplete, 0)
  assert.equal(dom.primaryRecordId, String(first.id))
  assert.equal(dom.recordId, String(first.id))
  assert.equal(dom.primaryDeclarationId, String(first.femaDeclarationString))
  assert.equal(dom.declarationId, String(first.femaDeclarationString))
  assert.equal(dom.disasterNumber, String(first.disasterNumber))
  assert.equal(dom.area, String(first.designatedArea))
  assert.equal(dom.stateCode, String(first.state))
  assert.equal(dom.incidentType, String(first.incidentType))
  assert.equal(dom.declarationDate, String(first.declarationDate))
  assert.equal(dom.facts['OpenFEMA record ID'], String(first.id))
  assert(dom.text.includes('area-level, not one-row-per-disaster'))
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
    id: 'fema-disasters',
    source: 'live provider',
    providerRecords: result.data.DisasterDeclarationsSummaries.length,
    identity: 'OpenFEMA record id + FEMA declaration id exact response match',
    areaAndIncident: 'exact response match',
    semanticState: 'ready',
    requestBound: true,
    providerMetadataEcho: 'exact $top=5 + declarationDate DESC + v2 URL acknowledgement',
    mobileOverflow: false,
    unnamedControls: 0,
  })

  const mixedUrl = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?%24top=5&%24orderby=declarationDate+desc'
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[mixedUrl, { body: {
    metadata: { skip: 0, top: 5, orderby: 'declarationDate DESC', entityname: 'DisasterDeclarationsSummaries', version: 'v2', url: '/api/open/v2/DisasterDeclarationsSummaries?%24top=5&%24orderby=declarationDate+desc' },
    DisasterDeclarationsSummaries: [
      {
        id: '3d9e9eef-ce3e-4932-a626-f13dc549f8a6',
        femaDeclarationString: 'DR-4943-KS',
        disasterNumber: 4943,
        state: 'KS',
        declarationType: 'DR',
        declarationDate: '2026-09-01T00:00:00.000Z',
        incidentType: 'Severe Storm',
        declarationTitle: 'SEVERE STORMS AND FLOODING',
        paProgramDeclared: true,
        designatedArea: 'Sheridan (County)',
      },
      {
        femaDeclarationString: 'DR-9999-ZZ',
        disasterNumber: 9999,
        state: 'ZZ',
        incidentType: 'Fabricated Incident',
        designatedArea: 'Fabricated Area',
      },
    ],
  } }]]) })
  try {
    await mixed.nav('fema-disasters')
    const mixedResult = await mixed.run()
    assert.equal(mixedResult.ok, true, mixedResult.error)
    const mixedDom = await mixed.ev(`(() => {
      const card = document.querySelector('.fema-disaster-preview')
      return {
        state: card?.dataset.resultState,
        requestBound: card?.dataset.requestBound,
        metadataContract: card?.dataset.metadataContract,
        rowCountContract: card?.dataset.rowCountContract,
        provider: Number(card?.dataset.providerRecordCount),
        valid: Number(card?.dataset.validRecordCount),
        invalid: Number(card?.dataset.invalidRecordCount),
        rows: document.querySelectorAll('.fema-disaster-preview [data-record-id]').length,
        text: card?.innerText || '',
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      }
    })()`)
    assert.deepEqual({ state:mixedDom.state, requestBound:mixedDom.requestBound, metadataContract:mixedDom.metadataContract, rowCountContract:mixedDom.rowCountContract, provider:mixedDom.provider, valid:mixedDom.valid, invalid:mixedDom.invalid, rows:mixedDom.rows }, { state:'partial', requestBound:'true', metadataContract:'true', rowCountContract:'true', provider:2, valid:1, invalid:1, rows:1 })
    assert(mixedDom.text.includes('Sheridan (County)'))
    assert.equal(mixedDom.text.includes('Fabricated Area'), false)
    assert.equal(mixedDom.text.includes('DR-9999-ZZ'), false)
    assert.equal(mixedDom.overflow, false)
    assert.deepEqual(mixed.fixtureRequests.filter((request) => request.method === 'GET').map((request) => ({ url:request.url, source:request.source, status:request.status })), [{ url:mixedUrl, source:'synthetic-fixture', status:200 }])
    await mixed.viewport(390, 844)
    const mixedAx = await mixed.call('Accessibility.getFullAXTree')
    assert.equal(unnamed(mixedAx.nodes).length, 0)
    report.checks.push({ id:'fema-disasters', case:'mixed HTTP-200 declared-area rows', source:'synthetic fixture', semanticState:'partial', providerRecords:2, validRecords:1, invalidRecords:1, fabricatedIdentityHidden:true, mobileOverflow:false, unnamedControls:0 })
    report.errors.push(...mixed.errors.map(String))
  } finally {
    await mixed.close()
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

fs.writeFileSync(`${evidence}/fema-disaster-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/fema-disaster-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
