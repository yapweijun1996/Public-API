import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'moon'
const limit = 8
const endpoint = `https://images-api.nasa.gov/search?${new URLSearchParams({ q:query, media_type:'image', page_size:String(limit) }).toString()}`
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', source:'one live NASA media search plus one synthetic HTTP-200 semantic fixture', checks:[], errors:[] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const trusted = (item) => {
  const d = Array.isArray(item?.data) && item.data.length === 1 ? item.data[0] : undefined
  if (!d || typeof d.nasa_id !== 'string' || !d.nasa_id.trim() || typeof d.title !== 'string' || !d.title.trim() || d.media_type !== 'image') return false
  try {
    const u = new URL(item.href)
    const prefix = '/image/', suffix = '/collection.json'
    if (u.protocol !== 'https:' || u.hostname !== 'images-assets.nasa.gov' || !u.pathname.startsWith(prefix) || !u.pathname.endsWith(suffix)) return false
    return decodeURIComponent(u.pathname.slice(prefix.length, -suffix.length)) === d.nasa_id
  } catch { return false }
}
const semantic = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="nasa-image-search"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', contract:card?.dataset.requestContract||'', query:card?.dataset.requestQuery||'', mediaType:card?.dataset.requestMediaType||'', limit:Number(card?.dataset.requestLimit||0), providerCount:Number(card?.dataset.providerRecordCount||0), total:Number(card?.dataset.providerTotalHits||0), valid:Number(card?.dataset.validRecordCount||0), malformed:Number(card?.dataset.malformedRecordCount||0), duplicates:Number(card?.dataset.duplicateRecordCount||0), overflow:Number(card?.dataset.overflowRecordCount||0), previewGaps:Number(card?.dataset.previewGapCount||0), supplemental:Number(card?.dataset.supplementalMalformedCount||0), primary:card?.dataset.primaryNasaId||'', text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('nasa-image-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'NASA verifier must issue exactly one live provider request')
  const c = result.data?.collection
  assert(['1.0','1.1'].includes(c?.version), `Unexpected NASA Collection+JSON version ${c?.version}`)
  assert(Array.isArray(c?.items))
  assert.equal(c.items.length, limit)
  assert(Number.isSafeInteger(c?.metadata?.total_hits) && c.metadata.total_hits >= limit)
  assert(c.items.every(trusted), 'NASA provider identity/media contract drifted')
  const echoed = new URL(c.href)
  assert.equal(echoed.searchParams.get('q'), query)
  assert.equal(echoed.searchParams.get('media_type'), 'image')
  assert.equal(echoed.searchParams.get('page_size'), String(limit))
  const expectedPrimary = c.items[0].data[0]
  const dom = await semantic(live)
  assert.deepEqual({layout:dom.layout,fallback:dom.fallback,state:dom.state,requestBound:dom.requestBound,contract:dom.contract,query:dom.query,mediaType:dom.mediaType,limit:dom.limit,providerCount:dom.providerCount,total:dom.total,valid:dom.valid,malformed:dom.malformed,duplicates:dom.duplicates,overflow:dom.overflow,previewGaps:dom.previewGaps,supplemental:dom.supplemental,primary:dom.primary}, {layout:'nasa-media-library',fallback:'false',state:'ready',requestBound:'true',contract:'exact-nasa-media-search-v2',query,mediaType:'image',limit,providerCount:limit,total:c.metadata.total_hits,valid:limit,malformed:0,duplicates:0,overflow:0,previewGaps:0,supplemental:0,primary:expectedPrimary.nasa_id})
  assert(dom.text.includes(expectedPrimary.title))
  assert(dom.text.includes('Media Usage Guidelines'))
  await live.viewport(390,844)
  const mobile = await live.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length,0)
  assert.deepEqual(live.errors,[])
  report.checks.push({ id:'nasa-image-search', source:'live provider', exactRequest:endpoint, returnedRecords:c.items.length, providerTotalHits:c.metadata.total_hits, primaryNasaId:expectedPrimary.nasa_id, semanticState:dom.state, requestBound:dom.requestBound, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active=undefined

  const valid = (id,title='Trusted NASA asset') => ({ data:[{ nasa_id:id,title,media_type:'image',date_created:'2026-09-16T00:00:00Z',center:'JSC',secondary_creator:'NASA fixture' }], href:`https://images-assets.nasa.gov/image/${encodeURIComponent(id)}/collection.json`, links:[{ href:`https://images-assets.nasa.gov/image/${encodeURIComponent(id)}/${encodeURIComponent(id)}~thumb.jpg`, rel:'preview', render:'image' }] })
  const fixtureBody = { collection:{ href:`http://images-api.nasa.gov/search?q=moon&media_type=image&page_size=8`, version:'1.0', metadata:{ total_hits:3 }, items:[ valid('NASA-ONE'), valid('NASA-ONE','Duplicate NASA asset'), { ...valid('NASA-BAD','Fabricated video'), data:[{ nasa_id:'NASA-BAD', title:'Fabricated video', media_type:'video' }], href:'https://images-assets.nasa.gov/video/NASA-BAD/collection.json' } ] } }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{ body:fixtureBody }]]) })
  active = fixture
  await fixture.nav('nasa-image-search')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run()
  assert.equal(fixtureResult.ok,true,fixtureResult.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({state:fixtureDom.state,requestBound:fixtureDom.requestBound,valid:fixtureDom.valid,malformed:fixtureDom.malformed,duplicates:fixtureDom.duplicates,primary:fixtureDom.primary}, {state:'partial',requestBound:'true',valid:1,malformed:1,duplicates:1,primary:'NASA-ONE'})
  assert.equal(fixtureDom.text.includes('Fabricated video'),false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests,1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture NASA case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({ id:'nasa-image-search', case:'mixed duplicate/media-type mismatch HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, validRecords:1, malformedRecords:1, duplicateRecords:1, fabricatedIdentityHidden:true, liveProviderRequests:0 })
  await fixture.close(); active=undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/nasa-image-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/nasa-image-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
