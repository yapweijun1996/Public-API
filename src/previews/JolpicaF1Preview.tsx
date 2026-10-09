import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardEmpty, CardHeading, Facts, finite, numericText, text } from './cardPrimitives'

type Dataset = 'drivers' | 'constructors' | 'races'
type JolpicaRequest = { season: string; dataset: Dataset; limit: number }
type BoundJolpicaRequest = { request?: JolpicaRequest; transportBound: boolean; invalidReason?: string }

const REQUEST_CONTRACT = 'exact-jolpica-season-catalog-v2'

const providerInteger = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

const requestedCatalog = (requestUrl?: string): JolpicaRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'api.jolpi.ca' || url.port || url.hash || url.username || url.password) return undefined
    const match = /^\/ergast\/f1\/(2023|2024|2025)\/(drivers|constructors|races)\.json$/.exec(url.pathname)
    if (!match || [...url.searchParams.keys()].some((key) => key !== 'limit') || url.searchParams.getAll('limit').length !== 1) return undefined
    const raw = url.searchParams.get('limit') ?? ''
    if (!/^\d+$/.test(raw)) return undefined
    const limit = Number(raw)
    if (!Number.isInteger(limit) || limit < 1 || limit > 30) return undefined
    const request = { season: match[1], dataset: match[2] as Dataset, limit }
    const canonical = `https://api.jolpi.ca/ergast/f1/${request.season}/${request.dataset}.json?limit=${request.limit}`
    return requestUrl === canonical ? request : undefined
  } catch { return undefined }
}

const bindJolpicaRequest = (requestUrl?: string, executedRequest?: ExecutedRequestContext): BoundJolpicaRequest => {
  if (!requestUrl) return { transportBound: false }
  const request = requestedCatalog(requestUrl)
  if (!request) return { transportBound: false, invalidReason: 'The displayed request was not the exact supported Jolpica season catalogue request.' }
  if (!executedRequest) return { request, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl) {
    return { request, transportBound: false, invalidReason: 'The successful response was not bound to the exact supported bodyless GET Jolpica season catalogue request.' }
  }
  const executed = requestedCatalog(executedRequest.url)
  if (!executed || executed.season !== request.season || executed.dataset !== request.dataset || executed.limit !== request.limit) {
    return { request, transportBound: false, invalidReason: 'The displayed Jolpica request and executed request identity did not match.' }
  }
  return { request, transportBound: true }
}

