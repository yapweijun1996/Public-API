import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'models-dev')
if (!api) throw new Error('Missing Hugging Face model fixture')

describe('Hugging Face model-search semantic preview', () => {
  afterEach(cleanup)

  it('rejects transport drift even when the displayed model-search URL is canonical', () => {
    const requestUrl = 'https://huggingface.co/api/models?search=gpt&limit=1&full=true'
    const data = [{ id: 'openai-community/gpt2', gated: false, private: false, downloads: 10, likes: 2 }]
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={data}/>)

    let card = screen.getByRole('region', { name: 'Hugging Face Model Search' }).querySelector('[data-domain-card="ai-model-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).not.toHaveTextContent('openai-community/gpt2')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: {} }} data={data}/>)
    card = screen.getByRole('region', { name: 'Hugging Face Model Search' }).querySelector('[data-domain-card="ai-model-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: 'https://huggingface.co/api/models?search=gpt&limit=2&full=true', method: 'GET' }} data={data}/>)
    card = screen.getByRole('region', { name: 'Hugging Face Model Search' }).querySelector('[data-domain-card="ai-model-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

  it('preserves model identity, access, provider license tag, popularity, and update metadata', () => {
    render(<ResponseDemoPreview api={api} data={[
      {
        id: 'openai-community/gpt2', author: 'openai-community', gated: false, private: false,
        pipeline_tag: 'text-generation', library_name: 'transformers', downloads: 14_748_356, likes: 3_743,
        lastModified: '2024-02-19T10:57:45.000Z', tags: ['transformers', 'text-generation', 'license:mit', 'en'],
      },
      {
        id: 'example/gated-model', author: 'example', gated: 'manual', private: false,
        pipeline_tag: 'text-classification', library_name: 'transformers', downloads: 42, likes: 3,
        lastModified: '2026-09-01T00:00:00Z', tags: ['license:apache-2.0'],
      },
    ]}/>)

    const preview = screen.getByRole('region', { name: 'Hugging Face Model Search' })
    expect(preview).toHaveAttribute('data-preview-layout', 'ai-model-catalog')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')
    const card = preview.querySelector('.huggingface-models-preview')
    expect(card).toHaveAttribute('data-row-count', '2')
    expect(card).toHaveAttribute('data-primary-model-id', 'openai-community/gpt2')
    expect(card).toHaveAttribute('data-primary-access', 'Public')
    expect(card).toHaveAttribute('data-primary-license', 'mit')
    expect(preview).toHaveTextContent('openai-community/gpt2')
    expect(preview).toHaveTextContent('text-generation')
    expect(preview).toHaveTextContent('transformers')
    expect(preview).toHaveTextContent('14,748,356')
    expect(preview).toHaveTextContent('2024-02-19')
    expect(preview).toHaveTextContent('Gated · manual')
    expect(preview).toHaveTextContent('apache-2.0')
    expect(preview).not.toHaveTextContent('Hugging Face Model Search record 1')
  })

  it('marks mixed model rows partial and does not fabricate missing model identities', () => {
    render(<ResponseDemoPreview api={api} data={[
      { id: 'openai-community/gpt2', gated: false, private: false, tags: ['license:mit'] },
      { downloads: 42, likes: 1, pipeline_tag: 'text-generation' },
    ]}/>)
    const preview = screen.getByRole('region', { name: 'Hugging Face Model Search' })
    const card = preview.querySelector('.huggingface-models-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveTextContent('openai-community/gpt2')
    expect(card).not.toHaveTextContent('Model 2')
  })

  it('marks non-array and identity-less HTTP-success payloads invalid while preserving a genuine empty array as empty', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} data={{ models: [] }}/>)
    let card = screen.getByRole('region', { name: 'Hugging Face Model Search' }).querySelector('[data-domain-card="ai-model-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    rerender(<ResponseDemoPreview api={api} data={[{ downloads: 42 }]}/>)
    card = screen.getByRole('region', { name: 'Hugging Face Model Search' }).querySelector('[data-domain-card="ai-model-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('Model 1')
    const requestUrl = 'https://huggingface.co/api/models?search=gpt&limit=8&full=true'
    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={[]}/>)
    card = screen.getByRole('region', { name: 'Hugging Face Model Search' }).querySelector('[data-domain-card="ai-model-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={[]}/>)
    card = screen.getByRole('region', { name: 'Hugging Face Model Search' }).querySelector('[data-domain-card="ai-model-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-request-bound', 'true')
  })

  it('fails closed when an HTTP-success model list does not match the executed search query', () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl="https://huggingface.co/api/models?search=gpt&limit=2&full=true"
      executedRequest={{ url: 'https://huggingface.co/api/models?search=gpt&limit=2&full=true', method: 'GET' }}
      data={[
        { id: 'openai-community/gpt2', gated: false, private: false, downloads: 10, likes: 2 },
        { id: 'google/bert-base-uncased', gated: false, private: false, downloads: 20, likes: 3 },
      ]}
    />)

    const card = screen.getByRole('region', { name: 'Hugging Face Model Search' }).querySelector('.huggingface-models-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-query-mismatch-count', '1')
    expect(card).toHaveTextContent('openai-community/gpt2')
    expect(card).not.toHaveTextContent('google/bert-base-uncased')
  })

  it('rejects malformed executed request identity instead of treating arbitrary model rows as ready', () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl="https://huggingface.co/api/models?search=gpt&limit=1&full=true&sort=downloads"
      data={[{ id: 'openai-community/gpt2', gated: false, private: false, downloads: 10, likes: 2 }]}
    />)

    const card = screen.getByRole('region', { name: 'Hugging Face Model Search' }).querySelector('[data-domain-card="ai-model-catalog"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).not.toHaveTextContent('openai-community/gpt2')
  })

  it('does not coerce numeric-string popularity counters into trusted provider numbers', () => {
    render(<ResponseDemoPreview
      api={api}
      requestUrl="https://huggingface.co/api/models?search=gpt&limit=1&full=true"
      executedRequest={{ url: 'https://huggingface.co/api/models?search=gpt&limit=1&full=true', method: 'GET' }}
      data={[{
        id: 'openai-community/gpt2', gated: false, private: false,
        downloads: '14748356', likes: '3743', lastModified: '2024-02-19T10:57:45.000Z',
      }]}
    />)

    const card = screen.getByRole('region', { name: 'Hugging Face Model Search' }).querySelector('.huggingface-models-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-malformed-popularity-count', '2')
    expect(card).toHaveTextContent('Not supplied')
    expect(card).not.toHaveTextContent('14,748,356')
  })

})
