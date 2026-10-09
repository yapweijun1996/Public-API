import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'go-module-proxy')
if (!api) throw new Error('Missing Go Module Proxy fixture')

const ginUrl = api.buildUrl({ module: 'github.com/gin-gonic/gin' })
const azureUrl = api.buildUrl({ module: 'github.com/Azure/azure-sdk-for-go' })
const card = (container: HTMLElement) => container.querySelector('[data-domain-card="go-module-versions"]') as HTMLElement | null

describe('Go Module Proxy semantic preview', () => {
  afterEach(cleanup)

  it('uses the GOPROXY uppercase escape convention for mixed-case module paths', () => {
    expect(azureUrl).toBe('https://proxy.golang.org/github.com/!azure/azure-sdk-for-go/@v/list')
    expect(new URL(ginUrl).pathname).toBe('/github.com/gin-gonic/gin/@v/list')
  })

  it('binds a valid list to the executed module request and sorts versions semantically', () => {
    const { container } = render(<ResponseDemoPreview api={api} requestUrl={ginUrl} executedRequest={{ url: ginUrl, method: 'GET' }} data={{ versions: ['v1.9.0', 'v1.3.0', 'v1.12.0', 'v1.12.0-rc.1', 'v1.11.2+incompatible'] }}/>)
    const result = card(container)
    expect(result).toHaveAttribute('data-result-state', 'ready')
    expect(result).toHaveAttribute('data-requested-module', 'github.com/gin-gonic/gin')
    expect(result).toHaveAttribute('data-request-bound', 'true')
    expect(result).toHaveAttribute('data-request-contract', 'exact-go-module-version-list-v2')
    expect(result).toHaveAttribute('data-provider-version-count', '5')
    expect(result).toHaveAttribute('data-valid-version-count', '5')
    expect(result).toHaveAttribute('data-invalid-version-count', '0')
    expect(result).toHaveAttribute('data-highest-listed-version', 'v1.12.0')
    expect(result).toHaveTextContent('Highest listed')
    expect(result).not.toHaveTextContent('Latest listed')
  })

  it('does not promote a canonical displayed URL to request-bound readiness without executed transport evidence', () => {
    const { container } = render(<ResponseDemoPreview api={api} requestUrl={ginUrl} data={{ versions: ['v1.12.0'] }}/>)
    const result = card(container)
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-request-bound', 'false')
    expect(result).toHaveAttribute('data-requested-module', 'github.com/gin-gonic/gin')
    expect(result).toHaveTextContent('executed-request identity is unavailable')
  })

  it('keeps trusted versions partial while hiding malformed, duplicate, and pseudo-version lines', () => {
    const { container } = render(<ResponseDemoPreview api={api} requestUrl={ginUrl} executedRequest={{ url: ginUrl, method: 'GET' }} data={{ versions: ['v1.12.0', 'not-a-version', 'v1.12.0', 'v1.12.1-0.20260912010101-abcdefabcdef', 'v1.11.0'] }}/>)
    const result = card(container)
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-provider-version-count', '5')
    expect(result).toHaveAttribute('data-valid-version-count', '2')
    expect(result).toHaveAttribute('data-invalid-version-count', '3')
    expect(result).toHaveTextContent('v1.12.0')
    expect(result).toHaveTextContent('v1.11.0')
    expect(result).not.toHaveTextContent('not-a-version')
    expect(result).not.toHaveTextContent('abcdefabcdef')
  })

  it('fails closed when the parsed HTTP-success payload lacks the versions envelope', () => {
    const { container } = render(<ResponseDemoPreview api={api} requestUrl={ginUrl} data={{ version: 'v99.0.0' }}/>)
    const result = card(container)
    expect(result).toHaveAttribute('data-result-state', 'invalid')
    expect(result).toHaveTextContent('Invalid Go module proxy response')
    expect(result).not.toHaveTextContent('v99.0.0')
  })

  it('treats a request-bound empty list as semantic empty', () => {
    const { container } = render(<ResponseDemoPreview api={api} requestUrl={ginUrl} executedRequest={{ url: ginUrl, method: 'GET' }} data={{ versions: [] }}/>)
    const result = card(container)
    expect(result).toHaveAttribute('data-result-state', 'empty')
    expect(result).toHaveAttribute('data-requested-module', 'github.com/gin-gonic/gin')
    expect(result).toHaveTextContent('No tagged module versions listed')
  })

  it('keeps a valid version list partial when executed-request identity is unavailable', () => {
    const { container } = render(<ResponseDemoPreview api={api} data={{ versions: ['v1.12.0'] }}/>)
    const result = card(container)
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-request-bound', 'false')
    expect(result).not.toHaveAttribute('data-requested-module')
    expect(result).toHaveTextContent('executed-request identity is unavailable')
  })

  it('fails closed when the supplied request URL is not the supported version-list endpoint', () => {
    const { container } = render(<ResponseDemoPreview api={api} requestUrl="https://proxy.golang.org/github.com/gin-gonic/gin/@latest" data={{ versions: ['v1.12.0'] }}/>)
    const result = card(container)
    expect(result).toHaveAttribute('data-result-state', 'invalid')
    expect(result).toHaveTextContent('Invalid Go module request identity')
    expect(result).not.toHaveTextContent('v1.12.0')
  })
  it('fails closed when the executed transport is not the documented bodyless GET', () => {
    const { container, rerender } = render(<ResponseDemoPreview api={api} requestUrl={ginUrl} executedRequest={{ url: ginUrl, method: 'POST' }} data={{ versions: ['v1.12.0'] }}/>)
    expect(card(container)).toHaveAttribute('data-result-state', 'invalid')
    expect(card(container)).toHaveTextContent('Invalid Go module request identity')

    rerender(<ResponseDemoPreview api={api} requestUrl={ginUrl} executedRequest={{ url: ginUrl, method: 'GET', body: { unexpected: true } }} data={{ versions: ['v1.12.0'] }}/>)
    expect(card(container)).toHaveAttribute('data-result-state', 'invalid')
  })

})
