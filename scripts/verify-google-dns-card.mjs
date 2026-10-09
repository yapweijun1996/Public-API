import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'Google Public DNS JSON API plus exact synthetic HTTP-200 fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setControl = async (b, name, value) => {
  await b.ev(`(() => { const element = document.querySelector('[name=${JSON.stringify(name)}]'); if (!element) throw new Error('Missing control: ${name}'); const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`)
  await sleep(80)
}
const mobileAx = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({ documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1 })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
}
const validAnswers = (value) => Array.isArray(value) ? value.filter((row) => row && typeof row === 'object' && typeof row.name === 'string' && Number.isInteger(row.type) && Number.isInteger(row.TTL) && row.TTL >= 0 && typeof row.data === 'string' && row.data.length > 0) : []

let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('google-dns-doh')
  await setControl(b, 'name', 'example.com')
  await setControl(b, 'type', 'A')
  const liveRequestsBefore = b.requestCount
  let result = await b.run()
  assert.equal(b.requestCount - liveRequestsBefore, 1, 'Expected one live Google DNS request with no retry')
  assert.equal(result.ok, true, result.error)
  assert.equal(result.data?.Status, 0)
  assert.equal(Array.isArray(result.data?.Question), true)
  assert.equal(result.data.Question.length, 1)
  const question = result.data.Question[0]
  assert.equal(question.name, 'example.com.')
  assert.equal(question.type, 1)
  const answers = validAnswers(result.data.Answer)
  assert(answers.length > 0, 'Live Google DNS A query returned no usable answer rows')
  assert.equal(answers.length, result.data.Answer.length, 'Live Google DNS returned a malformed answer row')

  const liveDom = await b.ev(`(() => {
    const shell = document.querySelector('.demo-preview')
    const card = shell.querySelector('[data-domain-card="dns-records"]')
    const answers = [...card.querySelectorAll('.dns-records > li')].map((row) => ({
      name: row.dataset.answerName,
      type: Number(row.dataset.answerType),
      ttl: Number(row.dataset.answerTtl),
      data: row.querySelector('code')?.textContent || '',
    }))
    return {
      layout: shell.dataset.previewLayout,
      state: card.dataset.resultState,
      requestBound: card.dataset.requestBound,
      requestedName: card.dataset.requestedDnsName,
      requestedType: card.dataset.requestedDnsType,
      questionName: card.dataset.questionName,
      questionType: Number(card.dataset.questionType),
      identityMatch: card.dataset.identityMatch,
      providerCount: Number(card.dataset.providerAnswerCount),
      validCount: Number(card.dataset.validAnswerCount),
      invalidCount: Number(card.dataset.invalidAnswerCount),
      rcode: Number(card.dataset.dnsStatus),
      answers,
    }
  })()`)
  assert.equal(liveDom.layout, 'dns-records')
  assert.equal(liveDom.state, 'ready')
  assert.equal(liveDom.requestBound, 'true')
  assert.equal(liveDom.requestedName, 'example.com')
  assert.equal(liveDom.requestedType, 'A')
  assert.equal(liveDom.questionName, question.name)
  assert.equal(liveDom.questionType, question.type)
  assert.equal(liveDom.identityMatch, 'true')
  assert.equal(liveDom.providerCount, result.data.Answer.length)
  assert.equal(liveDom.validCount, answers.length)
  assert.equal(liveDom.invalidCount, 0)
  assert.equal(liveDom.rcode, result.data.Status)
  assert.deepEqual(liveDom.answers, answers.map((row) => ({ name: row.name, type: row.type, ttl: row.TTL, data: row.data })))
  await mobileAx(b)
  report.checks.push({ id: 'google-dns-doh', case: 'live example.com A', http: result.status, rcode: result.data.Status, question: question.name, type: question.type, answerCount: answers.length, requestBound: true, liveProviderRequests: 1, retries: 0, rawToSemanticDom: 'exact match', mobileOverflow: false, unnamedControls: 0 })

  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const requestUrl = 'https://dns.google/resolve?name=example.com&type=A'
  const mismatched = {
    Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
    Question: [{ name: 'wrong.example.', type: 1 }],
    Answer: [{ name: 'wrong.example.', type: 1, TTL: 300, data: '203.0.113.99' }],
  }
  b = await browser(`${root}/dist`, { fixtures: new Map([[requestUrl, { body: mismatched }]]) })
  await b.nav('google-dns-doh')
  result = await b.run()
  assert.equal(result.ok, true, result.error)
  const mismatchDom = await b.ev(`(() => { const card=document.querySelector('[data-domain-card="dns-records"]'); return { state:card?.dataset.resultState, requestedName:card?.dataset.requestedDnsName, requestedType:card?.dataset.requestedDnsType, questionName:card?.dataset.questionName, identityMatch:card?.dataset.identityMatch, text:card?.innerText||'' }; })()`)
  assert.equal(mismatchDom.state, 'invalid')
  assert.equal(mismatchDom.requestedName, 'example.com')
  assert.equal(mismatchDom.requestedType, 'A')
  assert.equal(mismatchDom.questionName, 'wrong.example.')
  assert.equal(mismatchDom.identityMatch, 'false')
  assert(mismatchDom.text.includes('does not match the requested DNS name and record type'))
  assert(!mismatchDom.text.includes('203.0.113.99'))
  assert.deepEqual(b.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: requestUrl, source: 'synthetic-fixture', status: 200 }])
  await mobileAx(b)
  report.checks.push({ id: 'google-dns-doh', case: 'mismatched Question HTTP-200 fixture', semanticState: 'invalid', fabricatedAnswerHidden: true, mobileOverflow: false, unnamedControls: 0 })

  report.errors.push(...b.errors.map(String))
  assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const mixedWire = {
    Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
    Question: [{ name: 'example.com.', type: 1 }],
    Answer: [
      { name: 'example.com.', type: 1, TTL: 300, data: '192.0.2.1' },
      { name: 'example.com.', type: '1', TTL: '300', data: '203.0.113.77' },
    ],
  }
  b = await browser(`${root}/dist`, { fixtures: new Map([[requestUrl, { body: mixedWire }]]) })
  await b.nav('google-dns-doh')
  result = await b.run()
  assert.equal(result.ok, true, result.error)
  const mixedDom = await b.ev(`(() => { const card=document.querySelector('[data-domain-card="dns-records"]'); return { state:card?.dataset.resultState, requestBound:card?.dataset.requestBound, validCount:Number(card?.dataset.validAnswerCount), invalidCount:Number(card?.dataset.invalidAnswerCount), text:card?.innerText||'' }; })()`)
  assert.equal(mixedDom.state, 'partial')
  assert.equal(mixedDom.requestBound, 'true')
  assert.equal(mixedDom.validCount, 1)
  assert.equal(mixedDom.invalidCount, 1)
  assert(mixedDom.text.includes('192.0.2.1'))
  assert(!mixedDom.text.includes('203.0.113.77'))
  assert.deepEqual(b.fixtureRequests.map((request) => ({ url: request.url, source: request.source, status: request.status })), [{ url: requestUrl, source: 'synthetic-fixture', status: 200 }])
  await mobileAx(b)
  report.checks.push({ id: 'google-dns-doh', case: 'numeric-string DNS wire fixture', semanticState: 'partial', requestBound: true, malformedAnswerHidden: true, mobileOverflow: false, unnamedControls: 0 })

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

fs.writeFileSync(`${evidence}/google-dns-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/google-dns-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
