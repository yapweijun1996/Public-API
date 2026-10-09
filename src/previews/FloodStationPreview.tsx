import './stationList.css'
import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { asRecord, CardHeading, Facts, finite, numericText, rows, text } from './cardPrimitives'
import { isRecord, positiveInteger, trimmedText } from './semanticValidation'

type FloodStationRequest = { valid: true; riverName: string; limit: number; transportBound: boolean } | { valid: false }

type ParsedFloodStationRequest = { riverName: string; limit: number }

const parseRequestUrl = (requestUrl?: string): ParsedFloodStationRequest | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const riverName = url.searchParams.get('riverName')
    const limitText = url.searchParams.get('_limit')
    const keys = [...url.searchParams.keys()]
    if (
      url.protocol !== 'https:'
      || url.origin !== 'https://environment.data.gov.uk'
      || url.pathname !== '/flood-monitoring/id/stations'
      || url.username
      || url.password
      || url.hash
      || keys.length !== 2
      || url.searchParams.getAll('riverName').length !== 1
      || url.searchParams.getAll('_limit').length !== 1
      || keys.some((key) => key !== 'riverName' && key !== '_limit')
      || !riverName
      || riverName !== riverName.trim()
      || !limitText
      || !/^[1-9]\d*$/.test(limitText)
    ) return undefined
    const limit = Number(limitText)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) return undefined
    const canonical = `https://environment.data.gov.uk/flood-monitoring/id/stations?${new URLSearchParams({ riverName, _limit: String(limit) }).toString()}`
    return requestUrl === canonical ? { riverName, limit } : undefined
  } catch {
    return undefined
  }
}

const requestIdentity = (requestUrl?: string, executedRequest?: ExecutedRequestContext): FloodStationRequest | undefined => {
  if (!requestUrl) return undefined
  const displayed = parseRequestUrl(requestUrl)
  if (!displayed) return { valid: false }
  if (!executedRequest) return { valid: true, ...displayed, transportBound: false }
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || executedRequest.url !== requestUrl || !parseRequestUrl(executedRequest.url)) return { valid: false }
  return { valid: true, ...displayed, transportBound: true }
}

const requestAttributes = (request?: Extract<FloodStationRequest, { valid: true }>) => ({
  'data-request-bound': String(Boolean(request?.transportBound)),
  'data-requested-river': request?.riverName,
  'data-request-limit': request?.limit,
})

const statusLabel = (value: unknown) => {
  const raw = text(value)
  if (!raw) return 'Not supplied'
  const token = raw.split('/').filter(Boolean).at(-1) ?? raw
  return token.replace(/^status/i, '').replace(/([a-z])([A-Z])/g, '$1 $2') || raw
}

const coordinateLabel = (latitude: number | undefined, longitude: number | undefined) =>
  latitude === undefined || longitude === undefined ? 'Not supplied' : `${numericText(latitude)}, ${numericText(longitude)}`

const measureLabel = (value: Record<string, unknown>) => {
  const name = text(value.parameterName) ?? text(value.parameter) ?? 'Measurement'
  const qualifier = text(value.qualifier)
  const unit = text(value.unitName)
  const period = finite(value.period)
  return [name, qualifier, unit, period === undefined ? undefined : `${numericText(period)} s interval`].filter(Boolean).join(' · ')
}

const stationIdentity = (station: Record<string, unknown>) => {
  const label = text(station.label)
  const notation = text(station.notation)
  const stationReference = text(station.stationReference)
  return label && notation && stationReference ? { label, notation, stationReference } : undefined
}

