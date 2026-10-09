import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog, getDefaultParameters } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'eurostat-population')
if (!api) throw new Error('Missing eurostat-population fixture')

const dimension = (label: string, value: string, valueLabel: string) => ({
  label,
  category: { index: { [value]: 0 }, label: { [value]: valueLabel } },
})

const eurostatDataset = (overrides: Record<string, unknown> = {}) => ({
  version: '2.0',
  class: 'dataset',
  label: 'Population on 1 January by age and sex',
  source: 'ESTAT',
  updated: '2026-08-14T23:00:00+0200',
  id: ['freq', 'unit', 'age', 'sex', 'geo', 'time'],
  size: [1, 1, 1, 1, 1, 1],
  value: { '0': 83577140 },
  dimension: {
    freq: dimension('Time frequency', 'A', 'Annual'),
    unit: dimension('Unit of measure', 'NR', 'Number'),
    age: dimension('Age class', 'TOTAL', 'Total'),
    sex: dimension('Sex', 'T', 'Total'),
    geo: dimension('Geopolitical entity (reporting)', 'DE', 'Germany'),
    time: dimension('Time', '2025', '2025'),
  },
  ...overrides,
})

const defaultRequestUrl = api.buildUrl(getDefaultParameters(api))
const executed = (url = defaultRequestUrl, method = 'GET', body?: unknown) => ({ url, method, ...(body === undefined ? {} : { body }) })

