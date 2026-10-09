import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'rcsb-pdb-entry')
if (!api) throw new Error('Missing rcsb-pdb-entry fixture')
const requestUrl = api.buildUrl({ entryId: '4HHB' })
const validEntry = {
  rcsb_id: '4HHB',
  entry: { id: '4HHB' },
  rcsb_entry_container_identifiers: { entry_id: '4HHB', assembly_ids: ['1'], entity_ids: ['1', '2', '3', '4', '5'] },
  struct: { title: 'THE CRYSTAL STRUCTURE OF HUMAN DEOXYHAEMOGLOBIN AT 1.74 ANGSTROMS RESOLUTION' },
  exptl: [{ method: 'X-RAY DIFFRACTION' }],
  refine: [{ ls_d_res_high: 1.74 }],
  rcsb_entry_info: {
    polymer_composition: 'heteromeric protein',
    polymer_entity_count: 2,
    entity_count: 5,
    deposited_atom_count: 4779,
    assembly_count: 1,
    nonpolymer_bound_components: ['HEM'],
  },
  rcsb_accession_info: {
    deposit_date: '1984-03-07T00:00:00.000+00:00',
    initial_release_date: '1984-07-17T00:00:00.000+00:00',
    revision_date: '2026-08-12T00:00:00.000+00:00',
    status_code: 'REL',
  },
  citation: [{
    id: 'primary',
    rcsb_is_primary: 'Y',
    title: 'The crystal structure of human deoxyhaemoglobin at 1.74 A resolution',
    rcsb_journal_abbrev: 'J Mol Biol',
    year: 1984,
    rcsb_authors: ['Fermi, G.', 'Perutz, M.F.', 'Shaanan, B.', 'Fourme, R.'],
    pdbx_database_id_DOI: '10.1016/0022-2836(84)90472-8',
    pdbx_database_id_PubMed: 6726807,
  }],
}

describe('RCSB PDB molecular structure semantic preview', () => {
  afterEach(cleanup)

  it('preserves matching provider identity, experimental method, resolution, archive facts, and primary citation', () => {
    render(<ResponseDemoPreview api={api} data={validEntry} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)

    const preview = screen.getByRole('region', { name: 'RCSB Protein Data Bank Entry' })
    expect(preview).toHaveAttribute('data-preview-layout', 'molecular-structure')
    const card = preview.querySelector('.pdb-structure-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-entry-id', '4HHB')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-rcsb-id', '4HHB')
    expect(card).toHaveAttribute('data-entry-id', '4HHB')
    expect(card).toHaveAttribute('data-container-entry-id', '4HHB')
    expect(card).toHaveAttribute('data-experimental-method', 'X-RAY DIFFRACTION')
    expect(card).toHaveAttribute('data-resolution-angstroms', '1.74')
    expect(card).toHaveAttribute('data-polymer-composition', 'heteromeric protein')
    expect(card).toHaveAttribute('data-polymer-entity-count', '2')
    expect(card).toHaveAttribute('data-entity-count', '5')
    expect(card).toHaveAttribute('data-deposited-atom-count', '4779')
    expect(card).toHaveAttribute('data-primary-citation-doi', '10.1016/0022-2836(84)90472-8')
    expect(card).toHaveAttribute('data-initial-release-date', '1984-07-17')
    expect(card).toHaveAttribute('data-revision-date', '2026-08-12')
    expect(within(preview).getByRole('heading', { name: validEntry.struct.title })).toBeInTheDocument()
    expect(preview).toHaveTextContent('X-RAY DIFFRACTION')
    expect(preview).toHaveTextContent('1.74 Å')
    expect(preview).toHaveTextContent('4,779')
    expect(preview).toHaveTextContent('Fermi, G., Perutz, M.F., Shaanan, B., Fourme, R.')
    expect(preview).toHaveTextContent('10.1016/0022-2836(84)90472-8')
  })

  it('fails closed when HTTP-success data is not a core-entry object', () => {
    render(<ResponseDemoPreview api={api} data={[]} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'RCSB Protein Data Bank Entry' })
    expect(preview.querySelector('[data-domain-card="molecular-structure"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('without the documented core-entry object')
  })

  it('fails closed when provider-owned core-entry identity is missing', () => {
    render(<ResponseDemoPreview api={api} data={{ entry: { id: '4HHB' }, struct: { title: 'Incomplete entry' } }} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'RCSB Protein Data Bank Entry' })
    expect(preview.querySelector('[data-domain-card="molecular-structure"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('without the provider-owned rcsb_id, entry.id, and container entry_id identity fields')
  })

  it('fails closed when provider-owned core-entry identifiers disagree', () => {
    const conflicted = structuredClone(validEntry)
    conflicted.rcsb_entry_container_identifiers.entry_id = '1ABC'
    render(<ResponseDemoPreview api={api} data={conflicted} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'RCSB Protein Data Bank Entry' })
    expect(preview.querySelector('[data-domain-card="molecular-structure"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('provider-owned core-entry identifiers disagree')
    expect(preview).not.toHaveTextContent(validEntry.struct.title)
  })

  it('fails closed when the returned PDB identity does not match the requested entry', () => {
    const mismatched = structuredClone(validEntry)
    mismatched.rcsb_id = '1ABC'
    mismatched.entry.id = '1ABC'
    mismatched.rcsb_entry_container_identifiers.entry_id = '1ABC'
    render(<ResponseDemoPreview api={api} data={mismatched} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'RCSB Protein Data Bank Entry' })
    expect(preview.querySelector('[data-domain-card="molecular-structure"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('does not match the requested PDB entry')
    expect(preview).not.toHaveTextContent(validEntry.struct.title)
  })

  it('keeps matching identity visible but marks missing core context partial', () => {
    const partial = structuredClone(validEntry)
    partial.exptl = []
    render(<ResponseDemoPreview api={api} data={partial} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'RCSB Protein Data Bank Entry' })
    const card = preview.querySelector('.pdb-structure-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-rcsb-id', '4HHB')
    expect(preview).toHaveTextContent('Partial provider response')
    expect(preview).toHaveTextContent('matching core-entry identity')
    expect(preview).toHaveTextContent('Experimental methodNot supplied')
  })

  it.each([
    { label: 'POST execution', executedRequest: { url: requestUrl, method: 'POST' } },
    { label: 'GET with body', executedRequest: { url: requestUrl, method: 'GET', body: { unexpected: true } } },
    { label: 'display/executed URL mismatch', executedRequest: { url: `${requestUrl}#drift`, method: 'GET' } },
  ])('fails closed for $label transport drift', ({ executedRequest }) => {
    render(<ResponseDemoPreview api={api} data={validEntry} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'RCSB Protein Data Bank Entry' })
    expect(preview.querySelector('[data-domain-card="molecular-structure"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('executed request')
  })

})
