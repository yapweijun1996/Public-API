import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_pjan?format=JSON&geo=DE&sex=T&age=TOTAL&time=2025'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live Eurostat Statistics API JSON-stat response plus an exact synthetic wrong-dimension HTTP-200 fixture',
  checks: [], errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const categoryCode = (data, key) => Object.keys(data?.dimension?.[key]?.category?.index ?? {})[0]
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('eurostat-population')
  const live = await b.run()
  assert.equal(live.ok, true, live.error)
  const data = live.data
  assert.equal(data?.class, 'dataset')
  assert.equal(data?.source, 'ESTAT')
  assert.deepEqual(data?.id, ['freq','unit','age','sex','geo','time'])
  assert.deepEqual(data?.size, [1,1,1,1,1,1])
  assert.equal(categoryCode(data,'freq'), 'A')
  assert.equal(categoryCode(data,'unit'), 'NR')
  assert.equal(categoryCode(data,'age'), 'TOTAL')
  assert.equal(categoryCode(data,'sex'), 'T')
  assert.equal(categoryCode(data,'geo'), 'DE')
  assert.equal(categoryCode(data,'time'), '2025')
  const population = Number(data?.value?.['0'])
  assert(Number.isInteger(population) && population >= 0, 'Eurostat live cell was not a non-negative integer')
  const dom = await b.ev(`(()=>{const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('.eurostat-population-preview');return {layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',population:Number(card?.dataset.primaryPopulation),geo:card?.dataset.geoCode||'',year:card?.dataset.referenceYear||'',unit:card?.dataset.unitCode||'',age:card?.dataset.ageCode||'',sex:card?.dataset.sexCode||'',freq:card?.dataset.frequencyCode||'',requestedGeo:card?.dataset.requestedGeoCode||'',requestedYear:card?.dataset.requestedReferenceYear||'',identity:card?.dataset.identityMatch||'',cells:card?.dataset.cellCount||'',contract:card?.dataset.dimensionContractValid||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
  assert.deepEqual({layout:dom.layout,fallback:dom.fallback,state:dom.state,requestBound:dom.requestBound,requestContract:dom.requestContract,geo:dom.geo,year:dom.year,unit:dom.unit,age:dom.age,sex:dom.sex,freq:dom.freq,requestedGeo:dom.requestedGeo,requestedYear:dom.requestedYear,identity:dom.identity,cells:dom.cells,contract:dom.contract}, {layout:'population-statistic',fallback:'false',state:'ready',requestBound:'true',requestContract:'exact-eurostat-demo-pjan-single-cell-v2',geo:'DE',year:'2025',unit:'NR',age:'TOTAL',sex:'T',freq:'A',requestedGeo:'DE',requestedYear:'2025',identity:'true',cells:'1',contract:'true'})
  assert.equal(dom.population, population)
  assert.equal(dom.overflow, false)
  await b.viewport(390,844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({id:'eurostat-population',case:'live exact JSON-stat cell',population,geo:'DE',year:'2025',semanticState:'ready',requestBound:true,requestContract:'exact-eurostat-demo-pjan-single-cell-v2',mobileOverflow:false,unnamedControls:0})
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b=undefined

  const malformedBody = {
    version:'2.0', class:'dataset', source:'ESTAT', label:'Population on 1 January by age and sex',
    id:['freq','unit','age','sex','geo','time'], size:[1,1,1,1,1,1], value:{'0':99999999},
    dimension:{
      freq:{category:{index:{A:0},label:{A:'Annual'}}}, unit:{category:{index:{PC:0},label:{PC:'Percentage'}}},
      age:{category:{index:{TOTAL:0},label:{TOTAL:'Total'}}}, sex:{category:{index:{T:0},label:{T:'Total'}}},
      geo:{category:{index:{DE:0},label:{DE:'Germany'}}}, time:{category:{index:{2025:0},label:{2025:'2025'}}},
    },
  }
  const malformed = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:malformedBody}]]) })
  try {
    await malformed.nav('eurostat-population')
    const result = await malformed.run(); assert.equal(result.ok,true,result.error)
    const invalid = await malformed.ev(`(()=>{const card=document.querySelector('[data-domain-card="population-statistic"]');return {state:card?.dataset.resultState||'',text:card?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(invalid.state,'invalid'); assert.match(invalid.text,/single-cell demo_pjan JSON-stat dimension contract/i); assert.match(invalid.http,/^200/)
    assert.doesNotMatch(invalid.text,/99,999,999/)
    assert.equal(malformed.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length,1)
    assert.deepEqual(malformed.errors,[])
    report.checks.push({id:'eurostat-population',case:'synthetic wrong-unit HTTP-200',transportStatus:200,semanticState:'invalid',fabricatedPopulationHidden:true,exactProviderFixtureRequests:1})
  } finally { await malformed.close() }
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/eurostat-population-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/eurostat-population-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
