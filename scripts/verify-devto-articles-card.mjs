import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://dev.to/api/articles?tag=javascript&per_page=8&page=1'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'SSOT input validation, one live Forem v1 public article request, plus deterministic HTTP-200 fixtures',
  checks: [], errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="devto-articles"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',tag:c?.dataset.requestTag||'',limit:Number(c?.dataset.requestLimit||0),page:Number(c?.dataset.requestPage||0),requestBound:c?.dataset.requestBound||'',providerResults:Number(c?.dataset.providerResultCount||0),validResults:Number(c?.dataset.validResultCount||0),invalidResults:Number(c?.dataset.invalidResultCount||0),incompleteResults:Number(c?.dataset.incompleteResultCount||0),tagContract:c?.dataset.tagContract||'',countContract:c?.dataset.countContract||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

const trustworthy = (article) => article && typeof article === 'object'
  && article.type_of === 'article'
  && Number.isInteger(article.id) && article.id > 0
  && typeof article.title === 'string' && article.title.trim()
  && typeof article.path === 'string' && article.path.startsWith('/')
  && article.url === `https://dev.to${article.path}`
  && Array.isArray(article.tag_list) && article.tag_list.some((tag) => typeof tag === 'string' && tag.toLowerCase() === 'javascript')
  && Number.isInteger(article.public_reactions_count) && article.public_reactions_count >= 0
  && Number.isInteger(article.comments_count) && article.comments_count >= 0
  && Number.isInteger(article.reading_time_minutes) && article.reading_time_minutes >= 0
  && typeof article.published_timestamp === 'string' && !Number.isNaN(Date.parse(article.published_timestamp))
  && typeof article.user?.username === 'string' && article.user.username.trim()

