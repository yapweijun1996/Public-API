import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, finite, text } from './cardPrimitives'

const exactText = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

type PubChemRequest = { name: string; transportBound: boolean }
type PubChemRequestUrl = Omit<PubChemRequest, 'transportBound'>

const parseRequestUrl = (requestUrl?: string): PubChemRequestUrl | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const match = /^\/rest\/pug\/compound\/name\/([^/]+)\/property\/MolecularFormula,MolecularWeight,IUPACName\/JSON$/.exec(url.pathname)
    if (url.protocol !== 'https:' || url.hostname !== 'pubchem.ncbi.nlm.nih.gov' || url.port || url.username || url.password || url.hash || url.search || !match) return undefined
    const name = decodeURIComponent(match[1])
    if (!name.trim() || name !== name.trim()) return undefined
    const canonical = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`
    return canonical === requestUrl ? { name } : undefined
  } catch {
    return undefined
  }
}

const requestIdentity = (requestUrl?: string, executedRequest?: ExecutedRequestContext): PubChemRequest | null | undefined => {
  const displayed = parseRequestUrl(requestUrl)
  if (requestUrl && !displayed) return null
  if (!executedRequest) return displayed ? { ...displayed, transportBound: false } : undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && requestUrl !== executedRequest.url)) return null
  const executed = parseRequestUrl(executedRequest.url)
  return executed ? { ...executed, transportBound: true } : null
}

type CompoundProperty = {
  cid: number
  iupacName?: string
  molecularFormula?: string
  molecularWeight?: string
}

const compoundProperty = (value: unknown): CompoundProperty | undefined => {
  const property = asRecord(value)
  const cid = finite(property.CID)
  if (cid === undefined || !Number.isInteger(cid) || cid <= 0) return undefined
  return {
    cid,
    iupacName: text(property.IUPACName),
    molecularFormula: text(property.MolecularFormula),
    molecularWeight: exactText(property.MolecularWeight),
  }
}

const complete = (property: CompoundProperty) => Boolean(property.iupacName && property.molecularFormula && property.molecularWeight)

export function PubChemCompoundPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = requestIdentity(requestUrl, executedRequest)
  if (request === null) return <CardEmpty domain="compound-properties" title="Invalid PubChem executed request" detail="The successful response is not bound to the exact supported bodyless GET PubChem compound-property request." state="invalid"/>
  if (!request) return <CardEmpty domain="compound-properties" title="Invalid PubChem compound request" detail="The successful response was not tied to the supported exact PubChem compound-property request." state="invalid"/>
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <CardEmpty domain="compound-properties" title="Invalid PubChem compound response" detail="PubChem returned HTTP-success data without the documented property-table response object." state="invalid"/>
  }

  const root = asRecord(data)
  if (!root.PropertyTable || typeof root.PropertyTable !== 'object' || Array.isArray(root.PropertyTable)) {
    return <CardEmpty domain="compound-properties" title="Invalid PubChem compound response" detail="PubChem returned HTTP-success data without the documented PropertyTable object." state="invalid"/>
  }
  const propertyTable = asRecord(root.PropertyTable)
  if (!Array.isArray(propertyTable.Properties)) {
    return <CardEmpty domain="compound-properties" title="Invalid PubChem compound response" detail="PubChem returned HTTP-success data without the documented PropertyTable.Properties array." state="invalid"/>
  }
  if (propertyTable.Properties.length === 0) {
    return <CardEmpty domain="compound-properties" title="Invalid PubChem compound response" detail="PubChem returned an empty property table with HTTP success. PUG REST uses HTTP 404 when the requested compound name is not found, so this response cannot be treated as a legitimate empty lookup." state="invalid"/>
  }

  const compounds = propertyTable.Properties.map(compoundProperty).filter((property): property is CompoundProperty => Boolean(property))
  const invalidRecordCount = propertyTable.Properties.length - compounds.length
  if (!compounds.length) {
    return <CardEmpty domain="compound-properties" title="Invalid PubChem compound response" detail="PubChem returned property rows without a valid provider-owned CID identity." state="invalid"/>
  }

  const requested = request.name
  const incompleteRecordCount = compounds.filter((property) => !complete(property)).length
  const state = !request.transportBound || invalidRecordCount > 0 || incompleteRecordCount > 0 ? 'partial' : 'ready'
  const first = compounds[0]
  const title = compounds.length === 1
    ? first.iupacName ?? `PubChem CID ${first.cid}`
    : `${compounds.length} PubChem compounds${requested ? ` matched “${requested}”` : ''}`

  return <div
    className="domain-card pubchem-compound-preview"
    data-domain-card="compound-properties"
    data-result-state={state}
    data-request-bound={request.transportBound ? 'true' : 'false'}
    data-request-contract="exact-pug-compound-name-properties"
    data-requested-compound-name={requested}
    data-provider-record-count={propertyTable.Properties.length}
    data-valid-record-count={compounds.length}
    data-invalid-record-count={invalidRecordCount}
    data-incomplete-record-count={incompleteRecordCount}
    data-result-cardinality={compounds.length === 1 ? 'single' : 'multiple'}
    data-primary-cid={first.cid}
    data-primary-iupac-name={first.iupacName}
    data-molecular-formula={first.molecularFormula}
    data-molecular-weight={first.molecularWeight}
  >
    <CardHeading
      eyebrow="PubChem compound property record"
      title={title}
      description={compounds.length === 1
        ? `CID ${first.cid}${requested ? ` · requested name “${requested}”` : ''} · PUG REST compound property table`
        : `The requested chemical name resolved to multiple provider-owned CIDs. Each returned compound identity is preserved instead of choosing one silently.`}
    >
      <span className="domain-state">{state === 'ready' ? `${compounds.length} CID${compounds.length === 1 ? '' : 's'}` : 'Partial provider response'}</span>
    </CardHeading>

    {state === 'partial' && <p className="domain-note">{request.transportBound ? 'PubChem returned at least one provider-owned CID, but one or more returned property records are incomplete or malformed. Trusted CIDs remain visible; missing values and malformed rows are not inferred.' : 'The provider result is structurally useful, but executed-request identity is unavailable, so it cannot be marked ready.'}</p>}

    {compounds.length === 1 ? <Facts items={[
      { label: 'Requested compound name', value: requested ?? 'Not supplied' },
      { label: 'PubChem CID', value: first.cid },
      { label: 'Molecular formula', value: first.molecularFormula ? <code>{first.molecularFormula}</code> : 'Not supplied' },
      { label: 'Molecular weight', value: first.molecularWeight ? `${first.molecularWeight} g/mol` : 'Not supplied' },
      { label: 'IUPAC name', value: first.iupacName ?? 'Not supplied' },
    ]}/> : <ol className="pubchem-compound-list" aria-label="PubChem compound property records">
      {compounds.map((property, index) => <li key={`${property.cid}-${index}`} data-compound-index={index + 1} data-cid={property.cid} data-iupac-name={property.iupacName} data-molecular-formula={property.molecularFormula} data-molecular-weight={property.molecularWeight}>
        <header><div><small>PubChem CID {property.cid}</small><h4>{property.iupacName ?? `CID ${property.cid}`}</h4></div><span>{complete(property) ? 'Property record' : 'Partial record'}</span></header>
        <Facts items={[
          { label: 'Molecular formula', value: property.molecularFormula ? <code>{property.molecularFormula}</code> : 'Not supplied' },
          { label: 'Molecular weight', value: property.molecularWeight ? `${property.molecularWeight} g/mol` : 'Not supplied' },
          { label: 'IUPAC name', value: property.iupacName ?? 'Not supplied' },
        ]}/>
      </li>)}
    </ol>}

    <p className="domain-note">PubChem chemical names can resolve to more than one CID. PUG REST returns compound property tables for successful lookups and uses HTTP 404 when the requested input record is not found. Molecular weight is reported in g/mol. This is chemical reference data, not safety or clinical guidance.</p>
  </div>
}
