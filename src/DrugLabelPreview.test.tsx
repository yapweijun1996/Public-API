import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'openfda-drug-labels')
if (!api) throw new Error('Missing openfda-drug-labels fixture')
const requestUrl = api.buildUrl({ brand: 'Advil' })
const executedGet = { url: requestUrl, method: 'GET' }

describe('openFDA drug label semantic preview', () => {
  afterEach(cleanup)

  it('renders regulated label identity and sections instead of generic record/property output', () => {
    render(<ResponseDemoPreview api={api} data={{
      meta: { last_updated: '2026-09-04', results: { skip: 0, limit: 8, total: 39 } },
      results: [{
        id: '44e71018-211d-caf8-e063-6394a90a06c9',
        openfda: {
          brand_name: ['Advil Dual Action with Acetaminophen'],
          generic_name: ['IBUPROFEN, ACETAMINOPHEN TABLET, FILM COATED'],
          manufacturer_name: ["Lil' Drug Store Products, Inc."],
          product_type: ['HUMAN OTC DRUG'],
          route: ['ORAL'],
          substance_name: ['IBUPROFEN', 'ACETAMINOPHEN'],
        },
        active_ingredient: ['Acetaminophen 250 mg Ibuprofen 125 mg'],
        indications_and_usage: ['Temporarily relieves minor aches and pains.'],
        warnings: ['This product contains acetaminophen and ibuprofen.'],
        dosage_and_administration: ['Adults and children 12 years and over take 2 caplets every 8 hours while symptoms persist.'],
      }],
    }} requestUrl={requestUrl} executedRequest={executedGet}/>)

    const preview = screen.getByRole('region', { name: 'openFDA Drug Labels' })
    expect(preview).toHaveAttribute('data-preview-layout', 'drug-label')
    const label = preview.querySelector('.drug-label-preview')
    expect(label).toHaveAttribute('data-result-state', 'ready')
    expect(label).toHaveAttribute('data-request-bound', 'true')
    expect(label).toHaveAttribute('data-requested-brand', 'Advil')
    expect(label).toHaveAttribute('data-primary-brand-name', 'Advil Dual Action with Acetaminophen')
    expect(label).toHaveAttribute('data-primary-generic-name', 'IBUPROFEN, ACETAMINOPHEN TABLET, FILM COATED')
    expect(label).toHaveAttribute('data-primary-manufacturer', "Lil' Drug Store Products, Inc.")
    expect(label).toHaveAttribute('data-primary-substances', 'IBUPROFEN, ACETAMINOPHEN')
    expect(label).toHaveAttribute('data-provider-match-count', '39')
    expect(label).toHaveAttribute('data-provider-last-updated', '2026-09-04')
    expect(within(preview).getByRole('heading', { name: 'Active ingredients' })).toBeInTheDocument()
    expect(within(preview).getByRole('heading', { name: 'Indications and uses' })).toBeInTheDocument()
    expect(within(preview).getByRole('heading', { name: 'Warnings' })).toBeInTheDocument()
    expect(within(preview).getByRole('heading', { name: 'Directions' })).toBeInTheDocument()
    expect(preview).toHaveTextContent('Acetaminophen 250 mg Ibuprofen 125 mg')
    expect(preview).toHaveTextContent('Temporarily relieves minor aches and pains.')
    expect(preview).toHaveTextContent('This product contains acetaminophen and ibuprofen.')
    expect(preview).not.toHaveTextContent('openFDA Drug Labels record 1')
    expect(preview).not.toHaveTextContent('properties')
  })

  it('builds a quoted openFDA phrase search for multi-word brand names', () => {
    const url = new URL(api.buildUrl({ brand: 'Advil Dual Action' }))
    expect(url.origin).toBe('https://api.fda.gov')
    expect(url.pathname).toBe('/drug/label.json')
    expect(url.searchParams.get('search')).toBe('openfda.brand_name:"Advil Dual Action"')
    expect(url.searchParams.get('limit')).toBe('8')
    expect(api.fields[0]).toMatchObject({ id: 'brand', minLength: 1, maxLength: 80, pattern: '[^"\\\\]+' })
  })

  it('fails closed when an HTTP-success label belongs to another brand search', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{
      meta: { last_updated: '2026-09-11', results: { skip: 0, limit: 8, total: 1 } },
      results: [{
        id: 'wrong-brand-record',
        openfda: { brand_name: ['Tylenol'], generic_name: ['ACETAMINOPHEN'] },
        indications_and_usage: ['Temporary relief of minor aches and pains.'],
      }],
    }}/>)

    const preview = screen.getByRole('region', { name: 'openFDA Drug Labels' })
    expect(preview).toHaveTextContent('Invalid openFDA drug-label response')
    expect(preview).not.toHaveTextContent('Tylenol')
  })

  it('marks malformed pagination evidence partial instead of coercing numeric strings', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{
      meta: { last_updated: '2026-09-11', results: { skip: 0, limit: 8, total: '39' } },
      results: [{
        id: '44e71018-211d-caf8-e063-6394a90a06c9',
        openfda: { brand_name: ['ADVIL COLD AND SINUS'], generic_name: ['IBUPROFEN'] },
        warnings: ['Read the full label before use.'],
      }],
    }}/>)

    const label = screen.getByRole('region', { name: 'openFDA Drug Labels' }).querySelector('.drug-label-preview')
    expect(label).toHaveAttribute('data-result-state', 'partial')
    expect(label).toHaveAttribute('data-provider-match-count', '')
    expect(label).toHaveAttribute('data-pagination-coherent', 'false')
  })

  it('rejects successful responses tied to a non-canonical executed request', () => {
    const requestUrl = `${api.buildUrl({ brand: 'Advil' })}&skip=0`
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{
      meta: { last_updated: '2026-09-11', results: { skip: 0, limit: 8, total: 1 } },
      results: [{ id: 'record-1', openfda: { brand_name: ['ADVIL'] } }],
    }}/>)

    expect(screen.getByRole('region', { name: 'openFDA Drug Labels' })).toHaveTextContent('Invalid openFDA drug-label request')
  })

  it('fails closed when the displayed canonical URL was actually executed with POST or a GET body', () => {
    const response = {
      meta: { last_updated: '2026-09-11', results: { skip: 0, limit: 8, total: 1 } },
      results: [{ id: 'record-1', openfda: { brand_name: ['ADVIL'] } }],
    }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={response}/>)
    expect(screen.getByRole('region', { name: 'openFDA Drug Labels' })).toHaveTextContent('Invalid openFDA drug-label request')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={response}/>)
    expect(screen.getByRole('region', { name: 'openFDA Drug Labels' })).toHaveTextContent('Invalid openFDA drug-label request')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: api.buildUrl({ brand: 'Tylenol' }), method: 'GET' }} data={response}/>)
    expect(screen.getByRole('region', { name: 'openFDA Drug Labels' })).toHaveTextContent('Invalid openFDA drug-label request')
  })

  it('marks a structurally valid label response partial when executed transport identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{
      meta: { last_updated: '2026-09-11', results: { skip: 0, limit: 8, total: 1 } },
      results: [{ id: 'record-1', openfda: { brand_name: ['ADVIL'] } }],
    }}/>)

    const label = screen.getByRole('region', { name: 'openFDA Drug Labels' }).querySelector('.drug-label-preview')
    expect(label).toHaveAttribute('data-result-state', 'partial')
    expect(label).toHaveAttribute('data-request-bound', 'false')
  })

})
