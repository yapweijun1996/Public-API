import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'pubchem-compound')
if (!api) throw new Error('Missing pubchem-compound fixture')
const requestUrl = api.buildUrl({ name: 'aspirin' })
const executedGet = { url: requestUrl, method: 'GET' }
const validRecord = {
  CID: 2244,
  MolecularFormula: 'C9H8O4',
  MolecularWeight: '180.16',
  IUPACName: '2-acetyloxybenzoic acid',
}
const valid = { PropertyTable: { Properties: [validRecord] } }

describe('PubChem compound semantic preview', () => {
  afterEach(cleanup)

  it('preserves provider-owned CID identity and requested property-table fields', () => {
    render(<ResponseDemoPreview api={api} data={valid} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const preview = screen.getByRole('region', { name: 'PubChem Compound Lookup' })
    expect(preview).toHaveAttribute('data-preview-layout', 'compound-properties')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')
    const card = preview.querySelector('.pubchem-compound-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-compound-name', 'aspirin')
    expect(card).toHaveAttribute('data-provider-record-count', '1')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-result-cardinality', 'single')
    expect(card).toHaveAttribute('data-primary-cid', '2244')
    expect(card).toHaveAttribute('data-primary-iupac-name', '2-acetyloxybenzoic acid')
    expect(card).toHaveAttribute('data-molecular-formula', 'C9H8O4')
    expect(card).toHaveAttribute('data-molecular-weight', '180.16')
    expect(within(preview).getByRole('heading', { name: '2-acetyloxybenzoic acid' })).toBeInTheDocument()
    expect(preview).toHaveTextContent('C9H8O4')
    expect(preview).toHaveTextContent('180.16 g/mol')
  })

  it.each([
    { label: 'GET with body', executedRequest: { url: requestUrl, method: 'GET', body: { unexpected: true } } },
    { label: 'display/executed URL mismatch', executedRequest: { url: `${requestUrl}#drift`, method: 'GET' } },
  ])('fails closed for $label transport drift', ({ executedRequest }) => {
    render(<ResponseDemoPreview api={api} data={valid} requestUrl={requestUrl} executedRequest={executedRequest}/> )
    const preview = screen.getByRole('region', { name: 'PubChem Compound Lookup' })
    expect(preview.querySelector('[data-domain-card="compound-properties"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when a canonical display URL is attached to a POST execution', () => {
    render(<ResponseDemoPreview api={api} data={valid} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)
    const preview = screen.getByRole('region', { name: 'PubChem Compound Lookup' })
    expect(preview.querySelector('[data-domain-card="compound-properties"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('executed request')
  })

  it('fails closed when the documented PropertyTable envelope is missing', () => {
    render(<ResponseDemoPreview api={api} data={{ unexpected: [] }} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'PubChem Compound Lookup' })
    expect(preview.querySelector('[data-domain-card="compound-properties"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('documented PropertyTable object')
  })

  it('fails closed when HTTP-success Properties is empty because PubChem uses 404 for not-found input', () => {
    render(<ResponseDemoPreview api={api} data={{ PropertyTable: { Properties: [] } }} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'PubChem Compound Lookup' })
    expect(preview.querySelector('[data-domain-card="compound-properties"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('PUG REST uses HTTP 404')
  })

  it('fails closed when no property row carries provider-owned CID identity', () => {
    render(<ResponseDemoPreview api={api} data={{ PropertyTable: { Properties: [{ MolecularFormula: 'C9H8O4', MolecularWeight: '180.16', IUPACName: 'Fabricated aspirin' }] } }} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'PubChem Compound Lookup' })
    expect(preview.querySelector('[data-domain-card="compound-properties"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('provider-owned CID identity')
    expect(preview).not.toHaveTextContent('Fabricated aspirin')
  })

  it('preserves multiple provider-owned CIDs when a chemical name resolves to more than one compound', () => {
    const multiple = { PropertyTable: { Properties: [
      validRecord,
      { CID: 5793, MolecularFormula: 'C6H12O6', MolecularWeight: '180.16', IUPACName: 'glucose' },
    ] } }
    render(<ResponseDemoPreview api={api} data={multiple} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const preview = screen.getByRole('region', { name: 'PubChem Compound Lookup' })
    const card = preview.querySelector('.pubchem-compound-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '2')
    expect(card).toHaveAttribute('data-result-cardinality', 'multiple')
    expect(preview).toHaveTextContent('2 PubChem compounds matched “aspirin”')
    expect(preview.querySelector('[data-cid="2244"]')).toBeInTheDocument()
    expect(preview.querySelector('[data-cid="5793"]')).toBeInTheDocument()
  })

  it('marks mixed valid and identity-less property rows partial and hides the malformed row', () => {
    render(<ResponseDemoPreview api={api} data={{ PropertyTable: { Properties: [validRecord, { MolecularFormula: 'FAKE', IUPACName: 'Fabricated compound' }] } }} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'PubChem Compound Lookup' })
    const card = preview.querySelector('.pubchem-compound-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).not.toHaveTextContent('Fabricated compound')
    expect(preview).not.toHaveTextContent('FAKE')
  })

  it('marks a provider-identified compound partial when a requested property is missing', () => {
    render(<ResponseDemoPreview api={api} data={{ PropertyTable: { Properties: [{ CID: 2244, MolecularFormula: 'C9H8O4', MolecularWeight: '180.16' }] } }} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'PubChem Compound Lookup' })
    const card = preview.querySelector('.pubchem-compound-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-primary-cid', '2244')
    expect(preview).toHaveTextContent('Partial provider response')
    expect(preview).toHaveTextContent('IUPAC nameNot supplied')
  })
})
