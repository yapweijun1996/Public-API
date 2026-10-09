import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'nuget-package-lookup')
if (!api) throw new Error('Missing NuGet Package Lookup fixture')

const newtonsoftUrl = api.buildUrl({ packageId: 'Newtonsoft.Json' })
const versioningUrl = api.buildUrl({ packageId: 'NuGet.Versioning' })

const leaf = (packageId: string, version: string, extras: Record<string, unknown> = {}) => ({
  '@id': `https://api.nuget.org/v3/registration5-gz-semver2/${packageId.toLowerCase()}/${version}.json`,
  catalogEntry: {
    '@id': `https://api.nuget.org/v3/catalog0/data/example/${packageId.toLowerCase()}.${version}.json`,
    id: packageId,
    version,
    authors: 'NuGet authors',
    description: `${packageId} ${version} package metadata`,
    licenseExpression: 'MIT',
    published: '2026-01-01T00:00:00Z',
    ...extras,
  },
  packageContent: `https://api.nuget.org/v3-flatcontainer/${packageId.toLowerCase()}/${version}/${packageId.toLowerCase()}.${version}.nupkg`,
})

const inlineFixture = (packageId = 'Newtonsoft.Json') => ({
  '@id': `https://api.nuget.org/v3/registration5-gz-semver2/${packageId.toLowerCase()}/index.json`,
  count: 1,
  items: [{
    '@id': `https://api.nuget.org/v3/registration5-gz-semver2/${packageId.toLowerCase()}/index.json#page/12.0.1/13.0.5-beta1`,
    count: 3,
    lower: '12.0.1',
    upper: '13.0.5-beta1',
    parent: `https://api.nuget.org/v3/registration5-gz-semver2/${packageId.toLowerCase()}/index.json`,
    items: [leaf(packageId, '12.0.1'), leaf(packageId, '13.0.4'), leaf(packageId, '13.0.5-beta1')],
  }],
})

const pagedFixture = () => ({
  '@id': 'https://api.nuget.org/v3/registration5-gz-semver2/nuget.versioning/index.json',
  count: 3,
  items: [
    { '@id': 'https://api.nuget.org/v3/registration5-gz-semver2/nuget.versioning/page/0.1.0-alpha/4.8.0-rtm.5362.json', count: 64, lower: '0.1.0-alpha', upper: '4.8.0-rtm.5362' },
    { '@id': 'https://api.nuget.org/v3/registration5-gz-semver2/nuget.versioning/page/4.8.0/6.0.3-rc.1.json', count: 64, lower: '4.8.0', upper: '6.0.3-rc.1' },
    { '@id': 'https://api.nuget.org/v3/registration5-gz-semver2/nuget.versioning/page/6.0.5/7.9.0.json', count: 48, lower: '6.0.5', upper: '7.9.0' },
  ],
})

const card = () => screen.getByRole('region', { name: 'NuGet Package Lookup' }).querySelector('[data-domain-card="nuget-package"]')

