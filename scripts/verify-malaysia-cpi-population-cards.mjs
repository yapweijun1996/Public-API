import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoints = {
  cpi: `https://api.data.gov.my/data-catalogue/?${new URLSearchParams({ id: 'cpi_core', filter: 'overall@division', limit: '12', sort: '-date' })}`,
  population: `https://api.data.gov.my/data-catalogue/?${new URLSearchParams({ id: 'population_malaysia', filter: 'both@sex,overall@age,overall@ethnicity', limit: '10', sort: '-date' })}`,
}
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under real GitHub Pages origin', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const mobileAndAx = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.doc || overflow.preview, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
}

async function liveCpi() {
  const b = await browser(`${root}/dist`)
  try {
    await b.nav('malaysia-core-cpi')
    const requestsBefore = b.requestCount
    const result = await b.run(); assert.equal(b.requestCount - requestsBefore, 1, 'Expected exactly one live CPI provider request'); assert.equal(result.ok, true, result.error)
    assert(Array.isArray(result.data) && result.data.length > 0, 'data.gov.my returned no cpi_core rows')
    assert(result.data.every((row) => /^\d{4}-(0[1-9]|1[0-2])-01$/.test(String(row.date)) && row.division === 'overall' && typeof row.index === 'number' && Number.isFinite(row.index)), 'live CPI rows violate documented contract')
    assert(result.data.every((row, index) => index === 0 || String(result.data[index - 1].date) > String(row.date)), 'live CPI rows are not strictly descending by date')
    const first = result.data[0]
    const dom = await b.ev(`(()=>{const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('.malaysia-core-cpi-preview');return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestedLimit:Number(card?.dataset.requestedLimit),rowLimit:card?.dataset.rowLimitContract||'',sort:card?.dataset.sortContract||'',provider:Number(card?.dataset.providerRecordCount),valid:Number(card?.dataset.validRecordCount),invalid:Number(card?.dataset.invalidRecordCount),date:card?.dataset.latestDate||'',index:Number(card?.dataset.primaryIndex),division:card?.dataset.division||'',base:card?.dataset.indexBase||''}})()`)
    assert.deepEqual({layout:dom.layout,fallback:dom.fallback,state:dom.state,requestBound:dom.requestBound,requestedLimit:dom.requestedLimit,rowLimit:dom.rowLimit,sort:dom.sort},{layout:'core-cpi-index',fallback:'false',state:'ready',requestBound:'true',requestedLimit:12,rowLimit:'valid',sort:'valid'})
    assert.equal(dom.provider,result.data.length); assert.equal(dom.valid,result.data.length); assert.equal(dom.invalid,0)
    assert.equal(dom.date,String(first.date)); assert.equal(dom.index,Number(first.index)); assert.equal(dom.division,'overall'); assert.equal(dom.base,'2010=100')
    await mobileAndAx(b); assert.deepEqual(b.errors,[])
    report.checks.push({id:'malaysia-core-cpi',case:'live provider',rows:result.data.length,date:'exact',index:'exact',state:'ready',requestBound:true,liveProviderRequests:1,mobileOverflow:false,unnamedControls:0})
  } finally { await b.close() }
}

