import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, Facts, finite, numericText, text } from './cardPrimitives'
import { cleanText } from './previewData'
import { trimmedText } from './semanticValidation'

type WormsTaxon = {
  aphiaId?: number
  scientificName: string
  authority?: string
  status?: string
  rank?: string
  validAphiaId?: number
  validName?: string
  validAuthority?: string
  unacceptReason?: string
  lsid?: string
  lineage: string[]
  isMarine?: number
  isBrackish?: number
  isFreshwater?: number
  isTerrestrial?: number
  isExtinct?: number
  modified?: string
}

const taxonModel = (value: unknown): WormsTaxon | undefined => {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const scientificName = cleanText(row.scientificname)
  if (!scientificName) return undefined
  return {
    aphiaId: finite(row.AphiaID),
    scientificName,
    authority: text(row.authority),
    status: text(row.status),
    rank: text(row.rank),
    validAphiaId: finite(row.valid_AphiaID),
    validName: cleanText(row.valid_name),
    validAuthority: text(row.valid_authority),
    unacceptReason: cleanText(row.unacceptreason),
    lsid: text(row.lsid),
    modified: text(row.modified),
    lineage: ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'].map((key) => cleanText(row[key])).filter((value): value is string => Boolean(value)),
    isMarine: finite(row.isMarine),
    isBrackish: finite(row.isBrackish),
    isFreshwater: finite(row.isFreshwater),
    isTerrestrial: finite(row.isTerrestrial),
    isExtinct: finite(row.isExtinct),
  }
}

type WormsRequest = { scientificName: string }
type BoundWormsRequest = {
  request?: WormsRequest
  transportBound: boolean
  invalidReason?: string
}

const REQUEST_PREFIX = '/rest/AphiaRecordsByName/'

export const parseWormsRequest = (requestUrl?: string): WormsRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.origin !== 'https://www.marinespecies.org' || url.port || url.username || url.password || url.hash || !url.pathname.startsWith(REQUEST_PREFIX)) return undefined
    if ([...url.searchParams.keys()].length !== 1 || url.searchParams.getAll('like').length !== 1 || url.searchParams.get('like') !== 'false') return undefined
    const encodedName = url.pathname.slice(REQUEST_PREFIX.length)
    if (!encodedName || encodedName.includes('/')) return undefined
    const decodedName = decodeURIComponent(encodedName)
    const scientificName = trimmedText(decodedName)
    if (!scientificName || scientificName !== decodedName) return undefined
    return { scientificName }
  } catch {
    return undefined
  }
}

const bindWormsRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundWormsRequest => {
  const request = parseWormsRequest(requestUrl)
  if (!request)
    return {
      transportBound: false,
      invalidReason: 'The displayed request was not the exact supported WoRMS AphiaRecordsByName query.',
    }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return {
      request,
      transportBound: false,
      invalidReason: 'The successful response was not bound to the exact supported bodyless GET WoRMS AphiaRecordsByName request.',
    }
  }
  const executed = parseWormsRequest(executedRequest.url)
  if (!executed || executed.scientificName !== request.scientificName) {
    return {
      request,
      transportBound: false,
      invalidReason: 'The displayed WoRMS request and executed request identity did not match.',
    }
  }
  return { request, transportBound: true }
}

const yesNoUnknown = (value?: number) => (value === undefined ? 'Not supplied' : value === 1 ? 'Yes' : value === 0 ? 'No' : numericText(value))

