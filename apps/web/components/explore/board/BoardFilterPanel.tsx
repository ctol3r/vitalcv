'use client';

import type { BoardFilters } from '@/lib/explore/board-filters';
import {
  APPLICATION_MODE_LABEL,
  APPLICATION_MODE_OPTIONS,
  BENEFITS_LABEL,
  BENEFITS_OPTIONS,
  COMPENSATION_LABEL,
  COMPENSATION_OPTIONS,
  HIRING_TYPE_LABEL,
  HIRING_TYPE_OPTIONS,
  OBSERVED_WITHIN_LABEL,
  OBSERVED_WITHIN_OPTIONS,
  PROFESSION_LABEL,
  PROFESSION_OPTIONS,
  SCHEDULE_LABEL,
  SCHEDULE_OPTIONS,
  SORT_LABEL,
  SORT_OPTIONS,
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

const CONTROL_STYLE = {
  minHeight: 48,
  border: '1px solid var(--vt-home-d-rule)',
  borderRadius: 0,
  background: 'var(--vt-home-d-ground)',
  color: 'var(--vt-home-d-ink)',
} as const;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="opf-filter-field">
      <span className="opf-filter-label">{label}</span>
      {children}
      {hint ? <span className="opf-filter-hint">{hint}</span> : null}
    </label>
  );
}

/**
 * A pay bound compares against the figure the employer PUBLISHED, so setting one
 * necessarily drops every role that published no pay at all. That is the API's
 * semantics and it is the right one — ranking an unpublished range as $0 would
 * punish the employer, and ranking it high would invent a number — but it has to
 * be said on the control, or an empty result reads as "nothing pays this".
 */
const PAY_RANGE_HINT
  = 'Compares against the published figure, whether that is annual, hourly or per '
  + 'shift — the figures are not converted. Setting either bound excludes roles '
  + 'that published no pay.';

