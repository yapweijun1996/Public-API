import { useId, useState } from 'react'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, Facts, text } from './cardPrimitives'

const SCORECARD_REQUEST_CONTRACT = 'exact-openssf-scorecard-project-v2'

type ScorecardRequestBinding = {
  requestBound: boolean
  repository?: string
  invalidReason?: string
}

function scorecardRepositoryFromUrl(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.origin !== 'https://api.securityscorecards.dev' || url.search || url.hash || url.username || url.password) return undefined
    const match = /^\/projects\/github\.com\/([^/]+)\/([^/]+)$/.exec(url.pathname)
    if (!match) return undefined
    const owner = decodeURIComponent(match[1]).trim()
    const repo = decodeURIComponent(match[2]).trim()
    if (!owner || !repo || /[\/?#]/.test(owner) || /[\/?#]/.test(repo)) return undefined
    return 'github.com/' + owner + '/' + repo
  } catch { return undefined }
}

export function bindScorecardRequest(requestUrl?: string, executedRequest?: ExecutedRequestContext): ScorecardRequestBinding {
  const displayedRepository = scorecardRepositoryFromUrl(requestUrl)
  if (requestUrl && !displayedRepository) return { requestBound: false, invalidReason: 'The displayed request was not the exact supported OpenSSF Scorecard project endpoint.' }
  if (!executedRequest) return { requestBound: false, repository: displayedRepository }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return { requestBound: false, repository: displayedRepository, invalidReason: 'The successful response was not produced by the exact supported bodyless GET request.' }
  if (!requestUrl || executedRequest.url !== requestUrl) return { requestBound: false, repository: displayedRepository, invalidReason: 'The displayed OpenSSF request and executed request URL did not match.' }
  const executedRepository = scorecardRepositoryFromUrl(executedRequest.url)
  if (!executedRepository || executedRepository.toLowerCase() !== displayedRepository?.toLowerCase()) return { requestBound: false, repository: displayedRepository, invalidReason: 'The executed OpenSSF request did not preserve the exact repository identity.' }
  return { requestBound: true, repository: executedRepository }
}

