import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const modulePath = 'github.com/Azure/azure-sdk-for-go'
const expectedEndpoint = 'https://proxy.golang.org/github.com/!azure/azure-sdk-for-go/@v/list'
const canonicalVersion = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+incompatible)?$/
const pseudoVersion = /-(?:[0-9A-Za-z-]+\.)*\d{14}-[0-9A-Za-z]{12,}(?:\+incompatible)?$/
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'live proxy.golang.org mixed-case Go module @v/list', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setInput = async (b, name, value) => {
  await b.ev(`(()=>{const e=document.querySelector('input[name=${JSON.stringify(name)}]');if(!e)throw Error('missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  await sleep(100)
}
const readDom = (b) => b.ev(`(()=>{const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="go-module-versions"]');return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requested:card?.dataset.requestedModule||'',bound:card?.dataset.requestBound||'',providerCount:Number(card?.dataset.providerVersionCount),validCount:Number(card?.dataset.validVersionCount),invalidCount:Number(card?.dataset.invalidVersionCount),highest:card?.dataset.highestListedVersion||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',responseTab:document.querySelector('[data-output-tab="response"]')?.textContent?.trim()||'',copyAction:document.querySelector('.copy-output')?.textContent?.trim()||'',responseType:document.querySelector('.request-lab')?.dataset.responseType||'',responseContentTypes:document.querySelector('.request-lab')?.dataset.responseContentTypes||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('go-module-proxy')
  await setInput(b, 'module', modulePath)
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data?.versions), 'parsed Go proxy response must expose versions[]')
  assert(result.data.versions.length > 0, 'mixed-case module should return tagged versions')
  assert(result.data.versions.every((value) => typeof value === 'string' && canonicalVersion.test(value) && !pseudoVersion.test(value)), 'live @v/list should contain canonical tagged versions only')

  const dom = await readDom(b)
  assert.equal(dom.layout, 'go-module-versions')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requested, modulePath)
  assert.equal(dom.bound, 'true')
  assert.equal(dom.providerCount, result.data.versions.length)
  assert.equal(dom.validCount, result.data.versions.length)
  assert.equal(dom.invalidCount, 0)
  assert(result.data.versions.includes(dom.highest), 'highest semantic version must come from the provider list')
  assert.equal(dom.endpoint, expectedEndpoint)
  assert.equal(dom.responseType, 'text')
  assert.equal(dom.responseContentTypes, 'text/plain')
  assert.equal(dom.responseTab, 'Response details')
  assert.equal(dom.copyAction, 'Copy details')
  assert.equal(dom.overflow, false)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  report.checks.push({ id:'go-module-proxy', case:'live mixed-case GOPROXY module-path escaping, semantic card, and text-response lab semantics', state:dom.state, requestedModule:dom.requested, endpoint:dom.endpoint, responseType:dom.responseType, responseTab:dom.responseTab, copyAction:dom.copyAction, versions:result.data.versions.length, highestListed:dom.highest, mobileOverflow:false, unnamedControls:0 })
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error); if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}
fs.writeFileSync(`${evidence}/go-module-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/go-module-card.json`},null,2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
