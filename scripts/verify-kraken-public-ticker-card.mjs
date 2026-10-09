import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'Kraken request/pair identity binding, provider error semantics, strict decimal-string evidence, malformed HTTP-200 handling, mobile layout, and accessibility',
  checks: [],
  errors: [],
}

const expectedProviderPairs = {
  XBTUSD: 'BTC/USD',
  ETHUSD: 'ETH/USD',
  SOLUSD: 'SOL/USD',
  XBTEUR: 'BTC/EUR',
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())

const semanticDom = (b) => b.ev(`(() => {
  const shell=document.querySelector('.demo-preview');
  const card=shell?.querySelector('[data-domain-card="kraken-public-ticker"]');
  return {
    layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
    requestBound:card?.dataset.requestBound||'', method:card?.dataset.requestMethod||'', requestPair:card?.dataset.requestPair||'', providerPair:card?.dataset.providerPair||'',
    identity:card?.dataset.pairIdentityContract||'', base:card?.dataset.baseCurrency||'', quote:card?.dataset.quoteCurrency||'',
    envelope:card?.dataset.envelopeContract||'', errorContract:card?.dataset.errorContract||'', resultContract:card?.dataset.resultContract||'',
    tickerFields:card?.dataset.tickerFieldContract||'', decimals:card?.dataset.decimalStringContract||'', trades:card?.dataset.tradeCountContract||'',
    providerErrors:Number(card?.dataset.providerErrorCount), providerPairs:Number(card?.dataset.providerPairCount), unexpectedPairs:Number(card?.dataset.unexpectedPairCount),
    missing:Number(card?.dataset.missingFieldCount), malformed:Number(card?.dataset.malformedFieldCount), unexpectedFields:Number(card?.dataset.unexpectedTickerFieldCount), trustworthy:Number(card?.dataset.trustworthyFactCount),
    last:card?.dataset.primaryLast||'', bid:card?.dataset.primaryBid||'', ask:card?.dataset.primaryAsk||'', open:card?.dataset.open||'',
    high:card?.getAttribute('data-high-24h')||'', low:card?.getAttribute('data-low-24h')||'', volume:card?.getAttribute('data-volume-24h')||'', vwap:card?.getAttribute('data-vwap-24h')||'', trades24h:card?.getAttribute('data-trades-24h')||'',
    text:card?.innerText||'',
  };
})()`)

const endpointContract = (endpoint) => {
  const url = new URL(endpoint)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.hostname, 'api.kraken.com')
  assert.equal(url.port, '')
  assert.equal(url.username, '')
  assert.equal(url.password, '')
  assert.equal(url.pathname, '/0/public/Ticker')
  assert.equal(url.hash, '')
  assert.deepEqual([...url.searchParams.entries()], [['pair', 'XBTUSD'], ['assetVersion', '1']])
  return { requestPair: 'XBTUSD', providerPair: expectedProviderPairs.XBTUSD }
}

const decimalString = (value, label) => {
  assert.equal(typeof value, 'string', `${label} must be a JSON string`)
  assert.match(value, /^(?:0|[1-9]\d*)(?:\.\d+)?$/, `${label} must be a canonical non-negative decimal string`)
  assert(Number.isFinite(Number(value)), `${label} must convert to a finite number`)
}

const validateTicker = (ticker) => {
  assert(ticker && typeof ticker === 'object' && !Array.isArray(ticker), 'Ticker must be an object')
  assert.deepEqual(Object.keys(ticker).sort(), ['a', 'b', 'c', 'h', 'l', 'o', 'p', 't', 'v'])
  for (const [field, length] of [['a', 3], ['b', 3], ['c', 2], ['v', 2], ['p', 2], ['l', 2], ['h', 2]]) {
    assert(Array.isArray(ticker[field]), `${field} must be an array`)
    assert.equal(ticker[field].length, length, `${field} slot count`)
    ticker[field].forEach((value, index) => decimalString(value, `${field}[${index}]`))
  }
  decimalString(ticker.o, 'o')
  assert(Array.isArray(ticker.t), 't must be an array')
  assert.equal(ticker.t.length, 2, 't slot count')
  ticker.t.forEach((value, index) => {
    assert.equal(typeof value, 'number', `t[${index}] must be a native number`)
    assert(Number.isSafeInteger(value) && value >= 0, `t[${index}] must be a non-negative safe integer`)
  })
}

