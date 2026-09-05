import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiCatalog } from '../apiCatalog'
import { ResponseDemoPreview } from '../responsePreview'
import { ColorPreview, colorModel } from './ColorPreview'
import { DnsPreview, dnsModel } from './DnsPreview'
import { DownloadsPreview, downloadsModel } from './DownloadsPreview'
import { CoinbaseRatesPreview, ExchangeRateApiPreview, coinbaseRateModel, exchangeRateModel } from './ExchangeRatesPreview'
import { LifecyclePreview, lifecycleModel } from './LifecyclePreview'
import { CopyValue, finite, isoDate } from './cardPrimitives'

const colorFixture = {
  hex: { value: '#24b1e0' }, name: { value: 'Cerulean', exact_match_name: false, closest_named_hex: '#1DACD6' },
  rgb: { value: 'rgb(36, 177, 224)' }, hsl: { value: 'hsl(195, 75%, 51%)' },
  hsv: { value: 'hsv(195, 84%, 88%)' }, cmyk: { value: 'cmyk(84, 21, 0, 12)' },
  XYZ: { value: 'XYZ(46, 59, 92)' }, contrast: { value: '#000000' },
}
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
    render(<ColorPreview data={colorFixture}/>)
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
    expect(screen.getByText('Color unavailable')).toBeInTheDocument()
    rerender(<ColorPreview data={{}}/>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(colorModel({ name: {} }).match).toBe('Name match not specified')
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

describe('DNS diagnostic card', () => {
  it('preserves complete TXT records, wire types and zero-second TTLs as semantic text', () => {
    const full = `"v=DKIM1; p=${'A'.repeat(260)}"`
    render(<DnsPreview data={{ Status: 0, AD: false, TC: false, Question: [{ name: 'example.com.', type: 16 }], Answer: [{ name: 'example.com.', type: 16, TTL: 0, data: full }] }}/>)
    expect(screen.getByText(full)).toBeInTheDocument()
    expect(screen.getByText('TTL 0 seconds')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'DNS answer records' })).getByText('TXT · Text')).toBeInTheDocument()
    expect(screen.getByText('Not validated by resolver')).toBeInTheDocument()
  })
  it('distinguishes DNS failure from successful HTTP transport', () => {
    render(<DnsPreview data={{ Status: 3, Question: [{ name: 'missing.invalid.', type: 1 }] }}/>)
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-result-state', 'dns-error')
    expect(screen.getByText('NXDOMAIN')).toBeInTheDocument()
    expect(screen.getByText(/domain does not exist/)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
  it('distinguishes an empty NOERROR answer from malformed data and does not guess unknown record codes', () => {
    const { rerender } = render(<DnsPreview data={{ Status: 0, Question: [{ name: 'example.com.', type: 65000 }], Answer: [] }}/>)
    expect(screen.getByText('TYPE 65000')).toBeInTheDocument()
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-result-state', 'empty')
    expect(screen.getByText(/no answer records were returned/)).toBeInTheDocument()
    rerender(<DnsPreview data={{}}/>)
    expect(document.querySelector('[data-domain-card]')).toHaveAttribute('data-result-state', 'invalid')
    expect(dnsModel({}).dnssec).toBe('Not supplied')
  })
  it('exposes resolver errors and native diagnostic disclosure', () => {
    render(<DnsPreview data={{ Status: 2, TC: true, Comment: '<script>diagnostic text only</script>' }}/>)
    expect(screen.getByText('SERVFAIL')).toBeInTheDocument()
    expect(screen.getByText('Truncated by resolver')).toBeInTheDocument()
    expect(document.querySelector('details > summary')).toHaveTextContent('Resolver diagnostic')
    expect(document.querySelector('details p')).toHaveTextContent('<script>diagnostic text only</script>')
    expect(document.querySelector('script')).toBeNull()
  })
})

describe('currency conversion cards', () => {
  it('preserves supplied fiat and crypto precision and does not invent Coinbase update time', () => {
    expect(exchangeRateModel(rateFixture).rates.find((r) => r.code === 'USD')?.raw).toBe('0.789123')
    const fixture = { data: { currency: 'EUR', rates: { USD: '1.15990000', BTC: '0.000010123456' } } }
    expect(coinbaseRateModel(fixture).rates[0].raw).toBe('0.000010123456')
    render(<CoinbaseRatesPreview data={fixture}/>)
    expect(screen.getAllByText('1.15990000').length).toBeGreaterThan(0)
    expect(screen.getByText('0.000010123456')).toBeInTheDocument()
    expect(screen.getByText('Not supplied in this response')).toBeInTheDocument()
  })
  it('calculates amounts and switches targets without another fetch', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<ExchangeRateApiPreview data={rateFixture}/>)
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
    render(<ExchangeRateApiPreview data={rateFixture}/>)
    for (const value of ['', '-1', '1e308']) {
      fireEvent.change(screen.getByLabelText('Amount in SGD'), { target: { value } })
      expect(screen.getByLabelText('Converted amount')).not.toHaveAttribute('data-value')
      expect(screen.getByLabelText('Amount in SGD')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByText(/Enter a finite, non-negative amount/)).toBeInTheDocument()
    }
  })
  it('makes currencies beyond the first eight accessible through filtering and show-more', () => {
    render(<ExchangeRateApiPreview data={rateFixture}/>)
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
  it('fails closed for missing base, rejected payloads and absent valid rates', () => {
    const { rerender } = render(<ExchangeRateApiPreview data={{ rates: { MYR: 3.2 } }}/>)
    expect(screen.getByText('Exchange rates unavailable')).toBeInTheDocument()
    rerender(<ExchangeRateApiPreview data={{ ...rateFixture, result: 'error' }}/>)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    rerender(<CoinbaseRatesPreview data={{ data: { currency: 'EUR', rates: { USD: null, GBP: true, BTC: '', MYR: -1 } } }}/>)
    expect(screen.getByText('Exchange rates unavailable')).toBeInTheDocument()
  })
  it('resets local state on base-currency change and includes provider attribution', () => {
    const { rerender } = render(<ExchangeRateApiPreview data={rateFixture}/>)
    fireEvent.change(screen.getByLabelText('Amount in SGD'), { target: { value: '700' } })
    rerender(<ExchangeRateApiPreview data={{ base_code: 'USD', rates: { USD: 1, SGD: 1.2 } }}/>)
    expect(screen.getByLabelText('Amount in USD')).toHaveValue(100)
    expect(screen.getByRole('link', { name: 'Rates By Exchange Rate API' })).toHaveAttribute('href', 'https://www.exchangerate-api.com')
    expect(screen.getByText(/not a trade quote/)).toBeInTheDocument()
  })
})

describe('npm reporting-window card', () => {
  it('uses package identity, exact total, inclusive UTC window and computed average without fabricating a trend', () => {
    const fixture = { package: '@scope/package', downloads: 171637376, start: '2026-08-23', end: '2026-08-29' }
    expect(downloadsModel(fixture).days).toBe(7)
    expect(downloadsModel(fixture).average).toBeCloseTo(171637376 / 7, 6)
    render(<DownloadsPreview data={fixture}/>)
    expect(screen.getByRole('heading', { name: '@scope/package' })).toBeInTheDocument()
    expect(screen.getByText('171,637,376')).toBeInTheDocument()
    expect(document.querySelector('time[datetime="2026-08-23"]')).toBeInTheDocument()
    expect(screen.getByText(/not a daily time series/)).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeNull()
  })
  it('preserves genuine zero but rejects missing, negative and unsafe counts', () => {
    render(<DownloadsPreview data={{ package: 'empty', downloads: 0, start: '2026-09-01', end: '2026-09-01' }}/>)
    expect(document.querySelector('[data-download-count]')).toHaveAttribute('data-download-count', '0')
    expect(downloadsModel({ downloads: 0, start: '2026-09-01', end: '2026-09-01' }).days).toBe(1)
    for (const downloads of [null, undefined, -1, true, '', Number.MAX_SAFE_INTEGER + 1]) expect(downloadsModel({ downloads }).downloads).toBeUndefined()
  })
  it('does not derive an average from invalid or reversed reporting dates', () => {
    expect(downloadsModel({ downloads: 100, start: '2026-02-30', end: '2026-03-02' }).average).toBeUndefined()
    expect(downloadsModel({ downloads: 100, start: '2026-09-05', end: '2026-09-01' }).average).toBeUndefined()
    expect(isoDate('2024-02-29')).toBe('2024-02-29')
    expect(isoDate('2025-02-29')).toBeUndefined()
    for (const value of [null, true, false, '', '   ']) expect(finite(value)).toBeUndefined()
  })
})

describe('software lifecycle explorer', () => {
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
})

describe('Phase 2 API-owned SSOT integration', () => {
  const cases = [
    ['color-api', 'color-swatch', colorFixture],
    ['google-dns-doh', 'dns-records', { Status: 0, Question: [{ name: 'example.com.', type: 1 }], Answer: [{ name: 'example.com.', type: 1, TTL: 300, data: '192.0.2.1' }] }],
    ['npm-download-counts', 'download-summary', { downloads: 12, start: '2026-09-01', end: '2026-09-01', package: 'react' }],
    ['endoflife-date', 'release-lifecycle', lifecycleFixture],
    ['exchange-rate-current', 'exchange-rates', rateFixture],
    ['ecb-fx-rates', 'exchange-rates', { data: { currency: 'EUR', rates: { USD: '1.1599' } } }],
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
