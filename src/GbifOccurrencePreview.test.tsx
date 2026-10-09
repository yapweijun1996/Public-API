import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { apiCatalog, type ApiDemo } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'gbif-occurrence-search') as ApiDemo
const request = (url = api.buildUrl({ scientificName: 'Panthera leo', limit: '2' })) => ({ url, method: 'GET' as const })
const row = (overrides: Record<string, unknown> = {}) => ({
  key: 5938104699,
  scientificName: 'Panthera leo melanochaita (C.E.H.Smith, 1858)',
  species: 'Panthera leo',
  decimalLatitude: -24.907649,
  decimalLongitude: 31.462346,
  locality: 'Kruger National Park',
  eventDate: '2026-01-01T09:15:50',
  basisOfRecord: 'HUMAN_OBSERVATION',
  occurrenceStatus: 'PRESENT',
  ...overrides,
})
const response = (results: unknown[], overrides: Record<string, unknown> = {}) => ({
  offset: 0,
  limit: 2,
  endOfRecords: results.length < 2,
  count: results.length,
  results,
  ...overrides,
})
const card = () => screen.getByRole('region', { name: api.name }).querySelector('[data-domain-card="gbif-occurrence-map"]')

const renderResult = (data: unknown, executed = request()) => render(<ResponseDemoPreview api={api} executedRequest={executed} data={data}/>)

describe('GBIF occurrence request-bound map semantics', () => {
  afterEach(cleanup)

  it('binds native-coordinate occurrence rows to the exact executed search', async () => {
    expect(new URL(api.buildUrl({ scientificName: 'Panthera leo', limit: '2' })).searchParams.get('hasCoordinate')).toBe('true')
    renderResult(response([row(), row({ key: 5938252120, decimalLatitude: -32.35723, decimalLongitude: 25.563539 })], { count: 16802, endOfRecords: false }))
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-request-bound', 'true')
    expect(card()).toHaveAttribute('data-requested-scientific-name', 'Panthera leo')
    expect(card()).toHaveAttribute('data-requested-limit', '2')
    expect(card()).toHaveAttribute('data-provider-count', '16802')
    expect(card()).toHaveAttribute('data-valid-record-count', '2')
    expect(card()).toHaveAttribute('data-coordinate-contract', 'true')
    expect(within(card() as HTMLElement).getByRole('img', { name: /Map with 2 validated GBIF occurrence locations/ })).toBeInTheDocument()
  })

  it('withholds numeric-string or missing coordinates instead of manufacturing zero', async () => {
    renderResult(response([
      row(),
      row({ key: 2, decimalLatitude: '0', decimalLongitude: 36.8 }),
      row({ key: 3, decimalLatitude: undefined, decimalLongitude: 36.8 }),
    ], { limit: 3, count: 3, endOfRecords: true }), request(api.buildUrl({ scientificName: 'Panthera leo', limit: '3' })))
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-valid-record-count', '1')
    expect(card()).toHaveAttribute('data-invalid-record-count', '2')
    expect(within(card() as HTMLElement).getByRole('img', { name: /Map with 1 validated GBIF occurrence location/ })).toBeInTheDocument()
  })

  it('preserves a genuine zero/zero coordinate as provider evidence', async () => {
    renderResult(response([row({ decimalLatitude: 0, decimalLongitude: 0 })], { limit: 1, count: 1, endOfRecords: true }), request(api.buildUrl({ scientificName: 'Panthera leo', limit: '1' })))
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-primary-latitude', '0')
    expect(card()).toHaveAttribute('data-primary-longitude', '0')
  })

  it('fails closed on unsupported request expansion or incoherent pagination', async () => {
    const expanded = `${api.buildUrl({ scientificName: 'Panthera leo', limit: '2' })}&offset=2`
    renderResult(response([row(), row({ key: 2 })], { count: 20, endOfRecords: false }), request(expanded))
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    cleanup()
    renderResult(response([row()], { count: 20, endOfRecords: false }))
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('marks duplicate occurrence keys partial and keeps only unique trusted records', async () => {
    renderResult(response([row(), row({ decimalLatitude: -20 })], { count: 2, endOfRecords: true }))
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-valid-record-count', '1')
    expect(card()).toHaveAttribute('data-invalid-record-count', '1')
  })

  it('renders a coherent zero-result page as empty', async () => {
    renderResult(response([], { count: 0, endOfRecords: true }))
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveTextContent('No mapped GBIF occurrences')
  })
})
