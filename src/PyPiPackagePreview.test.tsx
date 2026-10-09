import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'pypi-json')
if (!api) throw new Error('Missing PyPI JSON API fixture')
const requestUrl = api.buildUrl({})

const fixture = (overrides: Record<string, unknown> = {}) => ({
  info: {
    name: 'requests',
    version: '2.34.2',
    summary: 'Python HTTP for Humans.',
    requires_python: '>=3.10',
    license: 'Apache-2.0',
    license_expression: null,
    author: null,
    maintainer: null,
    yanked: false,
    yanked_reason: null,
    package_url: 'https://pypi.org/project/requests/',
    project_url: 'https://pypi.org/project/requests/',
    project_urls: { Documentation: 'https://requests.readthedocs.io', Source: 'https://github.com/psf/requests' },
    downloads: { last_day: -1, last_week: -1, last_month: -1 },
    has_sig: false,
    bugtrack_url: null,
  },
  releases: { '2.34.2': [] },
  vulnerabilities: [],
  ...overrides,
})

const card = () => screen.getByRole('region', { name: 'PyPI JSON API' }).querySelector('[data-domain-card="pypi-package"]')

describe('PyPI package semantic preview', () => {
  afterEach(cleanup)

  it('renders a request-bound package response as ready without depending on deprecated releases/download fields', () => {
    const data = fixture({ releases: undefined })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={data}/>)
    const preview = screen.getByRole('region', { name: 'PyPI JSON API' })
    expect(preview).toHaveAttribute('data-preview-layout', 'python-package')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-requested-package', 'requests')
    expect(card()).toHaveAttribute('data-provider-package', 'requests')
    expect(card()).toHaveAttribute('data-normalized-requested-package', 'requests')
    expect(card()).toHaveAttribute('data-normalized-provider-package', 'requests')
    expect(card()).toHaveAttribute('data-identity-match', 'true')
    expect(card()).toHaveAttribute('data-provider-version', '2.34.2')
    expect(card()).toHaveAttribute('data-yanked', 'false')
    expect(preview).toHaveTextContent('Python HTTP for Humans.')
    expect(preview).toHaveTextContent('>=3.10')
    expect(preview).toHaveTextContent('Apache-2.0')
    expect(preview).not.toHaveTextContent('Releases')
    expect(preview).not.toHaveTextContent('-1')
  })

  it('uses official project-name normalization for request/provider identity', () => {
    const normalizedEquivalentUrl = 'https://pypi.org/pypi/Requests/json'
    render(<ResponseDemoPreview api={api} requestUrl={normalizedEquivalentUrl} executedRequest={{ url: normalizedEquivalentUrl, method: 'GET' }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-requested-package', 'Requests')
    expect(card()).toHaveAttribute('data-normalized-requested-package', 'requests')
    expect(card()).toHaveAttribute('data-identity-match', 'true')
  })

  it('treats dot, underscore, and hyphen runs as the same official normalized project identity', () => {
    const equivalentUrl = 'https://pypi.org/pypi/zope_interface/json'
    const baseInfo = fixture().info as Record<string, unknown>
    render(<ResponseDemoPreview api={api} requestUrl={equivalentUrl} executedRequest={{ url: equivalentUrl, method: 'GET' }} data={fixture({ info: { ...baseInfo, name: 'zope.interface', version: '8.6' } })}/>)
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-normalized-requested-package', 'zope-interface')
    expect(card()).toHaveAttribute('data-normalized-provider-package', 'zope-interface')
    expect(card()).toHaveAttribute('data-identity-match', 'true')
  })

  it('fails closed when an HTTP-success body identifies a different project', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={fixture({ info: { ...(fixture().info as Record<string, unknown>), name: 'fabricated-project', version: '999.0.0', summary: 'Fabricated package.' } })}/>)
    const preview = screen.getByRole('region', { name: 'PyPI JSON API' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('PyPI package identity mismatch')
    expect(preview).not.toHaveTextContent('fabricated-project')
    expect(preview).not.toHaveTextContent('999.0.0')
    expect(preview).not.toHaveTextContent('Fabricated package.')
  })

  it('fails closed when the HTTP-success body lacks the documented info identity', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ releases: {} }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'PyPI JSON API' })).toHaveTextContent('Invalid PyPI package response')
  })

  it('keeps trustworthy identity partial when current optional metadata types are malformed', () => {
    const baseInfo = fixture().info as Record<string, unknown>
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={fixture({ info: { ...baseInfo, yanked: 'false', requires_python: 310 } })}/>)
    const preview = screen.getByRole('region', { name: 'PyPI JSON API' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).not.toHaveAttribute('data-yanked')
    expect(preview).toHaveTextContent('optional package metadata fields are malformed')
    expect(preview).not.toHaveTextContent('310')
  })


  it('does not trust a displayed PyPI URL without executed-request evidence', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'PyPI JSON API' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })

  it('keeps trustworthy provider data partial when executed-request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'PyPI JSON API' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).not.toHaveAttribute('data-requested-package')
    expect(card()).toHaveAttribute('data-provider-package', 'requests')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })

  it('fails closed when the executed transport is not the documented bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'PyPI JSON API' })).toHaveTextContent('Invalid PyPI request identity')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when the captured URL is not the direct project JSON endpoint', () => {
    render(<ResponseDemoPreview api={api} requestUrl="https://pypi.org/search/?q=requests" data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'PyPI JSON API' })).toHaveTextContent('Invalid PyPI request identity')
  })
})
