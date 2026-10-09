import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://gitlab.com/api/v4/projects?visibility=public&search=artificial+intelligence&order_by=star_count&sort=desc&per_page=8'
const queryTerms = ['artificial', 'intelligence']
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live GitLab unauthenticated public Projects search plus deterministic malformed HTTP-200 fixtures',
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
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="gitlab-project-search"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',query:c?.dataset.searchQuery||'',limit:Number(c?.dataset.requestLimit||0),queryBound:c?.dataset.queryBound||'',providerResults:Number(c?.dataset.providerResultCount||0),validResults:Number(c?.dataset.validResultCount||0),invalidResults:Number(c?.dataset.invalidResultCount||0),incompleteResults:Number(c?.dataset.incompleteResultCount||0),queryContract:c?.dataset.queryContract||'',countContract:c?.dataset.countContract||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

const searchMatches = (row) => {
  if (!row || typeof row !== 'object') return false
  const searchable = [row.name, row.path, row.path_with_namespace, row.description].filter((value) => typeof value === 'string').join(' ').toLowerCase()
  return queryTerms.every((term) => searchable.includes(term))
}

const projectIsTrustworthy = (row) => row && typeof row === 'object'
  && Number.isInteger(row.id) && row.id > 0
  && typeof row.name === 'string' && row.name.trim()
  && typeof row.path_with_namespace === 'string' && row.path_with_namespace.trim()
  && row.visibility === 'public'
  && typeof row.web_url === 'string' && row.web_url === `https://gitlab.com/${row.path_with_namespace}`
  && Number.isInteger(row.star_count) && row.star_count >= 0
  && Number.isInteger(row.forks_count) && row.forks_count >= 0
  && searchMatches(row)

