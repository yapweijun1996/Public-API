import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, Facts, finite, numericText, text } from './cardPrimitives'
import { cleanText } from './previewData'
import { trimmedText } from './semanticValidation'

type FossilTaxon = {
  taxonNo: string
  originalNo?: string
  name: string
  rank?: string
  acceptedNo?: string
  acceptedName?: string
  acceptedRank?: string
  parentNo?: string
  referenceNo?: string
  extancy?: string
  occurrenceCount?: number
}

const model = (value: unknown): FossilTaxon | undefined => {
  const row = asRecord(value)
  const taxonNo = text(row.taxon_no)
  const name = cleanText(row.taxon_name)
  if (!taxonNo || !name) return undefined
  return {
    taxonNo,
    originalNo: text(row.orig_no),
    name,
    rank: text(row.taxon_rank),
    acceptedNo: text(row.accepted_no),
    acceptedName: cleanText(row.accepted_name),
    acceptedRank: text(row.accepted_rank),
    parentNo: text(row.parent_no),
    referenceNo: text(row.reference_no),
    extancy: text(row.is_extant),
    occurrenceCount: finite(row.n_occs),
  }
}
type PaleobiodbRequest = { name: string }
type BoundPaleobiodbRequest = { request?: PaleobiodbRequest; transportBound: boolean; invalidReason?: string }

export const parsePaleobiodbRequest = (requestUrl?: string): PaleobiodbRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    if (url.protocol !== 'https:' || url.hostname !== 'paleobiodb.org' || url.port || url.username || url.password || url.hash || url.pathname !== '/data1.2/taxa/list.json') return undefined
    if (keys.length !== 2 || url.searchParams.getAll('name').length !== 1 || url.searchParams.getAll('vocab').length !== 1 || url.searchParams.get('vocab') !== 'pbdb') return undefined
    const rawName = url.searchParams.get('name') ?? ''
    const name = trimmedText(rawName)
    if (!name || rawName !== name) return undefined
    const canonical = `https://paleobiodb.org/data1.2/taxa/list.json?${new URLSearchParams({ name, vocab: 'pbdb' }).toString()}`
    return requestUrl === canonical ? { name } : undefined
  } catch {
    return undefined
  }
}

const bindPaleobiodbRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundPaleobiodbRequest => {
  const request = parsePaleobiodbRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported Paleobiology Database taxa/list query.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Paleobiology Database taxa/list request.' }
  }
  const executed = parsePaleobiodbRequest(executedRequest.url)
  if (!executed || executed.name !== request.name) {
    return { request, transportBound: false, invalidReason: 'The displayed Paleobiology Database request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

export function PaleobiodbTaxonPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const identity = bindPaleobiodbRequest(requestUrl, executedRequest)
  const request = identity.request
  const requestAttrs = {
    'data-domain-card': 'fossil-taxon',
    'data-request-bound': request && identity.transportBound ? 'true' : 'false',
    'data-request-contract': 'exact-paleobiodb-taxa-list-v2',
    'data-requested-taxon-name': request?.name,
  }
  if (!request || identity.invalidReason) return <div className="domain-card domain-empty paleobiodb-taxon-preview" {...requestAttrs} data-result-state="invalid"><h3>Invalid fossil taxon request evidence</h3><p>{identity.invalidReason ?? 'The successful response could not be tied to the exact supported Paleobiology Database request.'}</p></div>
  if (!data || typeof data !== 'object' || Array.isArray(data)) return <div className="domain-card domain-empty paleobiodb-taxon-preview" {...requestAttrs} data-result-state="invalid"><h3>Invalid fossil taxon response</h3><p>Paleobiology Database did not return the expected taxon response object.</p></div>
  const root = asRecord(data)
  if (!Array.isArray(root.records)) return <div className="domain-card domain-empty paleobiodb-taxon-preview" {...requestAttrs} data-result-state="invalid"><h3>Invalid fossil taxon response</h3><p>Paleobiology Database did not return the expected records array.</p></div>
  if (!root.records.length) {
    const state = identity.transportBound ? 'empty' : 'partial'
    return <div className="domain-card domain-empty paleobiodb-taxon-preview" {...requestAttrs} data-result-state={state}><h3>{identity.transportBound ? 'No fossil taxon returned' : 'Paleobiology Database result not request-bound'}</h3><p>{identity.transportBound ? `Paleobiology Database returned an empty taxon records array for the exact executed name request “${request.name}”.` : `Paleobiology Database returned a coherent empty taxon result for “${request.name}”, but executed request evidence was unavailable.`}</p></div>
  }

  const taxa = root.records.map(model).filter((taxon): taxon is FossilTaxon => Boolean(taxon))
  if (!taxa.length) return <div className="domain-card domain-empty paleobiodb-taxon-preview" {...requestAttrs} data-result-state="invalid"><h3>Invalid fossil taxon response</h3><p>Paleobiology Database returned records without the required taxon identifier and scientific name.</p></div>

  const invalidRecordCount = root.records.length - taxa.length
  const state = invalidRecordCount || !identity.transportBound ? 'partial' : 'ready'
  const first = taxa[0]
  return <div className="domain-card paleobiodb-taxon-preview" {...requestAttrs} data-result-state={state} data-provider-record-count={root.records.length} data-valid-record-count={taxa.length} data-invalid-record-count={invalidRecordCount} data-taxon-count={taxa.length} data-primary-taxon-no={first.taxonNo} data-primary-taxon-name={first.name} data-primary-rank={first.rank} data-primary-extancy={first.extancy} data-primary-fossil-occurrence-count={first.occurrenceCount} data-primary-accepted-name={first.acceptedName}>
    <CardHeading eyebrow="Paleobiology Database · Taxonomic names" title={`Fossil taxon · ${request.name}`} description={identity.transportBound ? 'Exact-request-bound PBDB taxon identity, accepted-name relationship and extancy. Fossil occurrence counts include records assigned to this taxon or any of its subtaxa.' : 'The taxon response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}><span className="domain-state">{state === 'partial' ? 'Partial taxon evidence' : first.extancy ?? 'Extancy not supplied'}</span></CardHeading>
    {!identity.transportBound && <p className="domain-note">Executed request evidence was unavailable. The taxonomic records remain visible as partial evidence but are not claimed as exact-request-bound.</p>}
    {invalidRecordCount > 0 && <p className="domain-note">This response is incomplete or malformed. {invalidRecordCount} record{invalidRecordCount === 1 ? '' : 's'} without both the provider taxon ID and scientific name {invalidRecordCount === 1 ? 'was' : 'were'} omitted.</p>}
    <ol className="biodiversity-record-list paleobiodb-taxon-list" aria-label="Paleobiology Database taxon records">
      {taxa.map((taxon, index) => <li key={`${taxon.taxonNo}-${index}`} data-taxon-index={index + 1} data-taxon-no={taxon.taxonNo} data-taxon-name={taxon.name} data-rank={taxon.rank} data-extancy={taxon.extancy} data-fossil-occurrence-count={taxon.occurrenceCount} data-accepted-name={taxon.acceptedName}>
        <header><div><small>{`PBDB taxon ${taxon.taxonNo}`}</small><h4>{taxon.name}</h4></div><span>{taxon.extancy ?? 'Extancy not supplied'}</span></header>
        <Facts items={[
          { label: 'Rank', value: taxon.rank ?? 'Not supplied' },
          { label: 'Accepted name', value: taxon.acceptedName ?? 'Not supplied' },
          { label: 'Accepted taxon ID', value: taxon.acceptedNo ?? 'Not supplied' },
          { label: 'Fossil occurrences · taxon + subtaxa', value: taxon.occurrenceCount === undefined ? 'Not supplied' : numericText(taxon.occurrenceCount) },
          { label: 'Parent taxon ID', value: taxon.parentNo ?? 'Not supplied' },
          { label: 'Name reference ID', value: taxon.referenceNo ?? 'Not supplied' },
        ]}/>
        {taxon.originalNo && taxon.originalNo !== taxon.taxonNo && <p className="biodiversity-note"><strong>Original taxon ID:</strong> {taxon.originalNo}</p>}
        {taxon.acceptedRank && taxon.acceptedRank !== taxon.rank && <p className="biodiversity-note"><strong>Accepted rank:</strong> {taxon.acceptedRank}</p>}
      </li>)}
    </ol>
    <p className="domain-note">PBDB defines n_occs as fossil occurrences identified as this taxon or any subtaxa. It is not a direct-only occurrence count for the named taxon.</p>
  </div>
}
