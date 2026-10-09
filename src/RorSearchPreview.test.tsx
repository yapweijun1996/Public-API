import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'ror-search')
if (!api) throw new Error('Missing ror-search fixture')

const requestUrl = 'https://api.ror.org/v2/organizations?query=stanford'
const executedRequest = { url: requestUrl, method: 'GET' as const }
const organization = (id: string, name = 'Stanford University') => ({
  id,
  names: [{ value: name, types: ['ror_display'] }],
  types: ['Education'],
})
const validData = {
  number_of_results: 2,
  time_taken: 0.004,
  meta: {},
  items: [organization('https://ror.org/00f54p054'), organization('https://ror.org/01je1a109', 'Stanford University School of Medicine')],
}

describe('ROR organization search semantic preview', () => {
  afterEach(cleanup)

  it('renders ready only for a coherent exact executed ROR search', () => {
    render(<ResponseDemoPreview api={api} data={validData} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'ROR Organization Registry' })
    const result = preview.querySelector('[data-domain-card="ror-search"]')
    expect(result).toHaveAttribute('data-result-state', 'ready')
    expect(result).toHaveAttribute('data-request-bound', 'true')
    expect(result).toHaveAttribute('data-request-query', 'stanford')
    expect(result).toHaveAttribute('data-provider-total', '2')
    expect(result).toHaveAttribute('data-valid-organization-count', '2')
    expect(result).toHaveAttribute('data-primary-ror-id', 'https://ror.org/00f54p054')
    expect(preview).toHaveTextContent('Stanford University')
    expect(preview).toHaveTextContent('The first result is not auto-selected')
  })

  it.each([
    [`${requestUrl}&foo=bar`, 'extra query key'],
    [`${requestUrl}&query=other`, 'duplicate query key'],
  ])('fails closed for an executed request with %s', (url) => {
    render(<ResponseDemoPreview api={api} data={validData} executedRequest={{ url, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'ROR Organization Registry' })
    expect(preview.querySelector('[data-domain-card="ror-search"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Stanford University')
  })

  it('fails closed for a numeric-string total and does not expose unbound rows', () => {
    render(<ResponseDemoPreview api={api} data={{ ...validData, number_of_results: '2' }} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'ROR Organization Registry' })
    expect(preview.querySelector('[data-domain-card="ror-search"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Stanford University')
  })

  it('withholds malformed and duplicate ROR identities as partial evidence', () => {
    render(<ResponseDemoPreview api={api} data={{ ...validData, number_of_results: 4, items: [
      organization('https://ror.org/00f54p054'),
      organization('https://example.org/not-ror', 'Fabricated organization'),
      organization('https://ror.org/00f54p054', 'Duplicate organization'),
      { id: 'https://ror.org/02abc1234', names: [{ value: 'No ROR display name', types: ['ror_variant'] }] },
    ] }} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'ROR Organization Registry' })
    const result = preview.querySelector('[data-domain-card="ror-search"]')
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-valid-organization-count', '1')
    expect(result).toHaveAttribute('data-malformed-organization-count', '2')
    expect(result).toHaveAttribute('data-duplicate-organization-count', '1')
    expect(preview).toHaveTextContent('https://ror.org/00f54p054')
    expect(preview).not.toHaveTextContent('Fabricated organization')
    expect(preview).not.toHaveTextContent('Duplicate organization')
    expect(preview).not.toHaveTextContent('No ROR display name')
  })

  it('maps only a coherent zero-result page to semantic empty', () => {
    render(<ResponseDemoPreview api={api} data={{ number_of_results: 0, time_taken: 0, meta: {}, items: [] }} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'ROR Organization Registry' })
    expect(preview.querySelector('[data-domain-card="ror-search"]')).toHaveAttribute('data-result-state', 'empty')
    expect(preview).toHaveTextContent('No ROR organizations found')
  })

  it('declares a non-empty query field and preserves an explicit blank for validation', () => {
    const query = api.fields.find((field) => field.id === 'query')
    expect(query?.minLength).toBe(1)
    expect(new URL(api.buildUrl({ query: '   ' })).searchParams.get('query')).toBe('')
  })
})
