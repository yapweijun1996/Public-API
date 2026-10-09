import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('openf1-historical')
if (!api) throw new Error('Missing openf1-historical fixture')

const requestUrl = api.buildUrl({ season: '2025', round: '1' })
const executedGet: ExecutedRequestContext = { url: requestUrl, method: 'GET' }

const qualifyingResult = {
  number: '4',
  position: '1',
  Driver: {
    driverId: 'norris',
    code: 'NOR',
    givenName: 'Lando',
    familyName: 'Norris',
    nationality: 'British',
  },
  Constructor: {
    constructorId: 'mclaren',
    name: 'McLaren',
    nationality: 'British',
  },
  Q1: '1:15.912',
  Q2: '1:15.415',
  Q3: '1:15.096',
}

const response = (results: unknown[] = [qualifyingResult]) => ({
  MRData: {
    series: 'f1',
    limit: '30',
    offset: '0',
    total: String(results.length),
    RaceTable: {
      season: '2025',
      round: '1',
      Races: results.length === 0 ? [] : [{
        season: '2025',
        round: '1',
        raceName: 'Australian Grand Prix',
        Circuit: {
          circuitId: 'albert_park',
          circuitName: 'Albert Park Grand Prix Circuit',
          Location: { locality: 'Melbourne', country: 'Australia' },
        },
        QualifyingResults: results,
      }],
    },
  },
})

const card = () => screen.getByRole('region', { name: 'Jolpica F1 Qualifying' })
  .querySelector('[data-domain-card="jolpica-qualifying"]') as HTMLElement

describe('Jolpica qualifying semantic preview', () => {
  afterEach(cleanup)

  it('renders a request-bound qualifying classification from the documented Jolpica envelope', () => {
    render(<ResponseDemoPreview api={api} data={response()} requestUrl={requestUrl} executedRequest={executedGet}/>)

    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-request-bound', 'true')
    expect(card()).toHaveAttribute('data-request-contract', 'exact-jolpica-season-round-qualifying')
    expect(card()).toHaveAttribute('data-requested-season', '2025')
    expect(card()).toHaveAttribute('data-requested-round', '1')
    expect(card()).toHaveAttribute('data-provider-season', '2025')
    expect(card()).toHaveAttribute('data-provider-round', '1')
    expect(card()).toHaveAttribute('data-provider-result-count', '1')
    expect(card()).toHaveAttribute('data-valid-result-count', '1')
    expect(card()).toHaveAttribute('data-primary-driver-id', 'norris')
    expect(card()).toHaveTextContent('Australian Grand Prix')
    expect(card()).toHaveTextContent('Lando Norris')
    expect(card()).toHaveTextContent('1:15.096')
  })

  it('keeps a structurally valid qualifying result partial without executed transport evidence', () => {
    render(<ResponseDemoPreview api={api} data={response()} requestUrl={requestUrl}/>)

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(card()).toHaveTextContent('Lando Norris')
  })

  it.each([
    ['POST', { url: requestUrl, method: 'POST' }],
    ['GET with body', { url: requestUrl, method: 'GET', body: { unexpected: true } }],
    ['executed URL drift', { url: `${requestUrl}?limit=30`, method: 'GET' }],
  ])('fails closed for a canonical displayed URL paired with %s', (_label, executedRequest) => {
    render(<ResponseDemoPreview api={api} data={response()} requestUrl={requestUrl} executedRequest={executedRequest as ExecutedRequestContext}/>)

    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(card()).not.toHaveTextContent('Lando Norris')
  })

  it('rejects a response whose season and round do not acknowledge the executed request', () => {
    const mismatched = response()
    mismatched.MRData.RaceTable.season = '2024'
    mismatched.MRData.RaceTable.round = '2'
    mismatched.MRData.RaceTable.Races[0]!.season = '2024'
    mismatched.MRData.RaceTable.Races[0]!.round = '2'

    render(<ResponseDemoPreview api={api} data={mismatched} requestUrl={requestUrl} executedRequest={executedGet}/>)

    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-identity-match', 'false')
    expect(card()).not.toHaveTextContent('Lando Norris')
  })

  it('contains malformed qualifying rows and keeps only provider-owned driver identities', () => {
    render(<ResponseDemoPreview
      api={api}
      data={response([qualifyingResult, { position: '2', Driver: { givenName: 'Fabricated' } }])}
      requestUrl={requestUrl}
      executedRequest={executedGet}
    />)

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-provider-result-count', '2')
    expect(card()).toHaveAttribute('data-valid-result-count', '1')
    expect(card()).toHaveAttribute('data-invalid-result-count', '1')
    expect(card()).toHaveTextContent('Lando Norris')
    expect(card()).not.toHaveTextContent('Fabricated')
  })

  it.each([
    ['an unrelated ESPN event envelope', { events: [{ name: 'Injected Grand Prix', season: { year: 2026 }, competitions: [] }] }],
    ['an arbitrary session array', [{}]],
    ['numeric metadata that violates the documented string wire contract', (() => {
      const malformed = response()
      return { ...malformed, MRData: { ...malformed.MRData, total: 1 } }
    })()],
  ])('does not promote %s from HTTP success into Formula 1 facts', (_label, data) => {
    render(<ResponseDemoPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedGet}/>)

    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).not.toHaveTextContent('Injected Grand Prix')
    expect(card()).not.toHaveTextContent('Formula 1 session')
  })

  it('distinguishes a coherent request-bound zero-result response from schema failure', () => {
    render(<ResponseDemoPreview api={api} data={response([])} requestUrl={requestUrl} executedRequest={executedGet}/>)

    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveAttribute('data-request-bound', 'true')
    expect(card()).toHaveAttribute('data-provider-result-count', '0')
    expect(card()).toHaveTextContent('No qualifying classification returned')
  })
})
