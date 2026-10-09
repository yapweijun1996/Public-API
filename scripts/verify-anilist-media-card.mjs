import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://graphql.anilist.co/'
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setControl = async (b, name, value) => {
  await b.ev(`(() => { const element=document.querySelector('[name=${JSON.stringify(name)}]'); if(!element) throw new Error('Missing control'); const proto=element.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(element,${JSON.stringify(value)}); element.dispatchEvent(new Event(element.tagName==='SELECT'?'change':'input',{bubbles:true})); })()`)
  await sleep(80)
}
const mobileAx = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  assert.equal(unnamed((await b.call('Accessibility.getFullAXTree')).nodes).length, 0)
}
const boundDom = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="anilist-media-search"]'); return { layout:shell?.dataset.previewLayout||'', state:card?.dataset.resultState, requestBound:card?.dataset.requestBound, search:card?.dataset.requestedSearch||'', type:card?.dataset.requestedMediaType||'', requestedPage:Number(card?.dataset.requestedPage), requestedPerPage:Number(card?.dataset.requestedPerPage), providerPage:Number(card?.dataset.providerCurrentPage), providerPerPage:Number(card?.dataset.providerPerPage), pageMatch:card?.dataset.pageMatch, perPageMatch:card?.dataset.perPageMatch, providerCount:Number(card?.dataset.providerMediaCount), validCount:Number(card?.dataset.validMediaCount), invalidCount:Number(card?.dataset.invalidMediaCount), errorCount:Number(card?.dataset.graphqlErrorCount), text:card?.innerText||'' }; })()`)

try {
  const live = await browser(root + '/dist')
  try {
    await live.nav('anilist-graphql')
    await setControl(live, 'query', 'Cowboy Bebop')
    await setControl(live, 'mediaType', 'ANIME')
    await setControl(live, 'page', '1')
    await setControl(live, 'limit', '2')
    const result = await live.run()
    assert.equal(result.ok, true, result.error)
    assert(result.data && typeof result.data === 'object' && result.data.data?.Page)
    assert(Array.isArray(result.data.data.Page.media) && result.data.data.Page.media.length > 0)
    assert(result.data.data.Page.media.every((item) => item && item.type === 'ANIME' && Number.isSafeInteger(item.id) && item.id > 0))
    const dom = await boundDom(live)
    assert.deepEqual({ layout:dom.layout, state:dom.state, requestBound:dom.requestBound, search:dom.search, type:dom.type, requestedPage:dom.requestedPage, requestedPerPage:dom.requestedPerPage, pageMatch:dom.pageMatch, perPageMatch:dom.perPageMatch, invalidCount:dom.invalidCount, errorCount:dom.errorCount }, { layout:'anime-media-search', state:'ready', requestBound:'true', search:'Cowboy Bebop', type:'ANIME', requestedPage:1, requestedPerPage:2, pageMatch:'true', perPageMatch:'true', invalidCount:0, errorCount:0 })
    assert.equal(dom.providerPage, 1)
    assert.equal(dom.providerPerPage, 2)
    assert.equal(dom.providerCount, result.data.data.Page.media.length)
    assert.equal(dom.validCount, result.data.data.Page.media.length)
    await mobileAx(live)
    report.checks.push({ id:'anilist-graphql', source:'live provider', semanticState:'ready', requestBodyBinding:'search + media type + page + perPage', requestedType:'ANIME', requestedPage:1, requestedPerPage:2, providerRecords:dom.providerCount, validRecords:dom.validCount, pageMatch:true, perPageMatch:true, mobileOverflow:false, unnamedControls:0 })
    report.errors.push(...live.errors.map(String))
  } finally { await live.close() }

  const wrongTypeBody = {
    data: { Page: { pageInfo: { total: 1, perPage: 1, currentPage: 1, hasNextPage: false }, media: [{ id: 999, title: { romaji: 'Plausible but wrong manga' }, type: 'MANGA', format: 'MANGA', status: 'FINISHED', coverImage: { medium: 'https://images.test/wrong.jpg' } }] } },
  }
  const synthetic = await browser(root + '/dist', { fixtures:new Map([[endpoint,{ method:'POST', body:wrongTypeBody }]]) })
  try {
    await synthetic.nav('anilist-graphql')
    await setControl(synthetic, 'query', 'Cowboy Bebop')
    await setControl(synthetic, 'mediaType', 'ANIME')
    await setControl(synthetic, 'page', '1')
    await setControl(synthetic, 'limit', '1')
    const result = await synthetic.run()
    assert.equal(result.ok, true, result.error)
    const dom = await boundDom(synthetic)
    assert.equal(dom.state, 'invalid')
    assert(!dom.text.includes('Plausible but wrong manga'))
    const methods = synthetic.fixtureRequests.map((request) => request.method)
    assert(methods.includes('POST'))
    assert.deepEqual(synthetic.blockedProviders, [])
    await mobileAx(synthetic)
    report.checks.push({ id:'anilist-graphql', case:'wrong-media-type HTTP-200 GraphQL response', source:'synthetic fixture', semanticState:'invalid', requestedType:'ANIME', providerType:'MANGA', plausibleResultWithheld:true, mobileOverflow:false, unnamedControls:0 })
    report.errors.push(...synthetic.errors.map(String))
  } finally { await synthetic.close() }

  assert.deepEqual(report.errors, [])
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
}
fs.writeFileSync(`${evidence}/anilist-media-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/anilist-media-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
