import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'un-sdg-goals')
if (!api) throw new Error('Missing un-sdg-goals fixture')

const goal = (code: string) => ({ code, title: `Goal ${code} title`, description: `Goal ${code} description.`, uri: `/v1/sdg/Goal/${code}` })

describe('UN SDG goals semantic preview', () => {
  afterEach(cleanup)

  it('marks an incomplete goal catalogue partial while preserving provider identity', () => {
    render(<ResponseDemoPreview api={api} data={[goal('1'), goal('2')]}/>)
    const preview = screen.getByRole('region', { name: 'UN Sustainable Development Goals' })
    const card = preview.querySelector('.sdg-goals-preview')
    expect(preview).toHaveAttribute('data-preview-layout', 'sdg-goals')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-usable-goal-count', '2')
    expect(card).toHaveAttribute('data-malformed-record-count', '0')
    expect(card).toHaveAttribute('data-complete-official-set', 'false')
    expect(preview.querySelector('[data-goal-code="1"]')).toHaveAttribute('data-goal-uri', '/v1/sdg/Goal/1')
    expect(preview).toHaveTextContent('Goal 1 description.')
    expect(preview).toHaveTextContent('Incomplete Goal/List response')
    expect(screen.getByLabelText('Goal 1 API path')).toHaveTextContent('/v1/sdg/Goal/1')
  })

  it('marks only the complete unique official Goal 1-17 set ready', () => {
    render(<ResponseDemoPreview api={api} data={Array.from({ length: 17 }, (_, index) => goal(String(index + 1)))}/>)
    const card = screen.getByRole('region', { name: 'UN Sustainable Development Goals' }).querySelector('.sdg-goals-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-goal-count', '17')
    expect(card).toHaveAttribute('data-complete-official-set', 'true')
  })

  it('marks malformed HTTP-success shapes invalid instead of empty', () => {
    render(<ResponseDemoPreview api={api} data={{ goals: [goal('1')] }}/>)
    const card = screen.getByRole('region', { name: 'UN Sustainable Development Goals' }).querySelector('[data-domain-card="sdg-goals"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('not the expected Goal/List array')
  })

  it('keeps a genuine empty provider array semantically empty', () => {
    render(<ResponseDemoPreview api={api} data={[]}/>)
    const card = screen.getByRole('region', { name: 'UN Sustainable Development Goals' }).querySelector('[data-domain-card="sdg-goals"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
  })
})
