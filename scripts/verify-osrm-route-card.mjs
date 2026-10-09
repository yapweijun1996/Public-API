import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://router.project-osrm.org/route/v1/driving/103.8198,1.3521;103.851959,1.29027?alternatives=1&geometries=geojson&overview=full&steps=true'
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'live OSRM route plus exact synthetic malformed HTTP-200 fixtures', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('osrm-route')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.code, 'Ok')
  assert(Array.isArray(result.data?.routes) && result.data.routes.length > 0)
  assert(Array.isArray(result.data?.waypoints) && result.data.waypoints.length === 2)
  const first = result.data.routes[0]
  assert.equal(typeof first.distance, 'number')
  assert.equal(typeof first.duration, 'number')
  assert.equal(first.geometry?.type, 'LineString')
  assert(Array.isArray(first.geometry?.coordinates) && first.geometry.coordinates.length >= 2)
  const steps = (first.legs || []).flatMap((leg) => leg.steps || [])
  const dom = await b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('.route-summary-preview');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',code:c?.dataset.routeCode||'',start:c?.dataset.requestedStart||'',end:c?.dataset.requestedEnd||'',alternatives:c?.dataset.requestedAlternatives||'',provider:c?.dataset.providerRouteCount||'',valid:c?.dataset.validRouteCount||'',invalid:c?.dataset.invalidRouteCount||'',incomplete:c?.dataset.incompleteRouteCount||'',waypoints:c?.dataset.waypointContractValid||'',distance:Number(c?.dataset.primaryDistanceM),duration:Number(c?.dataset.primaryDurationS),steps:Number(c?.dataset.primaryStepCount),points:Number(c?.dataset.primaryGeometryPointCount),stepRows:s?.querySelectorAll('.route-step-panel li').length||0,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
  assert.equal(dom.layout, 'route-summary')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.code, 'Ok')
  assert.equal(dom.start, '103.8198,1.3521')
  assert.equal(dom.end, '103.851959,1.29027')
  assert.equal(dom.alternatives, '1')
  assert.equal(Number(dom.provider), result.data.routes.length)
  assert.equal(Number(dom.valid), result.data.routes.length)
  assert.equal(dom.invalid, '0')
  assert.equal(dom.incomplete, '0')
  assert.equal(dom.waypoints, 'true')
  assert.equal(dom.distance, first.distance)
  assert.equal(dom.duration, first.duration)
  assert.equal(dom.steps, steps.length)
  assert.equal(dom.points, first.geometry.coordinates.length)
  assert.equal(dom.stepRows, Math.min(40, steps.length))
  assert.equal(dom.overflow, false)
  await b.viewport(390,844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'osrm-route', case:'live route contract', state:'ready', routeFacts:'exact response match', mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const badRoute = { ...first, distance:999999, geometry:{ type:'LineString', coordinates:[['fake',1.3],[103.9,1.2]] } }
  const mixed = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:{...result.data,routes:[first,badRoute]}}]]) })
  try {
    await mixed.nav('osrm-route'); const run=await mixed.run(); assert.equal(run.ok,true,run.error)
    const value=await mixed.ev(`(()=>{const c=document.querySelector('.route-summary-preview');return {state:c?.dataset.resultState||'',provider:c?.dataset.providerRouteCount||'',valid:c?.dataset.validRouteCount||'',invalid:c?.dataset.invalidRouteCount||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.deepEqual({state:value.state,provider:value.provider,valid:value.valid,invalid:value.invalid},{state:'partial',provider:'2',valid:'1',invalid:'1'})
    assert.equal(value.text.includes('999.00 km'),false); assert.match(value.http,/^200/)
    assert.equal(mixed.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length,1); assert.deepEqual(mixed.errors,[])
    report.checks.push({id:'osrm-route',case:'mixed malformed route HTTP-200',state:'partial',fabricatedRouteHidden:true})
  } finally { await mixed.close() }

  const wrongCode = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{body:{...result.data,code:'NoRoute',routes:[first]}}]]) })
  try {
    await wrongCode.nav('osrm-route'); const run=await wrongCode.run(); assert.equal(run.ok,true,run.error)
    const value=await wrongCode.ev(`(()=>{const c=document.querySelector('.route-summary-preview');return {state:c?.dataset.resultState||'',code:c?.dataset.routeCode||'',distance:c?.dataset.primaryDistanceM||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(value.state,'invalid'); assert.equal(value.code,'NoRoute'); assert.equal(value.distance,''); assert.equal(value.text.includes('Calculated route'),false); assert.match(value.http,/^200/)
    assert.equal(wrongCode.fixtureRequests.filter((r)=>r.url===endpoint&&r.method==='GET').length,1); assert.deepEqual(wrongCode.errors,[])
    report.checks.push({id:'osrm-route',case:'non-Ok HTTP-200',state:'invalid',routeFactsHidden:true})
  } finally { await wrongCode.close() }
  report.verdict='PASS'
} catch (error) { report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String)) }
finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/osrm-route-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/osrm-route-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
