import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'fdic-bankfind')!
const requestUrl = api.buildUrl({ bankName: 'Wells Fargo', count: '6' })
const record = {
  NAME: 'Wells Fargo Bank, National Association',
  CERT: 3511,
  ID: '3511',
  ACTIVE: 1,
  INACTIVE: 0,
  ADDRESS: '3201 N 4th Ave',
  CITY: 'Sioux Falls',
  STALP: 'SD',
  ZIP: '57104',
  ESTYMD: '01/01/1870',
  INSDATE: '01/01/1934',
  ASSET: 1907928000,
  DEP: 1563534000,
  DEPDOM: 1554614000,
  OFFICES: 4184,
  REGAGNT: 'OCC',
  REPDTE: '06/30/2026',
  BKCLASS: 'N',
  FDICREGN: 'Kansas City',
  INSFDIC: 1,
}

const response = (
  rows: unknown[],
  { total = rows.length, search = 'NAME: WELLS FARGO', limit = '6' }: { total?: unknown; search?: unknown; limit?: unknown } = {},
) => ({ meta: { total, parameters: { filters: '', limit, search } }, data: rows })

const wrapped = (bank: Record<string, unknown> = record) => ({ data: bank, score: 1065.5092 })
const card = () => screen.getByRole('region', { name: 'FDIC BankFind Suite' }).querySelector('.bank-institution-preview') as HTMLElement
const metric = (root: HTMLElement, label: string) => within(root).getByText(label).parentElement?.querySelector('dd')?.textContent

