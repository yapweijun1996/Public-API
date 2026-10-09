import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'live Iconify and Homebrew APIs from the Pages origin', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setControl = async (b, name, value) => {
  await b.ev(`(() => { const element = document.querySelector('[name=${JSON.stringify(name)}]'); if (!element) throw new Error('Missing control'); const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`)
  await sleep(80)
}
const mobileAx = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({ documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1 })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
}
const macosRequirement = (data) => {
  const entries = Object.entries(data?.depends_on?.macos || {})
  if (!entries.length) return 'Not supplied'
  const [operator, raw] = entries[0]
  const values = Array.isArray(raw) ? raw.filter((value) => typeof value === 'string') : []
  return values.length ? `${operator} ${values.join(', ')}` : String(raw ?? 'Not supplied')
}

let b
try {
  b = await browser(`${root}/dist`)

  await b.nav('iconify-search')
  await setControl(b, 'query', 'home')
  await setControl(b, 'limit', '32')
  const iconifyRequestCountBefore = b.requestCount
  let result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(b.requestCount - iconifyRequestCountBefore, 1, 'Iconify should execute exactly one live provider request')
  const icon = result.data?.icons?.[0]
  assert(icon, 'Iconify returned no icon IDs')
  assert.equal(result.data?.request?.query, 'home')
  assert.equal(result.data?.request?.limit, '32')
  assert.deepEqual(Object.keys(result.data?.request || {}).sort(), ['limit', 'query'])
  assert.equal(typeof result.data?.total, 'number')
  assert.equal(typeof result.data?.limit, 'number')
  assert.equal(typeof result.data?.start, 'number')
  assert.equal(result.data.total, result.data.icons.length)
  assert.equal(result.data.limit, 32)
  assert.equal(result.data.start, 0)
  const prefix = String(icon).split(':', 1)[0]
  const collection = result.data?.collections?.[prefix] || {}
  const iconDom = await b.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell.querySelector('.iconify-search-preview'), first=card.querySelector('[data-record-index="1"]'); const facts=Object.fromEntries([...card.querySelectorAll(':scope > .domain-facts > div')].map(row=>[row.querySelector('dt')?.textContent||'',row.querySelector('dd')?.textContent||''])); return { layout:shell.dataset.previewLayout, fallback:shell.dataset.ssotFallback, state:card.dataset.resultState, requestBound:card.dataset.requestBound, requestContract:card.dataset.requestContract, requestedQuery:card.dataset.requestedQuery, requestedLimit:Number(card.dataset.requestedLimit), requestEchoValid:card.dataset.providerRequestEchoValid, paginationValid:card.dataset.paginationContractValid, providerTotal:Number(card.dataset.providerTotal), primary:card.dataset.primaryIconId, query:card.dataset.query, limit:Number(card.dataset.providerLimit), limitReached:card.dataset.limitReached, id:first.dataset.iconId, prefix:first.dataset.iconPrefix, author:first.dataset.author, spdx:first.dataset.licenseSpdx, heading:first.querySelector('h3')?.textContent||'', facts, generic:(shell.innerText||'').includes('Iconify Search record 1') }; })()`)
  assert.equal(iconDom.layout, 'icon-catalog')
  assert.equal(iconDom.fallback, 'false')
  assert.equal(iconDom.state, 'ready')
  assert.equal(iconDom.requestBound, 'true')
  assert.equal(iconDom.requestContract, 'exact-iconify-search-v2')
  assert.equal(iconDom.requestedQuery, 'home')
  assert.equal(iconDom.requestedLimit, 32)
  assert.equal(iconDom.requestEchoValid, 'true')
  assert.equal(iconDom.paginationValid, 'true')
  assert.equal(iconDom.providerTotal, result.data.total)
  assert.equal(iconDom.primary, String(icon))
  assert.equal(iconDom.id, String(icon))
  assert.equal(iconDom.prefix, prefix)
  assert.equal(iconDom.author, String(collection.author?.name || ''))
  assert.equal(iconDom.spdx, String(collection.license?.spdx || ''))
  assert.equal(iconDom.query, 'home')
  assert.equal(iconDom.limit, 32)
  assert.equal(iconDom.limitReached, String(result.data.icons.length >= result.data.limit))
  assert.equal(iconDom.heading, String(icon))
  assert.equal(iconDom.generic, false)
  await mobileAx(b)
  report.checks.push({ id:'iconify-search', liveProviderRequests:1, semanticState:'ready', requestBound:true, returned:result.data.icons.length, limit:result.data.limit, primaryIcon:icon, collection:collection.name, author:collection.author?.name, license:collection.license?.spdx || collection.license?.title, rawToSemanticDom:'exact match', mobileOverflow:false, unnamedControls:0 })

  await b.close(); b = undefined
  const iconifyUrl='https://api.iconify.design/search?query=home&limit=32'
  const mixedIconify={icons:['lucide:house','not-prefixed'],total:2,limit:32,start:0,collections:{lucide:{name:'Lucide'}},request:{query:'home',limit:'32'}}
  b=await browser(`${root}/dist`,{fixtures:new Map([[iconifyUrl,{body:mixedIconify}]])})
  await b.nav('iconify-search')
  await setControl(b,'query','home'); await setControl(b,'limit','32')
  result=await b.run(); assert.equal(result.ok,true,result.error)
  const partialDom=await b.ev(`(()=>{const c=document.querySelector('.iconify-search-preview');return {state:c?.dataset.resultState,provider:Number(c?.dataset.providerRecordCount),valid:Number(c?.dataset.validIconCount),invalid:Number(c?.dataset.invalidIconCount),text:c?.innerText||''}})()`)
  assert.deepEqual(partialDom,{state:'partial',provider:2,valid:1,invalid:1,text:partialDom.text})
  assert(partialDom.text.includes('lucide:house')); assert(!partialDom.text.includes('not-prefixed'))
  assert.deepEqual(b.fixtureRequests.map(x=>({url:x.url,source:x.source,status:x.status})),[{url:iconifyUrl,source:'synthetic-fixture',status:200}])
  await mobileAx(b)
  report.checks.push({id:'iconify-search',case:'mixed HTTP-200 identifiers',semanticState:'partial',providerRecords:2,validIcons:1,invalidIcons:1,mobileOverflow:false,unnamedControls:0})

  await b.close(); b = undefined
  const wrongEchoIconify={icons:['lucide:house'],total:1,limit:32,start:0,collections:{lucide:{name:'Lucide',total:1660}},request:{query:'weather',limit:'32'}}
  b=await browser(`${root}/dist`,{fixtures:new Map([[iconifyUrl,{body:wrongEchoIconify}]])})
  await b.nav('iconify-search'); await setControl(b,'query','home'); await setControl(b,'limit','32')
  result=await b.run(); assert.equal(result.ok,true,result.error)
  const wrongEchoDom=await b.ev(`(()=>{const c=document.querySelector('[data-domain-card="icon-catalog"]');return {state:c?.dataset.resultState,text:c?.innerText||''}})()` )
  assert.equal(wrongEchoDom.state,'invalid'); assert(wrongEchoDom.text.includes('request echo'))
  assert.deepEqual(b.fixtureRequests.map(x=>({url:x.url,source:x.source,status:x.status})),[{url:iconifyUrl,source:'synthetic-fixture',status:200}])
  report.checks.push({id:'iconify-search',case:'wrong provider request echo',semanticState:'invalid',fixtureOnly:true})

  await b.close(); b = undefined
  const numericStringIconify={icons:['lucide:house'],total:1,limit:'32',start:0,collections:{lucide:{name:'Lucide',total:1660}},request:{query:'home',limit:'32'}}
  b=await browser(`${root}/dist`,{fixtures:new Map([[iconifyUrl,{body:numericStringIconify}]])})
  await b.nav('iconify-search'); await setControl(b,'query','home'); await setControl(b,'limit','32')
  result=await b.run(); assert.equal(result.ok,true,result.error)
  const strictPaginationDom=await b.ev(`(()=>{const c=document.querySelector('.iconify-search-preview');return {state:c?.dataset.resultState,pagination:c?.dataset.paginationContractValid,providerLimit:c?.dataset.providerLimit||'',text:c?.innerText||''}})()` )
  assert.deepEqual(strictPaginationDom,{state:'partial',pagination:'false',providerLimit:'',text:strictPaginationDom.text})
  assert(strictPaginationDom.text.includes('Pagination evidence unavailable or malformed'))
  assert.deepEqual(b.fixtureRequests.map(x=>({url:x.url,source:x.source,status:x.status})),[{url:iconifyUrl,source:'synthetic-fixture',status:200}])
  report.checks.push({id:'iconify-search',case:'numeric-string provider limit',semanticState:'partial',paginationContractValid:false,fixtureOnly:true})

  await b.nav('homebrew-formula-json')
  await setControl(b, 'formula', 'node')
  await setControl(b, 'collection', 'formula')
  result = await b.run()
  assert.equal(result.ok, true, result.error)
  const formula = result.data
  const bottleCount = Object.keys(formula?.bottle?.stable?.files || {}).length
  const formulaDom = await b.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell.querySelector('.homebrew-package-preview'); const facts=Object.fromEntries([...card.querySelectorAll(':scope > .domain-facts > div')].map(row=>[row.querySelector('dt')?.textContent||'',row.querySelector('dd')?.textContent||''])); return { layout:shell.dataset.previewLayout, state:card.dataset.resultState, requestBound:card.dataset.requestBound, requestedKind:card.dataset.requestedPackageKind, requestedToken:card.dataset.requestedPackageToken, identityMatch:card.dataset.identityMatch, kind:card.dataset.packageKind, token:card.dataset.packageToken, tap:card.dataset.providerTap, name:card.dataset.packageName, version:card.dataset.version, license:card.dataset.license, deps:Number(card.dataset.dependencyCount), bottles:Number(card.dataset.bottlePlatformCount), heading:card.querySelector('.domain-heading h3')?.textContent||'', facts, text:card.innerText||'', generic:(shell.innerText||'').includes('Homebrew Formula JSON record 1') }; })()`)
  assert.equal(formulaDom.layout, 'homebrew-package')
  assert.equal(formulaDom.state, 'ready')
  assert.equal(formulaDom.requestBound, 'true')
  assert.equal(formulaDom.requestedKind, 'formula')
  assert.equal(formulaDom.requestedToken, 'node')
  assert.equal(formulaDom.identityMatch, 'true')
  assert.equal(formulaDom.kind, 'formula')
  assert.equal(formulaDom.token, String(formula.name))
  assert.equal(formulaDom.tap, String(formula.tap))
  assert.equal(formulaDom.name, String(formula.full_name || formula.name))
  assert.equal(formulaDom.version, String(formula.versions?.stable || 'Not supplied'))
  assert.equal(formulaDom.license, String(formula.license || ''))
  assert.equal(formulaDom.deps, (formula.dependencies || []).length)
  assert.equal(formulaDom.bottles, bottleCount)
  assert.equal(formulaDom.heading, String(formula.full_name || formula.name))
  assert(formulaDom.text.includes('Runtime dependencies'))
  assert.equal(formulaDom.generic, false)
  await mobileAx(b)
  report.checks.push({ id:'homebrew-formula-json', collection:'formula', requestBound:true, token:'node', version:formula.versions?.stable, license:formula.license, dependencies:(formula.dependencies||[]).length, bottlePlatforms:bottleCount, rawToSemanticDom:'exact match', mobileOverflow:false, unnamedControls:0 })

  await b.nav('homebrew-formula-json')
  await setControl(b, 'formula', 'postman')
  await setControl(b, 'collection', 'cask')
  result = await b.run()
  assert.equal(result.ok, true, result.error)
  const cask = result.data
  const caskDom = await b.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell.querySelector('.homebrew-package-preview'); return { layout:shell.dataset.previewLayout, state:card.dataset.resultState, requestBound:card.dataset.requestBound, requestedKind:card.dataset.requestedPackageKind, requestedToken:card.dataset.requestedPackageToken, identityMatch:card.dataset.identityMatch, kind:card.dataset.packageKind, token:card.dataset.packageToken, tap:card.dataset.providerTap, name:card.dataset.packageName, version:card.dataset.version, auto:card.dataset.autoUpdates, macos:card.dataset.macosRequirement, artifacts:Number(card.dataset.artifactCount), heading:card.querySelector('.domain-heading h3')?.textContent||'', text:card.innerText||'', generic:(shell.innerText||'').includes('Homebrew Formula JSON record 1') }; })()`)
  assert.equal(caskDom.layout, 'homebrew-package')
  assert.equal(caskDom.state, 'ready')
  assert.equal(caskDom.requestBound, 'true')
  assert.equal(caskDom.requestedKind, 'cask')
  assert.equal(caskDom.requestedToken, 'postman')
  assert.equal(caskDom.identityMatch, 'true')
  assert.equal(caskDom.kind, 'cask')
  assert.equal(caskDom.token, String(cask.token))
  assert.equal(caskDom.tap, String(cask.tap))
  assert.equal(caskDom.name, String(cask.name?.[0] || cask.token))
  assert.equal(caskDom.version, String(cask.version))
  assert.equal(caskDom.auto, String(cask.auto_updates === true))
  assert.equal(caskDom.macos, macosRequirement(cask))
  assert.equal(caskDom.artifacts, (cask.artifacts || []).length)
  assert.equal(caskDom.heading, String(cask.name?.[0] || cask.token))
  assert(caskDom.text.includes('Postman.app'))
  assert.equal(caskDom.generic, false)
  await mobileAx(b)
  report.checks.push({ id:'homebrew-formula-json', collection:'cask', requestBound:true, token:cask.token, version:cask.version, autoUpdates:cask.auto_updates, macosRequirement:macosRequirement(cask), artifacts:(cask.artifacts||[]).length, rawToSemanticDom:'exact match', mobileOverflow:false, unnamedControls:0 })

  await b.close(); b = undefined
  const homebrewFormulaUrl = 'https://formulae.brew.sh/api/formula/node.json'
  const mismatchedFormula = { name:'fabricated', full_name:'fabricated', tap:'homebrew/core', desc:'FABRICATED PACKAGE', versions:{ stable:'999', bottle:false }, dependencies:[], build_dependencies:[] }
  b = await browser(`${root}/dist`, { fixtures:new Map([[homebrewFormulaUrl,{body:mismatchedFormula}]]) })
  await b.nav('homebrew-formula-json')
  await setControl(b, 'formula', 'node'); await setControl(b, 'collection', 'formula')
  result = await b.run(); assert.equal(result.ok, true, result.error)
  const mismatchDom = await b.ev(`(() => { const card=document.querySelector('[data-domain-card="homebrew-package"]'); return { state:card?.dataset.resultState, text:card?.innerText||'' }; })()`)
  assert.equal(mismatchDom.state, 'invalid')
  assert(mismatchDom.text.includes('Homebrew package identity mismatch'))
  assert(!mismatchDom.text.includes('FABRICATED PACKAGE'))
  assert(!mismatchDom.text.includes('999'))
  assert.deepEqual(b.fixtureRequests.map(x=>({url:x.url,source:x.source,status:x.status})),[{url:homebrewFormulaUrl,source:'synthetic-fixture',status:200}])
  await mobileAx(b)
  report.checks.push({ id:'homebrew-formula-json', case:'mismatched formula HTTP-200 identity', semanticState:'invalid', fabricatedPackageHidden:true, mobileOverflow:false, unnamedControls:0 })

  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/package-icon-cards.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/package-icon-cards.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
