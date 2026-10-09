import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const newtonsoftEndpoint = 'https://api.nuget.org/v3/registration5-gz-semver2/newtonsoft.json/index.json'
const versioningEndpoint = 'https://api.nuget.org/v3/registration5-gz-semver2/nuget.versioning/index.json'
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', source:'live NuGet.org SemVer 2 registration indexes plus a synthetic wrong-package HTTP-200 fixture', checks:[], errors:[] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setInput = async (b,name,value) => { await b.ev(`(()=>{const e=document.querySelector('input[name=${JSON.stringify(name)}]');if(!e)throw Error('missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`); await sleep(100) }
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="nuget-package"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',requestBound:c?.dataset.requestBound||'',requested:c?.dataset.requestedPackage||'',provider:c?.dataset.providerPackage||'',identity:c?.dataset.identityMatch||'',pages:Number(c?.dataset.providerPageCount),versions:Number(c?.dataset.providerVersionCount),inline:Number(c?.dataset.inlineVersionCount),validInline:Number(c?.dataset.validInlineVersionCount),invalidInline:Number(c?.dataset.invalidInlineVersionCount),omitted:Number(c?.dataset.omittedPageCount),highest:c?.dataset.highestRegisteredVersion||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
const liveCounts = (data) => { const pages=Array.isArray(data?.items)?data.items:[]; return { pages:pages.length, versions:pages.reduce((n,p)=>n+(Number.isInteger(p?.count)?p.count:0),0), inline:pages.reduce((n,p)=>n+(Array.isArray(p?.items)?p.items.length:0),0), omitted:pages.filter((p)=>p && typeof p==='object' && p.items===undefined).length } }
const firstPackage = (data) => { for (const p of data?.items||[]) for (const leaf of p?.items||[]) if (typeof leaf?.catalogEntry?.id==='string') return leaf.catalogEntry.id; return '' }

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('nuget-package-lookup')
  const first = await b.run(); assert.equal(first.ok,true,first.error)
  const counts = liveCounts(first.data)
  assert(counts.pages > 0 && counts.versions > 0, 'live NuGet registration index must expose page/version counts')
  assert.equal(first.data?.count, counts.pages, 'root count must equal registration page count')
  const providerPackage = firstPackage(first.data); assert(providerPackage, 'default NuGet package should inline provider-owned package identity')
  const dom = await readDom(b)
  assert.equal(dom.layout,'package-registration'); assert.equal(dom.fallback,'false'); assert.equal(dom.state,'ready'); assert.equal(dom.requestBound,'true')
  assert.equal(dom.requested,'newtonsoft.json'); assert.equal(dom.provider.toLowerCase(),providerPackage.toLowerCase()); assert.equal(dom.identity,'true')
  assert.deepEqual({pages:dom.pages,versions:dom.versions,inline:dom.inline,validInline:dom.validInline,invalidInline:dom.invalidInline,omitted:dom.omitted},{pages:counts.pages,versions:counts.versions,inline:counts.inline,validInline:counts.inline,invalidInline:0,omitted:0})
  assert((first.data.items||[]).some((page)=>page?.upper===dom.highest), 'highest registered version must be one of the provider page upper bounds')
  assert.equal(dom.endpoint,newtonsoftEndpoint); assert.equal(dom.overflow,false)
  await b.viewport(390,844); const mobile=await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`); assert.equal(mobile.doc||mobile.preview,false,JSON.stringify(mobile))
  const ax=await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length,0)
  report.checks.push({id:'nuget-package-lookup',case:'live SemVer 2 inlined registration index',state:dom.state,package:providerPackage,pages:counts.pages,versions:counts.versions,inline:counts.inline,highest:dom.highest,mobileOverflow:false,unnamedControls:0})
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors,[])
  await b.close(); b=undefined

  const large = await browser(`${root}/dist`)
  try {
    await large.nav('nuget-package-lookup'); await setInput(large,'packageId','NuGet.Versioning'); const run=await large.run(); assert.equal(run.ok,true,run.error)
    const counts2=liveCounts(run.data), dom2=await readDom(large)
    assert.equal(dom2.endpoint,versioningEndpoint); assert.equal(dom2.state,'partial'); assert.equal(dom2.requestBound,'true'); assert.equal(dom2.requested,'nuget.versioning'); assert.equal(dom2.identity,'true')
    assert(counts2.omitted>0,'large live registration should exercise documented non-inlined pages')
    assert.deepEqual({pages:dom2.pages,versions:dom2.versions,inline:dom2.inline,omitted:dom2.omitted},{pages:counts2.pages,versions:counts2.versions,inline:counts2.inline,omitted:counts2.omitted})
    assert.equal(dom2.text.includes('page metadata is not inlined'),true); assert.equal(dom2.text.includes('Authors unavailable'),false)
    assert.deepEqual(large.errors,[])
    report.checks.push({id:'nuget-package-lookup',case:'live large registration with omitted page leaves',state:dom2.state,pages:counts2.pages,versions:counts2.versions,inline:counts2.inline,omittedPages:counts2.omitted,fabricatedLeafFacts:false})
  } finally { await large.close() }

  const wrongFixture={ '@id':'https://api.nuget.org/v3/registration5-gz-semver2/fabricated.package/index.json', count:1, items:[{ '@id':'https://api.nuget.org/v3/registration5-gz-semver2/fabricated.package/index.json#page/999.0.0/999.0.0', count:1, lower:'999.0.0', upper:'999.0.0', items:[] }] }
  const wrong=await browser(`${root}/dist`,{fixtures:new Map([[newtonsoftEndpoint,{body:wrongFixture}]])})
  try {
    await wrong.nav('nuget-package-lookup'); const run=await wrong.run(); assert.equal(run.ok,true,run.error); const value=await readDom(wrong)
    assert.equal(value.state,'invalid'); assert.equal(value.text.includes('fabricated.package'),false); assert.equal(value.text.includes('999.0.0'),false)
    assert.equal(wrong.fixtureRequests.filter((r)=>r.url===newtonsoftEndpoint&&r.method==='GET').length,1); assert.deepEqual(wrong.errors,[])
    report.checks.push({id:'nuget-package-lookup',case:'wrong package identity HTTP-200',state:'invalid',fabricatedFactsHidden:true})
  } finally { await wrong.close() }

  report.verdict='PASS'
} catch(error) { report.verdict='FAIL'; report.error=String(error); if(b) report.errors.push(...b.errors.map(String)) }
finally { if(b) await b.close() }
fs.writeFileSync(`${evidence}/nuget-package-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/nuget-package-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
