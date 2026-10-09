import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://rest.ensembl.org/lookup/id/ENSG00000157764?content-type=application%2Fjson'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live Ensembl stable-ID lookup plus exact synthetic HTTP-200 semantic fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const geneFixture = {
  id:'ENSG00000157764', version:16, display_name:'BRAF', description:'B-Raf proto-oncogene', biotype:'protein_coding',
  species:'homo_sapiens', assembly_name:'GRCh38', seq_region_name:'7', start:140719327, end:140925199, strand:-1,
  object_type:'Gene', canonical_transcript:'ENST00000646891.2', source:'ensembl_havana', db_type:'core',
}
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('ensembl-gene-lookup')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.id, 'ENSG00000157764')
  assert.equal(result.data?.object_type, 'Gene')
  const dom = await b.ev(`(()=>{const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('.ensembl-gene-preview');return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', requested:card?.dataset.requestedGeneId||'', identity:card?.dataset.identityMatch||'', id:card?.dataset.primaryGeneId||'', objectType:card?.dataset.objectType||'',
    version:card?.dataset.geneVersion||'', symbol:card?.dataset.geneSymbol||'', biotype:card?.dataset.biotype||'', species:card?.dataset.species||'',
    assembly:card?.dataset.assembly||'', seqRegion:card?.dataset.seqRegion||'', start:card?.dataset.start||'', end:card?.dataset.end||'', strand:card?.dataset.strand||'',
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  }})()`)
  assert.equal(dom.layout, 'gene-locus'); assert.equal(dom.fallback, 'false'); assert.equal(dom.state, 'ready'); assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requested, 'ENSG00000157764'); assert.equal(dom.identity, 'true'); assert.equal(dom.id, String(result.data.id)); assert.equal(dom.objectType, 'Gene')
  assert.equal(dom.version, String(result.data.version ?? '')); assert.equal(dom.symbol, String(result.data.display_name ?? '')); assert.equal(dom.biotype, String(result.data.biotype ?? ''))
  assert.equal(dom.species, String(result.data.species ?? '')); assert.equal(dom.assembly, String(result.data.assembly_name ?? '')); assert.equal(dom.seqRegion, String(result.data.seq_region_name ?? ''))
  assert.equal(dom.start, String(result.data.start ?? '')); assert.equal(dom.end, String(result.data.end ?? '')); assert.equal(dom.strand, String(result.data.strand ?? '')); assert.equal(dom.overflow, false)
  await b.viewport(390,844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'ensembl-gene-lookup', case:'live BRAF Gene contract', semanticState:'ready', requestBound:true, identity:'exact request/response stable-ID match', objectType:'Gene', locus:'exact response match', mobileOverflow:false, unnamedControls:0 })

  const inputContract = await b.ev(`(()=>{const input=document.querySelector('input[name="geneId"]');return {pattern:input?.pattern||'',help:document.querySelector('#parameter-geneId-help')?.textContent||''}})()`)
  assert.equal(inputContract.pattern, 'ENS[A-Z]*G[0-9]{11}')
  assert.match(inputContract.help, /unversioned Ensembl gene stable ID/i)
  const beforeInvalidSubmission = b.requestCount
  await b.ev(`(()=>{const input=document.querySelector('input[name="geneId"]'),setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'ENST00000646891');input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('form.parameter-card').requestSubmit()})()`)
  await b.wait(`document.querySelector('input[name="geneId"]')?.getAttribute('aria-invalid') === 'true'`)
  assert.equal(b.requestCount, beforeInvalidSubmission, 'Transcript ID reached the gene-only provider request')
  report.checks.push({ id:'ensembl-gene-lookup', case:'human transcript-ID pre-network validation', invalidValue:'ENST00000646891', providerRequests:0, fieldPattern:inputContract.pattern })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const malformed = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{ body:{ object_type:'Gene', display_name:'FABRICATED' } }]]) })
  try {
    await malformed.nav('ensembl-gene-lookup'); const r=await malformed.run(); assert.equal(r.ok,true,r.error)
    const d=await malformed.ev(`(()=>{const c=document.querySelector('[data-domain-card="gene-locus"]');return {state:c?.dataset.resultState||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(d.state,'invalid'); assert.match(d.text,/without a stable identifier/); assert.equal(d.text.includes('FABRICATED'),false); assert.match(d.http,/^200/)
    assert.equal(malformed.fixtureRequests.filter(x=>x.url===endpoint&&x.method==='GET').length,1); assert.deepEqual(malformed.errors,[])
    report.checks.push({id:'ensembl-gene-lookup',case:'synthetic malformed HTTP-200 lookup object',transportStatus:200,semanticState:'invalid',fabricatedIdentityHidden:true})
  } finally { await malformed.close() }

  const mismatch = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{ body:{...geneFixture,id:'ENSG00000999999',display_name:'FABRICATED WRONG GENE'} }]]) })
  try {
    await mismatch.nav('ensembl-gene-lookup'); const r=await mismatch.run(); assert.equal(r.ok,true,r.error)
    const d=await mismatch.ev(`(()=>{const c=document.querySelector('[data-domain-card="gene-locus"]');return {state:c?.dataset.resultState||'',text:c?.innerText||''}})()`)
    assert.equal(d.state,'invalid'); assert.match(d.text,/identity mismatch/i); assert.equal(d.text.includes('FABRICATED WRONG GENE'),false); assert.deepEqual(mismatch.errors,[])
    report.checks.push({id:'ensembl-gene-lookup',case:'synthetic HTTP-200 stable-ID mismatch',semanticState:'invalid',fabricatedGeneHidden:true})
  } finally { await mismatch.close() }

  const transcript = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{ body:{...geneFixture,object_type:'Transcript',display_name:'FABRICATED TRANSCRIPT'} }]]) })
  try {
    await transcript.nav('ensembl-gene-lookup'); const r=await transcript.run(); assert.equal(r.ok,true,r.error)
    const d=await transcript.ev(`(()=>{const c=document.querySelector('[data-domain-card="gene-locus"]');return {state:c?.dataset.resultState||'',text:c?.innerText||''}})()`)
    assert.equal(d.state,'invalid'); assert.match(d.text,/not a gene/i); assert.equal(d.text.includes('FABRICATED TRANSCRIPT'),false); assert.deepEqual(transcript.errors,[])
    report.checks.push({id:'ensembl-gene-lookup',case:'synthetic HTTP-200 non-Gene feature',semanticState:'invalid',transcriptRelabellingPrevented:true})
  } finally { await transcript.close() }

  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/ensembl-gene-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/ensembl-gene-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
