import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, numericText, text } from './cardPrimitives'
import { nonNegativeSafeInteger, positiveSafeInteger } from './semanticValidation'

const count = (value: unknown) => nonNegativeSafeInteger(value)
const countLabel = (value: number | undefined, rawValue: unknown) => value === undefined
  ? rawValue === undefined || rawValue === null ? 'Not supplied' : 'Unavailable'
  : numericText(value)
const providerOriginId = (item: Record<string, unknown>) => positiveSafeInteger(item.coo_id)
const providerOriginIdentity = (item: Record<string, unknown>) => providerOriginId(item) !== undefined || Boolean(text(item.coo_iso) || text(item.coo))
const trustedPopulationRow = (item: Record<string, unknown>) => count(item.year) !== undefined && providerOriginIdentity(item)

const integerFields = ['coo_id', 'refugees', 'asylum_seekers', 'idps', 'stateless', 'returned_refugees', 'returned_idps'] as const

const malformedIntegerCount = (item: Record<string, unknown>) => integerFields.filter((field) => {
  const value = item[field]
  if (value === undefined || value === null) return false
  return field === 'coo_id' ? providerOriginId(item) === undefined : count(value) === undefined
}).length

type RefugeeRequest = { originIso: string; year: number }

const requestContext = (requestUrl?: string): RefugeeRequest | null | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const originIso = url.searchParams.get('coo')?.trim().toUpperCase()
    const yearFrom = url.searchParams.get('yearFrom')?.trim()
    const yearTo = url.searchParams.get('yearTo')?.trim()
    const year = yearFrom && /^\d{4}$/.test(yearFrom) ? Number(yearFrom) : undefined
    const expectedParams = ['yearFrom', 'yearTo', 'coo', 'cf_type', 'limit']
    const requestParamKeys = [...url.searchParams.keys()]
    const exactParams = requestParamKeys.length === expectedParams.length
      && expectedParams.every((key) => url.searchParams.getAll(key).length === 1)
      && requestParamKeys.every((key) => expectedParams.includes(key))
    if (
      url.origin !== 'https://api.unhcr.org'
      || Boolean(url.username || url.password)
      || url.pathname !== '/population/v1/population/'
      || !exactParams
      || !originIso
      || !/^[A-Z]{3}$/.test(originIso)
      || year === undefined
      || yearTo !== yearFrom
      || url.searchParams.get('cf_type') !== 'ISO'
      || url.searchParams.get('limit') !== '1'
    ) return null
    return { originIso, year }
  } catch {
    return null
  }
}

type RefugeeRequestTransport = { request?: RefugeeRequest; valid: boolean; bound: boolean }

const resolveRequestTransport = (requestUrl?: string, executedRequest?: ExecutedRequestContext): RefugeeRequestTransport => {
  const displayed = requestContext(requestUrl)
  if (displayed === null) return { valid: false, bound: false }
  if (!executedRequest) return { request: displayed, valid: true, bound: false }
  if (
    executedRequest.method.toUpperCase() !== 'GET'
    || executedRequest.body !== undefined
    || (requestUrl !== undefined && executedRequest.url !== requestUrl)
  ) return { request: displayed, valid: false, bound: false }
  const executed = requestContext(executedRequest.url)
  if (!executed) return { request: displayed, valid: false, bound: false }
  return { request: executed, valid: true, bound: true }
}

const matchesRequest = (item: Record<string, unknown>, request: RefugeeRequest) => {
  const originIso = text(item.coo_iso)?.toUpperCase()
  return count(item.year) === request.year && originIso === request.originIso
}

