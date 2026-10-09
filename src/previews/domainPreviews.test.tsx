import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiCatalog } from '../apiCatalog'
import { ResponseDemoPreview } from '../responsePreview'
import { ColorPreview, colorModel } from './ColorPreview'
import { DnsPreview, dnsModel } from './DnsPreview'
import { DownloadsPreview, downloadsModel } from './DownloadsPreview'
import { CoinbaseRatesPreview, ExchangeRateApiPreview, VatcomplyRatesPreview, coinbaseRateModel, exchangeRateModel, vatcomplyRateModel } from './ExchangeRatesPreview'
import { LifecyclePreview, lifecycleModel } from './LifecyclePreview'
import { NewtonMathPreview } from './NewtonMathPreview'
import { CopyValue, finite, isoDate } from './cardPrimitives'

const colorFixture = {
  hex: { value: '#24b1e0', clean: '24B1E0' }, name: { value: 'Cerulean', exact_match_name: false, closest_named_hex: '#1DACD6' },
  rgb: { value: 'rgb(36, 177, 224)' }, hsl: { value: 'hsl(195, 75%, 51%)' },
  hsv: { value: 'hsv(195, 84%, 88%)' }, cmyk: { value: 'cmyk(84, 21, 0, 12)' },
  XYZ: { value: 'XYZ(46, 59, 92)' }, contrast: { value: '#000000' },
}
const colorRequestUrl = 'https://www.thecolorapi.com/id?hex=24B1E0'
const rateFixture = {
  result: 'success', base_code: 'SGD', time_last_update_utc: 'Sat, 05 Sep 2026 00:02:32 +0000',
  rates: { SGD: 1, MYR: 3.191234, USD: 0.789123, EUR: 0.68, GBP: 0.59, JPY: 116.5, AUD: 1.09, CNY: 5.31, CAD: 1.1, BTC: 0.000010123456 },
}
const lifecycleFixture = {
  last_modified: '2026-09-04T12:00:00Z',
  result: {
    name: 'nodejs', label: 'Node.js',
    releases: Array.from({ length: 12 }, (_, index) => ({
      name: String(26 - index), label: `${26 - index} release`,
      isEol: index > 1, isMaintained: index < 3, isLts: index % 2 === 0,
      releaseDate: '2024-04-24', eolFrom: index === 11 ? null : '2027-04-30',
      eoasFrom: '2026-10-01', eoesFrom: index === 2 ? '2028-04-30' : null,
      latest: index === 11 ? null : { name: `${26 - index}.1.0` },
    })),
  },
}

// jsdom has no Clipboard API. Restore the original descriptor after every test.
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals()
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})
function installClipboard(writeText: (value: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => ({ writeText }) })
}

