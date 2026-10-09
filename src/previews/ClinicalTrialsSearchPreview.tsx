import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { isRecord, trimmedText } from './semanticValidation'

type ClinicalTrialsRequest = {
  condition: string
  pageSize: number
  transportBound: boolean
}

type ClinicalStudy = {
  nctId: string
  title: string
  status?: string
  studyType?: string
  startDate?: string
  conditions: string[]
  hasResults?: boolean
}

type ClinicalTrialsResult = {
  studies: ClinicalStudy[]
  providerStudyCount: number
  malformedStudyCount: number
  duplicateStudyCount: number
  overflowStudyCount: number
  malformedSupplementCount: number
  nextPageAvailable: boolean
}

type ClinicalTrialsRequestUrl = Omit<ClinicalTrialsRequest, 'transportBound'>

const parseRequestUrl = (requestUrl?: string): ClinicalTrialsRequestUrl | null | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const allowed = new Set(['query.cond', 'pageSize', 'format'])
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'clinicaltrials.gov' || url.port || url.username || url.password
      || url.pathname !== '/api/v2/studies' || url.hash || keys.length !== 3 || keys.some((key) => !allowed.has(key))) return null
    if ([...allowed].some((key) => url.searchParams.getAll(key).length !== 1)) return null

    const condition = url.searchParams.get('query.cond')?.trim() ?? ''
    const rawPageSize = url.searchParams.get('pageSize') ?? ''
    if (!condition || rawPageSize !== '8' || url.searchParams.get('format') !== 'json') return null
    return { condition, pageSize: 8 }
  } catch {
    return null
  }
}

const parseRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): ClinicalTrialsRequest | null | undefined => {
  const displayedRequest = parseRequestUrl(requestUrl)
  if (requestUrl && !displayedRequest) return null
  if (!executedRequest) return displayedRequest ? { ...displayedRequest, transportBound: false } : undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return null
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return null
  const executed = parseRequestUrl(executedRequest.url)
  return executed ? { ...executed, transportBound: true } : null
}

const parseStudy = (value: unknown): { study?: ClinicalStudy; malformedSupplementCount: number } => {
  if (!isRecord(value) || !isRecord(value.protocolSection)) return { malformedSupplementCount: 0 }
  const protocol = value.protocolSection
  if (!isRecord(protocol.identificationModule)) return { malformedSupplementCount: 0 }
  const identification = protocol.identificationModule
  const nctId = trimmedText(identification.nctId)
  const title = trimmedText(identification.briefTitle) ?? trimmedText(identification.officialTitle)
  if (!nctId || !/^NCT\d{8}$/.test(nctId) || !title) return { malformedSupplementCount: 0 }

  let malformedSupplementCount = 0
  const statusModule = isRecord(protocol.statusModule) ? protocol.statusModule : undefined
  const designModule = isRecord(protocol.designModule) ? protocol.designModule : undefined
  const conditionsModule = isRecord(protocol.conditionsModule) ? protocol.conditionsModule : undefined
  const startDateStruct = statusModule && isRecord(statusModule.startDateStruct) ? statusModule.startDateStruct : undefined

  const status = statusModule ? trimmedText(statusModule.overallStatus) : undefined
  if (statusModule && statusModule.overallStatus !== undefined && !status) malformedSupplementCount += 1
  const studyType = designModule ? trimmedText(designModule.studyType) : undefined
  if (designModule && designModule.studyType !== undefined && !studyType) malformedSupplementCount += 1
  const startDate = startDateStruct ? trimmedText(startDateStruct.date) : undefined
  if (startDateStruct && startDateStruct.date !== undefined && !startDate) malformedSupplementCount += 1

  const conditions: string[] = []
  if (conditionsModule?.conditions !== undefined) {
    if (!Array.isArray(conditionsModule.conditions)) malformedSupplementCount += 1
    else {
      for (const condition of conditionsModule.conditions) {
        const normalized = trimmedText(condition)
        if (normalized) conditions.push(normalized)
        else malformedSupplementCount += 1
      }
    }
  }

  let hasResults: boolean | undefined
  if (value.hasResults !== undefined) {
    if (typeof value.hasResults === 'boolean') hasResults = value.hasResults
    else malformedSupplementCount += 1
  }

  return {
    study: { nctId, title, status, studyType, startDate, conditions, hasResults },
    malformedSupplementCount,
  }
}

const parseResult = (data: unknown, request: ClinicalTrialsRequest): ClinicalTrialsResult | null => {
  if (!isRecord(data) || !Array.isArray(data.studies)) return null
  if (data.nextPageToken !== undefined && typeof data.nextPageToken !== 'string') return null

  const studies: ClinicalStudy[] = []
  const seen = new Set<string>()
  let malformedStudyCount = 0
  let duplicateStudyCount = 0
  let overflowStudyCount = 0
  let malformedSupplementCount = 0

  data.studies.forEach((rawStudy, index) => {
    const parsed = parseStudy(rawStudy)
    malformedSupplementCount += parsed.malformedSupplementCount
    if (!parsed.study) {
      malformedStudyCount += 1
      return
    }
    if (seen.has(parsed.study.nctId)) {
      duplicateStudyCount += 1
      return
    }
    seen.add(parsed.study.nctId)
    if (index >= request.pageSize || studies.length >= request.pageSize) {
      overflowStudyCount += 1
      return
    }
    studies.push(parsed.study)
  })

  return {
    studies,
    providerStudyCount: data.studies.length,
    malformedStudyCount,
    duplicateStudyCount,
    overflowStudyCount,
    malformedSupplementCount,
    nextPageAvailable: typeof data.nextPageToken === 'string' && data.nextPageToken.length > 0,
  }
}

