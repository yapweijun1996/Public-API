import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { PreviewLoadBoundary } from './PreviewLoadBoundary'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function FailingPreview(): ReactNode {
  throw new Error('chunk unavailable')
}

function MaybePreview({ fail }: { fail: boolean }) {
  if (fail) throw new Error('preview unavailable')
  return <div>Recovered semantic preview</div>
}

describe('PreviewLoadBoundary', () => {
  it('contains preview failures while leaving sibling response content available', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<>
      <PreviewLoadBoundary resetKey="color-api:first"><FailingPreview /></PreviewLoadBoundary>
      <pre aria-label="Raw JSON">{JSON.stringify({ hex: '#24B1E0' })}</pre>
    </>)

    expect(screen.getByRole('alert', { name: 'Semantic preview failed to load' })).toHaveTextContent('Semantic preview unavailable')
    expect(screen.getByRole('button', { name: 'Reload application' })).toBeInTheDocument()
    expect(screen.getByLabelText('Raw JSON')).toHaveTextContent('#24B1E0')
  })

  it('resets the local failure state when a different preview result is selected', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { rerender } = render(<PreviewLoadBoundary resetKey="color-api:first"><MaybePreview fail /></PreviewLoadBoundary>)
    expect(screen.getByRole('alert', { name: 'Semantic preview failed to load' })).toBeInTheDocument()

    rerender(<PreviewLoadBoundary resetKey="github:second"><MaybePreview fail={false} /></PreviewLoadBoundary>)
    expect(screen.getByText('Recovered semantic preview')).toBeInTheDocument()
    expect(screen.queryByRole('alert', { name: 'Semantic preview failed to load' })).not.toBeInTheDocument()
  })
})
