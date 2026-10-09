import { render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'
import { parseFlathubAppstreamRequest, parseFlathubAppstreamResponse } from './previews/FlathubAppstreamPreview'

const api = getApiById('flathub-appstream')!
const requestUrl = api.buildUrl({ appId: 'org.gnome.Calculator' })
const executedRequest = { method: 'GET', url: requestUrl }

const response = (overrides: Record<string, unknown> = {}) => ({
  id: 'org.gnome.Calculator',
  name: 'Calculator',
  summary: 'Perform arithmetic, scientific or financial calculations',
  developer_name: 'The GNOME Project',
  project_license: 'GPL-3.0-or-later',
  is_free_license: true,
  bundle: {
    type: 'flatpak',
    value: 'app/org.gnome.Calculator/x86_64/stable',
    runtime: 'org.gnome.Platform/x86_64/50',
  },
  launchable: { type: 'desktop-id', value: 'org.gnome.Calculator.desktop' },
  urls: {
    homepage: 'https://apps.gnome.org/Calculator',
    vcs_browser: 'https://gitlab.gnome.org/GNOME/gnome-calculator',
  },
  releases: [{
    type: 'stable',
    version: '50.0',
    timestamp: '1767225600',
    description: '<img src=x onerror="alert(1)"><p>Provider HTML must not render.</p>',
  }],
  screenshots: [{
    caption: 'Basic Mode',
    default: true,
    sizes: [{
      scale: '1x',
      src: 'https://dl.flathub.org/media/org/gnome/Calculator/fixture/screenshots/image-1_orig.png',
      width: '410',
      height: '666',
    }],
  }],
  description: '<img src=x onerror="alert(2)"><p>Untrusted rich description.</p>',
  ...overrides,
})

const card = async () => {
  await screen.findByText('Flatpak identity')
  return document.querySelector('[data-domain-card="flathub-appstream"]') as HTMLElement
}

describe('Flathub AppStream semantic preview', () => {
  it('binds app, license, stable release, Flatpak runtime, screenshots, and project links to the exact request', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response()}/>)

    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'ready')
    expect(root).toHaveAttribute('data-request-bound', 'true')
    expect(root).toHaveAttribute('data-request-contract', 'exact-flathub-appstream-v1')
    expect(root).toHaveAttribute('data-request-app-id', 'org.gnome.Calculator')
    expect(root).toHaveAttribute('data-provider-app-id', 'org.gnome.Calculator')
    expect(root).toHaveAttribute('data-stable-release-version', '50.0')
    expect(root).toHaveAttribute('data-screenshot-count', '1')
    expect(root).toHaveAttribute('data-malformed-evidence-count', '0')
    expect(root).toHaveTextContent('Calculator')
    expect(root).toHaveTextContent('The GNOME Project')
    expect(root).toHaveTextContent('GPL-3.0-or-later')
    expect(root).toHaveTextContent('Free-license signal: yes')
    expect(root).toHaveTextContent('app/org.gnome.Calculator/x86_64/stable')
    expect(root).toHaveTextContent('org.gnome.Platform/x86_64/50')
    expect(root).toHaveTextContent('50.0')
    expect(within(root).getByRole('img', { name: 'Basic Mode' })).toHaveAttribute('width', '410')
    expect(within(root).getByRole('img', { name: 'Basic Mode' })).toHaveAttribute('height', '666')
    expect(within(root).getByRole('link', { name: 'Project website' })).toHaveAttribute('href', 'https://apps.gnome.org/Calculator')
    expect(within(root).getByRole('link', { name: 'Source repository' })).toHaveAttribute('href', 'https://gitlab.gnome.org/GNOME/gnome-calculator')
    expect(root.querySelectorAll('img')).toHaveLength(1)
    expect(root).not.toHaveTextContent('Provider HTML must not render')
    expect(root).not.toHaveTextContent('Untrusted rich description')
  })

  it('requires the exact executed GET URL and matching decoded provider app identity', async () => {
    expect(parseFlathubAppstreamRequest(executedRequest)).toEqual({ appId: 'org.gnome.Calculator' })
    for (const request of [
      { method: 'GET', url: `${requestUrl}?foo=bar` },
      { method: 'GET', url: `${requestUrl}#fragment` },
      { method: 'GET', url: `${requestUrl}/` },
      { method: 'GET', url: 'https://user:pass@flathub.org/api/v2/appstream/org.gnome.Calculator' },
      { method: 'GET', url: 'https://flathub.org:444/api/v2/appstream/org.gnome.Calculator' },
      { method: 'POST', url: requestUrl },
    ]) expect(parseFlathubAppstreamRequest(request)).toBeUndefined()

    expect(parseFlathubAppstreamResponse(response({ id: 'org.gnome.Calendar' }), executedRequest).result).toBeUndefined()
    render(<ResponseDemoPreview api={api} executedRequest={{ method: 'GET', url: `${requestUrl}?foo=bar` }} data={response()}/>)
    await waitFor(() => expect(document.querySelector('[data-domain-card="flathub-appstream"]')).toHaveAttribute('data-result-state', 'invalid'))
  })

  it('deliberately parses documented decimal-string dimensions and release timestamps without generic coercion', () => {
    const parsed = parseFlathubAppstreamResponse(response(), executedRequest)
    expect(parsed.result?.screenshots[0]).toMatchObject({ width: 410, height: 666 })
    expect(parsed.result?.stableRelease).toMatchObject({ version: '50.0', timestamp: 1767225600 })

    const malformed = parseFlathubAppstreamResponse(response({
      releases: [{ type: 'stable', version: '50.0', timestamp: 1767225600 }],
      screenshots: [{ caption: 'Numeric dimensions', sizes: [{ src: 'https://dl.flathub.org/media/org/gnome/Calculator/fixture.png', width: 410, height: 666 }] }],
    }), executedRequest)
    expect(malformed.result?.stableRelease).toBeUndefined()
    expect(malformed.result?.screenshots).toEqual([])
    expect(malformed.result?.malformed).toBeGreaterThanOrEqual(2)
  })

  it('keeps missing or malformed optional release, screenshot, bundle, launchable, and links visibly partial', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response({
      bundle: { type: 'flatpak', value: 'app/org.gnome.Calendar/x86_64/stable', runtime: 'org.gnome.Platform/x86_64/50' },
      launchable: { type: 'desktop-id', value: 123 },
      urls: { homepage: 'http://example.test/project', vcs_browser: 'javascript:alert(1)' },
      releases: [],
      screenshots: [],
    })}/>)

    const root = await card()
    expect(root).toHaveAttribute('data-result-state', 'partial')
    expect(root).toHaveAttribute('data-screenshot-count', '0')
    expect(root).not.toHaveTextContent('app/org.gnome.Calendar')
    expect(root).not.toHaveTextContent('javascript:')
    expect(root).toHaveTextContent('Stable release unavailable')
    expect(root).toHaveTextContent('No trustworthy screenshot metadata was available')
    expect(root.querySelectorAll('a')).toHaveLength(0)
  })

  it.each([
    ['numeric-string free-license flag', { is_free_license: 'true' }],
    ['missing provider identity', { id: undefined }],
    ['numeric name', { name: 123 }],
    ['blank license', { project_license: ' ' }],
  ])('fails closed for malformed core identity: %s', async (_label, overrides) => {
    render(<ResponseDemoPreview api={api} executedRequest={executedRequest} data={response(overrides)}/>)
    await waitFor(() => expect(document.querySelector('[data-domain-card="flathub-appstream"]')).toHaveAttribute('data-result-state', 'invalid'))
  })
})
