import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { NvdCveDetailPreview } from './previews/NvdCveDetailPreview'
import type { ExecutedRequestContext } from './useApiRequestRuntime'

const requestUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2024-3094'
const executedRequest: ExecutedRequestContext = { url: requestUrl, method: 'GET' }
const response = {
  resultsPerPage: 1,
  startIndex: 0,
  totalResults: 1,
  format: 'NVD_CVE',
  version: '2.0',
  timestamp: '2026-09-14T08:40:01.048',
  vulnerabilities: [{
    cve: {
      id: 'CVE-2024-3094',
      sourceIdentifier: 'secalert@redhat.com',
      published: '2024-03-29T17:15:25.123',
      lastModified: '2026-06-17T17:15:24.893',
      vulnStatus: 'Modified',
      descriptions: [
        { lang: 'en', value: 'Malicious code was discovered in the upstream xz release tarballs.' },
        { lang: 'es', value: 'Se descubrió código malicioso en xz.' },
      ],
      metrics: {
        cvssMetricV31: [{
          source: 'secalert@redhat.com',
          type: 'Secondary',
          exploitabilityScore: 3.9,
          impactScore: 6,
          cvssData: {
            version: '3.1',
            vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H',
            baseScore: 10,
            baseSeverity: 'CRITICAL',
          },
        }],
      },
      weaknesses: [{ source: 'secalert@redhat.com', type: 'Secondary', description: [{ lang: 'en', value: 'CWE-506' }] }],
      configurations: [{ nodes: [] }],
      references: [{ url: 'https://access.redhat.com/security/cve/CVE-2024-3094', source: 'secalert@redhat.com' }],
    },
  }],
}
const malformedCvssCases: Array<[string, Record<string, unknown>]> = [
  ['a malformed vector', { vectorString: 'CVSS:3.1/garbage' }],
  ['a CVSS v3.1 vector missing a required Base metric', { vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H' }],
  ['a CVSS v3.1 vector with a duplicate metric', { vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H/AV:N' }],
  ['missing schema-required severity', { baseSeverity: undefined }],
  ['a score/severity mismatch in CVSS v3.1', { baseSeverity: 'LOW' }],
  ['a score/severity mismatch in CVSS v4', {
    version: '4.0',
    vectorString: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N',
    baseScore: 10,
    baseSeverity: 'LOW',
  }],
]

describe('NVD CVE detail semantic card', () => {
  afterEach(cleanup)

  it('binds a valid NVD envelope and CVE record to the exact executed request', () => {
    render(<NvdCveDetailPreview data={response} executedRequest={executedRequest}/>)

    const card = screen.getByText('CVE-2024-3094').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-domain-card', 'nvd-cve-detail')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-requested-cve', 'CVE-2024-3094')
    expect(card).toHaveAttribute('data-provider-cve', 'CVE-2024-3094')
    expect(card).toHaveAttribute('data-identity-match', 'true')
    expect(card).toHaveAttribute('data-envelope-contract-valid', 'true')
    expect(card).toHaveAttribute('data-core-contract-valid', 'true')
    expect(card).toHaveAttribute('data-contract-valid', 'true')
    expect(card).toHaveAttribute('data-cvss-version', '3.1')
    expect(card).toHaveAttribute('data-cvss-base-score', '10')
    expect(screen.getByText(/Malicious code was discovered/)).toBeInTheDocument()
    expect(screen.getByText('10 · Critical')).toBeInTheDocument()
    expect(screen.getByText('Secondary · secalert@redhat.com')).toBeInTheDocument()
    expect(screen.getByText('2024-03-29')).toBeInTheDocument()
  })

  it.each([
    ['POST', { url: requestUrl, method: 'POST' }],
    ['GET with a body', { url: requestUrl, method: 'GET', body: { unexpected: true } }],
  ] as const)('fails closed when the canonical URL was executed as %s', (_caseName, transport) => {
    render(<NvdCveDetailPreview data={response} executedRequest={transport}/>)

    const card = screen.getByText('Invalid NVD CVE response').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-valid', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(screen.queryByText(/Malicious code was discovered/)).not.toBeInTheDocument()
    expect(screen.queryByText('10 · Critical')).not.toBeInTheDocument()
  })

  it('fails closed on a wrong provider CVE and hides plausible vulnerability details', () => {
    const wrong = structuredClone(response)
    wrong.vulnerabilities[0].cve.id = 'CVE-2021-44228'
    render(<NvdCveDetailPreview data={wrong} executedRequest={executedRequest}/>)

    const card = screen.getByText('NVD CVE identity mismatch').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-requested-cve', 'CVE-2024-3094')
    expect(card).toHaveAttribute('data-provider-cve', 'CVE-2021-44228')
    expect(card).toHaveAttribute('data-identity-match', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(screen.queryByText(/Malicious code was discovered/)).not.toBeInTheDocument()
    expect(screen.queryByText('10 · Critical')).not.toBeInTheDocument()
  })

  it('fails closed on malformed envelope counters instead of coercing numeric strings', () => {
    render(<NvdCveDetailPreview data={{ ...response, totalResults: '1' }} executedRequest={executedRequest}/>)

    const card = screen.getByText('Invalid NVD CVE response').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-envelope-contract-valid', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(screen.queryByText(/Malicious code was discovered/)).not.toBeInTheDocument()
  })

  it('fails closed on a malformed required CVE core field', () => {
    const malformed = structuredClone(response)
    malformed.vulnerabilities[0].cve.descriptions = 'plausible description' as unknown as typeof response.vulnerabilities[0]['cve']['descriptions']
    render(<NvdCveDetailPreview data={malformed} executedRequest={executedRequest}/>)

    const card = screen.getByText('Invalid NVD CVE response').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-envelope-contract-valid', 'true')
    expect(card).toHaveAttribute('data-core-contract-valid', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(screen.queryByText('plausible description')).not.toBeInTheDocument()
  })

  it('fails closed when the schema-required descriptions array is empty', () => {
    const emptyDescriptions = structuredClone(response)
    emptyDescriptions.vulnerabilities[0].cve.descriptions = []
    render(<NvdCveDetailPreview data={emptyDescriptions} executedRequest={executedRequest}/>)

    const card = screen.getByText('Invalid NVD CVE response').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-core-contract-valid', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
  })

  it('marks a valid core record partial and withholds a numeric-string CVSS score', () => {
    const numericString = structuredClone(response)
    numericString.vulnerabilities[0].cve.metrics.cvssMetricV31[0].cvssData.baseScore = '10' as unknown as number
    render(<NvdCveDetailPreview data={numericString} executedRequest={executedRequest}/>)

    const card = screen.getByText('CVE-2024-3094').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-core-contract-valid', 'true')
    expect(card).toHaveAttribute('data-metric-contract-valid', 'false')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(card).not.toHaveAttribute('data-cvss-base-score')
    expect(screen.getByText('CVSS metrics were present but malformed; score details are withheld.')).toBeInTheDocument()
    expect(screen.queryByText('10 · Critical')).not.toBeInTheDocument()
  })

  it.each(malformedCvssCases)('withholds CVSS details when the provider returns %s', (_caseName, cvssDataPatch) => {
    const malformed = structuredClone(response)
    const cvssData: Record<string, unknown> = {
      ...malformed.vulnerabilities[0].cve.metrics.cvssMetricV31[0].cvssData,
      ...cvssDataPatch,
    }
    if (Object.hasOwn(cvssDataPatch, 'baseSeverity') && cvssDataPatch.baseSeverity === undefined) delete cvssData.baseSeverity
    malformed.vulnerabilities[0].cve.metrics.cvssMetricV31[0].cvssData = cvssData as unknown as typeof response.vulnerabilities[0]['cve']['metrics']['cvssMetricV31'][0]['cvssData']
    if (cvssDataPatch.version === '4.0') {
      malformed.vulnerabilities[0].cve.metrics = {
        cvssMetricV40: malformed.vulnerabilities[0].cve.metrics.cvssMetricV31,
      } as unknown as typeof response.vulnerabilities[0]['cve']['metrics']
    }
    render(<NvdCveDetailPreview data={malformed} executedRequest={executedRequest}/>)

    const card = screen.getByText('CVE-2024-3094').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-metric-contract-valid', 'false')
    expect(card).not.toHaveAttribute('data-cvss-base-score')
    expect(screen.queryByText(/10 · (Critical|Low)/)).not.toBeInTheDocument()
  })

  it('renders a contract-valid empty state for an exact CVE lookup with zero results', () => {
    render(<NvdCveDetailPreview data={{
      ...response,
      resultsPerPage: 0,
      totalResults: 0,
      vulnerabilities: [],
    }} executedRequest={executedRequest}/>)

    const card = screen.getByText('No NVD CVE record found').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-requested-cve', 'CVE-2024-3094')
    expect(card).toHaveAttribute('data-envelope-contract-valid', 'true')
    expect(card).toHaveAttribute('data-contract-valid', 'true')
  })

  it('accepts the NVD CVSS v2 vector contract without a v3-style prefix', () => {
    const cvssV2 = structuredClone(response)
    cvssV2.vulnerabilities[0].cve.metrics = { cvssMetricV2: [{
      source: 'nvd@nist.gov',
      type: 'Primary',
      baseSeverity: 'HIGH',
      exploitabilityScore: 8.6,
      impactScore: 6.4,
      cvssData: {
        version: '2.0',
        vectorString: 'AV:N/AC:M/Au:N/C:P/I:P/A:P/E:F/RL:OF/RC:C',
        baseScore: 7.5,
      },
    }] } as unknown as typeof response.vulnerabilities[0]['cve']['metrics']
    render(<NvdCveDetailPreview data={cvssV2} executedRequest={executedRequest}/>)

    const card = screen.getByText('CVE-2024-3094').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-cvss-version', '2.0')
    expect(card).toHaveAttribute('data-cvss-base-score', '7.5')
    expect(screen.getByText('7.5 · High')).toBeInTheDocument()
    expect(screen.getByText('AV:N/AC:M/Au:N/C:P/I:P/A:P/E:F/RL:OF/RC:C')).toBeInTheDocument()
  })

  it('withholds a CVSS v2 metric when a required Base metric is missing', () => {
    const incompleteCvssV2 = structuredClone(response)
    incompleteCvssV2.vulnerabilities[0].cve.metrics = { cvssMetricV2: [{
      source: 'nvd@nist.gov',
      type: 'Primary',
      baseSeverity: 'HIGH',
      exploitabilityScore: 8.6,
      impactScore: 6.4,
      cvssData: {
        version: '2.0',
        vectorString: 'AV:N/AC:M/Au:N/C:P/I:P',
        baseScore: 7.5,
      },
    }] } as unknown as typeof response.vulnerabilities[0]['cve']['metrics']
    render(<NvdCveDetailPreview data={incompleteCvssV2} executedRequest={executedRequest}/>)

    const card = screen.getByText('CVE-2024-3094').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-metric-contract-valid', 'false')
    expect(card).not.toHaveAttribute('data-cvss-base-score')
    expect(screen.queryByText('7.5 · High')).not.toBeInTheDocument()
  })

  it('rejects the non-standard PR:U value in a CVSS v3.0 vector', () => {
    const invalidCvssV30 = structuredClone(response)
    invalidCvssV30.vulnerabilities[0].cve.metrics = { cvssMetricV30: [{
      source: 'nvd@nist.gov',
      type: 'Primary',
      exploitabilityScore: 3.9,
      impactScore: 6,
      cvssData: {
        version: '3.0',
        vectorString: 'CVSS:3.0/AV:N/AC:L/PR:U/UI:N/S:C/C:H/I:H/A:H',
        baseScore: 10,
        baseSeverity: 'CRITICAL',
      },
    }] } as unknown as typeof response.vulnerabilities[0]['cve']['metrics']
    render(<NvdCveDetailPreview data={invalidCvssV30} executedRequest={executedRequest}/>)

    const card = screen.getByText('CVE-2024-3094').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-metric-contract-valid', 'false')
    expect(card).not.toHaveAttribute('data-cvss-base-score')
  })

  it('marks malformed optional NVD entry arrays partial and withholds their counts', () => {
    const malformedWeaknesses = structuredClone(response)
    malformedWeaknesses.vulnerabilities[0].cve.weaknesses = ['not-a-weakness-object'] as unknown as typeof response.vulnerabilities[0]['cve']['weaknesses']
    render(<NvdCveDetailPreview data={malformedWeaknesses} executedRequest={executedRequest}/>)

    const card = screen.getByText('CVE-2024-3094').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(screen.getByText('One or more optional NVD fields were malformed and are withheld.')).toBeInTheDocument()
    expect(screen.getByText('Weakness groups').nextElementSibling).toHaveTextContent('Not supplied')
  })

  it('keeps a valid provider record partial when executed-request identity is unavailable', () => {
    render(<NvdCveDetailPreview data={response}/>)

    const card = screen.getByText('CVE-2024-3094').closest('[data-domain-card]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-identity-match', 'unknown')
    expect(card).toHaveAttribute('data-contract-valid', 'false')
    expect(screen.getByText(/executed-request identity is unavailable/)).toBeInTheDocument()
  })
})
