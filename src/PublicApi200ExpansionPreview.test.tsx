import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OpenMeteoSeasonalPreview } from './previews/OpenMeteoSeasonalPreview'
import { NhtsaSafetyRatingsPreview } from './previews/NhtsaSafetyRatingsPreview'
import { SingStatCpiPreview } from './previews/SingStatCpiPreview'
import { OpenAlexWorksPreview } from './previews/OpenAlexWorksPreview'
import { OecdCliPreview } from './previews/OecdCliPreview'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const seasonalUrl = 'https://seasonal-api.open-meteo.com/v1/seasonal?latitude=1.3521&longitude=103.8198&weekly=temperature_2m_mean%2Ctemperature_2m_anomaly%2Cprecipitation_mean%2Cprecipitation_anomaly&forecast_days=42&timezone=Asia%2FSingapore'
const seasonalApi = apiCatalog.find((candidate) => candidate.id === 'open-meteo-seasonal')
if (!seasonalApi) throw new Error('Missing Open-Meteo Seasonal API fixture')
const seasonalGet = { url: seasonalUrl, method: 'GET' } as const
const nhtsaUrl = 'https://api.nhtsa.gov/SafetyRatings/VehicleId/19426?format=json'
const nhtsaRequest = { method: 'GET', url: nhtsaUrl } as const
const singstatUrl = 'https://tablebuilder.singstat.gov.sg/api/table/tabledata/M213752?seriesNoORrowNo=1&limit=12&sortBy=key+desc'
const singstatRequest = { method: 'GET', url: singstatUrl } as const
const singstatApi = apiCatalog.find((candidate) => candidate.id === 'singstat-cpi-monthly')
if (!singstatApi) throw new Error('Missing SingStat CPI API fixture')
const openAlexUrl = 'https://api.openalex.org/works?search=artificial+intelligence&per_page=8&select=id%2Ctitle%2Cpublication_year%2Ccited_by_count%2Cdoi%2Cauthorships%2Copen_access'
const openAlexRequest = { method: 'GET', url: openAlexUrl } as const
const oecdUrl = 'https://sdmx.oecd.org/public/rest/v1/data/OECD.SDD.STES,DSD_STES@DF_CLI/USA.M.LI...AA...H?startPeriod=2025-01&dimensionAtObservation=AllDimensions&format=jsondata'
const oecdRequest = { method: 'GET', url: oecdUrl } as const
const oecdApi = apiCatalog.find((candidate) => candidate.id === 'oecd-cli')
if (!oecdApi) throw new Error('Missing OECD CLI API fixture')

const seasonal = {
  timezone: 'Asia/Singapore',
  weekly_units: { time: 'iso8601', temperature_2m_mean: '°C', temperature_2m_anomaly: 'K', precipitation_mean: 'mm', precipitation_anomaly: 'mm' },
  weekly: {
    time: ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'],
    temperature_2m_mean: [28.2, 28.1, 28.0, 27.9, 28.1, 28.2, 28.3],
    temperature_2m_anomaly: [0.4, -0.1, 0.2, 0.1, 0.3, 0.2, 0.5],
    precipitation_mean: [6.2, 8.1, 7.0, 6.8, 7.3, 8.0, 7.5],
    precipitation_anomaly: [1.2, -0.5, 0.4, -0.2, 0.6, 0.3, 0.7],
  },
}
const rating = {
  Count: 1,
  Results: [{ VehicleId: 19426, VehicleDescription: '2024 Toyota CAMRY 4 DR FWD', ModelYear: 2024, Make: 'TOYOTA', Model: 'CAMRY', OverallRating: '5', OverallFrontCrashRating: '5', OverallSideCrashRating: '5', RolloverRating: '5', RolloverPossibility: 0.099, ComplaintsCount: 49, RecallsCount: 1, InvestigationCount: 0, NHTSAElectronicStabilityControl: 'Standard' }],
}
const singstat = {
  StatusCode: 200, DataCount: 1,
  Data: { id: 'M213752', title: 'Consumer Price Index (CPI), 2024 As Base Year, Monthly, Seasonally Adjusted', frequency: 'Monthly', datasource: 'SINGAPORE DEPARTMENT OF STATISTICS', dataLastUpdated: '24/08/2026', limit: '12', sortBy: 'key desc', row: [{ seriesNo: '1', rowText: 'All Items', uoM: 'Index', columns: [{ key: '2026 Jul', value: '102.997' }, { key: '2026 Jun', value: '102.689' }] }] },
}
const openalex = {
  meta: { count: 1, page: 1, per_page: 8 },
  results: [{ id: 'https://openalex.org/W2122410182', title: 'Artificial intelligence: a modern approach', publication_year: 1995, cited_by_count: 22259, doi: 'https://doi.org/10.5860/choice.33-1577', authorships: [{ author: { display_name: 'Dr. Anil Kumar' } }], open_access: { is_oa: true, oa_status: 'green' } }],
}
const dim = (id: string, value: string, name = value) => ({ id, values: [{ id: value, name }] })
const oecd = {
  errors: [],
  data: {
    structure: { dimensions: { dataset: [], series: [], observation: [dim('REF_AREA', 'USA', 'United States'), dim('FREQ', 'M', 'Monthly'), dim('MEASURE', 'LI'), dim('UNIT_MEASURE', 'IX'), dim('ACTIVITY', '_Z'), dim('ADJUSTMENT', 'AA'), dim('TRANSFORMATION', 'IX'), dim('TIME_HORIZ', '_Z'), dim('METHODOLOGY', 'H'), { id: 'TIME_PERIOD', values: [{ id: '2026-07', name: '2026-07' }, { id: '2026-08', name: '2026-08' }] }] } },
    dataSets: [{ observations: { '0:0:0:0:0:0:0:0:0:0': [100.8], '0:0:0:0:0:0:0:0:0:1': [100.9] } }],
  },
}

