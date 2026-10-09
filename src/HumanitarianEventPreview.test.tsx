import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'hdx-humanitarian-datasets')
if (!api) throw new Error('Missing hdx-humanitarian-datasets fixture')

const canonicalUrl = 'https://goadmin.ifrc.org/api/v2/event/?limit=6&ordering=-disaster_start_date'
const request = (overrides: Partial<ExecutedRequestContext> = {}): ExecutedRequestContext => ({
  method: 'GET',
  url: canonicalUrl,
  ...overrides,
})
const event = (overrides: Record<string, unknown> = {}) => ({
  id: 8081,
  name: 'BIH: Fire',
  dtype: { name: 'Fire' },
  countries: [{ name: 'Bosnia and Herzegovina', iso3: 'BIH' }],
  ifrc_severity_level_display: 'Yellow',
  disaster_start_date: '2026-09-04T00:00:00Z',
  glide: '',
  num_affected: 0,
  active_deployments: 0,
  summary: '<p>Wildfires affected multiple regions.</p>',
  field_reports: [{
    report_date: '2026-09-06T21:46:09Z',
    num_affected: 0,
    num_dead: 0,
    num_displaced: '0',
    gov_num_affected: 0,
    gov_num_dead: 0,
    gov_num_displaced: 0,
    other_num_affected: 50000,
    other_num_dead: 0,
    other_num_displaced: 0,
  }],
  ...overrides,
})
const renderResult = (data: unknown, executedRequest: ExecutedRequestContext | undefined = request()) => render(
  <ResponseDemoPreview api={api} data={data} executedRequest={executedRequest}/>,
)
const card = () => screen.getByRole('region', { name: 'IFRC GO Emergency Events' }).querySelector('[data-domain-card="humanitarian-events"]')

