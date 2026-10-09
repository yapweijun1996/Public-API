import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const requestUrl = 'https://api.worldbank.org/v2/country/SGP?format=json'
const singapore = {
  id: 'SGP', iso2Code: 'SG', name: 'Singapore',
  region: { id: 'EAS', iso2code: 'Z4', value: 'East Asia & Pacific' },
  adminregion: { id: '', iso2code: '', value: '' },
  incomeLevel: { id: 'HIC', iso2code: 'XD', value: 'High income' },
  lendingType: { id: 'LNX', iso2code: 'XX', value: 'Not classified' },
  capitalCity: 'Singapore', longitude: '103.85', latitude: '1.28941',
}
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  scope: 'World Bank V2 single-country request identity plus synthetic wrong-country HTTP-200 fail-closed regression',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())

let live
let mismatch
try {
  live = await browser(`${root}/dist`)
  await live.nav('countries')
  const endpoint = await live.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(endpoint, requestUrl)
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert(Array.isArray(result.data) && result.data.length === 2 && Array.isArray(result.data[1]) && result.data[1].length === 1, 'World Bank did not return the documented two-part single-country envelope')
  const provider = result.data[1][0]
  assert.equal(provider.id, 'SGP')
  assert.equal(provider.iso2Code, 'SG')
  assert.equal(provider.name, 'Singapore')

  const dom = await live.ev(`(() => {
    const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('[data-domain-card="country-profile"]')
    const facts=Object.fromEntries([...card?.querySelectorAll('.country-facts > div')||[]].map(row=>[row.querySelector('dt')?.textContent||'',row.querySelector('dd')?.textContent||'']))
    return {
      layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
      requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', requestedCode:card?.dataset.requestedCountryCode||'', providerCode:card?.dataset.providerCountryCode||'',
      providerIso2:card?.dataset.providerIso2Code||'', identityMatch:card?.dataset.identityMatch||'', contractValid:card?.dataset.contractValid||'',
      providerRecordCount:Number(card?.dataset.providerRecordCount), title:card?.querySelector('h3')?.textContent||'', region:card?.querySelector('.country-hero p')?.textContent||'', facts,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
    }
  })()`)
  assert.equal(dom.layout, 'country-profile')
  assert.equal(dom.fallback, 'false')
  assert.equal(dom.state, 'ready')
  assert.deepEqual({ requestBound: dom.requestBound, requestContract: dom.requestContract, identityMatch: dom.identityMatch, contractValid: dom.contractValid }, { requestBound: 'true', requestContract: 'exact-world-bank-country-v2', identityMatch: 'true', contractValid: 'true' })
  assert.equal(dom.requestedCode, 'SGP')
  assert.equal(dom.providerCode, provider.id)
  assert.equal(dom.providerIso2, provider.iso2Code)
  assert.equal(dom.providerRecordCount, 1)
  assert.equal(dom.title, provider.name)
  assert.match(dom.region, new RegExp(provider.region.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.equal(dom.facts['Capital city'], provider.capitalCity)
  assert.equal(dom.facts['Income group'], provider.incomeLevel.value)
  assert.equal(dom.facts['Lending type'], provider.lendingType.value)
  assert.equal(dom.facts.Coordinates, `${provider.latitude}, ${provider.longitude}`)
  assert.equal(dom.overflow, false)

  await live.viewport(390, 844)
  const mobile = await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1,cardOverflow:document.querySelector('[data-domain-card="country-profile"]').scrollWidth>document.querySelector('[data-domain-card="country-profile"]').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow || mobile.cardOverflow, false, JSON.stringify(mobile))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'countries', case: 'live executed-request-bound World Bank V2 country', semanticState: 'ready', requestContract: dom.requestContract, requestedCode: 'SGP', providerCode: provider.id, providerIso2: provider.iso2Code, rawToDomIdentity: 'country identity and semantic facts exact', cors: 'browser request succeeded', mobileOverflow: false, unnamedControls: 0 })
  await live.close()
  live = undefined

  const brazil = { ...singapore, id: 'BRA', iso2Code: 'BR', name: 'Brazil', capitalCity: 'Brasilia' }
  mismatch = await browser(`${root}/dist`, { fixtures: new Map([[requestUrl, { body: [{ page: 1, pages: 1, per_page: '50', total: 1 }, [brazil]] }]]) })
  await mismatch.nav('countries')
  const synthetic = await mismatch.run()
  assert.equal(synthetic.ok, true, synthetic.error)
  const invalid = await mismatch.ev(`(() => { const card=document.querySelector('[data-domain-card="country-profile"]'); return {state:card?.dataset.resultState||'',requestedCode:card?.dataset.requestedCountryCode||'',providerCode:card?.dataset.providerCountryCode||'',providerIso2:card?.dataset.providerIso2Code||'',identityMatch:card?.dataset.identityMatch||'',contractValid:card?.dataset.contractValid||'',text:card?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''} })()`)
  assert.equal(invalid.state, 'invalid')
  assert.equal(invalid.requestedCode, 'SGP')
  assert.equal(invalid.providerCode, 'BRA')
  assert.equal(invalid.providerIso2, 'BR')
  assert.equal(invalid.identityMatch, 'false')
  assert.equal(invalid.contractValid, 'false')
  assert.match(invalid.http, /^200/)
  assert.doesNotMatch(invalid.text, /Brazil|Brasilia/)
  assert.equal(mismatch.fixtureRequests.filter((request) => request.url === requestUrl && request.method === 'GET').length, 1)
  assert.deepEqual(mismatch.errors, [])
  report.checks.push({ id: 'countries', case: 'synthetic wrong-country HTTP-200', transportStatus: 200, semanticState: 'invalid', identityMatch: false, plausibleCountryDetailsHidden: true, exactProviderFixtureRequests: 1 })
  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (live) report.errors.push(...live.errors.map(String))
  if (mismatch) report.errors.push(...mismatch.errors.map(String))
} finally {
  if (live) await live.close()
  if (mismatch) await mismatch.close()
}

fs.writeFileSync(`${evidence}/world-bank-country-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/world-bank-country-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