const goodProject = {
  id: 123,
  name: 'artificial-intelligence-demo',
  path: 'artificial-intelligence-demo',
  path_with_namespace: 'group/artificial-intelligence-demo',
  description: 'Artificial intelligence research project',
  visibility: 'public',
  web_url: 'https://gitlab.com/group/artificial-intelligence-demo',
  star_count: 42,
  forks_count: 7,
  last_activity_at: '2026-09-10T12:00:00.000Z',
  topics: ['artificial intelligence', 'research'],
}

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('gitlab-public-projects')

  const fieldContract = await b.ev(`(() => {
    const query = document.querySelector('[name="query"]')
    const limit = document.querySelector('[name="limit"]')
    return { queryMinLength: query?.minLength, limitMin: limit?.min, limitMax: limit?.max, limitStep: limit?.step }
  })()`)
  assert.deepEqual(fieldContract, { queryMinLength: 1, limitMin: '1', limitMax: '20', limitStep: '1' })

  await setControl(b, 'query', '   ')
  await setControl(b, 'limit', '8')
  const blankBefore = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()`)
  await sleep(180)
  const blankValidation = await b.ev(`(() => { const field=document.querySelector('[name="query"]'); return {state:document.querySelector('.request-lab')?.dataset.requestState,invalid:field?.getAttribute('aria-invalid'),help:document.querySelector('#parameter-query-help')?.textContent||''} })()`)
  assert.equal(b.requestCount - blankBefore, 0, 'Blank GitLab project search must not trigger a provider request')
  assert.equal(blankValidation.state, 'idle')
  assert.equal(blankValidation.invalid, 'true')
  assert.match(blankValidation.help, /Project search is required\./)

  await setControl(b, 'query', 'artificial intelligence')
  await setControl(b, 'limit', '8.5')
  const fractionalBefore = b.requestCount
  await b.ev(`document.querySelector('.parameter-card').requestSubmit()`)
  await sleep(180)
  const fractionalValidation = await b.ev(`(() => { const field=document.querySelector('[name="limit"]'); return {state:document.querySelector('.request-lab')?.dataset.requestState,invalid:field?.getAttribute('aria-invalid'),help:document.querySelector('#parameter-limit-help')?.textContent||''} })()`)
  assert.equal(b.requestCount - fractionalBefore, 0, 'Fractional GitLab result limit must not trigger a provider request')
  assert.equal(fractionalValidation.state, 'idle')
  assert.equal(fractionalValidation.invalid, 'true')
  assert.match(fractionalValidation.help, /Projects must use increments of 1\./)
  report.checks.push({ id: 'gitlab-public-projects', case: 'invalid explicit input', queryMinLength: 1, limitStep: 1, blankQueryProviderRequests: 0, fractionalLimitProviderRequests: 0, sharedValidation: 'fail-closed' })

  await setControl(b, 'limit', '8')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(Array.isArray(run.data), 'live GitLab Projects response must be an array')
  assert(run.data.length > 0, 'default GitLab project search must return at least one project')
  assert(run.data.length <= 8, 'default GitLab project search must respect per_page=8')
  assert(run.data.every(projectIsTrustworthy), 'every live GitLab result must preserve public project identity, numeric counters, and documented search semantics')

  const dom = await readDom(b)
  assert.equal(dom.layout, 'project-search')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.query, 'artificial intelligence')
  assert.equal(dom.limit, 8)
  assert.equal(dom.queryBound, 'true')
  assert.equal(dom.providerResults, run.data.length)
  assert.equal(dom.validResults, run.data.length)
  assert.equal(dom.invalidResults, 0)
  assert.equal(dom.incompleteResults, 0)
  assert.equal(dom.queryContract, 'true')
  assert.equal(dom.countContract, 'true')
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.text.includes(run.data[0].path_with_namespace), true)
  assert.equal(dom.text.includes(`${run.data[0].star_count.toLocaleString('en')} stars`), true)
  assert.equal(dom.overflow, false)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id: 'gitlab-public-projects', case: 'live request-bound public project search', state: dom.state, query: dom.query, returnedResults: dom.providerResults, firstProject: run.data[0].path_with_namespace, firstStars: run.data[0].star_count, corsBrowserExecution: true, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const wrongIdentity = { ...goodProject, path_with_namespace: 'fabricated/project', web_url: 'https://gitlab.com/other/project', star_count: 999999 }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: [goodProject, wrongIdentity] }]]) })
  try {
    await mixed.nav('gitlab-public-projects')
    const result = await mixed.run()
    assert.equal(result.ok, true, result.error)
    const domMixed = await readDom(mixed)
    assert.equal(domMixed.state, 'partial')
    assert.equal(domMixed.providerResults, 2)
    assert.equal(domMixed.validResults, 1)
    assert.equal(domMixed.invalidResults, 1)
    assert.equal(domMixed.text.includes('fabricated/project'), false)
    assert.equal(domMixed.text.includes('999,999'), false)
    assert.equal(mixed.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(mixed.errors, [])
    report.checks.push({ id: 'gitlab-public-projects', case: 'wrong project identity HTTP-200', state: 'partial', providerResults: 2, trustedResults: 1, fabricatedFactsHidden: true })
  } finally { await mixed.close() }

  const malformedMetrics = { ...goodProject, star_count: '0', forks_count: -1 }
  const partial = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: [malformedMetrics] }]]) })
  try {
    await partial.nav('gitlab-public-projects')
    const result = await partial.run()
    assert.equal(result.ok, true, result.error)
    const domPartial = await readDom(partial)
    assert.equal(domPartial.state, 'partial')
    assert.equal(domPartial.validResults, 1)
    assert.equal(domPartial.incompleteResults, 1)
    assert.equal(domPartial.text.includes('Stars unavailable'), true)
    assert.equal(domPartial.text.includes('Unavailable'), true)
    assert.deepEqual(partial.errors, [])
    report.checks.push({ id: 'gitlab-public-projects', case: 'malformed popularity counters HTTP-200', state: 'partial', malformedCountersWithheld: true })
  } finally { await partial.close() }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/gitlab-projects-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/gitlab-projects-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
