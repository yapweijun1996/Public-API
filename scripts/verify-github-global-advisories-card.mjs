import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.github.com/advisories?ecosystem=npm&severity=high&per_page=6'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live GitHub global-advisory request plus deterministic HTTP-200 UI/filter/transport fixtures',
  checks: [], errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="github-global-advisories"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',ecosystem:c?.dataset.requestedEcosystem||'',severity:c?.dataset.requestedSeverity||'',perPage:Number(c?.dataset.requestPerPage||0),requestBound:c?.dataset.requestBound||'',providerResults:Number(c?.dataset.providerResultCount||0),validResults:Number(c?.dataset.validResultCount||0),invalidResults:Number(c?.dataset.invalidResultCount||0),incompleteResults:Number(c?.dataset.incompleteResultCount||0),filterContract:c?.dataset.filterContract||'',countContract:c?.dataset.countContract||'',primaryGhsa:c?.dataset.primaryGhsaId||'',primarySeverity:c?.dataset.primarySeverity||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
const trustworthy = (advisory) => advisory && typeof advisory === 'object'
  && typeof advisory.ghsa_id === 'string' && advisory.ghsa_id.length > 0
  && advisory.type === 'reviewed'
  && advisory.severity === 'high'
  && typeof advisory.summary === 'string' && advisory.summary.length > 0
  && Number.isFinite(Date.parse(advisory.published_at))
  && Number.isFinite(Date.parse(advisory.updated_at))
  && Array.isArray(advisory.vulnerabilities)
  && advisory.vulnerabilities.some((item) => item?.package?.ecosystem === 'npm' && typeof item?.package?.name === 'string' && item.package.name.length > 0)

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('github-global-advisories')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(Array.isArray(run.data), 'live GitHub advisory response must be an array')
  assert(run.data.length > 0 && run.data.length <= 6, 'live GitHub advisory response must respect per_page=6')
  assert(run.data.every(trustworthy), 'each live row must be a reviewed high-severity advisory with at least one npm package')
  const dom = await readDom(b)
  assert.equal(dom.layout, 'global-security-advisories')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.ecosystem, 'npm')
  assert.equal(dom.severity, 'high')
  assert.equal(dom.perPage, 6)
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.providerResults, run.data.length)
  assert.equal(dom.validResults, run.data.length)
  assert.equal(dom.invalidResults, 0)
  assert.equal(dom.incompleteResults, 0)
  assert.equal(dom.filterContract, 'true')
  assert.equal(dom.countContract, 'true')
  assert.equal(dom.primaryGhsa, run.data[0].ghsa_id)
  assert.equal(dom.primarySeverity, 'high')
  assert.equal(dom.endpoint, endpoint)
  const firstNpm = run.data[0].vulnerabilities.find((item) => item?.package?.ecosystem === 'npm')?.package?.name
  assert.equal(dom.text.includes(run.data[0].ghsa_id), true)
  assert.equal(dom.text.includes(firstNpm), true)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'github-global-advisories', case:'live npm/high reviewed advisory list', state:'ready', returnedResults:run.data.length, firstGhsa:run.data[0].ghsa_id, firstNpmPackage:firstNpm, mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const mediumEndpoint = 'https://api.github.com/advisories?ecosystem=npm&severity=medium&per_page=6'
  const mediumAdvisory = {
    ghsa_id:'GHSA-medium-1111-2222', cve_id:'CVE-2026-7001', type:'reviewed', severity:'medium', summary:'Synthetic medium npm advisory',
    description:'Synthetic UI-selection contract fixture.', published_at:'2026-09-01T00:00:00Z', updated_at:'2026-09-03T00:00:00Z', withdrawn_at:null,
    vulnerabilities:[{ package:{ ecosystem:'npm', name:'medium-package' }, first_patched_version:'2.0.0', vulnerable_version_range:'< 2.0.0' }],
  }
  const mediumBrowser = await browser(`${root}/dist`, { fixtures:new Map([[mediumEndpoint,{body:[mediumAdvisory]}]]) })
  try {
    await mediumBrowser.nav('github-global-advisories')
    const selected = await mediumBrowser.ev(`(()=>{const e=document.querySelector('#parameter-severity');if(!e)throw Error('Missing severity control');const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(e,'medium');e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`)
    assert.equal(selected, 'medium')
    const run = await mediumBrowser.run()
    assert.equal(run.ok, true, run.error)
    assert.deepEqual(run.data, [mediumAdvisory])
    const dom = await readDom(mediumBrowser)
    assert.equal(dom.state, 'ready')
    assert.equal(dom.severity, 'medium')
    assert.equal(dom.filterContract, 'true')
    assert.equal(dom.endpoint, mediumEndpoint)
    assert.equal(mediumBrowser.fixtureRequests.filter((r)=>r.url===mediumEndpoint&&r.method==='GET').length,1)
    assert.deepEqual(mediumBrowser.errors, [])
    report.checks.push({ id:'github-global-advisories', case:'fixture-only UI-selected npm/medium advisory list', state:'ready', returnedResults:1, severity:'medium', filterContract:true, liveProviderRequests:0 })
  } finally { await mediumBrowser.close() }

  const good = {
    ghsa_id:'GHSA-good-1111-2222', cve_id:'CVE-2026-7000', type:'reviewed', severity:'high', summary:'Trusted npm advisory',
    description:'Synthetic trusted advisory.', published_at:'2026-09-01T00:00:00Z', updated_at:'2026-09-03T00:00:00Z', withdrawn_at:null,
    vulnerabilities:[{ package:{ ecosystem:'npm', name:'trusted-package' }, first_patched_version:'2.0.0', vulnerable_version_range:'< 2.0.0' }],
  }
  const wrongSeverity = { ...good, ghsa_id:'GHSA-wrng-1111-2222', severity:'critical', summary:'Plausible wrong severity', vulnerabilities:[{ package:{ ecosystem:'npm', name:'wrong-severity-package' } }] }
  const wrongEcosystem = { ...good, ghsa_id:'GHSA-wrng-3333-4444', summary:'Plausible wrong ecosystem', vulnerabilities:[{ package:{ ecosystem:'pip', name:'wrong-ecosystem-package' } }] }

  for (const [label, payload, hidden] of [
    ['wrong-severity HTTP-200 row', wrongSeverity, 'wrong-severity-package'],
    ['wrong-ecosystem HTTP-200 row', wrongEcosystem, 'wrong-ecosystem-package'],
  ]) {
    const synthetic = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:[payload]}]]) })
    try {
      await synthetic.nav('github-global-advisories'); const result=await synthetic.run(); assert.equal(result.ok,true,result.error)
      const dom=await readDom(synthetic); assert.equal(dom.state,'invalid'); assert.equal(dom.text.includes(hidden),false)
      assert.equal(synthetic.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length,1)
      assert.deepEqual(synthetic.errors,[])
      report.checks.push({ id:'github-global-advisories', case:label, state:'invalid', plausibleProviderFactsHidden:true })
    } finally { await synthetic.close() }
  }

  const mixed = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:[good,wrongSeverity]}]]) })
  try {
    await mixed.nav('github-global-advisories'); const result=await mixed.run(); assert.equal(result.ok,true,result.error)
    const dom=await readDom(mixed); assert.equal(dom.state,'partial'); assert.equal(dom.validResults,1); assert.equal(dom.invalidResults,1); assert.equal(dom.text.includes('wrong-severity-package'),false)
    assert.deepEqual(mixed.errors,[])
    report.checks.push({ id:'github-global-advisories', case:'mixed valid and contradictory HTTP-200 rows', state:'partial', trustedResults:1, invalidResults:1, contradictoryFactsHidden:true })
  } finally { await mixed.close() }

  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/github-global-advisories-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/github-global-advisories-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
