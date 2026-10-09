import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live Datamuse /words sounds-like API plus exact synthetic malformed HTTP-200 fixture',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const tags = (record) => Array.isArray(record?.tags) ? record.tags.filter((tag) => typeof tag === 'string') : []
const ipa = (record) => tags(record).find((tag) => tag.startsWith('ipa_pron:'))?.slice('ipa_pron:'.length).trim() || ''
const posLabels = { n: 'Noun', v: 'Verb', adj: 'Adjective', adv: 'Adverb', u: 'Unclassified' }
const parts = (record) => tags(record).map((tag) => posLabels[tag]).filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(', ') || 'Not supplied'
const datamuseUrl = 'https://api.datamuse.com/words?sl=orange&max=8&md=psr&ipa=1'
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('datamuse-rhymes')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data) && result.data.length > 0, 'Datamuse returned no sounds-like records')
  const first = result.data[0]
  const dom = await b.ev(`(() => {
    const shell=document.querySelector('.demo-preview'), card=shell.querySelector('.datamuse-word-preview'), first=shell.querySelector('.semantic-card-grid article'), url=new URL(document.querySelector('.endpoint-box code').textContent)
    const metrics=Object.fromEntries([...first.querySelectorAll('dl > div')].map(row=>[row.querySelector('dt')?.textContent||'',row.querySelector('dd')?.textContent||'']))
    return {layout:shell.dataset.previewLayout,fallback:shell.dataset.ssotFallback,domain:card.dataset.domainCard,state:card.dataset.resultState,requestBound:card.dataset.requestBound,requestContract:card.dataset.requestContract,constraint:card.dataset.queryConstraint,term:card.dataset.queryTerm,visible:Number(card.dataset.visibleCount),word:card.dataset.primaryWord,ipa:card.dataset.primaryIpa,heading:first.querySelector('h3')?.textContent||'',metrics,pathname:url.pathname,sl:url.searchParams.get('sl'),legacy:url.searchParams.get('rel_rhy'),max:url.searchParams.get('max'),md:url.searchParams.get('md'),ipaFlag:url.searchParams.get('ipa'),note:card.querySelector('.domain-note')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}
  })()`)
  assert.equal(dom.layout, 'lexical-matches'); assert.equal(dom.fallback, 'false'); assert.equal(dom.domain, 'lexical-matches')
  assert.equal(dom.state, 'ready'); assert.equal(dom.requestBound, 'true'); assert.equal(dom.requestContract, 'exact-datamuse-sounds-like-v2')
  assert.equal(dom.constraint, 'sl'); assert.equal(dom.term, 'orange'); assert.equal(dom.visible, Math.min(result.data.length, 8))
  assert.equal(dom.word, String(first.word || '')); assert.equal(dom.ipa, ipa(first)); assert.equal(dom.heading, String(first.word || ''))
  assert.equal(dom.metrics.Rank, '#1'); assert.equal(dom.metrics['Pronunciation (IPA)'], ipa(first) || 'Not supplied'); assert.equal(dom.metrics['Part of speech'], parts(first))
  assert.equal(dom.metrics['Provider score'], first.score === undefined ? 'Not supplied' : `${first.score} · ordering only`)
  assert.equal(dom.pathname, '/words'); assert.equal(dom.sl, 'orange'); assert.equal(dom.legacy, null); assert.equal(dom.max, '8'); assert.equal(dom.md, 'psr'); assert.equal(dom.ipaFlag, '1')
  assert.match(dom.note, /2027-01-01/); assert.match(dom.note, /Datamuse API/); assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({id:'datamuse-rhymes',contract:'exact-datamuse-sounds-like-v2',requestBound:true,returned:result.data.length,primaryWord:'exact response match',pronunciation:'exact response match',partsOfSpeech:'exact response match',scoreSemantics:'ordering only',futureKeyRequirement:'2027-01-01 surfaced',mobileOverflow:false,unnamedControls:0})
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[datamuseUrl, { body: [{ score: 100, tags: ['n'] }] }]]) })
  try {
    await malformed.nav('datamuse-rhymes')
    const malformedResult = await malformed.run()
    assert.equal(malformedResult.ok, true, malformedResult.error)
    const malformedDom = await malformed.ev(`(()=>{const shell=document.querySelector('.demo-preview'), card=shell.querySelector('[data-domain-card=\"lexical-matches\"]');return {state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',contract:card?.dataset.requestContract||'',text:card?.innerText||'',fake:[...shell.querySelectorAll('*')].some(e=>/^Match \\d+$/.test((e.textContent||'').trim())),http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(malformedDom.state, 'invalid')
    assert.equal(malformedDom.requestBound, 'true')
    assert.equal(malformedDom.contract, 'exact-datamuse-sounds-like-v2')
    assert.match(malformedDom.text, /required word identity/)
    assert.equal(malformedDom.fake, false)
    assert.match(malformedDom.http, /^200/)
    assert.equal(malformed.fixtureRequests.filter((request) => request.url === datamuseUrl && request.method === 'GET').length, 1)
    assert.deepEqual(malformed.errors, [])
    report.checks.push({id:'datamuse-rhymes',case:'synthetic malformed HTTP-200 word object',transportStatus:200,semanticState:'invalid',fabricatedFallbackWord:false,exactProviderFixtureRequests:1})
  } finally { await malformed.close() }
  report.verdict='PASS'
} catch (error) { report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String)) }
finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/datamuse-word-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/datamuse-word-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
