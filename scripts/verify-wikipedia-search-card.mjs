import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query='Singapore'
const limit=8
const endpoint=`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action:'query', generator:'search', gsrsearch:query, gsrlimit:String(limit), prop:'pageimages|extracts', exintro:'1', explaintext:'1', piprop:'thumbnail', pithumbsize:'480', format:'json', origin:'*' }).toString()}`
const report={origin:'https://yapweijun1996.github.io',publication:'unpublished local app bundle under the real GitHub Pages origin',source:'one live English Wikipedia search plus one synthetic HTTP-200 semantic fixture',checks:[],errors:[]}
const unnamed=(nodes)=>nodes.filter((node)=>!node.ignored&&['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value)&&!(node.name?.value||'').trim())
const trusted=(row)=>Number.isSafeInteger(row?.pageid)&&row.pageid>0&&row?.ns===0&&Number.isSafeInteger(row?.index)&&row.index>0&&typeof row?.title==='string'&&row.title.trim().length>0
const semantic=(b)=>b.ev(`(()=>{const shell=document.querySelector('.demo-preview');const card=shell?.querySelector('[data-domain-card="wikipedia-search"]');return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',query:card?.dataset.requestQuery||'',limit:Number(card?.dataset.requestLimit||0),providerCount:Number(card?.dataset.providerRecordCount||0),validCount:Number(card?.dataset.validRecordCount||0),malformed:Number(card?.dataset.malformedRecordCount||0),duplicates:Number(card?.dataset.duplicateRecordCount||0),overflow:Number(card?.dataset.overflowRecordCount||0),primaryPageId:Number(card?.dataset.primaryPageId||0),text:card?.innerText||''};})()`)
let active
try{
  const live=await browser(`${root}/dist`);active=live
  await live.nav('wikipedia-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`),endpoint)
  const before=live.requestCount
  const result=await live.run();assert.equal(result.ok,true,result.error)
  assert.equal(live.requestCount-before,1,'Wikipedia verifier must issue exactly one live provider request')
  const pages=Object.values(result.data?.query?.pages||{})
  assert.equal(pages.length,limit,'Wikipedia default result count drifted')
  assert(pages.every(trusted),'Wikipedia article identity/search-order contract drifted')
  const expectedPrimary=[...pages].sort((a,b)=>a.index-b.index)[0]
  const dom=await semantic(live)
  assert.deepEqual({layout:dom.layout,fallback:dom.fallback,state:dom.state,requestBound:dom.requestBound,requestContract:dom.requestContract,query:dom.query,limit:dom.limit,providerCount:dom.providerCount,validCount:dom.validCount,malformed:dom.malformed,duplicates:dom.duplicates,overflow:dom.overflow,primaryPageId:dom.primaryPageId},{layout:'encyclopedia-search',fallback:'false',state:'ready',requestBound:'true',requestContract:'exact-wikipedia-generator-search-v1',query,limit,providerCount:limit,validCount:limit,malformed:0,duplicates:0,overflow:0,primaryPageId:expectedPrimary.pageid})
  assert(dom.text.includes(expectedPrimary.title),'Primary Wikipedia title missing from semantic DOM')
  assert(dom.text.includes('CC BY-SA'),'Wikipedia reuse boundary missing from semantic DOM')
  await live.viewport(390,844)
  const mobile=await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow||mobile.previewOverflow,false,JSON.stringify(mobile))
  const ax=await live.call('Accessibility.getFullAXTree');assert.equal(unnamed(ax.nodes).length,0)
  assert.deepEqual(live.errors,[])
  report.checks.push({id:'wikipedia-search',source:'live provider',exactRequest:endpoint,returnedRecords:pages.length,primaryPageId:expectedPrimary.pageid,semanticState:dom.state,requestBound:dom.requestBound,browserCorsReadable:true,mobileOverflow:false,unnamedControls:0})
  await live.close();active=undefined

  const good=(pageid,index,title='Singapore')=>({pageid,ns:0,index,title,extract:`${title} fixture extract`,thumbnail:{source:`https://upload.wikimedia.org/${pageid}.jpg`,width:480,height:320}})
  const fixtureBody={batchcomplete:'',query:{pages:{a:good(27318,1),b:good(27318,2,'Fabricated duplicate'),c:{...good(99,3,'Fabricated numeric-string identity'),pageid:'99'}}}}
  const fixture=await browser(`${root}/dist`,{fixtures:new Map([[endpoint,{body:fixtureBody,allowHeaders:'Api-User-Agent'}]])});active=fixture
  await fixture.nav('wikipedia-search');const fixtureBefore=fixture.requestCount
  const fixtureResult=await fixture.run();assert.equal(fixtureResult.ok,true,fixtureResult.error)
  const fixtureDom=await semantic(fixture)
  assert.deepEqual({state:fixtureDom.state,requestBound:fixtureDom.requestBound,validCount:fixtureDom.validCount,malformed:fixtureDom.malformed,duplicates:fixtureDom.duplicates,primaryPageId:fixtureDom.primaryPageId},{state:'partial',requestBound:'true',validCount:1,malformed:1,duplicates:1,primaryPageId:27318})
  assert.equal(fixtureDom.text.includes('Fabricated duplicate'),false);assert.equal(fixtureDom.text.includes('Fabricated numeric-string identity'),false)
  const fixtureGets=fixture.fixtureRequests.filter((request)=>request.url===endpoint&&request.method==='GET').length
  assert.equal(fixtureGets,1);assert.equal(fixture.requestCount-fixtureBefore,fixtureGets,'Fixture Wikipedia case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({id:'wikipedia-search',case:'mixed malformed/duplicate article identity HTTP-200 fixture',source:'synthetic fixture',semanticState:fixtureDom.state,validRecords:1,malformedRecords:1,duplicateRecords:1,fabricatedIdentitiesHidden:true,liveProviderRequests:0})
  await fixture.close();active=undefined;report.verdict='PASS'
}catch(error){report.verdict='FAIL';report.error=String(error);if(active){report.errors.push(...active.errors.map(String));report.networkFailures=active.networkFailures}}
finally{if(active)await active.close()}
fs.writeFileSync(`${evidence}/wikipedia-search-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/wikipedia-search-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