describe('color specification card', () => {
  it('renders the requested swatch and all color spaces rather than the closest named color', () => {
    render(<ColorPreview data={colorFixture} requestUrl={colorRequestUrl} executedRequest={{ url: colorRequestUrl, method: 'GET' }}/>)
    expect(screen.getByTestId('color-swatch-card')).toHaveAttribute('data-result-state', 'ready')
    expect(screen.getByTestId('color-swatch-card')).toHaveAttribute('data-requested-hex', '#24B1E0')
    expect(screen.getByTestId('color-swatch-card')).toHaveAttribute('data-provider-hex', '#24B1E0')
    expect(screen.getByTestId('color-swatch-card')).toHaveAttribute('data-request-bound', 'true')
    expect(screen.getByTestId('color-swatch-card')).toHaveAttribute('data-identity-match', 'true')
    expect(screen.getByTestId('color-swatch-card')).toHaveAttribute('data-contract-valid', 'true')
    expect(screen.getByRole('img', { name: 'Color swatch #24B1E0' })).toHaveStyle({ backgroundColor: '#24B1E0' })
    expect(screen.getByRole('heading', { name: 'Cerulean' })).toBeInTheDocument()
    expect(screen.getByText('Closest named match')).toBeInTheDocument()
    expect(screen.getByText('#1DACD6')).toBeInTheDocument()
    for (const value of ['rgb(36, 177, 224)', 'hsv(195, 84%, 88%)', 'XYZ(46, 59, 92)']) expect(screen.getByText(value)).toBeInTheDocument()
    expect(screen.getByText(/not a verified accessibility contrast rating/)).toBeInTheDocument()
  })
  it('rejects absent or unsafe CSS values without drawing a guessed color', () => {
    const { rerender } = render(<ColorPreview data={{ hex: { value: 'red; background:url(https://invalid.test)' } }}/>)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Invalid color response')).toBeInTheDocument()
    rerender(<ColorPreview data={{}}/>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(colorModel({ name: {} }).match).toBe('Name match not specified')
  })
  it('fails closed for a wrong-color HTTP-200 payload instead of rendering a plausible swatch', () => {
    render(<ColorPreview data={{ ...colorFixture, hex: { value: '#ff0000', clean: 'FF0000' } }} requestUrl={colorRequestUrl} executedRequest={{ url: colorRequestUrl, method: 'GET' }}/>)
    const card = screen.getByTestId('color-swatch-card')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(/does not match the color in the executed/)).toBeInTheDocument()
  })
  it('fails closed when the color response came from a non-bodyless-GET executed transport', async () => {
    const api = apiCatalog.find((candidate) => candidate.id === 'color-api')!
    const { rerender } = render(<ResponseDemoPreview api={api} data={colorFixture} requestUrl={colorRequestUrl} executedRequest={{ url: colorRequestUrl, method: 'POST' }}/>)
    await waitFor(() => expect(screen.getByTestId('color-swatch-card')).toHaveAttribute('data-result-state', 'invalid'))
    expect(screen.getByTestId('color-swatch-card')).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} data={colorFixture} requestUrl={colorRequestUrl} executedRequest={{ url: colorRequestUrl, method: 'GET', body: { unexpected: true } }}/>)
    await waitFor(() => expect(screen.getByTestId('color-swatch-card')).toHaveAttribute('data-result-state', 'invalid'))

    rerender(<ResponseDemoPreview api={api} data={colorFixture} requestUrl={colorRequestUrl} executedRequest={{ url: colorRequestUrl.replace('24B1E0', 'FFFFFF'), method: 'GET' }}/>)
    await waitFor(() => expect(screen.getByTestId('color-swatch-card')).toHaveAttribute('data-result-state', 'invalid'))
  })

  it('keeps a valid response partial when executed request identity is unavailable', () => {
    render(<ColorPreview data={{ ...colorFixture, hex: { value: '#24B1E0', clean: '24B1E0' } }}/>)
    const card = screen.getByTestId('color-swatch-card')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).not.toHaveAttribute('data-identity-match')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(screen.getByRole('img', { name: 'Color swatch #24B1E0' })).toBeInTheDocument()
    expect(screen.getByText(/executed request identity was unavailable/)).toBeInTheDocument()
  })
  it('expands documented three-digit request input before identity comparison', () => {
    const shorthand = { ...colorFixture, hex: { value: '#AABBCC', clean: 'AABBCC' } }
    expect(colorModel(shorthand, 'https://www.thecolorapi.com/id?hex=abc', { url: 'https://www.thecolorapi.com/id?hex=abc', method: 'GET' })).toMatchObject({ requestedHex: '#AABBCC', providerHex: '#AABBCC', requestBound: true, identityMatch: true, contractValid: true, state: 'ready' })
  })
  it('copies the exact hex only after an explicit action and reports clipboard failure honestly', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    installClipboard(writeText)
    const { unmount } = render(<ColorPreview data={colorFixture}/>)
    expect(writeText).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Copy HEX' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('HEX copied'))
    expect(writeText).toHaveBeenCalledWith('#24B1E0')
    unmount()
    writeText.mockRejectedValueOnce(new Error('Denied'))
    render(<ColorPreview data={colorFixture}/>)
    fireEvent.click(screen.getByRole('button', { name: 'Copy HEX' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copy unavailable.'))
    expect(screen.getByRole('status')).not.toHaveTextContent('HEX copied')
  })
  it('does not label a newer value copied when an older clipboard write finishes', async () => {
    let complete!: () => void
    installClipboard(() => new Promise<void>((resolve) => { complete = resolve }))
    const { rerender } = render(<CopyValue label="HEX" value="#000000"/>)
    fireEvent.click(screen.getByRole('button', { name: 'Copy HEX' }))
    rerender(<CopyValue label="HEX" value="#FFFFFF"/>)
    await act(async () => complete())
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})

describe('FIRST EPSS semantic card', () => {
  const api = apiCatalog.find((item) => item.id === 'first-epss')!
  const requestUrl = 'https://api.first.org/data/v1/epss?cve=CVE-2021-44228'
  const response = {
    status: 'OK', 'status-code': 200, version: '1.0', total: 1, offset: 0, limit: 100,
    data: [{ cve: 'CVE-2021-44228', epss: '0.999990000', percentile: '1.000000000', date: '2026-09-13' }],
  }

  it('binds the provider CVE and bounded probability fields to the executed request', async () => {
    render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/> )
    const card = await waitFor(() => document.querySelector('[data-domain-card="epss-risk"]'))
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-cve', 'CVE-2021-44228')
    expect(card).toHaveAttribute('data-provider-cve', 'CVE-2021-44228')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-contract-valid', 'true')
    expect(screen.getByText('99.999%')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('2026-09-13')).toBeInTheDocument()
  })

  it('fails closed when an HTTP-200 EPSS row belongs to another CVE', async () => {
    const wrong = { ...response, data: [{ ...response.data[0], cve: 'CVE-2024-3094', epss: '0.987650000' }] }
    render(<ResponseDemoPreview api={api} data={wrong} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/> )
    const card = await waitFor(() => document.querySelector('[data-domain-card="epss-risk"]'))
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(screen.queryByText('98.765%')).not.toBeInTheDocument()
  })


  it('rejects numeric JSON values and out-of-range decimal strings that violate the FIRST EPSS field contract', async () => {
    const numeric = { ...response, data: [{ ...response.data[0], epss: 0.99999 }] }
    const { rerender } = render(<ResponseDemoPreview api={api} data={numeric} requestUrl={requestUrl}/> )
    await waitFor(() => expect(document.querySelector('[data-domain-card="epss-risk"]')).toHaveAttribute('data-result-state', 'invalid'))
    expect(screen.queryByText('99.999%')).not.toBeInTheDocument()

    const outOfRange = { ...response, data: [{ ...response.data[0], epss: '1.000010000' }] }
    rerender(<ResponseDemoPreview api={api} data={outOfRange} requestUrl={requestUrl}/> )
    await waitFor(() => expect(document.querySelector('[data-domain-card="epss-risk"]')).toHaveAttribute('data-result-state', 'invalid'))
  })

  it('fails closed when a successful EPSS payload came from a non-bodyless-GET transport', async () => {
    const { rerender } = render(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/> )
    await waitFor(() => expect(document.querySelector('[data-domain-card="epss-risk"]')).toHaveAttribute('data-result-state', 'invalid'))

    rerender(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }}/> )
    await waitFor(() => expect(document.querySelector('[data-domain-card="epss-risk"]')).toHaveAttribute('data-result-state', 'invalid'))

    rerender(<ResponseDemoPreview api={api} data={response} requestUrl={requestUrl} executedRequest={{ url: requestUrl.replace('api.first.org', 'api.first.org:444'), method: 'GET' }}/> )
    await waitFor(() => expect(document.querySelector('[data-domain-card="epss-risk"]')).toHaveAttribute('data-result-state', 'invalid'))
  })

  it('distinguishes a documented no-match response from malformed data and keeps unbound valid data partial', async () => {
    const empty = { ...response, total: 0, data: [] }
    const { rerender } = render(<ResponseDemoPreview api={api} data={empty} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }}/> )
    await waitFor(() => expect(document.querySelector('[data-domain-card="epss-risk"]')).toHaveAttribute('data-result-state', 'empty'))
    expect(screen.getByText(/No exploitation probability has been inferred/)).toBeInTheDocument()

    rerender(<ResponseDemoPreview api={api} data={response}/> )
    const card = await waitFor(() => document.querySelector('[data-domain-card="epss-risk"]'))
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')

    rerender(<ResponseDemoPreview api={api} data={empty}/> )
    const unboundEmpty = await waitFor(() => document.querySelector('[data-domain-card="epss-risk"]'))
    expect(unboundEmpty).toHaveAttribute('data-result-state', 'partial')
    expect(screen.getByText(/not trusted as a request-bound no-match result/)).toBeInTheDocument()
  })
})

