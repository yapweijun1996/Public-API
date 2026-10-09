export const isRateLimitFailure = (failure = {}, automatedVerification = { mode: 'enabled' }) => {
  if (failure.errorType === 'rate-limit') return true;
  const status = Number(failure.httpStatus);
  const configuredStatuses = automatedVerification?.mode === 'enabled' && Array.isArray(automatedVerification.rateLimitStatuses)
    ? automatedVerification.rateLimitStatuses.map(Number).filter(Number.isFinite)
    : [];
  const rateLimitStatuses = configuredStatuses.length ? configuredStatuses : [429];
  return rateLimitStatuses.includes(status);
};

export const decideHealthRetry = (failure = {}, automatedVerification = { mode: 'enabled' }) => {
  if (automatedVerification?.mode === 'cadence-limited') {
    return { retry: false, reason: 'cadence-limited' };
  }
  if (isRateLimitFailure(failure, automatedVerification) && automatedVerification?.retryOnRateLimit === false) {
    return { retry: false, reason: 'rate-limit-backoff' };
  }
  return { retry: true, reason: 'bounded-retry' };
};
