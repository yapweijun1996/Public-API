import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, finite, numericText, text } from './cardPrimitives'

type MlbRequest = { date: string; sportId: '1' }

const isIsoCalendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

const parseExecutedRequest = (executedRequest?: ExecutedRequestContext): MlbRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const entries = [...url.searchParams.entries()]
    const allowedKeys = ['sportId', 'date']
    const exactQuery = entries.length === allowedKeys.length
      && entries.every(([key]) => allowedKeys.includes(key))
      && allowedKeys.every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
    const sportId = url.searchParams.get('sportId')
    const date = url.searchParams.get('date')
    const valid = url.protocol === 'https:'
      && url.hostname === 'statsapi.mlb.com'
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && url.pathname === '/api/v1/schedule'
      && url.hash === ''
      && exactQuery
      && sportId === '1'
      && date !== null
      && isIsoCalendarDate(date)
    return valid ? { date, sportId: '1' } : undefined
  } catch {
    return undefined
  }
}

const recordLabel = (side: Record<string, unknown>) => {
  const record = asRecord(side.leagueRecord)
  const wins = finite(record.wins)
  const losses = finite(record.losses)
  return wins === undefined || losses === undefined ? 'Not supplied' : `${numericText(wins)}–${numericText(losses)}`
}

const teamName = (side: Record<string, unknown>) => text(asRecord(side.team).name)
const validGamePk = (value: unknown) => {
  const gamePk = finite(value)
  return gamePk !== undefined && Number.isInteger(gamePk) && gamePk > 0 ? gamePk : undefined
}

