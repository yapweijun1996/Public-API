import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import fixtures from './fixtures/diagnostic-responses.json'
import { ScorecardPreview, evidenceUrl, scoreValue } from './ScorecardPreview'
import { GrammarPreview, grammarContext, grammarModel } from './GrammarPreview'
import { RecallsPreview, recallQuery, recallsModel } from './RecallsPreview'
import { ResponseDemoPreview } from '../responsePreview'
import { apiCatalog } from '../apiCatalog'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const state = () => document.querySelector('[data-domain-card]')?.getAttribute('data-result-state')
const recallRequest = (make = 'Example', model = 'Demo', year = '2020', suffix = '') => ({
  url: `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}${suffix}`,
  method: 'GET' as const,
})
const grammarRequest = (overrides: Partial<{ url: string; method: string; body: unknown }> = {}) => ({
  url: 'https://api.languagetool.org/v2/check',
  method: 'POST',
  body: { text: 'This are a test.', language: 'en-US' },
  ...overrides,
})

describe('Scorecard evidence, not certification', () => {
  it('keeps genuine zero separate from inconclusive and uses the provider aggregate', () => {
    render(<ScorecardPreview data={fixtures.scorecard}/>)
    expect(document.querySelector('[data-aggregate-score]')).toHaveTextContent('8.7 / 10')
    const zero = document.querySelector('[data-check-name="Security-Policy"]') as HTMLElement
    expect(zero).toHaveAttribute('data-score', '0')
    expect(within(zero).getByRole('meter')).toHaveAttribute('value', '0')
    const unknown = document.querySelector('[data-check-name="Signed-Releases"]') as HTMLElement
    expect(unknown).toHaveTextContent('Inconclusive')
    expect(unknown).not.toHaveAttribute('data-score')
    expect(within(unknown).queryByRole('meter')).toBeNull()
    expect(screen.getByText(/not a security certification/)).toBeInTheDocument()
  })
  it.each([null, undefined, false, '', '5', -1, -2, 11, Infinity, NaN])('does not coerce or clamp invalid score %s', (value) => {
    expect(scoreValue(value)).toBeUndefined()
  })
  it('preserves full evidence and rejects unsafe documentation links', () => {
    const detail = '<script>literal provider evidence</script>' + ' detail'.repeat(100)
    render(<ScorecardPreview data={{ checks: [{ name: 'Example', score: 2, reason: detail, details: [detail], documentation: { url: 'javascript:alert(1)' } }] }}/>)
    expect(document.querySelector('.diagnostic-reason')).toHaveTextContent(detail)
    expect(document.querySelector('details li')).toHaveTextContent(detail)
    expect(screen.queryByRole('link')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
    for (const value of ['javascript:alert(1)', '//example.com', 'https://user:pass@example.com', 'http://example.com']) expect(evidenceUrl(value)).toBeUndefined()
    expect(evidenceUrl('https://github.com/ossf/scorecard#checks')).toBe('https://github.com/ossf/scorecard#checks')
  })
  it('distinguishes empty, missing and partly malformed lists without treating them as safe', () => {
    const { rerender } = render(<ScorecardPreview data={{}}/>)
    expect(state()).toBe('invalid')
    rerender(<ScorecardPreview data={{ checks: [] }}/>)
    expect(state()).toBe('partial')
    expect(document.querySelector('[data-domain-card="security-scorecard"]')).toHaveAttribute('data-request-bound', 'false')
    expect(screen.getByText(/not a clean security report/)).toBeInTheDocument()
    rerender(<ScorecardPreview data={{ checks: [null, { name: 'Unknown check' }] }}/>)
    expect(state()).toBe('partial')
    expect(screen.getByText(/1 check records could not be read/)).toBeInTheDocument()
    expect(document.querySelector('[data-check-outcome]')).toHaveAttribute('data-check-outcome', 'Not supplied')
  })
  it('lets users reach every check and filter unknown evidence without network calls', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const checks = Array.from({ length: 20 }, (_, i) => ({ name: `Check-${i}`, score: i % 2 ? -1 : 10 }))
    render(<ScorecardPreview data={{ checks }}/>)
    const list = screen.getByRole('list', { name: 'Repository security checks' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'Show more checks' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(20)
    fireEvent.change(screen.getByLabelText('Filter security checks'), { target: { value: 'unscored' } })
    expect(document.querySelectorAll('meter')).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent('8 of 10 checks shown')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('Scorecard exact executed-request identity', () => {
  const api = apiCatalog.find((entry) => entry.id === 'openssf-scorecard')!
  const requestUrl = 'https://api.securityscorecards.dev/projects/github.com/ossf/scorecard'
  const exactData = { ...fixtures.scorecard, repo: { ...fixtures.scorecard.repo, name: 'github.com/ossf/scorecard' } }

  it('fails closed unless the semantic result is bound to the exact repository GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} data={exactData} requestUrl={requestUrl}/>)
    let card = document.querySelector('[data-domain-card="security-scorecard"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    for (const executedRequest of [
      { url: requestUrl, method: 'POST' },
      { url: requestUrl, method: 'GET', body: {} },
      { url: requestUrl + '?commit=abcdef', method: 'GET' },
      { url: 'https://api.securityscorecards.dev/projects/github.com/example/demo', method: 'GET' },
    ]) {
      rerender(<ResponseDemoPreview api={api} data={exactData} requestUrl={requestUrl} executedRequest={executedRequest}/>)
      card = document.querySelector('[data-domain-card="security-scorecard"]')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
    }

    rerender(<ResponseDemoPreview api={api} data={exactData} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)
    card = document.querySelector('[data-domain-card="security-scorecard"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-openssf-scorecard-project-v2')
    expect(card).toHaveAttribute('data-request-repository', 'github.com/ossf/scorecard')
    expect(card).toHaveAttribute('data-provider-repository', 'github.com/ossf/scorecard')
  })

  it('rejects response repository contradictions and only trusts exact-bound empty results', () => {
    const exactRequest = { url: requestUrl, method: 'GET' }
    const { rerender } = render(<ResponseDemoPreview api={api} data={{ ...exactData, repo: { ...exactData.repo, name: 'github.com/example/demo' } }} requestUrl={requestUrl} executedRequest={exactRequest}/>)
    expect(document.querySelector('[data-domain-card="security-scorecard"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} data={{ ...exactData, checks: [] }} requestUrl={requestUrl} executedRequest={exactRequest}/>)
    const card = document.querySelector('[data-domain-card="security-scorecard"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-request-bound', 'true')
  })
})

describe('Grammar review result states', () => {
  it('uses the context-local offset and retains the whole explanation and replacement', () => {
    render(<GrammarPreview data={fixtures.grammar} requestUrl="https://api.languagetool.org/v2/check" executedRequest={grammarRequest()}/>)
    expect(state()).toBe('issues')
    expect(document.querySelector('mark')).toHaveTextContent('are')
    expect(screen.getByText(fixtures.grammar.matches[0].message)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy replacement 1 for issue 1' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'LanguageTool' })).toHaveAttribute('href', 'https://languagetool.org')
  })
  it('distinguishes no issues from missing, malformed or incomplete results', () => {
    const { rerender } = render(<GrammarPreview data={{ matches: [] }} requestUrl="https://api.languagetool.org/v2/check" executedRequest={grammarRequest()}/>)
    expect(state()).toBe('no-issues')
    expect(screen.getByText(/does not guarantee the text is error-free/)).toBeInTheDocument()
    for (const data of [{}, { matches: null }, { matches: [null] }, { matches: [], error: 'failed' }]) {
      rerender(<GrammarPreview data={data} requestUrl="https://api.languagetool.org/v2/check" executedRequest={grammarRequest()}/>); expect(state()).toBe('invalid')
      expect(screen.queryByRole('heading', { name: 'No issues returned' })).toBeNull()
    }
    rerender(<GrammarPreview data={{ matches: [], warnings: { incompleteResults: true } }} requestUrl="https://api.languagetool.org/v2/check" executedRequest={grammarRequest()}/>)
    expect(state()).toBe('partial')
    expect(screen.getByRole('heading', { name: 'Partial checking results' })).toBeInTheDocument()
    expect(grammarModel({ matches: [null, fixtures.grammar.matches[0]] }).state).toBe('partial')
  })
  it('retains unknown locations, zero-length insertions and valid UTF-16 without guessing', () => {
    expect(grammarContext({ text: '😀 are', offset: 3, length: 3 }).marked).toBe('are')
    for (const context of [{ text: 'a', offset: 50, length: 2 }, { text: 'a', offset: -1, length: 1 }, { text: 'a', offset: 0.5, length: 1 }, { text: '😀', offset: 1, length: 1 }]) expect(grammarContext(context).marked).toBeUndefined()
    expect(grammarContext({ text: 'a', offset: 0, length: 0 }).marked).toBe('')
  })
  it('shows deletion suggestions distinctly and preserves empty versus missing replacement arrays', () => {
    const issue = fixtures.grammar.matches[0]
    const { rerender } = render(<GrammarPreview data={{ matches: [{ ...issue, replacements: [{ value: '' }] }] }} requestUrl="https://api.languagetool.org/v2/check" executedRequest={grammarRequest()}/>)
    expect(screen.getByText('Delete the flagged text')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<GrammarPreview data={{ matches: [{ ...issue, replacements: [] }] }} requestUrl="https://api.languagetool.org/v2/check" executedRequest={grammarRequest()}/>)
    expect(screen.getByText(/No replacement suggested/)).toBeInTheDocument()
    rerender(<GrammarPreview data={{ matches: [{ ...issue, replacements: undefined }] }} requestUrl="https://api.languagetool.org/v2/check" executedRequest={grammarRequest()}/>)
    expect(screen.getByText(/suggestions were not supplied/)).toBeInTheDocument()
  })
  it('filters and reveals all issues without editing or resending the original sentence', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const matches = Array.from({ length: 12 }, (_, i) => ({ ...fixtures.grammar.matches[0], rule: { category: { name: i % 2 ? 'Spelling' : 'Grammar' } } }))
    render(<GrammarPreview data={{ matches }} requestUrl="https://api.languagetool.org/v2/check" executedRequest={grammarRequest()}/>)
    fireEvent.click(screen.getByRole('button', { name: 'Show more issues' }))
    expect(document.querySelectorAll('[data-issue-index]')).toHaveLength(12)
    fireEvent.change(screen.getByLabelText('Filter writing issues'), { target: { value: 'Spelling' } })
    expect(document.querySelectorAll('[data-issue-index]')).toHaveLength(6)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('Grammar exact executed-request identity', () => {
  const api = apiCatalog.find((entry) => entry.id === 'languagetool-grammar-check')!

  it('binds a semantic result only to the exact catalog POST form body', () => {
    render(<ResponseDemoPreview api={api} data={fixtures.grammar} requestUrl="https://api.languagetool.org/v2/check" executedRequest={grammarRequest()}/>)
    const card = document.querySelector('[data-domain-card="grammar-review"]')
    expect(card).toHaveAttribute('data-result-state', 'issues')
    expect(card).toHaveAttribute('data-request-contract', 'exact-languagetool-public-check-v2')
    expect(card).toHaveAttribute('data-request-bound', 'true')
  })

  it('fails closed when execution evidence is absent or transport/body identity drifts', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} data={fixtures.grammar} requestUrl="https://api.languagetool.org/v2/check"/>)
    let card = document.querySelector('[data-domain-card="grammar-review"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    const invalidRequests = [
      grammarRequest({ method: 'GET' }),
      grammarRequest({ url: 'https://api.languagetool.org/v2/check?language=en-US' }),
      grammarRequest({ body: undefined }),
      grammarRequest({ body: { text: 'This are a test.', language: 'auto' } }),
      grammarRequest({ body: { text: 'This are a test.', language: 'en-US', enabledOnly: 'false' } }),
    ]
    for (const executedRequest of invalidRequests) {
      rerender(<ResponseDemoPreview api={api} data={fixtures.grammar} requestUrl="https://api.languagetool.org/v2/check" executedRequest={executedRequest}/>)
      card = document.querySelector('[data-domain-card="grammar-review"]')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
    }
  })
})

describe('Recall risk and remedy experience', () => {
  it('preserves complete safety narratives, provider dates and important flags', () => {
    const row = fixtures.recalls.results[0]
    const summary = row.Summary + ' Long full narrative.'.repeat(90)
    render(<RecallsPreview data={{ Count: 1, results: [{ ...row, Summary: summary }] }} executedRequest={recallRequest()}/>)
    expect(state()).toBe('ready')
    expect(screen.getByRole('heading', { name: '2020 Example Demo' })).toBeInTheDocument()
    expect(document.querySelector('[data-recall-field="Summary"] p')).toHaveTextContent(summary)
    expect(document.querySelector('[data-recall-field="Consequence"] p')).toHaveTextContent(row.Consequence)
    expect(document.querySelector('[data-recall-field="Remedy"] p')).toHaveTextContent(row.Remedy)
    expect(screen.getByText('25/03/2021')).toBeInTheDocument()
    expect(screen.getByText(/Do not drive — provider flag/)).toBeInTheDocument()
    expect(screen.getByText(/Park outside — provider flag/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Check your VIN with NHTSA' })).toHaveAttribute('href', 'https://www.nhtsa.gov/recalls')
  })
  it('never presents empty, malformed or mismatched results as a safety clearance', () => {
    const { rerender } = render(<RecallsPreview data={{ Count: 0, results: [] }} executedRequest={recallRequest()}/>)
    expect(state()).toBe('empty')
    expect(screen.getByText(/not a safety clearance/)).toBeInTheDocument()
    for (const data of [{}, { Count: 0 }, { Count: 0, results: null }, { results: [{}] }, { results: [], error: 'failure' }]) {
      rerender(<RecallsPreview data={data} executedRequest={recallRequest()}/>); expect(state()).toBe('invalid')
    }
    rerender(<RecallsPreview data={{ Count: 5, results: [] }} executedRequest={recallRequest()}/>)
    expect(state()).toBe('invalid')
    expect(screen.queryByText(/No campaign records were returned/)).toBeNull()
    expect(screen.getByText(/empty recall page without a trustworthy zero-result count/)).toBeInTheDocument()
  })
  it('retains incomplete campaigns with explicit missing remedy and unknown flags', () => {
    render(<RecallsPreview data={{ Count: 1, results: [{ NHTSACampaignNumber: 'TEST-UNKNOWN', Component: 'Brakes', Make: 'Example', Model: 'Demo', ModelYear: '2020' }] }} executedRequest={recallRequest()}/>)
    expect(state()).toBe('partial')
    expect(screen.getByText(/Remedy not supplied/)).toBeInTheDocument()
    expect(screen.getAllByText('0 flagged · 1 unknown')).toHaveLength(2)
    expect(recallsModel({ results: [{ ...fixtures.recalls.results[0], parkIt: 'false' }] }).recalls[0].parkIt).toBeUndefined()
  })
  it('keeps campaign identity, searchable full remedies and all returned records accessible', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const results = Array.from({ length: 9 }, (_, i) => ({ ...fixtures.recalls.results[0], NHTSACampaignNumber: `TEST-${i}`, Remedy: i === 8 ? 'Unique full remedy search target.' : 'Consult the manufacturer.' }))
    render(<RecallsPreview data={{ Count: 9, results }} executedRequest={recallRequest()}/>)
    expect(document.querySelectorAll('[data-campaign-id]')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Show more campaigns' }))
    expect(document.querySelectorAll('[data-campaign-id]')).toHaveLength(9)
    fireEvent.change(screen.getByLabelText('Filter recall campaigns'), { target: { value: 'Unique full remedy' } })
    expect(document.querySelectorAll('[data-campaign-id]')).toHaveLength(1)
    expect(document.querySelector('[data-campaign-id]')).toHaveAttribute('data-campaign-id', 'TEST-8')
    fireEvent.change(screen.getByLabelText('Filter recall campaigns'), { target: { value: 'no matching record' } })
    expect(screen.getByText(/original response still contains 9/)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('uses only exact recognized request metadata for the query heading and never guesses a VIN', () => {
    const canonical = 'https://api.nhtsa.gov/recalls/recallsByVehicle?make=Example&model=Demo&modelYear=2020'
    expect(recallQuery(canonical)).toBe('2020 Example Demo')
    expect(recallQuery(`${canonical}&foo=bar`)).toBeUndefined()
    expect(recallQuery(`${canonical}&format=json`)).toBeUndefined()
    expect(recallQuery(`${canonical}&make=Other`)).toBeUndefined()
    expect(recallQuery('https://example.com/?make=wrong')).toBeUndefined()
    expect(recallQuery('https://api.nhtsa.gov/other?make=wrong')).toBeUndefined()
    expect(recallQuery('invalid')).toBeUndefined()
  })

  it('fails closed when HTTP-success recall rows do not match the executed vehicle query', () => {
    render(<RecallsPreview data={{ Count: 1, results: [{ ...fixtures.recalls.results[0], Make: 'Toyota', Model: 'Camry', ModelYear: '2020' }] }} executedRequest={recallRequest('Honda', 'Accord')}/>)
    expect(state()).toBe('invalid')
  })
})

describe('Diagnostic API registry integration', () => {
  const cases = [
    ['openssf-scorecard', 'security-scorecard', fixtures.scorecard],
    ['languagetool-grammar-check', 'grammar-review', fixtures.grammar],
    ['nhtsa-vehicle-recalls', 'vehicle-recalls', fixtures.recalls],
  ] as const
  it.each(cases)('%s uses its own semantic composition without generic property dumps', (id, layout, data) => {
    const api = apiCatalog.find((entry) => entry.id === id)!
    const before = JSON.stringify(data)
    render(<ResponseDemoPreview api={api} data={data}/>)
    const region = screen.getByRole('region', { name: api.name })
    expect(region).toHaveAttribute('data-preview-layout', layout)
    expect(region).toHaveAttribute('data-ssot-design', 'result-card-v2')
    expect(region).toHaveAttribute('data-ssot-fallback', 'false')
    expect(region.querySelector('[data-domain-card]')).toHaveAttribute('data-domain-card', layout)
    expect(region.querySelector('.semantic-card-grid, [data-generic-fallback="true"]')).toBeNull()
    expect(JSON.stringify(data)).toBe(before)
  })
})
