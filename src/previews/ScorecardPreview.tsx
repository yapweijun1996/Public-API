import { useId, useState } from 'react'
import { asRecord, CardEmpty, CardHeading, Facts, text } from './cardPrimitives'

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
function ScorecardBoard({ model }: { model: ReturnType<typeof scorecardModel> }) {
  const id = useId()
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(8)
  if (model.state === 'invalid') return <CardEmpty domain="security-scorecard" title="Security check data unavailable" detail="The response did not contain a usable check list. No security conclusion can be drawn."/>
  const checks = model.checks.filter((check) => filter === 'all' || (filter === 'scored' ? check.score !== undefined : check.score === undefined))
  const scored = model.checks.filter((check) => check.score !== undefined).length
  return <div className="domain-card diagnostic-workbench" data-domain-card="security-scorecard" data-result-state={model.state}>
    <CardHeading eyebrow="Repository security practices" title={model.repository ?? 'Repository not supplied'} description="Review individual evidence, not just the headline score.">
      <div className="diagnostic-score"><span>Provider aggregate</span><strong data-aggregate-score={model.score}>{model.score === undefined ? 'Not supplied' : `${model.score} / 10`}</strong></div>
    </CardHeading>
    <p className="domain-notice">These are heuristic checks, not a security certification. An inconclusive check is unknown, not zero; a high score does not prove the repository is safe.</p>
    <Facts items={[{ label: 'Scored checks', value: scored }, { label: 'Unscored checks', value: model.checks.length - scored }, { label: 'Provider scan date', value: model.date ?? 'Not supplied' }, { label: 'Scorecard version', value: model.version ?? 'Not supplied' }]}/>
    {model.commit && <p className="domain-note">Analyzed commit: <code>{model.commit}</code></p>}
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
export function ScorecardPreview({ data }: { data: unknown }) {
  const model = scorecardModel(data)
  return <ScorecardBoard key={`${model.repository}-${model.commit}-${model.date}`} model={model}/>
}
