'use client';

/**
 * BoardFilterPanel — the facet rail.
 *
 * Note on reuse: the equivalent group in components/intelligence-ops/finding-filters.tsx
 * was NOT extracted. It renders `rounded-full` (CD-10 retires pills) and carries
 * ops-dark colours, both of which are disallowed on a public paper surface. The
 * behaviour is the same; only the skin differs.
 *
 * Facets are single-select because the opportunity service takes single values
 * per field. Sections are native <details> so collapsing needs no JS and no
 * keyframes (LINT-03).
 */

import type { BoardFilters } from '@/lib/explore/board-filters';
import {
  BENEFIT_LABEL,
  BENEFIT_OPTIONS,
  HIRING_TYPE_LABEL,
  HIRING_TYPE_OPTIONS,
  PAY_MODEL_LABEL,
  PAY_MODEL_OPTIONS,
  READINESS_LABEL,
  READINESS_OPTIONS,
  START_URGENCY_LABEL,
  START_URGENCY_OPTIONS,
  VISA_LABEL,
  VISA_OPTIONS,
} from '@/lib/explore/board-filters';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID',
  'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC',
  'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD',
  'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
] as const;

const RULE = 'var(--rule, #C9C3B6)';
const RULE_SOFT = 'var(--rule-soft, #DAD5C9)';

function FacetSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group border-b py-3" style={{ borderColor: RULE_SOFT }}>
      {/* list-none stripped the native disclosure triangle, so the collapsed
          groups (Pay, Start timing, Sponsorship, Benefits, Employer) read as
          dead headings with working controls hidden beneath them. The chevron
          is the affordance that says "this opens". */}
      <summary
        className="mz-small flex cursor-pointer items-center justify-between gap-2 list-none select-none"
        style={{ fontWeight: 600, color: 'var(--vt-text-primary)' }}
      >
        {title}
        <span
          aria-hidden="true"
          className="text-[10px] transition-transform group-open:rotate-180"
          style={{ color: 'var(--vt-text-muted)' }}
        >
          ▾
        </span>
      </summary>
      <div style={{ marginTop: 10 }}>{children}</div>
    </details>
  );
}

/** Single-select option list. Square corners — pills are retired (CD-10). */
function OptionGroup({
  options,
  labels,
  value,
  onChange,
  name,
}: {
  options: readonly string[];
  labels: Record<string, string>;
  value: string;
  onChange: (next: string) => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={name}>
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? '' : option)}
            className="border px-2.5 py-1 text-left text-[12px] transition"
            style={{
              borderRadius: 3,
              borderColor: active ? 'var(--vt-text-primary)' : RULE,
              background: active ? 'var(--vt-text-primary)' : 'transparent',
              color: active ? 'var(--paper, #F0EEE9)' : 'var(--vt-text-secondary)',
            }}
          >
            {labels[option] ?? option}
          </button>
        );
      })}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <label className="block">
      <span className="mz-small" style={{ display: 'block', marginBottom: 4, color: 'var(--vt-text-muted)' }}>
        {label}
      </span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border px-2.5 py-1.5 text-[13px]"
        style={{
          borderRadius: 3,
          borderColor: RULE,
          background: 'var(--card, #FBFAF6)',
          color: 'var(--vt-text-primary)',
        }}
      />
    </label>
  );
}

