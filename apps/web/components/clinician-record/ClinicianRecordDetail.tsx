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
 * Server component: pure render, no client state. No icon library (LINT-02).
 */

import type { ClinicianRecord } from '@/lib/clinician-record/types';
import type { RecordAddress, RecordSection } from '@/lib/clinician-record/types';
import { CREDENTIAL_PROVENANCE_NOTE } from '@/lib/reference/credentials';
import { TAXONOMY_LICENSE_PROVENANCE_NOTE } from '@/lib/reference/taxonomy';

export type RecordMode = 'public' | 'owner';

// ── Small presentational primitives ────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-[11px] leading-relaxed text-gray-500">{subtitle}</p>
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
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  hint?: string;
}) {
  const empty =
    value === null || value === undefined || value === '' || value === false;

  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <dt className="text-[10px] uppercase tracking-wide text-gray-400">{label}</dt>
      <dd
        className={
          empty
            ? 'text-sm text-gray-400 italic'
            : mono
              ? 'text-sm font-mono text-gray-800 break-words'
              : 'text-sm text-gray-800 break-words'
        }
      >
        {/* An absent value is stated, never left as blank space that could
            read as "nothing to report". */}
        {empty ? 'Not reported to CMS' : value}
      </dd>
      {hint ? <p className="text-[10px] leading-snug text-gray-400">{hint}</p> : null}
    </div>
  );
}

