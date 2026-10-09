import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, finite, numericText, text } from './cardPrimitives'
import { finiteNumber, nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

type FoodHygieneRequest = {
  name: string
  pageNumber: number
  pageSize: number
}

type TrustedEstablishment = {
  id: number
  businessName: string
  record: Record<string, unknown>
}

const dateOnly = (value: unknown) => text(value)?.slice(0, 10) ?? 'Not supplied'
const publicRating = (scheme: string | undefined, value: unknown) => {
  const raw = text(value) ?? 'Not supplied'
  if (scheme !== 'FHRS' || !/^[0-5]$/.test(raw)) return raw
  const labels: Record<string, string> = { '5': 'Very good', '4': 'Good', '3': 'Generally satisfactory', '2': 'Improvement necessary', '1': 'Major improvement necessary', '0': 'Urgent improvement necessary' }
  return `${raw}/5 · ${labels[raw]}`
}
const interventionScore = (kind: 'Hygiene' | 'Structural' | 'ConfidenceInManagement', value: unknown) => {
  const score = finiteNumber(value)
  if (score === undefined) return undefined
  const common: Record<number, string> = { 0: 'Very good', 5: 'Good', 10: 'Generally satisfactory', 20: 'Major improvement necessary' }
  const labels = kind === 'ConfidenceInManagement'
    ? ({ ...common, 30: 'Urgent improvement necessary' } as Record<number, string>)
    : ({ ...common, 15: 'Improvement necessary', 25: 'Urgent improvement necessary' } as Record<number, string>)
  return `${numericText(score)} · ${labels[score] ?? 'Provider intervention score'}`
}
const address = (record: Record<string, unknown>) => [record.AddressLine1, record.AddressLine2, record.AddressLine3, record.AddressLine4, record.PostCode].map(text).filter(Boolean).join(', ')
const fhrsId = (record: Record<string, unknown>) => positiveSafeInteger(record.FHRSID)

const exactSearchKeys = (params: URLSearchParams, expectedKeys: string[]) => {
  const entries = [...params.entries()]
  return entries.length === expectedKeys.length
    && entries.every(([key]) => expectedKeys.includes(key))
    && expectedKeys.every((key) => params.getAll(key).length === 1)
}

const parseExecutedRequest = (executedRequest?: ExecutedRequestContext): FoodHygieneRequest | undefined => {
  if (!executedRequest || executedRequest.method !== 'GET' || executedRequest.body !== undefined) return undefined
  try {
    const url = new URL(executedRequest.url)
    const name = trimmedText(url.searchParams.get('name'))
    const pageNumberText = url.searchParams.get('pageNumber')
    const pageSizeText = url.searchParams.get('pageSize')
    const pageNumber = pageNumberText && /^\d+$/.test(pageNumberText) ? Number(pageNumberText) : NaN
    const pageSize = pageSizeText && /^\d+$/.test(pageSizeText) ? Number(pageSizeText) : NaN
    const valid = url.protocol === 'https:'
      && url.hostname === 'api.ratings.food.gov.uk'
      && url.port === ''
      && !url.username
      && !url.password
      && !url.hash
      && url.pathname === '/Establishments'
      && exactSearchKeys(url.searchParams, ['name', 'pageNumber', 'pageSize'])
      && Boolean(name)
      && pageNumber === 1
      && Number.isSafeInteger(pageSize)
      && pageSize >= 1
      && pageSize <= 50
    return valid && name ? { name, pageNumber, pageSize } : undefined
  } catch {
    return undefined
  }
}

type ProviderSelfContract = { status: 'valid' | 'missing' | 'invalid'; href?: string }

const normalizedSearchValue = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('en-GB')

const providerSelfContract = (links: unknown, request: FoodHygieneRequest): ProviderSelfContract => {
  if (!Array.isArray(links)) return { status: 'missing' }
  const self = links
    .map(asRecord)
    .find((link) => trimmedText(link.rel)?.toLocaleLowerCase('en-GB') === 'self')
  const href = self ? trimmedText(self.href) : undefined
  if (!href) return { status: 'missing' }
  try {
    const url = new URL(href)
    const entries = [...url.searchParams.entries()]
    const normalizedKeys = entries.map(([key]) => key.toLocaleLowerCase('en-GB'))
    const exactKeys = normalizedKeys.length === 3
      && ['name', 'pagenumber', 'pagesize'].every((key) => normalizedKeys.filter((candidate) => candidate === key).length === 1)
    const valueFor = (key: string) => entries.find(([candidate]) => candidate.toLocaleLowerCase('en-GB') === key)?.[1]
    const name = valueFor('name')
    const pageNumber = valueFor('pagenumber')
    const pageSize = valueFor('pagesize')
    const valid = url.protocol === 'https:'
      && url.hostname === 'api.ratings.food.gov.uk'
      && (url.port === '' || url.port === '443')
      && !url.username
      && !url.password
      && !url.hash
      && url.pathname.toLocaleLowerCase('en-GB') === '/establishments'
      && exactKeys
      && Boolean(name)
      && normalizedSearchValue(name ?? '') === normalizedSearchValue(request.name)
      && pageNumber === String(request.pageNumber)
      && pageSize === String(request.pageSize)
    return { status: valid ? 'valid' : 'invalid', href }
  } catch {
    return { status: 'invalid', href }
  }
}

export function FoodHygienePreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  const request = parseExecutedRequest(executedRequest)
  if (!request) {
    return <CardEmpty domain="food-hygiene-ratings" title="Invalid food hygiene request identity" detail="The successful response could not be bound to the supported bodyless Food Standards Agency establishment-name search on page 1." state="invalid"/>
  }

  const root = asRecord(data)
  const meta = asRecord(root.meta)
  const providerTotal = nonNegativeSafeInteger(meta.totalCount)
  const itemCount = nonNegativeSafeInteger(meta.itemCount)
  const providerPageNumber = positiveSafeInteger(meta.pageNumber)
  const providerPageSize = positiveSafeInteger(meta.pageSize)
  const providerTotalPages = nonNegativeSafeInteger(meta.totalPages)
  const selfContract = providerSelfContract(root.links, request)

  if (selfContract.status === 'invalid') {
    return <CardEmpty domain="food-hygiene-ratings" title="Invalid food hygiene response identity" detail="The provider self link did not acknowledge the executed establishment-name search and first-page request." state="invalid"/>
  }

  if (!Array.isArray(root.establishments)) {
    return <CardEmpty domain="food-hygiene-ratings" title="Invalid food hygiene response" detail="The Food Standards Agency response did not include the documented establishments array." state="invalid"/>
  }

  const providerRecords = root.establishments.map(asRecord)
  const countValid = providerTotal !== undefined
    && itemCount === providerRecords.length
    && providerTotal >= providerRecords.length
  const paginationValid = providerPageNumber === request.pageNumber
    && providerPageSize !== undefined
    && providerPageSize <= request.pageSize
    && providerTotalPages !== undefined
    && (providerTotal === 0 ? providerTotalPages <= 1 : providerTotalPages >= 1)

  if (!providerRecords.length) {
    const emptyContractValid = selfContract.status === 'valid' && providerTotal === 0 && itemCount === 0 && paginationValid
    return emptyContractValid
      ? <CardEmpty domain="food-hygiene-ratings" title="No food establishments returned" detail="The Food Standards Agency returned a request-bound zero-result establishment search." state="empty"/>
      : <CardEmpty domain="food-hygiene-ratings" title="Invalid food hygiene response" detail="The Food Standards Agency returned an empty establishments array without a matching zero-result pagination contract." state="invalid"/>
  }

  const seenIds = new Set<number>()
  const records: TrustedEstablishment[] = []
  let duplicateIdentityCount = 0
  let malformedIdentityCount = 0

  providerRecords.forEach((record) => {
    const id = fhrsId(record)
    const businessName = trimmedText(record.BusinessName)
    if (!id || !businessName) {
      malformedIdentityCount += 1
      return
    }
    if (seenIds.has(id)) {
      duplicateIdentityCount += 1
      return
    }
    seenIds.add(id)
    records.push({ id, businessName, record })
  })

  if (!records.length) {
    return <CardEmpty domain="food-hygiene-ratings" title="Invalid food hygiene response" detail="Returned establishment rows did not contain trustworthy unique provider-owned FHRS identity and business-name evidence." state="invalid"/>
  }

  const invalidRecordCount = providerRecords.length - records.length
  const queryValid = selfContract.status === 'valid'
  const state = invalidRecordCount > 0 || !countValid || !paginationValid || !queryValid ? 'partial' : 'ready'
  const first = records[0]

  return <div
    className="domain-card food-hygiene-preview"
    data-domain-card="food-hygiene-ratings"
    data-result-state={state}
    data-request-bound="true"
    data-request-name={request.name}
    data-request-page-number={request.pageNumber}
    data-request-page-size={request.pageSize}
    data-provider-page-number={providerPageNumber}
    data-provider-page-size={providerPageSize}
    data-provider-total-pages={providerTotalPages}
    data-result-count={records.length}
    data-provider-record-count={providerRecords.length}
    data-valid-record-count={records.length}
    data-invalid-record-count={invalidRecordCount}
    data-query-contract-valid={String(queryValid)}
    data-provider-self-contract={selfContract.status}
    data-provider-self-href={selfContract.href}
    data-duplicate-identity-count={duplicateIdentityCount}
    data-malformed-identity-count={malformedIdentityCount}
    data-provider-total-count={providerTotal}
    data-provider-item-count={itemCount}
    data-count-contract-valid={String(countValid)}
    data-pagination-contract-valid={String(paginationValid)}
    data-primary-fhrs-id={first.id}
    data-score-direction="lower-intervention-score-is-better"
  >
    <CardHeading
      eyebrow="Food Standards Agency · FHRS/FHIS"
      title={`${records.length} trusted establishment${records.length === 1 ? '' : 's'} in this response`}
      description={providerTotal === undefined
        ? `${providerRecords.length} provider row${providerRecords.length === 1 ? '' : 's'} returned. The provider total-count metadata was unavailable or malformed.`
        : `${numericText(providerTotal)} provider match${providerTotal === 1 ? '' : 'es'} for “${request.name}”. Overall public ratings and underlying intervention scores use different directions.`}
    ><span className="domain-state">{state === 'partial' ? 'Partial establishment batch' : 'Rating higher is better'}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">Some provider rows, provider self-link evidence, or pagination metadata were incomplete or mismatched. Only rows with trustworthy unique FHRS identity are included; the provider self link is the request-search acknowledgement.</p>}
    <ol className="food-hygiene-list" aria-label="Food Standards Agency establishment ratings">
      {records.map(({ id, businessName, record }, index) => {
        const scheme = text(record.SchemeType)
        const rating = text(record.RatingValue)
        const ratingDate = text(record.RatingDate)
        const authority = text(record.LocalAuthorityName)
        const scores = asRecord(record.scores)
        const geocode = asRecord(record.geocode)
        const latitude = finite(geocode.latitude)
        const longitude = finite(geocode.longitude)
        const hygiene = interventionScore('Hygiene', scores.Hygiene)
        const structural = interventionScore('Structural', scores.Structural)
        const management = interventionScore('ConfidenceInManagement', scores.ConfidenceInManagement)
        const hasComponents = scheme === 'FHRS' && Boolean(hygiene || structural || management)
        return <li key={id} data-establishment-index={index + 1} data-fhrs-id={id} data-business-name={businessName} data-scheme-type={scheme} data-rating-value={rating} data-rating-date={ratingDate} data-local-authority={authority} data-latitude={latitude} data-longitude={longitude}>
          <header><div><small>{scheme ?? 'Scheme not supplied'} · {text(record.BusinessType) ?? 'Business type not supplied'}</small><h4>{businessName}</h4></div><span>{publicRating(scheme, rating)}</span></header>
          <p>{address(record) || 'Address not supplied'}</p>
          <Facts items={[
            { label: 'Inspection/rating date', value: dateOnly(ratingDate) },
            { label: 'Local authority', value: authority ?? 'Not supplied' },
            { label: 'FHRS ID', value: numericText(id) },
            { label: 'New rating pending', value: record.NewRatingPending === true ? 'Yes' : record.NewRatingPending === false ? 'No' : 'Not supplied' },
            { label: 'Coordinates', value: latitude === undefined || longitude === undefined ? 'Not supplied' : `${numericText(latitude)}, ${numericText(longitude)}` },
          ]}/>
          <section className="food-hygiene-scores" aria-label={`${businessName} component intervention scores`}><h4>Component intervention scores</h4>{hasComponents ? <dl className="domain-facts"><div><dt>Hygiene</dt><dd>{hygiene ?? 'Not supplied'}</dd></div><div><dt>Structural</dt><dd>{structural ?? 'Not supplied'}</dd></div><div><dt>Confidence in management</dt><dd>{management ?? 'Not supplied'}</dd></div></dl> : <p>Component scores are not supplied for this record or scheme.</p>}</section>
        </li>
      })}
    </ol>
    <p className="domain-note">For FHRS, the overall public rating runs from 0 to 5 with <strong>higher better</strong>. The component intervention scores run in the opposite direction: <strong>lower is better</strong>. Component scores apply to FHRS, not FHIS, and may be absent after a rescore.</p>
  </div>
}
