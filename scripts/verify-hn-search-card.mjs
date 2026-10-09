import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const storyEndpoint = 'https://hn.algolia.com/api/v1/search?query=OpenAI&tags=story&hitsPerPage=6'
const combinedEndpoint = 'https://hn.algolia.com/api/v1/search?query=OpenAI&tags=%28story%2Ccomment%29&hitsPerPage=6'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live HN Search request plus deterministic malformed HTTP-200 fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setControl = async (b, name, value) => {
  await b.ev(`(()=>{const e=document.querySelector('[name=${JSON.stringify(name)}]');if(!e)throw Error('missing control');const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`)
  await sleep(80)
}
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="hn-search"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',query:c?.dataset.searchQuery||'',tags:c?.dataset.requestTags||'',limit:Number(c?.dataset.requestHitsPerPage||0),bound:c?.dataset.queryBound||'',ack:c?.dataset.requestAcknowledged||'',providerTotal:Number(c?.dataset.providerTotal||0),providerHits:Number(c?.dataset.providerHitCount||0),validHits:Number(c?.dataset.validHitCount||0),invalidHits:Number(c?.dataset.invalidHitCount||0),incompleteHits:Number(c?.dataset.incompleteHitCount||0),countContract:c?.dataset.countContract||'',primaryId:c?.dataset.primaryObjectId||'',primaryKind:c?.dataset.primaryKind||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

