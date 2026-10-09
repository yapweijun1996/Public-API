import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'homebrew-formula-json')
if (!api) throw new Error('Missing Homebrew fixture')

const formulaUrl = api.buildUrl({ formula: 'node', collection: 'formula' })
const caskUrl = api.buildUrl({ formula: 'postman', collection: 'cask' })

describe('Homebrew package semantic preview', () => {
  afterEach(cleanup)

  it('renders formula version, licence, bottle and dependency semantics with bound provider identity', () => {
    render(<ResponseDemoPreview api={api} requestUrl={formulaUrl} executedRequest={{ url: formulaUrl, method: 'GET' }} data={{ name: 'node', full_name: 'node', tap: 'homebrew/core', desc: 'JavaScript runtime', license: 'MIT', homepage: 'https://nodejs.org/', versions: { stable: '26.8.2', head: 'HEAD', bottle: true }, keg_only: false, dependencies: ['libuv', 'openssl@3'], build_dependencies: ['pkgconf'], uses_from_macos: ['python'], bottle: { stable: { files: { arm64_tahoe: {}, arm64_linux: {} } } } }}/>)
    const preview = screen.getByRole('region', { name: 'Homebrew Formula JSON' })
    expect(preview).toHaveAttribute('data-preview-layout', 'homebrew-package')
    const card = preview.querySelector('.homebrew-package-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-package-kind', 'formula')
    expect(card).toHaveAttribute('data-requested-package-token', 'node')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-package-kind', 'formula')
    expect(card).toHaveAttribute('data-package-token', 'node')
    expect(card).toHaveAttribute('data-provider-tap', 'homebrew/core')
    expect(card).toHaveAttribute('data-package-name', 'node')
    expect(card).toHaveAttribute('data-version', '26.8.2')
    expect(card).toHaveAttribute('data-license', 'MIT')
    expect(card).toHaveAttribute('data-dependency-count', '2')
    expect(card).toHaveAttribute('data-bottle-platform-count', '2')
    expect(preview).toHaveTextContent('Runtime dependencies')
    expect(preview).toHaveTextContent('libuv')
    expect(preview).not.toHaveTextContent('Homebrew Formula JSON record 1')
  })

  it('keeps cask app artifacts and macOS requirements separate from formula dependencies', () => {
    render(<ResponseDemoPreview api={api} requestUrl={caskUrl} executedRequest={{ url: caskUrl, method: 'GET' }} data={{ token: 'postman', full_token: 'postman', name: ['Postman'], desc: 'API development platform', homepage: 'https://www.postman.com/', version: '12.27.1', auto_updates: true, tap: 'homebrew/cask', depends_on: { macos: { '>=': ['11'] } }, artifacts: [{ uninstall: [{ quit: 'com.postmanlabs.mac' }] }, { app: ['Postman.app'], target: '/Applications/Postman.app' }, { zap: [{ trash: ['~/Library/Caches/Postman'] }] }], deprecated: false, disabled: false }}/>)
    const preview = screen.getByRole('region', { name: 'Homebrew Formula JSON' })
    const card = preview.querySelector('.homebrew-package-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-package-kind', 'cask')
    expect(card).toHaveAttribute('data-requested-package-token', 'postman')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-package-kind', 'cask')
    expect(card).toHaveAttribute('data-package-token', 'postman')
    expect(card).toHaveAttribute('data-provider-tap', 'homebrew/cask')
    expect(card).toHaveAttribute('data-version', '12.27.1')
    expect(card).toHaveAttribute('data-auto-updates', 'true')
    expect(card).toHaveAttribute('data-macos-requirement', '>= 11')
    expect(card).toHaveAttribute('data-artifact-count', '3')
    expect(preview).toHaveTextContent('Postman.app')
    expect(preview).toHaveTextContent('Auto-updates')
    expect(preview).not.toHaveTextContent('Runtime dependencies')
  })

  it('fails closed when HTTP-success data is not the documented package object', () => {
    render(<ResponseDemoPreview api={api} requestUrl={formulaUrl} data={[]} />)
    const preview = screen.getByRole('region', { name: 'Homebrew Formula JSON' })
    expect(preview.querySelector('[data-domain-card="homebrew-package"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid Homebrew package response')
  })

  it('fails closed when formula HTTP-success data lacks provider-owned identity', () => {
    render(<ResponseDemoPreview api={api} requestUrl={formulaUrl} data={{ desc: 'FABRICATED', versions: { stable: '999' } }} />)
    const preview = screen.getByRole('region', { name: 'Homebrew Formula JSON' })
    expect(preview.querySelector('[data-domain-card="homebrew-package"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('FABRICATED')
    expect(preview).not.toHaveTextContent('999')
  })

  it('fails closed when the direct lookup returns a different formula identity', () => {
    render(<ResponseDemoPreview api={api} requestUrl={formulaUrl} data={{ name: 'fabricated', full_name: 'fabricated', tap: 'homebrew/core', desc: 'FABRICATED', versions: { stable: '999' }, dependencies: [], build_dependencies: [] }} />)
    const preview = screen.getByRole('region', { name: 'Homebrew Formula JSON' })
    expect(preview.querySelector('[data-domain-card="homebrew-package"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Homebrew package identity mismatch')
    expect(preview).not.toHaveTextContent('FABRICATED')
    expect(preview).not.toHaveTextContent('999')
  })

  it('fails closed when a formula request receives the cask response shape', () => {
    render(<ResponseDemoPreview api={api} requestUrl={formulaUrl} data={{ token: 'node', full_token: 'node', tap: 'homebrew/cask', name: ['Node'], version: '999' }} />)
    const preview = screen.getByRole('region', { name: 'Homebrew Formula JSON' })
    expect(preview.querySelector('[data-domain-card="homebrew-package"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Homebrew package kind mismatch')
    expect(preview).not.toHaveTextContent('999')
  })

  it('fails closed when the executed transport is not the documented bodyless GET', () => {
    const formula = { name: 'node', full_name: 'node', tap: 'homebrew/core', versions: { stable: '26.8.2', bottle: true }, dependencies: [], build_dependencies: [] }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={formulaUrl} executedRequest={{ url: formulaUrl, method: 'POST' }} data={formula}/>)
    const preview = screen.getByRole('region', { name: 'Homebrew Formula JSON' })
    expect(preview.querySelector('[data-domain-card="homebrew-package"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid Homebrew request identity')

    rerender(<ResponseDemoPreview api={api} requestUrl={formulaUrl} executedRequest={{ url: formulaUrl, method: 'GET', body: { unexpected: true } }} data={formula}/>)
    expect(screen.getByRole('region', { name: 'Homebrew Formula JSON' }).querySelector('[data-domain-card="homebrew-package"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when a Homebrew-shaped path comes from a non-canonical origin', () => {
    const formula = { name: 'node', full_name: 'node', tap: 'homebrew/core', versions: { stable: '26.8.2', bottle: true }, dependencies: [], build_dependencies: [] }
    const foreignUrl = 'https://example.com/api/formula/node.json'
    render(<ResponseDemoPreview api={api} requestUrl={foreignUrl} executedRequest={{ url: foreignUrl, method: 'GET' }} data={formula}/>)
    const preview = screen.getByRole('region', { name: 'Homebrew Formula JSON' })
    expect(preview.querySelector('[data-domain-card="homebrew-package"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid Homebrew request identity')
  })


  it('does not trust a displayed Homebrew URL without executed-request evidence', () => {
    const formula = { name: 'node', full_name: 'node', tap: 'homebrew/core', versions: { stable: '26.8.2', bottle: true }, dependencies: [], build_dependencies: [] }
    render(<ResponseDemoPreview api={api} requestUrl={formulaUrl} data={formula}/>)
    const preview = screen.getByRole('region', { name: 'Homebrew Formula JSON' })
    const card = preview.querySelector('.homebrew-package-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })

  it('keeps a valid but unbound package identity partial when no executed request URL is available', () => {
    render(<ResponseDemoPreview api={api} data={{ name: 'node', full_name: 'node', tap: 'homebrew/core', versions: { stable: '26.8.2', bottle: true }, dependencies: [], build_dependencies: [] }} />)
    const preview = screen.getByRole('region', { name: 'Homebrew Formula JSON' })
    const card = preview.querySelector('.homebrew-package-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).not.toHaveAttribute('data-requested-package-token')
    expect(card).not.toHaveAttribute('data-identity-match')
    expect(preview).toHaveTextContent('executed-request identity is unavailable')
  })
})
