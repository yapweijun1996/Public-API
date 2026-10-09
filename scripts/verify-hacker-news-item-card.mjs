import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const liveEndpoint = 'https://hacker-news.firebaseio.com/v0/item/8863.json?print=pretty'
const missingEndpoint = 'https://hacker-news.firebaseio.com/v0/item/999999999.json?print=pretty'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live Hacker News Firebase item request plus deterministic HTTP-200 fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="hacker-news-item"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',requestedId:Number(c?.dataset.requestedItemId||0),providerId:Number(c?.dataset.providerItemId||0),bound:c?.dataset.requestBound||'',identity:c?.dataset.identityMatch||'',present:c?.dataset.providerItemPresent||'',type:c?.dataset.itemType||'',deleted:c?.dataset.itemDeleted||'',dead:c?.dataset.itemDead||'',kids:Number(c?.dataset.itemKidsCount||0),parts:Number(c?.dataset.itemPartsCount||0),score:c?.dataset.itemScore===''||c?.dataset.itemScore===undefined?null:Number(c.dataset.itemScore),descendants:c?.dataset.itemDescendants===''||c?.dataset.itemDescendants===undefined?null:Number(c.dataset.itemDescendants),parent:c?.dataset.itemParent===''||c?.dataset.itemParent===undefined?null:Number(c.dataset.itemParent),endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)
const setItemId = async (b, value) => {
  await b.ev(`(()=>{const el=document.querySelector('#parameter-itemId');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return el.value})()`)
  await sleep(100)
}
const liveStoryTrusted = (item) => item && typeof item === 'object'
  && item.id === 8863 && item.type === 'story'
  && typeof item.by === 'string' && item.by.length > 0
  && typeof item.title === 'string' && item.title.length > 0
  && Number.isInteger(item.time) && item.time > 0
  && Number.isInteger(item.score) && item.score >= 0
  && Number.isInteger(item.descendants) && item.descendants >= 0
  && Array.isArray(item.kids) && item.kids.every((id) => Number.isInteger(id) && id > 0)

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('hacker-news')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(liveStoryTrusted(run.data), 'live HN item 8863 must preserve documented story identity and numeric semantics')
  const dom = await readDom(b)
  assert.equal(dom.layout, 'hn-item'); assert.equal(dom.fallback, 'false'); assert.equal(dom.state, 'ready')
  assert.equal(dom.requestedId, 8863); assert.equal(dom.providerId, 8863); assert.equal(dom.bound, 'true'); assert.equal(dom.identity, 'true'); assert.equal(dom.present, 'true')
  assert.equal(dom.type, 'story'); assert.equal(dom.score, run.data.score); assert.equal(dom.descendants, run.data.descendants); assert.equal(dom.kids, run.data.kids.length); assert.equal(dom.endpoint, liveEndpoint)
  assert.equal(dom.text.includes(run.data.title), true); assert.equal(dom.overflow, false)
  await b.viewport(390,844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'hacker-news', case:'live request-bound story', state:dom.state, itemId:dom.providerId, score:dom.score, descendants:dom.descendants, directChildren:dom.kids, corsBrowserExecution:true, mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors,[])
  await b.close(); b=undefined

  const missing = await browser(`${root}/dist`, { fixtures:new Map([[missingEndpoint,{body:null}]]) })
  try {
    await missing.nav('hacker-news'); await setItemId(missing,'999999999'); const result=await missing.run(); assert.equal(result.ok,true,result.error)
    const domEmpty=await readDom(missing); assert.equal(domEmpty.state,'empty'); assert.equal(domEmpty.requestedId,999999999); assert.equal(domEmpty.present,'false'); assert.equal(domEmpty.text.includes('not found'),true)
    assert.equal(missing.fixtureRequests.filter((r)=>r.url===missingEndpoint&&r.method==='GET').length,1); assert.deepEqual(missing.errors,[])
    report.checks.push({id:'hacker-news',case:'request-bound provider null HTTP-200',state:'empty',notFoundIdentityBound:true})
  } finally { await missing.close() }

  const wrong = { ...run.data, id:9999, title:'Fabricated wrong-ID HN item', score:999999 }
  const mismatch = await browser(`${root}/dist`, { fixtures:new Map([[liveEndpoint,{body:wrong}]]) })
  try {
    await mismatch.nav('hacker-news'); const result=await mismatch.run(); assert.equal(result.ok,true,result.error)
    const domBad=await readDom(mismatch); assert.equal(domBad.state,'invalid'); assert.equal(domBad.text.includes('Fabricated wrong-ID HN item'),false); assert.equal(domBad.text.includes('999,999'),false); assert.deepEqual(mismatch.errors,[])
    report.checks.push({id:'hacker-news',case:'wrong item identity HTTP-200',state:'invalid',fabricatedFactsHidden:true})
  } finally { await mismatch.close() }

  const malformed = { ...run.data, score:'0', descendants:-1 }
  const partial = await browser(`${root}/dist`, { fixtures:new Map([[liveEndpoint,{body:malformed}]]) })
  try {
    await partial.nav('hacker-news'); const result=await partial.run(); assert.equal(result.ok,true,result.error)
    const domPartial=await readDom(partial); assert.equal(domPartial.state,'partial'); assert.equal(domPartial.score,null); assert.equal(domPartial.descendants,null); assert.equal(domPartial.text.includes('Unavailable'),true); assert.deepEqual(partial.errors,[])
    report.checks.push({id:'hacker-news',case:'malformed story counters HTTP-200',state:'partial',malformedCountersWithheld:true})
  } finally { await partial.close() }

  report.verdict='PASS'
} catch(error) {
  report.verdict='FAIL'; report.error=String(error); if(b) report.errors.push(...b.errors.map(String))
} finally { if(b) await b.close() }
fs.writeFileSync(`${evidence}/hacker-news-item-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/hacker-news-item-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