// Scorecard's -1 sentinel means inconclusive, not a failing zero score.
export function scoreValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 ? value : undefined
}
export function evidenceUrl(value: unknown) {
  try {
    const url = new URL(text(value) ?? '')
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}
export function scorecardModel(data: unknown) {
  const root = asRecord(data)
  const input = Array.isArray(root.checks) ? root.checks : undefined
  const checks = (input ?? []).flatMap((value, index) => {
    const row = asRecord(value)
    const name = text(row.name)
    if (!name) return []
    const documentation = asRecord(row.documentation)
    return [{
      index, name, score: scoreValue(row.score),
      outcome: row.score === -1 ? 'Inconclusive' : row.score == null ? 'Not supplied' : scoreValue(row.score) === undefined ? 'Invalid score' : 'Scored',
      reason: text(row.reason), description: text(documentation.short), url: evidenceUrl(documentation.url),
      details: Array.isArray(row.details) ? row.details.filter((item): item is string => typeof item === 'string') : [],
    }]
  })
  const invalidRows = (input?.length ?? 0) - checks.length
  const state = !input || text(root.error) || input.length > 0 && !checks.length ? 'invalid' : invalidRows ? 'partial' : checks.length ? 'ready' : 'empty'
  return { state, checks, invalidRows, total: input?.length, score: scoreValue(root.score), repository: text(asRecord(root.repo).name), commit: text(asRecord(root.repo).commit), date: text(root.date), version: text(asRecord(root.scorecard).version) }
}
function ScorecardBoard({ model, binding, state }: { model: ReturnType<typeof scorecardModel>; binding: ScorecardRequestBinding; state: 'ready' | 'partial' }) {
  const id = useId()
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(8)
  const checks = model.checks.filter((check) => filter === 'all' || (filter === 'scored' ? check.score !== undefined : check.score === undefined))
  const scored = model.checks.filter((check) => check.score !== undefined).length
  return <div className="domain-card diagnostic-workbench" data-domain-card="security-scorecard" data-result-state={state} data-request-contract={SCORECARD_REQUEST_CONTRACT} data-request-bound={binding.requestBound ? 'true' : 'false'} data-request-repository={binding.repository} data-provider-repository={model.repository}>
    <CardHeading eyebrow="Repository security practices" title={model.repository ?? 'Repository not supplied'} description="Review individual evidence, not just the headline score.">
      <div className="diagnostic-score"><span>Provider aggregate</span><strong data-aggregate-score={model.score}>{model.score === undefined ? 'Not supplied' : `${model.score} / 10`}</strong></div>
    </CardHeading>
    <p className="domain-notice">These are heuristic checks, not a security certification. An inconclusive check is unknown, not zero; a high score does not prove the repository is safe.</p>
    <Facts items={[{ label: 'Scored checks', value: scored }, { label: 'Unscored checks', value: model.checks.length - scored }, { label: 'Provider scan date', value: model.date ?? 'Not supplied' }, { label: 'Scorecard version', value: model.version ?? 'Not supplied' }]}/>
    {model.commit && <p className="domain-note">Analyzed commit: <code>{model.commit}</code></p>}
    {state === 'partial' && !binding.requestBound && <p className="diagnostic-warning">Executed-request identity is unavailable, so these checks are not trusted as an exact repository result.</p>}
    {model.invalidRows > 0 && <p className="diagnostic-warning">{model.invalidRows} check records could not be read. The displayed list is incomplete.</p>}
    {model.checks.length === 0 ? <p className="domain-notice">No check records returned. This is not a clean security report.</p> : <>
      <div className="domain-toolbar"><label htmlFor={id}>Filter security checks</label><select id={id} value={filter} onChange={(event) => { setFilter(event.target.value); setLimit(8) }}><option value="all">All checks</option><option value="scored">Scored checks</option><option value="unscored">Inconclusive or unavailable</option></select><span role="status">{Math.min(limit, checks.length)} of {checks.length} checks shown</span></div>
      <ol className="diagnostic-list scorecard-checks" role="list" aria-label="Repository security checks">{checks.slice(0, limit).map((check) => <li key={`${check.name}-${check.index}`} data-check-name={check.name} data-score={check.score} data-check-outcome={check.outcome}>
        <header><div><span className="domain-eyebrow">Check {check.index + 1}</span><h4>{check.name}</h4></div><span className="domain-state">{check.score === undefined ? check.outcome : `${check.score} / 10`}</span></header>
        {check.score !== undefined && <meter min={0} max={10} value={check.score} aria-label={`${check.name} score`}>{check.score} out of 10</meter>}
        {check.description && <p className="diagnostic-description">{check.description}</p>}
        <p className="diagnostic-reason"><strong>Provider finding</strong>{check.reason ?? 'No finding text supplied.'}</p>
        {check.details.length > 0 && <details className="domain-disclosure"><summary>Evidence for {check.name}</summary><ul>{check.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul></details>}
        {check.url && <a className="diagnostic-link" href={check.url} target="_blank" rel="noreferrer">Guidance for {check.name}</a>}
      </li>)}</ol>
      {!checks.length && <p className="domain-notice">No checks match this filter.</p>}
      {checks.length > limit && <button className="domain-more" type="button" onClick={() => setLimit((count) => count + 16)}>Show more checks</button>}
    </>}
  </div>
}
function ScorecardBoundary({ state, title, detail, binding, providerRepository }: { state: 'invalid' | 'partial' | 'empty'; title: string; detail: string; binding: ScorecardRequestBinding; providerRepository?: string }) {
  return <div className="domain-card domain-empty" data-domain-card="security-scorecard" data-result-state={state} data-request-contract={SCORECARD_REQUEST_CONTRACT} data-request-bound={binding.requestBound ? 'true' : 'false'} data-request-repository={binding.repository} data-provider-repository={providerRepository}><h3>{title}</h3><p>{detail}</p></div>
}

export function ScorecardPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = scorecardModel(data)
  const binding = bindScorecardRequest(requestUrl, executedRequest)
  if (binding.invalidReason) return <ScorecardBoundary state="invalid" title="Security request identity unavailable" detail={binding.invalidReason} binding={binding} providerRepository={model.repository}/>
  if (model.state === 'invalid') return <ScorecardBoundary state="invalid" title="Security check data unavailable" detail="The response did not contain a usable check list. No security conclusion can be drawn." binding={binding} providerRepository={model.repository}/>
  const providerRepositoryMatches = Boolean(binding.repository && model.repository && binding.repository.toLowerCase() === model.repository.toLowerCase())
  if (binding.requestBound && !providerRepositoryMatches) return <ScorecardBoundary state="invalid" title="Repository identity mismatch" detail="The provider response did not identify the same repository as the exact executed OpenSSF request." binding={{ ...binding, requestBound: false }} providerRepository={model.repository}/>
  if (!model.checks.length) {
    if (binding.requestBound && providerRepositoryMatches) return <ScorecardBoundary state="empty" title="No security checks returned" detail="OpenSSF returned a request-bound zero-check result. This is not a clean security report." binding={binding} providerRepository={model.repository}/>
    return <ScorecardBoundary state="partial" title="Unbound security check result" detail="No check records returned, but exact executed-request and provider repository identity are not both available. This is not a clean security report." binding={binding} providerRepository={model.repository}/>
  }
  const state: 'ready' | 'partial' = model.state === 'ready' && binding.requestBound && providerRepositoryMatches ? 'ready' : 'partial'
  return <ScorecardBoard key={[model.repository, model.commit, model.date, binding.repository].join('-')} model={model} binding={binding} state={state}/>
}
