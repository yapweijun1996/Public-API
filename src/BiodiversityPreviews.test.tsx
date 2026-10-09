import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const byId = (id: string) => {
  const api = apiCatalog.find((candidate) => candidate.id === id)
  if (!api) throw new Error(`Missing ${id} fixture`)
  return api
}

describe('biodiversity semantic previews', () => {
  afterEach(cleanup)

  it('keeps OBIS occurrence status, provenance, coordinates, and provider QC flags attached to the record', () => {
    const api = byId('obis-marine-occurrences')
    const requestUrl = api.buildUrl({ scientificName: 'Delphinus delphis', size: '5' })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{
      total: 121574,
      results: [{
        scientificName: 'Delphinus delphis', originalScientificName: 'Delphinus delphis', occurrenceID: '1406_14803', eventDate: '2000-02-19', occurrenceStatus: 'present', basisOfRecord: 'HumanObservation',
        decimalLatitude: 49.18, decimalLongitude: -1.601, datasetName: 'French stranding network', scientificNameID: 'urn:lsid:marinespecies.org:taxname:137094', aphiaID: 137094, flags: ['NO_DEPTH', 'ON_LAND'], license: 'https://creativecommons.org/licenses/by-nc/4.0/',
      }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'OBIS Marine Occurrences' })
    expect(preview).toHaveAttribute('data-preview-layout', 'marine-occurrences')
    const card = preview.querySelector('.obis-occurrence-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-obis-occurrence-v2')
    expect(card).toHaveAttribute('data-requested-scientific-name', 'Delphinus delphis')
    expect(card).toHaveAttribute('data-provider-total', '121574')
    expect(card).toHaveAttribute('data-primary-occurrence-id', '1406_14803')
    expect(card).toHaveAttribute('data-primary-occurrence-status', 'present')
    expect(card).toHaveAttribute('data-primary-basis-of-record', 'HumanObservation')
    expect(card).toHaveAttribute('data-primary-quality-flags', 'NO_DEPTH,ON_LAND')
    expect(preview).toHaveTextContent('French stranding network')
    expect(preview).toHaveTextContent('49.18, -1.601')
    expect(preview).toHaveTextContent('NO_DEPTH')
    expect(preview).toHaveTextContent('ON_LAND')
    expect(preview).not.toHaveTextContent('OBIS Marine Occurrences record 1')
  })

  it('does not claim an OBIS result is request-bound when executed transport evidence is missing or contradictory', () => {
    const api = byId('obis-marine-occurrences')
    const requestUrl = api.buildUrl({ scientificName: 'Delphinus delphis', size: '5' })
    const payload = { total: 1, results: [{ occurrenceID: 'obis-valid-1', scientificName: 'Delphinus delphis', occurrenceStatus: 'present' }] }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={payload}/>)
    let card = screen.getByRole('region', { name: 'OBIS Marine Occurrences' }).querySelector('.obis-occurrence-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={payload}/>)
    card = screen.getByRole('region', { name: 'OBIS Marine Occurrences' }).querySelector('[data-domain-card="marine-occurrences"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    card = screen.getByRole('region', { name: 'OBIS Marine Occurrences' }).querySelector('[data-domain-card="marine-occurrences"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: `${requestUrl}&absence=true`, method: 'GET' }} data={payload}/>)
    card = screen.getByRole('region', { name: 'OBIS Marine Occurrences' }).querySelector('[data-domain-card="marine-occurrences"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('distinguishes OBIS empty, malformed, and partial occurrence responses without inventing identity', () => {
    const api = byId('obis-marine-occurrences')
    const requestUrl = api.buildUrl({ scientificName: 'Delphinus delphis', size: '5' })
    const executedRequest = { url: requestUrl, method: 'GET' }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={{ total: 0, results: [] }} />)
    expect(screen.getByRole('region', { name: 'OBIS Marine Occurrences' }).querySelector('[data-domain-card="marine-occurrences"]')).toHaveAttribute('data-result-state', 'empty')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={{ total: 0 }} />)
    expect(screen.getByRole('region', { name: 'OBIS Marine Occurrences' }).querySelector('[data-domain-card="marine-occurrences"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={{ total: 2, results: [
      { occurrenceID: 'obis-valid-1', scientificName: 'Delphinus delphis', occurrenceStatus: 'present' },
      { scientificName: 'Delphinus delphis' },
    ] }} />)
    const card = screen.getByRole('region', { name: 'OBIS Marine Occurrences' }).querySelector('.obis-occurrence-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveAttribute('data-count-contract-valid', 'true')
    expect(card).toHaveTextContent('incomplete or malformed')
    expect(card).not.toHaveTextContent('Occurrence ID not supplied')
  })

  it('fails closed when the executed OBIS request expands beyond the admitted scientific-name and size contract', () => {
    const api = byId('obis-marine-occurrences')
    render(<ResponseDemoPreview api={api} requestUrl="https://api.obis.org/v3/occurrence?scientificname=Delphinus+delphis&size=5&absence=true" data={{
      total: 1,
      results: [{ occurrenceID: 'obis-valid-1', scientificName: 'Delphinus delphis', occurrenceStatus: 'present' }],
    }}/>)
    const card = screen.getByRole('region', { name: 'OBIS Marine Occurrences' }).querySelector('[data-domain-card="marine-occurrences"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
      })

  it('does not coerce numeric-string OBIS totals into trustworthy pagination evidence', () => {
    const api = byId('obis-marine-occurrences')
    const requestUrl = api.buildUrl({ scientificName: 'Delphinus delphis', size: '5' })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{
      total: '1',
      results: [{ occurrenceID: 'obis-valid-1', scientificName: 'Delphinus delphis', occurrenceStatus: 'present' }],
    }}/>)
    const card = screen.getByRole('region', { name: 'OBIS Marine Occurrences' }).querySelector('.obis-occurrence-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-count-contract-valid', 'false')
  })

  it('marks OBIS responses larger than the executed size partial instead of false-ready', () => {
    const api = byId('obis-marine-occurrences')
    const requestUrl = api.buildUrl({ scientificName: 'Delphinus delphis', size: '1' })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{
      total: 2,
      results: [
        { occurrenceID: 'obis-valid-1', scientificName: 'Delphinus delphis', occurrenceStatus: 'present' },
        { occurrenceID: 'obis-valid-2', scientificName: 'Delphinus delphis', occurrenceStatus: 'present' },
      ],
    }}/>)
    const card = screen.getByRole('region', { name: 'OBIS Marine Occurrences' }).querySelector('.obis-occurrence-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-row-limit-contract-valid', 'false')
  })

  it('preserves WoRMS unaccepted-name resolution to the current accepted name', () => {
    const api = byId('worms-species-lookup')
    const requestUrl = api.buildUrl({ name: 'Manta birostris' })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={[{
      AphiaID: 105857, scientificname: 'Manta birostris', authority: '(Walbaum, 1792)', status: 'unaccepted', rank: 'Species', valid_AphiaID: 1026118, valid_name: 'Mobula birostris', valid_authority: '(Walbaum, 1792)',
      kingdom: 'Animalia', phylum: 'Chordata', class: 'Elasmobranchii', order: 'Myliobatiformes', family: 'Mobulidae', genus: 'Manta', lsid: 'urn:lsid:marinespecies.org:taxname:105857', isMarine: 1, isBrackish: 0, isFreshwater: 0, isTerrestrial: 0, isExtinct: null,
    }]}/>)
    const preview = screen.getByRole('region', { name: 'WoRMS Marine Species Registry' })
    expect(preview).toHaveAttribute('data-preview-layout', 'marine-taxonomy')
    const card = preview.querySelector('.worms-species-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-worms-aphia-records-by-name-v2')
    expect(card).toHaveAttribute('data-requested-scientific-name', 'Manta birostris')
    expect(card).toHaveAttribute('data-primary-status', 'unaccepted')
    expect(card).toHaveAttribute('data-primary-aphia-id', '105857')
    expect(card).toHaveAttribute('data-primary-valid-aphia-id', '1026118')
    expect(card).toHaveAttribute('data-primary-valid-name', 'Mobula birostris')
    expect(preview).toHaveTextContent('Manta birostris → Mobula birostris')
    expect(preview).toHaveTextContent('Current accepted name')
    expect(preview).toHaveTextContent('Animalia › Chordata › Elasmobranchii › Myliobatiformes › Mobulidae › Manta')
    expect(preview).toHaveTextContent('ExtinctNot supplied')
    expect(preview).not.toHaveTextContent('WoRMS Marine Species Registry record 1')
  })

  it('fails closed when the successful WoRMS response transport is not the exact bodyless GET request', () => {
    const api = byId('worms-species-lookup')
    const requestUrl = api.buildUrl({ name: 'Manta birostris' })
    const payload = [{ AphiaID: 105857, scientificname: 'Manta birostris', status: 'unaccepted', valid_AphiaID: 1026118, valid_name: 'Mobula birostris' }]
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={payload}/>)
    let card = screen.getByRole('region', { name: 'WoRMS Marine Species Registry' }).querySelector('.worms-species-preview')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).not.toHaveTextContent('Mobula birostris')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    card = screen.getByRole('region', { name: 'WoRMS Marine Species Registry' }).querySelector('.worms-species-preview')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: `${requestUrl}&marine_only=true`, method: 'GET' }} data={payload}/>)
    card = screen.getByRole('region', { name: 'WoRMS Marine Species Registry' }).querySelector('.worms-species-preview')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

  it('keeps coherent WoRMS evidence partial when executed request evidence is unavailable', () => {
    const api = byId('worms-species-lookup')
    const requestUrl = api.buildUrl({ name: 'Manta birostris' })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={[{ AphiaID: 105857, scientificname: 'Manta birostris', status: 'unaccepted', valid_AphiaID: 1026118, valid_name: 'Mobula birostris' }]}/>)
    const card = screen.getByRole('region', { name: 'WoRMS Marine Species Registry' }).querySelector('.worms-species-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveTextContent(/executed request evidence was unavailable/i)
  })

  it('distinguishes request-bound WoRMS empty, malformed, and partial AphiaRecord responses', () => {
    const api = byId('worms-species-lookup')
    const requestUrl = api.buildUrl({ name: 'Manta birostris' })
    const executedRequest = { url: requestUrl, method: 'GET' }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={[]} />)
    let card = screen.getByRole('region', { name: 'WoRMS Marine Species Registry' }).querySelector('[data-domain-card="marine-taxonomy"]')
    expect(card).toHaveAttribute('data-result-state', 'empty')
    expect(card).toHaveAttribute('data-request-bound', 'true')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={{}} />)
    card = screen.getByRole('region', { name: 'WoRMS Marine Species Registry' }).querySelector('[data-domain-card="marine-taxonomy"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'true')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={[{ AphiaID: 105857, scientificname: 'Manta birostris', status: 'unaccepted' }, { AphiaID: 999 }]} />)
    card = screen.getByRole('region', { name: 'WoRMS Marine Species Registry' }).querySelector('.worms-species-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveTextContent('omitted 1 malformed AphiaRecord')
  })

  it('labels PBDB n_occs as the fossil count for the taxon plus subtaxa', () => {
    const api = byId('paleobiodb-taxa')
    const requestUrl = api.buildUrl({ name: 'Tyrannosaurus' })
    render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET' }} data={{
      elapsed_time: 0.005,
      records: [{ orig_no: '38613', taxon_no: '38613', taxon_rank: 'genus', taxon_name: 'Tyrannosaurus', accepted_no: '38613', accepted_rank: 'genus', accepted_name: 'Tyrannosaurus', parent_no: '92294', reference_no: '9259', is_extant: 'extinct', n_occs: 87 }],
    }}/>)
    const preview = screen.getByRole('region', { name: 'Paleobiology Database Taxa' })
    expect(preview).toHaveAttribute('data-preview-layout', 'fossil-taxon')
    const card = preview.querySelector('.paleobiodb-taxon-preview')
    expect(card).toHaveAttribute('data-request-bound', 'true')
    expect(card).toHaveAttribute('data-request-contract', 'exact-paleobiodb-taxa-list-v2')
    expect(card).toHaveAttribute('data-requested-taxon-name', 'Tyrannosaurus')
    expect(card).toHaveAttribute('data-primary-taxon-no', '38613')
    expect(card).toHaveAttribute('data-primary-extancy', 'extinct')
    expect(card).toHaveAttribute('data-primary-fossil-occurrence-count', '87')
    expect(preview).toHaveTextContent('Fossil occurrences · taxon + subtaxa87')
    expect(preview).toHaveTextContent('not a direct-only occurrence count')
    expect(preview).not.toHaveTextContent('Paleobiology Database Taxa record 1')
  })


  it('does not claim a PBDB result is request-bound when executed transport evidence is missing or contradictory', () => {
    const api = byId('paleobiodb-taxa')
    const requestUrl = api.buildUrl({ name: 'Tyrannosaurus' })
    const payload = { elapsed_time: 0.005, records: [{ taxon_no: '38613', taxon_name: 'Tyrannosaurus', taxon_rank: 'genus' }] }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} data={payload}/>)
    let card = screen.getByRole('region', { name: 'Paleobiology Database Taxa' }).querySelector('.paleobiodb-taxon-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }} data={payload}/>)
    card = screen.getByRole('region', { name: 'Paleobiology Database Taxa' }).querySelector('[data-domain-card="fossil-taxon"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'GET', body: { unexpected: true } }} data={payload}/>)
    card = screen.getByRole('region', { name: 'Paleobiology Database Taxa' }).querySelector('[data-domain-card="fossil-taxon"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={{ url: api.buildUrl({ name: 'Triceratops' }), method: 'GET' }} data={payload}/>)
    card = screen.getByRole('region', { name: 'Paleobiology Database Taxa' }).querySelector('[data-domain-card="fossil-taxon"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')

    for (const driftedUrl of [
      `${requestUrl}&limit=1`,
      `${requestUrl}&name=Triceratops`,
      `${requestUrl}#drift`,
      requestUrl.replace('/taxa/list.json', '/taxa/list.txt'),
      requestUrl.replace('https://paleobiodb.org', 'https://paleobiodb.org:444'),
      requestUrl.replace('https://paleobiodb.org', 'https://user@paleobiodb.org'),
    ]) {
      rerender(<ResponseDemoPreview api={api} requestUrl={driftedUrl} executedRequest={{ url: driftedUrl, method: 'GET' }} data={payload}/>)
      card = screen.getByRole('region', { name: 'Paleobiology Database Taxa' }).querySelector('[data-domain-card="fossil-taxon"]')
      expect(card).toHaveAttribute('data-result-state', 'invalid')
      expect(card).toHaveAttribute('data-request-bound', 'false')
    }
  })

  it('distinguishes PBDB empty, malformed, and partial taxon responses without inventing identity', () => {
    const api = byId('paleobiodb-taxa')
    const requestUrl = api.buildUrl({ name: 'Tyrannosaurus' })
    const executedRequest = { url: requestUrl, method: 'GET' }
    const { rerender } = render(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={{ elapsed_time: 0.001, records: [] }} />)
    expect(screen.getByRole('region', { name: 'Paleobiology Database Taxa' }).querySelector('[data-domain-card="fossil-taxon"]')).toHaveAttribute('data-result-state', 'empty')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={{ elapsed_time: 0.001 }} />)
    expect(screen.getByRole('region', { name: 'Paleobiology Database Taxa' }).querySelector('[data-domain-card="fossil-taxon"]')).toHaveAttribute('data-result-state', 'invalid')

    rerender(<ResponseDemoPreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} data={{ elapsed_time: 0.001, records: [
      { taxon_no: '38613', taxon_name: 'Tyrannosaurus', taxon_rank: 'genus' },
      { taxon_name: 'Identity-less fossil taxon' },
    ] }} />)
    const card = screen.getByRole('region', { name: 'Paleobiology Database Taxa' }).querySelector('.paleobiodb-taxon-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(card).toHaveTextContent('incomplete or malformed')
    expect(card).not.toHaveTextContent('Identity-less fossil taxon')
    expect(card).not.toHaveTextContent('Taxon ID not supplied')
  })
})
