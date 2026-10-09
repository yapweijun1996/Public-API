import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const networkId = 'youbike-taipei'
const endpoint = `https://api.citybik.es/v2/networks/${networkId}`
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', checks:[], errors:[] }
const unnamed = (nodes) => nodes.filter((n) => !n.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(n.role?.value) && !(n.name?.value || '').trim())
const semantic = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview');const c=s?.querySelector('[data-domain-card="citybikes-network"]');const first=c?.querySelector('.citybikes-station-list [data-station-id]');return{layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',bound:c?.dataset.requestBound||'',requestContract:c?.dataset.requestContract||'',requestNetwork:c?.dataset.requestNetwork||'',responseNetwork:c?.dataset.responseNetwork||'',provider:Number(c?.dataset.providerStationCount||0),valid:Number(c?.dataset.validStationCount||0),invalid:Number(c?.dataset.invalidStationCount||0),dups:Number(c?.dataset.duplicateStationCount||0),primary:c?.dataset.primaryStationId||'',free:Number(c?.dataset.freeBikesTotal||0),empty:Number(c?.dataset.emptySlotsTotal||0),firstId:first?.dataset.stationId||'',firstFree:Number(first?.dataset.freeBikes||0),firstEmpty:Number(first?.dataset.emptySlots||0),text:c?.innerText||''}})()`)
let active
try {
  const live=await browser(`${root}/dist`); active=live; await live.nav('citybikes-network')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before=live.requestCount; const result=await live.run(); assert.equal(result.ok,true,result.error)
  assert.equal(live.requestCount-before,1,'CityBikes verifier must issue exactly one live provider request')
  const network=result.data?.network; const stations=network?.stations
  assert.equal(network?.id,networkId); assert.equal(network?.href,`/v2/networks/${networkId}`)
  assert(Array.isArray(stations) && stations.length>0,'CityBikes stations missing')
  assert(stations.every((row)=>typeof row?.id==='string' && typeof row?.name==='string' && typeof row?.latitude==='number' && typeof row?.longitude==='number' && Number.isSafeInteger(row?.free_bikes) && row.free_bikes>=0 && Number.isSafeInteger(row?.empty_slots) && row.empty_slots>=0 && typeof row?.timestamp==='string'),'CityBikes station wire contract drifted')
  const ids=stations.map((row)=>row.id); assert.equal(new Set(ids).size,ids.length,'CityBikes station IDs are no longer unique')
  const dom=await semantic(live)
  assert.deepEqual({layout:dom.layout,fallback:dom.fallback,state:dom.state,bound:dom.bound,requestContract:dom.requestContract,requestNetwork:dom.requestNetwork,responseNetwork:dom.responseNetwork,provider:dom.provider,valid:dom.valid,invalid:dom.invalid,dups:dom.dups,primary:dom.primary},{layout:'bike-share-network',fallback:'false',state:'ready',bound:'true',requestContract:'exact-citybikes-network-v3',requestNetwork:networkId,responseNetwork:networkId,provider:stations.length,valid:stations.length,invalid:0,dups:0,primary:stations[0].id})
  assert.equal(dom.firstId,stations[0].id); assert.equal(dom.firstFree,stations[0].free_bikes); assert.equal(dom.firstEmpty,stations[0].empty_slots); assert(dom.text.includes(stations[0].name))
  await live.viewport(390,844)
  const overflow=await live.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.doc||overflow.preview,false,JSON.stringify(overflow))
  const ax=await live.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length,0); assert.deepEqual(live.errors,[])
  report.checks.push({id:'citybikes-network',source:'live provider',stations:stations.length,primaryStation:stations[0].id,semanticState:dom.state,browserCorsReadable:true,mobileOverflow:false,unnamedControls:0})
  await live.close(); active=undefined

  const trusted={id:'trusted-station',name:'Trusted Station',latitude:25.03,longitude:121.56,timestamp:'2026-09-16T21:00:00+00:00Z',free_bikes:12,empty_slots:8}
  const malformed={id:'malformed-station',name:'Malformed Station',latitude:25.04,longitude:121.57,timestamp:'2026-09-16T21:00:00+00:00Z',free_bikes:'12',empty_slots:4}
  const duplicate={...trusted,name:'Duplicate Station'}
  const body={network:{id:networkId,name:'YouBike',href:`/v2/networks/${networkId}`,location:{latitude:25.0329636,longitude:121.5654268,city:'Taipei',country:'TW'},stations:[trusted,malformed,duplicate]}}
  const fixture=await browser(`${root}/dist`,{fixtures:new Map([[endpoint,{body}]])}); active=fixture; await fixture.nav('citybikes-network')
  const fBefore=fixture.requestCount; const fResult=await fixture.run(); assert.equal(fResult.ok,true,fResult.error); const fDom=await semantic(fixture)
  assert.deepEqual({state:fDom.state,bound:fDom.bound,provider:fDom.provider,valid:fDom.valid,invalid:fDom.invalid,dups:fDom.dups,primary:fDom.primary},{state:'partial',bound:'true',provider:3,valid:1,invalid:2,dups:1,primary:'trusted-station'})
  assert(fDom.text.includes('Trusted Station')); assert.equal(fDom.text.includes('Malformed Station'),false); assert.equal(fDom.text.includes('Duplicate Station'),false)
  const fixtureRequests=fixture.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length; assert.equal(fixtureRequests,1); assert.equal(fixture.requestCount-fBefore,fixtureRequests); assert.deepEqual(fixture.errors,[])
  report.checks.push({id:'citybikes-network',case:'malformed + duplicate HTTP-200 fixture',semanticState:fDom.state,untrustedStationsHidden:true,liveProviderRequests:0})
  await fixture.close(); active=undefined; report.verdict='PASS'
} catch(error) {
  report.verdict='FAIL'; report.error=String(error)
  if(active){report.errors.push(...active.errors.map(String));report.networkFailures=active.networkFailures}
} finally { if(active) await active.close() }
fs.writeFileSync(`${evidence}/citybikes-network-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/citybikes-network-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
