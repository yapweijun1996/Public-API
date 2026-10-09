import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://registry.npmjs.org/-/v1/search?text=react&size=8'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'SSOT integer-size validation, one live npm registry package search, plus deterministic malformed HTTP-200 fixtures',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(()=>{const s=document.querySelector('.demo-preview'),c=s?.querySelector('[data-domain-card="npm-package-search"]');return {layout:s?.dataset.previewLayout||'',fallback:s?.dataset.ssotFallback||'',state:c?.dataset.resultState||'',query:c?.dataset.searchQuery||'',size:Number(c?.dataset.requestSize||0),from:c?.dataset.requestFrom===''||c?.dataset.requestFrom===undefined?null:Number(c.dataset.requestFrom),queryBound:c?.dataset.queryBound||'',providerTotal:c?.dataset.providerTotal===''||c?.dataset.providerTotal===undefined?null:Number(c.dataset.providerTotal),providerResults:Number(c?.dataset.providerResultCount||0),validResults:Number(c?.dataset.validResultCount||0),invalidResults:Number(c?.dataset.invalidResultCount||0),incompleteResults:Number(c?.dataset.incompleteResultCount||0),countContract:c?.dataset.countContract||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',text:c?.innerText||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`)

const liveRowIsTrustworthy = (row) => row && typeof row === 'object'
  && row.package && typeof row.package === 'object'
  && typeof row.package.name === 'string' && row.package.name.trim()
  && typeof row.package.version === 'string' && row.package.version.trim()

const goodResult = {
  downloads: { monthly: 120000000, weekly: 30000000 },
  dependents: 100000,
  updated: '2026-09-10T12:00:00.000Z',
  searchScore: 1234.5,
  package: {
    name: 'react', version: '19.1.1', description: 'React package', sanitized_name: 'react',
    publisher: { username: 'npm-publisher' }, maintainers: [{ username: 'npm-maintainer' }],
    license: 'MIT', date: '2026-09-10T12:00:00.000Z', keywords: ['react', 'ui'],
    links: { npm: 'https://www.npmjs.com/package/react' },
  },
  score: { final: 1234.5, detail: { popularity: 1, quality: 1, maintenance: 1 } },
  flags: { insecure: 0 },
}

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('npm-search')
  const sizeContract = await b.ev(`(() => {
    const input = document.querySelector('#parameter-limit')
    return { step: input?.getAttribute('step') || '', min: input?.getAttribute('min') || '', max: input?.getAttribute('max') || '' }
  })()`)
  assert.deepEqual(sizeContract, { step: '1', min: '1', max: '20' })
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
  assert.equal(b.requestCount, beforeFractional, 'Fractional npm search size reached a provider request')
  await b.ev(`(() => {
    const input = document.querySelector('#parameter-limit')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '8')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await sleep(100)
  report.checks.push({ id: 'npm-search', case: 'SSOT integer size validation', step: 1, min: 1, max: 20, fractionalSizeRejected: true, providerRequests: 0 })
  const run = await b.run()
  assert.equal(run.ok, true, run.error)
  assert(run.data && typeof run.data === 'object' && !Array.isArray(run.data), 'live npm response must be an object')
  assert(Array.isArray(run.data.objects), 'live npm response must expose objects[]')
  assert(run.data.objects.length > 0, 'default react search must return at least one package')
  assert(run.data.objects.length <= 8, 'default search must respect size=8')
  assert(Number.isInteger(run.data.total) && run.data.total >= run.data.objects.length, 'live npm total must cover returned objects')
  assert(run.data.objects.every(liveRowIsTrustworthy), 'every live result must have provider package name/version identity')

  const dom = await readDom(b)
  assert.equal(dom.layout, 'npm-package-search')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.query, 'react')
  assert.equal(dom.size, 8)
  assert.equal(dom.from, null)
  assert.equal(dom.queryBound, 'true')
  assert.equal(dom.providerTotal, run.data.total)
  assert.equal(dom.providerResults, run.data.objects.length)
  assert.equal(dom.validResults, run.data.objects.length)
  assert.equal(dom.invalidResults, 0)
  assert.equal(dom.incompleteResults, 0)
  assert.equal(dom.countContract, 'true')
  assert.equal(dom.endpoint, endpoint)
  assert.equal(dom.text.includes(run.data.objects[0].package.name), true)
  assert.equal(dom.text.includes(run.data.objects[0].package.version), true)
  assert.equal(dom.overflow, false)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({doc:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.doc || mobile.preview, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id: 'npm-search', case: 'live request-bound registry search', state: dom.state, query: dom.query, providerTotal: dom.providerTotal, returnedResults: dom.providerResults, firstPackage: run.data.objects[0].package.name, corsBrowserExecution: true, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close()
  b = undefined

  const badResult = {
    ...goodResult,
    package: { version: '999.0.0', description: 'Fabricated package without provider name.' },
  }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: { objects: [goodResult, badResult], total: 2, time: '2026-09-12T11:30:00.000Z' } }]]) })
  try {
    await mixed.nav('npm-search')
    const result = await mixed.run()
    assert.equal(result.ok, true, result.error)
    const domMixed = await readDom(mixed)
    assert.equal(domMixed.state, 'partial')
    assert.equal(domMixed.providerResults, 2)
    assert.equal(domMixed.validResults, 1)
    assert.equal(domMixed.invalidResults, 1)
    assert.equal(domMixed.text.includes('React package'), true)
    assert.equal(domMixed.text.includes('999.0.0'), false)
    assert.equal(mixed.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
    assert.deepEqual(mixed.errors, [])
    report.checks.push({ id: 'npm-search', case: 'mixed malformed package HTTP-200', state: 'partial', providerResults: 2, trustedResults: 1, malformedFactsHidden: true })
  } finally { await mixed.close() }

  const invalidEnvelope = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: { objects: {}, total: 1, time: '2026-09-12T11:30:00.000Z' } }]]) })
  try {
    await invalidEnvelope.nav('npm-search')
    const result = await invalidEnvelope.run()
    assert.equal(result.ok, true, result.error)
    const domInvalid = await readDom(invalidEnvelope)
    assert.equal(domInvalid.state, 'invalid')
    assert.equal(domInvalid.text.includes('Invalid npm search response'), true)
    assert.deepEqual(invalidEnvelope.errors, [])
    report.checks.push({ id: 'npm-search', case: 'malformed search envelope HTTP-200', state: 'invalid', fabricatedFactsHidden: true })
  } finally { await invalidEnvelope.close() }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/npm-search-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/npm-search-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
