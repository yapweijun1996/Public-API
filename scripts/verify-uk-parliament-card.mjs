import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live UK Parliament Members API from the Pages origin plus fixture-only semantic regressions',
  checks: [],
  errors: [],
}

const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const setControl = async (b, name, value) => {
  await b.ev(`(() => {
    const element = document.querySelector('[name=${JSON.stringify(name)}]')
    if (!element) throw new Error('Missing control ' + ${JSON.stringify(name)})
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)})
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })()`)
  await sleep(80)
}

const semanticDom = (b) => b.ev(`(() => {
  const shell = document.querySelector('.demo-preview')
  const card = shell?.querySelector('[data-domain-card="parliament-members"]')
  const row = card?.querySelector('[data-member-index="1"]')
  const facts = row ? Object.fromEntries([...row.querySelectorAll('.domain-facts > div')].map((item) => [item.querySelector('dt')?.textContent || '', item.querySelector('dd')?.textContent || ''])) : {}
  return {
    layout: shell?.dataset.previewLayout,
    fallback: shell?.dataset.ssotFallback,
    state: card?.dataset.resultState,
    requestValid: card?.dataset.requestContractValid,
    requestBound: card?.dataset.requestBound,
    requestContract: card?.dataset.requestContract,
    requestedName: card?.dataset.requestedName,
    requestedTake: Number(card?.dataset.requestedTake),
    requestedSkip: Number(card?.dataset.requestedSkip),
    totalResults: Number(card?.dataset.totalResults),
    providerTake: Number(card?.dataset.providerTake),
    providerSkip: Number(card?.dataset.providerSkip),
    providerRecords: Number(card?.dataset.providerRecordCount),
    validMembers: Number(card?.dataset.validMemberCount),
    invalidMembers: Number(card?.dataset.invalidMemberCount),
    duplicateMembers: Number(card?.dataset.duplicateMemberCount),
    requestMismatches: Number(card?.dataset.requestMismatchCount),
    countValid: card?.dataset.countContractValid,
    memberId: row ? Number(row.dataset.memberId) : null,
    partyId: row?.dataset.partyId === undefined ? null : Number(row.dataset.partyId),
    house: row?.dataset.house === undefined ? null : Number(row.dataset.house),
    membershipFromId: row?.dataset.membershipFromId === undefined ? null : Number(row.dataset.membershipFromId),
    active: row?.dataset.membershipActive,
    status: row?.dataset.membershipStatus,
    heading: row?.querySelector('h4')?.innerText || '',
    facts,
    text: card?.innerText || '',
    generic: (shell?.innerText || '').includes('UK Parliament Members record 1'),
  }
})()`)

