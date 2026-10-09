import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'opendota-pro-matches')
if (!api) throw new Error('Missing opendota-pro-matches fixture')

describe('OpenDota professional match semantic preview', () => {
  afterEach(cleanup)

  it('keeps kill counts distinct from the winner and series identifiers', () => {
    render(<ResponseDemoPreview api={api} data={[{
      match_id: 8988152817,
      duration: 2045,
      start_time: 1788819538,
      radiant_team_id: 10122515,
      radiant_name: 'The House Esports',
      dire_team_id: 2885851,
      dire_name: 'GIOR DOTA',
      leagueid: 20206,
      league_name: 'NEXUS SERIES I',
      series_id: 1139391,
      series_type: 1,
      radiant_score: 16,
      dire_score: 30,
      radiant_win: false,
    }]}/>)

    const preview = screen.getByRole('region', { name: 'OpenDota Matches' })
    expect(preview).toHaveAttribute('data-preview-layout', 'pro-match-results')
    const card = preview.querySelector('.opendota-matches-preview')
    expect(card).toHaveAttribute('data-provider-match-count', '1')
    const match = preview.querySelector('[data-match-id="8988152817"]')
    expect(match).toHaveAttribute('data-radiant-kills', '16')
    expect(match).toHaveAttribute('data-dire-kills', '30')
    expect(match).toHaveAttribute('data-radiant-win', 'false')
    expect(match).toHaveAttribute('data-series-id', '1139391')
    expect(match).toHaveAttribute('data-series-type', '1')
    expect(preview).toHaveTextContent('16 kills')
    expect(preview).toHaveTextContent('30 kills')
    expect(preview).toHaveTextContent('Winner · GIOR DOTA')
    expect(preview).toHaveTextContent('kill counts, not a series score')
    expect(preview).toHaveTextContent('Series type code')
    expect(preview).not.toHaveTextContent('OpenDota Matches record 1')
  })

  it('renders an explicit empty state without inventing a match', () => {
    render(<ResponseDemoPreview api={api} data={[]}/>)
    expect(screen.getByText('No professional matches returned')).toBeInTheDocument()
    expect(screen.getByText('OpenDota returned no professional match records for this request.')).toBeInTheDocument()
  })

  it('marks mixed identity-less match rows partial and filters them from the trusted list', () => {
    render(<ResponseDemoPreview api={api} data={[
      { match_id: 8988152817, radiant_name: 'Radiant Alpha', dire_name: 'Dire Beta', radiant_score: 20, dire_score: 18, radiant_win: true },
      { radiant_name: 'Missing identity', dire_name: 'Should not render', radiant_score: 99, dire_score: 0, radiant_win: true },
    ]}/>)

    const preview = screen.getByRole('region', { name: 'OpenDota Matches' })
    const card = preview.querySelector('.opendota-matches-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-match-count', '2')
    expect(card).toHaveAttribute('data-valid-match-count', '1')
    expect(card).toHaveAttribute('data-invalid-match-count', '1')
    expect(preview.querySelectorAll('[data-match-index]')).toHaveLength(1)
    expect(preview).not.toHaveTextContent('Missing identity')
    expect(preview).not.toHaveTextContent('Match ID not supplied')
  })

  it('marks a non-array HTTP-success body invalid instead of empty', () => {
    render(<ResponseDemoPreview api={api} data={{ match_id: 8988152817 }}/>)
    const preview = screen.getByRole('region', { name: 'OpenDota Matches' })
    expect(preview.querySelector('[data-domain-card="pro-match-results"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('Invalid professional match response')
  })
})
