import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = getApiById('uk-police-street-crime')!
const request = (category = 'burglary', query = 'lat=51.5074&lng=-0.1278'): ExecutedRequestContext => ({
  method: 'GET',
  url: `https://data.police.uk/api/crimes-street/${category}?${query}`,
})
const crime = (persistentId: string, overrides: Record<string, unknown> = {}) => ({
  persistent_id: persistentId,
  id: 123,
  category: 'burglary',
  month: '2026-07',
  location: { latitude: '51.49', longitude: '-0.12', street: { name: 'On or near Whitehall' } },
  outcome_status: { category: 'Under investigation', date: null },
  ...overrides,
})
const renderPreview = async (data: unknown, executedRequest = request()) => {
  render(<ResponseDemoPreview api={api} data={data} executedRequest={executedRequest}/>)
  await waitFor(() => expect(screen.getByRole('region', { name: 'UK Street Crime' }).querySelector('[data-domain-card="uk-police-street-crime"]')).toBeInTheDocument())
  return screen.getByRole('region', { name: 'UK Street Crime' })
}

afterEach(cleanup)

describe('UK Police street-crime request-bound semantic preview', () => {
  it('renders documented fields and accepts provider coordinate strings without exact coordinate equality', async () => {
    const persistentId = 'a'.repeat(64)
    const preview = await renderPreview([crime(persistentId)])
    const card = preview.querySelector('[data-domain-card="uk-police-street-crime"]')
    expect(preview).toHaveAttribute('data-preview-layout', 'street-crime')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-category', 'burglary')
    expect(card).toHaveAttribute('data-request-latitude', '51.5074')
    expect(card).toHaveAttribute('data-request-longitude', '-0.1278')
    expect(card).toHaveAttribute('data-primary-persistent-id', persistentId)
    expect(card).toHaveAttribute('data-anonymised-locations', 'true')
    expect(preview).toHaveTextContent('On or near Whitehall')
    expect(preview).toHaveTextContent('2026-07')
    expect(preview).toHaveTextContent('Locations are approximate/anonymised')
    expect(preview).not.toHaveTextContent('Anonymised location 1')
  })

  it('accepts all-crime rows without requiring the selected category in every row', async () => {
    const preview = await renderPreview([crime('b'.repeat(64), { category: 'vehicle-crime' })], request('all-crime'))
    const card = preview.querySelector('[data-domain-card="uk-police-street-crime"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(preview).toHaveTextContent('Vehicle Crime')
  })

  it('rejects extra, duplicate, and undeclared request parameters before trusting a response', async () => {
    for (const executedRequest of [
      request('burglary', 'lat=51.5074&lng=-0.1278&foo=bar'),
      request('burglary', 'lat=51.5074&lat=52.0&lng=-0.1278'),
      request('not-a-category'),
    ]) {
      const preview = await renderPreview([crime('c'.repeat(64))], executedRequest)
      const card = preview.querySelector('[data-domain-card="uk-police-street-crime"]')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(preview).not.toHaveTextContent('On or near Whitehall')
      cleanup()
    }
  })

  it('distinguishes a request-bound empty array from an invalid HTTP-success envelope', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} data={[]} executedRequest={request()}/>)
    let preview = screen.getByRole('region', { name: 'UK Street Crime' })
    expect(preview.querySelector('[data-domain-card="uk-police-street-crime"]')).toHaveAttribute('data-result-state', 'empty')

    rerender(<ResponseDemoPreview api={api} data={{ crimes: [] }} executedRequest={request()}/>)
    preview = screen.getByRole('region', { name: 'UK Street Crime' })
    expect(preview.querySelector('[data-domain-card="uk-police-street-crime"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds missing, malformed, and duplicate persistent identities without using API id as fallback', async () => {
    const persistentId = 'd'.repeat(64)
    const preview = await renderPreview([
      crime(persistentId),
      crime(persistentId, { id: 456 }),
      crime('', { id: 789 }),
      crime('e'.repeat(63)),
    ])
    const card = preview.querySelector('[data-domain-card="uk-police-street-crime"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '4')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '3')
    expect(card).toHaveAttribute('data-duplicate-record-count', '1')
    expect(card).toHaveAttribute('data-identity-field', 'persistent_id')
    expect(card).toHaveAttribute('data-identity-fallback', 'none')
    expect(preview).toHaveTextContent(persistentId)
    expect(preview).not.toHaveTextContent('No fallback to the API')
  })

  it('fails closed when no row has a documented persistent identity', async () => {
    const preview = await renderPreview([crime('', { id: 999 })])
    const card = preview.querySelector('[data-domain-card="uk-police-street-crime"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('none had a unique documented persistent_id')
    expect(preview).toHaveTextContent('No fallback to the API id is used')
  })
})
