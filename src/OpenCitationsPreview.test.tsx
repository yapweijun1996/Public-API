import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'opencitations-index')
if (!api) throw new Error('Missing opencitations-index fixture')
const requestUrl = 'https://api.opencitations.net/index/v2/citation-count/doi:10.1109%2F5.771073'
const executedGet = { url: requestUrl, method: 'GET' }

describe('OpenCitations semantic preview', () => {
  afterEach(cleanup)

  it('binds the provider citation count to the DOI from the request URL', () => {
    render(<ResponseDemoPreview api={api} data={[{ count: '98' }]} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const preview = screen.getByRole('region', { name: 'OpenCitations Citation Count' })
    expect(preview).toHaveAttribute('data-preview-layout', 'citation-count')
    const card = preview.querySelector('.opencitations-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-provider-record-count', '1')
    expect(card).toHaveAttribute('data-count-contract-valid', 'true')
    expect(card).toHaveAttribute('data-primary-doi', '10.1109/5.771073')
    expect(card).toHaveAttribute('data-incoming-citation-count', '98')
    expect(preview).toHaveTextContent('98 incoming citations')
    expect(preview).toHaveTextContent('10.1109/5.771073')
    expect(preview).toHaveTextContent('Incoming / cited by other works')
    expect(preview).not.toHaveTextContent('OpenCitations Citation Count record 1')
  })

  it('does not trust a canonical DOI display URL when the actual transport identity differs', () => {
    const { rerender } = render(<ResponseDemoPreview
      api={api}
      data={[{ count: '98' }]}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl, method: 'POST' }}
    />)
    let preview = screen.getByRole('region', { name: 'OpenCitations Citation Count' })
    expect(preview.querySelector('[data-domain-card="citation-count"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview
      api={api}
      data={[{ count: '98' }]}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }}
    />)
    preview = screen.getByRole('region', { name: 'OpenCitations Citation Count' })
    expect(preview.querySelector('[data-domain-card="citation-count"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview
      api={api}
      data={[{ count: '98' }]}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl.replace('10.1109%2F5.771073', '10.1038%2Fnphys1170'), method: 'GET' }}
    />)
    preview = screen.getByRole('region', { name: 'OpenCitations Citation Count' })
    expect(preview.querySelector('[data-domain-card="citation-count"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('keeps a provider zero count ready instead of misclassifying it as empty', () => {
    render(<ResponseDemoPreview api={api} data={[{ count: '0' }]} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const preview = screen.getByRole('region', { name: 'OpenCitations Citation Count' })
    const card = preview.querySelector('.opencitations-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-incoming-citation-count', '0')
    expect(preview).toHaveTextContent('0 incoming citations')
    expect(preview).toHaveTextContent('A zero count means the Index currently records no incoming citations')
  })

  it('fails closed when an HTTP-success body is not the documented result array', () => {
    render(<ResponseDemoPreview api={api} data={{ count: '98' }} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'OpenCitations Citation Count' })
    expect(preview.querySelector('[data-domain-card="citation-count"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('documented citation-count result array')
  })

  it('fails closed when the provider array does not contain exactly one count record', () => {
    render(<ResponseDemoPreview api={api} data={[]} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'OpenCitations Citation Count' })
    expect(preview.querySelector('[data-domain-card="citation-count"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('exactly one count record')
  })

  it('rejects negative, fractional, or missing citation counts', () => {
    for (const count of ['-1', '1.5', undefined]) {
      cleanup()
      render(<ResponseDemoPreview api={api} data={[{ count }]} requestUrl={requestUrl}/>)
      const preview = screen.getByRole('region', { name: 'OpenCitations Citation Count' })
      expect(preview.querySelector('[data-domain-card="citation-count"]')).toHaveAttribute('data-result-state', 'invalid')
      expect(preview).toHaveTextContent('non-negative integer incoming-citation count')
    }
  })

  it('keeps the DOI visible but partial when the successful executed transport identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={[{ count: '12' }]} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'OpenCitations Citation Count' })
    const card = preview.querySelector('.opencitations-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-primary-doi', '10.1109/5.771073')
    expect(card).toHaveAttribute('data-incoming-citation-count', '12')
    expect(preview).toHaveTextContent('Partial request identity')
    expect(preview).toHaveTextContent('successful executed transport identity is unavailable')
  })
})
