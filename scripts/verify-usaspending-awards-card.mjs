import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'
const report = { origin: 'https://yapweijun1996.github.io', publication: 'unpublished local app bundle', checks: [], errors: [] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setControl = async (b, name, value) => {
  await b.ev(`(() => { const element=document.querySelector('[name=${JSON.stringify(name)}]'); if(!element) throw new Error('Missing control'); const proto=element.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(element,${JSON.stringify(value)}); element.dispatchEvent(new Event(element.tagName==='SELECT'?'change':'input',{bubbles:true})); })()`)
  await sleep(80)
}
const mobileAx = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({ documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1, previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1 })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  assert.equal(unnamed((await b.call('Accessibility.getFullAXTree')).nodes).length, 0)
}
const boundDom = (b) => b.ev(`(() => { const card=document.querySelector('.federal-awards-preview'); const first=card?.querySelector('[data-award-index="1"]'); return { state:card?.dataset.resultState, requestBound:card?.dataset.requestBound, requestFiscalYear:Number(card?.dataset.requestFiscalYear), requestStart:card?.dataset.requestStartDate||'', requestEnd:card?.dataset.requestEndDate||'', requestDateType:card?.dataset.requestDateType||'', responseLimitMatch:card?.dataset.responseLimitMatch, awardDateRangeMatch:card?.dataset.awardDateRangeMatch, providerCount:Number(card?.dataset.providerRecordCount), validCount:Number(card?.dataset.validAwardCount), invalidCount:Number(card?.dataset.invalidAwardCount), incompleteCount:Number(card?.dataset.incompleteAwardCount), envelope:card?.dataset.envelopeContractValid, primaryInternalId:Number(card?.dataset.primaryInternalId), primaryAwardId:card?.dataset.primaryAwardId||'', internalId:Number(first?.dataset.internalId), awardId:first?.dataset.awardId||'', recipient:first?.dataset.recipient||'', amount:Number(first?.dataset.awardAmount), date:first?.dataset.baseObligationDate||'', text:card?.innerText||'' }; })()`)

