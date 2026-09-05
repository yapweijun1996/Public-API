import { useEffect, useId, useState } from 'react'
import { asRecord, CardEmpty, CardHeading, CopyValue, Facts, text } from './cardPrimitives'

const indexValue = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
// Context offsets belong to context.text, not the full submitted sentence.
export function grammarContext(value: unknown) {
  const context = asRecord(value)
  const content = typeof context.text === 'string' ? context.text : undefined
  const offset = indexValue(context.offset)
  const length = indexValue(context.length)
  const boundary = (at: number) => !content || !(at > 0 && at < content.length && /[\uD800-\uDBFF]/.test(content[at - 1]) && /[\uDC00-\uDFFF]/.test(content[at]))
  const valid = content !== undefined && offset !== undefined && length !== undefined && offset + length <= content.length && boundary(offset) && boundary(offset + length)
  return { content, before: valid ? content.slice(0, offset) : undefined, marked: valid ? content.slice(offset, offset + length) : undefined, after: valid ? content.slice(offset + length) : undefined }
}
export function grammarModel(data: unknown) {
  const root = asRecord(data)
  const input = Array.isArray(root.matches) ? root.matches : undefined
  const matches = (input ?? []).flatMap((value, index) => {
    const row = asRecord(value)
    const message = text(row.message)
    if (!message) return []
    const rule = asRecord(row.rule)
    const replacements = Array.isArray(row.replacements) ? row.replacements.flatMap((item) => typeof asRecord(item).value === 'string' ? [asRecord(item).value as string] : []) : undefined
    return [{ index, message, title: text(row.shortMessage) ?? text(rule.description) ?? `Issue ${index + 1}`, category: text(asRecord(rule.category).name) ?? 'Uncategorized', rule: text(rule.id), context: grammarContext(row.context), replacements }]
  })
  const invalidRows = (input?.length ?? 0) - matches.length
  const incomplete = asRecord(root.warnings).incompleteResults === true
  const warning = text(asRecord(root.software).status)
  const state = !input || text(root.error) || input.length > 0 && !matches.length ? 'invalid' : incomplete || invalidRows || warning ? 'partial' : matches.length ? 'issues' : 'no-issues'
  return { state, matches, invalidRows, incomplete, warning, language: text(asRecord(root.language).name), version: text(asRecord(root.software).version) }
}
function GrammarBoard({ data }: { data: unknown }) {
  const model = grammarModel(data)
  const id = useId()
  const [filter, setFilter] = useState('')
  const [limit, setLimit] = useState(8)
  useEffect(() => { setFilter(''); setLimit(8) }, [data])
  if (model.state === 'invalid') return <CardEmpty domain="grammar-review" title="Grammar results unavailable" detail="The response did not contain a usable matches array. Missing results do not mean the text has no issues."/>
  const matches = model.matches.filter((match) => !filter || match.category === filter)
  const categories = [...new Set(model.matches.map((match) => match.category))]
  return <div className="domain-card diagnostic-workbench" data-domain-card="grammar-review" data-result-state={model.state}>
    <CardHeading eyebrow="Writing review" title={model.state === 'partial' ? 'Partial checking results' : model.matches.length ? `${model.matches.length} issues to review` : 'No issues returned'} description="Review the checker’s explanations and suggested replacements. Your original text is not changed automatically."/>
    {model.state === 'partial' && <p className="diagnostic-warning">The checker result is incomplete or includes a warning. Do not interpret an empty list as an all-clear.{model.invalidRows ? ` ${model.invalidRows} issue records could not be read.` : ''}{model.warning ? ` ${model.warning}` : ''}</p>}
    <Facts items={[{ label: 'Language checked', value: model.language ?? 'Not supplied' }, { label: 'Readable issues', value: model.matches.length }, { label: 'Checker version', value: model.version ?? 'Not supplied' }]}/>
    {model.state === 'no-issues' && <p className="domain-notice">No suggestions were returned by this check. This does not guarantee the text is error-free.</p>}
    {model.matches.length > 0 && <>
      <div className="domain-toolbar"><label htmlFor={id}>Filter writing issues</label><select id={id} value={filter} onChange={(event) => { setFilter(event.target.value); setLimit(8) }}><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><span role="status">{Math.min(limit, matches.length)} of {matches.length} issues shown</span></div>
      <ol className="diagnostic-list grammar-issues" role="list" aria-label="Writing issues">{matches.slice(0, limit).map((match) => <li key={match.index} data-issue-index={match.index + 1}>
        <header><div><span className="domain-eyebrow">Issue {match.index + 1} · {match.category}</span><h4>{match.title}</h4></div></header>
        <p className="diagnostic-description">{match.message}</p>
        {match.context.content !== undefined && <blockquote className="grammar-context">{match.context.marked !== undefined ? <>{match.context.before}<mark>{match.context.marked || '▏'}</mark>{match.context.after}</> : match.context.content}</blockquote>}
        <p className="domain-note">{match.context.marked !== undefined ? <>Flagged text: <code>{match.context.marked || '(insertion point)'}</code></> : 'An exact highlight is unavailable for this issue.'}</p>
        {match.replacements?.length ? <details className="domain-disclosure" open><summary>Suggested replacements for issue {match.index + 1}</summary><ul className="grammar-replacements">{match.replacements.map((replacement, index) => <li key={`${replacement}-${index}`}><code>{replacement || 'Delete the flagged text'}</code>{replacement && <CopyValue label={`replacement ${index + 1} for issue ${match.index + 1}`} value={replacement}/>}</li>)}</ul></details> : <p className="domain-note">{match.replacements ? 'No replacement suggested. Review the explanation manually.' : 'Replacement suggestions were not supplied.'}</p>}
        {match.rule && <details className="domain-disclosure"><summary>Rule identifier for issue {match.index + 1}</summary><code>{match.rule}</code></details>}
      </li>)}</ol>
      {matches.length > limit && <button type="button" className="domain-more" onClick={() => setLimit((count) => count + 16)}>Show more issues</button>}
    </>}
    <p className="domain-note">Powered by <a href="https://languagetool.org" target="_blank" rel="noreferrer">LanguageTool</a>. The free public endpoint is for human-driven checks, not automated requests. Text is sent to the provider when you run a check; do not submit confidential text.</p>
  </div>
}
export function GrammarPreview({ data }: { data: unknown }) {
  return <GrammarBoard data={data}/>
}
