import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, finite, text } from './cardPrimitives'
import { nonNegativeSafeInteger, positiveSafeInteger, trimmedText } from './semanticValidation'

type ParliamentSearchRequest = {
  name: string
  skip: 0
  take: number
}

const parseCanonicalInteger = (value: string | null, min: number, max: number): number | undefined => {
  if (value === null || !/^(?:0|[1-9]\d*)$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined
}

const parseRequest = (requestUrl?: string): ParliamentSearchRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const entries = [...url.searchParams.entries()]
    const allowedKeys = ['Name', 'skip', 'take']
    const exactQuery = entries.length === allowedKeys.length
      && entries.every(([key]) => allowedKeys.includes(key))
      && allowedKeys.every((key) => entries.filter(([entryKey]) => entryKey === key).length === 1)
    const name = trimmedText(url.searchParams.get('Name'))
    const skip = parseCanonicalInteger(url.searchParams.get('skip'), 0, 0)
    const take = parseCanonicalInteger(url.searchParams.get('take'), 1, 20)
    const valid = url.protocol === 'https:'
      && url.hostname === 'members-api.parliament.uk'
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && url.pathname === '/api/Members/Search'
      && url.hash === ''
      && exactQuery
      && name !== undefined
      && skip === 0
      && take !== undefined
    return valid ? { name, skip: 0, take } : undefined
  } catch {
    return undefined
  }
}

type RequestIdentity = {
  request?: ParliamentSearchRequest
  requestBound: boolean
  invalidReason?: string
}

