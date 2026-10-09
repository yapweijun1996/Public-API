import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('nasa-power-climate')!

const executedRequest = (parameters = 'T2M,PRECTOTCORR'): ExecutedRequestContext => ({
  method: 'GET',
  url: `https://power.larc.nasa.gov/api/temporal/daily/point?${new URLSearchParams({
    parameters,
    community: 'AG',
    latitude: '1.3521',
    longitude: '103.8198',
    start: '20250101',
    end: '20250103',
    format: 'JSON',
  })}`,
})

const response = (overrides: Record<string, unknown> = {}) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [103.82, 1.352, 25.8] },
  properties: {
    parameter: {
      T2M: { '20250101': 26.56, '20250102': 26.93, '20250103': 27.01 },
      PRECTOTCORR: { '20250101': 10.59, '20250102': 25.48, '20250103': 74.3 },
    },
  },
  header: {
    title: 'NASA/POWER Source Native Resolution Daily Data',
    api: { version: 'v2.9.7', name: 'POWER Daily API' },
    sources: ['SYN1DEG', 'MERRA2', 'POWER'],
    fill_value: -999,
    time_standard: 'LST',
    start: '20250101',
    end: '20250103',
  },
  messages: [],
  parameters: {
    T2M: { units: 'C', longname: 'Temperature at 2 Meters' },
    PRECTOTCORR: { units: 'mm/day', longname: 'Precipitation Corrected' },
  },
  times: { data: 0.343, process: 0.01 },
  ...overrides,
})

const renderPreview = (data: unknown, request = executedRequest()) => {
  render(<ResponseDemoPreview api={api} data={data} requestUrl={request.url} executedRequest={request}/>)
  const region = screen.getByRole('region', { name: 'NASA POWER Climate' })
  const card = region.querySelector('[data-domain-card="nasa-power-climate"]')
  expect(card).not.toBeNull()
  return { region, card: card as HTMLElement }
}

describe('NASA POWER climate semantic preview', () => {
  it('binds the complete daily series, metadata, geometry, and header to the executed request', () => {
    const { region, card } = renderPreview(response())

    expect(region).toHaveAttribute('data-preview-layout', 'climate-series')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-start-date', '2025-01-01')
    expect(card).toHaveAttribute('data-request-end-date', '2025-01-03')
    expect(card).toHaveAttribute('data-request-parameters', 'T2M,PRECTOTCORR')
    expect(card).toHaveAttribute('data-provider-parameter-count', '2')
    expect(card).toHaveAttribute('data-valid-parameter-count', '2')
    expect(card).toHaveAttribute('data-invalid-parameter-count', '0')
    expect(card).toHaveAttribute('data-valid-measurement-count', '6')
    expect(card).toHaveAttribute('data-parameter-identity-contract', 'true')
    expect(card).toHaveAttribute('data-date-alignment-contract', 'true')
    expect(card).toHaveAttribute('data-metadata-contract', 'true')
    expect(card).toHaveAttribute('data-header-range-contract', 'true')
    expect(card).toHaveAttribute('data-geometry-contract', 'true')
    expect(card).toHaveAttribute('data-provider-longitude', '103.82')
    expect(card).toHaveAttribute('data-provider-latitude', '1.352')
    expect(card).toHaveAttribute('data-fill-value', '-999')
    expect(card).toHaveAttribute('data-time-standard', 'LST')
    expect(card).toHaveTextContent('Temperature at 2 Meters')
    expect(card).toHaveTextContent('27.01 C')
    expect(card).toHaveTextContent('2025-01-01')
    expect(card).toHaveTextContent('2025-01-03')
  })

  it('withholds numeric strings and the provider fill sentinel instead of trusting either as a measurement', () => {
    const data = response({
      properties: {
        parameter: {
          T2M: { '20250101': '26.56', '20250102': -999, '20250103': 27.01 },
        },
      },
      parameters: {
        T2M: { units: 'C', longname: 'Temperature at 2 Meters' },
      },
    })
    const { card } = renderPreview(data, executedRequest('T2M'))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-measurement-count', '1')
    expect(card).toHaveAttribute('data-missing-measurement-count', '1')
    expect(card).toHaveAttribute('data-malformed-measurement-count', '1')
    expect(card).not.toHaveTextContent('26.56 C')
    expect(card).not.toHaveTextContent('-999')
  })

  it('fails a malformed HTTP-success payload closed without fabricating a zero climate reading', () => {
    const { card } = renderPreview({ type: 'Feature' })

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('NASA POWER climate unavailable')
    expect(card).not.toHaveTextContent(/\b0(?:\.0+)?\s+(?:C|units)\b/)
  })

  it('marks missing dates and unrequested parameter series as partial identity/alignment evidence', () => {
    const data = response({
      properties: {
        parameter: {
          T2M: { '20250101': 26.56, '20250102': 26.93, '20250103': 27.01 },
          PRECTOTCORR: { '20250101': 10.59, '20250103': 74.3 },
          WS10M: { '20250101': 2.31, '20250102': 2.74, '20250103': 3.24 },
        },
      },
      parameters: {
        T2M: { units: 'C', longname: 'Temperature at 2 Meters' },
        PRECTOTCORR: { units: 'mm/day', longname: 'Precipitation Corrected' },
        WS10M: { units: 'm/s', longname: 'Wind Speed at 10 Meters' },
      },
    })
    const { card } = renderPreview(data)

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-parameter-count', '3')
    expect(card).toHaveAttribute('data-valid-parameter-count', '1')
    expect(card).toHaveAttribute('data-invalid-parameter-count', '2')
    expect(card).toHaveAttribute('data-parameter-identity-contract', 'false')
    expect(card).toHaveAttribute('data-date-alignment-contract', 'false')
    expect(card).toHaveAttribute('data-missing-measurement-count', '1')
    expect(card).not.toHaveTextContent('Wind Speed at 10 Meters')
  })

  it('treats a structurally complete all-fill response as empty rather than zero-valued data', () => {
    const data = response({
      properties: {
        parameter: {
          T2M: { '20250101': -999, '20250102': -999, '20250103': -999 },
        },
      },
      parameters: {
        T2M: { units: 'C', longname: 'Temperature at 2 Meters' },
      },
    })
    const { card } = renderPreview(data, executedRequest('T2M'))

    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-missing-measurement-count', '3')
    expect(card).toHaveTextContent('No reported measurements')
    expect(card).not.toHaveTextContent('-999')
  })
})