describe('Eurostat population semantic preview', () => {
  afterEach(cleanup)

  it('preserves the exact filtered population cell and dimension semantics', () => {
    render(<ResponseDemoPreview api={api} requestUrl={defaultRequestUrl} executedRequest={executed()} data={eurostatDataset()}/>)

    const preview = screen.getByRole('region', { name: 'Eurostat Population Statistics' })
    expect(preview).toHaveAttribute('data-preview-layout', 'population-statistic')
    const card = preview.querySelector('.eurostat-population-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-primary-population', '83577140')
    expect(card).toHaveAttribute('data-geo-code', 'DE')
    expect(card).toHaveAttribute('data-reference-year', '2025')
    expect(card).toHaveAttribute('data-unit-code', 'NR')
    expect(card).toHaveAttribute('data-age-code', 'TOTAL')
    expect(card).toHaveAttribute('data-sex-code', 'T')
    expect(card).toHaveAttribute('data-frequency-code', 'A')
    expect(card).toHaveAttribute('data-requested-geo-code', 'DE')
    expect(card).toHaveAttribute('data-requested-reference-year', '2025')
    expect(card).toHaveAttribute('data-cell-count', '1')
    expect(card).toHaveAttribute('data-dimension-contract-valid', 'true')
    expect(preview).toHaveTextContent('83,577,140 people')
    expect(preview).toHaveTextContent('Germany · Population on 1 January 2025')
    expect(preview).toHaveTextContent('Number (NR)')
    expect(preview).toHaveTextContent('Annual')
  })

  it('keeps a structurally valid exact cell with no published value as semantic empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={defaultRequestUrl} executedRequest={executed()} data={eurostatDataset({ value: {} })}/>)
    const preview = screen.getByRole('region', { name: 'Eurostat Population Statistics' })
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-result-state', 'empty')
  })

  it('treats a JSON-stat null observation as a valid missing-value cell', () => {
    render(<ResponseDemoPreview api={api} requestUrl={defaultRequestUrl} executedRequest={executed()} data={eurostatDataset({ value: [null], status: ['m'] })}/>)
    const preview = screen.getByRole('region', { name: 'Eurostat Population Statistics' })
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-result-state', 'empty')
  })

  it('keeps an internally coherent cell unbound as partial when request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={eurostatDataset()}/>)
    const preview = screen.getByRole('region', { name: 'Eurostat Population Statistics' })
    const card = preview.querySelector('.eurostat-population-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-identity-match', 'unbound')
  })

  it('fails semantically closed when JSON-stat cube metadata is malformed', () => {
    render(<ResponseDemoPreview api={api} requestUrl={defaultRequestUrl} data={{ value: {}, dimension: {} }}/>)
    const preview = screen.getByRole('region', { name: 'Eurostat Population Statistics' })
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails semantically closed when provider geography does not match the request', () => {
    const franceUrl = api.buildUrl({ country: 'FR', year: '2025' })
    render(<ResponseDemoPreview api={api} requestUrl={franceUrl} executedRequest={executed(franceUrl)} data={eurostatDataset()}/>)
    const preview = screen.getByRole('region', { name: 'Eurostat Population Statistics' })
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('83,577,140 people')
  })

  it('fails semantically closed when the fixed statistical dimensions are not the requested population-total contract', () => {
    const invalidDimension = eurostatDataset({
      dimension: {
        freq: dimension('Time frequency', 'A', 'Annual'),
        unit: dimension('Unit of measure', 'PC', 'Percentage'),
        age: dimension('Age class', 'TOTAL', 'Total'),
        sex: dimension('Sex', 'T', 'Total'),
        geo: dimension('Geopolitical entity (reporting)', 'DE', 'Germany'),
        time: dimension('Time', '2025', '2025'),
      },
    })
    render(<ResponseDemoPreview api={api} requestUrl={defaultRequestUrl} executedRequest={executed()} data={invalidDimension}/>)
    const preview = screen.getByRole('region', { name: 'Eurostat Population Statistics' })
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails semantically closed when the canonical displayed URL was executed with transport or URL drift', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={defaultRequestUrl} executedRequest={executed(defaultRequestUrl, 'POST')} data={eurostatDataset()}/>)
    const preview = screen.getByRole('region', { name: 'Eurostat Population Statistics' })
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={defaultRequestUrl} executedRequest={executed(defaultRequestUrl, 'GET', { unexpected: true })} data={eurostatDataset()}/>)
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-result-state', 'invalid')

    const franceUrl = api.buildUrl({ country: 'FR', year: '2025' })
    rerender(<ResponseDemoPreview api={api} requestUrl={defaultRequestUrl} executedRequest={executed(franceUrl)} data={eurostatDataset()}/>)
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('rejects extra, duplicate, and non-canonical query identity before trusting a HTTP-success body', () => {
    const cases = [
      `${defaultRequestUrl}&foo=bar`,
      `${defaultRequestUrl}&geo=FR`,
      defaultRequestUrl.replace('format=JSON&geo=DE', 'geo=DE&format=JSON'),
    ]
    for (const requestUrl of cases) {
      const { unmount } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed(requestUrl)} data={eurostatDataset()}/>)
      const preview = screen.getByRole('region', { name: 'Eurostat Population Statistics' })
      expect(preview.querySelector('[data-domain-card="population-statistic"]'), requestUrl).toHaveAttribute('data-result-state', 'invalid')
      unmount()
    }
  })

  it('keeps coherent value and empty cells partial when execution evidence is absent', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={defaultRequestUrl} data={eurostatDataset()}/>)
    const preview = screen.getByRole('region', { name: 'Eurostat Population Statistics' })
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-result-state', 'partial')
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={defaultRequestUrl} data={eurostatDataset({ value: {} })}/>)
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-result-state', 'partial')
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails semantically closed when an exact-cell request returns a multi-cell cube', () => {
    render(<ResponseDemoPreview api={api} requestUrl={defaultRequestUrl} executedRequest={executed()} data={eurostatDataset({
      size: [1, 1, 1, 1, 2, 1],
      value: { '0': 83577140, '1': 68669303 },
      dimension: {
        freq: dimension('Time frequency', 'A', 'Annual'),
        unit: dimension('Unit of measure', 'NR', 'Number'),
        age: dimension('Age class', 'TOTAL', 'Total'),
        sex: dimension('Sex', 'T', 'Total'),
        geo: { label: 'Geopolitical entity (reporting)', category: { index: { DE: 0, FR: 1 }, label: { DE: 'Germany', FR: 'France' } } },
        time: dimension('Time', '2025', '2025'),
      },
    })}/>)
    const preview = screen.getByRole('region', { name: 'Eurostat Population Statistics' })
    expect(preview.querySelector('[data-domain-card="population-statistic"]')).toHaveAttribute('data-result-state', 'invalid')
  })
})
