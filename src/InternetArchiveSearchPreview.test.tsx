import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { InternetArchiveSearchPreview, parseInternetArchiveRequest, parseInternetArchiveResponse } from './previews/InternetArchiveSearchPreview'

const api = getApiById('internet-archive-search')!
const requestUrl = api.buildUrl({ query: 'singapore', mediaType: 'texts' })
const fields = 'identifier,title,creator,date,mediatype,rights,licenseurl'

const item = (identifier: string, overrides: Record<string, unknown> = {}) => ({
  identifier,
  title: `Archive item ${identifier}`,
  creator: 'Example creator',
  date: '2024',
  mediatype: 'texts',
  rights: 'Rights information supplied by the uploader',
  licenseurl: 'https://creativecommons.org/licenses/by/4.0/',
  ...overrides,
})

const response = (docs: unknown[], overrides: Record<string, unknown> = {}) => ({
  responseHeader: {
    status: 0,
    params: { qin: 'singapore AND mediatype:texts', fl: fields, wt: 'json', rows: 6, start: 0 },
  },
  response: { numFound: docs.length, start: 0, docs },
  ...overrides,
})

describe('InternetArchiveSearchPreview', () => {
  it('accepts only the exact supported Advanced Search request contract', () => {
    expect(parseInternetArchiveRequest(requestUrl)).toEqual({ query: 'singapore', mediaType: 'texts', rows: 6, page: 1 })
    const url = new URL(requestUrl)
    url.searchParams.append('rows', '6')
    expect(parseInternetArchiveRequest(url.toString())).toBeUndefined()
    const reorderedFields = new URL(requestUrl)
    const values = reorderedFields.searchParams.getAll('fl[]').reverse()
    reorderedFields.searchParams.delete('fl[]')
    values.forEach((value) => reorderedFields.searchParams.append('fl[]', value))
    expect(parseInternetArchiveRequest(reorderedFields.toString())).toBeUndefined()
    expect(parseInternetArchiveRequest(requestUrl.replace('archive.org/advancedsearch.php', 'archive.org/advancedsearch.php/'))).toBeUndefined()
  })

  it('renders request-bound trusted identities and honest rights evidence', () => {
    render(<InternetArchiveSearchPreview data={response([item('singapore_history_2024'), item('singapore-text-2', { rights: undefined, licenseurl: undefined })])} requestUrl={requestUrl}/>)
    const root = screen.getByText('Internet Archive · Advanced Search').closest('[data-domain-card]')
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-contract', 'exact-internet-archive-advanced-search-v1')
    expect(root).toHaveAttribute('data-request-query', 'singapore')
    expect(root).toHaveAttribute('data-request-media-type', 'texts')
    expect(root).toHaveAttribute('data-valid-record-count', '2')
    expect(root).toHaveAttribute('data-primary-identifier', 'singapore_history_2024')
    expect(root).toHaveAttribute('data-rights-evidence-count', '1')
    expect(root).toHaveAttribute('data-license-evidence-count', '1')
    expect(screen.getAllByRole('link', { name: 'Archive item source' })[0]).toHaveAttribute('href', 'https://archive.org/details/singapore_history_2024')
    expect(screen.getByText(/does not guarantee copyright status/i)).toBeInTheDocument()
  })

  it('withholds malformed optional rights evidence and duplicate identities as partial', () => {
    const malformed = item('singapore_history_2024', { creator: 42, rights: { text: 'not a provider text field' }, licenseurl: 'https://example.com/not-recognized' })
    render(<InternetArchiveSearchPreview data={response([malformed, item('singapore_history_2024')])} requestUrl={requestUrl}/>)
    const root = screen.getByText('Internet Archive · Advanced Search').closest('[data-domain-card]')
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-valid-record-count', '1')
    expect(root).toHaveAttribute('data-duplicate-record-count', '1')
    expect(root).toHaveAttribute('data-optional-warning-count', '1')
    expect(root).toHaveAttribute('data-rights-evidence-count', '0')
    expect(screen.queryByRole('link', { name: 'License evidence' })).not.toBeInTheDocument()
  })

  it('rejects malformed request acknowledgement and native-integer violations', () => {
    const badEcho = response([item('singapore_history_2024')])
    ;(badEcho.responseHeader.params as Record<string, unknown>).rows = '6'
    expect(parseInternetArchiveResponse(badEcho, requestUrl).invalidReason).toMatch(/acknowledge/i)
    render(<InternetArchiveSearchPreview data={badEcho} requestUrl={requestUrl}/>)
    expect(screen.getByText('Invalid Internet Archive search response').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when a nonempty batch has no trustworthy item identity', () => {
    render(<InternetArchiveSearchPreview data={response([item('../unsafe', { title: '', mediatype: 'audio' })])} requestUrl={requestUrl}/>)
    expect(screen.getByText('Archive item evidence unavailable').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('renders only a coherent provider-zero page as empty', () => {
    const { rerender } = render(<InternetArchiveSearchPreview data={response([])} requestUrl={requestUrl}/>)
    expect(screen.getByText('No Internet Archive items matched').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'empty')
    rerender(<InternetArchiveSearchPreview data={response([], { response: { numFound: 1, start: 0, docs: [] } })} requestUrl={requestUrl}/>)
    expect(screen.getByText('Invalid Internet Archive empty response').closest('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
  })
})
