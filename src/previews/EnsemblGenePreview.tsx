import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, finite, text } from './cardPrimitives'

const humanizeSpecies = (value: string | undefined) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined
const strandLabel = (value: number | undefined) => value === 1 ? '+1 (forward)' : value === -1 ? '-1 (reverse)' : 'Not supplied'
const coordinate = (value: number | undefined) => value === undefined ? 'Not supplied' : value.toLocaleString('en-US')
type EnsemblRequest = { geneId: string; transportBound: boolean }
type EnsemblRequestUrl = Omit<EnsemblRequest, 'transportBound'>

const geneIdPattern = /^ENS[A-Z]*G[0-9]{11}$/

const parseRequestUrl = (requestUrl?: string): EnsemblRequestUrl | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const match = /^\/lookup\/id\/([^/]+)$/.exec(url.pathname)
    const keys = [...url.searchParams.keys()]
    const exactContentType = keys.length === 1 && keys[0] === 'content-type' && url.searchParams.getAll('content-type').length === 1 && url.searchParams.get('content-type') === 'application/json'
    if (url.protocol !== 'https:' || url.hostname !== 'rest.ensembl.org' || url.port || url.username || url.password || url.hash || !match || !exactContentType) return undefined
    const geneId = decodeURIComponent(match[1])
    if (!geneIdPattern.test(geneId)) return undefined
    const canonical = `https://rest.ensembl.org/lookup/id/${encodeURIComponent(geneId)}?${new URLSearchParams({ 'content-type': 'application/json' }).toString()}`
    return requestUrl === canonical ? { geneId } : undefined
  } catch { return undefined }
}

const requestIdentity = (requestUrl?: string, executedRequest?: ExecutedRequestContext): EnsemblRequest | null | undefined => {
  const displayed = parseRequestUrl(requestUrl)
  if (requestUrl && !displayed) return null
  if (!executedRequest) return displayed ? { ...displayed, transportBound: false } : undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && requestUrl !== executedRequest.url)) return null
  const executed = parseRequestUrl(executedRequest.url)
  return executed ? { ...executed, transportBound: true } : null
}

export function EnsemblGenePreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = requestIdentity(requestUrl, executedRequest)
  if (request === null) return <CardEmpty domain="gene-locus" title="Invalid Ensembl executed request" detail="The successful response is not bound to the exact supported bodyless GET Ensembl stable-ID lookup used by this demo." state="invalid"/>
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <CardEmpty domain="gene-locus" title="Invalid Ensembl gene response" detail="Ensembl returned HTTP-success data without the documented stable-ID lookup object." state="invalid"/>
  }

  const root = asRecord(data)
  const geneId = text(root.id)
  const objectType = text(root.object_type)
  if (!geneId) return <CardEmpty domain="gene-locus" title="Invalid Ensembl gene response" detail="Ensembl returned a lookup record without a stable identifier, so no gene identity is presented as trustworthy." state="invalid"/>

  const version = finite(root.version)
  const versionedId = version === undefined ? geneId : `${geneId}.${version}`
  const requested = request?.geneId
  const identityMatch = !requested || requested === geneId || requested === versionedId
  if (!identityMatch) {
    return <CardEmpty domain="gene-locus" title="Ensembl gene identity mismatch" detail="The returned stable identifier does not match the requested Ensembl gene ID, so no locus data is presented as trustworthy." state="invalid"/>
  }
  if (objectType !== 'Gene') {
    return <CardEmpty domain="gene-locus" title="Ensembl lookup is not a gene" detail="The stable-ID endpoint returned a transcript, protein, or other feature instead of the Gene object required by this demo." state="invalid"/>
  }

  const symbol = text(root.display_name)
  const description = text(root.description)
  const biotype = text(root.biotype)
  const species = text(root.species)
  const assembly = text(root.assembly_name)
  const seqRegion = text(root.seq_region_name)
  const rawStart = finite(root.start)
  const rawEnd = finite(root.end)
  const rawStrand = finite(root.strand)
  const locusValid = Boolean(seqRegion) && rawStart !== undefined && rawStart >= 1 && rawEnd !== undefined && rawEnd >= rawStart
  const strandValid = rawStrand === 1 || rawStrand === -1
  const start = locusValid ? rawStart : undefined
  const end = locusValid ? rawEnd : undefined
  const strand = strandValid ? rawStrand : undefined
  const canonicalTranscript = text(root.canonical_transcript)
  const source = text(root.source)
  const databaseType = text(root.db_type)
  const state = request?.transportBound && species && assembly && biotype && locusValid && strandValid ? 'ready' : 'partial'
  const location = seqRegion && start !== undefined && end !== undefined
    ? `${assembly ? `${assembly} · ` : ''}${seqRegion}:${coordinate(start)}–${coordinate(end)}`
    : 'Not supplied'

  return <div
    className="domain-card ensembl-gene-preview"
    data-domain-card="gene-locus"
    data-result-state={state}
    data-request-bound={request?.transportBound ? 'true' : 'false'}
    data-request-contract="exact-ensembl-gene-lookup-get"
    data-requested-gene-id={requested}
    data-identity-match={String(identityMatch)}
    data-primary-gene-id={geneId}
    data-object-type={objectType}
    data-gene-version={version}
    data-gene-symbol={symbol}
    data-biotype={biotype}
    data-species={species}
    data-assembly={assembly}
    data-seq-region={seqRegion}
    data-start={start}
    data-end={end}
    data-strand={strand}
    data-canonical-transcript={canonicalTranscript}
  >
    <CardHeading
      eyebrow="Ensembl gene record"
      title={symbol ?? geneId}
      description={`${versionedId}${biotype ? ` · ${biotype}` : ''}${species ? ` · ${humanizeSpecies(species)}` : ''}`}
    >
      <span className="domain-state">{state === 'ready' ? 'Gene' : 'Partial gene record'}</span>
    </CardHeading>

    {state === 'partial' && <p className="domain-note">{request?.transportBound ? 'Ensembl returned a matching Gene identity, but one or more core species, assembly, biotype, coordinate, or strand fields are missing or invalid.' : 'The Ensembl response is structurally useful, but executed-request identity is unavailable, so it cannot be marked ready.'}</p>}

    <Facts items={[
      { label: 'Stable gene ID', value: <code>{versionedId}</code> },
      { label: 'Gene symbol', value: symbol ?? 'Not supplied' },
      { label: 'Biotype', value: biotype ?? 'Not supplied' },
      { label: 'Species', value: humanizeSpecies(species) ?? 'Not supplied' },
      { label: 'Genome assembly', value: assembly ?? 'Not supplied' },
      { label: 'Genomic region', value: location },
      { label: 'Strand', value: strandLabel(strand) },
      { label: 'Canonical transcript', value: canonicalTranscript ? <code>{canonicalTranscript}</code> : 'Not supplied' },
      { label: 'Annotation source', value: source ?? 'Not supplied' },
      { label: 'Database', value: databaseType ?? 'Not supplied' },
    ]}/>

    {description && <section className="gene-description" aria-labelledby="ensembl-gene-description-heading">
      <h4 id="ensembl-gene-description-heading">Gene description</h4>
      <p>{description}</p>
    </section>}

    <p className="domain-note">This card accepts only a provider-matched Ensembl Gene object. The stable-ID endpoint can also resolve transcripts and proteins, but those feature types are rejected here rather than being relabelled as genes. Coordinates remain tied to the provider-reported genome assembly.</p>
  </div>
}