export function RefugeePopulationPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const root = asRecord(data)
  const transport = resolveRequestTransport(requestUrl, executedRequest)
  const request = transport.request

  if (!transport.valid) {
    return <CardEmpty
      domain="refugee-population"
      title="Invalid UNHCR request context"
      detail="The successful response was not bound to the catalog's exact bodyless GET single-origin, single-year population request, or the executed URL disagreed with the displayed request."
      state="invalid"
    />
  }

  if (!Array.isArray(root.items)) {
    return <CardEmpty
      domain="refugee-population"
      title="Invalid UNHCR population response"
      detail="UNHCR did not return the expected items array for the population endpoint."
      state="invalid"
    />
  }

  const providerItems = root.items.map(asRecord)
  if (!providerItems.length) {
    if (!transport.bound) {
      return <div className="domain-card domain-empty" data-domain-card="refugee-population" data-result-state="partial" data-request-bound="false">
        <h3>UNHCR population response unbound</h3>
        <p>The response contains no population rows, but executed-request identity is unavailable, so the result cannot be trusted as a semantic empty result.</p>
      </div>
    }
    return <CardEmpty
      domain="refugee-population"
      title="No UNHCR population row returned"
      detail="UNHCR returned no end-of-year population row for the selected origin and year."
      state="empty"
    />
  }

  const structurallyTrustedItems = providerItems.filter(trustedPopulationRow)
  const trustedItems = request ? structurallyTrustedItems.filter((item) => matchesRequest(item, request)) : structurallyTrustedItems
  const validItemCount = trustedItems.length
  const invalidItemCount = providerItems.length - structurallyTrustedItems.length
  const identityMismatchCount = structurallyTrustedItems.length - trustedItems.length

  if (!validItemCount) {
    return <CardEmpty
      domain="refugee-population"
      title="Invalid UNHCR population response"
      detail={request && identityMismatchCount > 0
        ? 'UNHCR returned population rows, but their ISO3 origin and reporting year do not match the executed origin and year.'
        : 'UNHCR returned population rows, but none included both a strict integer reporting year and provider-owned origin identity.'}
      state="invalid"
    />
  }

  const item = trustedItems[0]
  const year = count(item.year)!
  const originId = providerOriginId(item)
  const originName = text(item.coo_name)
  const originIso = text(item.coo_iso)
  const originUnhcr = text(item.coo)
  const refugees = count(item.refugees)
  const asylumSeekers = count(item.asylum_seekers)
  const idps = count(item.idps)
  const stateless = count(item.stateless)
  const returnedRefugees = count(item.returned_refugees)
  const returnedIdps = count(item.returned_idps)
  const malformedIntegers = malformedIntegerCount(item)
  const extraTrustedItemCount = Math.max(0, validItemCount - 1)
  const incompleteIdentityCount = originName && originIso && originUnhcr ? 0 : 1
  const resultState = !transport.bound || !request || invalidItemCount > 0 || identityMismatchCount > 0 || extraTrustedItemCount > 0 || incompleteIdentityCount > 0 || malformedIntegers > 0 ? 'partial' : 'ready'
  const displayOrigin = originName ?? originIso ?? originUnhcr ?? `UNHCR origin ${numericText(originId!)}`

  return <div
    className="domain-card refugee-population-preview"
    data-domain-card="refugee-population"
    data-result-state={resultState}
    data-provider-item-count={providerItems.length}
    data-valid-item-count={validItemCount}
    data-invalid-item-count={invalidItemCount}
    data-identity-mismatch-count={identityMismatchCount}
    data-extra-trusted-item-count={extraTrustedItemCount}
    data-incomplete-identity-count={incompleteIdentityCount}
    data-malformed-integer-count={malformedIntegers}
    data-request-bound={transport.bound ? 'true' : 'false'}
    data-requested-origin-iso={request?.originIso}
    data-requested-year={request?.year}
    data-identity-match={transport.bound && request ? 'true' : 'unbound'}
    data-primary-origin-id={originId}
    data-primary-origin-iso={originIso}
    data-origin-unhcr-code={originUnhcr}
    data-reporting-year={year}
    data-refugees={refugees}
    data-asylum-seekers={asylumSeekers}
    data-idps={idps}
    data-stateless={stateless}
    data-returned-refugees={returnedRefugees}
    data-returned-idps={returnedIdps}
  >
    <CardHeading
      eyebrow="UNHCR · Refugee Data Finder"
      title={`${displayOrigin} · ${year}`}
      description="End-of-year displacement population figures aggregated across countries of asylum for the selected country of origin."
    >
      <span className="domain-state">{resultState === 'partial' ? 'Partial year-end snapshot' : 'Year-end snapshot'}</span>
    </CardHeading>

    {resultState === 'partial' && <p className="domain-note">
      {invalidItemCount > 0 ? `${invalidItemCount} provider row${invalidItemCount === 1 ? ' was' : 's were'} omitted because reporting-year or origin identity was missing. ` : ''}
      {identityMismatchCount > 0 ? `${identityMismatchCount} structurally valid provider row${identityMismatchCount === 1 ? ' did' : 's did'} not match the executed ISO3 origin and reporting year. ` : ''}
      {extraTrustedItemCount > 0 ? `${extraTrustedItemCount} additional trusted row${extraTrustedItemCount === 1 ? ' was' : 's were'} returned even though this demo requests one aggregated row; only the first trusted row is displayed. ` : ''}
      {incompleteIdentityCount > 0 ? 'The displayed trusted row is missing one or more human-readable origin identity fields.' : ''}
      {malformedIntegers > 0 ? ` ${malformedIntegers} OpenAPI integer field${malformedIntegers === 1 ? ' was' : 's were'} malformed and ${malformedIntegers === 1 ? 'is' : 'are'} shown as unavailable.` : ''}
      {!transport.bound ? ' Executed request identity was unavailable, so the response could not be bound to a selected origin and year.' : ''}
    </p>}

    <Facts items={[
      { label: 'Refugees', value: countLabel(refugees, item.refugees) },
      { label: 'Asylum-seekers', value: countLabel(asylumSeekers, item.asylum_seekers) },
      { label: 'Internally displaced people', value: countLabel(idps, item.idps) },
      { label: 'Stateless people', value: countLabel(stateless, item.stateless) },
      { label: 'Returned refugees', value: countLabel(returnedRefugees, item.returned_refugees) },
      { label: 'Returned IDPs', value: countLabel(returnedIdps, item.returned_idps) },
      { label: 'UNHCR origin ID', value: originId === undefined ? item.coo_id === undefined || item.coo_id === null ? 'Not supplied' : 'Unavailable' : numericText(originId) },
      { label: 'ISO3 origin', value: originIso ?? 'Not supplied' },
      { label: 'UNHCR origin code', value: originUnhcr ?? 'Not supplied' },
    ]}/>

    <p className="domain-note">UNHCR documents <code>/population/</code> as end-of-year displacement data. This request sets <code>cf_type=ISO</code>, so the origin field is interpreted as ISO3. Because country of asylum is omitted, that dimension is aggregated into one row rather than returned as a list of asylum-country records.</p>
  </div>
}
