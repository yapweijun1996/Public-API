import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'chembl-molecule')
if (!api) throw new Error('Missing chembl-molecule fixture')

describe('ChEMBL molecule semantic preview', () => {
  afterEach(cleanup)

  it('preserves molecule identity, development metadata, properties, classifications, and structure identifiers', () => {
    render(<ResponseDemoPreview api={api} data={{
      molecule_chembl_id: 'CHEMBL25',
      pref_name: 'ASPIRIN',
      molecule_type: 'Small molecule',
      max_phase: '4.0',
      first_approval: 1950,
      therapeutic_flag: true,
      natural_product: 1,
      oral: true,
      parenteral: false,
      topical: false,
      withdrawn_flag: false,
      molecule_properties: {
        full_molformula: 'C9H8O4', full_mwt: '180.16', alogp: '1.31', psa: '63.60', hba: 3, hbd: 1,
        num_ro5_violations: 0, qed_weighted: '0.55',
      },
      molecule_structures: {
        canonical_smiles: 'CC(=O)Oc1ccccc1C(=O)O',
        standard_inchi: 'InChI=1S/C9H8O4/example',
        standard_inchi_key: 'BSYNRYMUTXBXSQ-UHFFFAOYSA-N',
      },
      atc_classifications: ['B01AC06', 'N02BA01'],
      cross_references: [{ xref_src: 'DailyMed', xref_id: 'aspirin' }],
    }} requestUrl={api.buildUrl({ chemblId: 'CHEMBL25' })} executedRequest={{ url: api.buildUrl({ chemblId: 'CHEMBL25' }), method: 'GET' }}/>)

    const preview = screen.getByRole('region', { name: 'ChEMBL Molecule Profile' })
    expect(preview).toHaveAttribute('data-preview-layout', 'molecule-profile')
    const card = preview.querySelector('.chembl-molecule-preview')
    expect(card).toHaveAttribute('data-primary-chembl-id', 'CHEMBL25')
    expect(card).toHaveAttribute('data-primary-name', 'ASPIRIN')
    expect(card).toHaveAttribute('data-molecule-type', 'Small molecule')
    expect(card).toHaveAttribute('data-max-phase', '4')
    expect(card).toHaveAttribute('data-first-approval', '1950')
    expect(card).toHaveAttribute('data-therapeutic-flag', 'true')
    expect(card).toHaveAttribute('data-withdrawn-flag', 'false')
    expect(card).toHaveAttribute('data-molecular-formula', 'C9H8O4')
    expect(card).toHaveAttribute('data-molecular-weight', '180.16')
    expect(card).toHaveAttribute('data-atc-classification-count', '2')
    expect(within(preview).getByRole('heading', { name: 'ASPIRIN' })).toBeInTheDocument()
    expect(within(preview).getByRole('heading', { name: 'Structure identifiers' })).toBeInTheDocument()
    expect(within(preview).getByRole('heading', { name: 'ATC classifications' })).toBeInTheDocument()
    expect(preview).toHaveTextContent('CHEMBL25')
    expect(preview).toHaveTextContent('C9H8O4')
    expect(preview).toHaveTextContent('180.16')
    expect(preview).toHaveTextContent('B01AC06')
    expect(preview).toHaveTextContent('DailyMed')
    expect(preview).toHaveTextContent('CC(=O)Oc1ccccc1C(=O)O')
    expect(preview).not.toHaveTextContent('ChEMBL Molecule Profile record 1')
    expect(preview.textContent ?? '').not.toMatch(/\d+ properties/)
  })


  it('fails closed when HTTP-success data is not a molecule detail object', () => {
    render(<ResponseDemoPreview api={api} data={[]} requestUrl={api.buildUrl({ chemblId: 'CHEMBL25' })} executedRequest={{ url: api.buildUrl({ chemblId: 'CHEMBL25' }), method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'ChEMBL Molecule Profile' })
    expect(preview.querySelector('[data-domain-card="molecule-profile"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('documented molecule detail object')
  })

  it('fails closed when the molecule detail object has no provider-owned identity', () => {
    render(<ResponseDemoPreview api={api} data={{ pref_name: 'FABRICATED', molecule_type: 'Small molecule' }} requestUrl={api.buildUrl({ chemblId: 'CHEMBL25' })} executedRequest={{ url: api.buildUrl({ chemblId: 'CHEMBL25' }), method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'ChEMBL Molecule Profile' })
    expect(preview.querySelector('[data-domain-card="molecule-profile"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('provider-owned molecule_chembl_id identity')
    expect(preview).not.toHaveTextContent('FABRICATED')
  })

  it('fails closed when the returned molecule identity does not match the direct request', () => {
    render(<ResponseDemoPreview api={api} data={{ molecule_chembl_id: 'CHEMBL999', pref_name: 'FABRICATED', molecule_type: 'Small molecule' }} requestUrl={api.buildUrl({ chemblId: 'CHEMBL25' })} executedRequest={{ url: api.buildUrl({ chemblId: 'CHEMBL25' }), method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'ChEMBL Molecule Profile' })
    expect(preview.querySelector('[data-domain-card="molecule-profile"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('ChEMBL molecule identity mismatch')
    expect(preview).not.toHaveTextContent('FABRICATED')
  })

  it('marks matching molecule identity partial when expected profile context is malformed', () => {
    render(<ResponseDemoPreview api={api} data={{
      molecule_chembl_id: 'CHEMBL25',
      pref_name: 'ASPIRIN',
      molecule_type: 'Small molecule',
      molecule_properties: {},
      molecule_structures: {},
      cross_references: [{ xref_src: 'DailyMed', xref_id: 'aspirin' }, { xref_src: 'Broken source' }],
    }} requestUrl={api.buildUrl({ chemblId: 'CHEMBL25' })} executedRequest={{ url: api.buildUrl({ chemblId: 'CHEMBL25' }), method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'ChEMBL Molecule Profile' })
    const card = preview.querySelector('.chembl-molecule-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-requested-chembl-id', 'CHEMBL25')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-provider-cross-reference-count', '2')
    expect(card).toHaveAttribute('data-valid-cross-reference-count', '1')
    expect(card).toHaveAttribute('data-invalid-cross-reference-count', '1')
    expect(preview).toHaveTextContent('Partial provider response')
    expect(preview).toHaveTextContent('DailyMed')
    expect(preview).not.toHaveTextContent('Broken source')
  })

  it('keeps unknown boolean flags distinct from false', () => {
    render(<ResponseDemoPreview api={api} data={{
      molecule_chembl_id: 'CHEMBL999',
      pref_name: 'EXAMPLE',
      molecule_type: 'Small molecule',
      oral: null,
      parenteral: false,
      topical: undefined,
      molecule_properties: {},
      molecule_structures: {},
    }}/>)

    const preview = screen.getByRole('region', { name: 'ChEMBL Molecule Profile' })
    const administration = within(preview).getByRole('heading', { name: 'Administration flags' }).closest('section')
    expect(administration).toHaveTextContent('OralNot supplied')
    expect(administration).toHaveTextContent('ParenteralNo')
    expect(administration).toHaveTextContent('TopicalNot supplied')
  })

  it.each([
    { label: 'POST execution', executedRequest: { url: api.buildUrl({ chemblId: 'CHEMBL25' }), method: 'POST' } },
    { label: 'GET with body', executedRequest: { url: api.buildUrl({ chemblId: 'CHEMBL25' }), method: 'GET', body: { unexpected: true } } },
    { label: 'display/executed URL mismatch', executedRequest: { url: `${api.buildUrl({ chemblId: 'CHEMBL25' })}#drift`, method: 'GET' } },
  ])('fails closed for $label transport drift', ({ executedRequest }) => {
    const requestUrl = api.buildUrl({ chemblId: 'CHEMBL25' })
    render(<ResponseDemoPreview api={api} data={{
      molecule_chembl_id: 'CHEMBL25', pref_name: 'ASPIRIN', molecule_type: 'Small molecule', cross_references: [],
    }} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'ChEMBL Molecule Profile' })
    expect(preview.querySelector('[data-domain-card="molecule-profile"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('executed request')
  })

})
