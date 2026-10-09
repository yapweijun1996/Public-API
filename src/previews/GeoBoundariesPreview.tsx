import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, Facts, finite, numericText, text } from './cardPrimitives'

const safeHref = (value: unknown) => {
  const candidate = text(value)
  if (!candidate) return undefined
  try { const url = new URL(candidate); return url.protocol === 'https:' ? url.href : undefined } catch { return undefined }
}
const numberText = (value: unknown, unit = '') => {
  const number = finite(value)
  return number === undefined ? 'Not supplied' : `${numericText(number)}${unit}`
}

type RequestedBoundary = { country?: string; level?: string }
type BoundaryTransport = { requested: RequestedBoundary; valid: boolean; bound: boolean }
type BoundaryLayer = {
  root: Record<string, unknown>
  boundaryId: string
  name: string
  iso: string
  level: string
  representedYear?: string
  unitCount?: number
  meanArea?: number
  meanPerimeter?: number
  source?: string
  sourceLicense?: string
  buildDate?: string
  sourceUpdate?: string
  geoJson?: string
  incomplete: boolean
}

const requestedBoundary = (requestUrl?: string): RequestedBoundary | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.origin !== 'https://www.geoboundaries.org' || url.username || url.password || url.search || url.hash) return undefined
    const match = url.pathname.match(/^\/api\/current\/gbOpen\/([A-Z]{3}|ALL)\/(ADM[0-5]|ALL)\/$/)
    if (!match) return undefined
    return { country: match[1], level: match[2] }
  } catch { return undefined }
}

const resolveBoundaryTransport = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundaryTransport => {
  const displayed = requestedBoundary(requestUrl)
  if (requestUrl && !displayed) return { requested: {}, valid: false, bound: false }
  if (!executedRequest) return { requested: displayed ?? {}, valid: true, bound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && executedRequest.url !== requestUrl)) {
    return { requested: displayed ?? {}, valid: false, bound: false }
  }
  const executed = requestedBoundary(executedRequest.url)
  return executed ? { requested: executed, valid: true, bound: true } : { requested: displayed ?? {}, valid: false, bound: false }
}

const toBoundaryLayer = (value: unknown, requested: RequestedBoundary): BoundaryLayer | undefined => {
  const root = asRecord(value)
  const boundaryId = text(root.boundaryID)
  const name = text(root.boundaryName)
  const iso = text(root.boundaryISO)?.toUpperCase()
  const level = text(root.boundaryType)?.toUpperCase()
  if (!boundaryId || !name || !iso || !level) return undefined
  if (!/^[A-Z]{3}$/.test(iso) || !/^ADM[0-5]$/.test(level)) return undefined
  if (!boundaryId.startsWith(`${iso}-${level}-`)) return undefined
  if (requested.country && requested.country !== 'ALL' && requested.country !== iso) return undefined
  if (requested.level && requested.level !== 'ALL' && requested.level !== level) return undefined

  const representedYear = text(root.boundaryYearRepresented)
  const unitCount = finite(root.admUnitCount)
  const meanArea = finite(root.meanAreaSqKM)
  const meanPerimeter = finite(root.meanPerimeterLengthKM)
  const source = text(root.boundarySource)
  const sourceLicense = text(root.boundaryLicense)
  const buildDate = text(root.buildDate)
  const sourceUpdate = text(root.sourceDataUpdateDate)
  const geoJson = safeHref(root.gjDownloadURL)
  const incomplete = !representedYear || unitCount === undefined || unitCount < 0 || !source || !sourceLicense || !buildDate || !sourceUpdate || !geoJson || meanArea === undefined || meanPerimeter === undefined

  return { root, boundaryId, name, iso, level, representedYear, unitCount, meanArea, meanPerimeter, source, sourceLicense, buildDate, sourceUpdate, geoJson, incomplete }
}

