import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { isRecord, trimmedText } from './semanticValidation'

type PubMedRequest = { term: string; retmax: number }

type PubMedResult = {
  count: number
  returned: number
  ids: string[]
  queryTranslation?: string
  malformedIdCount: number
  duplicateIdCount: number
}

const providerNonNegativeInteger = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : undefined
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

const parseRequest = (requestUrl?: string): PubMedRequest | null | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const allowed = new Set(['db', 'term', 'retmode', 'retmax'])
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'eutils.ncbi.nlm.nih.gov' || url.port || url.username || url.password
      || url.pathname !== '/entrez/eutils/esearch.fcgi' || url.hash || keys.length !== 4 || keys.some((key) => !allowed.has(key))) return null
    if ([...allowed].some((key) => url.searchParams.getAll(key).length !== 1)) return null
    const term = url.searchParams.get('term')?.trim() ?? ''
    const rawRetmax = url.searchParams.get('retmax') ?? ''
    if (url.searchParams.get('db') !== 'pubmed' || url.searchParams.get('retmode') !== 'json' || !term || !/^[1-9]\d*$/.test(rawRetmax)) return null
    const retmax = Number(rawRetmax)
    if (!Number.isSafeInteger(retmax) || retmax < 1 || retmax > 10) return null
    return { term, retmax }
  } catch {
    return null
  }
}

const executedRequestIdentity = (executedRequest?: ExecutedRequestContext, requestUrl?: string): { request?: PubMedRequest; invalid: boolean } => {
  if (!executedRequest) return { invalid: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined) return { invalid: true }
  if (requestUrl !== undefined && requestUrl !== executedRequest.url) return { invalid: true }
  const request = parseRequest(executedRequest.url)
  return request ? { request, invalid: false } : { invalid: true }
}

const parseResult = (data: unknown, request: PubMedRequest): PubMedResult | null => {
  if (!isRecord(data) || !isRecord(data.esearchresult)) return null
  const result = data.esearchresult
  const count = providerNonNegativeInteger(result.count)
  const returned = providerNonNegativeInteger(result.retmax)
  const retstart = providerNonNegativeInteger(result.retstart)
  if (count === undefined || returned === undefined || retstart !== 0 || !Array.isArray(result.idlist)) return null

  const ids: string[] = []
  const seen = new Set<string>()
  let malformedIdCount = 0
  let duplicateIdCount = 0
  for (const rawId of result.idlist) {
    if (typeof rawId !== 'string' || !/^[1-9]\d*$/.test(rawId)) {
      malformedIdCount += 1
      continue
    }
    if (seen.has(rawId)) {
      duplicateIdCount += 1
      continue
    }
    seen.add(rawId)
    ids.push(rawId)
  }

  const expectedReturned = Math.min(request.retmax, count)
  if (returned !== result.idlist.length || returned !== expectedReturned || result.idlist.length > request.retmax || result.idlist.length > count) return null

  return {
    count,
    returned,
    ids,
    queryTranslation: trimmedText(result.querytranslation),
    malformedIdCount,
    duplicateIdCount,
  }
}

export function PubMedSearchPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const displayedRequest = parseRequest(requestUrl)
  if (requestUrl && !displayedRequest) {
    return <CardEmpty domain="pubmed-search" title="Invalid PubMed search request" detail="The displayed request was not the supported exact PubMed ESearch request." state="invalid"/>
  }
  const execution = executedRequestIdentity(executedRequest, requestUrl)
  if (execution.invalid) {
    return <CardEmpty domain="pubmed-search" title="Invalid PubMed executed request" detail="The successful response is not bound to the exact supported bodyless GET PubMed ESearch request." state="invalid"/>
  }
  const request = execution.request ?? displayedRequest
  if (!request) {
    return <CardEmpty domain="pubmed-search" title="Invalid PubMed search request" detail="The successful response was not tied to the supported exact PubMed ESearch request." state="invalid"/>
  }
  const requestBound = Boolean(execution.request)

  const result = parseResult(data, request)
  if (!result) {
    return <CardEmpty domain="pubmed-search" title="Invalid PubMed search response" detail="NCBI did not return a coherent ESearch JSON result for the executed query and result limit." state="invalid"/>
  }

  if (result.count === 0) {
    return requestBound
      ? <CardEmpty domain="pubmed-search" title="No PubMed matches" detail={`NCBI returned a request-bound empty ESearch result for “${request.term}”.`} state="empty"/>
      : <div className="domain-card domain-empty" data-domain-card="pubmed-search" data-result-state="partial" data-request-bound="false">
        <h3>PubMed request identity unavailable</h3>
        <p>NCBI returned a coherent zero-result ESearch response, but the executed request transport is unavailable, so the response is not trusted as a request-bound no-match result.</p>
      </div>
  }

  if (!result.ids.length) {
    return <CardEmpty domain="pubmed-search" title="Invalid PubMed search response" detail="NCBI reported matching PubMed records but no trustworthy PMID identity was returned." state="invalid"/>
  }

  const partial = !requestBound || result.malformedIdCount > 0 || result.duplicateIdCount > 0
  const primary = result.ids[0]
  return <div
    className="pubmed-preview domain-card"
    data-domain-card="pubmed-search"
    data-result-state={partial ? 'partial' : 'ready'}
    data-request-bound={requestBound ? 'true' : 'false'}
    data-request-contract="exact-pubmed-esearch-json"
    data-query-term={request.term}
    data-requested-retmax={request.retmax}
    data-provider-count={result.count}
    data-provider-returned={result.returned}
    data-valid-pmid-count={result.ids.length}
    data-malformed-pmid-count={result.malformedIdCount}
    data-duplicate-pmid-count={result.duplicateIdCount}
    data-primary-pmid={primary}
  >
    <header className="domain-heading">
      <div>
        <small className="domain-eyebrow">PubMed ESearch</small>
        <h3>{request.term}</h3>
        <p>PubMed article identifiers returned by the exact executed NCBI ESearch request.</p>
      </div>
      <span className="domain-state">{result.ids.length} trusted PMIDs</span>
    </header>

    {partial && <p className="domain-note">{requestBound ? 'Malformed or duplicate PMID identities are withheld. Raw JSON retains the complete provider response.' : 'The provider result is structurally valid, but executed-request identity is unavailable, so this result is not marked ready.'}</p>}

    <dl className="domain-facts">
      <div><dt>Requested term</dt><dd>{request.term}</dd></div>
      <div><dt>Total matches</dt><dd>{result.count.toLocaleString('en')}</dd></div>
      <div><dt>Returned PMIDs</dt><dd>{result.returned}</dd></div>
      <div><dt>Primary PMID</dt><dd><code>{primary}</code></dd></div>
      <div><dt>Query translation</dt><dd>{result.queryTranslation ?? 'Unavailable'}</dd></div>
    </dl>

    <ol className="domain-list" aria-label="PubMed article identifiers">
      {result.ids.map((id) => <li key={id} data-pmid={id}>
        <strong>PMID {id}</strong>
        <span>pubmed.ncbi.nlm.nih.gov/{id}</span>
      </li>)}
    </ol>

    <p className="domain-note">This ESearch step returns identifiers, not article content or medical advice. Open a PMID in PubMed for the full indexed record. <a href="https://www.ncbi.nlm.nih.gov/home/about/policies/" target="_blank" rel="noreferrer">NCBI policies and disclaimer</a> apply to use of NCBI content.</p>
  </div>
}
