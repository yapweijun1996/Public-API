import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { SemanticCards, type SemanticCard } from './SemanticCards'
import { isRecord, optionalTrimmedText, trimmedText } from './semanticValidation'

const REQUEST_CONTRACT = 'exact-jolpica-season-round-qualifying'
const LAP_TIME_PATTERN = /^\d+:[0-5]\d\.\d{3}$/

type RequestIdentity = { season: string; round: string }
type RequestBinding = { identity?: RequestIdentity; valid: boolean; bound: boolean }

const canonicalDecimal = (value: unknown, minimum: number): string | undefined => {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum ? value : undefined
}

const requestIdentity = (requestUrl?: string): RequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const match = /^\/ergast\/f1\/(2023|2024|2025)\/([1-9]\d*)\/qualifying\/$/.exec(url.pathname)
    if (
      url.protocol !== 'https:'
      || url.origin !== 'https://api.jolpi.ca'
      || url.username
      || url.password
      || url.search
      || url.hash
      || !match
    ) return undefined
    const round = Number(match[2])
    return Number.isSafeInteger(round) && round >= 1 && round <= 30
      ? { season: match[1], round: match[2] }
      : undefined
  } catch {
    return undefined
  }
}

const bindRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestBinding => {
  const displayed = requestIdentity(requestUrl)
  if (requestUrl && !displayed) return { valid: false, bound: false }
  if (!executedRequest) return { identity: displayed, valid: true, bound: false }
  if (
    executedRequest.method.toUpperCase() !== 'GET'
    || executedRequest.body !== undefined
    || (requestUrl !== undefined && executedRequest.url !== requestUrl)
  ) return { identity: displayed, valid: false, bound: false }
  const executed = requestIdentity(executedRequest.url)
  if (!executed || (displayed && (displayed.season !== executed.season || displayed.round !== executed.round))) {
    return { identity: displayed ?? executed, valid: false, bound: false }
  }
  return { identity: executed, valid: true, bound: true }
}

type QualifyingRow = {
  driverId: string
  driverName: string
  driverCode?: string
  driverNationality?: string
  constructorId: string
  constructorName: string
  carNumber: string
  position?: string
  q1?: string
  q2?: string
  q3?: string
  optionalMalformed: boolean
}

const optionalLapTime = (value: unknown) => {
  const parsed = optionalTrimmedText(value)
  if (parsed.malformed || (parsed.value && !LAP_TIME_PATTERN.test(parsed.value))) return { malformed: true, value: undefined }
  return parsed
}

const parseQualifyingRow = (value: unknown): QualifyingRow | undefined => {
  if (!isRecord(value) || !isRecord(value.Driver) || !isRecord(value.Constructor)) return undefined
  const driverId = trimmedText(value.Driver.driverId)
  const givenName = trimmedText(value.Driver.givenName)
  const familyName = trimmedText(value.Driver.familyName)
  const constructorId = trimmedText(value.Constructor.constructorId)
  const constructorName = trimmedText(value.Constructor.name)
  const carNumber = canonicalDecimal(value.number, 0)
  if (!driverId || !givenName || !familyName || !constructorId || !constructorName || carNumber === undefined) return undefined

  const positionText = optionalTrimmedText(value.position)
  const position = positionText.value ? canonicalDecimal(positionText.value, 1) : undefined
  const driverCode = optionalTrimmedText(value.Driver.code)
  const driverNationality = optionalTrimmedText(value.Driver.nationality)
  const q1 = optionalLapTime(value.Q1)
  const q2 = optionalLapTime(value.Q2)
  const q3 = optionalLapTime(value.Q3)
  return {
    driverId,
    driverName: `${givenName} ${familyName}`,
    driverCode: driverCode.value,
    driverNationality: driverNationality.value,
    constructorId,
    constructorName,
    carNumber,
    position,
    q1: q1.value,
    q2: q2.value,
    q3: q3.value,
    optionalMalformed: positionText.malformed
      || (positionText.value !== undefined && position === undefined)
      || driverCode.malformed
      || driverNationality.malformed
      || q1.malformed
      || q2.malformed
      || q3.malformed,
  }
}

type ResultState = 'ready' | 'partial' | 'empty' | 'invalid'

const StateCard = ({ state, evidence, title, detail }: {
  state: Exclude<ResultState, 'ready'>
  evidence: Record<string, string | undefined>
  title: string
  detail: string
}) => <div className="domain-card domain-empty" data-domain-card="jolpica-qualifying" data-result-state={state} {...evidence}>
  <h3>{title}</h3>
  <p>{detail}</p>
</div>

