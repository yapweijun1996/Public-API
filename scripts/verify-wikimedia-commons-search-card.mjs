import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const query = 'Singapore skyline'
const limit = 6
const endpoint = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action:'query', generator:'search', gsrsearch:query, gsrnamespace:'6', gsrlimit:String(limit), prop:'imageinfo', iiprop:'url|extmetadata', iiurlwidth:'400', format:'json', origin:'*' }).toString()}`
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', source:'one live Wikimedia Commons search plus one synthetic HTTP-200 semantic fixture', checks:[], errors:[] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const meta = (row,key) => row?.imageinfo?.[0]?.extmetadata?.[key]?.value
const trusted = (row) => Number.isSafeInteger(row?.pageid) && row.pageid > 0 && row?.ns === 6 && Number.isSafeInteger(row?.index) && row.index > 0 && typeof row?.title === 'string' && row.title.startsWith('File:') && typeof row?.imageinfo?.[0]?.descriptionurl === 'string' && /^https:\/\//.test(row.imageinfo[0].descriptionurl) && /^https:\/\//.test(row.imageinfo[0].thumburl || row.imageinfo[0].url || '') && typeof (meta(row,'LicenseShortName') || meta(row,'License')) === 'string'
const semantic = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="wikimedia-commons-search"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', query:card?.dataset.requestQuery||'', limit:Number(card?.dataset.requestLimit||0), providerCount:Number(card?.dataset.providerRecordCount||0), validCount:Number(card?.dataset.validRecordCount||0), malformed:Number(card?.dataset.malformedRecordCount||0), duplicates:Number(card?.dataset.duplicateRecordCount||0), overflow:Number(card?.dataset.overflowRecordCount||0), licenseGaps:Number(card?.dataset.licenseGapCount||0), primaryPageId:Number(card?.dataset.primaryPageId||0), primaryLicense:card?.dataset.primaryLicense||'', text:card?.innerText||'' }; })()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('wikimedia-commons-search')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`), endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'Commons verifier must issue exactly one live provider request')
  const pages = Object.values(result.data?.query?.pages || {})
  assert.equal(pages.length, limit, 'Commons default result count drifted')
  assert(pages.every(trusted), 'Commons page identity/license contract drifted')
  const ordered = [...pages].sort((a,b) => a.index - b.index)
  const expectedPrimary = ordered[0]
  const expectedLicense = meta(expectedPrimary,'LicenseShortName') || meta(expectedPrimary,'License')
  const dom = await semantic(live)
  assert.deepEqual({ layout:dom.layout, fallback:dom.fallback, state:dom.state, requestBound:dom.requestBound, requestContract:dom.requestContract, query:dom.query, limit:dom.limit, providerCount:dom.providerCount, validCount:dom.validCount, malformed:dom.malformed, duplicates:dom.duplicates, overflow:dom.overflow, licenseGaps:dom.licenseGaps, primaryPageId:dom.primaryPageId, primaryLicense:dom.primaryLicense }, { layout:'commons-media-search', fallback:'false', state:'ready', requestBound:'true', requestContract:'exact-commons-generator-search-v1', query, limit, providerCount:limit, validCount:limit, malformed:0, duplicates:0, overflow:0, licenseGaps:0, primaryPageId:expectedPrimary.pageid, primaryLicense:expectedLicense })
  assert(dom.text.includes(expectedPrimary.title.replace(/^File:/,'')), 'Primary Commons title missing from semantic DOM')
  assert(dom.text.includes(expectedLicense), 'Primary Commons license missing from semantic DOM')
  await live.viewport(390,844)
  const mobile = await live.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id:'wikimedia-commons-search', source:'live provider', exactRequest:endpoint, returnedRecords:pages.length, primaryPageId:expectedPrimary.pageid, primaryLicense:expectedLicense, semanticState:dom.state, requestBound:dom.requestBound, browserCorsReadable:true, mobileOverflow:false, unnamedControls:0 })
  await live.close(); active=undefined

  const valid = (key,index,title='File:Trusted.jpg') => ({ pageid:key, ns:6, index, title, imageinfo:[{ url:`https://upload.wikimedia.org/${key}.jpg`, thumburl:`https://upload.wikimedia.org/${key}-thumb.jpg`, descriptionurl:`https://commons.wikimedia.org/wiki/File:${key}.jpg`, extmetadata:{ LicenseShortName:{ value:'CC BY 4.0' }, LicenseUrl:{ value:'https://creativecommons.org/licenses/by/4.0/' }, Artist:{ value:'Fixture Artist' }, AttributionRequired:{ value:'true' } } }] })
  const fixtureBody = { batchcomplete:'', query:{ pages:{ a:valid(10,1), b:valid(10,2,'File:Duplicate.jpg'), c:{ ...valid(12,3,'File:Fabricated-no-license.jpg'), imageinfo:[{ url:'https://upload.wikimedia.org/12.jpg', thumburl:'https://upload.wikimedia.org/12-thumb.jpg', descriptionurl:'https://commons.wikimedia.org/wiki/File:12.jpg', extmetadata:{} }] } } } }
  const fixture = await browser(`${root}/dist`, { fixtures:new Map([[endpoint,{ body:fixtureBody, allowHeaders:'Api-User-Agent' }]]) })
  active = fixture
  await fixture.nav('wikimedia-commons-search')
  const fixtureBefore = fixture.requestCount
  const fixtureResult = await fixture.run(); assert.equal(fixtureResult.ok,true,fixtureResult.error)
  const fixtureDom = await semantic(fixture)
  assert.deepEqual({ state:fixtureDom.state, requestBound:fixtureDom.requestBound, validCount:fixtureDom.validCount, malformed:fixtureDom.malformed, duplicates:fixtureDom.duplicates, primaryPageId:fixtureDom.primaryPageId }, { state:'partial', requestBound:'true', validCount:1, malformed:1, duplicates:1, primaryPageId:10 })
  assert.equal(fixtureDom.text.includes('Fabricated-no-license'), false)
  const fixtureRequests = fixture.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(fixtureRequests,1)
  assert.equal(fixture.requestCount - fixtureBefore, fixtureRequests, 'Fixture Commons case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({ id:'wikimedia-commons-search', case:'mixed malformed/duplicate Commons identity HTTP-200 fixture', source:'synthetic fixture', semanticState:fixtureDom.state, validRecords:1, malformedRecords:1, duplicateRecords:1, fabricatedIdentityHidden:true, liveProviderRequests:0 })
  await fixture.close(); active=undefined
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error)
  if (active) { report.errors.push(...active.errors.map(String)); report.networkFailures=active.networkFailures }
} finally { if (active) await active.close() }
fs.writeFileSync(`${evidence}/wikimedia-commons-search-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/wikimedia-commons-search-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
