import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'CoinGecko Simple Price request binding, native numeric market evidence, malformed HTTP-200 handling, mobile layout, and accessibility',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const semanticDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="coingecko-keyless-market"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', method:card?.dataset.requestMethod||'', coin:card?.dataset.requestCoin||'', currency:card?.dataset.requestCurrency||'',
    providerCoins:Number(card?.dataset.providerCoinCount), validCoins:Number(card?.dataset.validCoinCount), invalidCoins:Number(card?.dataset.invalidCoinCount),
    missingMetrics:Number(card?.dataset.missingMetricCount), malformedMetrics:Number(card?.dataset.malformedMetricCount), invalidMetrics:Number(card?.dataset.invalidMetricCount),
    envelope:card?.dataset.envelopeContract||'', coinIdentity:card?.dataset.coinIdentityContract||'', metricKeys:card?.dataset.metricKeyContract||'', nativeNumbers:card?.dataset.nativeNumberContract||'',
    primaryCoin:card?.dataset.primaryCoin||'', primaryPrice:card?.dataset.primaryPrice||'', primaryCurrency:card?.dataset.primaryCurrency||'', lastUpdatedAt:card?.dataset.lastUpdatedAt||'',
    text:card?.innerText||'',
  };
})()`)

const endpointContract = (endpoint) => {
  const url = new URL(endpoint)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.hostname, 'api.coingecko.com')
  assert.equal(url.pathname, '/api/v3/simple/price')
  assert.deepEqual([...url.searchParams.keys()].sort(), ['ids', 'include_24hr_change', 'include_24hr_vol', 'include_last_updated_at', 'include_market_cap', 'vs_currencies'].sort())
  const coin = url.searchParams.get('ids')
  const currency = url.searchParams.get('vs_currencies')
  assert(coin)
  assert(currency)
  for (const key of ['include_market_cap', 'include_24hr_vol', 'include_24hr_change', 'include_last_updated_at']) assert.equal(url.searchParams.get(key), 'true')
  return { coin, currency }
}

const canonicalQuote = (currency, overrides = {}) => ({
  [currency]: 65000,
  [`${currency}_market_cap`]: 1280000000000,
  [`${currency}_24h_vol`]: 35000000000,
  [`${currency}_24h_change`]: 2.5,
  last_updated_at: 1789438053,
  ...overrides,
})

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('coingecko-keyless-market')
  const endpoint = await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const contract = endpointContract(endpoint)

  const requestsBefore = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - requestsBefore, 1, 'The live journey must send exactly one provider fetch')
  assert(result.data && typeof result.data === 'object' && !Array.isArray(result.data), 'CoinGecko did not return a coin-keyed object')
  assert.deepEqual(Object.keys(result.data), [contract.coin], 'Live payload must contain only the requested coin identity')
  const quote = result.data[contract.coin]
  assert(quote && typeof quote === 'object' && !Array.isArray(quote), 'Requested CoinGecko quote is missing')
  const keys = [contract.currency, `${contract.currency}_market_cap`, `${contract.currency}_24h_vol`, `${contract.currency}_24h_change`, 'last_updated_at']
  assert.deepEqual(Object.keys(quote).sort(), keys.sort())
  for (const key of [contract.currency, `${contract.currency}_market_cap`, `${contract.currency}_24h_vol`, `${contract.currency}_24h_change`]) {
    assert.equal(typeof quote[key], 'number', `${key} must be a native JSON number`)
    assert(Number.isFinite(quote[key]), `${key} must be finite`)
  }
  assert(quote[contract.currency] >= 0)
  assert(quote[`${contract.currency}_market_cap`] >= 0)
  assert(quote[`${contract.currency}_24h_vol`] >= 0)
  assert(Number.isSafeInteger(quote.last_updated_at) && quote.last_updated_at >= 0)

  const liveDom = await semanticDom(active)
  assert.equal(liveDom.layout, 'market-chart')
  assert.equal(liveDom.fallback, 'false')
  assert.equal(liveDom.state, 'ready')
  assert.deepEqual({ requestBound: liveDom.requestBound, method: liveDom.method, coin: liveDom.coin, currency: liveDom.currency }, { requestBound: 'true', method: 'GET', coin: contract.coin, currency: contract.currency })
  assert.deepEqual({ providerCoins: liveDom.providerCoins, validCoins: liveDom.validCoins, invalidCoins: liveDom.invalidCoins }, { providerCoins: 1, validCoins: 1, invalidCoins: 0 })
  assert.deepEqual({ missingMetrics: liveDom.missingMetrics, malformedMetrics: liveDom.malformedMetrics, invalidMetrics: liveDom.invalidMetrics }, { missingMetrics: 0, malformedMetrics: 0, invalidMetrics: 0 })
  assert.deepEqual({ envelope: liveDom.envelope, coinIdentity: liveDom.coinIdentity, metricKeys: liveDom.metricKeys, nativeNumbers: liveDom.nativeNumbers }, { envelope: 'true', coinIdentity: 'true', metricKeys: 'true', nativeNumbers: 'true' })
  assert.equal(liveDom.primaryCoin, contract.coin)
  assert.equal(Number(liveDom.primaryPrice), quote[contract.currency])
  assert.equal(liveDom.primaryCurrency, contract.currency)
  assert.equal(Number(liveDom.lastUpdatedAt), quote.last_updated_at)

  await active.viewport(390, 844)
  const mobile = await active.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1,cardOverflow:document.querySelector('[data-domain-card="coingecko-keyless-market"]').scrollWidth>document.querySelector('[data-domain-card="coingecko-keyless-market"]').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await active.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(active.errors, [])
  report.checks.push({ case: 'live exact CoinGecko Simple Price request', transportStatus: 200, semanticState: liveDom.state, coin: contract.coin, currency: contract.currency, nativeNumericMetrics: true, identityBinding: true, cors: 'browser request succeeded', mobileOverflow: false, unnamedControls: 0, liveProviderRequests: 1, retries: 0 })
  await active.close()
  active = undefined

  const canonical = canonicalQuote(contract.currency)
  const cases = [
    {
      name: 'numeric-string price',
      body: { [contract.coin]: { ...canonical, [contract.currency]: '99999' } },
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.malformedMetrics, 1)
        assert.equal(dom.nativeNumbers, 'false')
        assert.doesNotMatch(dom.text, /99,999/)
      },
    },
    {
      name: 'unexpected extra coin identity',
      body: { [contract.coin]: canonical, ethereum: canonicalQuote(contract.currency) },
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.validCoins, 1)
        assert.equal(dom.invalidCoins, 1)
        assert.doesNotMatch(dom.text, /Ethereum/)
      },
    },
    {
      name: 'wrong-only coin identity',
      body: { ethereum: canonicalQuote(contract.currency) },
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.validCoins, 0)
        assert.equal(dom.invalidCoins, 1)
        assert.doesNotMatch(dom.text, /65,000/)
      },
    },
    {
      name: 'empty snapshot',
      body: {},
      expectedState: 'empty',
      check: (dom) => {
        assert.equal(dom.providerCoins, 0)
        assert.match(dom.text, /No market snapshot returned/)
        assert.doesNotMatch(dom.text, /USD 0|\$0/)
      },
    },
  ]

  for (const testCase of cases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: testCase.body }]]) })
    active = fixtureBrowser
    await fixtureBrowser.nav('coingecko-keyless-market')
    assert.equal(await fixtureBrowser.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`), endpoint)
    const before = fixtureBrowser.requestCount
    const fixtureResult = await fixtureBrowser.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureFetchCount = fixtureBrowser.requestCount - before
    const fixtureDom = await semanticDom(fixtureBrowser)
    assert.equal(fixtureDom.state, testCase.expectedState)
    testCase.check(fixtureDom)
    const exactFixtureRequests = fixtureBrowser.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
    assert.equal(exactFixtureRequests, 1)
    assert.equal(fixtureFetchCount, exactFixtureRequests, 'Fixture-only cases must not send additional live provider requests')
    assert.deepEqual(fixtureBrowser.errors, [])
    report.checks.push({ case: `fixture-only ${testCase.name} HTTP-200`, semanticState: fixtureDom.state, exactFixtureRequests, liveProviderRequests: 0 })
    await fixtureBrowser.close()
    active = undefined
  }
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/coingecko-keyless-market-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/coingecko-keyless-market-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
