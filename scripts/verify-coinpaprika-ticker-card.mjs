import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'CoinPaprika ticker request/identity binding, native-number and documented empty-string evidence, malformed HTTP-200 handling, mobile layout, and accessibility',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const semanticDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="coinpaprika-ticker"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', method:card?.dataset.requestMethod||'', coin:card?.dataset.requestCoin||'', quote:card?.dataset.requestQuote||'',
    envelope:card?.dataset.envelopeContract||'', idContract:card?.dataset.idContract||'', identityText:card?.dataset.identityTextContract||'', quoteContract:card?.dataset.quoteContract||'',
    nativeNumberContract:card?.dataset.nativeNumberContract||'', timestampContract:card?.dataset.timestampContract||'',
    providerTickers:Number(card?.dataset.providerTickerCount), validTickers:Number(card?.dataset.validTickerCount), invalidTickers:Number(card?.dataset.invalidTickerCount),
    nativeNumbers:Number(card?.dataset.nativeNumberCount), missingMetrics:Number(card?.dataset.missingMetricCount), emptyStringMetrics:Number(card?.dataset.emptyStringMetricCount), malformedMetrics:Number(card?.dataset.malformedMetricCount),
    validTimestamps:Number(card?.dataset.validTimestampCount), emptyStringTimestamps:Number(card?.dataset.emptyStringTimestampCount), malformedTimestamps:Number(card?.dataset.malformedTimestampCount),
    primaryId:card?.dataset.primaryId||'', primaryPrice:card?.dataset.primaryPrice||'', primarySymbol:card?.dataset.primarySymbol||'', lastUpdated:card?.dataset.lastUpdated||'',
    text:card?.innerText||'',
  };
})()`)

const endpointContract = (endpoint) => {
  const url = new URL(endpoint)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.hostname, 'api.coinpaprika.com')
  assert.equal(url.port, '')
  assert.equal(url.username, '')
  assert.equal(url.password, '')
  assert.equal(url.hash, '')
  assert.equal(url.search, '')
  const path = url.pathname.split('/').filter(Boolean)
  assert.deepEqual(path.slice(0, 2), ['v1', 'tickers'])
  assert.equal(path.length, 3)
  assert.match(path[2], /^[a-z0-9]+(?:-[a-z0-9]+)+$/)
  return { coin: path[2] }
}

const canonicalTicker = (coin, overrides = {}) => ({
  id: coin,
  name: coin === 'btc-bitcoin' ? 'Bitcoin' : 'Selected coin',
  symbol: coin === 'btc-bitcoin' ? 'BTC' : 'COIN',
  last_updated: '2026-09-15T04:05:06Z',
  quotes: {
    USD: {
      price: 116234.52,
      volume_24h: 49876543210,
      market_cap: 2314567890123,
      percent_change_24h: -1.25,
    },
  },
  ...overrides,
})

const strictIsoTimestamp = (value) => {
  assert.equal(typeof value, 'string')
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/)
  assert(Number.isFinite(Date.parse(value)))
}

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('coinpaprika-ticker')
  const endpoint = await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const contract = endpointContract(endpoint)

  const requestsBefore = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - requestsBefore, 1, 'The live journey must send exactly one provider fetch and never retry')
  assert(result.data && typeof result.data === 'object' && !Array.isArray(result.data), 'CoinPaprika did not return its ticker object envelope')
  assert.equal(result.data.id, contract.coin, 'Live ticker id must match the selected request path')
  assert.equal(typeof result.data.name, 'string')
  assert(result.data.name.trim())
  assert.equal(typeof result.data.symbol, 'string')
  assert(result.data.symbol.trim())
  assert(result.data.quotes && typeof result.data.quotes === 'object' && !Array.isArray(result.data.quotes))
  const usd = result.data.quotes.USD
  assert(usd && typeof usd === 'object' && !Array.isArray(usd), 'Live ticker is missing quotes.USD')
  for (const key of ['price', 'volume_24h', 'market_cap', 'percent_change_24h']) {
    assert.equal(typeof usd[key], 'number', `${key} must be a native JSON number for the default live ticker`)
    assert(Number.isFinite(usd[key]), `${key} must be finite`)
  }
  for (const key of ['price', 'volume_24h', 'market_cap']) assert(usd[key] >= 0, `${key} must be non-negative`)
  strictIsoTimestamp(result.data.last_updated)

  const liveDom = await semanticDom(active)
  assert.equal(liveDom.layout, 'market-chart')
  assert.equal(liveDom.fallback, 'false')
  assert.equal(liveDom.state, 'ready')
  assert.deepEqual({ requestBound: liveDom.requestBound, method: liveDom.method, coin: liveDom.coin, quote: liveDom.quote }, { requestBound: 'true', method: 'GET', coin: contract.coin, quote: 'USD' })
  assert.deepEqual({ envelope: liveDom.envelope, idContract: liveDom.idContract, identityText: liveDom.identityText, quoteContract: liveDom.quoteContract, nativeNumberContract: liveDom.nativeNumberContract, timestampContract: liveDom.timestampContract }, { envelope: 'true', idContract: 'true', identityText: 'true', quoteContract: 'true', nativeNumberContract: 'true', timestampContract: 'true' })
  assert.deepEqual({ providerTickers: liveDom.providerTickers, validTickers: liveDom.validTickers, invalidTickers: liveDom.invalidTickers, nativeNumbers: liveDom.nativeNumbers, missingMetrics: liveDom.missingMetrics, emptyStringMetrics: liveDom.emptyStringMetrics, malformedMetrics: liveDom.malformedMetrics }, { providerTickers: 1, validTickers: 1, invalidTickers: 0, nativeNumbers: 4, missingMetrics: 0, emptyStringMetrics: 0, malformedMetrics: 0 })
  assert.equal(liveDom.primaryId, result.data.id)
  assert.equal(Number(liveDom.primaryPrice), usd.price)
  assert.equal(liveDom.primarySymbol, result.data.symbol.trim())
  assert.equal(liveDom.lastUpdated, new Date(result.data.last_updated).toISOString())

  await active.viewport(390, 844)
  const mobile = await active.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1,cardOverflow:document.querySelector('[data-domain-card="coinpaprika-ticker"]').scrollWidth>document.querySelector('[data-domain-card="coinpaprika-ticker"]').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await active.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(active.errors, [])
  report.checks.push({ case: 'live exact CoinPaprika ticker request', transportStatus: 200, semanticState: liveDom.state, coin: contract.coin, quote: 'USD', nativeNumericMetrics: 4, identityBinding: true, cors: 'browser request succeeded', mobileOverflow: false, unnamedControls: 0, liveProviderRequests: 1, retries: 0 })
  await active.close()
  active = undefined

  const cases = [
    {
      name: 'numeric-string price',
      body: canonicalTicker(contract.coin, { quotes: { USD: { ...canonicalTicker(contract.coin).quotes.USD, price: '99999' } } }),
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.nativeNumbers, 3)
        assert.equal(dom.malformedMetrics, 1)
        assert.equal(dom.nativeNumberContract, 'false')
        assert.doesNotMatch(dom.text, /99,999/)
      },
    },
    {
      name: 'wrong ticker id',
      body: canonicalTicker('eth-ethereum'),
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.idContract, 'false')
        assert.equal(dom.validTickers, 0)
        assert.equal(dom.invalidTickers, 1)
        assert.doesNotMatch(dom.text, /116,234\.52/)
      },
    },
    {
      name: 'documented empty-string price',
      body: canonicalTicker(contract.coin, { quotes: { USD: { ...canonicalTicker(contract.coin).quotes.USD, price: '' } } }),
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.nativeNumbers, 3)
        assert.equal(dom.emptyStringMetrics, 1)
        assert.equal(dom.malformedMetrics, 0)
        assert.match(dom.text, /Price unavailable/)
        assert.doesNotMatch(dom.text, /USD 0/)
      },
    },
    {
      name: 'all documented unavailable values',
      body: canonicalTicker(contract.coin, { last_updated: '', quotes: { USD: { price: '', volume_24h: '', market_cap: '', percent_change_24h: '' } } }),
      expectedState: 'empty',
      check: (dom) => {
        assert.equal(dom.nativeNumbers, 0)
        assert.equal(dom.emptyStringMetrics, 4)
        assert.equal(dom.emptyStringTimestamps, 1)
        assert.match(dom.text, /No USD market values returned/)
        assert.doesNotMatch(dom.text, /USD 0/)
      },
    },
    {
      name: 'malformed array envelope',
      body: [canonicalTicker(contract.coin)],
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.envelope, 'false')
        assert.equal(dom.validTickers, 0)
        assert.doesNotMatch(dom.text, /116,234\.52/)
      },
    },
  ]

  for (const testCase of cases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: testCase.body }]]) })
    active = fixtureBrowser
    await fixtureBrowser.nav('coinpaprika-ticker')
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

fs.writeFileSync(`${evidence}/coinpaprika-ticker-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/coinpaprika-ticker-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
