import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const openLiga = apiCatalog.find((candidate) => candidate.id === 'openligadb-matches')
const mlb = apiCatalog.find((candidate) => candidate.id === 'mlb-stats-api')
if (!openLiga || !mlb) throw new Error('Missing sports schedule fixtures')

describe('sports schedule semantic previews', () => {
  afterEach(cleanup)

  const openLigaRequest = openLiga.buildUrl({ league: 'bl1', season: '2025', matchday: '1' })
  const mlbRequest = (date = '2025-04-15', suffix = ''): ExecutedRequestContext => ({
    url: `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}${suffix}`,
    method: 'GET',
  })

  it('keeps OpenLigaDB halftime and final result semantics distinct', () => {
    render(<ResponseDemoPreview api={openLiga} requestUrl={openLigaRequest} executedRequest={{ url: openLigaRequest, method: 'GET' }} data={[{
      matchID: 77257,
      matchDateTime: '2025-08-23T15:30:00',
      matchDateTimeUTC: '2025-08-23T13:30:00Z',
      timeZoneID: 'W. Europe Standard Time',
      leagueId: 4821,
      leagueName: '1. Fußball-Bundesliga 2025/2026',
      leagueSeason: 2025,
      leagueShortcut: 'bl1',
      group: { groupName: '1. Spieltag', groupOrderID: 1 },
      team1: { teamId: 6, teamName: 'Bayer 04 Leverkusen' },
      team2: { teamId: 175, teamName: 'TSG Hoffenheim' },
      matchIsFinished: true,
      matchResults: [
        { resultName: 'Halbzeit', pointsTeam1: 1, pointsTeam2: 1, resultOrderID: 1, resultTypeKind: 'HalfTime' },
        { resultName: 'Endergebnis', pointsTeam1: 1, pointsTeam2: 2, resultOrderID: 2, resultTypeKind: 'After90Minutes' },
      ],
      goals: [{ goalID: 1 }, { goalID: 2 }, { goalID: 3 }],
    }]}/>)

    const preview = screen.getByRole('region', { name: 'OpenLigaDB' })
    expect(preview).toHaveAttribute('data-preview-layout', 'football-matchday')
    const card = preview.querySelector('.openligadb-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-contract-valid', 'true')
    expect(card).toHaveAttribute('data-requested-league-shortcut', 'bl1')
    expect(card).toHaveAttribute('data-requested-league-season', '2025')
    expect(card).toHaveAttribute('data-requested-group-order-id', '1')
    const match = preview.querySelector('[data-match-id="77257"]')
    expect(match).toHaveAttribute('data-result-kind', 'After90Minutes')
    expect(match).toHaveAttribute('data-team1-score', '1')
    expect(match).toHaveAttribute('data-team2-score', '2')
    expect(preview).toHaveTextContent('Bayer 04 Leverkusen')
    expect(preview).toHaveTextContent('TSG Hoffenheim')
    expect(preview).toHaveTextContent('Result typeAfter90Minutes')
    expect(preview).toHaveTextContent('Goals returned3')
    expect(preview).toHaveTextContent('Raw JSON retains every provider result')
    expect(preview).not.toHaveTextContent('OpenLigaDB record 1')
  })

  it('fails OpenLigaDB malformed HTTP-success shapes closed and marks malformed rows partial', () => {
    const { rerender } = render(<ResponseDemoPreview api={openLiga} requestUrl={openLigaRequest} executedRequest={{ url: openLigaRequest, method: 'GET' }} data={{ matches: [] }}/>)
    let preview = screen.getByRole('region', { name: 'OpenLigaDB' })
    expect(preview.querySelector('[data-domain-card="football-matchday"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={openLiga} requestUrl={openLigaRequest} executedRequest={{ url: openLigaRequest, method: 'GET' }} data={[]}/>)
    preview = screen.getByRole('region', { name: 'OpenLigaDB' })
    expect(preview.querySelector('[data-domain-card="football-matchday"]')).toHaveAttribute('data-result-state', 'empty')

    rerender(<ResponseDemoPreview api={openLiga} requestUrl={openLigaRequest} executedRequest={{ url: openLigaRequest, method: 'GET' }} data={[
      { matchID: 1001, leagueName: 'Test League', leagueShortcut: 'bl1', leagueSeason: 2025, group: { groupName: '1. Matchday', groupOrderID: 1 }, team1: { teamId: 1, teamName: 'Home FC' }, team2: { teamId: 2, teamName: 'Away FC' }, matchIsFinished: false, matchResults: [], goals: [] },
      { leagueName: 'Drifted row', team1: { teamName: 'Fabricated Home' }, team2: { teamName: 'Fabricated Away' } },
    ]}/>)
    preview = screen.getByRole('region', { name: 'OpenLigaDB' })
    const card = preview.querySelector('.openligadb-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-match-count', '1')
    expect(card).toHaveAttribute('data-malformed-match-count', '1')
    expect(card).toHaveAttribute('data-request-mismatch-count', '0')
    expect(preview.querySelectorAll('[data-match-id]')).toHaveLength(1)
    expect(preview).toHaveTextContent('Home FC')
    expect(preview).not.toHaveTextContent('Fabricated Home')
  })

  it('binds OpenLigaDB rows to the exact executed league, season, and matchday request', () => {
    const correct = { matchID: 2001, leagueName: 'Bound League', leagueShortcut: 'bl1', leagueSeason: 2025, group: { groupName: '1. Matchday', groupOrderID: 1 }, team1: { teamId: 1, teamName: 'Bound Home' }, team2: { teamId: 2, teamName: 'Bound Away' }, matchIsFinished: false, matchResults: [], goals: [] }
    const wrong = { matchID: 2002, leagueName: 'Wrong League', leagueShortcut: 'bl2', leagueSeason: 2025, group: { groupName: '1. Matchday', groupOrderID: 1 }, team1: { teamId: 3, teamName: 'Wrong Home' }, team2: { teamId: 4, teamName: 'Wrong Away' }, matchIsFinished: false, matchResults: [], goals: [] }
    const { rerender } = render(<ResponseDemoPreview api={openLiga} requestUrl={openLigaRequest} executedRequest={{ url: openLigaRequest, method: 'GET' }} data={[correct, wrong]}/>)

    let preview = screen.getByRole('region', { name: 'OpenLigaDB' })
    let card = preview.querySelector('.openligadb-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-mismatch-count', '1')
    expect(card).toHaveAttribute('data-valid-match-count', '1')
    expect(preview.querySelectorAll('[data-match-id]')).toHaveLength(1)
    expect(preview).toHaveTextContent('Bound Home')
    expect(preview).not.toHaveTextContent('Wrong Home')

    rerender(<ResponseDemoPreview api={openLiga} requestUrl={openLigaRequest} executedRequest={{ url: openLigaRequest, method: 'GET' }} data={[wrong]}/>)
    preview = screen.getByRole('region', { name: 'OpenLigaDB' })
    expect(preview.querySelector('[data-domain-card="football-matchday"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('did not contain any provider-owned match records bound to the executed league, season, and matchday request')

    rerender(<ResponseDemoPreview api={openLiga} requestUrl={`${openLigaRequest}?unexpected=1`} data={[correct]}/>)
    preview = screen.getByRole('region', { name: 'OpenLigaDB' })
    expect(preview.querySelector('[data-domain-card="football-matchday"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('could not verify the exact executed OpenLigaDB')
  })

  it('requires exact executed OpenLigaDB transport evidence before semantic readiness', () => {
    const correct = { matchID: 3001, leagueName: 'Bound League', leagueShortcut: 'bl1', leagueSeason: 2025, group: { groupName: '1. Matchday', groupOrderID: 1 }, team1: { teamId: 1, teamName: 'Bound Home' }, team2: { teamId: 2, teamName: 'Bound Away' }, matchIsFinished: false, matchResults: [], goals: [] }
    const { rerender } = render(<ResponseDemoPreview api={openLiga} requestUrl={openLigaRequest} data={[correct]}/>)

    let preview = screen.getByRole('region', { name: 'OpenLigaDB' })
    let card = preview.querySelector('.openligadb-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-request-contract', 'exact-openligadb-matchday-v2')

    rerender(<ResponseDemoPreview api={openLiga} requestUrl={openLigaRequest} executedRequest={{ url: openLigaRequest, method: 'POST' }} data={[correct]}/>)
    preview = screen.getByRole('region', { name: 'OpenLigaDB' })
    expect(preview.querySelector('[data-domain-card="football-matchday"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={openLiga} requestUrl={openLigaRequest} executedRequest={{ url: openLigaRequest, method: 'GET', body: { unexpected: true } }} data={[correct]}/>)
    preview = screen.getByRole('region', { name: 'OpenLigaDB' })
    expect(preview.querySelector('[data-domain-card="football-matchday"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={openLiga} requestUrl={openLigaRequest} executedRequest={{ url: 'https://api.openligadb.de/getmatchdata/bl1/2025/2', method: 'GET' }} data={[correct]}/>)
    preview = screen.getByRole('region', { name: 'OpenLigaDB' })
    expect(preview.querySelector('[data-domain-card="football-matchday"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={openLiga} requestUrl={openLigaRequest} executedRequest={{ url: openLigaRequest, method: 'GET' }} data={[correct]}/>)
    preview = screen.getByRole('region', { name: 'OpenLigaDB' })
    card = preview.querySelector('.openligadb-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
  })

  it('does not invent zero scores for scheduled MLB games', () => {
    render(<ResponseDemoPreview api={mlb} executedRequest={mlbRequest('2026-09-09')} data={{
      totalGames: 1,
      totalGamesInProgress: 0,
      dates: [{
        date: '2026-09-09',
        games: [{
          gamePk: 824226,
          gameDate: '2026-09-09T17:10:00Z',
          officialDate: '2026-09-09',
          status: { detailedState: 'Scheduled' },
          teams: {
            away: { team: { id: 142, name: 'Minnesota Twins' }, leagueRecord: { wins: 68, losses: 76 } },
            home: { team: { id: 116, name: 'Detroit Tigers' }, leagueRecord: { wins: 66, losses: 78 } },
          },
          venue: { id: 2394, name: 'Comerica Park' },
          gamesInSeries: 3,
          seriesGameNumber: 3,
          seriesDescription: 'Regular Season',
          scheduledInnings: 9,
        }],
      }],
    }}/>)

    const preview = screen.getByRole('region', { name: 'MLB Stats' })
    expect(preview).toHaveAttribute('data-preview-layout', 'baseball-schedule')
    const game = preview.querySelector('[data-game-pk="824226"]')
    expect(game).toHaveAttribute('data-game-status', 'Scheduled')
    expect(game).not.toHaveAttribute('data-away-score')
    expect(game).not.toHaveAttribute('data-home-score')
    expect(preview).toHaveTextContent('Minnesota Twins')
    expect(preview).toHaveTextContent('Detroit Tigers')
    expect(preview).toHaveTextContent('Away record · W–L68–76')
    expect(preview).toHaveTextContent('Home record · W–L66–78')
    expect(preview).toHaveTextContent('does not invent a 0–0 score')
    expect(preview).not.toHaveTextContent('MLB Stats record 1')
  })

  it('fails malformed MLB HTTP-success shapes closed and preserves only provider-owned game identity', () => {
    const { rerender } = render(<ResponseDemoPreview api={mlb} executedRequest={mlbRequest()} data={{ totalGames: 0 }}/>)
    let preview = screen.getByRole('region', { name: 'MLB Stats' })
    expect(preview.querySelector('[data-domain-card="baseball-schedule"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={mlb} executedRequest={mlbRequest()} data={{ totalGames: 0, dates: [] }}/>)
    preview = screen.getByRole('region', { name: 'MLB Stats' })
    expect(preview.querySelector('[data-domain-card="baseball-schedule"]')).toHaveAttribute('data-result-state', 'empty')

    rerender(<ResponseDemoPreview api={mlb} executedRequest={mlbRequest()} data={{ totalGames: 2, dates: [{ date: '2025-04-15', games: [
      { gamePk: 777001, gameDate: '2025-04-15T23:10:00Z', status: { detailedState: 'Final' }, teams: { away: { score: 4, team: { id: 1, name: 'Away Club' } }, home: { score: 2, team: { id: 2, name: 'Home Club' } } } },
      { gameDate: '2025-04-15T20:00:00Z', teams: { away: { team: { name: 'Fabricated Away' } }, home: { team: { name: 'Fabricated Home' } } } },
    ] }] }}/>)
    preview = screen.getByRole('region', { name: 'MLB Stats' })
    const card = preview.querySelector('.mlb-schedule-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-game-count', '2')
    expect(card).toHaveAttribute('data-valid-game-count', '1')
    expect(card).toHaveAttribute('data-invalid-game-count', '1')
    expect(preview.querySelectorAll('[data-game-pk]')).toHaveLength(1)
    expect(preview).toHaveTextContent('Away Club')
    expect(preview).not.toHaveTextContent('Fabricated Away')
    expect(preview).not.toHaveTextContent('Game ID not supplied')
  })

  it('marks identifiable MLB games with missing team identity partial without inventing team names', () => {
    render(<ResponseDemoPreview api={mlb} executedRequest={mlbRequest()} data={{ totalGames: 1, dates: [{ date: '2025-04-15', games: [{
      gamePk: 777002, gameDate: '2025-04-15T20:00:00Z', status: { detailedState: 'Scheduled' }, teams: { away: { team: { id: 1 } }, home: { team: { id: 2, name: 'Home Club' } } },
    }] }] }}/>)
    const preview = screen.getByRole('region', { name: 'MLB Stats' })
    const card = preview.querySelector('.mlb-schedule-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-incomplete-game-count', '1')
    expect(preview).not.toHaveTextContent('Away team')
    expect(preview).toHaveTextContent('—')
  })

  it('binds MLB schedules to the exact executed MLB date request and rejects minor-league or wrong-date payloads', () => {
    const correct = { gamePk: 777101, officialDate: '2025-04-15', gameDate: '2025-04-15T18:00:00Z', status: { detailedState: 'Final' }, teams: { away: { team: { id: 1, name: 'Bound Away' }, score: 3 }, home: { team: { id: 2, name: 'Bound Home' }, score: 2 } } }
    const wrong = { gamePk: 777102, officialDate: '2025-04-16', gameDate: '2025-04-16T18:00:00Z', status: { detailedState: 'Final' }, teams: { away: { team: { id: 3, name: 'Wrong Away' }, score: 5 }, home: { team: { id: 4, name: 'Wrong Home' }, score: 1 } } }
    const { rerender } = render(<ResponseDemoPreview api={mlb} executedRequest={mlbRequest()} data={{
      totalGames: 2,
      dates: [
        { date: '2025-04-15', totalGames: 1, games: [correct] },
        { date: '2025-04-16', totalGames: 1, games: [wrong] },
      ],
    }}/>)

    let preview = screen.getByRole('region', { name: 'MLB Stats' })
    let card = preview.querySelector('.mlb-schedule-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-contract-valid', 'true')
    expect(card).toHaveAttribute('data-requested-date', '2025-04-15')
    expect(card).toHaveAttribute('data-requested-sport-id', '1')
    expect(card).toHaveAttribute('data-request-mismatch-count', '1')
    expect(preview.querySelectorAll('[data-game-pk]')).toHaveLength(1)
    expect(preview).toHaveTextContent('Bound Away')
    expect(preview).not.toHaveTextContent('Wrong Away')

    rerender(<ResponseDemoPreview api={mlb} executedRequest={mlbRequest()} data={{ totalGames: 1, dates: [{ date: '2025-04-16', totalGames: 1, games: [wrong] }] }}/>)
    preview = screen.getByRole('region', { name: 'MLB Stats' })
    expect(preview.querySelector('[data-domain-card="baseball-schedule"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Wrong Away')

    rerender(<ResponseDemoPreview api={mlb} executedRequest={mlbRequest('2025-04-15', '&hydrate=team')} data={{ totalGames: 1, dates: [{ date: '2025-04-15', totalGames: 1, games: [correct] }] }}/>)
    preview = screen.getByRole('region', { name: 'MLB Stats' })
    expect(preview.querySelector('[data-domain-card="baseball-schedule"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={mlb} executedRequest={{ url: 'https://statsapi.mlb.com/api/v1/schedule?sportId=11&date=2025-04-15', method: 'GET' }} data={{ totalGames: 1, dates: [{ date: '2025-04-15', totalGames: 1, games: [correct] }] }}/>)
    preview = screen.getByRole('region', { name: 'MLB Stats' })
    expect(preview.querySelector('[data-domain-card="baseball-schedule"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('preserves completed MLB schedule scores when the provider supplies them', () => {
    render(<ResponseDemoPreview api={mlb} executedRequest={mlbRequest()} data={{
      totalGames: 1,
      dates: [{ date: '2025-04-15', games: [{
        gamePk: 777001,
        gameDate: '2025-04-15T23:10:00Z',
        status: { detailedState: 'Final' },
        teams: {
          away: { score: 4, team: { id: 1, name: 'Away Club' }, leagueRecord: { wins: 10, losses: 8 } },
          home: { score: 2, team: { id: 2, name: 'Home Club' }, leagueRecord: { wins: 9, losses: 9 } },
        },
        venue: { name: 'Ballpark' },
        seriesDescription: 'Regular Season',
      }] }],
    }}/>)
    const game = screen.getByRole('region', { name: 'MLB Stats' }).querySelector('[data-game-pk="777001"]')
    expect(game).toHaveAttribute('data-away-score', '4')
    expect(game).toHaveAttribute('data-home-score', '2')
    expect(screen.getByRole('region', { name: 'MLB Stats' })).toHaveTextContent('Final')
  })
})