export function ClinicalTrialsSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = parseRequest(requestUrl, executedRequest)
  if (!request) {
    return <CardEmpty domain="clinical-trials-search" title="Invalid clinical-trials request" detail="The successful response was not tied to the supported exact ClinicalTrials.gov condition-search request." state="invalid"/>
  }

  const result = parseResult(data, request)
  if (!result) {
    return <CardEmpty domain="clinical-trials-search" title="Invalid clinical-trials response" detail="ClinicalTrials.gov did not return a coherent JSON study collection for the executed condition search." state="invalid"/>
  }

  if (result.providerStudyCount === 0) {
    return request.transportBound
      ? <CardEmpty domain="clinical-trials-search" title="No clinical studies found" detail={`ClinicalTrials.gov returned a request-bound empty first page for “${request.condition}”.`} state="empty"/>
      : <div className="domain-card domain-empty" data-domain-card="clinical-trials-search" data-result-state="partial" data-request-bound="false">
        <h3>ClinicalTrials.gov request identity unavailable</h3>
        <p>ClinicalTrials.gov returned a coherent zero-result page, but the executed request transport is unavailable, so this response is not trusted as a request-bound no-match result.</p>
      </div>
  }

  if (!result.studies.length) {
    return <CardEmpty domain="clinical-trials-search" title="Invalid clinical-trials response" detail="ClinicalTrials.gov returned studies but no trustworthy NCT study identity could be established." state="invalid"/>
  }

  const partial = !request.transportBound || result.malformedStudyCount > 0 || result.duplicateStudyCount > 0 || result.overflowStudyCount > 0 || result.malformedSupplementCount > 0
  const primary = result.studies[0]

  return <div
    className="clinical-trials-preview domain-card"
    data-domain-card="clinical-trials-search"
    data-result-state={partial ? 'partial' : 'ready'}
    data-request-bound={request.transportBound ? 'true' : 'false'}
    data-request-contract="exact-clinicaltrials-condition-first-page-json"
    data-query-condition={request.condition}
    data-requested-page-size={request.pageSize}
    data-provider-study-count={result.providerStudyCount}
    data-valid-study-count={result.studies.length}
    data-malformed-study-count={result.malformedStudyCount}
    data-duplicate-study-count={result.duplicateStudyCount}
    data-overflow-study-count={result.overflowStudyCount}
    data-malformed-supplement-count={result.malformedSupplementCount}
    data-row-limit-contract={result.overflowStudyCount === 0 ? 'true' : 'false'}
    data-next-page-available={result.nextPageAvailable ? 'true' : 'false'}
    data-primary-nct-id={primary.nctId}
  >
    <header className="domain-heading">
      <div>
        <small className="domain-eyebrow">ClinicalTrials.gov condition search</small>
        <h3>{request.condition}</h3>
        <p>{request.transportBound ? 'Public clinical-study registry records returned by the exact executed condition-search request.' : 'Validated registry records from the claimed ClinicalTrials.gov request URL; executed transport identity is unavailable.'}</p>
      </div>
      <span className="domain-state">{result.studies.length} trusted studies</span>
    </header>

    {partial && <p className="domain-note">{request.transportBound ? 'Malformed, duplicate, or over-limit study evidence is withheld. Raw JSON retains the complete provider response.' : 'The provider result is structurally valid, but executed-request identity is unavailable, so this result is not marked ready.'}</p>}

    <dl className="domain-facts">
      <div><dt>Requested condition</dt><dd>{request.condition}</dd></div>
      <div><dt>Returned studies</dt><dd>{result.providerStudyCount}</dd></div>
      <div><dt>Trusted studies</dt><dd>{result.studies.length}</dd></div>
      <div><dt>Primary NCT ID</dt><dd><code>{primary.nctId}</code></dd></div>
      <div><dt>More pages</dt><dd>{result.nextPageAvailable ? 'Yes' : 'No'}</dd></div>
    </dl>

    <ol className="domain-list" aria-label="ClinicalTrials.gov study records">
      {result.studies.map((study) => <li key={study.nctId} data-nct-id={study.nctId}>
        <strong>{study.title}</strong>
        <span>{study.nctId}{study.status ? ` · ${study.status}` : ''}</span>
        <span>{study.studyType ?? 'Study type unavailable'}{study.startDate ? ` · Started ${study.startDate}` : ''}</span>
        {study.conditions.length > 0 && <span>{study.conditions.slice(0, 4).join(' · ')}</span>}
        {study.hasResults !== undefined && <span>Results posted: {study.hasResults ? 'Yes' : 'No'}</span>}
      </li>)}
    </ol>

    <p className="domain-note">Registry data is submitted by study sponsors or investigators. The U.S. government does not review or approve the safety and science of every listed study. This card is for research discovery, not medical advice. <a href="https://clinicaltrials.gov/about-site/disclaimer" target="_blank" rel="noreferrer">ClinicalTrials.gov disclaimer</a>.</p>
  </div>
}