async function livePopulation() {
  const b = await browser(`${root}/dist`)
  try {
    await b.nav('malaysia-population')
    const requestsBefore = b.requestCount
    const result = await b.run(); assert.equal(b.requestCount - requestsBefore, 1, 'Expected exactly one live population provider request'); assert.equal(result.ok, true, result.error)
    assert(Array.isArray(result.data) && result.data.length > 0, 'data.gov.my returned no population rows')
    assert(result.data.every((row) => /^\d{4}-01-01$/.test(String(row.date)) && row.sex === 'both' && row.age === 'overall' && row.ethnicity === 'overall' && typeof row.population === 'number' && Number.isFinite(row.population)), 'live population rows violate documented contract')
    assert(result.data.every((row, index) => index === 0 || String(result.data[index - 1].date) > String(row.date)), 'live population rows are not strictly descending by date')
    const first = result.data[0]
    const dom = await b.ev(`(()=>{const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('.malaysia-population-preview');return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestedLimit:Number(card?.dataset.requestedLimit),rowLimit:card?.dataset.rowLimitContract||'',sort:card?.dataset.sortContract||'',provider:Number(card?.dataset.providerRecordCount),valid:Number(card?.dataset.validRecordCount),invalid:Number(card?.dataset.invalidRecordCount),date:card?.dataset.latestDate||'',raw:Number(card?.dataset.primaryPopulationThousand),people:Number(card?.dataset.primaryPopulationPeople),sex:card?.dataset.sex||'',age:card?.dataset.age||'',ethnicity:card?.dataset.ethnicity||''}})()`)
    assert.deepEqual({layout:dom.layout,fallback:dom.fallback,state:dom.state,requestBound:dom.requestBound,requestedLimit:dom.requestedLimit,rowLimit:dom.rowLimit,sort:dom.sort},{layout:'population-total',fallback:'false',state:'ready',requestBound:'true',requestedLimit:10,rowLimit:'valid',sort:'valid'})
    assert.equal(dom.provider,result.data.length); assert.equal(dom.valid,result.data.length); assert.equal(dom.invalid,0)
    assert.equal(dom.date,String(first.date)); assert.equal(dom.raw,Number(first.population)); assert.equal(dom.people,Number(first.population)*1000)
    assert.deepEqual({sex:dom.sex,age:dom.age,ethnicity:dom.ethnicity},{sex:'both',age:'overall',ethnicity:'overall'})
    await mobileAndAx(b); assert.deepEqual(b.errors,[])
    report.checks.push({id:'malaysia-population',case:'live provider',rows:result.data.length,date:'exact',population:'exact',state:'ready',requestBound:true,liveProviderRequests:1,mobileOverflow:false,unnamedControls:0})
  } finally { await b.close() }
}

async function synthetic(id, endpoint, body, expected, forbiddenText) {
  const b = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body }]]) })
  try {
    await b.nav(id); const result = await b.run(); assert.equal(result.ok, true, result.error)
    const dom = await b.ev(`(()=>{const card=document.querySelector('[data-domain-card]');return {state:card?.dataset.resultState||'',provider:card?.dataset.providerRecordCount===undefined?null:Number(card.dataset.providerRecordCount),valid:card?.dataset.validRecordCount===undefined?null:Number(card.dataset.validRecordCount),invalid:card?.dataset.invalidRecordCount===undefined?null:Number(card.dataset.invalidRecordCount),text:card?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(dom.state, expected.state); assert.match(dom.http,/^200/)
    if (expected.provider !== undefined) assert.deepEqual({provider:dom.provider,valid:dom.valid,invalid:dom.invalid}, {provider:expected.provider,valid:expected.valid,invalid:expected.invalid})
    if (forbiddenText) assert.equal(dom.text.includes(forbiddenText), false)
    assert.equal(b.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(b.errors,[])
    report.checks.push({id,case:expected.state==='invalid'?'malformed HTTP-200 envelope':'mixed HTTP-200 rows',state:dom.state,provider:dom.provider,valid:dom.valid,invalid:dom.invalid,fabricatedValueHidden:Boolean(forbiddenText)})
  } finally { await b.close() }
}

let active
try {
  await liveCpi(); await livePopulation()
  await synthetic('malaysia-core-cpi', endpoints.cpi, { unexpected: [] }, { state: 'invalid' })
  await synthetic('malaysia-core-cpi', endpoints.cpi, [{date:'2026-07-01',division:'overall',index:136.2},{date:'2026-07-02',division:'overall',index:999.9}], {state:'partial',provider:2,valid:1,invalid:1}, '999.9')
  await synthetic('malaysia-core-cpi', endpoints.cpi, [{date:'2026-07-01',division:'overall',index:'136.2'}], {state:'invalid'})
  await synthetic('malaysia-population', endpoints.population, { unexpected: [] }, { state: 'invalid' })
  await synthetic('malaysia-population', endpoints.population, [{date:'2026-01-01',sex:'both',age:'overall',ethnicity:'overall',population:34389.4},{date:'2025-01-01',sex:'female',age:'overall',ethnicity:'overall',population:99999.9}], {state:'partial',provider:2,valid:1,invalid:1}, '99,999,900')
  await synthetic('malaysia-population', endpoints.population, [{date:'2026-01-01',sex:'both',age:'overall',ethnicity:'overall',population:'34389.4'}], {state:'invalid'})
  report.verdict='PASS'
} catch (error) { report.verdict='FAIL'; report.error=String(error); if (active) report.errors.push(...active.errors.map(String)) }
fs.writeFileSync(`${evidence}/malaysia-cpi-population-cards.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/malaysia-cpi-population-cards.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
