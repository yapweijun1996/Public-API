import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/property/MolecularFormula,MolecularWeight,IUPACName/JSON'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live PubChem PUG REST aspirin property response plus synthetic HTTP-200 semantic-contract fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('pubchem-compound')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  const properties = result.data?.PropertyTable?.Properties
  assert(Array.isArray(properties), 'PubChem response did not expose PropertyTable.Properties[]')
  assert.equal(properties.length, 1, 'Default single-name PubChem lookup did not return exactly one property record')
  const first = properties[0] || {}
  assert.equal(Number.isInteger(first.CID) && first.CID > 0, true, 'PubChem property record lacks positive integer CID')
  assert.equal(typeof first.MolecularFormula, 'string')
  assert.equal(typeof first.MolecularWeight, 'string')
  assert.equal(typeof first.IUPACName, 'string')

  const dom = await b.ev(`(() => {
    const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('.pubchem-compound-preview')
    return {
      layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'',
      requested:card?.dataset.requestedCompoundName||'', providerRecords:Number(card?.dataset.providerRecordCount), validRecords:Number(card?.dataset.validRecordCount), invalidRecords:Number(card?.dataset.invalidRecordCount), cardinality:card?.dataset.resultCardinality||'',
      cid:Number(card?.dataset.primaryCid), iupac:card?.dataset.primaryIupacName||'', formula:card?.dataset.molecularFormula||'', weight:card?.dataset.molecularWeight||'',
      text:card?.innerText||'', overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
    }
  })()`)
  assert.equal(dom.layout, 'compound-properties'); assert.equal(dom.fallback, 'false'); assert.equal(dom.state, 'ready'); assert.equal(dom.requestBound, 'true'); assert.equal(dom.requestContract, 'exact-pug-compound-name-properties')
  assert.equal(dom.requested, 'aspirin'); assert.equal(dom.providerRecords, 1); assert.equal(dom.validRecords, 1); assert.equal(dom.invalidRecords, 0); assert.equal(dom.cardinality, 'single')
  assert.equal(dom.cid, Number(first.CID)); assert.equal(dom.iupac, String(first.IUPACName)); assert.equal(dom.formula, String(first.MolecularFormula)); assert.equal(dom.weight, String(first.MolecularWeight))
  assert(dom.text.includes(`CID ${first.CID}`)); assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'pubchem-compound', case:'live PubChem aspirin property contract', semanticState:'ready', requestBound:true, requestContract:'exact-pug-compound-name-properties', cid:'provider-owned exact response match', requestedProperties:'exact response match', mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: { unexpected: [] } }]]) })
  try {
    await malformed.nav('pubchem-compound'); const run = await malformed.run(); assert.equal(run.ok, true, run.error)
    const x = await malformed.ev(`(()=>{const c=document.querySelector('[data-domain-card="compound-properties"]');return {state:c?.dataset.resultState||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(x.state, 'invalid'); assert.match(x.text, /documented PropertyTable object/); assert.match(x.http, /^200/)
    assert.equal(malformed.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length,1); assert.deepEqual(malformed.errors, [])
    report.checks.push({ id:'pubchem-compound', case:'synthetic malformed HTTP-200 envelope', transportStatus:200, semanticState:'invalid', exactProviderFixtureRequests:1 })
  } finally { await malformed.close() }

  const empty = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: { PropertyTable: { Properties: [] } } }]]) })
  try {
    await empty.nav('pubchem-compound'); const run = await empty.run(); assert.equal(run.ok, true, run.error)
    const x = await empty.ev(`(()=>{const c=document.querySelector('[data-domain-card="compound-properties"]');return {state:c?.dataset.resultState||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(x.state, 'invalid'); assert.match(x.text, /HTTP 404/); assert.match(x.http, /^200/); assert.deepEqual(empty.errors, [])
    report.checks.push({ id:'pubchem-compound', case:'synthetic empty HTTP-200 property table', transportStatus:200, semanticState:'invalid', notFoundNotFabricated:true })
  } finally { await empty.close() }

  const multipleBody = { PropertyTable: { Properties: [
    { CID:2244, MolecularFormula:'C9H8O4', MolecularWeight:'180.16', IUPACName:'2-acetyloxybenzoic acid' },
    { CID:5793, MolecularFormula:'C6H12O6', MolecularWeight:'180.16', IUPACName:'glucose' },
  ] } }
  const multiple = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: multipleBody }]]) })
  try {
    await multiple.nav('pubchem-compound'); const run = await multiple.run(); assert.equal(run.ok, true, run.error)
    const x = await multiple.ev(`(()=>{const c=document.querySelector('.pubchem-compound-preview');return {state:c?.dataset.resultState||'',provider:Number(c?.dataset.providerRecordCount),valid:Number(c?.dataset.validRecordCount),invalid:Number(c?.dataset.invalidRecordCount),cardinality:c?.dataset.resultCardinality||'',cids:[...c.querySelectorAll('[data-cid]')].map(n=>n.dataset.cid),text:c?.innerText||''}})()`)
    assert.deepEqual({state:x.state,provider:x.provider,valid:x.valid,invalid:x.invalid,cardinality:x.cardinality},{state:'ready',provider:2,valid:2,invalid:0,cardinality:'multiple'})
    assert.deepEqual(x.cids,['2244','5793']); assert.match(x.text,/multiple provider-owned CIDs/i); assert.deepEqual(multiple.errors, [])
    report.checks.push({ id:'pubchem-compound', case:'synthetic multi-CID HTTP-200 property table', semanticState:'ready', providerRecords:2, validRecords:2, identitiesPreserved:true })
  } finally { await multiple.close() }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/pubchem-compound-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/pubchem-compound-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
