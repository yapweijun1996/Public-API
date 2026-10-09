import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint='https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items?f=json&monitoring_location_id=USGS-01646500&parameter_code=00060&limit=1'
const report={origin:'https://yapweijun1996.github.io',publication:'unpublished local app bundle under the real GitHub Pages origin',source:'live USGS Water Data API V1 latest-continuous response plus synthetic HTTP-200 contract fixtures',checks:[],errors:[]}
const unnamed=nodes=>nodes.filter(node=>!node.ignored&&['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value)&&!(node.name?.value||'').trim())
const decimalString=value=>typeof value==='string'&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value.trim())&&Number.isFinite(Number(value))
const semanticDom=b=>b.ev(`(()=>{const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('.usgs-water-preview')||shell?.querySelector('[data-domain-card="water-gauge"]');return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',requestedLocation:card?.dataset.requestedMonitoringLocationId||'',requestedParameter:card?.dataset.requestedParameterCode||'',requestedLimit:card?.dataset.requestedLimit||'',location:card?.dataset.monitoringLocationId||'',parameter:card?.dataset.parameterCode||'',timeSeries:card?.dataset.timeSeriesId||'',statistic:card?.dataset.statisticId||'',value:card?.dataset.primaryValue||'',unit:card?.dataset.unitOfMeasure||'',observedAt:card?.dataset.observedAt||'',approval:card?.dataset.approvalStatus||'',latitude:card?.dataset.latitude||'',longitude:card?.dataset.longitude||'',providerRecords:Number(card?.dataset.providerRecordCount),providerNumberReturned:card?.dataset.providerNumberReturned||'',countValid:card?.dataset.countContractValid||'',rowLimitValid:card?.dataset.rowLimitContractValid||'',measurementContract:card?.dataset.measurementContract||'',coordinateContract:card?.dataset.coordinateContract||'',text:card?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
let b
try {
  b=await browser(`${root}/dist`)
  await b.nav('usgs-water-legacy')
  const beforeLive=b.requestCount
  const result=await b.run()
  assert.equal(b.requestCount-beforeLive,1,'USGS live journey must issue exactly one provider request and never retry')
  assert.equal(result.ok,true,result.error)
  assert.equal(result.data?.type,'FeatureCollection')
  assert(Array.isArray(result.data?.features),'USGS response did not expose features[]')
  assert.equal(result.data.features.length,1,'USGS default request did not return exactly one latest observation')
  assert.equal(Number.isSafeInteger(result.data.numberReturned),true,'USGS numberReturned must remain a native safe integer')
  assert.equal(result.data.numberReturned,result.data.features.length,'USGS numberReturned must match features.length')
  const feature=result.data.features[0], properties=feature?.properties||{}, coordinates=feature?.geometry?.coordinates
  assert.equal(feature?.type,'Feature')
  assert.equal(feature?.geometry?.type,'Point')
  assert.equal(properties.monitoring_location_id,'USGS-01646500')
  assert.equal(properties.parameter_code,'00060')
  assert.equal(typeof properties.time_series_id,'string')
  assert.equal(decimalString(properties.value),true,'USGS observation value must use the documented precision-preserving decimal-string wire type')
  assert(Array.isArray(coordinates),'USGS feature did not expose coordinates')
  assert.equal(typeof coordinates[0],'number'); assert(Number.isFinite(coordinates[0]))
  assert.equal(typeof coordinates[1],'number'); assert(Number.isFinite(coordinates[1]))
  const dom=await semanticDom(b)
  assert.equal(dom.layout,'water-gauge'); assert.equal(dom.fallback,'false'); assert.equal(dom.state,'ready')
  assert.equal(dom.requestBound,'true'); assert.equal(dom.requestContract,'exact-v1-latest-continuous'); assert.equal(dom.requestedLimit,'1')
  assert.equal(dom.requestedLocation,'USGS-01646500'); assert.equal(dom.requestedParameter,'00060')
  assert.equal(dom.location,properties.monitoring_location_id); assert.equal(dom.parameter,properties.parameter_code); assert.equal(dom.timeSeries,properties.time_series_id)
  assert.equal(dom.statistic,properties.statistic_id||''); assert.equal(dom.value,properties.value); assert.equal(dom.unit,properties.unit_of_measure)
  assert.equal(dom.observedAt,properties.time); assert.equal(dom.approval,properties.approval_status)
  assert.equal(Number(dom.latitude),coordinates[1]); assert.equal(Number(dom.longitude),coordinates[0])
  assert.equal(dom.providerRecords,result.data.features.length); assert.equal(dom.providerNumberReturned,String(result.data.numberReturned)); assert.equal(dom.countValid,'true'); assert.equal(dom.rowLimitValid,'true')
  assert.equal(dom.measurementContract,'decimal-string'); assert.equal(dom.coordinateContract,'native-geojson-number'); assert.equal(dom.overflow,false)
  await b.viewport(390,844)
  const mobile=await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow||mobile.previewOverflow,false,JSON.stringify(mobile))
  const ax=await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length,0)
  report.checks.push({id:'usgs-water-legacy',case:'live USGS latest-continuous contract',semanticState:'ready',requestBound:true,providerRequests:1,numberReturnedWireType:'native integer',measurementWireType:'decimal string',coordinateWireType:'native number',location:'exact request/response match',parameter:'exact request/response match',timeSeriesIdentity:'provider-owned and exposed',mobileOverflow:false,unnamedControls:0})
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors,[])
  await b.close(); b=undefined

  const cases=[
    {name:'malformed envelope',body:{unexpected:[]},state:'invalid',check:d=>assert.match(d.text,/FeatureCollection features array/)},
    {name:'identity mismatch',body:{type:'FeatureCollection',numberReturned:1,features:[{type:'Feature',properties:{time_series_id:'synthetic-series',monitoring_location_id:'USGS-01646500',parameter_code:'00065',statistic_id:'00011',time:'2026-09-11T00:00:00+00:00',value:'1850',unit_of_measure:'ft^3/s',approval_status:'Provisional',qualifier:null},geometry:{type:'Point',coordinates:[-77.1,38.9]}}]},state:'invalid',check:d=>{assert.match(d.text,/identity mismatch/i);assert.equal(d.text.includes('1,850 ft^3/s'),false)}},
    {name:'numeric-string count plus string coordinates',body:{type:'FeatureCollection',numberReturned:'1',features:[{type:'Feature',properties:{time_series_id:'synthetic-series',monitoring_location_id:'USGS-01646500',parameter_code:'00060',statistic_id:'00011',time:'2026-09-11T00:00:00+00:00',value:'1850',unit_of_measure:'ft^3/s',approval_status:'Provisional',qualifier:null},geometry:{type:'Point',coordinates:['-77.1','38.9']}}]},state:'partial',check:d=>{assert.equal(d.countValid,'false');assert.equal(d.coordinateContract,'malformed');assert.equal(d.value,'1850')}},
    {name:'native-number observation value',body:{type:'FeatureCollection',numberReturned:1,features:[{type:'Feature',properties:{time_series_id:'synthetic-series',monitoring_location_id:'USGS-01646500',parameter_code:'00060',statistic_id:'00011',time:'2026-09-11T00:00:00+00:00',value:1850,unit_of_measure:'ft^3/s',approval_status:'Provisional',qualifier:null},geometry:{type:'Point',coordinates:[-77.1,38.9]}}]},state:'invalid',check:d=>assert.equal(d.text.includes('1,850 ft^3/s'),false)},
  ]
  for(const testCase of cases){
    const fixtureBrowser=await browser(`${root}/dist`,{fixtures:new Map([[endpoint,{body:testCase.body}]])})
    try{
      await fixtureBrowser.nav('usgs-water-legacy')
      const before=fixtureBrowser.requestCount
      const r=await fixtureBrowser.run(); assert.equal(r.ok,true,r.error)
      const exact=fixtureBrowser.fixtureRequests.filter(request=>request.url===endpoint&&request.method==='GET').length
      assert.equal(exact,1); assert.equal(fixtureBrowser.requestCount-before,exact,'Fixture-only case must not send live provider requests')
      const d=await semanticDom(fixtureBrowser); assert.equal(d.state,testCase.state); testCase.check(d)
      assert.deepEqual(fixtureBrowser.blockedProviders,[]); assert.deepEqual(fixtureBrowser.errors,[])
      report.checks.push({id:'usgs-water-legacy',case:`synthetic HTTP-200 ${testCase.name}`,semanticState:d.state,exactFixtureRequests:exact,liveProviderRequests:0})
    } finally { await fixtureBrowser.close() }
  }
  report.verdict='PASS'
} catch(error){report.verdict='FAIL';report.error=String(error);if(b)report.errors.push(...b.errors.map(String))}
finally{if(b)await b.close()}
fs.writeFileSync(`${evidence}/usgs-water-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/usgs-water-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
