import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, Facts, rows, text } from './cardPrimitives'
import { nonNegativeSafeInteger, trimmedText } from './semanticValidation'

const bilingualText = (record: Record<string, unknown>, key: string, language: 'en' | 'fr') => {
  const translated = asRecord(record[`${key}_translated`])
  return text(translated[language]) ?? (language === 'en' ? text(record[key]) : undefined)
}
const dateOnly = (value: unknown) => text(value)?.slice(0, 10)
const stringList = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []
const uniqueText = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))]
const packageIdentity = (record: Record<string, unknown>) => text(record.id) ?? text(record.name)
const packageTitle = (record: Record<string, unknown>) => bilingualText(record, 'title', 'en') ?? packageIdentity(record)
type CanadaOpenDataRequest = { query: string; rows: number }
type BoundCanadaOpenDataRequest = { request?: CanadaOpenDataRequest; transportBound: boolean; invalidReason?: string }

const parseCanonicalRows = (value: string | null): number | undefined => {
  if (value === null || !/^(?:[1-9]|1\d|20)$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 20 ? parsed : undefined
}

const parseRequest = (requestUrl?: string): CanadaOpenDataRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const entries = [...url.searchParams.entries()]
    const allowedKeys = ['q', 'rows']
    const exactQuery = entries.length === allowedKeys.length
      && entries.every(([key]) => allowedKeys.includes(key))
      && allowedKeys.every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
    const rawQuery = url.searchParams.get('q') ?? ''
    const query = trimmedText(rawQuery)
    const requestedRows = parseCanonicalRows(url.searchParams.get('rows'))
    const valid = url.protocol === 'https:'
      && url.hostname === 'open.canada.ca'
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && url.pathname === '/data/api/3/action/package_search'
      && url.hash === ''
      && exactQuery
      && query !== undefined
      && rawQuery === query
      && requestedRows !== undefined
    if (!valid) return undefined
    const canonical = `https://open.canada.ca/data/api/3/action/package_search?${new URLSearchParams({ q: query, rows: String(requestedRows) }).toString()}`
    return requestUrl === canonical ? { query, rows: requestedRows } : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundCanadaOpenDataRequest => {
  const request = parseRequest(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported Government of Canada CKAN package_search request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Canada CKAN package_search request.' }
  }
  const executed = parseRequest(executedRequest.url)
  if (!executed || executed.query !== request.query || executed.rows !== request.rows) {
    return { request, transportBound: false, invalidReason: 'The displayed Canada Open Data request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const requestAttrs = (request?: CanadaOpenDataRequest, transportBound = false) => ({
  'data-domain-card': 'open-data-catalog',
  'data-request-bound': request && transportBound ? 'true' : 'false',
  'data-request-contract': 'exact-canada-open-data-package-search-v2',
  'data-requested-query': request?.query,
  'data-requested-rows': request?.rows,
})

const stateCard = (request: CanadaOpenDataRequest | undefined, transportBound: boolean, state: 'invalid' | 'empty' | 'partial', title: string, detail: string) => (
  <div className="domain-card domain-empty" {...requestAttrs(request, transportBound)} data-result-state={state}><h3>{title}</h3><p>{detail}</p></div>
)

export function CanadaOpenDataPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const identity = bindRequest(requestUrl, executedRequest)
  const request = identity.request
  if (!request || identity.invalidReason) {
    return stateCard(request, false, 'invalid', 'Invalid Canada Open Data request identity', identity.invalidReason ?? 'The semantic result could not verify the exact Government of Canada CKAN package_search request.')
  }
  const root = asRecord(data)
  if (root.success !== true) {
    return stateCard(request, identity.transportBound, 'invalid', 'Invalid Canada Open Data response', 'The Government of Canada CKAN response did not report a successful package search.')
  }

  const result = asRecord(root.result)
  if (!Array.isArray(result.results)) {
    return stateCard(request, identity.transportBound, 'invalid', 'Invalid Canada Open Data response', 'The Government of Canada CKAN response did not include the expected result.results array.')
  }

  const providerRecords = result.results
  const totalResults = nonNegativeSafeInteger(result.count)
  if (!providerRecords.length) {
    if (totalResults === 0) {
      const state = identity.transportBound ? 'empty' : 'partial'
      return stateCard(request, identity.transportBound, state, identity.transportBound ? 'No Canadian open-government records returned' : 'Canada Open Data result not request-bound', identity.transportBound ? 'The Government of Canada CKAN search returned an exact-request-bound zero-result catalogue response.' : 'The CKAN search returned a coherent zero-result response, but executed request evidence was unavailable, so the result is not claimed as exact-request-bound.')
    }
    return stateCard(request, identity.transportBound, 'invalid', 'Invalid Canada Open Data response', 'The CKAN result list was empty but its provider count did not describe a zero-result search.')
  }

  const records = providerRecords
    .map(asRecord)
    .filter((record) => Boolean(packageIdentity(record)))
  if (!records.length) {
    return stateCard(request, identity.transportBound, 'invalid', 'Invalid Canada Open Data response', 'The CKAN search returned records without provider-owned package id or name identities.')
  }

  const malformedRecordCount = providerRecords.length - records.length
  const countConsistent = totalResults !== undefined && totalResults >= providerRecords.length
  const rowLimitConsistent = providerRecords.length <= request.rows
  const state = !identity.transportBound || malformedRecordCount > 0 || !countConsistent || !rowLimitConsistent ? 'partial' : 'ready'
  const visible = records.slice(0, 10)
  const first = visible[0]
  const firstId = packageIdentity(first)
  const firstType = text(first.type)
  const firstCollection = text(first.collection)
  return <div className="domain-card canada-open-data-preview" {...requestAttrs(request, identity.transportBound)} data-result-state={state} data-request-contract-valid="true" data-provider-record-count={providerRecords.length} data-usable-record-count={records.length} data-malformed-record-count={malformedRecordCount} data-count-contract={countConsistent ? 'valid' : 'invalid'} data-row-limit-contract={rowLimitConsistent ? 'valid' : 'invalid'} data-row-count={records.length} data-visible-count={visible.length} data-total-results={totalResults ?? ''} data-primary-record-id={firstId} data-primary-record-type={firstType} data-primary-collection={firstCollection}>
    <CardHeading eyebrow="Government of Canada · Open Government CKAN" title={`${records.length} catalogue record${records.length === 1 ? '' : 's'} returned`} description={identity.transportBound ? `Exact-request-bound CKAN results for “${request.query}”. Search results can be datasets or publications. The card preserves the provider's record type, collection, publisher, licence, dates, restrictions, bilingual metadata, and resource formats without treating every result as a dataset.` : `Structurally valid CKAN results for “${request.query}” are visible, but executed request evidence was unavailable, so the result is not claimed as exact-request-bound.`}><span className="domain-state">{state === 'partial' ? 'Partial catalogue response' : `${totalResults?.toLocaleString('en')} matches total`}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">{identity.transportBound ? 'This CKAN response is incomplete or malformed. The card shows only provider-owned package identities and does not invent missing catalogue records.' : 'Executed request evidence was unavailable. The catalogue records remain visible as partial evidence but are not marked ready.'}</p>}
    <div className="canada-catalog-context" aria-label="Canada open-data search result context">
      <span><strong>{request.query}</strong> requested query</span>
      <span><strong>{request.rows}</strong> requested rows</span>
      <span><strong>{providerRecords.length}</strong> provider records</span>
      <span><strong>{records.length}</strong> usable records</span>
      <span><strong>{visible.length}</strong> shown semantically</span>
      <span><strong>{totalResults?.toLocaleString('en') ?? 'Not supplied'}</strong> provider matches</span>
    </div>
    <ol className="canada-catalog-list" aria-label="Government of Canada open-data catalogue records">
      {visible.map((record, index) => {
        const id = packageIdentity(record) as string
        const titleEn = packageTitle(record) as string
        const titleFr = bilingualText(record, 'title', 'fr')
        const notesEn = bilingualText(record, 'notes', 'en')
        const notesFr = bilingualText(record, 'notes', 'fr')
        const organization = asRecord(record.organization)
        const publisher = text(organization.title) ?? bilingualText(record, 'org_title_at_publication', 'en') ?? 'Publisher not supplied'
        const type = text(record.type) ?? 'Not supplied'
        const collection = text(record.collection) ?? 'Not supplied'
        const license = text(record.license_title) ?? 'Not supplied'
        const restrictions = text(record.restrictions) ?? 'Not supplied'
        const resources = rows(record.resources)
        const formats = uniqueText(resources.map((resource) => text(resource.format))).slice(0, 8)
        const languages = uniqueText(resources.flatMap((resource) => stringList(resource.language))).slice(0, 8)
        const resourceTypes = uniqueText(resources.map((resource) => text(resource.resource_type))).slice(0, 8)
        const published = dateOnly(record.date_published)
        const portalReleased = dateOnly(record.portal_release_date)
        return <li key={`${id}-${index}`} data-record-index={index + 1} data-record-id={id} data-record-type={type} data-collection={collection} data-license={license} data-restrictions={restrictions} data-resource-count={resources.length}>
          <header><div><small>{type} · collection {collection} · record ID {id}</small><h4>{titleEn}</h4>{titleFr && titleFr !== titleEn && <p lang="fr">{titleFr}</p>}</div><span>{license}</span></header>
          <Facts items={[
            { label: 'Publisher', value: publisher },
            { label: 'Provider type', value: type },
            { label: 'Collection', value: collection },
            { label: 'Published', value: published ? <time dateTime={published}>{published}</time> : 'Not supplied' },
            { label: 'Portal released', value: portalReleased ? <time dateTime={portalReleased}>{portalReleased}</time> : 'Not supplied' },
            { label: 'Restrictions', value: restrictions },
            { label: 'Resources', value: resources.length.toLocaleString('en') },
            { label: 'Formats', value: formats.length ? formats.join(' · ') : 'Not supplied' },
            { label: 'Languages', value: languages.length ? languages.join(' · ') : 'Not supplied' },
            { label: 'Resource types', value: resourceTypes.length ? resourceTypes.join(' · ') : 'Not supplied' },
          ]}/>
          {notesEn && <p className="canada-record-description">{notesEn}</p>}
          {notesFr && notesFr !== notesEn && <p className="canada-record-description canada-record-description-fr" lang="fr">{notesFr}</p>}
        </li>
      })}
    </ol>
    <p className="domain-note">Licence and restriction values are provider catalogue metadata. Review the selected record and resource before reuse; this search response describes catalogue entries and does not itself validate the contents of each linked resource.</p>
  </div>
}