try {
  const live = await browser(root + '/dist')
  try {
    await live.nav('usaspending')
    const selectedFiscalYear = Number(await live.ev(`document.querySelector('[name="fiscalYear"]')?.value`))
    const integerContract = await live.ev(`(() => ({
      fiscalYearStep: document.querySelector('[name="fiscalYear"]')?.getAttribute('step') || '',
      limitStep: document.querySelector('[name="limit"]')?.getAttribute('step') || '',
    }))()` )
    assert.deepEqual(integerContract, { fiscalYearStep: '1', limitStep: '1' })
    const beforeFractionalFiscalYear = live.requestCount
    await setControl(live, 'fiscalYear', '2025.5')
    const fiscalYearValidity = await live.ev(`(() => { const input=document.querySelector('[name="fiscalYear"]'); return { valid:input.checkValidity(), stepMismatch:input.validity.stepMismatch }; })()` )
    assert.deepEqual(fiscalYearValidity, { valid:false, stepMismatch:true })
    live.ev(`document.querySelector('form.parameter-card').requestSubmit()` )
    await sleep(120)
    assert.equal(live.requestCount, beforeFractionalFiscalYear, 'Fractional USAspending fiscal year reached a provider request')
    await setControl(live, 'fiscalYear', String(selectedFiscalYear))
    const beforeFractionalLimit = live.requestCount
    await setControl(live, 'limit', '3.5')
    const limitValidity = await live.ev(`(() => { const input=document.querySelector('[name="limit"]'); return { valid:input.checkValidity(), stepMismatch:input.validity.stepMismatch }; })()` )
    assert.deepEqual(limitValidity, { valid:false, stepMismatch:true })
    live.ev(`document.querySelector('form.parameter-card').requestSubmit()` )
    await sleep(120)
    assert.equal(live.requestCount, beforeFractionalLimit, 'Fractional USAspending limit reached a provider request')
    report.checks.push({ id:'usaspending', case:'integer SSOT validation', fiscalYearStep:1, limitStep:1, fractionalFiscalYearRejected:true, fractionalLimitRejected:true, providerRequests:0 })
    await setControl(live, 'limit', '3')
    const result = await live.run()
    assert.equal(result.ok, true, result.error)
    assert.equal(result.data.spending_level, 'awards')
    assert.equal(result.data.limit, 3)
    assert(Array.isArray(result.data.results) && result.data.results.length > 0)
    assert(result.data.results.every((row) => typeof row.internal_id === 'number'))
    const first = result.data.results[0]
    const dom = await boundDom(live)
    assert.equal(dom.state, 'ready')
    assert.equal(dom.requestBound, 'true')
    assert.equal(dom.requestFiscalYear, selectedFiscalYear)
    assert.equal(dom.requestStart, `${selectedFiscalYear - 1}-10-01`)
    assert.equal(dom.requestEnd, `${selectedFiscalYear}-09-30`)
    assert.equal(dom.requestDateType, 'new_awards_only')
    assert.equal(dom.responseLimitMatch, 'true')
    assert.equal(dom.awardDateRangeMatch, 'true')
    assert.equal(dom.providerCount, result.data.results.length)
    assert.equal(dom.validCount, result.data.results.length)
    assert.equal(dom.invalidCount, 0)
    assert.equal(dom.incompleteCount, 0)
    assert.equal(dom.envelope, 'true')
    assert.equal(dom.primaryInternalId, Number(first.internal_id))
    assert.equal(dom.internalId, Number(first.internal_id))
    assert.equal(dom.primaryAwardId, String(first['Award ID'] || ''))
    assert.equal(dom.awardId, String(first['Award ID'] || ''))
    assert.equal(dom.recipient, String(first['Recipient Name'] || ''))
    assert.equal(dom.amount, Number(first['Award Amount']))
    assert.equal(dom.date, String(first['Base Obligation Date'] || ''))
    assert(result.data.results.every((row) => String(row['Base Obligation Date'] || '') >= dom.requestStart && String(row['Base Obligation Date'] || '') <= dom.requestEnd))
    assert(!dom.text.includes('Award 1'))
    await mobileAx(live)
    report.checks.push({ id:'usaspending', source:'live provider', semanticState:'ready', fiscalYear:selectedFiscalYear, requestBodyBinding:'fiscal-year + new_awards_only + A-D contracts', responseLimitMatch:true, awardDateRangeMatch:true, providerRecords:result.data.results.length, requiredInternalIds:'exact', primaryAward:'raw-to-DOM exact', mobileOverflow:false, unnamedControls:0 })
    report.errors.push(...live.errors.map(String))
  } finally { await live.close() }

  const mixedBody = {
    spending_level: 'awards', limit: 2,
    results: [
      { internal_id: 901, 'Award ID':'SAFE-901', 'Recipient Name':'Trusted Recipient', 'Award Amount':125, 'Base Obligation Date':'2026-01-05', 'Contract Award Type':'PURCHASE ORDER' },
      { 'Award ID':'FABRICATED-ROW', 'Recipient Name':'Should not render', 'Award Amount':5, 'Base Obligation Date':'2026-01-04' },
    ],
    page_metadata: { page:1, hasNext:false }, messages: [],
  }
  const synthetic = await browser(root + '/dist', { fixtures:new Map([[endpoint,{ method:'POST', body:mixedBody }]]) })
  try {
    await synthetic.nav('usaspending')
    await setControl(synthetic, 'fiscalYear', '2026')
    await setControl(synthetic, 'limit', '2')
    const result = await synthetic.run()
    assert.equal(result.ok, true, result.error)
    const dom = await boundDom(synthetic)
    assert.deepEqual({state:dom.state,requestBound:dom.requestBound,requestFiscalYear:dom.requestFiscalYear,providerCount:dom.providerCount,validCount:dom.validCount,invalidCount:dom.invalidCount,primaryInternalId:dom.primaryInternalId},{state:'partial',requestBound:'true',requestFiscalYear:2026,providerCount:2,validCount:1,invalidCount:1,primaryInternalId:901})
    assert(dom.text.includes('Trusted Recipient'))
    assert(!dom.text.includes('Should not render'))
    assert(!dom.text.includes('FABRICATED-ROW'))
    await mobileAx(synthetic)
    const methods = synthetic.fixtureRequests.map((request) => request.method)
    assert(methods.includes('POST'))
    assert.deepEqual(synthetic.blockedProviders, [])
    report.checks.push({ id:'usaspending', case:'mixed HTTP-200 award batch', source:'synthetic fixture', semanticState:'partial', requestBound:true, fiscalYear:2026, providerRecords:2, validAwards:1, invalidAwards:1, fabricatedRowRendered:false, mobileOverflow:false, unnamedControls:0 })
    report.errors.push(...synthetic.errors.map(String))
  } finally { await synthetic.close() }

  const wrongFiscalYearBody = {
    spending_level: 'awards', limit: 1,
    results: [{ internal_id: 902, 'Award ID':'WRONG-FY', 'Recipient Name':'Plausible but wrong', 'Award Amount':999999, 'Base Obligation Date':'2025-09-30' }],
    page_metadata: { page:1, hasNext:false }, messages: [],
  }
  const wrongFiscalYear = await browser(root + '/dist', { fixtures:new Map([[endpoint,{ method:'POST', body:wrongFiscalYearBody }]]) })
  try {
    await wrongFiscalYear.nav('usaspending')
    await setControl(wrongFiscalYear, 'fiscalYear', '2026')
    await setControl(wrongFiscalYear, 'limit', '1')
    const result = await wrongFiscalYear.run()
    assert.equal(result.ok, true, result.error)
    const invalid = await wrongFiscalYear.ev(`(() => { const card=document.querySelector('[data-domain-card="federal-awards"]'); return { state:card?.dataset.resultState, text:card?.innerText||'' }; })()`)
    assert.equal(invalid.state, 'invalid')
    assert(!invalid.text.includes('Plausible but wrong'))
    assert(!invalid.text.includes('$999,999'))
    await mobileAx(wrongFiscalYear)
    report.checks.push({ id:'usaspending', case:'wrong-fiscal-year HTTP-200 batch', source:'synthetic fixture', semanticState:'invalid', requestedFiscalYear:2026, providerDate:'2025-09-30', plausibleAwardWithheld:true, mobileOverflow:false, unnamedControls:0 })
    report.errors.push(...wrongFiscalYear.errors.map(String))
  } finally { await wrongFiscalYear.close() }

  assert.deepEqual(report.errors, [])
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
}
fs.writeFileSync(`${evidence}/usaspending-awards-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({ ...report, evidence:`${evidence}/usaspending-awards-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