export function MlbSchedulePreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const request = parseExecutedRequest(executedRequest)
  if (!request) {
    return <CardEmpty domain="baseball-schedule" title="Invalid MLB schedule request identity" detail="The successful response could not be bound to the exact bodyless MLB schedule GET for sportId 1 and one ISO calendar date." state="invalid"/>
  }

  const root = asRecord(data)
  if (!Array.isArray(root.dates)) {
    return <CardEmpty domain="baseball-schedule" title="Invalid MLB schedule response" detail="MLB Stats did not return the documented dates array." state="invalid"/>
  }

  const providerTotalGames = finite(root.totalGames)
  const dateBlocks = root.dates.map(asRecord)
  const malformedDateBlockCount = dateBlocks.filter((dateBlock) => !Array.isArray(dateBlock.games) || !text(dateBlock.date)).length
  const mismatchedDateBlockCount = dateBlocks.filter((dateBlock) => text(dateBlock.date) !== request.date).length
  const providerGames = dateBlocks.flatMap((dateBlock) => Array.isArray(dateBlock.games)
    ? dateBlock.games.map((game) => ({ game: asRecord(game), dateBlock }))
    : [])

  if (!providerGames.length) {
    const validEmptyDateBlocks = dateBlocks.every((dateBlock) => text(dateBlock.date) === request.date && Array.isArray(dateBlock.games) && dateBlock.games.length === 0)
    if (providerTotalGames === 0 && (dateBlocks.length === 0 || validEmptyDateBlocks)) {
      return <CardEmpty domain="baseball-schedule" title="No MLB games returned" detail={`MLB Stats returned a zero-game MLB schedule for ${request.date}.`} state="empty"/>
    }
    return <CardEmpty domain="baseball-schedule" title="Invalid MLB schedule response" detail="The schedule response did not contain a usable games array bound to the executed MLB date request and consistent with its game count." state="invalid"/>
  }

  const requestBoundGames = providerGames.filter(({ game, dateBlock }) => {
    const blockDate = text(dateBlock.date)
    const officialDate = text(game.officialDate)
    return blockDate === request.date && (officialDate === undefined || officialDate === request.date)
  })
  const requestMismatchCount = providerGames.length - requestBoundGames.length
  const games = requestBoundGames.filter(({ game }) => validGamePk(game.gamePk) !== undefined)
  if (!games.length) {
    return <CardEmpty domain="baseball-schedule" title="Invalid MLB game records" detail="The schedule response contained games but none had a provider-owned gamePk identity bound to the executed MLB date request." state="invalid"/>
  }

  const invalidGameCount = requestBoundGames.length - games.length
  const incompleteGameCount = games.filter(({ game }) => {
    const teams = asRecord(game.teams)
    return !teamName(asRecord(teams.away)) || !teamName(asRecord(teams.home))
  }).length
  const countContractValid = providerTotalGames !== undefined && providerTotalGames === providerGames.length
  const resultState = invalidGameCount || incompleteGameCount || malformedDateBlockCount || mismatchedDateBlockCount || requestMismatchCount || !countContractValid ? 'partial' : 'ready'

  const inProgress = finite(root.totalGamesInProgress)
  const firstGame = games[0].game

  return <div
    className="domain-card mlb-schedule-preview"
    data-domain-card="baseball-schedule"
    data-result-state={resultState}
    data-request-contract-valid="true"
    data-requested-date={request.date}
    data-requested-sport-id={request.sportId}
    data-schedule-date={request.date}
    data-provider-total-games={providerTotalGames}
    data-provider-game-count={providerGames.length}
    data-valid-game-count={games.length}
    data-invalid-game-count={invalidGameCount}
    data-incomplete-game-count={incompleteGameCount}
    data-malformed-date-block-count={malformedDateBlockCount}
    data-mismatched-date-block-count={mismatchedDateBlockCount}
    data-request-mismatch-count={requestMismatchCount}
    data-count-contract-valid={String(countContractValid)}
    data-provider-games-in-progress={inProgress}
    data-primary-game-pk={validGamePk(firstGame.gamePk)}
  >
    <CardHeading
      eyebrow="MLB Stats · Schedule"
      title={`${request.date} MLB schedule`}
      description="Games are bound to the executed MLB sportId 1 date request and preserve provider game identity, UTC start time, status, home/away identity, venue, series context, and scores only when supplied."
    ><span className="domain-state">{resultState === 'ready' ? `${numericText(games.length)} games ready` : `${numericText(games.length)} usable of ${numericText(providerGames.length)}`}{inProgress === undefined ? '' : ` · ${numericText(inProgress)} in progress`}</span></CardHeading>
    {resultState === 'partial' && <p className="domain-note">This schedule response is incomplete, malformed, or contains records outside the executed MLB date request. Only request-bound games with provider-owned <code>gamePk</code> identity are shown; unavailable team identity stays unavailable rather than being invented.</p>}

    <ol className="sports-schedule-list" aria-label="MLB schedule games">{games.map(({ game }, index) => {
      const teams = asRecord(game.teams)
      const away = asRecord(teams.away)
      const home = asRecord(teams.home)
      const awayTeam = asRecord(away.team)
      const homeTeam = asRecord(home.team)
      const status = asRecord(game.status)
      const venue = asRecord(game.venue)
      const awayName = text(awayTeam.name)
      const homeName = text(homeTeam.name)
      const awayScore = finite(away.score)
      const homeScore = finite(home.score)
      const gamePk = validGamePk(game.gamePk)!
      const gameDate = text(game.gameDate)
      const detailedState = text(status.detailedState) ?? text(status.abstractGameState) ?? 'Status not supplied'
      const awayAccessible = awayName ?? 'away team unavailable'
      const homeAccessible = homeName ?? 'home team unavailable'
      return <li
        key={gamePk}
        data-game-index={index + 1}
        data-game-pk={gamePk}
        data-away-team-id={finite(awayTeam.id)}
        data-home-team-id={finite(homeTeam.id)}
        data-game-status={detailedState}
        data-game-start={gameDate}
        data-official-date={text(game.officialDate)}
        data-away-score={awayScore}
        data-home-score={homeScore}
      >
        <header>
          <div><small>Game {numericText(gamePk)} · {text(game.seriesDescription) ?? 'Series not supplied'}</small><h4>{awayName ?? '—'} <span aria-hidden="true">at</span><span className="sr-only">at</span> {homeName ?? '—'}</h4></div>
          <span>{detailedState}</span>
        </header>
        <div className="sports-score" aria-label={`${awayAccessible} at ${homeAccessible} score`}>
          <strong>{awayName ?? '—'}</strong><b>{awayScore === undefined ? '—' : numericText(awayScore)}</b>
          <span aria-hidden="true">–</span><span className="sr-only">to</span>
          <b>{homeScore === undefined ? '—' : numericText(homeScore)}</b><strong>{homeName ?? '—'}</strong>
        </div>
        <Facts items={[
          { label: 'Start · UTC', value: gameDate ? <time dateTime={gameDate}>{gameDate}</time> : 'Not supplied' },
          { label: 'Venue', value: text(venue.name) ?? 'Not supplied' },
          { label: 'Away record · W–L', value: recordLabel(away) },
          { label: 'Home record · W–L', value: recordLabel(home) },
          { label: 'Series game', value: finite(game.seriesGameNumber) === undefined || finite(game.gamesInSeries) === undefined ? 'Not supplied' : `${numericText(finite(game.seriesGameNumber)!)} of ${numericText(finite(game.gamesInSeries)!)}` },
          { label: 'Scheduled innings', value: finite(game.scheduledInnings) === undefined ? 'Not supplied' : numericText(finite(game.scheduledInnings)!) },
        ]}/>
      </li>
    })}</ol>
    <p className="domain-note">This is MLB's schedule surface, not play-by-play. The demo is intentionally fixed to sportId 1 so Minor League schedules cannot be presented as MLB. A dash means the provider did not supply that field; the card does not invent a 0–0 score or fabricate missing team identity.</p>
  </div>
}
