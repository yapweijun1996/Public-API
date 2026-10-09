import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'gleif-lei')!
const requestUrl = api.buildUrl({ query: 'Royal Bank of Canada', count: '8' })
const pagination = { currentPage: 1, perPage: 8, from: 1, to: 1, total: 1, lastPage: 1 }
const record = {
  type: 'lei-records',
  id: 'ES7IP3U3RHIGC71XBU11',
  attributes: {
    lei: 'ES7IP3U3RHIGC71XBU11',
    entity: {
      legalName: { name: 'Royal Bank of Canada' },
      headquartersAddress: { addressLines: ['1 place Ville-Marie'], city: 'Montreal', region: 'CA-QC', country: 'CA', postalCode: 'H3B 3A9' },
      jurisdiction: 'CA',
      status: 'ACTIVE',
    },
    registration: { initialRegistrationDate: '2012-06-06T15:52:00Z', nextRenewalDate: '2027-01-09T18:00:18Z', status: 'ISSUED' },
    bic: ['ROYCAEA1XXX'],
  },
}

const card = () => screen.getByRole('region', { name: 'GLEIF LEI Explorer' }).querySelector('.legal-entity-preview') as HTMLElement

describe('GLEIF LEI semantic identity', () => {
  afterEach(cleanup)

  it('renders a request-bound JSON:API search only when provider LEI identities agree', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ data: [record], meta: { pagination } }}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-requested-legal-name', 'Royal Bank of Canada')
    expect(root).toHaveAttribute('data-requested-page-size', '8')
    expect(root).toHaveAttribute('data-provider-page-size', '8')
    expect(root).toHaveAttribute('data-provider-record-count', '1')
    expect(root).toHaveAttribute('data-valid-record-count', '1')
    expect(root).toHaveAttribute('data-invalid-record-count', '0')
    expect(root).toHaveAttribute('data-primary-lei', 'ES7IP3U3RHIGC71XBU11')
    expect(within(root).getByText('Royal Bank of Canada')).toBeInTheDocument()
  })

  it('distinguishes a documented zero-record search from malformed HTTP-success shape', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ data: [], meta: { pagination: { ...pagination, from: null, to: null, total: 0 } } }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveTextContent('No LEI records found')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ meta: { pagination } }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid GLEIF record envelope')
  })

  it('fails closed when record.id and attributes.lei do not identify the same LEI', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{
      data: [{ ...record, id: '5493008WOGQAQLWW1073', attributes: { ...record.attributes, lei: 'ES7IP3U3RHIGC71XBU11', entity: { ...record.attributes.entity, legalName: { name: 'Fabricated Entity' } } } }],
      meta: { pagination },
    }}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'invalid')
    expect(root).toHaveAttribute('data-invalid-record-count', '1')
    expect(root).toHaveTextContent('Invalid GLEIF record identity')
    expect(root).not.toHaveTextContent('Fabricated Entity')
  })

  it('omits identity-less rows and marks a mixed provider batch partial', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{
      data: [record, { type: 'lei-records', id: 'FABRICATED', attributes: { entity: { legalName: { name: 'Fabricated Entity' } } } }],
      meta: { pagination: { ...pagination, to: 2, total: 2 } },
    }}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-provider-record-count', '2')
    expect(root).toHaveAttribute('data-valid-record-count', '1')
    expect(root).toHaveAttribute('data-invalid-record-count', '1')
    expect(root).toHaveTextContent('Royal Bank of Canada')
    expect(root).not.toHaveTextContent('Fabricated Entity')
  })

  it('keeps a coherent LEI visible as partial when required entity context is missing', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{
      data: [{ ...record, attributes: { ...record.attributes, entity: { headquartersAddress: record.attributes.entity.headquartersAddress, status: 'ACTIVE' } } }],
      meta: { pagination },
    }}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-incomplete-record-count', '1')
    expect(root).toHaveTextContent('ES7IP3U3RHIGC71XBU11')
    expect(root).toHaveTextContent('Only records with coherent provider LEI identity are shown')
  })

  it('does not claim ready when request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={{ data: [record], meta: { pagination } }}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-requested-legal-name', '')
    expect(root).toHaveTextContent('Royal Bank of Canada')
  })

  it('fails closed when the canonical URL was executed with a non-GET method or request body', () => {
    const data = { data: [record], meta: { pagination } }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={data}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(card()).toHaveTextContent('Invalid GLEIF request identity')
    expect(card()).not.toHaveTextContent('Royal Bank of Canada')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={data}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(card()).toHaveTextContent('Invalid GLEIF request identity')
    expect(card()).not.toHaveTextContent('Royal Bank of Canada')
  })

  it('fails closed when the executed URL contains duplicate or undeclared query semantics', () => {
    const duplicateName = `${requestUrl}&filter%5Bentity.legalName%5D=Apple+Inc`
    const extraQuery = `${requestUrl}&foo=bar`
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={duplicateName} data={{ data: [record], meta: { pagination } }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid GLEIF request identity')
    expect(card()).not.toHaveTextContent('Royal Bank of Canada')

    rerender(<ResponseDemoPreview api={api} requestUrl={extraQuery} data={{ data: [record], meta: { pagination } }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid GLEIF request identity')
  })

  it('fails closed for non-canonical page-size request values and URL variants', () => {
    const variants = [
      requestUrl.replace('page%5Bsize%5D=8', 'page%5Bsize%5D=08'),
      requestUrl.replace('https://api.gleif.org/', 'http://api.gleif.org/'),
      requestUrl.replace('https://api.gleif.org/', 'https://user:pass@api.gleif.org/'),
      `${requestUrl}#fragment`,
    ]
    for (const variant of variants) {
      const { unmount } = render(<ResponseDemoPreview api={api} requestUrl={variant} data={{ data: [record], meta: { pagination } }}/>)
      expect(card()).toHaveAttribute('data-result-state', 'invalid')
      expect(card()).toHaveTextContent('Invalid GLEIF request identity')
      unmount()
    }
  })

  it('fails pagination coherence when the first page returns fewer rows than the provider total requires', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{
      data: [record],
      meta: { pagination: { currentPage: 1, perPage: 8, from: 1, to: 1, total: 17, lastPage: 3 } },
    }}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-pagination-contract-valid', 'false')
  })

  it('fails pagination coherence when provider page position metadata does not describe the executed first page', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{
      data: [record],
      meta: { pagination: { currentPage: 2, perPage: 8, from: 9, to: 9, total: 17, lastPage: 3 } },
    }}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-pagination-contract-valid', 'false')
  })

  it('does not coerce numeric-string pagination metadata into a trusted provider contract', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{
      data: [record],
      meta: { pagination: { currentPage: '1', perPage: '8', from: '1', to: '1', total: '1', lastPage: '1' } },
    }}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-pagination-contract-valid', 'false')
  })
})
