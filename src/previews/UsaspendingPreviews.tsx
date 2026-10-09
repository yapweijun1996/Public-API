import { asRecord, CardEmpty, CardHeading, Facts, numericText, text } from './cardPrimitives'
import { cleanText, isRecord } from './previewData'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { finiteNumber, nonNegativeInteger, positiveInteger, trimmedText } from './semanticValidation'

const safeHttpUrl = (value: unknown) => {
  const candidate = text(value)
  if (!candidate) return undefined
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

const dateValue = (value: unknown) => {
  const candidate = text(value)
  return candidate && /^\d{4}-\d{2}-\d{2}/.test(candidate) ? candidate.slice(0, 10) : undefined
}

const agencyRequestCode = (requestUrl?: string) => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const match = /^\/api\/v2\/agency\/(\d{3,4})\/$/.exec(url.pathname)
    if (url.origin !== 'https://api.usaspending.gov' || url.search || url.hash || !match) return false
    return requestUrl === `https://api.usaspending.gov/api/v2/agency/${match[1]}/` ? match[1] : false
  } catch { return false }
}

type AgencyRequestIdentity = { requested?: string; bound: boolean; valid: boolean }

const resolveAgencyRequestIdentity = (requestUrl?: string, executedRequest?: ExecutedRequestContext): AgencyRequestIdentity => {
  const displayed = agencyRequestCode(requestUrl)
  if (displayed === false) return { bound: false, valid: false }
  if (!executedRequest) return { requested: displayed, bound: false, valid: true }
  if (!displayed || executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl || agencyRequestCode(executedRequest.url) !== displayed) {
    return { requested: displayed, bound: false, valid: false }
  }
  return { requested: displayed, bound: true, valid: true }
}

const agencyInvalid = (title: string, detail: string, requested?: string, provider?: string, match?: boolean, bound = false) => <div className="domain-card domain-empty" data-domain-card="federal-agency-overview" data-result-state="invalid" data-request-bound={String(bound)} data-requested-toptier-code={requested} data-provider-toptier-code={provider} data-identity-match={match === undefined ? undefined : String(match)} data-contract-valid="false"><h3>{title}</h3><p>{detail}</p></div>

export function FederalAgencyOverviewPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = resolveAgencyRequestIdentity(requestUrl, executedRequest)
  if (!request.valid) return agencyInvalid('Invalid USAspending agency request identity', 'The executed request is not the supported canonical bodyless GET agency overview request.', request.requested)
  const requested = request.requested
  const agency = asRecord(data)
  const name = cleanText(agency.name)
  const code = trimmedText(agency.toptier_code)
  if (!name || !code || !/^\d{3,4}$/.test(code)) return agencyInvalid('Invalid USAspending agency response', 'The response is missing the required agency name or top-tier code.', requested, undefined, undefined, request.bound)
  const identityMatch = requested ? requested === code : undefined
  if (identityMatch === false) return agencyInvalid('USAspending agency identity mismatch', 'The provider top-tier agency code does not match the executed request.', requested, code, false, request.bound)

  const fiscalYear = positiveInteger(agency.fiscal_year)
  const agencyId = positiveInteger(agency.agency_id)
  const subtierCount = nonNegativeInteger(agency.subtier_agency_count)
  const providerDefCodes = Array.isArray(agency.def_codes) ? agency.def_codes : []
  const defCodes = providerDefCodes.filter(isRecord)
  const optionalMalformed = (agency.def_codes !== undefined && !Array.isArray(agency.def_codes)) || defCodes.length !== providerDefCodes.length
  const website = safeHttpUrl(agency.website)
  const budgetJustification = safeHttpUrl(agency.congressional_justification_url)
  const coreValid = fiscalYear !== undefined && agencyId !== undefined && subtierCount !== undefined
  const state = request.bound && requested && identityMatch && coreValid && !optionalMalformed ? 'ready' : 'partial'

  return <div className="domain-card federal-agency-preview" data-domain-card="federal-agency-overview" data-result-state={state} data-request-bound={String(request.bound)} data-requested-toptier-code={requested || undefined} data-provider-toptier-code={code} data-identity-match={identityMatch === undefined ? undefined : String(identityMatch)} data-contract-valid={String(state === 'ready')} data-fiscal-year={fiscalYear} data-toptier-code={code} data-agency-id={agencyId} data-subtier-count={subtierCount} data-def-code-count={defCodes.length}>
    <CardHeading eyebrow="USAspending · Agency overview" title={name} description="Agency identity and reference metadata from the USAspending Agency Details overview endpoint."><span className="domain-state">{state === 'ready' ? 'Agency identity verified' : 'Partial agency overview'}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">The agency identity is usable, but request binding or required provider fields are incomplete. Untrusted values are withheld.</p>}
    <Facts items={[
      { label: 'Fiscal year context', value: fiscalYear === undefined ? 'Not supplied' : `FY ${numericText(fiscalYear)}` },
      { label: 'Top-tier agency code', value: code },
      { label: 'USAspending agency ID', value: agencyId === undefined ? 'Not supplied' : numericText(agencyId) },
      { label: 'Abbreviation', value: text(agency.abbreviation) ?? 'Not supplied' },
      { label: 'Subtier agencies', value: subtierCount === undefined ? 'Not supplied' : numericText(subtierCount) },
    ]}/>
    {cleanText(agency.mission) && <section className="federal-agency-mission" aria-labelledby="federal-agency-mission-heading"><h4 id="federal-agency-mission-heading">Mission</h4><p>{cleanText(agency.mission)}</p></section>}
    {(website || budgetJustification) && <section className="federal-agency-links" aria-labelledby="federal-agency-links-heading"><h4 id="federal-agency-links-heading">Official references</h4><ul>{website && <li><a href={website} target="_blank" rel="noreferrer">Open agency website</a></li>}{budgetJustification && <li><a href={budgetJustification} target="_blank" rel="noreferrer">Open congressional budget justification</a></li>}</ul></section>}
    {defCodes.length > 0 && <section className="federal-def-codes" aria-labelledby="federal-def-codes-heading"><header><h4 id="federal-def-codes-heading">Disaster Emergency Fund Codes</h4><span>{defCodes.length} supplied</span></header><ol>{defCodes.slice(0, 10).map((entry, index) => <li key={text(entry.code) ?? index} data-def-code={text(entry.code)} data-disaster={text(entry.disaster)}><strong>{text(entry.code) ?? 'Code not supplied'}</strong><div><span>{cleanText(entry.title) ?? 'Title not supplied'}</span><small>{cleanText(entry.public_law) ?? 'Public-law designation not supplied'}{text(entry.disaster) ? ` · ${text(entry.disaster)}` : ''}</small></div></li>)}</ol>{defCodes.length > 10 && <p>Showing 10 of {defCodes.length}; complete provider data remains in Raw JSON.</p>}</section>}
    <p className="domain-note">Overview, not spending totals. This endpoint is the agency overview used by USAspending's Agency Details page. It does not itself return award obligations or budgetary-resource totals; those are separate agency endpoints.</p>
  </div>
}


