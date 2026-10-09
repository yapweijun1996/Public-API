import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'rubygems-lookup')
if (!api) throw new Error('Missing RubyGems Package Lookup fixture')

const railsUrl = api.buildUrl({ gemName: 'rails' })
const fixture = (overrides: Record<string, unknown> = {}) => ({
  name: 'rails',
  downloads: 786_894_108,
  version: '8.1.3.1',
  version_created_at: '2026-07-29T15:02:41.060Z',
  version_downloads: 6_971_496,
  platform: 'ruby',
  authors: 'David Heinemeier Hansson',
  info: 'Ruby on Rails is a full-stack web framework.',
  licenses: ['MIT'],
  yanked: false,
  project_uri: 'https://rubygems.org/gems/rails',
  gem_uri: 'https://rubygems.org/gems/rails-8.1.3.1.gem',
  homepage_uri: 'https://rubyonrails.org',
  ...overrides,
})

const card = () => screen.getByRole('region', { name: 'RubyGems Package Lookup' }).querySelector('[data-domain-card="rubygems-package"]')

describe('RubyGems package semantic preview', () => {
  afterEach(cleanup)

  it('renders a request-bound gem response as ready', () => {
    render(<ResponseDemoPreview api={api} requestUrl={railsUrl} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'RubyGems Package Lookup' })
    expect(preview).toHaveAttribute('data-preview-layout', 'package-release')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-requested-gem', 'rails')
    expect(card()).toHaveAttribute('data-provider-gem', 'rails')
    expect(card()).toHaveAttribute('data-identity-match', 'true')
    expect(card()).toHaveAttribute('data-provider-version', '8.1.3.1')
    expect(card()).toHaveAttribute('data-total-downloads', '786894108')
    expect(card()).toHaveAttribute('data-version-downloads', '6971496')
    expect(card()).toHaveAttribute('data-platform', 'ruby')
    expect(card()).toHaveAttribute('data-license-count', '1')
    expect(preview).toHaveTextContent('8.1.3.1')
    expect(preview).toHaveTextContent('786,894,108')
    expect(preview).toHaveTextContent('MIT')
  })

  it('fails closed when an HTTP-success body identifies a different gem', () => {
    render(<ResponseDemoPreview api={api} requestUrl={railsUrl} data={fixture({ name: 'fabricated-gem', version: '999.0.0', downloads: 999_999_999 })}/>)
    const preview = screen.getByRole('region', { name: 'RubyGems Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('RubyGems package identity mismatch')
    expect(preview).not.toHaveTextContent('fabricated-gem')
    expect(preview).not.toHaveTextContent('999.0.0')
    expect(preview).not.toHaveTextContent('999,999,999')
  })

  it('fails closed when the HTTP-success body is not the documented gem object', () => {
    render(<ResponseDemoPreview api={api} requestUrl={railsUrl} data={['rails']}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'RubyGems Package Lookup' })).toHaveTextContent('Invalid RubyGems package response')
  })

  it('does not trust numeric strings or negative download counts', () => {
    render(<ResponseDemoPreview api={api} requestUrl={railsUrl} data={fixture({ downloads: '786894108', version_downloads: -5 })}/>)
    const preview = screen.getByRole('region', { name: 'RubyGems Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).not.toHaveAttribute('data-total-downloads')
    expect(card()).not.toHaveAttribute('data-version-downloads')
    expect(preview).toHaveTextContent('Downloads unavailable')
    expect(preview).not.toHaveTextContent('786,894,108')
  })

  it('keeps trustworthy provider data partial when executed-request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={fixture()}/>)
    const preview = screen.getByRole('region', { name: 'RubyGems Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).not.toHaveAttribute('data-requested-gem')
    expect(card()).toHaveAttribute('data-provider-gem', 'rails')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })

  it('accepts null licences as legitimate unavailable optional metadata', () => {
    render(<ResponseDemoPreview api={api} requestUrl={railsUrl} data={fixture({ licenses: null })}/>)
    const preview = screen.getByRole('region', { name: 'RubyGems Package Lookup' })
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-license-count', '0')
    expect(preview).toHaveTextContent('License unavailable')
  })
  it('fails closed when the executed transport is not the documented bodyless GET', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={railsUrl} executedRequest={{ url: railsUrl, method: 'POST' }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'RubyGems Package Lookup' })).toHaveTextContent('Invalid RubyGems request identity')

    rerender(<ResponseDemoPreview api={api} requestUrl={railsUrl} executedRequest={{ url: railsUrl, method: 'GET', body: { unexpected: true } }} data={fixture()}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
  })

})
