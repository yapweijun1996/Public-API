import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, finite, rows, text } from './cardPrimitives'

type FunctionAnnotation = {
  molecule?: string
  text: string
}

const accessionPattern = /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})$/
const validAccession = (value: unknown) => {
  const candidate = text(value)
  return candidate && accessionPattern.test(candidate) ? candidate : undefined
}

type ProteinRequest = { accession: string; transportBound: boolean }
type ProteinRequestUrl = Omit<ProteinRequest, 'transportBound'>

const parseRequestUrl = (requestUrl?: string): ProteinRequestUrl | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const match = /^\/uniprotkb\/([^/]+)\.json$/.exec(url.pathname)
    if (url.protocol !== 'https:' || url.hostname !== 'rest.uniprot.org' || url.port || url.username || url.password || url.hash || url.search || !match) return undefined
    const accession = validAccession(decodeURIComponent(match[1]))
    if (!accession) return undefined
    return requestUrl === `https://rest.uniprot.org/uniprotkb/${accession}.json` ? { accession } : undefined
  } catch {
    return undefined
  }
}

const requestIdentity = (requestUrl?: string, executedRequest?: ExecutedRequestContext): ProteinRequest | null | undefined => {
  const displayed = parseRequestUrl(requestUrl)
  if (requestUrl && !displayed) return null
  if (!executedRequest) return displayed ? { ...displayed, transportBound: false } : undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && requestUrl !== executedRequest.url)) return null
  const executed = parseRequestUrl(executedRequest.url)
  return executed ? { ...executed, transportBound: true } : null
}

const nestedText = (value: unknown, ...path: string[]) => {
  let current: unknown = value
  for (const key of path) current = asRecord(current)[key]
  return text(current)
}

const providerFunctions = (comments: unknown): FunctionAnnotation[] => rows(comments)
  .filter((comment) => text(comment.commentType) === 'FUNCTION')
  .flatMap((comment) => {
    const molecule = text(comment.molecule)
    return rows(comment.texts)
      .map((entry) => text(entry.value))
      .filter((value): value is string => Boolean(value))
      .map((value) => ({ molecule, text: value }))
  })

