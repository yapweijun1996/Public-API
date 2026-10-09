import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const api = apiCatalog.find((candidate) => candidate.id === 'uk-food-hygiene')
if (!api) throw new Error('Missing uk-food-hygiene fixture')

const request = (name = 'Cafe', count = '5'): ExecutedRequestContext => ({
  method: 'GET',
  url: api.buildUrl({ name, count }),
})

const providerSelf = (name = 'Cafe', count = '5') => [{
  rel: 'self',
  href: `https://api.ratings.food.gov.uk/establishments?name=${encodeURIComponent(name.toLocaleLowerCase('en-GB'))}&pagenumber=1&pagesize=${count}`,
}]

describe('UK food hygiene rating semantic preview', () => {
  afterEach(cleanup)

  it('distinguishes the overall rating direction from intervention component scores', () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={{ meta: { itemCount: 1, totalCount: 42, totalPages: 9, pageSize: 5, pageNumber: 1 }, links: providerSelf(), establishments: [{ FHRSID: 79912, BusinessName: 'Cafe Cafe', BusinessType: 'Restaurant/Cafe/Canteen', AddressLine2: '108 Bute Street', AddressLine3: 'Treorchy', PostCode: 'CF42 6AU', RatingValue: '5', RatingDate: '2025-11-10T00:00:00', SchemeType: 'FHRS', NewRatingPending: false, LocalAuthorityName: 'Rhondda Cynon Taf', scores: { Hygiene: 5, Structural: 25, ConfidenceInManagement: 30 }, geocode: { longitude: '-3.507796', latitude: '51.660498' } }] }}/>)
    const preview = screen.getByRole('region', { name: 'UK Food Hygiene Ratings' })
    expect(preview).toHaveAttribute('data-preview-layout', 'food-hygiene-ratings')
    const card = preview.querySelector('.food-hygiene-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-name', 'Cafe')
    expect(card).toHaveAttribute('data-request-page-size', '5')
    expect(card).toHaveAttribute('data-provider-record-count', '1')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-query-contract-valid', 'true')
    expect(card).toHaveAttribute('data-provider-self-contract', 'valid')
    expect(card).toHaveAttribute('data-provider-total-count', '42')
    expect(card).toHaveAttribute('data-count-contract-valid', 'true')
    expect(card).toHaveAttribute('data-pagination-contract-valid', 'true')
    expect(card).toHaveAttribute('data-primary-fhrs-id', '79912')
    expect(card).toHaveAttribute('data-score-direction', 'lower-intervention-score-is-better')
    expect(preview).toHaveTextContent('5/5 · Very good')
    expect(preview).toHaveTextContent('Hygiene5 · Good')
    expect(preview).toHaveTextContent('Structural25 · Urgent improvement necessary')
    expect(preview).toHaveTextContent('Confidence in management30 · Urgent improvement necessary')
    expect(preview).toHaveTextContent('component intervention scores run in the opposite direction')
  })

  it('does not fabricate FHRS component scores for another scheme', () => {
    render(<ResponseDemoPreview api={api} executedRequest={request('Scottish')} data={{ meta: { itemCount: 1, totalCount: 1, totalPages: 1, pageSize: 5, pageNumber: 1 }, links: providerSelf('Scottish'), establishments: [{ FHRSID: 1, BusinessName: 'Scottish Shop', RatingValue: 'Pass', SchemeType: 'FHIS' }] }}/>)
    expect(screen.getByRole('region', { name: 'UK Food Hygiene Ratings' })).toHaveTextContent('Component scores are not supplied for this record or scheme.')
  })

  it('distinguishes a documented zero-result search from a malformed HTTP-success body', () => {
    const executedRequest = request()
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={{ meta: { itemCount: 0, totalCount: 0, totalPages: 0, pageSize: 5, pageNumber: 1 }, links: providerSelf(), establishments: [] }}/>)
    let preview = screen.getByRole('region', { name: 'UK Food Hygiene Ratings' })
    expect(preview.querySelector('[data-domain-card="food-hygiene-ratings"]')).toHaveAttribute('data-result-state', 'empty')

    rerender(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={{ meta: { itemCount: 0, totalCount: 0, pageSize: 5, pageNumber: 1 }, links: providerSelf() }}/>)
    preview = screen.getByRole('region', { name: 'UK Food Hygiene Ratings' })
    expect(preview.querySelector('[data-domain-card="food-hygiene-ratings"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('did not include the documented establishments array')

    rerender(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={{ meta: { itemCount: 0, totalCount: 3, totalPages: 1, pageSize: 5, pageNumber: 1 }, links: providerSelf(), establishments: [] }}/>)
    preview = screen.getByRole('region', { name: 'UK Food Hygiene Ratings' })
    expect(preview.querySelector('[data-domain-card="food-hygiene-ratings"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('without a matching zero-result pagination contract')
  })

  it('marks mixed establishment rows partial and excludes rows without provider-owned FHRS IDs', () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={{
      meta: { itemCount: 2, totalCount: 2, totalPages: 1, pageSize: 5, pageNumber: 1 },
      links: providerSelf(),
      establishments: [
        { FHRSID: 79912, BusinessName: 'Cafe Cafe', RatingValue: '5', SchemeType: 'FHRS' },
        { BusinessName: 'Fabricated Cafe Establishment', RatingValue: '5', SchemeType: 'FHRS' },
      ],
    }}/>)

    const preview = screen.getByRole('region', { name: 'UK Food Hygiene Ratings' })
    const card = preview.querySelector('.food-hygiene-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveAttribute('data-count-contract-valid', 'true')
    expect(preview).toHaveTextContent('Cafe Cafe')
    expect(preview).not.toHaveTextContent('Fabricated Cafe Establishment')
    expect(preview).not.toHaveTextContent('FHRS IDNot supplied')
  })

  it('fails closed when an identified row cannot prove the executed name search', () => {
    render(<ResponseDemoPreview api={api} executedRequest={request('Cafe')} data={{ meta: { itemCount: 1, totalCount: 1, totalPages: 1, pageSize: 5, pageNumber: 1 }, links: providerSelf(), establishments: [{ FHRSID: 12345, SchemeType: 'FHRS', RatingValue: '4' }] }}/>)
    const preview = screen.getByRole('region', { name: 'UK Food Hygiene Ratings' })
    expect(preview.querySelector('[data-domain-card="food-hygiene-ratings"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('FHRS ID 12,345')
  })

  it('fails closed when the provider self link acknowledges a different business-name search', () => {
    render(<ResponseDemoPreview api={api} executedRequest={request('Cafe')} data={{ meta: { itemCount: 1, totalCount: 1, totalPages: 1, pageSize: 5, pageNumber: 1 }, links: providerSelf('Burger'), establishments: [{ FHRSID: 98765, BusinessName: 'Burger House', SchemeType: 'FHRS', RatingValue: '5' }] }}/>)
    const preview = screen.getByRole('region', { name: 'UK Food Hygiene Ratings' })
    const card = preview.querySelector('[data-domain-card="food-hygiene-ratings"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Burger House')
  })

  it('does not trust numeric-string pagination or FHRS identity fields', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={request()} data={{ meta: { itemCount: '1', totalCount: '1', totalPages: '1', pageSize: '5', pageNumber: '1' }, links: providerSelf(), establishments: [{ FHRSID: 79912, BusinessName: 'Cafe Cafe', SchemeType: 'FHRS', RatingValue: '5' }] }}/>)
    let card = screen.getByRole('region', { name: 'UK Food Hygiene Ratings' }).querySelector('.food-hygiene-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-pagination-contract-valid', 'false')

    rerender(<ResponseDemoPreview api={api} executedRequest={request()} data={{ meta: { itemCount: 1, totalCount: 1, totalPages: 1, pageSize: 5, pageNumber: 1 }, links: providerSelf(), establishments: [{ FHRSID: '79912', BusinessName: 'Cafe Cafe', SchemeType: 'FHRS', RatingValue: '5' }] }}/>)
    const preview = screen.getByRole('region', { name: 'UK Food Hygiene Ratings' })
    expect(preview.querySelector('[data-domain-card="food-hygiene-ratings"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Cafe Cafe')
  })
})
