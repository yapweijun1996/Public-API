import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://data.jsdelivr.com/v1/packages/npm/react'
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'live current jsDelivr npm package metadata plus exact synthetic malformed HTTP-200 fixtures', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const validHttp = (value) => { try { const u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:' } catch { return false } }
const validVersion = (row) => row && typeof row === 'object' && typeof row.version === 'string' && row.version.trim() && row.links && typeof row.links === 'object' && validHttp(row.links.self) && validHttp(row.links.stats) && (row.links.entrypoints === undefined || validHttp(row.links.entrypoints))

const readDom = async (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="jsdelivr-package"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',bound:c?.dataset.requestBound||'',requested:c?.dataset.requestedPackage||'',providerPackage:c?.dataset.providerPackage||'',providerType:c?.dataset.providerType||'',identity:c?.dataset.identityMatch||'',providerVersions:c?.dataset.providerVersionCount||'',validVersions:c?.dataset.validVersionCount||'',invalidVersions:c?.dataset.invalidVersionCount||'',providerTags:c?.dataset.providerTagCount||'',validTags:c?.dataset.validTagCount||'',invalidTags:c?.dataset.invalidTagCount||'',latest:c?.dataset.trustedLatest||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

const fixtureVersion = (name, version, complete = true) => ({ version, links: complete ? { self:`https://data.jsdelivr.com/v1/packages/npm/${name}@${version}`, entrypoints:`https://data.jsdelivr.com/v1/packages/npm/${name}@${version}/entrypoints`, stats:`https://data.jsdelivr.com/v1/stats/packages/npm/${name}@${version}` } : { self:`https://data.jsdelivr.com/v1/packages/npm/${name}@${version}` } })
const fixtureBase = (name = 'react') => ({ type:'npm', name, tags:{ latest:'19.2.8' }, versions:[fixtureVersion(name,'19.2.8')], links:{ stats:`https://data.jsdelivr.com/v1/stats/packages/npm/${name}` } })

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('jsdelivr-package')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.type, 'npm')
  assert.equal(result.data?.name, 'react')
  assert(Array.isArray(result.data?.versions) && result.data.versions.length > 0, 'live jsDelivr versions[] must be non-empty')
  assert(result.data.versions.every(validVersion), 'live jsDelivr versions must satisfy the current PackageMetadata link contract')
  assert(result.data?.tags && typeof result.data.tags === 'object' && !Array.isArray(result.data.tags), 'live jsDelivr tags must be an object')
  assert(validHttp(result.data?.links?.stats), 'live jsDelivr package stats link must be an absolute HTTP URL')
  const versionSet = new Set(result.data.versions.map((entry) => entry.version))
  const tags = Object.entries(result.data.tags)
  assert(tags.every(([, value]) => typeof value === 'string' && versionSet.has(value)), 'every live dist-tag must resolve to a published version')

  const dom = await readDom(b)
  assert.equal(dom.layout, 'cdn-package')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.bound, 'true')
  assert.equal(dom.requested, 'react')
  assert.equal(dom.providerPackage, result.data.name)
  assert.equal(dom.providerType, result.data.type)
  assert.equal(dom.identity, 'true')
  assert.equal(Number(dom.providerVersions), result.data.versions.length)
  assert.equal(Number(dom.validVersions), result.data.versions.length)
  assert.equal(Number(dom.invalidVersions), 0)
  assert.equal(Number(dom.providerTags), tags.length)
  assert.equal(Number(dom.validTags), tags.length)
  assert.equal(Number(dom.invalidTags), 0)
  assert.equal(dom.latest, result.data.tags.latest || '')
  assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'jsdelivr-package', case:'live current package metadata contract', state:'ready', requestBound:true, package:result.data.name, versions:result.data.versions.length, tags:tags.length, mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const wrongFixture = fixtureBase('fabricated-package')
  wrongFixture.tags = { latest:'999.0.0' }
  wrongFixture.versions = [fixtureVersion('fabricated-package','999.0.0')]
  const wrong = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:wrongFixture}]]) })
  try {
    await wrong.nav('jsdelivr-package'); const run=await wrong.run(); assert.equal(run.ok,true,run.error)
    const value=await readDom(wrong)
    assert.equal(value.state,'invalid')
    assert.equal(value.text.includes('fabricated-package'),false)
    assert.equal(value.text.includes('999.0.0'),false)
    assert.equal(wrong.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length,1)
    assert.deepEqual(wrong.errors,[])
    report.checks.push({id:'jsdelivr-package',case:'wrong package identity HTTP-200',state:'invalid',fabricatedFactsHidden:true})
  } finally { await wrong.close() }

  const mixedFixture = fixtureBase('react')
  mixedFixture.tags = { latest:'19.2.8', rc:'999.0.0' }
  mixedFixture.versions = [fixtureVersion('react','19.2.8'), fixtureVersion('react','999.0.0',false), fixtureVersion('react','18.3.1')]
  const mixed = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:mixedFixture}]]) })
  try {
    await mixed.nav('jsdelivr-package'); const run=await mixed.run(); assert.equal(run.ok,true,run.error)
    const value=await readDom(mixed)
    assert.equal(value.state,'partial')
    assert.deepEqual({providerVersions:value.providerVersions,validVersions:value.validVersions,invalidVersions:value.invalidVersions,providerTags:value.providerTags,validTags:value.validTags,invalidTags:value.invalidTags},{providerVersions:'3',validVersions:'2',invalidVersions:'1',providerTags:'2',validTags:'1',invalidTags:'1'})
    assert.equal(value.text.includes('19.2.8'),true)
    assert.equal(value.text.includes('18.3.1'),true)
    assert.equal(value.text.includes('999.0.0'),false)
    assert.equal(mixed.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length,1)
    assert.deepEqual(mixed.errors,[])
    report.checks.push({id:'jsdelivr-package',case:'mixed malformed package metadata HTTP-200',state:'partial',invalidVersionAndTagFactsHidden:true})
  } finally { await mixed.close() }

  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}
fs.writeFileSync(`${evidence}/jsdelivr-package-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/jsdelivr-package-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
