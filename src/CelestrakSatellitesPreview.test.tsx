import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiCatalog } from './apiCatalog'
import { ResponseDemoPreview } from './responsePreview'

const api = apiCatalog.find((candidate) => candidate.id === 'celestrak-satellites')
if (!api) throw new Error('Missing celestrak-satellites fixture')
const officialStyleIss = { OBJECT_NAME: 'ISS (ZARYA)', OBJECT_ID: '1998-067A', EPOCH: '2026-06-19T12:16:41.638656', MEAN_MOTION: 15.49315858, ECCENTRICITY: 0.00045965, INCLINATION: 51.6332, RA_OF_ASC_NODE: 288.5889, ARG_OF_PERICENTER: 205.0015, MEAN_ANOMALY: 155.0751, CLASSIFICATION_TYPE: 'U', NORAD_CAT_ID: 25544, ELEMENT_SET_NO: 999, REV_AT_EPOCH: 57211 }
const requestUrl = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json'
const exactGet = { url: requestUrl, method: 'GET' }

describe('CelesTrak GP orbital-element semantic preview', () => {
  afterEach(cleanup)
  it('labels OMM values with orbital meaning and keeps request group metadata', () => {
    render(<ResponseDemoPreview api={api} data={[officialStyleIss]} requestUrl={requestUrl} executedRequest={exactGet}/>)
    const preview = screen.getByRole('region', { name: 'CelesTrak Orbital Elements' })
    expect(preview).toHaveAttribute('data-preview-layout', 'satellite-orbits')
    const card = preview.querySelector('.celestrak-satellites-preview')
    expect(card).toHaveAttribute('data-result-state', 'ready')
    expect(card).toHaveAttribute('data-requested-group', 'stations')
    expect(card).toHaveAttribute('data-provider-record-count', '1')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '0')
    expect(card).toHaveAttribute('data-primary-norad-id', '25544')
    expect(card).toHaveAttribute('data-primary-mean-motion-rev-day', '15.49315858')
    expect(preview).toHaveTextContent('15.49315858 rev/day')
    expect(preview).toHaveTextContent('51.6332°')
    expect(preview).toHaveTextContent('0.00045965')
    expect(preview).toHaveTextContent('not real-time satellite positions')
    expect(preview).toHaveTextContent('Automated verification remains cadence-limited')
  })

  it('treats a documented empty JSON array as semantic empty', () => {
    render(<ResponseDemoPreview api={api} data={[]} requestUrl={requestUrl} executedRequest={exactGet}/>)
    const preview = screen.getByRole('region', { name: 'CelesTrak Orbital Elements' })
    expect(preview.querySelector('[data-domain-card="satellite-orbits"]')).toHaveAttribute('data-result-state', 'empty')
  })

  it('fails closed when HTTP-success data is not the documented JSON array', () => {
    render(<ResponseDemoPreview api={api} data={{ unexpected: [] }} requestUrl={requestUrl} executedRequest={exactGet}/>)
    const preview = screen.getByRole('region', { name: 'CelesTrak Orbital Elements' })
    expect(preview.querySelector('[data-domain-card="satellite-orbits"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).toHaveTextContent('documented JSON array')
  })

  it('fails closed when all GP rows lack required OMM identity or mean elements', () => {
    render(<ResponseDemoPreview api={api} data={[{ OBJECT_NAME: 'Fabricated satellite', NORAD_CAT_ID: 12345 }]} requestUrl={requestUrl} executedRequest={exactGet}/>)
    const preview = screen.getByRole('region', { name: 'CelesTrak Orbital Elements' })
    expect(preview.querySelector('[data-domain-card="satellite-orbits"]')).toHaveAttribute('data-result-state', 'invalid')
    expect(preview).not.toHaveTextContent('Fabricated satellite')
  })

  it('marks mixed valid and malformed GP rows partial and hides the malformed record', () => {
    render(<ResponseDemoPreview api={api} data={[officialStyleIss, { OBJECT_NAME: 'Fabricated satellite', NORAD_CAT_ID: 12345 }]} requestUrl={requestUrl} executedRequest={exactGet}/>)
    const preview = screen.getByRole('region', { name: 'CelesTrak Orbital Elements' })
    const card = preview.querySelector('.celestrak-satellites-preview')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-provider-record-count', '2')
    expect(card).toHaveAttribute('data-valid-record-count', '1')
    expect(card).toHaveAttribute('data-invalid-record-count', '1')
    expect(preview).toHaveTextContent('Partial GP evidence')
    expect(preview).toHaveTextContent('ISS (ZARYA)')
    expect(preview).not.toHaveTextContent('Fabricated satellite')
  })


  it('keeps a structurally coherent response partial when executed request evidence is unavailable', () => {
    render(<ResponseDemoPreview api={api} data={[officialStyleIss]} requestUrl={requestUrl}/>)
    const preview = screen.getByRole('region', { name: 'CelesTrak Orbital Elements' })
    const card = preview.querySelector('[data-domain-card="satellite-orbits"]')
    expect(card).toHaveAttribute('data-result-state', 'partial')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(card).toHaveAttribute('data-request-contract', 'exact-celestrak-gp-group-v2')
    expect(preview).toHaveTextContent('executed request evidence was unavailable')
  })

  it.each([
    ['GET with body', { url: requestUrl, method: 'GET', body: { unexpected: true } }],
    ['URL drift', { url: requestUrl.replace('stations', 'gps-ops'), method: 'GET' }],
  ])('fails closed on %s transport drift', (_label, executedRequest) => {
    render(<ResponseDemoPreview api={api} data={[officialStyleIss]} requestUrl={requestUrl} executedRequest={executedRequest}/>)
    const preview = screen.getByRole('region', { name: 'CelesTrak Orbital Elements' })
    const card = preview.querySelector('[data-domain-card="satellite-orbits"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
    expect(preview).not.toHaveTextContent('ISS (ZARYA)')
  })

  it('fails closed when a successful payload is tied to a POST instead of the exact bodyless GET', () => {
    render(<ResponseDemoPreview api={api} data={[officialStyleIss]} requestUrl={requestUrl} executedRequest={{ url: requestUrl, method: 'POST' }}/>)
    const preview = screen.getByRole('region', { name: 'CelesTrak Orbital Elements' })
    const card = preview.querySelector('[data-domain-card="satellite-orbits"]')
    expect(card).toHaveAttribute('data-result-state', 'invalid')
    expect(card).toHaveAttribute('data-request-bound', 'false')
  })

})
