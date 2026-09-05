// Isolated test browser. App assets are local; providers stay live unless explicitly fixture-mapped.
// LanguageTool public requests are blocked unless synthetic fixtures are supplied.
// Never connect this harness to an existing authenticated user browser.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {spawn} from 'node:child_process';
export const root=path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
export const evidence=process.env.EVIDENCE_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'public-api-domain-evidence-'));
fs.mkdirSync(evidence,{recursive:true});
export const ids=['color-api','google-dns-doh','npm-download-counts','endoflife-date','exchange-rate-current','ecb-fx-rates'];
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function browser(dist, { fixtures = new Map() } = {}){
 if(!fs.existsSync(path.join(dist,'index.html')))throw Error('Build the Pages-base bundle before browser verification.');
 const port=9820+Math.floor(Math.random()*100);
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'public-api-test-profile-'));
 let launchError;
 const chrome=spawn(process.env.CHROME_BIN||'/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 chrome.on('error',error=>{launchError=error;});
 let pages; for(let i=0;i<60;i++){if(launchError)throw new Error('Set CHROME_BIN to a Chromium browser executable: '+launchError.message);try{pages=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json()); if(pages.length)break;}catch{} await sleep(100);}
 if(!pages?.length){chrome.kill();throw Error('CDP unavailable');}
 const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;}); let seq=0;const pending=new Map();const errors=[];const fixtureRequests=[];const blockedProviders=[];let requests=0;
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}return;}
 if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
 if(m.method==='Network.requestWillBeSent'&&m.params.type==='Fetch')requests++;
 if(m.method==='Fetch.requestPaused'){
  const url=new URL(m.params.request.url);
  if(url.origin!=='https://yapweijun1996.github.io'||!url.pathname.startsWith('/Public-API/')){
   const fixture=fixtures.get(url.href);
   if(!fixture){blockedProviders.push(url.origin+url.pathname);call('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(e=>errors.push(String(e)));return;}
   const method=m.params.request.method;
   if(method!==(fixture.method||'GET')&&method!=='OPTIONS'){errors.push('Unexpected fixture method: '+method);call('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{});return;}
   fixtureRequests.push({url:url.href,method,source:'synthetic-fixture',status:method==='OPTIONS'?204:fixture.status||200});
   call('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:method==='OPTIONS'?204:fixture.status||200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET, POST, OPTIONS'},{name:'Access-Control-Allow-Headers',value:'Content-Type'},{name:'Cache-Control',value:'no-store'}],body:method==='OPTIONS'?'':Buffer.from(JSON.stringify(fixture.body)).toString('base64')}).catch(e=>errors.push(String(e)));return;
  }
  const relative=url.pathname.slice('/Public-API/'.length)||'index.html';const f=path.resolve(dist,relative);
  if(!f.startsWith(path.resolve(dist)+path.sep)||!fs.existsSync(f)){errors.push('Missing local test asset: '+relative);call('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:404,body:''}).catch(()=>{});return;}
  const type=f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'application/octet-stream';
  call('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type},{name:'Cache-Control',value:'no-store'}],body:fs.readFileSync(f).toString('base64')}).catch(e=>errors.push(String(e)));
 }
 };
 const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async(expr,ms=8000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await ev(`Boolean(${expr})`))return;await sleep(100);}throw Error(`Timed out: ${expr}`);};
 await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Accessibility.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});await call('Network.setBypassServiceWorker',{bypass:true});
 // The free LanguageTool endpoint prohibits automated checks. Block it unless an
 // explicitly supplied synthetic fixture handles the request; never contact it.
 await call('Fetch.enable',{patterns:[{urlPattern:'https://yapweijun1996.github.io/Public-API/*',requestStage:'Request'},{urlPattern:'https://api.languagetool.org/*',requestStage:'Request'},...[...fixtures.keys()].filter(url=>!url.startsWith('https://api.languagetool.org/')).map(urlPattern=>({urlPattern,requestStage:'Request'}))]});
 const viewport=async(width,height)=>{await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(350);};
 const nav=async id=>{await viewport(1440,1000);await call('Page.navigate',{url:`https://yapweijun1996.github.io/Public-API/#/request-lab?api=${id}`});await wait(`document.querySelector('.parameter-card')?.dataset.apiId===${JSON.stringify(id)}`);};
 const run=async()=>{await ev(`document.querySelector('.parameter-card').requestSubmit()`);await wait(`['success','error'].includes(document.querySelector('.request-lab')?.dataset.requestState)`,24000);const state=await ev(`document.querySelector('.request-lab').dataset.requestState`);if(state==='error')return {ok:false,error:await ev(`document.querySelector('.response-error').innerText`)};await wait(`document.querySelector('.demo-preview')`);return {ok:true,data:await ev(`JSON.parse(document.querySelector('.response-body pre').textContent)`)};};
 const screenshot=async(file)=>{await ev(`document.querySelector('.demo-preview')?.scrollIntoView({block:'start',behavior:'instant'})`);await sleep(120);const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(file,Buffer.from(r.data,'base64'));};
 return {call,ev,wait,nav,run,viewport,screenshot,errors,fixtureRequests,blockedProviders,get requestCount(){return requests;},async close(){ws.close();if(chrome.exitCode===null){const exited=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill('SIGTERM');await Promise.race([exited,sleep(3000)]);}if(chrome.exitCode!==null)fs.rmSync(profile,{recursive:true,force:true});}};
}
