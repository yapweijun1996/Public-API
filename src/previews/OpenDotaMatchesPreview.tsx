import { asRecord, CardEmpty, CardHeading, Facts, finite, numericText, text } from './cardPrimitives'

const MAX_VISIBLE_MATCHES = 12

const epochIso = (value: unknown) => {
  const seconds = finite(value)
  if (seconds === undefined) return undefined
  const date = new Date(seconds * 1000)
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
}

const utcLabel = (iso: string | undefined) => {
  if (!iso) return 'Not supplied'
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return 'Not supplied'
  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)} UTC`
}

const durationLabel = (value: unknown) => {
  const seconds = finite(value)
  if (seconds === undefined || seconds < 0) return 'Not supplied'
  const whole = Math.round(seconds)
  const minutes = Math.floor(whole / 60)
  const remainder = whole % 60
  return `${minutes}m ${remainder}s`
}

const teamLabel = (name: unknown, id: unknown, side: 'Radiant' | 'Dire') => {
  const supplied = text(name)
  if (supplied) return supplied
  const teamId = finite(id)
  return teamId === undefined ? `${side} team` : `${side} team ${numericText(teamId)}`
}

export function OpenDotaMatchesPreview({ data }: { data: unknown }) {
  if (!Array.isArray(data)) return <CardEmpty domain="pro-match-results" title="Invalid professional match response" detail="OpenDota did not return the expected proMatches array." state="invalid"/>
  if (!data.length) return <CardEmpty domain="pro-match-results" title="No professional matches returned" detail="OpenDota returned no professional match records for this request." state="empty"/>

  const providerMatches = data.map(asRecord)
  const matches = providerMatches.filter((match) => finite(match.match_id) !== undefined)
  if (!matches.length) return <CardEmpty domain="pro-match-results" title="Invalid professional match response" detail="OpenDota returned match rows without provider-owned match identifiers." state="invalid"/>

  const invalidMatchCount = data.length - matches.length
  const state = invalidMatchCount ? 'partial' : 'ready'
  const visible = matches.slice(0, MAX_VISIBLE_MATCHES)
  const firstId = finite(matches[0].match_id)
  return <div
    className="domain-card opendota-matches-preview"
    data-domain-card="pro-match-results"
    data-result-state={state}
    data-provider-match-count={data.length}
    data-valid-match-count={matches.length}
    data-invalid-match-count={invalidMatchCount}
    data-visible-match-count={visible.length}
    data-primary-match-id={firstId}
    data-truncated={matches.length > visible.length ? 'true' : 'false'}
  >
    <CardHeading
      eyebrow="OpenDota · Professional matches"
      title={`${matches.length} provider-returned match${matches.length === 1 ? '' : 'es'}`}
      description="Team identity, match-end kill counts, winner, league, series identifiers, start time, and duration are preserved with provider semantics."
    ><span className="domain-state">{state === 'partial' ? 'Partial match batch' : 'Match semantics'}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">Some provider rows were missing the OpenDota <code>match_id</code> identity and are excluded from the trusted match list.</p>}

    <ol className="opendota-match-list" aria-label="OpenDota professional match results">
      {visible.map((match, index) => {
        const matchId = finite(match.match_id)
        const radiantTeamId = finite(match.radiant_team_id)
        const direTeamId = finite(match.dire_team_id)
        const leagueId = finite(match.leagueid)
        const seriesId = finite(match.series_id)
        const seriesType = finite(match.series_type)
        const radiantKills = finite(match.radiant_score)
        const direKills = finite(match.dire_score)
        const radiantWin = typeof match.radiant_win === 'boolean' ? match.radiant_win : undefined
        const radiant = teamLabel(match.radiant_name, match.radiant_team_id, 'Radiant')
        const dire = teamLabel(match.dire_name, match.dire_team_id, 'Dire')
        const winner = radiantWin === undefined ? 'Not supplied' : radiantWin ? radiant : dire
        const startedAt = epochIso(match.start_time)
        const durationSeconds = finite(match.duration)
        return <li
          key={`${matchId}-${index}`}
          data-match-index={index + 1}
          data-match-id={matchId}
          data-radiant-team-id={radiantTeamId}
          data-dire-team-id={direTeamId}
          data-league-id={leagueId}
          data-series-id={seriesId}
          data-series-type={seriesType}
          data-radiant-kills={radiantKills}
          data-dire-kills={direKills}
          data-radiant-win={radiantWin === undefined ? undefined : String(radiantWin)}
          data-start-time={startedAt}
          data-duration-seconds={durationSeconds}
        >
          <header>
            <div><small>{text(match.league_name) ?? 'League not supplied'} · Match {numericText(matchId!)}</small><h4>{radiant} <span aria-hidden="true">vs</span><span className="sr-only">versus</span> {dire}</h4></div>
            <span>{winner === 'Not supplied' ? 'Winner not supplied' : `Winner · ${winner}`}</span>
          </header>
          <div className="opendota-score" aria-label={`${radiant} versus ${dire} match-end kill counts`}>
            <div><span>Radiant</span><strong>{radiant}</strong><b>{radiantKills === undefined ? '—' : numericText(radiantKills)} <small>kills</small></b></div>
            <div><span>Dire</span><strong>{dire}</strong><b>{direKills === undefined ? '—' : numericText(direKills)} <small>kills</small></b></div>
          </div>
          <Facts items={[
            { label: 'Started', value: startedAt ? <time dateTime={startedAt}>{utcLabel(startedAt)}</time> : 'Not supplied' },
            { label: 'Duration', value: durationLabel(match.duration) },
            { label: 'League ID', value: leagueId === undefined ? 'Not supplied' : numericText(leagueId) },
            { label: 'Series ID', value: seriesId === undefined ? 'Not supplied' : numericText(seriesId) },
            { label: 'Series type code', value: seriesType === undefined ? 'Not supplied' : numericText(seriesType) },
            { label: 'Winner', value: winner },
          ]}/>
        </li>
      })}
    </ol>
    {matches.length > visible.length && <p className="domain-note">Showing the first {visible.length} of {matches.length} provider-returned matches. Raw JSON retains the complete response.</p>}
    <p className="domain-note">OpenDota defines <code>radiant_score</code> and <code>dire_score</code> as match-end kill counts, not a series score. <code>radiant_win</code> is the winner field. Numeric series type is kept as the provider code without inventing a best-of format.</p>
  </div>
}
