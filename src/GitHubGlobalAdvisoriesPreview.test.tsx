import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GitHubGlobalAdvisoriesPreview } from './previews/GitHubGlobalAdvisoriesPreview'

const requestUrl = 'https://api.github.com/advisories?ecosystem=npm&severity=high&per_page=6'
const executedRequest = { url: requestUrl, method: 'GET' as const }
const advisory = {
  ghsa_id: 'GHSA-demo-1234', cve_id: 'CVE-2026-7000', type: 'reviewed', severity: 'high', summary: 'Trusted npm advisory',
  description: 'A demo advisory.', published_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-03T00:00:00Z', withdrawn_at: null,
  vulnerabilities: [{ package: { ecosystem: 'npm', name: 'trusted-package' }, first_patched_version: '2.0.0', vulnerable_version_range: '< 2.0.0' }],
}
const card = () => document.querySelector('[data-domain-card="github-global-advisories"]')

describe('GitHubGlobalAdvisoriesPreview', () => {
  afterEach(cleanup)

  it('marks a request-bound reviewed advisory as ready', () => {
    render(<GitHubGlobalAdvisoriesPreview data={[advisory]} executedRequest={executedRequest}/>)
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-requested-ecosystem', 'npm')
    expect(card()).toHaveAttribute('data-requested-severity', 'high')
    expect(card()).toHaveAttribute('data-filter-contract', 'true')
    expect(screen.getByText('GHSA-demo-1234')).toBeInTheDocument()
    expect(screen.getByText('npm:trusted-package')).toBeInTheDocument()
  })

  it.each([
    ['severity', { ...advisory, severity: 'critical', summary: 'Wrong severity', vulnerabilities: [{ package: { ecosystem: 'npm', name: 'wrong-severity' } }] }],
    ['ecosystem', { ...advisory, summary: 'Wrong ecosystem', vulnerabilities: [{ package: { ecosystem: 'pip', name: 'wrong-ecosystem' } }] }],
    ['type', { ...advisory, type: 'malware', summary: 'Wrong type', vulnerabilities: [{ package: { ecosystem: 'npm', name: 'wrong-type' } }] }],
  ])('fails closed on a %s contradiction', (_, payload) => {
    render(<GitHubGlobalAdvisoriesPreview data={[payload]} executedRequest={executedRequest}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText(payload.summary)).not.toBeInTheDocument()
  })

  it('keeps mixed trusted and contradictory rows partial and hides the bad row', () => {
    const wrong = { ...advisory, ghsa_id: 'GHSA-bad0-0000-0000', severity: 'critical', summary: 'Plausible but wrong advisory', vulnerabilities: [{ package: { ecosystem: 'npm', name: 'plausible-wrong-package' } }] }
    render(<GitHubGlobalAdvisoriesPreview data={[advisory, wrong]} executedRequest={executedRequest}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-valid-result-count', '1')
    expect(card()).toHaveAttribute('data-invalid-result-count', '1')
    expect(screen.queryByText('Plausible but wrong advisory')).not.toBeInTheDocument()
    expect(screen.queryByText('npm:plausible-wrong-package')).not.toBeInTheDocument()
  })

  it('distinguishes a request-bound empty result from an unbound response', () => {
    const { rerender } = render(<GitHubGlobalAdvisoriesPreview data={[]} executedRequest={executedRequest}/>)
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    rerender(<GitHubGlobalAdvisoriesPreview data={[advisory]}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
  })


  it.each([
    ['POST', { ...executedRequest, method: 'POST' }],
    ['GET with a body', { ...executedRequest, body: { unexpected: true } }],
  ])('fails closed when the successful transport is %s', (_label, request) => {
    render(<GitHubGlobalAdvisoriesPreview data={[advisory]} executedRequest={request}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText('Trusted npm advisory')).not.toBeInTheDocument()
  })

  it('rejects malformed request identity and malformed HTTP-success envelopes', () => {
    const { rerender } = render(<GitHubGlobalAdvisoriesPreview data={[advisory]} executedRequest={{ url: "https://api.github.com/advisories?ecosystem=npm&severity=moderate&per_page=6", method: 'GET' }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    rerender(<GitHubGlobalAdvisoriesPreview data={{ advisories: [advisory] }} executedRequest={executedRequest}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })
})
