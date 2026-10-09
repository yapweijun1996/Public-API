import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'usgs-water-legacy')
if (!api) throw new Error('Missing usgs-water-legacy fixture')
const requestUrl = api.buildUrl({ site: '01646500', parameter: '00060' })
const executedGet = { url: requestUrl, method: 'GET' }
const validObservation = {
  type: 'FeatureCollection',
  numberReturned: 1,
  features: [{
    type: 'Feature',
    properties: {
      time_series_id: 'series-1', monitoring_location_id: 'USGS-01646500', parameter_code: '00060', statistic_id: '00011',
      time: '2026-09-08T02:50:00+00:00', value: '1940', unit_of_measure: 'ft^3/s', approval_status: 'Provisional', qualifier: null,
    },
    geometry: { type: 'Point', coordinates: [-77.1276388889, 38.9497777778] },
  }],
}

describe('USGS Water Data V1 semantic preview', () => {
  afterEach(cleanup)

  it('preserves the selected measurement, provider identity, status, time and coordinates', () => {
    render(<ResponseDemoPreview api={api} data={validObservation} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const preview = screen.getByRole('region', { name: 'USGS Water Data V1' })
    expect(preview).toHaveAttribute('data-preview-layout', 'water-gauge')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')
    const card = preview.querySelector('.usgs-water-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-monitoring-location-id', 'USGS-01646500')
    expect(card).toHaveAttribute('data-requested-parameter-code', '00060')
    expect(card).toHaveAttribute('data-monitoring-location-id', 'USGS-01646500')
    expect(card).toHaveAttribute('data-parameter-code', '00060')
    expect(card).toHaveAttribute('data-time-series-id', 'series-1')
    expect(card).toHaveAttribute('data-statistic-id', '00011')
    expect(card).toHaveAttribute('data-primary-value', '1940')
    expect(card).toHaveAttribute('data-unit-of-measure', 'ft^3/s')
    expect(card).toHaveAttribute('data-approval-status', 'Provisional')
    expect(within(preview).getByRole('heading', { name: '1,940 ft^3/s streamflow / discharge' })).toBeInTheDocument()
    expect(preview).toHaveTextContent('Streamflow / discharge (00060)')
    expect(preview).toHaveTextContent('series-1')
    expect(preview).toHaveTextContent('00011')
    expect(preview).toHaveTextContent('2026-09-08T02:50:00+00:00')
    expect(preview).toHaveTextContent('Provisional')
    expect(preview).toHaveTextContent('38.9497777778, -77.1276388889')
  })

  it('treats a documented empty features array as semantic empty', () => {
    render(<ResponseDemoPreview api={api} data={{ type: 'FeatureCollection', numberReturned: 0, features: [] }} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const preview = screen.getByRole('region', { name: 'USGS Water Data V1' })
    expect(preview.querySelector('[data-domain-card="water-gauge"]')).toHaveAttribute('data-result-state', 'empty')
  })

  it('fails closed when the HTTP-success envelope is malformed', () => {
    render(<ResponseDemoPreview api={api} data={{ unexpected: [] }} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'USGS Water Data V1' })
    expect(preview.querySelector('[data-domain-card="water-gauge"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('documented FeatureCollection features array')
  })

  it('fails closed when provider-owned measurement identity is missing', () => {
    render(<ResponseDemoPreview api={api} data={{ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { monitoring_location_id: 'USGS-01646500', parameter_code: '00060', value: '1940' } }] }} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'USGS Water Data V1' })
    expect(preview.querySelector('[data-domain-card="water-gauge"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('required time-series, monitoring-location, parameter, and precision-preserving string measurement identity')
  })

  it('fails closed when the returned observation does not match the request identity', () => {
    const mismatched = structuredClone(validObservation)
    mismatched.features[0].properties.monitoring_location_id = 'USGS-00000000'
    render(<ResponseDemoPreview api={api} data={mismatched} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'USGS Water Data V1' })
    expect(preview.querySelector('[data-domain-card="water-gauge"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('USGS observation identity mismatch')
    expect(preview).not.toHaveTextContent('1,940 ft^3/s')
  })

  it('keeps a matching numeric observation visible but marks missing context partial', () => {
    const partial = structuredClone(validObservation) as any
    delete partial.features[0].properties.unit_of_measure
    render(<ResponseDemoPreview api={api} data={partial} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'USGS Water Data V1' })
    const card = preview.querySelector('.usgs-water-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-primary-value', '1940')
    expect(preview).toHaveTextContent('Partial provider response')
    expect(preview).toHaveTextContent('matching provider identity')
  })

  it('fails closed when the successful request includes an unsupported query key', () => {
    render(<ResponseDemoPreview api={api} data={validObservation} requestUrl={`${requestUrl}&offset=0`}/>)
    const preview = screen.getByRole('region', { name: 'USGS Water Data V1' })
    expect(preview.querySelector('[data-domain-card="water-gauge"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('does not trust numeric-string numberReturned metadata as provider count evidence', () => {
    const malformed = structuredClone(validObservation) as any
    malformed.numberReturned = '1'
    render(<ResponseDemoPreview api={api} data={malformed} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'USGS Water Data V1' })
    expect(preview.querySelector('.usgs-water-preview')).toHaveAttribute('data-result-state', 'partial')
  })

  it('rejects a native-number observation value because USGS documents JSON values as precision-preserving strings', () => {
    const malformed = structuredClone(validObservation) as any
    malformed.features[0].properties.value = 1940
    render(<ResponseDemoPreview api={api} data={malformed} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'USGS Water Data V1' })
    expect(preview.querySelector('[data-domain-card="water-gauge"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('1,940 ft^3/s')
  })

  it('does not coerce string coordinates into trustworthy GeoJSON numbers', () => {
    const malformed = structuredClone(validObservation) as any
    malformed.features[0].geometry.coordinates = ['-77.1276388889', '38.9497777778']
    render(<ResponseDemoPreview api={api} data={malformed} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'USGS Water Data V1' })
    expect(preview.querySelector('.usgs-water-preview')).toHaveAttribute('data-result-state', 'partial')
  })

  it('fails closed when a canonical displayed URL is attached to an executed POST', () => {
    render(<ResponseDemoPreview api={api} data={validObservation} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST', body: '{}' }}/>)
    const preview = screen.getByRole('region', { name: 'USGS Water Data V1' })
    expect(preview.querySelector('[data-domain-card="water-gauge"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('1,940 ft^3/s')
  })
  it("does not mark a valid USGS measurement ready without executed-request evidence", () => {
    render(<ResponseDemoPreview api={api} data={validObservation} requestUrl={requestUrl}/>)
    const card = screen.getByRole("region", { name: "USGS Water Data V1" }).querySelector(".usgs-water-preview")
    expect(card).toHaveAttribute("data-result-state", "partial")
    expect(card).toHaveAttribute("data-request-bound", "false")
  })

  it("fails closed when a GET carries a request body", () => {
    render(<ResponseDemoPreview api={api} data={validObservation} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: "GET", body: {} }}/>)
    const card = screen.getByRole("region", { name: "USGS Water Data V1" }).querySelector("[data-domain-card=\"water-gauge\"]")
    expect(card).toHaveAttribute("data-result-state", "invalid")
    expect(card).toHaveAttribute("data-request-bound", "false")
  })
})
