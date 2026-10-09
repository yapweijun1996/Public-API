import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'live Open5e V2 creatures API plus exact request-binding HTTP-200 fixtures from the Pages origin', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('open5e-monster-search')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data?.results) && result.data.results.length > 0, 'Open5e V2 returned no creature records')
  assert(result.data.results.every((row) => String(row?.name || '').toLowerCase().includes('dragon')), 'Open5e returned a live row outside name__icontains=dragon')
  const first = result.data.results[0]
  const dom = await b.ev(`(() => {
    const shell=document.querySelector('.demo-preview'), card=shell.querySelector('.open5e-monster-preview'), first=shell.querySelector('.semantic-card-grid article'), url=new URL(document.querySelector('.endpoint-box code').textContent)
    const metrics=Object.fromEntries([...first.querySelectorAll('dl > div')].map(row=>[row.querySelector('dt')?.textContent||'',row.querySelector('dd')?.textContent||'']))
    return {layout:shell.dataset.previewLayout,fallback:shell.dataset.ssotFallback,version:card.dataset.apiVersion,requestContract:card.dataset.requestContract,requestBound:card.dataset.requestBound,requestQuery:card.dataset.requestQuery,queryMismatchCount:Number(card.dataset.queryMismatchCount),total:Number(card.dataset.providerTotal),visible:Number(card.dataset.visibleCount),key:card.dataset.primaryMonsterKey,name:card.dataset.primaryMonsterName,source:card.dataset.primarySource,system:card.dataset.primaryGameSystem,heading:first.querySelector('h3')?.textContent||'',badge:first.querySelector('header em')?.textContent||'',metrics,pathname:url.pathname,query:url.searchParams.get('name__icontains'),limit:url.searchParams.get('limit'),fields:url.searchParams.get('fields'),documentFields:url.searchParams.get('document__fields'),generic:(shell.innerText||'').includes('Open5e Monster Search record 1'),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}
  })()`)
  const source = first.document || {}, gameSystem = source.gamesystem || {}, type = first.type || {}, size = first.size || {}
  assert.equal(dom.layout, 'monster-statblock'); assert.equal(dom.fallback, 'false'); assert.equal(dom.version, 'v2'); assert.equal(dom.requestContract, 'exact-open5e-monster-search-v2'); assert.equal(dom.requestBound, 'true'); assert.equal(dom.requestQuery, 'dragon'); assert.equal(dom.queryMismatchCount, 0)
  assert.equal(dom.total, Number(result.data.count)); assert.equal(dom.visible, Math.min(result.data.results.length, 8))
  assert.equal(dom.key, String(first.key || '')); assert.equal(dom.name, String(first.name || '')); assert.equal(dom.source, String(source.name || '')); assert.equal(dom.system, String(gameSystem.name || ''))
  assert.equal(dom.heading, String(first.name || '')); assert.equal(dom.badge, `CR ${first.challenge_rating ?? 'Not supplied'}`)
  assert.equal(dom.metrics['Armor class'], String(first.armor_class ?? 'Not supplied')); assert.equal(dom.metrics['Hit points'], String(first.hit_points ?? 'Not supplied')); assert.equal(dom.metrics.Source, String(source.name || 'Not supplied')); assert.equal(dom.metrics['Game system'], String(gameSystem.name || 'Not supplied'))
  assert.equal(dom.pathname, '/v2/creatures/'); assert.equal(dom.query, 'dragon'); assert.equal(dom.limit, '8'); assert(dom.fields.includes('challenge_rating') && dom.fields.includes('passive_perception')); assert.equal(dom.documentFields, 'name,key,gamesystem')
  assert.equal(dom.generic || dom.overflow, false); assert(type.name && size.name, 'V2 projected creature type/size missing')
  await b.viewport(390, 844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({id:'open5e-monster-search',apiVersion:'v2',providerTotal:result.data.count,returned:result.data.results.length,requestBinding:'exact bodyless GET + displayed/executed URL identity',queryMismatchCount:0,primaryIdentity:'exact response match',sourceAndGameSystem:'exact response match',combatFacts:'exact response match',mobileOverflow:false,unnamedControls:0})

  const open5eUrl = 'https://api.open5e.com/v2/creatures/?name__icontains=dragon&limit=8&fields=name%2Ckey%2Cdocument%2Ctype%2Csize%2Cchallenge_rating%2Carmor_class%2Chit_points%2Chit_dice%2Cspeed%2Calignment%2Cpassive_perception&document__fields=name%2Ckey%2Cgamesystem'
  const mixed = { count: 2, next: null, previous: null, results: [
    { key: 'fixture_dragon', name: 'Fixture Dragon', document: { name: 'Fixture Source', key: 'fixture', gamesystem: { name: 'Fixture 5e', key: 'fixture-5e' } }, type: { name: 'Dragon' }, size: { name: 'Large' }, challenge_rating: 5, armor_class: 17, hit_points: 120, speed: { walk: 30, fly: 60, unit: 'feet' } },
    { key: 'fixture_goblin', name: 'Fixture Goblin', document: { name: 'Fixture Source', key: 'fixture', gamesystem: { name: 'Fixture 5e', key: 'fixture-5e' } }, type: { name: 'Humanoid' }, size: { name: 'Small' }, challenge_rating: 1, armor_class: 15, hit_points: 7, speed: { walk: 30, unit: 'feet' } },
  ] }
  const synthetic = await browser(`${root}/dist`, { fixtures: new Map([[open5eUrl, { body: mixed }]]) })
  try {
    await synthetic.nav('open5e-monster-search')
    const fixtureResult = await synthetic.run(); assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await synthetic.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell.querySelector('.open5e-monster-preview'); return {state:card?.dataset.resultState,requestContract:card?.dataset.requestContract,requestBound:card?.dataset.requestBound,requestQuery:card?.dataset.requestQuery,providerRecords:Number(card?.dataset.providerRecordCount),validRecords:Number(card?.dataset.validRecordCount),invalidRecords:Number(card?.dataset.invalidRecordCount),queryMismatchCount:Number(card?.dataset.queryMismatchCount),countContract:card?.dataset.countContract,primary:card?.dataset.primaryMonsterKey,text:card?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1} })()`)
    assert.deepEqual({state:fixtureDom.state,requestContract:fixtureDom.requestContract,requestBound:fixtureDom.requestBound,requestQuery:fixtureDom.requestQuery,providerRecords:fixtureDom.providerRecords,validRecords:fixtureDom.validRecords,invalidRecords:fixtureDom.invalidRecords,queryMismatchCount:fixtureDom.queryMismatchCount,countContract:fixtureDom.countContract,primary:fixtureDom.primary},{state:'partial',requestContract:'exact-open5e-monster-search-v2',requestBound:'true',requestQuery:'dragon',providerRecords:2,validRecords:1,invalidRecords:0,queryMismatchCount:1,countContract:'valid',primary:'fixture_dragon'})
    assert(fixtureDom.text.includes('Fixture Dragon')); assert(!fixtureDom.text.includes('Fixture Goblin')); assert.equal(fixtureDom.overflow,false)
    assert.deepEqual(synthetic.fixtureRequests.map(x=>({url:x.url,source:x.source,status:x.status})),[{url:open5eUrl,source:'synthetic-fixture',status:200}]); assert.deepEqual(synthetic.blockedProviders,[])
    await synthetic.viewport(390,844); assert.equal(await synthetic.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1`),false)
    const fixtureAx=await synthetic.call('Accessibility.getFullAXTree'); assert.equal(unnamed(fixtureAx.nodes).length,0)
    report.checks.push({id:'open5e-monster-search',case:'mixed HTTP-200 request identity',source:'synthetic fixture',semanticState:'partial',requestQuery:'dragon',providerRecords:2,validRecords:1,queryMismatchCount:1,wrongQueryRowWithheld:true,mobileOverflow:false,unnamedControls:0})
    report.errors.push(...synthetic.errors.map(String))
  } finally { await synthetic.close() }

  const wrongQuery = { count: 1, next: null, previous: null, results: [
    { key: 'fixture_goblin', name: 'Fixture Goblin', document: { name: 'Fixture Source', key: 'fixture', gamesystem: { name: 'Fixture 5e', key: 'fixture-5e' } }, type: { name: 'Humanoid' }, size: { name: 'Small' } },
  ] }
  const wrongQueryBrowser = await browser(`${root}/dist`, { fixtures: new Map([[open5eUrl, { body: wrongQuery }]]) })
  try {
    await wrongQueryBrowser.nav('open5e-monster-search')
    const wrongResult = await wrongQueryBrowser.run(); assert.equal(wrongResult.ok, true, wrongResult.error)
    const wrongDom = await wrongQueryBrowser.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell.querySelector('[data-domain-card="monster-statblock"]'); return {state:card?.dataset.resultState,text:card?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1} })()`)
    assert.equal(wrongDom.state, 'invalid'); assert(!wrongDom.text.includes('Fixture Goblin')); assert.equal(wrongDom.overflow, false)
    assert.deepEqual(wrongQueryBrowser.fixtureRequests.map(x=>({url:x.url,source:x.source,status:x.status})),[{url:open5eUrl,source:'synthetic-fixture',status:200}]); assert.deepEqual(wrongQueryBrowser.blockedProviders,[])
    report.checks.push({id:'open5e-monster-search',case:'all-wrong-query HTTP-200 response',source:'synthetic fixture',semanticState:'invalid',wrongQueryRowWithheld:true,additionalLiveProviderRequests:0})
    report.errors.push(...wrongQueryBrowser.errors.map(String))
  } finally { await wrongQueryBrowser.close() }

  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, []); report.verdict='PASS'
} catch (error) { report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String)) }
finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/open5e-monster-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/open5e-monster-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
