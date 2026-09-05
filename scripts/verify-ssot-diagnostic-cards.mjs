import fs from 'node:fs';
import assert from 'node:assert/strict';
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs';

const fixtures=JSON.parse(fs.readFileSync(root+'/src/previews/fixtures/diagnostic-responses.json','utf8'));
const report={origin:'https://yapweijun1996.github.io',publication:'unpublished local app bundle',live:[],synthetic:[],edgeCases:[],errors:[]};
console.log('Evidence directory:',evidence);
const change=async(b,selector,value)=>{await b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');const prototype=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await sleep(120);};
const enter=async(b,selector)=>{await b.ev(`document.querySelector(${JSON.stringify(selector)}).focus()`);await b.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await b.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(150);};
const state=b=>b.ev(`document.querySelector('[data-domain-card]')?.dataset.resultState`);
async function matrix(b,id,layout,expectedState,kind,requiredNames){
 const row={id,source:kind,views:[],http:await b.ev(`document.querySelector('.ssot-runtime b').textContent`)};
 report[kind==='live-provider'?'live':'synthetic'].push(row);
 for(const [w,h]of [[1440,1000],[900,1000],[390,844],[320,780]]){
  await b.viewport(w,h);
  const measure=await b.ev(`(()=>{const c=document.querySelector('[data-domain-card]');const s=document.querySelector('.demo-preview');const visible=[...c.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().height>0);return {layout:s.dataset.previewLayout,domain:c.dataset.domainCard,state:c.dataset.resultState,docOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,cardOverflow:c.scrollWidth>c.clientWidth+1,shellOverflow:s.scrollWidth>s.clientWidth+1,fallback:!!s.querySelector('[data-generic-fallback="true"]'),clipped:visible.filter(e=>['DD','CODE','H3','H4','STRONG'].includes(e.tagName)&&getComputedStyle(e).display!=='inline'&&e.scrollWidth>e.clientWidth+1).map(e=>e.tagName+':'+e.textContent.slice(0,60)),shortControls:visible.filter(e=>['BUTTON','SELECT','INPUT','SUMMARY'].includes(e.tagName)&&e.getBoundingClientRect().height<44).map(e=>e.tagName)}})()`);
  row.views.push({width:w,...measure});assert.equal(measure.layout,layout);assert.equal(measure.domain,layout);assert.equal(measure.state,expectedState);
  assert.equal(measure.docOverflow||measure.cardOverflow||measure.shellOverflow||measure.fallback,false,JSON.stringify(measure));assert.deepEqual(measure.clipped,[]);assert.deepEqual(measure.shortControls,[]);
  if(w===1440||w===390){
   if(kind==='synthetic-fixture')await b.ev(`(()=>{let p=document.querySelector('[data-fixture-notice]');if(!p){p=document.createElement('p');p.dataset.fixtureNotice='true';p.textContent='SYNTHETIC TEST FIXTURE — not live provider evidence';p.style.cssText='margin:0;padding:12px;color:#733c14;background:#fff1de;font:600 14px/1.5 sans-serif';document.querySelector('.demo-preview').prepend(p)}})()`);
   await b.screenshot(`${evidence}/${kind}-${id}-${w}.png`);
  }
 }
 const ax=await b.call('Accessibility.getFullAXTree');
 const active=ax.nodes.filter(n=>!n.ignored);
 const bad=active.filter(n=>['button','combobox','textbox','spinbutton','searchbox','tab','radio','link','meter'].includes(n.role?.value)&&!(n.name?.value||'').trim());
 assert.equal(bad.length,0,JSON.stringify(bad));for(const name of requiredNames)assert(active.some(n=>n.name?.value===name),'AX missing '+name);
 row.axNames=requiredNames;row.unnamedControls=bad.length;
 console.log(id,kind,'4 VIEWPORTS + AX PASS');return row;
}
async function revealAll(b){
 for(let i=0;i<30&&await b.ev(`Boolean(document.querySelector('.domain-more'))`);i++)await enter(b,'.domain-more');
 assert.equal(await b.ev(`Boolean(document.querySelector('.domain-more'))`),false,'Unbounded show-more');
}
async function liveCases(){
 const b=await browser(root+'/dist');
 try{
  await b.call('Page.navigate',{url:report.origin+'/Public-API/#/catalog'});await b.wait(`document.querySelectorAll('input[name="selected-api"]').length===200`);
  assert.equal(await b.ev(`performance.getEntriesByType('resource').filter(e=>e.name.includes('/responsePreview-')).length`),0);
  for(const id of ['openssf-scorecard','nhtsa-vehicle-recalls']){
   await b.nav(id);const r=await b.run();assert.equal(r.ok,true,id+': '+r.error);
   fs.writeFileSync(`${evidence}/live-${id}.json`,JSON.stringify(r.data,null,2));
   const row=await matrix(b,id,id==='openssf-scorecard'?'security-scorecard':'vehicle-recalls','ready','live-provider',id==='openssf-scorecard'?['Filter security checks','Repository security checks']:['Filter recall campaigns','Vehicle recall campaigns','Check your VIN with NHTSA']);
   const requests=b.requestCount;
   await revealAll(b);
   if(id==='openssf-scorecard'){
    const values=await b.ev(`[...document.querySelectorAll('[data-check-name]')].map(e=>({name:e.dataset.checkName,score:e.dataset.score,reason:e.querySelector('.diagnostic-reason').textContent.replace(/^Provider finding/,'')}))`);
    assert.equal(values.length,r.data.checks.length);
    for(const [index,check]of r.data.checks.entries()){assert.equal(values[index].name,check.name);assert.equal(values[index].score,check.score>=0&&check.score<=10?String(check.score):undefined);assert.equal(values[index].reason,check.reason);}
    assert.equal(await b.ev(`Number(document.querySelector('[data-aggregate-score]').dataset.aggregateScore)`),r.data.score);
    await change(b,'.domain-toolbar select','unscored');
    assert.equal(await b.ev(`document.querySelectorAll('.scorecard-checks > li').length`),Math.min(8,r.data.checks.filter(c=>c.score<0||c.score==null).length));
    await change(b,'.domain-toolbar select','all');
    const index=r.data.checks.slice(0,8).findIndex(c=>Array.isArray(c.details)&&c.details.length);
    if(index>=0){await enter(b,`.scorecard-checks > li:nth-child(${index+1}) summary`);assert.equal(await b.ev(`document.querySelector('.scorecard-checks > li:nth-child(${index+1}) details').open`),true);}
    row.fullEvidenceAndAggregate='PASS';
   } else {
    const displayed=await b.ev(`[...document.querySelectorAll('[data-campaign-id]')].map(e=>({id:e.dataset.campaignId,fields:Object.fromEntries([...e.querySelectorAll('[data-recall-field]')].map(f=>[f.dataset.recallField,f.querySelector('p').textContent]))}))`);
    assert.equal(displayed.length,r.data.results.length);
    for(const [index,recall]of r.data.results.entries()){assert.equal(displayed[index].id,recall.NHTSACampaignNumber);for(const key of ['Summary','Consequence','Remedy'])assert.equal(displayed[index].fields[key],recall[key]);}
    await change(b,'.domain-toolbar input',r.data.results.at(-1).NHTSACampaignNumber);
    assert.equal(await b.ev(`document.querySelectorAll('[data-campaign-id]').length`),1);
    await enter(b,'.recall-campaigns summary');assert.equal(await b.ev(`document.querySelector('.recall-campaigns details').open`),true);
    await change(b,'.domain-toolbar input','no-match-synthetic-query');assert.equal(await b.ev(`document.querySelectorAll('[data-campaign-id]').length`),0);
    row.fullRiskRemedyAndFiltering='PASS';
   }
   await sleep(150);assert.equal(b.requestCount,requests);row.localInteractionRequests=0;
  }
  assert.equal(b.fixtureRequests.length,0);assert.equal(b.blockedProviders.length,0);assert.deepEqual(b.errors,[]);
 }finally{report.errors.push(...b.errors);await b.close();}
}
async function syntheticCases(){
 const endpoints={
  'openssf-scorecard':'https://api.securityscorecards.dev/projects/github.com/ossf/scorecard',
  'nhtsa-vehicle-recalls':'https://api.nhtsa.gov/recalls/recallsByVehicle?make=honda&model=accord&modelYear=2020&format=json',
  'languagetool-grammar-check':'https://api.languagetool.org/v2/check',
 };
 const map=new Map(Object.values(endpoints).map(url=>[url,{method:url===endpoints['languagetool-grammar-check']?'POST':'GET',body:{}}]));
 const b=await browser(root+'/dist',{fixtures:map});
 const load=async(id,body,status=200)=>{
  map.set(endpoints[id],{method:id==='languagetool-grammar-check'?'POST':'GET',body,status});
  await b.nav(id);const count=b.fixtureRequests.length;const r=await b.run();
  assert(b.fixtureRequests.length>count,'Fixture not used: '+id);return r;
 };
 try{
  const id='languagetool-grammar-check';
  const r=await load(id,fixtures.grammar);assert(r.ok);
  const row=await matrix(b,id,'grammar-review','issues','synthetic-fixture',['Filter writing issues','Writing issues','Copy replacement 1 for issue 1']);
  assert.equal(await b.ev(`document.querySelector('mark').textContent`),'are');
  const requests=b.requestCount;
  await b.call('Browser.grantPermissions',{origin:report.origin,permissions:['clipboardReadWrite','clipboardSanitizedWrite']});await b.call('Page.bringToFront');
  await enter(b,'button[aria-label="Copy replacement 1 for issue 1"]');
  await b.wait(`document.querySelector('.domain-copy [role="status"]').textContent==='replacement 1 for issue 1 copied'`);
  assert.equal(await b.ev('navigator.clipboard.readText()'),'is');
  await enter(b,'.grammar-issues details:last-child summary');assert.equal(await b.ev(`document.querySelector('.grammar-issues details:last-child').open`),true);
  assert.equal(b.requestCount,requests);row.clipboardAndKeyboard='actual browser readback PASS';row.localInteractionRequests=0;
  const cases=[
   [id,'no-issues',{matches:[]}],
   [id,'invalid',{}],
   [id,'partial',{matches:[],warnings:{incompleteResults:true}}],
   ['openssf-scorecard','ready',fixtures.scorecard],
   ['openssf-scorecard','empty',{checks:[]}],
   ['openssf-scorecard','invalid',{}],
   ['nhtsa-vehicle-recalls','ready',fixtures.recalls],
   ['nhtsa-vehicle-recalls','empty',{Count:0,results:[]}],
   ['nhtsa-vehicle-recalls','partial',{Count:2,results:[]}],
   ['nhtsa-vehicle-recalls','invalid',{}],
  ];
  for(const [api,expected,body]of cases){
   const r=await load(api,body);assert.equal(r.ok,true);assert.equal(await state(b),expected);
   if(api==='openssf-scorecard'&&expected==='ready'){
    assert.equal(await b.ev(`document.querySelector('[data-check-name="Security-Policy"]').dataset.score`),'0');
    assert.equal(await b.ev(`document.querySelector('[data-check-name="Signed-Releases"]').dataset.score`),undefined);
    assert.equal(await b.ev(`Boolean(document.querySelector('[data-check-name="Signed-Releases"] meter'))`),false);
   }
   if(api==='nhtsa-vehicle-recalls'&&expected==='ready')assert.equal(await b.ev(`document.querySelector('.recall-campaigns .diagnostic-warning').textContent.includes('Do not drive')`),true);
   report.edgeCases.push({api,state:expected,source:'synthetic-fixture'});
  }
  const limited=await load(id,{error:'Synthetic rate limit'},429);assert.equal(limited.ok,false);
  assert.equal(await b.ev(`document.querySelector('.response-error').dataset.errorType`),'rate-limit');assert.equal(await b.ev(`Boolean(document.querySelector('[data-domain-card]'))`),false);
  report.edgeCases.push({api:id,state:'rate-limit',http:429,source:'synthetic-fixture'});
  // Deliberately remove the fixture to prove the harness blocks automation, never falls through to LanguageTool.
  map.delete(endpoints[id]);await b.nav(id);const blocked=await b.run();assert.equal(blocked.ok,false);
  assert(b.blockedProviders.includes(endpoints[id]));report.languageToolExternalRequests='blocked by test harness (no live health claim)';
  assert.deepEqual(b.errors,[]);report.fixtureRequests=b.fixtureRequests;
 }finally{report.errors.push(...b.errors);await b.close();}
}
try {await liveCases();await syntheticCases();report.verdict='PASS';}
catch(error){report.verdict='FAIL';report.error=String(error);console.error(error);}
finally{fs.writeFileSync(evidence+'/diagnostic-verification.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({verdict:report.verdict,error:report.error,live:report.live.length,synthetic:report.synthetic.length,edgeCases:report.edgeCases.length,languageToolExternalRequests:report.languageToolExternalRequests},null,2));
process.exit(report.verdict==='PASS'?0:1);