export function OpenF1SessionsPreview({ data, requestUrl, executedRequest }: {
  data: unknown
  requestUrl?: string
  executedRequest?: ExecutedRequestContext
}) {
  const transport = bindRequest(requestUrl, executedRequest)
  const root = isRecord(data) ? data : undefined
  const mrData = root && isRecord(root.MRData) ? root.MRData : undefined
  const raceTable = mrData && isRecord(mrData.RaceTable) ? mrData.RaceTable : undefined
  const races = raceTable && Array.isArray(raceTable.Races) ? raceTable.Races : undefined
  const providerSeason = trimmedText(raceTable?.season)
  const providerRound = canonicalDecimal(raceTable?.round, 1)
  const limit = canonicalDecimal(mrData?.limit, 1)
  const offset = canonicalDecimal(mrData?.offset, 0)
  const total = canonicalDecimal(mrData?.total, 0)
  const totalCount = total === undefined ? undefined : Number(total)
  const identityMatch = transport.identity
    ? providerSeason === transport.identity.season && providerRound === transport.identity.round
    : undefined

  const race = races?.length === 1 && isRecord(races[0]) ? races[0] : undefined
  const raceSeason = trimmedText(race?.season)
  const raceRound = canonicalDecimal(race?.round, 1)
  const raceName = trimmedText(race?.raceName)
  const circuit = race && isRecord(race.Circuit) ? race.Circuit : undefined
  const location = circuit && isRecord(circuit.Location) ? circuit.Location : undefined
  const circuitId = trimmedText(circuit?.circuitId)
  const circuitName = trimmedText(circuit?.circuitName)
  const locality = trimmedText(location?.locality)
  const country = trimmedText(location?.country)
  const providerResults = race && Array.isArray(race.QualifyingResults) ? race.QualifyingResults : []

  const envelopeValid = Boolean(
    root
    && mrData
    && mrData.series === 'f1'
    && raceTable
    && races
    && races.length <= 1
    && limit !== undefined
    && offset === '0'
    && totalCount !== undefined
    && totalCount <= Number(limit)
    && ((totalCount === 0 && races.length === 0) || (totalCount > 0 && race && providerResults.length === totalCount))
  )
  const raceIdentityValid = totalCount === 0 || Boolean(
    race
    && raceSeason === providerSeason
    && raceRound === providerRound
    && raceName
    && circuitId
    && circuitName
    && locality
    && country
  )
  const responseIdentityValid = Boolean(providerSeason && providerRound && (!transport.identity || identityMatch))

  const seenDriverIds = new Set<string>()
  const parsedRows: QualifyingRow[] = []
  let invalidResultCount = 0
  for (const providerResult of providerResults) {
    const parsed = parseQualifyingRow(providerResult)
    if (!parsed || seenDriverIds.has(parsed.driverId)) {
      invalidResultCount += 1
      continue
    }
    seenDriverIds.add(parsed.driverId)
    parsedRows.push(parsed)
  }
  const malformedOptionalCount = parsedRows.filter((row) => row.optionalMalformed).length
  const providerResultCount = providerResults.length
  const validResultCount = parsedRows.length
  const evidence = {
    'data-request-bound': String(transport.bound),
    'data-request-contract': REQUEST_CONTRACT,
    'data-requested-season': transport.identity?.season,
    'data-requested-round': transport.identity?.round,
    'data-provider-season': providerSeason,
    'data-provider-round': providerRound,
    'data-identity-match': identityMatch === undefined ? 'unbound' : String(identityMatch),
    'data-provider-total': total,
    'data-provider-result-count': String(providerResultCount),
    'data-valid-result-count': String(validResultCount),
    'data-invalid-result-count': String(invalidResultCount),
    'data-malformed-optional-count': String(malformedOptionalCount),
    'data-primary-driver-id': parsedRows[0]?.driverId,
  }

  if (!transport.valid || !envelopeValid || !raceIdentityValid || !responseIdentityValid || (providerResultCount > 0 && validResultCount === 0)) {
    return <StateCard
      state="invalid"
      evidence={evidence}
      title="Invalid Jolpica qualifying response"
      detail={!transport.valid
        ? 'The successful response was not bound to the exact supported bodyless GET qualifying request.'
        : identityMatch === false
          ? 'The returned season or round does not match the executed Jolpica qualifying request, so classification facts are withheld.'
          : 'The HTTP-success payload does not match the documented Jolpica qualifying envelope, count, race, or driver identity contract.'}
    />
  }

  if (totalCount === 0) {
    return transport.bound
      ? <StateCard state="empty" evidence={evidence} title="No qualifying classification returned" detail="Jolpica returned a coherent zero-result response for this exact season and round."/>
      : <StateCard state="partial" evidence={evidence} title="Unbound empty qualifying response" detail="The zero-result envelope is coherent, but executed transport identity is unavailable."/>
  }

  const state: ResultState = transport.bound && invalidResultCount === 0 && malformedOptionalCount === 0 ? 'ready' : 'partial'
  const cards: SemanticCard[] = parsedRows.slice(0, 10).map((result) => ({
    title: result.driverName,
    eyebrow: `${raceName ?? 'Grand Prix'} · ${result.position ? `P${result.position}` : 'Position not supplied'}`,
    badge: result.driverCode ?? `#${result.carNumber}`,
    description: `${result.constructorName} · ${result.driverNationality ?? 'Nationality not supplied'} · ${locality ?? 'Locality not supplied'}, ${country ?? 'Country not supplied'}`,
    metrics: [
      { label: 'Q1', value: result.q1 ?? '—' },
      { label: 'Q2', value: result.q2 ?? '—' },
      { label: 'Q3', value: result.q3 ?? '—' },
      { label: 'Circuit', value: circuitName ?? '—' },
    ],
    tags: [result.driverId, result.constructorId],
  }))

  return <div className="domain-card" data-domain-card="jolpica-qualifying" data-result-state={state} {...evidence}>
    {state === 'partial' && <p className="domain-note">Only qualifying rows with provider-owned driver and constructor identities are shown. The response is partial when transport evidence is unavailable or malformed rows or optional fields were withheld.</p>}
    <SemanticCards cards={cards} emptyTitle="Qualifying results unavailable"/>
  </div>
}
