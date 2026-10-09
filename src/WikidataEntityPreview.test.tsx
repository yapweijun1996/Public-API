import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'wikidata-sparql')
if (!api) throw new Error('Missing wikidata-sparql fixture')

const validBinding = {
  item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q60' },
  itemLabel: { 'xml:lang': 'en', type: 'literal', value: 'New York City' },
}

const renderData = (data: unknown) => render(<ResponseDemoPreview api={api} data={data}/>)
const card = () => screen.getByRole('region', { name: 'Wikidata SPARQL' }).querySelector('[data-domain-card="knowledge-entities"]')

describe('Wikidata entity semantic preview', () => {
  afterEach(cleanup)

  it('preserves provider binding identity, QID, URI, label, language and projected variables', () => {
    renderData({ head: { vars: ['item', 'itemLabel'] }, results: { bindings: [validBinding] } })
    const preview = screen.getByRole('region', { name: 'Wikidata SPARQL' })
    const result = preview.querySelector('.wikidata-entity-preview')
    expect(preview).toHaveAttribute('data-preview-layout', 'knowledge-entities')
    expect(result).toHaveAttribute('data-result-state', 'ready')
    expect(result).toHaveAttribute('data-provider-binding-count', '1')
    expect(result).toHaveAttribute('data-valid-binding-count', '1')
    expect(result).toHaveAttribute('data-invalid-binding-count', '0')
    expect(result).toHaveAttribute('data-primary-qid', 'Q60')
    expect(result).toHaveAttribute('data-query-variables-valid', 'true')
    expect(preview).toHaveTextContent('New York City')
    expect(preview).toHaveTextContent('Q60')
    expect(preview).toHaveTextContent('http://www.wikidata.org/entity/Q60')
    expect(preview).toHaveTextContent('city (wd:Q515)')
    expect(preview).not.toHaveTextContent('Wikidata SPARQL record 1')
  })

  it('treats a contract-valid empty bindings array as semantic empty', () => {
    renderData({ head: { vars: ['item', 'itemLabel'] }, results: { bindings: [] } })
    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(screen.getByRole('region', { name: 'Wikidata SPARQL' })).toHaveTextContent('No Wikidata city bindings returned')
  })

  it('fails closed when HTTP-success data omits results.bindings', () => {
    renderData({ head: { vars: ['item', 'itemLabel'] }, results: { unexpected: [] } })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByRole('region', { name: 'Wikidata SPARQL' })).toHaveTextContent('documented results.bindings array')
  })

  it('fails closed when a binding has a plausible label but no provider-owned entity URI/QID', () => {
    renderData({
      head: { vars: ['item', 'itemLabel'] },
      results: { bindings: [{ itemLabel: { 'xml:lang': 'en', type: 'literal', value: 'Fabricated City' } }] },
    })
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    const preview = screen.getByRole('region', { name: 'Wikidata SPARQL' })
    expect(preview).toHaveTextContent('provider-owned Wikidata entity URI/QID')
    expect(preview).not.toHaveTextContent('Fabricated City')
  })

  it('preserves valid rows but marks a mixed binding response partial', () => {
    renderData({
      head: { vars: ['item', 'itemLabel'] },
      results: { bindings: [validBinding, { item: { type: 'literal', value: 'Q999' }, itemLabel: { type: 'literal', value: 'Fabricated City' } }] },
    })
    const preview = screen.getByRole('region', { name: 'Wikidata SPARQL' })
    const result = preview.querySelector('.wikidata-entity-preview')
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-provider-binding-count', '2')
    expect(result).toHaveAttribute('data-valid-binding-count', '1')
    expect(result).toHaveAttribute('data-invalid-binding-count', '1')
    expect(preview).toHaveTextContent('New York City')
    expect(preview).not.toHaveTextContent('Fabricated City')
    expect(preview).toHaveTextContent('Partial SPARQL result')
  })

  it('keeps a valid entity visible but marks missing English-language metadata partial', () => {
    renderData({
      head: { vars: ['item', 'itemLabel'] },
      results: { bindings: [{ item: validBinding.item, itemLabel: { type: 'literal', value: 'New York City' } }] },
    })
    const preview = screen.getByRole('region', { name: 'Wikidata SPARQL' })
    const result = preview.querySelector('.wikidata-entity-preview')
    expect(result).toHaveAttribute('data-result-state', 'partial')
    expect(result).toHaveAttribute('data-english-label-count', '0')
    expect(preview).toHaveTextContent('New York City')
    expect(preview).toHaveTextContent('Label languageNot supplied')
  })
})
