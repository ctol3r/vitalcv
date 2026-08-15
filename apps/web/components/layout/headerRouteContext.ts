/**
 * headerRouteContext — one place that decides, per route, how the shared
 * header behaves: which audience it addresses, the single contextual primary
 * action, the journey stage shown before any section declares one, and
 * whether the journey rail may be interactive.
 *
 * Route-specific behavior lives HERE, never scattered across components.
 * The rail is interactive only on `/`, where its anchors are honest — every
 * other route shows narrative position without pretending to be in-page
 * navigation.
 */

import { DEFAULT_JOURNEY_STAGE, type HeaderTheme, type JourneyStageId } from './journeyStages';

export type HeaderAudience = 'clinician' | 'employer' | 'neutral';

export interface HeaderCta {
  href: string;
  label: string;
}

export interface HeaderRouteContext {
  audience: HeaderAudience;
  /**
   * A non-interactive route cue for the public eyebrow. The public bar names
   * the visitor's current context; destination choices live in its full menu
   * so it never collapses back into an unreadable horizontal link row.
   */
  contextLabel: string;
  /**
   * The one contextual primary action. `null` on the action's own
   * destination — a button pointing at the page it is on is noise, and the
   * page carries the primary action itself.
   */
  cta: HeaderCta | null;
  /** Stage shown until a section declares `data-header-stage`. */
  defaultStage: JourneyStageId;
  /** Treatment until a section declares `data-header-theme`. */
  defaultTheme: HeaderTheme;
  /** Anchors are honest only on the homepage narrative. */
  railInteractive: boolean;
}

/** The clinician action — same destination and name the mobile CTA shipped with. */
const CLINICIAN_CTA: HeaderCta = { href: '/onboarding', label: 'Build my profile' };

/**
 * The employer action mirrors the one honest action `/employers` itself
 * opens with; Step 1 lives on its own route now, so the bar goes there.
 */
const EMPLOYER_CTA: HeaderCta = {
  href: '/employers/request-access',
  label: 'Request organization access',
};

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export function getHeaderRouteContext(pathname: string): HeaderRouteContext {
  // Employer-audience surfaces. On `/employers` itself the bar CTA is
  // suppressed — the page opens with the identical action, and two copies of
  // one button is exactly the competing-primary problem the wave retires.
  if (
    matches(pathname, '/employers') ||
    matches(pathname, '/for') ||
    matches(pathname, '/pilot') ||
    matches(pathname, '/solutions') ||
    matches(pathname, '/demo')
  ) {
    return {
      audience: 'employer',
      contextLabel: 'Hiring teams',
      // Suppressed on /employers (the page opens with the identical action)
      // and on the CTA's own destination — a bar button pointing at the page
      // you are already on is the same competing-primary problem.
      cta:
        pathname === '/employers' || pathname === EMPLOYER_CTA.href ? null : EMPLOYER_CTA,
      defaultStage: 'review',
      defaultTheme: 'light',
      railInteractive: false,
    };
  }

  // Employer-side inspection surfaces: verification and review live at the
  // Review end of the journey.
  if (matches(pathname, '/verify') || matches(pathname, '/review')) {
    return {
      audience: 'employer',
      contextLabel: 'Employer review',
      cta: EMPLOYER_CTA,
      defaultStage: 'review',
      defaultTheme: 'light',
      railInteractive: false,
    };
  }

  // The clinician activation flow: the journey begins at the number. The
  // page advances the stage itself only from a server-confirmed phase
  // (see lib/activation/headerStage.ts) — never from client-invented
  // completion. No CTA: this IS the CTA's destination.
  if (
    matches(pathname, '/onboarding') ||
    matches(pathname, '/get-ready') ||
    matches(pathname, '/profile/activate')
  ) {
    return {
      audience: 'clinician',
      contextLabel: 'Build your profile',
      cta: null,
      defaultStage: DEFAULT_JOURNEY_STAGE,
      defaultTheme: 'light',
      railInteractive: false,
    };
  }

  // The profile a clinician holds, and where it came from.
  if (matches(pathname, '/explore')) {
    return {
      audience: 'clinician',
      contextLabel: 'Find work that fits',
      cta: CLINICIAN_CTA,
      defaultStage: 'sources',
      defaultTheme: 'light',
      railInteractive: false,
    };
  }

  // Trust surfaces answer "where do the facts come from" — Sources.
  if (
    matches(pathname, '/trust') ||
    matches(pathname, '/status') ||
    matches(pathname, '/evidence-network')
  ) {
    return {
      audience: 'neutral',
      contextLabel: 'Source limits, stated plainly',
      cta: CLINICIAN_CTA,
      defaultStage: 'sources',
      defaultTheme: 'light',
      railInteractive: false,
    };
  }

  // Sharing, consent, and shared-profile surfaces — Permission.
  if (
    matches(pathname, '/opportunities') ||
    matches(pathname, '/p') ||
    matches(pathname, '/privacy') ||
    matches(pathname, '/legal')
  ) {
    return {
      audience: pathname.startsWith('/opportunities') ? 'clinician' : 'neutral',
      contextLabel: 'You control what you share',
      cta: CLINICIAN_CTA,
      defaultStage: 'permission',
      defaultTheme: 'light',
      railInteractive: false,
    };
  }

  // The homepage: Direction D's warm paper register. Sections still declare
  // stage and theme; this default keeps the server/no-JavaScript chrome
  // legible before useHeaderScene can observe the first light section. The
  // eyebrow substitutes its own "Start with your NPI" action on `/`.
  if (pathname === '/') {
    return {
      audience: 'clinician',
      contextLabel: 'Your profile, ready for every move',
      cta: CLINICIAN_CTA,
      defaultStage: DEFAULT_JOURNEY_STAGE,
      defaultTheme: 'light',
      railInteractive: true,
    };
  }

  return {
    audience: 'neutral',
    contextLabel: 'Your profile, ready for every move',
    cta: CLINICIAN_CTA,
    defaultStage: DEFAULT_JOURNEY_STAGE,
    defaultTheme: 'light',
    railInteractive: false,
  };
}
