/**
 * Clerk appearance mapping — wave1505 DG-12.1 ("One house, even at the front
 * door."). Themes Clerk's sign-in / sign-up / verification UI to the VitalCV
 * paper/ink house system so there is zero default Clerk purple.
 *
 * Clerk resolves these server-side and cannot read CSS custom properties, so
 * every value is the RESOLVED hex/px of the wave1505 token noted in the comment.
 * Passed to <ClerkProvider appearance={clerkAppearance}> in app/layout.tsx.
 *
 * Kept to flat CSS values (no nested pseudo-selectors) so it satisfies Clerk's
 * element style typing without importing @clerk/types directly.
 *
 * Design Handoff Reference:
 *   design-handoff/claude-design-2026-07-12-wave1505/wave1505/w1505-auth.jsx
 *   (CK_VARS + CK_ELEMENTS)
 */

const ink = '#141414'; // --ink-900 / --vt-text
const rule = '#dddbd3'; // --vt-rule
const ruleStrong = '#c9c6bd';
const bodyStack = "'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif";
const displayStack = "'Fraunces', Georgia, 'Times New Roman', serif";

export const clerkAppearance = {
  variables: {
    colorPrimary: ink,
    colorText: ink,
    colorTextSecondary: '#474540', // --vt-text-secondary
    colorBackground: '#ffffff', // card only; page stays paper
    colorInputBackground: '#ffffff',
    colorInputText: ink,
    colorDanger: '#7a1414', // --hue-p0
    colorSuccess: '#1c5c38', // --hue-ok
    colorWarning: '#7d5a1e', // --hue-watch
    colorNeutral: ink, // kills residual purple in borders/shadows
    fontFamily: bodyStack,
    fontFamilyButtons: bodyStack,
    borderRadius: '2px', // --radius-1, near-sharp public
  },
  elements: {
    // rules, not shadows (DG-1.10)
    rootBox: { boxShadow: 'none' },
    cardBox: { boxShadow: 'none', border: `1px solid ${rule}`, borderRadius: '4px' },
    card: { backgroundColor: '#ffffff', boxShadow: 'none' },
    headerTitle: { fontFamily: displayStack, fontWeight: 560, letterSpacing: '-0.015em' },
    headerSubtitle: { color: '#474540' },
    socialButtonsBlockButton: {
      height: '46px',
      border: `1px solid ${ink}`,
      borderRadius: '2px',
      boxShadow: 'none',
    },
    dividerLine: { backgroundColor: rule },
    dividerText: {
      fontFamily: "'Geist Mono', ui-monospace, monospace",
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: '#6b6860',
    },
    formFieldLabel: { fontSize: '12.5px', fontWeight: 600, color: ink },
    formFieldInput: {
      height: '46px',
      border: `1px solid ${ink}`,
      borderRadius: '2px',
      backgroundColor: '#ffffff',
    },
    formButtonPrimary: {
      backgroundColor: ink,
      height: '46px',
      borderRadius: '2px',
      boxShadow: 'none',
      textTransform: 'none',
    },
    footerActionLink: { color: ink, textDecorationLine: 'underline', textUnderlineOffset: '3px' },
    footer: { background: 'none' },
    badge: { border: `1px solid ${ruleStrong}`, color: '#6b6860' },
    logoBox: { display: 'none' }, // house wordmark supplied by the shell, not Clerk's slot
  },
} as const;

/**
 * Per-component appearance for the <SignIn /> and <SignUp /> cards.
 *
 * Those cards render their own `<h1>` ("Sign in to VitalCV") inside a page that
 * already has one ("Welcome back to VitalCV"), which the 2026-08-09 page
 * audit recorded as finding F5: two competing document headings on /sign-in,
 * /sign-up and /auth/resolving, reading as near-duplicate copy. The shell's
 * heading is the better one — it carries the disclosure paragraph beneath it —
 * so Clerk's header slot is suppressed here, exactly as `logoBox` already is
 * for the same reason ("supplied by the shell, not Clerk's slot").
 *
 * Deliberately NOT added to `clerkAppearance` above: that object is passed to
 * <ClerkProvider>, so it applies to every Clerk component in the app —
 * including <UserProfile /> and the verification flows, where the header is the
 * only thing naming the panel. This override is scoped to the two auth cards
 * that sit under a page heading of their own.
 */
export const authCardAppearance = {
  elements: {
    header: { display: 'none' },
  },
} as const;
