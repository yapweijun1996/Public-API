import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'ensembl-gene-lookup')
if (!api) throw new Error('Missing ensembl-gene-lookup fixture')
const requestUrl = api.buildUrl({ geneId: 'ENSG00000157764' })
const gene = {
  id: 'ENSG00000157764', version: 16, display_name: 'BRAF',
  description: 'B-Raf proto-oncogene, serine/threonine kinase [Source:HGNC Symbol;Acc:HGNC:1097]',
  biotype: 'protein_coding', species: 'homo_sapiens', assembly_name: 'GRCh38',
  seq_region_name: '7', start: 140719327, end: 140925199, strand: -1, object_type: 'Gene',
  canonical_transcript: 'ENST00000646891.2', source: 'ensembl_havana', db_type: 'core',
}

describe('Ensembl gene semantic preview', () => {
  afterEach(cleanup)

  it('preserves a matching Gene identity, assembly coordinates, strand, biotype, and canonical transcript', () => {
    render(<ResponseDemoPreview api={api} data={gene} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'Ensembl Gene Lookup' })
    const card = preview.querySelector('.ensembl-gene-preview')
    expect(preview).toHaveAttribute('data-preview-layout', 'gene-locus')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-gene-id', 'ENSG00000157764')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-primary-gene-id', 'ENSG00000157764')
    expect(card).toHaveAttribute('data-object-type', 'Gene')
    expect(card).toHaveAttribute('data-gene-version', '16')
    expect(card).toHaveAttribute('data-gene-symbol', 'BRAF')
    expect(card).toHaveAttribute('data-biotype', 'protein_coding')
    expect(card).toHaveAttribute('data-species', 'homo_sapiens')
    expect(card).toHaveAttribute('data-assembly', 'GRCh38')
    expect(card).toHaveAttribute('data-seq-region', '7')
    expect(card).toHaveAttribute('data-start', '140719327')
    expect(card).toHaveAttribute('data-end', '140925199')
    expect(card).toHaveAttribute('data-strand', '-1')
    expect(within(preview).getByRole('heading', { name: 'BRAF' })).toBeInTheDocument()
    expect(preview).toHaveTextContent('ENSG00000157764.16')
    expect(preview).toHaveTextContent('GRCh38 · 7:140,719,327–140,925,199')
    expect(preview).toHaveTextContent('-1 (reverse)')
  })

  it('keeps a complete matching gene ready when canonical transcript is omitted', () => {
    const withoutTranscript = { ...gene, canonical_transcript: undefined }
    render(<ResponseDemoPreview api={api} data={withoutTranscript} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'Ensembl Gene Lookup' })
    expect(preview.querySelector('.ensembl-gene-preview')).toHaveAttribute('data-result-state', 'ready')
    expect(preview.querySelector('.ensembl-gene-preview')).not.toHaveAttribute('data-canonical-transcript')
    expect(preview).toHaveTextContent('Canonical transcriptNot supplied')
  })

  it('fails closed when HTTP-success data lacks stable identity', () => {
    render(<ResponseDemoPreview api={api} data={{ object_type: 'Gene', display_name: 'FABRICATED' }} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'Ensembl Gene Lookup' })
    expect(preview.querySelector('[data-domain-card="gene-locus"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('without a stable identifier')
    expect(preview).not.toHaveTextContent('FABRICATED')
  })

  it('fails closed when the returned stable ID does not match the request', () => {
    render(<ResponseDemoPreview api={api} data={{ ...gene, id: 'ENSG00000999999', display_name: 'FABRICATED' }} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'Ensembl Gene Lookup' })
    expect(preview.querySelector('[data-domain-card="gene-locus"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('identity mismatch')
    expect(preview).not.toHaveTextContent('FABRICATED')
  })

  it('rejects a non-Gene response instead of relabelling it as a gene', () => {
    render(<ResponseDemoPreview api={api} data={{ ...gene, object_type: 'Transcript', display_name: 'BRAF-201' }} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'Ensembl Gene Lookup' })
    expect(preview.querySelector('[data-domain-card="gene-locus"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('not a gene')
    expect(preview).not.toHaveTextContent('BRAF-201')
  })

  it('marks a matching Gene partial when core locus context is malformed', () => {
    render(<ResponseDemoPreview api={api} data={{ ...gene, start: 200, end: 100, strand: 0 }} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'Ensembl Gene Lookup' })
    const card = preview.querySelector('.ensembl-gene-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).not.toHaveAttribute('data-start')
    expect(card).not.toHaveAttribute('data-end')
    expect(card).not.toHaveAttribute('data-strand')
    expect(preview).toHaveTextContent('Partial gene record')
    expect(preview).toHaveTextContent('Genomic regionNot supplied')
    expect(preview).toHaveTextContent('StrandNot supplied')
  })

  it.each([
    { label: 'POST execution', executedRequest: { url: requestUrl, method: 'POST' } },
    { label: 'GET with body', executedRequest: { url: requestUrl, method: 'GET', body: { unexpected: true } } },
    { label: 'display/executed URL mismatch', executedRequest: { url: `${requestUrl}#drift`, method: 'GET' } },
  ])('fails closed for $label transport drift', ({ executedRequest }) => {
    render(<ResponseDemoPreview api={api} data={gene} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'Ensembl Gene Lookup' })
    expect(preview.querySelector('[data-domain-card="gene-locus"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('executed request')
  })

})
