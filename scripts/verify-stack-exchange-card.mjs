import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&tagged=javascript&site=stackoverflow&pagesize=8'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one policy-compliant live Stack Exchange /questions request plus deterministic HTTP-200 fixtures',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setControl = async (active, name, value) => {
  await active.ev(`(() => {
    const element = document.querySelector('[name=${JSON.stringify(name)}]')
    if (!element) throw new Error('Missing control ' + ${JSON.stringify(name)})
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)})
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })()`)
  await sleep(80)
}
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="stack-exchange-questions"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',site:c?.dataset.site||'',tags:c?.dataset.requestTags||'',sort:c?.dataset.requestSort||'',order:c?.dataset.requestOrder||'',pageSize:Number(c?.dataset.requestPageSize||0),queryBound:c?.dataset.queryBound||'',providerResults:Number(c?.dataset.providerResultCount||0),validResults:Number(c?.dataset.validResultCount||0),invalidResults:Number(c?.dataset.invalidResultCount||0),incompleteResults:Number(c?.dataset.incompleteResultCount||0),wrapperContract:c?.dataset.wrapperContract||'',tagContract:c?.dataset.tagContract||'',countContract:c?.dataset.countContract||'',hasMore:c?.dataset.hasMore||'',quotaRemaining:c?.dataset.quotaRemaining===''||c?.dataset.quotaRemaining===undefined?null:Number(c.dataset.quotaRemaining),quotaMax:c?.dataset.quotaMax===''||c?.dataset.quotaMax===undefined?null:Number(c.dataset.quotaMax),backoff:c?.dataset.backoffSeconds===''||c?.dataset.backoffSeconds===undefined?null:Number(c.dataset.backoffSeconds),endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

const trustedQuestion = (row) => row && typeof row === 'object'
  && Number.isInteger(row.question_id) && row.question_id > 0
  && typeof row.title === 'string' && row.title.trim()
  && typeof row.link === 'string' && row.link.startsWith(`https://stackoverflow.com/questions/${row.question_id}/`)
  && Array.isArray(row.tags) && row.tags.includes('javascript')
  && Number.isInteger(row.score)
  && Number.isInteger(row.answer_count) && row.answer_count >= 0
  && Number.isInteger(row.view_count) && row.view_count >= 0
  && typeof row.is_answered === 'boolean'
  && Number.isInteger(row.creation_date) && row.creation_date > 0
  && Number.isInteger(row.last_activity_date) && row.last_activity_date > 0

