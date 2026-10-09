import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', scope: 'GBIF request/pagination/coordinate semantics, mobile, accessibility', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setControl = async (b, name, value) => {
  await b.ev(`(() => {
    const element = document.querySelector('[name=${JSON.stringify(name)}]')
    if (!element) throw new Error('Missing control ' + ${JSON.stringify(name)})
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)})
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })()`)
  await sleep(80)
}
const endpointContract = (endpoint) => {
  const url = new URL(endpoint)
  assert.equal(url.protocol, 'https:'); assert.equal(url.hostname, 'api.gbif.org'); assert.equal(url.pathname, '/v1/occurrence/search')
  const keys = ['scientificName','limit','hasCoordinate']; const entries = [...url.searchParams.entries()]
  assert.equal(entries.length, keys.length); assert.deepEqual(entries.map(([key]) => key).sort(), [...keys].sort())
  for (const key of keys) assert.equal(entries.filter(([candidate]) => candidate === key).length, 1)
  assert.equal(url.searchParams.get('scientificName'), 'Panthera leo'); assert.equal(url.searchParams.get('limit'), '6'); assert.equal(url.searchParams.get('hasCoordinate'), 'true')
  return { endpoint, scientificName: 'Panthera leo', limit: 6 }
}
const semanticDom = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="gbif-occurrence-map"]'); return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',scientificName:card?.dataset.requestedScientificName||'',requestedLimit:Number(card?.dataset.requestedLimit),providerCount:Number(card?.dataset.providerCount),validRecords:Number(card?.dataset.validRecordCount),invalidRecords:Number(card?.dataset.invalidRecordCount),coordinateContract:card?.dataset.coordinateContract||'',primaryLatitude:Number(card?.dataset.primaryLatitude),primaryLongitude:Number(card?.dataset.primaryLongitude),rows:[...(card?.querySelectorAll('ol > li[data-occurrence-key]')||[])].map(node=>({key:Number(node.dataset.occurrenceKey),latitude:Number(node.dataset.latitude),longitude:Number(node.dataset.longitude),text:node.textContent||''})),text:card?.innerText||''}; })()`)
const row = (overrides={}) => ({ key:5938104699, scientificName:'Panthera leo melanochaita (C.E.H.Smith, 1858)', species:'Panthera leo', decimalLatitude:-24.907649, decimalLongitude:31.462346, locality:'Kruger National Park', eventDate:'2026-01-01T09:15:50', basisOfRecord:'HUMAN_OBSERVATION', ...overrides })
const canonical = (rows,overrides={}) => ({ offset:0, limit:6, endOfRecords:rows.length < 6, count:rows.length, results:rows, ...overrides })
let active
try {
  active = await browser(`${root}/dist`); await active.nav('gbif-occurrence-search')
  const fieldContract = await active.ev(`(() => {
    const name = document.querySelector('[name="scientificName"]')
    const limit = document.querySelector('[name="limit"]')
    return { nameMinLength: name?.minLength, limitMin: limit?.min, limitMax: limit?.max, limitStep: limit?.step }
  })()`); assert.deepEqual(fieldContract,{nameMinLength:1,limitMin:'1',limitMax:'20',limitStep:'1'})

  await setControl(active,'scientificName','   '); await setControl(active,'limit','6')
  const blankBefore=active.requestCount; await active.ev(`document.querySelector('.parameter-card').requestSubmit()`); await sleep(180)
  const blankValidation=await active.ev(`(() => { const field=document.querySelector('[name="scientificName"]'); return {state:document.querySelector('.request-lab')?.dataset.requestState,invalid:field?.getAttribute('aria-invalid'),help:document.querySelector('#parameter-scientificName-help')?.textContent||''} })()`)
  assert.equal(active.requestCount-blankBefore,0,'Blank GBIF scientificName must not trigger a provider request'); assert.equal(blankValidation.state,'idle'); assert.equal(blankValidation.invalid,'true'); assert.match(blankValidation.help,/Scientific name is required\./)

  await setControl(active,'scientificName','Panthera leo'); await setControl(active,'limit','6.5')
  const fractionalBefore=active.requestCount; await active.ev(`document.querySelector('.parameter-card').requestSubmit()`); await sleep(180)
  const fractionalValidation=await active.ev(`(() => { const field=document.querySelector('[name="limit"]'); return {state:document.querySelector('.request-lab')?.dataset.requestState,invalid:field?.getAttribute('aria-invalid'),help:document.querySelector('#parameter-limit-help')?.textContent||''} })()`)
  assert.equal(active.requestCount-fractionalBefore,0,'Fractional GBIF limit must not trigger a provider request'); assert.equal(fractionalValidation.state,'idle'); assert.equal(fractionalValidation.invalid,'true'); assert.match(fractionalValidation.help,/Records must use increments of 1\./)
  report.checks.push({case:'invalid explicit input',scientificNameMinLength:1,limitStep:1,blankScientificNameProviderRequests:0,fractionalLimitProviderRequests:0,sharedValidation:'fail-closed'})

  await setControl(active,'limit','6')
  const endpoint = await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`); const contract = endpointContract(endpoint)
  const before = active.requestCount; const result = await active.run(); assert.equal(result.ok,true,result.error); assert.equal(active.requestCount-before,1)
  const payload=result.data; assert(payload && typeof payload==='object' && !Array.isArray(payload)); assert.equal(payload.offset,0); assert.equal(payload.limit,contract.limit); assert.equal(typeof payload.endOfRecords,'boolean'); assert(Number.isSafeInteger(payload.count)&&payload.count>=0); assert(Array.isArray(payload.results)); assert.equal(payload.results.length,Math.min(contract.limit,payload.count)); assert.equal(payload.endOfRecords,payload.count<=contract.limit)
  const keys=new Set(); for(const occurrence of payload.results){ assert(Number.isSafeInteger(occurrence.key)&&occurrence.key>0); assert(!keys.has(occurrence.key)); keys.add(occurrence.key); assert.equal(typeof occurrence.scientificName,'string'); assert(occurrence.scientificName.trim()); assert.equal(typeof occurrence.decimalLatitude,'number'); assert.equal(typeof occurrence.decimalLongitude,'number'); assert(Number.isFinite(occurrence.decimalLatitude)&&occurrence.decimalLatitude>=-90&&occurrence.decimalLatitude<=90); assert(Number.isFinite(occurrence.decimalLongitude)&&occurrence.decimalLongitude>=-180&&occurrence.decimalLongitude<=180) }
  const liveDom=await semanticDom(active); assert.equal(liveDom.layout,'location-map'); assert.equal(liveDom.fallback,'false'); assert.equal(liveDom.state,payload.count===0?'empty':'ready'); assert.equal(liveDom.requestBound,'true'); assert.equal(liveDom.scientificName,contract.scientificName); assert.equal(liveDom.requestedLimit,contract.limit); assert.equal(liveDom.providerCount,payload.count); assert.equal(liveDom.validRecords,payload.results.length); assert.equal(liveDom.invalidRecords,0)
  if(payload.results.length){ assert.equal(liveDom.coordinateContract,'true'); assert.equal(liveDom.rows.length,payload.results.length); assert.equal(liveDom.rows[0].key,payload.results[0].key); assert.equal(liveDom.rows[0].latitude,payload.results[0].decimalLatitude); assert.equal(liveDom.rows[0].longitude,payload.results[0].decimalLongitude) }
  await active.viewport(390,844); const mobile=await active.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1,cardOverflow:document.querySelector('[data-domain-card="gbif-occurrence-map"]').scrollWidth>document.querySelector('[data-domain-card="gbif-occurrence-map"]').clientWidth+1})`); assert.equal(mobile.documentOverflow||mobile.previewOverflow||mobile.cardOverflow,false,JSON.stringify(mobile)); const ax=await active.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length,0); assert.deepEqual(active.errors,[])
  report.checks.push({case:'live GBIF coordinate-only Panthera leo first page',transportStatus:200,semanticState:liveDom.state,returnedRows:payload.results.length,providerCount:payload.count,requestIdentity:'exact three-key GET with hasCoordinate=true',rawToDomIdentity:true,cors:'browser request succeeded',mobileOverflow:false,unnamedControls:0,liveProviderRequests:1,retries:0}); await active.close(); active=undefined
  const fixtures=[
    {name:'numeric-string coordinate',body:canonical([row(),row({key:2,decimalLatitude:'0'})],{limit:2,count:2,endOfRecords:true}),limit:'2',expected:'partial',check:(dom)=>assert.equal(dom.validRecords,1)},
    {name:'genuine zero coordinate',body:canonical([row({decimalLatitude:0,decimalLongitude:0})],{limit:1,count:1,endOfRecords:true}),limit:'1',expected:'ready',check:(dom)=>{assert.equal(dom.primaryLatitude,0);assert.equal(dom.primaryLongitude,0)}},
    {name:'duplicate occurrence key',body:canonical([row(),row({decimalLatitude:-20})],{limit:2,count:2,endOfRecords:true}),limit:'2',expected:'partial',check:(dom)=>assert.equal(dom.validRecords,1)},
    {name:'malformed pagination',body:canonical([row()],{count:20,endOfRecords:false}),limit:'6',expected:'invalid',check:(dom)=>assert.equal(dom.validRecords,0)},
    {name:'coherent empty first page',body:canonical([],{count:0,endOfRecords:true}),limit:'6',expected:'empty',check:(dom)=>assert.match(dom.text,/No mapped GBIF occurrences/)},
  ]
  for(const testCase of fixtures){ const fixtureUrl=endpoint.replace('limit=6',`limit=${testCase.limit}`); const fixtureBrowser=await browser(`${root}/dist`,{fixtures:new Map([[fixtureUrl,{body:testCase.body}]])}); active=fixtureBrowser; await fixtureBrowser.nav('gbif-occurrence-search'); if(testCase.limit!=='6'){ await fixtureBrowser.ev(`(()=>{const input=[...document.querySelectorAll('input[type="number"]')].find(n=>n.value==='6');if(input){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(testCase.limit)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}})()`)} const current=await fixtureBrowser.ev(`document.querySelector('.endpoint-box code')?.textContent||''`); assert.equal(current,fixtureUrl); const pre=fixtureBrowser.requestCount; const fixtureResult=await fixtureBrowser.run(); assert.equal(fixtureResult.ok,true,fixtureResult.error); const dom=await semanticDom(fixtureBrowser); assert.equal(dom.state,testCase.expected); testCase.check(dom); const exact=fixtureBrowser.fixtureRequests.filter(r=>r.url===fixtureUrl&&r.method==='GET').length; assert.equal(exact,1); assert.equal(fixtureBrowser.requestCount-pre,1); assert.deepEqual(fixtureBrowser.blockedProviders,[]); assert.deepEqual(fixtureBrowser.errors,[]); report.checks.push({case:`fixture-only ${testCase.name} HTTP-200`,semanticState:dom.state,exactFixtureRequests:exact,liveProviderRequests:0}); await fixtureBrowser.close(); active=undefined }
  report.verdict='PASS'
} catch(error){ report.verdict='FAIL'; report.error=String(error); if(active) report.errors.push(...active.errors.map(String)) } finally { if(active) await active.close() }
fs.writeFileSync(`${evidence}/gbif-occurrence-card.json`,`${JSON.stringify(report,null,2)}\n`); console.log(JSON.stringify({...report,evidence:`${evidence}/gbif-occurrence-card.json`},null,2)); process.exit(report.verdict==='PASS'?0:1)
