import { describe, expect, it } from 'vitest';
import { decideHealthRetry, isRateLimitFailure } from './health-retry-policy.mjs';

describe('health retry policy', () => {
  const rateLimitBackoffPolicy = { mode: 'enabled', retryOnRateLimit: false };
  const githubRateLimitPolicy = { mode: 'enabled', retryOnRateLimit: false, rateLimitStatuses: [403, 429] };

  it('recognizes runtime rate-limit classification and HTTP 429', () => {
    expect(isRateLimitFailure({ errorType: 'rate-limit', httpStatus: 429 })).toBe(true);
    expect(isRateLimitFailure({ errorType: 'http', httpStatus: '429' })).toBe(true);
    expect(isRateLimitFailure({ errorType: 'timeout', httpStatus: '' })).toBe(false);
    expect(isRateLimitFailure({ errorType: 'http-error', httpStatus: 403 }, githubRateLimitPolicy)).toBe(true);
    expect(isRateLimitFailure({ errorType: 'http-error', httpStatus: 403 }, rateLimitBackoffPolicy)).toBe(false);
  });

  it('defers a provider 429 when the enabled SSOT policy disables same-run rate-limit retry', () => {
    expect(decideHealthRetry({ errorType: 'rate-limit', httpStatus: 429 }, rateLimitBackoffPolicy)).toEqual({ retry: false, reason: 'rate-limit-backoff' });
  });

  it('defers provider-defined alternate rate-limit statuses without treating every 403 as a rate limit', () => {
    expect(decideHealthRetry({ errorType: 'http-error', httpStatus: 403 }, githubRateLimitPolicy)).toEqual({ retry: false, reason: 'rate-limit-backoff' });
    expect(decideHealthRetry({ errorType: 'http-error', httpStatus: 403 }, rateLimitBackoffPolicy)).toEqual({ retry: true, reason: 'bounded-retry' });
  });

  it('keeps non-rate-limit recovery eligible for an enabled provider', () => {
    expect(decideHealthRetry({ errorType: 'timeout', httpStatus: '' }, rateLimitBackoffPolicy)).toEqual({ retry: true, reason: 'bounded-retry' });
  });

  it('keeps the default enabled policy retryable and cadence-limited providers fail closed', () => {
    expect(decideHealthRetry({ errorType: 'rate-limit', httpStatus: 429 }, { mode: 'enabled' })).toEqual({ retry: true, reason: 'bounded-retry' });
    expect(decideHealthRetry({ errorType: 'timeout' }, { mode: 'cadence-limited', minimumIntervalSeconds: 60, retryOnNon2xx: false })).toEqual({ retry: false, reason: 'cadence-limited' });
  });
});
