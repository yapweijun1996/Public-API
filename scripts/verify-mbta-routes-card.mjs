import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api-v3.mbta.com/routes?filter%5Btype%5D=0%2C1'
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle under the real GitHub Pages origin', source: 'one live MBTA routes request plus one duplicate-filter synthetic HTTP-200 fixture', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="mbta-routes"]'), first=card?.querySelector('[data-route-id]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', reason:card?.dataset.resultReason||'', requestBound:card?.dataset.requestBound||'', requestedTypes:card?.dataset.requestedRouteTypes||'', providerCount:Number(card?.dataset.providerRouteCount), validCount:Number(card?.dataset.validRouteCount), invalidCount:Number(card?.dataset.invalidRouteCount), incompleteCount:Number(card?.dataset.incompleteRouteCount), firstRouteId:first?.dataset.routeId||'', firstRouteType:first?.dataset.routeType||'', firstText:first?.innerText||'', allText:card?.innerText||'', endpoint:document.querySelector('.endpoint-box code')?.textContent||'', overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1 } })()`)

let active
try {
  const live = await browser(`${root}/dist`); active = live
  await live.nav('mbta-transit-routes')
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data?.data) && result.data.data.length > 0, 'MBTA returned no live routes')
  const first = result.data.data[0]
  const dom = await readDom(live)
  assert(['ready','partial'].includes(dom.state), JSON.stringify(dom))
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, requestBound:dom.requestBound, requestedTypes:dom.requestedTypes, endpoint:dom.endpoint }, { layout:'transit-board', fallback:'false', requestBound:'true', requestedTypes:'0,1', endpoint })
  assert.equal(dom.providerCount, result.data.data.length)
  assert(dom.validCount > 0)
  assert.equal(dom.firstRouteId, String(first.id))
  assert.equal(dom.firstRouteType, String(first.attributes?.type))
  assert(dom.firstText.includes(String(first.attributes?.long_name)))
  assert([0,1].includes(first.attributes?.type))
  const providerRequests = await live.ev(`performance.getEntriesByName(${JSON.stringify(endpoint)}).length`)
  assert.equal(providerRequests, 1)
  await live.viewport(390, 844)
  assert.equal(await live.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1`), false)
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ case:'live exact MBTA subway/light-rail filter', state:dom.state, requestBound:true, routes:result.data.data.length, validRoutes:dom.validCount, invalidRoutes:dom.invalidCount, incompleteRoutes:dom.incompleteCount, browserCorsReadable:true, providerRequests, mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...live.errors.map(String)); assert.deepEqual(report.errors, [])
  await live.close(); active = undefined

  const duplicateUrl = `${endpoint}&filter%5Btype%5D=3`
  const injected = { data: [{ type:'route', id:'741', attributes:{ type:3, color:'7C878E', text_color:'FFFFFF', description:'Frequent Bus', direction_destinations:['Logan Airport Terminals','South Station'], direction_names:['Outbound','Inbound'], fare_class:'Rapid Transit', listed_route:true, long_name:'Logan Airport Terminals - South Station', short_name:'SL1', sort_order:10051 } }] }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{ body:injected }]]), blockedProviderPatterns:['https://api-v3.mbta.com/*'] }); active = fixture
  await fixture.nav('mbta-transit-routes')
  const fixtureResult = await fixture.run(); assert.equal(fixtureResult.ok, true, fixtureResult.error)
  const fixtureDom = await readDom(fixture)
  assert.equal(fixtureDom.state, 'invalid')
  assert.equal(fixtureDom.allText.includes('SL1'), false)
  assert.deepEqual(fixture.fixtureRequests.map(({url,source,status})=>({url,source,status})), [{url:endpoint,source:'synthetic-fixture',status:200}])
  assert.deepEqual(fixture.blockedProviders, []); assert.deepEqual(fixture.errors, [])
  report.checks.push({ case:'synthetic wrong-mode HTTP-200 route payload', state:'invalid', providerFactsHidden:true, liveProviderRequests:0, duplicateProviderProbeObservedSeparately:duplicateUrl })
  await fixture.close(); active = undefined
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error); if (active) report.errors.push(...active.errors.map(String))
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/mbta-routes-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/mbta-routes-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
