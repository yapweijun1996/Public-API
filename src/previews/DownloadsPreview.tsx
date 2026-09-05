import { asRecord, CardEmpty, CardHeading, DateValue, Facts, finite, isoDate, numericText, text } from './cardPrimitives'

export function downloadsModel(data: unknown) {
  const root = asRecord(data)
  const count = finite(root.downloads)
  const downloads = count !== undefined && Number.isSafeInteger(count) && count >= 0 ? count : undefined
  const start = isoDate(root.start)
  const end = isoDate(root.end)
  const days = start && end && end >= start ? (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1 : undefined
  return { packageName: text(root.package), downloads, start, end, days, average: downloads !== undefined && days ? downloads / days : undefined }
}
export function DownloadsPreview({ data }: { data: unknown }) {
  const model = downloadsModel(data)
  if (model.downloads === undefined) return <CardEmpty domain="download-summary" title="Download count unavailable" detail="The response did not contain a valid non-negative download total. Missing data is not zero downloads."/>
  return <div className="domain-card downloads-workbench" data-domain-card="download-summary" data-result-state="ready">
    <CardHeading eyebrow="npm package downloads" title={model.packageName ?? 'Package not supplied'} description="A total for the exact reporting window returned by npm."/>
    <div className="downloads-hero"><span>Downloads in this window</span><strong data-download-count={model.downloads}>{new Intl.NumberFormat('en').format(model.downloads)}</strong><p>{model.days ? `${model.days} calendar ${model.days === 1 ? 'day' : 'days'} · start and end included` : 'Reporting window unavailable'}</p></div>
    <Facts items={[{ label: 'Window start · UTC', value: <DateValue value={model.start}/> }, { label: 'Window end · UTC', value: <DateValue value={model.end}/> }, { label: 'Daily average · calculated', value: model.average === undefined ? 'Not available' : `${numericText(model.average)} downloads / day` }]}/>
    <p className="domain-note">This endpoint returns a period total, not a daily time series. The average is calculated from that total; it is not a growth rate or a count of unique users.</p>
  </div>
}
