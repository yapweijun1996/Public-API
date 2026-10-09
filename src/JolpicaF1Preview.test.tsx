import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'jolpica-f1')
if (!api) throw new Error('Missing jolpica-f1 fixture')

const wrap = (table: Record<string, unknown>, total = '1') => ({ MRData: { series: 'f1', limit: '8', offset: '0', total, ...table } })
const driverRequestUrl = api.buildUrl({ season: '2025', dataset: 'drivers', limit: '8' })
const constructorRequestUrl = api.buildUrl({ season: '2025', dataset: 'constructors', limit: '8' })
const raceRequestUrl = api.buildUrl({ season: '2025', dataset: 'races', limit: '8' })
const executedRequest = (url = driverRequestUrl, method = 'GET', body?: unknown): ExecutedRequestContext => ({ url, method, ...(body === undefined ? {} : { body }) })

describe('Jolpica Formula 1 season semantic preview', () => {
  afterEach(cleanup)

  it('preserves driver identity instead of generic early-property rows', () => {
    render(<ResponseDemoPreview api={api} requestUrl={driverRequestUrl} data={wrap({ DriverTable: { season: '2025', Drivers: [{ driverId: 'albon', permanentNumber: '23', code: 'ALB', givenName: 'Alexander', familyName: 'Albon', dateOfBirth: '1996-03-23', nationality: 'Thai' }] } }, '36')}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    expect(preview).toHaveAttribute('data-preview-layout', 'f1-season-catalog')
    const card = preview.querySelector('.jolpica-f1-preview')
    expect(card).toHaveAttribute('data-dataset', 'drivers')
    expect(card).toHaveAttribute('data-provider-total', '36')
    expect(preview).toHaveTextContent('Alexander Albon')
    expect(preview).toHaveTextContent('NationalityThai')
    expect(preview).not.toHaveTextContent('Jolpica F1 Data record 1')
  })

  it('preserves constructor identity and nationality', () => {
    render(<ResponseDemoPreview api={api} requestUrl={constructorRequestUrl} data={wrap({ ConstructorTable: { season: '2025', Constructors: [{ constructorId: 'ferrari', name: 'Ferrari', nationality: 'Italian' }] } }, '10')}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    expect(preview.querySelector('[data-constructor-id="ferrari"]')).toHaveAttribute('data-nationality', 'Italian')
    expect(preview).toHaveTextContent('Ferrari')
  })

  it('keeps race calendar timing, circuit and coordinates semantic', () => {
    render(<ResponseDemoPreview api={api} requestUrl={raceRequestUrl} data={wrap({ RaceTable: { season: '2025', Races: [{ season: '2025', round: '1', raceName: 'Australian Grand Prix', date: '2025-03-16', time: '04:00:00Z', Circuit: { circuitId: 'albert_park', circuitName: 'Albert Park Grand Prix Circuit', Location: { lat: '-37.8497', long: '144.968', locality: 'Melbourne', country: 'Australia' } }, Qualifying: { date: '2025-03-15', time: '05:00:00Z' } }] } }, '24')}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    const race = preview.querySelector('[data-round="1"]')
    expect(race).toHaveAttribute('data-race-start', '2025-03-16T04:00:00Z')
    expect(race).toHaveAttribute('data-circuit-id', 'albert_park')
    expect(preview).toHaveTextContent('Albert Park Grand Prix Circuit')
    expect(preview).toHaveTextContent('Coordinates-37.8497, 144.968')
    expect(preview).toHaveTextContent('season catalogue, not standings or race results')
  })

  it('fails closed when a documented Jolpica list is not an array', () => {
    render(<ResponseDemoPreview api={api} requestUrl={driverRequestUrl} data={wrap({ DriverTable: { season: '2025', Drivers: { driverId: 'albon' } } }, '1')}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
    expect(preview).toHaveTextContent('DriverTable without the documented Drivers array')
  })

  it('marks mixed driver records partial and hides identity-less rows', () => {
    render(<ResponseDemoPreview api={api} requestUrl={driverRequestUrl} data={wrap({ DriverTable: { season: '2025', Drivers: [
      { driverId: 'albon', code: 'ALB', givenName: 'Alexander', familyName: 'Albon', nationality: 'Thai' },
      { code: 'FAK', givenName: 'Fabricated', familyName: 'Driver' },
    ] } }, '36')}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    const card = preview.querySelector('.jolpica-f1-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).toHaveTextContent('Alexander Albon')
    expect(preview).not.toHaveTextContent('Fabricated Driver')
    expect(preview).not.toHaveTextContent('driver-2')
  })

  it('uses documented constructor name identity when constructorId is absent', () => {
    render(<ResponseDemoPreview api={api} requestUrl={constructorRequestUrl} executedRequest={executedRequest(constructorRequestUrl)} data={wrap({ ConstructorTable: { season: '2025', Constructors: [
      { name: 'Provider Named Constructor', nationality: 'British' },
    ] } }, '1')}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    const card = preview.querySelector('.jolpica-f1-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-primary-id', 'Provider Named Constructor')
    expect(preview).toHaveTextContent('Provider Named Constructor')
    expect(preview).not.toHaveTextContent('constructor-1')
  })

  it('omits malformed race records instead of inventing round or race identity', () => {
    render(<ResponseDemoPreview api={api} requestUrl={raceRequestUrl} data={wrap({ RaceTable: { season: '2025', Races: [
      { season: '2025', round: '1', raceName: 'Australian Grand Prix', Circuit: { circuitId: 'albert_park', circuitName: 'Albert Park Grand Prix Circuit', Location: {} } },
      { season: '2025', raceName: 'Fabricated Grand Prix', Circuit: {} },
    ] } }, '24')}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    const card = preview.querySelector('.jolpica-f1-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).toHaveTextContent('Australian Grand Prix')
    expect(preview).not.toHaveTextContent('Fabricated Grand Prix')
    expect(preview).not.toHaveTextContent('Round 2')
  })


  it('binds semantic readiness only to the exact executed bodyless GET request', () => {
    render(<ResponseDemoPreview api={api} requestUrl={driverRequestUrl} executedRequest={executedRequest()} data={wrap({ DriverTable: { season: '2025', Drivers: [{ driverId: 'albon', givenName: 'Alexander', familyName: 'Albon' }] } })}/>)
    const card = screen.getByRole('region', { name: 'Jolpica F1 Data' }).querySelector('.jolpica-f1-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-jolpica-season-catalog-v2')
    expect(card).toHaveAttribute('data-request-season', '2025')
    expect(card).toHaveAttribute('data-request-dataset', 'drivers')
    expect(card).toHaveAttribute('data-request-limit', '8')
    expect(card).toHaveAttribute('data-season-contract-valid', 'true')
    expect(card).toHaveAttribute('data-dataset-contract-valid', 'true')
    expect(card).toHaveAttribute('data-limit-contract-valid', 'true')
  })

  it('keeps coherent provider data partial when executed-request evidence is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={driverRequestUrl} data={wrap({ DriverTable: { season: '2025', Drivers: [{ driverId: 'albon', givenName: 'Alexander', familyName: 'Albon' }] } })}/>)
    const card = screen.getByRole('region', { name: 'Jolpica F1 Data' }).querySelector('.jolpica-f1-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it.each([
    ['POST transport', executedRequest(driverRequestUrl, 'POST')],
    ['GET with body', executedRequest(driverRequestUrl, 'GET', { unexpected: true })],
    ['executed URL drift', executedRequest(driverRequestUrl.replace('limit=8', 'limit=7'))],
  ])('fails closed for %s even when the displayed URL and provider payload look valid', (_label, request) => {
    render(<ResponseDemoPreview api={api} requestUrl={driverRequestUrl} executedRequest={request} data={wrap({ DriverTable: { season: '2025', Drivers: [{ driverId: 'albon', givenName: 'Alexander', familyName: 'Albon' }] } })}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
    expect(preview).not.toHaveTextContent('Alexander Albon')
  })

  it('fails closed when an HTTP-success table belongs to a different season', () => {
    render(<ResponseDemoPreview api={api} requestUrl={driverRequestUrl} data={wrap({ DriverTable: { season: '2024', Drivers: [{ driverId: 'verstappen', givenName: 'Max', familyName: 'Verstappen' }] } })}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
    expect(preview).not.toHaveTextContent('Max Verstappen')
  })

  it('fails closed when an HTTP-success payload belongs to a different dataset', () => {
    render(<ResponseDemoPreview api={api} requestUrl={driverRequestUrl} data={wrap({ RaceTable: { season: '2025', Races: [{ season: '2025', round: '1', raceName: 'Australian Grand Prix', Circuit: { circuitId: 'albert_park', circuitName: 'Albert Park Grand Prix Circuit' } }] } })}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
    expect(preview).not.toHaveTextContent('Australian Grand Prix')
  })

  it('marks race rows from the wrong season partial instead of trusting them', () => {
    render(<ResponseDemoPreview api={api} requestUrl={raceRequestUrl} data={wrap({ RaceTable: { season: '2025', Races: [
      { season: '2025', round: '1', raceName: 'Australian Grand Prix', Circuit: { circuitId: 'albert_park', circuitName: 'Albert Park Grand Prix Circuit', Location: {} } },
      { season: '2024', round: '2', raceName: 'Wrong Season Grand Prix', Circuit: { circuitId: 'wrong', circuitName: 'Wrong Circuit', Location: {} } },
    ] } }, '24')}/>)
    const preview = screen.getByRole('region', { name: 'Jolpica F1 Data' })
    const card = preview.querySelector('.jolpica-f1-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).not.toHaveTextContent('Wrong Season Grand Prix')
  })

})
