import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'uk-parliament-members')
if (!api) throw new Error('Missing UK Parliament fixture')

const requestUrl = (name = 'Rishi', take = 3) => `https://members-api.parliament.uk/api/Members/Search?${new URLSearchParams({ Name: name, skip: '0', take: String(take) }).toString()}`
const executedGet = (url: string) => ({ url, method: 'GET' as const })

describe('UK Parliament members semantic preview', () => {
  afterEach(cleanup)

  it('preserves current-member identity, house membership, party, and provider pagination semantics', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl('Rishi', 3)} executedRequest={executedGet(requestUrl('Rishi', 3))} data={{
      items: [{ value: {
        id: 4483,
        nameDisplayAs: 'Rishi Sunak',
        nameFullTitle: 'Rt Hon Rishi Sunak MP',
        latestParty: { id: 4, name: 'Conservative', abbreviation: 'Con' },
        latestHouseMembership: {
          membershipFrom: 'Richmond and Northallerton', membershipFromId: 4259, house: 1,
          membershipStartDate: '2015-05-07T00:00:00', membershipEndDate: null,
          membershipStatus: { statusIsActive: true, statusDescription: 'Current Member', statusStartDate: '2024-07-04T00:00:00' },
        },
      } }], totalResults: 1, skip: 0, take: 3,
    }}/>)

    const preview = screen.getByRole('region', { name: 'UK Parliament Members' })
    expect(preview).toHaveAttribute('data-preview-layout', 'parliament-members')
    expect(preview).toHaveAttribute('data-ssot-fallback', 'false')
    const card = preview.querySelector('.parliament-members-preview')
    expect(card).toHaveAttribute('data-total-results', '1')
    expect(card).toHaveAttribute('data-provider-take', '3')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-uk-parliament-members-search-v2')
    const member = preview.querySelector('[data-member-id="4483"]')
    expect(member).toHaveAttribute('data-party-id', '4')
    expect(member).toHaveAttribute('data-house', '1')
    expect(member).toHaveAttribute('data-membership-from-id', '4259')
    expect(member).toHaveAttribute('data-membership-active', 'true')
    expect(preview).toHaveTextContent('Rishi Sunak')
    expect(preview).toHaveTextContent('House of Commons')
    expect(preview).toHaveTextContent('Richmond and Northallerton')
    expect(preview).toHaveTextContent('Current Member')
    expect(preview).not.toHaveTextContent('UK Parliament Members record 1')
  })

  it('does not invent a constituency/location when latest membership omits it', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl('Example', 1)} executedRequest={executedGet(requestUrl('Example', 1))} data={{ items: [{ value: {
      id: 99,
      nameDisplayAs: 'Example Peer',
      latestParty: { id: 8, name: 'Crossbench' },
      latestHouseMembership: { house: 2, membershipStartDate: '2020-01-01T00:00:00', membershipStatus: { statusIsActive: true, statusDescription: 'Current Member' } },
    } }], totalResults: 1, skip: 0, take: 1 }}/>)
    const preview = screen.getByRole('region', { name: 'UK Parliament Members' })
    expect(preview).toHaveTextContent('House of Lords')
    expect(preview).toHaveTextContent('Membership fromNot supplied')
  })

  it('distinguishes a documented zero-result search from a malformed HTTP-success body', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl('Rishi', 10)} executedRequest={executedGet(requestUrl('Rishi', 10))} data={{ items: [], totalResults: 0, skip: 0, take: 10 }}/>)
    let preview = screen.getByRole('region', { name: 'UK Parliament Members' })
    expect(preview.querySelector('[data-domain-card="parliament-members"]')).toHaveAttribute('data-result-state', 'empty')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl('Rishi', 10)} executedRequest={executedGet(requestUrl('Rishi', 10))} data={{ totalResults: 0, skip: 0, take: 10 }}/>)
    preview = screen.getByRole('region', { name: 'UK Parliament Members' })
    expect(preview.querySelector('[data-domain-card="parliament-members"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('did not include the documented items array')
  })

  it('marks mixed member rows partial and excludes rows without provider-owned member IDs', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl('Rishi', 10)} executedRequest={executedGet(requestUrl('Rishi', 10))} data={{
      items: [
        { value: { id: 4483, nameDisplayAs: 'Rishi Sunak', latestParty: { name: 'Conservative' }, latestHouseMembership: { house: 1 } } },
        { value: { nameDisplayAs: 'Fabricated Member' } },
      ],
      totalResults: 2, skip: 0, take: 10,
    }}/>)

    const preview = screen.getByRole('region', { name: 'UK Parliament Members' })
    const card = preview.querySelector('.parliament-members-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-member-count', '1')
    expect(card).toHaveAttribute('data-invalid-member-count', '1')
    expect(card).toHaveAttribute('data-count-contract-valid', 'true')
    expect(preview).toHaveTextContent('Rishi Sunak')
    expect(preview).not.toHaveTextContent('Fabricated Member')
    expect(preview).not.toHaveTextContent('Member 2')
  })

  it('binds the semantic result to the exact executed member-name search and provider pagination', () => {
    const matching = { value: { id: 4483, nameDisplayAs: 'Rishi Sunak', latestParty: { name: 'Conservative' }, latestHouseMembership: { house: 1 } } }
    const wrongName = { value: { id: 172, nameDisplayAs: 'Keir Starmer', latestParty: { name: 'Labour' }, latestHouseMembership: { house: 1 } } }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl('Rishi', 3)} executedRequest={executedGet(requestUrl('Rishi', 3))} data={{ items: [matching, wrongName], totalResults: 2, skip: 0, take: 3 }}/>)

    let preview = screen.getByRole('region', { name: 'UK Parliament Members' })
    let card = preview.querySelector('.parliament-members-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-contract-valid', 'true')
    expect(card).toHaveAttribute('data-requested-name', 'Rishi')
    expect(card).toHaveAttribute('data-requested-take', '3')
    expect(card).toHaveAttribute('data-requested-skip', '0')
    expect(card).toHaveAttribute('data-request-mismatch-count', '1')
    expect(card).toHaveAttribute('data-count-contract-valid', 'true')
    expect(preview).toHaveTextContent('Rishi Sunak')
    expect(preview).not.toHaveTextContent('Keir Starmer')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl('Rishi', 3)} executedRequest={executedGet(requestUrl('Rishi', 3))} data={{ items: [wrongName], totalResults: 1, skip: 0, take: 3 }}/>)
    preview = screen.getByRole('region', { name: 'UK Parliament Members' })
    expect(preview.querySelector('[data-domain-card="parliament-members"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Keir Starmer')

    rerender(<ResponseDemoPreview api={api} requestUrl="https://members-api.parliament.uk/api/Members/Search?Name=Rishi&skip=0&take=3&unexpected=1" executedRequest={executedGet('https://members-api.parliament.uk/api/Members/Search?Name=Rishi&skip=0&take=3&unexpected=1')} data={{ items: [matching], totalResults: 1, skip: 0, take: 3 }}/>)
    preview = screen.getByRole('region', { name: 'UK Parliament Members' })
    expect(preview.querySelector('[data-domain-card="parliament-members"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('not tied to the exact supported UK Parliament')
  })

  it('rejects numeric-string pagination evidence instead of coercing it into a ready result', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl('Rishi', 3)} executedRequest={executedGet(requestUrl('Rishi', 3))} data={{
      items: [{ value: { id: 4483, nameDisplayAs: 'Rishi Sunak', latestParty: { name: 'Conservative' }, latestHouseMembership: { house: 1 } } }],
      totalResults: '1', skip: '0', take: '3',
    }}/>)
    const preview = screen.getByRole('region', { name: 'UK Parliament Members' })
    const card = preview.querySelector('.parliament-members-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-count-contract-valid', 'false')
  })

  it('keeps displayed-only coherent responses partial when executed transport evidence is unavailable', () => {
    const url = requestUrl('Rishi', 3)
    const payload = {
      items: [{ value: { id: 4483, nameDisplayAs: 'Rishi Sunak', latestParty: { name: 'Conservative' }, latestHouseMembership: { house: 1 } } }],
      totalResults: 1, skip: 0, take: 3,
    }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={url} data={payload}/>)
    let preview = screen.getByRole('region', { name: 'UK Parliament Members' })
    let card = preview.querySelector('.parliament-members-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(preview).toHaveTextContent('Executed transport identity is unavailable')

    rerender(<ResponseDemoPreview api={api} requestUrl={url} data={{ items: [], totalResults: 0, skip: 0, take: 3 }}/>)
    preview = screen.getByRole('region', { name: 'UK Parliament Members' })
    expect(preview.querySelector('[data-domain-card="parliament-members"]')).toHaveAttribute('data-result-state', 'partial')
    expect(preview).toHaveTextContent('semantic emptiness is not trusted')
  })

  it('fails closed when the displayed canonical request disagrees with the executed transport', () => {
    const url = requestUrl('Rishi', 3)
    const payload = {
      items: [{ value: { id: 4483, nameDisplayAs: 'Rishi Sunak', latestParty: { name: 'Conservative' }, latestHouseMembership: { house: 1 } } }],
      totalResults: 1, skip: 0, take: 3,
    }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={url} executedRequest={{ url, method: 'POST' }} data={payload}/>)
    let card = screen.getByRole('region', { name: 'UK Parliament Members' }).querySelector('[data-domain-card="parliament-members"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={url} executedRequest={{ url, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    card = screen.getByRole('region', { name: 'UK Parliament Members' }).querySelector('[data-domain-card="parliament-members"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={url} executedRequest={{ url: `${url}&unexpected=1`, method: 'GET' }} data={payload}/>)
    card = screen.getByRole('region', { name: 'UK Parliament Members' }).querySelector('[data-domain-card="parliament-members"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
  })

})