const good = {
  type_of:'article', id:4638269, title:'A trustworthy JavaScript article', description:'A short article summary.', readable_publish_date:'Sep 12',
  tag_list:['javascript','webdev'], slug:'a-trustworthy-javascript-article', path:'/example/a-trustworthy-javascript-article',
  url:'https://dev.to/example/a-trustworthy-javascript-article', public_reactions_count:6, comments_count:2,
  published_timestamp:'2026-09-12T10:24:23Z', reading_time_minutes:5, user:{ name:'Example Author', username:'example' },
}

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('devto')
  const inputContract = await b.ev(`(() => {
    const tag = document.querySelector('#parameter-tag')
    const limit = document.querySelector('#parameter-limit')
    return {
      tagMinLength: tag?.getAttribute('minlength') || '',
      limitStep: limit?.getAttribute('step') || '',
      limitMin: limit?.getAttribute('min') || '',
      limitMax: limit?.getAttribute('max') || '',
    }
  })()`)
  assert.deepEqual(inputContract, { tagMinLength: '1', limitStep: '1', limitMin: '1', limitMax: '20' })

  const beforeFractional = b.requestCount
  const fractional = await b.ev(`(() => {
    const input = document.querySelector('#parameter-limit')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '8.5')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return { valid: input.checkValidity(), stepMismatch: input.validity.stepMismatch }
  })()`)
  assert.deepEqual(fractional, { valid: false, stepMismatch: true })
  await b.ev(`document.querySelector('form.parameter-card').requestSubmit()`)
  await sleep(150)
  assert.equal(b.requestCount, beforeFractional, 'Fractional DEV article limit reached a provider request')

  const beforeBlankTag = b.requestCount
  await b.ev(`(() => {
    const tag = document.querySelector('#parameter-tag')
    const limit = document.querySelector('#parameter-limit')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(limit, '8')
    limit.dispatchEvent(new Event('input', { bubbles: true }))
    limit.dispatchEvent(new Event('change', { bubbles: true }))
    setter.call(tag, '   ')
    tag.dispatchEvent(new Event('input', { bubbles: true }))
    tag.dispatchEvent(new Event('change', { bubbles: true }))
    document.querySelector('form.parameter-card').requestSubmit()
  })()`)
  await sleep(150)
  assert.equal(b.requestCount, beforeBlankTag, 'Whitespace-only DEV article tag reached a provider request')
  await b.ev(`(() => {
    const tag = document.querySelector('#parameter-tag')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(tag, 'javascript')
    tag.dispatchEvent(new Event('input', { bubbles: true }))
    tag.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await sleep(100)
  report.checks.push({ id:'devto', case:'SSOT parameter validation', tagMinLength:1, limitStep:1, limitMin:1, limitMax:20, fractionalLimitRejected:true, whitespaceTagRejected:true, providerRequests:0 })

  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(Array.isArray(run.data), 'live Forem published article response must be an array')
  assert(run.data.length > 0 && run.data.length <= 8, 'live Forem response must respect per_page=8')
  assert(run.data.every(trustworthy), 'every live DEV article must preserve article identity, exact javascript tag, typed metrics, publication time, and author identity')
  const dom = await readDom(b)
  assert.equal(dom.layout, 'community-articles')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.tag, 'javascript')
  assert.equal(dom.limit, 8)
  assert.equal(dom.page, 1)
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.providerResults, run.data.length)
  assert.equal(dom.validResults, run.data.length)
  assert.equal(dom.invalidResults, 0)
  assert.equal(dom.incompleteResults, 0)
  assert.equal(dom.tagContract, 'true')
  assert.equal(dom.countContract, 'true')
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.text.includes(run.data[0].title), true)
  assert.equal(dom.text.includes(`${run.data[0].public_reactions_count.toLocaleString('en')} reactions`), true)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'devto', case:'live Forem v1 exact-tag article page', state:dom.state, returnedResults:dom.providerResults, firstArticleId:run.data[0].id, firstTitle:run.data[0].title, mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const malformedEnvelope = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: { articles:[good] } }]]) })
  try {
    await malformedEnvelope.nav('devto'); const result=await malformedEnvelope.run(); assert.equal(result.ok,true,result.error)
    const d=await readDom(malformedEnvelope); assert.equal(d.state,'invalid'); assert.equal(d.text.includes(good.title),false); assert.deepEqual(malformedEnvelope.errors,[])
    report.checks.push({ id:'devto', case:'malformed HTTP-200 envelope', state:'invalid', fabricatedFactsHidden:true })
  } finally { await malformedEnvelope.close() }

  const wrongTag = { ...good, id:999, title:'Fabricated Python article', path:'/other/fabricated', url:'https://dev.to/other/fabricated', tag_list:['python'], public_reactions_count:999999 }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: [good, wrongTag] }]]) })
  try {
    await mixed.nav('devto'); const result=await mixed.run(); assert.equal(result.ok,true,result.error)
    const d=await readDom(mixed); assert.equal(d.state,'partial'); assert.equal(d.validResults,1); assert.equal(d.invalidResults,1)
    assert.equal(d.text.includes('Fabricated Python article'),false); assert.equal(d.text.includes('999,999 reactions'),false); assert.deepEqual(mixed.errors,[])
    report.checks.push({ id:'devto', case:'tag-contradictory article HTTP-200', state:'partial', providerResults:2, trustedResults:1, fabricatedFactsHidden:true })
  } finally { await mixed.close() }

  const malformedMetrics = { ...good, public_reactions_count:'0', comments_count:-1, reading_time_minutes:'5' }
  const partial = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: [malformedMetrics] }]]) })
  try {
    await partial.nav('devto'); const result=await partial.run(); assert.equal(result.ok,true,result.error)
    const d=await readDom(partial); assert.equal(d.state,'partial'); assert.equal(d.incompleteResults,1)
    assert.equal(d.text.includes('Reactions unavailable'),true); assert.equal(d.text.includes('Unavailable'),true); assert.deepEqual(partial.errors,[])
    report.checks.push({ id:'devto', case:'malformed engagement metrics HTTP-200', state:'partial', malformedMetricsWithheld:true })
  } finally { await partial.close() }

  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/devto-articles-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/devto-articles-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
