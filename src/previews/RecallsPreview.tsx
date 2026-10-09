import { useEffect, useId, useState } from 'react'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, Facts, text } from './cardPrimitives'
import { nonNegativeSafeInteger, trimmedText } from './semanticValidation'

type RecallRequest = {
  make: string
  model: string
  year: number
}

const flag = (value: unknown) => typeof value === 'boolean' ? value : undefined
const flagLabel = (value?: boolean) => value === undefined ? 'Not supplied' : value ? 'Flagged by provider' : 'Not flagged by provider'
const normalizedVehicleText = (value: string) => value.trim().toLocaleLowerCase('en-US')

const requestIdentity = (requestUrl?: string): RecallRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const entries = [...url.searchParams.entries()]
    const expectedKeys = ['make', 'model', 'modelYear']
    if (url.protocol !== 'https:' || url.hostname !== 'api.nhtsa.gov' || url.port || url.username || url.password || url.hash
      || url.pathname !== '/recalls/recallsByVehicle'
      || entries.length !== expectedKeys.length
      || entries.some(([key]) => !expectedKeys.includes(key))
      || expectedKeys.some((key) => url.searchParams.getAll(key).length !== 1)) return undefined
    const make = url.searchParams.get('make')
    const model = url.searchParams.get('model')
    const yearText = url.searchParams.get('modelYear')
    if (!make || make !== make.trim() || !model || model !== model.trim() || !yearText || !/^\d{4}$/.test(yearText)) return undefined
    const year = Number(yearText)
    if (!Number.isSafeInteger(year) || year < 1949 || String(year) !== yearText) return undefined
    return { make, model, year }
  } catch { return undefined }
}

const executedRequestIdentity = (executedRequest?: ExecutedRequestContext): RecallRequest | undefined => {
  if (!executedRequest || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return undefined
  return requestIdentity(executedRequest.url)
}

export function recallQuery(requestUrl?: string) {
  const request = requestIdentity(requestUrl)
  return request ? `${request.year} ${request.make} ${request.model}` : undefined
}

const providerModelYear = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 1949 && value <= 9999 ? value : undefined
  const year = trimmedText(value)
  if (!year || !/^\d{4}$/.test(year)) return undefined
  const parsed = Number(year)
  return Number.isSafeInteger(parsed) && parsed >= 1949 && String(parsed) === year ? parsed : undefined
}

export function recallsModel(data: unknown, request?: RecallRequest) {
  const root = asRecord(data)
  const input = Array.isArray(root.results) ? root.results : undefined
  const count = nonNegativeSafeInteger(root.Count)
  let invalidRows = 0
  let mismatchedRows = 0
  const recalls = (input ?? []).flatMap((value, index) => {
    const row = asRecord(value)
    const campaign = trimmedText(row.NHTSACampaignNumber)
    if (!campaign) {
      invalidRows += 1
      return []
    }
    const make = trimmedText(row.Make)
    const model = trimmedText(row.Model)
    const yearNumber = providerModelYear(row.ModelYear)
    if (request && (!make || !model || yearNumber !== request.year
      || normalizedVehicleText(make) !== normalizedVehicleText(request.make)
      || normalizedVehicleText(model) !== normalizedVehicleText(request.model))) {
      mismatchedRows += 1
      return []
    }
    return [{
      index, campaign, component: text(row.Component), manufacturer: text(row.Manufacturer), make, model, year: yearNumber === undefined ? undefined : String(yearNumber),
      // Keep provider dates verbatim: this endpoint currently returns DD/MM/YYYY. Do not guess locale or reorder ambiguous dates.
      received: text(row.ReportReceivedDate), summary: text(row.Summary), consequence: text(row.Consequence), remedy: text(row.Remedy), notes: text(row.Notes),
      parkIt: flag(row.parkIt), parkOutside: flag(row.parkOutSide), ota: flag(row.overTheAirUpdate),
    }]
  })
  const incompleteRecords = recalls.filter((recall) => !recall.summary || !recall.consequence || !recall.remedy).length
  const countContract = input !== undefined && count !== undefined && count === input.length
  let state: 'ready' | 'partial' | 'empty' | 'invalid' = 'invalid'
  let reason: string | undefined
  if (!request) {
    reason = 'The response is not bound to the exact bodyless NHTSA make/model/model-year recall request.'
  } else if (!input || text(root.error) || text(root.Error)) {
    reason = 'NHTSA returned HTTP-success data without a usable recall results array.'
  } else if (input.length === 0) {
    if (count === 0) state = 'empty'
    else reason = 'NHTSA returned an empty recall page without a trustworthy zero-result count.'
  } else if (!recalls.length) {
    reason = mismatchedRows
      ? 'NHTSA returned recall rows, but none match the executed make, model, and model year.'
      : 'NHTSA returned recall rows, but none had a trustworthy campaign identity.'
  } else if (!countContract || invalidRows || mismatchedRows || incompleteRecords) {
    state = 'partial'
    reason = 'Only request-matching campaigns with trustworthy identity are shown; incomplete or mismatched evidence is withheld.'
  } else {
    state = 'ready'
  }
  return { state, reason, count, recalls, invalidRows, mismatchedRows, incompleteRecords, countContract, providerResultCount: input?.length ?? 0, request }
}

