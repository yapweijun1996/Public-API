import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'pubmed-search')
if (!api) throw new Error('Missing pubmed-search fixture')

const requestUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=covid&retmode=json&retmax=3'
const validData = {
  header: { type: 'esearch', version: '0.3' },
  esearchresult: {
    count: '511622',
    retmax: '3',
    retstart: '0',
    idlist: ['42745862', '42745812', '42745795'],
    querytranslation: '"covid"[All Fields]',
  },
}

describe('PubMed ESearch semantic preview', () => {
  afterEach(cleanup)

  it('renders ready only from a coherent exact request-bound ESearch result', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={validData}/>)
    const preview = screen.getByRole('region', { name: 'PubMed Search' })
    const result = preview.querySelector('[data-domain-card="pubmed-search"]')
    expect(result).toHaveAttribute('data-result-state', 'ready')
    expect(result).toHaveAttribute('data-request-bound', 'true')
    expect(result).toHaveAttribute('data-query-term', 'covid')
    expect(result).toHaveAttribute('data-requested-retmax', '3')
    expect(result).toHaveAttribute('data-provider-count', '511622')
    expect(result).toHaveAttribute('data-provider-returned', '3')
    expect(result).toHaveAttribute('data-primary-pmid', '42745862')
    expect(preview).toHaveTextContent('PMID 42745862')
    expect(screen.getByRole('link', { name: 'NCBI policies and disclaimer' })).toHaveAttribute('href', 'https://www.ncbi.nlm.nih.gov/home/about/policies/')
  })

  it('fails closed when a canonical-looking response came from a non-GET or body-bearing transport', () => {
    for (const executedRequest of [
      { url: requestUrl, method: 'POST' },
      { url: requestUrl, method: 'GET', body: { term: 'different-query' } },
      { url: `${requestUrl}&sort=pub_date`, method: 'GET' },
    ]) {
      cleanup()
      render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={validData}/>)
      const preview = screen.getByRole('region', { name: 'PubMed Search' })
      expect(preview.querySelector('[data-domain-card="pubmed-search"]')).toHaveAttribute('data-result-state', 'invalid')
      expect(preview).not.toHaveTextContent('PMID 42745862')
    }
  })

  it('fails closed when the executed request contains undeclared ESearch semantics', () => {
    render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&sort=pub_date`} data={validData}/>)
    const preview = screen.getByRole('region', { name: 'PubMed Search' })
    expect(preview.querySelector('[data-domain-card="pubmed-search"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('PMID 42745862')
  })

  it('does not claim request-bound readiness when executed transport identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={validData}/>)
    const preview = screen.getByRole('region', { name: 'PubMed Search' })
    const result = preview.querySelector('[data-domain-card="pubmed-search"]')
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-request-bound', 'false')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })

  it('fails closed when provider pagination values are not non-negative integers', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ esearchresult: { ...validData.esearchresult, count: '511622.5' } }}/>)
    const preview = screen.getByRole('region', { name: 'PubMed Search' })
    expect(preview.querySelector('[data-domain-card="pubmed-search"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('withholds malformed and duplicate PMID identities as partial evidence', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ esearchresult: {
      ...validData.esearchresult,
      count: '5', retmax: '3', idlist: ['42745862', 'bad-id', '42745862'],
    } }}/>)
    const preview = screen.getByRole('region', { name: 'PubMed Search' })
    const result = preview.querySelector('[data-domain-card="pubmed-search"]')
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-valid-pmid-count', '1')
    expect(result).toHaveAttribute('data-malformed-pmid-count', '1')
    expect(result).toHaveAttribute('data-duplicate-pmid-count', '1')
    expect(preview).toHaveTextContent('PMID 42745862')
    expect(preview).not.toHaveTextContent('bad-id')
  })

  it('maps a coherent zero-result ESearch response to semantic empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{ esearchresult: {
      count: '0', retmax: '0', retstart: '0', idlist: [], querytranslation: 'covid',
    } }}/>)
    const preview = screen.getByRole('region', { name: 'PubMed Search' })
    expect(preview.querySelector('[data-domain-card="pubmed-search"]')).toHaveAttribute('data-result-state', 'empty')
    expect(preview).toHaveTextContent('No PubMed matches')
  })
})
