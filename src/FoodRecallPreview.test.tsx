import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'openfda-food-recalls')
if (!api) throw new Error('Missing openfda-food-recalls fixture')
const requestUrl = api.buildUrl({ query: 'peanut', limit: '8' })
const executedGet = { url: requestUrl, method: 'GET' }

describe('openFDA food recall semantic preview', () => {
  afterEach(cleanup)

  it('renders enforcement identity, risk, dates and recall narratives instead of generic record output', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{
      meta: { last_updated: '2026-08-19', results: { skip: 0, limit: 8, total: 1668 } },
      results: [{
        recall_number: 'F-0865-2017',
        classification: 'Class II',
        status: 'Terminated',
        recalling_firm: 'Magic Gourmet Trading Inc',
        recall_initiation_date: '20160831',
        report_date: '20170118',
        city: 'Millbrae',
        state: 'CA',
        country: 'United States',
        voluntary_mandated: 'Voluntary: Firm initiated',
        product_quantity: '2 cases',
        distribution_pattern: 'CA, WA, OR.',
        product_description: 'Koi Palace Mini Moon Cake: Single Box - Mini Oolong Tea Paste',
        reason_for_recall: 'Undeclared ingredients include wheat and peanut oil.',
        code_info: 'Best by Nov 1, 2016.',
      }, {
        recall_number: 'F-9999-2017',
        classification: 'Class I',
        status: 'Ongoing',
        recalling_firm: 'Example Foods',
        product_description: 'Peanut snack product',
      }],
    }}/>)

    const preview = screen.getByRole('region', { name: 'openFDA Food Recalls' })
    expect(preview).toHaveAttribute('data-preview-layout', 'food-recalls')
    const recall = preview.querySelector('.food-recall-preview')
    expect(recall).toHaveAttribute('data-result-state', 'ready')
    expect(recall).toHaveAttribute('data-request-bound', 'true')
    expect(recall).toHaveAttribute('data-requested-query', 'peanut')
    expect(recall).toHaveAttribute('data-requested-limit', '8')
    expect(recall).toHaveAttribute('data-pagination-coherent', 'true')
    expect(recall).toHaveAttribute('data-primary-recall-number', 'F-0865-2017')
    expect(recall).toHaveAttribute('data-primary-classification', 'Class II')
    expect(recall).toHaveAttribute('data-primary-status', 'Terminated')
    expect(recall).toHaveAttribute('data-primary-recalling-firm', 'Magic Gourmet Trading Inc')
    expect(recall).toHaveAttribute('data-primary-recall-initiation-date', '2016-08-31')
    expect(recall).toHaveAttribute('data-provider-match-count', '1668')
    expect(recall).toHaveAttribute('data-provider-last-updated', '2026-08-19')
    expect(within(preview).getByRole('heading', { name: 'Recall F-0865-2017' })).toBeInTheDocument()
    expect(within(preview).getByRole('heading', { name: 'Reason for recall' })).toBeInTheDocument()
    expect(preview).toHaveTextContent('Undeclared ingredients include wheat and peanut oil.')
    expect(preview).toHaveTextContent('2016-08-31')
    expect(preview).toHaveTextContent('Other recall records')
    expect(preview).not.toHaveTextContent('openFDA Food Recalls record 1')
    expect(preview).not.toHaveTextContent('properties')
  })

  it('builds one bounded phrase query across product description and recall reason', () => {
    const url = new URL(api.buildUrl({ query: 'ice cream', limit: '6' }))
    expect(url.origin).toBe('https://api.fda.gov')
    expect(url.pathname).toBe('/food/enforcement.json')
    expect(url.searchParams.get('search')).toBe('product_description:"ice cream" OR reason_for_recall:"ice cream"')
    expect(url.searchParams.get('limit')).toBe('6')
    expect(api.fields[0]).toMatchObject({ id: 'query', minLength: 1, maxLength: 80, pattern: '[^"\\\\]+' })
  })

  it('fails closed when HTTP-success rows do not acknowledge the executed product/reason search', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{
      meta: { last_updated: '2026-09-15', results: { skip: 0, limit: 8, total: 1 } },
      results: [{
        recall_number: 'F-WRONG-1',
        classification: 'Class II',
        status: 'Ongoing',
        recalling_firm: 'Example Foods',
        product_description: 'Vanilla ice cream',
        reason_for_recall: 'Undeclared milk.',
      }],
    }}/>)

    const preview = screen.getByRole('region', { name: 'openFDA Food Recalls' })
    expect(preview).toHaveTextContent('Invalid openFDA food-recall response')
    expect(preview).not.toHaveTextContent('Vanilla ice cream')
  })

  it('keeps matching rows but marks malformed pagination and wrong-query rows partial', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{
      meta: { last_updated: '2026-09-15', results: { skip: 0, limit: 8, total: '2' } },
      results: [{
        recall_number: 'F-GOOD-1',
        classification: 'Class I',
        status: 'Ongoing',
        recalling_firm: 'Good Foods',
        product_description: 'Peanut snack bites',
        reason_for_recall: 'Possible contamination.',
      }, {
        recall_number: 'F-WRONG-2',
        classification: 'Class II',
        status: 'Completed',
        recalling_firm: 'Other Foods',
        product_description: 'Vanilla wafers',
        reason_for_recall: 'Undeclared milk.',
      }],
    }}/>)

    const card = screen.getByRole('region', { name: 'openFDA Food Recalls' }).querySelector('.food-recall-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveAttribute('data-query-mismatch-count', '1')
    expect(card).toHaveAttribute('data-pagination-coherent', 'false')
    expect(card).toHaveAttribute('data-provider-match-count', '')
    expect(screen.getByRole('region', { name: 'openFDA Food Recalls' })).not.toHaveTextContent('Vanilla wafers')
  })

  it('rejects a successful response tied to an expanded executed request', () => {
    render(<ResponseDemoPreview api={api} requestUrl={`${api.buildUrl({ query: 'peanut', limit: '8' })}&skip=0`} data={{
      meta: { last_updated: '2026-09-15', results: { skip: 0, limit: 8, total: 1 } },
      results: [{ recall_number: 'F-1', product_description: 'Peanut snack' }],
    }}/>)

    expect(screen.getByRole('region', { name: 'openFDA Food Recalls' })).toHaveTextContent('Invalid openFDA food-recall request')
  })

  it('treats a coherent zero-match response as empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={{
      meta: { last_updated: '2026-09-15', results: { skip: 0, limit: 8, total: 0 } },
      results: [],
    }}/>)

    expect(screen.getByRole('region', { name: 'openFDA Food Recalls' })).toHaveTextContent('No openFDA food recalls returned')
  })

  it('fails closed when the displayed canonical food-recall URL was actually executed with POST or a GET body', () => {
    const response = {
      meta: { last_updated: '2026-09-15', results: { skip: 0, limit: 8, total: 1 } },
      results: [{ recall_number: 'F-1', product_description: 'Peanut snack' }],
    }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={response}/>)
    expect(screen.getByRole('region', { name: 'openFDA Food Recalls' })).toHaveTextContent('Invalid openFDA food-recall request')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={response}/>)
    expect(screen.getByRole('region', { name: 'openFDA Food Recalls' })).toHaveTextContent('Invalid openFDA food-recall request')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: api.buildUrl({ query: 'ice cream', limit: '8' }), method: 'GET' }} data={response}/>)
    expect(screen.getByRole('region', { name: 'openFDA Food Recalls' })).toHaveTextContent('Invalid openFDA food-recall request')
  })

  it('marks a structurally valid recall response partial when executed transport identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{
      meta: { last_updated: '2026-09-15', results: { skip: 0, limit: 8, total: 1 } },
      results: [{ recall_number: 'F-1', product_description: 'Peanut snack' }],
    }}/>)

    const card = screen.getByRole('region', { name: 'openFDA Food Recalls' }).querySelector('.food-recall-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

})
