import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root, sleep } from './lib/pages-origin-browser.mjs'

const report = {
  origin: 'https://yapweijun1996.github.io',
  publication: 'unpublished local app bundle under the real GitHub Pages origin',
  source: 'live providers from the Pages origin',
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
const verifyMobileAx = async (b) => {
  await b.viewport(390, 844)
  const state = await b.ev(`({
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    previewOverflow: document.querySelector('.demo-preview').scrollWidth > document.querySelector('.demo-preview').clientWidth + 1,
  })`)
  assert.equal(state.documentOverflow || state.previewOverflow, false, JSON.stringify(state))
  const ax = await b.call('Accessibility.getFullAXTree')
  assert.equal(unnamed(ax.nodes).length, 0)
}
const finalKinds = ['AfterPenalties', 'AfterExtraTime', 'After90Minutes']
const selectOpenLigaResult = (results = []) => [...results].sort((a, b) => {
  const aIndex = finalKinds.indexOf(String(a.resultTypeKind || ''))
  const bIndex = finalKinds.indexOf(String(b.resultTypeKind || ''))
  const aPriority = aIndex < 0 ? 99 : aIndex
  const bPriority = bIndex < 0 ? 99 : bIndex
  return aPriority === bPriority ? Number(b.resultOrderID || -1) - Number(a.resultOrderID || -1) : aPriority - bPriority
})[0] || {}

let b
try {
  b = await browser(`${root}/dist`)

  await b.nav('openligadb-matches')
  await setControl(b, 'league', 'bl1')
  await setControl(b, 'season', '2025')
  await setControl(b, 'matchday', '1')
  const openLigaUrl = 'https://api.openligadb.de/getmatchdata/bl1/2025/1'
  const openLigaEndpoint = await b.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`)
  assert.equal(openLigaEndpoint, openLigaUrl)
  const openLigaRequestsBefore = b.requestCount
  const openLiga = await b.run()
  assert.equal(openLiga.ok, true, openLiga.error)
  assert.equal(b.requestCount - openLigaRequestsBefore, 1, 'OpenLigaDB verifier must issue exactly one live provider request')
  assert(Array.isArray(openLiga.data) && openLiga.data.length > 0, 'OpenLigaDB returned no matchday records')
  for (const providerMatch of openLiga.data) {
    assert.equal(providerMatch.leagueShortcut, 'bl1')
    assert.equal(providerMatch.leagueSeason, 2025)
    assert.equal(providerMatch.group?.groupOrderID, 1)
  }
  const match = openLiga.data[0]
  const expectedResult = selectOpenLigaResult(match.matchResults)
  const openLigaDom = await b.ev(`(() => {
    const shell = document.querySelector('.demo-preview')
    const card = shell.querySelector('.openligadb-preview')
    const row = card.querySelector('[data-match-index="1"]')
    const facts = Object.fromEntries([...row.querySelectorAll('.domain-facts > div')].map((item) => [item.querySelector('dt')?.textContent || '', item.querySelector('dd')?.textContent || '']))
    return {
      layout: shell.dataset.previewLayout,
      fallback: shell.dataset.ssotFallback,
      domain: card.dataset.domainCard,
      state: card.dataset.resultState,
      requestContractValid: card.dataset.requestContractValid,
      requestBound: card.dataset.requestBound,
      requestContract: card.dataset.requestContract,
      requestedLeague: card.dataset.requestedLeagueShortcut,
      requestedSeason: Number(card.dataset.requestedLeagueSeason),
      requestedGroup: Number(card.dataset.requestedGroupOrderId),
      requestMismatchCount: Number(card.dataset.requestMismatchCount),
      matchId: Number(row.dataset.matchId),
      team1Id: Number(row.dataset.team1Id),
      team2Id: Number(row.dataset.team2Id),
      finished: row.dataset.matchFinished,
      kickoffUtc: row.dataset.kickoffUtc || '',
      resultKind: row.dataset.resultKind || '',
      team1Score: row.dataset.team1Score === undefined ? null : Number(row.dataset.team1Score),
      team2Score: row.dataset.team2Score === undefined ? null : Number(row.dataset.team2Score),
      heading: row.querySelector('h4')?.innerText || '',
      facts,
      generic: (shell.innerText || '').includes('OpenLigaDB record 1'),
    }
  })()`)
  assert.equal(openLigaDom.layout, 'football-matchday')
  assert.equal(openLigaDom.fallback, 'false')
  assert.equal(openLigaDom.domain, 'football-matchday')
  assert.equal(openLigaDom.state, 'ready')
  assert.equal(openLigaDom.requestContractValid, 'true')
  assert.equal(openLigaDom.requestBound, 'true')
  assert.equal(openLigaDom.requestContract, 'exact-openligadb-matchday-v2')
  assert.equal(openLigaDom.requestedLeague, 'bl1')
  assert.equal(openLigaDom.requestedSeason, 2025)
  assert.equal(openLigaDom.requestedGroup, 1)
  assert.equal(openLigaDom.requestMismatchCount, 0)
  assert.equal(openLigaDom.matchId, Number(match.matchID))
  assert.equal(openLigaDom.team1Id, Number(match.team1?.teamId))
  assert.equal(openLigaDom.team2Id, Number(match.team2?.teamId))
  assert.equal(openLigaDom.finished, String(match.matchIsFinished))
  assert.equal(openLigaDom.kickoffUtc, String(match.matchDateTimeUTC || ''))
  assert.equal(openLigaDom.resultKind, String(expectedResult.resultTypeKind || ''))
  assert.equal(openLigaDom.team1Score, expectedResult.pointsTeam1 === undefined ? null : Number(expectedResult.pointsTeam1))
  assert.equal(openLigaDom.team2Score, expectedResult.pointsTeam2 === undefined ? null : Number(expectedResult.pointsTeam2))
  assert(openLigaDom.heading.includes(String(match.team1?.teamName || match.team1?.shortName || '')))
  assert(openLigaDom.heading.includes(String(match.team2?.teamName || match.team2?.shortName || '')))
  assert.equal(openLigaDom.facts['Result type'], String(expectedResult.resultTypeKind || 'Not supplied'))
  assert.equal(openLigaDom.facts['Goals returned'], String((match.goals || []).length))
  assert.equal(openLigaDom.generic, false)
  await verifyMobileAx(b)
  report.checks.push({ id: 'openligadb-matches', source: 'live provider', liveRequests: 1, layout: openLigaDom.layout, requestIdentity: 'exact displayed + executed bodyless GET league/season/matchday binding', requestContract: openLigaDom.requestContract, requestBound: openLigaDom.requestBound, matchIdentity: 'exact response match', typedResult: String(expectedResult.resultTypeKind || ''), score: 'exact selected typed result', mobileOverflow: false, unnamedControls: 0 })

  const openLigaFixture = [
    { matchID: 91001, matchDateTime: '2025-08-22T20:30:00', matchDateTimeUTC: '2025-08-22T18:30:00Z', timeZoneID: 'W. Europe Standard Time', leagueId: 4821, leagueName: '1. Fußball-Bundesliga 2025/2026', leagueSeason: 2025, leagueShortcut: 'bl1', group: { groupName: '1. Spieltag', groupOrderID: 1 }, team1: { teamId: 6, teamName: 'Home FC' }, team2: { teamId: 175, teamName: 'Away FC' }, matchIsFinished: false, matchResults: [], goals: [] },
    { matchID: 91002, leagueId: 9999, leagueName: 'Wrong league response', leagueSeason: 2025, leagueShortcut: 'bl2', group: { groupName: '1. Spieltag', groupOrderID: 1 }, team1: { teamId: 7, teamName: 'Fabricated Home' }, team2: { teamId: 8, teamName: 'Fabricated Away' }, matchIsFinished: false, matchResults: [], goals: [] },
  ]
  const openLigaPartial = await browser(`${root}/dist`, { fixtures: new Map([[openLigaUrl, { body: openLigaFixture }]]) })
  try {
    await openLigaPartial.nav('openligadb-matches')
    const partialResult = await openLigaPartial.run()
    assert.equal(partialResult.ok, true, partialResult.error)
    const partialDom = await openLigaPartial.ev(`(() => { const card=document.querySelector('.openligadb-preview'); return { state:card?.dataset.resultState, provider:Number(card?.dataset.providerRecordCount), valid:Number(card?.dataset.validMatchCount), malformed:Number(card?.dataset.malformedMatchCount), mismatched:Number(card?.dataset.requestMismatchCount), rows:document.querySelectorAll('.openligadb-preview [data-match-id]').length, text:card?.innerText||'' } })()`)
    assert.deepEqual({ state:partialDom.state, provider:partialDom.provider, valid:partialDom.valid, malformed:partialDom.malformed, mismatched:partialDom.mismatched, rows:partialDom.rows }, { state:'partial', provider:2, valid:1, malformed:0, mismatched:1, rows:1 })
    assert(partialDom.text.includes('Home FC'))
    assert.equal(partialDom.text.includes('Fabricated Home'), false)
    assert.deepEqual(openLigaPartial.fixtureRequests.map((request) => ({ url:request.url, source:request.source, status:request.status })), [{ url:openLigaUrl, source:'synthetic-fixture', status:200 }])
    await verifyMobileAx(openLigaPartial)
    report.checks.push({ id:'openligadb-matches', case:'mixed HTTP-200 request identity', source:'synthetic fixture', semanticState:'partial', providerRecords:2, validMatches:1, requestMismatches:1, fabricatedMatchHidden:true, providerLiveRequests:0, mobileOverflow:false, unnamedControls:0 })
  } finally {
    report.errors.push(...openLigaPartial.errors.map(String))
    await openLigaPartial.close()
  }

  const openLigaWrongOnly = await browser(`${root}/dist`, { fixtures: new Map([[openLigaUrl, { body: [openLigaFixture[1]] }]]) })
  try {
    await openLigaWrongOnly.nav('openligadb-matches')
    const wrongOnlyResult = await openLigaWrongOnly.run()
    assert.equal(wrongOnlyResult.ok, true, wrongOnlyResult.error)
    const wrongOnlyDom = await openLigaWrongOnly.ev(`(() => { const card=document.querySelector('[data-domain-card="football-matchday"]'); return { state:card?.dataset.resultState, text:card?.innerText||'' } })()`)
    assert.equal(wrongOnlyDom.state, 'invalid')
    assert(wrongOnlyDom.text.includes('did not contain any provider-owned match records bound to the executed league, season, and matchday request'))
    assert.equal(openLigaWrongOnly.requestCount, 1)
    assert.deepEqual(openLigaWrongOnly.fixtureRequests.map((request) => ({ url:request.url, source:request.source, status:request.status })), [{ url:openLigaUrl, source:'synthetic-fixture', status:200 }])
    report.checks.push({ id:'openligadb-matches', case:'all-wrong HTTP-200 request identity', source:'synthetic fixture', semanticState:'invalid', providerLiveRequests:0, fabricatedMatchHidden:true })
  } finally {
    report.errors.push(...openLigaWrongOnly.errors.map(String))
    await openLigaWrongOnly.close()
  }

  await b.nav('mlb-stats-api')
  const mlbInputType = await b.ev(`document.querySelector('input[name="date"]')?.type || ''`)
  assert.equal(mlbInputType, 'date')
  await setControl(b, 'date', '2025-04-15')
  assert.equal(await b.ev(`document.querySelector('[name="sportId"]') === null`), true, 'MLB Request Lab must not expose Minor League sport IDs under the MLB-labelled demo')
  const mlbEndpoint = new URL(await b.ev(`document.querySelector('.endpoint-box code')?.textContent || ''`))
  assert.equal(mlbEndpoint.searchParams.get('date'), '2025-04-15')
  assert.equal(mlbEndpoint.searchParams.get('sportId'), '1')
  assert.equal(mlbEndpoint.searchParams.has('teamId'), false)
  const mlbRequestsBefore = b.requestCount
  const mlb = await b.run()
  assert.equal(mlb.ok, true, mlb.error)
  assert.equal(b.requestCount - mlbRequestsBefore, 1, 'MLB verifier must issue exactly one live provider request for the bound-date case')
  const mlbGames = (mlb.data?.dates || []).flatMap((dateBlock) => dateBlock.games || [])
  assert(mlbGames.length > 0, 'MLB returned no games for 2025-04-15')
  const game = mlbGames[0]
  const mlbDom = await b.ev(`(() => {
    const shell = document.querySelector('.demo-preview')
    const card = shell.querySelector('.mlb-schedule-preview')
    const row = card.querySelector('[data-game-index="1"]')
    const facts = Object.fromEntries([...row.querySelectorAll('.domain-facts > div')].map((item) => [item.querySelector('dt')?.textContent || '', item.querySelector('dd')?.textContent || '']))
    return {
      layout: shell.dataset.previewLayout,
      fallback: shell.dataset.ssotFallback,
      domain: card.dataset.domainCard,
      state: card.dataset.resultState,
      requestContractValid: card.dataset.requestContractValid,
      requestedDate: card.dataset.requestedDate || '',
      requestedSportId: card.dataset.requestedSportId || '',
      requestMismatchCount: Number(card.dataset.requestMismatchCount),
      scheduleDate: card.dataset.scheduleDate || '',
      gamePk: Number(row.dataset.gamePk),
      awayTeamId: Number(row.dataset.awayTeamId),
      homeTeamId: Number(row.dataset.homeTeamId),
      status: row.dataset.gameStatus || '',
      start: row.dataset.gameStart || '',
      officialDate: row.dataset.officialDate || '',
      awayScore: row.dataset.awayScore === undefined ? null : Number(row.dataset.awayScore),
      homeScore: row.dataset.homeScore === undefined ? null : Number(row.dataset.homeScore),
      heading: row.querySelector('h4')?.innerText || '',
      facts,
      generic: (shell.innerText || '').includes('MLB Stats record 1'),
    }
  })()`)
  assert.equal(mlbDom.layout, 'baseball-schedule')
  assert.equal(mlbDom.fallback, 'false')
  assert.equal(mlbDom.domain, 'baseball-schedule')
  assert.equal(mlbDom.state, 'ready')
  assert.equal(mlbDom.requestContractValid, 'true')
  assert.equal(mlbDom.requestedDate, '2025-04-15')
  assert.equal(mlbDom.requestedSportId, '1')
  assert.equal(mlbDom.requestMismatchCount, 0)
  assert.equal(mlbDom.scheduleDate, String((mlb.data?.dates || [])[0]?.date || game.officialDate || ''))
  assert.equal(mlbDom.gamePk, Number(game.gamePk))
  assert.equal(mlbDom.awayTeamId, Number(game.teams?.away?.team?.id))
  assert.equal(mlbDom.homeTeamId, Number(game.teams?.home?.team?.id))
  assert.equal(mlbDom.status, String(game.status?.detailedState || game.status?.abstractGameState || 'Status not supplied'))
  assert.equal(mlbDom.start, String(game.gameDate || ''))
  assert.equal(mlbDom.officialDate, String(game.officialDate || ''))
  assert.equal(mlbDom.awayScore, game.teams?.away?.score === undefined ? null : Number(game.teams.away.score))
  assert.equal(mlbDom.homeScore, game.teams?.home?.score === undefined ? null : Number(game.teams.home.score))
  assert(mlbDom.heading.includes(String(game.teams?.away?.team?.name || '')))
  assert(mlbDom.heading.includes(String(game.teams?.home?.team?.name || '')))
  assert.equal(mlbDom.facts.Venue, String(game.venue?.name || 'Not supplied'))
  assert.equal(mlbDom.generic, false)
  await verifyMobileAx(b)
  report.checks.push({ id: 'mlb-stats-api', source: 'live provider', liveRequests: 1, nativeDateInput: true, sportSelectorAbsent: true, requestedSportId: '1', requestedDate: '2025-04-15', requestIdentity: 'exact GET + sportId/date binding', hiddenTeamIdAbsent: true, layout: mlbDom.layout, gameIdentity: 'exact request-bound response match', statusAndScores: 'exact response match', mobileOverflow: false, unnamedControls: 0 })

  await b.viewport(1280, 900)
  await setControl(b, 'date', '2025-01-01')
  const mlbEmpty = await b.run()
  assert.equal(mlbEmpty.ok, true, mlbEmpty.error)
  assert.equal(mlbEmpty.data?.totalGames, 0)
  assert.deepEqual(mlbEmpty.data?.dates, [])
  const mlbEmptyDom = await b.ev(`(() => { const card=document.querySelector('[data-domain-card="baseball-schedule"]'); return { state:card?.dataset.resultState, text:card?.innerText||'' } })()`)
  assert.equal(mlbEmptyDom.state, 'empty')
  await verifyMobileAx(b)
  report.checks.push({ id:'mlb-stats-api', case:'zero-game date', source:'live provider', requestedDate:'2025-01-01', providerTotalGames:0, providerDates:0, semanticState:'empty', mobileOverflow:false, unnamedControls:0 })

  const mlbFixtureUrl = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2025-04-15'
  const mlbFixture = { totalGames:2, totalGamesInProgress:0, dates:[{ date:'2025-04-15', totalGames:2, games:[
    { gamePk:777001, gameDate:'2025-04-15T23:10:00Z', officialDate:'2025-04-15', status:{ detailedState:'Final' }, teams:{ away:{ score:4, team:{ id:1, name:'Away Club' } }, home:{ score:2, team:{ id:2, name:'Home Club' } } }, venue:{ name:'Ballpark' }, seriesDescription:'Regular Season' },
    { gameDate:'2025-04-15T20:00:00Z', teams:{ away:{ team:{ name:'Fabricated Away' } }, home:{ team:{ name:'Fabricated Home' } } } },
  ] }] }
  const mlbPartial = await browser(`${root}/dist`, { fixtures:new Map([[mlbFixtureUrl, { body:mlbFixture }]]) })
  try {
    await mlbPartial.nav('mlb-stats-api')
    await setControl(mlbPartial, 'date', '2025-04-15')
    assert.equal(await mlbPartial.ev(`document.querySelector('[name="sportId"]') === null`), true)
    const partialResult = await mlbPartial.run()
    assert.equal(partialResult.ok, true, partialResult.error)
    const partialDom = await mlbPartial.ev(`(() => { const card=document.querySelector('.mlb-schedule-preview'); return { state:card?.dataset.resultState, requestValid:card?.dataset.requestContractValid, requestedDate:card?.dataset.requestedDate, requestedSportId:card?.dataset.requestedSportId, mismatched:Number(card?.dataset.requestMismatchCount), provider:Number(card?.dataset.providerGameCount), valid:Number(card?.dataset.validGameCount), invalid:Number(card?.dataset.invalidGameCount), incomplete:Number(card?.dataset.incompleteGameCount), countValid:card?.dataset.countContractValid, rows:document.querySelectorAll('.mlb-schedule-preview [data-game-pk]').length, text:card?.innerText||'' } })()`)
    assert.deepEqual({ state:partialDom.state, requestValid:partialDom.requestValid, requestedDate:partialDom.requestedDate, requestedSportId:partialDom.requestedSportId, mismatched:partialDom.mismatched, provider:partialDom.provider, valid:partialDom.valid, invalid:partialDom.invalid, incomplete:partialDom.incomplete, countValid:partialDom.countValid, rows:partialDom.rows }, { state:'partial', requestValid:'true', requestedDate:'2025-04-15', requestedSportId:'1', mismatched:0, provider:2, valid:1, invalid:1, incomplete:0, countValid:'true', rows:1 })
    assert(partialDom.text.includes('Away Club'))
    assert.equal(partialDom.text.includes('Fabricated Away'), false)
    assert.equal(partialDom.text.includes('Game ID not supplied'), false)
    assert.deepEqual(mlbPartial.fixtureRequests.map((request) => ({ url:request.url, source:request.source, status:request.status })), [{ url:mlbFixtureUrl, source:'synthetic-fixture', status:200 }])
    await verifyMobileAx(mlbPartial)
    report.checks.push({ id:'mlb-stats-api', case:'mixed HTTP-200 schedule', source:'synthetic fixture', semanticState:'partial', providerGames:2, validGames:1, invalidGames:1, fabricatedGameHidden:true, mobileOverflow:false, unnamedControls:0 })
  } finally {
    report.errors.push(...mlbPartial.errors.map(String))
    await mlbPartial.close()
  }

  const mlbWrongDateFixture = { totalGames:1, totalGamesInProgress:0, dates:[{ date:'2025-04-16', totalGames:1, games:[
    { gamePk:777102, gameDate:'2025-04-16T18:00:00Z', officialDate:'2025-04-16', status:{ detailedState:'Final' }, teams:{ away:{ score:5, team:{ id:3, name:'Wrong Away' } }, home:{ score:1, team:{ id:4, name:'Wrong Home' } } } },
  ] }] }
  const mlbWrongDate = await browser(`${root}/dist`, { fixtures:new Map([[mlbFixtureUrl, { body:mlbWrongDateFixture }]]) })
  try {
    await mlbWrongDate.nav('mlb-stats-api')
    await setControl(mlbWrongDate, 'date', '2025-04-15')
    const wrongDateResult = await mlbWrongDate.run()
    assert.equal(wrongDateResult.ok, true, wrongDateResult.error)
    const wrongDateDom = await mlbWrongDate.ev(`(() => { const card=document.querySelector('[data-domain-card="baseball-schedule"]'); return { state:card?.dataset.resultState, text:card?.innerText||'' } })()`)
    assert.equal(wrongDateDom.state, 'invalid')
    assert.equal(wrongDateDom.text.includes('Wrong Away'), false)
    assert.deepEqual(mlbWrongDate.fixtureRequests.map((request) => ({ url:request.url, source:request.source, status:request.status })), [{ url:mlbFixtureUrl, source:'synthetic-fixture', status:200 }])
    report.checks.push({ id:'mlb-stats-api', case:'all-wrong HTTP-200 date identity', source:'synthetic fixture', semanticState:'invalid', providerLiveRequests:0, fabricatedGameHidden:true })
  } finally {
    report.errors.push(...mlbWrongDate.errors.map(String))
    await mlbWrongDate.close()
  }

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

fs.writeFileSync(`${evidence}/sports-schedule-cards.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, evidence: `${evidence}/sports-schedule-cards.json` }, null, 2))
process.exit(report.verdict === 'PASS' ? 0 : 1)
