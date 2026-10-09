import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'canada-open-data-search')
if (!api) throw new Error('Missing Canada Open Data fixture')

const requestUrl = 'https://open.canada.ca/data/api/3/action/package_search?q=climate&rows=3'
const executedRequest = (url = requestUrl, method = 'GET', body?: unknown): ExecutedRequestContext => ({ url, method, ...(body === undefined ? {} : { body }) })
const preview = (data: unknown, url = requestUrl, request: ExecutedRequestContext | undefined = executedRequest(url)) => <ResponseDemoPreview api={api} data={data} requestUrl={url} executedRequest={request}/>

describe('Canada Open Data semantic preview', () => {
  afterEach(cleanup)

  it('preserves dataset/publication identity, bilingual metadata, licence, and resource semantics', () => {
    render(preview({ success: true, result: { count: 2863, results: [{
      id: '09ffaeb5-ec8f-5bb5-bdcb-3436ccf26f58',
      title: 'Climatic Regions', title_translated: { en: 'Climatic Regions', fr: 'Régions climatiques' },
      notes: 'Historical climatic regions.', notes_translated: { en: 'Historical climatic regions.', fr: 'Régions climatiques historiques.' },
      collection: 'geogratis', type: 'dataset',
      organization: { title: 'Natural Resources Canada | Ressources naturelles Canada' },
      date_published: '1957-01-01 00:00:00', portal_release_date: '2017-01-18',
      license_title: 'Open Government Licence - Canada', restrictions: 'unrestricted',
      resources: [
        { format: 'JPG', language: ['en', 'fr'], resource_type: 'dataset' },
        { format: 'PDF', language: ['en', 'fr'], resource_type: 'dataset' },
      ],
    }] } }))

    const previewRoot = screen.getByRole('region', { name: 'Canada Open Data Search' })
    expect(previewRoot).toHaveAttribute('data-preview-layout', 'open-data-catalog')
    expect(previewRoot).toHaveAttribute('data-ssot-fallback', 'false')
    const card = previewRoot.querySelector('.canada-open-data-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-canada-open-data-package-search-v2')
    expect(card).toHaveAttribute('data-total-results', '2863')
    expect(card).toHaveAttribute('data-primary-record-id', '09ffaeb5-ec8f-5bb5-bdcb-3436ccf26f58')
    expect(card).toHaveAttribute('data-primary-record-type', 'dataset')
    const record = previewRoot.querySelector('[data-record-id="09ffaeb5-ec8f-5bb5-bdcb-3436ccf26f58"]')
    expect(record).toHaveAttribute('data-record-type', 'dataset')
    expect(record).toHaveAttribute('data-collection', 'geogratis')
    expect(record).toHaveAttribute('data-license', 'Open Government Licence - Canada')
    expect(record).toHaveAttribute('data-resource-count', '2')
    expect(previewRoot).toHaveTextContent('Climatic Regions')
    expect(previewRoot).toHaveTextContent('Régions climatiques')
    expect(previewRoot).toHaveTextContent('Natural Resources Canada | Ressources naturelles Canada')
    expect(previewRoot).toHaveTextContent('JPG · PDF')
    expect(previewRoot).toHaveTextContent('en · fr')
    expect(previewRoot).toHaveTextContent('2,863 matches total')
    expect(previewRoot).not.toHaveTextContent('Canada Open Data Search record 1')
  })

  it('rejects a successful response when the executed transport is POST even if the displayed URL is canonical', () => {
    render(preview({ success: true, result: { count: 1, results: [{ id: 'record-1', title: 'Climate record', type: 'dataset', collection: 'primary' }] } }, requestUrl, executedRequest(requestUrl, 'POST')))
    const card = screen.getByRole('region', { name: 'Canada Open Data Search' }).querySelector('[data-domain-card="open-data-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('Invalid Canada Open Data request identity')
  })

  it('keeps coherent provider data partial when executed request evidence is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={{ success: true, result: { count: 1, results: [{ id: 'record-1', title: 'Climate record', type: 'dataset', collection: 'primary' }] } }} requestUrl={requestUrl}/>)
    const card = screen.getByRole('region', { name: 'Canada Open Data Search' }).querySelector('.canada-open-data-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-request-contract', 'exact-canada-open-data-package-search-v2')
    expect(card).toHaveTextContent('Executed request evidence was unavailable')
  })

  it('rejects POST, GET-with-body, and executed URL drift', () => {
    const data = { success: true, result: { count: 1, results: [{ id: 'record-1', title: 'Climate record', type: 'dataset', collection: 'primary' }] } }
    const cases = [
      executedRequest(requestUrl, 'POST'),
      executedRequest(requestUrl, 'GET', { q: 'climate' }),
      executedRequest('https://open.canada.ca/data/api/3/action/package_search?q=weather&rows=3'),
    ]
    const { rerender } = render(preview(data, requestUrl, cases[0]))
    for (const request of cases) {
      rerender(preview(data, requestUrl, request))
      const card = screen.getByRole('region', { name: 'Canada Open Data Search' }).querySelector('[data-domain-card="open-data-catalog"]')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
      expect(card).toHaveTextContent('Invalid Canada Open Data request identity')
    }
  })

  it('does not relabel a provider publication as a dataset', () => {
    render(preview({ success: true, result: { count: 1, results: [{
      id: 'publication-1', title: 'Artificial Intelligence - ITSAP.00.040', collection: 'publication', type: 'info',
      organization: { title: 'Communications Security Establishment Canada' }, license_title: 'Open Government Licence - Canada', restrictions: 'unrestricted',
      resources: [{ format: 'HTML', language: ['en'], resource_type: 'publication' }],
    }] } }))
    const record = screen.getByRole('region', { name: 'Canada Open Data Search' }).querySelector('[data-record-id="publication-1"]')
    expect(record).toHaveAttribute('data-record-type', 'info')
    expect(record).toHaveAttribute('data-collection', 'publication')
    expect(record).toHaveTextContent('info · collection publication')
    expect(record).not.toHaveTextContent('dataset · collection publication')
  })

  it('fails semantically closed for malformed HTTP-success search shapes', () => {
    const { rerender } = render(preview({ success: true, result: { count: 1, results: { id: 'not-an-array' } } }))
    let card = screen.getByRole('region', { name: 'Canada Open Data Search' }).querySelector('[data-domain-card="open-data-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('Invalid Canada Open Data response')

    rerender(preview({ success: false, result: { count: 0, results: [] } }))
    card = screen.getByRole('region', { name: 'Canada Open Data Search' }).querySelector('[data-domain-card="open-data-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('marks mixed provider records partial and never invents catalogue identity', () => {
    render(preview({ success: true, result: { count: 2, results: [
      { id: 'real-record', name: 'real-record', title: 'Provider title', type: 'dataset', collection: 'primary' },
      { type: 'dataset', collection: 'primary', notes: 'Missing provider identity and title.' },
    ] } }))
    const previewRoot = screen.getByRole('region', { name: 'Canada Open Data Search' })
    const card = previewRoot.querySelector('.canada-open-data-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-usable-record-count', '1')
    expect(card).toHaveAttribute('data-malformed-record-count', '1')
    expect(previewRoot).toHaveTextContent('Provider title')
    expect(previewRoot).not.toHaveTextContent('Catalogue record 2')
    expect(previewRoot.querySelector('[data-record-id="record-2"]')).toBeNull()
  })

  it('keeps a genuine zero-result CKAN search empty', () => {
    render(preview({ success: true, result: { count: 0, results: [] } }))
    const card = screen.getByRole('region', { name: 'Canada Open Data Search' }).querySelector('[data-domain-card="open-data-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveTextContent('No Canadian open-government records returned')
  })

  it('fails closed when the executed CKAN request identity is not the admitted q+rows search contract', () => {
    render(preview({ success: true, result: { count: 1, results: [{ id: 'record-1', title: 'Climate record', type: 'dataset', collection: 'primary' }] } }, `${requestUrl}&start=0`))
    const card = screen.getByRole('region', { name: 'Canada Open Data Search' }).querySelector('[data-domain-card="open-data-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('Invalid Canada Open Data request identity')
  })

  it('does not trust numeric-string provider counts', () => {
    render(preview({ success: true, result: { count: '1', results: [{ id: 'record-1', title: 'Climate record', type: 'dataset', collection: 'primary' }] } }))
    const card = screen.getByRole('region', { name: 'Canada Open Data Search' }).querySelector('.canada-open-data-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-count-contract', 'invalid')
  })

  it('binds returned row count to the executed rows limit', () => {
    const oneRowUrl = 'https://open.canada.ca/data/api/3/action/package_search?q=climate&rows=1'
    render(preview({ success: true, result: { count: 2, results: [
      { id: 'record-1', title: 'Climate record one', type: 'dataset', collection: 'primary' },
      { id: 'record-2', title: 'Climate record two', type: 'dataset', collection: 'primary' },
    ] } }, oneRowUrl))
    const card = screen.getByRole('region', { name: 'Canada Open Data Search' }).querySelector('.canada-open-data-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-requested-query', 'climate')
    expect(card).toHaveAttribute('data-requested-rows', '1')
    expect(card).toHaveAttribute('data-row-limit-contract', 'invalid')
  })
})
