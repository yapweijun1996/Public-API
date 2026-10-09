import assert from 'node:assert/strict';
import fs from 'node:fs';
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs';

const report={origin:'https://yapweijun1996.github.io',publication:'unpublished local app bundle',checks:[],errors:[]};
const unnamed=nodes=>nodes.filter(n=>!n.ignored&&['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(n.role?.value)&&!(n.name?.value||'').trim());
const setControl=async(b,name,value)=>{await b.ev(`(()=>{const e=document.querySelector('[name=${JSON.stringify(name)}]');if(!e)throw Error('missing control '+${JSON.stringify(name)});const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await sleep(80)};
const verifyMobileAx=async b=>{await b.viewport(390,844);const state=await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,shell:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`);assert.equal(state.doc||state.shell,false,JSON.stringify(state));const ax=await b.call('Accessibility.getFullAXTree');assert.equal(unnamed(ax.nodes).length,0)};

let b;
try{
  b=await browser(root+'/dist');

  await b.nav('jolpica-f1');await setControl(b,'season','2025');await setControl(b,'dataset','drivers');await setControl(b,'limit','3');
  const drivers=await b.run();assert.equal(drivers.ok,true,drivers.error);const driverRows=drivers.data.MRData?.DriverTable?.Drivers||[];assert.equal(drivers.data.MRData?.limit,'3');assert.equal(driverRows.length,3);const driver=driverRows[0];
  const driverDom=await b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s.querySelector('.jolpica-f1-preview'),r=c.querySelector('[data-record-index="1"]'),u=new URL(document.querySelector('.endpoint-box code').textContent);return {layout:s.dataset.previewLayout,state:c.dataset.resultState,dataset:c.dataset.dataset,season:c.dataset.season,total:Number(c.dataset.providerTotal),limit:Number(c.dataset.providerLimit),requestBound:c.dataset.requestBound,requestContract:c.dataset.requestContract,requestSeason:c.dataset.requestSeason,requestDataset:c.dataset.requestDataset,requestLimit:Number(c.dataset.requestLimit),seasonContract:c.dataset.seasonContractValid,datasetContract:c.dataset.datasetContractValid,limitContract:c.dataset.limitContractValid,id:r.dataset.driverId,code:r.dataset.driverCode||'',number:r.dataset.driverNumber||'',nationality:r.dataset.nationality||'',name:r.querySelector('h4')?.textContent||'',endpoint:u.href,generic:(s.innerText||'').includes('Jolpica F1 Data record 1')}})()`);
  assert.equal(driverDom.layout,'f1-season-catalog');assert.equal(driverDom.state,'ready');assert.equal(driverDom.dataset,'drivers');assert.equal(driverDom.season,'2025');assert.equal(driverDom.limit,3);assert.equal(driverDom.requestBound,'true');assert.equal(driverDom.requestContract,'exact-jolpica-season-catalog-v2');assert.equal(driverDom.requestSeason,'2025');assert.equal(driverDom.requestDataset,'drivers');assert.equal(driverDom.requestLimit,3);assert.equal(driverDom.seasonContract,'true');assert.equal(driverDom.datasetContract,'true');assert.equal(driverDom.limitContract,'true');assert.equal(driverDom.id,String(driver.driverId));assert.equal(driverDom.code,String(driver.code||''));assert.equal(driverDom.number,String(driver.permanentNumber||''));assert.equal(driverDom.nationality,String(driver.nationality||''));assert.equal(driverDom.name,[driver.givenName,driver.familyName].filter(Boolean).join(' '));assert(driverDom.endpoint.includes('/ergast/f1/2025/drivers.json'));assert(driverDom.endpoint.includes('limit=3'));assert.equal(driverDom.generic,false);await verifyMobileAx(b);
  report.checks.push({dataset:'drivers',source:'live provider',limit:3,primaryIdentity:'exact response match',mobileOverflow:false,unnamedControls:0});

  await b.nav('jolpica-f1');await setControl(b,'season','2025');await setControl(b,'dataset','constructors');await setControl(b,'limit','3');
  const constructors=await b.run();assert.equal(constructors.ok,true,constructors.error);const constructorRows=constructors.data.MRData?.ConstructorTable?.Constructors||[];assert.equal(constructorRows.length,3);const constructor=constructorRows[0];
  const constructorDom=await b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s.querySelector('.jolpica-f1-preview'),r=c.querySelector('[data-record-index="1"]');return {layout:s.dataset.previewLayout,dataset:c.dataset.dataset,id:r.dataset.constructorId,nationality:r.dataset.nationality||'',name:r.querySelector('h4')?.textContent||'',generic:(s.innerText||'').includes('Jolpica F1 Data record 1')}})()`);
  assert.equal(constructorDom.layout,'f1-season-catalog');assert.equal(constructorDom.dataset,'constructors');assert.equal(constructorDom.id,String(constructor.constructorId));assert.equal(constructorDom.nationality,String(constructor.nationality||''));assert.equal(constructorDom.name,String(constructor.name||constructor.constructorId));assert.equal(constructorDom.generic,false);await verifyMobileAx(b);
  report.checks.push({dataset:'constructors',source:'live provider',limit:3,primaryIdentity:'exact response match',mobileOverflow:false,unnamedControls:0});

  await b.nav('jolpica-f1');await setControl(b,'season','2025');await setControl(b,'dataset','races');await setControl(b,'limit','3');
  const races=await b.run();assert.equal(races.ok,true,races.error);const raceRows=races.data.MRData?.RaceTable?.Races||[];assert.equal(raceRows.length,3);const race=raceRows[0];const expectedStart=race.date+(race.time?`T${race.time}`:'');
  const raceDom=await b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s.querySelector('.jolpica-f1-preview'),r=c.querySelector('[data-record-index="1"]');const facts=Object.fromEntries([...r.querySelectorAll('.domain-facts>div')].map(x=>[x.querySelector('dt')?.textContent||'',x.querySelector('dd')?.textContent||'']));return {layout:s.dataset.previewLayout,dataset:c.dataset.dataset,round:r.dataset.round,name:r.dataset.raceName,circuit:r.dataset.circuitId||'',start:r.dataset.raceStart||'',lat:Number(r.dataset.latitude),lon:Number(r.dataset.longitude),facts,generic:(s.innerText||'').includes('Jolpica F1 Data record 1'),note:(s.innerText||'').includes('season catalogue, not standings or race results')}})()`);
  assert.equal(raceDom.layout,'f1-season-catalog');assert.equal(raceDom.dataset,'races');assert.equal(raceDom.round,String(race.round));assert.equal(raceDom.name,String(race.raceName));assert.equal(raceDom.circuit,String(race.Circuit?.circuitId||''));assert.equal(raceDom.start,expectedStart);assert.equal(raceDom.lat,Number(race.Circuit?.Location?.lat));assert.equal(raceDom.lon,Number(race.Circuit?.Location?.long));assert.equal(raceDom.facts.Circuit,String(race.Circuit?.circuitName||'Not supplied'));assert.equal(raceDom.generic,false);assert.equal(raceDom.note,true);await verifyMobileAx(b);
  report.checks.push({dataset:'races',source:'live provider',limit:3,calendarIdentity:'exact response match',utcStart:'exact provider date/time join',circuitAndCoordinates:'exact response match',mobileOverflow:false,unnamedControls:0});

  const mixedUrl='https://api.jolpi.ca/ergast/f1/2025/drivers.json?limit=8';
  const mixedFixture={MRData:{series:'f1',limit:'8',offset:'0',total:'36',DriverTable:{season:'2025',Drivers:[{driverId:'albon',code:'ALB',givenName:'Alexander',familyName:'Albon',nationality:'Thai'},{code:'FAK',givenName:'Fabricated',familyName:'Driver'}]}}};
  const partial=await browser(root+'/dist',{fixtures:new Map([[mixedUrl,{body:mixedFixture}]])});
  try{
    await partial.nav('jolpica-f1');
    const mixed=await partial.run();assert.equal(mixed.ok,true,mixed.error);
    const mixedDom=await partial.ev(`(()=>{const c=document.querySelector('.jolpica-f1-preview');return {state:c?.dataset.resultState,provider:Number(c?.dataset.providerRecordCount),valid:Number(c?.dataset.validRecordCount),invalid:Number(c?.dataset.invalidRecordCount),countValid:c?.dataset.countContractValid,rows:document.querySelectorAll('.jolpica-f1-preview [data-driver-id]').length,text:c?.innerText||''}})()`);
    assert.deepEqual({state:mixedDom.state,provider:mixedDom.provider,valid:mixedDom.valid,invalid:mixedDom.invalid,countValid:mixedDom.countValid,rows:mixedDom.rows},{state:'partial',provider:2,valid:1,invalid:1,countValid:'true',rows:1});
    assert(mixedDom.text.includes('Alexander Albon'));assert.equal(mixedDom.text.includes('Fabricated Driver'),false);assert.equal(mixedDom.text.includes('driver-2'),false);
    assert.deepEqual(partial.fixtureRequests.map(r=>({url:r.url,source:r.source,status:r.status})),[{url:mixedUrl,source:'synthetic-fixture',status:200}]);
    await verifyMobileAx(partial);
    report.checks.push({dataset:'drivers',case:'mixed HTTP-200 Driver array',source:'synthetic fixture',semanticState:'partial',providerRecords:2,validRecords:1,invalidRecords:1,fabricatedIdentityHidden:true,mobileOverflow:false,unnamedControls:0});
  }finally{report.errors.push(...partial.errors.map(String));await partial.close();}

  const wrongSeasonFixture={MRData:{series:'f1',limit:'8',offset:'0',total:'1',DriverTable:{season:'2024',Drivers:[{driverId:'verstappen',givenName:'Max',familyName:'Verstappen'}]}}};
  const wrongSeason=await browser(root+'/dist',{fixtures:new Map([[mixedUrl,{body:wrongSeasonFixture}]])});
  try{
    await wrongSeason.nav('jolpica-f1');
    const result=await wrongSeason.run();assert.equal(result.ok,true,result.error);
    const semantic=await wrongSeason.ev(`(()=>{const s=document.querySelector('.demo-preview');return {state:s.querySelector('[data-result-state]')?.dataset.resultState,text:s.innerText||''}})()`);
    assert.equal(semantic.state,'invalid');assert.equal(semantic.text.includes('Max Verstappen'),false);
    assert.deepEqual(wrongSeason.fixtureRequests.map(r=>({url:r.url,source:r.source,status:r.status})),[{url:mixedUrl,source:'synthetic-fixture',status:200}]);
    report.checks.push({dataset:'drivers',case:'wrong-season HTTP-200 DriverTable',source:'synthetic fixture',semanticState:'invalid',wrongSeasonIdentityHidden:true,liveProviderRequests:0});
  }finally{report.errors.push(...wrongSeason.errors.map(String));await wrongSeason.close();}

  report.errors.push(...b.errors.map(String));assert.deepEqual(report.errors,[]);report.verdict='PASS';
}catch(error){report.verdict='FAIL';report.error=String(error);if(b)report.errors.push(...b.errors.map(String));}
finally{if(b)await b.close();}
fs.writeFileSync(`${evidence}/jolpica-f1-verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,evidence:`${evidence}/jolpica-f1-verification.json`},null,2));process.exit(report.verdict==='PASS'?0:1);
