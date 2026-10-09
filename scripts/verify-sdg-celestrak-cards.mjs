import assert from 'node:assert/strict';
import fs from 'node:fs';
import { browser, evidence, root } from './lib/pages-origin-browser.mjs';

const report={origin:'https://yapweijun1996.github.io',publication:'unpublished local app bundle',checks:[],errors:[]};
const unnamed=(nodes)=>nodes.filter(n=>!n.ignored&&['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(n.role?.value)&&!(n.name?.value||'').trim());
try{
  const live=await browser(root+'/dist');
  try{
    await live.nav('un-sdg-goals'); const r=await live.run(); assert.equal(r.ok,true,r.error); assert.equal(r.data.length,17);
    const dom=await live.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s.querySelector('.sdg-goals-preview');return {layout:s.dataset.previewLayout,count:Number(c.dataset.goalCount),codes:c.dataset.goalCodes,complete:c.dataset.completeOfficialSet,rows:[...c.querySelectorAll('.sdg-goal-list>li')].map(x=>({code:x.dataset.goalCode,uri:x.dataset.goalUri,title:x.querySelector('h4')?.textContent,description:x.querySelector('p')?.textContent})),generic:(s.innerText||'').includes('UN Sustainable Development Goals record 1'),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`);
    assert.equal(dom.layout,'sdg-goals'); assert.equal(dom.count,17); assert.equal(dom.complete,'true'); assert.equal(dom.generic||dom.overflow,false);
    assert.deepEqual(dom.rows,r.data.map(x=>({code:String(x.code),uri:String(x.uri),title:String(x.title),description:String(x.description)})));
    await live.viewport(390,844); assert.equal(await live.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1`),false); assert.equal(unnamed((await live.call('Accessibility.getFullAXTree')).nodes).length,0);
    report.checks.push({id:'un-sdg-goals',source:'live provider',layout:dom.layout,count:17,rawToDom:'exact',mobileOverflow:false,unnamedControls:0});
  }finally{report.errors.push(...live.errors.map(String));await live.close()}

  const sdgUrl='https://unstats.un.org/SDGAPI/v1/sdg/Goal/List';
  const partialGoals=Array.from({length:16},(_,index)=>({code:String(index+1),title:`Goal ${index+1}`,description:`Synthetic goal ${index+1} description`,uri:`/v1/sdg/Goal/${index+1}`}));
  const partial=await browser(root+'/dist',{fixtures:new Map([[sdgUrl,{body:partialGoals}]])});
  try{
    await partial.nav('un-sdg-goals'); const r=await partial.run(); assert.equal(r.ok,true,r.error);
    const dom=await partial.ev(`(()=>{const c=document.querySelector('.sdg-goals-preview');return {state:c?.dataset.resultState,providerCount:Number(c?.dataset.providerRecordCount),usableGoalCount:Number(c?.dataset.usableGoalCount),malformedRecordCount:Number(c?.dataset.malformedRecordCount),complete:c?.dataset.completeOfficialSet,text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`);
    assert.deepEqual({state:dom.state,providerCount:dom.providerCount,usableGoalCount:dom.usableGoalCount,malformedRecordCount:dom.malformedRecordCount,complete:dom.complete},{state:'partial',providerCount:16,usableGoalCount:16,malformedRecordCount:0,complete:'false'});
    assert(dom.text.includes('Incomplete Goal/List response')&&dom.text.includes('official SDG framework contains Goal 1–17')); assert.equal(dom.overflow,false);
    assert.deepEqual(partial.fixtureRequests.map(x=>({url:x.url,source:x.source,status:x.status})),[{url:sdgUrl,source:'synthetic-fixture',status:200}]); assert.deepEqual(partial.blockedProviders,[]);
    await partial.viewport(390,844); assert.equal(await partial.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1`),false); assert.equal(unnamed((await partial.call('Accessibility.getFullAXTree')).nodes).length,0);
    report.checks.push({id:'un-sdg-goals',case:'incomplete HTTP-200 catalogue',source:'synthetic fixture',semanticState:'partial',providerRecords:16,usableGoals:16,completeOfficialSet:false,mobileOverflow:false,unnamedControls:0});
  }finally{report.errors.push(...partial.errors.map(String));await partial.close()}

  const url='https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json';
  const sample=[{OBJECT_NAME:'ISS (ZARYA)',OBJECT_ID:'1998-067A',EPOCH:'2026-06-19T12:16:41.638656',MEAN_MOTION:15.49315858,ECCENTRICITY:0.00045965,INCLINATION:51.6332,RA_OF_ASC_NODE:288.5889,ARG_OF_PERICENTER:205.0015,MEAN_ANOMALY:155.0751,CLASSIFICATION_TYPE:'U',NORAD_CAT_ID:25544,ELEMENT_SET_NO:999,REV_AT_EPOCH:57211}];
  const synthetic=await browser(root+'/dist',{fixtures:new Map([[url,{body:sample}]])});
  try{
    await synthetic.nav('celestrak-satellites'); const r=await synthetic.run(); assert.equal(r.ok,true,r.error);
    const dom=await synthetic.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s.querySelector('.celestrak-satellites-preview'),f=c.querySelector('[data-satellite-index="1"]');return {layout:s.dataset.previewLayout,group:c.dataset.requestedGroup,count:Number(c.dataset.satelliteCount),norad:Number(c.dataset.primaryNoradId),objectId:c.dataset.primaryObjectId,epoch:c.dataset.primaryEpoch,meanMotion:Number(c.dataset.primaryMeanMotionRevDay),inclination:Number(c.dataset.primaryInclinationDegrees),text:f.innerText,generic:(s.innerText||'').includes('CelesTrak Satellite Tracker record 1'),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`);
    assert.deepEqual({layout:dom.layout,group:dom.group,count:dom.count,norad:dom.norad,objectId:dom.objectId,epoch:dom.epoch,meanMotion:dom.meanMotion,inclination:dom.inclination},{layout:'satellite-orbits',group:'stations',count:1,norad:25544,objectId:'1998-067A',epoch:sample[0].EPOCH,meanMotion:sample[0].MEAN_MOTION,inclination:sample[0].INCLINATION});
    assert(dom.text.includes('rev/day')&&dom.text.includes('Eccentricity')); assert.equal(dom.generic||dom.overflow,false);
    assert.deepEqual(synthetic.fixtureRequests.map(x=>({url:x.url,source:x.source,status:x.status})),[{url,source:'synthetic-fixture',status:200}]); assert.deepEqual(synthetic.blockedProviders,[]);
    await synthetic.viewport(390,844); assert.equal(await synthetic.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1`),false); assert.equal(unnamed((await synthetic.call('Accessibility.getFullAXTree')).nodes).length,0);
    report.checks.push({id:'celestrak-satellites',source:'official-documentation-shaped synthetic fixture',providerRequest:'intercepted; no live cadence-limited probe',layout:dom.layout,rawToDom:'exact fixture',mobileOverflow:false,unnamedControls:0});
  }finally{report.errors.push(...synthetic.errors.map(String));await synthetic.close()}


  const malformed=await browser(root+'/dist',{fixtures:new Map([[url,{body:{unexpected:[]}}]])});
  try{
    await malformed.nav('celestrak-satellites'); const r=await malformed.run(); assert.equal(r.ok,true,r.error);
    const dom=await malformed.ev(`(()=>{const c=document.querySelector('[data-domain-card="satellite-orbits"]');return {state:c?.dataset.resultState||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`);
    assert.equal(dom.state,'invalid'); assert(dom.text.includes('documented JSON array')); assert.equal(dom.overflow,false);
    assert.deepEqual(malformed.fixtureRequests.map(x=>({url:x.url,source:x.source,status:x.status})),[{url,source:'synthetic-fixture',status:200}]); assert.deepEqual(malformed.blockedProviders,[]);
    await malformed.viewport(390,844); assert.equal(await malformed.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1`),false); assert.equal(unnamed((await malformed.call('Accessibility.getFullAXTree')).nodes).length,0);
    report.checks.push({id:'celestrak-satellites',case:'malformed HTTP-200 envelope',source:'synthetic fixture',providerRequest:'intercepted; no live cadence-limited probe',semanticState:'invalid',mobileOverflow:false,unnamedControls:0});
  }finally{report.errors.push(...malformed.errors.map(String));await malformed.close()}

  const mixed=await browser(root+'/dist',{fixtures:new Map([[url,{body:[sample[0],{OBJECT_NAME:'Fabricated satellite',NORAD_CAT_ID:12345}]}]])});
  try{
    await mixed.nav('celestrak-satellites'); const r=await mixed.run(); assert.equal(r.ok,true,r.error);
    const dom=await mixed.ev(`(()=>{const c=document.querySelector('.celestrak-satellites-preview');return {state:c?.dataset.resultState||'',provider:Number(c?.dataset.providerRecordCount),valid:Number(c?.dataset.validRecordCount),invalid:Number(c?.dataset.invalidRecordCount),rows:document.querySelectorAll('.celestrak-satellites-preview [data-satellite-index]').length,text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`);
    assert.deepEqual({state:dom.state,provider:dom.provider,valid:dom.valid,invalid:dom.invalid,rows:dom.rows},{state:'partial',provider:2,valid:1,invalid:1,rows:1});
    assert(dom.text.includes('ISS (ZARYA)')); assert.equal(dom.text.includes('Fabricated satellite'),false); assert.equal(dom.overflow,false);
    assert.deepEqual(mixed.fixtureRequests.map(x=>({url:x.url,source:x.source,status:x.status})),[{url,source:'synthetic-fixture',status:200}]); assert.deepEqual(mixed.blockedProviders,[]);
    await mixed.viewport(390,844); assert.equal(await mixed.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1`),false); assert.equal(unnamed((await mixed.call('Accessibility.getFullAXTree')).nodes).length,0);
    report.checks.push({id:'celestrak-satellites',case:'mixed HTTP-200 GP rows',source:'synthetic fixture',providerRequest:'intercepted; no live cadence-limited probe',semanticState:'partial',providerRecords:2,validRecords:1,invalidRecords:1,fabricatedRecordHidden:true,mobileOverflow:false,unnamedControls:0});
  }finally{report.errors.push(...mixed.errors.map(String));await mixed.close()}
  assert.deepEqual(report.errors,[]); report.verdict='PASS';
}catch(error){report.verdict='FAIL';report.error=String(error);}
fs.writeFileSync(`${evidence}/sdg-celestrak-verification.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,evidence:`${evidence}/sdg-celestrak-verification.json`},null,2));
process.exit(report.verdict==='PASS'?0:1);
