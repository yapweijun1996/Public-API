import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://clinicaltrials.gov/api/v2/studies?query.cond=Diabetes&pageSize=8&format=json'
const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live ClinicalTrials.gov API v2 from the Pages origin',
  checks: [],
  errors: [],
}
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const providerStudies = (data) => Array.isArray(data?.studies) ? data.studies : []
const identity = (study) => {
  const identification = study?.protocolSection?.identificationModule
  const nctId = typeof identification?.nctId === 'string' ? identification.nctId.trim() : ''
  const title = typeof identification?.briefTitle === 'string' && identification.briefTitle.trim()
    ? identification.briefTitle.trim()
    : typeof identification?.officialTitle === 'string' ? identification.officialTitle.trim() : ''
  return { nctId, title }
}
const semantic = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview')
  const card = shell?.querySelector('.clinical-trials-preview, [data-domain-card="clinical-trials-search"]')
  return {
    layout: shell?.dataset.previewLayout || '',
    fallback: shell?.dataset.ssotFallback || '',
    state: card?.dataset.resultState || '',
    requestBound: card?.dataset.requestBound || '',
    requestContract: card?.dataset.requestContract || '',
    condition: card?.dataset.queryCondition || '',
    requestedPageSize: Number(card?.dataset.requestedPageSize || 0),
    providerStudyCount: Number(card?.dataset.providerStudyCount || 0),
    validStudyCount: Number(card?.dataset.validStudyCount || 0),
    malformedStudyCount: Number(card?.dataset.malformedStudyCount || 0),
    duplicateStudyCount: Number(card?.dataset.duplicateStudyCount || 0),
    overflowStudyCount: Number(card?.dataset.overflowStudyCount || 0),
    rowLimitContract: card?.dataset.rowLimitContract || '',
    primaryNctId: card?.dataset.primaryNctId || '',
    visibleNctIds: [...(card?.querySelectorAll('[data-nct-id]') || [])].map((node) => node.dataset.nctId || ''),
    text: card?.innerText || '',
  }
})()`)

let active
try {
  const live = await browser(`${root}/dist`)
  active = live
  await live.nav('clinical-trials-search')
  const renderedEndpoint = await live.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(renderedEndpoint, endpoint)
  const before = live.requestCount
  const result = await live.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(live.requestCount - before, 1, 'ClinicalTrials.gov verifier must issue exactly one live provider request')
  const studies = providerStudies(result.data)
  assert(studies.length > 0 && studies.length <= 8, `ClinicalTrials.gov default search returned ${studies.length} studies`)
  const identities = studies.map(identity)
  assert(identities.every(({ nctId, title }) => /^NCT\d{8}$/.test(nctId) && title), 'ClinicalTrials.gov NCT/title identity contract drifted')
  assert(result.data.nextPageToken === undefined || typeof result.data.nextPageToken === 'string', 'ClinicalTrials.gov nextPageToken wire type drifted')

  const dom = await semantic(live)
  assert.deepEqual({
    layout: dom.layout,
    fallback: dom.fallback,
    state: dom.state,
    requestBound: dom.requestBound,
    requestContract: dom.requestContract,
    condition: dom.condition,
    requestedPageSize: dom.requestedPageSize,
    providerStudyCount: dom.providerStudyCount,
    validStudyCount: dom.validStudyCount,
    malformedStudyCount: dom.malformedStudyCount,
    duplicateStudyCount: dom.duplicateStudyCount,
    overflowStudyCount: dom.overflowStudyCount,
    rowLimitContract: dom.rowLimitContract,
    primaryNctId: dom.primaryNctId,
    visibleNctIds: dom.visibleNctIds,
  }, {
    layout: 'research-library',
    fallback: 'false',
    state: 'ready',
    requestBound: 'true',
    requestContract: 'exact-clinicaltrials-condition-first-page-json',
    condition: 'Diabetes',
    requestedPageSize: 8,
    providerStudyCount: studies.length,
    validStudyCount: studies.length,
    malformedStudyCount: 0,
    duplicateStudyCount: 0,
    overflowStudyCount: 0,
    rowLimitContract: 'true',
    primaryNctId: identities[0].nctId,
    visibleNctIds: identities.map(({ nctId }) => nctId),
  })
  assert.equal(dom.text.includes('not medical advice'), true)
  assert.equal(dom.text.includes('does not review or approve the safety and science of every listed study'), true)
  await live.viewport(390, 844)
  const overflow = await live.ev(`({ documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1 })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow, false, JSON.stringify(overflow))
  const ax = await live.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
  assert.deepEqual(live.errors, [])
  report.checks.push({ id: 'clinical-trials-search', source: 'live provider', exactRequest: endpoint, returnedStudies: studies.length, primaryNctId: identities[0].nctId, semanticState: dom.state, requestBound: dom.requestBound, browserCorsReadable: true, mobileOverflow: false, unnamedControls: 0 })
  await live.close()
  active = undefined

  const mixedBody = {
    studies: [
      {
        protocolSection: {
          identificationModule: { nctId: 'NCT01234567', briefTitle: 'Fixture diabetes study' },
          statusModule: { overallStatus: 'COMPLETED', startDateStruct: { date: '2024-01' } },
          conditionsModule: { conditions: ['Diabetes'] },
          designModule: { studyType: 'INTERVENTIONAL' },
        },
        hasResults: true,
      },
      {
        protocolSection: {
          identificationModule: { nctId: 'bad-id', briefTitle: 'Fabricated malformed identity' },
        },
      },
      {
        protocolSection: {
          identificationModule: { nctId: 'NCT01234567', briefTitle: 'Fabricated duplicate identity' },
        },
      },
    ],
  }
  const mixed = await browser(`${root}/dist`, { fixtures: new Map([[endpoint, { body: mixedBody }]]) })
  active = mixed
  await mixed.nav('clinical-trials-search')
  const fixtureBefore = mixed.requestCount
  const mixedResult = await mixed.run()
  assert.equal(mixedResult.ok, true, mixedResult.error)
  const mixedDom = await semantic(mixed)
  assert.deepEqual({ state: mixedDom.state, requestBound: mixedDom.requestBound, validStudyCount: mixedDom.validStudyCount, malformedStudyCount: mixedDom.malformedStudyCount, duplicateStudyCount: mixedDom.duplicateStudyCount, visibleNctIds: mixedDom.visibleNctIds }, { state: 'partial', requestBound: 'true', validStudyCount: 1, malformedStudyCount: 1, duplicateStudyCount: 1, visibleNctIds: ['NCT01234567'] })
  assert.equal(mixedDom.text.includes('bad-id'), false)
  assert.equal(mixedDom.text.includes('Fabricated duplicate identity'), false)
  const exactFixtures = mixed.fixtureRequests.filter((request) => request.url === endpoint && request.method === 'GET').length
  assert.equal(exactFixtures, 1)
  assert.equal(mixed.requestCount - fixtureBefore, exactFixtures, 'Fixture-only ClinicalTrials.gov case must send zero live provider requests')
  assert.deepEqual(mixed.errors, [])
  report.checks.push({ id: 'clinical-trials-search', case: 'mixed malformed/duplicate NCT identity HTTP-200 fixture', source: 'synthetic fixture', semanticState: mixedDom.state, validStudies: 1, malformedStudies: 1, duplicateStudies: 1, malformedIdentityHidden: true, liveProviderRequests: 0 })
  await mixed.close()
  active = undefined

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close()
}

fs.writeFileSync(`${evidence}/clinical-trials-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/clinical-trials-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
