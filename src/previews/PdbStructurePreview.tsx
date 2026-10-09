import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, DateValue, Facts, finite, rows, text } from './cardPrimitives'

const dateOnly = (value: unknown) => {
  const candidate = text(value)
  return candidate && /^\d{4}-\d{2}-\d{2}/.test(candidate) ? candidate.slice(0, 10) : undefined
}

const primaryCitation = (value: unknown) => {
  const citations = rows(value)
  return citations.find((citation) => text(citation.rcsb_is_primary) === 'Y') ?? citations[0] ?? {}
}

type PdbRequest = { entryId: string; transportBound: boolean }
type PdbRequestUrl = Omit<PdbRequest, 'transportBound'>

const parseRequestUrl = (requestUrl?: string): PdbRequestUrl | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const match = /^\/rest\/v1\/core\/entry\/([A-Za-z0-9]{4})$/.exec(url.pathname)
    if (url.protocol !== 'https:' || url.hostname !== 'data.rcsb.org' || url.port || url.username || url.password || url.hash || url.search || !match) return undefined
    const entryId = match[1].toUpperCase()
    const canonical = `https://data.rcsb.org/rest/v1/core/entry/${entryId}`
    return requestUrl === canonical ? { entryId } : undefined
  } catch { return undefined }
}

const requestIdentity = (requestUrl?: string, executedRequest?: ExecutedRequestContext): PdbRequest | null | undefined => {
  const displayed = parseRequestUrl(requestUrl)
  if (requestUrl && !displayed) return null
  if (!executedRequest) return displayed ? { ...displayed, transportBound: false } : undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && requestUrl !== executedRequest.url)) return null
  const executed = parseRequestUrl(executedRequest.url)
  return executed ? { ...executed, transportBound: true } : null
}

