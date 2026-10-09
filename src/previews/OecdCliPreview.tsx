import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { isRecord, trimmedText } from './semanticValidation'

type OecdRequest = { area: string; startPeriod: string }
type CliPoint = { period: string; value: number }
const DATAFLOW = 'OECD.SDD.STES,DSD_STES@DF_CLI'

const requestedCli = (requestUrl?: string): OecdRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.origin !== 'https://sdmx.oecd.org' || url.hash || url.username || url.password) return undefined
    const match = new RegExp(`^/public/rest/v1/data/${DATAFLOW.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([A-Z0-9]+)\\.M\\.LI\\.\\.\\.AA\\.\\.\\.H$`).exec(url.pathname)
    if (!match) return undefined
    const keys = ['startPeriod', 'dimensionAtObservation', 'format'] as const
    const entries = [...url.searchParams.entries()]
    if (entries.length !== keys.length || keys.some((key) => url.searchParams.getAll(key).length !== 1) || entries.some(([key]) => !keys.includes(key as typeof keys[number]))) return undefined
    if (url.searchParams.get('dimensionAtObservation') !== 'AllDimensions' || url.searchParams.get('format') !== 'jsondata') return undefined
    const start = url.searchParams.get('startPeriod') ?? ''
    const startMatch = /^(\d{4})-01$/.exec(start)
    const startYear = startMatch ? Number(startMatch[1]) : undefined
    if (!startMatch || startYear === undefined || startYear < 2000 || startYear > 2100) return undefined
    const identity = { area: match[1], startPeriod: `${startMatch[1]}-01` }
    const canonical = `https://sdmx.oecd.org/public/rest/v1/data/${DATAFLOW}/${identity.area}.M.LI...AA...H?${new URLSearchParams({ startPeriod: identity.startPeriod, dimensionAtObservation: 'AllDimensions', format: 'jsondata' }).toString()}`
    return requestUrl === canonical ? identity : undefined
  } catch { return undefined }
}

type OecdTransport = { request?: OecdRequest; valid: boolean; bound: boolean }
const resolveOecdTransport = (requestUrl?: string, executedRequest?: ExecutedRequestContext): OecdTransport => {
  const displayed = requestedCli(requestUrl)
  if (requestUrl !== undefined && !displayed) return { valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) return { request: displayed, valid: false, bound: false }
  const executed = requestedCli(executedRequest.url)
  return executed ? { request: executed, valid: true, bound: true } : { request: displayed, valid: false, bound: false }
}
const dimValue = (dim: Record<string, unknown> | undefined): { id?: string; name?: string; count: number } => {
  const values = dim && Array.isArray(dim.values) ? dim.values.filter(isRecord) : []
  return { id: trimmedText(values[0]?.id), name: trimmedText(values[0]?.name), count: values.length }
}
const invalid = (detail: string) => <CardEmpty domain="leading-indicator" title="Invalid OECD CLI response" detail={detail} state="invalid"/>

