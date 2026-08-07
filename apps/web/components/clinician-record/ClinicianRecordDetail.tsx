/**
 * ClinicianRecordDetail.tsx — the full provider record, rendered once.
 *
 * Used by the public verifier view, the clinician's own view, and the public
 * directory page. One component means the three cannot drift into three
 * different accounts of the same person.
 *
 * DESIGN CONSTRAINT THAT DRIVES THE LAYOUT
 * ----------------------------------------
 * Completeness is the risk. A dense, well-organised provider page reads as
 * "this has been checked" to a credentialing reviewer, and nothing in the
 * data itself corrects that impression. So:
 *
 *   - every section states its source and how fresh the reading is
 *   - self-reported values are labelled at the point of display, not in a
 *     footnote below the fold
 *   - what is NOT covered gets its own section with equal visual weight
 *
 * STYLING
 * -------
 * Calm Wave (D56) tokens throughout — this renders inside the `.mz` island.
 * Notes on two deliberate choices:
 *
 *   - Small labels use `--vt-text-muted`, not `--ink-400`. matcha-zen.css
 *     documents --ink-400 at small sizes as 2.37:1, below WCAG AA; the muted
 *     bridge token is the AA-corrected one. Neighbouring code still uses the
 *     raw ramp value, but matching it would knowingly ship a contrast failure.
 *
 *   - No check glyph appears anywhere, on any state. LINT-07 reserves it for
 *     affirmative evidence, and nothing on this record is affirmative
 *     evidence — it is a registry filing. State chips carry the `.mz-gl`
 *     shape cue instead, which is also the non-colour cue for the a11y
 *     baseline.
 *
 * Server component: pure render, no client state. No icon library (LINT-02).
 */

import type {
  ClinicianRecord,
  RecordAddress,
  RecordSection,
} from '@/lib/clinician-record/types';
import { CREDENTIAL_PROVENANCE_NOTE } from '@/lib/reference/credentials';
import { TAXONOMY_LICENSE_PROVENANCE_NOTE } from '@/lib/reference/taxonomy';

export type RecordMode = 'public' | 'owner';

// ── Small presentational primitives ────────────────────────────────────────

