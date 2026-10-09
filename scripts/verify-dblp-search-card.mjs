import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const term = 'large language models'
const limit = 6
const query = `PREFIX dblp: <https://dblp.org/rdf/schema#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nSELECT ?publ ?title ?year ?venue ?doi ?authorName WHERE {\n  {\n    SELECT ?publ ?title WHERE {\n      ?publ a dblp:Publication ; dblp:title ?title .\n      FILTER(CONTAINS(LCASE(STR(?title)), LCASE("${term}")))\n    }\n    LIMIT ${limit}\n  }\n  OPTIONAL { ?publ dblp:yearOfPublication ?year . }\n  OPTIONAL { ?publ dblp:publishedIn ?venue . }\n  OPTIONAL { ?publ dblp:doi ?doi . }\n  OPTIONAL { ?publ dblp:authoredBy ?author . ?author rdfs:label ?authorName . }\n}\nORDER BY ?publ ?authorName`
const endpoint = `https://sparql.dblp.org/sparql?${new URLSearchParams({ query })}`
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', checks:[], errors:[] }
const unnamed = (nodes) => nodes.filter((n) => !n.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(n.role?.value) && !(n.name?.value || '').trim())
const semantic = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview');const c=s?.querySelector('[data-domain-card="dblp-search"]');return{layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',bound:c?.dataset.requestBound||'',term:c?.dataset.requestQuery||'',limit:Number(c?.dataset.requestLimit||0),bindings:Number(c?.dataset.bindingCount||0),pubs:Number(c?.dataset.publicationCount||0),invalid:Number(c?.dataset.invalidRowCount||0),dups:Number(c?.dataset.duplicateRowCount||0),wrong:Number(c?.dataset.wrongTitleRowCount||0),conflicts:Number(c?.dataset.conflictCount||0),overflow:Number(c?.dataset.overflowPublicationCount||0),text:c?.innerText||''}})()`)
const validUri = (v) => { try { const u=new URL(v); return u.protocol==='https:' && u.hostname==='dblp.org' && u.pathname.startsWith('/rec/') } catch { return false } }
let active
try {
  const live=await browser(`${root}/dist`); active=live; await live.nav('dblp-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`),endpoint)
  const before=live.requestCount; const result=await live.run(); assert.equal(result.ok,true,result.error)
  assert.equal(live.requestCount-before,1,'DBLP verifier must issue exactly one live provider request')
  assert.deepEqual(result.data?.head?.vars,['publ','title','year','venue','doi','authorName'])
  const rows=result.data?.results?.bindings; assert(Array.isArray(rows) && rows.length>0,'DBLP bindings missing')
  const uris=[...new Set(rows.map((r)=>r?.publ?.value).filter(validUri))]
  assert.equal(uris.length,limit,'DBLP bounded publication count drifted')
  assert(rows.every((r)=>typeof r?.title?.value==='string' && r.title.value.toLowerCase().includes(term)),'DBLP title-search contract drifted')
  const dom=await semantic(live)
  assert.deepEqual({layout:dom.layout,fallback:dom.fallback,state:dom.state,bound:dom.bound,term:dom.term,limit:dom.limit,bindings:dom.bindings,pubs:dom.pubs,invalid:dom.invalid,dups:dom.dups,wrong:dom.wrong,conflicts:dom.conflicts,overflow:dom.overflow},{layout:'dblp-publications',fallback:'false',state:'ready',bound:'true',term,limit,bindings:rows.length,pubs:limit,invalid:0,dups:0,wrong:0,conflicts:0,overflow:0})
  assert(dom.text.includes(uris[0])); assert(dom.text.includes(rows[0].title.value.trim()))
  await live.viewport(390,844); const overflow=await live.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`); assert.equal(overflow.doc||overflow.preview,false,JSON.stringify(overflow))
  const ax=await live.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length,0); assert.deepEqual(live.errors,[])
  report.checks.push({id:'dblp-search',source:'live provider',returnedBindings:rows.length,publications:uris.length,primaryPublication:uris[0],semanticState:dom.state,browserCorsReadable:true,mobileOverflow:false,unnamedControls:0})
  await live.close(); active=undefined

  const cell=(value,type='literal')=>({type,value}); const trusted={publ:cell('https://dblp.org/rec/conf/demo/Trusted26','uri'),title:cell('Large Language Models for Trusted Systems'),year:cell('2026'),venue:cell('DemoConf'),doi:cell('https://doi.org/10.1/trusted','uri'),authorName:cell('Trusted Author')}
  const body={head:{vars:['publ','title','year','venue','doi','authorName']},results:{bindings:[trusted,trusted,{...trusted,publ:cell('https://dblp.org/rec/conf/demo/Wrong26','uri'),title:cell('Unrelated database systems paper'),authorName:cell('Fabricated Author')}]}}
  const fixture=await browser(`${root}/dist`,{fixtures:new Map([[endpoint,{body}]])}); active=fixture; await fixture.nav('dblp-search')
  const fBefore=fixture.requestCount; const fResult=await fixture.run(); assert.equal(fResult.ok,true,fResult.error); const fDom=await semantic(fixture)
  assert.deepEqual({state:fDom.state,bound:fDom.bound,pubs:fDom.pubs,invalid:fDom.invalid,dups:fDom.dups,wrong:fDom.wrong},{state:'partial',bound:'true',pubs:1,invalid:1,dups:1,wrong:1})
  assert.equal(fDom.text.includes('Fabricated Author'),false); assert.equal(fDom.text.includes('Unrelated database systems paper'),false)
  const fixtureRequests=fixture.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length; assert.equal(fixtureRequests,1); assert.equal(fixture.requestCount-fBefore,fixtureRequests); assert.deepEqual(fixture.errors,[])
  report.checks.push({id:'dblp-search',case:'duplicate + wrong-title HTTP-200 fixture',semanticState:fDom.state,fabricatedIdentityHidden:true,liveProviderRequests:0})
  await fixture.close(); active=undefined; report.verdict='PASS'
} catch(error) { report.verdict='FAIL'; report.error=String(error); if(active){report.errors.push(...active.errors.map(String));report.networkFailures=active.networkFailures} }
finally { if(active) await active.close() }
fs.writeFileSync(`${evidence}/dblp-search-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/dblp-search-card.json`},null,2)); process.exit(report.verdict==='PASS'?0:1)