export function PdbStructurePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = requestIdentity(requestUrl, executedRequest)
  if (request === null) return <CardEmpty domain="molecular-structure" title="Invalid RCSB PDB executed request" detail="The successful response is not bound to the exact supported bodyless GET RCSB core-entry request used by this demo." state="invalid"/>
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <CardEmpty domain="molecular-structure" title="Invalid RCSB PDB structure response" detail="RCSB PDB returned HTTP-success data without the documented core-entry object." state="invalid"/>
  }

  const root = asRecord(data)
  const rootId = text(root.rcsb_id)?.toUpperCase()
  const entry = asRecord(root.entry)
  const entryId = text(entry.id)?.toUpperCase()
  const identifiers = asRecord(root.rcsb_entry_container_identifiers)
  const containerEntryId = text(identifiers.entry_id)?.toUpperCase()
  if (!rootId || !entryId || !containerEntryId) {
    return <CardEmpty domain="molecular-structure" title="Invalid RCSB PDB structure response" detail="RCSB PDB returned a core-entry object without the provider-owned rcsb_id, entry.id, and container entry_id identity fields." state="invalid"/>
  }

  if (rootId !== entryId || rootId !== containerEntryId) {
    return <CardEmpty domain="molecular-structure" title="RCSB PDB structure identity mismatch" detail="The provider-owned core-entry identifiers disagree, so no structure metadata is presented as trustworthy." state="invalid"/>
  }

  const requested = request?.entryId
  if (requested && requested !== rootId) {
    return <CardEmpty domain="molecular-structure" title="RCSB PDB structure identity mismatch" detail="The returned core-entry identifier does not match the requested PDB entry, so no structure metadata is presented as trustworthy." state="invalid"/>
  }

  const structure = asRecord(root.struct)
  const providerTitle = text(structure.title)
  const title = providerTitle ?? `PDB ${rootId}`
  const experimentalMethods = rows(root.exptl).map((record) => text(record.method)).filter((value): value is string => Boolean(value))
  const entryInfo = asRecord(root.rcsb_entry_info)
  const resolution = rows(root.refine).map((record) => finite(record.ls_d_res_high)).find((value) => value !== undefined)
    ?? (Array.isArray(entryInfo.resolution_combined) ? entryInfo.resolution_combined.map(finite).find((value) => value !== undefined) : undefined)
  const polymerComposition = text(entryInfo.polymer_composition)
  const polymerEntityCount = finite(entryInfo.polymer_entity_count)
  const entityCount = finite(entryInfo.entity_count)
  const atomCount = finite(entryInfo.deposited_atom_count)
  const assemblyCount = finite(entryInfo.assembly_count)
  const boundComponents = Array.isArray(entryInfo.nonpolymer_bound_components)
    ? entryInfo.nonpolymer_bound_components.map(text).filter((value): value is string => Boolean(value))
    : []

  const accession = asRecord(root.rcsb_accession_info)
  const deposited = dateOnly(accession.deposit_date)
  const released = dateOnly(accession.initial_release_date)
  const revised = dateOnly(accession.revision_date)
  const statusCode = text(accession.status_code)

  const citation = primaryCitation(root.citation)
  const citationTitle = text(citation.title)
  const journal = text(citation.rcsb_journal_abbrev) ?? text(citation.journal_abbrev)
  const citationYear = finite(citation.year)
  const doi = text(citation.pdbx_database_id_DOI)
  const pubmedId = finite(citation.pdbx_database_id_PubMed)
  const authors = Array.isArray(citation.rcsb_authors)
    ? citation.rcsb_authors.map(text).filter((value): value is string => Boolean(value))
    : []
  const state = request?.transportBound && providerTitle && experimentalMethods.length > 0 && statusCode && released ? 'ready' : 'partial'

  return <div
    className="domain-card pdb-structure-preview"
    data-domain-card="molecular-structure"
    data-result-state={state}
    data-request-bound={request?.transportBound ? 'true' : 'false'}
    data-request-contract="exact-rcsb-core-entry-get"
    data-requested-entry-id={requested}
    data-identity-match="true"
    data-rcsb-id={rootId}
    data-entry-id={entryId}
    data-container-entry-id={containerEntryId}
    data-experimental-method={experimentalMethods.join(', ')}
    data-resolution-angstroms={resolution}
    data-polymer-composition={polymerComposition}
    data-polymer-entity-count={polymerEntityCount}
    data-entity-count={entityCount}
    data-deposited-atom-count={atomCount}
    data-primary-citation-doi={doi}
    data-initial-release-date={released}
    data-revision-date={revised}
  >
    <CardHeading
      eyebrow="RCSB PDB structure record"
      title={title}
      description={`PDB ${rootId} · Experimental structure metadata and primary publication`}
    >
      <span className="domain-state">{state === 'partial' ? 'Partial provider response' : experimentalMethods.join(' + ')}</span>
    </CardHeading>

    {state === 'partial' && <p className="domain-note">{request?.transportBound ? 'RCSB PDB returned matching core-entry identity, but one or more expected title, experimental-method, archive-status, or release-date fields are unavailable. Missing context is not inferred.' : 'The RCSB PDB response is structurally useful, but executed-request identity is unavailable, so it cannot be marked ready.'}</p>}

    <Facts items={[
      { label: 'PDB entry', value: <code>{rootId}</code> },
      { label: 'Experimental method', value: experimentalMethods.join(', ') || 'Not supplied' },
      { label: 'Resolution', value: resolution === undefined ? 'Not supplied' : `${resolution.toLocaleString('en', { maximumFractionDigits: 3 })} Å` },
      { label: 'Polymer composition', value: polymerComposition ?? 'Not supplied' },
      { label: 'Polymer entities', value: polymerEntityCount ?? 'Not supplied' },
      { label: 'All entities', value: entityCount ?? 'Not supplied' },
      { label: 'Deposited atoms', value: atomCount === undefined ? 'Not supplied' : atomCount.toLocaleString('en') },
      { label: 'Biological assemblies', value: assemblyCount ?? 'Not supplied' },
      { label: 'Bound components', value: boundComponents.length ? boundComponents.join(', ') : 'None reported' },
      { label: 'Archive status', value: statusCode ?? 'Not supplied' },
      { label: 'Deposited', value: <DateValue value={deposited}/> },
      { label: 'Initial release', value: <DateValue value={released}/> },
      { label: 'Latest revision', value: <DateValue value={revised}/> },
    ]}/>

    {citationTitle && <section className="structure-citation" aria-labelledby="pdb-primary-citation-heading">
      <header>
        <span className="domain-eyebrow">Primary publication</span>
        <h4 id="pdb-primary-citation-heading">{citationTitle}</h4>
      </header>
      <p>{[journal, citationYear].filter(Boolean).join(' · ') || 'Publication details not supplied'}</p>
      {authors.length > 0 && <p><strong>Authors:</strong> {authors.join(', ')}</p>}
      <dl>
        {doi && <div><dt>DOI</dt><dd><code>{doi}</code></dd></div>}
        {pubmedId !== undefined && <div><dt>PubMed ID</dt><dd><code>{pubmedId}</code></dd></div>}
      </dl>
    </section>}

    <p className="domain-note">RCSB PDB Data API core-entry records identify each object with rcsb_id plus container identifiers. This card presents only a matching provider-owned structure identity; Raw JSON remains available for the complete entry.</p>
  </div>
}
