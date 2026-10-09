import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { NvdCpeSearchPreview } from './previews/NvdCpeSearchPreview'

const requestUrl = 'https://services.nvd.nist.gov/rest/json/cpes/2.0?keywordSearch=openssl&resultsPerPage=8'
const executed = (url = requestUrl, method = 'GET', body?: unknown) => ({ url, method, ...(body === undefined ? {} : { body }) })
const product = {
  cpe: {
    deprecated: false,
    cpeName: 'cpe:2.3:a:openssl:openssl:3.0.0:*:*:*:*:*:*:*',
    cpeNameId: '11111111-2222-4333-8444-555555555555',
    created: '2026-09-01T00:00:00.000',
    lastModified: '2026-09-12T00:00:00.000',
    titles: [{ title: 'OpenSSL 3.0.0', lang: 'en' }],
  },
}
const products = [
  product,
  ...Array.from({ length: 7 }, (_, index) => ({
    cpe: {
      ...product.cpe,
      cpeName: `cpe:2.3:a:openssl:openssl:3.0.${index + 1}:*:*:*:*:*:*:*`,
      cpeNameId: `11111111-2222-4333-8444-${String(index + 1).padStart(12, '0')}`,
      titles: [{ title: `OpenSSL 3.0.${index + 1}`, lang: 'en' }],
    },
  })),
]
const response = {
  resultsPerPage: 8,
  startIndex: 0,
  totalResults: 42,
  format: 'NVD_CPE',
  version: '2.0',
  timestamp: '2026-09-14T10:00:00.000',
  products,
}
const card = () => document.querySelector('[data-domain-card="nvd-cpe-search"]')

describe('NvdCpeSearchPreview', () => {
  afterEach(cleanup)

  it('renders a strict request-bound CPE product response as ready', () => {
    render(<NvdCpeSearchPreview data={response} executedRequest={executed()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-requested-keyword', 'openssl')
    expect(card()).toHaveAttribute('data-request-results-per-page', '8')
    expect(card()).toHaveAttribute('data-envelope-contract', 'true')
    expect(card()).toHaveAttribute('data-filter-contract', 'true')
    expect(card()).toHaveAttribute('data-count-contract', 'true')
    expect(card()).toHaveAttribute('data-provider-results-per-page', '8')
    expect(card()).toHaveAttribute('data-provider-product-count', '8')
    expect(card()).toHaveAttribute('data-primary-cpe-name-id', product.cpe.cpeNameId)
    expect(screen.getByText('OpenSSL 3.0.0')).toBeInTheDocument()
    expect(screen.getByText(product.cpe.cpeName)).toBeInTheDocument()
    expect(screen.getAllByText('Not deprecated')).toHaveLength(8)
  })

  it('accepts a complete final first page below the requested result ceiling', () => {
    render(<NvdCpeSearchPreview data={{ ...response, resultsPerPage: 1, totalResults: 1, products: [product] }} executedRequest={executed()}/>)

    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-provider-results-per-page', '1')
    expect(card()).toHaveAttribute('data-provider-product-count', '1')
    expect(card()).toHaveAttribute('data-provider-total-results', '1')
    expect(card()).toHaveAttribute('data-count-contract', 'true')
  })

  it('keeps inconsistent and short non-final first pages partial', () => {
    const { rerender } = render(<NvdCpeSearchPreview data={{ ...response, products: [product] }} executedRequest={executed()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-count-contract', 'false')

    rerender(<NvdCpeSearchPreview data={{ ...response, resultsPerPage: 1, products: [product] }} executedRequest={executed()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-count-contract', 'false')
  })

  it('fails closed on malformed NVD envelopes and numeric-string counters', () => {
    const { rerender } = render(<NvdCpeSearchPreview data={{ ...response, format: undefined }} executedRequest={executed()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<NvdCpeSearchPreview data={{ ...response, totalResults: '42' }} executedRequest={executed()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<NvdCpeSearchPreview data={{ ...response, products: {} }} executedRequest={executed()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })


  it('fails closed when the canonical URL was executed with the wrong transport', () => {
    const { rerender } = render(<NvdCpeSearchPreview data={response} executedRequest={executed(requestUrl, 'POST')}/>)

    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByText('Invalid NVD CPE request identity')).toBeInTheDocument()
    expect(screen.queryByText('OpenSSL 3.0.0')).not.toBeInTheDocument()

    rerender(<NvdCpeSearchPreview data={response} executedRequest={executed(requestUrl, 'GET', { unexpected: true })}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByText('Invalid NVD CPE request identity')).toBeInTheDocument()
    expect(screen.queryByText('OpenSSL 3.0.0')).not.toBeInTheDocument()
  })

  it('rejects flattened, mistyped, and filter-contradictory product rows', () => {
    const flattened = { ...product.cpe, deprecated: 'false' }
    const wrongProduct = {
      cpe: {
        ...product.cpe,
        cpeName: 'cpe:2.3:o:microsoft:windows_11:23h2:*:*:*:*:*:*:*',
        cpeNameId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        titles: [{ title: 'Microsoft Windows 11 23H2', lang: 'en' }],
      },
    }
    const { rerender } = render(<NvdCpeSearchPreview data={{ ...response, products: [flattened] }} executedRequest={executed()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText(flattened.cpeName)).not.toBeInTheDocument()

    rerender(<NvdCpeSearchPreview data={{ ...response, products: [wrongProduct] }} executedRequest={executed()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText('Microsoft Windows 11 23H2')).not.toBeInTheDocument()
  })

  it('keeps a mixed batch partial and withholds the contradictory row', () => {
    const wrongProduct = {
      cpe: {
        ...product.cpe,
        cpeName: 'cpe:2.3:a:postgresql:postgresql:18.0:*:*:*:*:*:*:*',
        cpeNameId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        titles: [{ title: 'PostgreSQL 18', lang: 'en' }],
      },
    }
    render(<NvdCpeSearchPreview data={{ ...response, products: [product, wrongProduct] }} executedRequest={executed()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-provider-product-count', '2')
    expect(card()).toHaveAttribute('data-valid-product-count', '1')
    expect(card()).toHaveAttribute('data-invalid-product-count', '1')
    expect(screen.queryByText('PostgreSQL 18')).not.toBeInTheDocument()
  })

  it('distinguishes a request-bound zero result from unbound response data', () => {
    const empty = { ...response, resultsPerPage: 0, totalResults: 0, products: [] }
    const { rerender } = render(<NvdCpeSearchPreview data={empty} executedRequest={executed()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'empty')

    rerender(<NvdCpeSearchPreview data={response}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
  })

  it('rejects unsupported executed request identities', () => {
    render(<NvdCpeSearchPreview data={response} executedRequest={executed("https://services.nvd.nist.gov/rest/json/cpes/2.0?keywordSearch=openssl&resultsPerPage=100")}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText('OpenSSL 3.0.0')).not.toBeInTheDocument()
  })
})
