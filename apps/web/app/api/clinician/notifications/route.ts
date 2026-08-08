/**
 * GET  /api/clinician/notifications — the clinician's own contact-consent
 *      state, routing preferences, and whether VitalCV could actually
 *      deliver to them today.
 * POST /api/clinician/notifications — grant or withdraw contact consent, or
 *      update routing preferences.
 *
 * The NPI is always derived from the caller's own profile server-side; a
 * client-supplied subject is rejected outright. Consent writes are strict —
 * a write that does not persist answers 503 rather than implying VitalCV may
 * write to someone.
 *
 * Context worth stating plainly: before this route existed, a clinician's
 * employers were told when their credential neared expiry and the clinician
 * was not. This is the surface that lets them ask to be told.
 */
import { auth } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import {
  grantContactConsent,
  readContactConsentStates,
  revokeContactConsent,
} from '@/lib/clinician-notifications/consent-store';
import {
  isNotificationSeverity,
  readNotificationPreference,
  updateNotificationPreference,
} from '@/lib/clinician-notifications/preferences';
import { resolveNotificationSubject } from '@/lib/clinician-notifications/subject';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Anything that would let a caller act on a subject other than themselves. */
const CLIENT_AUTHORED_KEYS = ['npi', 'clinicianNpi', 'subject', 'subjectRef', 'userId', 'seq'];

function subjectError(reason: 'no_npi_on_profile' | 'unavailable'): NextResponse {
  return reason === 'no_npi_on_profile'
    ? NextResponse.json(
        {
          error:
            'No NPI is bound to this account yet, so there is nothing to send notifications about.',
          refusal: 'no_npi_on_profile',
        },
        { status: 409 },
      )
    : NextResponse.json({ error: 'canonical profile unavailable' }, { status: 503 });
}

export async function GET() {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolved = await resolveNotificationSubject(session.userId);
  if (!resolved.ok) return subjectError(resolved.reason);

  try {
    const [consents, preference] = await Promise.all([
      readContactConsentStates(resolved.subject.npi),
      readNotificationPreference(resolved.subject.npi),
    ]);
    const emailConsent = consents.find((c) => c.channel === 'EMAIL');
    return NextResponse.json({
      consents,
      preference,
      // Honest deliverability: consent alone is not enough if we hold no
      // verified address, and the settings screen should say so rather than
      // implying mail is on its way.
      deliverable: Boolean(emailConsent?.granted) && resolved.subject.hasVerifiedEmail,
      hasVerifiedEmail: resolved.subject.hasVerifiedEmail,
      verifiedEmailDomain: resolved.subject.verifiedEmailDomain,
    });
  } catch {
    return NextResponse.json({ error: 'notification settings unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = (await request.json()) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  const offending = CLIENT_AUTHORED_KEYS.filter((key) => key in body);
  if (offending.length > 0) {
    return NextResponse.json(
      {
        error: 'the notification subject is derived from your own profile and may not be supplied',
        rejectedFields: offending,
      },
      { status: 400 },
    );
  }

  const decision = body.decision;
  const hasPreferenceUpdate =
    body.severityFloor !== undefined ||
    body.suppressionWindowMinutes !== undefined ||
    body.active !== undefined;

  if (decision === undefined && !hasPreferenceUpdate) {
    return NextResponse.json(
      { error: 'provide a consent decision ("grant" | "revoke") or a preference update' },
      { status: 400 },
    );
  }
  if (decision !== undefined && decision !== 'grant' && decision !== 'revoke') {
    return NextResponse.json({ error: 'decision must be "grant" or "revoke"' }, { status: 400 });
  }
  if (body.severityFloor !== undefined && !isNotificationSeverity(body.severityFloor)) {
    return NextResponse.json({ error: 'invalid severityFloor' }, { status: 400 });
  }
  if (
    body.suppressionWindowMinutes !== undefined &&
    typeof body.suppressionWindowMinutes !== 'number'
  ) {
    return NextResponse.json({ error: 'suppressionWindowMinutes must be a number' }, { status: 400 });
  }
  if (body.active !== undefined && typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'active must be a boolean' }, { status: 400 });
  }

  const resolved = await resolveNotificationSubject(session.userId);
  if (!resolved.ok) return subjectError(resolved.reason);
  const { npi } = resolved.subject;

  let consentResult: Awaited<ReturnType<typeof grantContactConsent>> | null = null;
  if (decision !== undefined) {
    consentResult =
      decision === 'grant'
        ? await grantContactConsent({ clinicianNpi: npi, channel: 'EMAIL', grantSource: 'holder_settings' })
        : await revokeContactConsent({ clinicianNpi: npi, channel: 'EMAIL', grantSource: 'holder_settings' });

    if (!consentResult.persisted) {
      return NextResponse.json(
        { error: 'consent could not be recorded', decision },
        { status: 503 },
      );
    }
  }

  if (hasPreferenceUpdate) {
    const updated = await updateNotificationPreference({
      clinicianNpi: npi,
      ...(isNotificationSeverity(body.severityFloor) ? { severityFloor: body.severityFloor } : {}),
      ...(typeof body.suppressionWindowMinutes === 'number'
        ? { suppressionWindowMinutes: body.suppressionWindowMinutes }
        : {}),
      ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
    });
    if (!updated.persisted) {
      return NextResponse.json({ error: 'preferences could not be saved' }, { status: 503 });
    }
  }

  const [consents, preference] = await Promise.all([
    readContactConsentStates(npi),
    readNotificationPreference(npi),
  ]);
  const emailConsent = consents.find((c) => c.channel === 'EMAIL');

  return NextResponse.json({
    consents,
    preference,
    deliverable: Boolean(emailConsent?.granted) && resolved.subject.hasVerifiedEmail,
    hasVerifiedEmail: resolved.subject.hasVerifiedEmail,
    ...(consentResult
      ? { changed: consentResult.changed, eventRef: consentResult.eventRef, seq: consentResult.seq }
      : {}),
  });
}
