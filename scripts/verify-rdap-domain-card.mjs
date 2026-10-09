import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://rdap.org/domain/google.com'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live RDAP.org direct domain lookup plus exact synthetic malformed/wrong-identity HTTP-200 fixtures',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const canonical = (name) => new URL(`https://${String(name).replace(/\.+$/g, '')}/`).hostname.replace(/\.+$/g, '').toLowerCase()
let b
try {
  b = await browser(`${root}/dist`)
  await b.nav('rdap-domain-lookup')
  const result = await b.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(String(result.data?.objectClassName || '').toLowerCase(), 'domain')
  assert.equal(canonical(result.data?.ldhName || result.data?.unicodeName), 'google.com')
  const registrar = (result.data?.entities || []).find((entity) => (entity.roles || []).some((role) => String(role).toLowerCase() === 'registrar'))
  const vcard = Array.isArray(registrar?.vcardArray?.[1]) ? registrar.vcardArray[1] : []
  const registrarName = vcard.find((property) => Array.isArray(property) && property[0] === 'fn')?.[3] || registrar?.handle || '—'
  const expectedNameservers = (result.data?.nameservers || []).map((entry) => entry.ldhName || entry.unicodeName).filter(Boolean).join(', ')
  const expectedStatus = (result.data?.status || []).join(', ')
  const dom = await b.ev(`(() => {
    const shell=document.querySelector('.demo-preview'), card=shell?.querySelector('.rdap-domain-preview')
    const metrics=Object.fromEntries([...card.querySelectorAll('.semantic-card-grid dl > div')].map((row)=>[row.querySelector('dt')?.textContent||'',row.querySelector('dd')?.textContent||'']))
    return {
      layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'',
      requested:card?.dataset.requestedDomain||'', providerDomain:card?.dataset.providerDomain||'', providerLdh:card?.dataset.providerLdhName||'', providerUnicode:card?.dataset.providerUnicodeName||'',
      objectClass:card?.dataset.objectClassName||'', identityMatch:card?.dataset.identityMatch||'', contextShape:card?.dataset.contextShapeValid||'',
      title:card.querySelector('.semantic-card-grid h3')?.textContent||'', registrar:metrics.Registrar||'', nameservers:metrics.Nameservers||'', status:metrics.Status||'',
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
    }
  })()`)
  assert.equal(dom.layout, 'domain-registration'); assert.equal(dom.fallback, 'false'); assert.equal(dom.state, 'ready')
  assert.equal(dom.requested, 'google.com'); assert.equal(dom.providerDomain, 'google.com'); assert.equal(dom.identityMatch, 'true')
  assert.equal(dom.objectClass.toLowerCase(), 'domain'); assert.equal(dom.contextShape, 'true')
  assert.equal(canonical(dom.providerLdh || dom.providerUnicode), 'google.com'); assert.equal(dom.title, String(result.data.ldhName || result.data.unicodeName))
  assert.equal(dom.registrar, String(registrarName)); assert.equal(dom.nameservers, expectedNameservers || '—'); assert.equal(dom.status, expectedStatus || '—'); assert.equal(dom.overflow, false)
  await b.viewport(390, 844)
  const mobile = await b.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow || mobile.previewOverflow, false, JSON.stringify(mobile))
  const ax = await b.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length, 0)
  report.checks.push({ id:'rdap-domain-lookup', case:'live google.com direct-domain contract', semanticState:'ready', identity:'request ↔ provider domain exact after DNS/IDNA canonicalization', objectClass:'domain', registrar:'exact response match', nameservers:'exact response match', status:'exact response match', mobileOverflow:false, unnamedControls:0 })
  report.errors.push(...b.errors.map(String)); assert.deepEqual(report.errors, [])
  await b.close(); b = undefined

  const mismatch = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: { objectClassName:'domain', ldhName:'FABRICATED.EXAMPLE', handle:'FAKE-HANDLE', status:['active'], nameservers:[], events:[], entities:[{ roles:['registrar'], handle:'Fake Registrar' }] } }]]) })
  try {
    await mismatch.nav('rdap-domain-lookup'); const run = await mismatch.run(); assert.equal(run.ok, true, run.error)
    const x = await mismatch.ev(`(()=>{const c=document.querySelector('.rdap-domain-preview');return {state:c?.dataset.resultState||'',identity:c?.dataset.identityMatch||'',requested:c?.dataset.requestedDomain||'',text:c?.innerText||'',http:document.querySelector('.ssot-runtime b')?.textContent||''}})()`)
    assert.equal(x.state, 'invalid'); assert.equal(x.identity, 'false'); assert.equal(x.requested, 'google.com'); assert.match(x.text, /identity mismatch/i)
    assert.equal(x.text.includes('FABRICATED.EXAMPLE'), false); assert.equal(x.text.includes('Fake Registrar'), false); assert.equal(x.text.includes('FAKE-HANDLE'), false); assert.match(x.http, /^200/)
    assert.equal(mismatch.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length, 1); assert.deepEqual(mismatch.errors, [])
    report.checks.push({ id:'rdap-domain-lookup', case:'synthetic wrong-domain HTTP-200', transportStatus:200, semanticState:'invalid', fabricatedRegistrationHidden:true, exactProviderFixtureRequests:1 })
  } finally { await mismatch.close() }

  const malformed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: { objectClassName:'domain', handle:'FABRICATED', status:['active'] } }]]) })
  try {
    await malformed.nav('rdap-domain-lookup'); const run = await malformed.run(); assert.equal(run.ok, true, run.error)
    const x = await malformed.ev(`(()=>{const c=document.querySelector('.rdap-domain-preview');return {state:c?.dataset.resultState||'',text:c?.innerText||''}})()`)
    assert.equal(x.state, 'invalid'); assert.match(x.text, /Invalid RDAP domain identity/); assert.equal(x.text.includes('FABRICATED'), false); assert.deepEqual(malformed.errors, [])
    report.checks.push({ id:'rdap-domain-lookup', case:'synthetic missing-domain-identity HTTP-200', transportStatus:200, semanticState:'invalid', fabricatedRegistrationHidden:true })
  } finally { await malformed.close() }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'; report.error = String(error); if (b) report.errors.push(...b.errors.map(String))
} finally { if (b) await b.close() }
fs.writeFileSync(`${evidence}/rdap-domain-card.json`, `${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/rdap-domain-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
