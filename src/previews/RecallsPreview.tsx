import { useEffect, useId, useState } from 'react'
import { asRecord, CardEmpty, CardHeading, Facts, text } from './cardPrimitives'

const flag = (value: unknown) => typeof value === 'boolean' ? value : undefined
const flagLabel = (value?: boolean) => value === undefined ? 'Not supplied' : value ? 'Flagged by provider' : 'Not flagged by provider'
export function recallQuery(requestUrl?: string) {
  try {
    const url = new URL(requestUrl ?? '')
    if (url.origin !== 'https://api.nhtsa.gov' || url.pathname !== '/recalls/recallsByVehicle') return undefined
    return ['modelYear', 'make', 'model'].map((key) => url.searchParams.get(key)?.trim()).filter(Boolean).join(' ') || undefined
  } catch { return undefined }
}
export function recallsModel(data: unknown) {
  const root = asRecord(data)
  const input = Array.isArray(root.results) ? root.results : undefined
  const count = typeof root.Count === 'number' && Number.isSafeInteger(root.Count) && root.Count >= 0 ? root.Count : undefined
  const recalls = (input ?? []).flatMap((value, index) => {
    const row = asRecord(value)
    const campaign = text(row.NHTSACampaignNumber)
    if (!campaign) return []
    return [{
      index, campaign, component: text(row.Component), manufacturer: text(row.Manufacturer), make: text(row.Make), model: text(row.Model), year: text(row.ModelYear),
      // Keep provider dates verbatim: this endpoint returned DD/MM/YYYY. Do not guess locale or reorder ambiguous dates.
      received: text(row.ReportReceivedDate), summary: text(row.Summary), consequence: text(row.Consequence), remedy: text(row.Remedy), notes: text(row.Notes),
      parkIt: flag(row.parkIt), parkOutside: flag(row.parkOutSide), ota: flag(row.overTheAirUpdate),
    }]
  })
  const invalidRows = (input?.length ?? 0) - recalls.length
  const incompleteRecords = recalls.filter((recall) => !recall.summary || !recall.consequence || !recall.remedy).length
  const countMismatch = input !== undefined && count !== undefined && count !== input.length
  const state = !input || text(root.error) || text(root.Error) || input.length > 0 && !recalls.length ? 'invalid' : invalidRows || incompleteRecords || countMismatch ? 'partial' : recalls.length ? 'ready' : 'empty'
  return { state, count, recalls, invalidRows, incompleteRecords, countMismatch }
}
export function RecallsPreview({ data, requestUrl }: { data: unknown; requestUrl?: string }) {
  const model = recallsModel(data)
  const id = useId()
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(4)
  useEffect(() => { setQuery(''); setLimit(4) }, [data, requestUrl])
  const scope = recallQuery(requestUrl)
  if (model.state === 'invalid') return <CardEmpty domain="vehicle-recalls" title="Recall records unavailable" detail="A usable campaign list was not returned. Do not interpret this as no recalls; verify the vehicle with NHTSA or its manufacturer."/>
  const needle = query.trim().toLowerCase()
  const recalls = model.recalls.filter((recall) => !needle || [recall.campaign, recall.component, recall.summary, recall.consequence, recall.remedy].some((value) => value?.toLowerCase().includes(needle)))
  return <div className="domain-card diagnostic-workbench" data-domain-card="vehicle-recalls" data-result-state={model.state}>
    <CardHeading eyebrow="U.S. vehicle recall campaigns" title={scope ?? 'Vehicle recall report'} description="Read the defect, safety consequence and repair instructions for each returned campaign."/>
    <p className="domain-notice">This is a model-level search, not a VIN repair-status check. It cannot confirm that your specific vehicle is affected, repaired or safe. <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noreferrer">Check your VIN with NHTSA</a> and follow the manufacturer’s instructions.</p>
    <Facts items={[{ label: 'Readable campaign records', value: model.recalls.length }, { label: 'Provider result count', value: model.count ?? 'Not supplied' }, { label: 'Do-not-drive flags', value: `${model.recalls.filter((recall) => recall.parkIt === true).length} flagged · ${model.recalls.filter((recall) => recall.parkIt === undefined).length} unknown` }, { label: 'Park-outside flags', value: `${model.recalls.filter((recall) => recall.parkOutside === true).length} flagged · ${model.recalls.filter((recall) => recall.parkOutside === undefined).length} unknown` }]}/>
    {model.state === 'partial' && <p className="diagnostic-warning">The response is incomplete.{model.invalidRows ? ` ${model.invalidRows} campaign records could not be read.` : ''}{model.incompleteRecords ? ` ${model.incompleteRecords} records lack a full defect, consequence or remedy.` : ''}{model.countMismatch ? ' The provider count differs from the supplied list.' : ''} Verify the full campaign with NHTSA.</p>}
    {model.state === 'empty' ? <p className="domain-notice">No campaign records were returned for this query. Check the make, model and year, then verify the VIN; this is not a safety clearance.</p> : <>
      <div className="domain-toolbar"><label htmlFor={id}>Filter recall campaigns</label><input id={id} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(4) }} placeholder="Campaign, component or keyword"/><span role="status">{Math.min(limit, recalls.length)} of {recalls.length} records shown</span></div>
      <ol className="diagnostic-list recall-campaigns" role="list" aria-label="Vehicle recall campaigns">{recalls.slice(0, limit).map((recall) => <li key={`${recall.campaign}-${recall.index}`} data-campaign-id={recall.campaign}>
        <header><div><span className="domain-eyebrow">NHTSA campaign</span><h4>{recall.campaign}</h4><p className="diagnostic-description">{recall.component ?? 'Component not supplied'}</p></div></header>
        {(recall.parkIt || recall.parkOutside) && <p className="diagnostic-warning">{recall.parkIt && <strong>Do not drive — provider flag. </strong>}{recall.parkOutside && <strong>Park outside — provider flag. </strong>}Follow the official campaign instructions.</p>}
        <Facts items={[{ label: 'Make', value: recall.make ?? 'Not supplied' }, { label: 'Model', value: recall.model ?? 'Not supplied' }, { label: 'Model year', value: recall.year ?? 'Not supplied' }, { label: 'Received (provider date)', value: recall.received ?? 'Not supplied' }]}/>
        <div className="recall-narrative">
          <section data-recall-field="Summary"><h5>What is the defect?</h5><p>{recall.summary ?? 'Defect summary not supplied.'}</p></section>
          <section data-recall-field="Consequence"><h5>Why does it matter?</h5><p>{recall.consequence ?? 'Safety consequence not supplied.'}</p></section>
          <section data-recall-field="Remedy"><h5>What should owners do?</h5><p>{recall.remedy ?? 'Remedy not supplied. Contact the manufacturer or NHTSA for instructions.'}</p></section>
        </div>
        <details className="domain-disclosure"><summary>Additional details for {recall.campaign}</summary>
          <Facts items={[{ label: 'Manufacturer', value: recall.manufacturer ?? 'Not supplied' }, { label: 'Do-not-drive flag', value: flagLabel(recall.parkIt) }, { label: 'Park-outside flag', value: flagLabel(recall.parkOutside) }, { label: 'Over-the-air update flag', value: flagLabel(recall.ota) }]}/>
          <p>{recall.notes ?? 'No additional provider notes supplied.'}</p>
        </details>
      </li>)}</ol>
      {!recalls.length && <p className="domain-notice">No campaigns match this filter. The original response still contains {model.recalls.length} readable records.</p>}
      {recalls.length > limit && <button className="domain-more" type="button" onClick={() => setLimit((count) => count + 8)}>Show more campaigns</button>}
    </>}
  </div>
}
