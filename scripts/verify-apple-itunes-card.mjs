import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'Beatles'
const limit = 8
const endpoint = `https://itunes.apple.com/search?${new URLSearchParams({ term:query, media:'music', entity:'song', country:'sg', limit:String(limit) }).toString()}`
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', source:'one live Apple Search API request plus one synthetic HTTP-200 semantic fixture', checks:[], errors:[] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const trustedSong = (row) => row?.wrapperType === 'track' && row?.kind === 'song' && Number.isSafeInteger(row?.trackId) && row.trackId > 0 && typeof row?.trackName === 'string' && row.trackName.trim() && typeof row?.artistName === 'string' && row.artistName.trim() && /^https:\/\/music\.apple\.com\/sg\//.test(row?.trackViewUrl || '')
const semantic = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="apple-itunes-search"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', query:card?.dataset.requestQuery||'', entity:card?.dataset.requestEntity||'', media:card?.dataset.requestMedia||'', country:card?.dataset.requestCountry||'', limit:Number(card?.dataset.requestLimit||0), providerCount:Number(card?.dataset.providerRecordCount||0), validCount:Number(card?.dataset.validRecordCount||0), malformed:Number(card?.dataset.malformedRecordCount||0), duplicates:Number(card?.dataset.duplicateRecordCount||0), supplementalMalformed:Number(card?.dataset.supplementalMalformedCount||0), promotionalFields:Number(card?.dataset.promotionalAssetFieldCount||0), promotionalEmbedded:card?.dataset.promotionalAssetsEmbedded||'', primaryIdentity:card?.dataset.primaryMediaIdentity||'', images:card?.querySelectorAll('img').length||0, audio:card?.querySelectorAll('audio,video').length||0, appleLinks:card?.querySelectorAll('a[href*="apple.com"]').length||0, text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('apple-itunes-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const response = await live.run()
  assert.equal(response.ok, true, response.error)
  assert.equal(live.requestCount - before, 1, 'Apple verifier must issue exactly one live provider request')
  assert(Number.isSafeInteger(response.data?.resultCount) && response.data.resultCount >= 0 && response.data.resultCount <= limit)
  assert(Array.isArray(response.data?.results))
  assert.equal(response.data.results.length, response.data.resultCount)
  assert(response.data.results.length > 0, 'Default Apple query unexpectedly returned no results')
  assert(response.data.results.every(trustedSong), 'Apple song identity/storefront contract drifted')
  assert.equal(new Set(response.data.results.map((row) => row.trackId)).size, response.data.results.length)
  const dom = await semantic(live)
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract, query:dom.query, entity:dom.entity, media:dom.media, country:dom.country, limit:dom.limit, providerCount:dom.providerCount, validCount:dom.validCount, malformed:dom.malformed, duplicates:dom.duplicates, supplementalMalformed:dom.supplementalMalformed, promotionalEmbedded:dom.promotionalEmbedded, primaryIdentity:dom.primaryIdentity, images:dom.images, audio:dom.audio, appleLinks:dom.appleLinks }, { layout:'itunes-media-search', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-apple-itunes-search-v1', query, entity:'song', media:'music', country:'sg', limit, providerCount:response.data.resultCount, validCount:response.data.resultCount, malformed:0, duplicates:0, supplementalMalformed:0, promotionalEmbedded:'false', primaryIdentity:`track:${response.data.results[0].trackId}`, images:0, audio:0, appleLinks:response.data.resultCount })
  assert(dom.promotionalFields > 0, 'Live Apple response no longer included the promotional fields this card intentionally suppresses')
  assert(dom.text.includes('promotional-content terms'))
  await live.viewport(390,844)
  const mobile = await live.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'apple-itunes-search', source:'live provider', exactRequest:endpoint, returnedRecords:response.data.resultCount, primaryTrackId:response.data.results[0].trackId, semanticState:dom.state, requestBound:dom.requestBound, browserCorsReadable:true, promotionalMediaEmbedded:false, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active=undefined

  const song = (id, overrides={}) => ({ wrapperType:'track', kind:'song', trackId:id, trackName:`Fixture song ${id}`, artistName:'Fixture artist', trackViewUrl:`https://music.apple.com/sg/album/fixture/1?i=${id}`, artworkUrl100:`https://is1-ssl.mzstatic.com/fixture/${id}.jpg`, previewUrl:`https://audio-ssl.itunes.apple.com/fixture/${id}.m4a`, ...overrides })
  const fixtureBody = { resultCount:3, results:[ song(1), song(1,{ trackName:'Fabricated duplicate' }), song(3,{ kind:'podcast', trackName:'Fabricated wrong entity', trackViewUrl:'https://podcasts.apple.com/sg/podcast/fixture/id3' }) ] }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{ body:fixtureBody }]]) })
  active = fixture
  await fixture.nav('apple-itunes-search')
  const fixtureBefore = fixture.requestCount
  const fixtureResponse = await fixture.run(); assert.equal(fixtureResponse.ok,true,fixtureResponse.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({ state:fixtureDom.state, requestBound:fixtureDom.requestBound, validCount:fixtureDom.validCount, malformed:fixtureDom.malformed, duplicates:fixtureDom.duplicates, primaryIdentity:fixtureDom.primaryIdentity, images:fixtureDom.images, audio:fixtureDom.audio }, { state:'partial', requestBound:'true', validCount:1, malformed:1, duplicates:1, primaryIdentity:'track:1', images:0, audio:0 })
  assert.equal(fixtureDom.text.includes('Fabricated duplicate'), false)
  assert.equal(fixtureDom.text.includes('Fabricated wrong entity'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests,1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture Apple case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({ id:'apple-itunes-search', case:'duplicate/wrong-entity HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, validRecords:1, malformedRecords:1, duplicateRecords:1, fabricatedIdentityHidden:true, promotionalMediaEmbedded:false, liveProviderRequests:0 })
  await fixture.close(); active=undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/apple-itunes-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/apple-itunes-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
