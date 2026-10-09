import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live Environment Agency Flood Monitoring API from the Pages origin',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('uk-flood-monitoring')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data?.items), 'Environment Agency response did not expose items[]')
  assert(result.data.items.length > 0, 'Environment Agency returned no stations for River Severn')
  assert(result.data.items.every((item) => item?.riverName === 'River Severn'), 'Environment Agency did not honor exact riverName')
  assert.equal(result.data?.meta?.limit, 8, 'Environment Agency metadata must echo the native integer applied _limit')

  const first = result.data.items[0] || {}
  assert.equal(typeof first.label, 'string')
  assert.equal(typeof first.notation, 'string')
  assert.equal(typeof first.stationReference, 'string')
  const dom = await b.ev(`(() => {
    const shell = document.querySelector('.demo-preview')
    const card = shell.querySelector('.flood-stations-preview')
    const row = card.querySelector('[data-station-index="1"]')
    const facts = Object.fromEntries([...row.querySelectorAll('.domain-facts>div')].map((node) => [node.querySelector('dt')?.textContent || '', node.querySelector('dd')?.textContent || '']))
    return {
      layout: shell.dataset.previewLayout,
      fallback: shell.dataset.ssotFallback,
      state: card.dataset.resultState,
      requestBound: card.dataset.requestBound,
      requestedRiver: card.dataset.requestedRiver,
      requestLimit: Number(card.dataset.requestLimit),
      providerLimit: Number(card.dataset.providerLimit),
      metadataContract: card.dataset.metadataContract,
      countContract: card.dataset.countContract,
      filterContract: card.dataset.filterContract,
      filterMismatch: Number(card.dataset.filterMismatchCount),
      duplicateRecords: Number(card.dataset.duplicateRecordCount),
      provider: Number(card.dataset.providerRecordCount),
      valid: Number(card.dataset.validRecordCount),
      invalid: Number(card.dataset.invalidRecordCount),
      primary: card.dataset.primaryStationReference,
      reference: row.dataset.stationReference,
      notation: row.dataset.stationNotation,
      river: row.dataset.riverName,
      label: row.querySelector('h4')?.textContent || '',
      latitude: row.dataset.latitude === undefined ? null : Number(row.dataset.latitude),
      longitude: row.dataset.longitude === undefined ? null : Number(row.dataset.longitude),
      measureCount: Number(row.dataset.measureCount),
      facts,
      text: card.innerText || '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }
  })()`)

  assert.equal(dom.layout, 'flood-stations')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestedRiver, 'River Severn')
  assert.equal(dom.requestLimit, 8)
  assert.equal(dom.providerLimit, 8)
  assert.equal(dom.metadataContract, 'true')
  assert.equal(dom.countContract, 'true')
  assert.equal(dom.filterContract, 'true')
  assert.equal(dom.filterMismatch, 0)
  assert.equal(dom.duplicateRecords, 0)
  assert.equal(dom.provider, result.data.items.length)
  assert.equal(dom.valid, result.data.items.length)
  assert.equal(dom.invalid, 0)
  assert.equal(dom.primary, String(first.stationReference))
  assert.equal(dom.reference, String(first.stationReference))
  assert.equal(dom.notation, String(first.notation))
  assert.equal(dom.river, String(first.riverName))
  assert.equal(dom.label, String(first.label))
  assert.equal(dom.latitude, first.lat == null ? null : Number(first.lat))
  assert.equal(dom.longitude, first.long == null ? null : Number(first.long))
  assert.equal(dom.measureCount, Array.isArray(first.measures) ? first.measures.length : 0)
  assert.equal(dom.facts['Station reference'], String(first.stationReference))
  assert(dom.text.includes('Live readings and flood warnings are separate API resources.'))
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
    id: 'uk-flood-monitoring',
    source: 'live provider',
    providerRecords: result.data.items.length,
    identity: 'label + notation + stationReference exact response match',
    riverAndLocation: 'exact response match',
    measures: 'provider count exact',
    semanticState: 'ready',
    requestBound: true,
    requestedRiver: 'River Severn',
    requestedLimit: 8,
    providerLimit: 8,
    filterContract: true,
    mobileOverflow: false,
    unnamedControls: 0,
  })

  const mixedUrl = 'https://environment.data.gov.uk/flood-monitoring/id/stations?riverName=River+Severn&_limit=8'
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[mixedUrl, { body: {
    meta: { limit: 8 },
    items: [
      {
        '@id': 'http://environment.data.gov.uk/flood-monitoring/id/stations/2642',
        label: 'Worcester (Barbourne)',
        notation: '2642',
        stationReference: '2642',
        riverName: 'River Severn',
        measures: [],
      },
      { label: 'Fabricated Station', riverName: 'River Severn' },
    ],
  } }]]) })
  try {
    await mixed.nav('uk-flood-monitoring')
    const mixedResult = await mixed.run()
    assert.equal(mixedResult.ok, true, mixedResult.error)
    const mixedDom = await mixed.ev(`(() => {
      const card = document.querySelector('.flood-stations-preview')
      return {
        state: card?.dataset.resultState,
        provider: Number(card?.dataset.providerRecordCount),
        valid: Number(card?.dataset.validRecordCount),
        invalid: Number(card?.dataset.invalidRecordCount),
        rows: document.querySelectorAll('.flood-stations-preview [data-station-reference]').length,
        text: card?.innerText || '',
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      }
    })()`)
    assert.deepEqual({ state:mixedDom.state, provider:mixedDom.provider, valid:mixedDom.valid, invalid:mixedDom.invalid, rows:mixedDom.rows }, { state:'partial', provider:2, valid:1, invalid:1, rows:1 })
    assert(mixedDom.text.includes('Worcester (Barbourne)'))
    assert.equal(mixedDom.text.includes('Fabricated Station'), false)
    assert.equal(mixedDom.text.includes('Station 2'), false)
    assert.equal(mixedDom.overflow, false)
    assert.deepEqual(mixed.fixtureRequests.filter((request) => request.method === 'GET').map((request) => ({ url:request.url, source:request.source, status:request.status })), [{ url:mixedUrl, source:'synthetic-fixture', status:200 }])
    await mixed.viewport(390, 844)
    const mixedAx = await mixed.call('Accessibility.getFullAXTree')
    assert.equal(unnamed(mixedAx.nodes).length, 0)
    report.checks.push({ id:'uk-flood-monitoring', case:'mixed HTTP-200 station rows', source:'synthetic fixture', semanticState:'partial', providerRecords:2, validRecords:1, invalidRecords:1, fabricatedIdentityHidden:true, mobileOverflow:false, unnamedControls:0 })
    report.errors.push(...mixed.errors.map(String))
  } finally {
    await mixed.close()
  }

  for (const [label, body, expected] of [
    ['wrong-river HTTP-200 row', { meta:{ limit:8 }, items:[{ '@id':'http://environment.data.gov.uk/flood-monitoring/id/stations/2642', label:'Worcester (Barbourne)', notation:'2642', stationReference:'2642', riverName:'River Thames', measures:[] }] }, { filter:'false', metadata:'true' }],
    ['numeric-string metadata limit', { meta:{ limit:'8' }, items:[{ '@id':'http://environment.data.gov.uk/flood-monitoring/id/stations/2642', label:'Worcester (Barbourne)', notation:'2642', stationReference:'2642', riverName:'River Severn', measures:[] }] }, { filter:'', metadata:'false' }],
  ]) {
    const synthetic = await browser(`${root}/dist`, { fixtures:new Map([[mixedUrl,{ body }]]), blockedProviderPatterns:['https://environment.data.gov.uk/*'] })
    try {
      await synthetic.nav('uk-flood-monitoring')
      const result = await synthetic.run()
      assert.equal(result.ok, true, result.error)
      const evidence = await synthetic.ev(`(()=>{const c=document.querySelector('[data-domain-card=\"flood-stations\"]');return {state:c?.dataset.resultState||'',requestBound:c?.dataset.requestBound||'',metadata:c?.dataset.metadataContract||'',filter:c?.dataset.filterContract||'',text:c?.innerText||''}})()`)
      assert.equal(evidence.state, 'invalid')
      assert.equal(evidence.requestBound, 'true')
      assert.equal(evidence.metadata, expected.metadata)
      if (expected.filter) assert.equal(evidence.filter, expected.filter)
      assert.equal(evidence.text.includes('Worcester (Barbourne)'), false)
      assert.equal(synthetic.fixtureRequests.filter((request)=>request.url===mixedUrl&&request.method==='GET').length,1)
      assert.deepEqual(synthetic.blockedProviders, [])
      assert.deepEqual(synthetic.errors, [])
      report.checks.push({ id:'uk-flood-monitoring', case:label, source:'synthetic fixture', semanticState:'invalid', requestBound:true, metadataContract:expected.metadata, filterContract:expected.filter || 'not-applicable', plausibleStationHidden:true, liveProviderRequests:0 })
    } finally { await synthetic.close() }
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

fs.writeFileSync(`${evidence}/flood-station-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/flood-station-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