describe('NuGet registration semantic preview', () => {
  afterEach(cleanup)

  it('uses the SemVer 2 registration hive and lowercases the package ID', () => {
    expect(newtonsoftUrl).toBe('https://api.nuget.org/v3/registration5-gz-semver2/newtonsoft.json/index.json')
    expect(versioningUrl).toBe('https://api.nuget.org/v3/registration5-gz-semver2/nuget.versioning/index.json')
  })

  it('renders a fully inlined request-bound registration index as ready', () => {
    render(<ResponseDemoPreview api={api} requestUrl={newtonsoftUrl} executedRequest={{ url: newtonsoftUrl, method: 'GET' }} data={inlineFixture()}/>)
    const preview = screen.getByRole('region', { name: 'NuGet Package Lookup' })
    expect(preview).toHaveAttribute('data-preview-layout', 'package-registration')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-requested-package', 'newtonsoft.json')
    expect(card()).toHaveAttribute('data-provider-package', 'Newtonsoft.Json')
    expect(card()).toHaveAttribute('data-identity-match', 'true')
    expect(card()).toHaveAttribute('data-provider-page-count', '1')
    expect(card()).toHaveAttribute('data-provider-version-count', '3')
    expect(card()).toHaveAttribute('data-inline-version-count', '3')
    expect(card()).toHaveAttribute('data-valid-inline-version-count', '3')
    expect(card()).toHaveAttribute('data-invalid-inline-version-count', '0')
    expect(card()).toHaveAttribute('data-omitted-page-count', '0')
    expect(card()).toHaveAttribute('data-highest-registered-version', '13.0.5-beta1')
    expect(preview).toHaveTextContent('Newtonsoft.Json')
    expect(preview).toHaveTextContent('13.0.5-beta1')
    expect(preview).toHaveTextContent('MIT')
  })

  it('does not trust a displayed request URL without executed-request evidence', () => {
    render(<ResponseDemoPreview api={api} requestUrl={newtonsoftUrl} data={inlineFixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(screen.getByRole('region', { name: 'NuGet Package Lookup' })).toHaveTextContent('executed-request identity is unavailable')
  })

  it('keeps a large registration index partial when NuGet omits page leaves by contract', () => {
    render(<ResponseDemoPreview api={api} requestUrl={versioningUrl} executedRequest={{ url: versioningUrl, method: 'GET' }} data={pagedFixture()}/>)
    const preview = screen.getByRole('region', { name: 'NuGet Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-requested-package', 'nuget.versioning')
    expect(card()).toHaveAttribute('data-provider-page-count', '3')
    expect(card()).toHaveAttribute('data-provider-version-count', '176')
    expect(card()).toHaveAttribute('data-inline-version-count', '0')
    expect(card()).toHaveAttribute('data-omitted-page-count', '3')
    expect(card()).toHaveAttribute('data-highest-registered-version', '7.9.0')
    expect(preview).toHaveTextContent('176 registered versions')
    expect(preview).toHaveTextContent('page metadata is not inlined')
    expect(preview).not.toHaveTextContent('Developer records unavailable')
  })

  it('fails closed when an HTTP-success registration root belongs to a different package', () => {
    const wrong = inlineFixture('Fabricated.Package')
    render(<ResponseDemoPreview api={api} requestUrl={newtonsoftUrl} data={wrong}/>)
    const preview = screen.getByRole('region', { name: 'NuGet Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('NuGet package identity mismatch')
    expect(preview).not.toHaveTextContent('Fabricated.Package 13.0.5-beta1')
  })

  it('keeps trustworthy inline leaves partial while hiding wrong-package and malformed leaves', () => {
    const mixed = inlineFixture() as ReturnType<typeof inlineFixture>
    mixed.items[0].count = 4
    mixed.items[0].items.push(leaf('Fabricated.Package', '999.0.0'))
    render(<ResponseDemoPreview api={api} requestUrl={newtonsoftUrl} data={mixed}/>)
    const preview = screen.getByRole('region', { name: 'NuGet Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-provider-version-count', '4')
    expect(card()).toHaveAttribute('data-inline-version-count', '4')
    expect(card()).toHaveAttribute('data-valid-inline-version-count', '3')
    expect(card()).toHaveAttribute('data-invalid-inline-version-count', '1')
    expect(preview).toHaveTextContent('13.0.5-beta1')
    expect(preview).not.toHaveTextContent('999.0.0')
    expect(preview).not.toHaveTextContent('Fabricated.Package')
  })

  it('keeps a coherent provider registration partial when executed-request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={inlineFixture()}/>)
    const preview = screen.getByRole('region', { name: 'NuGet Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).not.toHaveAttribute('data-requested-package')
    expect(card()).toHaveAttribute('data-provider-package', 'Newtonsoft.Json')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })

  it('fails closed when the HTTP-success body lacks the documented registration pages', () => {
    render(<ResponseDemoPreview api={api} requestUrl={newtonsoftUrl} data={{ count: 1, package: { id: 'Newtonsoft.Json', version: '999.0.0' } }}/>)
    const preview = screen.getByRole('region', { name: 'NuGet Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid NuGet registration response')
    expect(preview).not.toHaveTextContent('999.0.0')
  })
  it('fails closed when the displayed and executed NuGet request URLs drift', () => {
    render(<ResponseDemoPreview api={api} requestUrl={newtonsoftUrl} executedRequest={{ url: versioningUrl, method: 'GET' }} data={inlineFixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'NuGet Package Lookup' })).toHaveTextContent('Invalid NuGet request identity')
  })

  it('fails closed when the executed transport is not the documented bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={newtonsoftUrl} executedRequest={{ url: newtonsoftUrl, method: 'POST' }} data={inlineFixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'NuGet Package Lookup' })).toHaveTextContent('Invalid NuGet request identity')

    rerender(<ResponseDemoPreview api={api} requestUrl={newtonsoftUrl} executedRequest={{ url: newtonsoftUrl, method: 'GET', body: { unexpected: true } }} data={inlineFixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

})
