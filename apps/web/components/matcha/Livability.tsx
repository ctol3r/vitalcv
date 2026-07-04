'use client';

/**
 * Livability — honest relocation context for an opportunity.
 *
 * Renders category tiles that link to external lookups scoped to the location. VitalCV does not
 * estimate these figures; the copy says so. Remote roles show a distinct, honest note instead of
 * relocation data.
 */

import { MapPin, ExternalLink, Laptop } from 'lucide-react';
import {
  LIVABILITY_CATEGORIES,
  livabilityLookupUrl,
  locationLabel,
} from '@/lib/matcha/livability';

export interface LivabilityProps {
  location?: string;
  state?: string;
  remote?: boolean;
}

export function Livability({ location, state, remote }: LivabilityProps) {
  const label = locationLabel({ location, state });

  if (remote) {
    return (
      <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, border: '1px solid var(--vt-border, #E2E8E6)', background: 'var(--vt-surface-subtle, #EDF2F0)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--vt-text-primary)' }}>
          <Laptop size={15} aria-hidden="true" /> Remote role
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--vt-text-secondary)', lineHeight: 1.5 }}>
          No relocation needed — live where you like. {label ? `Team based in ${label}.` : ''}
        </p>
      </div>
    );
  }

  if (!label) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <MapPin size={15} aria-hidden="true" style={{ color: 'var(--vt-accent, #0A7B7F)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vt-text-primary)' }}>Livability — {label}</span>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--vt-text-muted)', lineHeight: 1.5 }}>
        Relocation context from external sources. VitalCV doesn&rsquo;t estimate these figures.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
        {LIVABILITY_CATEGORIES.map((cat) => (
          <a
            key={cat.key}
            href={livabilityLookupUrl(cat.key, label)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              textDecoration: 'none',
              border: '1px solid var(--vt-border, #E2E8E6)',
              borderRadius: 10,
              padding: '10px 12px',
              background: 'var(--vt-surface, #fff)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vt-text-primary)' }}>{cat.label}</span>
              <ExternalLink size={12} aria-hidden="true" style={{ color: 'var(--vt-text-muted)', flex: '0 0 auto' }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--vt-text-muted)' }}>{cat.hint}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
