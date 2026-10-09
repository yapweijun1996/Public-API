import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ExecutedRequestContext } from './useApiRequestRuntime'
import {
  DATA_GOV_TAXI_AVAILABILITY_URL,
  DataGovTaxiAvailabilityPreview,
  buildDataGovTaxiAvailabilityViewModel,
} from './previews/DataGovTaxiAvailabilityPreview'

const request = (overrides: Partial<ExecutedRequestContext> = {}): ExecutedRequestContext => ({
  method: 'GET',
  url: DATA_GOV_TAXI_AVAILABILITY_URL,
  ...overrides,
})

const response = (coordinates: unknown[] = [[103.8, 1.3], [103.81, 1.31]], overrides: Record<string, unknown> = {}) => ({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'MultiPoint', coordinates },
    properties: { timestamp: '2026-09-17T12:34:56+08:00', taxi_count: coordinates.length, api_info: { status: 'healthy' }, ...overrides },
  }],
})

describe('DataGovTaxiAvailabilityPreview', () => {
  afterEach(cleanup)

  it('renders a request-bound snapshot and preserves duplicate anonymous coordinates', () => {
    render(<DataGovTaxiAvailabilityPreview data={response([[103.8, 1.3], [103.8, 1.3], [103.81, 1.31]])} executedRequest={request()}/>)
    const card = screen.getByText('3 available taxis').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-taxi-count', '3')
    expect(card).toHaveAttribute('data-provider-coordinate-count', '3')
    expect(card).toHaveAttribute('data-valid-coordinate-count', '3')
    expect(card).toHaveAttribute('data-invalid-coordinate-count', '0')
    expect(within(card as HTMLElement).getAllByText('1.3, 103.8')).toHaveLength(2)
    expect(card).toHaveTextContent('data.gov.sg acquisition time')
    expect(card).toHaveTextContent('not a per-taxi observation time')
    expect(card).toHaveTextContent('not stable taxi identities')
  })

  it('uses empty only for a coherent native zero count and empty coordinate array', () => {
    render(<DataGovTaxiAvailabilityPreview data={response([])} executedRequest={request()}/>)
    const card = screen.getByText('0 available taxis').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-count-contract', 'true')
    expect(card).toHaveAttribute('data-coordinate-contract', 'true')
    expect(card).toHaveTextContent('No anonymous taxi positions')
  })

  it.each([
    ['missing request', undefined],
    ['query parameter', request({ url: `${DATA_GOV_TAXI_AVAILABILITY_URL}?date_time=2026-09-17T12%3A00%3A00Z` })],
    ['extra query key', request({ url: `${DATA_GOV_TAXI_AVAILABILITY_URL}?foo=bar` })],
    ['wrong method', request({ method: 'POST' })],
    ['request body', request({ body: {} })],
    ['wrong path', request({ url: 'https://api.data.gov.sg/v1/transport/taxi-availability/' })],
  ])('rejects %s as inexact executed-request evidence', (_label, executedRequest) => {
    expect(buildDataGovTaxiAvailabilityViewModel(response(), executedRequest)).toMatchObject({ state: 'invalid', requestBound: false })
  })

  it.each([
    ['non-object envelope', []],
    ['wrong collection type', { ...response(), type: 'Collection' }],
    ['more than one feature', { ...response(), features: [...response().features, ...response().features] }],
    ['wrong geometry', { ...response(), features: [{ ...response().features[0], geometry: { type: 'Point', coordinates: [103.8, 1.3] } }] }],
    ['numeric-string count', response([[103.8, 1.3]], { taxi_count: '1' })],
    ['count mismatch', response([[103.8, 1.3]], { taxi_count: 2 })],
    ['invalid timestamp', response([[103.8, 1.3]], { timestamp: '2026-02-30T12:34:56+08:00' })],
    ['all malformed coordinates despite healthy api_info', response([['103.8', '1.3']], { api_info: { status: 'healthy' } })],
  ])('fails closed for %s', (_label, data) => {
    expect(buildDataGovTaxiAvailabilityViewModel(data, request()).state).toBe('invalid')
  })

  it('marks a mixed coordinate batch partial and withholds malformed positions', () => {
    render(<DataGovTaxiAvailabilityPreview data={response([[103.8, 1.3], ['103.81', 1.31], [181, 1.32]])} executedRequest={request()}/>)
    const card = screen.getByText('3 available taxis').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-coordinate-contract', 'false')
    expect(card).toHaveAttribute('data-valid-coordinate-count', '1')
    expect(card).toHaveAttribute('data-invalid-coordinate-count', '2')
    expect(within(card as HTMLElement).getAllByText(/Anonymous position/)).toHaveLength(1)
    expect(card).toHaveTextContent('Malformed taxi positions were withheld')
  })

  it('requires exact two-item native finite coordinate pairs within WGS84 bounds', () => {
    for (const coordinate of [[103.8], [103.8, 1.3, 0], [Number.NaN, 1.3], [103.8, Number.POSITIVE_INFINITY], [-181, 1.3], [103.8, 91]]) {
      const model = buildDataGovTaxiAvailabilityViewModel(response([coordinate]), request())
      expect(model.state).toBe('invalid')
      expect(model.validCoordinateCount).toBe(0)
    }
  })
})
