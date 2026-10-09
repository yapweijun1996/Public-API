import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'malaysia-household-income')
if (!api) throw new Error('Missing malaysia-household-income fixture')
const requestUrl = 'https://api.data.gov.my/data-catalogue/?id=hh_income&limit=10&sort=-date'
const validRows = [
  { date: '2024-01-01', income_mean: 9155, income_median: 7017 },
  { date: '2022-01-01', income_mean: 8479, income_median: 6338 },
  { date: '2020-01-01', income_mean: 7089, income_median: 5209 },
]
const executedGet = { url: requestUrl, method: 'GET' }

describe('Malaysia household income semantic preview', () => {
  afterEach(cleanup)

  it('preserves nominal mean and median HIES survey observations', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={validRows}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Household Income' })
    expect(preview).toHaveAttribute('data-preview-layout', 'household-income')
    const card = preview.querySelector('.household-income-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-provider-record-count', '3')
    expect(card).toHaveAttribute('data-valid-record-count', '3')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-latest-date', '2024-01-01')
    expect(card).toHaveAttribute('data-latest-mean-rm', '9155')
    expect(card).toHaveAttribute('data-latest-median-rm', '7017')
    expect(card).toHaveAttribute('data-price-basis', 'nominal')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-limit', '10')
    expect(card).toHaveAttribute('data-row-limit-contract', 'valid')
    expect(card).toHaveAttribute('data-sort-contract', 'valid')
    expect(preview).toHaveTextContent('RM 7,017')
    expect(preview).toHaveTextContent('not inflation-adjusted')
    expect(screen.getByRole('img', { name: 'Malaysia median monthly household income trend' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Malaysia mean monthly household income trend' })).toBeInTheDocument()
  })

  it('treats the documented empty array as semantic empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={[]}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Household Income' }).querySelector('[data-domain-card="household-income"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
  })

  it('fails closed when HTTP-success data is not the documented array', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ data: validRows }}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Household Income' })
    expect(preview.querySelector('[data-domain-card="household-income"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('without the documented household-income array')
  })

  it('fails closed when all rows are malformed instead of calling them empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={[{ date: '2024-02-01', income_mean: 9155, income_median: 7017 }, { date: '2022-01-01', income_mean: 'not-a-number', income_median: 6338 }]}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Household Income' })
    expect(preview.querySelector('[data-domain-card="household-income"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('annual date and native integer mean/median RM values')
  })

  it('marks mixed valid and malformed provider rows partial without fabricating an observation', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={[validRows[0], { date: 'bad-date', income_mean: 999999, income_median: 888888 }]}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Household Income' })
    const card = preview.querySelector('.household-income-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).toHaveTextContent('incomplete or inconsistent with the executed request')
    expect(preview).not.toHaveTextContent('RM 888,888')
  })

  it('fails closed when the executed household-income request has an undeclared query parameter', () => {
    render(<ResponseDemoPreview api={api} requestUrl="https://api.data.gov.my/data-catalogue/?id=hh_income&limit=10&sort=-date&start=0" data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Household Income' }).querySelector('[data-domain-card="household-income"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('does not trust numeric-string household-income amounts as provider integer evidence', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={[{ date: '2024-01-01', income_mean: '9155', income_median: '7017' }]}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Household Income' }).querySelector('[data-domain-card="household-income"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when the displayed canonical URL was actually executed as POST', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Household Income' }).querySelector('[data-domain-card="household-income"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('keeps coherent data partial when executed transport identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Household Income' }).querySelector('[data-domain-card="household-income"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

})
