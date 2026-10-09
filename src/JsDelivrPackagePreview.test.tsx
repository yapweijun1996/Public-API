import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'jsdelivr-package')
if (!api) throw new Error('Missing jsDelivr package fixture')

const reactUrl = api.buildUrl({ packageName: 'react' })
const scopedUrl = api.buildUrl({ packageName: '@babel/core' })

const version = (packageName: string, value: string) => ({
  version: value,
  links: {
    self: `https://data.jsdelivr.com/v1/packages/npm/${encodeURIComponent(packageName)}@${value}`,
    entrypoints: `https://data.jsdelivr.com/v1/packages/npm/${encodeURIComponent(packageName)}@${value}/entrypoints`,
    stats: `https://data.jsdelivr.com/v1/stats/packages/npm/${encodeURIComponent(packageName)}@${value}`,
  },
})

const packageFixture = (name = 'react') => ({
  type: 'npm',
  name,
  tags: { latest: '19.2.8', rc: '19.0.0-rc.1' },
  versions: [version(name, '19.2.8'), version(name, '19.0.0-rc.1'), version(name, '18.3.1')],
  links: { stats: `https://data.jsdelivr.com/v1/stats/packages/npm/${encodeURIComponent(name)}` },
})

describe('jsDelivr package metadata semantic preview', () => {
  afterEach(cleanup)

  it('renders a request-bound current package response as ready', () => {
    render(<ResponseDemoPreview api={api} requestUrl={reactUrl} executedRequest={{ url: reactUrl, method: 'GET' }} data={packageFixture()}/>)
    const preview = screen.getByRole('region', { name: 'jsDelivr Package Metadata' })
    const card = preview.querySelector('[data-domain-card="jsdelivr-package"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-package', 'react')
    expect(card).toHaveAttribute('data-provider-package', 'react')
    expect(card).toHaveAttribute('data-provider-type', 'npm')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-provider-version-count', '3')
    expect(card).toHaveAttribute('data-valid-version-count', '3')
    expect(card).toHaveAttribute('data-invalid-version-count', '0')
    expect(card).toHaveAttribute('data-provider-tag-count', '2')
    expect(card).toHaveAttribute('data-valid-tag-count', '2')
    expect(card).toHaveAttribute('data-invalid-tag-count', '0')
    expect(card).toHaveAttribute('data-trusted-latest', '19.2.8')
    expect(preview).toHaveTextContent('Latest stable')
    expect(preview).toHaveTextContent('19.0.0-rc.1')
  })

  it('fails closed when an HTTP-success response belongs to a different package', () => {
    const wrong = packageFixture('fabricated-package')
    wrong.tags = { latest: '999.0.0', rc: '999.0.0' }
    wrong.versions = [version('fabricated-package', '999.0.0')]
    render(<ResponseDemoPreview api={api} requestUrl={reactUrl} data={wrong}/>)
    const preview = screen.getByRole('region', { name: 'jsDelivr Package Metadata' })
    expect(preview.querySelector('[data-domain-card="jsdelivr-package"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('jsDelivr package identity mismatch')
    expect(preview).not.toHaveTextContent('fabricated-package')
    expect(preview).not.toHaveTextContent('999.0.0')
  })

  it('keeps trustworthy rows partial while hiding malformed versions and tags', () => {
    const mixed = packageFixture() as { tags: Record<string, string>; versions: Array<{ version: string; links: Record<string, string> }>; [key: string]: unknown }
    mixed.tags = { latest: '19.2.8', rc: '999.0.0' }
    mixed.versions = [
      version('react', '19.2.8'),
      { version: '999.0.0', links: { self: 'https://data.jsdelivr.com/v1/packages/npm/react@999.0.0' } },
      version('react', '18.3.1'),
    ]
    render(<ResponseDemoPreview api={api} requestUrl={reactUrl} data={mixed}/>)
    const preview = screen.getByRole('region', { name: 'jsDelivr Package Metadata' })
    const card = preview.querySelector('[data-domain-card="jsdelivr-package"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-version-count', '3')
    expect(card).toHaveAttribute('data-valid-version-count', '2')
    expect(card).toHaveAttribute('data-invalid-version-count', '1')
    expect(card).toHaveAttribute('data-provider-tag-count', '2')
    expect(card).toHaveAttribute('data-valid-tag-count', '1')
    expect(card).toHaveAttribute('data-invalid-tag-count', '1')
    expect(preview).toHaveTextContent('19.2.8')
    expect(preview).toHaveTextContent('18.3.1')
    expect(preview).not.toHaveTextContent('999.0.0')
  })


  it('does not trust a displayed jsDelivr URL without executed-request evidence', () => {
    render(<ResponseDemoPreview api={api} requestUrl={reactUrl} data={packageFixture()}/>)
    const preview = screen.getByRole('region', { name: 'jsDelivr Package Metadata' })
    const card = preview.querySelector('[data-domain-card="jsdelivr-package"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })

  it('keeps coherent provider metadata partial when no executed request URL is available', () => {
    render(<ResponseDemoPreview api={api} data={packageFixture()}/>)
    const preview = screen.getByRole('region', { name: 'jsDelivr Package Metadata' })
    const card = preview.querySelector('[data-domain-card="jsdelivr-package"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).not.toHaveAttribute('data-requested-package')
    expect(card).not.toHaveAttribute('data-identity-match')
    expect(preview).toHaveTextContent('request identity is unavailable')
  })

  it('fails closed when the current package response lacks the versions envelope', () => {
    render(<ResponseDemoPreview api={api} requestUrl={reactUrl} data={{ type: 'npm', name: 'react', tags: { latest: '19.2.8' }, links: { stats: 'https://data.jsdelivr.com/v1/stats/packages/npm/react' } }}/>)
    const preview = screen.getByRole('region', { name: 'jsDelivr Package Metadata' })
    expect(preview.querySelector('[data-domain-card="jsdelivr-package"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid jsDelivr version envelope')
    expect(preview).not.toHaveTextContent('19.2.8')
  })

  it('fails closed when the executed transport is not the documented bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={reactUrl} executedRequest={{ url: reactUrl, method: 'POST' }} data={packageFixture()}/>)
    const preview = screen.getByRole('region', { name: 'jsDelivr Package Metadata' })
    expect(preview.querySelector('[data-domain-card="jsdelivr-package"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid jsDelivr request identity')

    rerender(<ResponseDemoPreview api={api} requestUrl={reactUrl} executedRequest={{ url: reactUrl, method: 'GET', body: { unexpected: true } }} data={packageFixture()}/>)
    expect(screen.getByRole('region', { name: 'jsDelivr Package Metadata' }).querySelector('[data-domain-card="jsdelivr-package"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('rejects non-canonical jsDelivr origins even when the path is valid', () => {
    const alternate = reactUrl.replace('https://data.jsdelivr.com', 'https://data.jsdelivr.com:444')
    render(<ResponseDemoPreview api={api} requestUrl={alternate} executedRequest={{ url: alternate, method: 'GET' }} data={packageFixture()}/>)
    const preview = screen.getByRole('region', { name: 'jsDelivr Package Metadata' })
    expect(preview.querySelector('[data-domain-card="jsdelivr-package"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('binds an encoded scoped package request to the provider-owned package name', () => {
    const scoped = {
      type: 'npm',
      name: '@babel/core',
      tags: { latest: '8.0.5' },
      versions: [version('@babel/core', '8.0.5')],
      links: { stats: 'https://data.jsdelivr.com/v1/stats/packages/npm/%40babel%2Fcore' },
    }
    expect(new URL(scopedUrl).pathname).toBe('/v1/packages/npm/%40babel%2Fcore')
    render(<ResponseDemoPreview api={api} requestUrl={scopedUrl} executedRequest={{ url: scopedUrl, method: 'GET' }} data={scoped}/>)
    const preview = screen.getByRole('region', { name: 'jsDelivr Package Metadata' })
    const card = preview.querySelector('[data-domain-card="jsdelivr-package"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-package', '@babel/core')
    expect(card).toHaveAttribute('data-provider-package', '@babel/core')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(preview).toHaveTextContent('8.0.5')
  })
})
