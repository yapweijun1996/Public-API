import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'github')!
const requestUrl = api.buildUrl({})
const executedRequest = { url: requestUrl, method: 'GET' }

const repo = (overrides: Record<string, unknown> = {}) => ({
  id: 1296269,
  name: 'Hello-World',
  full_name: 'octocat/Hello-World',
  owner: { login: 'octocat' },
  private: false,
  html_url: 'https://github.com/octocat/Hello-World',
  description: 'This your first repo!',
  fork: false,
  language: 'JavaScript',
  forks_count: 9,
  stargazers_count: 80,
  open_issues_count: 2,
  topics: ['octocat', 'api'],
  archived: false,
  disabled: false,
  visibility: 'public',
  default_branch: 'master',
  pushed_at: '2026-09-10T12:00:00Z',
  updated_at: '2026-09-11T12:00:00Z',
  ...overrides,
})

const domain = () => screen.getByRole('region', { name: 'GitHub Public Repos' }).querySelector('[data-domain-card="github-repositories"]') as HTMLElement

describe('GitHubRepositoriesPreview', () => {
  afterEach(cleanup)

  it('binds repository identity and trustworthy metrics to the executed user listing', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={[repo()]}/>)
    const preview = screen.getByRole('region', { name: 'GitHub Public Repos' })
    expect(preview).toHaveAttribute('data-preview-layout', 'repository-list')
    expect(domain()).toHaveAttribute('data-result-state', 'ready')
    expect(domain()).toHaveAttribute('data-request-owner', 'octocat')
    expect(domain()).toHaveAttribute('data-owner-contract', 'true')
    expect(domain()).toHaveAttribute('data-provider-result-count', '1')
    expect(within(preview).getByText('octocat/Hello-World')).toBeInTheDocument()
    expect(within(preview).getByText('Not archived')).toBeInTheDocument()
    expect(within(preview).getByText('80')).toBeInTheDocument()
    expect(within(preview).getByText('9')).toBeInTheDocument()
    expect(within(preview).getByText('2')).toBeInTheDocument()
  })

  it('fails closed when the successful response came from the wrong transport', () => {
    const payload = [repo()]
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={payload}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByText('Invalid GitHub repository request identity')).toBeInTheDocument()

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText('octocat/Hello-World')).not.toBeInTheDocument()

    const alternatePort = requestUrl.replace('https://api.github.com', 'https://api.github.com:444')
    rerender(<ResponseDemoPreview api={api} requestUrl={alternatePort} executedRequest={{ url: alternatePort, method: 'GET' }} data={payload}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={payload}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'partial')
    expect(domain()).toHaveAttribute('data-request-bound', 'false')
  })

  it('does not invent Active when archive state is missing', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={[repo({ archived: undefined })]}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'partial')
    expect(screen.getByText('Archive state unavailable')).toBeInTheDocument()
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('withholds malformed popularity and issue counters instead of manufacturing zeroes', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={[repo({ stargazers_count: '0', forks_count: -1, open_issues_count: '2' })]}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'partial')
    expect(domain()).toHaveAttribute('data-incomplete-result-count', '1')
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(3)
  })

  it('hides an owner or canonical-URL contradictory repository in a mixed batch', () => {
    const bad = repo({ id: 999, name: 'Fabricated', full_name: 'other/Fabricated', owner: { login: 'other' }, html_url: 'https://github.com/other/Fabricated', stargazers_count: 999999 })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={[repo(), bad]}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'partial')
    expect(domain()).toHaveAttribute('data-valid-result-count', '1')
    expect(domain()).toHaveAttribute('data-invalid-result-count', '1')
    expect(screen.queryByText('other/Fabricated')).not.toBeInTheDocument()
    expect(screen.queryByText('999,999')).not.toBeInTheDocument()
  })

  it('fails closed when no returned repository belongs to the executed owner', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={[repo({ full_name: 'other/Hello-World', owner: { login: 'other' }, html_url: 'https://github.com/other/Hello-World' })]}/>)
    const card = domain()
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText('octocat/Hello-World')).not.toBeInTheDocument()
  })

  it('treats a request-bound empty repository list as semantic empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={[]}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'empty')
    expect(screen.getByText('No public repositories returned')).toBeInTheDocument()
  })

  it('fails closed on a malformed HTTP-success envelope', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={{ repositories: [repo()] }}/>)
    expect(domain()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByText('Invalid GitHub repository response')).toBeInTheDocument()
  })
})