export function WormsSpeciesPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const identity = bindWormsRequest(requestUrl, executedRequest)
  const request = identity.request
  const baseAttrs = {
    'data-domain-card': 'marine-taxonomy',
    'data-request-bound': request && identity.transportBound ? 'true' : 'false',
    'data-request-contract': 'exact-worms-aphia-records-by-name-v2',
    'data-requested-scientific-name': request?.scientificName,
  }
  if (!request || identity.invalidReason)
    return (
      <div className="domain-card domain-empty worms-species-preview" {...baseAttrs} data-result-state="invalid">
        <h3>Invalid WoRMS taxon response</h3>
        <p>{identity.invalidReason ?? 'The successful response was not tied to the exact supported WoRMS request.'}</p>
      </div>
    )
  if (!Array.isArray(data))
    return (
      <div className="domain-card domain-empty worms-species-preview" {...baseAttrs} data-result-state="invalid">
        <h3>Invalid WoRMS taxon response</h3>
        <p>WoRMS returned a successful response that was not the documented AphiaRecords array.</p>
      </div>
    )
  if (!data.length) {
    const state = identity.transportBound ? 'empty' : 'partial'
    return (
      <div className="domain-card domain-empty worms-species-preview" {...baseAttrs} data-result-state={state}>
        <h3>{identity.transportBound ? 'No WoRMS taxon match returned' : 'WoRMS result not request-bound'}</h3>
        <p>{identity.transportBound ? `WoRMS returned no AphiaRecords for the exact executed scientific-name request “${request.scientificName}”.` : `WoRMS returned a coherent empty AphiaRecords result for “${request.scientificName}”, but executed request evidence was unavailable.`}</p>
      </div>
    )
  }
  const taxa = data.map(taxonModel).filter((taxon): taxon is WormsTaxon => Boolean(taxon))
  if (!taxa.length)
    return (
      <div className="domain-card domain-empty worms-species-preview" {...baseAttrs} data-result-state="invalid">
        <h3>Invalid WoRMS taxon response</h3>
        <p>WoRMS returned AphiaRecord rows without usable scientific-name identities.</p>
      </div>
    )
  const invalidRecordCount = data.length - taxa.length
  const first = taxa[0]
  const state = invalidRecordCount || !identity.transportBound ? 'partial' : 'ready'
  return (
    <div className="domain-card worms-species-preview" {...baseAttrs} data-result-state={state} data-provider-record-count={data.length} data-valid-record-count={taxa.length} data-invalid-record-count={invalidRecordCount} data-match-count={taxa.length} data-primary-aphia-id={first.aphiaId} data-primary-status={first.status} data-primary-valid-aphia-id={first.validAphiaId} data-primary-valid-name={first.validName}>
      <CardHeading eyebrow="WoRMS · Aphia taxonomic registry" title={`Taxonomy for ${request.scientificName}`} description={identity.transportBound ? 'The queried name and its current accepted-name relationship remain separate. An unaccepted name is never presented as if it were the current accepted taxon.' : 'The response is structurally coherent, but executed request evidence was unavailable, so it is not marked ready.'}>
        <span className="domain-state">{first.status ?? 'Status not supplied'}</span>
      </CardHeading>
      {!identity.transportBound && <p className="domain-note">Executed request evidence was unavailable. The taxonomic records remain visible as partial evidence but are not claimed as exact-request-bound.</p>}
      <ol className="biodiversity-record-list worms-taxon-list" aria-label="WoRMS taxon matches">
        {taxa.slice(0, 10).map((taxon, index) => {
          const acceptedDiffers = Boolean(taxon.validName && (taxon.validName !== taxon.scientificName || taxon.validAphiaId !== taxon.aphiaId))
          return (
            <li key={`${taxon.aphiaId ?? taxon.scientificName}-${index}`} data-taxon-index={index + 1} data-aphia-id={taxon.aphiaId} data-status={taxon.status} data-valid-aphia-id={taxon.validAphiaId} data-valid-name={taxon.validName}>
              <header>
                <div>
                  <small>{taxon.aphiaId === undefined ? 'AphiaID not supplied' : `AphiaID ${numericText(taxon.aphiaId)}`}</small>
                  <h4>{taxon.scientificName}</h4>
                  {taxon.authority && <p>{taxon.authority}</p>}
                </div>
                <span>{taxon.status ?? 'Status not supplied'}</span>
              </header>
              <Facts
                items={[
                  { label: 'Rank', value: taxon.rank ?? 'Not supplied' },
                  {
                    label: 'Current accepted name',
                    value: taxon.validName ?? 'Not supplied',
                  },
                  {
                    label: 'Accepted AphiaID',
                    value: taxon.validAphiaId === undefined ? 'Not supplied' : numericText(taxon.validAphiaId),
                  },
                  {
                    label: 'Accepted authority',
                    value: taxon.validAuthority ?? 'Not supplied',
                  },
                  { label: 'Marine', value: yesNoUnknown(taxon.isMarine) },
                  { label: 'Extinct', value: yesNoUnknown(taxon.isExtinct) },
                ]}
              />
              {acceptedDiffers && (
                <div className="accepted-name-callout">
                  <strong>Accepted-name resolution</strong>
                  <span>
                    {taxon.scientificName} → {taxon.validName}
                  </span>
                  <small>WoRMS valid_AphiaID {taxon.validAphiaId ?? 'not supplied'} identifies the current final accepted name.</small>
                </div>
              )}
              {taxon.unacceptReason && (
                <p className="biodiversity-note">
                  <strong>Unaccepted reason:</strong> {taxon.unacceptReason}
                </p>
              )}
              {taxon.lineage.length > 0 && (
                <p className="biodiversity-note">
                  <strong>Classification:</strong> {taxon.lineage.join(' › ')}
                </p>
              )}
              {taxon.lsid && (
                <p className="biodiversity-note">
                  <strong>LSID:</strong> <code>{taxon.lsid}</code>
                </p>
              )}
              <Facts
                items={[
                  { label: 'Brackish', value: yesNoUnknown(taxon.isBrackish) },
                  {
                    label: 'Freshwater',
                    value: yesNoUnknown(taxon.isFreshwater),
                  },
                  {
                    label: 'Terrestrial',
                    value: yesNoUnknown(taxon.isTerrestrial),
                  },
                  {
                    label: 'Record modified',
                    value: taxon.modified ?? 'Not supplied',
                  },
                ]}
              />
            </li>
          )
        })}
      </ol>
      {invalidRecordCount > 0 && (
        <p className="domain-note">
          Showing {taxa.length} usable provider-owned record
          {taxa.length === 1 ? '' : 's'}; omitted {invalidRecordCount} malformed AphiaRecord{invalidRecordCount === 1 ? '' : 's'} without a scientific-name identity.
        </p>
      )}
      {taxa.length > 10 && <p className="domain-note">Showing the first 10 of {taxa.length} usable AphiaRecords. Raw JSON retains the complete response.</p>}
      <p className="domain-note">WoRMS keeps stable Aphia identifiers for names. The provider’s valid_AphiaID points to the current final accepted name, so synonym or unaccepted-name relationships must remain visible.</p>
    </div>
  )
}