const goodStory = {
  objectID: '38309611', title: "OpenAI's board has fired Sam Altman", url: 'https://example.test/openai', author: 'davidbarker', points: 5710,
  story_text: null, comment_text: null, num_comments: 2530, created_at_i: 1700252930, _tags: ['story','author_davidbarker','story_38309611'],
}
const storyWrapper = (hits, overrides={}) => ({ hits, page:0, nbHits:hits.length || 27420, nbPages:hits.length ? 167 : 0, hitsPerPage:6, processingTimeMS:16, query:'OpenAI', params:'query=OpenAI&tags=story&hitsPerPage=6&advancedSyntax=true&analyticsTags=backend', ...overrides })

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('hn-search-algolia')

  const fieldContract = await b.ev(`(() => {
    const query = document.querySelector('[name="query"]')
    const limit = document.querySelector('[name="limit"]')
    return { queryMinLength: query?.minLength, limitMin: limit?.min, limitMax: limit?.max, limitStep: limit?.step }
  })()`)
  assert.deepEqual(fieldContract, { queryMinLength: 1, limitMin: '1', limitMax: '20', limitStep: '1' })

  await setControl(b, 'query', '   ')
  const blankBefore = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()`)
  await sleep(180)
  const blankValidation = await b.ev(`(() => { const field=document.querySelector('[name="query"]'); return {state:document.querySelector('.request-lab')?.dataset.requestState,invalid:field?.getAttribute('aria-invalid'),help:document.querySelector('#parameter-query-help')?.textContent||''} })()`)
  assert.equal(b.requestCount - blankBefore, 0, 'Blank HN search must not trigger a provider request')
  assert.equal(blankValidation.state, 'idle')
  assert.equal(blankValidation.invalid, 'true')
  assert.match(blankValidation.help, /Search term is required\./)

  await setControl(b, 'query', 'OpenAI')
  await setControl(b, 'limit', '6.5')
  const fractionalBefore = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()`)
  await sleep(180)
  const fractionalValidation = await b.ev(`(() => { const field=document.querySelector('[name="limit"]'); return {state:document.querySelector('.request-lab')?.dataset.requestState,invalid:field?.getAttribute('aria-invalid'),help:document.querySelector('#parameter-limit-help')?.textContent||''} })()`)
  assert.equal(b.requestCount - fractionalBefore, 0, 'Fractional HN result limit must not trigger a provider request')
  assert.equal(fractionalValidation.state, 'idle')
  assert.equal(fractionalValidation.invalid, 'true')
  assert.match(fractionalValidation.help, /Results must use increments of 1\./)
  report.checks.push({id:'hn-search-algolia',case:'invalid explicit input',queryMinLength:1,limitStep:1,blankQueryProviderRequests:0,fractionalLimitProviderRequests:0,sharedValidation:'fail-closed'})

  await setControl(b, 'limit', '6')
  await setControl(b, 'tag', '(story,comment)')
  await sleep(150)
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(run.data && typeof run.data === 'object' && !Array.isArray(run.data), 'HN Search response must be an object')
  assert(Array.isArray(run.data.hits) && run.data.hits.length > 0, 'combined story/comment search should return hits')
  assert.equal(run.data.query, 'OpenAI')
  assert.equal(run.data.hitsPerPage, 6)
  const providerParams = new URLSearchParams(run.data.params)
  assert.equal(providerParams.get('query'), 'OpenAI')
  assert.equal(providerParams.get('tags'), '(story,comment)')
  assert.equal(providerParams.get('hitsPerPage'), '6')
  assert(run.data.hits.every((hit) => Array.isArray(hit?._tags) && (hit._tags.includes('story') || hit._tags.includes('comment'))), 'live hits must identify as story or comment')

  const dom = await readDom(b)
  assert.equal(dom.layout, 'hn-search'); assert.equal(dom.fallback, 'false'); assert.equal(dom.state, 'ready')
  assert.equal(dom.query, 'OpenAI'); assert.equal(dom.tags, '(story,comment)'); assert.equal(dom.limit, 6); assert.equal(dom.bound, 'true'); assert.equal(dom.ack, 'true')
  assert.equal(dom.providerHits, run.data.hits.length); assert.equal(dom.validHits, run.data.hits.length); assert.equal(dom.invalidHits, 0); assert.equal(dom.incompleteHits, 0); assert.equal(dom.countContract, 'true')
  assert.equal(dom.endpoint, combinedEndpoint)
  assert.equal(dom.primaryId, run.data.hits[0].objectID)
  assert(run.data.hits[0]._tags.includes(dom.primaryKind), 'primary semantic kind must match provider tags')
  assert.equal(dom.overflow, false)
  await b.viewport(390,844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({id:'hn-search-algolia',case:'live combined stories/comments OR search',state:dom.state,providerHits:dom.providerHits,providerTotal:dom.providerTotal,tagAcknowledgement:providerParams.get('tags'),mobileOverflow:false,unnamedControls:0})
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors,[])
  await b.close(); b=undefined

  const malformed = await browser(`${root}/dist`, { fixtures:new Map([[storyEndpoint,{body:{unexpected:[]}}]]) })
  try {
    await malformed.nav('hn-search-algolia'); const result=await malformed.run(); assert.equal(result.ok,true,result.error)
    const domBad=await readDom(malformed); assert.equal(domBad.state,'invalid'); assert.match(domBad.text,/documented hits array/)
    assert.equal(malformed.fixtureRequests.filter((r)=>r.url===storyEndpoint&&r.method==='GET').length,1); assert.deepEqual(malformed.errors,[])
    report.checks.push({id:'hn-search-algolia',case:'malformed HTTP-200 envelope',state:'invalid',fabricatedFactsHidden:true})
  } finally { await malformed.close() }

  const comment = { objectID:'9949739', author:'Yadi', story_title:'Ask HN', comment_text:'Fabricated contradictory comment', story_id:9949664, parent_id:9949664, created_at_i:1437874131, points:null, num_comments:null, _tags:['comment','author_Yadi','story_9949664'] }
  const mixed = await browser(`${root}/dist`, { fixtures:new Map([[storyEndpoint,{body:storyWrapper([goodStory,comment])}]]) })
  try {
    await mixed.nav('hn-search-algolia'); const result=await mixed.run(); assert.equal(result.ok,true,result.error)
    const domMixed=await readDom(mixed); assert.equal(domMixed.state,'partial'); assert.equal(domMixed.providerHits,2); assert.equal(domMixed.validHits,1); assert.equal(domMixed.invalidHits,1)
    assert.equal(domMixed.text.includes('Fabricated contradictory comment'),false); assert.deepEqual(mixed.errors,[])
    report.checks.push({id:'hn-search-algolia',case:'story-filter response with contradictory comment',state:'partial',providerHits:2,trustedHits:1,contradictoryHitHidden:true})
  } finally { await mixed.close() }

  report.verdict='PASS'
} catch(error) {
  report.verdict='FAIL'; report.error=String(error); if(b) report.errors.push(...b.errors.map(String))
} finally { if(b) await b.close() }
fs.writeFileSync(`${evidence}/hn-search-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/hn-search-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
