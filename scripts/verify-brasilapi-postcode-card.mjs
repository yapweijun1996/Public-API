import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://brasilapi.com.br/api/cep/v2/01310930'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'one live BrasilAPI CEP v2 lookup plus a synthetic wrong-CEP HTTP-200 response',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const readDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview'),card=shell?.querySelector('[data-domain-card="brasilapi-postcode"]')
  return {
    layout:shell?.dataset.previewLayout||'',fallback:shell?.dataset.ssotFallback||'',state:card?.dataset.resultState||'',requestBound:card?.dataset.requestBound||'',requestContract:card?.dataset.requestContract||'',requestedPostcode:card?.dataset.requestedPostcode||'',providerPostcode:card?.dataset.providerPostcode||'',postcodeMatch:card?.dataset.postcodeMatch||'',coordinateEvidence:card?.dataset.coordinateEvidence||'',allText:card?.innerText||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  }
})()`)

const verifyMobileAx = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({document:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,preview:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(overflow.document || overflow.preview, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
}

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('brasilapi-postcode')
  const before = b.requestCount
  const result = await b.run()
  const providerFetches = b.requestCount - before
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.cep, '01310930')
  assert.equal(result.data?.city, 'São Paulo')
  assert.equal(typeof result.data?.service, 'string')
  const dom = await readDom(b)
  assert.equal(dom.layout, 'location-map')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-brasilapi-cep-v2-bodyless-get')
  assert.equal(dom.requestedPostcode, '01310930')
  assert.equal(dom.providerPostcode, '01310930')
  assert.equal(dom.postcodeMatch, 'true')
  assert.equal(dom.endpoint, endpoint)
  assert.equal(providerFetches, 1)
  assert.equal(dom.overflow, false)
  assert(dom.allText.includes('São Paulo'))
  assert(dom.allText.includes(result.data.street || 'CEP 01310930'))
  await verifyMobileAx(b)
  report.checks.push({ id: 'brasilapi-postcode', case: 'live exact CEP v2 response', semanticState: dom.state, requestBound: true, postcode: result.data.cep, service: result.data.service, coordinateEvidence: dom.coordinateEvidence, providerFetches, providerCors: 'browser-readable', mobileOverflow: false, unnamedControls: 0 })
  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  assert.deepEqual(b.networkFailures, [])
  await b.close()
  b = undefined

  const wrongCep = await browser(`${root}/dist`, {
    fixtures: new Map([[endpoint, { body: {
      cep: '01001000', state: 'SP', city: 'São Paulo', neighborhood: 'Sé', street: 'Praça da Sé', service: 'synthetic-provider', timezoneName: 'America/Sao_Paulo', location: { type: 'Point', coordinates: { latitude: '-23.5505', longitude: '-46.6333' } },
    } }]]),
    blockedProviderPatterns: ['https://brasilapi.com.br/*'],
  })
  try {
    await wrongCep.nav('brasilapi-postcode')
    const fixtureResult = await wrongCep.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await readDom(wrongCep)
    assert.equal(fixtureDom.state, 'invalid')
    assert.equal(fixtureDom.requestBound, 'true')
    assert.equal(fixtureDom.postcodeMatch, 'false')
    assert.equal(fixtureDom.allText.includes('Praça da Sé'), false)
    assert.deepEqual(wrongCep.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: endpoint, source: 'synthetic-fixture', status: 200 }])
    assert.deepEqual(wrongCep.blockedProviders, [])
    assert.deepEqual(wrongCep.errors, [])
    report.checks.push({ id: 'brasilapi-postcode', case: 'synthetic wrong-CEP HTTP-200 response', semanticState: 'invalid', providerFactsHidden: true, liveProviderRequests: 0 })
  } finally {
    await wrongCep.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/brasilapi-postcode-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/brasilapi-postcode-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
