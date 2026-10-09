import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'clinical-trials-search')
if (!api) throw new Error('Missing clinical-trials-search fixture')

const requestUrl = 'https://clinicaltrials.gov/api/v2/studies?query.cond=Diabetes&pageSize=8&format=json'
const study = (nctId: string, title = 'Representative diabetes study') => ({
  protocolSection: {
    identificationModule: { nctId, briefTitle: title, officialTitle: `${title} official title` },
    statusModule: { overallStatus: 'COMPLETED', startDateStruct: { date: '2024-01' } },
    conditionsModule: { conditions: ['Diabetes'] },
    designModule: { studyType: 'INTERVENTIONAL', phases: ['PHASE2'] },
  },
  hasResults: true,
})

describe('ClinicalTrials.gov search semantic preview', () => {
  afterEach(cleanup)

  it('renders ready only for a coherent exact request-bound study page', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{ studies: [study('NCT01234567'), study('NCT07654321')], nextPageToken: 'next-token' }}/>)
    const preview = screen.getByRole('region', { name: 'ClinicalTrials.gov Search' })
    const result = preview.querySelector('[data-domain-card="clinical-trials-search"]')
    expect(result).toHaveAttribute('data-result-state', 'ready')
    expect(result).toHaveAttribute('data-request-bound', 'true')
    expect(result).toHaveAttribute('data-query-condition', 'Diabetes')
    expect(result).toHaveAttribute('data-requested-page-size', '8')
    expect(result).toHaveAttribute('data-primary-nct-id', 'NCT01234567')
    expect(preview).toHaveTextContent('Representative diabetes study')
  })

  it('fails closed when a canonical-looking response came from a non-GET or body-bearing transport', () => {
    for (const executedRequest of [
      { url: requestUrl, method: 'POST' },
      { url: requestUrl, method: 'GET', body: { condition: 'different-condition' } },
    ]) {
      cleanup()
      render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={{ studies: [study('NCT01234567')] }}/>)
      const preview = screen.getByRole('region', { name: 'ClinicalTrials.gov Search' })
      expect(preview.querySelector('[data-domain-card="clinical-trials-search"]')).toHaveAttribute('data-result-state', 'invalid')
      expect(preview).not.toHaveTextContent('Representative diabetes study')
    }
  })

  it('does not claim request-bound readiness without executed transport identity', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ studies: [study('NCT01234567')] }}/>)
    const preview = screen.getByRole('region', { name: 'ClinicalTrials.gov Search' })
    const result = preview.querySelector('[data-domain-card="clinical-trials-search"]')
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-request-bound', 'false')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })

  it('fails closed when the executed request contains undeclared search semantics', () => {
    render(<ResponseDemoPreview api={api} requestUrl={`${requestUrl}&pageToken=unexpected`} data={{ studies: [study('NCT01234567')] }}/>)
    const preview = screen.getByRole('region', { name: 'ClinicalTrials.gov Search' })
    expect(preview.querySelector('[data-domain-card="clinical-trials-search"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Representative diabetes study')
  })

  it('withholds malformed and duplicate NCT identities as partial evidence', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{ studies: [
      study('NCT01234567'),
      study('bad-id', 'Malformed identity study'),
      study('NCT01234567', 'Duplicate identity study'),
    ] }}/>)
    const preview = screen.getByRole('region', { name: 'ClinicalTrials.gov Search' })
    const result = preview.querySelector('[data-domain-card="clinical-trials-search"]')
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-valid-study-count', '1')
    expect(result).toHaveAttribute('data-malformed-study-count', '1')
    expect(result).toHaveAttribute('data-duplicate-study-count', '1')
    expect(preview).toHaveTextContent('NCT01234567')
    expect(preview).not.toHaveTextContent('bad-id')
    expect(preview).not.toHaveTextContent('Duplicate identity study')
  })

  it('maps a request-bound empty study list to semantic empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{ studies: [] }}/>)
    const preview = screen.getByRole('region', { name: 'ClinicalTrials.gov Search' })
    expect(preview.querySelector('[data-domain-card="clinical-trials-search"]')).toHaveAttribute('data-result-state', 'empty')
    expect(preview).toHaveTextContent('No clinical studies found')
  })

  it('declares the condition as a non-empty shared SSOT field and preserves an explicit blank for pre-network validation', () => {
    const condition = api.fields.find((field) => field.id === 'condition')
    expect(condition?.minLength).toBe(1)
    const built = new URL(api.buildUrl({ condition: '   ' }))
    expect(built.searchParams.get('query.cond')).toBe('')
  })
})
