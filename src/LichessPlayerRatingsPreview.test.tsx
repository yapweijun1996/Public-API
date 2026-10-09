import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getApiById, getDefaultParameters, validateParameters } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = getApiById('chess-player-stats')!

const player = (overrides: Record<string, unknown> = {}) => ({
  id: 'thibault',
  username: 'thibault',
  url: 'https://lichess.org/@/thibault',
  perfs: {
    blitz: { games: 11856, rating: 1718, rd: 45, prog: 7 },
    rapid: { games: 915, rating: 1802, rd: 68, prog: -75 },
  },
  ...overrides,
})

describe('Lichess player ratings semantic preview', () => {
  it('uses the browser-ready Lichess public-user contract and rejects a blank username before network execution', () => {
    expect(api.provider).toBe('Lichess')
    expect(api.buildUrl(getDefaultParameters(api))).toBe('https://lichess.org/api/user/thibault')
    expect(api.fields.find((field) => field.id === 'username')?.minLength).toBe(1)
    expect(validateParameters(api, { username: '' }).username).toMatch(/required/i)
  })

  it('marks an exact request-bound Lichess user response ready', () => {
    const requestUrl = api.buildUrl({ username: 'thibault' })
    render(<ResponseDemoPreview api={api} data={player()} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)

    const preview = screen.getByRole('region', { name: 'Lichess Player Ratings' })
    const card = preview.querySelector('[data-domain-card="lichess-player-ratings"]')
    expect(preview).toHaveAttribute('data-preview-layout', 'chess-ratings')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-username', 'thibault')
    expect(card).toHaveAttribute('data-provider-user-id', 'thibault')
    expect(card).toHaveAttribute('data-valid-perf-count', '2')
    expect(within(preview).getAllByText('1,802')[0]).toBeInTheDocument()
    expect(within(preview).getByText('Rapid')).toBeInTheDocument()
    expect(within(preview).getByText('915 games')).toBeInTheDocument()
  })

  it('fails closed when the successful transport was not the exact bodyless GET', () => {
    const requestUrl = api.buildUrl({ username: 'thibault' })
    render(<ResponseDemoPreview api={api} data={player()} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)

    const card = screen.getByRole('region', { name: 'Lichess Player Ratings' }).querySelector('[data-domain-card="lichess-player-ratings"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(screen.queryByText('1,802')).not.toBeInTheDocument()
  })

  it('fails closed when the provider user identity contradicts the executed username', () => {
    const requestUrl = api.buildUrl({ username: 'thibault' })
    render(<ResponseDemoPreview api={api} data={player({ id: 'someoneelse', username: 'SomeoneElse', url: 'https://lichess.org/@/SomeoneElse' })} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)

    const card = screen.getByRole('region', { name: 'Lichess Player Ratings' }).querySelector('[data-domain-card="lichess-player-ratings"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-response-identity-match', 'false')
    expect(screen.queryByText('1,802')).not.toBeInTheDocument()
  })

  it('withholds malformed performance rows instead of fabricating rating/game facts', () => {
    const requestUrl = api.buildUrl({ username: 'thibault' })
    render(<ResponseDemoPreview api={api} data={player({
      perfs: {
        blitz: { games: 11856, rating: 1718, rd: 45, prog: 7 },
        rapid: { games: 915, rating: '2999', rd: 68, prog: -75 },
      },
    })} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)

    const preview = screen.getByRole('region', { name: 'Lichess Player Ratings' })
    const card = preview.querySelector('[data-domain-card="lichess-player-ratings"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-perf-count', '1')
    expect(card).toHaveAttribute('data-invalid-perf-count', '1')
    expect(within(preview).getAllByText('1,718')[0]).toBeInTheDocument()
    expect(within(preview).queryByText('2,999')).not.toBeInTheDocument()
  })
})
