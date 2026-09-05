import { useId, useState } from 'react'
import { asRecord, CardEmpty, CardHeading, DateValue, displayed, Facts, isoDate, rows, text } from './cardPrimitives'

export function lifecycleModel(data: unknown) {
  const root = asRecord(data)
  const product = asRecord(root.result)
  return {
    product: text(product.label) ?? text(product.name) ?? 'Product not supplied',
    updated: text(root.last_modified),
    releases: rows(product.releases).map((release) => ({
      name: displayed(release.name), label: text(release.label),
      eol: typeof release.isEol === 'boolean' ? release.isEol : undefined,
      maintained: typeof release.isMaintained === 'boolean' ? release.isMaintained : undefined,
      lts: typeof release.isLts === 'boolean' ? release.isLts : undefined,
      releaseDate: isoDate(release.releaseDate), endDate: isoDate(release.eolFrom),
      activeEnd: isoDate(release.eoasFrom), extendedEnd: isoDate(release.eoesFrom),
      latest: text(asRecord(release.latest).name),
    })),
  }
}
function LifecycleBoard({ model }: { model: ReturnType<typeof lifecycleModel> }) {
  const id = useId()
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(8)
  const releases = model.releases.filter((release) => filter === 'all' || filter === 'maintained' && release.maintained === true || filter === 'eol' && release.eol === true || filter === 'lts' && release.lts === true)
  if (!model.releases.length) return <CardEmpty domain="release-lifecycle" state="empty" title="Release information unavailable" detail="No release cycles were returned. Support status has not been inferred."/>
  return <div className="domain-card lifecycle-workbench" data-domain-card="release-lifecycle" data-result-state="ready">
    <CardHeading eyebrow="Software lifecycle" title={model.product} description="Compare release cycles and support dates from the provider response."/>
    <Facts items={[{ label: 'Release cycles', value: model.releases.length }, { label: 'Some support available', value: model.releases.filter((r) => r.maintained === true).length }, { label: 'Marked end of life', value: model.releases.filter((r) => r.eol === true).length }, { label: 'Provider last modified', value: model.updated ?? 'Not supplied' }]}/>
    <div className="domain-toolbar"><label htmlFor={id}>Filter releases</label><select id={id} value={filter} onChange={(event) => { setFilter(event.target.value); setLimit(8) }}><option value="all">All releases</option><option value="maintained">Some support available</option><option value="eol">Marked end of life</option><option value="lts">LTS releases</option></select><span role="status">{Math.min(limit, releases.length)} of {releases.length} release cycles shown</span></div>
    <ol className="lifecycle-list" role="list" aria-label="Software release cycles">{releases.slice(0, limit).map((release, index) => <li key={`${release.name}-${index}`} data-release={release.name}>
      <header><div><span className="domain-eyebrow">Release cycle</span><h4>{model.product} {release.name}</h4>{release.label && <p>{release.label}</p>}</div><span className={`domain-state ${release.eol === true ? 'warning' : 'neutral'}`}>{release.eol === true ? 'End of life' : release.eol === false ? 'Not end of life' : 'EOL not supplied'}</span></header>
      <Facts items={[{ label: 'Support', value: release.maintained === true ? 'Some support available' : release.maintained === false ? 'Not maintained' : 'Not supplied' }, { label: 'LTS', value: release.lts === undefined ? 'Not supplied' : release.lts ? 'Yes' : 'No' }, { label: 'Latest in cycle', value: release.latest ?? 'Not supplied' }]}/>
      <div className="lifecycle-dates"><div><span>Released</span><DateValue value={release.releaseDate}/></div><span aria-hidden="true">→</span><div><span>End-of-life date</span><DateValue value={release.endDate}/></div></div>
      {(release.activeEnd || release.extendedEnd) && <details className="domain-disclosure"><summary>Support milestones for {model.product} {release.name}</summary><Facts items={[{ label: 'Active support ends', value: <DateValue value={release.activeEnd}/> }, { label: 'Extended support ends', value: <DateValue value={release.extendedEnd}/> }]}/></details>}
    </li>)}</ol>
    {!releases.length && <p className="domain-notice">No releases match this filter.</p>}
    {releases.length > limit && <button className="domain-more" type="button" onClick={() => setLimit((count) => count + 16)}>Show more releases</button>}
    <p className="domain-note">End-of-life and maintenance are separate provider flags. Some support may be extended or paid; this view is not a guarantee of security updates. Missing dates stay unknown.</p>
  </div>
}
export function LifecyclePreview({ data }: { data: unknown }) {
  const model = lifecycleModel(data)
  return <LifecycleBoard key={model.product} model={model}/>
}