export function ProteinAnnotationPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = requestIdentity(requestUrl, executedRequest)
  if (request === null) return <CardEmpty domain="protein-annotation" title="Invalid UniProt executed request" detail="The successful response is not bound to the exact supported bodyless GET UniProtKB entry request." state="invalid"/>
  if (!request) return <CardEmpty domain="protein-annotation" title="Invalid UniProt protein request" detail="The successful response was not tied to the supported exact UniProtKB entry request." state="invalid"/>
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <CardEmpty domain="protein-annotation" title="Invalid UniProt protein response" detail="UniProt returned HTTP-success data without the documented protein entry object." state="invalid"/>
  }

  const root = asRecord(data)
  const accession = validAccession(root.primaryAccession)
  if (!accession) return <CardEmpty domain="protein-annotation" title="Invalid UniProt protein response" detail="UniProt returned a protein entry without a valid primary accession, so no protein identity is presented as trustworthy." state="invalid"/>

  const requested = request.accession
  const rawSecondary = root.secondaryAccessions
  const secondaryShapeValid = rawSecondary === undefined || Array.isArray(rawSecondary)
  const secondaryValues = Array.isArray(rawSecondary) ? rawSecondary : []
  const secondaryAccessions = secondaryValues.map(validAccession).filter((value): value is string => Boolean(value))
  const invalidSecondaryCount = secondaryValues.length - secondaryAccessions.length
  const requestedRole = requested === accession ? 'primary' : secondaryAccessions.includes(requested) ? 'secondary' : 'mismatch'
  if (requestedRole === 'mismatch') {
    return <CardEmpty domain="protein-annotation" title="UniProt protein identity mismatch" detail="The returned protein entry does not identify the requested accession as either its primary accession or a provider-reported secondary accession." state="invalid"/>
  }

  const entryName = text(root.uniProtkbId)
  const entryType = text(root.entryType)
  const annotationScore = finite(root.annotationScore)
  const organism = asRecord(root.organism)
  const organismName = text(organism.scientificName)
  const organismCommonName = text(organism.commonName)
  const taxonId = finite(organism.taxonId)
  const sequence = asRecord(root.sequence)
  const sequenceLength = finite(sequence.length)
  const molecularWeight = finite(sequence.molWeight)
  const providerProteinName = nestedText(root.proteinDescription, 'recommendedName', 'fullName', 'value')
    ?? nestedText(rows(asRecord(root.proteinDescription).submissionNames)[0], 'fullName', 'value')
  const proteinName = providerProteinName ?? entryName
  const geneRecords = rows(root.genes)
  const primaryGene = geneRecords.map((gene) => nestedText(gene, 'geneName', 'value')).find(Boolean)
  const geneSynonyms = geneRecords.flatMap((gene) => rows(gene.synonyms).map((synonym) => text(synonym.value)).filter((value): value is string => Boolean(value)))
  const functions = providerFunctions(root.comments)
  const visibleFunctions = functions.slice(0, 3)
  const reviewed = entryType?.toLowerCase().startsWith('uniprotkb reviewed') ?? false
  const state = request.transportBound && entryName && entryType && organismName && sequenceLength !== undefined && proteinName && secondaryShapeValid && invalidSecondaryCount === 0
    ? 'ready'
    : 'partial'

  return <div
    className="domain-card protein-annotation-preview"
    data-domain-card="protein-annotation"
    data-result-state={state}
    data-request-bound={request.transportBound ? 'true' : 'false'}
    data-request-contract="exact-uniprotkb-entry-json"
    data-requested-accession={requested}
    data-requested-accession-role={requestedRole}
    data-identity-match="true"
    data-primary-accession={accession}
    data-secondary-accession-count={secondaryAccessions.length}
    data-invalid-secondary-accession-count={invalidSecondaryCount}
    data-primary-entry-name={entryName}
    data-primary-protein-name={proteinName}
    data-primary-gene={primaryGene}
    data-organism-name={organismName}
    data-organism-taxon-id={taxonId}
    data-entry-type={entryType}
    data-annotation-score={annotationScore}
    data-sequence-length={sequenceLength}
    data-molecular-weight-daltons={molecularWeight}
    data-function-comment-count={functions.length}
  >
    <CardHeading
      eyebrow="UniProtKB protein annotation"
      title={proteinName ?? accession}
      description={entryName ? `${entryName} · Stable protein identity and provider annotation` : `Primary accession ${accession} · provider annotation`}
    >
      <span className={`domain-state${entryType && !reviewed ? ' warning' : ''}`}>{state === 'partial' && !entryType ? 'Partial provider response' : entryType ?? 'Partial provider response'}</span>
    </CardHeading>

    {state === 'partial' && <p className="domain-note">{request.transportBound ? 'UniProt returned a valid protein identity, but one or more core annotation context fields or secondary-accession values are unavailable or malformed. Missing context is not inferred.' : 'The provider result is structurally useful, but executed-request identity is unavailable, so it cannot be marked ready.'}</p>}
    {requestedRole === 'secondary' && requested && <p className="domain-note">Requested accession <code>{requested}</code> is a provider-reported secondary accession for current primary accession <code>{accession}</code>.</p>}

    <Facts items={[
      { label: 'Primary accession', value: <code>{accession}</code> },
      ...(requested && requested !== accession ? [{ label: 'Requested accession', value: <code>{requested}</code> }] : []),
      { label: 'Entry name', value: entryName ?? 'Not supplied' },
      { label: 'Primary gene', value: primaryGene ?? 'Not supplied' },
      { label: 'Organism', value: organismName ? `${organismName}${organismCommonName ? ` (${organismCommonName})` : ''}` : 'Not supplied' },
      { label: 'Taxonomy ID', value: taxonId ?? 'Not supplied' },
      { label: 'Sequence length', value: sequenceLength === undefined ? 'Not supplied' : `${sequenceLength.toLocaleString('en')} residues` },
      { label: 'Molecular mass', value: molecularWeight === undefined ? 'Not supplied' : `${molecularWeight.toLocaleString('en')} Da` },
      { label: 'Annotation score', value: annotationScore === undefined ? 'Not supplied' : `${annotationScore}/5` },
    ]}/>

    {geneSynonyms.length > 0 && <section className="protein-identifiers" aria-labelledby="protein-gene-synonyms-heading">
      <h4 id="protein-gene-synonyms-heading">Gene synonyms</h4>
      <ul>{geneSynonyms.slice(0, 8).map((synonym) => <li key={synonym}><code>{synonym}</code></li>)}</ul>
    </section>}

    {visibleFunctions.length > 0 && <section className="protein-functions" aria-labelledby="protein-functions-heading">
      <header><div><span className="domain-eyebrow">General annotation</span><h4 id="protein-functions-heading">Function</h4></div><span>{functions.length} returned comments</span></header>
      <ol>
        {visibleFunctions.map((annotation, index) => <li key={`${annotation.molecule ?? 'protein'}-${index}`} data-function-index={index + 1}>
          {annotation.molecule && <strong>{annotation.molecule}</strong>}
          <p>{annotation.text}</p>
        </li>)}
      </ol>
      {functions.length > visibleFunctions.length && <p className="domain-note">Showing {visibleFunctions.length} of {functions.length} returned function comments. Raw JSON retains the complete annotation.</p>}
    </section>}

    <p className="domain-note">UniProtKB reports whether an entry is reviewed (Swiss-Prot) or unreviewed (TrEMBL). Primary accessions are the stable citable identifiers; secondary accessions can resolve historical merged identities to the current primary record.</p>
  </div>
}
