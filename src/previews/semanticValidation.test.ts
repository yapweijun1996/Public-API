import { describe, expect, it } from 'vitest'
import {
  exactBodylessGetRequestLimit,
  finiteNumber,
  formatOptionalCount,
  isRecord,
  nonNegativeInteger,
  nonNegativeSafeInteger,
  optionalTrimmedText,
  positiveInteger,
  positiveSafeInteger,
  trimmedText,
} from './semanticValidation'

describe('strict semantic validation primitives', () => {
  it('accepts plain records but rejects arrays, null and primitives', () => {
    expect(isRecord({ id: 1 })).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('object')).toBe(false)
  })

  it('trims text without coercing non-strings or accepting blank strings', () => {
    expect(trimmedText('  value  ')).toBe('value')
    expect(trimmedText('   ')).toBeUndefined()
    expect(trimmedText(123)).toBeUndefined()
  })

  it('accepts only real finite JSON numbers without numeric-string coercion', () => {
    expect(finiteNumber(1.25)).toBe(1.25)
    expect(finiteNumber(-4)).toBe(-4)
    expect(finiteNumber('1.25')).toBeUndefined()
    expect(finiteNumber(Number.POSITIVE_INFINITY)).toBeUndefined()
  })

  it('keeps strict integer semantics without numeric-string or fractional coercion', () => {
    expect(positiveInteger(1)).toBe(1)
    expect(positiveInteger(0)).toBeUndefined()
    expect(positiveInteger('1')).toBeUndefined()
    expect(nonNegativeInteger(0)).toBe(0)
    expect(nonNegativeInteger(-1)).toBeUndefined()
    expect(nonNegativeInteger(1.5)).toBeUndefined()
  })

  it('keeps safe-integer variants bounded to exact JavaScript integer identity', () => {
    expect(positiveSafeInteger(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER)
    expect(positiveSafeInteger(Number.MAX_SAFE_INTEGER + 1)).toBeUndefined()
    expect(nonNegativeSafeInteger(0)).toBe(0)
    expect(nonNegativeSafeInteger(-1)).toBeUndefined()
  })

  it('distinguishes absent optional text from malformed non-string text', () => {
    expect(optionalTrimmedText(undefined)).toEqual({ malformed: false })
    expect(optionalTrimmedText(null)).toEqual({ malformed: false })
    expect(optionalTrimmedText('  hello ')).toEqual({ value: 'hello', malformed: false })
    expect(optionalTrimmedText('  ')).toEqual({ value: undefined, malformed: false })
    expect(optionalTrimmedText(0)).toEqual({ malformed: true })
  })

  it('binds exact request limits only to the same bodyless GET transport', () => {
    const pattern = /^https:\/\/example\.com\/items\?limit=([1-9]\d*)$/
    const requestUrl = 'https://example.com/items?limit=10'
    expect(exactBodylessGetRequestLimit(requestUrl, { url: requestUrl, method: 'GET' }, pattern, 1, 20)).toEqual({ valid: true, limit: 10, transportBound: true })
    expect(exactBodylessGetRequestLimit(requestUrl, undefined, pattern, 1, 20)).toEqual({ valid: true, limit: 10, transportBound: false })
    expect(exactBodylessGetRequestLimit(requestUrl, { url: requestUrl, method: 'POST' }, pattern, 1, 20)).toEqual({ valid: false, transportBound: false })
    expect(exactBodylessGetRequestLimit(requestUrl, { url: requestUrl, method: 'GET', body: {} }, pattern, 1, 20)).toEqual({ valid: false, transportBound: false })
    expect(exactBodylessGetRequestLimit(requestUrl, { url: 'https://example.com/items?limit=9', method: 'GET' }, pattern, 1, 20)).toEqual({ valid: false, transportBound: false })
  })

  it('formats missing counts as unavailable rather than manufacturing zero', () => {
    expect(formatOptionalCount(undefined)).toBe('Unavailable')
    expect(formatOptionalCount(0)).toBe('0')
    expect(formatOptionalCount(1234)).toBe('1,234')
  })
})
