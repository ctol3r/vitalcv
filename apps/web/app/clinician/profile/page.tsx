import * as React from 'react';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import ProfileSurface from './ProfileSurface';
import { ClinicianRecordDetail } from '@/components/clinician-record/ClinicianRecordDetail';
import { loadOwnerRecord } from '@/lib/clinician-record/ownerRecord';
import { OWNER_CONTEXT_NOTE } from '@/lib/clinician-record/copy';

// ProfileSurface reads the signed-in workspace client-side and the registry
// panel below reaches CMS on the server, so this page can never be
// prerendered. Render at request time, inside the root ClerkProvider.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clinician Profile',
  description:
    'Your clinician profile. User-entered information is not verified until source-backed evidence is attached.',
};

/**
 * The registry record an employer reads about this clinician.
 *
 * Placed ABOVE the self-entered form on purpose. The form is what the
 * clinician controls; this is what the world already says about them, and it
 * is the thing they cannot fix without first being shown it. Every empty
 * state below names its own cause, because "link your NPI" and "CMS was
 * unreachable" need different actions from the clinician — collapsing them
 * into one blank panel tells them nothing they can act on.
 *
 * Wrapped in a `.mz mz-paper` island: ClinicianRecordDetail is shared with
 * /verify, /directory and /holder and is written against the Calm Wave tokens
 * (--ink-*, --rule*, --vt-*), every one of which is defined only inside `.mz`.
 * The surrounding page is the D57 `.vcv-doc` system, where those names resolve
 * to nothing — an unscoped render would draw borderless, transparent rows.
 * Scoping the island is what keeps the shared component unmodified.
 */
function RegistryIsland({ children }: { children: React.ReactNode }) {
  return <div className="mz mz-paper">{children}</div>;
}

function OwnRegistryRecordPending() {
  return (
    <RegistryIsland>
      <section
        aria-labelledby="own-registry-record-heading"
        aria-busy="true"
        className="space-y-1 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 sm:p-5"
      >
        <h2 id="own-registry-record-heading" className="mz-h2">
          Reading your registry record
        </h2>
        <p className="text-[12px] leading-relaxed text-[var(--ink-600)]">
          Checking what CMS publishes about you.
        </p>
      </section>
    </RegistryIsland>
  );
}

async function OwnRegistryRecord() {
  const result = await loadOwnerRecord();

  if (result.state === 'ready') {
    return (
      <RegistryIsland>
        <section
          aria-labelledby="own-registry-record-heading"
          className="space-y-4 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 sm:p-5"
        >
          <div className="space-y-1">
            <h2 id="own-registry-record-heading" className="mz-h2">
              What employers read about you
            </h2>
            <p className="text-[12px] leading-relaxed text-[var(--ink-600)]">
              {OWNER_CONTEXT_NOTE}
            </p>
          </div>
          <ClinicianRecordDetail record={result.record} mode="owner" />
        </section>
      </RegistryIsland>
    );
  }

  const { heading, body } =
    result.state === 'no_npi'
      ? {
          heading: 'No NPI linked to this account',
          body: 'Link your NPI and your public CMS record will appear here, exactly as an employer reviewing you would read it.',
        }
      : result.state === 'registry_unavailable'
        ? {
            heading: `CMS had no readable record for NPI ${result.npi}`,
            body: 'This may be a temporary CMS outage, or an NPI that is no longer enumerated. Nothing is being hidden — we could not read the registry just now.',
          }
        : {
            heading: 'Could not check your registry record',
            body: 'We could not reach your workspace to find which NPI is linked to this account. That is our problem, not a finding about your record.',
          };

  return (
    <RegistryIsland>
      <section
        aria-labelledby="own-registry-record-heading"
        className="space-y-1 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 sm:p-5"
      >
        <h2 id="own-registry-record-heading" className="mz-h2">
          {heading}
        </h2>
        <p className="text-[12px] leading-relaxed text-[var(--ink-600)]">{body}</p>
      </section>
    </RegistryIsland>
  );
}

/**
 * The clinician profile.
 *
 * This page shipped for one wave as a read-only "foundation shell": twelve
 * sections of italic placeholder text under a banner saying the editing flow
 * had not shipped. It had, in fact, already been built — ProfileSurface, its
 * save state machine, and its 9-case test suite were on disk and imported by
 * nothing. This wires the built surface up.
 *
 * The banner is gone because the claim it made is no longer true: the fields
 * below write to /api/profile/{links,work-auth,resume/upload,self-attested}
 * and persist. What is still NOT capturable is named explicitly on the surface
 * itself rather than implied by a page-wide disclaimer.
 */
export default function ClinicianProfilePage() {
  return (
    <ProfileSurface
      registrySlot={
        // Behind Suspense: this reaches out to CMS, and the clinician's own
        // editable fields should paint immediately rather than waiting on a
        // third party that may be slow or down.
        <Suspense fallback={<OwnRegistryRecordPending />}>
          <OwnRegistryRecord />
        </Suspense>
      }
    />
  );
}
