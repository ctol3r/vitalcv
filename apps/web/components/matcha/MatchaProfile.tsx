/**
 * MatchaProfile — Wave 2, "MATCHA understands you".
 *
 * A reflective, Wrapped-style read-back of what the clinician has told MATCHA. Every insight
 * is rendered with its provenance (the answers it came from), and the confidence score is
 * explicitly framed as "how much you've told MATCHA" — not a claim about match quality.
 *
 * Presentational only: it takes a derived profile and renders it. No fetching, no fabrication.
 */

import type { InsightCategory, MatchaDerivedProfile, MatchaInsight } from '@/lib/matcha/profile';
import type { PreferenceField } from '@/lib/matcha/preferences';

const CATEGORY_ORDER: Array<{ key: InsightCategory; title: string }> = [
  { key: 'career_direction', title: 'Career direction' },
  { key: 'career_dna', title: 'Career DNA' },
  { key: 'value', title: 'Values' },
  { key: 'strength', title: 'Strengths' },
  { key: 'ideal_organization', title: 'Ideal organizations' },
  { key: 'ideal_team', title: 'Ideal teams' },
  { key: 'ideal_location', title: 'Ideal locations' },
  { key: 'ideal_compensation', title: 'Ideal compensation' },
  { key: 'ideal_schedule', title: 'Ideal schedule' },
];

function readableField(field: PreferenceField): string {
  return String(field)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function ConfidenceRing({ value }: { value: number }) {
  const size = 92;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}% of preferences shared`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--vt-border, #E2E8E6)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--vt-accent, #0A7B7F)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        style={{ fontSize: 20, fontWeight: 700, fill: 'var(--vt-text-primary)' }}
      >
        {value}%
      </text>
    </svg>
  );
}

function InsightRow({ insight }: { insight: MatchaInsight }) {
  return (
    <li style={{ display: 'grid', gap: 3, padding: '10px 0', borderBottom: '1px solid var(--vt-border, #EEF2F0)' }}>
      <span style={{ fontSize: 15, color: 'var(--vt-text-primary)', fontWeight: 500 }}>{insight.label}</span>
      <span style={{ fontSize: 11, color: 'var(--vt-text-muted)' }}>
        because you told us: {insight.provenance.map(readableField).join(', ')}
      </span>
    </li>
  );
}

export interface MatchaProfileProps {
  derived: MatchaDerivedProfile;
  clinicianName?: string;
}

export function MatchaProfile({ derived, clinicianName }: MatchaProfileProps) {
  const { insights, confidenceScore, dreamRole, dreamEmployer } = derived;

  if (insights.length === 0) {
    return (
      <section
        style={{
          background: 'var(--vt-surface, #fff)',
          border: '1px solid var(--vt-border, #E2E8E6)',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--vt-text-primary)' }}>
          Ready to learn about you
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--vt-text-secondary)', lineHeight: 1.5 }}>
          Answer a few questions and we will build a picture of what you&rsquo;re looking for —
          reflected back here, always tied to what you actually said.
        </p>
      </section>
    );
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    ...cat,
    items: insights.filter((i) => i.category === cat.key),
  })).filter((g) => g.items.length > 0);

  return (
    <section style={{ display: 'grid', gap: 20 }}>
      {/* Header card */}
      <div
        style={{
          background: 'var(--vt-surface-subtle, #EDF2F0)',
          border: '1px solid var(--vt-border, #E2E8E6)',
          borderRadius: 4,
          padding: 24,
          display: 'flex',
          gap: 20,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <ConfidenceRing value={confidenceScore} />
        <div style={{ minWidth: 220, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--vt-accent, #0A7B7F)', fontWeight: 700 }}>
            What we know about you
          </p>
          <h2 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 600, color: 'var(--vt-text-primary)' }}>
            {clinicianName ? `Here's what I know about you, ${clinicianName}` : "Here's what I know about you"}
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--vt-text-secondary)', lineHeight: 1.5 }}>
            Confidence reflects how much you&rsquo;ve shared — {confidenceScore}% so far. The more you
            tell us, the sharper your matches get. Everything below traces to your own answers.
          </p>
        </div>
      </div>

      {/* Dream role / employer */}
      {(dreamRole || dreamEmployer) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {dreamRole && (
            <div style={{ background: 'var(--vt-surface, #fff)', border: '1px solid var(--vt-border, #E2E8E6)', borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--vt-text-muted)' }}>Dream role</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--vt-text-primary)', marginTop: 4 }}>{dreamRole}</div>
            </div>
          )}
          {dreamEmployer && (
            <div style={{ background: 'var(--vt-surface, #fff)', border: '1px solid var(--vt-border, #E2E8E6)', borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--vt-text-muted)' }}>Dream employer</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--vt-text-primary)', marginTop: 4 }}>{dreamEmployer}</div>
            </div>
          )}
        </div>
      )}

      {/* Grouped insights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {grouped.map((group) => (
          <div key={group.key} style={{ background: 'var(--vt-surface, #fff)', border: '1px solid var(--vt-border, #E2E8E6)', borderRadius: 16, padding: '16px 20px' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--vt-text-secondary)' }}>{group.title}</h3>
            <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }}>
              {group.items.map((insight, i) => (
                <InsightRow key={`${insight.label}-${i}`} insight={insight} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
