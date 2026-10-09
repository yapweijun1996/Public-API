import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, text } from './cardPrimitives'
import { isRecord, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

const FEMA_PATH = '/api/open/v2/DisasterDeclarationsSummaries'
const FEMA_ORDER_BY = 'declarationDate desc'

type FemaRequestUrlIdentity = { valid: true; top: number; pathAndQuery: string } | { valid: false }
type FemaRequestIdentity = { valid: true; top: number; pathAndQuery: string; transportBound: boolean } | { valid: false }

const parseFemaRequestUrl = (requestUrl?: string): FemaRequestUrlIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const allowed = new Set(['$top', '$orderby'])
    const keys = [...url.searchParams.keys()]
    const topRaw = url.searchParams.get('$top')
    const orderBy = url.searchParams.get('$orderby')
    if (url.protocol !== 'https:' || url.hostname !== 'www.fema.gov' || url.port || url.pathname !== FEMA_PATH || url.hash || url.username || url.password || keys.length !== 2 || keys.some((key) => !allowed.has(key)) || [...allowed].some((key) => url.searchParams.getAll(key).length !== 1) || !topRaw || !/^[1-9]\d*$/.test(topRaw) || orderBy !== FEMA_ORDER_BY) return { valid: false }
    const top = Number(topRaw)
    if (!Number.isSafeInteger(top) || top < 1 || top > 10) return { valid: false }
    const canonicalQuery = new URLSearchParams({ '$top': String(top), '$orderby': FEMA_ORDER_BY }).toString()
    const canonical = `https://www.fema.gov${FEMA_PATH}?${canonicalQuery}`
    if (requestUrl !== canonical) return { valid: false }
    return { valid: true, top, pathAndQuery: `${FEMA_PATH}?${canonicalQuery}` }
  } catch { return { valid: false } }
}

