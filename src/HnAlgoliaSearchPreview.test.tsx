import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'hn-search-algolia')
if (!api) throw new Error('Missing hn-search-algolia fixture')
const requestUrl = api.buildUrl({ query: 'OpenAI', tag: 'story', limit: '6' })
const executedRequest = { url: requestUrl, method: 'GET' }
const story = {
  objectID: '38309611',
  title: "OpenAI's board has fired Sam Altman",
  url: 'https://example.test/openai',
  author: 'davidbarker',
  points: 5710,
  story_text: null,
  comment_text: null,
  num_comments: 2530,
  created_at_i: 1700252930,
  _tags: ['story', 'author_davidbarker', 'story_38309611'],
}
const response = (hits: unknown[], overrides: Record<string, unknown> = {}) => ({
  hits,
  page: 0,
  nbHits: hits.length || 27420,
  nbPages: hits.length ? 167 : 0,
  hitsPerPage: 6,
  processingTimeMS: 16,
  query: 'OpenAI',
  params: 'query=OpenAI&tags=story&hitsPerPage=6&advancedSyntax=true&analyticsTags=backend',
  ...overrides,
})

describe('HN Algolia semantic preview', () => {
  afterEach(cleanup)

  it('binds live-style story identity and engagement to the executed search', () => {
    render(<ResponseDemoPreview api={api} data={response([story])} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'HN Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'hn-search')
    const card = preview.querySelector('[data-domain-card="hn-search"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-search-query', 'OpenAI')
    expect(card).toHaveAttribute('data-request-tags', 'story')
    expect(card).toHaveAttribute('data-request-acknowledged', 'true')
    expect(card).toHaveAttribute('data-primary-object-id', '38309611')
    expect(card).toHaveAttribute('data-primary-kind', 'story')
    expect(card).toHaveAttribute('data-primary-points', '5710')
    expect(preview).toHaveTextContent("OpenAI's board has fired Sam Altman")
    expect(preview).toHaveTextContent('5,710 points')
    expect(preview).toHaveTextContent('2,530')
  })

  it('treats a request-bound zero-result search as empty', () => {
    render(<ResponseDemoPreview api={api} data={response([], { nbHits: 0, nbPages: 0 })} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const card = screen.getByRole('region', { name: 'HN Search' }).querySelector('[data-domain-card="hn-search"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
  })

  it('fails closed on a malformed HTTP-success envelope', () => {
    render(<ResponseDemoPreview api={api} data={{ unexpected: [] }} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'HN Search' })
    expect(preview.querySelector('[data-domain-card="hn-search"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('documented hits array')
  })

  it('fails closed when provider query acknowledgement contradicts the request', () => {
    render(<ResponseDemoPreview api={api} data={response([story], { query: 'Anthropic' })} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'HN Search' })
    expect(preview.querySelector('[data-domain-card="hn-search"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent("OpenAI's board has fired Sam Altman")
  })

  it('marks a mixed content-type batch partial and hides contradictory hits', () => {
    const comment = { objectID: '9949739', author: 'Yadi', story_title: 'Ask HN', comment_text: 'A comment', story_id: 9949664, parent_id: 9949664, created_at_i: 1437874131, points: null, num_comments: null, _tags: ['comment', 'author_Yadi', 'story_9949664'] }
    render(<ResponseDemoPreview api={api} data={response([story, comment], { nbHits: 27420 })} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'HN Search' })
    const card = preview.querySelector('[data-domain-card="hn-search"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-hit-count', '2')
    expect(card).toHaveAttribute('data-valid-hit-count', '1')
    expect(card).toHaveAttribute('data-invalid-hit-count', '1')
    expect(preview).not.toHaveTextContent('A comment')
  })

  it('accepts comment null story metrics without manufacturing zeroes', () => {
    const commentRequest = api.buildUrl({ query: 'OpenAI', tag: 'comment', limit: '6' })
    const comment = { objectID: '9949739', author: 'Yadi', story_title: 'Ask HN: Technical debt', comment_text: 'OpenAI was discussed here.', story_id: 9949664, parent_id: 9949664, created_at_i: 1437874131, points: null, num_comments: null, _tags: ['comment', 'author_Yadi', 'story_9949664'] }
    const data = response([comment], { nbHits: 194035, query: 'OpenAI', params: 'query=OpenAI&tags=comment&hitsPerPage=6&advancedSyntax=true' })
    render(<ResponseDemoPreview api={api} data={data} requestUrl={commentRequest} executedRequest={{ url: commentRequest, method: 'GET' }}/>)
    const preview = screen.getByRole('region', { name: 'HN Search' })
    expect(preview.querySelector('[data-domain-card="hn-search"]')).toHaveAttribute('data-result-state', 'ready')
    expect(preview).toHaveTextContent('Comment')
    expect(preview).toHaveTextContent('9949664')
    expect(preview).not.toHaveTextContent('0 points')
  })

  it('fails closed when the successful response came from a non-bodyless-GET transport', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} data={response([story])} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)
    const preview = screen.getByRole('region', { name: 'HN Search' })
    expect(preview.querySelector('[data-domain-card="hn-search"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} data={response([story])} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }}/>)
    expect(preview.querySelector('[data-domain-card="hn-search"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('keeps structurally trustworthy hits partial when request identity is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={response([story])}/>)
    const card = screen.getByRole('region', { name: 'HN Search' }).querySelector('[data-domain-card="hn-search"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-query-bound', 'false')
  })
})
