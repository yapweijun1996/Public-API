import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'uniprot-protein')
if (!api) throw new Error('Missing uniprot-protein fixture')
const requestUrl = api.buildUrl({ accession: 'P05067' })
const executedGet = { url: requestUrl, method: 'GET' }
const validProtein = {
  entryType: 'UniProtKB reviewed (Swiss-Prot)',
  primaryAccession: 'P05067',
  secondaryAccessions: ['P09000'],
  uniProtkbId: 'A4_HUMAN',
  annotationScore: 5,
  organism: { scientificName: 'Homo sapiens', commonName: 'Human', taxonId: 9606 },
  proteinDescription: { recommendedName: { fullName: { value: 'Amyloid-beta precursor protein' } } },
  genes: [{ geneName: { value: 'APP' }, synonyms: [{ value: 'A4' }, { value: 'AD1' }] }],
  sequence: { length: 770, molWeight: 86943 },
  comments: [
    { commentType: 'FUNCTION', texts: [{ value: 'Functions as a cell surface receptor.' }] },
    { commentType: 'FUNCTION', molecule: 'Amyloid-beta protein 42', texts: [{ value: 'May activate mononuclear phagocytes.' }] },
  ],
}

describe('UniProt protein annotation semantic preview', () => {
  afterEach(cleanup)

  it('preserves stable protein identity, request identity, sequence facts, and provider function annotations', () => {
    render(<ResponseDemoPreview api={api} data={validProtein} requestUrl={requestUrl} executedRequest={executedGet}/>)

    const preview = screen.getByRole('region', { name: 'UniProt Protein Lookup' })
    expect(preview).toHaveAttribute('data-preview-layout', 'protein-annotation')
    const card = preview.querySelector('.protein-annotation-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-accession', 'P05067')
    expect(card).toHaveAttribute('data-requested-accession-role', 'primary')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-primary-accession', 'P05067')
    expect(card).toHaveAttribute('data-secondary-accession-count', '1')
    expect(card).toHaveAttribute('data-invalid-secondary-accession-count', '0')
    expect(card).toHaveAttribute('data-primary-entry-name', 'A4_HUMAN')
    expect(card).toHaveAttribute('data-primary-protein-name', 'Amyloid-beta precursor protein')
    expect(card).toHaveAttribute('data-primary-gene', 'APP')
    expect(card).toHaveAttribute('data-organism-name', 'Homo sapiens')
    expect(card).toHaveAttribute('data-organism-taxon-id', '9606')
    expect(card).toHaveAttribute('data-entry-type', 'UniProtKB reviewed (Swiss-Prot)')
    expect(card).toHaveAttribute('data-annotation-score', '5')
    expect(card).toHaveAttribute('data-sequence-length', '770')
    expect(card).toHaveAttribute('data-molecular-weight-daltons', '86943')
    expect(card).toHaveAttribute('data-function-comment-count', '2')
    expect(within(preview).getByRole('heading', { name: 'Amyloid-beta precursor protein' })).toBeInTheDocument()
    expect(within(preview).getByRole('heading', { name: 'Function' })).toBeInTheDocument()
    expect(preview).toHaveTextContent('A4_HUMAN')
    expect(preview).toHaveTextContent('APP')
    expect(preview).toHaveTextContent('770 residues')
    expect(preview).toHaveTextContent('86,943 Da')
    expect(preview).toHaveTextContent('Functions as a cell surface receptor.')
    expect(preview).toHaveTextContent('Amyloid-beta protein 42')
    expect(preview).not.toHaveTextContent('UniProt Protein Lookup record 1')
    expect(preview).not.toHaveTextContent('properties')
  })

  it.each([
    { label: 'GET with body', executedRequest: { url: requestUrl, method: 'GET', body: { unexpected: true } } },
    { label: 'display/executed URL mismatch', executedRequest: { url: `${requestUrl}#drift`, method: 'GET' } },
  ])('fails closed for $label transport drift', ({ executedRequest }) => {
    render(<ResponseDemoPreview api={api} data={validProtein} requestUrl={requestUrl} executedRequest={executedRequest}/> )
    const preview = screen.getByRole('region', { name: 'UniProt Protein Lookup' })
    expect(preview.querySelector('[data-domain-card="protein-annotation"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when a canonical display URL is attached to a POST execution', () => {
    render(<ResponseDemoPreview api={api} data={validProtein} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)
    const preview = screen.getByRole('region', { name: 'UniProt Protein Lookup' })
    expect(preview.querySelector('[data-domain-card="protein-annotation"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('executed request')
  })

  it('does not misclassify an unreviewed TrEMBL entry as reviewed', () => {
    const unreviewedUrl = api.buildUrl({ accession: 'A0A000' })
    render(<ResponseDemoPreview api={api} requestUrl={unreviewedUrl} executedRequest={{ url: unreviewedUrl, method: 'GET' }} data={{
      entryType: 'UniProtKB unreviewed (TrEMBL)',
      primaryAccession: 'A0A000',
      uniProtkbId: 'EXAMPLE_HUMAN',
      proteinDescription: { submissionNames: [{ fullName: { value: 'Example protein' } }] },
      organism: { scientificName: 'Homo sapiens', taxonId: 9606 },
      sequence: { length: 100, molWeight: 11000 },
    }}/>)

    const preview = screen.getByRole('region', { name: 'UniProt Protein Lookup' })
    const state = preview.querySelector('.domain-state')
    expect(state).toHaveTextContent('UniProtKB unreviewed (TrEMBL)')
    expect(state).toHaveClass('warning')
    expect(preview.querySelector('.protein-annotation-preview')).toHaveAttribute('data-result-state', 'ready')
  })

  it('fails closed when HTTP-success data is not a protein entry object', () => {
    render(<ResponseDemoPreview api={api} data={[]} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'UniProt Protein Lookup' })
    expect(preview.querySelector('[data-domain-card="protein-annotation"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid UniProt protein response')
  })

  it('fails closed when the provider omits a valid primary accession', () => {
    render(<ResponseDemoPreview api={api} data={{ ...validProtein, primaryAccession: undefined }} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'UniProt Protein Lookup' })
    expect(preview.querySelector('[data-domain-card="protein-annotation"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('without a valid primary accession')
    expect(preview).not.toHaveTextContent('Amyloid-beta precursor protein')
  })

  it('fails closed when the requested accession is neither primary nor provider-reported secondary identity', () => {
    const mismatched = { ...validProtein, primaryAccession: 'Q9Y6K9', secondaryAccessions: [] }
    render(<ResponseDemoPreview api={api} data={mismatched} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'UniProt Protein Lookup' })
    expect(preview.querySelector('[data-domain-card="protein-annotation"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('UniProt protein identity mismatch')
    expect(preview).not.toHaveTextContent('Amyloid-beta precursor protein')
  })

  it('accepts a provider-reported secondary accession that resolves to the current primary record', () => {
    const secondaryUrl = api.buildUrl({ accession: 'P09000' })
    render(<ResponseDemoPreview api={api} data={validProtein} requestUrl={secondaryUrl} executedRequest={{ url: secondaryUrl, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'UniProt Protein Lookup' })
    const card = preview.querySelector('.protein-annotation-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-accession', 'P09000')
    expect(card).toHaveAttribute('data-requested-accession-role', 'secondary')
    expect(card).toHaveAttribute('data-primary-accession', 'P05067')
    expect(preview).toHaveTextContent('provider-reported secondary accession')
    expect(preview).toHaveTextContent('P09000')
    expect(preview).toHaveTextContent('P05067')
  })

  it('keeps trustworthy identity visible but marks missing core annotation context partial', () => {
    const partial = { ...validProtein, organism: {} }
    render(<ResponseDemoPreview api={api} data={partial} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const preview = screen.getByRole('region', { name: 'UniProt Protein Lookup' })
    const card = preview.querySelector('.protein-annotation-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-primary-accession', 'P05067')
    expect(preview).toHaveTextContent('valid protein identity')
    expect(preview).toHaveTextContent('OrganismNot supplied')
  })
})
