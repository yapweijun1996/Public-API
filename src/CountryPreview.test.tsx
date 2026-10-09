import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'countries')
if (!api) throw new Error('Missing countries fixture')

const requestUrl = 'https://api.worldbank.org/v2/country/SGP?format=json'
const executedRequest = { url: requestUrl, method: 'GET' }
const singapore = {
  id: 'SGP',
  iso2Code: 'SG',
  name: 'Singapore',
  region: { id: 'EAS', iso2code: 'Z4', value: 'East Asia & Pacific' },
  adminregion: { id: '', iso2code: '', value: '' },
  incomeLevel: { id: 'HIC', iso2code: 'XD', value: 'High income' },
  lendingType: { id: 'LNX', iso2code: 'XX', value: 'Not classified' },
  capitalCity: 'Singapore',
  longitude: '103.85',
  latitude: '1.28941',
}
const response = [{ page: 1, pages: 1, per_page: '50', total: 1 }, [singapore]]

describe('World Bank Country Explorer semantic preview', () => {
  afterEach(cleanup)

  it('binds the executed country code to the World Bank identity', () => {
    render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'Country Explorer' })
    const card = preview.querySelector('[data-domain-card="country-profile"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-country-code', 'SGP')
    expect(card).toHaveAttribute('data-provider-country-code', 'SGP')
    expect(card).toHaveAttribute('data-provider-iso2-code', 'SG')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-contract-valid', 'true')
    expect(preview).toHaveTextContent('East Asia & Pacific')
    expect(preview).toHaveTextContent('High income')
    expect(preview).toHaveTextContent('Singapore')
  })

  it('accepts an executed ISO2 code when it matches the provider ISO2 identity', () => {
    render(<ResponseDemoPreview api={api} data={response} requestUrl="https://api.worldbank.org/v2/country/sg?format=json" executedRequest={{ url: "https://api.worldbank.org/v2/country/sg?format=json", method: "GET" }}/>)
    const card = screen.getByRole('region', { name: 'Country Explorer' }).querySelector('[data-domain-card="country-profile"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-country-code', 'SG')
    expect(card).toHaveAttribute('data-identity-match', 'true')
  })

  it('fails closed when a plausible HTTP-success country does not match the executed request', () => {
    const brazil = { ...singapore, id: 'BRA', iso2Code: 'BR', name: 'Brazil', capitalCity: 'Brasilia' }
    render(<ResponseDemoPreview api={api} data={[{ page: 1, pages: 1, per_page: '50', total: 1 }, [brazil]]} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'Country Explorer' })
    const card = preview.querySelector('[data-domain-card="country-profile"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(preview).not.toHaveTextContent('Brazil')
    expect(preview).not.toHaveTextContent('Brasilia')
  })

  it('fails closed for a malformed World Bank envelope instead of recursively finding a plausible record', () => {
    render(<ResponseDemoPreview api={api} data={{ result: singapore }} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'Country Explorer' })
    expect(preview.querySelector('[data-domain-card="country-profile"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('High income')
  })

  it('marks a coherent response partial when executed request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl}/>)
    const card = screen.getByRole('region', { name: 'Country Explorer' }).querySelector('[data-domain-card="country-profile"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-identity-match', 'unbound')
  })

  it.each([
    ['POST', { url: requestUrl, method: 'POST' }],
    ['GET with body', { url: requestUrl, method: 'GET', body: { code: 'SGP' } }],
    ['URL drift', { url: 'https://api.worldbank.org/v2/country/BRA?format=json', method: 'GET' }],
  ])('fails closed when executed transport identity drifts: %s', (_label, driftedRequest) => {
    render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={driftedRequest}/>)
    const preview = screen.getByRole('region', { name: 'Country Explorer' })
    const card = preview.querySelector('[data-domain-card="country-profile"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
  })

})
