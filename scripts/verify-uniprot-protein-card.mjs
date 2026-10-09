import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://rest.uniprot.org/uniprotkb/P05067.json'
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', source:'live UniProtKB P05067 plus synthetic HTTP-200 contract fixtures', checks:[], errors:[] }
const unnamed = nodes => nodes.filter(node => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value||'').trim())
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('uniprot-protein')
  const result = await b.run(); assert.equal(result.ok,true,result.error)
  assert.equal(result.data?.primaryAccession,'P05067')
  assert.equal(typeof result.data?.uniProtkbId,'string')
  assert.equal(typeof result.data?.entryType,'string')
  assert.equal(typeof result.data?.organism?.scientificName,'string')
  assert.equal(typeof result.data?.sequence?.length,'number')
  const secondaries = Array.isArray(result.data.secondaryAccessions) ? result.data.secondaryAccessions : []
  const proteinName = result.data.proteinDescription?.recommendedName?.fullName?.value || result.data.proteinDescription?.submissionNames?.[0]?.fullName?.value || result.data.uniProtkbId
  const dom = await b.ev(`(()=>{const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('.protein-annotation-preview');return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',requested:card?.dataset.requestedAccession||'',role:card?.dataset.requestedAccessionRole||'',identity:card?.dataset.identityMatch||'',primary:card?.dataset.primaryAccession||'',secondaryCount:Number(card?.dataset.secondaryAccessionCount),invalidSecondaryCount:Number(card?.dataset.invalidSecondaryAccessionCount),entryName:card?.dataset.primaryEntryName||'',proteinName:card?.dataset.primaryProteinName||'',organism:card?.dataset.organismName||'',sequenceLength:Number(card?.dataset.sequenceLength),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
  assert.equal(dom.layout,'protein-annotation'); assert.equal(dom.fallback,'false'); assert.equal(dom.state,'ready'); assert.equal(dom.requestBound,'true'); assert.equal(dom.requestContract,'exact-uniprotkb-entry-json')
  assert.equal(dom.requested,'P05067'); assert.equal(dom.role,'primary'); assert.equal(dom.identity,'true'); assert.equal(dom.primary,result.data.primaryAccession)
  assert.equal(dom.secondaryCount,secondaries.length); assert.equal(dom.invalidSecondaryCount,0); assert.equal(dom.entryName,result.data.uniProtkbId); assert.equal(dom.proteinName,proteinName); assert.equal(dom.organism,result.data.organism.scientificName); assert.equal(dom.sequenceLength,result.data.sequence.length); assert.equal(dom.overflow,false)
  await b.viewport(390,844); const mobile=await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`); assert.equal(mobile.documentOverflow||mobile.previewOverflow,false,JSON.stringify(mobile))
  const ax=await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length,0)
  report.checks.push({id:'uniprot-protein',case:'live UniProtKB P05067 contract',semanticState:'ready',requestBound:true,requestContract:'exact-uniprotkb-entry-json',primaryAccession:'exact response match',secondaryAccessions:'exact count',proteinIdentity:'exact response match',mobileOverflow:false,unnamedControls:0})
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors,[]); await b.close(); b=undefined

  const malformed=await browser(`${root}/dist`,{fixtures:new Map([[endpoint,{body:{unexpected:[]}}]])})
  try { await malformed.nav('uniprot-protein'); const r=await malformed.run(); assert.equal(r.ok,true,r.error); const d=await malformed.ev(`(()=>{const c=document.querySelector('[data-domain-card="protein-annotation"]');return {state:c?.dataset.resultState||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`); assert.equal(d.state,'invalid'); assert.match(d.text,/valid primary accession/); assert.match(d.http,/^200/); assert.equal(malformed.fixtureRequests.filter(x=>x.url===endpoint&&x.method==='GET').length,1); assert.deepEqual(malformed.errors,[]); report.checks.push({id:'uniprot-protein',case:'synthetic malformed HTTP-200 entry',transportStatus:200,semanticState:'invalid'}) } finally { await malformed.close() }

  const mismatchBody={entryType:'UniProtKB reviewed (Swiss-Prot)',primaryAccession:'Q9Y6K9',secondaryAccessions:[],uniProtkbId:'IKBKG_HUMAN',organism:{scientificName:'Homo sapiens',taxonId:9606},proteinDescription:{recommendedName:{fullName:{value:'Inhibitor of nuclear factor kappa-B kinase subunit gamma'}}},sequence:{length:419,molWeight:48000}}
  const mismatch=await browser(`${root}/dist`,{fixtures:new Map([[endpoint,{body:mismatchBody}]])})
  try { await mismatch.nav('uniprot-protein'); const r=await mismatch.run(); assert.equal(r.ok,true,r.error); const d=await mismatch.ev(`(()=>{const c=document.querySelector('[data-domain-card="protein-annotation"]');return {state:c?.dataset.resultState||'',text:c?.innerText||''}})()`); assert.equal(d.state,'invalid'); assert.match(d.text,/identity mismatch/i); assert.equal(d.text.includes('Inhibitor of nuclear factor'),false); assert.deepEqual(mismatch.errors,[]); report.checks.push({id:'uniprot-protein',case:'synthetic HTTP-200 accession mismatch',semanticState:'invalid',fabricatedProteinHidden:true}) } finally { await mismatch.close() }
  report.verdict='PASS'
} catch(error){ report.verdict='FAIL'; report.error=String(error); if(b) report.errors.push(...b.errors.map(String)) }
finally { if(b) await b.close() }
fs.writeFileSync(`${evidence}/uniprot-protein-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/uniprot-protein-card.json`},null,2)); process.exit(report.verdict==='PASS'?0:1)