/**
 * The provenance strip that rides above every section.
 *
 * This is the component that keeps the page honest, so it is deliberately
 * not subtle: source, what that source does and does not establish, and how
 * old the reading is.
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

  const freshnessLabel =
    freshness.status === 'current'
      ? 'Within refresh window'
      : freshness.status === 'stale'
        ? 'Older than refresh window'
        : 'Age unknown';

  const freshnessTone =
    freshness.status === 'current'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
      : freshness.status === 'stale'
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : 'border-gray-300 bg-gray-50 text-gray-600';

  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px]">
      <span className="inline-flex items-center rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-gray-700">
        {source.label}
      </span>
      <span className="inline-flex items-center rounded border border-gray-300 bg-white px-1.5 py-0.5 text-gray-700">
        {confirmationLabel}
      </span>
      <span
        className={`inline-flex items-center rounded border px-1.5 py-0.5 ${freshnessTone}`}
      >
        {/* Non-colour cue alongside the colour, per the a11y baseline. */}
        {freshnessLabel}
        {freshness.ageDays !== null ? ` · ${formatAge(freshness.ageDays)}` : ''}
      </span>
    </div>
  );
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
    <div className="space-y-0.5 text-sm text-gray-800">
      <div>{address.line1}</div>
      {address.line2 ? <div>{address.line2}</div> : null}
      <div>
        {[address.city, address.state].filter(Boolean).join(', ')}
        {zip ? ` ${zip}` : ''}
      </div>
      {address.countryName && address.countryCode !== 'US' ? (
        <div className="text-gray-600">{address.countryName}</div>
      ) : null}
      <div className="flex flex-wrap gap-x-4 pt-1 text-xs text-gray-600">
        {address.telephone ? (
          <span>
            Phone <span className="font-mono text-gray-800">{address.telephone}</span>
          </span>
        ) : null}
        {address.fax ? (
          <span>
            Fax <span className="font-mono text-gray-800">{address.fax}</span>
          </span>
        ) : null}
      </div>
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

  return (
    <div className="space-y-8">
      {/* ── Identity ──────────────────────────────────────────────────── */}
      <Section title="Provider record">
        <SourceStrip section={record.identity} />
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {identity.displayName || `NPI ${record.npi}`}
              </h3>
              <p className="mt-0.5 text-sm text-gray-500">
                {record.entityTypeLabel}
                {' · NPI '}
                <span className="font-mono text-gray-700">{record.npi}</span>
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-mono ${
                status.isActive
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-amber-300 bg-amber-50 text-amber-800'
              }`}
            >
              {status.label}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-1 gap-x-6 border-t border-gray-100 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {record.entityType === 'individual' ? (
              <>
                <Field label="First name" value={identity.firstName} />
                <Field label="Middle name" value={identity.middleName} />
                <Field label="Last name" value={identity.lastName} />
                <Field label="Name prefix" value={identity.namePrefix} />
                <Field label="Name suffix" value={identity.nameSuffix} />
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
            <div className="mt-3 border-t border-gray-100 pt-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">
                Credential as filed
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {identity.credential.tokens.map((token, i) => (
                  <span
                    key={`${token.raw}-${i}`}
                    className="inline-flex items-baseline gap-1.5 rounded border border-gray-200 bg-gray-50 px-2 py-0.5"
                  >
                    <span className="font-mono text-sm text-gray-800">{token.raw}</span>
                    <span className="text-xs text-gray-500">
                      {token.expansion ?? 'meaning not recognised'}
                    </span>
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-gray-500">
                {CREDENTIAL_PROVENANCE_NOTE}
              </p>
            </div>
          ) : null}
        </div>
      </Section>

      {/* ── Specialty ─────────────────────────────────────────────────── */}
      <Section
        title="Specialty and taxonomy"
        subtitle="Every taxonomy on the NPI record, resolved against the NUCC code set and the CMS Medicare crosswalk."
      >
        <SourceStrip section={record.taxonomies} />
        {record.taxonomies.data.length === 0 ? (
          <EmptyBlock message="This NPI record lists no taxonomy." />
        ) : (
          <div className="space-y-2">
            {record.taxonomies.data.map((t, i) => (
              <div
                key={`${t.code}-${t.state}-${t.license}-${i}`}
                className="rounded-lg border border-gray-200 p-3"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {t.displayName}
                  </span>
                  {t.primary ? (
                    <span className="rounded border border-gray-900 bg-gray-900 px-1.5 py-0.5 text-[10px] font-mono text-white">
                      Primary
                    </span>
                  ) : null}
                  <span className="font-mono text-xs text-gray-500">{t.code}</span>
                </div>

                {t.grouping ? (
                  <p className="mt-1 text-xs text-gray-600">
                    {t.grouping}
                    {t.classification ? ` › ${t.classification}` : ''}
                    {t.specialization ? ` › ${t.specialization}` : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-xs italic text-gray-400">
                    This code is not in the current NUCC code set, so no hierarchy
                    is available.
                  </p>
                )}

                <dl className="mt-2 grid grid-cols-1 gap-x-6 border-t border-gray-100 pt-2 sm:grid-cols-3">
                  <Field
                    label="Licence number as filed"
                    value={t.license}
                    mono
                  />
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

                {t.definition ? (
                  <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] leading-relaxed text-gray-500">
                    {t.definition}
                  </p>
                ) : null}
              </div>
            ))}
            <p className="text-[10px] leading-snug text-gray-500">
              {TAXONOMY_LICENSE_PROVENANCE_NOTE}
            </p>
          </div>
        )}
      </Section>

      {/* ── Locations ─────────────────────────────────────────────────── */}
      <Section title="Locations">
        <SourceStrip section={record.practiceAddress} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">
              Practice location
            </div>
            <div className="mt-1.5">
              {record.practiceAddress.data ? (
                <AddressBlock address={record.practiceAddress.data} />
              ) : (
                <p className="text-sm italic text-gray-400">
                  No practice address on the NPI record.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">
              Mailing address
            </div>
            <div className="mt-1.5">
              {record.mailingAddress.data ? (
                <AddressBlock address={record.mailingAddress.data} />
              ) : (
                <p className="text-sm italic text-gray-400">
                  No mailing address on the NPI record.
                </p>
              )}
            </div>
          </div>
        </div>

        {record.secondaryLocations.data.length > 0 ? (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">
              Additional practice locations ({record.secondaryLocations.data.length})
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {record.secondaryLocations.data.map((addr, i) => (
                <div
                  key={`${addr.line1}-${addr.city}-${i}`}
                  className="rounded-lg border border-gray-200 p-3"
                >
                  <AddressBlock address={addr} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      {/* ── Other identifiers and names ───────────────────────────────── */}
      <Section
        title="Other identifiers"
        subtitle="Medicaid numbers and other identifiers the provider listed alongside their NPI."
      >
        <SourceStrip section={record.identifiers} />
        {record.identifiers.data.length === 0 ? (
          <EmptyBlock message="No additional identifiers on the NPI record." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="py-1.5 pr-3 font-medium">Identifier</th>
                  <th className="py-1.5 pr-3 font-medium">Type</th>
                  <th className="py-1.5 pr-3 font-medium">Issuer</th>
                  <th className="py-1.5 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {record.identifiers.data.map((id, i) => (
                  <tr key={`${id.identifier}-${i}`} className="border-b border-gray-100">
                    <td className="py-1.5 pr-3 font-mono text-gray-800">
                      {id.identifier}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-700">{id.description || id.code}</td>
                    <td className="py-1.5 pr-3 text-gray-700">{id.issuer || '—'}</td>
                    <td className="py-1.5 text-gray-700">{id.state || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {record.otherNames.data.length > 0 ? (
        <Section
          title="Other names on record"
          subtitle="Former or alternate names. Useful when matching this provider to records filed under a different name."
        >
          <SourceStrip section={record.otherNames} />
          <ul className="space-y-1">
            {record.otherNames.data.map((n, i) => (
              <li key={`${n.displayName}-${i}`} className="text-sm text-gray-800">
                {n.displayName}
                {n.type ? (
                  <span className="ml-2 text-xs text-gray-500">({n.type})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {record.endpoints.data.length > 0 ? (
        <Section
          title="Health information exchange endpoints"
          subtitle="Direct secure messaging and FHIR endpoints the provider published to CMS."
        >
          <SourceStrip section={record.endpoints} />
          <ul className="space-y-2">
            {record.endpoints.data.map((e, i) => (
              <li key={`${e.endpoint}-${i}`} className="rounded border border-gray-200 p-2">
                <div className="font-mono text-xs break-all text-gray-800">
                  {e.endpoint}
                </div>
                <div className="mt-0.5 text-[11px] text-gray-500">
                  {[e.endpointType, e.endpointTypeDescription, e.affiliation]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {record.authorizedOfficial.data ? (
        <Section
          title="Authorized official"
          subtitle="The person CMS holds accountable for this organization's NPI record."
        >
          <SourceStrip section={record.authorizedOfficial} />
          <div className="rounded-lg border border-gray-200 p-3">
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
        </Section>
      ) : null}

      {/* ── Registry audit trail ──────────────────────────────────────── */}
      <Section
        title="Registry history"
        subtitle="When this record was created, last changed, and last certified as accurate by the provider."
      >
        <SourceStrip section={record.audit} />
        <div className="rounded-lg border border-gray-200 p-3">
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
      </Section>

      {/* ── What this record does NOT cover ───────────────────────────── */}
      <Section
        title="Not covered by this record"
        subtitle={
          mode === 'owner'
            ? 'Employers reviewing your profile will see these gaps too.'
            : 'These checks are not attached to this record. Do not read their absence as a pass.'
        }
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <ul className="space-y-2">
            {record.gaps.map((gap) => (
              <li key={gap.label} className="text-sm">
                <span className="font-medium text-gray-900">{gap.label}</span>
                <span className="text-gray-400"> — </span>
                <span className="text-gray-700">{gap.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── Provenance footer ─────────────────────────────────────────── */}
      <Section title="Sources">
        <div className="space-y-2">
          {record.citedSources.map((source) => (
            <div key={source.id} className="rounded border border-gray-200 p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {source.label}
                </span>
                <span className="font-mono text-[10px] text-gray-500">
                  {source.tier}
                </span>
                {source.url ? (
                  <a
                    href={source.url}
                    className="text-xs text-gray-600 underline"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {source.url}
                  </a>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-600">
                {source.note}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-400">
      {message}
    </div>
  );
}
