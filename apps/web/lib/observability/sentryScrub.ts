/**
 * sentryScrub — web entry point for the canonical Sentry PII scrubber.
 *
 * The implementation moved to `@vitalcv/shared/observability` so the web app and
 * the backend API scrub against ONE reviewed redaction list. This product is
 * healthcare-adjacent; two copies of the list would drift, and the drift would
 * only surface in a Sentry payload that already contains PII.
 *
 * This file stays as the web's import path (three `sentry.*.config.ts` files and
 * `__tests__/sentry-scrub.test.ts` reference it). Add redaction rules in the
 * shared package, never here.
 */
export { scrubEvent, resolveSentryRelease, SENTRY_SENSITIVE_KEYS } from '@vitalcv/shared/observability';