type AwardRequestContract = {
  bound: boolean
  valid: boolean
  fiscalYear?: number
  startDate?: string
  endDate?: string
  dateType?: string
  limit?: number
  awardTypeCodes?: string[]
}

const USA_SPENDING_AWARDS_ENDPOINT = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'
const CONTRACT_AWARD_CODES = ['A', 'B', 'C', 'D']

const strictDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? undefined : value
}

const parseAwardRequest = (executedRequest?: ExecutedRequestContext): AwardRequestContract => {
  if (!executedRequest) return { bound: false, valid: false }
  if (executedRequest.method !== 'POST' || executedRequest.url !== USA_SPENDING_AWARDS_ENDPOINT || !isRecord(executedRequest.body)) {
    return { bound: true, valid: false }
  }

  const body = executedRequest.body
  const filters = isRecord(body.filters) ? body.filters : undefined
  const periods = filters && Array.isArray(filters.time_period) ? filters.time_period : []
  const period = periods.length === 1 && isRecord(periods[0]) ? periods[0] : undefined
  const startDate = strictDate(period?.start_date)
  const endDate = strictDate(period?.end_date)
  const dateType = typeof period?.date_type === 'string' ? period.date_type : undefined
  const fiscalYear = endDate ? Number(endDate.slice(0, 4)) : undefined
  const limit = positiveInteger(body.limit)
  const awardTypeCodes = filters && Array.isArray(filters.award_type_codes) && filters.award_type_codes.every((value) => typeof value === 'string')
    ? filters.award_type_codes as string[]
    : undefined
  const fiscalPeriodValid = fiscalYear !== undefined
    && startDate === `${fiscalYear - 1}-10-01`
    && endDate === `${fiscalYear}-09-30`
  const awardTypesValid = awardTypeCodes?.length === CONTRACT_AWARD_CODES.length
    && awardTypeCodes.every((code, index) => code === CONTRACT_AWARD_CODES[index])
  const valid = Boolean(
    fiscalPeriodValid
    && dateType === 'new_awards_only'
    && awardTypesValid
    && limit !== undefined
    && body.page === 1
    && body.sort === 'Base Obligation Date'
    && body.order === 'desc'
    && body.subawards === false,
  )

  return { bound: true, valid, fiscalYear, startDate, endDate, dateType, limit, awardTypeCodes }
}

