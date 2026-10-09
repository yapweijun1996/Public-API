import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, finite, numericText } from './cardPrimitives'

type OpenCitationsRequest = { doi: string; transportBound: boolean }

const parseDoiRequestUrl = (requestUrl?: string) => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const match = /^\/index\/v2\/citation-count\/doi:(.+)$/.exec(url.pathname)
    if (url.protocol !== 'https:' || url.hostname !== 'api.opencitations.net' || url.port || url.username || url.password || url.search || url.hash || !match) return undefined
    const doi = decodeURIComponent(match[1])
    if (!/^10\..+/.test(doi)) return undefined
    const canonical = `https://api.opencitations.net/index/v2/citation-count/doi:${encodeURIComponent(doi)}`
    return requestUrl === canonical ? doi : undefined
  } catch {
    return undefined
  }
}

const citationRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): OpenCitationsRequest | undefined | null => {
  const doi = parseDoiRequestUrl(requestUrl)
  if (requestUrl && !doi) return null
  if (!doi) return undefined
  if (!executedRequest) return { doi, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) return null
  return parseDoiRequestUrl(executedRequest.url) === doi ? { doi, transportBound: true } : null
}

const citationCount = (value: unknown) => {
  const count = finite(value)
  return count !== undefined && Number.isInteger(count) && count >= 0 ? count : undefined
}

export function OpenCitationsPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  if (!Array.isArray(data)) {
    return <CardEmpty
      domain="citation-count"
      title="Invalid OpenCitations citation-count response"
      detail="OpenCitations returned HTTP-success data without the documented citation-count result array."
      state="invalid"
    />
  }

  if (data.length !== 1) {
    return <CardEmpty
      domain="citation-count"
      title="Invalid OpenCitations citation-count response"
      detail="OpenCitations citation-count should return exactly one count record for one bibliographic identifier."
      state="invalid"
    />
  }

  const record = asRecord(data[0])
  const count = citationCount(record.count)
  if (count === undefined) {
    return <CardEmpty
      domain="citation-count"
      title="Invalid OpenCitations citation-count response"
      detail="OpenCitations returned a citation-count record without a non-negative integer incoming-citation count."
      state="invalid"
    />
  }

  const request = citationRequest(requestUrl, executedRequest)
  if (request === null) {
    return <CardEmpty domain="citation-count" title="Invalid OpenCitations request identity" detail="This citation count was not produced by the exact supported bodyless GET request shown in Request Lab." state="invalid"/>
  }
  const doi = request?.doi
  const state = request?.transportBound ? 'ready' : 'partial'

  return <div
    className="domain-card opencitations-preview"
    data-domain-card="citation-count"
    data-result-state={state}
    data-provider-record-count={data.length}
    data-count-contract-valid="true"
    data-request-bound={String(Boolean(request?.transportBound))}
    data-primary-doi={doi}
    data-incoming-citation-count={count}
    data-citation-direction="incoming"
    data-citation-index="OpenCitations Index v2"
  >
    <CardHeading
      eyebrow="OpenCitations Index v2 · Citation count"
      title={`${numericText(count)} incoming citation${count === 1 ? '' : 's'}`}
      description={doi ? `Incoming citations recorded in OpenCitations Index for DOI ${doi}.` : 'Incoming citations recorded in OpenCitations Index; request identity was unavailable to bind this count to a DOI.'}
    ><span className="domain-state">{state === 'ready' ? 'Index-scoped count' : 'Partial request identity'}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">{doi ? 'The request DOI is known, but the successful executed transport identity is unavailable, so this count is not presented as fully request-bound.' : 'The provider count is usable, but the request DOI and successful executed transport identity are unavailable, so this result is not presented as fully identity-bound.'}</p>}
    <Facts items={[
      { label: 'DOI', value: doi ? <code>{doi}</code> : 'Not supplied' },
      { label: 'Incoming citations', value: numericText(count) },
      { label: 'Citation direction', value: 'Incoming / cited by other works' },
      { label: 'Index', value: 'OpenCitations Index v2' },
    ]}/>
    <p className="domain-note">This number is scoped to citations indexed by OpenCitations. A zero count means the Index currently records no incoming citations for the requested identifier; it is not a transport-empty result and should not be interpreted as a universal citation total.</p>
  </div>
}
