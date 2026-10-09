import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'Frankfurter SGD/MYR ECB request/row binding, strict native positive rates, malformed HTTP-200 handling, mobile layout, and accessibility',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored
  && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value)
  && !(node.name?.value || '').trim())

const setInput = async (b, name, value) => {
  await b.ev(`(() => {
    const input = document.querySelector('input[name=${JSON.stringify(name)}]');
    if (!input) throw Error('missing input: ${name}');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }));
  })()`)
  await sleep(80)
}

const setSelect = async (b, name, value) => {
  await b.ev(`(() => {
    const select = document.querySelector('select[name=${JSON.stringify(name)}]');
    if (!select) throw Error('missing select: ${name}');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
  await sleep(80)
}

const isoDay = (value) => {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/)
  const date = new Date(`${value}T00:00:00.000Z`)
  assert.equal(date.toISOString().slice(0, 10), value)
  return Math.floor(date.getTime() / 86_400_000)
}

const endpointContract = (endpoint) => {
  const url = new URL(endpoint)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.hostname, 'api.frankfurter.dev')
  assert.equal(url.port, '')
  assert.equal(url.username, '')
  assert.equal(url.password, '')
  assert.equal(url.hash, '')
  assert.equal(url.pathname, '/v2/rates')
  const entries = [...url.searchParams.entries()]
  const keys = ['from', 'to', 'base', 'quotes', 'providers', 'group']
  assert.equal(entries.length, keys.length)
  assert.deepEqual(entries.map(([key]) => key).sort(), [...keys].sort())
  for (const key of keys) assert.equal(entries.filter(([candidate]) => candidate === key).length, 1)
  assert.equal(url.searchParams.get('base'), 'SGD')
  assert.equal(url.searchParams.get('quotes'), 'MYR')
  assert.equal(url.searchParams.get('providers'), 'ECB')
  assert(['month', 'week'].includes(url.searchParams.get('group')))
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const fromDay = isoDay(from)
  const toDay = isoDay(to)
  assert(fromDay >= isoDay('1999-01-04'))
  assert(toDay >= fromDay)
  return { endpoint, from, to, fromDay, toDay, group: url.searchParams.get('group') }
}

const configureRequest = async (b) => {
  await b.nav('frankfurter-sgd-myr-history')
  await setInput(b, 'from', '2026-01-01')
  await setInput(b, 'to', '2026-09-15')
  await setSelect(b, 'group', 'month')
  const endpoint = await b.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  return endpointContract(endpoint)
}

const semanticDom = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview');
  const card = shell?.querySelector('[data-domain-card="frankfurter-fx-history"]');
  return {
    layout: shell?.dataset.previewLayout || '', fallback: shell?.dataset.ssotFallback || '', state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '', method: card?.dataset.requestMethod || '',
    from: card?.dataset.requestStartDate || '', to: card?.dataset.requestEndDate || '', group: card?.dataset.requestGroup || '',
    base: card?.dataset.requestBase || '', quote: card?.dataset.requestQuote || '', provider: card?.dataset.requestProvider || '',
    providerRecords: Number(card?.dataset.providerRecordCount), validRecords: Number(card?.dataset.validRecordCount), invalidRecords: Number(card?.dataset.invalidRecordCount),
    invalidShapes: Number(card?.dataset.invalidShapeCount), identityMismatches: Number(card?.dataset.wrongIdentityCount), invalidDates: Number(card?.dataset.invalidDateCount), duplicateDates: Number(card?.dataset.duplicateDateCount), outOfRange: Number(card?.dataset.outOfRangeCount), malformedRates: Number(card?.dataset.malformedRateCount),
    envelope: card?.dataset.envelopeContract || '', rowShape: card?.dataset.rowShapeContract || '', pairIdentity: card?.dataset.rowIdentityContract || '', dateContract: card?.dataset.dateRangeContract || '', uniqueDates: card?.dataset.uniqueDateContract || '', nativeRates: card?.dataset.nativePositiveRateContract || '',
    primaryDate: card?.dataset.primaryDate || '', primaryRate: card?.dataset.primaryRate || '',
    evidence: [...(card?.querySelectorAll('ol[aria-label="Frankfurter validated SGD/MYR rate evidence"] li') || [])].map((node) => node.textContent || ''),
    runtimeStatus: shell?.querySelector('.ssot-runtime b')?.textContent || '', text: card?.innerText || '',
  };
})()`)

const exactRateRow = (date, rate, base = 'SGD', quote = 'MYR') => ({ date, base, quote, rate })

let active
try {
  active = await browser(`${root}/dist`)
  const contract = await configureRequest(active)
  assert.deepEqual(await active.ev(`(() => ({
    fromType: document.querySelector('input[name="from"]')?.type,
    toType: document.querySelector('input[name="to"]')?.type,
    toMin: document.querySelector('input[name="to"]')?.min,
    group: document.querySelector('select[name="group"]')?.value,
    groupOptions: [...(document.querySelector('select[name="group"]')?.options || [])].map((option) => option.value),
  }))()`), { fromType: 'date', toType: 'date', toMin: contract.from, group: 'month', groupOptions: ['month', 'week'] })

  const beforeLive = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - beforeLive, 1, 'The live journey must send exactly one provider fetch and never retry')
  assert(Array.isArray(result.data), 'Frankfurter did not return the documented flat rates array')
  assert(result.data.length > 0, 'The bounded 2026 monthly range should return at least one ECB rate')
  const seen = new Set()
  for (const row of result.data) {
    assert(row && typeof row === 'object' && !Array.isArray(row))
    assert.deepEqual(Object.keys(row).sort(), ['base', 'date', 'quote', 'rate'])
    assert.equal(row.base, 'SGD')
    assert.equal(row.quote, 'MYR')
    const day = isoDay(row.date)
    assert(day >= contract.fromDay && day <= contract.toDay)
    assert(!seen.has(row.date), `duplicate live Frankfurter date ${row.date}`)
    seen.add(row.date)
    assert.equal(typeof row.rate, 'number')
    assert(Number.isFinite(row.rate) && row.rate > 0)
  }

  const sorted = [...result.data].sort((left, right) => left.date.localeCompare(right.date))
  const latest = sorted.at(-1)
  const liveDom = await semanticDom(active)
  assert.equal(liveDom.layout, 'fx-history')
  assert.equal(liveDom.fallback, 'false')
  assert.equal(liveDom.state, 'ready')
  assert.match(liveDom.runtimeStatus, /^200 OK$/)
  assert.deepEqual(
    { requestBound: liveDom.requestBound, method: liveDom.method, from: liveDom.from, to: liveDom.to, group: liveDom.group, base: liveDom.base, quote: liveDom.quote, provider: liveDom.provider },
    { requestBound: 'true', method: 'GET', from: contract.from, to: contract.to, group: 'month', base: 'SGD', quote: 'MYR', provider: 'ECB' },
  )
  assert.deepEqual(
    { providerRecords: liveDom.providerRecords, validRecords: liveDom.validRecords, invalidRecords: liveDom.invalidRecords, invalidShapes: liveDom.invalidShapes, identityMismatches: liveDom.identityMismatches, invalidDates: liveDom.invalidDates, duplicateDates: liveDom.duplicateDates, outOfRange: liveDom.outOfRange, malformedRates: liveDom.malformedRates },
    { providerRecords: result.data.length, validRecords: result.data.length, invalidRecords: 0, invalidShapes: 0, identityMismatches: 0, invalidDates: 0, duplicateDates: 0, outOfRange: 0, malformedRates: 0 },
  )
  assert.deepEqual(
    { envelope: liveDom.envelope, rowShape: liveDom.rowShape, pairIdentity: liveDom.pairIdentity, dateContract: liveDom.dateContract, uniqueDates: liveDom.uniqueDates, nativeRates: liveDom.nativeRates },
    { envelope: 'true', rowShape: 'true', pairIdentity: 'true', dateContract: 'true', uniqueDates: 'true', nativeRates: 'true' },
  )
  assert.equal(liveDom.primaryDate, latest.date)
  assert.equal(Number(liveDom.primaryRate), latest.rate)
  assert.equal(liveDom.evidence.length, result.data.length)
  assert(liveDom.evidence.includes(`${latest.date}: 1 SGD = ${latest.rate} MYR; provider ECB`))

  await active.viewport(390, 844)
  const mobile = await active.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
    cardOverflow: document.querySelector('[data-domain-card="frankfurter-fx-history"]').scrollWidth > document.querySelector('[data-domain-card="frankfurter-fx-history"]').clientWidth + 1,
  })`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await active.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(active.errors, [])
  report.checks.push({
    case: 'live exact Frankfurter SGD/MYR ECB grouped history request', transportStatus: 200, semanticState: liveDom.state,
    range: `${contract.from}..${contract.to}`, group: contract.group, rows: result.data.length,
    requestIdentity: 'exact six-key GET', rowIdentity: 'SGD/MYR native positive rates', rawToDomIdentity: true,
    cors: 'browser request succeeded', mobileOverflow: false, unnamedControls: 0, liveProviderRequests: 1, retries: 0,
  })
  await active.close()
  active = undefined

  const canonicalRows = [
    exactRateRow('2026-01-01', 3.12),
    exactRateRow('2026-02-01', 3.15),
    exactRateRow('2026-03-01', 3.18),
  ]
  const cases = [
    {
      name: 'numeric-string rate',
      body: canonicalRows.map((row, index) => index === 1 ? { ...row, rate: '9.9999' } : row),
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.validRecords, 2)
        assert.equal(dom.malformedRates, 1)
        assert.equal(dom.nativeRates, 'false')
        assert.doesNotMatch(dom.text, /9\.9999/)
      },
    },
    {
      name: 'wrong currency pair',
      body: canonicalRows.map((row, index) => index === 1 ? { ...row, base: 'EUR', rate: 8.8888 } : row),
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.validRecords, 2)
        assert.equal(dom.identityMismatches, 1)
        assert.equal(dom.pairIdentity, 'false')
        assert.doesNotMatch(dom.text, /8\.8888/)
      },
    },
    {
      name: 'duplicate and out-of-range dates',
      body: [exactRateRow('2025-12-31', 9.9991), canonicalRows[0], exactRateRow('2026-01-01', 9.9992), canonicalRows[2]],
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.validRecords, 2)
        assert.equal(dom.invalidDates, 0)
        assert.equal(dom.outOfRange, 1)
        assert.equal(dom.duplicateDates, 1)
        assert.equal(dom.dateContract, 'false')
        assert.equal(dom.uniqueDates, 'false')
        assert.doesNotMatch(dom.text, /9\.9991|9\.9992/)
      },
    },
    {
      name: 'empty array',
      body: [],
      expectedState: 'empty',
      check: (dom) => {
        assert.equal(dom.validRecords, 0)
        assert.match(dom.text, /No rates returned/)
        assert.doesNotMatch(dom.text, /MYR 0/)
      },
    },
    {
      name: 'malformed object envelope',
      body: { rates: canonicalRows },
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.envelope, 'false')
        assert.equal(dom.validRecords, 0)
        assert.doesNotMatch(dom.text, /3\.12|3\.15|3\.18/)
      },
    },
    {
      name: 'nonempty array with zero trustworthy rows',
      body: [exactRateRow('2026-01-01', '3.12'), exactRateRow('2026-02-01', 0)],
      expectedState: 'invalid',
      check: (dom) => {
        assert.equal(dom.validRecords, 0)
        assert.equal(dom.malformedRates, 2)
        assert.doesNotMatch(dom.text, /3\.12|MYR 0/)
      },
    },
  ]

  const fixtureContract = endpointContract('https://api.frankfurter.dev/v2/rates?from=2026-01-01&to=2026-09-15&base=SGD&quotes=MYR&providers=ECB&group=month')
  for (const testCase of cases) {
    const intercepted = await browser(`${root}/dist`, { fixtures: new Map([[fixtureContract.endpoint, { body: testCase.body }]]) })
    active = intercepted
    const configured = await configureRequest(intercepted)
    assert.equal(configured.endpoint, fixtureContract.endpoint)
    const before = intercepted.requestCount
    const fixtureResult = await intercepted.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureFetchCount = intercepted.requestCount - before
    const fixtureDom = await semanticDom(intercepted)
    assert.equal(fixtureDom.state, testCase.expectedState)
    testCase.check(fixtureDom)
    const exactFixtureRequests = intercepted.fixtureRequests.filter((request) => request.url === fixtureContract.endpoint && request.method === 'GET').length
    assert.equal(exactFixtureRequests, 1)
    assert.equal(fixtureFetchCount, exactFixtureRequests, 'Fixture-only cases must not send additional live provider requests')
    assert.deepEqual(intercepted.blockedProviders, [])
    assert.deepEqual(intercepted.errors, [])
    report.checks.push({ case: `fixture-only ${testCase.name} HTTP-200`, semanticState: fixtureDom.state, exactFixtureRequests, liveProviderRequests: 0 })
    await intercepted.close()
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

fs.writeFileSync(`${evidence}/frankfurter-sgd-myr-history-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/frankfurter-sgd-myr-history-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