export function FloodStationPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const request = requestIdentity(requestUrl, executedRequest)
  const boundRequest = request?.valid ? request : undefined
  const root = asRecord(data)
  const meta = isRecord(root.meta) ? root.meta : undefined
  const providerLimit = positiveInteger(meta?.limit)
  const metadataContract = providerLimit !== undefined && (!boundRequest || providerLimit === boundRequest.limit)
  const providerItems = Array.isArray(root.items) ? root.items : undefined

  const contractMessage = (
    state: 'invalid' | 'empty' | 'partial',
    title: string,
    detail: string,
    evidence: {
      providerRecordCount?: number
      validRecordCount?: number
      invalidRecordCount?: number
      filterMismatchCount?: number
      duplicateRecordCount?: number
      countContract?: boolean
      filterContract?: boolean
    } = {},
  ) => <div
    className="domain-card domain-empty"
    data-domain-card="flood-stations"
    data-result-state={state}
    data-provider-limit={providerLimit}
    data-metadata-contract={String(metadataContract)}
    data-provider-record-count={evidence.providerRecordCount}
    data-valid-record-count={evidence.validRecordCount}
    data-invalid-record-count={evidence.invalidRecordCount}
    data-filter-mismatch-count={evidence.filterMismatchCount}
    data-duplicate-record-count={evidence.duplicateRecordCount}
    data-count-contract={evidence.countContract === undefined ? undefined : String(evidence.countContract)}
    data-filter-contract={evidence.filterContract === undefined ? undefined : String(evidence.filterContract)}
    {...requestAttributes(boundRequest)}
  ><h3>{title}</h3><p>{detail}</p></div>

  if (request?.valid === false) {
    return contractMessage('invalid', 'Invalid monitoring-station request', 'This card only renders the canonical HTTPS Environment Agency station search with one exact riverName filter and one bounded _limit value.')
  }

  if (!providerItems) {
    return contractMessage('invalid', 'Invalid monitoring-station response', 'The Environment Agency response could not be interpreted because the documented station list was not an array.')
  }

  if (!metadataContract) {
    return contractMessage('invalid', 'Invalid monitoring-station metadata', 'The Environment Agency response did not provide a native integer metadata limit matching the executed station-list request.', {
      providerRecordCount: providerItems.length,
      validRecordCount: 0,
      invalidRecordCount: providerItems.length,
    })
  }

  const providerRecordCount = providerItems.length
  const countContract = Boolean(boundRequest) && providerRecordCount <= boundRequest!.limit
  if (providerRecordCount === 0) {
    if (!boundRequest?.transportBound || !countContract) {
      return contractMessage('partial', 'Unbound monitoring-station empty response', 'A zero-station response is only semantic empty when it is bound to the exact executed bodyless GET river-name request and provider limit metadata.', {
        providerRecordCount: 0,
        validRecordCount: 0,
        invalidRecordCount: 0,
        countContract,
        filterContract: false,
      })
    }
    return contractMessage('empty', 'No monitoring stations returned', `The Environment Agency returned no stations for the exact river-name filter “${boundRequest.riverName}”.`, {
      providerRecordCount: 0,
      validRecordCount: 0,
      invalidRecordCount: 0,
      countContract: true,
      filterContract: true,
    })
  }

  const stations: Array<{ station: Record<string, unknown>; identity: ReturnType<typeof stationIdentity> & {} }> = []
  const seen = new Set<string>()
  let invalidRecordCount = 0
  let filterMismatchCount = 0
  let duplicateRecordCount = 0
  for (const value of providerItems) {
    if (!isRecord(value)) {
      invalidRecordCount += 1
      continue
    }
    const identity = stationIdentity(value)
    if (!identity) {
      invalidRecordCount += 1
      continue
    }
    const identityKey = `${identity.notation}\u0000${identity.stationReference}`
    if (seen.has(identityKey)) {
      invalidRecordCount += 1
      duplicateRecordCount += 1
      continue
    }
    if (boundRequest && value.riverName !== boundRequest.riverName) {
      invalidRecordCount += 1
      filterMismatchCount += 1
      continue
    }
    seen.add(identityKey)
    stations.push({ station: value, identity })
  }

  const validRecordCount = stations.length
  const filterContract = Boolean(boundRequest) && filterMismatchCount === 0
  if (validRecordCount === 0) {
    return contractMessage('invalid', 'Invalid monitoring-station response', 'None of the returned rows established a unique Environment Agency station identity matching the exact executed river-name filter.', {
      providerRecordCount,
      validRecordCount: 0,
      invalidRecordCount,
      filterMismatchCount,
      duplicateRecordCount,
      countContract,
      filterContract,
    })
  }

  const first = stations[0]
  const resultState = boundRequest?.transportBound && countContract && filterContract && invalidRecordCount === 0 ? 'ready' : 'partial'

  return <div
    className="domain-card flood-stations-preview"
    data-domain-card="flood-stations"
    data-result-state={resultState}
    data-provider-limit={providerLimit}
    data-metadata-contract="true"
    data-station-count={validRecordCount}
    data-provider-record-count={providerRecordCount}
    data-valid-record-count={validRecordCount}
    data-invalid-record-count={invalidRecordCount}
    data-filter-mismatch-count={filterMismatchCount}
    data-duplicate-record-count={duplicateRecordCount}
    data-count-contract={String(countContract)}
    data-filter-contract={String(filterContract)}
    data-primary-station-reference={first.identity.stationReference}
    {...requestAttributes(boundRequest)}
  >
    <CardHeading
      eyebrow="Environment Agency · Real-time flood monitoring API"
      title={`${validRecordCount} monitoring station${validRecordCount === 1 ? '' : 's'}${boundRequest ? ` · ${boundRequest.riverName}` : ''}`}
      description="Station and available-measure metadata from the provider response. Live readings and flood warnings are separate API resources."
    >
      <span className="domain-state">{resultState === 'partial' ? 'Partially verified station metadata' : 'Request-bound station metadata'}</span>
    </CardHeading>

    {resultState === 'partial' && <p className="domain-note">
      {!boundRequest?.transportBound ? 'Executed-request identity is unavailable, so this provider batch cannot be marked ready. ' : ''}
      {!countContract ? 'The returned row count exceeds the executed request limit. ' : ''}
      {filterMismatchCount > 0 ? `${filterMismatchCount} station row${filterMismatchCount === 1 ? '' : 's'} contradicted the exact river-name filter and ${filterMismatchCount === 1 ? 'was' : 'were'} withheld. ` : ''}
      {duplicateRecordCount > 0 ? `${duplicateRecordCount} duplicate station row${duplicateRecordCount === 1 ? '' : 's'} ${duplicateRecordCount === 1 ? 'was' : 'were'} withheld. ` : ''}
      {invalidRecordCount - filterMismatchCount - duplicateRecordCount > 0 ? `${invalidRecordCount - filterMismatchCount - duplicateRecordCount} provider row${invalidRecordCount - filterMismatchCount - duplicateRecordCount === 1 ? '' : 's'} ${invalidRecordCount - filterMismatchCount - duplicateRecordCount === 1 ? 'was' : 'were'} omitted because the documented station identity was incomplete.` : ''}
    </p>}

    <ol className="flood-station-list" aria-label="Environment Agency monitoring stations">
      {stations.map(({ station, identity }, index) => {
        const river = trimmedText(station.riverName)
        const latitude = finite(station.lat)
        const longitude = finite(station.long)
        const status = statusLabel(station.status)
        const measures = rows(station.measures)
        return <li
          key={`${identity.stationReference}-${identity.notation}-${index}`}
          data-station-index={index + 1}
          data-station-reference={identity.stationReference}
          data-station-notation={identity.notation}
          data-river-name={river}
          data-station-status={status}
          data-latitude={latitude}
          data-longitude={longitude}
          data-measure-count={measures.length}
        >
          <header>
            <div><small>{river ?? 'River not supplied'}</small><h4>{identity.label}</h4></div>
            <span>{status}</span>
          </header>
          <Facts items={[
            { label: 'Station reference', value: identity.stationReference },
            { label: 'Town', value: text(station.town) ?? 'Not supplied' },
            { label: 'Catchment', value: text(station.catchmentName) ?? 'Not supplied' },
            { label: 'Coordinates (WGS84)', value: coordinateLabel(latitude, longitude) },
          ]}/>
          <section className="flood-measures" aria-label={`${identity.label} available measures`}>
            <h4>Available measures</h4>
            {measures.length
              ? <ul>{measures.map((measure, measureIndex) => <li key={text(measure['@id']) ?? `${identity.stationReference}-measure-${measureIndex}`}>{measureLabel(measure)}</li>)}</ul>
              : <p>No measure metadata was supplied for this station.</p>}
          </section>
        </li>
      })}
    </ol>

    <p className="domain-note">The provider documents <code>riverName</code> as an exact-match filter and list metadata echoes the applied limit. This card therefore binds the exact executed filter and provider limit before treating station metadata as ready; current readings and flood warnings remain separate API resources.</p>
  </div>
}
