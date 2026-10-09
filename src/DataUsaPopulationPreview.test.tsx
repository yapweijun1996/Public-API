import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'data-usa')
if (!api) throw new Error('Missing data-usa fixture')

const request = (url = api.buildUrl({}), method = 'GET') => ({ url, method })
const row = (stateId: string, state: string, population: unknown, year: unknown = 2023) => ({
  'State ID': stateId,
  State: state,
  Year: year,
  Population: population,
})
const response = (rows: unknown[], page: Record<string, unknown> = {}) => ({
  annotations: {
    source_description: 'The American Community Survey (ACS) is conducted by the US Census.',
    topic: 'Diversity',
    dataset_link: 'http://www.census.gov/programs-surveys/acs/',
    dataset_name: 'ACS 5-year Estimate',
    source_name: 'Census Bureau',
    subtopic: 'Demographics',
    table_id: 'B01003',
  },
  page: { limit: 8, offset: 0, total: rows.length, ...page },
  columns: ['State ID', 'State', 'Year', 'Population'],
  data: rows,
})

const canonicalRows = [
  row('04000US01', 'Alabama', 5_054_253),
  row('04000US02', 'Alaska', 733_971),
  row('04000US04', 'Arizona', 7_268_175),
]
const region = () => screen.getByRole('region', { name: 'Data USA API' })
const card = () => region().querySelector('[data-domain-card="data-usa-state-population"]')

describe('Data USA state population semantic preview', () => {
  afterEach(cleanup)

  it('binds the documented Tesseract state/year population page to the exact executed GET request', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={response(canonicalRows)}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(region()).toHaveAttribute('data-preview-layout', 'state-population')
    expect(card()).toHaveAttribute('data-result-state', 'ready')
    expect(card()).toHaveAttribute('data-request-bound', 'true')
    expect(card()).toHaveAttribute('data-request-year', '2023')
    expect(card()).toHaveAttribute('data-request-limit', '8')
    expect(card()).toHaveAttribute('data-provider-record-count', '3')
    expect(card()).toHaveAttribute('data-valid-record-count', '3')
    expect(card()).toHaveAttribute('data-pagination-contract', 'true')
    expect(card()).toHaveAttribute('data-columns-contract', 'true')
    expect(card()).toHaveAttribute('data-row-identity-contract', 'true')
    expect(region()).toHaveTextContent('Alabama')
    expect(region()).toHaveTextContent('5,054,253')
    expect(region()).not.toHaveTextContent('0.00% across this response')
  })

  it('withholds numeric-string population instead of coercing it into a trustworthy value', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={response([
      canonicalRows[0], row('04000US02', 'Alaska', '9999999'), canonicalRows[2],
    ])}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-valid-record-count', '2')
    expect(card()).toHaveAttribute('data-malformed-population-count', '1')
    expect(region()).not.toHaveTextContent('9,999,999')
  })

  it('withholds wrong-year, duplicate-state, and malformed-identity rows', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={response([
      canonicalRows[0],
      row('04000US02', 'Alaska', 733_971, 2022),
      row('04000US01', 'Duplicate Alabama', 123),
      row('bad-id', 'Arizona', 7_268_175),
    ])}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'partial')
    expect(card()).toHaveAttribute('data-valid-record-count', '1')
    expect(card()).toHaveAttribute('data-invalid-record-count', '3')
    expect(card()).toHaveAttribute('data-row-identity-contract', 'false')
    expect(region()).not.toHaveTextContent('Duplicate Alabama')
    expect(region()).not.toHaveTextContent('7,268,175')
  })

  it('fails closed for malformed pagination, columns, or an expanded executed request', async () => {
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={request()} data={response(canonicalRows, { limit: '8' })}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-pagination-contract', 'false')

    rerender(<ResponseDemoPreview api={api} executedRequest={request()} data={{ ...response(canonicalRows), columns: ['State', 'Year', 'Population'] }}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-columns-contract', 'false')

    rerender(<ResponseDemoPreview api={api} executedRequest={request(`${api.buildUrl({})}&sort=Population.desc`)} data={response(canonicalRows)}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
  })

  it('represents a documented empty first page as empty without fabricating zero population', async () => {
    render(<ResponseDemoPreview api={api} executedRequest={request()} data={response([], { total: 0 })}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())

    expect(card()).toHaveAttribute('data-result-state', 'empty')
    expect(card()).toHaveAttribute('data-valid-record-count', '0')
    expect(region()).toHaveTextContent('No state population records returned')
    expect(region()).not.toHaveTextContent('0 people')
  })

  it('fails closed for a malformed HTTP-success envelope or a non-GET execution', async () => {
    const { rerender } = render(<ResponseDemoPreview api={api} executedRequest={request()} data={{ data: canonicalRows }}/>)
    await waitFor(() => expect(card()).toBeInTheDocument())
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-envelope-contract', 'false')

    rerender(<ResponseDemoPreview api={api} executedRequest={request(api.buildUrl({}), 'POST')} data={response(canonicalRows)}/>)
    expect(card()).toHaveAttribute('data-result-state', 'invalid')
    expect(card()).toHaveAttribute('data-request-bound', 'false')
  })
})
