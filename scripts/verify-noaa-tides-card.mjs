import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint='https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=8518750&product=water_level&date=latest&datum=MLLW&units=metric&time_zone=gmt&application=Public_API_Workbench&format=json'
const report={origin:'https://yapweijun1996.github.io',publication:'unpublished local app bundle under the real GitHub Pages origin',source:'live NOAA CO-OPS water_level date=latest response plus synthetic HTTP-200 semantic-contract fixtures',checks:[],errors:[]}
const unnamed=nodes=>nodes.filter(node=>!node.ignored&&['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value)&&!(node.name?.value||'').trim())
let b
try {
  b=await browser(`${root}/dist`)
  await b.nav('noaa-tides')
  const requestCountBeforeRun=b.requestCount
  const result=await b.run()
  const liveRequestCount=b.requestCount-requestCountBeforeRun;assert.equal(liveRequestCount,1,'NOAA live verification must use exactly one Request Lab fetch')
  assert.equal(result.ok,true,result.error)
  assert.equal(result.data?.metadata?.id,'8518750','NOAA live response did not identify the requested station')
  assert(Array.isArray(result.data?.data)&&result.data.data.length===1,'NOAA date=latest did not return exactly one observation')
  const row=result.data.data[0]
  assert.match(String(row.t),/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  assert.equal(Number.isFinite(Number(row.v)),true,'NOAA latest observation is missing measured water level')
  assert(['p','v'].includes(String(row.q).toLowerCase()),'NOAA latest observation is missing documented QA/QC identity')
  const dom=await b.ev(`(()=>{const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('.tide-water-level-preview');return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',requested:card?.dataset.requestedStationId||'',identity:card?.dataset.identityMatch||'',provider:Number(card?.dataset.providerRecordCount),valid:Number(card?.dataset.validRecordCount),invalid:Number(card?.dataset.invalidRecordCount),countValid:card?.dataset.countContractValid||'',station:card?.dataset.stationId||'',name:card?.dataset.stationName||'',value:Number(card?.dataset.primaryWaterLevel),unit:card?.dataset.waterLevelUnit||'',observedAt:card?.dataset.observedAt||'',quality:card?.dataset.qualityLevel||'',datum:card?.dataset.datum||'',timeZone:card?.dataset.timeZone||'',sigma:Number(card?.dataset.sigma),flags:card?.dataset.flags||'',latitude:Number(card?.dataset.latitude),longitude:Number(card?.dataset.longitude),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
  assert.deepEqual({layout:dom.layout,fallback:dom.fallback,state:dom.state},{layout:'coastal-water-level',fallback:'false',state:'ready'})
  assert.equal(dom.requestBound,'true');assert.equal(dom.requestContract,'exact-water-level-latest-mllw-metric-gmt-json');assert.equal(dom.requested,'8518750');assert.equal(dom.identity,'true');assert.equal(dom.provider,1);assert.equal(dom.valid,1);assert.equal(dom.invalid,0);assert.equal(dom.countValid,'true')
  assert.equal(dom.station,String(result.data.metadata.id));assert.equal(dom.name,String(result.data.metadata.name));assert.equal(dom.value,Number(row.v));assert.equal(dom.unit,'m');assert.equal(dom.observedAt,String(row.t));assert.equal(dom.quality,String(row.q).toLowerCase());assert.equal(dom.datum,'MLLW');assert.equal(dom.timeZone,'gmt');assert.equal(dom.sigma,Number(row.s));assert.equal(dom.flags,String(row.f));assert.equal(dom.latitude,Number(result.data.metadata.lat));assert.equal(dom.longitude,Number(result.data.metadata.lon));assert.equal(dom.overflow,false)
  await b.viewport(390,844)
  const mobile=await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow||mobile.previewOverflow,false,JSON.stringify(mobile))
  const ax=await b.call('Accessibility.getFullAXTree');assert.equal(unnamed(ax.nodes).length,0)
  report.checks.push({id:'noaa-tides',case:'live NOAA date=latest water-level contract',semanticState:'ready',requestBinding:'exact supported request',liveRequestCount,stationIdentity:'exact request/response match',measurement:'exact response match',qaQc:'exact response match',mobileOverflow:false,unnamedControls:0})
  report.errors.push(...b.errors.map(String));assert.deepEqual(report.errors,[])
  await b.close();b=undefined

  const malformed=await browser(`${root}/dist`,{fixtures:new Map([[endpoint,{body:{metadata:{id:'8518750',name:'The Battery',lat:'40.7006',lon:'-74.0142'},unexpected:[]}}]])})
  try {
    await malformed.nav('noaa-tides');const r=await malformed.run();assert.equal(r.ok,true,r.error)
    const d=await malformed.ev(`(()=>{const c=document.querySelector('[data-domain-card="coastal-water-level"]');return {state:c?.dataset.resultState||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(d.state,'invalid');assert.match(d.text,/documented water-level data array/);assert.match(d.http,/^200/);assert.equal(malformed.fixtureRequests.filter(request=>request.url===endpoint&&request.method==='GET').length,1);assert.deepEqual(malformed.errors,[])
    report.checks.push({id:'noaa-tides',case:'synthetic malformed HTTP-200 envelope',transportStatus:200,semanticState:'invalid',exactProviderFixtureRequests:1})
  } finally { await malformed.close() }

  const mixedBody={metadata:{id:'8518750',name:'The Battery',lat:'40.7006',lon:'-74.0142'},data:[{t:'2026-09-11 17:30',v:'0.408',s:'0.049',f:'1,0,0,0',q:'p'},{t:'bad-time',v:'999.999',s:'0.001',f:'0,0,0,0',q:'p'}]}
  const mixed=await browser(`${root}/dist`,{fixtures:new Map([[endpoint,{body:mixedBody}]])})
  try {
    await mixed.nav('noaa-tides');const r=await mixed.run();assert.equal(r.ok,true,r.error)
    const d=await mixed.ev(`(()=>{const c=document.querySelector('.tide-water-level-preview');return {state:c?.dataset.resultState||'',provider:Number(c?.dataset.providerRecordCount),valid:Number(c?.dataset.validRecordCount),invalid:Number(c?.dataset.invalidRecordCount),countValid:c?.dataset.countContractValid||'',text:c?.innerText||''}})()`)
    assert.deepEqual({state:d.state,provider:d.provider,valid:d.valid,invalid:d.invalid,countValid:d.countValid},{state:'partial',provider:2,valid:1,invalid:1,countValid:'false'});assert.equal(d.text.includes('999.999'),false);assert.deepEqual(mixed.errors,[])
    report.checks.push({id:'noaa-tides',case:'synthetic mixed HTTP-200 observation rows',semanticState:'partial',providerRecords:2,validRecords:1,invalidRecords:1,fabricatedMeasurementHidden:true})
  } finally { await mixed.close() }
  report.verdict='PASS'
} catch(error){report.verdict='FAIL';report.error=String(error);if(b)report.errors.push(...b.errors.map(String))}
finally{if(b)await b.close()}
fs.writeFileSync(`${evidence}/noaa-tides-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/noaa-tides-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