export function FederalAwardsPreview({ data, executedRequest }: { data: unknown; executedRequest?: ExecutedRequestContext }) {
  if (!isRecord(data) || !Array.isArray(data.results)) {
    return <CardEmpty domain="federal-awards" title="Invalid USAspending award response" detail="The USAspending response did not include the required results array." state="invalid"/>
  }

  const request = parseAwardRequest(executedRequest)
  if (request.bound && !request.valid) {
    return <CardEmpty domain="federal-awards" title="Invalid USAspending award response" detail="The executed POST request did not match the documented new-award fiscal-year search contract." state="invalid"/>
  }

  const root = data
  const providerAwards = root.results as unknown[]
  const spendingLevel = typeof root.spending_level === 'string' ? root.spending_level : undefined
  const providerLimit = positiveInteger(root.limit)
  const page = isRecord(root.page_metadata) ? root.page_metadata : undefined
  const pageNumber = page ? positiveInteger(page.page) : undefined
  const hasNext = page && typeof page.hasNext === 'boolean' ? page.hasNext : undefined
  const envelopeContractValid = spendingLevel === 'awards' && providerLimit !== undefined && pageNumber !== undefined && hasNext !== undefined
  const responseLimitMatch = request.valid && request.limit !== undefined && providerLimit !== undefined ? providerLimit === request.limit : undefined
  const pageMatch = request.valid && pageNumber !== undefined ? pageNumber === 1 : undefined

  if (request.valid && (responseLimitMatch === false || pageMatch === false)) {
    return <CardEmpty domain="federal-awards" title="Invalid USAspending award response" detail="The response pagination metadata did not match the executed award-search request." state="invalid"/>
  }

  if (!providerAwards.length) {
    return envelopeContractValid && request.valid && responseLimitMatch === true && pageMatch === true
      ? <CardEmpty domain="federal-awards" title="No contract awards returned" detail={`USAspending returned no new prime contract awards for FY${request.fiscalYear}.`} state="empty"/>
      : <CardEmpty domain="federal-awards" title="Invalid USAspending award response" detail="An empty award result could not be bound to a complete executed request and response envelope." state="invalid"/>
  }

  const awards = providerAwards.filter((award): award is Record<string, unknown> => isRecord(award) && finiteNumber(award.internal_id) !== undefined)
  const invalidAwardCount = providerAwards.length - awards.length
  if (!awards.length) {
    return <CardEmpty domain="federal-awards" title="Invalid USAspending award response" detail="The USAspending response contained no award records with a numeric provider internal_id." state="invalid"/>
  }

  const awardDates = awards.map((award) => dateValue(award['Base Obligation Date']))
  const awardDatesComplete = awardDates.every((value): value is string => value !== undefined)
  const awardDateRangeMatch = request.valid && request.startDate && request.endDate && awardDatesComplete
    ? awardDates.every((value) => value >= request.startDate! && value <= request.endDate!)
    : undefined
  if (request.valid && awardDateRangeMatch === false) {
    return <CardEmpty domain="federal-awards" title="Invalid USAspending award response" detail={`USAspending returned an award outside the executed FY${request.fiscalYear} new-award date range.`} state="invalid"/>
  }

  const incompleteAwardCount = awards.filter((award) => {
    const awardId = text(award['Award ID'])
    const recipient = cleanText(award['Recipient Name'])
    const amount = finiteNumber(award['Award Amount'])
    const obligationDate = dateValue(award['Base Obligation Date'])
    return !awardId || !recipient || amount === undefined || !obligationDate
  }).length
  const resultState = invalidAwardCount > 0 || incompleteAwardCount > 0 || !envelopeContractValid || !request.valid || awardDateRangeMatch !== true ? 'partial' : 'ready'
  const messages = Array.isArray(root.messages) ? root.messages.map((value) => text(value)).filter((value): value is string => Boolean(value)) : []
  const first = awards[0]
  return <div
    className="domain-card federal-awards-preview"
    data-domain-card="federal-awards"
    data-result-state={resultState}
    data-result-count={awards.length}
    data-provider-record-count={providerAwards.length}
    data-valid-award-count={awards.length}
    data-invalid-award-count={invalidAwardCount}
    data-incomplete-award-count={incompleteAwardCount}
    data-envelope-contract-valid={String(envelopeContractValid)}
    data-request-bound={String(request.valid)}
    data-request-contract-valid={String(request.valid)}
    data-request-fiscal-year={request.fiscalYear}
    data-request-start-date={request.startDate}
    data-request-end-date={request.endDate}
    data-request-date-type={request.dateType}
    data-request-award-type-codes={request.awardTypeCodes?.join(',')}
    data-request-limit={request.limit}
    data-response-limit-match={responseLimitMatch === undefined ? undefined : String(responseLimitMatch)}
    data-award-date-range-match={awardDateRangeMatch === undefined ? undefined : String(awardDateRangeMatch)}
    data-provider-limit={providerLimit}
    data-spending-level={spendingLevel}
    data-page={pageNumber}
    data-has-next={hasNext === undefined ? undefined : String(hasNext)}
    data-primary-internal-id={finiteNumber(first.internal_id)}
    data-primary-award-id={text(first['Award ID'])}
    data-primary-recipient={text(first['Recipient Name'])}
    data-primary-award-amount={finiteNumber(first['Award Amount'])}
    data-primary-award-amount-semantic="total_obligation"
    data-primary-obligation-date={dateValue(first['Base Obligation Date'])}
  >
    <CardHeading
      eyebrow="USAspending · New prime contract awards"
      title={`${awards.length} award${awards.length === 1 ? '' : 's'} on this page`}
      description={request.valid
        ? `Executed request: FY${request.fiscalYear} new prime contract awards, bound to the provider response by fiscal-year range and pagination metadata.`
        : 'Award data is visible, but this preview cannot prove which POST request produced the response.'}
    ><span className="domain-state">{resultState === 'ready' ? `Bound to FY${request.fiscalYear} request` : 'Partial provider response'}</span></CardHeading>

    {resultState === 'partial' && <p className="domain-note">USAspending returned an incomplete or malformed award batch, or the executed POST request context is unavailable. Only records with the required numeric provider <code>internal_id</code> are shown; missing optional award details remain unavailable rather than being invented.</p>}

    <ol className="federal-award-list" aria-label="USAspending prime contract awards">
      {awards.map((award, index) => {
        const internalId = finiteNumber(award.internal_id)!
        const awardId = text(award['Award ID'])
        const recipient = cleanText(award['Recipient Name'])
        const amount = finiteNumber(award['Award Amount'])
        const obligationDate = dateValue(award['Base Obligation Date'])
        const contractType = text(award['Contract Award Type'])
        const description = cleanText(award.Description)
        const complete = Boolean(awardId && recipient && amount !== undefined && obligationDate)
        return <li
          key={internalId}
          data-award-index={index + 1}
          data-internal-id={internalId}
          data-award-id={awardId}
          data-recipient={recipient ?? ''}
          data-record-complete={String(complete)}
          data-award-amount={amount}
          data-award-amount-semantic="total_obligation"
          data-base-obligation-date={obligationDate}
          data-contract-award-type={contractType}
          data-awarding-agency={text(award['Awarding Agency'])}
          data-funding-agency={text(award['Funding Agency'])}
        >
          <header><div><small>{awardId ? `Award ${awardId}` : `USAspending internal ID ${numericText(internalId)}`}</small><h4>{recipient ?? 'Recipient not supplied'}</h4></div>{contractType && <span>{contractType}</span>}</header>
          <div className="federal-award-amount"><span>Award Amount · total obligation</span><strong>{amount === undefined ? 'Not supplied' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount)}</strong><small>USD · award-level total_obligation</small></div>
          <Facts items={[
            { label: 'Base obligation date', value: obligationDate ? <time dateTime={obligationDate}>{obligationDate}</time> : 'Not supplied' },
            { label: 'Awarding agency', value: text(award['Awarding Agency']) ?? 'Not supplied' },
            { label: 'Awarding sub-agency', value: text(award['Awarding Sub Agency']) ?? 'Not supplied' },
            { label: 'Funding agency', value: text(award['Funding Agency']) ?? 'Not supplied' },
            { label: 'Funding sub-agency', value: text(award['Funding Sub Agency']) ?? 'Not supplied' },
          ]}/>
          {description && <p className="federal-award-description">{description}</p>}
        </li>
      })}
    </ol>

    <Facts items={[
      { label: 'Selected federal fiscal year', value: request.fiscalYear === undefined ? 'Unbound request' : `FY ${request.fiscalYear}` },
      { label: 'Spending level', value: spendingLevel ?? 'Not supplied' },
      { label: 'Provider result limit', value: providerLimit === undefined ? 'Not supplied' : numericText(providerLimit) },
      { label: 'Page', value: pageNumber === undefined ? 'Not supplied' : numericText(pageNumber) },
      { label: 'More results', value: hasNext === undefined ? 'Not supplied' : (hasNext ? 'Yes' : 'No') },
    ]}/>

    {messages.length > 0 && <section className="federal-award-messages" aria-labelledby="federal-award-messages-heading"><h4 id="federal-award-messages-heading">Provider messages</h4><ul>{messages.map((message, index) => <li key={index}>{message}</li>)}</ul></section>}
    <p className="domain-note">For contract awards, USAspending maps <strong>Award Amount</strong> to <code>total_obligation</code>. It is an award-level total obligation, not a single transaction amount or a potential award ceiling. The bound request uses <code>new_awards_only</code> and prime contract award types A-D.</p>
  </div>
}