export function BoardFilterPanel({
  filters,
  onChange,
  readinessAvailable,
}: {
  filters: BoardFilters;
  onChange: (patch: Partial<BoardFilters>) => void;
  /** True only when a clinician NPI resolved — the readiness facets need one. */
  readinessAvailable: boolean;
}) {
  return (
    <aside aria-label="Filter opportunities">
      <FacetSection title="Location" defaultOpen>
        <div className="space-y-3">
          <label className="block">
            <span className="mz-small" style={{ display: 'block', marginBottom: 4, color: 'var(--vt-text-muted)' }}>
              State
            </span>
            <select
              value={filters.state}
              onChange={(event) => onChange({ state: event.target.value })}
              className="w-full border px-2.5 py-1.5 text-[13px]"
              style={{
                borderRadius: 3,
                borderColor: RULE,
                background: 'var(--card, #FBFAF6)',
                color: 'var(--vt-text-primary)',
              }}
            >
              <option value="">Any state</option>
              {US_STATES.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </label>

          <OptionGroup
            name="Work setting"
            options={['remote', 'onsite']}
            labels={{ remote: 'Remote', onsite: 'Onsite' }}
            value={filters.remote === true ? 'remote' : filters.remote === false ? 'onsite' : ''}
            onChange={(next) => onChange({ remote: next === 'remote' ? true : next === 'onsite' ? false : null })}
          />
        </div>
      </FacetSection>

      <FacetSection title="Role" defaultOpen>
        <div className="space-y-3">
          <TextField
            label="Specialty"
            value={filters.specialty}
            onChange={(specialty) => onChange({ specialty })}
            placeholder="e.g. Internal Medicine"
          />
          <OptionGroup
            name="Commitment"
            options={HIRING_TYPE_OPTIONS}
            labels={HIRING_TYPE_LABEL}
            value={filters.hiringType}
            onChange={(hiringType) => onChange({ hiringType })}
          />
        </div>
      </FacetSection>

      <FacetSection title="Pay">
        <div className="space-y-3">
          <OptionGroup
            name="Pay model"
            options={PAY_MODEL_OPTIONS}
            labels={PAY_MODEL_LABEL}
            value={filters.payModel}
            onChange={(payModel) => onChange({ payModel })}
          />
          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="Min"
              value={filters.payMin}
              onChange={(payMin) => onChange({ payMin })}
              placeholder="0"
              inputMode="numeric"
            />
            <TextField
              label="Max"
              value={filters.payMax}
              onChange={(payMax) => onChange({ payMax })}
              placeholder="Any"
              inputMode="numeric"
            />
          </div>
          <p className="mz-small" style={{ margin: 0, color: 'var(--vt-text-muted)' }}>
            Filtering by pay hides roles that publish no figure.
          </p>
        </div>
      </FacetSection>

      <FacetSection title="Start timing">
        <OptionGroup
          name="Start timing"
          options={START_URGENCY_OPTIONS}
          labels={START_URGENCY_LABEL}
          value={filters.startUrgency}
          onChange={(startUrgency) => onChange({ startUrgency })}
        />
      </FacetSection>

      <FacetSection title="Sponsorship">
        <OptionGroup
          name="Sponsorship"
          options={VISA_OPTIONS}
          labels={VISA_LABEL}
          value={filters.visaSponsorship}
          onChange={(visaSponsorship) => onChange({ visaSponsorship })}
        />
      </FacetSection>

      <FacetSection title="Benefits">
        <OptionGroup
          name="Benefits"
          options={BENEFIT_OPTIONS}
          labels={BENEFIT_LABEL}
          value={filters.benefits}
          onChange={(benefits) => onChange({ benefits })}
        />
      </FacetSection>

      <FacetSection title="Employer">
        <TextField
          label="Employer type"
          value={filters.employerType}
          onChange={(employerType) => onChange({ employerType })}
          placeholder="e.g. health system"
        />
      </FacetSection>

      {/* The facet no general job board can offer. Gated on a resolved NPI,
          because without one there is nothing to compare requirements against. */}
      <FacetSection title="Your readiness" defaultOpen={readinessAvailable}>
        {readinessAvailable ? (
          <OptionGroup
            name="Your readiness"
            options={READINESS_OPTIONS}
            labels={READINESS_LABEL}
            value={filters.readinessStatus}
            onChange={(readinessStatus) => onChange({ readinessStatus })}
          />
        ) : (
          <p className="mz-small" style={{ margin: 0, color: 'var(--vt-text-muted)' }}>
            Filtering by readiness needs your NPI on file. Sign in, and add it to your
            profile if it isn’t there yet.
          </p>
        )}
      </FacetSection>
    </aside>
  );
}

export default BoardFilterPanel;
