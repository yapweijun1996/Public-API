import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'pub-dev')
if (!api) throw new Error('Missing pub.dev Package Lookup fixture')

const riverpodUrl = api.buildUrl({ packageName: 'riverpod' })
const version = (value: string, overrides: Record<string, unknown> = {}) => ({
  version: value,
  pubspec: {
    name: 'riverpod',
    version: value,
    description: 'A reactive caching and data-binding framework.',
    repository: 'https://github.com/rrousselGit/riverpod',
    topics: ['state-management'],
    environment: { sdk: '^3.12.0' },
  },
  archive_url: `https://pub.dev/api/archives/riverpod-${value}.tar.gz`,
  archive_sha256: 'a'.repeat(64),
  published: '2026-09-03T22:14:57.641244Z',
  ...overrides,
})
const fixture = (overrides: Record<string, unknown> = {}) => ({
  name: 'riverpod',
  latest: version('3.4.3'),
  versions: [version('3.4.2'), version('3.4.3')],
  ...overrides,
})

const card = () => screen.getByRole('region', { name: 'pub.dev Package Lookup' }).querySelector('[data-domain-card="pubdev-package"]')

describe('pub.dev package semantic preview', () => {
  afterEach(cleanup)

  it('renders a request-bound Hosted Pub v2 package as ready', () => {
    render(<ResponseDemoPreview api={api} requestUrl={riverpodUrl} executedRequest={{ url: riverpodUrl, method: 'GET' }} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'pub.dev Package Lookup' })
    expect(preview).toHaveAttribute('data-preview-layout', 'dart-package')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-requested-package', 'riverpod')
    expect(card()).toHaveAttribute('data-provider-package', 'riverpod')
    expect(card()).toHaveAttribute('data-identity-match', 'true')
    expect(card()).toHaveAttribute('data-provider-version-count', '2')
    expect(card()).toHaveAttribute('data-valid-version-count', '2')
    expect(card()).toHaveAttribute('data-invalid-version-count', '0')
    expect(card()).toHaveAttribute('data-latest-version', '3.4.3')
    expect(card()).toHaveAttribute('data-latest-present-in-versions', 'true')
    expect(card()).toHaveAttribute('data-sdk-constraint', '^3.12.0')
    expect(card()).toHaveAttribute('data-discontinued', 'false')
    expect(preview).toHaveTextContent('3.4.3')
    expect(preview).toHaveTextContent('^3.12.0')
    expect(preview).toHaveTextContent('state-management')
  })

  it('fails closed when HTTP-success data identifies a different package', () => {
    const fabricated = version('999.0.0', {
      pubspec: { name: 'fabricated_package', version: '999.0.0', description: 'Fabricated package' },
      archive_url: 'https://pub.dev/api/archives/fabricated_package-999.0.0.tar.gz',
    })
    render(<ResponseDemoPreview api={api} requestUrl={riverpodUrl} data={fixture({ name: 'fabricated_package', latest: fabricated, versions: [fabricated] })}/>)
    const preview = screen.getByRole('region', { name: 'pub.dev Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('pub.dev package identity mismatch')
    expect(preview).not.toHaveTextContent('fabricated_package')
    expect(preview).not.toHaveTextContent('999.0.0')
  })

  it('fails closed when the latest release contradicts its pubspec identity', () => {
    render(<ResponseDemoPreview api={api} requestUrl={riverpodUrl} data={fixture({
      latest: version('3.4.3', { pubspec: { name: 'riverpod', version: '999.0.0', description: 'Contradictory metadata' } }),
    })}/>)
    const preview = screen.getByRole('region', { name: 'pub.dev Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid pub.dev latest release')
    expect(preview).not.toHaveTextContent('Contradictory metadata')
  })

  it('fails closed when the provider latest release is absent from trusted version history', () => {
    render(<ResponseDemoPreview api={api} requestUrl={riverpodUrl} data={fixture({ versions: [version('3.4.2')] })}/>)
    const preview = screen.getByRole('region', { name: 'pub.dev Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('pub.dev latest-version relationship mismatch')
    expect(preview).not.toHaveTextContent('A reactive caching and data-binding framework.')
  })

  it('keeps mixed version history partial and hides malformed version rows', () => {
    render(<ResponseDemoPreview api={api} requestUrl={riverpodUrl} data={fixture({
      versions: [version('3.4.3'), version('999.0.0', { pubspec: { name: 'fabricated_package', version: '999.0.0' }, archive_url: 'http://example.test/fabricated.tar.gz' })],
    })}/>)
    const preview = screen.getByRole('region', { name: 'pub.dev Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-provider-version-count', '2')
    expect(card()).toHaveAttribute('data-valid-version-count', '1')
    expect(card()).toHaveAttribute('data-invalid-version-count', '1')
    expect(preview).toHaveTextContent('3.4.3')
    expect(preview).not.toHaveTextContent('999.0.0')
    expect(preview).not.toHaveTextContent('fabricated_package')
  })


  it('does not trust a displayed pub.dev URL without executed-request evidence', () => {
    render(<ResponseDemoPreview api={api} requestUrl={riverpodUrl} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'pub.dev Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })

  it('keeps trustworthy provider metadata partial without executed-request identity', () => {
    render(<ResponseDemoPreview api={api} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'pub.dev Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).not.toHaveAttribute('data-requested-package')
    expect(card()).toHaveAttribute('data-provider-package', 'riverpod')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })

  it('fails closed when the executed request URL is not the supported direct package endpoint', () => {
    render(<ResponseDemoPreview api={api} requestUrl="https://pub.dev/api/package-name-completion-data" data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'pub.dev Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid pub.dev request identity')
  })

  it('uses the Hosted Pub v2 media type in the shared API SSOT', () => {
    expect(api.headers).toEqual({ Accept: 'application/vnd.pub.v2+json' })
  })
  it('fails closed when the executed transport is not the documented bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={riverpodUrl} executedRequest={{ url: riverpodUrl, method: 'POST' }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'pub.dev Package Lookup' })).toHaveTextContent('Invalid pub.dev request identity')

    rerender(<ResponseDemoPreview api={api} requestUrl={riverpodUrl} executedRequest={{ url: riverpodUrl, method: 'GET', body: { unexpected: true } }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

})
