import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'open5e-monster-search')
if (!api) throw new Error('Missing Open5e monster fixture')

const dragonUrl = api.buildUrl({ search: 'dragon' })
const executedGet = (url = dragonUrl) => ({ url, method: 'GET' })

describe('Open5e V2 creature semantic preview', () => {
  afterEach(cleanup)
  it('fails closed when the successful response is not bound to the exact bodyless GET request', () => {
    render(<ResponseDemoPreview api={api} requestUrl={dragonUrl} executedRequest={{ url: dragonUrl, method: 'POST' }} data={{ count: 1, results: [
      { key: 'srd_dragon', name: 'Adult Red Dragon', document: { name: 'SRD', key: 'srd', gamesystem: { name: '5e', key: '5e' } } },
    ] }}/>)

    const preview = screen.getByRole('region', { name: 'Open5e Monster Search' })
    expect(preview.querySelector('[data-domain-card="monster-statblock"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Adult Red Dragon')
  })

  it('rejects a GET with a request body or executed URL drift', () => {
    const payload = { count: 1, results: [{ key: 'srd_dragon', name: 'Adult Red Dragon', document: { name: 'SRD', key: 'srd', gamesystem: { name: '5e', key: '5e' } } }] }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={dragonUrl} executedRequest={{ url: dragonUrl, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    let card = screen.getByRole('region', { name: 'Open5e Monster Search' }).querySelector('[data-domain-card="monster-statblock"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={dragonUrl} executedRequest={{ url: `${dragonUrl}&page=2`, method: 'GET' }} data={payload}/>)
    card = screen.getByRole('region', { name: 'Open5e Monster Search' }).querySelector('[data-domain-card="monster-statblock"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('keeps coherent rows partial when executed request evidence is unavailable', () => {
    render(<ResponseDemoPreview api={api} requestUrl={dragonUrl} data={{ count: 1, results: [
      { key: 'srd_dragon', name: 'Adult Red Dragon', document: { name: 'SRD', key: 'srd', gamesystem: { name: '5e', key: '5e' } } },
    ] }}/>)
    const card = screen.getByRole('region', { name: 'Open5e Monster Search' }).querySelector('.open5e-monster-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-request-contract', 'exact-open5e-monster-search-v2')
  })

  it('preserves source-aware identity and combat facts without the generic data-table card', () => {
    render(<ResponseDemoPreview api={api} requestUrl={api.buildUrl({ search: 'mimic' })} executedRequest={executedGet(api.buildUrl({ search: 'mimic' }))} data={{ count: 2, results: [
      { key: 'srd-2024_mimic', name: 'Mimic', document: { name: 'System Reference Document 5.2', key: 'srd-2024', gamesystem: { name: 'Dungeons & Dragons 5e 2024', key: '5e-2024' } }, type: { name: 'Monstrosity', key: 'monstrosity' }, size: { name: 'Medium', key: 'medium' }, challenge_rating: 2, armor_class: 12, hit_points: 58, hit_dice: '9d8+18', speed: { walk: 20, unit: 'feet' }, alignment: 'neutral', passive_perception: 11 },
      { key: 'legacy_mimic', name: 'Mimic', document: { name: 'Another Open Source', key: 'other', gamesystem: { name: 'Compatible 5e', key: '5e' } }, type: { name: 'Monstrosity', key: 'monstrosity' }, size: { name: 'Medium', key: 'medium' }, challenge_rating: 2, armor_class: 12, hit_points: 55, hit_dice: '10d8+10', speed: { walk: 15, climb: 15, unit: 'feet' }, alignment: 'unaligned', passive_perception: 10 },
    ] }}/>)

    const preview = screen.getByRole('region', { name: 'Open5e Monster Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'monster-statblock')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')
    const card = preview.querySelector('.open5e-monster-preview')
    expect(card).toHaveAttribute('data-api-version', 'v2')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-open5e-monster-search-v2')
    expect(card).toHaveAttribute('data-provider-total', '2')
    expect(card).toHaveAttribute('data-primary-monster-key', 'srd-2024_mimic')
    expect(card).toHaveAttribute('data-primary-source', 'System Reference Document 5.2')
    expect(preview).toHaveTextContent('CR 2')
    expect(preview).toHaveTextContent('Armor class')
    expect(preview).toHaveTextContent('58')
    expect(preview).toHaveTextContent('walk 20 feet')
    expect(preview).toHaveTextContent('System Reference Document 5.2')
    expect(preview).toHaveTextContent('Dungeons & Dragons 5e 2024')
    expect(preview).not.toHaveTextContent('Open5e Monster Search record 1')
  })

  it('marks mixed provider rows partial and does not fabricate creature identity', () => {
    render(<ResponseDemoPreview api={api} requestUrl={dragonUrl} executedRequest={executedGet()} data={{ count: 2, results: [
      { key: 'srd_dragon', name: 'Dragon', document: { name: 'SRD', key: 'srd', gamesystem: { name: '5e', key: '5e' } } },
      { armor_class: 10 },
    ] }}/>)

    const preview = screen.getByRole('region', { name: 'Open5e Monster Search' })
    const card = preview.querySelector('.open5e-monster-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).toHaveTextContent('Dragon')
    expect(preview).not.toHaveTextContent('Creature 2')
  })

  it('distinguishes malformed HTTP-success shapes from a genuine empty search', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={dragonUrl} executedRequest={executedGet()} data={{ count: 1, results: 'not-an-array' }}/>)
    let preview = screen.getByRole('region', { name: 'Open5e Monster Search' })
    expect(preview.querySelector('[data-domain-card="monster-statblock"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={dragonUrl} executedRequest={executedGet()} data={{ count: 0, results: [] }}/>)
    preview = screen.getByRole('region', { name: 'Open5e Monster Search' })
    expect(preview.querySelector('[data-domain-card="monster-statblock"]')).toHaveAttribute('data-result-state', 'empty')
  })


  it('fails closed when a complete HTTP-success payload does not belong to the executed creature-name search', () => {
    const goblinUrl = api.buildUrl({ search: 'goblin' })
    render(<ResponseDemoPreview api={api} requestUrl={goblinUrl} executedRequest={executedGet(goblinUrl)} data={{ count: 1, results: [
      { key: 'srd_dragon', name: 'Adult Red Dragon', document: { name: 'SRD', key: 'srd', gamesystem: { name: '5e', key: '5e' } } },
    ] }}/>)

    const preview = screen.getByRole('region', { name: 'Open5e Monster Search' })
    expect(preview.querySelector('[data-domain-card="monster-statblock"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Adult Red Dragon')
  })

  it('withholds wrong-query rows and marks a mixed HTTP-success response partial', () => {
    render(<ResponseDemoPreview api={api} requestUrl={dragonUrl} executedRequest={executedGet()} data={{ count: 2, results: [
      { key: 'srd_dragon', name: 'Adult Red Dragon', document: { name: 'SRD', key: 'srd', gamesystem: { name: '5e', key: '5e' } } },
      { key: 'srd_goblin', name: 'Goblin', document: { name: 'SRD', key: 'srd', gamesystem: { name: '5e', key: '5e' } } },
    ] }}/>)

    const preview = screen.getByRole('region', { name: 'Open5e Monster Search' })
    const card = preview.querySelector('.open5e-monster-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-query', 'dragon')
    expect(card).toHaveAttribute('data-query-mismatch-count', '1')
    expect(preview).toHaveTextContent('Adult Red Dragon')
    expect(preview).not.toHaveTextContent('Goblin')
  })

  it('does not trust numeric-string pagination metadata from an HTTP-success response', () => {
    render(<ResponseDemoPreview api={api} requestUrl={dragonUrl} executedRequest={executedGet()} data={{ count: '1', results: [
      { key: 'srd_dragon', name: 'Adult Red Dragon', document: { name: 'SRD', key: 'srd', gamesystem: { name: '5e', key: '5e' } } },
    ] }}/>)

    const preview = screen.getByRole('region', { name: 'Open5e Monster Search' })
    expect(preview.querySelector('.open5e-monster-preview')).toHaveAttribute('data-result-state', 'partial')
  })

})