const femaRequestIdentity = (requestUrl?: string, executedRequest?: ExecutedRequestContext): FemaRequestIdentity | undefined => {
  const displayed = parseFemaRequestUrl(requestUrl)
  if (!displayed || !displayed.valid) return displayed
  if (!executedRequest) return { ...displayed, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return { valid: false }
  const executed = parseFemaRequestUrl(executedRequest.url)
  if (!executed?.valid) return { valid: false }
  return { ...displayed, transportBound: true }
}

const metadataMatchesRequest = (metadataValue: unknown, request: Extract<FemaRequestIdentity, { valid: true }>) => {
  if (!isRecord(metadataValue)) return false
  const top = positiveSafeInteger(metadataValue.top)
  const skip = nonNegativeSafeInteger(metadataValue.skip)
  const entityName = trimmedText(metadataValue.entityname)
  const version = trimmedText(metadataValue.version)
  const orderBy = trimmedText(metadataValue.orderby)?.replace(/\s+/g, ' ').toLowerCase()
  const echoedUrl = trimmedText(metadataValue.url)
  return top === request.top && skip === 0 && entityName === 'DisasterDeclarationsSummaries' && version === 'v2' && orderBy === FEMA_ORDER_BY.toLowerCase() && echoedUrl === request.pathAndQuery
}

const dateOnly = (value: unknown) => text(value)?.slice(0, 10) ?? 'Not supplied'
const declarationTypeLabel = (value: unknown) => {
  switch (text(value)) {
    case 'DR': return 'Major Disaster (DR)'
    case 'EM': return 'Emergency (EM)'
    case 'FM': return 'Fire Management Assistance (FM)'
    case 'FS': return 'Fire Suppression (FS)'
    default: return text(value) ?? 'Not supplied'
  }
}
const declaredPrograms = (record: Record<string, unknown>) => {
  const flags = [record.ihProgramDeclared, record.iaProgramDeclared, record.paProgramDeclared, record.hmProgramDeclared]
  const programs = [record.ihProgramDeclared === true ? 'IH' : undefined, record.iaProgramDeclared === true ? 'IA' : undefined, record.paProgramDeclared === true ? 'PA' : undefined, record.hmProgramDeclared === true ? 'HM' : undefined].filter(Boolean)
  if (programs.length) return programs.join(', ')
  return flags.every((flag) => flag === false) ? 'None flagged in this record' : 'Not supplied'
}
const recordId = (record: Record<string, unknown>) => text(record.id)
const recordIdentityComplete = (record: Record<string, unknown>) => Boolean(text(record.femaDeclarationString) && text(record.designatedArea))

export function FemaDisasterPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = femaRequestIdentity(requestUrl, executedRequest)
  if (request && !request.valid) {
    return <div className="domain-card domain-empty" data-domain-card="disaster-declared-areas" data-result-state="invalid" data-request-bound="false" data-request-contract="exact-fema-disaster-get-v1"><h3>Invalid FEMA disaster request</h3><p>The successful response was not bound to the supported exact bodyless GET OpenFEMA DisasterDeclarationsSummaries request.</p></div>
  }

  const root = asRecord(data)
  if (!Array.isArray(root.DisasterDeclarationsSummaries)) {
    return <CardEmpty
      domain="disaster-declared-areas"
      title="Invalid FEMA declared-area response"
      detail="OpenFEMA did not return the documented DisasterDeclarationsSummaries array."
      state="invalid"
    />
  }

  const boundRequest = request?.valid ? request : undefined
  const metadataContract = boundRequest ? metadataMatchesRequest(root.metadata, boundRequest) : false
  if (boundRequest && !metadataContract) {
    return <CardEmpty domain="disaster-declared-areas" title="Invalid FEMA request acknowledgement" detail="OpenFEMA returned HTTP-success data without metadata that matches the exact executed limit, ordering, dataset version, and request URL." state="invalid"/>
  }

  const providerRecords = root.DisasterDeclarationsSummaries.map(asRecord)
  const rowCountContract = boundRequest ? providerRecords.length <= boundRequest.top : false
  if (!providerRecords.length) {
    if (!boundRequest || !metadataContract) {
      return <CardEmpty domain="disaster-declared-areas" title="Unbound FEMA empty response" detail="An empty OpenFEMA response is only trusted when provider metadata acknowledges the exact displayed request." state="invalid"/>
    }
    if (!boundRequest.transportBound) {
      return <div className="domain-card domain-empty" data-domain-card="disaster-declared-areas" data-result-state="partial" data-requested-limit={boundRequest.top} data-request-bound="false" data-metadata-contract="true" data-row-count-contract="true" data-provider-record-count="0"><h3>Unbound FEMA empty response</h3><p>OpenFEMA returned a coherent empty DisasterDeclarationsSummaries array, but executed transport identity is unavailable, so semantic emptiness is not trusted.</p></div>
    }
    return <div className="domain-card domain-empty" data-domain-card="disaster-declared-areas" data-result-state="empty" data-requested-limit={boundRequest.top} data-request-bound="true" data-metadata-contract="true" data-row-count-contract="true" data-provider-record-count="0"><h3>No FEMA declared-area records returned</h3><p>OpenFEMA returned an exact-request-bound empty DisasterDeclarationsSummaries array.</p></div>
  }

  const records = providerRecords.filter((record) => recordId(record) !== undefined)
  const validRecordCount = records.length
  const invalidRecordCount = providerRecords.length - validRecordCount

  if (!validRecordCount) {
    return <CardEmpty
      domain="disaster-declared-areas"
      title="Invalid FEMA declared-area response"
      detail="OpenFEMA returned rows, but none included the provider-owned record ID documented as the unique ID assigned to each record."
      state="invalid"
    />
  }

  const incompleteRecordCount = records.filter((record) => !recordIdentityComplete(record)).length
  const declarationIds = [...new Set(records.map((record) => text(record.femaDeclarationString)).filter((value): value is string => Boolean(value)))]
  const first = records[0]
  const firstRecordId = recordId(first)!
  const requestBound = Boolean(boundRequest?.transportBound && metadataContract)
  const resultState = !requestBound || !rowCountContract || invalidRecordCount > 0 || incompleteRecordCount > 0 ? 'partial' : 'ready'

  return <div
    className="domain-card fema-disaster-preview"
    data-domain-card="disaster-declared-areas"
    data-result-state={resultState}
    data-requested-limit={boundRequest?.top}
    data-request-bound={String(requestBound)}
    data-metadata-contract={String(metadataContract)}
    data-row-count-contract={String(rowCountContract)}
    data-row-count={validRecordCount}
    data-provider-record-count={providerRecords.length}
    data-valid-record-count={validRecordCount}
    data-invalid-record-count={invalidRecordCount}
    data-incomplete-record-count={incompleteRecordCount}
    data-unique-declaration-count={declarationIds.length}
    data-primary-record-id={firstRecordId}
    data-primary-declaration-id={text(first.femaDeclarationString)}
  >
    <CardHeading
      eyebrow="FEMA OpenFEMA · Disaster Declarations Summaries"
      title={`${validRecordCount} trusted declared-area record${validRecordCount === 1 ? '' : 's'}`}
      description={`${declarationIds.length} federal declaration${declarationIds.length === 1 ? '' : 's'} identified in this response. OpenFEMA stores each designated geographic area as its own row, so repeated disaster IDs are expected.`}
    ><span className="domain-state">{resultState === 'partial' ? 'Partial area-level records' : 'Area-level records'}</span></CardHeading>

    {resultState === 'partial' && <p className="domain-note">{!requestBound ? 'Executed-request identity or OpenFEMA metadata acknowledgement is unavailable, so this response is not marked ready. ' : ''}{!rowCountContract ? `OpenFEMA returned more rows than the executed $top=${boundRequest?.top} limit. ` : ''}{invalidRecordCount > 0 ? `${invalidRecordCount} provider row${invalidRecordCount === 1 ? ' was' : 's were'} omitted because the documented unique record ID was missing. ` : ''}{incompleteRecordCount > 0 ? `${incompleteRecordCount} trusted row${incompleteRecordCount === 1 ? ' has' : 's have'} incomplete declaration or designated-area identity.` : ''}</p>}

    <ol className="fema-declaration-list" aria-label="FEMA declared geographic areas">
      {records.map((record, index) => {
        const id = recordId(record)!
        const declarationId = text(record.femaDeclarationString)
        const area = text(record.designatedArea)
        const state = text(record.state)
        const incident = text(record.incidentType)
        const declarationDate = text(record.declarationDate)
        const incidentBegin = text(record.incidentBeginDate)
        const incidentEnd = text(record.incidentEndDate)
        const lastRefresh = text(record.lastRefresh)
        return <li
          key={id}
          data-declaration-index={index + 1}
          data-record-id={id}
          data-declaration-id={declarationId}
          data-disaster-number={record.disasterNumber}
          data-designated-area={area}
          data-state={state}
          data-declaration-type={text(record.declarationType)}
          data-incident-type={incident}
          data-declaration-date={declarationDate}
        >
          <header><div><small>{declarationId ?? `Record ${id}`} · {incident ?? '—'}</small><h4>{area ?? '—'}</h4></div><span>{state ?? '—'}</span></header>
          <p className="fema-declaration-title">{text(record.declarationTitle) ?? 'Not supplied'}</p>
          <Facts items={[
            { label: 'OpenFEMA record ID', value: id },
            { label: 'Disaster number', value: record.disasterNumber === undefined || record.disasterNumber === null ? 'Not supplied' : String(record.disasterNumber) },
            { label: 'Declaration type', value: declarationTypeLabel(record.declarationType) },
            { label: 'Declared', value: declarationDate ? <time dateTime={declarationDate}>{dateOnly(declarationDate)}</time> : 'Not supplied' },
            { label: 'Incident period', value: `${dateOnly(incidentBegin)} → ${dateOnly(incidentEnd)}` },
            { label: 'Declared programs', value: declaredPrograms(record) },
            { label: 'FEMA region', value: record.region === undefined || record.region === null ? 'Not supplied' : String(record.region) },
            { label: 'Provider refresh', value: lastRefresh ? <time dateTime={lastRefresh}>{dateOnly(lastRefresh)}</time> : 'Not supplied' },
          ]}/>
        </li>
      })}
    </ol>
    <p className="domain-note">This endpoint is area-level, not one-row-per-disaster. OpenFEMA documents <code>id</code> as the unique ID assigned to each record and describes the source as raw NEMIS data that can contain a small percentage of human error.</p>
  </div>
}
