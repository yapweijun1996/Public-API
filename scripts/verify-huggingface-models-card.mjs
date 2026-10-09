import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live Hugging Face Hub model API from the Pages origin',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setControl = async (b, name, value) => {
  await b.ev(`(() => {
    const element = document.querySelector('[name=${JSON.stringify(name)}]')
    if (!element) throw new Error('Missing control ' + ${JSON.stringify(name)})
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)})
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })()`)
  await sleep(80)
}
const tags = (model) => Array.isArray(model?.tags) ? model.tags.filter((tag) => typeof tag === 'string') : []
const license = (model) => tags(model).find((tag) => tag.startsWith('license:'))?.slice('license:'.length) || 'Not declared'
const access = (model) => model?.private === true ? 'Private' : model?.gated === true ? 'Gated' : typeof model?.gated === 'string' && model.gated.trim() ? `Gated · ${model.gated}` : 'Public'

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('models-dev')
  await setControl(b, 'query', 'gpt')
  await setControl(b, 'count', '3')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data), 'Hugging Face model search did not return an array')
  assert.equal(result.data.length, 3, `Expected exactly 3 provider models, got ${result.data.length}`)
  const first = result.data[0] || {}
  assert(first.id || first.modelId, 'First Hugging Face model has no stable model ID')
  assert(result.data.every((model) => String(model.id || model.modelId || '').toLowerCase().includes('gpt')), 'Provider returned a model ID that does not acknowledge search=gpt')
  assert(Object.hasOwn(first, 'gated'), 'full model metadata did not include gated state')
  assert(first.lastModified, 'full model metadata did not include lastModified')

  const expectedId = String(first.id || first.modelId)
  const expectedLicense = license(first)
  const expectedAccess = access(first)
  const dom = await b.ev(`(() => {
    const shell = document.querySelector('.demo-preview')
    const card = shell.querySelector('.huggingface-models-preview')
    const firstRecord = card.querySelector('.semantic-card-grid article[data-record-index="1"]')
    const facts = Object.fromEntries([...firstRecord.querySelectorAll('dl > div')].map((item) => [item.querySelector('dt')?.textContent || '', item.querySelector('dd')?.textContent || '']))
    return {
      layout: shell.dataset.previewLayout,
      fallback: shell.dataset.ssotFallback,
      domain: card.dataset.domainCard,
      state: card.dataset.resultState,
      requestBound: card.dataset.requestBound,
      requestContract: card.dataset.requestContract,
      requestedQuery: card.dataset.requestedQuery,
      requestedLimit: Number(card.dataset.requestedLimit),
      queryMismatchCount: Number(card.dataset.queryMismatchCount),
      malformedPopularityCount: Number(card.dataset.malformedPopularityCount),
      responseExceedsLimit: card.dataset.responseExceedsLimit,
      rowCount: Number(card.dataset.rowCount),
      visibleCount: Number(card.dataset.visibleCount),
      primaryModelId: card.dataset.primaryModelId,
      primaryAccess: card.dataset.primaryAccess,
      primaryLicense: card.dataset.primaryLicense,
      heading: firstRecord.querySelector('h3')?.innerText || '',
      badge: firstRecord.querySelector('header em')?.innerText || '',
      facts,
      generic: (shell.innerText || '').includes('Hugging Face Model Search record 1'),
    }
  })()`)

  assert.equal(dom.layout, 'ai-model-catalog')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.domain, 'ai-model-catalog')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-huggingface-model-search-v2')
  assert.equal(dom.requestedQuery, 'gpt')
  assert.equal(dom.requestedLimit, 3)
  assert.equal(dom.queryMismatchCount, 0)
  assert.equal(dom.malformedPopularityCount, 0)
  assert.equal(dom.responseExceedsLimit, 'false')
  assert.equal(dom.rowCount, result.data.length)
  assert.equal(dom.visibleCount, Math.min(result.data.length, 8))
  assert.equal(dom.primaryModelId, expectedId)
  assert.equal(dom.primaryAccess, expectedAccess)
  assert.equal(dom.primaryLicense, expectedLicense)
  assert.equal(dom.heading, expectedId)
  assert.equal(dom.badge, expectedAccess)
  assert.equal(dom.facts.Task, String(first.pipeline_tag || 'Not declared'))
  assert.equal(dom.facts.Library, String(first.library_name || 'Not declared'))
  assert.equal(dom.facts.Access, expectedAccess)
  assert.equal(dom.facts['License tag'], expectedLicense)
  assert.equal(dom.facts.Downloads, Number(first.downloads).toLocaleString('en'))
  assert.equal(dom.facts.Likes, Number(first.likes).toLocaleString('en'))
  assert.equal(dom.facts['Last modified'], String(first.lastModified).slice(0, 10))
  assert.equal(dom.generic, false)

  await b.viewport(390, 844)
  const overflow = await b.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
  })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)

  report.checks.push({
    id: 'models-dev', source: 'live provider', requestedSearch: 'gpt', requestedCount: 3,
    returnedModels: result.data.length, modelIdentity: 'exact response match', access: expectedAccess,
    licenseTag: expectedLicense, task: first.pipeline_tag, library: first.library_name,
    mobileOverflow: false, unnamedControls: 0,
  })

  const syntheticUrl = 'https://huggingface.co/api/models?search=gpt&limit=2&full=true'
  const syntheticBody = [
    { id: 'openai-community/gpt2', gated: false, private: false, tags: ['license:mit'], downloads: '1', likes: '1' },
    { id: 'google/bert-base-uncased', gated: false, private: false, downloads: 42, likes: 2 },
  ]
  const synthetic = await browser(`${root}/dist`, { fixtures: new Map([[syntheticUrl, { body: syntheticBody }]]) })
  try {
    await synthetic.nav('models-dev')
    await setControl(synthetic, 'query', 'gpt')
    await setControl(synthetic, 'count', '2')
    const syntheticResult = await synthetic.run()
    assert.equal(syntheticResult.ok, true, syntheticResult.error)
    const semantic = await synthetic.ev(`(() => {
      const shell = document.querySelector('.demo-preview')
      const card = shell.querySelector('.huggingface-models-preview')
      const firstRecord = card.querySelector('.semantic-card-grid article[data-record-index="1"]')
      const facts = Object.fromEntries([...firstRecord.querySelectorAll('dl > div')].map((item) => [item.querySelector('dt')?.textContent || '', item.querySelector('dd')?.textContent || '']))
      return {
        state: card?.dataset.resultState,
        providerCount: Number(card?.dataset.providerRecordCount),
        validCount: Number(card?.dataset.validRecordCount),
        invalidCount: Number(card?.dataset.invalidRecordCount),
        requestBound: card?.dataset.requestBound,
        requestedQuery: card?.dataset.requestedQuery,
        queryMismatchCount: Number(card?.dataset.queryMismatchCount),
        malformedPopularityCount: Number(card?.dataset.malformedPopularityCount),
        primaryModelId: card?.dataset.primaryModelId,
        facts,
        text: card?.innerText || '',
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      }
    })()`)
    assert.deepEqual({ state: semantic.state, providerCount: semantic.providerCount, validCount: semantic.validCount, invalidCount: semantic.invalidCount, requestBound: semantic.requestBound, requestedQuery: semantic.requestedQuery, queryMismatchCount: semantic.queryMismatchCount, malformedPopularityCount: semantic.malformedPopularityCount, primaryModelId: semantic.primaryModelId }, { state: 'partial', providerCount: 2, validCount: 1, invalidCount: 1, requestBound: 'true', requestedQuery: 'gpt', queryMismatchCount: 1, malformedPopularityCount: 2, primaryModelId: 'openai-community/gpt2' })
    assert.equal(semantic.text.includes('google/bert-base-uncased'), false)
    assert.equal(semantic.text.includes('Only exact-request-bound model identities and strict provider-number evidence are trusted.'), true)
    assert.equal(semantic.facts.Downloads, 'Not supplied')
    assert.equal(semantic.facts.Likes, 'Not supplied')
    assert.equal(semantic.overflow, false)
    assert.deepEqual(synthetic.fixtureRequests.map((entry) => ({ url: entry.url, source: entry.source, status: entry.status })), [{ url: syntheticUrl, source: 'synthetic-fixture', status: 200 }])
    await synthetic.viewport(390, 844)
    assert.equal(await synthetic.ev(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 1`), false)
    assert.equal(unnamed((await synthetic.call('Accessibility.getFullAXTree')).nodes).length, 0)
    report.checks.push({ id: 'models-dev', case: 'wrong-query + numeric-string HTTP-200 model list', source: 'synthetic fixture', semanticState: 'partial', providerRecords: 2, validRecords: 1, invalidRecords: 1, queryMismatches: 1, malformedPopularity: 2, fabricatedIdentity: false, mobileOverflow: false, unnamedControls: 0 })
    report.errors.push(...synthetic.errors.map(String))
  } finally {
    await synthetic.close()
  }

  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/huggingface-models-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/huggingface-models-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
