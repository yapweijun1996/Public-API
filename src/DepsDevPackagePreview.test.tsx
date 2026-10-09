import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'deps-dev')
if (!api) throw new Error('Missing deps.dev Package Insights fixture')
const requestUrl = api.buildUrl({ system: 'npm', packageName: 'react' })
const version = (value: string, overrides: Record<string, unknown> = {}) => ({
  versionKey: { system: 'NPM', name: 'react', version: value },
  publishedAt: '2026-01-01T00:00:00Z', isDefault: false, isDeprecated: false, deprecatedReason: '', ...overrides,
})
const fixture = (versions: unknown[] = [version('18.3.1'), version('19.2.0', { isDefault: true, publishedAt: '2026-08-01T00:00:00Z' })], packageKey: Record<string, unknown> = { system: 'NPM', name: 'react' }) => ({ packageKey, versions })
const card = () => screen.getByRole('region', { name: 'deps.dev Package Insights' }).querySelector('[data-domain-card="deps-dev-package"]')

describe('deps.dev Package Insights semantic preview', () => {
  afterEach(cleanup)

  it('renders a coherent request-bound package response as ready', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'deps.dev Package Insights' })
    expect(preview).toHaveAttribute('data-preview-layout', 'package-insights')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-requested-system', 'npm')
    expect(card()).toHaveAttribute('data-provider-system', 'NPM')
    expect(card()).toHaveAttribute('data-system-match', 'true')
    expect(card()).toHaveAttribute('data-requested-package', 'react')
    expect(card()).toHaveAttribute('data-provider-package', 'react')
    expect(card()).toHaveAttribute('data-package-match', 'true')
    expect(card()).toHaveAttribute('data-provider-version-count', '2')
    expect(card()).toHaveAttribute('data-valid-version-count', '2')
    expect(card()).toHaveAttribute('data-default-version', '19.2.0')
    expect(card()).toHaveAttribute('data-default-contract', 'true')
    expect(preview).toHaveTextContent('Default version')
    expect(preview).toHaveTextContent('19.2.0')
  })

  it('accepts documented PyPI name canonicalization while preserving identities', () => {
    const pypiUrl = api.buildUrl({ system: 'pypi', packageName: 'Requests' })
    const pypiData = { packageKey: { system: 'PYPI', name: 'requests' }, versions: [{ versionKey: { system: 'PYPI', name: 'requests', version: '2.34.2' }, publishedAt: '2026-05-14T19:25:26Z', isDefault: true, isDeprecated: false }] }
    render(<ResponseDemoPreview api={api} requestUrl={pypiUrl} executedRequest={{ url: pypiUrl, method: 'GET' }} data={pypiData}/>)
    const preview = screen.getByRole('region', { name: 'deps.dev Package Insights' })
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-requested-package', 'Requests')
    expect(card()).toHaveAttribute('data-provider-package', 'requests')
    expect(card()).toHaveAttribute('data-package-match', 'true')
    expect(card()).toHaveAttribute('data-package-canonicalized', 'true')
    expect(preview).toHaveTextContent('Canonicalized match')
  })

  it('fails closed on malformed HTTP-success package envelopes', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={{ packageKey: { system: 'NPM', name: 'react' }, versions: {} }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'deps.dev Package Insights' })).toHaveTextContent('Invalid deps.dev package response')
  })

  it('fails closed when provider package identity contradicts the executed lookup', () => {
    const bad = fixture([version('999.0.0', { versionKey: { system: 'NPM', name: 'fabricated-package', version: '999.0.0' } })], { system: 'NPM', name: 'fabricated-package' })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={bad}/>)
    const preview = screen.getByRole('region', { name: 'deps.dev Package Insights' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('999.0.0')
    expect(preview).not.toHaveTextContent('fabricated-package')
  })

  it('keeps trusted versions partial and hides mixed package-identity rows', () => {
    const bad = version('999.0.0', { versionKey: { system: 'NPM', name: 'other-package', version: '999.0.0' } })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={fixture([version('19.2.0', { isDefault: true }), bad])}/>)
    const preview = screen.getByRole('region', { name: 'deps.dev Package Insights' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-valid-version-count', '1')
    expect(card()).toHaveAttribute('data-invalid-version-count', '1')
    expect(preview).toHaveTextContent('19.2.0')
    expect(preview).not.toHaveTextContent('999.0.0')
    expect(preview).not.toHaveTextContent('other-package')
  })

  it('treats duplicate or contradictory default claims as partial', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={fixture([
      version('19.1.0', { isDefault: true }), version('19.2.0', { isDefault: true }), version('19.2.0', { isDefault: false }),
    ])}/>)
    const preview = screen.getByRole('region', { name: 'deps.dev Package Insights' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-default-version-count', '2')
    expect(card()).toHaveAttribute('data-default-contract', 'false')
    expect(card()).toHaveAttribute('data-invalid-version-count', '1')
    expect(preview).toHaveTextContent('more than one returned version as the default version')
    expect(preview).toHaveTextContent('Not identified')
  })

  it('renders a coherent request-bound zero-version package as empty', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={fixture([])}/>)
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveAttribute('data-provider-version-count', '0')
    expect(screen.getByRole('region', { name: 'deps.dev Package Insights' })).toHaveTextContent('No published package versions')
  })

  it('keeps internally trustworthy package data partial when request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).not.toHaveAttribute('data-requested-package')
    expect(screen.getByRole('region', { name: 'deps.dev Package Insights' })).toHaveTextContent('execution evidence is unavailable')
  })

  it('does not promote a displayed URL to request-bound readiness without execution evidence', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(card()).toHaveAttribute('data-requested-package', 'react')
    expect(screen.getByRole('region', { name: 'deps.dev Package Insights' })).toHaveTextContent('execution evidence is unavailable')
  })

  it('fails closed when the executed transport is not the documented bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'deps.dev Package Insights' })).toHaveTextContent('Invalid deps.dev request identity')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when displayed and executed package URLs drift', () => {
    const executedUrl = api.buildUrl({ system: 'npm', packageName: 'vue' })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: executedUrl, method: 'GET' }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'deps.dev Package Insights' })).toHaveTextContent('Invalid deps.dev request identity')
  })

  it('rejects non-canonical deps.dev origins even when the path is valid', () => {
    const alternate = requestUrl.replace('https://api.deps.dev', 'https://api.deps.dev:444')
    render(<ResponseDemoPreview api={api} requestUrl={alternate} executedRequest={{ url: alternate, method: 'GET' }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when the captured URL is not the deps.dev GetPackage endpoint', () => {
    render(<ResponseDemoPreview api={api} requestUrl="https://example.com/v3/systems/npm/packages/react" data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'deps.dev Package Insights' })).toHaveTextContent('Invalid deps.dev request identity')
  })
})
