import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const ISS_POSITION_URL = 'https://api.wheretheiss.at/v1/satellites/25544'

const api = apiCatalog.find((candidate) => candidate.id === 'where-the-iss-at')!
const request = (overrides: Partial<ExecutedRequestContext> = {}): ExecutedRequestContext => ({
  method: 'GET',
  url: ISS_POSITION_URL,
  ...overrides,
})
const response = (overrides: Record<string, unknown> = {}) => ({
  name: 'iss',
  id: 25544,
  latitude: 1.3521,
  longitude: 103.8198,
  altitude: 421.86,
  velocity: 27575.9,
  visibility: 'daylight',
  footprint: 4508.7,
  timestamp: 1789603200,
  daynum: 2461300.5,
  solar_lat: 2.05,
  solar_lon: 238.786,
  units: 'kilometers',
  ...overrides,
})

describe('WhereTheIssAtPreview', () => {
  afterEach(cleanup)

  it('renders the request-bound ISS identity, position, measurements, and observation time', async () => {
    render(<ResponseDemoPreview api={api} data={response()} executedRequest={request()}/>)
    const card = (await screen.findByText('International Space Station')).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-domain-card', 'iss-position')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-current-iss-position-get')
    expect(card).toHaveAttribute('data-norad-id', '25544')
    expect(card).toHaveAttribute('data-latitude', '1.3521')
    expect(card).toHaveAttribute('data-longitude', '103.8198')
    expect(card).toHaveAttribute('data-units', 'kilometers')
    expect(card).toHaveAttribute('data-visibility', 'daylight')
    expect(card).toHaveTextContent('NORAD ID25544')
    expect(card).toHaveTextContent('1.3521, 103.8198')
    expect(card).toHaveTextContent('421.86 km')
    expect(card).toHaveTextContent('27,575.9 km/h')
    expect(card).toHaveTextContent('Daylight')
    expect(card?.querySelector('time')).toHaveAttribute('dateTime', '2026-09-17T00:00:00.000Z')
  })

  it.each([
    ['missing request', undefined],
    ['query', request({ url: `${ISS_POSITION_URL}?units=miles` })],
    ['hash', request({ url: `${ISS_POSITION_URL}#position` })],
    ['credentials', request({ url: 'https://user:pass@api.wheretheiss.at/v1/satellites/25544' })],
    ['alternate port', request({ url: 'https://api.wheretheiss.at:444/v1/satellites/25544' })],
    ['trailing slash', request({ url: `${ISS_POSITION_URL}/` })],
    ['request body', request({ body: {} })],
    ['wrong method', request({ method: 'POST' })],
  ])('rejects %s as inexact executed-request evidence', async (_label, executedRequest) => {
    render(<ResponseDemoPreview api={api} data={response()} executedRequest={executedRequest}/>)
    const card = (await screen.findByText('ISS position evidence unavailable')).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it.each([
    ['wrong satellite name', { name: 'ISS' }],
    ['numeric-string NORAD id', { id: '25544' }],
    ['wrong native NORAD id', { id: 25545 }],
    ['numeric-string latitude', { latitude: '1.3521' }],
    ['out-of-range latitude', { latitude: -90.1 }],
    ['out-of-range longitude', { longitude: 180.1 }],
    ['zero altitude', { altitude: 0 }],
    ['negative altitude', { altitude: -1 }],
    ['numeric-string altitude', { altitude: '421.86' }],
    ['zero velocity', { velocity: 0 }],
    ['numeric-string velocity', { velocity: '27575.9' }],
    ['non-finite velocity', { velocity: Number.POSITIVE_INFINITY }],
    ['zero footprint', { footprint: 0 }],
    ['numeric-string footprint', { footprint: '4508.7' }],
    ['negative footprint', { footprint: -1 }],
    ['zero timestamp', { timestamp: 0 }],
    ['fractional timestamp', { timestamp: 1789603200.5 }],
    ['empty visibility', { visibility: '   ' }],
    ['non-text visibility', { visibility: 1 }],
    ['wrong units', { units: 'miles' }],
  ])('fails closed for %s', async (_label, overrides) => {
    render(<ResponseDemoPreview api={api} data={response(overrides)} executedRequest={request()}/>)
    const card = (await screen.findByText('ISS position evidence unavailable')).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('preserves a non-empty provider visibility value without inventing an undocumented enum', async () => {
    render(<ResponseDemoPreview api={api} data={response({ visibility: 'visible' })} executedRequest={request()}/>)
    const card = (await screen.findByText('International Space Station')).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-visibility', 'visible')
    expect(card).toHaveTextContent('Visible')
  })

  it('marks malformed supplemental orbital context partial without inventing values', async () => {
    render(<ResponseDemoPreview api={api} data={response({ daynum: undefined, solar_lat: 91, solar_lon: 361 })} executedRequest={request()}/>)
    const card = (await screen.findByText('International Space Station')).closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-supplemental-contract', 'false')
    expect(card).toHaveTextContent('Supplemental orbital context is unavailable')
    expect(card).toHaveTextContent('Footprint4,508.7 km')
    expect(card).toHaveTextContent('Day number—')
    expect(card).toHaveTextContent('Solar coordinates—')
  })
})
