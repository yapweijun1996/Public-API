import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live ExchangeRate-API, Coinbase, and VATComply endpoints plus exact synthetic wrong-base and wrong-symbol HTTP-200 fixtures',
  checks: [],
  errors: [],
}
const actionableRoles = new Set(['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'])
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && actionableRoles.has(node.role?.value) && !(node.name?.value || '').trim())

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('exchange-rate-current')
  const endpoint = await b.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert(endpoint, 'ExchangeRate-API endpoint was not exposed')
  const requestUrl = new URL(endpoint)
  assert.equal(requestUrl.origin, 'https://open.er-api.com')
  assert.equal(requestUrl.pathname, '/v6/latest/SGD')
  const policy = await b.ev(`Promise.all([
    Promise.resolve(document.querySelector('.request-lab')?.dataset.verificationRetryOnRateLimit || ''),
    fetch('/Public-API/api-catalog.json', {cache:'no-store'}).then((response) => response.json()).then((catalog) => catalog.apis.find((api) => api.id === 'exchange-rate-current')?.automatedVerification || null)
  ])`)
  assert.equal(policy[0], 'false')
  assert.deepEqual(policy[1], {
    mode: 'enabled',
    retryOnRateLimit: false,
    reason: 'ExchangeRate-API says its open endpoint returns HTTP 429 when rate limited and that the rate limit remains in effect for about 20 minutes. Generic health verification records the first 429 and defers another provider request to a later independent run instead of retrying within that window.',
    policyUrl: 'https://www.exchangerate-api.com/docs/free',
  })

  const live = await b.run()
  assert.equal(live.ok, true, live.error)
  assert.equal(live.data?.result, 'success')
  assert.equal(live.data?.base_code, 'SGD')
  assert.equal(typeof live.data?.rates, 'object')
  assert.equal(Array.isArray(live.data?.rates), false)
  for (const [code, rate] of Object.entries(live.data.rates)) {
    assert.match(code, /^[A-Z]{3}$/)
    assert.equal(typeof rate, 'number')
    assert(Number.isFinite(rate) && rate > 0)
  }

  const dom = await b.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="exchange-rates"]'); return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestedBase:card?.dataset.requestedBaseCurrency||'', providerBase:card?.dataset.providerBaseCurrency||'',
    identityMatch:card?.dataset.identityMatch||'', contractValid:card?.dataset.contractValid||'',
    attribution:card?.querySelector('a[href="https://www.exchangerate-api.com"]')?.textContent?.trim()||'',
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  } })()`)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestedBase: dom.requestedBase,
    providerBase: dom.providerBase,
    identityMatch: dom.identityMatch,
    contractValid: dom.contractValid,
  }, {
    layout: 'exchange-rates',
    fallback: 'false',
    state: 'ready',
    requestedBase: 'SGD',
    providerBase: 'SGD',
    identityMatch: 'true',
    contractValid: 'true',
  })
  assert.equal(dom.attribution, 'Rates By Exchange Rate API')
  assert.equal(dom.overflow, false)

  await b.viewport(390, 844)
  const mobile = await b.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0, 'unnamed actionable controls')
  assert.deepEqual(b.errors, [], `browser errors ${b.errors.join(' | ')}`)
  report.checks.push({
    id: 'exchange-rate-current',
    case: 'live request-bound FX table',
    providerResult: live.data.result,
    requestedBase: 'SGD',
    providerBase: live.data.base_code,
    semanticState: 'ready',
    identityMatch: true,
    contractValid: true,
    mobileOverflow: false,
    unnamedControls: 0,
    retryOnRateLimit: false,
    machineCatalogPolicyAligned: true,
  })
  await b.close(); b = undefined

  const wrongBase = {
    ...live.data,
    result: 'success',
    base_code: 'USD',
    rates: { USD: 1, SGD: 1.234567, MYR: 4.321 },
  }
  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: wrongBase }]]) })
  try {
    await malformed.nav('exchange-rate-current')
    const result = await malformed.run()
    assert.equal(result.ok, true, result.error)
    const invalid = await malformed.ev(`(() => { const card=document.querySelector('[data-domain-card="exchange-rates"]'); return { state:card?.dataset.resultState||'', requestedBase:card?.dataset.requestedBaseCurrency||'', providerBase:card?.dataset.providerBaseCurrency||'', identityMatch:card?.dataset.identityMatch||'', contractValid:card?.dataset.contractValid||'', text:card?.innerText||'', http:document.querySelector('.ssot-runtime b')?.textContent||'' } })()`)
    assert.equal(invalid.state, 'invalid')
    assert.equal(invalid.requestedBase, 'SGD')
    assert.equal(invalid.providerBase, 'USD')
    assert.equal(invalid.identityMatch, 'false')
    assert.equal(invalid.contractValid, 'false')
    assert.match(invalid.http, /^200/)
    assert.doesNotMatch(invalid.text, /1\.234567/)
    assert.equal(malformed.fixtureRequests.filter((item) => item.url === endpoint && item.method === 'GET').length, 1)
    assert.deepEqual(malformed.errors, [])
    report.checks.push({
      id: 'exchange-rate-current',
      case: 'synthetic wrong-base HTTP-200',
      transportStatus: 200,
      requestedBase: 'SGD',
      providerBase: 'USD',
      semanticState: 'invalid',
      identityMatch: false,
      plausibleRateHidden: true,
      exactProviderFixtureRequests: 1,
    })
  } finally {
    await malformed.close()
  }

  const coinbaseBrowser = await browser(`${root}/dist`)
  let coinbaseEndpoint = ''
  let coinbaseLive
  try {
    await coinbaseBrowser.nav('ecb-fx-rates')
    coinbaseEndpoint = await coinbaseBrowser.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
    assert(coinbaseEndpoint, 'Coinbase exchange-rate endpoint was not exposed')
    const coinbaseRequestUrl = new URL(coinbaseEndpoint)
    assert.equal(coinbaseRequestUrl.origin, 'https://api.coinbase.com')
    assert.equal(coinbaseRequestUrl.pathname, '/v2/exchange-rates')
    assert.equal(coinbaseRequestUrl.searchParams.get('currency'), 'EUR')

    coinbaseLive = await coinbaseBrowser.run()
    assert.equal(coinbaseLive.ok, true, coinbaseLive.error)
    assert.equal(coinbaseLive.data?.data?.currency, 'EUR')
    assert.equal(typeof coinbaseLive.data?.data?.rates, 'object')
    assert.equal(Array.isArray(coinbaseLive.data?.data?.rates), false)

    const coinbaseDom = await coinbaseBrowser.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="exchange-rates"]'); return {
      layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
      requestedBase:card?.dataset.requestedBaseCurrency||'', providerBase:card?.dataset.providerBaseCurrency||'',
      identityMatch:card?.dataset.identityMatch||'', contractValid:card?.dataset.contractValid||'',
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
    } })()`)
    assert.deepEqual(coinbaseDom, {
      layout: 'exchange-rates',
      fallback: 'false',
      state: 'ready',
      requestedBase: 'EUR',
      providerBase: 'EUR',
      identityMatch: 'true',
      contractValid: 'true',
      overflow: false,
    })

    await coinbaseBrowser.viewport(390, 844)
    const coinbaseMobile = await coinbaseBrowser.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
    assert.equal(coinbaseMobile.documentOverflow || coinbaseMobile.previewOverflow, false, JSON.stringify(coinbaseMobile))
    const coinbaseAx = await coinbaseBrowser.call('Accessibility.getFullAXTree')
    assert.equal(unnamed(coinbaseAx.nodes).length, 0, 'Coinbase unnamed actionable controls')
    assert.deepEqual(coinbaseBrowser.errors, [], `Coinbase browser errors ${coinbaseBrowser.errors.join(' | ')}`)
    report.checks.push({
      id: 'ecb-fx-rates',
      case: 'live request-bound Coinbase FX table',
      requestedBase: 'EUR',
      providerBase: coinbaseLive.data.data.currency,
      semanticState: 'ready',
      identityMatch: true,
      contractValid: true,
      mobileOverflow: false,
      unnamedControls: 0,
    })
  } finally {
    await coinbaseBrowser.close()
  }

  const wrongCoinbaseBase = {
    ...coinbaseLive,
    data: { currency: 'USD', rates: { EUR: '0.8593', SGD: '1.2645', BTC: '0.0000086' } },
  }
  const coinbaseMalformed = await browser(`${root}/dist`, { fixtures: new Map([[coinbaseEndpoint, { body: wrongCoinbaseBase }]]) })
  try {
    await coinbaseMalformed.nav('ecb-fx-rates')
    const result = await coinbaseMalformed.run()
    assert.equal(result.ok, true, result.error)
    const invalid = await coinbaseMalformed.ev(`(() => { const card=document.querySelector('[data-domain-card="exchange-rates"]'); return { state:card?.dataset.resultState||'', requestedBase:card?.dataset.requestedBaseCurrency||'', providerBase:card?.dataset.providerBaseCurrency||'', identityMatch:card?.dataset.identityMatch||'', contractValid:card?.dataset.contractValid||'', text:card?.innerText||'', http:document.querySelector('.ssot-runtime b')?.textContent||'' } })()`)
    assert.equal(invalid.state, 'invalid')
    assert.equal(invalid.requestedBase, 'EUR')
    assert.equal(invalid.providerBase, 'USD')
    assert.equal(invalid.identityMatch, 'false')
    assert.equal(invalid.contractValid, 'false')
    assert.match(invalid.http, /^200/)
    assert.doesNotMatch(invalid.text, /1\.2645/)
    assert.equal(coinbaseMalformed.fixtureRequests.filter((item) => item.url === coinbaseEndpoint && item.method === 'GET').length, 1)
    assert.deepEqual(coinbaseMalformed.errors, [])
    report.checks.push({
      id: 'ecb-fx-rates',
      case: 'synthetic wrong-base HTTP-200',
      transportStatus: 200,
      requestedBase: 'EUR',
      providerBase: 'USD',
      semanticState: 'invalid',
      identityMatch: false,
      plausibleRateHidden: true,
      exactProviderFixtureRequests: 1,
    })
  } finally {
    await coinbaseMalformed.close()
  }

  const vatBrowser = await browser(`${root}/dist`)
  let vatEndpoint = ''
  let vatLive
  try {
    await vatBrowser.nav('vatcomply')
    vatEndpoint = await vatBrowser.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
    assert(vatEndpoint, 'VATComply endpoint was not exposed')
    const vatRequestUrl = new URL(vatEndpoint)
    assert.equal(vatRequestUrl.origin, 'https://api.vatcomply.com')
    assert.equal(vatRequestUrl.pathname, '/rates')
    assert.equal(vatRequestUrl.searchParams.get('base'), 'EUR')
    assert.equal(vatRequestUrl.searchParams.get('symbols'), 'USD,SGD,GBP')
    const vatRequestedSymbols = vatRequestUrl.searchParams.get('symbols').split(',').sort()

    vatLive = await vatBrowser.run()
    assert.equal(vatLive.ok, true, vatLive.error)
    assert.equal(vatLive.data?.base, 'EUR')
    assert.equal(typeof vatLive.data?.date, 'string')
    assert.equal(typeof vatLive.data?.rates, 'object')
    assert.equal(Array.isArray(vatLive.data?.rates), false)
    assert.deepEqual(Object.keys(vatLive.data.rates).sort(), vatRequestedSymbols)
    assert(Object.values(vatLive.data.rates).every((rate) => typeof rate === 'number' && Number.isFinite(rate) && rate > 0), 'VATComply rates must remain positive JSON numbers')

    const vatDom = await vatBrowser.ev(`(() => { const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="exchange-rates"]'); return {
      layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
      requestedBase:card?.dataset.requestedBaseCurrency||'', providerBase:card?.dataset.providerBaseCurrency||'',
      requestedSymbols:card?.dataset.requestedSymbols||'', providerSymbols:card?.dataset.providerSymbols||'',
      baseIdentityMatch:card?.dataset.baseIdentityMatch||'', symbolsMatch:card?.dataset.symbolsMatch||'',
      identityMatch:card?.dataset.identityMatch||'', contractValid:card?.dataset.contractValid||'',
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
    } })()`)
    assert.deepEqual(vatDom, {
      layout: 'exchange-rates',
      fallback: 'false',
      state: 'ready',
      requestedBase: 'EUR',
      providerBase: 'EUR',
      requestedSymbols: 'USD,SGD,GBP',
      providerSymbols: 'GBP,SGD,USD',
      baseIdentityMatch: 'true',
      symbolsMatch: 'true',
      identityMatch: 'true',
      contractValid: 'true',
      overflow: false,
    })

    await vatBrowser.viewport(390, 844)
    const vatMobile = await vatBrowser.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
    assert.equal(vatMobile.documentOverflow || vatMobile.previewOverflow, false, JSON.stringify(vatMobile))
    const vatAx = await vatBrowser.call('Accessibility.getFullAXTree')
    assert.equal(unnamed(vatAx.nodes).length, 0, 'VATComply unnamed actionable controls')
    assert.deepEqual(vatBrowser.errors, [], `VATComply browser errors ${vatBrowser.errors.join(' | ')}`)
    report.checks.push({
      id: 'vatcomply',
      case: 'live request-bound FX table',
      providerDate: vatLive.data.date,
      requestedBase: 'EUR',
      providerBase: vatLive.data.base,
      requestedSymbols: 'USD,SGD,GBP',
      providerSymbols: Object.keys(vatLive.data.rates).sort(),
      semanticState: 'ready',
      baseIdentityMatch: true,
      symbolsMatch: true,
      identityMatch: true,
      contractValid: true,
      mobileOverflow: false,
      unnamedControls: 0,
    })
  } finally {
    await vatBrowser.close()
  }

  const wrongVatBase = {
    ...vatLive.data,
    base: 'USD',
    rates: { EUR: 0.86, SGD: 1.27, GBP: 0.74 },
  }
  const vatMalformed = await browser(`${root}/dist`, { fixtures: new Map([[vatEndpoint, { body: wrongVatBase }]]) })
  try {
    await vatMalformed.nav('vatcomply')
    const result = await vatMalformed.run()
    assert.equal(result.ok, true, result.error)
    const invalid = await vatMalformed.ev(`(() => { const card=document.querySelector('[data-domain-card="exchange-rates"]'); return { state:card?.dataset.resultState||'', requestedBase:card?.dataset.requestedBaseCurrency||'', providerBase:card?.dataset.providerBaseCurrency||'', identityMatch:card?.dataset.identityMatch||'', contractValid:card?.dataset.contractValid||'', text:card?.innerText||'', http:document.querySelector('.ssot-runtime b')?.textContent||'' } })()`)
    assert.equal(invalid.state, 'invalid')
    assert.equal(invalid.requestedBase, 'EUR')
    assert.equal(invalid.providerBase, 'USD')
    assert.equal(invalid.identityMatch, 'false')
    assert.equal(invalid.contractValid, 'false')
    assert.match(invalid.http, /^200/)
    assert.doesNotMatch(invalid.text, /1\.27/)
    assert.equal(vatMalformed.fixtureRequests.filter((item) => item.url === vatEndpoint && item.method === 'GET').length, 1)
    assert.deepEqual(vatMalformed.errors, [])
    report.checks.push({
      id: 'vatcomply',
      case: 'synthetic wrong-base HTTP-200',
      transportStatus: 200,
      requestedBase: 'EUR',
      providerBase: 'USD',
      semanticState: 'invalid',
      identityMatch: false,
      plausibleRateHidden: true,
      exactProviderFixtureRequests: 1,
    })
  } finally {
    await vatMalformed.close()
  }

  const wrongVatSymbols = {
    ...vatLive.data,
    rates: { USD: 1.1622, GBP: 0.85898, JPY: 171.12 },
  }
  const vatSymbolMismatch = await browser(`${root}/dist`, { fixtures: new Map([[vatEndpoint, { body: wrongVatSymbols }]]) })
  try {
    await vatSymbolMismatch.nav('vatcomply')
    const result = await vatSymbolMismatch.run()
    assert.equal(result.ok, true, result.error)
    const invalid = await vatSymbolMismatch.ev(`(() => { const card=document.querySelector('[data-domain-card=\"exchange-rates\"]'); return { state:card?.dataset.resultState||'', requestedSymbols:card?.dataset.requestedSymbols||'', providerSymbols:card?.dataset.providerSymbols||'', baseIdentityMatch:card?.dataset.baseIdentityMatch||'', symbolsMatch:card?.dataset.symbolsMatch||'', identityMatch:card?.dataset.identityMatch||'', contractValid:card?.dataset.contractValid||'', text:card?.innerText||'', http:document.querySelector('.ssot-runtime b')?.textContent||'' } })()`)
    assert.equal(invalid.state, 'invalid')
    assert.equal(invalid.requestedSymbols, 'USD,SGD,GBP')
    assert.equal(invalid.providerSymbols, 'GBP,JPY,USD')
    assert.equal(invalid.baseIdentityMatch, 'true')
    assert.equal(invalid.symbolsMatch, 'false')
    assert.equal(invalid.identityMatch, 'false')
    assert.equal(invalid.contractValid, 'false')
    assert.match(invalid.http, /^200/)
    assert.doesNotMatch(invalid.text, /171\.12/)
    assert.equal(vatSymbolMismatch.fixtureRequests.filter((item) => item.url === vatEndpoint && item.method === 'GET').length, 1)
    assert.deepEqual(vatSymbolMismatch.errors, [])
    report.checks.push({ id: 'vatcomply', case: 'synthetic wrong-symbol HTTP-200', transportStatus: 200, requestedSymbols: 'USD,SGD,GBP', providerSymbols: ['GBP', 'JPY', 'USD'], semanticState: 'invalid', baseIdentityMatch: true, symbolsMatch: false, plausibleRateHidden: true, exactProviderFixtureRequests: 1 })
  } finally {
    await vatSymbolMismatch.close()
  }
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (b) report.errors.push(...b.errors.map(String))
} finally {
  if (b) await b.close()
}

fs.writeFileSync(`${evidence}/exchange-rate-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/exchange-rate-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
