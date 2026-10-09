import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getApiById, validateParameters } from './apiCatalog'
import { apiPreviewComponents } from './responsePreview'

const api = getApiById('dnd5e-spell-lookup')!
const Preview = apiPreviewComponents['dnd5e-spell-lookup']!
const requestUrl = api.buildUrl({ spellIndex: 'fireball' })
const fireball = {
  index: 'fireball',
  name: 'Fireball',
  desc: ['A bright streak flashes from your pointing finger.'],
  higher_level: ['The damage increases at higher levels.'],
  range: '150 feet',
  components: ['V', 'S', 'M'],
  material: 'A tiny ball of bat guano and sulfur.',
  ritual: false,
  duration: 'Instantaneous',
  concentration: false,
  casting_time: '1 action',
  level: 3,
  school: { index: 'evocation', name: 'Evocation', url: '/api/2014/magic-schools/evocation' },
  classes: [{ index: 'sorcerer', name: 'Sorcerer', url: '/api/2014/classes/sorcerer' }],
  subclasses: [],
  url: '/api/2014/spells/fireball',
}

afterEach(cleanup)

describe('D&D 5e spell request-bound semantics', () => {
  it('enforces canonical spell slugs before provider execution', () => {
    expect(validateParameters(api, { spellIndex: 'magic-missile' })).toEqual({})
    expect(validateParameters(api, { spellIndex: '' }).spellIndex).toContain('required')
    expect(validateParameters(api, { spellIndex: 'Magic-Missile' }).spellIndex).toContain('lowercase')
    expect(validateParameters(api, { spellIndex: 'magic--missile' }).spellIndex).toContain('lowercase')
    expect(api.buildUrl({ spellIndex: '' })).toBe('https://www.dnd5eapi.co/api/2014/spells/')
  })

  it('marks the exact bodyless GET response ready and request-bound', () => {
    render(<Preview api={api} data={fireball} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl }}/>)
    const card = screen.getByRole('region', { name: 'D&D 5e spell response evidence' })
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-spell-index', 'fireball')
    expect(card).toHaveAttribute('data-provider-spell-index', 'fireball')
    expect(card).toHaveTextContent('Fireball')
  })

  it('fails a wrong-spell HTTP-success payload closed and withholds plausible spell facts', () => {
    const wrong = { ...fireball, index: 'magic-missile', name: 'Magic Missile', url: '/api/2014/spells/magic-missile' }
    render(<Preview api={api} data={wrong} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl }}/>)
    const card = screen.getByRole('region', { name: 'D&D 5e spell response evidence' })
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-spell-index-match', 'false')
    expect(card).not.toHaveTextContent('Magic Missile')
  })

  it('does not claim ready without successful executed-request evidence', () => {
    render(<Preview api={api} data={fireball} requestUrl={requestUrl}/>)
    expect(screen.getByRole('region', { name: 'D&D 5e spell response evidence' })).toHaveAttribute('data-result-state', 'partial')
  })

  it('fails closed for POST, body, URL drift, and provider-ignored extra query keys', () => {
    for (const executedRequest of [
      { method: 'POST', url: requestUrl },
      { method: 'GET', url: requestUrl, body: '{}' },
      { method: 'GET', url: api.buildUrl({ spellIndex: 'magic-missile' }) },
      { method: 'GET', url: `${requestUrl}?foo=bar` },
    ]) {
      const { unmount } = render(<Preview api={api} data={fireball} requestUrl={executedRequest.url} executedRequest={executedRequest}/>)
      expect(screen.getByRole('region', { name: 'D&D 5e spell response evidence' })).toHaveAttribute('data-result-state', 'invalid')
      unmount()
    }
  })

  it('rejects malformed required spell evidence instead of manufacturing display values', () => {
    const malformed = { ...fireball, level: '3', desc: [], school: { name: 'Evocation' } }
    render(<Preview api={api} data={malformed} requestUrl={requestUrl} executedRequest={{ method: 'GET', url: requestUrl }}/>)
    const card = screen.getByRole('region', { name: 'D&D 5e spell response evidence' })
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('Level 3')
  })
})
