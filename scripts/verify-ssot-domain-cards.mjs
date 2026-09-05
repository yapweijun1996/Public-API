import fs from 'node:fs';
import assert from 'node:assert/strict';
import { browser, evidence, ids, root, sleep } from './lib/pages-origin-browser.mjs';
const b=await browser(root+'/dist');const report={origin:'https://yapweijun1996.github.io',method:'Only same-origin app assets fulfilled from local production build; provider responses unmodified',cases:[],regressions:[],interactions:[]};
console.log('Evidence directory:',evidence);
const expectedLayouts=['color-swatch','dns-records','download-summary','release-lifecycle','exchange-rates','exchange-rates'];
const change=async(selector,value)=>{await b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await sleep(100);};
const enter=async(selector)=>{await b.ev(`document.querySelector(${JSON.stringify(selector)}).focus()`);await b.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await b.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(120);};
async function measure(){return b.ev(`(()=>{const card=document.querySelector('[data-domain-card]');const shell=document.querySelector('.demo-preview');const visible=[...card.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().height>0);return {domain:card.dataset.domainCard,state:card.dataset.resultState,layout:shell.dataset.previewLayout,fallback:!!shell.querySelector('[data-generic-fallback="true"]'),docOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,shellOverflow:shell.scrollWidth>shell.clientWidth+1,cardOverflow:card.scrollWidth>card.clientWidth+1,clippedValues:visible.filter(e=>['DD','CODE','H3','H4','STRONG','OUTPUT'].includes(e.tagName)&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).display!=='inline').map(e=>e.tagName+':'+e.textContent.slice(0,60)),shortControls:visible.filter(e=>['BUTTON','SELECT','INPUT','SUMMARY'].includes(e.tagName)&&e.getBoundingClientRect().height<44).map(e=>e.tagName),font:getComputedStyle(card).fontSize,width:card.getBoundingClientRect().width}})()`);}
try{
 // Initial catalog must not download the preview JS or CSS.
 await b.call('Page.navigate',{url:'https://yapweijun1996.github.io/Public-API/#/catalog'});await b.wait(`document.querySelectorAll('input[name="selected-api"]').length===200`);
 report.initialLazy=await b.ev(`performance.getEntriesByType('resource').filter(e=>e.name.includes('/responsePreview-')).map(e=>e.name)`);assert.equal(report.initialLazy.length,0);
 for(const [index,id]of ids.entries()){
  await b.nav(id);const r=await b.run();assert.equal(r.ok,true,id+': '+r.error);
  fs.writeFileSync(`${evidence}/after-${id}.json`,JSON.stringify(r.data,null,2));
  const row={id,origin:await b.ev('location.origin'),views:[],http:await b.ev(`document.querySelector('.ssot-runtime b').textContent`)};
  row.lazyResources=await b.ev(`performance.getEntriesByType('resource').filter(e=>e.name.includes('/responsePreview-')).map(e=>new URL(e.name).pathname)`);assert.equal(row.lazyResources.filter(n=>n.endsWith('.js')).length,1);assert.equal(row.lazyResources.filter(n=>n.endsWith('.css')).length,1);
  report.cases.push(row);
  for(const [w,h]of [[1440,1000],[900,1000],[390,844],[320,780]]){
   await b.viewport(w,h);const m=await measure();row.views.push({viewport:[w,h],...m});
   assert.equal(m.layout,expectedLayouts[index]);assert.equal(m.domain,expectedLayouts[index]);assert.equal(m.state,'ready');
   assert.equal(m.docOverflow||m.shellOverflow||m.cardOverflow||m.fallback,false,JSON.stringify(m));assert.deepEqual(m.clippedValues,[]);assert.deepEqual(m.shortControls,[]);
   if(w===1440||w===390)await b.screenshot(`${evidence}/after-${id}-${w}.png`);
  }
  const ax=await b.call('Accessibility.getFullAXTree');
  const bad=ax.nodes.filter(n=>!n.ignored&&['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(n.role?.value)&&!(n.name?.value||'').trim());
  assert.equal(bad.length,0);row.unnamedControls=0;
  const names=ax.nodes.filter(n=>!n.ignored).map(n=>n.name?.value);
  const required={'color-api':['Copy HEX','Color swatch #24B1E0'],'google-dns-doh':['DNS answer records'],'npm-download-counts':['react'],'endoflife-date':['Filter releases','Software release cycles'],'exchange-rate-current':['Amount in SGD','Convert to','Filter currencies','Converted amount'],'ecb-fx-rates':['Amount in EUR','Convert to','Filter currencies','Converted amount']}[id];
  for(const name of required)assert(names.includes(name),'AX missing '+name);row.namedContracts=required;
  // Exact input/response-to-view equality; no fixture-generated provider claims.
  if(id==='color-api')assert.equal(await b.ev(`document.querySelector('.color-swatch-caption strong').textContent`),r.data.hex.value.toUpperCase());
  if(id==='google-dns-doh')assert.deepEqual(await b.ev(`[...document.querySelectorAll('.dns-records code')].map(e=>e.textContent)`),r.data.Answer.map(a=>a.data));
  if(id==='npm-download-counts')assert.equal(await b.ev(`Number(document.querySelector('[data-download-count]').dataset.downloadCount)`),r.data.downloads);
  console.log(id,'4 VIEWPORTS + AX PASS');
  const count=b.requestCount;
  if(id==='color-api'){
   await b.call('Browser.grantPermissions',{origin:report.origin,permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
   await b.call('Page.bringToFront');await enter('button[aria-label="Copy HEX"]');
   await b.wait(`document.querySelector('.domain-copy [role="status"]').textContent==='HEX copied'`);
   const copied=await b.ev('navigator.clipboard.readText()');assert.equal(copied,r.data.hex.value.toUpperCase());
   report.interactions.push({id,clipboard:'actual browser readback PASS',keyboard:'Enter'});
  }
  if(id==='google-dns-doh'&&r.data.Comment){await enter('.domain-disclosure summary');assert.equal(await b.ev(`document.querySelector('.domain-disclosure').open`),true);report.interactions.push({id,disclosure:'native Enter PASS'});}
  if(id==='endoflife-date'){
   await enter('.domain-more');const shown=await b.ev(`document.querySelectorAll('.lifecycle-list > li').length`);assert.equal(shown,Math.min(24,r.data.result.releases.length));
   await change('.domain-toolbar select','lts');assert.equal(await b.ev(`document.querySelectorAll('.lifecycle-list > li').length`),Math.min(8,r.data.result.releases.filter(a=>a.isLts===true).length));
   await enter('.domain-disclosure summary');assert.equal(await b.ev(`document.querySelector('.domain-disclosure').open`),true);
   report.interactions.push({id,showMore:shown,filter:'LTS PASS',disclosure:'native Enter PASS'});
  }
  if(id==='exchange-rate-current'||id==='ecb-fx-rates'){
   const raw=id==='exchange-rate-current'?r.data.rates:r.data.data.rates;
   const target=id==='ecb-fx-rates'?'BTC':'USD';await change('.fx-inputs input','250');await change('.fx-inputs select',target);
   const output=await b.ev(`({value:Number(document.querySelector('.fx-output output').dataset.value),currency:document.querySelector('.fx-output output').dataset.currency})`);
   assert.equal(output.value,250*Number(raw[target]));assert.equal(output.currency,target);
   await change('.domain-toolbar input',target);assert.equal(await b.ev(`document.querySelector('.fx-rates li').dataset.rate`),String(raw[target]));
   await change('.domain-toolbar input','not-a-currency');assert.equal(await b.ev(`document.querySelectorAll('.fx-rates li').length`),0);
   await change('.domain-toolbar input','');await enter('.domain-more');assert.equal(await b.ev(`document.querySelectorAll('.fx-rates li').length`),Math.min(32,Object.keys(raw).length-1));
   report.interactions.push({id,calculation:'exact JS result PASS',target,fullRawRate:'PASS',filter:'PASS',showMore:'PASS'});
  }
  await sleep(150);assert.equal(b.requestCount,count,'Local control unexpectedly sent a request');row.localInteractionRequests=0;
 }
 for(const id of ['countries','weather','github']){await b.nav(id);const r=await b.run();assert(r.ok,id+': '+r.error);const check=await b.ev(`({design:document.querySelector('.demo-preview').dataset.ssotDesign,fallback:!!document.querySelector('[data-generic-fallback="true"]'),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1})`);assert.equal(check.design,'result-card-v2');assert.equal(check.fallback||check.overflow,false);report.regressions.push({id,...check});console.log(id,'UNAFFECTED SMOKE PASS');}
 // Live domain-negative case: HTTP success must not mask NXDOMAIN.
 await b.nav('google-dns-doh');await change('.parameter-card input','no-such-domain.invalid');
 const negative=await b.run();assert.equal(negative.ok,true);assert.equal(negative.data.Status,3);
 assert.equal(await b.ev(`document.querySelector('[data-domain-card]').dataset.resultState`),'dns-error');
 report.interactions.push({id:'google-dns-doh',case:'live NXDOMAIN',http:'200',dnsStatus:3,state:'dns-error'});
 // The actual long TXT payload must remain complete at the narrow viewport.
 await b.nav('google-dns-doh');await change('.parameter-card input','google.com');await change('.parameter-card select','TXT');
 const txt=await b.run();assert.equal(txt.ok,true);
 assert.deepEqual(await b.ev(`[...document.querySelectorAll('.dns-records code')].map(e=>e.textContent)`),txt.data.Answer.map(a=>a.data));
 await b.viewport(320,780);const txtLayout=await measure();assert.equal(txtLayout.docOverflow||txtLayout.cardOverflow,false);assert.deepEqual(txtLayout.clippedValues,[]);
 report.interactions.push({id:'google-dns-doh',case:'live TXT',longest:Math.max(...txt.data.Answer.map(a=>a.data.length)),completeText:true});
 report.errors=b.errors;assert.deepEqual(b.errors,[]);report.verdict='PASS';
} catch(e){report.verdict='FAIL';report.error=String(e);console.error(e);}finally{await b.close();fs.writeFileSync(evidence+'/verification.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({verdict:report.verdict,error:report.error,cases:report.cases.length,regressions:report.regressions.length,interactions:report.interactions},null,2));
process.exit(report.verdict==='PASS'?0:1);
