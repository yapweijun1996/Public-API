import { describe, expect, it } from 'vitest'
import { apiCatalog, getAgentExecutionPolicy, getApiById, getAutomatedVerificationPolicy, getDefaultParameters, matchesApiSearch, validateParameters } from './apiCatalog'
import { previewProfileIds, previewProfiles } from './previewProfiles'
import phase2DocSource from '../docs/ssot-card-ux-phase-2.md?raw'

describe('API catalog', () => {
  it('has unique IDs and builds valid HTTPS URLs from defaults', () => {
    expect(new Set(apiCatalog.map((api) => api.id)).size).toBe(apiCatalog.length)

    for (const api of apiCatalog) {
      const url = new URL(api.buildUrl(getDefaultParameters(api)))
      expect(url.protocol).toBe('https:')
    }
  })

  it('keeps data.gov.sg taxi availability fixed to the documented latest-snapshot request', () => {
    const taxi = getApiById('data-gov-taxi')
    expect(taxi).toBeDefined()
    if (!taxi) return
    expect(taxi.fields).toEqual([])
    expect(taxi.buildUrl({})).toBe('https://api.data.gov.sg/v1/transport/taxi-availability')
    expect(taxi.documentationUrl).toBe('https://data.gov.sg/collections/352/datasets/d_e25662f1a062dd046453926aa284ba64/view')
    expect(taxi.usageNote).toContain('at most once per minute')
    expect(taxi.usageNote).toContain('acquisition time')
    expect(taxi.usageNote).toContain('not a per-taxi observation time')
  })

  it('keeps numeric step constraints positive and aligned with their defaults', () => {
    for (const api of apiCatalog) {
      for (const field of api.fields.filter((candidate) => candidate.step !== undefined)) {
        expect(field.type, `${api.id}.${field.id} step requires a numeric field`).toBe('number')
        expect(Number.isFinite(field.step) && field.step! > 0, `${api.id}.${field.id} step must be finite and positive`).toBe(true)
        const numericDefault = Number(field.defaultValue)
        const stepOffset = (numericDefault - (field.min ?? 0)) / field.step!
        expect(Number.isFinite(numericDefault), `${api.id}.${field.id} default must be numeric`).toBe(true)
        expect(Math.abs(stepOffset - Math.round(stepOffset)), `${api.id}.${field.id} default must align with step`).toBeLessThanOrEqual(1e-9)
      }
    }
  })

  it('keeps JSONPlaceholder post identity integer-valued without silently truncating invalid input', () => {
    const posts = getApiById('posts')
    expect(posts).toBeDefined()
    if (!posts) return

    expect(posts.fields.find((field) => field.id === 'postId')).toMatchObject({
      type: 'number',
      min: 1,
      max: 100,
      step: 1,
    })
    expect(validateParameters(posts, { postId: '7.5' })).toEqual({
      postId: 'Post ID must use increments of 1.',
    })
    expect(posts.buildUrl({ postId: '7.5' })).toBe('https://jsonplaceholder.typicode.com/posts/7.5')
    expect(posts.buildUrl({ postId: '101' })).toBe('https://jsonplaceholder.typicode.com/posts/101')
    expect(posts.buildUrl({ postId: '' })).toBe('https://jsonplaceholder.typicode.com/posts/')
  })

  it('keeps Stack Exchange tags and page-size intent exact for shared validation', () => {
    const stackExchange = getApiById('stack-exchange')
    expect(stackExchange).toBeDefined()
    if (!stackExchange) return

    expect(stackExchange.fields.find((field) => field.id === 'tags')).toMatchObject({
      type: 'text',
      minLength: 1,
      maxLength: 200,
      pattern: '[^;]+(?:;[^;]+){0,4}',
    })
    expect(stackExchange.fields.find((field) => field.id === 'limit')).toMatchObject({
      type: 'number',
      min: 1,
      max: 20,
      step: 1,
    })
    expect(validateParameters(stackExchange, { tags: '   ', limit: '8' })).toHaveProperty('tags')
    expect(validateParameters(stackExchange, { tags: 'javascript', limit: '8.5' })).toEqual({
      limit: 'Questions must use increments of 1.',
    })

    const malformed = new URL(stackExchange.buildUrl({ tags: '   ', limit: '8.5' }))
    expect(malformed.searchParams.get('tagged')).toBe('')
    expect(malformed.searchParams.get('pagesize')).toBe('8.5')

    const valid = new URL(stackExchange.buildUrl({ tags: ' javascript;reactjs ', limit: '8' }))
    expect(valid.searchParams.get('tagged')).toBe('javascript;reactjs')
    expect(valid.searchParams.get('pagesize')).toBe('8')
  })

  it('keeps zero-valued numeric inputs valid and exposes only supported AlAdhan built-in method IDs', () => {
    const aladhan = getApiById('aladhan-prayer-times')
    expect(aladhan).toBeDefined()
    if (!aladhan) return

    const method = aladhan.fields.find((field) => field.id === 'method')
    expect(method?.type).toBe('select')
    expect(method?.options?.some((option) => option.value === '0')).toBe(true)
    expect(method?.options?.some((option) => option.value === '6')).toBe(false)
    expect(method?.options?.some((option) => option.value === '99')).toBe(false)

    const defaults = getDefaultParameters(aladhan)
    const jafari = new URL(aladhan.buildUrl({ ...defaults, method: '0' }))
    expect(jafari.searchParams.get('method')).toBe('0')
    expect(validateParameters(aladhan, { ...defaults, method: '0' })).toEqual({})
    expect(validateParameters(aladhan, { ...defaults, method: '6' })).toEqual({
      method: 'Calculation method must be one of the supported options.',
    })
  })


  it('uses native ISO date fields for Bank of Canada and rejects compact dates that the provider does not accept', () => {
    const bank = getApiById('bank-of-canada-valet')
    expect(bank).toBeDefined()
    if (!bank) return

    const defaults = getDefaultParameters(bank)
    const series = bank.fields.find((field) => field.id === 'series')
    const startDate = bank.fields.find((field) => field.id === 'startDate')
    const endDate = bank.fields.find((field) => field.id === 'endDate')
    expect(series).toMatchObject({
      minLength: 1,
      pattern: '[A-Za-z0-9_.-]+',
      patternDescription: 'must be one Bank of Canada series code using only letters, digits, underscores, periods, or hyphens.',
    })
    expect(startDate?.type).toBe('date')
    expect(endDate?.type).toBe('date')
    expect(startDate?.defaultValue).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(endDate?.defaultValue).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(validateParameters(bank, { ...defaults, startDate: '20260901' })).toEqual({
      startDate: 'Start date must be a valid date in YYYY-MM-DD format.',
    })
    expect(validateParameters(bank, { ...defaults, series: 'FXUSDCAD,FXEURCAD' })).toEqual({
      series: 'Series must be one Bank of Canada series code using only letters, digits, underscores, periods, or hyphens.',
    })

    const url = new URL(bank.buildUrl({ ...defaults, startDate: '2026-08-03', endDate: '2026-08-07' }))
    expect(url.searchParams.get('start_date')).toBe('2026-08-03')
    expect(url.searchParams.get('end_date')).toBe('2026-08-07')

    const malformedUrl = new URL(bank.buildUrl({
      ...defaults,
      series: 'FXUSDCAD,FXEURCAD',
      startDate: '2025-02-30',
      endDate: 'not-a-date',
    }))
    expect(decodeURIComponent(malformedUrl.pathname)).toBe('/valet/observations/FXUSDCAD,FXEURCAD/json')
    expect(malformedUrl.searchParams.get('start_date')).toBe('2025-02-30')
    expect(malformedUrl.searchParams.get('end_date')).toBe('not-a-date')
  })

  it('uses one ISO date SSOT for historical climate inputs and converts only at provider boundaries', () => {
    const openMeteo = getApiById('open-meteo-history')
    const nasaPower = getApiById('nasa-power-climate')
    expect(openMeteo).toBeDefined()
    expect(nasaPower).toBeDefined()
    if (!openMeteo || !nasaPower) return

    for (const api of [openMeteo, nasaPower]) {
      const defaults = getDefaultParameters(api)
      expect(api.fields.find((field) => field.id === 'startDate')?.type, api.id).toBe('date')
      expect(api.fields.find((field) => field.id === 'endDate')?.type, api.id).toBe('date')
      expect(defaults.startDate, api.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(defaults.endDate, api.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(validateParameters(api, { ...defaults, startDate: '20260803' }), api.id).toEqual({
        startDate: 'Start date must be a valid date in YYYY-MM-DD format.',
      })
    }

    const openMeteoUrl = new URL(openMeteo.buildUrl({ ...getDefaultParameters(openMeteo), startDate: '2026-08-03', endDate: '2026-08-07' }))
    expect(openMeteoUrl.searchParams.get('start_date')).toBe('2026-08-03')
    expect(openMeteoUrl.searchParams.get('end_date')).toBe('2026-08-07')

    const malformedOpenMeteoUrl = new URL(openMeteo.buildUrl({
      ...getDefaultParameters(openMeteo),
      startDate: '2025-02-30',
      endDate: 'not-a-date',
    }))
    expect(malformedOpenMeteoUrl.searchParams.get('start_date')).toBe('2025-02-30')
    expect(malformedOpenMeteoUrl.searchParams.get('end_date')).toBe('not-a-date')

    const nasaUrl = new URL(nasaPower.buildUrl({ ...getDefaultParameters(nasaPower), startDate: '2026-08-03', endDate: '2026-08-07' }))
    expect(nasaUrl.searchParams.get('start')).toBe('20260803')
    expect(nasaUrl.searchParams.get('end')).toBe('20260807')
    expect(nasaPower.fields.find((field) => field.id === 'parameters')).toMatchObject({ type: 'text', minLength: 1 })

    const malformedNasaUrl = new URL(nasaPower.buildUrl({
      ...getDefaultParameters(nasaPower),
      startDate: '2025-02-30',
      endDate: 'not-a-date',
      parameters: '',
    }))
    expect(malformedNasaUrl.searchParams.get('start')).toBe('2025-02-30')
    expect(malformedNasaUrl.searchParams.get('end')).toBe('not-a-date')
    expect(malformedNasaUrl.searchParams.get('parameters')).toBe('')
  })

  it('keeps ordered date and year ranges in the shared field SSOT instead of silently rewriting reversed input', () => {
    const cases = [
      ['bank-of-canada-valet', 'startDate', 'endDate', '2026-08-07', '2026-08-03'],
      ['open-meteo-history', 'startDate', 'endDate', '2026-08-07', '2026-08-03'],
      ['nasa-power-climate', 'startDate', 'endDate', '2026-08-07', '2026-08-03'],
      ['frankfurter-sgd-myr-history', 'from', 'to', '2026-08-07', '2026-08-03'],
      ['open-meteo-climate', 'startYear', 'endYear', '2030', '2020'],
      ['world-bank-indicator-explorer', 'startYear', 'endYear', '2025', '2015'],
    ] as const

    for (const api of apiCatalog) {
      for (const field of api.fields.filter((candidate) => candidate.minimumFromField)) {
        const minimumField = api.fields.find((candidate) => candidate.id === field.minimumFromField)
        expect(minimumField, `${api.id}.${field.id} minimumFromField must reference a declared field`).toBeDefined()
        expect(minimumField?.type, `${api.id}.${field.id} minimumFromField must reference the same field type`).toBe(field.type)
        expect(validateParameters(api, getDefaultParameters(api)), `${api.id} defaults must satisfy ordered-range constraints`).toEqual({})
      }
    }

    for (const [id, startId, endId, later, earlier] of cases) {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) continue
      const startField = api.fields.find((field) => field.id === startId)
      const endField = api.fields.find((field) => field.id === endId)
      expect(endField, `${id}.${endId}`).toMatchObject({ minimumFromField: startId })
      const errors = validateParameters(api, { ...getDefaultParameters(api), [startId]: later, [endId]: earlier })
      expect(errors[endId], id).toBe(endField?.type === 'date'
        ? `${endField.label} must be on or after ${startField?.label}.`
        : `${endField?.label} must be greater than or equal to ${startField?.label}.`)
    }

    const climate = getApiById('open-meteo-climate')
    const worldBank = getApiById('world-bank-indicator-explorer')
    expect(climate).toBeDefined()
    expect(worldBank).toBeDefined()
    if (!climate || !worldBank) return

    const climateUrl = new URL(climate.buildUrl({ ...getDefaultParameters(climate), startYear: '2030', endYear: '2020' }))
    expect(climateUrl.searchParams.get('start_date')).toBe('2030-01-01')
    expect(climateUrl.searchParams.get('end_date')).toBe('2020-12-31')

    const worldBankUrl = new URL(worldBank.buildUrl({ ...getDefaultParameters(worldBank), startYear: '2025', endYear: '2015' }))
    expect(worldBankUrl.searchParams.get('date')).toBe('2025:2015')
  })

  it('exposes only the currently documented Open-Meteo Climate model IDs', () => {
    const climate = getApiById('open-meteo-climate')
    expect(climate).toBeDefined()
    if (!climate) return

    const model = climate.fields.find((field) => field.id === 'model')
    expect(model?.type).toBe('select')
    expect(model?.defaultValue).toBe('CMCC_CM2_VHR4')
    expect(model?.options?.map((option) => option.value)).toEqual([
      'CMCC_CM2_VHR4',
      'FGOALS_f3_H',
      'HiRAM_SIT_HR',
      'MRI_AGCM3_2_S',
      'EC_Earth3P_HR',
      'MPI_ESM1_2_XR',
      'NICAM16_8S',
    ])
    expect(validateParameters(climate, { ...getDefaultParameters(climate), model: 'nasa_nex_gddp' })).toEqual({
      model: 'Model must be one of the supported options.',
    })
    expect(new URL(climate.buildUrl(getDefaultParameters(climate))).searchParams.get('models')).toBe('CMCC_CM2_VHR4')
  })

  it('uses native ISO dates for strict Frankfurter and MLB calendar inputs', () => {
    const frankfurter = getApiById('frankfurter-sgd-myr-history')
    const mlb = getApiById('mlb-stats-api')
    expect(frankfurter).toBeDefined()
    expect(mlb).toBeDefined()
    if (!frankfurter || !mlb) return

    const frankfurterDefaults = getDefaultParameters(frankfurter)
    expect(frankfurter.fields.find((field) => field.id === 'from')?.type).toBe('date')
    expect(frankfurter.fields.find((field) => field.id === 'to')?.type).toBe('date')
    expect(validateParameters(frankfurter, { ...frankfurterDefaults, from: '20260901' })).toEqual({
      from: 'Start date must be a valid date in YYYY-MM-DD format.',
    })
    const frankfurterUrl = new URL(frankfurter.buildUrl({ ...frankfurterDefaults, from: '2026-08-03', to: '2026-08-07' }))
    expect(frankfurterUrl.searchParams.get('from')).toBe('2026-08-03')
    expect(frankfurterUrl.searchParams.get('to')).toBe('2026-08-07')

    const mlbDefaults = getDefaultParameters(mlb)
    expect(mlb.fields.find((field) => field.id === 'date')?.type).toBe('date')
    expect(validateParameters(mlb, { ...mlbDefaults, date: '20260901' })).toEqual({
      date: 'Schedule date must be a valid date in YYYY-MM-DD format.',
    })
    const mlbUrl = new URL(mlb.buildUrl({ ...mlbDefaults, date: '2025-04-15' }))
    expect(mlbUrl.searchParams.get('date')).toBe('2025-04-15')
    expect(mlb.fields.map((field) => field.id)).toEqual(['date'])
    expect(validateParameters(mlb, { ...mlbDefaults, sportId: '11' })).toEqual({ sportId: 'Unknown parameter: sportId.' })
    expect(mlbUrl.searchParams.get('sportId')).toBe('1')
  })

  it('keeps Brazilian CEP format validation in the shared field SSOT before provider execution', () => {
    const brasil = getApiById('brasilapi-postcode')
    expect(brasil).toBeDefined()
    if (!brasil) return

    const field = brasil.fields.find((candidate) => candidate.id === 'postcode')
    expect(field).toMatchObject({
      type: 'text',
      pattern: '\\d{5}-?\\d{3}',
      patternDescription: 'must contain exactly eight digits, optionally formatted as 12345-678.',
    })

    expect(validateParameters(brasil, { postcode: '01310930' })).toEqual({})
    expect(validateParameters(brasil, { postcode: '01310-930' })).toEqual({})
    expect(validateParameters(brasil, { postcode: '01310-930abc' })).toEqual({
      postcode: 'Brazilian CEP must contain exactly eight digits, optionally formatted as 12345-678.',
    })
    expect(validateParameters(brasil, { postcode: '0131093' })).toEqual({
      postcode: 'Brazilian CEP must contain exactly eight digits, optionally formatted as 12345-678.',
    })

    expect(new URL(brasil.buildUrl({ postcode: '01310930' })).pathname).toBe('/api/cep/v2/01310930')
    expect(new URL(brasil.buildUrl({ postcode: '01310-930' })).pathname).toBe('/api/cep/v2/01310930')
    expect(new URL(brasil.buildUrl({ postcode: '' })).pathname).toBe('/api/cep/v2/')
    expect(decodeURIComponent(new URL(brasil.buildUrl({ postcode: '01310-930abc' })).pathname)).toBe('/api/cep/v2/01310930abc')
  })

  it('rejects undeclared parameter keys across the shared catalog validation boundary', () => {
    for (const api of apiCatalog) {
      const defaults = getDefaultParameters(api)
      expect(validateParameters(api, { ...defaults, __undeclared: 'hidden' }), api.id).toEqual({
        __undeclared: 'Unknown parameter: __undeclared.',
      })
    }

    const mlb = getApiById('mlb-stats-api')
    expect(mlb).toBeDefined()
    if (!mlb) return
    const defaults = getDefaultParameters(mlb)
    expect(validateParameters(mlb, { ...defaults, teamId: '147' })).toEqual({ teamId: 'Unknown parameter: teamId.' })
    expect(new URL(mlb.buildUrl({ ...defaults, teamId: '147' })).searchParams.has('teamId')).toBe(false)
  })

  it('keeps declared limit controls request-effective across the catalog SSOT', () => {
    for (const api of apiCatalog) {
      const limitField = api.fields.find((field) => field.id === 'limit')
      if (!limitField) continue

      const defaults = getDefaultParameters(api)
      const alternate = limitField.max !== undefined && String(limitField.max) !== defaults.limit
        ? String(limitField.max)
        : limitField.min !== undefined && String(limitField.min) !== defaults.limit
          ? String(limitField.min)
          : undefined
      expect(alternate, `${api.id}: limit control needs an alternate valid value`).toBeDefined()
      if (!alternate) continue

      const changed = { ...defaults, limit: alternate }
      const defaultRequest = { url: api.buildUrl(defaults), body: api.buildBody?.(defaults) }
      const changedRequest = { url: api.buildUrl(changed), body: api.buildBody?.(changed) }
      expect(changedRequest, `${api.id}: changing the declared limit must change the provider request`).not.toEqual(defaultRequest)
    }
  })

  it('supports task-oriented token search and SSOT keyword aliases', () => {
    const expectMatch = (id: string, query: string) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      expect(matchesApiSearch(api!, query), `${id} should match ${query}`).toBe(true)
    }

    expectMatch('geocoding-search', 'place name to coordinates')
    expectMatch('exchange-rate-current', 'convert currency')
    expectMatch('languagetool-grammar-check', 'spell check')
    expectMatch('deps-dev', 'package versions')
    expectMatch('celestrak-satellites', 'satellite orbit')
    expectMatch('uk-flood-monitoring', 'flood stations')
    expectMatch('datamuse-rhymes', 'word pronunciation')
    expectMatch('swiss-transit-connections', 'train connections')
    expectMatch('usgs', 'earthquake data')
    expectMatch('nasa-power-climate', 'climate data for coordinates')

    expectMatch('deps-dev', 'please show me an API for package versions')
    expectMatch('geocoding-search', 'can you find me a place name geocoder')
    expectMatch('exchange-rate-current', 'please show me how to convert currency')
    expectMatch('weather', 'show me current weather')
    expectMatch('qr-code-generator', 'please generate a QR code')
    expectMatch('nhtsa-vehicle-recalls', 'please show me vehicle recalls')
    expect(matchesApiSearch(getApiById('countries')!, 'package versions')).toBe(false)
  })

  it('has unique monograms (no duplicate UI badges)', () => {
    expect(new Set(apiCatalog.map((api) => api.monogram)).size).toBe(apiCatalog.length)
  })

  it('assigns a valid 6-digit hex accent to every catalog entry', () => {
    for (const api of apiCatalog) {
      expect(api.accent, api.id).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('assigns one intentional demo preview profile to every catalog API', () => {
    const catalogIds = apiCatalog.map((api) => api.id).sort()
    const profileIds = [...previewProfileIds].sort()

    expect(new Set(previewProfileIds).size).toBe(previewProfileIds.length)
    expect(profileIds).toEqual(catalogIds)
    expect(Object.keys(previewProfiles).sort()).toEqual(catalogIds)
    expect(Object.values(previewProfiles).every((profile) => profile.layout !== 'result-list')).toBe(true)
    expect(new Set(Object.values(previewProfiles).map((profile) => profile.label)).size).toBe(apiCatalog.length)
  })

  it('includes the expanded recommendations without duplicating the five original providers', () => {
    expect(apiCatalog).toHaveLength(196)
    expect(apiCatalog.filter((api) => api.id.startsWith('data-gov-'))).toHaveLength(14)
    expect(getApiById('ipify-public-ip')?.provider).toBe('ipify')
    expect(getApiById('usaspending')?.method).toBe('POST')
    for (const provider of ['Random User', 'Dog CEO', 'JSONPlaceholder', 'Nager.Holidays']) {
      expect(apiCatalog.filter((api) => api.provider === provider), provider).toHaveLength(1)
    }
  })

  it('uses the current Nager.Holidays Community v4 contract without silently repairing invalid input', () => {
    const holidays = getApiById('holidays')!
    const currentYear = new Date().getUTCFullYear()
    const yearField = holidays.fields.find((field) => field.id === 'year')
    expect(holidays.provider).toBe('Nager.Holidays')
    expect(holidays.documentationUrl).toBe('https://nagerholidays.com/api')
    expect(yearField).toMatchObject({ defaultValue: String(currentYear), min: currentYear, max: currentYear + 5, step: 1 })
    expect(holidays.buildUrl({ year: String(currentYear), country: 'SG' })).toBe(`https://nagerholidays.com/api/v4/Holidays/SG/${currentYear}`)
    expect(holidays.buildUrl({ year: '2100', country: 'SG' })).toBe('https://nagerholidays.com/api/v4/Holidays/SG/2100')
    expect(holidays.buildUrl({ year: '2.5', country: 'SG' })).toBe('https://nagerholidays.com/api/v4/Holidays/SG/2.5')
    expect(holidays.buildUrl({ year: String(currentYear), country: 'xx' })).toBe(`https://nagerholidays.com/api/v4/Holidays/XX/${currentYear}`)
    expect(validateParameters(holidays, { year: String(currentYear + 6), country: 'SG' })).toHaveProperty('year')
    expect(validateParameters(holidays, { year: `${currentYear}.5`, country: 'SG' })).toHaveProperty('year')
    expect(validateParameters(holidays, { year: String(currentYear), country: 'xx' })).toHaveProperty('country')
    expect(holidays.usageNote).toContain('Community API v4')
    expect(holidays.usageNote).toContain('CORS')
  })

  it('preserves Dog CEO count input for shared validation and documents conservative image rights', () => {
    const dogs = getApiById('dogs')!
    expect(dogs.buildUrl({ count: '4' })).toBe('https://dog.ceo/api/breeds/image/random/4')
    expect(dogs.buildUrl({ count: '4.0' })).toBe('https://dog.ceo/api/breeds/image/random/4')
    expect(dogs.buildUrl({ count: '0' })).toBe('https://dog.ceo/api/breeds/image/random/0')
    expect(dogs.buildUrl({ count: '11' })).toBe('https://dog.ceo/api/breeds/image/random/11')
    expect(dogs.buildUrl({ count: '2.5' })).toBe('https://dog.ceo/api/breeds/image/random/2.5')
    expect(dogs.buildUrl({ count: '4/5' })).toBe('https://dog.ceo/api/breeds/image/random/4%2F5')
    expect(dogs.fields.find((field) => field.id === 'count')?.step).toBe(1)
    expect(validateParameters(dogs, { count: '0' })).toHaveProperty('count')
    expect(validateParameters(dogs, { count: '11' })).toHaveProperty('count')
    expect(validateParameters(dogs, { count: '2.5' })).toHaveProperty('count')
    expect(dogs.usageNote).toContain('Keep request frequency bounded')
    expect(dogs.usageNote).toContain('does not establish reuse rights for each photo')
  })

  it('builds the five curated 200-API expansion requests from the shared SSOT', () => {
    const seasonalApi = getApiById('open-meteo-seasonal')!
    const seasonal = new URL(seasonalApi.buildUrl({ latitude: '1.3521', longitude: '103.8198', forecastDays: '42' }))
    expect(seasonal.hostname).toBe('seasonal-api.open-meteo.com')
    expect(seasonal.searchParams.get('weekly')).toBe('temperature_2m_mean,temperature_2m_anomaly,precipitation_mean,precipitation_anomaly')
    expect(seasonal.searchParams.get('forecast_days')).toBe('42')
    expect(seasonalApi.fields.find((field) => field.id === 'forecastDays')).toMatchObject({ min: 1, max: 46, step: 1 })
    expect(validateParameters(seasonalApi, { latitude: '1.3521', longitude: '103.8198', forecastDays: '42.5' })).toEqual({ forecastDays: 'Forecast horizon (days) must use increments of 1.' })
    expect(new URL(seasonalApi.buildUrl({ latitude: '1.3521', longitude: '103.8198', forecastDays: ' 42.5 ' })).searchParams.get('forecast_days')).toBe('42.5')

    const ratings = new URL(getApiById('nhtsa-safety-ratings')!.buildUrl({ vehicleId: '19426' }))
    expect(ratings.pathname).toBe('/SafetyRatings/VehicleId/19426')
    expect(ratings.searchParams.get('format')).toBe('json')

    const singstat = new URL(getApiById('singstat-cpi-monthly')!.buildUrl({}))
    expect(singstat.pathname).toBe('/api/table/tabledata/M213752')
    expect(singstat.searchParams.get('seriesNoORrowNo')).toBe('1')
    expect(singstat.searchParams.get('limit')).toBe('12')
    expect(singstat.searchParams.get('sortBy')).toBe('key desc')

    const openalexApi = getApiById('openalex-works-search')!
    const openalex = new URL(openalexApi.buildUrl({ query: 'artificial intelligence', limit: '8' }))
    expect(openalex.pathname).toBe('/works')
    expect(openalex.searchParams.get('search')).toBe('artificial intelligence')
    expect(openalex.searchParams.get('per_page')).toBe('8')
    expect(openalex.searchParams.has('per-page')).toBe(false)
    expect(openalex.searchParams.get('select')).toBe('id,title,publication_year,cited_by_count,doi,authorships,open_access')
    expect(openalexApi.documentationUrl).toBe('https://help.openalex.org/api/searching/')
    expect(openalexApi.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(openalexApi.fields.find((field) => field.id === 'limit')?.step).toBe(1)
    const explicitInvalid = new URL(openalexApi.buildUrl({ query: '', limit: '8.5' }))
    expect(explicitInvalid.searchParams.get('search')).toBe('')
    expect(explicitInvalid.searchParams.get('per_page')).toBe('8.5')
    expect(validateParameters(openalexApi, { query: '', limit: '8' })).toHaveProperty('query')
    expect(validateParameters(openalexApi, { query: 'artificial intelligence', limit: '8.5' })).toHaveProperty('limit')

    const oecd = new URL(getApiById('oecd-cli')!.buildUrl({ area: 'JPN', startYear: '2025' }))
    expect(oecd.pathname).toContain('/OECD.SDD.STES,DSD_STES@DF_CLI/JPN.M.LI...AA...H')
    expect(oecd.searchParams.get('startPeriod')).toBe('2025-01')
    expect(oecd.searchParams.get('format')).toBe('jsondata')
  })

  it('keeps NHTSA VehicleId identity canonical and rejects malformed values without builder rewriting', () => {
    const nhtsa = getApiById('nhtsa-safety-ratings')
    expect(nhtsa).toBeDefined()
    if (!nhtsa) return

    expect(nhtsa.fields.find((field) => field.id === 'vehicleId')).toMatchObject({
      type: 'text',
      defaultValue: '19426',
      minLength: 1,
      maxLength: 6,
      pattern: '[1-9][0-9]{0,5}',
      patternDescription: 'must be a canonical positive decimal ID from 1 to 999999.',
    })
    expect(validateParameters(nhtsa, { vehicleId: '7520' })).toEqual({})
    expect(new URL(nhtsa.buildUrl({ vehicleId: '7520' })).pathname).toBe('/SafetyRatings/VehicleId/7520')

    for (const invalid of ['19426.9', 'abc123', '0', '1000000']) {
      expect(validateParameters(nhtsa, { vehicleId: invalid }), invalid).toHaveProperty('vehicleId')
      expect(new URL(nhtsa.buildUrl({ vehicleId: invalid })).pathname, invalid)
        .toBe(`/SafetyRatings/VehicleId/${invalid}`)
    }
  })

  it('excludes browser-incompatible or policy-incompatible relay-backed catalog entries', () => {
    expect(getApiById('musicbrainz-artist-search')).toBeUndefined()
    expect(getApiById('yahoo-finance-sgx-history')).toBeUndefined()
    expect(getApiById('gutendex-books')).toBeUndefined()
    expect(getApiById('crates-io-search')).toBeUndefined()
    expect(getApiById('nws-weather')).toBeUndefined()
    expect(getApiById('europe-pmc-search')).toBeUndefined()
    expect(getApiById('zenodo-search')).toBeUndefined()
    const defaultHosts = apiCatalog.map((api) => new URL(api.buildUrl(getDefaultParameters(api))).hostname)
    expect(defaultHosts).not.toContain('r.jina.ai')
  })

  it('builds the six new keyless interactive API requests', () => {
    const urls = Object.fromEntries(['geocoding-search', 'open-meteo-air-quality', 'sunrise-sunset', 'nasa-eonet-events', 'mbta-transit-routes', 'open-trivia'].map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['geocoding-search'].searchParams.get('name')).toBe('Singapore')
    const geocoding = getApiById('geocoding-search')!
    expect(geocoding.fields.find((field) => field.id === 'name')).toMatchObject({ minLength: 2 })
    expect(geocoding.fields.find((field) => field.id === 'count')).toMatchObject({ min: 1, max: 10, step: 1 })
    expect(validateParameters(geocoding, { name: ' ', count: '6' })).toHaveProperty('name')
    expect(validateParameters(geocoding, { name: 'SG', count: '2.5' })).toHaveProperty('count')
    expect(new URL(geocoding.buildUrl({ name: ' ', count: '999' })).searchParams.get('name')).toBe('')
    expect(new URL(geocoding.buildUrl({ name: 'SG', count: '999' })).searchParams.get('count')).toBe('999')
    expect(urls['open-meteo-air-quality'].searchParams.get('current')).toContain('us_aqi')
    expect(urls['sunrise-sunset'].pathname).toBe('/v2')
    expect(urls['nasa-eonet-events'].searchParams.get('status')).toBe('open')
    const eonet = getApiById('nasa-eonet-events')!
    expect(eonet.fields.find((field) => field.id === 'days')).toMatchObject({ min: 1, max: 365, step: 1 })
    expect(eonet.fields.find((field) => field.id === 'limit')).toMatchObject({ min: 1, max: 10, step: 1 })
    expect(validateParameters(eonet, { category: 'all', days: '30.5', limit: '6' })).toEqual({ days: 'Recent days must use increments of 1.' })
    expect(validateParameters(eonet, { category: 'all', days: '30', limit: '6.5' })).toEqual({ limit: 'Events must use increments of 1.' })
    const malformedEonet = new URL(eonet.buildUrl({ category: 'all', days: '30.5', limit: '6.5' }))
    expect(malformedEonet.searchParams.get('days')).toBe('30.5')
    expect(malformedEonet.searchParams.get('limit')).toBe('6.5')
    expect(urls['mbta-transit-routes'].searchParams.get('filter[type]')).toBe('0,1')
    const mbta = getApiById('mbta-transit-routes')!
    expect(validateParameters(mbta, { routeType: '' })).toHaveProperty('routeType')
    expect(new URL(mbta.buildUrl({ routeType: '' })).searchParams.get('filter[type]')).toBe('')
    expect(urls['open-trivia'].searchParams.get('type')).toBe('multiple')
    const trivia = getApiById('open-trivia')!
    expect(trivia.fields.find((field) => field.id === 'amount')).toMatchObject({ min: 1, max: 10, step: 1 })
    expect(validateParameters(trivia, { amount: '6.5', category: '9', difficulty: 'medium' })).toEqual({ amount: 'Questions must use increments of 1.' })
    expect(validateParameters(trivia, { amount: '0', category: '9', difficulty: 'medium' })).toHaveProperty('amount')
    expect(validateParameters(trivia, { amount: '11', category: '9', difficulty: 'medium' })).toHaveProperty('amount')
    const malformedTrivia = new URL(trivia.buildUrl({ amount: ' 6.5 ', category: '9', difficulty: 'medium' }))
    expect(malformedTrivia.searchParams.get('amount')).toBe('6.5')
    expect(trivia.usageNote).toMatch(/CC BY-SA 4\.0/i)
    expect(trivia.usageNote).toMatch(/one API request every 5 seconds/i)
    expect(getAutomatedVerificationPolicy(trivia)).toEqual({
      mode: 'cadence-limited',
      minimumIntervalSeconds: 5,
      retryOnNon2xx: false,
      reason: 'Open Trivia DB limits each IP to one API request every 5 seconds. Automated verification must use one isolated request per cadence window and must not add a same-run non-2xx retry.',
      policyUrl: 'https://opentdb.com/api_config.php',
    })
  })

  it('builds the Frankfurter long-history market demo', () => {
    const frankfurter = getApiById('frankfurter-sgd-myr-history')

    expect(frankfurter).toBeDefined()
    if (!frankfurter) return

    expect(frankfurter.buildUrl(getDefaultParameters(frankfurter))).toContain('from=1999-01-04')
    expect(frankfurter.buildUrl(getDefaultParameters(frankfurter))).toContain('base=SGD&quotes=MYR&providers=ECB')
  })

  it('builds the five new keyless specialist API requests', () => {
    const ids = ['malaysia-fuel-price', 'open-meteo-marine', 'nobel-prizes', 'chess-player-stats', 'crossref-works']
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['malaysia-fuel-price'].hostname).toBe('api.data.gov.my')
    expect(urls['malaysia-fuel-price'].searchParams.get('id')).toBe('fuelprice')
    expect(urls['open-meteo-marine'].searchParams.get('hourly')).toContain('ocean_current_velocity')
    expect(urls['open-meteo-marine'].searchParams.get('forecast_days')).toBe('3')
    const marine = getApiById('open-meteo-marine')!
    expect(marine.fields.find((field) => field.id === 'days')).toMatchObject({ min: 1, max: 7, step: 1 })
    expect(validateParameters(marine, { latitude: '1.3521', longitude: '103.8198', days: '3.5' })).toEqual({ days: 'Forecast days must use increments of 1.' })
    expect(new URL(marine.buildUrl({ latitude: '1.3521', longitude: '103.8198', days: ' 3.5 ' })).searchParams.get('forecast_days')).toBe('3.5')
    expect(urls['nobel-prizes'].searchParams.get('nobelPrizeCategory')).toBe('phy')
    const nobel = getApiById('nobel-prizes')!
    expect(nobel.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', min: 1, max: 12, step: 1 })
    expect(validateParameters(nobel, { category: 'phy', limit: '6.5' })).toEqual({ limit: 'Prize years must use increments of 1.' })
    expect(validateParameters(nobel, { category: '', limit: '6' })).toEqual({ category: 'Prize category is required.' })
    const fractionalNobel = new URL(nobel.buildUrl({ category: 'phy', limit: ' 6.5 ' }))
    expect(fractionalNobel.searchParams.get('limit')).toBe('6.5')
    const blankCategoryNobel = new URL(nobel.buildUrl({ category: '', limit: '6' }))
    expect(blankCategoryNobel.searchParams.get('nobelPrizeCategory')).toBe('')
    expect(urls['chess-player-stats'].pathname).toBe('/api/user/thibault')
    expect(urls['chess-player-stats'].hostname).toBe('lichess.org')
    expect(urls['crossref-works'].pathname).toBe('/v1/works')
    expect(urls['crossref-works'].searchParams.get('select')).toContain('DOI')
    const crossref = getApiById('crossref-works')!
    expect(crossref.fields.find((field) => field.id === 'query')).toMatchObject({ type: 'text', minLength: 1 })
    expect(crossref.fields.find((field) => field.id === 'rows')).toMatchObject({ type: 'number', min: 1, max: 20, step: 1 })
    expect(validateParameters(crossref, { query: '   ', rows: '8' })).toEqual({ query: 'Research query is required.' })
    expect(validateParameters(crossref, { query: 'agentic AI', rows: '8.5' })).toEqual({ rows: 'Results must use increments of 1.' })
    const blankCrossref = new URL(crossref.buildUrl({ query: '   ', rows: '8' }))
    expect(blankCrossref.searchParams.get('query')).toBe('')
    const fractionalCrossref = new URL(crossref.buildUrl({ query: 'agentic AI', rows: ' 8.5 ' }))
    expect(fractionalCrossref.searchParams.get('rows')).toBe('8.5')
  })

  it('builds the next twelve browser-ready keyless API requests', () => {
    const ids = [
      'noaa-space-weather', 'osv-vulnerability', 'federal-register-documents', 'wikipedia-search',
      'open-meteo-flood', 'open-meteo-history', 'kraken-public-ticker', 'gitlab-public-projects',
      'uk-police-street-crime', 'open-brewery-directory', 'rick-morty-characters', 'wikimedia-pageviews',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['noaa-space-weather'].pathname).toBe('/products/noaa-scales.json')
    expect(urls['osv-vulnerability'].pathname).toContain('/v1/vulns/GHSA-jfh8-c2jp-5v3q')
    const osv = getApiById('osv-vulnerability')
    expect(osv?.buildUrl({ vulnerabilityId: '  GHSA-jfh8-c2jp-5v3q  ' })).toBe('https://api.osv.dev/v1/vulns/GHSA-jfh8-c2jp-5v3q')
    expect(osv?.buildUrl({ vulnerabilityId: 'ghsa-jfh8-c2jp-5v3q' })).toBe('https://api.osv.dev/v1/vulns/ghsa-jfh8-c2jp-5v3q')
    expect(osv?.fields[0]?.help).toContain('case-sensitive')
    expect(urls['federal-register-documents'].searchParams.get('conditions[term]')).toBe('artificial intelligence')
    expect(urls['wikipedia-search'].hostname).toBe('en.wikipedia.org')
    expect(urls['wikipedia-search'].pathname).toBe('/w/api.php')
    expect(urls['wikipedia-search'].searchParams.get('generator')).toBe('search')
    expect([...urls['wikipedia-search'].searchParams.keys()]).toEqual(['action', 'generator', 'gsrsearch', 'gsrlimit', 'prop', 'exintro', 'explaintext', 'piprop', 'pithumbsize', 'format', 'origin'])
    expect(getApiById('wikipedia-search')?.fields.find((field) => field.id === 'query')).toMatchObject({ minLength: 1 })
    expect(getApiById('wikipedia-search')?.fields.find((field) => field.id === 'limit')).toMatchObject({ min: 1, max: 12, step: 1 })
    expect(getApiById('wikipedia-search')?.headers?.['Api-User-Agent']).toBe('Public-API/0.1 (https://yapweijun1996.github.io/Public-API/)')
    expect(getApiById('wikipedia-search')?.usageNote).toContain('CC BY-SA')
    expect(urls['open-meteo-flood'].searchParams.get('daily')).toBe('river_discharge,river_discharge_mean,river_discharge_max')
    const floodApi = getApiById('open-meteo-flood')!
    expect(floodApi.fields.find((field) => field.id === 'days')).toMatchObject({ min: 1, max: 30, step: 1 })
    expect(validateParameters(floodApi, { latitude: '1.3521', longitude: '103.8198', days: '7.5' })).toEqual({ days: 'Forecast days must use increments of 1.' })
    expect(new URL(floodApi.buildUrl({ latitude: '1.3521', longitude: '103.8198', days: ' 7.5 ' })).searchParams.get('forecast_days')).toBe('7.5')
    expect(urls['open-meteo-history'].searchParams.get('daily')).toContain('temperature_2m_max')
    expect(urls['kraken-public-ticker'].searchParams.get('pair')).toBe('XBTUSD')
    expect(urls['kraken-public-ticker'].searchParams.get('assetVersion')).toBe('1')
    expect(urls['gitlab-public-projects'].searchParams.get('visibility')).toBe('public')
    const gitlab = getApiById('gitlab-public-projects')!
    expect(gitlab.fields.find((field) => field.id === 'query')).toMatchObject({ type: 'text', minLength: 1 })
    expect(gitlab.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', min: 1, max: 20, step: 1 })
    expect(validateParameters(gitlab, { query: '   ', limit: '8' })).toEqual({ query: 'Project search is required.' })
    expect(validateParameters(gitlab, { query: 'artificial intelligence', limit: '8.5' })).toEqual({ limit: 'Projects must use increments of 1.' })
    expect(new URL(gitlab.buildUrl({ query: '   ', limit: '8' })).searchParams.get('search')).toBe('')
    expect(new URL(gitlab.buildUrl({ query: 'artificial intelligence', limit: ' 8.5 ' })).searchParams.get('per_page')).toBe('8.5')
    expect(urls['uk-police-street-crime'].pathname).toContain('/burglary')
    expect([...urls['uk-police-street-crime'].searchParams.keys()]).toEqual(['lat', 'lng'])
    expect(urls['uk-police-street-crime'].searchParams.get('lat')).toBe('51.5074')
    expect(urls['uk-police-street-crime'].searchParams.get('lng')).toBe('-0.1278')
    expect(getApiById('uk-police-street-crime')?.usageNote).toContain('persistent_id is the documented stable 64-character crime identity')
    expect(urls['open-brewery-directory'].searchParams.get('by_country')).toBe('united_states')
    expect(urls['rick-morty-characters'].searchParams.get('name')).toBe('Rick')
    expect(urls['wikimedia-pageviews'].pathname).toContain('/Singapore/daily/')
  })

  it('builds exact Kraken display-identity ticker requests for every catalog pair', () => {
    const kraken = getApiById('kraken-public-ticker')
    expect(kraken).toBeDefined()
    if (!kraken) return

    for (const pair of ['XBTUSD', 'ETHUSD', 'SOLUSD', 'XBTEUR']) {
      const url = new URL(kraken.buildUrl({ pair }))
      expect(url.origin).toBe('https://api.kraken.com')
      expect(url.pathname).toBe('/0/public/Ticker')
      expect([...url.searchParams.entries()]).toEqual([['pair', pair], ['assetVersion', '1']])
    }

    expect(new URL(kraken.buildUrl({ pair: 'DOGEUSD' })).searchParams.get('pair')).toBe('XBTUSD')
  })

  it('builds the twelve newly verified keyless API requests', () => {
    const ids = [
      'openf1-historical', 'irail-liveboard', 'spaceflight-news', 'launch-library-upcoming',
      'wiktionary-entry', 'animechan-random-quote', 'jokeapi-safe', 'dummyjson-recipes',
      'brasilapi-postcode', 'poetrydb-poems', 'coingecko-keyless-market', 'swapi-people',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['openf1-historical'].hostname).toBe('api.jolpi.ca')
    expect(urls['openf1-historical'].pathname).toBe('/ergast/f1/2025/1/qualifying/')
    expect(urls['irail-liveboard'].pathname).toBe('/liveboard/')
    expect(urls['irail-liveboard'].searchParams.get('arrdep')).toBe('departure')
    expect(new URL(getApiById('irail-liveboard')!.buildUrl({ station: 'Gent-Sint-Pieters', direction: 'arrival' })).searchParams.get('arrdep')).toBe('arrival')
    expect(urls['spaceflight-news'].pathname).toBe('/v4/articles/')
    expect(urls['spaceflight-news'].searchParams.get('limit')).toBe('6')
    expect(urls['launch-library-upcoming'].pathname).toBe('/2.3.0/launches/upcoming/')
    expect(urls['launch-library-upcoming'].searchParams.get('limit')).toBe('4')
    expect(urls['wiktionary-entry'].pathname).toBe('/api/rest_v1/page/definition/hello')
    const wiktionary = getApiById('wiktionary-entry')!
    expect(wiktionary.fields.find((field) => field.id === 'word')).toMatchObject({ type: 'text', defaultValue: 'hello', minLength: 1 })
    expect(validateParameters(wiktionary, { word: '' })).toHaveProperty('word')
    expect(new URL(wiktionary.buildUrl({ word: '' })).pathname).toBe('/api/rest_v1/page/definition/')
    expect(urls['animechan-random-quote'].pathname).toBe('/v1/quotes/random')
    expect(getApiById('animechan-random-quote')?.usageNote).toContain('100 requests per day per IP address')
    expect(getApiById('animechan-random-quote')?.usageNote).toContain('HTTP 429')
    expect(urls['jokeapi-safe'].pathname).toBe('/joke/Programming')
    expect(urls['jokeapi-safe'].search).toContain('safe-mode')
    expect(urls['dummyjson-recipes'].pathname).toBe('/recipes/search')
    expect(urls['brasilapi-postcode'].pathname).toBe('/api/cep/v2/01310930')
    expect(decodeURIComponent(urls['poetrydb-poems'].pathname)).toContain('/Emily Dickinson;3/')
    expect(urls['coingecko-keyless-market'].searchParams.get('ids')).toBe('bitcoin')
    expect(urls['swapi-people'].searchParams.get('search')).toBe('Luke')
  })

  it('keeps the Spaceflight News request contract exact and leaves explicit invalid values for shared validation', () => {
    const spaceflight = getApiById('spaceflight-news')
    expect(spaceflight).toBeDefined()
    if (!spaceflight) return

    const query = spaceflight.fields.find((field) => field.id === 'query')
    const limit = spaceflight.fields.find((field) => field.id === 'limit')
    expect(query).toMatchObject({ type: 'text', defaultValue: 'NASA', minLength: 1 })
    expect(limit).toMatchObject({ type: 'number', defaultValue: '6', min: 1, max: 10, step: 1 })
    expect(validateParameters(spaceflight, { query: '   ', limit: '6' })).toHaveProperty('query')
    expect(validateParameters(spaceflight, { query: 'NASA', limit: '0' })).toHaveProperty('limit')
    expect(validateParameters(spaceflight, { query: 'NASA', limit: '1.5' })).toHaveProperty('limit')
    expect(validateParameters(spaceflight, { query: 'NASA', limit: '11' })).toHaveProperty('limit')

    const defaults = new URL(spaceflight.buildUrl(getDefaultParameters(spaceflight)))
    expect([...defaults.searchParams.entries()]).toEqual([
      ['search', 'NASA'],
      ['limit', '6'],
      ['ordering', '-published_at'],
    ])

    const explicitBadValues = new URL(spaceflight.buildUrl({ query: '   ', limit: '0' }))
    expect([...explicitBadValues.searchParams.entries()]).toEqual([
      ['search', '   '],
      ['limit', '0'],
      ['ordering', '-published_at'],
    ])

    const nonIntegralLimit = new URL(spaceflight.buildUrl({ query: 'NASA', limit: '1.5' }))
    expect(nonIntegralLimit.searchParams.get('limit')).toBe('1.5')
  })

  it('keeps DummyJSON recipe search non-empty and preserves explicit invalid values for shared validation', () => {
    const recipes = getApiById('dummyjson-recipes')
    expect(recipes).toBeDefined()
    if (!recipes) return

    expect(recipes.fields.find((field) => field.id === 'query')).toMatchObject({ type: 'text', defaultValue: 'pasta', minLength: 1 })
    expect(recipes.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', defaultValue: '6', min: 1, max: 10, step: 1 })
    expect(validateParameters(recipes, { query: '   ', limit: '6' })).toHaveProperty('query')
    expect(validateParameters(recipes, { query: 'pasta', limit: '0' })).toHaveProperty('limit')
    expect(validateParameters(recipes, { query: 'pasta', limit: '2.5' })).toHaveProperty('limit')
    expect(validateParameters(recipes, { query: 'pasta', limit: '11' })).toHaveProperty('limit')

    const defaults = new URL(recipes.buildUrl(getDefaultParameters(recipes)))
    expect([...defaults.searchParams.entries()]).toEqual([['q', 'pasta'], ['limit', '6']])
    const explicitInvalid = new URL(recipes.buildUrl({ query: '   ', limit: '2.5' }))
    expect([...explicitInvalid.searchParams.entries()]).toEqual([['q', ''], ['limit', '2.5']])
    expect(recipes.usageNote).toContain('does not establish reuse rights for individual recipe content or images')
  })

  it('builds the seven externally-verified expansion API requests', () => {
    const ids = ['google-dns-doh', 'color-api', 'nasa-image-search', 'lichess-top-players', 'pubmed-search', 'rxnorm-drug-search', 'inaturalist-observations']
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['google-dns-doh'].searchParams.get('name')).toBe('example.com')
    const dnsNameField = getApiById('google-dns-doh')?.fields.find((field) => field.id === 'name')
    expect(dnsNameField?.minLength).toBe(1)
    const dns = getApiById('google-dns-doh')
    expect(dns).toBeDefined()
    if (!dns) throw new Error('Missing API: google-dns-doh')
    expect(new URL(dns.buildUrl({ name: '   ', type: 'A' })).searchParams.get('name')).toBe('')
    expect(urls['color-api'].searchParams.get('hex')).toBe('24B1E0')
    expect(urls['nasa-image-search'].searchParams.get('media_type')).toBe('image')
    expect(urls['nasa-image-search'].searchParams.get('page_size')).toBe('8')
    const nasa = getApiById('nasa-image-search')
    expect(nasa?.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(new URL(nasa!.buildUrl({ query: '   ', mediaType: 'image' })).searchParams.get('q')).toBe('')
    expect(urls['lichess-top-players'].pathname).toBe('/api/player/top/5/blitz')
    expect(urls['pubmed-search'].searchParams.get('db')).toBe('pubmed')
    const pubmed = getApiById('pubmed-search')
    expect(pubmed).toBeDefined()
    if (!pubmed) throw new Error('Missing API: pubmed-search')
    expect(pubmed.fields.find((field) => field.id === 'term')?.minLength).toBe(1)
    expect(pubmed.fields.find((field) => field.id === 'retmax')?.step).toBe(1)
    expect(pubmed.usageNote).toContain('3 E-utility requests per second')
    expect(pubmed.usageNote).toContain('tool/email')
    expect(new URL(pubmed.buildUrl({ term: '   ', retmax: '5' })).searchParams.get('term')).toBe('')
    expect(new URL(pubmed.buildUrl({ term: 'covid', retmax: '2.5' })).searchParams.get('retmax')).toBe('2.5')
    expect(urls['rxnorm-drug-search'].searchParams.get('name')).toBe('ibuprofen')
    const rxnorm = getApiById('rxnorm-drug-search')
    expect(rxnorm).toBeDefined()
    if (!rxnorm) throw new Error('Missing API: rxnorm-drug-search')
    expect(rxnorm.fields.find((field) => field.id === 'name')?.minLength).toBe(1)
    expect(new URL(rxnorm.buildUrl({ name: '   ' })).searchParams.get('name')).toBe('')
    expect(urls['inaturalist-observations'].searchParams.get('taxon_name')).toBe('Panthera')
  })

  it('builds the thirteen second-expansion API requests', () => {
    const ids = [
      'first-epss', 'endoflife-date', 'deps-dev', 'ecb-fx-rates', 'un-sdg-goals', 'datacite-search',
      'ror-search', 'celestrak-satellites', 'cleveland-museum-search',
      'scryfall-card-search', 'dnd5e-spell-lookup', 'qr-code-generator', 'where-the-iss-at',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['first-epss'].searchParams.get('cve')).toBe('CVE-2021-44228')
    expect(urls['endoflife-date'].pathname).toBe('/api/v1/products/nodejs')
    expect(urls['deps-dev'].pathname).toBe('/v3/systems/npm/packages/react')
    expect(urls['ecb-fx-rates'].hostname).toBe('api.coinbase.com')
    expect(urls['ecb-fx-rates'].pathname).toBe('/v2/exchange-rates')
    expect(urls['ecb-fx-rates'].searchParams.get('currency')).toBe('EUR')
    expect(urls['un-sdg-goals'].pathname).toBe('/SDGAPI/v1/sdg/Goal/List')
    expect(urls['datacite-search'].searchParams.get('query')).toBe('climate change')
    const datacite = getApiById('datacite-search')
    expect(datacite).toBeDefined()
    if (!datacite) throw new Error('Missing API: datacite-search')
    expect(datacite.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(datacite.fields.find((field) => field.id === 'count')?.step).toBe(1)
    expect(new URL(datacite.buildUrl({ query: '   ', count: '5' })).searchParams.get('query')).toBe('')
    expect(new URL(datacite.buildUrl({ query: 'climate change', count: '2.5' })).searchParams.get('page[size]')).toBe('2.5')
    expect(urls['ror-search'].pathname).toBe('/v2/organizations')
    expect(urls['ror-search'].searchParams.get('query')).toBe('stanford')
    expect(getApiById('ror-search')?.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(new URL(getApiById('ror-search')!.buildUrl({ query: '   ' })).searchParams.get('query')).toBe('')
    expect(urls['celestrak-satellites'].searchParams.get('GROUP')).toBe('stations')
    expect(urls['celestrak-satellites'].searchParams.get('FORMAT')).toBe('json')
    expect(getApiById('celestrak-satellites')?.fields.find((field) => field.id === 'group')?.options?.map((option) => option.value)).toEqual(['stations', 'gps-ops'])
    expect(getApiById('celestrak-satellites')?.usageNote).toContain('excludes large Active and Starlink groups')
    expect(urls['cleveland-museum-search'].searchParams.get('q')).toBe('monet')
    expect(urls['scryfall-card-search'].searchParams.get('q')).toBe('dragon')
    const scryfall = getApiById('scryfall-card-search')
    expect(scryfall?.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(scryfall?.headers).toEqual({ Accept: 'application/json' })
    expect(scryfall?.automatedVerification).toMatchObject({ mode: 'enabled', retryOnRateLimit: false, rateLimitStatuses: [429] })
    expect(new URL(scryfall!.buildUrl({ query: '   ' })).searchParams.get('q')).toBe('')
    expect(urls['dnd5e-spell-lookup'].pathname).toBe('/api/2014/spells/fireball')
    expect(urls['qr-code-generator'].searchParams.get('data')).toBe('https://example.com')
    expect(urls['where-the-iss-at'].pathname).toBe('/v1/satellites/25544')
    expect(urls['where-the-iss-at'].search).toBe('')
    expect(getApiById('where-the-iss-at')?.usageNote).toContain('roughly one per second')

    const qrApi = getApiById('qr-code-generator')
    expect(qrApi?.responseType).toBe('image')
    expect(qrApi?.headers).toEqual({ Accept: 'image/png' })
    expect(qrApi?.responseContentTypes).toEqual(['image/png'])
    expect(qrApi?.parseResponse).toBeUndefined()
  })

  it('builds the exact Art Institute public-domain image search and preserves invalid input for shared validation', () => {
    const art = getApiById('art-institute-search')
    expect(art).toBeDefined()
    if (!art) throw new Error('Missing API: art-institute-search')
    const url = new URL(art.buildUrl({ query: 'monet', limit: '8' }))
    expect(url.origin).toBe('https://api.artic.edu')
    expect(url.pathname).toBe('/api/v1/artworks/search')
    expect(url.searchParams.get('q')).toBe('monet')
    expect(url.searchParams.get('limit')).toBe('8')
    expect(url.searchParams.get('fields')).toBe('id,title,artist_title,date_display,image_id,is_public_domain')
    expect(url.searchParams.get('query[term][is_public_domain]')).toBe('true')
    expect(art.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(art.fields.find((field) => field.id === 'limit')?.step).toBe(1)
    expect(validateParameters(art, { query: '   ', limit: '8' })).toHaveProperty('query')
    expect(validateParameters(art, { query: 'monet', limit: '2.5' })).toHaveProperty('limit')
    expect(validateParameters(art, { query: 'monet', limit: '0' })).toHaveProperty('limit')
    expect(validateParameters(art, { query: 'monet', limit: '21' })).toHaveProperty('limit')
    const malformed = new URL(art.buildUrl({ query: '   ', limit: '2.5' }))
    expect(malformed.searchParams.get('q')).toBe('')
    expect(malformed.searchParams.get('limit')).toBe('2.5')
  })

  it('builds the twenty-six remaining third-expansion API requests', () => {
    const ids = [
      'eurostat-population', 'bls-timeseries', 'fema-disasters', 'noaa-tides', 'rdap-domain-lookup',
      'languagetool-grammar-check', 'doaj-search', 'pubchem-compound', 'chembl-molecule',
      'uniprot-protein', 'rcsb-pdb-entry', 'ensembl-gene-lookup', 'obis-marine-occurrences', 'worms-species-lookup',
      'paleobiodb-taxa', 'usgs-water-legacy', 'rubygems-lookup', 'nuget-package-lookup',
      'internet-archive-search', 'ipwhois-lookup', 'newton-math-solver', 'datamuse-rhymes',
      'open5e-monster-search', 'dicebear-avatar', 'catfacts',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['eurostat-population'].searchParams.get('geo')).toBe('DE')
    expect(urls['eurostat-population'].searchParams.get('time')).toBe('2025')
    expect(urls['eurostat-population'].searchParams.get('sex')).toBe('T')
    expect(urls['eurostat-population'].searchParams.get('age')).toBe('TOTAL')
    const eurostat = getApiById('eurostat-population')
    expect(eurostat?.fields.find((field) => field.id === 'year')?.max).toBe(2025)
    expect(eurostat?.fields.find((field) => field.id === 'year')?.step).toBe(1)
    expect(validateParameters(eurostat!, { country: 'DE', year: '2025.5' })).toHaveProperty('year')
    expect(validateParameters(eurostat!, { country: 'DE', year: '2009' })).toHaveProperty('year')
    expect(new URL(eurostat!.buildUrl({ country: 'DE', year: '2025.5' })).searchParams.get('time')).toBe('2025.5')
    expect(urls['bls-timeseries'].toString()).toBe('https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000')
    expect(getApiById('bls-timeseries')?.documentationUrl).toBe('https://www.bls.gov/developers/api_signature.htm')
    expect(getApiById('bls-timeseries')?.method ?? 'GET').toBe('GET')
    expect(getApiById('bls-timeseries')?.fields.find((field) => field.id === 'seriesId')?.options?.map((option) => option.value)).toEqual([
      'LNS14000000',
      'CUUR0000SA0',
      'CUUR0000SAF1',
    ])
    expect(getApiById('bls-timeseries')?.usageNote).toContain('Version 1.0')
    expect(getApiById('bls-timeseries')?.usageNote).toContain('25 queries per day')
    expect(getApiById('bls-timeseries')?.usageNote).not.toContain('automated access is prohibited')
    expect(getApiById('bls-timeseries')?.automatedVerification).toEqual({
      mode: 'enabled',
      retryOnRateLimit: false,
      rateLimitStatuses: [429],
      reason: expect.stringContaining('25 queries per day'),
      policyUrl: 'https://www.bls.gov/developers/api_FAQs.htm',
    })
    expect(urls['fema-disasters'].searchParams.get('$top')).toBe('5')
    expect(urls['fema-disasters'].searchParams.get('$orderby')).toBe('declarationDate desc')
    expect(getApiById('fema-disasters')?.usageNote).toContain('area-level')
    expect(urls['noaa-tides'].searchParams.get('station')).toBe('8518750')
    expect(urls['noaa-tides'].searchParams.get('product')).toBe('water_level')
    expect(urls['noaa-tides'].searchParams.get('date')).toBe('latest')
    expect(urls['noaa-tides'].searchParams.get('datum')).toBe('MLLW')
    expect(urls['noaa-tides'].searchParams.get('units')).toBe('metric')
    expect(urls['noaa-tides'].searchParams.get('time_zone')).toBe('gmt')
    expect(urls['noaa-tides'].searchParams.get('application')).toBe('Public_API_Workbench')
    expect(urls['noaa-tides'].searchParams.get('format')).toBe('json')
    expect(urls['rdap-domain-lookup'].pathname).toBe('/domain/google.com')
    expect(urls['languagetool-grammar-check'].toString()).toBe('https://api.languagetool.org/v2/check')
    expect(urls['doaj-search'].pathname).toBe('/api/search/articles/climate')
    expect(urls['pubchem-compound'].pathname).toContain('/compound/name/aspirin/property/')
    expect(urls['chembl-molecule'].pathname).toBe('/chembl/api/data/molecule/CHEMBL25.json')
    expect(urls['uniprot-protein'].pathname).toBe('/uniprotkb/P05067.json')
    expect(urls['rcsb-pdb-entry'].pathname).toBe('/rest/v1/core/entry/4HHB')
    expect(urls['ensembl-gene-lookup'].pathname).toBe('/lookup/id/ENSG00000157764')
    expect(urls['ensembl-gene-lookup'].searchParams.get('content-type')).toBe('application/json')
    expect(urls['obis-marine-occurrences'].searchParams.get('scientificname')).toBe('Delphinus delphis')
    expect(getApiById('obis-marine-occurrences')?.fields.find((field) => field.id === 'scientificName')?.minLength).toBe(1)
    expect(getApiById('obis-marine-occurrences')?.fields.find((field) => field.id === 'size')?.step).toBe(1)
    expect(new URL(getApiById('obis-marine-occurrences')!.buildUrl({ scientificName: 'Delphinus delphis', size: '2.5' })).searchParams.get('size')).toBe('2.5')
    expect(urls['worms-species-lookup'].pathname).toBe('/rest/AphiaRecordsByName/Delphinus%20delphis')
    expect(urls['paleobiodb-taxa'].searchParams.get('name')).toBe('Tyrannosaurus')
    expect(getApiById('obis-marine-occurrences')?.usageNote).toContain('QC flags')
    expect(getApiById('worms-species-lookup')?.usageNote).toContain('valid_AphiaID')
    expect(getApiById('worms-species-lookup')?.successNoContent).toEqual({ statuses: [204], data: [] })
    expect(getApiById('paleobiodb-taxa')?.usageNote).toContain('subtaxa')
    expect(urls['usgs-water-legacy'].hostname).toBe('api.waterdata.usgs.gov')
    expect(urls['usgs-water-legacy'].pathname).toBe('/ogcapi/v1/collections/latest-continuous/items')
    expect(urls['usgs-water-legacy'].searchParams.get('f')).toBe('json')
    expect(urls['usgs-water-legacy'].searchParams.get('monitoring_location_id')).toBe('USGS-01646500')
    expect(urls['usgs-water-legacy'].searchParams.get('parameter_code')).toBe('00060')
    expect(urls['usgs-water-legacy'].searchParams.get('limit')).toBe('1')
    expect(urls['rubygems-lookup'].pathname).toBe('/api/v1/gems/rails.json')
    expect(urls['nuget-package-lookup'].pathname).toBe('/v3/registration5-gz-semver2/newtonsoft.json/index.json')
    expect(urls['internet-archive-search'].searchParams.get('q')).toBe('singapore AND mediatype:texts')
    expect(urls['internet-archive-search'].searchParams.get('rows')).toBe('6')
    expect(urls['internet-archive-search'].searchParams.get('page')).toBe('1')
    expect(urls['internet-archive-search'].searchParams.get('output')).toBe('json')
    expect(urls['internet-archive-search'].searchParams.getAll('fl[]')).toEqual(['identifier', 'title', 'creator', 'date', 'mediatype', 'rights', 'licenseurl'])
    expect(urls['ipwhois-lookup'].pathname).toBe('/8.8.8.8')
    expect(getApiById('ipwhois-lookup')?.usageNote).toContain('1,000 requests/day')
    expect(getApiById('ipwhois-lookup')?.usageNote).toContain('counted per domain')
    expect(urls['newton-math-solver'].hostname).toBe('newton.vercel.app')
    expect(urls['newton-math-solver'].pathname).toBe('/api/v2/simplify/2x%2B2x')
    expect(getApiById('newton-math-solver')?.usageNote).toContain('community-maintained')
    expect(urls['datamuse-rhymes'].searchParams.get('sl')).toBe('orange')
    expect(urls['datamuse-rhymes'].searchParams.get('rel_rhy')).toBeNull()
    expect(urls['datamuse-rhymes'].searchParams.get('max')).toBe('8')
    expect(urls['datamuse-rhymes'].searchParams.get('md')).toBe('psr')
    expect(urls['datamuse-rhymes'].searchParams.get('ipa')).toBe('1')
    expect(getApiById('datamuse-rhymes')?.usageNote).toContain('2027-01-01')
    expect(urls['open5e-monster-search'].hostname).toBe('api.open5e.com')
    expect(urls['open5e-monster-search'].pathname).toBe('/v2/creatures/')
    expect(urls['open5e-monster-search'].searchParams.get('name__icontains')).toBe('dragon')
    expect(urls['open5e-monster-search'].searchParams.get('limit')).toBe('8')
    expect(urls['open5e-monster-search'].searchParams.get('fields')).toContain('challenge_rating')
    expect(urls['open5e-monster-search'].searchParams.get('document__fields')).toBe('name,key,gamesystem')
    expect(getApiById('open5e-monster-search')?.usageNote).toContain('Open5e V2')
    expect(urls['dicebear-avatar'].pathname).toBe('/9.x/identicon/svg')
    expect(urls['catfacts'].pathname).toBe('/fact')

    const languageToolApi = getApiById('languagetool-grammar-check')
    expect(languageToolApi?.bodyEncoding).toBe('form')
    expect(languageToolApi?.buildBody?.({ text: 'Hello' })).toEqual({ text: 'Hello', language: 'en-US' })

    const diceBearApi = getApiById('dicebear-avatar')
    expect(diceBearApi?.responseType).toBe('image')
    expect(diceBearApi?.headers).toEqual({ Accept: 'image/svg+xml' })
    expect(diceBearApi?.responseContentTypes).toEqual(['image/svg+xml'])
    expect(diceBearApi?.parseResponse).toBeUndefined()
  })

  it('builds the thirteen newly prioritized keyless API requests', () => {
    const ids = [
      'packagist-search', 'anilist-graphql', 'openverse-search', 'apple-itunes-search', 'jolpica-f1', 'hn-search-algolia', 'bank-of-canada-valet', 'swiss-transit-connections', 'nasa-power-climate', 'open-meteo-elevation', 'zippopotam-postcode', 'hebcal-calendar', 'aladhan-prayer-times',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['packagist-search'].hostname).toBe('packagist.org')
    expect(urls['packagist-search'].searchParams.get('q')).toBe('react')
    expect(urls['packagist-search'].searchParams.get('per_page')).toBe('8')
    const packagist = getApiById('packagist-search')!
    expect(packagist.fields.find((field) => field.id === 'query')).toMatchObject({ type: 'text', minLength: 1 })
    expect(packagist.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', min: 1, max: 20, step: 1 })
    expect(validateParameters(packagist, { query: '   ', limit: '8' })).toEqual({ query: 'Package search is required.' })
    expect(validateParameters(packagist, { query: 'react', limit: '8.5' })).toEqual({ limit: 'Packages must use increments of 1.' })
    expect(new URL(packagist.buildUrl({ query: '   ', limit: '8' })).searchParams.get('q')).toBe('')
    expect(new URL(packagist.buildUrl({ query: 'react', limit: ' 8.5 ' })).searchParams.get('per_page')).toBe('8.5')
    expect(urls['anilist-graphql'].pathname).toBe('/')
    expect(urls['openverse-search'].pathname).toBe('/v1/images/')
    expect(urls['openverse-search'].searchParams.get('q')).toBe('space')
    expect(urls['openverse-search'].searchParams.get('page_size')).toBe('8')
    expect(urls['apple-itunes-search'].hostname).toBe('itunes.apple.com')
    expect(urls['apple-itunes-search'].pathname).toBe('/search')
    expect(urls['apple-itunes-search'].searchParams.get('term')).toBe('Beatles')
    expect(urls['apple-itunes-search'].searchParams.get('media')).toBe('music')
    expect(urls['apple-itunes-search'].searchParams.get('entity')).toBe('song')
    expect(urls['apple-itunes-search'].searchParams.get('country')).toBe('sg')
    expect(urls['apple-itunes-search'].searchParams.get('limit')).toBe('8')
    expect(urls['jolpica-f1'].pathname).toBe('/ergast/f1/2025/drivers.json')
    expect(urls['jolpica-f1'].searchParams.get('limit')).toBe('8')
    expect(urls['hn-search-algolia'].pathname).toBe('/api/v1/search')
    expect(urls['hn-search-algolia'].searchParams.get('query')).toBe('OpenAI')
    expect(urls['hn-search-algolia'].searchParams.get('tags')).toBe('story')
    expect(urls['hn-search-algolia'].searchParams.get('hitsPerPage')).toBe('6')
    expect(urls['bank-of-canada-valet'].pathname).toBe('/valet/observations/FXUSDCAD/json')
    expect(urls['swiss-transit-connections'].pathname).toBe('/v1/connections')
    expect(urls['swiss-transit-connections'].searchParams.get('from')).toBe('Zurich')
    expect(urls['swiss-transit-connections'].searchParams.get('to')).toBe('Geneva')
    expect(urls['swiss-transit-connections'].searchParams.get('limit')).toBe('6')
    const swissTransit = getApiById('swiss-transit-connections')!
    expect(swissTransit.fields.find((field) => field.id === 'from')).toMatchObject({ type: 'text', minLength: 1 })
    expect(swissTransit.fields.find((field) => field.id === 'to')).toMatchObject({ type: 'text', minLength: 1 })
    expect(swissTransit.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', min: 1, max: 10, step: 1 })
    expect(validateParameters(swissTransit, { from: '   ', to: 'Geneva', limit: '6' })).toEqual({ from: 'Origin is required.' })
    expect(validateParameters(swissTransit, { from: 'Zurich', to: '   ', limit: '6' })).toEqual({ to: 'Destination is required.' })
    expect(validateParameters(swissTransit, { from: 'Zurich', to: 'Geneva', limit: '6.5' })).toEqual({ limit: 'Connections must use increments of 1.' })
    const blankSwissOrigin = new URL(swissTransit.buildUrl({ from: '   ', to: 'Geneva', limit: '6' }))
    const blankSwissDestination = new URL(swissTransit.buildUrl({ from: 'Zurich', to: '   ', limit: '6' }))
    const fractionalSwissLimit = new URL(swissTransit.buildUrl({ from: 'Zurich', to: 'Geneva', limit: ' 6.5 ' }))
    expect(blankSwissOrigin.searchParams.get('from')).toBe('')
    expect(blankSwissDestination.searchParams.get('to')).toBe('')
    expect(fractionalSwissLimit.searchParams.get('limit')).toBe('6.5')
    expect(urls['nasa-power-climate'].pathname).toBe('/api/temporal/daily/point')
    expect(urls['nasa-power-climate'].searchParams.get('community')).toBe('AG')
    expect(urls['nasa-power-climate'].searchParams.get('format')).toBe('JSON')
    expect(urls['nasa-power-climate'].searchParams.get('parameters')).toBe('T2M,PRECTOTCORR,WS10M,RH2M,ALLSKY_SFC_SW_DWN')
    expect(urls['open-meteo-elevation'].pathname).toBe('/v1/elevation')
    expect(urls['open-meteo-elevation'].searchParams.get('latitude')).toBe('1.3521')
    expect(urls['open-meteo-elevation'].searchParams.get('longitude')).toBe('103.8198')
    expect(urls['open-meteo-elevation'].searchParams.has('format')).toBe(false)
    expect(getApiById('open-meteo-elevation')?.usageNote).toContain('attribution to both the Copernicus programme and Open-Meteo')
    expect(urls['zippopotam-postcode'].hostname).toBe('api.zippopotam.us')
    expect(urls['zippopotam-postcode'].pathname).toBe('/us/10001')
    expect(getApiById('zippopotam-postcode')?.documentationUrl).toBe('https://docs.zippopotam.us/docs/v1/')

    expect(urls['hebcal-calendar'].hostname).toBe('www.hebcal.com')
    expect(urls['hebcal-calendar'].pathname).toBe('/hebcal')
    expect(urls['hebcal-calendar'].searchParams.get('year')).toBe('5787')
    expect(urls['hebcal-calendar'].searchParams.get('yt')).toBe('H')
    expect(urls['hebcal-calendar'].searchParams.get('month')).toBe('x')
    expect(urls['hebcal-calendar'].searchParams.get('i')).toBe('off')
    expect(urls['hebcal-calendar'].searchParams.get('leyning')).toBe('off')
    expect(urls['aladhan-prayer-times'].hostname).toBe('api.aladhan.com')
    const aladhan = getApiById('aladhan-prayer-times')
    const aladhanDate = aladhan?.fields.find((field) => field.id === 'date')?.defaultValue ?? ''
    const [aladhanYear, aladhanMonth, aladhanDay] = aladhanDate.split('-')
    expect(aladhan?.fields.find((field) => field.id === 'date')?.type).toBe('date')
    expect(urls['aladhan-prayer-times'].pathname).toBe(`/v1/timings/${aladhanDay}-${aladhanMonth}-${aladhanYear}`)
    expect(urls['aladhan-prayer-times'].searchParams.get('method')).toBe('11')
    expect(urls['aladhan-prayer-times'].searchParams.get('latitude')).toBe('1.3521')
    expect(urls['aladhan-prayer-times'].searchParams.get('longitude')).toBe('103.8198')

    const anilist = getApiById('anilist-graphql')
    expect(anilist?.method).toBe('POST')
    expect(anilist?.buildBody?.({ query: 'Steins Gate', mediaType: 'MANGA', limit: '4', page: '2' })).toEqual(expect.objectContaining({
      variables: expect.objectContaining({ search: 'Steins Gate', perPage: 4, page: 2, type: 'MANGA' }),
    }))
  })

  it('keeps Hebcal on the documented Hebrew-year SSOT without silent input correction', () => {
    const hebcal = getApiById('hebcal-calendar')
    expect(hebcal).toBeDefined()
    if (!hebcal) return
    expect(hebcal.fields.map((field) => field.id)).toEqual(['year', 'israel'])
    expect(hebcal.fields.find((field) => field.id === 'year')).toMatchObject({ type: 'number', defaultValue: '5787', min: 5700, max: 5800, step: 1 })
    expect(hebcal.fields.find((field) => field.id === 'israel')?.options).toEqual([{ label: 'Diaspora', value: 'off' }, { label: 'Israel', value: 'on' }])
    expect(validateParameters(hebcal, { year: '5787', israel: 'off' })).toEqual({})
    expect(validateParameters(hebcal, { year: '5787.5', israel: 'off' })).toHaveProperty('year')
    expect(validateParameters(hebcal, { year: '5787', israel: 'diaspora' })).toHaveProperty('israel')
    const malformed = new URL(hebcal.buildUrl({ year: '5787.5', israel: 'diaspora' }))
    expect(malformed.searchParams.get('year')).toBe('5787.5')
    expect(malformed.searchParams.get('i')).toBe('diaspora')
    expect(malformed.searchParams.get('yt')).toBe('H')
    expect(malformed.searchParams.get('month')).toBe('x')
    expect(hebcal.usageNote).toContain('CC BY 4.0')
    expect(getAutomatedVerificationPolicy(hebcal)).toMatchObject({ mode: 'enabled', retryOnRateLimit: false, rateLimitStatuses: [429] })
  })

  it('keeps Malaysia data.gov.my result limits in SSOT validation without silently rewriting explicit invalid values', () => {
    const cases = [
      { id: 'malaysia-core-cpi', valid: '12', below: '5', above: '61', fractional: '12.5' },
      { id: 'malaysia-household-income', valid: '10', below: '5', above: '31', fractional: '10.5' },
      { id: 'malaysia-population', valid: '10', below: '5', above: '58', fractional: '10.5' },
    ]

    for (const testCase of cases) {
      const api = getApiById(testCase.id)
      expect(api, testCase.id).toBeDefined()
      if (!api) continue

      expect(validateParameters(api, { limit: testCase.valid }), testCase.id).toEqual({})
      expect(validateParameters(api, { limit: testCase.below }), testCase.id).toHaveProperty('limit')
      expect(validateParameters(api, { limit: testCase.above }), testCase.id).toHaveProperty('limit')
      expect(validateParameters(api, { limit: testCase.fractional }), testCase.id).toHaveProperty('limit')

      expect(new URL(api.buildUrl({ limit: ` ${testCase.below} ` })).searchParams.get('limit'), `${testCase.id} below-min`).toBe(testCase.below)
      expect(new URL(api.buildUrl({ limit: ` ${testCase.above} ` })).searchParams.get('limit'), `${testCase.id} above-max`).toBe(testCase.above)
      expect(new URL(api.buildUrl({ limit: ` ${testCase.fractional} ` })).searchParams.get('limit'), `${testCase.id} fractional`).toBe(testCase.fractional)
    }
  })

  it('builds the latest 13 priority keyless API requests from the 2026-08-02 audit', () => {
    const ids = [
      'malaysia-core-cpi', 'malaysia-household-income', 'malaysia-population',
      'openfda-food-recalls', 'iconify-search', 'homebrew-formula-json',
      'npm-download-counts', 'geoboundaries-admin-boundaries', 'osrm-route',
      'opendota-pro-matches', 'openligadb-matches', 'uk-parliament-members', 'mlb-stats-api',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['malaysia-core-cpi'].hostname).toBe('api.data.gov.my')
    expect(urls['malaysia-core-cpi'].searchParams.get('id')).toBe('cpi_core')
    expect(urls['malaysia-core-cpi'].searchParams.get('filter')).toBe('overall@division')
    expect(urls['malaysia-core-cpi'].searchParams.get('limit')).toBe('12')
    const cpiApi = getApiById('malaysia-core-cpi')
    expect(cpiApi?.fields[0]?.id).toBe('limit')
    expect(new URL(cpiApi!.buildUrl({ limit: '18' })).searchParams.get('limit')).toBe('18')
    expect(urls['malaysia-household-income'].hostname).toBe('api.data.gov.my')
    expect(urls['malaysia-household-income'].searchParams.get('id')).toBe('hh_income')
    expect(urls['malaysia-household-income'].searchParams.get('limit')).toBe('10')
    const incomeApi = getApiById('malaysia-household-income')
    expect(incomeApi?.fields[0]?.id).toBe('limit')
    expect(new URL(incomeApi!.buildUrl({ limit: '14' })).searchParams.get('limit')).toBe('14')
    expect(urls['malaysia-population'].hostname).toBe('api.data.gov.my')
    expect(urls['malaysia-population'].searchParams.get('id')).toBe('population_malaysia')
    expect(urls['malaysia-population'].searchParams.get('filter')).toBe('both@sex,overall@age,overall@ethnicity')
    expect(urls['malaysia-population'].searchParams.get('limit')).toBe('10')
    const populationApi = getApiById('malaysia-population')
    expect(populationApi?.fields[0]?.id).toBe('limit')
    expect(new URL(populationApi!.buildUrl({ limit: '16' })).searchParams.get('limit')).toBe('16')
    expect(urls['openfda-food-recalls'].hostname).toBe('api.fda.gov')
    expect(urls['openfda-food-recalls'].pathname).toBe('/food/enforcement.json')
    expect(urls['openfda-food-recalls'].searchParams.get('search')).toBe('product_description:"peanut" OR reason_for_recall:"peanut"')
    expect(urls['iconify-search'].hostname).toBe('api.iconify.design')
    expect(urls['iconify-search'].pathname).toBe('/search')
    expect(urls['iconify-search'].searchParams.get('query')).toBe('home')
    expect(urls['iconify-search'].searchParams.get('limit')).toBe('32')
    expect(urls['homebrew-formula-json'].hostname).toBe('formulae.brew.sh')
    expect(urls['homebrew-formula-json'].pathname).toBe('/api/formula/node.json')
    const homebrewApi = getApiById('homebrew-formula-json')
    expect(homebrewApi?.fields.find((field) => field.id === 'formula')?.label).toBe('Formula or cask token')
    expect(new URL(homebrewApi!.buildUrl({ formula: 'postman', collection: 'cask' })).pathname).toBe('/api/cask/postman.json')
    expect(urls['npm-download-counts'].hostname).toBe('api.npmjs.org')
    expect(urls['npm-download-counts'].pathname).toBe('/downloads/point/last-week/react')
    expect(urls['geoboundaries-admin-boundaries'].hostname).toBe('www.geoboundaries.org')
    expect(urls['geoboundaries-admin-boundaries'].pathname).toBe('/api/current/gbOpen/SGP/ADM0/')
    expect(getApiById('geoboundaries-admin-boundaries')?.fields.find((field) => field.id === 'adminLevel')?.options?.map((option) => option.value)).toEqual(['ADM0', 'ADM1', 'ADM2', 'ADM3', 'ADM4', 'ADM5'])
    expect(getApiById('geoboundaries-admin-boundaries')?.usageNote).toContain('meanAreaSqKM')
    expect(urls['osrm-route'].hostname).toBe('router.project-osrm.org')
    expect(urls['osrm-route'].pathname).toBe('/route/v1/driving/103.8198,1.3521;103.851959,1.29027')
    expect(urls['osrm-route'].searchParams.get('alternatives')).toBe('1')
    const osrmApi = getApiById('osrm-route')!
    const osrmAlternatives = osrmApi.fields.find((field) => field.label === 'Alternatives')
    expect(osrmAlternatives?.id).toBe('alternatives')
    expect(osrmAlternatives?.step).toBe(1)
    expect(osrmApi.usageNote).toMatch(/reasonable, non-commercial/i)
    expect(osrmApi.usageNote).toMatch(/1 request per second/i)
    expect(osrmApi.automatedVerification).toMatchObject({
      mode: 'cadence-limited',
      minimumIntervalSeconds: 1,
      retryOnNon2xx: false,
      policyUrl: 'https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server',
    })
    expect(new URL(osrmApi.buildUrl({ startLatitude: '1.3521', startLongitude: '103.8198', endLatitude: '1.290270', endLongitude: '103.851959', alternatives: '3' })).searchParams.get('alternatives')).toBe('3')
    expect(new URL(osrmApi.buildUrl({ startLatitude: '1.3521', startLongitude: '103.8198', endLatitude: '1.290270', endLongitude: '103.851959', alternatives: '2.5' })).searchParams.get('alternatives')).toBe('2.5')
    expect(new URL(osrmApi.buildUrl({ startLatitude: '', startLongitude: '103.8198', endLatitude: '1.290270', endLongitude: '103.851959', alternatives: '1' })).pathname).toBe('/route/v1/driving/103.8198,;103.851959,1.29027')
    expect(validateParameters(osrmApi, { startLatitude: '', startLongitude: '103.8198', endLatitude: '1.290270', endLongitude: '103.851959', alternatives: '1' })).toHaveProperty('startLatitude')
    expect(validateParameters(osrmApi, { startLatitude: '1.3521', startLongitude: '103.8198', endLatitude: '1.290270', endLongitude: '103.851959', alternatives: '2.5' })).toHaveProperty('alternatives')
    expect(urls['opendota-pro-matches'].hostname).toBe('api.opendota.com')
    expect(urls['opendota-pro-matches'].pathname).toBe('/api/proMatches')
    expect(urls['opendota-pro-matches'].search).toBe('')
    expect(getApiById('opendota-pro-matches')?.fields).toEqual([])
    expect(getApiById('opendota-pro-matches')?.usageNote).toContain('does not expose a result-count limit')
    expect(urls['openligadb-matches'].hostname).toBe('api.openligadb.de')
    expect(urls['openligadb-matches'].pathname).toBe('/getmatchdata/bl1/2025/1')
    expect(getApiById('openligadb-matches')?.usageNote).toContain('60 requests per minute and IP')
    expect(getApiById('openligadb-matches')?.usageNote).toContain('ODbL 1.0')
    expect(urls['uk-parliament-members'].hostname).toBe('members-api.parliament.uk')
    expect(urls['uk-parliament-members'].pathname).toBe('/api/Members/Search')
    expect(urls['uk-parliament-members'].searchParams.get('Name')).toBe('Rishi')
    expect(urls['uk-parliament-members'].searchParams.get('take')).toBe('10')
    expect(urls['uk-parliament-members'].searchParams.has('limit')).toBe(false)
    const parliamentLimit = getApiById('uk-parliament-members')?.fields.find((field) => field.id === 'limit')
    expect(parliamentLimit?.max).toBe(20)
    expect(new URL(getApiById('uk-parliament-members')!.buildUrl({ query: 'a', limit: '50' })).searchParams.get('take')).toBe('20')
    expect(urls['mlb-stats-api'].hostname).toBe('statsapi.mlb.com')
    expect(urls['mlb-stats-api'].pathname).toBe('/api/v1/schedule')
    expect(urls['mlb-stats-api'].searchParams.get('sportId')).toBe('1')
  })

  it('builds the latest 15 browser-ready third-round API requests from the 2026-08-02 audit', () => {
    const ids = [
      'gleif-lei', 'fdic-bankfind', 'uk-food-hygiene', 'uk-flood-monitoring', 'unhcr-refugees',
      'hdx-humanitarian-datasets', 'open-meteo-climate', 'models-dev', 'vatcomply', 'mempool-space-btc',
      'metacpan', 'hexpm', 'pub-dev', 'go-module-proxy', 'flathub-appstream',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['gleif-lei'].hostname).toBe('api.gleif.org')
    expect(urls['gleif-lei'].searchParams.get('filter[entity.legalName]')).toBe('Royal Bank of Canada')
    expect(urls['gleif-lei'].searchParams.get('page[size]')).toBe('8')
    const gleif = getApiById('gleif-lei')!
    expect(gleif.documentationUrl).toBe('https://www.gleif.org/en/lei-data/gleif-api')
    expect(gleif.fields.find((field) => field.id === 'query')).toMatchObject({ minLength: 1 })
    expect(gleif.fields.find((field) => field.id === 'count')).toMatchObject({ min: 1, max: 50, step: 1 })
    const malformedGleif = new URL(gleif.buildUrl({ query: '   ', count: '8.5' }))
    expect(malformedGleif.searchParams.get('filter[entity.legalName]')).toBe('')
    expect(malformedGleif.searchParams.get('page[size]')).toBe('8.5')
    expect(validateParameters(gleif, { query: '   ', count: '8.5' })).toMatchObject({ query: expect.any(String), count: expect.any(String) })
    expect(urls['fdic-bankfind'].hostname).toBe('api.fdic.gov')
    expect(urls['fdic-bankfind'].pathname).toBe('/banks/institutions')
    expect(urls['fdic-bankfind'].searchParams.get('search')).toBe('NAME: WELLS FARGO')
    expect(urls['fdic-bankfind'].searchParams.has('q')).toBe(false)
    expect(urls['fdic-bankfind'].searchParams.get('limit')).toBe('6')

    const foodHygiene = getApiById('uk-food-hygiene')
    expect(foodHygiene?.headers).toEqual({ 'x-api-version': '2' })
    expect(urls['uk-food-hygiene'].hostname).toBe('api.ratings.food.gov.uk')
    expect(urls['uk-food-hygiene'].pathname).toBe('/Establishments')
    expect(urls['uk-food-hygiene'].searchParams.get('name')).toBe('Cafe')
    expect(urls['uk-food-hygiene'].searchParams.get('pageNumber')).toBe('1')
    expect(urls['uk-food-hygiene'].searchParams.get('pageSize')).toBe('5')
    expect(foodHygiene?.usageNote).toContain('lower better')

    expect(urls['uk-flood-monitoring'].hostname).toBe('environment.data.gov.uk')
    expect(urls['uk-flood-monitoring'].pathname).toBe('/flood-monitoring/id/stations')
    expect(urls['uk-flood-monitoring'].searchParams.get('riverName')).toBe('River Severn')
    expect(urls['uk-flood-monitoring'].searchParams.get('_limit')).toBe('8')
    expect(getApiById('uk-flood-monitoring')?.usageNote).toContain('exact-match filter')
    expect(urls['unhcr-refugees'].hostname).toBe('api.unhcr.org')
    expect(urls['unhcr-refugees'].pathname).toBe('/population/v1/population/')
    expect(urls['unhcr-refugees'].searchParams.get('coo')).toBe('SYR')
    expect(urls['unhcr-refugees'].searchParams.get('cf_type')).toBe('ISO')
    expect(urls['unhcr-refugees'].searchParams.get('yearFrom')).toBe('2025')
    expect(urls['unhcr-refugees'].searchParams.get('yearTo')).toBe('2025')
    expect(urls['unhcr-refugees'].searchParams.get('limit')).toBe('1')
    expect(getApiById('unhcr-refugees')?.fields.map((field) => field.id)).toEqual(['origin', 'year'])
    expect(getApiById('unhcr-refugees')?.fields.find((field) => field.id === 'origin')).toMatchObject({ minLength: 3, maxLength: 3 })
    expect(urls['hdx-humanitarian-datasets'].hostname).toBe('goadmin.ifrc.org')
    expect(urls['hdx-humanitarian-datasets'].pathname).toBe('/api/v2/event/')
    expect(urls['hdx-humanitarian-datasets'].searchParams.get('limit')).toBe('6')
    expect(urls['hdx-humanitarian-datasets'].searchParams.get('ordering')).toBe('-disaster_start_date')
    expect(urls['open-meteo-climate'].hostname).toBe('climate-api.open-meteo.com')
    expect(urls['open-meteo-climate'].pathname).toBe('/v1/climate')
    expect(urls['open-meteo-climate'].searchParams.get('daily')).toBe('temperature_2m_mean,precipitation_sum')
    expect(urls['models-dev'].hostname).toBe('huggingface.co')
    expect(urls['models-dev'].pathname).toBe('/api/models')
    expect(urls['models-dev'].searchParams.get('search')).toBe('gpt')
    expect(urls['models-dev'].searchParams.get('limit')).toBe('8')
    expect(urls['models-dev'].searchParams.get('full')).toBe('true')
    const modelsDev = getApiById('models-dev')!
    expect(modelsDev.fields.find((field) => field.id === 'query')).toMatchObject({ minLength: 1 })
    expect(modelsDev.fields.find((field) => field.id === 'count')).toMatchObject({ min: 1, max: 25, step: 1 })
    expect(validateParameters(modelsDev, { query: 'gpt', count: '3.5' })).toEqual({ count: 'Results must use increments of 1.' })
    expect(urls['vatcomply'].hostname).toBe('api.vatcomply.com')
    expect(urls['vatcomply'].pathname).toBe('/rates')
    expect(urls['vatcomply'].searchParams.get('base')).toBe('EUR')
    expect(urls['vatcomply'].searchParams.get('symbols')).toBe('USD,SGD,GBP')
    const vatcomply = getApiById('vatcomply')!
    expect(vatcomply.fields.find((field) => field.id === 'base')).toMatchObject({ minLength: 3, maxLength: 3, pattern: '[A-Za-z]{3}' })
    expect(vatcomply.fields.find((field) => field.id === 'symbols')).toMatchObject({ minLength: 3, pattern: '[A-Za-z]{3}(?:\\s*,\\s*[A-Za-z]{3})*' })
    expect(vatcomply.fields.find((field) => field.id === 'symbols')?.help).not.toContain('up to ten')
    expect(validateParameters(vatcomply, { base: ' eur ', symbols: 'usd, sgd, gbp' })).toEqual({})
    expect(new URL(vatcomply.buildUrl({ base: ' eur ', symbols: 'usd, sgd, gbp' })).searchParams.get('base')).toBe('EUR')
    expect(new URL(vatcomply.buildUrl({ base: ' eur ', symbols: 'usd, sgd, gbp' })).searchParams.get('symbols')).toBe('USD,SGD,GBP')
    expect(validateParameters(vatcomply, { base: 'EURO', symbols: 'USD,,GBP' })).toEqual({
      base: 'Base currency must be at most 3 characters.',
      symbols: 'Target currencies must be a comma-separated list of three-letter currency codes.',
    })
    expect(urls['mempool-space-btc'].hostname).toBe('mempool.space')
    expect(urls['mempool-space-btc'].pathname).toBe('/api/v1/fees/recommended')
    expect(getApiById('mempool-space-btc')?.description).toContain('recommended Bitcoin transaction fee rates')
    expect(getApiById('mempool-space-btc')?.description).not.toContain('chain health')

    expect(urls['metacpan'].hostname).toBe('fastapi.metacpan.org')
    expect(urls['metacpan'].pathname).toBe('/v1/module/_search')
    expect(urls['metacpan'].searchParams.get('q')).toBe('module.name:"Mojolicious" AND status:latest')
    expect(urls['metacpan'].searchParams.get('size')).toBe('6')
    expect(urls['hexpm'].hostname).toBe('hex.pm')
    expect(urls['hexpm'].pathname).toBe('/api/packages/ecto')
    expect(urls['pub-dev'].hostname).toBe('pub.dev')
    expect(urls['pub-dev'].pathname).toBe('/api/packages/riverpod')
    expect(urls['pub-dev'].search).toBe('')
    expect(urls['go-module-proxy'].hostname).toBe('proxy.golang.org')
    expect(urls['go-module-proxy'].pathname).toBe('/github.com/gin-gonic/gin/@v/list')
    expect(getApiById('go-module-proxy')?.responseType).toBe('text')
    expect(getApiById('go-module-proxy')?.responseContentTypes).toEqual(['text/plain'])
    expect(urls['flathub-appstream'].hostname).toBe('flathub.org')
    expect(urls['flathub-appstream'].pathname).toBe('/api/v2/appstream/org.gnome.Calculator')
    expect(urls['flathub-appstream'].search).toBe('')
    const flathub = getApiById('flathub-appstream')!
    expect(flathub.fields[0]).toMatchObject({ id: 'appId', minLength: 1 })
    expect(flathub.buildUrl({ appId: '' })).toBe('https://flathub.org/api/v2/appstream/')
    expect(validateParameters(flathub, { appId: '' })).toEqual({ appId: 'Flathub app ID is required.' })
  })

  it('builds the legacy fourth-round URLs still used by UI mappings', () => {
    const ids = ['usgs', 'usaspending', 'fiscal-data-treasury', 'wikidata-sparql', 'carbon-intensity-gb', 'met-museum-object-detail', 'met-museum-search', 'holidays']
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['usgs'].pathname).toBe('/earthquakes/feed/v1.0/summary/2.5_day.geojson')
    expect(urls['usaspending'].pathname).toBe('/api/v2/search/spending_by_award/')
    const awardsApi = getApiById('usaspending')
    expect(awardsApi?.fields.map((field) => field.id)).toEqual(['fiscalYear', 'limit'])
    expect(awardsApi?.fields.find((field) => field.id === 'fiscalYear')).toMatchObject({ type: 'number', min: 2008 })
    const defaultFiscalYear = Number(awardsApi?.fields.find((field) => field.id === 'fiscalYear')?.defaultValue)
    const customFiscalYear = Math.max(2008, defaultFiscalYear - 1)
    const awardsBody = awardsApi?.buildBody?.({ fiscalYear: String(customFiscalYear), limit: '5' }) as Record<string, unknown>
    expect(awardsBody).toMatchObject({ page: 1, limit: 5, sort: 'Base Obligation Date', order: 'desc', subawards: false })
    expect(awardsBody.filters).toEqual({
      time_period: [{ start_date: `${customFiscalYear - 1}-10-01`, end_date: `${customFiscalYear}-09-30`, date_type: 'new_awards_only' }],
      award_type_codes: ['A', 'B', 'C', 'D'],
    })
    expect(awardsBody.fields).toEqual(expect.arrayContaining(['Award ID', 'Recipient Name', 'Award Amount', 'Base Obligation Date', 'Awarding Agency', 'Funding Agency', 'Contract Award Type', 'Description']))
    expect(getApiById('usaspending')?.usageNote).toContain('date_type=new_awards_only')
    expect(getApiById('usaspending')?.usageNote).toContain('total_obligation')
    expect(urls['fiscal-data-treasury'].hostname).toBe('api.usaspending.gov')
    expect(urls['fiscal-data-treasury'].pathname).toBe('/api/v2/agency/020/')
    expect(urls['fiscal-data-treasury'].search).toBe('')
    expect(getApiById('fiscal-data-treasury')?.usageNote).toContain('does not itself return award obligations')
    expect(urls['wikidata-sparql'].hostname).toBe('query.wikidata.org')
    expect(urls['wikidata-sparql'].pathname).toBe('/sparql')
    expect(urls['wikidata-sparql'].searchParams.get('format')).toBe('json')
    expect(getApiById('wikidata-sparql')?.headers).toMatchObject({
      Accept: 'application/sparql-results+json',
      'Api-User-Agent': 'Public-API/0.1 (https://yapweijun1996.github.io/Public-API/)',
    })
    expect(getApiById('wikidata-sparql')?.usageNote).toContain('Api-User-Agent')
    expect(urls['carbon-intensity-gb'].hostname).toBe('api.carbonintensity.org.uk')
    expect(urls['carbon-intensity-gb'].pathname).toBe('/intensity')
    expect(urls['met-museum-object-detail'].pathname).toBe('/public/collection/v1/objects/436535')
    expect(urls['met-museum-search'].pathname).toBe('/public/collection/v1.1/search')
    expect(urls['met-museum-search'].searchParams.get('q')).toBe('singapore')
    expect(urls['met-museum-search'].searchParams.get('hasImages')).toBe('true')
    expect(urls['met-museum-search'].searchParams.get('offset')).toBe('0')
    expect(urls['met-museum-search'].searchParams.get('limit')).toBe('12')
    expect(urls['holidays'].hostname).toBe('nagerholidays.com')
    expect(urls['holidays'].pathname).toBe(`/api/v4/Holidays/SG/${new Date().getUTCFullYear()}`)
  })

  it('keeps Open Food Facts barcode validation and bounded v3 field projection fail-closed', () => {
    const api = getApiById('open-food-facts')
    expect(api).toBeDefined()
    if (!api) return
    const barcode = api.fields.find((field) => field.id === 'barcode')
    expect(barcode?.minLength).toBe(1)
    expect(barcode?.pattern).toBe('[0-9]+')
    const blank = new URL(api.buildUrl({ barcode: '   ' }))
    expect(blank.pathname).toBe('/api/v3/product/')
    const url = new URL(api.buildUrl({ barcode: '3017620422003' }))
    expect(url.pathname).toBe('/api/v3/product/3017620422003')
    expect(url.searchParams.get('fields')).toContain('product_name')
    expect(url.searchParams.get('fields')).toContain('nutriments')
    expect(api.usageNote).toContain('15 product reads/minute/IP')
  })

  it('keeps Open Library search validation and request construction fail-closed', () => {
    const api = getApiById('open-library-search')
    expect(api).toBeDefined()
    if (!api) return
    expect(api.fields.find((field) => field.id === 'query')?.minLength).toBe(1)
    expect(api.fields.find((field) => field.id === 'limit')?.step).toBe(1)
    const blank = new URL(api.buildUrl({ query: '   ', limit: '8' }))
    expect(blank.searchParams.get('q')).toBe('')
    const fractional = new URL(api.buildUrl({ query: 'artificial intelligence', limit: '2.5' }))
    expect(fractional.searchParams.get('limit')).toBe('2.5')
    expect(fractional.searchParams.get('fields')).toBe('key,title,author_name,first_publish_year,cover_i')
  })

  it('builds the latest 3 browser-ready fourth-round API requests from the 2026-08-02 audit', () => {
    const ids = ['openssf-scorecard', 'opencitations-index', 'vam-collections']
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['openssf-scorecard'].hostname).toBe('api.securityscorecards.dev')
    expect(urls['openssf-scorecard'].pathname).toBe('/projects/github.com/ossf/scorecard')
    expect(urls['opencitations-index'].hostname).toBe('api.opencitations.net')
    expect(urls['opencitations-index'].pathname).toBe('/index/v2/citation-count/doi:10.1109%2F5.771073')
    expect(urls['opencitations-index'].search).toBe('')
    expect(getApiById('opencitations-index')?.usageNote).toContain('180 requests/minute')
    expect(urls['vam-collections'].hostname).toBe('api.vam.ac.uk')
    expect(urls['vam-collections'].pathname).toBe('/v2/objects/search')
    expect(urls['vam-collections'].searchParams.get('q')).toBe('eastern')
    expect(urls['vam-collections'].searchParams.get('page_size')).toBe('6')
  })

  it('escapes DBLP title-search text while shared SSOT rejects invalid limits before execution', () => {
    const api = getApiById('dblp-search')
    expect(api).toBeDefined()
    if (!api) return
    const url = new URL(api.buildUrl({ query: 'agent "safety" \\ research', limit: '20' }))
    const query = url.searchParams.get('query') ?? ''
    expect(query).toContain(String.raw`LCASE("agent \"safety\" \\ research")`)
    expect(query).toContain('LIMIT 20')
    expect(api.fields.find((field) => field.id === 'limit')?.step).toBe(1)
    expect(validateParameters(api, { query: 'retrieval', limit: '2.5' })).toEqual({ limit: 'Results must use increments of 1.' })
    expect(validateParameters(api, { query: '   ', limit: '6' })).toHaveProperty('query')
    expect(new URL(api.buildUrl({ query: 'retrieval', limit: '999' })).searchParams.get('query')).toContain('LIMIT 999')
    expect(getAutomatedVerificationPolicy(api)).toMatchObject({ mode: 'enabled', retryOnRateLimit: false, rateLimitStatuses: [429] })
  })

  it('builds the retained Public-API 200 milestone requests', () => {
    const ids = [
      'github-global-advisories', 'dblp-search', 'citybikes-network', 'wikimedia-commons-search',
      'jsdelivr-package', 'canada-open-data-search', 'gbif-occurrence-search',
      'open-meteo-ensemble', 'world-bank-indicator-explorer', 'exchange-rate-current', 'circl-vulnerability',
    ]
    const urls = Object.fromEntries(ids.map((id) => {
      const api = getApiById(id)
      expect(api, id).toBeDefined()
      if (!api) throw new Error(`Missing API: ${id}`)
      return [id, new URL(api.buildUrl(getDefaultParameters(api)))]
    }))

    expect(urls['github-global-advisories'].hostname).toBe('api.github.com')
    expect(urls['github-global-advisories'].pathname).toBe('/advisories')
    expect(urls['github-global-advisories'].searchParams.get('ecosystem')).toBe('npm')
    expect(urls['github-global-advisories'].searchParams.get('severity')).toBe('high')
    const githubAdvisories = getApiById('github-global-advisories')
    const githubSeverity = githubAdvisories?.fields.find((field) => field.id === 'severity')
    const githubLimit = githubAdvisories?.fields.find((field) => field.id === 'limit')
    expect(githubSeverity?.options?.map((option) => option.value)).toEqual(['low', 'medium', 'high', 'critical'])
    expect(githubLimit?.step).toBe(1)
    expect(validateParameters(githubAdvisories!, { ecosystem: 'npm', severity: 'high', limit: '2.5' })).toEqual({ limit: 'Advisories must use increments of 1.' })
    expect(new URL(githubAdvisories!.buildUrl({ ecosystem: 'npm', severity: 'high', limit: '2.5' })).searchParams.get('per_page')).toBe('2.5')
    expect(new URL(githubAdvisories!.buildUrl({ ...getDefaultParameters(githubAdvisories!), severity: 'medium' })).searchParams.get('severity')).toBe('medium')
    expect(urls['dblp-search'].hostname).toBe('sparql.dblp.org')
    expect(urls['dblp-search'].pathname).toBe('/sparql')
    const dblpQuery = urls['dblp-search'].searchParams.get('query') ?? ''
    expect(dblpQuery).toContain('dblp:title ?title')
    expect(dblpQuery).toContain('LCASE("large language models")')
    expect(dblpQuery).toContain('LIMIT 6')
    expect(getApiById('dblp-search')?.headers?.Accept).toBe('application/sparql-results+json')
    expect(urls['citybikes-network'].pathname).toBe('/v2/networks/youbike-taipei')
    expect(urls['wikimedia-commons-search'].hostname).toBe('commons.wikimedia.org')
    expect(urls['wikimedia-commons-search'].searchParams.get('origin')).toBe('*')
    expect(urls['wikimedia-commons-search'].searchParams.get('gsrnamespace')).toBe('6')
    expect(getApiById('wikimedia-commons-search')?.headers?.['Api-User-Agent']).toBe('Public-API/0.1 (https://yapweijun1996.github.io/Public-API/)')
    expect(urls['jsdelivr-package'].hostname).toBe('data.jsdelivr.com')
    expect(urls['jsdelivr-package'].pathname).toBe('/v1/packages/npm/react')
    expect(urls['canada-open-data-search'].hostname).toBe('open.canada.ca')
    expect(urls['canada-open-data-search'].pathname).toBe('/data/api/3/action/package_search')
    expect(urls['gbif-occurrence-search'].hostname).toBe('api.gbif.org')
    expect(urls['gbif-occurrence-search'].pathname).toBe('/v1/occurrence/search')
    expect(urls['open-meteo-ensemble'].hostname).toBe('ensemble-api.open-meteo.com')
    expect(urls['open-meteo-ensemble'].pathname).toBe('/v1/ensemble')
    expect(urls['open-meteo-ensemble'].searchParams.get('models')).toBe('icon_seamless_eps')
    expect(urls['open-meteo-ensemble'].searchParams.get('hourly')).toBe('temperature_2m')
    expect(urls['open-meteo-ensemble'].searchParams.get('timezone')).toBe('Asia/Singapore')
    expect(urls['world-bank-indicator-explorer'].hostname).toBe('api.worldbank.org')
    expect(urls['world-bank-indicator-explorer'].pathname).toBe('/v2/country/SGP/indicator/SP.DYN.LE00.IN')
    expect(urls['world-bank-indicator-explorer'].searchParams.get('date')).toBe('2015:2025')
    expect(urls['world-bank-indicator-explorer'].searchParams.get('per_page')).toBe('141')
    expect(urls['exchange-rate-current'].hostname).toBe('open.er-api.com')
    expect(urls['exchange-rate-current'].pathname).toBe('/v6/latest/SGD')
    expect(urls['circl-vulnerability'].hostname).toBe('vulnerability.circl.lu')
    expect(urls['circl-vulnerability'].pathname).toBe('/api/vulnerability/CVE-2021-44228')
  })

  it('keeps GBIF occurrence scientific-name and limit intent in shared SSOT validation', () => {
    const gbif = getApiById('gbif-occurrence-search')
    expect(gbif).toBeDefined()
    if (!gbif) return

    expect(gbif.fields.find((field) => field.id === 'scientificName')?.minLength).toBe(1)
    expect(gbif.fields.find((field) => field.id === 'limit')).toMatchObject({ min: 1, max: 20, step: 1 })
    expect(validateParameters(gbif, { scientificName: '   ', limit: '6' })).toHaveProperty('scientificName')
    expect(validateParameters(gbif, { scientificName: 'Panthera leo', limit: '6.5' })).toEqual({ limit: 'Records must use increments of 1.' })

    const blank = new URL(gbif.buildUrl({ scientificName: '   ', limit: '6' }))
    expect(blank.searchParams.get('scientificName')).toBe('')
    const fractional = new URL(gbif.buildUrl({ scientificName: 'Panthera leo', limit: '6.5' }))
    expect(fractional.searchParams.get('limit')).toBe('6.5')
  })

  it('rejects fractional World Bank years before execution', () => {
    const worldBank = getApiById('world-bank-indicator-explorer')
    expect(worldBank).toBeDefined()
    if (!worldBank) return

    expect(validateParameters(worldBank, { ...getDefaultParameters(worldBank), startYear: '2015.5', endYear: '2025.5' })).toEqual({
      startYear: 'Start year must use increments of 1.',
      endYear: 'End year must use increments of 1.',
    })
  })

  it('does not silently rewrite invalid World Bank years in the URL builder', () => {
    const worldBank = getApiById('world-bank-indicator-explorer')
    expect(worldBank).toBeDefined()
    if (!worldBank) return

    const fractionalRange = new URL(worldBank.buildUrl({ country: 'SGP', indicator: 'SP.POP.TOTL', startYear: ' 2015.5 ', endYear: ' 2025.5 ' }))
    expect(fractionalRange.searchParams.get('date')).toBe('2015.5:2025.5')
  })

  it('keeps every allowed World Bank year in one documented page and validates country-code syntax', () => {
    const worldBank = getApiById('world-bank-indicator-explorer')
    expect(worldBank).toBeDefined()
    if (!worldBank) return

    expect(worldBank.fields.find((field) => field.id === 'country')).toMatchObject({
      minLength: 2,
      maxLength: 3,
      pattern: '[A-Za-z]{2,3}',
      patternDescription: 'must contain exactly two or three letters for an ISO 3166-1 alpha-2 or alpha-3 country code.',
    })
    expect(worldBank.fields.find((field) => field.id === 'startYear')).toMatchObject({ step: 1 })
    expect(worldBank.fields.find((field) => field.id === 'endYear')).toMatchObject({ step: 1 })
    expect(validateParameters(worldBank, { ...getDefaultParameters(worldBank), country: 'SG' })).toEqual({})
    expect(validateParameters(worldBank, { ...getDefaultParameters(worldBank), country: 'S1' })).toEqual({
      country: 'Country code must contain exactly two or three letters for an ISO 3166-1 alpha-2 or alpha-3 country code.',
    })
    const fullRange = new URL(worldBank.buildUrl({ country: 'sg', indicator: 'SP.POP.TOTL', startYear: '1960', endYear: '2100' }))
    expect(fullRange.pathname).toBe('/v2/country/SG/indicator/SP.POP.TOTL')
    expect(fullRange.searchParams.get('date')).toBe('1960:2100')
    expect(fullRange.searchParams.get('per_page')).toBe('141')
    expect(2100 - 1960 + 1).toBe(141)
  })

  it('keeps the Open-Meteo Ensemble request on one documented model and variable-unit surface', () => {
    const ensemble = getApiById('open-meteo-ensemble')
    expect(ensemble).toBeDefined()
    expect(ensemble?.fields.find((field) => field.id === 'forecastDays')).toMatchObject({ min: 1, max: 7, step: 1 })
    expect(validateParameters(ensemble!, { latitude: '1.3521', longitude: '103.8198', variable: 'temperature_2m', forecastDays: '3.5' })).toEqual({ forecastDays: 'Forecast days must use increments of 1.' })
    expect(new URL(ensemble!.buildUrl({ latitude: '1.3521', longitude: '103.8198', variable: 'temperature_2m', forecastDays: ' 3.5 ' })).searchParams.get('forecast_days')).toBe('3.5')

    for (const variable of ['temperature_2m', 'precipitation', 'wind_speed_10m']) {
      const url = new URL(ensemble!.buildUrl({ variable, forecastDays: '7' }))
      expect(url.origin).toBe('https://ensemble-api.open-meteo.com')
      expect(url.pathname).toBe('/v1/ensemble')
      expect(url.searchParams.get('models')).toBe('icon_seamless_eps')
      expect(url.searchParams.get('hourly')).toBe(variable)
      expect(url.searchParams.get('forecast_days')).toBe('7')
      expect(url.searchParams.get('timezone')).toBe('Asia/Singapore')
    }
  })

  it('builds the NHTSA vehicle recall request', () => {
    const api = getApiById('nhtsa-vehicle-recalls')
    expect(api, 'nhtsa-vehicle-recalls').toBeDefined()
    if (!api) return

    const url = new URL(api.buildUrl(getDefaultParameters(api)))
    expect(url.hostname).toBe('api.nhtsa.gov')
    expect(url.pathname).toBe('/recalls/recallsByVehicle')
    expect(url.searchParams.get('make')).toBe('honda')
    expect(url.searchParams.get('model')).toBe('accord')
    expect(url.searchParams.get('modelYear')).toBe('2020')
    expect(url.searchParams.has('format')).toBe(false)
    expect(api.fields.find((field) => field.id === 'year')?.step).toBe(1)
    const blank = new URL(api.buildUrl({ make: ' ', model: ' ', year: '2020' }))
    expect(blank.searchParams.get('make')).toBe('')
    expect(blank.searchParams.get('model')).toBe('')
    const fractional = new URL(api.buildUrl({ make: 'honda', model: 'accord', year: '2020.5' }))
    expect(fractional.searchParams.get('modelYear')).toBe('2020.5')
  })


  it('builds repaired browser-direct health contracts', () => {
    const dictionary = getApiById('free-dictionary')
    const bank = getApiById('bank-of-canada-valet')
    const aniList = getApiById('anilist-graphql')
    const datacite = getApiById('datacite-search')
    const mlb = getApiById('mlb-stats-api')
    expect(dictionary).toBeDefined()
    expect(bank).toBeDefined()
    expect(aniList).toBeDefined()
    expect(datacite).toBeDefined()
    expect(mlb).toBeDefined()
    if (!dictionary || !bank || !aniList || !mlb) return

    expect(new URL(dictionary.buildUrl(getDefaultParameters(dictionary))).hostname).toBe('freedictionaryapi.com')
    const bankUrl = new URL(bank.buildUrl(getDefaultParameters(bank)))
    expect(bankUrl.searchParams.get('start_date')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(bankUrl.searchParams.get('end_date')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const aniListBody = JSON.stringify(aniList.buildBody?.(getDefaultParameters(aniList)))
    expect(aniListBody).not.toContain('hasPreviousPage')
    expect(getDefaultParameters(mlb)).not.toHaveProperty('teamId')
    expect(new URL(mlb.buildUrl(getDefaultParameters(mlb))).searchParams.has('teamId')).toBe(false)
  })


  it('keeps provider automation restrictions in the catalog SSOT', () => {
    const languageTool = getApiById('languagetool-grammar-check')
    const circl = getApiById('circl-vulnerability')
    const countries = getApiById('countries')
    const color = getApiById('color-api')
    const internetArchive = getApiById('internet-archive-search')
    expect(languageTool).toBeDefined()
    expect(circl).toBeDefined()
    expect(countries).toBeDefined()
    expect(color).toBeDefined()
    if (!languageTool || !circl || !color || !internetArchive) return

    expect(getApiById('nominatim-search')).toBeUndefined()
    expect(getAgentExecutionPolicy(languageTool)).toEqual({
      mode: 'manual-only',
      reason: 'LanguageTool’s free public endpoint prohibits automated requests. Use a self-hosted or Enterprise instance for automation.',
      policyUrl: 'https://dev.languagetool.org/public-http-api.html',
    })
    expect(getAgentExecutionPolicy(circl)).toEqual({
      mode: 'manual-only',
      reason: 'CIRCL requires automated clients to send a meaningful User-Agent containing a contact URL or email. Browser JavaScript cannot set that protected header, so generic structured execution cannot satisfy the provider policy.',
      policyUrl: 'https://vulnerability.circl.lu/.well-known/api-policy.json',
    })
    expect(getAgentExecutionPolicy(internetArchive)).toEqual({
      mode: 'manual-only',
      reason: 'Internet Archive requires every automated request to send a descriptive User-Agent identifying the tool/version and AI model. Browser JavaScript cannot set that protected header, so structured agent execution cannot satisfy the provider bot policy.',
      policyUrl: 'https://archive.org/developers/bots.html',
    })
    expect(internetArchive.usageNote).toContain('Human-triggered interactive searches')
    expect(internetArchive.usageNote).toContain('does not guarantee the copyright status')
    expect(getAgentExecutionPolicy(color)).toEqual({ mode: 'enabled' })

    const manualOnly = apiCatalog.filter((api) => getAgentExecutionPolicy(api).mode === 'manual-only')
    expect(manualOnly.map((api) => api.id).sort()).toEqual(['circl-vulnerability', 'internet-archive-search', 'languagetool-grammar-check'])
    for (const api of manualOnly) {
      const policy = getAgentExecutionPolicy(api)
      expect(policy.mode).toBe('manual-only')
      if (policy.mode !== 'manual-only') continue
      expect(policy.reason.trim().length, api.id).toBeGreaterThan(20)
      expect(policy.policyUrl, api.id).toMatch(/^https:\/\//)
    }
  })

  it('pins the exact Internet Archive Advanced Search request without repairing explicit invalid input', () => {
    const archive = getApiById('internet-archive-search')
    expect(archive).toBeDefined()
    if (!archive) return
    expect(archive.fields.find((field) => field.id === 'query')).toMatchObject({ minLength: 1 })
    expect(validateParameters(archive, { query: ' ', mediaType: 'texts' })).toHaveProperty('query')
    expect(validateParameters(archive, { query: 'singapore', mediaType: 'images' })).toHaveProperty('mediaType')

    const explicitBlank = new URL(archive.buildUrl({ query: '', mediaType: '' }))
    expect(explicitBlank.searchParams.get('q')).toBe(' AND mediatype:')
    const defaults = new URL(archive.buildUrl({}))
    expect(defaults.searchParams.get('q')).toBe('singapore AND mediatype:texts')
    expect([...defaults.searchParams.keys()]).toEqual(['q', 'rows', 'page', 'output', 'fl[]', 'fl[]', 'fl[]', 'fl[]', 'fl[]', 'fl[]', 'fl[]'])
  })

  it('pins GitHub public repository listing semantics and the current supported REST API version', () => {
    const github = apiCatalog.find((api) => api.id === 'github')
    expect(github).toBeDefined()
    const url = new URL(github!.buildUrl({}))
    expect(url.origin).toBe('https://api.github.com')
    expect(url.pathname).toBe('/users/octocat/repos')
    expect(url.searchParams.get('type')).toBe('owner')
    expect(url.searchParams.get('sort')).toBe('full_name')
    expect(url.searchParams.get('direction')).toBe('asc')
    expect(url.searchParams.get('per_page')).toBe('8')
    expect(github!.headers).toMatchObject({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' })
  })

  it('keeps Canada Open Data keyword and row-count intent exact in the shared SSOT', () => {
    const canada = getApiById('canada-open-data-search')
    expect(canada).toBeDefined()
    if (!canada) return

    expect(canada.fields.find((field) => field.id === 'query')).toMatchObject({ type: 'text', defaultValue: 'artificial intelligence', minLength: 1 })
    expect(canada.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', defaultValue: '6', min: 1, max: 20, step: 1 })
    expect(validateParameters(canada, { query: '   ', limit: '3' })).toEqual({ query: 'Catalogue search is required.' })
    expect(validateParameters(canada, { query: 'climate', limit: '3.5' })).toEqual({ limit: 'Results must use increments of 1.' })

    const fractional = new URL(canada.buildUrl({ query: 'climate', limit: '3.5' }))
    expect(fractional.searchParams.get('q')).toBe('climate')
    expect(fractional.searchParams.get('rows')).toBe('3.5')
    const blankQuery = new URL(canada.buildUrl({ query: '   ', limit: '3' }))
    expect(blankQuery.searchParams.get('q')).toBe('')
  })

  it('models DEV published articles as a Forem v1 exact-tag request', () => {
    const devto = getApiById('devto')
    expect(devto).toBeDefined()
    if (!devto) return
    const defaults = getDefaultParameters(devto)
    const url = new URL(devto.buildUrl(defaults))
    expect(url.origin).toBe('https://dev.to')
    expect(url.pathname).toBe('/api/articles')
    expect(url.searchParams.get('tag')).toBe('javascript')
    expect(url.searchParams.get('per_page')).toBe('8')
    expect(url.searchParams.get('page')).toBe('1')
    expect(devto.headers).toEqual({ Accept: 'application/vnd.forem.api-v1+json' })
    expect(devto.fields.find((field) => field.id === 'tag')).toMatchObject({ type: 'text', defaultValue: 'javascript', minLength: 1, maxLength: 50 })
    expect(devto.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', defaultValue: '8', min: 1, max: 20, step: 1 })
    expect(validateParameters(devto, { tag: 'javascript', limit: '8.5' })).toEqual({ limit: 'Articles must use increments of 1.' })
    expect(validateParameters(devto, { tag: '   ', limit: '8' })).toEqual({ tag: 'Tag is required.' })
    const fractional = new URL(devto.buildUrl({ tag: 'javascript', limit: '8.5' }))
    expect(fractional.searchParams.get('per_page')).toBe('8.5')
    const blankTag = new URL(devto.buildUrl({ tag: '   ', limit: '8' }))
    expect(blankTag.searchParams.get('tag')).toBe('')
  })

  it('models Hacker News item lookup as a validated request-bound item ID', () => {
    const hn = apiCatalog.find((api) => api.id === 'hacker-news')
    expect(hn).toBeDefined()
    const field = hn!.fields.find((candidate) => candidate.id === 'itemId')
    expect(field).toMatchObject({ type: 'text', defaultValue: '8863', pattern: '[1-9][0-9]*', minLength: 1, maxLength: 15 })
    const url = new URL(hn!.buildUrl({ itemId: '2921983' }))
    expect(url.origin).toBe('https://hacker-news.firebaseio.com')
    expect(url.pathname).toBe('/v0/item/2921983.json')
    expect(url.searchParams.get('print')).toBe('pretty')
    expect(validateParameters(hn!, { ...getDefaultParameters(hn!), itemId: '0' })).toHaveProperty('itemId')
  })

  it('models NVD CPE search parameters in the shared request SSOT', () => {
    const nvdCpe = getApiById('nvd-cpe-search')
    expect(nvdCpe).toBeDefined()
    if (!nvdCpe) return

    expect(nvdCpe.fields.map((field) => field.id)).toEqual(['query', 'limit'])
    expect(nvdCpe.fields.find((field) => field.id === 'query')).toMatchObject({ type: 'text', defaultValue: 'openssl', minLength: 1 })
    expect(nvdCpe.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', defaultValue: '8', min: 1, max: 20, step: 1 })
    expect(validateParameters(nvdCpe, { query: '', limit: '8' })).toHaveProperty('query')
    expect(validateParameters(nvdCpe, { query: 'postgresql', limit: '6.5' })).toHaveProperty('limit')
    expect(validateParameters(nvdCpe, { query: 'postgresql', limit: '6' })).toEqual({})

    const url = new URL(nvdCpe.buildUrl({ query: ' postgresql ', limit: '6' }))
    expect(url.origin).toBe('https://services.nvd.nist.gov')
    expect(url.pathname).toBe('/rest/json/cpes/2.0')
    expect(url.searchParams.get('keywordSearch')).toBe('postgresql')
    expect(url.searchParams.get('resultsPerPage')).toBe('6')
    const explicitInvalid = new URL(nvdCpe.buildUrl({ query: '   ', limit: '8.5' }))
    expect(explicitInvalid.searchParams.get('keywordSearch')).toBe('')
    expect(explicitInvalid.searchParams.get('resultsPerPage')).toBe('8.5')
  })

  it('models NVD CVE description search parameters in the shared request SSOT', () => {
    const nvdCves = getApiById('nvd-cves')
    expect(nvdCves).toBeDefined()
    if (!nvdCves) return

    expect(nvdCves.fields.map((field) => field.id)).toEqual(['query', 'limit'])
    expect(nvdCves.fields.find((field) => field.id === 'query')).toMatchObject({ type: 'text', defaultValue: 'postgresql', minLength: 1, maxLength: 100 })
    expect(nvdCves.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', defaultValue: '8', min: 1, max: 20, step: 1 })
    expect(validateParameters(nvdCves, { query: '', limit: '8' })).toHaveProperty('query')
    expect(validateParameters(nvdCves, { query: 'remote code', limit: '6.5' })).toHaveProperty('limit')
    expect(validateParameters(nvdCves, { query: 'remote code', limit: '6' })).toEqual({})

    const url = new URL(nvdCves.buildUrl({ query: ' remote code ', limit: '6' }))
    expect(url.origin).toBe('https://services.nvd.nist.gov')
    expect(url.pathname).toBe('/rest/json/cves/2.0')
    expect(url.searchParams.get('keywordSearch')).toBe('remote code')
    expect(url.searchParams.get('resultsPerPage')).toBe('6')
    expect(url.searchParams.has('keywordExactMatch')).toBe(false)
    const explicitInvalid = new URL(nvdCves.buildUrl({ query: '   ', limit: '8.5' }))
    expect(explicitInvalid.searchParams.get('keywordSearch')).toBe('')
    expect(explicitInvalid.searchParams.get('resultsPerPage')).toBe('8.5')
    expect(apiCatalog.filter((api) => matchesApiSearch(api, 'NVD CVE Search')).map(({ id }) => id)).toEqual(['nvd-cves'])
  })

  it('preserves explicit invalid NVD CVE detail input for shared validation', () => {
    const detail = getApiById('nvd-cve-detail')
    expect(detail).toBeDefined()
    if (!detail) return

    expect(validateParameters(detail, { cve: '' })).toHaveProperty('cve')
    const explicitBlank = new URL(detail.buildUrl({ cve: '   ' }))
    expect(explicitBlank.searchParams.get('cveId')).toBe('')
    const valid = new URL(detail.buildUrl({ cve: ' CVE-2024-3094 ' }))
    expect(valid.searchParams.get('cveId')).toBe('CVE-2024-3094')
  })

  it('models NVD recently modified CVEs as a bounded runtime last-modified window', () => {
    const recent = getApiById('nvd-recent-cves')
    expect(recent).toBeDefined()
    if (!recent) return

    const field = recent.fields.find((candidate) => candidate.id === 'lookbackDays')
    expect(field).toMatchObject({ type: 'select', defaultValue: '7' })
    expect(field?.options?.map(({ value }) => value)).toEqual(['1', '7', '30', '90', '120'])
    expect(validateParameters(recent, { lookbackDays: '7' })).toEqual({})
    expect(validateParameters(recent, { lookbackDays: '14' })).toHaveProperty('lookbackDays')
    expect(() => recent.buildUrl({ lookbackDays: '14' })).toThrow('Unsupported NVD modified-window lookback')

    const url = new URL(recent.buildUrl({ lookbackDays: '7' }))
    const repeatedUrl = new URL(recent.buildUrl({ lookbackDays: '7' }))
    const start = Date.parse(url.searchParams.get('lastModStartDate') ?? '')
    const end = Date.parse(url.searchParams.get('lastModEndDate') ?? '')
    expect(url.origin).toBe('https://services.nvd.nist.gov')
    expect(url.pathname).toBe('/rest/json/cves/2.0')
    expect(url.searchParams.get('resultsPerPage')).toBe('8')
    expect(end - start).toBe(7 * 86_400_000)
    expect(repeatedUrl.toString()).toBe(url.toString())
    expect(Math.abs(Date.now() - end)).toBeLessThan(60_000)
  })

  it('keeps provider-specific automated verification cadence in the catalog SSOT', () => {
    const celestrak = getApiById('celestrak-satellites')
    const stackExchange = getApiById('stack-exchange')
    const openAlex = getApiById('openalex-works-search')
    const coinGecko = getApiById('coingecko-keyless-market')
    const wikidata = getApiById('wikidata-sparql')
    const lichess = getApiById('lichess-top-players')
    const github = getApiById('github')
    const githubAdvisories = getApiById('github-global-advisories')
    const exchangeRate = getApiById('exchange-rate-current')
    const color = getApiById('color-api')
    const aniList = getApiById('anilist-graphql')
    const datacite = getApiById('datacite-search')
    const nvdApis = ['nvd-cpe-search', 'nvd-cve-detail', 'nvd-cves', 'nvd-recent-cves'].map((id) => getApiById(id))
    expect(celestrak).toBeDefined()
    expect(stackExchange).toBeDefined()
    expect(openAlex).toBeDefined()
    expect(coinGecko).toBeDefined()
    expect(wikidata).toBeDefined()
    expect(lichess).toBeDefined()
    expect(github).toBeDefined()
    expect(githubAdvisories).toBeDefined()
    expect(exchangeRate).toBeDefined()
    expect(color).toBeDefined()
    expect(aniList).toBeDefined()
    expect(datacite).toBeDefined()
    if (!celestrak || !stackExchange || !openAlex || !coinGecko || !wikidata || !lichess || !github || !githubAdvisories || !exchangeRate || !color || !aniList || !datacite || nvdApis.some((api) => !api)) return

    expect(getAutomatedVerificationPolicy(celestrak)).toEqual({
      mode: 'cadence-limited',
      minimumIntervalSeconds: 7200,
      retryOnNon2xx: false,
      reason: 'CelesTrak asks machine clients to download GP data only once per update and to stop immediately after any non-200 response.',
      policyUrl: 'https://celestrak.org/usage-policy.php',
    })
    expect(getAutomatedVerificationPolicy(stackExchange)).toEqual({
      mode: 'cadence-limited',
      minimumIntervalSeconds: 60,
      retryOnNon2xx: false,
      reason: 'Stack Exchange says semantically identical API requests should not be made more than once per minute; automated verification uses one request per cadence window and no same-run non-2xx retry.',
      policyUrl: 'https://api.stackexchange.com/docs/throttle',
    })
    for (const nvd of nvdApis) {
      expect(getAutomatedVerificationPolicy(nvd!)).toEqual({
        mode: 'cadence-limited',
        minimumIntervalSeconds: 6,
        retryOnNon2xx: false,
        reason: 'NVD documents a public limit of five requests per rolling 30 seconds and recommends sleeping six seconds between requests. Automated verification must use an isolated cadence-aware journey and stop after a non-2xx response instead of joining the generic sweep.',
        policyUrl: 'https://nvd.nist.gov/developers/start-here',
      })
      expect(nvd?.usageNote).toMatch(/five requests in a rolling 30-second window/i)
    }
    expect(getAutomatedVerificationPolicy(openAlex)).toEqual({
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'OpenAlex requires exponential backoff after HTTP 429. Generic health verification records the first 429 and defers another provider request to a later independent run instead of retrying immediately.',
      policyUrl: 'https://help.openalex.org/api/errors/',
    })
    expect(getAutomatedVerificationPolicy(datacite)).toEqual({
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'DataCite returns HTTP 429 when rate limited and recommends incremental backoff after failures. Generic health verification records the first 429 and defers another provider request to a later independent run instead of immediately retrying.',
      policyUrl: 'https://support.datacite.org/docs/rate-limit',
    })
    expect(getAutomatedVerificationPolicy(coinGecko)).toEqual({
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'CoinGecko says HTTP 429 means the rate limit was exceeded and all requests, including errors, count toward the per-minute limit. Generic health verification records the first 429 and defers another provider request to a later independent run instead of immediately adding another counted call.',
      policyUrl: 'https://docs.coingecko.com/docs/errors-and-rate-limits',
    })
    expect(getAutomatedVerificationPolicy(wikidata)).toEqual({
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'Wikidata Query Service says HTTP 429 clients must wait until the Retry-After window before repeating the query; generic health verification records the first 429 and defers another provider request to a later independent run.',
      policyUrl: 'https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual',
    })
    expect(getAutomatedVerificationPolicy(lichess)).toEqual({
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'Lichess says clients receiving HTTP 429 must wait a full minute before resuming API usage; generic health verification records the first 429 and defers another provider request to a later independent run.',
      policyUrl: 'https://lichess.org/page/api-tips',
    })
    for (const githubApi of [github, githubAdvisories]) {
      expect(getAutomatedVerificationPolicy(githubApi)).toEqual({
        mode: 'enabled',
        retryOnRateLimit: false,
        rateLimitStatuses: [403, 429],
        reason: 'GitHub documents HTTP 403 or 429 for primary or secondary rate-limit exhaustion and requires clients to wait for x-ratelimit-reset, Retry-After, or at least one minute before retrying. Generic health verification therefore records the first 403/429 and defers another provider request to a later independent run.',
        policyUrl: 'https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api',
      })
    }
    expect(getAutomatedVerificationPolicy(exchangeRate)).toEqual({
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'ExchangeRate-API says its open endpoint returns HTTP 429 when rate limited and that the rate limit remains in effect for about 20 minutes. Generic health verification records the first 429 and defers another provider request to a later independent run instead of retrying within that window.',
      policyUrl: 'https://www.exchangerate-api.com/docs/free',
    })
    expect(getAutomatedVerificationPolicy(aniList)).toEqual({
      mode: 'enabled',
      retryOnRateLimit: false,
      reason: 'AniList documents Retry-After and X-RateLimit-Reset on HTTP 429, and may temporarily lower its normal quota during degraded service. Generic health verification records the first 429 and defers another provider request to a later independent run.',
      policyUrl: 'https://docs.anilist.co/guide/rate-limiting',
    })
    expect(getAutomatedVerificationPolicy(color)).toEqual({ mode: 'enabled' })
  })

  it('keeps the current release snapshot aligned with executable agent and automated-verification policy', () => {
    const runnable = apiCatalog.filter((api) => getAgentExecutionPolicy(api).mode === 'enabled')
    const manualOnly = apiCatalog.filter((api) => getAgentExecutionPolicy(api).mode === 'manual-only').map((api) => api.id).sort()
    const cadenceLimited = runnable.filter((api) => getAutomatedVerificationPolicy(api).mode === 'cadence-limited').map((api) => api.id).sort()
    const automatedVerificationEligible = runnable.filter((api) => getAutomatedVerificationPolicy(api).mode === 'enabled')

    expect(apiCatalog).toHaveLength(196)
    expect(runnable).toHaveLength(193)
    expect(automatedVerificationEligible).toHaveLength(184)
    expect(manualOnly).toEqual(['circl-vulnerability', 'internet-archive-search', 'languagetool-grammar-check'])
    expect(cadenceLimited).toEqual(['celestrak-satellites', 'launch-library-upcoming', 'nvd-cpe-search', 'nvd-cve-detail', 'nvd-cves', 'nvd-recent-cves', 'open-trivia', 'osrm-route', 'stack-exchange'])

    const snapshot = phase2DocSource.match(/Current local candidate snapshot \([^)]*\): \*\*(\d+) catalog APIs \/ (\d+) structured-agent runnable \/ (\d+) automated-verification-eligible/)
    expect(snapshot, 'Phase-2 current snapshot must publish the executable catalog/policy counts').not.toBeNull()
    expect(snapshot?.slice(1).map(Number)).toEqual([apiCatalog.length, runnable.length, automatedVerificationEligible.length])
  })

  it('finds API demos by ID', () => {
    expect(getApiById('weather')?.provider).toBe('Open-Meteo')
    expect(getApiById('missing')).toBeUndefined()
  })

  it('validates required, numeric, text-length, date, and select constraints from the field SSOT', () => {
    const weather = getApiById('weather')
    const people = getApiById('people')
    const geoBoundaries = getApiById('geoboundaries-admin-boundaries')
    const aladhan = getApiById('aladhan-prayer-times')
    expect(weather).toBeDefined()
    expect(people).toBeDefined()
    expect(geoBoundaries).toBeDefined()
    expect(aladhan).toBeDefined()
    if (!weather || !people || !geoBoundaries || !aladhan) return

    expect(validateParameters(weather, { latitude: '', longitude: '200' })).toEqual({
      latitude: 'Latitude is required.',
      longitude: 'Longitude must be at most 180.',
    })
    expect(validateParameters(people, { count: '3', nationality: 'xx' })).toEqual({
      nationality: 'Nationality must be one of the supported options.',
    })
    expect(validateParameters(geoBoundaries, { countryIso: 'SG', adminLevel: 'ADM0' })).toEqual({
      countryIso: 'Country ISO must be at least 3 characters.',
    })
    expect(validateParameters(geoBoundaries, { countryIso: 'SGP', adminLevel: 'ADM9' })).toEqual({
      adminLevel: 'Admin level must be one of the supported options.',
    })
    expect(validateParameters(aladhan, { latitude: '1.3521', longitude: '103.8198', method: '11', date: '2026-02-30' })).toEqual({
      date: 'Date must be a valid date in YYYY-MM-DD format.',
    })
  })

  it('validates provider-documented machine-readable text formats before request construction', () => {
    const countries = getApiById('countries')
    const color = getApiById('color-api')
    const geoBoundaries = getApiById('geoboundaries-admin-boundaries')
    const uniprot = getApiById('uniprot-protein')
    const pdb = getApiById('rcsb-pdb-entry')
    const ensembl = getApiById('ensembl-gene-lookup')
    const firstEpss = getApiById('first-epss')
    const circl = getApiById('circl-vulnerability')
    const nvd = getApiById('nvd-cve-detail')
    expect(countries).toBeDefined()
    expect(color).toBeDefined()
    expect(geoBoundaries).toBeDefined()
    expect(uniprot).toBeDefined()
    expect(pdb).toBeDefined()
    expect(ensembl).toBeDefined()
    expect(firstEpss).toBeDefined()
    expect(circl).toBeDefined()
    expect(nvd).toBeDefined()
    if (!countries || !color || !geoBoundaries || !uniprot || !pdb || !ensembl || !firstEpss || !circl || !nvd) return

    const countryCodeField = countries.fields.find((field) => field.id === 'code')
    expect(countryCodeField).toMatchObject({
      minLength: 2,
      maxLength: 3,
      pattern: '[A-Za-z]{2,3}',
      patternDescription: 'must contain exactly two or three letters for an ISO 3166-1 alpha-2 or alpha-3 country code.',
    })
    expect(validateParameters(countries, { code: 'SG' })).toEqual({})
    expect(validateParameters(countries, { code: 'SGP' })).toEqual({})
    expect(validateParameters(countries, { code: 'S1' })).toEqual({ code: 'Country code must contain exactly two or three letters for an ISO 3166-1 alpha-2 or alpha-3 country code.' })
    expect(countries.buildUrl({ code: 'sgp' })).toBe('https://api.worldbank.org/v2/country/SGP?format=json')

    const colorField = color.fields.find((field) => field.id === 'hex')
    expect(colorField).toMatchObject({
      pattern: '#?(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})',
      patternDescription: 'must be a 3- or 6-digit hexadecimal color, with an optional leading #.',
    })
    expect(validateParameters(color, { hex: '#fff' })).toEqual({})
    expect(validateParameters(color, { hex: '00ffa6' })).toEqual({})
    expect(validateParameters(color, { hex: 'GGGGGG' })).toEqual({
      hex: 'Hex color must be a 3- or 6-digit hexadecimal color, with an optional leading #.',
    })

    const geoCountryField = geoBoundaries.fields.find((field) => field.id === 'countryIso')
    expect(geoCountryField).toMatchObject({
      minLength: 3,
      maxLength: 3,
      pattern: '[A-Za-z]{3}',
      patternDescription: 'must contain exactly three letters (an ISO 3166-1 alpha-3 code or the special ALL code).',
    })
    expect(validateParameters(geoBoundaries, { countryIso: 'ALL', adminLevel: 'ADM0' })).toEqual({})
    expect(validateParameters(geoBoundaries, { countryIso: '123', adminLevel: 'ADM0' })).toEqual({
      countryIso: 'Country ISO must contain exactly three letters (an ISO 3166-1 alpha-3 code or the special ALL code).',
    })


    const uniprotField = uniprot.fields.find((field) => field.id === 'accession')
    expect(uniprotField).toMatchObject({
      pattern: '[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2}',
      patternDescription: 'must be a valid 6- or 10-character UniProtKB accession.',
    })
    expect(validateParameters(uniprot, { accession: 'P05067' })).toEqual({})
    expect(validateParameters(uniprot, { accession: 'A0A023GPI8' })).toEqual({})
    expect(validateParameters(uniprot, { accession: 'INVALID' })).toEqual({
      accession: 'UniProt accession must be a valid 6- or 10-character UniProtKB accession.',
    })

    const pdbField = pdb.fields.find((field) => field.id === 'entryId')
    expect(pdbField).toMatchObject({
      minLength: 4,
      maxLength: 12,
      pattern: '(?:[A-Za-z0-9]{4}|[Pp][Dd][Bb]_0000[A-Za-z0-9]{4})',
      patternDescription: 'must be a four-character PDB ID or a transitional pdb_0000XXXX extended alias for an entry that still has a legacy ID.',
    })
    expect(validateParameters(pdb, { entryId: '4HHB' })).toEqual({})
    expect(validateParameters(pdb, { entryId: 'pdb_00004hhb' })).toEqual({})
    expect(new URL(pdb.buildUrl({ entryId: 'pdb_00004hhb' })).pathname).toBe('/rest/v1/core/entry/4HHB')
    expect(validateParameters(pdb, { entryId: 'pdb_10004hhb' })).toEqual({
      entryId: 'PDB entry ID must be a four-character PDB ID or a transitional pdb_0000XXXX extended alias for an entry that still has a legacy ID.',
    })

    const ensemblField = ensembl.fields.find((field) => field.id === 'geneId')
    expect(ensemblField).toMatchObject({
      pattern: 'ENS[A-Z]*G[0-9]{11}',
      patternDescription: 'must be an unversioned Ensembl gene stable ID such as ENSG00000157764.',
    })
    expect(validateParameters(ensembl, { geneId: ' ENSG00000157764 ' })).toEqual({})
    expect(new URL(ensembl.buildUrl({ geneId: ' ENSG00000157764 ' })).pathname).toBe('/lookup/id/ENSG00000157764')
    for (const invalidGeneId of ['ENST00000646891', 'ENSG00000157764.16', 'not-a-stable-id']) {
      expect(validateParameters(ensembl, { geneId: invalidGeneId }), invalidGeneId).toEqual({
        geneId: 'Ensembl gene ID must be an unversioned Ensembl gene stable ID such as ENSG00000157764.',
      })
    }

    for (const api of [firstEpss, circl, nvd]) {
      const cveField = api.fields.find((field) => field.id === 'cve')
      expect(cveField).toMatchObject({
        pattern: 'CVE-[0-9]{4}-[0-9]{4,}',
        patternDescription: 'must use the CVE-YYYY-NNNN format with four or more sequence digits.',
      })
      expect(validateParameters(api, { cve: 'CVE-2021-44228' })).toEqual({})
      expect(validateParameters(api, { cve: 'not-a-cve' })).toEqual({
        cve: `${cveField?.label} must use the CVE-YYYY-NNNN format with four or more sequence digits.`,
      })
    }
    expect(new URL(nvd.buildUrl({ cve: 'CVE-2024-3094' })).searchParams.get('cveId')).toBe('CVE-2024-3094')
  })

  it('validates provider-documented ISO country-code representations before provider execution', () => {
    const unhcr = getApiById('unhcr-refugees')
    const apple = getApiById('apple-itunes-search')
    const zippopotam = getApiById('zippopotam-postcode')
    expect(unhcr).toBeDefined()
    expect(apple).toBeDefined()
    expect(zippopotam).toBeDefined()
    if (!unhcr || !apple || !zippopotam) return

    const unhcrOrigin = unhcr.fields.find((field) => field.id === 'origin')
    expect(unhcrOrigin).toMatchObject({
      minLength: 3,
      maxLength: 3,
      pattern: '[A-Za-z]{3}',
      patternDescription: 'must contain exactly three letters for an ISO 3166-1 alpha-3 country code.',
    })
    expect(validateParameters(unhcr, { origin: 'syr', year: '2025' })).toEqual({})
    expect(validateParameters(unhcr, { origin: '123', year: '2025' })).toEqual({
      origin: 'Origin country ISO3 must contain exactly three letters for an ISO 3166-1 alpha-3 country code.',
    })

    for (const [api, fieldId, valid, invalid] of [
      [apple, 'country', 'sg', '12'],
      [zippopotam, 'country', 'us', '1x'],
    ] as const) {
      const field = api.fields.find((candidate) => candidate.id === fieldId)
      expect(field).toMatchObject({
        minLength: 2,
        maxLength: 2,
        pattern: '[A-Za-z]{2}',
        patternDescription: 'must contain exactly two letters for an ISO 3166-1 alpha-2 country code.',
      })
      expect(validateParameters(api, { ...getDefaultParameters(api), [fieldId]: valid })).toEqual({})
      expect(validateParameters(api, { ...getDefaultParameters(api), [fieldId]: invalid })).toEqual({
        [fieldId]: `${field?.label} must contain exactly two letters for an ISO 3166-1 alpha-2 country code.`,
      })
    }
  })

  it('keeps HN Algolia search input exact for shared pre-network validation', () => {
    const hn = apiCatalog.find((candidate) => candidate.id === 'hn-search-algolia')
    expect(hn).toBeDefined()
    if (!hn) return

    expect(hn.fields.find((field) => field.id === 'query')).toMatchObject({ type: 'text', minLength: 1 })
    expect(hn.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', min: 1, max: 20, step: 1 })

    const defaults = getDefaultParameters(hn)
    expect(validateParameters(hn, { ...defaults, query: '   ' })).toHaveProperty('query')
    expect(validateParameters(hn, { ...defaults, limit: '6.5' })).toHaveProperty('limit')
    expect(validateParameters(hn, { ...defaults, tag: 'poll' })).toHaveProperty('tag')

    const blank = new URL(hn.buildUrl({ query: '   ', tag: 'story', limit: '6' }))
    expect(blank.searchParams.get('query')).toBe('')
    const fractional = new URL(hn.buildUrl({ query: 'OpenAI', tag: 'story', limit: ' 6.5 ' }))
    expect(fractional.searchParams.get('hitsPerPage')).toBe('6.5')
    const unsupportedTag = new URL(hn.buildUrl({ query: 'OpenAI', tag: 'poll', limit: '6' }))
    expect(unsupportedTag.searchParams.get('tags')).toBe('poll')
  })

  it('uses HN Algolia parenthesized OR tag syntax for stories and comments', () => {
    const hn = apiCatalog.find((candidate) => candidate.id === 'hn-search-algolia')
    expect(hn).toBeDefined()
    const combined = new URL(hn!.buildUrl({ query: 'agent', tag: '(story,comment)', limit: '9' }))
    expect(combined.searchParams.get('query')).toBe('agent')
    expect(combined.searchParams.get('tags')).toBe('(story,comment)')
    expect(combined.searchParams.get('hitsPerPage')).toBe('9')
    const contentType = hn!.fields.find((field) => field.id === 'tag')
    expect(contentType?.options?.map((option) => option.value)).toContain('(story,comment)')
  })

  it('keeps Apple iTunes media and entity semantics compatible in one declared result-type field', () => {
    const apple = getApiById('apple-itunes-search')
    expect(apple).toBeDefined()
    if (!apple) return

    expect(apple.fields.map((field) => field.id)).toEqual(['query', 'entity', 'country', 'limit'])
    expect(apple.fields.find((field) => field.id === 'query')).toMatchObject({ minLength: 1 })
    expect(apple.fields.find((field) => field.id === 'limit')).toMatchObject({ min: 1, max: 20, step: 1 })
    const entity = apple.fields.find((field) => field.id === 'entity')
    expect(entity).toMatchObject({ type: 'select', defaultValue: 'song' })
    expect(entity?.options?.map((option) => option.value)).toEqual([
      'song', 'musicTrack', 'album', 'musicArtist', 'musicVideo', 'mix', 'podcast', 'podcastAuthor',
    ])

    const songUrl = new URL(apple.buildUrl({ ...getDefaultParameters(apple), entity: 'song' }))
    expect(songUrl.searchParams.get('media')).toBe('music')
    expect(songUrl.searchParams.get('entity')).toBe('song')

    const podcastUrl = new URL(apple.buildUrl({ ...getDefaultParameters(apple), entity: 'podcast' }))
    expect(podcastUrl.searchParams.get('media')).toBe('podcast')
    expect(podcastUrl.searchParams.get('entity')).toBe('podcast')

    expect(validateParameters(apple, { ...getDefaultParameters(apple), entity: 'bogus' })).toEqual({
      entity: 'Result type must be one of the supported options.',
    })
    const malformed = new URL(apple.buildUrl({ query: '   ', entity: 'bogus', country: '12', limit: '2.5' }))
    expect(malformed.searchParams.get('term')).toBe('')
    expect(malformed.searchParams.get('entity')).toBe('bogus')
    expect(malformed.searchParams.get('country')).toBe('12')
    expect(malformed.searchParams.get('limit')).toBe('2.5')
  })

  it('keeps TVmaze show search non-empty and preserves explicit invalid input for shared validation', () => {
    const tvmaze = getApiById('tvmaze-search')
    expect(tvmaze).toBeDefined()
    if (!tvmaze) return

    expect(tvmaze.fields).toEqual([
      expect.objectContaining({ id: 'show', type: 'text', defaultValue: 'severance', minLength: 1 }),
    ])
    expect(validateParameters(tvmaze, { show: '' })).toEqual({ show: 'Show title is required.' })
    expect(tvmaze.buildUrl({ show: '   ' })).toBe('https://api.tvmaze.com/search/shows?q=')
    expect(tvmaze.buildUrl({ show: '  friends  ' })).toBe('https://api.tvmaze.com/search/shows?q=friends')
    expect(tvmaze.usageNote).toContain('CC BY-SA')
    expect(tvmaze.usageNote).toContain('20 calls per 10 seconds')
    expect(tvmaze.usageNote).toContain('HTTP 429')
  })

  it('keeps Rick and Morty character search non-empty and preserves explicit invalid filters for shared validation', () => {
    const rickMorty = getApiById('rick-morty-characters')
    expect(rickMorty).toBeDefined()
    if (!rickMorty) return

    expect(rickMorty.fields[0]).toMatchObject({ id: 'name', type: 'text', defaultValue: 'Rick', minLength: 1 })
    expect(validateParameters(rickMorty, { name: '', status: 'alive' })).toEqual({ name: 'Character name is required.' })
    expect(validateParameters(rickMorty, { name: 'Rick', status: 'retired' })).toEqual({ status: 'Status must be one of the supported options.' })
    expect(rickMorty.buildUrl({ name: '   ', status: 'alive' })).toBe('https://rickandmortyapi.com/api/character?name=&status=alive')
    expect(rickMorty.buildUrl({ name: '  Rick  ', status: 'retired' })).toBe('https://rickandmortyapi.com/api/character?name=Rick&status=retired')
    expect(rickMorty.usageNote).toContain('without an ownership claim')
    expect(rickMorty.usageNote).toContain('Do not treat character images as BSD-licensed reusable media')
  })

  it('keeps non-JSON response contracts explicit and unambiguous', () => {
    for (const api of apiCatalog) {
      if (api.parseResponse) expect(api.responseType, `${api.id} custom parser must declare text transport`).toBe('text')
      if (api.responseType === 'text') expect(api.parseResponse, `${api.id} text transport must declare its parser`).toBeTypeOf('function')
      if (api.responseType === 'image') expect(api.parseResponse, `${api.id} image transport must not reuse the text parser`).toBeUndefined()
      if (api.responseType) {
        expect(api.responseContentTypes?.length, `${api.id} non-JSON transport must declare accepted Content-Type values`).toBeGreaterThan(0)
        for (const contentType of api.responseContentTypes ?? []) {
          expect(contentType, `${api.id} response Content-Type must be canonical lowercase media type only`).toBe(contentType.toLowerCase())
          expect(contentType, `${api.id} response Content-Type must not include parameters`).not.toContain(';')
          expect(contentType, `${api.id} response Content-Type must be a media type`).toMatch(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/)
        }
      }
    }
  })

  it('keeps declared successful no-content mappings bounded to successful HTTP statuses', () => {
    for (const api of apiCatalog) {
      if (!api.successNoContent) continue
      expect(api.successNoContent.statuses.length, api.id).toBeGreaterThan(0)
      expect(new Set(api.successNoContent.statuses).size, api.id).toBe(api.successNoContent.statuses.length)
      for (const status of api.successNoContent.statuses) {
        expect(status, `${api.id} no-content status`).toBeGreaterThanOrEqual(200)
        expect(status, `${api.id} no-content status`).toBeLessThan(300)
      }
    }
  })

  it('keeps every select default inside its declared option set', () => {
    for (const api of apiCatalog) {
      for (const field of api.fields.filter((candidate) => candidate.type === 'select')) {
        expect(field.options?.length, `${api.id}.${field.id} must declare select options`).toBeGreaterThan(0)
        expect(field.options?.some((option) => option.value === field.defaultValue), `${api.id}.${field.id} default must be a supported option`).toBe(true)
      }
    }
  })
  it('models npm Registry Search text and size as one shared request SSOT', () => {
    const npmSearch = getApiById('npm-search')
    expect(npmSearch).toBeDefined()
    if (!npmSearch) return

    const defaults = getDefaultParameters(npmSearch)
    expect(defaults).toMatchObject({ query: 'react', limit: '8' })
    expect(npmSearch.fields.find((field) => field.id === 'query')).toMatchObject({ type: 'text', minLength: 1 })
    expect(npmSearch.fields.find((field) => field.id === 'limit')).toMatchObject({ type: 'number', min: 1, max: 20, step: 1 })
    expect(validateParameters(npmSearch, { query: 'react', limit: '8.5' })).toEqual({ limit: 'Packages must use increments of 1.' })
    expect(new URL(npmSearch.buildUrl({ query: 'react', limit: '8.5' })).searchParams.get('size')).toBe('8.5')

    const url = new URL(npmSearch.buildUrl(defaults))
    expect(url.origin).toBe('https://registry.npmjs.org')
    expect(url.pathname).toBe('/-/v1/search')
    expect(url.searchParams.get('text')).toBe('react')
    expect(url.searchParams.get('size')).toBe('8')
    expect(url.searchParams.has('from')).toBe(false)

    const custom = new URL(npmSearch.buildUrl({ query: 'web components', limit: '12' }))
    expect(custom.searchParams.get('text')).toBe('web components')
    expect(custom.searchParams.get('size')).toBe('12')
  })

})
