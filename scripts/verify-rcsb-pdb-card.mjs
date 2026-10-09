import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://data.rcsb.org/rest/v1/core/entry/4HHB'
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', source:'live RCSB PDB core_entry 4HHB plus synthetic HTTP-200 identity fixtures', checks:[], errors:[] }
const unnamed = nodes => nodes.filter(node => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value||'').trim())
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('rcsb-pdb-entry')
  const result = await b.run(); assert.equal(result.ok,true,result.error)
  assert.equal(result.data?.rcsb_id,'4HHB')
  assert.equal(result.data?.entry?.id,'4HHB')
  assert.equal(result.data?.rcsb_entry_container_identifiers?.entry_id,'4HHB')
  assert(Array.isArray(result.data?.exptl) && result.data.exptl.length > 0, 'RCSB live entry lacks experimental method records')
  assert.equal(typeof result.data?.struct?.title,'string')
  const methods = result.data.exptl.map(row => row?.method).filter(Boolean)
  const release = String(result.data?.rcsb_accession_info?.initial_release_date || '').slice(0,10)
  const dom = await b.ev(`(()=>{const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('.pdb-structure-preview');return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requested:card?.dataset.requestedEntryId||'',identity:card?.dataset.identityMatch||'',rcsbId:card?.dataset.rcsbId||'',entryId:card?.dataset.entryId||'',containerId:card?.dataset.containerEntryId||'',method:card?.dataset.experimentalMethod||'',resolution:card?.dataset.resolutionAngstroms===undefined?null:Number(card.dataset.resolutionAngstroms),release:card?.dataset.initialReleaseDate||'',text:card?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
  assert.equal(dom.layout,'molecular-structure'); assert.equal(dom.fallback,'false'); assert.equal(dom.state,'ready'); assert.equal(dom.requestBound,'true')
  assert.equal(dom.requested,'4HHB'); assert.equal(dom.identity,'true'); assert.equal(dom.rcsbId,result.data.rcsb_id); assert.equal(dom.entryId,result.data.entry.id); assert.equal(dom.containerId,result.data.rcsb_entry_container_identifiers.entry_id)
  assert.equal(dom.method,methods.join(', ')); assert.equal(dom.release,release); assert(dom.text.includes(result.data.struct.title)); assert.equal(dom.overflow,false)
  await b.viewport(390,844); const mobile=await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`); assert.equal(mobile.documentOverflow||mobile.previewOverflow,false,JSON.stringify(mobile))
  const ax=await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length,0)
  report.checks.push({id:'rcsb-pdb-entry',case:'live RCSB core_entry 4HHB contract',semanticState:'ready',requestBound:true,identity:'rcsb_id + entry.id + container entry_id exact response/request match',experimentalMethod:'exact response match',initialReleaseDate:'exact response match',mobileOverflow:false,unnamedControls:0})
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors,[]); await b.close(); b=undefined

  const malformed=await browser(`${root}/dist`,{fixtures:new Map([[endpoint,{body:{entry:{id:'4HHB'},struct:{title:'Fabricated structure'}}}]])})
  try { await malformed.nav('rcsb-pdb-entry'); const r=await malformed.run(); assert.equal(r.ok,true,r.error); const d=await malformed.ev(`(()=>{const c=document.querySelector('[data-domain-card="molecular-structure"]');return {state:c?.dataset.resultState||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`); assert.equal(d.state,'invalid'); assert.match(d.text,/provider-owned rcsb_id, entry.id, and container entry_id/); assert.equal(d.text.includes('Fabricated structure'),false); assert.match(d.http,/^200/); assert.equal(malformed.fixtureRequests.filter(x=>x.url===endpoint&&x.method==='GET').length,1); assert.deepEqual(malformed.errors,[]); report.checks.push({id:'rcsb-pdb-entry',case:'synthetic malformed HTTP-200 core entry',transportStatus:200,semanticState:'invalid',fabricatedStructureHidden:true}) } finally { await malformed.close() }

  const mismatchBody={rcsb_id:'1ABC',entry:{id:'1ABC'},rcsb_entry_container_identifiers:{entry_id:'1ABC'},struct:{title:'Fabricated wrong PDB entry'},exptl:[{method:'X-RAY DIFFRACTION'}],rcsb_accession_info:{status_code:'REL',initial_release_date:'2020-01-01T00:00:00Z'}}
  const mismatch=await browser(`${root}/dist`,{fixtures:new Map([[endpoint,{body:mismatchBody}]])})
  try { await mismatch.nav('rcsb-pdb-entry'); const r=await mismatch.run(); assert.equal(r.ok,true,r.error); const d=await mismatch.ev(`(()=>{const c=document.querySelector('[data-domain-card="molecular-structure"]');return {state:c?.dataset.resultState||'',text:c?.innerText||''}})()`); assert.equal(d.state,'invalid'); assert.match(d.text,/identity mismatch/i); assert.equal(d.text.includes('Fabricated wrong PDB entry'),false); assert.deepEqual(mismatch.errors,[]); report.checks.push({id:'rcsb-pdb-entry',case:'synthetic HTTP-200 requested-entry mismatch',semanticState:'invalid',fabricatedStructureHidden:true}) } finally { await mismatch.close() }
  report.verdict='PASS'
} catch(error){ report.verdict='FAIL'; report.error=String(error); if(b) report.errors.push(...b.errors.map(String)) }
finally { if(b) await b.close() }
fs.writeFileSync(`${evidence}/rcsb-pdb-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/rcsb-pdb-card.json`},null,2)); process.exit(report.verdict==='PASS'?0:1)
