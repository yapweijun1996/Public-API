import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { GeneratedImagePreview } from './previews/SpecializedCatalogPreviews'

const api = (id: 'qr-code-generator' | 'dicebear-avatar') => {
  const match = getApiById(id)
  if (!match) throw new Error(`Missing test API: ${id}`)
  return match
}

describe('GeneratedImagePreview', () => {
  it('renders the image from the successful response object URL instead of re-requesting the provider URL', () => {
    const qr = api('qr-code-generator')
    const requestUrl = qr.buildUrl({ data: 'https://example.com', size: '200x200' })
    render(<GeneratedImagePreview
      api={qr}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl, method: 'GET' }}
      responseMedia={{ objectUrl: 'blob:public-api-qr', contentType: 'image/png' }}
    />)

    const card = screen.getByRole('img', { name: qr.name }).closest('[data-domain-card="generated-image"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(screen.getByRole('img', { name: qr.name })).toHaveAttribute('src', 'blob:public-api-qr')
    expect(screen.getByRole('img', { name: qr.name })).not.toHaveAttribute('src', requestUrl)
  })

  it('fails closed when the successful transport is not the exact bodyless GET request', () => {
    const avatar = api('dicebear-avatar')
    const requestUrl = avatar.buildUrl({ style: 'identicon', seed: 'test' })
    render(<GeneratedImagePreview
      api={avatar}
      requestUrl={requestUrl}
      executedRequest={{ url: requestUrl, method: 'POST' }}
      responseMedia={{ objectUrl: 'blob:public-api-avatar', contentType: 'image/svg+xml' }}
    />)

    expect(screen.getByText('Invalid generated image response').closest('[data-domain-card="generated-image"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
