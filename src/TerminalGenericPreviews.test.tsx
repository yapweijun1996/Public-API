import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const ipify = apiCatalog.find((candidate) => candidate.id === 'ipify-public-ip')
const catfacts = apiCatalog.find((candidate) => candidate.id === 'catfacts')
if (!ipify || !catfacts) throw new Error('Missing terminal generic preview fixtures')

describe('final generic preview migrations', () => {
  afterEach(cleanup)

  it('keeps ipify on the official universal JSON endpoint and presents network identity semantics', () => {
    const url = new URL(ipify.buildUrl({}))
    expect(url.hostname).toBe('api64.ipify.org')
    expect(url.searchParams.get('format')).toBe('json')

    render(<ResponseDemoPreview api={ipify} data={{ ip: '2001:db8::1' }}/>)
    const preview = screen.getByRole('region', { name: 'ipify Public IP' })
    expect(preview).toHaveAttribute('data-preview-layout', 'public-ip')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')
    const card = preview.querySelector('.ipify-public-ip-preview')
    expect(card).toHaveAttribute('data-domain-card', 'public-ip')
    expect(card).toHaveAttribute('data-ip-family', 'IPv6')
    expect(card).toHaveAttribute('data-public-ip', '2001:db8::1')
    expect(preview).toHaveTextContent('Public network address')
    expect(preview).toHaveTextContent('Seen by the ipify request endpoint')
    expect(preview).toHaveTextContent('does not provide geolocation')
    expect(screen.getByRole('button', { name: 'Copy public IP address' })).toBeInTheDocument()
    expect(preview).not.toHaveTextContent('ipify Public IP record 1')
  })

  it('fails malformed ipify HTTP-success identity closed instead of guessing IPv4', () => {
    render(<ResponseDemoPreview api={ipify} data={{ ip: 'not-an-ip' }}/>)
    const preview = screen.getByRole('region', { name: 'ipify Public IP' })
    const card = preview.querySelector('[data-domain-card="public-ip"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid public IP response')
    expect(preview).toHaveTextContent('valid IPv4 or IPv6')
    expect(preview).not.toHaveTextContent('not-an-ip')
    expect(screen.queryByRole('button', { name: 'Copy public IP address' })).not.toBeInTheDocument()
  })

  it('presents Cat Facts as readable provider content with explicit reported length', () => {
    const url = new URL(catfacts.buildUrl({}))
    expect(url.hostname).toBe('catfact.ninja')
    expect(url.pathname).toBe('/fact')

    render(<ResponseDemoPreview api={catfacts} data={{ fact: 'Cats can rotate their ears independently.', length: 41 }}/>)
    const preview = screen.getByRole('region', { name: 'Cat Facts Generator' })
    expect(preview).toHaveAttribute('data-preview-layout', 'cat-fact')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')
    const card = preview.querySelector('.cat-fact-preview')
    expect(card).toHaveAttribute('data-domain-card', 'cat-fact')
    expect(card).toHaveAttribute('data-fact-length', '41')
    expect(preview).toHaveTextContent('Cats can rotate their ears independently.')
    expect(preview).toHaveTextContent('41 characters')
    expect(preview).toHaveTextContent('Random fact per request')
    expect(preview).not.toHaveTextContent('Cat Facts Generator record 1')
  })
})