const resolveRequestIdentity = (requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestIdentity => {
  const request = parseRequest(requestUrl)
  if (!request) return { requestBound: false, invalidReason: 'The successful response was not tied to the exact supported UK Parliament member-name search request.' }
  if (!executedRequest) return { request, requestBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl || !parseRequest(executedRequest.url)) {
    return { request, requestBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET UK Parliament member-name search request.' }
  }
  return { request, requestBound: true }
}

const normalizedSearchText = (value: string) => value.normalize('NFKC').toLocaleLowerCase('en-GB')
const memberNames = (member: Record<string, unknown>) => [member.nameDisplayAs, member.nameFullTitle, member.nameListAs, member.nameAddressAs]
  .map(trimmedText)
  .filter((value): value is string => value !== undefined)
const memberMatchesRequest = (member: Record<string, unknown>, requestedName: string) => {
  const needle = normalizedSearchText(requestedName)
  return memberNames(member).some((candidate) => normalizedSearchText(candidate).includes(needle))
}

const houseLabel = (value: unknown) => value === 1 ? 'House of Commons' : value === 2 ? 'House of Lords' : value === undefined || value === null ? 'House not supplied' : `House ${String(value)}`
const dateOnly = (value: unknown) => text(value)?.slice(0, 10)
const memberName = (member: Record<string, unknown>) => memberNames(member)[0]
const paginationContractValid = (
  total: number | undefined,
  take: number | undefined,
  skip: number | undefined,
  providerCount: number,
  request: ParliamentSearchRequest,
) => total !== undefined
  && take === request.take
  && skip === request.skip
  && providerCount <= request.take
  && total >= request.skip + providerCount

export function UkParliamentMembersPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const identity = resolveRequestIdentity(requestUrl, executedRequest)
  const { request, requestBound } = identity
  if (!request || identity.invalidReason) {
    return <CardEmpty domain="parliament-members" title="Invalid Parliament members request identity" detail={identity.invalidReason ?? 'The semantic result could not verify the exact UK Parliament member-name search with Name, skip=0, and bounded take parameters.'} state="invalid"/>
  }

  const root = asRecord(data)
  const totalResults = nonNegativeSafeInteger(root.totalResults)
  const take = positiveSafeInteger(root.take)
  const skip = nonNegativeSafeInteger(root.skip)

  if (!Array.isArray(root.items)) {
    return <CardEmpty domain="parliament-members" title="Invalid Parliament members response" detail="The UK Parliament Members API response did not include the documented items array." state="invalid"/>
  }

  const countContractValid = paginationContractValid(totalResults, take, skip, root.items.length, request)
  if (!root.items.length) {
    if (totalResults === 0 && countContractValid) {
      return requestBound
        ? <CardEmpty domain="parliament-members" title="No current Parliament members returned" detail={`The UK Parliament Members API returned zero current Commons or Lords members for the exact executed “${request.name}” search.`} state="empty"/>
        : <div className="domain-card domain-empty" data-domain-card="parliament-members" data-result-state="partial" data-request-bound="false" data-request-contract="exact-uk-parliament-members-search-v2" data-requested-name={request.name} data-requested-take={request.take} data-requested-skip={request.skip}><h3>Unbound Parliament members empty response</h3><p>The provider returned a coherent zero-result envelope for the displayed canonical search, but executed transport identity is unavailable, so semantic emptiness is not trusted.</p></div>
    }
    return <CardEmpty domain="parliament-members" title="Invalid Parliament members response" detail="The UK Parliament Members API returned an empty items array without request-bound zero-result pagination evidence." state="invalid"/>
  }

  const providerItems = root.items.map(asRecord)
  const providerMembers = providerItems.map((item) => asRecord(item.value))
  const identifiedMembers = providerMembers.map((member) => ({ member, id: positiveSafeInteger(member.id) })).filter((entry): entry is { member: Record<string, unknown>; id: number } => entry.id !== undefined)
  const invalidMemberCount = providerMembers.length - identifiedMembers.length
  const seenIds = new Set<number>()
  const uniqueIdentifiedMembers = identifiedMembers.filter(({ id }) => {
    if (seenIds.has(id)) return false
    seenIds.add(id)
    return true
  })
  const duplicateMemberCount = identifiedMembers.length - uniqueIdentifiedMembers.length
  const requestBoundMembers = uniqueIdentifiedMembers.filter(({ member }) => memberMatchesRequest(member, request.name))
  const requestMismatchCount = uniqueIdentifiedMembers.length - requestBoundMembers.length
  if (!requestBoundMembers.length) {
    return <CardEmpty domain="parliament-members" title="Invalid Parliament member search identity" detail="The HTTP-success response did not contain any provider-owned member records whose returned name matched the executed member-name search." state="invalid"/>
  }

  const members = requestBoundMembers.map(({ member }) => member)
  const incompleteMemberCount = members.filter((member) => !memberName(member)).length
  const state = !requestBound || invalidMemberCount > 0 || duplicateMemberCount > 0 || requestMismatchCount > 0 || incompleteMemberCount > 0 || !countContractValid ? 'partial' : 'ready'
  const first = members[0]

  return <div
    className="domain-card parliament-members-preview"
    data-domain-card="parliament-members"
    data-result-state={state}
    data-request-contract-valid="true"
    data-request-bound={String(requestBound)}
    data-request-contract="exact-uk-parliament-members-search-v2"
    data-requested-name={request.name}
    data-requested-take={request.take}
    data-requested-skip={request.skip}
    data-row-count={members.length}
    data-provider-record-count={providerItems.length}
    data-valid-member-count={members.length}
    data-invalid-member-count={invalidMemberCount}
    data-duplicate-member-count={duplicateMemberCount}
    data-request-mismatch-count={requestMismatchCount}
    data-incomplete-member-count={incompleteMemberCount}
    data-count-contract-valid={String(countContractValid)}
    data-total-results={totalResults}
    data-provider-take={take}
    data-provider-skip={skip}
    data-primary-member-id={positiveSafeInteger(first.id)}
  >
    <CardHeading
      eyebrow="UK Parliament · Members API"
      title={`${members.length} current member${members.length === 1 ? '' : 's'} returned`}
      description={requestBound
        ? `Trusted rows are bound to the exact executed “${request.name}” member-name search plus provider pagination. Constituency/location is shown only when the provider supplies it for the latest house membership.`
        : `Rows match the displayed canonical “${request.name}” search, but executed transport identity is unavailable, so the result remains partial.`}
    ><span className="domain-state">{state === 'partial' ? 'Partial member batch' : totalResults === undefined ? 'Current members' : `${totalResults} match${totalResults === 1 ? '' : 'es'} total`}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">{requestBound ? 'Some provider rows, search identity, or pagination metadata were incomplete or malformed.' : 'Executed transport identity is unavailable, so this coherent response cannot be marked ready.'} Only unique rows with a provider-owned member ID and returned name matching the displayed canonical search are included in the trusted member list.</p>}
    <div className="parliament-result-context" aria-label="Parliament search result context">
      <span><strong>{members.length}</strong> trusted of {providerItems.length} returned</span>
      <span><strong>{request.name}</strong> requested name</span>
      <span><strong>{take ?? 'Not supplied'}</strong> provider take</span>
      <span><strong>{skip ?? 'Not supplied'}</strong> provider skip</span>
    </div>
    <ol className="parliament-member-list" aria-label="Current UK Parliament members">
      {members.map((member, index) => {
        const party = asRecord(member.latestParty)
        const membership = asRecord(member.latestHouseMembership)
        const status = asRecord(membership.membershipStatus)
        const memberId = positiveSafeInteger(member.id)!
        const partyId = finite(party.id)
        const membershipFromId = finite(membership.membershipFromId)
        const displayName = memberName(member) ?? `Member ID ${memberId}`
        const fullTitle = text(member.nameFullTitle)
        const partyName = text(party.name) ?? 'Party not supplied'
        const house = houseLabel(membership.house)
        const membershipFrom = text(membership.membershipFrom)
        const startDate = text(membership.membershipStartDate)
        const endDate = text(membership.membershipEndDate)
        const statusDescription = text(status.statusDescription) ?? (status.statusIsActive === true ? 'Current Member' : status.statusIsActive === false ? 'Inactive membership' : 'Status not supplied')
        return <li key={memberId} data-member-index={index + 1} data-member-id={memberId} data-party-id={partyId} data-house={membership.house} data-membership-from-id={membershipFromId} data-membership-status={statusDescription} data-membership-active={status.statusIsActive === undefined ? undefined : String(status.statusIsActive)}>
          <header><div><small>{house} · Member ID {memberId}</small><h4>{displayName}</h4>{fullTitle && fullTitle !== displayName && <p>{fullTitle}</p>}</div><span>{partyName}</span></header>
          <Facts items={[
            { label: 'Party', value: partyName },
            { label: 'Party abbreviation', value: text(party.abbreviation) ?? 'Not supplied' },
            { label: 'House', value: house },
            { label: 'Membership from', value: membershipFrom ?? 'Not supplied' },
            { label: 'Membership started', value: startDate ? <time dateTime={startDate}>{dateOnly(startDate)}</time> : 'Not supplied' },
            { label: 'Membership status', value: statusDescription },
            ...(endDate ? [{ label: 'Membership ended', value: <time dateTime={endDate}>{dateOnly(endDate)}</time> }] : []),
          ]}/>
        </li>
      })}
    </ol>
    <p className="domain-note">This is current-members search metadata. It does not infer parliamentary offices or roles, and it does not invent a constituency/location when the provider omits one.</p>
  </div>
}