/** A sub-section inside the page's own Section, so one level quieter. */
function Group({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="space-y-1">
        <h3 className="mz-mono text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">
          {title}
        </h3>
        {subtitle ? (
          <p className="text-[11px] leading-relaxed text-[var(--ink-600)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  hint,
  optional,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  hint?: string;
  /**
   * Set for fields whose absence carries no meaning — a missing middle name
   * or name suffix says nothing about a provider. Those rows disappear when
   * empty instead of announcing themselves.
   *
   * Deliberately NOT set for anything a reviewer would act on. A missing
   * licence number, state or address is decision-relevant, and hiding it
   * would turn "we don't know" into "nothing to see", which is the exact
   * silent-completeness failure this component exists to prevent.
   */
  optional?: boolean;
}) {
  const empty =
    value === null || value === undefined || value === '' || value === false;

  if (empty && optional) return null;

  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <dt className="mz-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
        {label}
      </dt>
      <dd
        className={
          empty
            ? 'text-sm italic text-[var(--vt-text-muted)]'
            : `text-sm break-words text-[var(--ink-800)]${mono ? ' mz-mono' : ''}`
        }
      >
        {/* An absent value is stated, never left as blank space that could
            read as "nothing to report". */}
        {empty ? 'Not reported to CMS' : value}
      </dd>
      {hint ? (
        <p className="text-[10px] leading-snug text-[var(--vt-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * The provenance strip that rides above every group.
 *
 * This is the component that keeps the page honest, so it is deliberately
 * not subtle: source, what that source does and does not establish, and how
 * old the reading is.
 *
 * The confirmation chip is always `mz-chip-unknown` for registry data — a
 * neutral chip, never the affirmative one. Registry data being present is not
 * a positive finding, and colouring it as one is the exact misread this
 * component exists to prevent.
 */
function SourceStrip({ section }: { section: RecordSection<unknown> }) {
  const { provenance, freshness } = section;
  const { source } = provenance;

  const confirmationLabel =
    provenance.confirmation === 'registry_self_report'
      ? 'Self-reported to CMS'
      : provenance.confirmation === 'source_confirmed'
        ? 'Confirmed by source'
        : provenance.confirmation === 'derived'
          ? 'Derived by VitalCV'
          : 'Entered by the clinician';

  const confirmationChip =
    provenance.confirmation === 'source_confirmed' ? 'mz-chip-ok' : 'mz-chip-unknown';

  const freshnessLabel =
    freshness.status === 'current'
      ? 'Within refresh window'
      : freshness.status === 'stale'
        ? 'Older than refresh window'
        : 'Age unknown';

  const freshnessChip =
    freshness.status === 'current'
      ? 'mz-chip-ok'
      : freshness.status === 'stale'
        ? 'mz-chip-watch'
        : 'mz-chip-unknown';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mz-chip mz-chip-unknown">
        <span className="mz-gl" aria-hidden="true" />
        {source.label}
      </span>
      <span className={`mz-chip ${confirmationChip}`}>
        <span className="mz-gl" aria-hidden="true" />
        {confirmationLabel}
      </span>
      <span className={`mz-chip ${freshnessChip}`}>
        <span className="mz-gl" aria-hidden="true" />
        {freshnessLabel}
        {freshness.ageDays !== null ? ` · ${formatAge(freshness.ageDays)}` : ''}
      </span>
    </div>
  );
}

/**
 * Identity of a section's provenance, for deciding whether the strip has to
 * repeat. Two sections read from the same source, at the same confirmation
 * level, with the same freshness are making the same claim about themselves.
 */
function provenanceKey(section: RecordSection<unknown>): string {
  return [
    section.provenance.source.id,
    section.provenance.confirmation,
    section.freshness.status,
    section.freshness.ageDays ?? '',
  ].join('|');
}

/** "3 days ago" / "over 1 year ago" — the age a reader actually wants. */
function formatAge(days: number): string {
  if (days < 0) return 'dated in the future';
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'over 1 year ago' : `over ${years} years ago`;
}

function AddressBlock({ address }: { address: RecordAddress }) {
  const zip = address.postalCodeFormatted || address.postalCode;
  return (
    <div className="space-y-0.5 text-sm text-[var(--ink-800)]">
      <div>{address.line1}</div>
      {address.line2 ? <div>{address.line2}</div> : null}
      <div>
        {[address.city, address.state].filter(Boolean).join(', ')}
        {zip ? ` ${zip}` : ''}
      </div>
      {address.countryName && address.countryCode !== 'US' ? (
        <div className="text-[var(--ink-600)]">{address.countryName}</div>
      ) : null}
      <div className="flex flex-wrap gap-x-4 pt-1 text-xs text-[var(--ink-600)]">
        {address.telephone ? (
          <span>
            Phone{' '}
            <span className="mz-mono text-[var(--ink-800)]">{address.telephone}</span>
          </span>
        ) : null}
        {address.fax ? (
          <span>
            Fax <span className="mz-mono text-[var(--ink-800)]">{address.fax}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="mz-inset px-3 py-4 text-center text-sm text-[var(--vt-text-muted)]">
      {message}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ClinicianRecordDetail({
  record,
  mode = 'public',
}: {
  record: ClinicianRecord;
  mode?: RecordMode;
}) {
  const identity = record.identity.data;
  const status = record.status.data;
  const audit = record.audit.data;

  /**
   * Today every section comes from one NPPES read, so the strip would render
   * identically five times. A badge repeated verbatim five times stops being
   * read — it becomes wallpaper, and the honesty signal is the one thing on
   * this page that must not become wallpaper. So it is hoisted to a single
   * banner while the sections agree.
   *
   * The moment a federal connector attaches a section with different
   * provenance or freshness, this flips back to per-section strips, and the
   * differences are then the thing that stands out. Same rule, opposite
   * rendering, because the informative thing changed.
   */
  const allSections: RecordSection<unknown>[] = [
    record.identity,
    record.taxonomies,
    record.practiceAddress,
    record.identifiers,
    record.audit,
    ...(record.medicareEnrollment ? [record.medicareEnrollment] : []),
  ];
  const uniform = new Set(allSections.map(provenanceKey)).size === 1;
  const strip = (section: RecordSection<unknown>) =>
    uniform ? null : <SourceStrip section={section} />;

  return (
    <div className="space-y-7">
      {uniform ? (
        <div className="space-y-1.5">
          <SourceStrip section={record.identity} />
          <p className="text-[11px] leading-relaxed text-[var(--ink-600)]">
            Every field below comes from this one reading. Sections will carry
            their own labels once a source disagrees with it.
          </p>
        </div>
      ) : null}
      {/* ── Identity ──────────────────────────────────────────────────── */}
      <Group title="Provider record">
        {strip(record.identity)}
        <div className="mz-card mz-card-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="mz-h2">{identity.displayName || `NPI ${record.npi}`}</h4>
              <p className="mt-0.5 text-sm text-[var(--ink-600)]">
                {record.entityTypeLabel}
                {' · NPI '}
                <span className="mz-mono text-[var(--ink-700)]">{record.npi}</span>
              </p>
            </div>
            <span
              className={`mz-chip ${status.isActive ? 'mz-chip-ok' : 'mz-chip-p0'}`}
            >
              <span className="mz-gl" aria-hidden="true" />
              {status.label}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-1 gap-x-6 border-t border-[var(--rule-soft)] pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {record.entityType === 'individual' ? (
              <>
                <Field label="First name" value={identity.firstName} />
                <Field label="Last name" value={identity.lastName} />
                <Field label="Middle name" value={identity.middleName} optional />
                <Field label="Name prefix" value={identity.namePrefix} optional />
                <Field label="Name suffix" value={identity.nameSuffix} optional />
                <Field
                  label="Sole proprietor"
                  value={identity.soleProprietor}
                  hint="A CMS filing election, not a description of where the provider works."
                />
                <Field
                  label="Sex (CMS administrative field)"
                  value={identity.sexLabel}
                  hint="Recorded by CMS on the NPI application. Not a statement about gender identity."
                />
              </>
            ) : (
              <>
                <Field label="Legal business name" value={identity.organizationName} />
                <Field
                  label="Organizational subpart"
                  value={record.organizationalSubpart}
                />
                <Field
                  label="Parent organization"
                  value={record.parentOrganizationName}
                />
              </>
            )}
          </dl>

          {/* Credential decode — the single most misreadable field on the
              page, so its limitation sits directly under it. */}
          {identity.credential.raw ? (
            <div className="mt-3 border-t border-[var(--rule-soft)] pt-3">
              <div className="mz-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
                Credential as filed
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {identity.credential.tokens.map((token, i) => (
                  <span
                    key={`${token.raw}-${i}`}
                    className="mz-inset inline-flex items-baseline gap-1.5 px-2 py-1"
                  >
                    <span className="mz-mono text-sm text-[var(--ink-800)]">
                      {token.raw}
                    </span>
                    <span className="text-xs text-[var(--ink-600)]">
                      {token.expansion ?? 'meaning not recognised'}
                    </span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-snug text-[var(--vt-text-muted)]">
                {CREDENTIAL_PROVENANCE_NOTE}
              </p>
            </div>
          ) : null}
        </div>
      </Group>

      {/* ── Specialty ─────────────────────────────────────────────────── */}
      <Group
        title="Specialty and taxonomy"
        subtitle="Every taxonomy on the NPI record, resolved against the NUCC code set and the CMS Medicare crosswalk."
      >
        {strip(record.taxonomies)}
        {record.taxonomies.data.length === 0 ? (
          <EmptyBlock message="This NPI record lists no taxonomy." />
        ) : (
          <div className="space-y-2">
            {record.taxonomies.data.map((t, i, all) => {
              // A provider licensed in several states files one taxonomy row
              // per licence, so the same code repeats. Print the NUCC
              // definition on its first appearance only — three identical
              // paragraphs of boilerplate bury the licence rows, which are
              // the part that actually differs between them.
              const firstOfCode = all.findIndex((o) => o.code === t.code) === i;
              return (
              <div
                key={`${t.code}-${t.state}-${t.license}-${i}`}
                className="mz-card px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-semibold text-[var(--ink-900)]">
                    {t.displayName}
                  </span>
                  {t.primary ? (
                    <span className="mz-chip mz-chip-unknown">
                      <span className="mz-gl" aria-hidden="true" />
                      Primary
                    </span>
                  ) : null}
                  <span className="mz-mono text-xs text-[var(--ink-600)]">{t.code}</span>
                </div>

                {t.grouping ? (
                  <p className="mt-1 text-xs text-[var(--ink-600)]">
                    {t.grouping}
                    {t.classification ? ` › ${t.classification}` : ''}
                    {t.specialization ? ` › ${t.specialization}` : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-xs italic text-[var(--vt-text-muted)]">
                    This code is not in the current NUCC code set, so no hierarchy
                    is available.
                  </p>
                )}

                <dl className="mt-2 grid grid-cols-1 gap-x-6 border-t border-[var(--rule-soft)] pt-2 sm:grid-cols-3">
                  <Field label="Licence number as filed" value={t.license} mono />
                  <Field label="Licence state as filed" value={t.state} />
                  <Field
                    label="Medicare specialty"
                    value={
                      t.medicareSpecialties.length > 0
                        ? t.medicareSpecialties
                            .map((m) => `${m.specialtyCode} — ${m.description}`)
                            .join('; ')
                        : ''
                    }
                    hint={
                      t.medicareSpecialties.length === 0
                        ? 'This taxonomy is not Medicare enrollable.'
                        : 'A mapping of the taxonomy code. Not evidence of Medicare enrollment.'
                    }
                  />
                </dl>

                {t.definition && firstOfCode ? (
                  <p className="mt-2 border-t border-[var(--rule-soft)] pt-2 text-[11px] leading-relaxed text-[var(--ink-600)]">
                    {t.definition}
                  </p>
                ) : null}
              </div>
              );
            })}
            <p className="text-[10px] leading-snug text-[var(--vt-text-muted)]">
              {TAXONOMY_LICENSE_PROVENANCE_NOTE}
            </p>
          </div>
        )}
      </Group>

      {/* ── Medicare enrollment (CMS Doctors & Clinicians) ─────────────
          The one section on this record sourced from CMS's own enrollment
          records rather than a provider submission, so it is the only place
          the confirmation chip reads 'Confirmed by source'. */}
      {record.medicareEnrollment ? (
        <Group
          title="Medicare enrollment"
          subtitle="Published by CMS from its Medicare enrollment records. Enrollment is not licensure, and this says nothing about exclusions."
        >
          <SourceStrip section={record.medicareEnrollment} />
          {record.medicareEnrollment.data.state === 'enrolled' ? (
            <div className="mz-card px-4 py-3">
              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Medical school"
                  value={record.medicareEnrollment.data.medicalSchool}
                  hint="As recorded by CMS at enrollment."
                />
                <Field
                  label="Graduation year"
                  value={record.medicareEnrollment.data.graduationYear}
                  mono
                />
                <Field
                  label="Accepts Medicare assignment"
                  value={
                    record.medicareEnrollment.data.acceptsAssignment === null
                      ? ''
                      : record.medicareEnrollment.data.acceptsAssignment
                        ? 'Yes'
                        : 'No'
                  }
                />
                <Field
                  label="CMS primary specialty"
                  value={record.medicareEnrollment.data.primarySpecialty}
                  hint="CMS's own classification, which may differ from the NPPES taxonomy above."
                />
                <Field
                  label="CMS secondary specialties"
                  value={record.medicareEnrollment.data.secondarySpecialties.join(', ')}
                  optional
                />
                <Field
                  label="PECOS enrollment ID"
                  value={record.medicareEnrollment.data.individualEnrollmentId}
                  mono
                  optional
                />
              </dl>

              {record.medicareEnrollment.data.affiliations.length > 0 ? (
                <div className="mt-3 border-t border-[var(--rule-soft)] pt-3">
                  <div className="mz-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
                    Group practices billed under
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {record.medicareEnrollment.data.affiliations.map((a) => (
                      <li key={a.organizationPacId || a.facilityName} className="text-sm text-[var(--ink-800)]">
                        {a.facilityName}
                        <span className="ml-2 text-xs text-[var(--ink-600)]">
                          {[
                            a.memberCount ? `${a.memberCount} clinicians` : '',
                            a.locations > 1 ? `${a.locations} locations` : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {record.medicareEnrollment.data.surnameAgreesWithNppes === false ? (
                <p
                  className="mt-3 rounded-[3px] border px-3 py-2 text-[12px] leading-relaxed text-[var(--ink-800)]"
                  style={{ background: 'var(--watch-bg)', borderColor: 'var(--watch-rule)' }}
                >
                  The surname CMS holds for this NPI in its Medicare enrollment
                  file does not match the NPPES filing. That usually means a name
                  change or a stale enrollment record, but it is worth resolving
                  before relying on either.
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyBlock
              message={
                record.medicareEnrollment.data.state === 'not_listed'
                  ? 'Not listed in the CMS Medicare enrollment file. This is not a negative finding — clinicians who do not bill Medicare are legitimately absent.'
                  : 'The CMS enrollment file could not be read just now. This is not a finding about the clinician.'
              }
            />
          )}
        </Group>
      ) : null}

      {/* ── Locations ─────────────────────────────────────────────────── */}
      <Group title="Locations">
        {strip(record.practiceAddress)}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="mz-card px-4 py-3">
            <div className="mz-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
              Practice location
            </div>
            <div className="mt-1.5">
              {record.practiceAddress.data ? (
                <AddressBlock address={record.practiceAddress.data} />
              ) : (
                <p className="text-sm italic text-[var(--vt-text-muted)]">
                  No practice address on the NPI record.
                </p>
              )}
            </div>
          </div>

          <div className="mz-card px-4 py-3">
            <div className="mz-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
              Mailing address
            </div>
            <div className="mt-1.5">
              {record.mailingAddress.data ? (
                <AddressBlock address={record.mailingAddress.data} />
              ) : (
                <p className="text-sm italic text-[var(--vt-text-muted)]">
                  No mailing address on the NPI record.
                </p>
              )}
            </div>
          </div>
        </div>

        {record.secondaryLocations.data.length > 0 ? (
          <div className="space-y-2">
            <div className="mz-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
              Additional practice locations ({record.secondaryLocations.data.length})
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {record.secondaryLocations.data.map((addr, i) => (
                <div key={`${addr.line1}-${addr.city}-${i}`} className="mz-card px-4 py-3">
                  <AddressBlock address={addr} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Group>

      {/* ── Other identifiers ─────────────────────────────────────────── */}
      <Group
        title="Other identifiers"
        subtitle="Medicaid numbers and other identifiers the provider listed alongside their NPI."
      >
        {strip(record.identifiers)}
        {record.identifiers.data.length === 0 ? (
          <EmptyBlock message="No additional identifiers on the NPI record." />
        ) : (
          <div className="mz-card overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-[var(--rule)] text-left">
                  {['Identifier', 'Type', 'Issuer', 'State'].map((h) => (
                    <th
                      key={h}
                      className="mz-mono px-3 py-2 text-[9.5px] font-medium uppercase tracking-[0.12em] text-[var(--vt-text-muted)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {record.identifiers.data.map((id, i) => (
                  <tr
                    key={`${id.identifier}-${i}`}
                    className="border-b border-[var(--rule-soft)] last:border-0"
                  >
                    <td className="mz-mono px-3 py-2 text-[var(--ink-800)]">
                      {id.identifier}
                    </td>
                    <td className="px-3 py-2 text-[var(--ink-700)]">
                      {id.description || id.code}
                    </td>
                    <td className="px-3 py-2 text-[var(--ink-700)]">{id.issuer || '—'}</td>
                    <td className="px-3 py-2 text-[var(--ink-700)]">{id.state || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Group>

      {record.otherNames.data.length > 0 ? (
        <Group
          title="Other names on record"
          subtitle="Former or alternate names. Useful when matching this provider to records filed under a different name."
        >
          {strip(record.otherNames)}
          <ul className="space-y-0.5">
            {record.otherNames.data.map((n, i) => (
              <li key={`${n.displayName}-${i}`} className="text-sm text-[var(--ink-800)]">
                {n.displayName}
                {n.type ? (
                  <span className="ml-2 text-xs text-[var(--ink-600)]">({n.type})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {record.endpoints.data.length > 0 ? (
        <Group
          title="Health information exchange endpoints"
          subtitle="Direct secure messaging and FHIR endpoints the provider published to CMS."
        >
          {strip(record.endpoints)}
          <ul className="space-y-2">
            {record.endpoints.data.map((e, i) => (
              <li key={`${e.endpoint}-${i}`} className="mz-card px-3 py-2">
                <div className="mz-mono break-all text-xs text-[var(--ink-800)]">
                  {e.endpoint}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--ink-600)]">
                  {[e.endpointType, e.endpointTypeDescription, e.affiliation]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {record.authorizedOfficial.data ? (
        <Group
          title="Authorized official"
          subtitle="The person CMS holds accountable for this organization's NPI record."
        >
          {strip(record.authorizedOfficial)}
          <div className="mz-card px-4 py-3">
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-3">
              <Field label="Name" value={record.authorizedOfficial.data.displayName} />
              <Field
                label="Title or position"
                value={record.authorizedOfficial.data.titleOrPosition}
              />
              <Field
                label="Telephone"
                value={record.authorizedOfficial.data.telephone}
                mono
              />
            </dl>
          </div>
        </Group>
      ) : null}

      {/* ── Registry audit trail ──────────────────────────────────────── */}
      <Group
        title="Registry history"
        subtitle="When this record was created, last changed, and last certified as accurate by the provider."
      >
        {strip(record.audit)}
        <div className="mz-card px-4 py-3">
          <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="NPI enumerated" value={audit.enumerationDate} mono />
            <Field label="Last updated" value={audit.lastUpdated} mono />
            <Field
              label="Last certified by provider"
              value={audit.certificationDate}
              mono
              hint="The provider's own attestation date, not a check by CMS."
            />
            <Field label="NPPES status" value={status.label} />
            {status.deactivationDate ? (
              <Field label="Deactivated" value={status.deactivationDate} mono />
            ) : null}
            {status.reactivationDate ? (
              <Field label="Reactivated" value={status.reactivationDate} mono />
            ) : null}
          </dl>
        </div>
      </Group>

      {/* ── What this record does NOT cover ───────────────────────────── */}
      <Group
        title="Not covered by this record"
        subtitle={
          mode === 'owner'
            ? 'Employers reviewing your profile will see these gaps too.'
            : 'These checks are not attached to this record. Do not read their absence as a pass.'
        }
      >
        <div
          className="mz-card px-4 py-3"
          style={{
            background: 'var(--watch-bg)',
            borderColor: 'var(--watch-rule)',
          }}
        >
          <ul className="space-y-2">
            {record.gaps.map((gap) => (
              <li key={gap.label} className="text-sm">
                <span className="font-semibold text-[var(--ink-900)]">{gap.label}</span>
                <span className="text-[var(--vt-text-muted)]"> — </span>
                <span className="text-[var(--ink-700)]">{gap.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </Group>

      {/* ── Provenance footer ─────────────────────────────────────────── */}
      <Group title="Sources">
        <div className="space-y-2">
          {record.citedSources.map((source) => (
            <div key={source.id} className="mz-card px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold text-[var(--ink-900)]">
                  {source.label}
                </span>
                <span className="mz-mono text-[10px] text-[var(--vt-text-muted)]">
                  {source.tier}
                </span>
                {source.url ? (
                  <a
                    href={source.url}
                    className="text-xs text-[var(--ink-600)] underline"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {source.url}
                  </a>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-600)]">
                {source.note}
              </p>
            </div>
          ))}
        </div>
      </Group>
    </div>
  );
}
