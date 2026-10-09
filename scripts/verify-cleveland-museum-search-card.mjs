import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'monet'
const limit = 6
const endpoint = `https://openaccess-api.clevelandart.org/api/artworks/?${new URLSearchParams({ q:query, limit:String(limit), has_image:'1', cc0:'' }).toString()}`
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', source:'one live Cleveland Museum CC0 search plus one synthetic HTTP-200 semantic fixture', checks:[], errors:[] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const trusted = (row) => Number.isSafeInteger(row?.id) && row.id > 0 && typeof row?.accession_number === 'string' && row.accession_number.trim() && typeof row?.title === 'string' && row.title.trim() && row?.share_license_status === 'CC0' && /^https:\/\/(?:[^/]+\.)?clevelandart\.org\//.test(row?.url || '') && /^https:\/\/(?:[^/]+\.)?clevelandart\.org\//.test(row?.images?.web?.url || '')
const semantic = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="cleveland-museum-search"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', query:card?.dataset.requestQuery||'', limit:Number(card?.dataset.requestLimit||0), total:Number(card?.dataset.providerTotal||0), providerCount:Number(card?.dataset.providerArtworkCount||0), validCount:Number(card?.dataset.validArtworkCount||0), malformed:Number(card?.dataset.malformedArtworkCount||0), duplicates:Number(card?.dataset.duplicateArtworkCount||0), overflow:Number(card?.dataset.overflowArtworkCount||0), licenseGaps:Number(card?.dataset.licenseGapCount||0), supplementalMalformed:Number(card?.dataset.supplementalMalformedCount||0), countContract:card?.dataset.countContract||'', primaryArtworkId:Number(card?.dataset.primaryArtworkId||0), primaryAccession:card?.dataset.primaryAccessionNumber||'', primaryLicense:card?.dataset.primaryLicense||'', text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('cleveland-museum-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Cleveland Museum verifier must issue exactly one live provider request')
  assert(Number.isSafeInteger(result.data?.info?.total) && result.data.info.total >= 0)
  assert.equal(result.data?.info?.parameters?.skip, 0)
  assert.equal(result.data?.info?.parameters?.limit, limit)
  assert.equal(result.data?.info?.parameters?.q, query)
  assert.equal(result.data?.info?.parameters?.search, query)
  assert.equal(result.data?.info?.parameters?.has_image, '1')
  assert.equal(result.data?.info?.parameters?.cc0, '')
  const rows = result.data?.data || []
  assert.equal(rows.length, Math.min(limit, result.data.info.total))
  assert(rows.every(trusted), 'Cleveland Museum artwork identity/CC0/image contract drifted')
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length)
  assert.equal(new Set(rows.map((row) => row.accession_number)).size, rows.length)
  const dom = await semantic(live)
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract, query:dom.query, limit:dom.limit, total:dom.total, providerCount:dom.providerCount, validCount:dom.validCount, malformed:dom.malformed, duplicates:dom.duplicates, overflow:dom.overflow, licenseGaps:dom.licenseGaps, supplementalMalformed:dom.supplementalMalformed, countContract:dom.countContract, primaryArtworkId:dom.primaryArtworkId, primaryAccession:dom.primaryAccession, primaryLicense:dom.primaryLicense }, { layout:'open-access-art-search', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-cleveland-cc0-image-search-v2', query, limit, total:result.data.info.total, providerCount:rows.length, validCount:rows.length, malformed:0, duplicates:0, overflow:0, licenseGaps:0, supplementalMalformed:0, countContract:'true', primaryArtworkId:rows[0]?.id || 0, primaryAccession:rows[0]?.accession_number || '', primaryLicense:'CC0' })
  assert(dom.text.includes('third-party rights'), 'CMA rights caveat missing from semantic DOM')
  await live.viewport(390,844)
  const mobile = await live.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'cleveland-museum-search', source:'live provider', exactRequest:endpoint, providerTotal:result.data.info.total, returnedRecords:rows.length, primaryArtworkId:rows[0]?.id, primaryAccession:rows[0]?.accession_number, semanticState:dom.state, requestBound:dom.requestBound, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active=undefined

  const artwork = (id, accession, overrides={}) => ({ id, accession_number:accession, title:'Fixture artwork', creation_date:'1900', share_license_status:'CC0', url:`https://clevelandart.org/art/${accession}`, creators:[{ description:'Fixture creator' }], images:{ web:{ url:`https://openaccess-cdn.clevelandart.org/${accession}/${accession}_web.jpg` } }, ...overrides })
  const fixtureBody = { info:{ total:3, parameters:{ skip:0, limit, q:query, search:query, cc0:'', has_image:'1' } }, data:[ artwork(1,'A.1'), artwork(2,'A.1',{title:'Duplicate accession'}), artwork(3,'A.3',{title:'Fabricated copyrighted work',share_license_status:'Copyrighted'}) ] }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{ body:fixtureBody }]]) })
  active = fixture
  await fixture.nav('cleveland-museum-search')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run(); assert.equal(fixtureResult.ok,true,fixtureResult.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({ state:fixtureDom.state, requestBound:fixtureDom.requestBound, validCount:fixtureDom.validCount, malformed:fixtureDom.malformed, duplicates:fixtureDom.duplicates, licenseGaps:fixtureDom.licenseGaps, primaryArtworkId:fixtureDom.primaryArtworkId, primaryAccession:fixtureDom.primaryAccession }, { state:'partial', requestBound:'true', validCount:1, malformed:1, duplicates:1, licenseGaps:1, primaryArtworkId:1, primaryAccession:'A.1' })
  assert.equal(fixtureDom.text.includes('Fabricated copyrighted work'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests,1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture Cleveland Museum case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({ id:'cleveland-museum-search', case:'duplicate/non-CC0 HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, validRecords:1, malformedRecords:1, duplicateRecords:1, licenseGaps:1, fabricatedIdentityHidden:true, liveProviderRequests:0 })
  await fixture.close(); active=undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/cleveland-museum-search-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/cleveland-museum-search-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