const link = (value: unknown) => {
  const candidate = text(value)
  if (!candidate) return undefined
  try {
    const url = new URL(candidate)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}

const dateTime = (date: unknown, time: unknown) => {
  const d = text(date)
  const t = text(time)
  if (!d) return undefined
  return t ? `${d}T${t}` : d
}

const detectedDataset = (mrData: Record<string, unknown>): Dataset | undefined => {
  if (Object.keys(asRecord(mrData.DriverTable)).length) return 'drivers'
  if (Object.keys(asRecord(mrData.ConstructorTable)).length) return 'constructors'
  if (Object.keys(asRecord(mrData.RaceTable)).length) return 'races'
  return undefined
}

const countContractValid = (providerTotal: number, providerLimit: number, providerRecords: number) =>
  providerTotal >= providerRecords && providerRecords <= providerLimit

const resultState = (requestBound: boolean, countValid: boolean, invalidRecords: number) =>
  requestBound && countValid && invalidRecords === 0 ? 'ready' : 'partial'

const stateLabel = (state: 'ready' | 'partial', validRecords: number, providerRecords: number, providerTotal: number) =>
  state === 'partial'
    ? `${validRecords} usable of ${providerRecords} returned · ${providerTotal} total`
    : `${validRecords} returned · ${providerTotal} total`

const requestAttrs = (request: JolpicaRequest | undefined, transportBound: boolean, dataset: Dataset, season: string, providerLimit: number) => ({
  'data-request-bound': transportBound ? 'true' : 'false',
  'data-request-contract': REQUEST_CONTRACT,
  'data-request-season': request?.season,
  'data-request-dataset': request?.dataset,
  'data-request-limit': request?.limit,
  'data-season-contract-valid': String(Boolean(request && season === request.season)),
  'data-dataset-contract-valid': String(Boolean(request && dataset === request.dataset)),
  'data-limit-contract-valid': String(Boolean(request && providerLimit === request.limit)),
})

export function JolpicaF1Preview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const binding = bindJolpicaRequest(requestUrl, executedRequest)
  const request = binding.request
  if (binding.invalidReason) return <CardEmpty domain="f1-season-catalog" title="Formula 1 request identity invalid" detail={binding.invalidReason} state="invalid"/>
  const root = asRecord(data)
  const mrData = asRecord(root.MRData)
  const dataset = detectedDataset(mrData)
  if (!dataset) return <CardEmpty domain="f1-season-catalog" title="Formula 1 season data unavailable" detail="Jolpica returned no supported DriverTable, ConstructorTable, or RaceTable payload." state="invalid"/>
  if (request && dataset !== request.dataset) return <CardEmpty domain="f1-season-catalog" title="Formula 1 dataset identity mismatch" detail="Jolpica returned a different season-catalogue dataset than the one in the executed request." state="invalid"/>
  const providerLimit = providerInteger(mrData.limit)
  const providerOffset = providerInteger(mrData.offset)
  const providerTotal = providerInteger(mrData.total)
  if (mrData.series !== 'f1' || providerLimit === undefined || providerOffset !== 0 || providerTotal === undefined) return <CardEmpty domain="f1-season-catalog" title="Formula 1 pagination metadata invalid" detail="Jolpica returned HTTP-success data without the documented F1 series and decimal-string limit, offset, and total metadata." state="invalid"/>
  if (request && providerLimit !== request.limit) return <CardEmpty domain="f1-season-catalog" title="Formula 1 request limit mismatch" detail="Jolpica did not acknowledge the row limit from the executed request." state="invalid"/>

  if (dataset === 'drivers') {
    const table = asRecord(mrData.DriverTable)
    const season = text(table.season)
    if (!season || (request && season !== request.season)) return <CardEmpty domain="f1-season-catalog" title="Formula 1 driver season mismatch" detail="Jolpica did not return the driver season requested by the executed URL." state="invalid"/>
    if (!Array.isArray(table.Drivers)) return <CardEmpty domain="f1-season-catalog" title="Formula 1 driver data invalid" detail="Jolpica returned a DriverTable without the documented Drivers array." state="invalid"/>
    const providerRecords = table.Drivers.map(asRecord)
    const countValid = countContractValid(providerTotal, providerLimit, providerRecords.length)
    if (!providerRecords.length) {
      return binding.transportBound && request && providerTotal === 0 && countValid
        ? <div className="domain-card domain-empty" data-domain-card="f1-season-catalog" data-result-state="empty" data-dataset="drivers" data-season={season} data-provider-total="0" data-provider-limit={providerLimit} data-provider-offset={providerOffset} data-provider-record-count="0" data-valid-record-count="0" data-invalid-record-count="0" data-count-contract-valid="true" {...requestAttrs(request, binding.transportBound, dataset, season, providerLimit)}><h3>No Formula 1 drivers returned</h3><p>Jolpica returned a request-bound zero-result driver catalogue for this season.</p></div>
        : <CardEmpty domain="f1-season-catalog" title="Formula 1 driver data invalid" detail="Jolpica returned an empty Drivers array without a request-bound zero-result count contract." state="invalid"/>
    }
    const drivers = providerRecords.filter((driver) => text(driver.driverId) && text(driver.givenName) && text(driver.familyName))
    if (!drivers.length) return <CardEmpty domain="f1-season-catalog" title="Formula 1 driver data invalid" detail="Returned driver records did not contain the documented driver ID and name identity." state="invalid"/>
    const invalidRecords = providerRecords.length - drivers.length
    const state = resultState(binding.transportBound, countValid, invalidRecords)
    const first = drivers[0]
    return <div className="domain-card jolpica-f1-preview" data-domain-card="f1-season-catalog" data-result-state={state} data-dataset="drivers" data-season={season} data-provider-total={providerTotal} data-provider-limit={providerLimit} data-provider-offset={providerOffset} data-provider-record-count={providerRecords.length} data-valid-record-count={drivers.length} data-invalid-record-count={invalidRecords} data-count-contract-valid={String(countValid)} data-primary-id={text(first.driverId)} {...requestAttrs(request, binding.transportBound, dataset, season, providerLimit)}>
      <CardHeading eyebrow="Jolpica · Formula 1 season drivers" title={`${season} drivers`} description="Drivers that participated in the selected Formula 1 season. Jolpica documents this list as ordered alphabetically by driverId."><span className="domain-state">{stateLabel(state, drivers.length, providerRecords.length, providerTotal)}</span></CardHeading>
      <ol className="jolpica-season-list" aria-label="Formula 1 season drivers">{drivers.map((driver, index) => {
        const id = text(driver.driverId)!
        const name = `${text(driver.givenName)} ${text(driver.familyName)}`
        const href = link(driver.url)
        return <li key={`${id}-${index}`} data-record-index={index + 1} data-driver-id={id} data-driver-code={text(driver.code)} data-driver-number={text(driver.permanentNumber)} data-nationality={text(driver.nationality)}>
          <header><div><small>Driver · {id}</small><h4>{name}</h4></div><span>{text(driver.code) ?? 'Code not supplied'}</span></header>
          <Facts items={[
            { label: 'Permanent number', value: text(driver.permanentNumber) ?? 'Not supplied' },
            { label: 'Nationality', value: text(driver.nationality) ?? 'Not supplied' },
            { label: 'Date of birth', value: text(driver.dateOfBirth) ? <time dateTime={text(driver.dateOfBirth)}>{text(driver.dateOfBirth)}</time> : 'Not supplied' },
          ]}/>
          {href && <a className="domain-reference-link" href={href} target="_blank" rel="noreferrer" aria-label={`Open ${name} reference`}>Reference</a>}
        </li>
      })}</ol>
    </div>
  }

  if (dataset === 'constructors') {
    const table = asRecord(mrData.ConstructorTable)
    const season = text(table.season)
    if (!season || (request && season !== request.season)) return <CardEmpty domain="f1-season-catalog" title="Formula 1 constructor season mismatch" detail="Jolpica did not return the constructor season requested by the executed URL." state="invalid"/>
    if (!Array.isArray(table.Constructors)) return <CardEmpty domain="f1-season-catalog" title="Formula 1 constructor data invalid" detail="Jolpica returned a ConstructorTable without the documented Constructors array." state="invalid"/>
    const providerRecords = table.Constructors.map(asRecord)
    const countValid = countContractValid(providerTotal, providerLimit, providerRecords.length)
    if (!providerRecords.length) {
      return binding.transportBound && request && providerTotal === 0 && countValid
        ? <div className="domain-card domain-empty" data-domain-card="f1-season-catalog" data-result-state="empty" data-dataset="constructors" data-season={season} data-provider-total="0" data-provider-limit={providerLimit} data-provider-offset={providerOffset} data-provider-record-count="0" data-valid-record-count="0" data-invalid-record-count="0" data-count-contract-valid="true" {...requestAttrs(request, binding.transportBound, dataset, season, providerLimit)}><h3>No Formula 1 constructors returned</h3><p>Jolpica returned a request-bound zero-result constructor catalogue for this season.</p></div>
        : <CardEmpty domain="f1-season-catalog" title="Formula 1 constructor data invalid" detail="Jolpica returned an empty Constructors array without a request-bound zero-result count contract." state="invalid"/>
    }
    const constructors = providerRecords.filter((constructor) => text(constructor.name))
    if (!constructors.length) return <CardEmpty domain="f1-season-catalog" title="Formula 1 constructor data invalid" detail="Returned constructor records did not contain the documented constructor name identity." state="invalid"/>
    const invalidRecords = providerRecords.length - constructors.length
    const state = resultState(binding.transportBound, countValid, invalidRecords)
    const first = constructors[0]
    return <div className="domain-card jolpica-f1-preview" data-domain-card="f1-season-catalog" data-result-state={state} data-dataset="constructors" data-season={season} data-provider-total={providerTotal} data-provider-limit={providerLimit} data-provider-offset={providerOffset} data-provider-record-count={providerRecords.length} data-valid-record-count={constructors.length} data-invalid-record-count={invalidRecords} data-count-contract-valid={String(countValid)} data-primary-id={text(first.constructorId) ?? text(first.name)} {...requestAttrs(request, binding.transportBound, dataset, season, providerLimit)}>
      <CardHeading eyebrow="Jolpica · Formula 1 season constructors" title={`${season} constructors`} description="Constructors that participated in the selected Formula 1 season, preserving provider names, optional IDs, and nationality."><span className="domain-state">{stateLabel(state, constructors.length, providerRecords.length, providerTotal)}</span></CardHeading>
      <ol className="jolpica-season-list" aria-label="Formula 1 season constructors">{constructors.map((constructor, index) => {
        const id = text(constructor.constructorId)
        const name = text(constructor.name)!
        const href = link(constructor.url)
        return <li key={`${id ?? name}-${index}`} data-record-index={index + 1} data-constructor-id={id} data-nationality={text(constructor.nationality)}>
          <header><div><small>Constructor{id ? ` · ${id}` : ''}</small><h4>{name}</h4></div><span>{text(constructor.nationality) ?? 'Nationality not supplied'}</span></header>
          {href && <a className="domain-reference-link" href={href} target="_blank" rel="noreferrer" aria-label={`Open ${name} reference`}>Reference</a>}
        </li>
      })}</ol>
    </div>
  }

  const table = asRecord(mrData.RaceTable)
  const season = text(table.season)
  if (!season || (request && season !== request.season)) return <CardEmpty domain="f1-season-catalog" title="Formula 1 race season mismatch" detail="Jolpica did not return the race season requested by the executed URL." state="invalid"/>
  if (!Array.isArray(table.Races)) return <CardEmpty domain="f1-season-catalog" title="Formula 1 race data invalid" detail="Jolpica returned a RaceTable without the documented Races array." state="invalid"/>
  const providerRecords = table.Races.map(asRecord)
  const countValid = countContractValid(providerTotal, providerLimit, providerRecords.length)
  if (!providerRecords.length) {
    return binding.transportBound && request && providerTotal === 0 && countValid
      ? <div className="domain-card domain-empty" data-domain-card="f1-season-catalog" data-result-state="empty" data-dataset="races" data-season={season} data-provider-total="0" data-provider-limit={providerLimit} data-provider-offset={providerOffset} data-provider-record-count="0" data-valid-record-count="0" data-invalid-record-count="0" data-count-contract-valid="true" {...requestAttrs(request, binding.transportBound, dataset, season, providerLimit)}><h3>No Formula 1 races returned</h3><p>Jolpica returned a request-bound zero-result race catalogue for this season.</p></div>
      : <CardEmpty domain="f1-season-catalog" title="Formula 1 race data invalid" detail="Jolpica returned an empty Races array without a request-bound zero-result count contract." state="invalid"/>
  }
  const races = providerRecords.filter((race) => {
    const circuit = asRecord(race.Circuit)
    return (!request || text(race.season) === request.season)
      && Boolean(text(race.round) && text(race.raceName) && text(circuit.circuitId) && text(circuit.circuitName))
  })
  if (!races.length) return <CardEmpty domain="f1-season-catalog" title="Formula 1 race data invalid" detail="Returned race records did not contain the requested season plus documented round, race, and circuit identity." state="invalid"/>
  const invalidRecords = providerRecords.length - races.length
  const state = resultState(binding.transportBound, countValid, invalidRecords)
  const first = races[0]
  return <div className="domain-card jolpica-f1-preview" data-domain-card="f1-season-catalog" data-result-state={state} data-dataset="races" data-season={season} data-provider-total={providerTotal} data-provider-limit={providerLimit} data-provider-offset={providerOffset} data-provider-record-count={providerRecords.length} data-valid-record-count={races.length} data-invalid-record-count={invalidRecords} data-count-contract-valid={String(countValid)} data-primary-id={text(first.round)} {...requestAttrs(request, binding.transportBound, dataset, season, providerLimit)}>
    <CardHeading eyebrow="Jolpica · Formula 1 season races" title={`${season} race calendar`} description="Races are returned from earliest to latest. Race and session timestamps remain UTC when the provider supplies a Z-suffixed time."><span className="domain-state">{stateLabel(state, races.length, providerRecords.length, providerTotal)}</span></CardHeading>
    <ol className="jolpica-season-list" aria-label="Formula 1 season races">{races.map((race, index) => {
      const circuit = asRecord(race.Circuit)
      const location = asRecord(circuit.Location)
      const round = text(race.round)!
      const raceName = text(race.raceName)!
      const start = dateTime(race.date, race.time)
      const latitude = finite(location.lat)
      const longitude = finite(location.long)
      const href = link(race.url)
      return <li key={`${round}-${raceName}-${index}`} data-record-index={index + 1} data-round={round} data-race-name={raceName} data-circuit-id={text(circuit.circuitId)} data-race-start={start} data-latitude={latitude} data-longitude={longitude}>
        <header><div><small>Round {round}</small><h4>{raceName}</h4></div><span>{start ?? 'Start not supplied'}</span></header>
        <Facts items={[
          { label: 'Circuit', value: text(circuit.circuitName)! },
          { label: 'Location', value: [text(location.locality), text(location.country)].filter(Boolean).join(', ') || 'Not supplied' },
          { label: 'Coordinates', value: latitude === undefined || longitude === undefined ? 'Not supplied' : `${numericText(latitude)}, ${numericText(longitude)}` },
          { label: 'Qualifying', value: dateTime(asRecord(race.Qualifying).date, asRecord(race.Qualifying).time) ?? 'Not supplied' },
          { label: 'Sprint', value: dateTime(asRecord(race.Sprint).date, asRecord(race.Sprint).time) ?? 'Not scheduled' },
        ]}/>
        {href && <a className="domain-reference-link" href={href} target="_blank" rel="noreferrer" aria-label={`Open ${raceName} reference`}>Reference</a>}
      </li>
    })}</ol>
    <p className="domain-note">This route is a season catalogue, not standings or race results. Driver, constructor, and race datasets are separate provider shapes selected from the same Request Lab control.</p>
  </div>

}
