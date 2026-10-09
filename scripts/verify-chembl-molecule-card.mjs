import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://www.ebi.ac.uk/chembl/api/data/molecule/CHEMBL25.json'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live ChEMBL molecule detail response plus synthetic HTTP-200 semantic-contract fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('chembl-molecule')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.molecule_chembl_id, 'CHEMBL25')
  assert.equal(typeof result.data?.molecule_type, 'string')
  const properties = result.data?.molecule_properties || {}
  const dom = await b.ev(`(() => {
    const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('.chembl-molecule-preview')
    return {
      layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
      requestBound:card?.dataset.requestBound||'', requested:card?.dataset.requestedChemblId||'', identityMatch:card?.dataset.identityMatch||'', id:card?.dataset.primaryChemblId||'',
      name:card?.dataset.primaryName||'', type:card?.dataset.moleculeType||'', formula:card?.dataset.molecularFormula||'', weight:card?.dataset.molecularWeight||'',
      providerXrefs:Number(card?.dataset.providerCrossReferenceCount), validXrefs:Number(card?.dataset.validCrossReferenceCount), invalidXrefs:Number(card?.dataset.invalidCrossReferenceCount),
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
    }
  })()`)
  assert.equal(dom.layout, 'molecule-profile'); assert.equal(dom.fallback, 'false'); assert.equal(dom.state, 'ready'); assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requested, 'CHEMBL25'); assert.equal(dom.identityMatch, 'true'); assert.equal(dom.id, String(result.data.molecule_chembl_id))
  assert.equal(dom.name, String(result.data.pref_name || result.data.molecule_chembl_id)); assert.equal(dom.type, String(result.data.molecule_type))
  assert.equal(dom.formula, String(properties.full_molformula || '')); assert.equal(dom.weight, String(properties.full_mwt || ''))
  assert.equal(dom.providerXrefs, Array.isArray(result.data.cross_references) ? result.data.cross_references.length : 0)
  assert.equal(dom.validXrefs, dom.providerXrefs); assert.equal(dom.invalidXrefs, 0); assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'chembl-molecule', case:'live CHEMBL25 molecule detail contract', semanticState:'ready', requestBound:true, identity:'exact request/response match', profileFields:'exact response match', mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: { pref_name:'FABRICATED', molecule_type:'Small molecule' } }]]) })
  try {
    await malformed.nav('chembl-molecule'); const run = await malformed.run(); assert.equal(run.ok, true, run.error)
    const x = await malformed.ev(`(()=>{const c=document.querySelector('[data-domain-card="molecule-profile"]');return {state:c?.dataset.resultState||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(x.state, 'invalid'); assert.match(x.text, /molecule_chembl_id/); assert.equal(x.text.includes('FABRICATED'), false); assert.match(x.http, /^200/)
    assert.equal(malformed.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length,1); assert.deepEqual(malformed.errors, [])
    report.checks.push({ id:'chembl-molecule', case:'synthetic malformed HTTP-200 molecule object', transportStatus:200, semanticState:'invalid', fabricatedIdentityHidden:true })
  } finally { await malformed.close() }

  const mismatch = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: { molecule_chembl_id:'CHEMBL999', pref_name:'FABRICATED', molecule_type:'Small molecule', cross_references:[] } }]]) })
  try {
    await mismatch.nav('chembl-molecule'); const run = await mismatch.run(); assert.equal(run.ok, true, run.error)
    const x = await mismatch.ev(`(()=>{const c=document.querySelector('[data-domain-card="molecule-profile"]');return {state:c?.dataset.resultState||'',text:c?.innerText||''}})()`)
    assert.equal(x.state, 'invalid'); assert.match(x.text, /identity mismatch/i); assert.equal(x.text.includes('FABRICATED'), false); assert.deepEqual(mismatch.errors, [])
    report.checks.push({ id:'chembl-molecule', case:'synthetic HTTP-200 request/response identity mismatch', semanticState:'invalid', fabricatedProfileHidden:true })
  } finally { await mismatch.close() }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/chembl-molecule-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/chembl-molecule-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
