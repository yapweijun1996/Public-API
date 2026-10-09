import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'malaysia-population')
if (!api) throw new Error('Missing malaysia-population fixture')
const requestUrl = 'https://api.data.gov.my/data-catalogue/?id=population_malaysia&filter=both%40sex%2Coverall%40age%2Coverall%40ethnicity&limit=10&sort=-date'
const validRows = [
  { date: '2026-01-01', sex: 'both', age: 'overall', ethnicity: 'overall', population: 34389.4 },
  { date: '2025-01-01', sex: 'both', age: 'overall', ethnicity: 'overall', population: 34220.5 },
]
const executedGet = { url: requestUrl, method: 'GET' }

describe('Malaysia population semantic preview', () => {
  afterEach(cleanup)

  it('renders one national total per year and preserves the provider thousand-person unit', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={validRows}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Population' })
    expect(preview).toHaveAttribute('data-preview-layout', 'population-total')
    const card = preview.querySelector('.malaysia-population-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '2')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-primary-population-thousand', '34389.4')
    expect(card).toHaveAttribute('data-primary-population-people', '34389400')
    expect(card).toHaveAttribute('data-sex', 'both')
    expect(card).toHaveAttribute('data-age', 'overall')
    expect(card).toHaveAttribute('data-ethnicity', 'overall')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-limit', '10')
    expect(card).toHaveAttribute('data-row-limit-contract', 'valid')
    expect(card).toHaveAttribute('data-sort-contract', 'valid')
    expect(preview).toHaveTextContent('34,389,400')
    expect(preview).toHaveTextContent("Provider raw ('000 people)34,389.4")
    expect(screen.getByRole('img', { name: 'Malaysia total population trend' })).toBeInTheDocument()
  })

  it('treats the documented empty array as semantic empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet} data={[]}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Population' }).querySelector('[data-domain-card="population-total"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
  })

  it('fails closed when HTTP-success data is not the documented array', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ data: validRows }}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Population' })
    expect(preview.querySelector('[data-domain-card="population-total"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('without the documented national-population observation array')
  })

  it('fails closed rather than using a demographic slice or malformed annual date as the national total', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={[
      { date: '2026-01-01', sex: 'both', age: '0-4', ethnicity: 'overall', population: 2165.4 },
      { date: '2025-07-01', sex: 'both', age: 'overall', ethnicity: 'overall', population: 34220.5 },
    ]}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Population' })
    expect(preview.querySelector('[data-domain-card="population-total"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('annual date, overall demographic dimensions, and native numeric population value')
  })

  it('marks mixed valid and mismatched provider rows partial without fabricating a national total', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={[validRows[0], { date: '2025-01-01', sex: 'female', age: 'overall', ethnicity: 'overall', population: 99999.9 }]}/>)
    const preview = screen.getByRole('region', { name: 'Malaysia Population' })
    const card = preview.querySelector('.malaysia-population-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).toHaveTextContent('incomplete or inconsistent with the executed request')
    expect(preview).not.toHaveTextContent('99,999,900')
  })

  it('fails closed when the executed population request has an undeclared query parameter', () => {
    render(<ResponseDemoPreview api={api} requestUrl="https://api.data.gov.my/data-catalogue/?id=population_malaysia&filter=both%40sex%2Coverall%40age%2Coverall%40ethnicity&limit=10&sort=-date&start=0" data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Population' }).querySelector('[data-domain-card="population-total"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('does not trust a numeric-string population as provider float evidence', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={[{ date: '2026-01-01', sex: 'both', age: 'overall', ethnicity: 'overall', population: '34389.4' }]}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Population' }).querySelector('[data-domain-card="population-total"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when the displayed canonical URL was actually executed as POST', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Population' }).querySelector('[data-domain-card="population-total"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('keeps coherent data partial when executed transport identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={validRows}/>)
    const card = screen.getByRole('region', { name: 'Malaysia Population' }).querySelector('[data-domain-card="population-total"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

})
