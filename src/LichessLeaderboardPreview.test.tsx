import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getApiById } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = getApiById('lichess-top-players')!

const user = (username: string, rating: number | string, progress: number, perfType = 'blitz') => ({
  id: username.toLowerCase(),
  username,
  perfs: { [perfType]: { rating, progress } },
})

describe('Lichess leaderboard semantic preview', () => {
  it('marks an exact request-bound leaderboard ready and reads only the requested performance', () => {
    const requestUrl = api.buildUrl({ perfType: 'blitz', count: '2' })
    render(<ResponseDemoPreview api={api} data={{ users: [user('Alpha', 2500, 12), user('Beta', 2450, -3)] }} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)

    const preview = screen.getByRole('region', { name: 'Lichess Top Players' })
    const card = preview.querySelector('[data-domain-card="lichess-leaderboard"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-perf-type', 'blitz')
    expect(card).toHaveAttribute('data-requested-count', '2')
    expect(card).toHaveAttribute('data-valid-player-count', '2')
    expect(within(preview).getByText('Alpha')).toBeInTheDocument()
    expect(within(preview).getByText('Rating 2,500')).toBeInTheDocument()
  })

  it('fails closed when an HTTP-success body contains a different performance than the requested leaderboard', () => {
    const requestUrl = api.buildUrl({ perfType: 'blitz', count: '1' })
    render(<ResponseDemoPreview api={api} data={{ users: [user('WrongPerf', 2999, 100, 'rapid')] }} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)

    const preview = screen.getByRole('region', { name: 'Lichess Top Players' })
    const card = preview.querySelector('[data-domain-card="lichess-leaderboard"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-valid-player-count', '0')
    expect(card).toHaveAttribute('data-invalid-player-count', '1')
    expect(within(preview).queryByText('Rating 2,999')).not.toBeInTheDocument()
  })

  it('fails closed when transport evidence is not the exact bodyless GET', () => {
    const requestUrl = api.buildUrl({ perfType: 'blitz', count: '1' })
    render(<ResponseDemoPreview api={api} data={{ users: [user('Alpha', 2500, 12)] }} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)

    const card = screen.getByRole('region', { name: 'Lichess Top Players' }).querySelector('[data-domain-card="lichess-leaderboard"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('rejects a response that exceeds the requested leaderboard size', () => {
    const requestUrl = api.buildUrl({ perfType: 'blitz', count: '1' })
    render(<ResponseDemoPreview api={api} data={{ users: [user('Alpha', 2500, 12), user('Beta', 2450, -3)] }} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)

    const card = screen.getByRole('region', { name: 'Lichess Top Players' }).querySelector('[data-domain-card="lichess-leaderboard"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-response-count-valid', 'false')
  })

  it('withholds malformed requested-performance rows and keeps a mixed response partial', () => {
    const requestUrl = api.buildUrl({ perfType: 'blitz', count: '2' })
    render(<ResponseDemoPreview api={api} data={{ users: [user('Malformed', '2999', 100), user('Alpha', 2500, 12)] }} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/>)

    const preview = screen.getByRole('region', { name: 'Lichess Top Players' })
    const card = preview.querySelector('[data-domain-card="lichess-leaderboard"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-valid-player-count', '1')
    expect(card).toHaveAttribute('data-invalid-player-count', '1')
    expect(within(preview).getByText('Rating 2,500')).toBeInTheDocument()
    expect(within(preview).getByText('2')).toBeInTheDocument()
    expect(within(preview).queryByText('Rating 2,999')).not.toBeInTheDocument()
  })
})