describe('Public-API 195→200 expansion semantic previews', () => {
  it('renders a request-bound seasonal anomaly outlook and fails closed on malformed values', () => {
    const { container, rerender } = render(<OpenMeteoSeasonalPreview data={seasonal} requestUrl={seasonalUrl} executedRequest={seasonalGet}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'ready')
    expect(container.firstElementChild).toHaveAttribute('data-request-forecast-days', '42')
    expect(container.firstElementChild).toHaveAttribute('data-provider-period-count', '7')
    expect(container.firstElementChild).toHaveAttribute('data-weekly-cadence-contract', 'true')
    expect(container.firstElementChild).toHaveAttribute('data-horizon-count-contract', 'true')
    expect(screen.getAllByText('28.2 °C').length).toBeGreaterThan(0)
    rerender(<OpenMeteoSeasonalPreview data={{ ...seasonal, weekly: { ...seasonal.weekly, temperature_2m_mean: ['28.2', ...seasonal.weekly.temperature_2m_mean.slice(1)] } }} requestUrl={seasonalUrl} executedRequest={seasonalGet}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'partial')
  })

  it('keeps an incomplete calendar-boundary seasonal bucket visible as partial evidence without fabricating measurements', () => {
    const boundaryPartial = {
      ...seasonal,
      weekly: {
        ...seasonal.weekly,
        temperature_2m_mean: [...seasonal.weekly.temperature_2m_mean.slice(0, -1), null],
        temperature_2m_anomaly: [...seasonal.weekly.temperature_2m_anomaly.slice(0, -1), null],
        precipitation_mean: [...seasonal.weekly.precipitation_mean.slice(0, -1), null],
        precipitation_anomaly: [...seasonal.weekly.precipitation_anomaly.slice(0, -1), null],
      },
    }
    const { container } = render(<OpenMeteoSeasonalPreview data={boundaryPartial} requestUrl={seasonalUrl} executedRequest={seasonalGet}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'partial')
    expect(container.firstElementChild).toHaveAttribute('data-provider-period-count', '7')
    expect(container.firstElementChild).toHaveAttribute('data-valid-period-count', '6')
    expect(container.firstElementChild).toHaveAttribute('data-invalid-period-count', '1')
    expect(container).not.toHaveTextContent('Week of 2026-10-19')
    expect(container).toHaveTextContent('Only validated seasonal buckets are shown')
  })

  it('fails closed when the displayed seasonal URL disagrees with the actual executed transport', () => {
    const invalidRequests = [
      { url: seasonalUrl, method: 'POST' },
      { url: seasonalUrl, method: 'GET', body: { unexpected: true } },
      { url: `${seasonalUrl}&extra=1`, method: 'GET' },
    ]
    const { container, rerender } = render(<ResponseDemoPreview api={seasonalApi} data={seasonal} requestUrl={seasonalUrl} executedRequest={invalidRequests[0]}/>)

    for (const executedRequest of invalidRequests) {
      rerender(<ResponseDemoPreview api={seasonalApi} data={seasonal} requestUrl={seasonalUrl} executedRequest={executedRequest}/>)
      expect(container.querySelector('[data-domain-card="seasonal-outlook"]')).toHaveAttribute('data-result-state', 'invalid')
      expect(container.querySelector('[data-domain-card="seasonal-outlook"]')).toHaveAttribute('data-request-bound', 'false')
      expect(container).not.toHaveTextContent('28.2 °C')
    }
  })

  it('keeps a structurally valid seasonal payload partial when execution evidence is missing', () => {
    const { container } = render(<OpenMeteoSeasonalPreview data={seasonal} requestUrl={seasonalUrl}/>)

    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'partial')
    expect(container.firstElementChild).toHaveAttribute('data-request-bound', 'false')
  })

  it('treats weekly buckets as calendar-aligned horizon output instead of pretending bucket count equals requested weeks', () => {
    const brokenCadence = structuredClone(seasonal)
    brokenCadence.weekly.time[3] = '2026-09-29'
    const { container } = render(<OpenMeteoSeasonalPreview data={brokenCadence} requestUrl={seasonalUrl} executedRequest={seasonalGet}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'partial')
    expect(container.firstElementChild).toHaveAttribute('data-request-forecast-days', '42')
    expect(container.firstElementChild).toHaveAttribute('data-weekly-cadence-contract', 'false')
    expect(container.firstElementChild).toHaveAttribute('data-minimum-expected-buckets', '6')
    expect(container.firstElementChild).toHaveAttribute('data-maximum-expected-buckets', '7')
  })

  it('preserves NHTSA VehicleId identity, valid ratings, and zero-result semantics', () => {
    const { container, rerender } = render(<NhtsaSafetyRatingsPreview data={rating} executedRequest={nhtsaRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'ready')
    expect(container.firstElementChild).toHaveAttribute('data-request-bound', 'true')
    expect(container.firstElementChild).toHaveAttribute('data-overall-score-meaning', 'relative-injury-risk')
    expect(container.firstElementChild).toHaveAttribute('data-overall-frontal-comparison-scope', 'same-class-plus-minus-250lb')
    expect(container.firstElementChild).toHaveAttribute('data-side-rollover-comparison-scope', 'cross-class')
    expect(container.firstElementChild).toHaveAttribute('data-comparison-validation', 'unavailable-from-this-response')
    expect(screen.getByText(/Overall Vehicle Score · 5\/5 stars/)).toBeInTheDocument()
    expect(screen.getByText('Overall frontal crash')).toBeInTheDocument()
    expect(screen.getByText('Overall side crash')).toBeInTheDocument()
    expect(screen.getByText(/only comparable within the same vehicle class and ±250 lb/)).toBeInTheDocument()
    rerender(<NhtsaSafetyRatingsPreview data={{ ...rating, Results: [{ ...rating.Results[0], VehicleId: 99999 }] }} executedRequest={nhtsaRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'invalid')
    rerender(<NhtsaSafetyRatingsPreview data={{ Count: 0, Results: [] }} executedRequest={nhtsaRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'empty')
    expect(container.firstElementChild).toHaveAttribute('data-request-bound', 'true')
  })

  it('rejects duplicate, extra, alternate-port, and noncanonical NHTSA request identities', () => {
    const invalidRequests = [
      `${nhtsaUrl}&format=json`,
      `${nhtsaUrl}&format=xml`,
      `${nhtsaUrl}&foo=bar`,
      nhtsaUrl.replace('https://api.nhtsa.gov', 'https://api.nhtsa.gov:444'),
      nhtsaUrl.replace('/19426?', '/019426?'),
      nhtsaUrl.replace('/19426?', '/19426/?'),
    ]
    const { container, rerender } = render(<NhtsaSafetyRatingsPreview data={rating} executedRequest={{ method: 'GET', url: invalidRequests[0] }}/>)
    for (const requestUrl of invalidRequests) {
      rerender(<NhtsaSafetyRatingsPreview data={rating} executedRequest={{ method: 'GET', url: requestUrl }}/>)
      expect(container.firstElementChild).toHaveAttribute('data-result-state', 'invalid')
    }
    rerender(<NhtsaSafetyRatingsPreview data={rating} executedRequest={{ method: 'POST', url: nhtsaUrl }}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'invalid')
    rerender(<NhtsaSafetyRatingsPreview data={rating} executedRequest={{ method: 'GET', url: nhtsaUrl, body: { hidden: true } }}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'invalid')
  })

  it('maps the official SingStat All Items series and hides malformed provider values', () => {
    const { container, rerender } = render(<SingStatCpiPreview data={singstat} requestUrl={singstatUrl} executedRequest={singstatRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'ready')
    expect(screen.getAllByText('102.997').length).toBeGreaterThan(0)
    rerender(<SingStatCpiPreview data={{ ...singstat, Data: { ...singstat.Data, row: [{ ...singstat.Data.row[0], columns: [...singstat.Data.row[0].columns, { key: '2026 May', value: 'not-a-number' }] }] } }} requestUrl={singstatUrl} executedRequest={singstatRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'partial')
  })

  it('binds SingStat readiness to the exact executed bodyless GET transport', () => {
    const { container, rerender } = render(<SingStatCpiPreview data={singstat} requestUrl={singstatUrl}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'partial')
    expect(container.firstElementChild).toHaveAttribute('data-request-bound', 'false')

    for (const executedRequest of [
      { method: 'POST', url: singstatUrl },
      { method: 'GET', url: singstatUrl, body: { hidden: true } },
      { method: 'GET', url: `${singstatUrl}&limit=12` },
    ]) {
      rerender(<ResponseDemoPreview api={singstatApi} data={singstat} requestUrl={singstatUrl} executedRequest={executedRequest}/>)
      const card = container.querySelector('[data-domain-card="singapore-cpi"]')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
    }
  })

  it('fails SingStat latest-12 semantics closed when the provider does not acknowledge the bounded descending request', () => {
    const stale = structuredClone(singstat)
    stale.Data.limit = '5000'
    stale.Data.sortBy = null as unknown as string
    stale.Data.row[0].columns = [{ key: '1961 Jan', value: '20.823' }, { key: '1961 Feb', value: '20.827' }]
    const { container } = render(<SingStatCpiPreview data={stale} requestUrl={singstatUrl} executedRequest={singstatRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText('20.823')).not.toBeInTheDocument()
  })

  it('renders OpenAlex work identity from the exact current search/per_page request and fails closed when identity disappears', () => {
    const { container, rerender } = render(<OpenAlexWorksPreview data={openalex} executedRequest={openAlexRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'ready')
    expect(container.firstElementChild).toHaveAttribute('data-request-bound', 'true')
    expect(container.firstElementChild).toHaveAttribute('data-search-query', 'artificial intelligence')
    expect(container.firstElementChild).toHaveAttribute('data-request-limit', '8')
    expect(screen.getByText('22,259 citations')).toBeInTheDocument()
    rerender(<OpenAlexWorksPreview data={{ ...openalex, results: [{ ...openalex.results[0], id: 'fabricated' }] }} executedRequest={openAlexRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'invalid')
    rerender(<OpenAlexWorksPreview data={{ meta: { count: 0, page: 1, per_page: 8 }, results: [] }} executedRequest={openAlexRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'empty')
    expect(container.firstElementChild).toHaveAttribute('data-request-bound', 'true')
  })

  it('rejects duplicate, extra, legacy-alias, noncanonical, and non-GET OpenAlex request identities', () => {
    const invalidRequests = [
      `${openAlexUrl}&search=climate`,
      openAlexUrl.replace('per_page=8', 'per_page=8&per_page=1'),
      `${openAlexUrl}&foo=bar`,
      openAlexUrl.replace('per_page=8', 'per-page=8'),
      openAlexUrl.replace('per_page=8', 'per_page=08'),
      openAlexUrl.replace('https://api.openalex.org', 'https://api.openalex.org:444'),
    ]
    const { container, rerender } = render(<OpenAlexWorksPreview data={openalex} executedRequest={{ method: 'GET', url: invalidRequests[0] }}/>)
    for (const url of invalidRequests) {
      rerender(<OpenAlexWorksPreview data={openalex} executedRequest={{ method: 'GET', url }}/>)
      expect(container.firstElementChild).toHaveAttribute('data-result-state', 'invalid')
    }
    rerender(<OpenAlexWorksPreview data={openalex} executedRequest={{ method: 'POST', url: openAlexUrl }}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'invalid')
    rerender(<OpenAlexWorksPreview data={openalex} executedRequest={{ method: 'GET', url: openAlexUrl, body: { hidden: true } }}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds duplicate OpenAlex work identities instead of presenting them twice', () => {
    const second = { ...openalex.results[0], id: 'https://openalex.org/W999', title: 'A second trusted work', cited_by_count: 10 }
    const duplicate = { ...openalex.results[0], title: 'Fabricated duplicate title' }
    const { container } = render(<OpenAlexWorksPreview data={{ meta: { count: 3, page: 1, per_page: 8 }, results: [openalex.results[0], duplicate, second] }} executedRequest={openAlexRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'partial')
    expect(container.firstElementChild).toHaveAttribute('data-provider-result-count', '3')
    expect(container.firstElementChild).toHaveAttribute('data-valid-result-count', '2')
    expect(container.firstElementChild).toHaveAttribute('data-duplicate-result-count', '1')
    expect(screen.queryByText('Fabricated duplicate title')).not.toBeInTheDocument()
    expect(screen.getByText('A second trusted work')).toBeInTheDocument()
  })

  it('maps OECD SDMX observation dimensions to the requested reference area', () => {
    const { container, rerender } = render(<OecdCliPreview data={oecd} requestUrl={oecdUrl} executedRequest={oecdRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'ready')
    expect(container.firstElementChild).toHaveAttribute('data-requested-start-period', '2025-01')
    expect(container.firstElementChild).toHaveAttribute('data-start-period-contract', 'true')
    expect(screen.getAllByText('100.90').length).toBeGreaterThan(0)
    const wrong = structuredClone(oecd); wrong.data.structure.dimensions.observation[0] = dim('REF_AREA', 'JPN', 'Japan')
    rerender(<OecdCliPreview data={wrong} requestUrl={oecdUrl} executedRequest={oecdRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'invalid')
  })

  it('binds OECD readiness to the exact executed bodyless GET transport', () => {
    const { container, rerender } = render(<OecdCliPreview data={oecd} requestUrl={oecdUrl}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'partial')
    expect(container.firstElementChild).toHaveAttribute('data-request-bound', 'false')

    for (const executedRequest of [
      { method: 'POST', url: oecdUrl },
      { method: 'GET', url: oecdUrl, body: { hidden: true } },
      { method: 'GET', url: `${oecdUrl}&format=jsondata` },
    ]) {
      rerender(<ResponseDemoPreview api={oecdApi} data={oecd} requestUrl={oecdUrl} executedRequest={executedRequest}/>)
      const card = container.querySelector('[data-domain-card="leading-indicator"]')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
    }
  })

  it('fails OECD startPeriod semantics closed when an HTTP-success response includes pre-start observations', () => {
    const outOfRange = structuredClone(oecd)
    outOfRange.data.structure.dimensions.observation[9].values[0] = { id: '2024-12', name: '2024-12' }
    outOfRange.data.dataSets[0].observations['0:0:0:0:0:0:0:0:0:0'] = [999.99]
    const { container } = render(<OecdCliPreview data={outOfRange} requestUrl={oecdUrl} executedRequest={oecdRequest}/>)
    expect(container.firstElementChild).toHaveAttribute('data-result-state', 'partial')
    expect(container.firstElementChild).toHaveAttribute('data-requested-start-period', '2025-01')
    expect(container.firstElementChild).toHaveAttribute('data-start-period-contract', 'false')
    expect(container.firstElementChild).toHaveAttribute('data-invalid-observation-count', '1')
    expect(screen.queryByText('999.99')).not.toBeInTheDocument()
    expect(screen.getAllByText('100.90').length).toBeGreaterThan(0)
  })
})