export function BoardFilterPanel({
  filters,
  onChange,
}: {
  filters: BoardFilters;
  onChange: (patch: Partial<BoardFilters>) => void;
}) {
  return (
    <section className="opf-filter-grid" aria-label="Filter clinical opportunities">
      <Field label="Specialty or service line">
        <input
          type="text"
          value={filters.specialty}
          onChange={(event) => onChange({ specialty: event.target.value })}
          placeholder="Family medicine"
          className="opf-filter-control"
          style={CONTROL_STYLE}
        />
      </Field>

      <Field label="Profession">
        <select
          value={filters.profession}
          onChange={(event) => onChange({ profession: event.target.value })}
          className="opf-filter-control"
          style={CONTROL_STYLE}
        >
          <option value="">All professions</option>
          {PROFESSION_OPTIONS.map((value) => (
            <option key={value} value={value}>{PROFESSION_LABEL[value]}</option>
          ))}
        </select>
      </Field>

      <Field label="Location">
        <div className="opf-location-controls">
          <select
            aria-label="State"
            value={filters.state}
            onChange={(event) => onChange({ state: event.target.value })}
            className="opf-filter-control"
            style={CONTROL_STYLE}
          >
            <option value="">Any state</option>
            {US_STATES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select
            aria-label="Work setting"
            value={filters.remote === true ? 'remote' : filters.remote === false ? 'onsite' : ''}
            onChange={(event) => onChange({
              remote: event.target.value === 'remote'
                ? true
                : event.target.value === 'onsite'
                  ? false
                  : null,
            })}
            className="opf-filter-control"
            style={CONTROL_STYLE}
          >
            <option value="">Any setting</option>
            <option value="remote">Remote</option>
            <option value="onsite">On-site or hybrid</option>
          </select>
        </div>
      </Field>

      <Field label="Schedule">
        <select
          value={filters.schedule}
          onChange={(event) => onChange({ schedule: event.target.value })}
          className="opf-filter-control"
          style={CONTROL_STYLE}
        >
          <option value="">Any schedule</option>
          {SCHEDULE_OPTIONS.map((value) => (
            <option key={value} value={value}>{SCHEDULE_LABEL[value]}</option>
          ))}
        </select>
      </Field>

      <Field label="Employment type">
        <select
          value={filters.hiringType}
          onChange={(event) => onChange({ hiringType: event.target.value })}
          className="opf-filter-control"
          style={CONTROL_STYLE}
        >
          <option value="">Any type</option>
          {HIRING_TYPE_OPTIONS.map((value) => (
            <option key={value} value={value}>{HIRING_TYPE_LABEL[value]}</option>
          ))}
        </select>
      </Field>

      <Field label="Source observation">
        <select
          value={filters.observedWithin}
          onChange={(event) => onChange({ observedWithin: event.target.value })}
          className="opf-filter-control"
          style={CONTROL_STYLE}
        >
          <option value="">Any observation time</option>
          {OBSERVED_WITHIN_OPTIONS.map((value) => (
            <option key={value} value={value}>{OBSERVED_WITHIN_LABEL[value]}</option>
          ))}
        </select>
      </Field>

      <Field label="Application path">
        <select
          value={filters.applicationMode}
          onChange={(event) => onChange({ applicationMode: event.target.value })}
          className="opf-filter-control"
          style={CONTROL_STYLE}
        >
          <option value="">Any application path</option>
          {APPLICATION_MODE_OPTIONS.map((value) => (
            <option key={value} value={value}>{APPLICATION_MODE_LABEL[value]}</option>
          ))}
        </select>
      </Field>

      <Field label="Compensation detail">
        <select
          value={filters.compensation}
          onChange={(event) => onChange({ compensation: event.target.value })}
          className="opf-filter-control"
          style={CONTROL_STYLE}
        >
          <option value="">Any compensation detail</option>
          {COMPENSATION_OPTIONS.map((value) => (
            <option key={value} value={value}>{COMPENSATION_LABEL[value]}</option>
          ))}
        </select>
      </Field>

      <Field label="Pay range" hint={PAY_RANGE_HINT}>
        <div className="opf-pay-controls">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            aria-label="Minimum pay"
            value={filters.payMin}
            onChange={(event) => onChange({ payMin: event.target.value })}
            placeholder="Minimum"
            className="opf-filter-control"
            style={CONTROL_STYLE}
          />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            aria-label="Maximum pay"
            value={filters.payMax}
            onChange={(event) => onChange({ payMax: event.target.value })}
            placeholder="Maximum"
            className="opf-filter-control"
            style={CONTROL_STYLE}
          />
        </div>
      </Field>

      <Field label="Visa sponsorship">
        <select
          value={filters.visaSponsorship}
          onChange={(event) => onChange({ visaSponsorship: event.target.value })}
          className="opf-filter-control"
          style={CONTROL_STYLE}
        >
          <option value="">Any sponsorship status</option>
          {VISA_OPTIONS.map((value) => (
            <option key={value} value={value}>{VISA_LABEL[value]}</option>
          ))}
        </select>
      </Field>

      <Field label="Start timing">
        <select
          value={filters.startUrgency}
          onChange={(event) => onChange({ startUrgency: event.target.value })}
          className="opf-filter-control"
          style={CONTROL_STYLE}
        >
          <option value="">Any start timing</option>
          {START_URGENCY_OPTIONS.map((value) => (
            <option key={value} value={value}>{START_URGENCY_LABEL[value]}</option>
          ))}
        </select>
      </Field>

      <Field label="Employer type" hint="Matches any part of the employer’s stated facility type.">
        <input
          type="text"
          value={filters.employerType}
          onChange={(event) => onChange({ employerType: event.target.value })}
          placeholder="Hospital, telehealth…"
          className="opf-filter-control"
          style={CONTROL_STYLE}
        />
      </Field>

      <Field label="Benefits detail">
        <select
          value={filters.benefits}
          onChange={(event) => onChange({ benefits: event.target.value })}
          className="opf-filter-control"
          style={CONTROL_STYLE}
        >
          <option value="">Any benefits detail</option>
          {BENEFITS_OPTIONS.map((value) => (
            <option key={value} value={value}>{BENEFITS_LABEL[value]}</option>
          ))}
        </select>
      </Field>

      <Field label="Sort field">
        <select
          value={filters.sort}
          onChange={(event) => onChange({ sort: event.target.value })}
          className="opf-filter-control"
          style={CONTROL_STYLE}
        >
          {SORT_OPTIONS.map((value) => (
            <option key={value} value={value}>{SORT_LABEL[value]}</option>
          ))}
        </select>
      </Field>
    </section>
  );
}

export default BoardFilterPanel;
