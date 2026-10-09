import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.github.com/users/octocat/repos?type=owner&sort=full_name&direction=asc&per_page=8'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live GitHub public-repository request plus deterministic HTTP-200 fixtures',
  checks: [], errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="github-repositories"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',owner:c?.dataset.requestOwner||'',perPage:Number(c?.dataset.requestPerPage||0),requestBound:c?.dataset.requestBound||'',providerResults:Number(c?.dataset.providerResultCount||0),validResults:Number(c?.dataset.validResultCount||0),invalidResults:Number(c?.dataset.invalidResultCount||0),incompleteResults:Number(c?.dataset.incompleteResultCount||0),ownerContract:c?.dataset.ownerContract||'',countContract:c?.dataset.countContract||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

const trustworthy = (repo) => repo && typeof repo === 'object'
  && Number.isInteger(repo.id) && repo.id > 0
  && typeof repo.name === 'string' && repo.name
  && repo.full_name === `octocat/${repo.name}`
  && repo.owner?.login?.toLowerCase() === 'octocat'
  && repo.private === false
  && repo.visibility === 'public'
  && repo.html_url === `https://github.com/${repo.full_name}`
  && typeof repo.fork === 'boolean'
  && typeof repo.archived === 'boolean'
  && typeof repo.disabled === 'boolean'
  && Number.isInteger(repo.stargazers_count) && repo.stargazers_count >= 0
  && Number.isInteger(repo.forks_count) && repo.forks_count >= 0
  && Number.isInteger(repo.open_issues_count) && repo.open_issues_count >= 0

const good = {
  id: 1296269, name: 'Hello-World', full_name: 'octocat/Hello-World', owner: { login: 'octocat' }, private: false,
  html_url: 'https://github.com/octocat/Hello-World', description: 'Example repository', fork: false, language: 'JavaScript',
  forks_count: 9, stargazers_count: 80, open_issues_count: 2, topics: ['octocat','api'], archived: false, disabled: false,
  visibility: 'public', default_branch: 'master', pushed_at: '2026-09-10T12:00:00Z', updated_at: '2026-09-11T12:00:00Z',
}

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('github')
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(Array.isArray(run.data), 'live GitHub repository response must be an array')
  assert(run.data.length > 0 && run.data.length <= 8, 'live GitHub response must respect per_page=8')
  assert(run.data.every(trustworthy), 'every live GitHub row must preserve Octocat public repository identity and typed status/metrics')
  const dom = await readDom(b)
  assert.equal(dom.layout, 'repository-list')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.owner, 'octocat')
  assert.equal(dom.perPage, 8)
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.providerResults, run.data.length)
  assert.equal(dom.validResults, run.data.length)
  assert.equal(dom.invalidResults, 0)
  assert.equal(dom.incompleteResults, 0)
  assert.equal(dom.ownerContract, 'true')
  assert.equal(dom.countContract, 'true')
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.text.includes(run.data[0].full_name), true)
  assert.equal(dom.text.includes(run.data[0].stargazers_count.toLocaleString('en')), true)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'github', case:'live versioned Octocat public repository list', state:dom.state, returnedResults:dom.providerResults, firstRepository:run.data[0].full_name, firstStars:run.data[0].stargazers_count, mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const bad = { ...good, id: 999, name:'Fabricated', full_name:'other/Fabricated', owner:{ login:'other' }, html_url:'https://github.com/other/Fabricated', stargazers_count:999999 }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: [good, bad], allowHeaders: 'Accept, Content-Type, X-GitHub-Api-Version' }]]) })
  try {
    await mixed.nav('github'); const result=await mixed.run(); assert.equal(result.ok,true,result.error)
    const d=await readDom(mixed); assert.equal(d.state,'partial'); assert.equal(d.validResults,1); assert.equal(d.invalidResults,1)
    assert.equal(d.text.includes('other/Fabricated'),false); assert.equal(d.text.includes('999,999'),false)
    assert.equal(mixed.fixtureRequests.filter((r)=>r.url===endpoint && r.method==='GET').length,1); assert.deepEqual(mixed.errors,[])
    report.checks.push({ id:'github', case:'wrong-owner HTTP-200 row', state:'partial', providerResults:2, trustedResults:1, fabricatedFactsHidden:true })
  } finally { await mixed.close() }

  const malformed = { ...good, archived: undefined, stargazers_count:'0', forks_count:-1, open_issues_count:'2' }
  const partial = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: [malformed], allowHeaders: 'Accept, Content-Type, X-GitHub-Api-Version' }]]) })
  try {
    await partial.nav('github'); const result=await partial.run(); assert.equal(result.ok,true,result.error)
    const d=await readDom(partial); assert.equal(d.state,'partial'); assert.equal(d.incompleteResults,1)
    assert.equal(d.text.includes('Archive state unavailable'),true); assert.equal(d.text.includes('Active'),false); assert.equal(d.text.includes('Unavailable'),true)
    assert.deepEqual(partial.errors,[])
    report.checks.push({ id:'github', case:'missing archive state and malformed counters HTTP-200', state:'partial', fabricatedActiveHidden:true, malformedCountersWithheld:true })
  } finally { await partial.close() }
  report.verdict='PASS'
} catch (error) {
  report.verdict='FAIL'; report.error=String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/github-repositories-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/github-repositories-card.json` },null,2))
process.exit(report.verdict==='PASS'?0:1)