describe('IFRC GO humanitarian event semantic preview', () => {
  afterEach(cleanup)

  it('binds the exact request and keeps native zero/source-separated impacts ready', () => {
    renderResult({ count: 1, results: [event()] })
    const preview = screen.getByRole('region', { name: 'IFRC GO Emergency Events' })
    const root = card()
    const renderedEvent = preview.querySelector('[data-event-id="8081"]')

    expect(preview).toHaveAttribute('data-preview-layout', 'humanitarian-events')
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-method', 'GET')
    expect(root).toHaveAttribute('data-request-limit', '6')
    expect(root).toHaveAttribute('data-request-ordering', '-disaster_start_date')
    expect(root).toHaveAttribute('data-provider-total', '1')
    expect(root).toHaveAttribute('data-count-contract', 'true')
    expect(root).toHaveAttribute('data-native-number-contract', 'true')
    expect(root).toHaveAttribute('data-malformed-numeric-count', '0')
    expect(root).toHaveAttribute('data-duplicate-event-count', '0')
    expect(renderedEvent).toHaveAttribute('data-country-iso3', 'BIH')
    expect(renderedEvent).toHaveAttribute('data-ifrc-affected', '0')
    expect(renderedEvent).toHaveAttribute('data-government-affected', '0')
    expect(renderedEvent).toHaveAttribute('data-other-affected', '50000')
    expect(preview).toHaveTextContent('Event-level affected figure0')
    expect(preview).toHaveTextContent('Active deployments0')
    expect(preview).toHaveTextContent('Wildfires affected multiple regions.')
    expect(preview).toHaveTextContent('Other source')
    expect(preview).toHaveTextContent('50,000')
    expect(preview).toHaveTextContent('not treated as the event-wide humanitarian total')
  })

  it.each([
    ['missing request', undefined],
    ['wrong method', request({ method: 'get' })],
    ['request body', request({ body: null })],
    ['HTTP URL', request({ url: canonicalUrl.replace('https:', 'http:') })],
    ['authenticated URL', request({ url: canonicalUrl.replace('https://', 'https://user:pass@') })],
    ['URL hash', request({ url: `${canonicalUrl}#fragment` })],
    ['explicit port', request({ url: canonicalUrl.replace('goadmin.ifrc.org', 'goadmin.ifrc.org:443') })],
    ['wrong host', request({ url: canonicalUrl.replace('goadmin.ifrc.org', 'example.com') })],
    ['wrong path', request({ url: canonicalUrl.replace('/event/', '/events/') })],
    ['missing query', request({ url: 'https://goadmin.ifrc.org/api/v2/event/' })],
    ['extra query', request({ url: `${canonicalUrl}&page=2` })],
    ['wrong query order', request({ url: 'https://goadmin.ifrc.org/api/v2/event/?ordering=-disaster_start_date&limit=6' })],
  ])('fails closed for %s without rendering provider identities', (_label, executedRequest) => {
    if (executedRequest === undefined) render(<ResponseDemoPreview api={api} data={{ count: 1, results: [event()] }}/>)
    else renderResult({ count: 1, results: [event()] }, executedRequest)
    const preview = screen.getByRole('region', { name: 'IFRC GO Emergency Events' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(preview).not.toHaveTextContent('BIH: Fire')
    expect(preview.querySelector('[data-event-id]')).not.toBeInTheDocument()
  })

  it('accepts a coherent zero-total empty page only', () => {
    const { rerender } = renderResult({ count: 0, results: [] })
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveAttribute('data-request-bound', 'true')
    expect(card()).toHaveAttribute('data-provider-total', '0')
    expect(card()).toHaveAttribute('data-count-contract', 'true')

    rerender(<ResponseDemoPreview api={api} data={{ count: 1, results: [] }} executedRequest={request()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-count-contract', 'false')
  })

  it.each([
    ['non-record envelope', null],
    ['missing results', { count: 0 }],
    ['non-array results', { count: 1, results: event() }],
    ['numeric-string count', { count: '1', results: [event()] }],
    ['negative count', { count: -1, results: [event()] }],
    ['fractional count', { count: 1.5, results: [event()] }],
    ['unsafe count', { count: Number.MAX_SAFE_INTEGER + 1, results: [event()] }],
    ['count below page length', { count: 0, results: [event()] }],
    ['page over request limit', { count: 7, results: Array.from({ length: 7 }, (_, index) => event({ id: 9000 + index, name: `Event ${index}` })) }],
  ])('rejects an incoherent envelope: %s', (_label, data) => {
    renderResult(data)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-count-contract', 'false')
  })

  it('accepts a paginated provider total greater than the returned first page', () => {
    renderResult({ count: 42, results: [event()] })
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-provider-total', '42')
    expect(card()).toHaveAttribute('data-count-contract', 'true')
  })

  it('rejects a numeric-string event ID instead of coercing provider identity', () => {
    renderResult({ count: 1, results: [event({ id: '8081' })] })
    const preview = screen.getByRole('region', { name: 'IFRC GO Emergency Events' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('BIH: Fire')
    expect(preview.querySelector('[data-event-id]')).not.toBeInTheDocument()
  })

  it.each([
    ['numeric string', '12'],
    ['negative', -1],
    ['fractional', 1.5],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
  ])('withholds malformed documented integer metrics and prevents ready: %s', (_label, malformed) => {
    renderResult({ count: 1, results: [event({
      num_affected: malformed,
      active_deployments: malformed,
      field_reports: [{ report_date: '2026-09-06T21:46:09Z', num_affected: malformed, gov_num_dead: malformed, other_num_displaced: malformed }],
    })] })
    const preview = screen.getByRole('region', { name: 'IFRC GO Emergency Events' })
    const root = card()
    const renderedEvent = preview.querySelector('[data-event-id="8081"]')

    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-native-number-contract', 'false')
    expect(root).toHaveAttribute('data-malformed-numeric-count', '5')
    expect(renderedEvent).not.toHaveAttribute('data-ifrc-affected')
    expect(preview).not.toHaveTextContent('Affected12')
    expect(preview).not.toHaveTextContent('Affected-1')
  })

  it('does not treat documented string num_displaced as a native-number violation', () => {
    renderResult({ count: 1, results: [event({ field_reports: [{ report_date: '2026-09-06T21:46:09Z', num_displaced: '12' }] })] })
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-native-number-contract', 'true')
    expect(card()).toHaveAttribute('data-malformed-numeric-count', '0')
    expect(screen.getByRole('region', { name: 'IFRC GO Emergency Events' })).toHaveTextContent('Displaced12')
  })

  it('deduplicates repeated event IDs and marks a mixed response partial', () => {
    renderResult({ count: 3, results: [
      event({ id: 8084, name: 'Trusted Flood' }),
      event({ id: 8084, name: 'Duplicate Flood' }),
      event({ id: 8085, name: 'Second Trusted Event' }),
    ] })
    const preview = screen.getByRole('region', { name: 'IFRC GO Emergency Events' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-valid-event-count', '1')
    expect(card()).toHaveAttribute('data-invalid-event-count', '2')
    expect(card()).toHaveAttribute('data-duplicate-event-count', '2')
    expect(preview.querySelectorAll('[data-event-id]')).toHaveLength(1)
    expect(preview).toHaveTextContent('Second Trusted Event')
    expect(preview).not.toHaveTextContent('Trusted Flood')
    expect(preview).not.toHaveTextContent('Duplicate Flood')
  })

  it('fails invalid when duplicate and malformed rows leave no unique valid event', () => {
    renderResult({ count: 3, results: [event({ id: 8084, name: 'First duplicate' }), event({ id: 8084, name: 'Second duplicate' }), event({ id: '8085', name: 'String ID' })] })
    const preview = screen.getByRole('region', { name: 'IFRC GO Emergency Events' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-duplicate-event-count', '2')
    expect(preview.querySelector('[data-event-id]')).not.toBeInTheDocument()
    expect(preview).not.toHaveTextContent('First duplicate')
    expect(preview).not.toHaveTextContent('Second duplicate')
  })

  it('omits identity-less provider rows and marks a mixed response partial', () => {
    renderResult({ count: 2, results: [
      event({ id: 8084, name: 'Trusted Flood' }),
      event({ id: undefined, name: 'Fabricated Event' }),
    ] })
    const preview = screen.getByRole('region', { name: 'IFRC GO Emergency Events' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-provider-event-count', '2')
    expect(card()).toHaveAttribute('data-valid-event-count', '1')
    expect(card()).toHaveAttribute('data-invalid-event-count', '1')
    expect(card()).toHaveAttribute('data-primary-event-id', '8084')
    expect(preview).toHaveTextContent('Trusted Flood')
    expect(preview).not.toHaveTextContent('Fabricated Event')
    expect(preview).not.toHaveTextContent('IFRC event 2')
  })

  it('does not invent field-report impacts when no field report exists', () => {
    renderResult({ count: 1, results: [event({ id: 8082, name: 'Honduras - Drought Assessment', field_reports: [] })] })
    const preview = screen.getByRole('region', { name: 'IFRC GO Emergency Events' })
    expect(preview).toHaveTextContent('No field report supplied')
    expect(preview.querySelector('.humanitarian-impact')).not.toBeInTheDocument()
  })
})