describe('FDIC BankFind semantic identity', () => {
  afterEach(cleanup)

  it('keeps FDIC input validation in the catalog SSOT and does not silently rewrite explicit invalid values', () => {
    expect(api.fields.find((field) => field.id === 'bankName')).toMatchObject({ minLength: 1 })
    expect(api.fields.find((field) => field.id === 'count')).toMatchObject({ min: 1, max: 20, step: 1 })

    const blank = new URL(api.buildUrl({ bankName: '   ', count: '6' }))
    expect(blank.searchParams.get('search')).toBe('NAME: ')
    expect(blank.searchParams.get('limit')).toBe('6')

    const fractional = new URL(api.buildUrl({ bankName: 'Wells Fargo', count: '6.5' }))
    expect(fractional.searchParams.get('limit')).toBe('6.5')
  })

  it('renders a request-bound institution search only when FDIC acknowledges its search and limit', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([wrapped()], { total: 35 })}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-requested-search', 'NAME: WELLS FARGO')
    expect(root).toHaveAttribute('data-requested-limit', '6')
    expect(root).toHaveAttribute('data-provider-search', 'NAME: WELLS FARGO')
    expect(root).toHaveAttribute('data-provider-limit', '6')
    expect(root).toHaveAttribute('data-acknowledgement-match', 'true')
    expect(root).toHaveAttribute('data-request-contract-valid', 'true')
    expect(root).toHaveAttribute('data-provider-total', '35')
    expect(root).toHaveAttribute('data-provider-match-count', '35')
    expect(root).toHaveAttribute('data-provider-record-count', '1')
    expect(root).toHaveAttribute('data-valid-record-count', '1')
    expect(root).toHaveAttribute('data-primary-fdic-certificate', '3511')
    expect(root).toHaveAttribute('data-primary-status', 'Active')
    expect(within(root).getByText(record.NAME)).toBeInTheDocument()
  })

  it('allows fuzzy name results instead of inventing an exact-name identity rule', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([wrapped({ ...record, NAME: 'Wells Fargo National Bank West' })])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveTextContent('Wells Fargo National Bank West')
  })

  it('distinguishes a coherent zero-record result from malformed HTTP-success envelopes', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([], { total: 0 })}/>)
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveTextContent('No FDIC institutions found')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ meta: { total: 0, parameters: { search: 'NAME: WELLS FARGO', limit: '6' } } }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid FDIC record envelope')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ meta: { total: 0, parameters: { search: 'NAME: WELLS FARGO', limit: '6' } }, data: {} }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid FDIC record envelope')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([], { total: 1 })}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid empty FDIC response')

    rerender(<ResponseDemoPreview api={api} data={response([], { total: 0 })}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-acknowledgement-match', 'false')
  })

  it('fails closed when provider acknowledgement or total/row coherence does not match the request', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([wrapped()], { search: 'NAME: BANK OF AMERICA' })}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-acknowledgement-match', 'false')
    expect(card()).toHaveAttribute('data-request-contract-valid', 'false')
    expect(card()).toHaveAttribute('data-primary-bank-name', '')
    expect(card()).toHaveAttribute('data-primary-fdic-certificate', '')
    expect(card()).not.toHaveTextContent(record.NAME)

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([wrapped()], { total: '1' })}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={api.buildUrl({ bankName: 'Wells Fargo', count: '1' })} data={response([wrapped(), wrapped({ ...record, CERT: 27389, ID: '27389' })], { total: 2, limit: '1' })}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when the canonical URL was executed with a non-GET method or request body', () => {
    const data = response([wrapped()])
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={data}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-contract-valid', 'false')
    expect(card()).toHaveTextContent('Invalid FDIC request identity')
    expect(card()).not.toHaveTextContent(record.NAME)

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={data}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-contract-valid', 'false')
    expect(card()).toHaveTextContent('Invalid FDIC request identity')
    expect(card()).not.toHaveTextContent(record.NAME)
  })

  it('rejects HTTP-success data when the request URL contains undeclared, duplicate, missing-format, or non-canonical request semantics', () => {
    const variants = [
      `${requestUrl}&foo=bar`,
      `${requestUrl}&limit=2`,
      requestUrl.replace('&format=json', ''),
      requestUrl.replace('limit=6', 'limit=06'),
      requestUrl.replace('/banks/institutions?', '/banks/institutions/?'),
    ]

    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={variants[0]} data={response([wrapped()])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveTextContent('Invalid FDIC request identity')
    for (const requestVariant of variants.slice(1)) {
      rerender(<ResponseDemoPreview api={api} requestUrl={requestVariant} data={response([wrapped()])}/>)
      expect(card()).toHaveAttribute('data-result-state', 'invalid')
      expect(card()).toHaveAttribute('data-request-contract-valid', 'false')
      expect(card()).not.toHaveTextContent(record.NAME)
    }
  })

  it('requires the nested FDIC row shape and matching positive CERT/ID identities', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([wrapped({ ...record, CERT: 3511, ID: '27389', NAME: 'Fabricated Bank' })])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-invalid-record-count', '1')
    expect(card()).toHaveTextContent('Invalid FDIC institution identity')
    expect(card()).not.toHaveTextContent('Fabricated Bank')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([{ ...record }])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([{ data: record }])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([wrapped({ ...record, CERT: 0, ID: '0' })])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('omits identity-incoherent rows and marks a mixed provider batch partial', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([
      wrapped(),
      wrapped({ ...record, CERT: 27389, ID: '3511', NAME: 'Fabricated Bank' }),
    ], { total: 2 })}/>)
    const root = card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-provider-record-count', '2')
    expect(root).toHaveAttribute('data-valid-record-count', '1')
    expect(root).toHaveAttribute('data-invalid-record-count', '1')
    expect(root).toHaveTextContent(record.NAME)
    expect(root).not.toHaveTextContent('Fabricated Bank')
  })

  it('keeps identity-coherent incomplete rows visible as partial and preserves legitimate zero values', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([wrapped({ ...record, NAME: '', ASSET: undefined })])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-incomplete-record-count', '1')
    expect(card()).toHaveTextContent('FDIC certificate 3511')
    expect(metric(card(), 'Total assets ($000s)')).toBe('—')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([wrapped({ ...record, ASSET: 0, DEP: 0, OFFICES: 0 })])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-primary-assets-thousands', '0')
    expect(card()).toHaveAttribute('data-primary-deposits-thousands', '0')
    expect(card()).toHaveAttribute('data-primary-office-count', '0')
    expect(metric(card(), 'Total assets ($000s)')).toBe('0')
    expect(metric(card(), 'Total deposits ($000s)')).toBe('0')
    expect(metric(card(), 'Offices')).toBe('0')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([wrapped({ ...record, DEPDOM: '1554614000', INSFDIC: '1' })])}/>)
    expect(metric(card(), 'Domestic deposits ($000s)')).toBe('—')
    expect(within(card()).queryByText('FDIC insured', { selector: 'footer span' })).not.toBeInTheDocument()
  })

  it('does not claim request-bound readiness when the executed URL is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={response([wrapped()])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-requested-search', '')
    expect(card()).toHaveAttribute('data-request-contract-valid', 'false')
    expect(card()).toHaveTextContent(record.NAME)
  })
})
