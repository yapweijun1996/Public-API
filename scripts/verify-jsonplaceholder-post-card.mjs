import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://jsonplaceholder.typicode.com/posts/7'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live JSONPlaceholder post request plus deterministic malformed HTTP-200 fixtures',
  checks: [], errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="jsonplaceholder-post"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',requestBound:c?.dataset.requestBound||'',requestedId:Number(c?.dataset.requestedPostId||0),providerId:Number(c?.dataset.providerPostId||0),authorId:c?.dataset.authorUserId===''||c?.dataset.authorUserId===undefined?null:Number(c.dataset.authorUserId),identityMatch:c?.dataset.identityMatch||'',contentContract:c?.dataset.contentContract||'',authorContract:c?.dataset.authorContract||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

const trustworthy = (post) => post && typeof post === 'object' && !Array.isArray(post)
  && Number.isInteger(post.id) && post.id === 7
  && Number.isInteger(post.userId) && post.userId >= 1 && post.userId <= 10
  && typeof post.title === 'string' && post.title.trim()
  && typeof post.body === 'string' && Boolean(post.body.trim())

const good = { userId:1, id:7, title:'A trustworthy fake REST post', body:'A deterministic fake post body.' }

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('posts')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert.equal(trustworthy(run.data), true, 'live JSONPlaceholder /posts/7 must preserve documented post identity and content fields')
  const dom = await readDom(b)
  assert.equal(dom.layout, 'rest-post')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestedId, 7)
  assert.equal(dom.providerId, run.data.id)
  assert.equal(dom.authorId, run.data.userId)
  assert.equal(dom.identityMatch, 'true')
  assert.equal(dom.contentContract, 'true')
  assert.equal(dom.authorContract, 'true')
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.text.includes(run.data.title), true)
  assert.equal(dom.text.includes(run.data.body.split('\n')[0]), true)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'posts', case:'live request-bound JSONPlaceholder post', state:dom.state, postId:dom.providerId, authorUserId:dom.authorId, mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const wrongIdentity = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body:{ ...good, id:8, title:'Fabricated wrong post' } }]]) })
  try {
    await wrongIdentity.nav('posts'); const result=await wrongIdentity.run(); assert.equal(result.ok,true,result.error)
    const d=await readDom(wrongIdentity); assert.equal(d.state,'invalid'); assert.equal(d.text.includes('Fabricated wrong post'),false); assert.deepEqual(wrongIdentity.errors,[])
    report.checks.push({ id:'posts', case:'wrong post identity HTTP-200', state:'invalid', fabricatedFactsHidden:true })
  } finally { await wrongIdentity.close() }

  const malformedAuthor = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body:{ ...good, userId:'1' } }]]) })
  try {
    await malformedAuthor.nav('posts'); const result=await malformedAuthor.run(); assert.equal(result.ok,true,result.error)
    const d=await readDom(malformedAuthor); assert.equal(d.state,'partial'); assert.equal(d.authorId,null); assert.equal(d.authorContract,'false'); assert.equal(d.text.includes('Unavailable'),true); assert.deepEqual(malformedAuthor.errors,[])
    report.checks.push({ id:'posts', case:'malformed author identity HTTP-200', state:'partial', untrustedAuthorWithheld:true })
  } finally { await malformedAuthor.close() }

  const malformedContent = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body:{ ...good, title:123, body:null } }]]) })
  try {
    await malformedContent.nav('posts'); const result=await malformedContent.run(); assert.equal(result.ok,true,result.error)
    const d=await readDom(malformedContent); assert.equal(d.state,'partial'); assert.equal(d.contentContract,'false'); assert.equal(d.text.includes('Post #7'),true); assert.equal(d.text.includes('Content unavailable'),true); assert.deepEqual(malformedContent.errors,[])
    report.checks.push({ id:'posts', case:'malformed content HTTP-200', state:'partial', untrustedContentWithheld:true })
  } finally { await malformedContent.close() }

  const malformedEnvelope = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body:{} }]]) })
  try {
    await malformedEnvelope.nav('posts'); const result=await malformedEnvelope.run(); assert.equal(result.ok,true,result.error)
    const d=await readDom(malformedEnvelope); assert.equal(d.state,'invalid'); assert.deepEqual(malformedEnvelope.errors,[])
    report.checks.push({ id:'posts', case:'empty-object HTTP-200', state:'invalid', noSemanticEmptyInvented:true })
  } finally { await malformedEnvelope.close() }

  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/jsonplaceholder-post-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/jsonplaceholder-post-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
