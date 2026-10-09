import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'fema-disasters')
if (!api) throw new Error('Missing fema-disasters fixture')
const requestUrl = api.buildUrl({ limit: '5' })
const executedGet = { url: requestUrl, method: 'GET' as const }
const requestPath = new URL(requestUrl).pathname + new URL(requestUrl).search
const row = { femaDeclarationString: 'DR-4943-KS', disasterNumber: 4943, state: 'KS', declarationType: 'DR', declarationDate: '2026-09-01T00:00:00.000Z', incidentType: 'Severe Storm', declarationTitle: 'SEVERE STORMS AND FLOODING', paProgramDeclared: true, incidentBeginDate: '2026-06-18T00:00:00.000Z', incidentEndDate: '2026-06-30T00:00:00.000Z', designatedArea: 'Rawlins (County)', region: 7, lastRefresh: '2026-09-03T11:06:12.500Z', id: 'row-1' }
const response = (records: unknown[], metadata: Record<string, unknown> = {}) => ({
  metadata: { skip: 0, top: 5, orderby: 'declarationDate DESC', entityname: 'DisasterDeclarationsSummaries', version: 'v2', url: requestPath, ...metadata },
  DisasterDeclarationsSummaries: records,
})

describe('FEMA disaster declared-area semantic preview', () => {
  afterEach(cleanup)

  it('preserves area-level identity and binds the response to the executed OpenFEMA request', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={response([row, { ...row, designatedArea: 'Russell (County)', id: 'row-2' }])}/>)
    const preview = screen.getByRole('region', { name: 'FEMA Disaster Declarations' })
    const card = preview.querySelector('.fema-disaster-preview')
    expect(preview).toHaveAttribute('data-preview-layout', 'disaster-declared-areas')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-limit', '5')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-metadata-contract', 'true')
    expect(card).toHaveAttribute('data-row-count-contract', 'true')
    expect(card).toHaveAttribute('data-row-count', '2')
    expect(card).toHaveAttribute('data-unique-declaration-count', '1')
    expect(card).toHaveAttribute('data-primary-declaration-id', 'DR-4943-KS')
    expect(preview).toHaveTextContent('Rawlins (County)')
    expect(preview).toHaveTextContent('Russell (County)')
    expect(preview).toHaveTextContent('repeated disaster IDs are expected')
    expect(preview).toHaveTextContent('PA')
  })

  it('fails closed when the successful payload came from transport drift', () => {
    const payload = response([row])
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={payload}/>)
    let card = screen.getByRole('region', { name: 'FEMA Disaster Declarations' }).querySelector('[data-domain-card="disaster-declared-areas"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    card = screen.getByRole('region', { name: 'FEMA Disaster Declarations' }).querySelector('[data-domain-card="disaster-declared-areas"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: `${requestUrl}#drift`, method: 'GET' }} data={payload}/>)
    card = screen.getByRole('region', { name: 'FEMA Disaster Declarations' }).querySelector('[data-domain-card="disaster-declared-areas"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('does not mark an otherwise valid response ready when executed-request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={response([row])}/>)
    const card = screen.getByRole('region', { name: 'FEMA Disaster Declarations' }).querySelector('.fema-disaster-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-metadata-contract', 'false')
  })

  it('fails closed for unsupported executed URLs and mismatched or coerced provider metadata', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&%24skip=0`} data={response([row])}/>)
    let preview = screen.getByRole('region', { name: 'FEMA Disaster Declarations' })
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
    expect(preview).toHaveTextContent('Invalid FEMA disaster request')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([row], { top: 4 })}/>)
    preview = screen.getByRole('region', { name: 'FEMA Disaster Declarations' })
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
    expect(preview).toHaveTextContent('Invalid FEMA request acknowledgement')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([row], { top: '5' })}/>)
    preview = screen.getByRole('region', { name: 'FEMA Disaster Declarations' })
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
    expect(preview).toHaveTextContent('Invalid FEMA request acknowledgement')
  })

  it('trusts an empty result only when the exact request and provider metadata agree', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={response([])}/>)
    let preview = screen.getByRole('region', { name: 'FEMA Disaster Declarations' })
    expect(preview).toHaveTextContent('No FEMA declared-area records returned')
    expect(preview.querySelector('[data-result-state="empty"]')).toHaveAttribute('data-request-bound', 'true')

    rerender(<ResponseDemoPreview api={api} data={response([])}/>)
    preview = screen.getByRole('region', { name: 'FEMA Disaster Declarations' })
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
    expect(preview).toHaveTextContent('Unbound FEMA empty response')
  })

  it('treats a missing or non-array declared-area list as invalid instead of empty', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ metadata: response([]).metadata }}/>)
    let preview = screen.getByRole('region', { name: 'FEMA Disaster Declarations' })
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ ...response([]), DisasterDeclarationsSummaries: { ...row } }}/>)
    preview = screen.getByRole('region', { name: 'FEMA Disaster Declarations' })
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
  })

  it('omits identity-less provider rows and marks a mixed response partial', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([
      row,
      { ...row, id: undefined, femaDeclarationString: 'DR-9999-ZZ', designatedArea: 'Fabricated Area' },
    ])}/>)
    const preview = screen.getByRole('region', { name: 'FEMA Disaster Declarations' })
    const card = preview.querySelector('.fema-disaster-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).toHaveTextContent('Rawlins (County)')
    expect(preview).not.toHaveTextContent('Fabricated Area')
  })

  it('marks a row-count violation partial instead of claiming the executed limit was honored', () => {
    const oneUrl = api.buildUrl({ limit: '1' })
    const onePath = new URL(oneUrl).pathname + new URL(oneUrl).search
    render(<ResponseDemoPreview api={api} requestUrl={oneUrl} data={{ metadata: { ...response([]).metadata, top: 1, url: onePath }, DisasterDeclarationsSummaries: [row, { ...row, id: 'row-2' }] }}/>)
    const card = screen.getByRole('region', { name: 'FEMA Disaster Declarations' }).querySelector('.fema-disaster-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-row-count-contract', 'false')
  })

  it('fails invalid when no returned row has the documented provider identity', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={response([{ ...row, id: undefined }])}/>)
    const preview = screen.getByRole('region', { name: 'FEMA Disaster Declarations' })
    expect(preview.querySelector('[data-result-state="invalid"]')).toBeInTheDocument()
    expect(preview).not.toHaveTextContent('Rawlins (County)')
  })
})
