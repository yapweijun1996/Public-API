import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'rdap-domain-lookup')!
const requestUrl = api.buildUrl({ domain: 'google.com' })
const executedGet = (url = requestUrl) => ({ url, method: 'GET' })
const domainRecord = {
  objectClassName: 'domain',
  handle: '2138514_DOMAIN_COM-VRSN',
  ldhName: 'GOOGLE.COM',
  status: ['client delete prohibited'],
  nameservers: [{ objectClassName: 'nameserver', ldhName: 'NS1.GOOGLE.COM' }],
  events: [
    { eventAction: 'registration', eventDate: '1997-09-15T04:00:00Z' },
    { eventAction: 'expiration', eventDate: '2028-09-14T04:00:00Z' },
  ],
  entities: [{ roles: ['registrar'], handle: '292', vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'MarkMonitor Inc.']]] }],
}

const rdapCard = () => screen.getByRole('region', { name: 'RDAP Domain Lookup' }).querySelector('.rdap-domain-preview') as HTMLElement

describe('RDAP Domain semantic identity', () => {
  afterEach(cleanup)

  it('binds the provider domain identity to the executed direct lookup', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet()} data={domainRecord}/>)
    const card = rdapCard()
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-domain', 'google.com')
    expect(card).toHaveAttribute('data-provider-domain', 'google.com')
    expect(card).toHaveAttribute('data-object-class-name', 'domain')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-context-shape-valid', 'true')
    expect(within(card).getByText('GOOGLE.COM')).toBeInTheDocument()
    expect(card).toHaveTextContent('MarkMonitor Inc.')
  })

  it('fails closed when an HTTP-success response identifies a different domain', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet()} data={{ ...domainRecord, ldhName: 'FABRICATED.EXAMPLE', handle: 'FAKE', entities: [{ roles: ['registrar'], handle: 'Fake Registrar' }] }}/>)
    const card = rdapCard()
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(card).toHaveTextContent('RDAP domain identity mismatch')
    expect(card).not.toHaveTextContent('Fake Registrar')
    expect(card).not.toHaveTextContent('FAKE')
  })

  it('fails closed when a valid RDAP payload is attached to a different executed transport', () => {
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={domainRecord}/>)
    expect(rdapCard()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={domainRecord}/>)
    expect(rdapCard()).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: api.buildUrl({ domain: 'example.com' }), method: 'GET' }} data={domainRecord}/>)
    expect(rdapCard()).toHaveAttribute('data-result-state', 'invalid')
  })

  it('fails closed when a direct domain lookup returns another RDAP object class', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet()} data={{ ...domainRecord, objectClassName: 'entity' }}/>)
    const card = rdapCard()
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('RDAP object-type mismatch')
    expect(card).not.toHaveTextContent('MarkMonitor Inc.')
  })

  it('fails closed when HTTP-success data has no provider-owned domain identity', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet()} data={{ objectClassName: 'domain', handle: 'FABRICATED', status: ['active'] }}/>)
    const card = rdapCard()
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('Invalid RDAP domain identity')
    expect(card).not.toHaveTextContent('FABRICATED')
  })

  it('treats A-label and U-label forms of the same IDN as one identity', () => {
    const idnUrl = api.buildUrl({ domain: 'bücher.example' })
    render(<ResponseDemoPreview api={api} requestUrl={idnUrl} executedRequest={executedGet(idnUrl)} data={{
      objectClassName: 'domain',
      ldhName: 'XN--BCHER-KVA.EXAMPLE',
      unicodeName: 'bücher.example',
      status: [],
      nameservers: [],
      events: [],
      entities: [],
    }}/>)
    const card = rdapCard()
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-domain', 'xn--bcher-kva.example')
    expect(card).toHaveAttribute('data-provider-domain', 'xn--bcher-kva.example')
    expect(card).toHaveAttribute('data-identity-match', 'true')
  })

  it('rejects contradictory LDH and Unicode identities', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet()} data={{
      ...domainRecord,
      ldhName: 'GOOGLE.COM',
      unicodeName: 'example.com',
    }}/>)
    const card = rdapCard()
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveTextContent('Conflicting RDAP domain identity')
    expect(card).not.toHaveTextContent('MarkMonitor Inc.')
  })

  it('keeps a coherent unbound response partial instead of claiming request verification', () => {
    render(<ResponseDemoPreview api={api} data={domainRecord}/>)
    const card = rdapCard()
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-identity-match', 'unbound')
    expect(card).toHaveTextContent('request identity is unavailable')
    expect(card).toHaveTextContent('MarkMonitor Inc.')
  })

  it('marks malformed optional registration arrays partial and hides their untrusted contents', () => {
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedGet()} data={{ ...domainRecord, nameservers: [{ ldhName: 'NS1.GOOGLE.COM' }, { handle: 'FABRICATED-NAMESERVER' }] }}/>)
    const card = rdapCard()
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-context-shape-valid', 'false')
    expect(card).toHaveAttribute('data-nameserver-count', '0')
    expect(card).not.toHaveTextContent('FABRICATED-NAMESERVER')
  })
})