const goodQuestion = {
  tags: ['javascript', 'reactjs'],
  owner: { display_name: 'Example user' },
  is_answered: true,
  view_count: 1234,
  answer_count: 3,
  score: 12,
  last_activity_date: 1789230000,
  creation_date: 1789200000,
  question_id: 123456,
  link: 'https://stackoverflow.com/questions/123456/example-question',
  title: 'Example JavaScript question',
}
const wrapper = (items, overrides = {}) => ({ items, has_more: false, quota_max: 300, quota_remaining: 299, ...overrides })

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('stack-exchange')

  const fieldContract = await b.ev(`(() => {
    const tags = document.querySelector('[name="tags"]')
    const limit = document.querySelector('[name="limit"]')
    return { tagsMinLength: tags?.minLength, tagsMaxLength: tags?.maxLength, tagsPattern: tags?.pattern, limitMin: limit?.min, limitMax: limit?.max, limitStep: limit?.step }
  })()` )
  assert.deepEqual(fieldContract, { tagsMinLength: 1, tagsMaxLength: 200, tagsPattern: '[^;]+(?:;[^;]+){0,4}', limitMin: '1', limitMax: '20', limitStep: '1' })

  await setControl(b, 'tags', '   ')
  await setControl(b, 'limit', '8')
  const blankBefore = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()`)
  await sleep(180)
  const blankValidation = await b.ev(`(() => { const field=document.querySelector('[name="tags"]'); return {state:document.querySelector('.request-lab')?.dataset.requestState,invalid:field?.getAttribute('aria-invalid'),help:document.querySelector('#parameter-tags-help')?.textContent||''} })()` )
  assert.equal(b.requestCount - blankBefore, 0, 'Blank Stack Exchange tags must not trigger a provider request')
  assert.equal(blankValidation.state, 'idle')
  assert.equal(blankValidation.invalid, 'true')
  assert.match(blankValidation.help, /Required tags is required\./)

  await setControl(b, 'tags', 'javascript')
  await setControl(b, 'limit', '8.5')
  const fractionalBefore = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()`)
  await sleep(180)
  const fractionalValidation = await b.ev(`(() => { const field=document.querySelector('[name="limit"]'); return {state:document.querySelector('.request-lab')?.dataset.requestState,invalid:field?.getAttribute('aria-invalid'),help:document.querySelector('#parameter-limit-help')?.textContent||''} })()` )
  assert.equal(b.requestCount - fractionalBefore, 0, 'Fractional Stack Exchange page size must not trigger a provider request')
  assert.equal(fractionalValidation.state, 'idle')
  assert.equal(fractionalValidation.invalid, 'true')
  assert.match(fractionalValidation.help, /Questions must use increments of 1\./)
  report.checks.push({ id: 'stack-exchange', case: 'invalid explicit input', tagsMinLength: 1, limitStep: 1, blankTagsProviderRequests: 0, fractionalPageSizeProviderRequests: 0, sharedValidation: 'fail-closed' })

  await setControl(b, 'limit', '8')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(run.data && typeof run.data === 'object' && !Array.isArray(run.data), 'live Stack Exchange response must be a common wrapper object')
  assert(Array.isArray(run.data.items), 'live Stack Exchange wrapper must expose items[]')
  assert(run.data.items.length > 0, 'default JavaScript request must return at least one question')
  assert(run.data.items.length <= 8, 'default request must respect pagesize=8')
  assert.equal(typeof run.data.has_more, 'boolean')
  assert(Number.isInteger(run.data.quota_max) && run.data.quota_max >= 0, 'quota_max must be a non-negative integer')
  assert(Number.isInteger(run.data.quota_remaining) && run.data.quota_remaining >= 0 && run.data.quota_remaining <= run.data.quota_max, 'quota_remaining must be within quota_max')
  assert(run.data.items.every(trustedQuestion), 'every live question must preserve Stack Overflow identity, javascript tag binding, and numeric engagement fields')

  const dom = await readDom(b)
  assert.equal(dom.layout, 'community-questions')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.site, 'stackoverflow')
  assert.equal(dom.tags, 'javascript')
  assert.equal(dom.sort, 'activity')
  assert.equal(dom.order, 'desc')
  assert.equal(dom.pageSize, 8)
  assert.equal(dom.queryBound, 'true')
  assert.equal(dom.providerResults, run.data.items.length)
  assert.equal(dom.validResults, run.data.items.length)
  assert.equal(dom.invalidResults, 0)
  assert.equal(dom.incompleteResults, 0)
  assert.equal(dom.wrapperContract, 'true')
  assert.equal(dom.tagContract, 'true')
  assert.equal(dom.countContract, 'true')
  assert.equal(dom.quotaRemaining, run.data.quota_remaining)
  assert.equal(dom.quotaMax, run.data.quota_max)
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.text.includes(run.data.items[0].title), true)
  assert.equal(dom.text.includes(run.data.items[0].view_count.toLocaleString('en')), true)
  assert.equal(dom.overflow, false)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id: 'stack-exchange', case: 'live request-bound tagged questions', state: dom.state, tags: dom.tags, returnedResults: dom.providerResults, quotaRemaining: dom.quotaRemaining, quotaMax: dom.quotaMax, backoffSeconds: dom.backoff, corsBrowserExecution: true, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const contradictory = { ...goodQuestion, question_id: 999999, link: 'https://stackoverflow.com/questions/999999/unrelated', title: 'Fabricated unrelated question', tags: ['typescript'], view_count: 999999999 }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrapper([goodQuestion, contradictory]) }]]) })
  try {
    await mixed.nav('stack-exchange')
    const result = await mixed.run()
    assert.equal(result.ok, true, result.error)
    const domMixed = await readDom(mixed)
    assert.equal(domMixed.state, 'partial')
    assert.equal(domMixed.providerResults, 2)
    assert.equal(domMixed.validResults, 1)
    assert.equal(domMixed.invalidResults, 1)
    assert.equal(domMixed.text.includes('Fabricated unrelated question'), false)
    assert.equal(domMixed.text.includes('999,999,999'), false)
    assert.equal(mixed.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(mixed.errors, [])
    report.checks.push({ id: 'stack-exchange', case: 'tag-contradictory question HTTP-200', state: 'partial', providerResults: 2, trustedResults: 1, fabricatedFactsHidden: true })
  } finally { await mixed.close() }

  const malformedCounters = { ...goodQuestion, question_id: 234567, link: 'https://stackoverflow.com/questions/234567/malformed-counters', view_count: '0', answer_count: -1, score: '0' }
  const partial = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrapper([malformedCounters], { backoff: 60 }) }]]) })
  try {
    await partial.nav('stack-exchange')
    const result = await partial.run()
    assert.equal(result.ok, true, result.error)
    const domPartial = await readDom(partial)
    assert.equal(domPartial.state, 'partial')
    assert.equal(domPartial.validResults, 1)
    assert.equal(domPartial.incompleteResults, 1)
    assert.equal(domPartial.backoff, 60)
    assert.equal(domPartial.text.includes('wait 60 seconds'), true)
    assert.equal(domPartial.text.includes('Unavailable'), true)
    assert.deepEqual(partial.errors, [])
    report.checks.push({ id: 'stack-exchange', case: 'malformed counters with provider backoff HTTP-200', state: 'partial', malformedCountersWithheld: true, backoffSurfaced: true })
  } finally { await partial.close() }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/stack-exchange-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/stack-exchange-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
