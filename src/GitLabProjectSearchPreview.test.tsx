import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'gitlab-public-projects')
if (!api) throw new Error('Missing GitLab Public Projects fixture')
const requestUrl = api.buildUrl({ query: 'artificial intelligence', limit: '8' })
const executed = (url = requestUrl, method = 'GET', body?: unknown) => ({ url, method, ...(body === undefined ? {} : { body }) })

const project = (path = 'group/artificial-intelligence-demo', overrides: Record<string, unknown> = {}) => ({
  id: 123,
  name: path.split('/').at(-1),
  path_with_namespace: path,
  description: 'Artificial intelligence research project',
  visibility: 'public',
  web_url: `https://gitlab.com/${path}`,
  star_count: 42,
  forks_count: 7,
  last_activity_at: '2026-09-10T12:00:00.000Z',
  topics: ['artificial intelligence', 'research'],
  ...overrides,
})

const card = () => screen.getByRole('region', { name: 'GitLab Public Projects' }).querySelector('[data-domain-card="gitlab-project-search"]')

describe('GitLab Public Projects semantic preview', () => {
  afterEach(cleanup)

  it('renders request-bound public project search results as ready', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={[project()]}/>)
    const preview = screen.getByRole('region', { name: 'GitLab Public Projects' })
    expect(preview).toHaveAttribute('data-preview-layout', 'project-search')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-search-query', 'artificial intelligence')
    expect(card()).toHaveAttribute('data-request-limit', '8')
    expect(card()).toHaveAttribute('data-query-bound', 'true')
    expect(card()).toHaveAttribute('data-provider-result-count', '1')
    expect(card()).toHaveAttribute('data-valid-result-count', '1')
    expect(card()).toHaveAttribute('data-invalid-result-count', '0')
    expect(card()).toHaveAttribute('data-incomplete-result-count', '0')
    expect(card()).toHaveAttribute('data-query-contract', 'true')
    expect(preview).toHaveTextContent('42 stars')
    expect(preview).toHaveTextContent('7')
  })

  it('renders a request-bound zero-match response as empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={[]}/>)
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveAttribute('data-search-query', 'artificial intelligence')
    expect(screen.getByRole('region', { name: 'GitLab Public Projects' })).toHaveTextContent('No GitLab projects matched')
  })

  it('fails closed on a malformed HTTP-success response envelope', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={{ projects: [project()] }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'GitLab Public Projects' })).toHaveTextContent('Invalid GitLab projects response')
  })

  it('hides a wrong-identity project from a mixed HTTP-success batch', () => {
    const bad = project('fabricated/project', { web_url: 'https://gitlab.com/other/project', star_count: 999999 })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={[project(), bad]}/>)
    const preview = screen.getByRole('region', { name: 'GitLab Public Projects' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-provider-result-count', '2')
    expect(card()).toHaveAttribute('data-valid-result-count', '1')
    expect(card()).toHaveAttribute('data-invalid-result-count', '1')
    expect(preview).not.toHaveTextContent('fabricated/project')
    expect(preview).not.toHaveTextContent('999,999')
  })

  it('does not coerce malformed star or fork counts into plausible zero facts', () => {
    const malformed = project('group/artificial-intelligence-tools', { star_count: '0', forks_count: -1 })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={[malformed]}/>)
    const preview = screen.getByRole('region', { name: 'GitLab Public Projects' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-incomplete-result-count', '1')
    expect(preview).toHaveTextContent('Stars unavailable')
    expect(preview).toHaveTextContent('Unavailable')
    expect(preview).not.toHaveTextContent('-1 forks')
  })

  it('fails closed when provider rows contradict the documented search semantics', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed()} data={[project('group/unrelated', { description: 'Unrelated project' })]}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'GitLab Public Projects' })).toHaveTextContent('Invalid GitLab project results')
  })

  it('fails closed on an unsupported executed request URL and stays partial when request identity is absent', () => {
    const unsupportedUrl = 'https://example.com/api/v4/projects?visibility=public&search=artificial+intelligence&order_by=star_count&sort=desc&per_page=8'
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={unsupportedUrl} executedRequest={executed(unsupportedUrl)} data={[project()]}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    rerender(<ResponseDemoPreview api={api} data={[project()]}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-query-bound', 'false')
    expect(screen.getByRole('region', { name: 'GitLab Public Projects' })).toHaveTextContent('executed-request identity is unavailable')
  })

  it('fails closed when the executed transport is not the supported bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed(requestUrl, 'POST')} data={[project()]}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executed(requestUrl, 'GET', { unexpected: true })} data={[project()]}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })
})