const canonicalTicker = (overrides = {}) => ({
  a: ['65010.10000', '1', '1.000'],
  b: ['65000.00000', '2', '2.000'],
  c: ['65005.50000', '0.12500000'],
  v: ['1000.00000000', '2500.00000000'],
  p: ['64500.00000', '64750.00000'],
  t: [100, 321],
  l: ['63000.00000', '62000.00000'],
  h: ['66000.00000', '67000.00000'],
  o: '64000.00000',
  ...overrides,
})

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('kraken-public-ticker')
  const endpoint = await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const contract = endpointContract(endpoint)

  const requestsBefore = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - requestsBefore, 1, 'The live journey must send exactly one provider fetch and never retry')
  assert.deepEqual(active.blockedProviders, [])
  assert.deepEqual(active.networkFailures, [])
  assert(result.data && typeof result.data === 'object' && !Array.isArray(result.data), 'Kraken did not return an object envelope')
  assert.deepEqual(Object.keys(result.data).sort(), ['error', 'result'])
  assert(Array.isArray(result.data.error) && result.data.error.length === 0, `Kraken returned errors: ${JSON.stringify(result.data.error)}`)
  assert(result.data.result && typeof result.data.result === 'object' && !Array.isArray(result.data.result), 'Kraken result must be an object')
  assert.deepEqual(Object.keys(result.data.result), [contract.providerPair], 'Live provider identity must exactly match the assetVersion=1 requested pair')
  const ticker = result.data.result[contract.providerPair]
  validateTicker(ticker)

  const liveDom = await semanticDom(active)
  assert.equal(liveDom.layout, 'market-chart')
  assert.equal(liveDom.fallback, 'false')
  assert.equal(liveDom.state, 'ready')
  assert.deepEqual(
    { requestBound: liveDom.requestBound, method: liveDom.method, requestPair: liveDom.requestPair, providerPair: liveDom.providerPair, identity: liveDom.identity, base: liveDom.base, quote: liveDom.quote },
    { requestBound: 'true', method: 'GET', requestPair: contract.requestPair, providerPair: contract.providerPair, identity: 'true', base: 'BTC', quote: 'USD' },
  )
  assert.deepEqual(
    { envelope: liveDom.envelope, errorContract: liveDom.errorContract, resultContract: liveDom.resultContract, tickerFields: liveDom.tickerFields, decimals: liveDom.decimals, trades: liveDom.trades },
    { envelope: 'true', errorContract: 'true', resultContract: 'true', tickerFields: 'true', decimals: 'true', trades: 'true' },
  )
  assert.deepEqual(
    { providerErrors: liveDom.providerErrors, providerPairs: liveDom.providerPairs, unexpectedPairs: liveDom.unexpectedPairs, missing: liveDom.missing, malformed: liveDom.malformed, unexpectedFields: liveDom.unexpectedFields, trustworthy: liveDom.trustworthy },
    { providerErrors: 0, providerPairs: 1, unexpectedPairs: 0, missing: 0, malformed: 0, unexpectedFields: 0, trustworthy: 9 },
  )
  assert.deepEqual(
    { last: liveDom.last, bid: liveDom.bid, ask: liveDom.ask, open: liveDom.open, high: liveDom.high, low: liveDom.low, volume: liveDom.volume, vwap: liveDom.vwap, trades24h: liveDom.trades24h },
    { last: ticker.c[0], bid: ticker.b[0], ask: ticker.a[0], open: ticker.o, high: ticker.h[1], low: ticker.l[1], volume: ticker.v[1], vwap: ticker.p[1], trades24h: String(ticker.t[1]) },
  )

  await active.viewport(390, 844)
  const mobile = await active.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1,cardOverflow:document.querySelector('[data-domain-card="kraken-public-ticker"]').scrollWidth>document.querySelector('[data-domain-card="kraken-public-ticker"]').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await active.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(active.errors, [])
  report.checks.push({ case: 'live exact Kraken ticker request', transportStatus: 200, semanticState: liveDom.state, requestPair: contract.requestPair, providerPair: contract.providerPair, identityBinding: true, cors: 'real Pages-origin browser fetch succeeded with no network failure', mobileOverflow: false, unnamedControls: 0, liveProviderRequests: 1, retries: 0 })
  await active.close()
  active = undefined

  const cases = [
    {
      name: 'unexpected extra pair',
      body: { error: [], result: { 'BTC/USD': canonicalTicker(), 'ETH/USD': canonicalTicker({ c: ['99999', '1'] }) } },
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.identity, 'true')
        assert.equal(dom.providerPairs, 2)
        assert.equal(dom.unexpectedPairs, 1)
        assert.equal(dom.last, '65005.50000')
        assert.doesNotMatch(dom.text, /99,999/)
      },
    },
    {
      name: 'wrong pair identity',
      body: { error: [], result: { 'ETH/USD': canonicalTicker() } },
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.identity, 'false')
        assert.equal(dom.providerPair, 'ETH/USD')
        assert.equal(dom.last, '')
      },
    },
    {
      name: 'provider error-only envelope',
      body: { error: ['EQuery:Unknown asset pair'] },
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.errorContract, 'true')
        assert.equal(dom.providerErrors, 1)
        assert.match(dom.text, /Kraken returned a provider error/)
      },
    },
    {
      name: 'malformed array envelope',
      body: [],
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.envelope, 'false')
        assert.equal(dom.last, '')
      },
    },
    {
      name: 'native-number decimal',
      body: { error: [], result: { 'BTC/USD': canonicalTicker({ c: [65005.5, '0.125'] }) } },
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.decimals, 'false')
        assert.equal(dom.malformed, 1)
        assert.equal(dom.last, '')
        assert.match(dom.text, /Last unavailable/)
        assert.doesNotMatch(dom.text, /USD 0/)
      },
    },
    {
      name: 'negative decimal string',
      body: { error: [], result: { 'BTC/USD': canonicalTicker({ v: ['1000', '-1'] }) } },
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.decimals, 'false')
        assert.equal(dom.malformed, 1)
        assert.equal(dom.volume, '')
      },
    },
    {
      name: 'malformed ask slots',
      body: { error: [], result: { 'BTC/USD': canonicalTicker({ a: ['65010', '1'] }) } },
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.malformed, 1)
        assert.equal(dom.ask, '')
      },
    },
    {
      name: 'missing last and open',
      body: { error: [], result: { 'BTC/USD': canonicalTicker({ c: undefined, o: undefined }) } },
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.missing, 2)
        assert.equal(dom.last, '')
        assert.equal(dom.open, '')
        assert.match(dom.text, /Last unavailable/)
        assert.doesNotMatch(dom.text, /USD 0/)
      },
    },
    {
      name: 'true zero values',
      body: { error: [], result: { 'BTC/USD': canonicalTicker({ a: ['0', '0', '0'], b: ['0', '0', '0'], c: ['0', '0'], v: ['0', '0'], p: ['0', '0'], t: [0, 0], l: ['0', '0'], h: ['0', '0'], o: '0' }) } },
      expectedState: 'ready',
      check: (dom) => {
        assert.equal(dom.last, '0')
        assert.equal(dom.open, '0')
        assert.equal(dom.trades24h, '0')
      },
    },
    {
      name: 'empty result',
      body: { error: [], result: {} },
      expectedState: 'empty',
      check: (dom) => {
        assert.equal(dom.providerPairs, 0)
        assert.equal(dom.last, '')
        assert.match(dom.text, /No ticker returned for BTC\/USD/)
      },
    },
  ]

  for (const testCase of cases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: testCase.body }]]) })
    active = fixtureBrowser
    await fixtureBrowser.nav('kraken-public-ticker')
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

fs.writeFileSync(`${evidence}/kraken-public-ticker-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/kraken-public-ticker-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
