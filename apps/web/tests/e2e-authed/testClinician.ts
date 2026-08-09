/**
 * The shared synthetic clinician used by the authed suite.
 *
 * Lives in its own module because Playwright forbids one test file importing
 * another, and both the setup project and the specs need this identity.
 *
 * `+clerk_test` addresses are Clerk's development-instance test users: no real
 * mailbox, no real person.
 */
export const E2E_CLINICIAN_EMAIL = 'e2e-clinician+clerk_test@vitalcv.dev'