export function GeoBoundariesPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const transport = resolveBoundaryTransport(requestUrl, executedRequest)
  const requested = transport.requested
  if (!transport.valid) {
    return <div className="domain-card domain-empty geoboundaries-preview" data-domain-card="boundary-layer" data-result-state="invalid" data-request-bound="false" data-requested-country={requested.country} data-requested-admin-level={requested.level} data-identity-match="false">
      <h3>Boundary request identity invalid</h3>
      <p>The executed request was not the exact supported bodyless GET geoBoundaries gbOpen endpoint, or it disagreed with the displayed request URL.</p>
    </div>
  }

  const providerValues = Array.isArray(data) ? data : data !== null && typeof data === 'object' ? [data] : []
  const providerRecordCount = providerValues.length
  const collectionExpected = requested.country === 'ALL' || requested.level === 'ALL'
  const hasRequestIdentity = Boolean(requested.country && requested.level)
  const cardinalityMismatch = hasRequestIdentity && ((collectionExpected && !Array.isArray(data)) || (!collectionExpected && Array.isArray(data)))
  const layers = cardinalityMismatch ? [] : providerValues.map((value) => toBoundaryLayer(value, requested)).filter((layer): layer is BoundaryLayer => Boolean(layer))
  const invalidRecordCount = providerRecordCount - layers.length
  const incompleteRecordCount = layers.filter((layer) => layer.incomplete).length

  if (providerRecordCount === 0 || layers.length === 0) {
    return <div className="domain-card domain-empty geoboundaries-preview" data-domain-card="boundary-layer" data-result-state="invalid" data-request-bound={String(transport.bound)} data-provider-record-count={providerRecordCount} data-valid-record-count="0" data-invalid-record-count={providerRecordCount} data-requested-country={requested.country} data-requested-admin-level={requested.level} data-identity-match="false">
      <h3>Boundary layer response invalid</h3>
      <p>geoBoundaries returned HTTP-success data that does not match the documented gbOpen boundary-layer identity and cardinality for this request.</p>
    </div>
  }

  const resultState = invalidRecordCount > 0 || incompleteRecordCount > 0 || !transport.bound ? 'partial' : 'ready'
  const identityMatch = invalidRecordCount === 0 && transport.bound

  if (Array.isArray(data)) {
    const visibleLayers = layers.slice(0, 24)
    const levelLabel = requested.level && requested.level !== 'ALL' ? requested.level : 'multiple administrative levels'
    const countryLabel = requested.country === 'ALL' ? 'Global' : requested.country ?? 'Multi-layer'
    return <div className="domain-card geoboundaries-preview" data-domain-card="boundary-layer" data-result-state={resultState} data-request-bound={String(transport.bound)} data-provider-record-count={providerRecordCount} data-valid-record-count={layers.length} data-invalid-record-count={invalidRecordCount} data-incomplete-record-count={incompleteRecordCount} data-requested-country={requested.country} data-requested-admin-level={requested.level} data-identity-match={String(identityMatch)} data-release-type="gbOpen">
      <CardHeading eyebrow="geoBoundaries · gbOpen layer collection" title={`${countryLabel} ${levelLabel} boundary layers`} description="Provider-owned metadata for multiple administrative-boundary layers. Geometry remains in the linked provider files rather than this API response."><span className="domain-state">{layers.length} valid layers</span></CardHeading>
      <Facts items={[
        { label: 'Provider records', value: numericText(providerRecordCount) },
        { label: 'Valid boundary layers', value: numericText(layers.length) },
        { label: 'Invalid records hidden', value: numericText(invalidRecordCount) },
        { label: 'Incomplete valid records', value: numericText(incompleteRecordCount) },
      ]}/>
      <ol className="geoboundaries-layer-list" aria-label="geoBoundaries administrative boundary layers">
        {visibleLayers.map((layer) => <li key={layer.boundaryId} data-boundary-id={layer.boundaryId} data-country-iso={layer.iso} data-admin-level={layer.level}>
          <div><strong>{layer.name}</strong> <code>{layer.iso}</code></div>
          <span>{layer.level} · {layer.unitCount === undefined ? 'unit count unavailable' : `${numericText(layer.unitCount)} units`} · {layer.representedYear ?? 'year unavailable'}</span>
          {layer.geoJson && <a href={layer.geoJson} target="_blank" rel="noreferrer" aria-label={`Full GeoJSON for ${layer.name} ${layer.level}`}>Full GeoJSON</a>}
        </li>)}
      </ol>
      {layers.length > visibleLayers.length && <p className="domain-note">Showing {visibleLayers.length} of {layers.length} validated layers to keep the result readable; Raw JSON retains the complete provider response.</p>}
      {resultState === 'partial' && <p className="domain-note">{!transport.bound ? 'The response is structurally useful, but executed transport identity is unavailable, so it cannot be marked ready.' : 'Some provider records were malformed or missing documented layer metadata. They are excluded from the visible layer list rather than being presented as trustworthy boundary data.'}</p>}
      <p className="domain-note">geoBoundaries requires attribution for API/programmatic use. This route is fixed to the provider's gbOpen release type.</p>
    </div>
  }

  const layer = layers[0]
  const links = [
    ['Full GeoJSON', layer.geoJson],
    ['Simplified GeoJSON', safeHref(layer.root.simplifiedGeometryGeoJSON)],
    ['TopoJSON', safeHref(layer.root.tjDownloadURL)],
    ['Layer archive', safeHref(layer.root.staticDownloadLink)],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))

  return <div className="domain-card geoboundaries-preview" data-domain-card="boundary-layer" data-result-state={resultState} data-request-bound={String(transport.bound)} data-provider-record-count={providerRecordCount} data-valid-record-count={layers.length} data-invalid-record-count={invalidRecordCount} data-incomplete-record-count={incompleteRecordCount} data-requested-country={requested.country} data-requested-admin-level={requested.level} data-identity-match={String(identityMatch)} data-boundary-id={layer.boundaryId} data-country-iso={layer.iso} data-admin-level={layer.level} data-represented-year={layer.representedYear} data-admin-unit-count={layer.unitCount} data-mean-unit-area-sq-km={layer.meanArea} data-mean-unit-perimeter-km={layer.meanPerimeter} data-build-date={layer.buildDate} data-source-update-date={layer.sourceUpdate} data-source-license={layer.sourceLicense} data-release-type="gbOpen">
    <CardHeading eyebrow="geoBoundaries · gbOpen layer metadata" title={`${layer.name} · ${layer.level}`} description="Metadata for one gbOpen administrative-boundary layer. Geometry is not embedded in this API response; the provider returns download links to the actual boundary files."><span className="domain-state">{layer.iso}</span></CardHeading>
    <Facts items={[
      { label: 'Boundary layer ID', value: <code>{layer.boundaryId}</code> },
      { label: 'Represented year', value: layer.representedYear ?? 'Not supplied' },
      { label: 'Administrative units in layer', value: layer.unitCount === undefined ? 'Not supplied' : numericText(layer.unitCount) },
      { label: 'Mean administrative-unit area', value: numberText(layer.meanArea, ' km²') },
      { label: 'Mean administrative-unit perimeter', value: numberText(layer.meanPerimeter, ' km') },
      { label: 'Source integrated', value: layer.sourceUpdate ?? 'Not supplied' },
      { label: 'geoBoundaries build', value: layer.buildDate ?? 'Not supplied' },
      { label: 'UN SDG region', value: text(layer.root['UNSDG-region']) ?? 'Not supplied' },
      { label: 'World Bank income group', value: text(layer.root.worldBankIncomeGroup) ?? 'Not supplied' },
    ]}/>
    <section className="geoboundaries-provenance" aria-labelledby="geoboundaries-provenance-heading">
      <h4 id="geoboundaries-provenance-heading">Source and license</h4>
      <p><strong>Boundary source:</strong> {layer.source ?? 'Not supplied'}</p>
      <p><strong>Original source license:</strong> {layer.sourceLicense ?? 'Not supplied'}</p>
      {text(layer.root.licenseDetail) && <p><strong>License detail:</strong> {text(layer.root.licenseDetail)}</p>}
    </section>
    <section className="geoboundaries-downloads" aria-labelledby="geoboundaries-downloads-heading">
      <h4 id="geoboundaries-downloads-heading">Boundary downloads</h4>
      {links.length ? <ul>{links.map(([label, href]) => <li key={label}><a href={href} target="_blank" rel="noreferrer" aria-label={`${label} for ${layer.name} ${layer.level}`}>{label}</a></li>)}</ul> : <p>No provider download URLs were supplied.</p>}
    </section>
    {resultState === 'partial' && <p className="domain-note">{!transport.bound ? 'The layer metadata is structurally useful, but executed transport identity is unavailable, so it cannot be marked ready.' : 'The layer identity matches this request, but some documented provider metadata is unavailable or malformed; missing values remain unavailable rather than being inferred.'}</p>}
    <p className="domain-note">geoBoundaries requires attribution for API/programmatic use. This route is fixed to the provider's gbOpen release type. The response's boundaryLicense is the original source-data license; meanAreaSqKM and meanPerimeterLengthKM are averages across administrative units in the layer, not total country area or perimeter.</p>
  </div>
}
