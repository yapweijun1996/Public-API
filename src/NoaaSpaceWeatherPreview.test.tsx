import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('noaa-space-weather')!
const endpoint = 'https://services.swpc.noaa.gov/products/noaa-scales.json'
const request = (url = endpoint): ExecutedRequestContext => ({ method: 'GET', url })

const fixture = (overrides: Record<string, unknown> = {}) => ({
  0: {
    DateStamp: '2026-09-15',
    TimeStamp: '16:08:00',
    R: { Scale: '0', Text: 'none', MinorProb: null, MajorProb: null },
    S: { Scale: '0', Text: 'none', Prob: null },
    G: { Scale: '1', Text: 'minor' },
  },
  1: { DateStamp: '2026-09-15', TimeStamp: '16:08:00', R: { Scale: null, Text: null, MinorProb: '10', MajorProb: '1' }, S: { Scale: null, Text: null, Prob: '20' }, G: { Scale: '1', Text: 'minor' } },
  2: { DateStamp: '2026-09-16', TimeStamp: '00:00:00', R: { Scale: null, Text: null, MinorProb: '10', MajorProb: '1' }, S: { Scale: null, Text: null, Prob: '20' }, G: { Scale: '1', Text: 'minor' } },
  3: { DateStamp: '2026-09-17', TimeStamp: '00:00:00', R: { Scale: null, Text: null, MinorProb: '10', MajorProb: '1' }, S: { Scale: null, Text: null, Prob: '20' }, G: { Scale: '0', Text: 'none' } },
  ...overrides,
})

const renderPreview = (data: unknown, executedRequest = request()) => {
  render(<ResponseDemoPreview api={api} data={data} requestUrl={executedRequest.url} executedRequest={executedRequest}/>)
  const region = screen.getByRole('region', { name: 'NOAA Space Weather' })
  const card = region.querySelector('[data-domain-card="noaa-space-weather-scales"]')
  expect(card).not.toBeNull()
  return { region, card: card as HTMLElement }
}

afterEach(cleanup)

describe('NOAA Space Weather semantic preview', () => {
  it('accepts the provider decimal-string scale contract and binds the fixed executed request', () => {
    const { region, card } = renderPreview(fixture())

    expect(region).toHaveAttribute('data-preview-layout', 'space-weather-scales')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-current-valid-scale-count', '3')
    expect(card).toHaveAttribute('data-current-invalid-scale-count', '0')
    expect(card).toHaveAttribute('data-current-peak-scale', '1')
    expect(card).toHaveAttribute('data-current-observed-at', '2026-09-15T16:08:00Z')
    expect(region).toHaveTextContent('G1 · minor')
    expect(region).toHaveTextContent('R0 · none')
  })

  it('does not turn a missing current scale into a fabricated quiet zero', () => {
    const data = fixture({
      0: {
        DateStamp: '2026-09-15', TimeStamp: '16:08:00',
        R: { Scale: null, Text: null, MinorProb: null, MajorProb: null },
        S: { Scale: '0', Text: 'none', Prob: null },
        G: { Scale: '1', Text: 'minor' },
      },
    })
    const { region, card } = renderPreview(data)

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-current-valid-scale-count', '2')
    expect(card).toHaveAttribute('data-current-invalid-scale-count', '1')
    expect(region).toHaveTextContent('Radio blackout · Unavailable')
    expect(region).not.toHaveTextContent('Radio blackout · R0')
  })

  it('rejects native-number Scale values instead of silently coercing the documented string wire shape', () => {
    const data = fixture({
      0: {
        DateStamp: '2026-09-15', TimeStamp: '16:08:00',
        R: { Scale: 0, Text: 'none', MinorProb: null, MajorProb: null },
        S: { Scale: '0', Text: 'none', Prob: null },
        G: { Scale: '1', Text: 'minor' },
      },
    })
    const { region, card } = renderPreview(data)

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-current-invalid-scale-count', '1')
    expect(region).not.toHaveTextContent('Radio blackout · R0')
  })

  it('fails closed when all current R/S/G scale evidence is unusable', () => {
    const { region, card } = renderPreview(fixture({
      0: { DateStamp: '2026-09-15', TimeStamp: '16:08:00', R: {}, S: {}, G: {} },
    }))

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-current-valid-scale-count', '0')
    expect(region).toHaveTextContent('Current NOAA scales unavailable')
    expect(region).not.toHaveTextContent('No current storm-scale activity')
  })

  it('fails closed when the executed request is not the fixed NOAA scale product URL', () => {
    const { region, card } = renderPreview(fixture(), request(`${endpoint}?unexpected=1`))

    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(region).toHaveTextContent('NOAA request identity unavailable')
  })

  it('marks a malformed displayed geomagnetic forecast partial instead of calling missing evidence no storm', () => {
    const { region, card } = renderPreview(fixture({
      2: { DateStamp: '2026-09-16', TimeStamp: '00:00:00', G: { Scale: null, Text: null } },
    }))

    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-forecast-invalid-count', '1')
    expect(region).toHaveTextContent('2026-09-16 · G unavailable')
    expect(region).not.toHaveTextContent('2026-09-16 · G0')
  })
})