const verifyMobileAx = async (b) => {
  await b.viewport(390, 844)
  const overflow = await b.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview')?.scrollWidth > document.querySelector('.demo-preview')?.clientWidth + 1,
    cardOverflow: document.querySelector('[data-domain-card="parliament-members"]')?.scrollWidth > document.querySelector('[data-domain-card="parliament-members"]')?.clientWidth + 1,
  })`)
  assert.equal(overflow.documentOverflow || overflow.previewOverflow || overflow.cardOverflow, false, JSON.stringify(overflow))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
}

let active
try {
  active = await browser(`${root}/dist`)
  await active.nav('uk-parliament-members')
  await setControl(active, 'query', 'Rishi')
  await setControl(active, 'limit', '3')
  const endpoint = await active.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  const parsedEndpoint = new URL(endpoint)
  assert.equal(parsedEndpoint.origin, 'https://members-api.parliament.uk')
  assert.equal(parsedEndpoint.pathname, '/api/Members/Search')
  assert.deepEqual([...parsedEndpoint.searchParams.keys()].sort(), ['Name', 'skip', 'take'].sort())
  assert.equal(parsedEndpoint.searchParams.get('Name'), 'Rishi')
  assert.equal(parsedEndpoint.searchParams.get('skip'), '0')
  assert.equal(parsedEndpoint.searchParams.get('take'), '3')

  const before = active.requestCount
  const result = await active.run()
  assert.equal(result.ok, true, result.error)
  assert.equal(active.requestCount - before, 1, 'UK Parliament verifier must issue exactly one live provider request')
  assert(Array.isArray(result.data?.items), 'UK Parliament response did not expose items')
  assert(result.data.items.length > 0, 'UK Parliament returned no current members for Rishi search')
  assert(result.data.items.length <= 3, `Expected at most 3 members, got ${result.data.items.length}`)
  assert.equal(result.data.take, 3)
  assert.equal(result.data.skip, 0)
  assert.equal(typeof result.data.totalResults, 'number')

  const expectedNeedle = 'rishi'
  for (const item of result.data.items) {
    const member = item?.value || {}
    const names = [member.nameDisplayAs, member.nameFullTitle, member.nameListAs, member.nameAddressAs].filter((value) => typeof value === 'string')
    assert(names.some((value) => value.normalize('NFKC').toLocaleLowerCase('en-GB').includes(expectedNeedle)), `Provider row did not acknowledge Name=Rishi: ${JSON.stringify(names)}`)
    assert.equal(typeof member.id, 'number')
    assert(Number.isSafeInteger(member.id) && member.id > 0)
  }

  const first = result.data.items[0]?.value || {}
  const membership = first.latestHouseMembership || {}
  const party = first.latestParty || {}
  const status = membership.membershipStatus || {}
  const liveDom = await semanticDom(active)
  assert.deepEqual(
    { layout: liveDom.layout, fallback: liveDom.fallback, state: liveDom.state, requestValid: liveDom.requestValid, requestBound: liveDom.requestBound, requestContract: liveDom.requestContract, requestedName: liveDom.requestedName, requestedTake: liveDom.requestedTake, requestedSkip: liveDom.requestedSkip },
    { layout: 'parliament-members', fallback: 'false', state: 'ready', requestValid: 'true', requestBound: 'true', requestContract: 'exact-uk-parliament-members-search-v2', requestedName: 'Rishi', requestedTake: 3, requestedSkip: 0 },
  )
  assert.equal(liveDom.totalResults, result.data.totalResults)
  assert.equal(liveDom.providerTake, result.data.take)
  assert.equal(liveDom.providerSkip, result.data.skip)
  assert.equal(liveDom.providerRecords, result.data.items.length)
  assert.equal(liveDom.validMembers, result.data.items.length)
  assert.equal(liveDom.invalidMembers, 0)
  assert.equal(liveDom.duplicateMembers, 0)
  assert.equal(liveDom.requestMismatches, 0)
  assert.equal(liveDom.countValid, 'true')
  assert.equal(liveDom.memberId, first.id)
  assert.equal(liveDom.partyId, party.id ?? null)
  assert.equal(liveDom.house, membership.house ?? null)
  assert.equal(liveDom.membershipFromId, membership.membershipFromId ?? null)
  assert.equal(liveDom.active, status.statusIsActive === undefined ? undefined : String(status.statusIsActive))
  assert.equal(liveDom.status, String(status.statusDescription || (status.statusIsActive === true ? 'Current Member' : status.statusIsActive === false ? 'Inactive membership' : 'Status not supplied')))
  assert.equal(liveDom.heading, String(first.nameDisplayAs || first.nameFullTitle || first.nameListAs || first.nameAddressAs || ''))
  assert.equal(liveDom.facts.Party, String(party.name || 'Party not supplied'))
  assert.equal(liveDom.facts.House, membership.house === 1 ? 'House of Commons' : membership.house === 2 ? 'House of Lords' : membership.house == null ? 'House not supplied' : `House ${membership.house}`)
  assert.equal(liveDom.facts['Membership from'], String(membership.membershipFrom || 'Not supplied'))
  assert.equal(liveDom.generic, false)
  await verifyMobileAx(active)
  assert.deepEqual(active.errors, [])
  report.checks.push({
    id: 'uk-parliament-members',
    case: 'live exact member-name search',
    source: 'live provider',
    liveProviderRequests: 1,
    retries: 0,
    transportStatus: 200,
    cors: 'browser request succeeded',
    semanticState: liveDom.state,
    requestIdentity: 'exact bodyless GET + displayed/executed URL equality + Name + skip=0 + take binding',
    returnedItems: result.data.items.length,
    totalResults: result.data.totalResults,
    rawToDomIdentity: true,
    mobileOverflow: false,
    unnamedControls: 0,
  })
  await active.close()
  active = undefined

  const baseUrl = 'https://members-api.parliament.uk/api/Members/Search?Name=Rishi&skip=0&take=3'
  const matching = { value: { id: 4483, nameDisplayAs: 'Rishi Sunak', latestParty: { id: 4, name: 'Conservative' }, latestHouseMembership: { house: 1 } } }
  const wrongName = { value: { id: 172, nameDisplayAs: 'Keir Starmer', latestParty: { id: 15, name: 'Labour' }, latestHouseMembership: { house: 1 } } }
  const cases = [
    {
      name: 'mixed wrong-name member identity',
      url: baseUrl,
      body: { items: [matching, wrongName], totalResults: 2, skip: 0, take: 3 },
      expectedState: 'partial',
      check: (dom) => {
        assert.equal(dom.requestMismatches, 1)
        assert.equal(dom.validMembers, 1)
        assert(dom.text.includes('Rishi Sunak'))
        assert.equal(dom.text.includes('Keir Starmer'), false)
      },
    },
    {
      name: 'all-wrong member identity',
      url: baseUrl,
      body: { items: [wrongName], totalResults: 1, skip: 0, take: 3 },
      expectedState: 'invalid',
      check: (dom) => assert.equal(dom.text.includes('Keir Starmer'), false),
    },
    {
      name: 'numeric-string pagination',
      url: baseUrl,
      body: { items: [matching], totalResults: '1', skip: '0', take: '3' },
      expectedState: 'partial',
      check: (dom) => assert.equal(dom.countValid, 'false'),
    },
    {
      name: 'request-bound zero-result search',
      url: 'https://members-api.parliament.uk/api/Members/Search?Name=zzzzzzzzzzzzzzzzzzzz&skip=0&take=3',
      query: 'zzzzzzzzzzzzzzzzzzzz',
      body: { items: [], totalResults: 0, skip: 0, take: 3 },
      expectedState: 'empty',
      check: (dom) => assert(dom.text.includes('zero current Commons or Lords members')),
    },
  ]

  for (const testCase of cases) {
    const fixtureBrowser = await browser(`${root}/dist`, { fixtures: new Map([[testCase.url, { body: testCase.body }]]) })
    active = fixtureBrowser
    await fixtureBrowser.nav('uk-parliament-members')
    await setControl(fixtureBrowser, 'query', testCase.query || 'Rishi')
    await setControl(fixtureBrowser, 'limit', '3')
    const fixtureBefore = fixtureBrowser.requestCount
    const fixtureResult = await fixtureBrowser.run()
    assert.equal(fixtureResult.ok, true, fixtureResult.error)
    const fixtureDom = await semanticDom(fixtureBrowser)
    assert.equal(fixtureDom.state, testCase.expectedState)
    testCase.check(fixtureDom)
    const exactFixtureRequests = fixtureBrowser.fixtureRequests.filter((request) => request.url === testCase.url && request.method === 'GET').length
    assert.equal(exactFixtureRequests, 1)
    assert.equal(fixtureBrowser.requestCount - fixtureBefore, exactFixtureRequests, 'Fixture-only cases must not send additional live provider requests')
    assert.deepEqual(fixtureBrowser.blockedProviders, [])
    assert.deepEqual(fixtureBrowser.errors, [])
    report.checks.push({ id: 'uk-parliament-members', case: `fixture-only ${testCase.name} HTTP-200`, semanticState: fixtureDom.state, exactFixtureRequests, liveProviderRequests: 0 })
    await fixtureBrowser.close()
    active = undefined
  }

  report.verdict = 'PASS'
} catch (error) {
  report.verdict = 'FAIL'
  report.error = String(error)
  if (active) report.errors.push(...active.errors.map(String))
} finally {
  if (active) await active.close().catch((error) => report.errors.push(String(error)))
}

fs.writeFileSync(`${evidence}/uk-parliament-card.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/uk-parliament-card.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
