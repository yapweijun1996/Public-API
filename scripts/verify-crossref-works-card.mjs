import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const query = 'agentic AI'
const rows = 8
const endpoint = `https://api.crossref.org/v1/works?${new URLSearchParams({
  query,
  rows: String(rows),
  select: 'DOI,title,author,published,publisher,is-referenced-by-count,type,URL',
}).toString()}`
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'native exact-input validation, one live Crossref v1 works search, plus exact synthetic HTTP-200 semantic fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const doiIdentity = (work) => typeof work?.DOI === 'string' && typeof work?.URL === 'string'
  && work.URL.toLowerCase() === `https://doi.org/${work.DOI}`.toLowerCase()

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('crossref-works')
  const fieldContract = await b.ev(`(() => {
    const query = document.querySelector('#parameter-query')
    const rows = document.querySelector('#parameter-rows')
    return {
      queryMinLength: query?.getAttribute('minlength') || '',
      rowsMin: rows?.getAttribute('min') || '', rowsMax: rows?.getAttribute('max') || '', rowsStep: rows?.getAttribute('step') || '',
    }
  })()`)
  assert.deepEqual(fieldContract, { queryMinLength: '1', rowsMin: '1', rowsMax: '20', rowsStep: '1' })
  const beforeInvalidInput = b.requestCount
  await b.ev(`(() => {
    const input = document.querySelector('#parameter-query')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '   ')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await b.ev(`document.querySelector('form.parameter-card').requestSubmit()`)
  await sleep(150)
  assert.equal(b.requestCount, beforeInvalidInput, 'Blank Crossref research query reached a provider request')
  const blankQueryError = await b.ev(`(() => { const input = document.querySelector('#parameter-query'); const help = document.querySelector('#parameter-query-help'); return { invalid: input?.getAttribute('aria-invalid') || '', text: help?.textContent || '' } })()`)
  assert.equal(blankQueryError.invalid, 'true')
  assert.match(blankQueryError.text, /required/i)
  await b.ev(`(() => {
    const query = document.querySelector('#parameter-query')
    const rows = document.querySelector('#parameter-rows')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(query, 'agentic AI')
    query.dispatchEvent(new Event('input', { bubbles: true }))
    query.dispatchEvent(new Event('change', { bubbles: true }))
    setter.call(rows, '8.5')
    rows.dispatchEvent(new Event('input', { bubbles: true }))
    rows.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  const fractionalRows = await b.ev(`(() => { const input = document.querySelector('#parameter-rows'); return { valid: input.checkValidity(), stepMismatch: input.validity.stepMismatch } })()`)
  assert.deepEqual(fractionalRows, { valid: false, stepMismatch: true })
  await b.ev(`document.querySelector('form.parameter-card').requestSubmit()`)
  await sleep(150)
  assert.equal(b.requestCount, beforeInvalidInput, 'Fractional Crossref result count reached a provider request')
  await b.ev(`(() => {
    const rows = document.querySelector('#parameter-rows')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(rows, '8')
    rows.dispatchEvent(new Event('input', { bubbles: true }))
    rows.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await sleep(100)
  report.checks.push({ id: 'crossref-works', case: 'native exact-input contract', queryMinLength: 1, rowsMin: 1, rowsMax: 20, rowsStep: 1, blankQueryRejected: true, fractionalRowsRejected: true, providerRequests: 0 })
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  const displayedEndpoint = await b.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(displayedEndpoint, endpoint)
  assert.equal(result.data?.status, 'ok')
  assert.equal(result.data?.['message-type'], 'work-list')
  assert.equal(typeof result.data?.['message-version'], 'string')
  const message = result.data?.message
  assert(Array.isArray(message?.items), 'Crossref live response missing message.items[]')
  assert.equal(message['items-per-page'], rows)
  assert.equal(message.query?.['start-index'], 0)
  assert.equal(message.query?.['search-terms'], query)
  assert.equal(message.items.length, Math.min(rows, message['total-results']))
  assert(message.items.length > 0, 'Crossref default search unexpectedly empty')
  assert(message.items.every(doiIdentity), 'Crossref live rows did not preserve coherent DOI/URL identity')
  const first = message.items[0]
  const title = first.title?.[0]
  assert.equal(typeof title, 'string')
  assert.equal(Number.isSafeInteger(first['is-referenced-by-count']) && first['is-referenced-by-count'] >= 0, true)

  const dom = await b.ev(`(() => {
    const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="crossref-works-search"]')
    return {
      layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
      requestBound:card?.dataset.requestBound||'', requestQuery:card?.dataset.requestQuery||'', requestRows:card?.dataset.requestRows||'', providerQuery:card?.dataset.providerSearchTerms||'', providerStart:card?.dataset.providerStartIndex||'',
      providerPerPage:card?.dataset.providerItemsPerPage||'', providerTotal:card?.dataset.providerTotalResults||'', providerCount:card?.dataset.providerItemCount||'',
      validCount:card?.dataset.validItemCount||'', invalidCount:card?.dataset.invalidItemCount||'', incompleteCount:card?.dataset.incompleteItemCount||'',
      queryContract:card?.dataset.queryContract||'', countContract:card?.dataset.countContract||'', primaryDoi:card?.dataset.primaryDoi||'', text:card?.innerText||'',
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
    }
  })()`)
  assert.equal(dom.layout, 'scholarly-search'); assert.equal(dom.fallback, 'false'); assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true'); assert.equal(dom.requestQuery, query); assert.equal(dom.requestRows, String(rows)); assert.equal(dom.providerQuery, query); assert.equal(dom.providerStart, '0')
  assert.equal(dom.providerPerPage, String(rows)); assert.equal(dom.providerTotal, String(message['total-results'])); assert.equal(dom.providerCount, String(message.items.length))
  assert.equal(dom.validCount, String(message.items.length)); assert.equal(dom.invalidCount, '0'); assert.equal(dom.incompleteCount, '0')
  assert.equal(dom.queryContract, 'true'); assert.equal(dom.countContract, 'true'); assert.equal(dom.primaryDoi, first.DOI)
  assert.equal(dom.text.includes(title), true); assert.equal(dom.text.includes(first.DOI), true); assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id: 'crossref-works', case: 'live versioned first-page search', semanticState: 'ready', requestBound: true, returnedItems: message.items.length, totalResults: message['total-results'], queryAcknowledged: true, countCoherent: true, mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const base = {
    status: result.data.status,
    'message-type': result.data['message-type'],
    'message-version': result.data['message-version'],
  }
  const cases = [
    {
      name: 'synthetic wrong-query acknowledgement HTTP-200',
      body: { ...base, message: { ...message, query: { ...message.query, 'search-terms': 'unrelated query' } } },
      expectedState: 'invalid', expectedQuery: 'false', expectedCount: 'true', hidden: title,
    },
    {
      name: 'synthetic truncated first page HTTP-200',
      body: { ...base, message: { ...message, items: [first] } },
      expectedState: 'partial', expectedQuery: 'true', expectedCount: 'false', hidden: '',
    },
    {
      name: 'synthetic mixed identity and numeric-string citation HTTP-200',
      body: { ...base, message: { ...message, 'total-results': 2, items: [{ ...first, 'is-referenced-by-count': '12' }, { ...message.items[1], DOI: undefined, URL: undefined, title: ['Fabricated scholarly work'] }] } },
      expectedState: 'partial', expectedQuery: 'true', expectedCount: 'true', hidden: 'Fabricated scholarly work', expectedInvalid: '1', expectedIncomplete: '1',
      hidesCoercedCitation: true,
    },
  ]

  for (const testCase of cases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: testCase.body }]]) })
    try {
      await fixtureBrowser.nav('crossref-works')
      const run = await fixtureBrowser.run()
      assert.equal(run.ok, true, run.error)
      const semantic = await fixtureBrowser.ev(`(() => { const c=document.querySelector('[data-domain-card="crossref-works-search"]'); return {state:c?.dataset.resultState||'',requestBound:c?.dataset.requestBound||'',query:c?.dataset.queryContract||'',count:c?.dataset.countContract||'',invalid:c?.dataset.invalidItemCount||'',incomplete:c?.dataset.incompleteItemCount||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''} })()`)
      assert.equal(semantic.state, testCase.expectedState)
      assert.equal(semantic.requestBound, 'true')
      assert.equal(semantic.query, testCase.expectedQuery)
      assert.equal(semantic.count, testCase.expectedCount)
      if (testCase.expectedInvalid) assert.equal(semantic.invalid, testCase.expectedInvalid)
      if (testCase.expectedIncomplete) assert.equal(semantic.incomplete, testCase.expectedIncomplete)
      if (testCase.hidden) assert.equal(semantic.text.includes(testCase.hidden), false)
      if (testCase.hidesCoercedCitation) assert.equal(semantic.text.includes('12 citations'), false)
      assert.match(semantic.http, /^200/)
      assert.equal(fixtureBrowser.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1)
      assert.deepEqual(fixtureBrowser.errors, [])
      report.checks.push({ id: 'crossref-works', case: testCase.name, transportStatus: 200, semanticState: testCase.expectedState, queryContract: testCase.expectedQuery === 'true', countContract: testCase.expectedCount === 'true', exactProviderFixtureRequests: 1 })
    } finally {
      await fixtureBrowser.close()
    }
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/crossref-works-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/crossref-works-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
