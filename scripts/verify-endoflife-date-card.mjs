import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://endoflife.date/api/v1/products/nodejs'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live endoflife.date v1 product response plus exact synthetic HTTP-200 mismatch/malformed fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())

async function semanticSnapshot(b) {
  return b.ev(`(() => {
    const card=document.querySelector('[data-domain-card="release-lifecycle"]')
    const first=card?.querySelector('[data-release]')
    return {
      state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', requestedProduct:card?.dataset.requestedProduct||'',
      providerProduct:card?.dataset.providerProduct||'', identityMatch:card?.dataset.identityMatch||'', contractValid:card?.dataset.contractValid||'',
      providerRecords:card?.dataset.providerRecords||'', validRecords:card?.dataset.validRecords||'', invalidRecords:card?.dataset.invalidRecords||'',
      firstRelease:first?.dataset.release||'', firstText:first?.textContent||'', cardText:card?.textContent||'',
      documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      previewOverflow:document.querySelector('.demo-preview')?.scrollWidth>document.querySelector('.demo-preview')?.clientWidth+1,
      cardOverflow:card ? card.scrollWidth>card.clientWidth+1 : false,
    }
  })()`)
}

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('endoflife-date')
  const displayedEndpoint = await b.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(displayedEndpoint, endpoint)
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.result?.name, 'nodejs')
  assert(Array.isArray(result.data?.result?.releases))
  assert(result.data.result.releases.length > 0)
  const firstProviderRelease = result.data.result.releases[0]
  assert.equal(typeof firstProviderRelease?.name, 'string')

  let dom = await semanticSnapshot(b)
  assert.equal(dom.state, 'ready')
  assert.equal(dom.requestBound, 'true')
  assert.equal(dom.requestContract, 'exact-endoflife-date-product-v2')
  assert.equal(dom.requestedProduct, 'nodejs')
  assert.equal(dom.providerProduct, result.data.result.name)
  assert.equal(dom.identityMatch, 'true')
  assert.equal(dom.contractValid, 'true')
  assert.equal(Number(dom.providerRecords), result.data.result.releases.length)
  assert.equal(Number(dom.validRecords), result.data.result.releases.length)
  assert.equal(dom.invalidRecords, '0')
  assert.equal(dom.firstRelease, firstProviderRelease.name)
  assert(dom.firstText.includes(firstProviderRelease.name), `First provider release ${firstProviderRelease.name} was not preserved in the semantic card`)

  await b.viewport(390, 844)
  dom = await semanticSnapshot(b)
  assert.equal(dom.documentOverflow || dom.previewOverflow || dom.cardOverflow, false, JSON.stringify(dom))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(b.errors, [])
  report.checks.push({ id: 'endoflife-date', case: 'live exact executed-request-bound product lifecycle', product: result.data.result.name, releases: result.data.result.releases.length, semanticState: dom.state, requestContract: dom.requestContract, identityMatch: true, mobileOverflow: false, unnamedControls: 0 })
  await b.close(); b = undefined

  const wrongPayload = {
    schema_version: '1.2.1',
    result: { name: 'python', label: 'Python', releases: [{ name: '3.14', isEol: false, isMaintained: true, isLts: false, releaseDate: '2025-10-07', eolFrom: '2030-10-01', latest: { name: '3.14.0' } }] },
  }
  const wrong = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrongPayload }]]) })
  try {
    await wrong.nav('endoflife-date')
    const result = await wrong.run()
    assert.equal(result.ok, true, result.error)
    const dom = await semanticSnapshot(wrong)
    assert.equal(dom.state, 'invalid')
    assert.equal(dom.requestBound, 'true')
    assert.equal(dom.requestedProduct, 'nodejs')
    assert.equal(dom.providerProduct, 'python')
    assert.equal(dom.identityMatch, 'false')
    assert.equal(dom.contractValid, 'false')
    assert.match(dom.cardText, /Lifecycle response identity mismatch/)
    assert.doesNotMatch(dom.cardText, /Python 3\.14/)
    assert.equal(wrong.fixtureRequests.filter((item) => item.url === endpoint && item.method === 'GET').length, 1)
    report.checks.push({ id: 'endoflife-date', case: 'synthetic wrong-product HTTP-200', transportStatus: 200, semanticState: dom.state, identityMatch: false, plausibleReleaseHidden: true, exactProviderFixtureRequests: 1 })
  } finally {
    await wrong.close()
  }

  const malformedPayload = { result: { name: 'nodejs', label: 'Node.js', releases: { name: '26' } } }
  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: malformedPayload }]]) })
  try {
    await malformed.nav('endoflife-date')
    const result = await malformed.run()
    assert.equal(result.ok, true, result.error)
    const dom = await semanticSnapshot(malformed)
    assert.equal(dom.state, 'invalid')
    assert.equal(dom.providerProduct, 'nodejs')
    assert.equal(dom.identityMatch, 'true')
    assert.equal(dom.contractValid, 'false')
    assert.match(dom.cardText, /Invalid lifecycle response/)
    assert.match(dom.cardText, /documented product releases array/)
    report.checks.push({ id: 'endoflife-date', case: 'synthetic malformed releases HTTP-200', transportStatus: 200, semanticState: dom.state, malformedEnvelopeHidden: true })
  } finally {
    await malformed.close()
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/endoflife-date-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/endoflife-date-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
