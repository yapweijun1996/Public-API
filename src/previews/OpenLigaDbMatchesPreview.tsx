import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, finite, numericText, rows, text } from './cardPrimitives'
import { positiveSafeInteger, trimmedText } from './semanticValidation'

const finalKinds = ['AfterPenalties', 'AfterExtraTime', 'After90Minutes']

type OpenLigaRequestIdentity = {
  leagueShortcut: string
  leagueSeason: number
  groupOrderId: number
}

type BoundOpenLigaRequest = { request?: OpenLigaRequestIdentity; transportBound: boolean; invalidReason?: string }

const REQUEST_CONTRACT = 'exact-openligadb-matchday-v2'

const parseRequestIdentity = (requestUrl?: string): OpenLigaRequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'api.openligadb.de' || url.port || url.username || url.password || url.search || url.hash) return undefined
    const pathMatch = /^\/getmatchdata\/([^/]+)\/(\d+)\/(\d+)$/.exec(url.pathname)
    if (!pathMatch) return undefined
    const leagueShortcut = decodeURIComponent(pathMatch[1])
    const leagueSeason = Number(pathMatch[2])
    const groupOrderId = Number(pathMatch[3])
    if (!leagueShortcut || leagueShortcut.includes('/') || !Number.isSafeInteger(leagueSeason) || leagueSeason <= 0 || !Number.isSafeInteger(groupOrderId) || groupOrderId <= 0) return undefined
    const request = { leagueShortcut, leagueSeason, groupOrderId }
    const canonical = `https://api.openligadb.de/getmatchdata/${encodeURIComponent(request.leagueShortcut)}/${request.leagueSeason}/${request.groupOrderId}`
    return requestUrl === canonical ? request : undefined
  } catch {
    return undefined
  }
}

const bindOpenLigaRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundOpenLigaRequest => {
  if (!requestUrl) return { transportBound: false, invalidReason: 'The displayed request URL was unavailable, so the OpenLigaDB matchday identity could not be verified.' }
  const request = parseRequestIdentity(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The semantic result could not verify the exact executed OpenLigaDB league, season, and matchday request because the displayed URL was not canonical.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET OpenLigaDB matchday request.' }
  }
  const executed = parseRequestIdentity(executedRequest.url)
  if (!executed
    || executed.leagueShortcut !== request.leagueShortcut
    || executed.leagueSeason !== request.leagueSeason
    || executed.groupOrderId !== request.groupOrderId) {
    return { request, transportBound: false, invalidReason: 'The displayed OpenLigaDB request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const requestAttrs = (request: OpenLigaRequestIdentity, transportBound: boolean) => ({
  'data-request-bound': transportBound ? 'true' : 'false',
  'data-request-contract': REQUEST_CONTRACT,
  'data-requested-league-shortcut': request.leagueShortcut,
  'data-requested-league-season': request.leagueSeason,
  'data-requested-group-order-id': request.groupOrderId,
})

const matchResult = (value: unknown) => {
  const results = rows(value)
  return [...results].sort((a, b) => {
    const aKind = finalKinds.indexOf(text(a.resultTypeKind) ?? '')
    const bKind = finalKinds.indexOf(text(b.resultTypeKind) ?? '')
    if (aKind !== bKind) return (aKind < 0 ? 99 : aKind) - (bKind < 0 ? 99 : bKind)
    return (finite(b.resultOrderID) ?? -1) - (finite(a.resultOrderID) ?? -1)
  })[0]
}

const teamName = (value: unknown) => text(asRecord(value).teamName) ?? text(asRecord(value).shortName)

const matchesRequest = (match: Record<string, unknown>, request: OpenLigaRequestIdentity) => {
  const group = asRecord(match.group)
  return trimmedText(match.leagueShortcut) === request.leagueShortcut
    && positiveSafeInteger(match.leagueSeason) === request.leagueSeason
    && positiveSafeInteger(group.groupOrderID) === request.groupOrderId
}

export function OpenLigaDbMatchesPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const binding = bindOpenLigaRequest(requestUrl, executedRequest)
  if (binding.invalidReason) {
    return <CardEmpty domain="football-matchday" title="Invalid OpenLigaDB request context" detail={binding.invalidReason} state="invalid"/>
  }
  const request = binding.request!
  if (!Array.isArray(data)) {
    return <CardEmpty domain="football-matchday" title="Invalid OpenLigaDB response" detail="The matchday endpoint did not return the documented Match array." state="invalid"/>
  }
  if (!data.length) {
    if (binding.transportBound) return <CardEmpty domain="football-matchday" title="No football matches returned" detail="OpenLigaDB returned an empty Match array for the exact executed league, season, and matchday request." state="empty"/>
    return <div className="domain-card domain-empty openligadb-preview" data-domain-card="football-matchday" data-result-state="partial" {...requestAttrs(request, binding.transportBound)}><h3>OpenLigaDB execution evidence unavailable</h3><p>The displayed matchday request is valid, but semantic emptiness cannot be trusted until it is bound to the successful executed request.</p></div>
  }

  const providerMatches = data.map(asRecord)
  const identifiedMatches = providerMatches.filter((match) => positiveSafeInteger(match.matchID) !== undefined)
  const matches = identifiedMatches.filter((match) => matchesRequest(match, request))
  if (!matches.length) {
    return <CardEmpty domain="football-matchday" title="Invalid OpenLigaDB match identity" detail="The HTTP-success response did not contain any provider-owned match records bound to the executed league, season, and matchday request." state="invalid"/>
  }

  const malformedMatchCount = providerMatches.length - identifiedMatches.length
  const requestMismatchCount = identifiedMatches.length - matches.length
  const incompleteMatchCount = matches.filter((match) => !teamName(match.team1) || !teamName(match.team2)).length
  const resultState = !binding.transportBound || malformedMatchCount || requestMismatchCount || incompleteMatchCount ? 'partial' : 'ready'
  const first = matches[0]
  const leagueName = text(first.leagueName) ?? request.leagueShortcut
  const group = asRecord(first.group)
  const groupName = text(group.groupName) ?? `Matchday ${numericText(request.groupOrderId)}`

  return <div
    className="domain-card openligadb-preview"
    data-domain-card="football-matchday"
    data-result-state={resultState}
    data-request-contract-valid="true"
    {...requestAttrs(request, binding.transportBound)}
    data-provider-record-count={providerMatches.length}
    data-valid-match-count={matches.length}
    data-malformed-match-count={malformedMatchCount}
    data-request-mismatch-count={requestMismatchCount}
    data-incomplete-match-count={incompleteMatchCount}
    data-league-id={finite(first.leagueId)}
    data-league-shortcut={trimmedText(first.leagueShortcut)}
    data-league-season={positiveSafeInteger(first.leagueSeason)}
    data-group-order-id={positiveSafeInteger(group.groupOrderID)}
    data-provider-match-count={providerMatches.length}
    data-primary-match-id={positiveSafeInteger(first.matchID)}
  >
    <CardHeading
      eyebrow="OpenLigaDB · Matchday schedule and results"
      title={`${leagueName} · ${groupName}`}
      description="Each trusted record is bound to the executed league, season, and matchday request, then keeps provider team identity, kickoff time, match status, and typed result semantics."
    ><span className="domain-state">{resultState === 'ready' ? `${matches.length} matches ready` : `${matches.length} trusted of ${providerMatches.length}`} · season {request.leagueSeason}</span></CardHeading>
    {resultState === 'partial' && <p className="domain-note">{binding.transportBound ? 'This matchday response contains incomplete, malformed, or request-mismatched records. Only matches with provider-owned IDs and league/season/matchday identity matching the executed request are shown.' : 'The displayed matchday URL is canonical, but this render does not have successful execution evidence. Records are shown as unbound and cannot be promoted to ready.'}</p>}

    <ol className="sports-schedule-list" aria-label="OpenLigaDB football matches">{matches.map((match, index) => {
      const team1 = asRecord(match.team1)
      const team2 = asRecord(match.team2)
      const home = teamName(team1)
      const away = teamName(team2)
      const result = matchResult(match.matchResults)
      const resultKind = text(result?.resultTypeKind)
      const score1 = finite(result?.pointsTeam1)
      const score2 = finite(result?.pointsTeam2)
      const matchId = positiveSafeInteger(match.matchID)!
      const utc = text(match.matchDateTimeUTC)
      const local = text(match.matchDateTime)
      const finished = typeof match.matchIsFinished === 'boolean' ? match.matchIsFinished : undefined
      return <li
        key={matchId}
        data-match-index={index + 1}
        data-match-id={matchId}
        data-team1-id={finite(team1.teamId)}
        data-team2-id={finite(team2.teamId)}
        data-match-finished={finished === undefined ? undefined : String(finished)}
        data-kickoff-utc={utc}
        data-result-kind={resultKind}
        data-team1-score={score1}
        data-team2-score={score2}
      >
        <header>
          <div><small>Match {numericText(matchId)}</small><h4>{home ?? '—'} <span aria-hidden="true">vs</span><span className="sr-only">versus</span> {away ?? '—'}</h4></div>
          <span>{finished === true ? 'Finished' : finished === false ? 'Scheduled / in progress' : 'Status not supplied'}</span>
        </header>
        <div className="sports-score" aria-label={`${home ?? 'home team unavailable'} versus ${away ?? 'away team unavailable'} result`}>
          <strong>{home ?? '—'}</strong><b>{score1 === undefined ? '—' : numericText(score1)}</b>
          <span aria-hidden="true">–</span><span className="sr-only">to</span>
          <b>{score2 === undefined ? '—' : numericText(score2)}</b><strong>{away ?? '—'}</strong>
        </div>
        <Facts items={[
          { label: 'Kickoff · UTC', value: utc ? <time dateTime={utc}>{utc}</time> : 'Not supplied' },
          { label: 'Provider local kickoff', value: local ?? 'Not supplied' },
          { label: 'Provider time zone', value: text(match.timeZoneID) ?? 'Not supplied' },
          { label: 'Result type', value: resultKind ?? 'Not supplied' },
          { label: 'Result label', value: text(result?.resultName) ?? 'Not supplied' },
          { label: 'Goals returned', value: numericText(rows(match.goals).length) },
        ]}/>
      </li>
    })}</ol>
    <p className="domain-note">OpenLigaDB can return multiple typed results for one match, such as <code>HalfTime</code> and <code>After90Minutes</code>. The score above uses the most final typed result present; Raw JSON retains every provider result and goal event.</p>
  </div>
}
