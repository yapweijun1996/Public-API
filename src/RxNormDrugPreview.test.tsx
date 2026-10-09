import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'rxnorm-drug-search')
if (!api) throw new Error('Missing rxnorm-drug-search fixture')

const requestUrl = api.buildUrl({ name: 'ibuprofen' })
const executedGet = { url: requestUrl, method: 'GET' }

const validData = {
  drugGroup: { name: null, conceptGroup: [
    { tty: 'SBD', conceptProperties: [
      { rxcui: '153008', name: 'ibuprofen 200 MG Oral Tablet [Advil]', synonym: 'Advil 200 MG Oral Tablet', tty: 'SBD' },
    ] },
    { tty: 'SCD', conceptProperties: [
      { rxcui: '197805', name: 'ibuprofen 400 MG Oral Tablet', synonym: '', tty: 'SCD' },
      { rxcui: '310965', name: 'ibuprofen 200 MG Oral Tablet', synonym: 'ibuprofen 200 MG (as ibuprofen sodium 256 MG) Oral Tablet', tty: 'SCD' },
    ] },
  ] },
}

describe('RxNorm drug terminology semantic preview', () => {
  afterEach(cleanup)

  it('groups standardized concepts by RxNorm term type and exposes request-bound RxCUI metadata', () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl={requestUrl}
      executedRequest={executedGet}
      data={validData}
    />)

    const preview = screen.getByRole('region', { name: 'RxNorm Drug Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'drug-terminology')
    const terminology = preview.querySelector('.rxnorm-preview')
    expect(terminology).toHaveAttribute('data-result-state', 'ready')
    expect(terminology).toHaveAttribute('data-request-bound', 'true')
    expect(terminology).toHaveAttribute('data-query-name', 'ibuprofen')
    expect(terminology).toHaveAttribute('data-result-count', '3')
    expect(terminology).toHaveAttribute('data-term-types', 'SBD,SCD')
    expect(terminology).toHaveAttribute('data-primary-rxcui', '197805')
    expect(terminology).toHaveAttribute('data-primary-concept-name', 'ibuprofen 400 MG Oral Tablet')
    expect(terminology).toHaveAttribute('data-primary-term-type', 'SCD')
    expect(within(preview).getByRole('heading', { name: 'ibuprofen' })).toBeInTheDocument()
    expect(within(preview).getByRole('heading', { name: 'Clinical Drug' })).toBeInTheDocument()
    expect(within(preview).getByRole('heading', { name: 'Branded Drug' })).toBeInTheDocument()
    expect(preview).toHaveTextContent('RxCUI 197805')
    expect(preview).toHaveTextContent('Advil 200 MG Oral Tablet')
    expect(preview).not.toHaveTextContent('RxNorm Drug Search record 1')
    expect(preview).not.toHaveTextContent('properties')
  })

  it.each([
    { label: 'GET with body', executedRequest: { url: requestUrl, method: 'GET', body: { unexpected: true } } },
    { label: 'display/executed URL mismatch', executedRequest: { url: `${requestUrl}#drift`, method: 'GET' } },
  ])('fails closed for $label transport drift', ({ executedRequest }) => {
    render(<ResponseDemoPreview api={api} data={validData} requestUrl={requestUrl} executedRequest={executedRequest}/> )
    const preview = screen.getByRole('region', { name: 'RxNorm Drug Search' })
    expect(preview.querySelector('[data-domain-card="rxnorm-drug-terminology"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when a canonical display URL is attached to a POST execution', () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl, method: 'POST' }}
      data={validData}
    />)

    const preview = screen.getByRole('region', { name: 'RxNorm Drug Search' })
    const state = preview.querySelector('[data-domain-card="rxnorm-drug-terminology"]')
    expect(state).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('executed request')
  })

  it('fails closed when an HTTP-success body is attached to an unsupported executed request', () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl="https://rxnav.nlm.nih.gov/REST/drugs.json?name=ibuprofen&expand=psn"
      data={validData}
    />)

    const preview = screen.getByRole('region', { name: 'RxNorm Drug Search' })
    const state = preview.querySelector('[data-domain-card="rxnorm-drug-terminology"]')
    expect(state).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid RxNorm drug-search request')
    expect(preview).not.toHaveTextContent('RxCUI 197805')
  })

  it('treats a request-bound documented no-concept response as semantic empty', () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl="https://rxnav.nlm.nih.gov/REST/drugs.json?name=definitely-not-a-real-drug-name"
      executedRequest={{ url: "https://rxnav.nlm.nih.gov/REST/drugs.json?name=definitely-not-a-real-drug-name", method: 'GET' }}
      data={{ drugGroup: {} }}
    />)

    const preview = screen.getByRole('region', { name: 'RxNorm Drug Search' })
    const state = preview.querySelector('[data-domain-card="rxnorm-drug-terminology"]')
    expect(state).toHaveAttribute('data-result-state', 'empty')
    expect(preview).toHaveTextContent('No associated RxNorm drug concepts')
  })

  it('withholds malformed concept identity and marks a mixed provider response partial', () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl="https://rxnav.nlm.nih.gov/REST/drugs.json?name=ibuprofen"
      data={{ drugGroup: { conceptGroup: [
        { tty: 'SCD', conceptProperties: [
          { rxcui: '197805', name: 'ibuprofen 400 MG Oral Tablet', synonym: '', tty: 'SCD' },
          { name: 'fabricated identity without RxCUI', synonym: '', tty: 'SCD' },
        ] },
      ] } }}
    />)

    const preview = screen.getByRole('region', { name: 'RxNorm Drug Search' })
    const terminology = preview.querySelector('.rxnorm-preview')
    expect(terminology).toHaveAttribute('data-result-state', 'partial')
    expect(terminology).toHaveAttribute('data-provider-concept-count', '2')
    expect(terminology).toHaveAttribute('data-valid-concept-count', '1')
    expect(terminology).toHaveAttribute('data-invalid-concept-count', '1')
    expect(preview).toHaveTextContent('RxCUI 197805')
    expect(preview).not.toHaveTextContent('fabricated identity without RxCUI')
  })
})
