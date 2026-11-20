import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById, getDefaultParameters, validateParameters } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const exactNpmRelease = {
  name: 'react',
  version: '19.1.0',
  license: 'MIT',
  engines: { node: '>=0.10.0' },
  dist: { integrity: 'sha512-example' },
  dependencies: { 'example-runtime': '^1.0.0' },
}

const sha256 = 'a'.repeat(64)

const renderPreview = (id: string, data: unknown) => {
  const api = getApiById(id)
  if (!api) throw new Error(`Missing ${id} catalog entry`)
  const url = api.buildUrl({})
  const { container } = render(<ResponseDemoPreview api={api} data={data} requestUrl={url} executedRequest={{ url, method: 'GET' }}/>)
  return container.querySelector('[data-domain-card]')
}

describe('keyless package registry operations', () => {
  afterEach(cleanup)

  it('builds the documented GET routes and uses the Simple API JSON media type', () => {
    const expected = {
      'npm-version': 'https://registry.npmjs.org/react/19.1.0',
      'npm-packument': 'https://registry.npmjs.org/is-number',
      'pypi-release': 'https://pypi.org/pypi/requests/2.32.5/json',
      'pypi-simple-project': 'https://pypi.org/simple/httpx/',
    }
    for (const [id, url] of Object.entries(expected)) {
      const api = getApiById(id)
      if (!api) throw new Error(`Missing ${id} catalog entry`)
      expect(validateParameters(api, getDefaultParameters(api))).toEqual({})
      expect(api.buildUrl({})).toBe(url)
      expect(api.method ?? 'GET').toBe('GET')
      expect(api.request).toMatchObject({ declarative: true, method: 'GET' })
    }
    const npmVersion = getApiById('npm-version')
    if (!npmVersion) throw new Error('Missing npm exact release')
    expect(validateParameters(npmVersion, { packageName: '@vitejs/plugin-react', version: '5.1.4' })).toEqual({})
    expect(npmVersion.buildUrl({ packageName: ' @vitejs/plugin-react ', version: ' 5.1.4 ' })).toBe('https://registry.npmjs.org/%40vitejs%2Fplugin-react/5.1.4')
    expect(validateParameters(npmVersion, { packageName: 'react', version: 'latest' })).toHaveProperty('version')
    expect(getApiById('pypi-simple-project')?.headers).toEqual({ Accept: 'application/vnd.pypi.simple.v1+json' })
  })

  it('shows npm version identity, license, integrity and dependency constraints', () => {
    expect(renderPreview('npm-version', exactNpmRelease)).toHaveAttribute('data-result-state', 'ready')
    expect(screen.getByText('MIT')).toBeInTheDocument()
    expect(screen.getByText('sha512-example')).toBeInTheDocument()
    expect(screen.getByText('example-runtime')).toBeInTheDocument()
  })

  it('rejects an npm response for a different release', () => {
    expect(renderPreview('npm-version', { ...exactNpmRelease, version: '19.0.0' })).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByText('MIT')).not.toBeInTheDocument()
  })

  it('sorts npm publication timestamps and retains distribution tags', () => {
    const card = renderPreview('npm-packument', {
      name: 'is-number',
      'dist-tags': { latest: '7.0.0' },
      versions: { '6.0.0': {}, '7.0.0': {} },
      time: { '6.0.0': '2018-01-01T00:00:00.000Z', '7.0.0': '2018-05-01T00:00:00.000Z' },
    })
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card?.querySelector('time')).toHaveTextContent('2018-05-01')
    expect(screen.getByText('latest')).toBeInTheDocument()
  })

  it('binds PyPI release files to the normalized project and exact release', () => {
    expect(renderPreview('pypi-release', {
      info: { name: 'Requests', version: '2.32.5' },
      urls: [{ filename: 'requests-2.32.5.tar.gz', digests: { sha256 }, requires_python: '>=3.9', yanked: false }],
    })).toHaveAttribute('data-result-state', 'ready')
    expect(screen.getByText('requests-2.32.5.tar.gz')).toBeInTheDocument()
    expect(screen.getByText(`SHA-256: ${sha256}`)).toBeInTheDocument()
  })

  it('preserves Simple API yank semantics and omits malformed distributions', () => {
    expect(renderPreview('pypi-simple-project', {
      name: 'httpx',
      meta: { 'api-version': '1.4' },
      files: [
        { filename: 'httpx-0.28.0.tar.gz', hashes: { sha256 }, 'requires-python': '>=3.8', yanked: 'Release withdrawn' },
        { filename: 'fabricated.tar.gz', hashes: { sha256: 'not-a-digest' }, yanked: false },
      ],
    })).toHaveAttribute('data-result-state', 'partial')
    expect(screen.getByText('Yanked')).toBeInTheDocument()
    expect(screen.getByText('Requires Python: >=3.8')).toBeInTheDocument()
    expect(screen.queryByText('fabricated.tar.gz')).not.toBeInTheDocument()
  })
})