export function RecallsPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const request = executedRequestIdentity(executedRequest)
  const model = recallsModel(data, request)
  const id = useId()
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(4)
  useEffect(() => { setQuery(''); setLimit(4) }, [data, executedRequest?.url])
  const scope = request ? `${request.year} ${request.make} ${request.model}` : undefined
  const evidence = {
    'data-result-state': model.state,
    'data-request-bound': String(Boolean(request)),
    'data-request-method': request ? 'GET' : undefined,
    'data-request-make': request?.make,
    'data-request-model': request?.model,
    'data-request-model-year': request?.year,
    'data-provider-result-count': model.providerResultCount,
    'data-provider-count': model.count,
    'data-count-contract': String(model.countContract),
    'data-valid-record-count': model.recalls.length,
    'data-invalid-record-count': model.invalidRows,
    'data-mismatched-record-count': model.mismatchedRows,
    'data-incomplete-record-count': model.incompleteRecords,
  }
  if (model.state === 'invalid') return <div className="domain-card domain-empty" data-domain-card="vehicle-recalls" {...evidence}><h3>Recall records unavailable</h3><p>{model.reason} Do not interpret this as no recalls; verify the vehicle with NHTSA or its manufacturer.</p></div>
  const needle = query.trim().toLowerCase()
  const recalls = model.recalls.filter((recall) => !needle || [recall.campaign, recall.component, recall.summary, recall.consequence, recall.remedy].some((value) => value?.toLowerCase().includes(needle)))
  return <div className="domain-card diagnostic-workbench" data-domain-card="vehicle-recalls" {...evidence}>
    <CardHeading eyebrow="U.S. vehicle recall campaigns" title={scope ?? 'Vehicle recall report'} description="Read the defect, safety consequence and repair instructions for each returned campaign."/>
    <p className="domain-notice">This is a model-level search, not a VIN repair-status check. It cannot confirm that your specific vehicle is affected, repaired or safe. <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noreferrer">Check your VIN with NHTSA</a> and follow the manufacturer’s instructions.</p>
    <Facts items={[{ label: 'Readable campaign records', value: model.recalls.length }, { label: 'Provider result count', value: model.count ?? 'Not supplied' }, { label: 'Do-not-drive flags', value: `${model.recalls.filter((recall) => recall.parkIt === true).length} flagged · ${model.recalls.filter((recall) => recall.parkIt === undefined).length} unknown` }, { label: 'Park-outside flags', value: `${model.recalls.filter((recall) => recall.parkOutside === true).length} flagged · ${model.recalls.filter((recall) => recall.parkOutside === undefined).length} unknown` }]}/>
    {model.state === 'partial' && <p className="diagnostic-warning">The response is incomplete.{model.invalidRows ? ` ${model.invalidRows} campaign records could not be read.` : ''}{model.mismatchedRows ? ` ${model.mismatchedRows} records did not match the executed vehicle query and were withheld.` : ''}{model.incompleteRecords ? ` ${model.incompleteRecords} records lack a full defect, consequence or remedy.` : ''}{!model.countContract ? ' The provider count differs from the supplied list or is unavailable.' : ''} Verify the full campaign with NHTSA.</p>}
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
