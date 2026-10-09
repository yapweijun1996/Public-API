import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'hexpm')
if (!api) throw new Error('Missing Hex.pm Package API fixture')

const ectoUrl = api.buildUrl({ package: 'ecto' })
const release = (version: string, overrides: Record<string, unknown> = {}) => ({
  version,
  url: `https://hex.pm/api/packages/ecto/releases/${version}`,
  has_docs: true,
  inserted_at: '2026-08-14T15:59:20.362215Z',
  ...overrides,
})
const fixture = (overrides: Record<string, unknown> = {}) => ({
  meta: {
    links: { GitHub: 'https://github.com/elixir-ecto/ecto' },
    description: 'A toolkit for data mapping and language integrated query for Elixir',
    licenses: ['Apache-2.0'],
    maintainers: [],
  },
  name: 'ecto',
  url: 'https://hex.pm/api/packages/ecto',
  owners: [{ url: 'https://hex.pm/api/users/ericmj', email: 'eric@example.test', username: 'ericmj' }],
  inserted_at: '2014-04-21T08:06:56.000000Z',
  updated_at: '2026-08-14T15:59:23.000000Z',
  repository: 'hexpm',
  releases: [release('3.14.2'), release('3.14.1')],
  html_url: 'https://hex.pm/packages/ecto',
  latest_version: '3.14.2',
  downloads: { all: 146_785_342, day: 64_438, recent: 4_559_972, week: 429_542 },
  configs: { 'mix.exs': '{:ecto, "~> 3.14"}', 'rebar.config': '{ecto, "3.14.2"}', 'erlang.mk': 'dep_ecto = hex 3.14.2' },
  retirements: {},
  latest_stable_version: '3.14.2',
  ...overrides,
})

const card = () => screen.getByRole('region', { name: 'Hex.pm Package API' }).querySelector('[data-domain-card="hexpm-package"]')

describe('Hex.pm package semantic preview', () => {
  afterEach(cleanup)

  it('renders request-bound package metadata as ready', () => {
    render(<ResponseDemoPreview api={api} requestUrl={ectoUrl} executedRequest={{ url: ectoUrl, method: 'GET' }} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'Hex.pm Package API' })
    expect(preview).toHaveAttribute('data-preview-layout', 'hex-package')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-requested-package', 'ecto')
    expect(card()).toHaveAttribute('data-provider-package', 'ecto')
    expect(card()).toHaveAttribute('data-identity-match', 'true')
    expect(card()).toHaveAttribute('data-provider-release-count', '2')
    expect(card()).toHaveAttribute('data-valid-release-count', '2')
    expect(card()).toHaveAttribute('data-invalid-release-count', '0')
    expect(card()).toHaveAttribute('data-latest-version', '3.14.2')
    expect(card()).toHaveAttribute('data-latest-stable-version', '3.14.2')
    expect(card()).toHaveAttribute('data-total-downloads', '146785342')
    expect(card()).toHaveAttribute('data-recent-downloads', '4559972')
    expect(card()).toHaveAttribute('data-owner-count', '1')
    expect(card()).toHaveAttribute('data-license-count', '1')
    expect(preview).toHaveTextContent('3.14.2')
    expect(preview).toHaveTextContent('146,785,342')
    expect(preview).toHaveTextContent('Apache-2.0')
  })

  it('fails closed when an HTTP-success body identifies a different package', () => {
    render(<ResponseDemoPreview api={api} requestUrl={ectoUrl} data={fixture({
      name: 'fabricated_package',
      url: 'https://hex.pm/api/packages/fabricated_package',
      latest_version: '999.0.0',
      latest_stable_version: '999.0.0',
      downloads: { all: 999_999_999, recent: 999_999, week: 99_999, day: 9_999 },
    })}/>)
    const preview = screen.getByRole('region', { name: 'Hex.pm Package API' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Hex.pm package identity mismatch')
    expect(preview).not.toHaveTextContent('fabricated_package')
    expect(preview).not.toHaveTextContent('999.0.0')
    expect(preview).not.toHaveTextContent('999,999,999')
  })

  it('fails closed when provider-owned package identity contradicts its own package URL', () => {
    render(<ResponseDemoPreview api={api} requestUrl={ectoUrl} data={fixture({ url: 'https://hex.pm/api/packages/phoenix' })}/>)
    const preview = screen.getByRole('region', { name: 'Hex.pm Package API' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Hex.pm provider identity mismatch')
    expect(preview).not.toHaveTextContent('146,785,342')
  })

  it('keeps mixed release data partial and hides malformed release rows', () => {
    render(<ResponseDemoPreview api={api} requestUrl={ectoUrl} data={fixture({
      releases: [release('3.14.2'), release('999.0.0', { url: 'https://example.test/fabricated', has_docs: 'yes' })],
    })}/>)
    const preview = screen.getByRole('region', { name: 'Hex.pm Package API' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-provider-release-count', '2')
    expect(card()).toHaveAttribute('data-valid-release-count', '1')
    expect(card()).toHaveAttribute('data-invalid-release-count', '1')
    expect(preview).toHaveTextContent('3.14.2')
    expect(preview).not.toHaveTextContent('999.0.0')
  })

  it('does not coerce malformed download counters into trusted package facts', () => {
    render(<ResponseDemoPreview api={api} requestUrl={ectoUrl} data={fixture({ downloads: { all: '146785342', recent: -1, week: 429_542, day: 64_438 } })}/>)
    const preview = screen.getByRole('region', { name: 'Hex.pm Package API' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).not.toHaveAttribute('data-total-downloads')
    expect(card()).not.toHaveAttribute('data-recent-downloads')
    expect(preview).toHaveTextContent('Downloads unavailable')
    expect(preview).not.toHaveTextContent('146,785,342')
  })

  it('treats omitted optional releases as partial instead of inventing an empty package', () => {
    const withoutReleases = fixture()
    delete (withoutReleases as Partial<typeof withoutReleases>).releases
    render(<ResponseDemoPreview api={api} requestUrl={ectoUrl} data={withoutReleases}/>)
    const preview = screen.getByRole('region', { name: 'Hex.pm Package API' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).not.toHaveAttribute('data-provider-release-count')
    expect(preview).toHaveTextContent('Release list unavailable')
    expect(preview).toHaveTextContent('3.14.2')
  })


  it('does not trust a displayed Hex.pm URL without executed-request evidence', () => {
    render(<ResponseDemoPreview api={api} requestUrl={ectoUrl} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'Hex.pm Package API' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })

  it('keeps trustworthy provider metadata partial when executed-request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'Hex.pm Package API' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).not.toHaveAttribute('data-requested-package')
    expect(card()).toHaveAttribute('data-provider-package', 'ecto')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })
  it('fails closed when the executed transport is not the documented bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={ectoUrl} executedRequest={{ url: ectoUrl, method: 'POST' }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'Hex.pm Package API' })).toHaveTextContent('Invalid Hex.pm request identity')

    rerender(<ResponseDemoPreview api={api} requestUrl={ectoUrl} executedRequest={{ url: ectoUrl, method: 'GET', body: { unexpected: true } }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

})