export function OecdCliPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const transport = resolveOecdTransport(requestUrl, executedRequest)
  if (!transport.valid) return <div className="domain-card domain-empty" data-domain-card="leading-indicator" data-result-state="invalid" data-request-bound="false" data-query-bound="false"><h3>Invalid OECD CLI request</h3><p>The successful response was not bound to the exact supported bodyless GET OECD harmonised monthly CLI request.</p></div>
  if (!isRecord(data) || !isRecord(data.data) || !Array.isArray(data.errors) || data.errors.length !== 0) return invalid('OECD returned HTTP-success data without a clean SDMX-JSON data envelope.')
  const request = transport.request
  const structure = isRecord(data.data.structure) ? data.data.structure : undefined
  const dimensionsRoot = structure && isRecord(structure.dimensions) ? structure.dimensions : undefined
  const dimensions = dimensionsRoot && Array.isArray(dimensionsRoot.observation) ? dimensionsRoot.observation.filter(isRecord) : []
  const byId = new Map(dimensions.map((dim) => [trimmedText(dim.id) ?? '', dim]))
  const area = dimValue(byId.get('REF_AREA')); const freq = dimValue(byId.get('FREQ')); const measure = dimValue(byId.get('MEASURE')); const unit = dimValue(byId.get('UNIT_MEASURE')); const adjustment = dimValue(byId.get('ADJUSTMENT')); const transformation = dimValue(byId.get('TRANSFORMATION')); const methodology = dimValue(byId.get('METHODOLOGY'))
  const timeDim = byId.get('TIME_PERIOD'); const timeValues = timeDim && Array.isArray(timeDim.values) ? timeDim.values.filter(isRecord) : []
  const dimensionContract = dimensions.length === 10 && area.count === 1 && freq.id === 'M' && measure.id === 'LI' && unit.id === 'IX' && adjustment.id === 'AA' && transformation.id === 'IX' && methodology.id === 'H' && Boolean(timeDim)
  if (!dimensionContract) return invalid('The SDMX dimensions do not describe the OECD harmonised monthly Composite Leading Indicator contract.')
  if (request && area.id !== request.area) return invalid('The returned OECD reference area does not match the executed CLI request.')
  const dataSets = Array.isArray(data.data.dataSets) ? data.data.dataSets.filter(isRecord) : []
  if (dataSets.length !== 1 || !isRecord(dataSets[0].observations)) return invalid('The OECD response does not contain exactly one observation dataset.')
  const observations = dataSets[0].observations
  const points: CliPoint[] = []; let invalidCount = 0; let beforeStartCount = 0
  for (const [key, raw] of Object.entries(observations)) {
    const indices = key.split(':').map(Number)
    const timeIndex = indices.length === 10 ? indices[9] : -1
    const period = timeIndex >= 0 && timeIndex < timeValues.length ? trimmedText(timeValues[timeIndex]?.id) : undefined
    const value = Array.isArray(raw) && typeof raw[0] === 'number' && Number.isFinite(raw[0]) ? raw[0] : undefined
    if (!period || !/^\d{4}-\d{2}$/.test(period) || value === undefined || indices.slice(0, 9).some((index) => index !== 0)) { invalidCount += 1; continue }
    if (request && period < request.startPeriod) { invalidCount += 1; beforeStartCount += 1; continue }
    points.push({ period, value })
  }
  if (!points.length) {
    if (request && Object.keys(observations).length === 0) return <div className="domain-card domain-empty" data-domain-card="leading-indicator" data-result-state={transport.bound ? 'empty' : 'partial'} data-reference-area={request.area} data-request-bound={String(transport.bound)} data-query-bound={String(transport.bound)}><h3>{transport.bound ? 'No OECD CLI observations found' : 'Unbound OECD CLI empty response'}</h3><p>{transport.bound ? 'The exact executed request returned a structurally valid zero-observation CLI dataset.' : 'The zero-observation dataset is structurally valid, but exact executed transport identity is unavailable, so semantic emptiness is not trusted.'}</p></div>
    return invalid('None of the OECD observation cells could be mapped to a trustworthy monthly CLI value.')
  }
  const unique = new Map<string, CliPoint>(); let duplicateCount = 0
  for (const point of points) { if (unique.has(point.period)) duplicateCount += 1; else unique.set(point.period, point) }
  const sorted = [...unique.values()].sort((a, b) => a.period.localeCompare(b.period)); const latest = sorted.at(-1)
  const startPeriodContract = Boolean(request) && beforeStartCount === 0
  const state = transport.bound && request && startPeriodContract && invalidCount === 0 && duplicateCount === 0 ? 'ready' : 'partial'
  const cards: SemanticCard[] = sorted.slice(-12).reverse().map((point) => ({ title: point.period, eyebrow: `${area.name ?? area.id ?? 'OECD area'} · monthly CLI`, badge: point.value.toFixed(2), metrics: [{ label: 'CLI index', value: point.value.toFixed(2) }, { label: 'Period', value: point.period }], }))
  return <div data-domain-card="leading-indicator" data-result-state={state} data-requested-area={request?.area} data-requested-start-period={request?.startPeriod} data-start-period-contract={String(startPeriodContract)} data-provider-area={area.id} data-provider-area-name={area.name} data-query-bound={transport.bound ? 'true' : 'false'} data-request-bound={transport.bound ? 'true' : 'false'} data-provider-observation-count={Object.keys(observations).length} data-valid-observation-count={sorted.length} data-invalid-observation-count={invalidCount} data-duplicate-observation-count={duplicateCount} data-latest-period={latest?.period} data-latest-value={latest?.value} data-dimension-contract={String(dimensionContract)}>
    <div className="domain-note"><strong>OECD Composite Leading Indicator · {area.name ?? area.id}</strong> · latest {latest?.period} = {latest?.value.toFixed(2)}</div>
    {state === 'partial' && <p className="domain-note">Only validated monthly CLI cells are shown because request binding, duplicates, or one or more SDMX observation cells are incomplete.</p>}
    <SemanticCards cards={cards} emptyTitle="OECD CLI observations unavailable"/>
  </div>
}
