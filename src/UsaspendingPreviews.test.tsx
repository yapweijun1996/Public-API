import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog, validateParameters } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const agencyApi = apiCatalog.find((candidate) => candidate.id === 'fiscal-data-treasury')
const awardsApi = apiCatalog.find((candidate) => candidate.id === 'usaspending')
if (!agencyApi || !awardsApi) throw new Error('Missing USAspending fixtures')

const awardRequest = (fiscalYear: number, limit: number) => {
  const parameters = { fiscalYear: String(fiscalYear), limit: String(limit) }
  return {
    url: awardsApi.buildUrl(parameters),
    method: 'POST',
    body: awardsApi.buildBody?.(parameters),
  }
}

describe('USAspending semantic previews', () => {
  afterEach(cleanup)

  it('keeps fiscal year and award limit as integer SSOT inputs without silent request coercion', () => {
    expect(awardsApi.fields.find((field) => field.id === 'fiscalYear')).toMatchObject({ type: 'number', min: 2008, step: 1 })
    expect(awardsApi.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', min: 1, max: 20, step: 1 })
    expect(validateParameters(awardsApi, { fiscalYear: '2025.5', limit: '8' })).toHaveProperty('fiscalYear')
    expect(validateParameters(awardsApi, { fiscalYear: '2025', limit: '8.5' })).toHaveProperty('limit')
    expect(() => awardsApi.buildBody?.({ fiscalYear: '2025.5', limit: '8' })).toThrow(/fiscal year/i)
    expect(() => awardsApi.buildBody?.({ fiscalYear: '2025', limit: '8.5' })).toThrow(/limit/i)
  })

  it('renders the agency endpoint as an overview without inventing spending totals', () => {
    render(<ResponseDemoPreview api={agencyApi} requestUrl={agencyApi.buildUrl({})} executedRequest={{ url: agencyApi.buildUrl({}), method: 'GET' }} data={{
      fiscal_year: 2026,
      toptier_code: '020',
      name: 'Department of the Treasury',
      abbreviation: 'TREAS',
      agency_id: 456,
      mission: 'Maintain a strong economy and manage the U.S. Government finances effectively.',
      website: 'https://www.treasury.gov/',
      congressional_justification_url: 'https://www.treasury.gov/cj',
      subtier_agency_count: 14,
      def_codes: [{ code: 'N', title: 'CARES Act', public_law: 'Emergency P.L. 116-136', disaster: 'covid_19' }],
    }}/>)

    const preview = screen.getByRole('region', { name: 'U.S. Treasury Agency Overview' })
    expect(preview).toHaveAttribute('data-preview-layout', 'federal-agency-overview')
    const card = preview.querySelector('.federal-agency-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-toptier-code', '020')
    expect(card).toHaveAttribute('data-provider-toptier-code', '020')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-contract-valid', 'true')
    expect(card).toHaveAttribute('data-fiscal-year', '2026')
    expect(card).toHaveAttribute('data-toptier-code', '020')
    expect(card).toHaveAttribute('data-subtier-count', '14')
    expect(preview).toHaveTextContent('Maintain a strong economy')
    expect(preview).toHaveTextContent('CARES Act')
    expect(screen.getByRole('link', { name: 'Open agency website' })).toHaveAttribute('href', 'https://www.treasury.gov/')
    expect(preview).toHaveTextContent('does not itself return award obligations or budgetary-resource totals')
    expect(preview).not.toHaveTextContent('federal spending profile')
  })

  it('does not claim verified agency request binding when the executed transport differs from the displayed GET', () => {
    const requestUrl = agencyApi.buildUrl({})
    const data = {
      fiscal_year: 2026,
      toptier_code: '020',
      name: 'Department of the Treasury',
      agency_id: 456,
      subtier_agency_count: 14,
      def_codes: [],
    }

    const { rerender } = render(<ResponseDemoPreview api={agencyApi} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={data}/>)
    expect(screen.getByText('Invalid USAspending agency request identity').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={agencyApi} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={data}/>)
    expect(screen.getByText('Invalid USAspending agency request identity').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={agencyApi} requestUrl={requestUrl} executedRequest={{ url: requestUrl.replace('/020/', '/070/'), method: 'GET' }} data={data}/>)
    expect(screen.getByText('Invalid USAspending agency request identity').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={agencyApi} requestUrl={requestUrl} data={data}/>)
    const unbound = screen.getByRole('region', { name: 'U.S. Treasury Agency Overview' }).querySelector('.federal-agency-preview')
    expect(unbound).toHaveAttribute('data-result-state', 'partial')
    expect(unbound).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails closed when the agency response identity does not match the executed top-tier code', () => {
    render(<ResponseDemoPreview api={agencyApi} requestUrl={agencyApi.buildUrl({})} executedRequest={{ url: agencyApi.buildUrl({}), method: 'GET' }} data={{
      fiscal_year: 2026,
      toptier_code: '070',
      name: 'Plausible but wrong agency',
      agency_id: 999,
      subtier_agency_count: 2,
      def_codes: [],
    }}/>)

    const card = screen.getByText('USAspending agency identity mismatch').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-toptier-code', '020')
    expect(card).toHaveAttribute('data-provider-toptier-code', '070')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(screen.queryByText('Plausible but wrong agency')).not.toBeInTheDocument()
  })

  it('does not coerce numeric strings into trusted agency identifiers or counts', () => {
    render(<ResponseDemoPreview api={agencyApi} requestUrl={agencyApi.buildUrl({})} executedRequest={{ url: agencyApi.buildUrl({}), method: 'GET' }} data={{
      fiscal_year: 2026,
      toptier_code: '020',
      name: 'Department of the Treasury',
      agency_id: '456',
      subtier_agency_count: '14',
      def_codes: [],
    }}/>)

    const card = screen.getByRole('region', { name: 'U.S. Treasury Agency Overview' }).querySelector('.federal-agency-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(card).not.toHaveAttribute('data-agency-id')
    expect(card).not.toHaveAttribute('data-subtier-count')
  })

  it('keeps USAspending award amounts, obligation dates, agencies and provider messages explicit', () => {
    render(<ResponseDemoPreview api={awardsApi} data={{
      spending_level: 'awards',
      limit: 2,
      results: [{
        internal_id: 1,
        'Award ID': 'FA521525P0037',
        'Recipient Name': 'MCS OF TAMPA, INC.',
        'Award Amount': 437441.54,
        'Base Obligation Date': '2025-09-30',
        'Awarding Agency': 'Department of Defense',
        'Awarding Sub Agency': 'Department of the Air Force',
        'Funding Agency': 'Department of Defense',
        'Funding Sub Agency': 'Department of the Air Force',
        'Contract Award Type': 'PURCHASE ORDER',
        Description: 'Installation of communications hardware and software.',
      }],
      page_metadata: { page: 1, hasNext: true },
      messages: ['Search data begins in FY2008 for this endpoint.'],
    }} executedRequest={awardRequest(2025, 2)}/>)

    const preview = screen.getByRole('region', { name: 'USAspending Contract Awards' })
    expect(preview).toHaveAttribute('data-preview-layout', 'federal-awards')
    const card = preview.querySelector('.federal-awards-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-fiscal-year', '2025')
    expect(card).toHaveAttribute('data-request-date-type', 'new_awards_only')
    expect(card).toHaveAttribute('data-response-limit-match', 'true')
    expect(card).toHaveAttribute('data-award-date-range-match', 'true')
    expect(card).toHaveAttribute('data-primary-award-id', 'FA521525P0037')
    expect(card).toHaveAttribute('data-primary-award-amount', '437441.54')
    expect(card).toHaveAttribute('data-primary-award-amount-semantic', 'total_obligation')
    expect(card).toHaveAttribute('data-primary-obligation-date', '2025-09-30')
    const award = preview.querySelector('[data-award-id="FA521525P0037"]')
    expect(award).toHaveAttribute('data-contract-award-type', 'PURCHASE ORDER')
    expect(preview).toHaveTextContent('$437,441.54')
    expect(preview).toHaveTextContent('Award Amount · total obligation')
    expect(preview).toHaveTextContent('new_awards_only')
    expect(preview).toHaveTextContent('Base obligation date')
    expect(preview).toHaveTextContent('Department of the Air Force')
    expect(preview).toHaveTextContent('Search data begins in FY2008')
    expect(preview).toHaveTextContent('not a single transaction amount or a potential award ceiling')
    expect(preview).not.toHaveTextContent('USAspending Contract Awards record 1')
  })

  it('marks a missing required results array invalid instead of empty', () => {
    render(<ResponseDemoPreview api={awardsApi} data={{ spending_level: 'awards', limit: 8, page_metadata: { page: 1, hasNext: false } }}/>)
    const card = screen.getByText('Invalid USAspending award response').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText('No contract awards returned')).not.toBeInTheDocument()
  })

  it('filters rows without required internal_id and marks the batch partial', () => {
    render(<ResponseDemoPreview api={awardsApi} data={{
      spending_level: 'awards', limit: 2, page_metadata: { page: 1, hasNext: false },
      results: [
        { internal_id: 101, 'Award ID': 'VALID-101', 'Recipient Name': 'Valid Recipient', 'Award Amount': 50, 'Base Obligation Date': '2026-01-02' },
        { 'Award ID': 'FABRICATED-ROW', 'Recipient Name': 'Should not render', 'Award Amount': 10, 'Base Obligation Date': '2026-01-01' },
      ],
    }} executedRequest={awardRequest(2026, 2)}/>)
    const card = screen.getByRole('region', { name: 'USAspending Contract Awards' }).querySelector('.federal-awards-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-award-count', '1')
    expect(card).toHaveAttribute('data-invalid-award-count', '1')
    expect(screen.getByText('Valid Recipient')).toBeInTheDocument()
    expect(screen.queryByText('Should not render')).not.toBeInTheDocument()
    expect(screen.queryByText('FABRICATED-ROW')).not.toBeInTheDocument()
  })

  it('uses provider internal_id instead of inventing Award N when Award ID is absent', () => {
    render(<ResponseDemoPreview api={awardsApi} data={{
      spending_level: 'awards', limit: 1, page_metadata: { page: 1, hasNext: false },
      results: [{ internal_id: 202, 'Recipient Name': 'Identity-safe recipient', 'Award Amount': 75, 'Base Obligation Date': '2026-01-03' }],
    }} executedRequest={awardRequest(2026, 1)}/>)
    const preview = screen.getByRole('region', { name: 'USAspending Contract Awards' })
    const card = preview.querySelector('.federal-awards-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-primary-internal-id', '202')
    expect(preview).toHaveTextContent('USAspending internal ID 202')
    expect(preview).not.toHaveTextContent('Award 1')
  })

  it('renders an explicit empty award state', () => {
    render(<ResponseDemoPreview api={awardsApi} data={{ spending_level: 'awards', limit: 8, results: [], page_metadata: { page: 1, hasNext: false } }} executedRequest={awardRequest(2026, 8)}/>)
    expect(screen.getByText('No contract awards returned')).toBeInTheDocument()
  })

  it('fails closed when an HTTP-200 award batch does not match the executed fiscal-year request', () => {
    render(<ResponseDemoPreview api={awardsApi} data={{
      spending_level: 'awards', limit: 1, page_metadata: { page: 1, hasNext: false },
      results: [{ internal_id: 909, 'Award ID': 'WRONG-FY', 'Recipient Name': 'Plausible but wrong', 'Award Amount': 999999, 'Base Obligation Date': '2025-09-30' }],
    }} executedRequest={awardRequest(2026, 1)}/>)

    const card = screen.getByText('Invalid USAspending award response').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText('Plausible but wrong')).not.toBeInTheDocument()
    expect(screen.queryByText('99,999')).not.toBeInTheDocument()
  })

  it('does not coerce provider numeric strings into trusted award identities or amounts', () => {
    render(<ResponseDemoPreview api={awardsApi} data={{
      spending_level: 'awards', limit: 1, page_metadata: { page: 1, hasNext: false },
      results: [{ internal_id: '909', 'Award ID': 'STRING-NUMBER', 'Recipient Name': 'Numeric string row', 'Award Amount': '125', 'Base Obligation Date': '2026-01-05' }],
    }} executedRequest={awardRequest(2026, 1)}/>)

    const card = screen.getByText('Invalid USAspending award response').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText('Numeric string row')).not.toBeInTheDocument()
  })
})