describe('DNS diagnostic card', () => {
  const requestUrl = (name: string, type: string) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`
  const executedGet = (url: string) => ({ url, method: 'GET' })

  it('preserves complete TXT records, request identity, wire types and zero-second TTLs as semantic text', () => {
    const full = `"v=DKIM1; p=${'A'.repeat(260)}"`
    render(<DnsPreview
      requestUrl={requestUrl('example.com', 'TXT')}
      executedRequest={executedGet(requestUrl('example.com', 'TXT'))}
      data={{ Status: 0, AD: false, TC: false, Question: [{ name: 'example.com.', type: 16 }], Answer: [{ name: 'example.com.', type: 16, TTL: 0, data: full }] }}
    />)
    const card = document.querySelector('[data-domain-card="dns-records"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-dns-name', 'example.com')
    expect(card).toHaveAttribute('data-requested-dns-type', 'TXT')
    expect(card).toHaveAttribute('data-question-name', 'example.com.')
    expect(card).toHaveAttribute('data-question-type', '16')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(screen.getByText(full)).toBeInTheDocument()
    expect(screen.getByText('TTL 0 seconds')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'DNS answer records' })).getByText('TXT · Text')).toBeInTheDocument()
    expect(screen.getByText('Not validated by resolver')).toBeInTheDocument()
  })

  it('keeps a matching NXDOMAIN as a DNS-layer error rather than semantic invalidity', () => {
    render(<DnsPreview requestUrl={requestUrl('missing.invalid', 'A')} executedRequest={executedGet(requestUrl('missing.invalid', 'A'))} data={{ Status: 3, Question: [{ name: 'missing.invalid.', type: 1 }] }}/>)
    const card = document.querySelector('[data-domain-card="dns-records"]')
    expect(card).toHaveAttribute('data-result-state', 'dns-error')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(screen.getByText('NXDOMAIN')).toBeInTheDocument()
    expect(screen.getByText(/domain does not exist/)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('accepts documented NOERROR/NODATA when Answer is omitted, but rejects malformed response structure', () => {
    const { rerender } = render(<DnsPreview requestUrl={requestUrl('example.com', 'CNAME')} executedRequest={executedGet(requestUrl('example.com', 'CNAME'))} data={{ Status: 0, Question: [{ name: 'example.com.', type: 5 }] }}/>)
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-result-state', 'empty')
    expect(screen.getByText(/no answer records were returned/)).toBeInTheDocument()

    rerender(<DnsPreview requestUrl={requestUrl('example.com', 'A')} data={{ Status: 0, Question: [{ name: 'example.com.', type: 1 }], Answer: {} }}/>)
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByText(/undocumented non-array shape/)).toBeInTheDocument()

    rerender(<DnsPreview requestUrl={requestUrl('example.com', 'A')} data={{}}/>)
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByText(/valid integer Status/)).toBeInTheDocument()
  })

  it('fails closed when the provider Question does not match the executed request', () => {
    render(<DnsPreview
      requestUrl={requestUrl('example.com', 'A')}
      executedRequest={executedGet(requestUrl('example.com', 'A'))}
      data={{ Status: 0, Question: [{ name: 'wrong.example.', type: 1 }], Answer: [{ name: 'wrong.example.', type: 1, TTL: 300, data: '203.0.113.99' }] }}
    />)
    const card = document.querySelector('[data-domain-card="dns-records"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(screen.getByText(/does not match the requested DNS name and record type/)).toBeInTheDocument()
    expect(screen.queryByText('203.0.113.99')).not.toBeInTheDocument()
  })

  it('fails closed when the executed DNS URL leaves the catalog-admitted request surface', () => {
    const response = { Status: 0, Question: [{ name: 'example.com.', type: 1 }], Answer: [{ name: 'example.com.', type: 1, TTL: 300, data: '192.0.2.1' }] }
    const extra = `${requestUrl('example.com', 'A')}&do=true`
    const duplicate = `${requestUrl('example.com', 'A')}&type=TXT`

    const { rerender } = render(<DnsPreview requestUrl={extra} executedRequest={executedGet(extra)} data={response}/>)
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-request-bound', 'false')
    expect(screen.getByText(/supported bodyless GET Google Public DNS request/)).toBeInTheDocument()

    rerender(<DnsPreview requestUrl={duplicate} executedRequest={executedGet(duplicate)} data={response}/>)
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-request-bound', 'false')
  })

  it('fails closed when the successful DNS response is attached to a different executed transport', async () => {
    const api = apiCatalog.find((candidate) => candidate.id === 'google-dns-doh')!
    const url = requestUrl('example.com', 'A')
    const response = { Status: 0, Question: [{ name: 'example.com.', type: 1 }], Answer: [{ name: 'example.com.', type: 1, TTL: 300, data: '192.0.2.1' }] }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={url} executedRequest={{ url, method: 'POST' }} data={response}/> )

    await waitFor(() => expect(document.querySelector('[data-domain-card="dns-records"]')).toHaveAttribute('data-result-state', 'invalid'))

    rerender(<ResponseDemoPreview api={api} requestUrl={url} executedRequest={{ url, method: 'GET', body: { unexpected: true } }} data={response}/> )
    await waitFor(() => expect(document.querySelector('[data-domain-card="dns-records"]')).toHaveAttribute('data-result-state', 'invalid'))

    rerender(<ResponseDemoPreview api={api} requestUrl={url} executedRequest={{ url: requestUrl('example.org', 'A'), method: 'GET' }} data={response}/> )
    await waitFor(() => expect(document.querySelector('[data-domain-card="dns-records"]')).toHaveAttribute('data-result-state', 'invalid'))
  })

  it('rejects numeric-string DNS wire integers instead of silently coercing them', () => {
    const { rerender } = render(<DnsPreview
      requestUrl={requestUrl('example.com', 'A')}
      executedRequest={executedGet(requestUrl('example.com', 'A'))}
      data={{ Status: '0', Question: [{ name: 'example.com.', type: 1 }], Answer: [{ name: 'example.com.', type: 1, TTL: 300, data: '192.0.2.1' }] }}
    />)
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByText(/valid integer Status/)).toBeInTheDocument()

    rerender(<DnsPreview
      requestUrl={requestUrl('example.com', 'A')}
      executedRequest={executedGet(requestUrl('example.com', 'A'))}
      data={{ Status: 0, Question: [{ name: 'example.com.', type: 1 }], Answer: [
        { name: 'example.com.', type: 1, TTL: 300, data: '192.0.2.1' },
        { name: 'example.com.', type: '1', TTL: '300', data: '203.0.113.77' },
      ] }}
    />)
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-result-state', 'partial')
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-valid-answer-count', '1')
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-invalid-answer-count', '1')
    expect(screen.getByText('192.0.2.1')).toBeInTheDocument()
    expect(screen.queryByText('203.0.113.77')).not.toBeInTheDocument()
  })

  it('keeps valid answer rows but marks a mixed malformed batch partial', () => {
    render(<DnsPreview
      requestUrl={requestUrl('example.com', 'A')}
      executedRequest={executedGet(requestUrl('example.com', 'A'))}
      data={{ Status: 0, TC: false, Question: [{ name: 'example.com.', type: 1 }], Answer: [
        { name: 'example.com.', type: 1, TTL: 300, data: '192.0.2.1' },
        { name: 'example.com.', type: 1, TTL: -1, data: '203.0.113.77' },
      ] }}
    />)
    const card = document.querySelector('[data-domain-card="dns-records"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-answer-count', '2')
    expect(card).toHaveAttribute('data-valid-answer-count', '1')
    expect(card).toHaveAttribute('data-invalid-answer-count', '1')
    expect(screen.getByText('192.0.2.1')).toBeInTheDocument()
    expect(screen.queryByText('203.0.113.77')).not.toBeInTheDocument()
    expect(screen.getByText(/malformed provider answer record was omitted/)).toBeInTheDocument()
  })

  it('preserves a legitimate CNAME chain whose terminal answer owner differs from the Question name', () => {
    render(<DnsPreview
      requestUrl={requestUrl('www.github.com', 'A')}
      executedRequest={executedGet(requestUrl('www.github.com', 'A'))}
      data={{ Status: 0, TC: false, Question: [{ name: 'www.github.com.', type: 1 }], Answer: [
        { name: 'www.github.com.', type: 5, TTL: 60, data: 'github.com.' },
        { name: 'github.com.', type: 1, TTL: 60, data: '192.0.2.44' },
      ] }}
    />)
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-result-state', 'ready')
    const list = within(screen.getByRole('list', { name: 'DNS answer records' }))
    expect(list.getByText('CNAME · Alias')).toBeInTheDocument()
    expect(list.getByText('192.0.2.44')).toBeInTheDocument()
    expect(list.getAllByText('github.com.').length).toBeGreaterThan(0)
  })

  it('exposes matching resolver errors and native diagnostic disclosure', () => {
    render(<DnsPreview
      requestUrl={requestUrl('example.com', 'A')}
      executedRequest={executedGet(requestUrl('example.com', 'A'))}
      data={{ Status: 2, TC: true, Question: [{ name: 'example.com.', type: 1 }], Comment: '<script>diagnostic text only</script>' }}
    />)
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-result-state', 'dns-error')
    expect(screen.getByText('SERVFAIL')).toBeInTheDocument()
    expect(screen.getByText('Truncated by resolver')).toBeInTheDocument()
    expect(document.querySelector('details > summary')).toHaveTextContent('Resolver diagnostic')
    expect(document.querySelector('details p')).toHaveTextContent('<script>diagnostic text only</script>')
    expect(document.querySelector('script')).toBeNull()
    expect(dnsModel({ Status: 2, Question: [{ name: 'example.com.', type: 1 }] }, requestUrl('example.com', 'A')).dnssec).toBe('Not supplied')
  })
})

describe('currency conversion cards', () => {
  const exchangeRequestUrl = (base = 'SGD') => `https://open.er-api.com/v6/latest/${base}`
  const coinbaseRequestUrl = (currency = 'EUR') => `https://api.coinbase.com/v2/exchange-rates?${new URLSearchParams({ currency }).toString()}`
  const vatcomplyRequestUrl = (base = 'EUR', symbols = 'USD,SGD,GBP') => `https://api.vatcomply.com/rates?${new URLSearchParams({ base, symbols }).toString()}`
  const executedGet = (url: string) => ({ url, method: 'GET' })

  it('fails closed when FX HTTP-success data is attached to a non-bodyless-GET transport', async () => {
    const cases = [
      {
        id: 'exchange-rate-current',
        url: exchangeRequestUrl(),
        data: rateFixture,
      },
      {
        id: 'ecb-fx-rates',
        url: coinbaseRequestUrl(),
        data: { data: { currency: 'EUR', rates: { USD: '1.15990000', BTC: '0.000010123456' } } },
      },
      {
        id: 'vatcomply',
        url: vatcomplyRequestUrl(),
        data: { date: '2026-09-04', base: 'EUR', rates: { USD: 1.1622, GBP: 0.85898, SGD: 1.4724 } },
      },
    ] as const

    for (const testCase of cases) {
      const api = apiCatalog.find((candidate) => candidate.id === testCase.id)!
      const { rerender, unmount } = render(<ResponseDemoPreview api={api} requestUrl={testCase.url} executedRequest={{ url: testCase.url, method: 'POST' }} data={testCase.data}/>)
      await waitFor(() => expect(document.querySelector('[data-domain-card="exchange-rates"]')).toHaveAttribute('data-result-state', 'invalid'))
      rerender(<ResponseDemoPreview api={api} requestUrl={testCase.url} executedRequest={{ url: testCase.url, method: 'GET', body: { unexpected: true } }} data={testCase.data}/>)
      await waitFor(() => expect(document.querySelector('[data-domain-card="exchange-rates"]')).toHaveAttribute('data-result-state', 'invalid'))
      rerender(<ResponseDemoPreview api={api} requestUrl={testCase.url} executedRequest={{ url: `${testCase.url}#drift`, method: 'GET' }} data={testCase.data}/>)
      await waitFor(() => expect(document.querySelector('[data-domain-card="exchange-rates"]')).toHaveAttribute('data-result-state', 'invalid'))
      unmount()
    }
  })
  it('maps VATComply /rates without implying separate VAT or IBAN operations', () => {
    const fixture = { date: '2026-09-04', base: 'EUR', rates: { USD: 1.1622, GBP: 0.85898, SGD: 1.4724 } }
    const url = vatcomplyRequestUrl()
    expect(vatcomplyRateModel(fixture, url, executedGet(url))).toMatchObject({
      base: 'EUR', updated: '2026-09-04', requestedBase: 'EUR', requestedSymbols: ['USD', 'SGD', 'GBP'],
      providerSymbols: ['GBP', 'SGD', 'USD'], baseIdentityMatch: true, symbolsMatch: true, identityMatch: true,
      contractValid: true, failed: false,
    })
    render(<VatcomplyRatesPreview data={fixture} requestUrl={url} executedRequest={executedGet(url)}/>)
    expect(screen.getByText('1 EUR → USD')).toBeInTheDocument()
    expect(screen.getAllByText('1.1622').length).toBeGreaterThan(0)
    expect(screen.getByText(/VAT-number and IBAN validation are separate provider endpoints/)).toBeInTheDocument()
    const card = document.querySelector('[data-domain-card="exchange-rates"]')
    expect(card).toHaveAttribute('data-requested-base-currency', 'EUR')
    expect(card).toHaveAttribute('data-provider-base-currency', 'EUR')
    expect(card).toHaveAttribute('data-requested-symbols', 'USD,SGD,GBP')
    expect(card).toHaveAttribute('data-provider-symbols', 'GBP,SGD,USD')
    expect(card).toHaveAttribute('data-base-identity-match', 'true')
    expect(card).toHaveAttribute('data-symbols-match', 'true')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-contract-valid', 'true')
  })
  it('fails plausible VATComply HTTP-success data closed when executed base identity disagrees', () => {
    const fixture = { date: '2026-09-04', base: 'USD', rates: { EUR: 0.86, SGD: 1.27, GBP: 0.74 } }
    render(<VatcomplyRatesPreview data={fixture} requestUrl={vatcomplyRequestUrl('EUR')}/>)
    const card = document.querySelector('[data-domain-card="exchange-rates"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-requested-base-currency', 'EUR')
    expect(card).toHaveAttribute('data-provider-base-currency', 'USD')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(card).not.toHaveTextContent('1.27')
  })
  it('fails plausible VATComply HTTP-success data closed when returned symbols disagree with the executed filter', () => {
    const fixture = { date: '2026-09-04', base: 'EUR', rates: { USD: 1.1622, GBP: 0.85898, JPY: 171.12 } }
    render(<VatcomplyRatesPreview data={fixture} requestUrl={vatcomplyRequestUrl('EUR', 'USD,SGD,GBP')}/>)
    const card = document.querySelector('[data-domain-card="exchange-rates"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-requested-symbols', 'USD,SGD,GBP')
    expect(card).toHaveAttribute('data-provider-symbols', 'GBP,JPY,USD')
    expect(card).toHaveAttribute('data-base-identity-match', 'true')
    expect(card).toHaveAttribute('data-symbols-match', 'false')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(card).not.toHaveTextContent('171.12')
  })
  it('rejects VATComply numeric-string rates instead of coercing them into provider measurements', () => {
    const fixture = { date: '2026-09-04', base: 'EUR', rates: { USD: '1.1622', GBP: 0.85898, SGD: 1.4724 } }
    render(<VatcomplyRatesPreview data={fixture} requestUrl={vatcomplyRequestUrl()}/>)
    const card = document.querySelector('[data-domain-card="exchange-rates"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(card).not.toHaveTextContent('1.1622')
  })
  it('rejects VATComply reference dates outside the documented YYYY-MM-DD contract', () => {
    const fixture = { date: 'Sep 4, 2026', base: 'EUR', rates: { USD: 1.1622, GBP: 0.85898, SGD: 1.4724 } }
    render(<VatcomplyRatesPreview data={fixture} requestUrl={vatcomplyRequestUrl()}/>)
    const card = document.querySelector('[data-domain-card="exchange-rates"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
  })
  it('preserves supplied fiat and crypto precision, binds Coinbase to the executed base, and does not invent update time', () => {
    expect(exchangeRateModel(rateFixture, exchangeRequestUrl()).rates.find((r) => r.code === 'USD')?.raw).toBe('0.789123')
    const fixture = { data: { currency: 'EUR', rates: { USD: '1.15990000', BTC: '0.000010123456' } } }
    const url = coinbaseRequestUrl()
    expect(coinbaseRateModel(fixture, url, executedGet(url))).toMatchObject({ requestedBase: 'EUR', base: 'EUR', identityMatch: true, contractValid: true, requestBound: true, failed: false })
    expect(coinbaseRateModel(fixture, url, executedGet(url)).rates[0].raw).toBe('0.000010123456')
    render(<CoinbaseRatesPreview data={fixture} requestUrl={url} executedRequest={executedGet(url)}/>)
    expect(screen.getAllByText('1.15990000').length).toBeGreaterThan(0)
    expect(screen.getByText('0.000010123456')).toBeInTheDocument()
    expect(screen.getByText('Not supplied in this response')).toBeInTheDocument()
    const card = document.querySelector('[data-domain-card="exchange-rates"]')
    expect(card).toHaveAttribute('data-requested-base-currency', 'EUR')
    expect(card).toHaveAttribute('data-provider-base-currency', 'EUR')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-contract-valid', 'true')
  })

  it('fails plausible Coinbase HTTP-success data closed when executed base identity disagrees', () => {
    const fixture = { data: { currency: 'USD', rates: { EUR: '0.8593', SGD: '1.2645', BTC: '0.0000086' } } }
    render(<CoinbaseRatesPreview data={fixture} requestUrl={coinbaseRequestUrl('EUR')}/>)
    const card = document.querySelector('[data-domain-card="exchange-rates"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-requested-base-currency', 'EUR')
    expect(card).toHaveAttribute('data-provider-base-currency', 'USD')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(card).not.toHaveTextContent('1.2645')
  })
  it('calculates amounts and switches targets without another fetch', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<ExchangeRateApiPreview data={rateFixture} requestUrl={exchangeRequestUrl()}/>)
    fireEvent.change(screen.getByLabelText('Amount in SGD'), { target: { value: '250' } })
    fireEvent.change(screen.getByLabelText('Convert to'), { target: { value: 'USD' } })
    const output = screen.getByLabelText('Converted amount')
    expect(Number(output.getAttribute('data-value'))).toBeCloseTo(250 * 0.789123, 8)
    expect(output).toHaveAttribute('data-currency', 'USD')
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Amount in SGD'), { target: { value: '0' } })
    expect(output).toHaveAttribute('data-value', '0')
    expect(screen.getByLabelText('Amount in SGD')).toHaveAttribute('aria-invalid', 'false')
  })
  it('does not turn missing, negative or overflowing amounts into a valid zero conversion', () => {
    render(<ExchangeRateApiPreview data={rateFixture} requestUrl={exchangeRequestUrl()}/>)
    for (const value of ['', '-1', '1e308']) {
      fireEvent.change(screen.getByLabelText('Amount in SGD'), { target: { value } })
      expect(screen.getByLabelText('Converted amount')).not.toHaveAttribute('data-value')
      expect(screen.getByLabelText('Amount in SGD')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByText(/Enter a finite, non-negative amount/)).toBeInTheDocument()
    }
  })
  it('makes currencies beyond the first eight accessible through filtering and show-more', () => {
    render(<ExchangeRateApiPreview data={rateFixture} requestUrl={exchangeRequestUrl()}/>)
    const list = screen.getByRole('list', { name: 'Exchange rates from this response' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'Show more rates' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(9)
    fireEvent.change(screen.getByLabelText('Filter currencies'), { target: { value: 'btc' } })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(list).toHaveTextContent('0.000010123456')
    fireEvent.change(screen.getByLabelText('Filter currencies'), { target: { value: 'nonexistent' } })
    expect(screen.getByText(/No currency codes match/)).toBeInTheDocument()
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('0 of 0 rates shown')
  })
  it('binds ExchangeRate-API results to the executed base currency and strict success contract', () => {
    const url = exchangeRequestUrl()
    const model = exchangeRateModel(rateFixture, url, executedGet(url))
    expect(model).toMatchObject({ requestedBase: 'SGD', base: 'SGD', identityMatch: true, contractValid: true, requestBound: true, failed: false })
    render(<ExchangeRateApiPreview data={rateFixture} requestUrl={url} executedRequest={executedGet(url)}/>)
    const card = document.querySelector('[data-domain-card="exchange-rates"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-base-currency', 'SGD')
    expect(card).toHaveAttribute('data-provider-base-currency', 'SGD')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-contract-valid', 'true')
  })


  it('keeps coherent FX data partial when executed transport identity is unavailable', () => {
    const url = exchangeRequestUrl()
    render(<ExchangeRateApiPreview data={rateFixture} requestUrl={url}/>)
    const card = document.querySelector('[data-domain-card="exchange-rates"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(screen.getByText(/executed transport identity is unavailable/)).toBeInTheDocument()
  })

  it('fails plausible HTTP-success FX data closed when base identity or numeric rate contract disagrees', () => {
    const { rerender } = render(<ExchangeRateApiPreview data={{ ...rateFixture, base_code: 'USD' }} requestUrl={exchangeRequestUrl('SGD')}/>)
    let card = document.querySelector('[data-domain-card="exchange-rates"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(card).not.toHaveTextContent('3.191234')

    rerender(<ExchangeRateApiPreview data={{ ...rateFixture, rates: { SGD: 1, MYR: '3.191234', USD: 0.789123 } }} requestUrl={exchangeRequestUrl('SGD')}/>)
    card = document.querySelector('[data-domain-card="exchange-rates"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(card).not.toHaveTextContent('3.191234')
  })

  it('fails closed for missing base, rejected payloads and absent valid rates', () => {
    const { rerender } = render(<ExchangeRateApiPreview data={{ rates: { MYR: 3.2 } }} requestUrl={exchangeRequestUrl()}/>)
    expect(screen.getByText('Exchange rates unavailable')).toBeInTheDocument()
    rerender(<ExchangeRateApiPreview data={{ ...rateFixture, result: 'error' }} requestUrl={exchangeRequestUrl()}/>)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    rerender(<CoinbaseRatesPreview data={{ data: { currency: 'EUR', rates: { USD: null, GBP: true, BTC: '', MYR: -1 } } }}/>)
    expect(screen.getByText('Exchange rates unavailable')).toBeInTheDocument()
  })
  it('resets local state on base-currency change and includes provider attribution', () => {
    const { rerender } = render(<ExchangeRateApiPreview data={rateFixture} requestUrl={exchangeRequestUrl()}/>)
    fireEvent.change(screen.getByLabelText('Amount in SGD'), { target: { value: '700' } })
    rerender(<ExchangeRateApiPreview data={{ result: 'success', base_code: 'USD', rates: { USD: 1, SGD: 1.2 } }} requestUrl={exchangeRequestUrl('USD')}/>)
    expect(screen.getByLabelText('Amount in USD')).toHaveValue(100)
    expect(screen.getByRole('link', { name: 'Rates By Exchange Rate API' })).toHaveAttribute('href', 'https://www.exchangerate-api.com')
    expect(screen.getByText(/not a trade quote/)).toBeInTheDocument()
  })
})

describe('npm reporting-window card', () => {
  const requestUrl = (period = 'last-week', packageName = '@scope/package') =>
    `https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(packageName)}`

  it('uses request-bound package identity, exact total, inclusive UTC window and computed average without fabricating a trend', () => {
    const fixture = { package: '@scope/package', downloads: 171637376, start: '2026-08-23', end: '2026-08-29' }
    expect(downloadsModel(fixture, requestUrl()).days).toBe(7)
    expect(downloadsModel(fixture, requestUrl()).average).toBeCloseTo(171637376 / 7, 6)
    render(<DownloadsPreview data={fixture} requestUrl={requestUrl()}/>)
    const card = document.querySelector('[data-domain-card="download-summary"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-package', '@scope/package')
    expect(card).toHaveAttribute('data-provider-package', '@scope/package')
    expect(card).toHaveAttribute('data-requested-period', 'last-week')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-period-contract', 'true')
    expect(screen.getByRole('heading', { name: '@scope/package' })).toBeInTheDocument()
    expect(screen.getByText('171,637,376')).toBeInTheDocument()
    expect(document.querySelector('time[datetime="2026-08-23"]')).toBeInTheDocument()
    expect(screen.getByText(/not a daily time series/)).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeNull()
  })

  it('fails closed when an HTTP-success response belongs to a different package', () => {
    render(<DownloadsPreview
      requestUrl={requestUrl('last-week', 'react')}
      data={{ package: 'lodash', downloads: 999999999, start: '2026-08-23', end: '2026-08-29' }}
    />)
    const card = document.querySelector('[data-domain-card="download-summary"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(screen.getByText(/package identity does not match/i)).toBeInTheDocument()
    expect(screen.queryByText('999,999,999')).not.toBeInTheDocument()
  })

  it('fails closed when the provider reporting span contradicts the requested named period', () => {
    render(<DownloadsPreview
      requestUrl={requestUrl('last-week', 'react')}
      data={{ package: 'react', downloads: 7654321, start: '2026-08-24', end: '2026-08-29' }}
    />)
    const card = document.querySelector('[data-domain-card="download-summary"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-period-contract', 'false')
    expect(screen.getByText(/reporting window does not match/i)).toBeInTheDocument()
    expect(screen.queryByText('7,654,321')).not.toBeInTheDocument()
  })

  it('fails closed when the executed transport is not the documented bodyless GET', () => {
    const url = requestUrl('last-week', 'react')
    const fixture = { package: 'react', downloads: 7654321, start: '2026-08-23', end: '2026-08-29' }
    const { rerender } = render(<DownloadsPreview requestUrl={url} executedRequest={{ url, method: 'POST' }} data={fixture}/>)
    expect(document.querySelector('[data-domain-card="download-summary"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByText(/bodyless GET npm point-download endpoint/i)).toBeInTheDocument()

    rerender(<DownloadsPreview requestUrl={url} executedRequest={{ url, method: 'GET', body: { unexpected: true } }} data={fixture}/>)
    expect(document.querySelector('[data-domain-card="download-summary"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('rejects a non-canonical npm downloads origin even when the path is valid', () => {
    const canonical = requestUrl('last-week', 'react')
    const alternate = canonical.replace('https://api.npmjs.org', 'https://api.npmjs.org:444')
    render(<DownloadsPreview requestUrl={alternate} executedRequest={{ url: alternate, method: 'GET' }} data={{ package: 'react', downloads: 7654321, start: '2026-08-23', end: '2026-08-29' }}/>)
    expect(document.querySelector('[data-domain-card="download-summary"]')).toHaveAttribute('data-result-state', 'invalid')
  })

  it('keeps valid provider facts partial without executed-request identity', () => {
    render(<DownloadsPreview data={{ package: 'react', downloads: 123, start: '2026-09-01', end: '2026-09-07' }}/>)
    expect(document.querySelector('[data-domain-card="download-summary"]')).toHaveAttribute('data-result-state', 'partial')
    expect(screen.getByText('123')).toBeInTheDocument()
    expect(screen.getByText(/cannot be fully bound to the executed npm request/i)).toBeInTheDocument()
  })

  it('preserves genuine zero but rejects missing, negative, coerced and unsafe counts', () => {
    render(<DownloadsPreview data={{ package: 'empty', downloads: 0, start: '2026-09-01', end: '2026-09-01' }}/>)
    expect(document.querySelector('[data-download-count]')).toHaveAttribute('data-download-count', '0')
    expect(downloadsModel({ downloads: 0, start: '2026-09-01', end: '2026-09-01' }).days).toBe(1)
    for (const downloads of [null, undefined, -1, true, '', '100', Number.MAX_SAFE_INTEGER + 1]) expect(downloadsModel({ downloads }).downloads).toBeUndefined()
  })
  it('does not derive an average from invalid or reversed reporting dates', () => {
    expect(downloadsModel({ downloads: 100, start: '2026-02-30', end: '2026-03-02' }).average).toBeUndefined()
    expect(downloadsModel({ downloads: 100, start: '2026-09-05', end: '2026-09-01' }).average).toBeUndefined()
    expect(isoDate('2024-02-29')).toBe('2024-02-29')
    expect(isoDate('2025-02-29')).toBeUndefined()
    for (const value of [null, true, false, '', '   ']) expect(finite(value)).toBeUndefined()
  })
})


describe('Newton symbolic math request binding', () => {
  const fixture = { operation: 'simplify', expression: '2x+2x', result: '4 x' }
  const requestUrl = 'https://newton.vercel.app/api/v2/simplify/2x%2B2x'
  const executedGet = { url: requestUrl, method: 'GET' } as const

  it('marks only an exact executed bodyless GET operation/expression binding ready', () => {
    render(<NewtonMathPreview data={fixture} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const card = document.querySelector('[data-domain-card="symbolic-math"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-newton-symbolic-math-v2')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-requested-operation', 'simplify')
    expect(card).toHaveAttribute('data-requested-expression', '2x+2x')
  })

  it('keeps coherent provider facts partial when displayed identity exists but execution evidence is unavailable', () => {
    render(<NewtonMathPreview data={fixture} requestUrl={requestUrl}/>)
    const card = document.querySelector('[data-domain-card="symbolic-math"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-request-contract', 'exact-newton-symbolic-math-v2')
    expect(screen.getByText('4 x')).toBeInTheDocument()
  })

  it('fails closed for POST, GET-with-body, or executed/display URL drift', () => {
    const { rerender } = render(<NewtonMathPreview data={fixture} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)
    let card = document.querySelector('[data-domain-card="symbolic-math"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<NewtonMathPreview data={fixture} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }}/>)
    card = document.querySelector('[data-domain-card="symbolic-math"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<NewtonMathPreview data={fixture} requestUrl={requestUrl} executedRequest={{ url: 'https://newton.vercel.app/api/v2/factor/2x%2B2x', method: 'GET' }}/>)
    card = document.querySelector('[data-domain-card="symbolic-math"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('forwards executed-request transport through the SSOT registry', async () => {
    const api = apiCatalog.find((candidate) => candidate.id === 'newton-math-solver')!
    render(<ResponseDemoPreview api={api} data={fixture} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)
    const card = await waitFor(() => document.querySelector('[data-domain-card="symbolic-math"]'))
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-request-contract', 'exact-newton-symbolic-math-v2')
  })

  it('fails closed when an exact-request HTTP-success payload belongs to a different operation or expression', () => {
    render(<NewtonMathPreview data={{ operation: 'factor', expression: 'x^2+2x', result: 'x (x + 2)' }} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const card = document.querySelector('[data-domain-card="symbolic-math"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(screen.queryByText('x (x + 2)')).not.toBeInTheDocument()
  })

  it('keeps valid provider facts partial when neither displayed nor executed-request identity is available', () => {
    render(<NewtonMathPreview data={fixture}/>)
    const card = document.querySelector('[data-domain-card="symbolic-math"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(screen.getByText('4 x')).toBeInTheDocument()
  })
})

describe('software lifecycle explorer', () => {
  const requestUrl = 'https://endoflife.date/api/v1/products/nodejs'
  const executedGet = { url: requestUrl, method: 'GET' } as const

  it('keeps end-of-life and any maintenance independent, including extended support', () => {
    render(<LifecyclePreview data={lifecycleFixture}/>)
    const release = document.querySelector('[data-release="24"]') as HTMLElement
    expect(release).toHaveTextContent('End of life')
    expect(release).toHaveTextContent('Some support available')
    expect(release).toHaveTextContent('24.1.0')
    expect(release.querySelector('details > summary')).toHaveTextContent('Support milestones for Node.js 24')
    expect(release.querySelector('time[datetime="2028-04-30"]')).toBeInTheDocument()
  })
  it('makes every returned cycle reachable with native filtering and show-more', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    render(<LifecyclePreview data={lifecycleFixture}/>)
    const list = screen.getByRole('list', { name: 'Software release cycles' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'Show more releases' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(12)
    fireEvent.change(screen.getByLabelText('Filter releases'), { target: { value: 'maintained' } })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Filter releases'), { target: { value: 'lts' } })
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('retains unknown flags and dates instead of labeling them unsupported or unlimited', () => {
    const fixture = { result: { name: 'example', releases: [{ name: '1', eolFrom: null, latest: null }] } }
    const release = lifecycleModel(fixture).releases[0]
    expect(release.maintained).toBeUndefined()
    expect(release.eol).toBeUndefined()
    render(<LifecyclePreview data={fixture}/>)
    expect(screen.getByText('EOL not supplied')).toBeInTheDocument()
    expect(screen.queryByText('Not maintained')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Filter releases'), { target: { value: 'maintained' } })
    expect(screen.getByText('No releases match this filter.')).toBeInTheDocument()
  })
  it('binds provider product identity to the exact executed bodyless GET request', () => {
    render(<LifecyclePreview data={lifecycleFixture} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const card = document.querySelector('[data-domain-card="release-lifecycle"]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-endoflife-date-product-v2')
    expect(card).toHaveAttribute('data-requested-product', 'nodejs')
    expect(card).toHaveAttribute('data-provider-product', 'nodejs')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-provider-records', '12')
    expect(card).toHaveAttribute('data-valid-records', '12')
    expect(card).toHaveAttribute('data-invalid-records', '0')
  })
  it('keeps coherent lifecycle facts partial when executed-request evidence is unavailable', () => {
    render(<LifecyclePreview data={lifecycleFixture} requestUrl={requestUrl}/>)
    const card = document.querySelector('[data-domain-card="release-lifecycle"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(card).toHaveTextContent('Node.js 26')
    expect(card).toHaveTextContent('executed-request identity is unavailable')
  })
  it('fails closed when a successful lifecycle payload is attached to transport drift', () => {
    const { rerender } = render(<LifecyclePreview data={lifecycleFixture} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)
    let card = document.querySelector('[data-domain-card="release-lifecycle"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(screen.queryByText('Node.js 26')).not.toBeInTheDocument()

    rerender(<LifecyclePreview data={lifecycleFixture} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }}/>)
    card = document.querySelector('[data-domain-card="release-lifecycle"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<LifecyclePreview data={lifecycleFixture} requestUrl={requestUrl} executedRequest={{ url: 'https://endoflife.date/api/v1/products/python', method: 'GET' }}/>)
    card = document.querySelector('[data-domain-card="release-lifecycle"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })
  it('fails closed when an HTTP-success lifecycle payload belongs to a different product', () => {
    const wrongProduct = { ...lifecycleFixture, result: { ...lifecycleFixture.result, name: 'python', label: 'Python' } }
    render(<LifecyclePreview data={wrongProduct} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const card = document.querySelector('[data-domain-card="release-lifecycle"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(screen.getByText('Lifecycle response identity mismatch')).toBeInTheDocument()
    expect(screen.queryByText('Python 26')).not.toBeInTheDocument()
  })
  it('distinguishes malformed release envelopes from genuine exact-request empty release sets', () => {
    const malformed = { result: { name: 'nodejs', label: 'Node.js', releases: { name: '26' } } }
    const { rerender } = render(<LifecyclePreview data={malformed} requestUrl={requestUrl} executedRequest={executedGet}/>)
    expect(document.querySelector('[data-domain-card="release-lifecycle"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(screen.getByText('Invalid lifecycle response')).toBeInTheDocument()
    rerender(<LifecyclePreview data={{ result: { name: 'nodejs', label: 'Node.js', releases: [] } }} requestUrl={requestUrl} executedRequest={executedGet}/>)
    expect(document.querySelector('[data-domain-card="release-lifecycle"]')).toHaveAttribute('data-result-state', 'empty')
    expect(screen.getByText('Release information unavailable')).toBeInTheDocument()
    rerender(<LifecyclePreview data={{ result: { name: 'nodejs', label: 'Node.js', releases: [] } }} requestUrl={requestUrl}/>)
    expect(document.querySelector('[data-domain-card="release-lifecycle"]')).toHaveAttribute('data-result-state', 'partial')
    expect(screen.getByText('Release information not request-bound')).toBeInTheDocument()
  })
  it('marks mixed release batches partial and omits identity-less rows', () => {
    const mixed = { ...lifecycleFixture, result: { ...lifecycleFixture.result, releases: [lifecycleFixture.result.releases[0], { label: 'fabricated cycle', isEol: false }] } }
    render(<LifecyclePreview data={mixed} requestUrl={requestUrl} executedRequest={executedGet}/>)
    const card = document.querySelector('[data-domain-card="release-lifecycle"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-records', '2')
    expect(card).toHaveAttribute('data-valid-records', '1')
    expect(card).toHaveAttribute('data-invalid-records', '1')
    expect(screen.queryByText('fabricated cycle')).not.toBeInTheDocument()
    expect(screen.getByText(/1 malformed release record was withheld/)).toBeInTheDocument()
  })
})

describe('Phase 2 API-owned SSOT integration', () => {
  const cases = [
    ['color-api', 'color-swatch', colorFixture],
    ['google-dns-doh', 'dns-records', { Status: 0, Question: [{ name: 'example.com.', type: 1 }], Answer: [{ name: 'example.com.', type: 1, TTL: 300, data: '192.0.2.1' }] }],
    ['npm-download-counts', 'download-summary', { downloads: 12, start: '2026-09-01', end: '2026-09-01', package: 'react' }],
    ['endoflife-date', 'release-lifecycle', lifecycleFixture],
    ['exchange-rate-current', 'exchange-rates', rateFixture],
    ['ecb-fx-rates', 'exchange-rates', { data: { currency: 'EUR', rates: { USD: '1.1599' } } }],
    ['vatcomply', 'exchange-rates', { date: '2026-09-04', base: 'EUR', rates: { USD: 1.1622, GBP: 0.85898, SGD: 1.4724 } }],
  ] as const
  it.each(cases)('%s uses its dedicated composition within the existing V2 shell', (id, layout, data) => {
    const api = apiCatalog.find((entry) => entry.id === id)!
    render(<ResponseDemoPreview api={api} data={data}/>)
    const region = screen.getByRole('region', { name: api.name })
    expect(region).toHaveAttribute('data-preview-layout', layout)
    expect(region).toHaveAttribute('data-ssot-design', 'result-card-v2')
    expect(region).toHaveAttribute('data-ssot-fallback', 'false')
    expect(region.querySelector('[data-domain-card]')).toHaveAttribute('data-domain-card', layout)
    expect(region.querySelector('.semantic-card-grid, [data-generic-fallback="true"]')).toBeNull()
  })
})
