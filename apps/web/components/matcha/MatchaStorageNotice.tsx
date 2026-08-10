'use client';

/**
 * MatchaStorageNotice — says where the answers on this screen are actually kept.
 *
 * MATCHA surfaces state "everything you enter stays yours" and render a completeness
 * figure with no qualifier. That reads as a durable account record, and for a signed-out
 * visitor or a clinician whose account store is not answering it simply is not one. This
 * strip carries the qualifier next to the figure it qualifies, rather than leaving the
 * reader to assume the stronger claim.
 *
 * Renders nothing when the account store holds the answers and the last write landed —
 * there is no news in the working case.
 */

import type { MatchaSyncNotice } from '@/lib/matcha/sync';

const TONE_COLOR: Record<MatchaSyncNotice['tone'], string> = {
  info: 'var(--state-info, #2563eb)',
  warn: 'var(--state-pending, #b45309)',
};

export function MatchaStorageNotice({ notice }: { notice: MatchaSyncNotice | null }) {
  if (!notice) return null;
  const accent = TONE_COLOR[notice.tone];

  return (
    <div
      role="status"
      data-matcha-sync-tone={notice.tone}
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '12px 14px',
        borderRadius: 12,
        border: `1px solid color-mix(in srgb, ${accent} 32%, transparent)`,
        background: `color-mix(in srgb, ${accent} 7%, var(--vt-surface, #fff))`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: accent,
          flex: '0 0 auto',
          marginTop: 6,
        }}
      />
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--vt-text-primary)' }}>
        <strong style={{ fontWeight: 600 }}>{notice.label}.</strong>{' '}
        <span style={{ color: 'var(--vt-text-secondary)' }}>{notice.detail}</span>
      </p>
    </div>
  );
}

/**
 * Offers preferences found in this browser that carry no account. Ownership cannot be
 * read off storage — they may be this clinician's from before their answers were bound
 * to an account, or the previous person's on a shared device — so the choice belongs to
 * the person reading the screen, not to a migration.
 */
export function MatchaUnboundPreferencesPrompt({
  answeredCount,
  onAdopt,
  onDismiss,
}: {
  answeredCount: number;
  onAdopt: () => void;
  onDismiss: () => void;
}) {
  if (answeredCount <= 0) return null;

  return (
    <div
      data-matcha-unbound-prompt=""
      style={{
        padding: '14px 16px',
        borderRadius: 12,
        border: '1px solid var(--vt-border, #E2E8E6)',
        background: 'var(--vt-surface, #fff)',
      }}
    >
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--vt-text-primary)' }}>
        This browser holds {answeredCount} saved {answeredCount === 1 ? 'answer' : 'answers'} from
        before preferences were kept with your account. We cannot tell whose they are, so they
        are not part of your account until you say they are yours.
      </p>
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={onAdopt}
          style={{
            padding: '8px 14px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid var(--vt-accent, #0A7B7F)',
            background: 'var(--vt-accent, #0A7B7F)',
            color: '#fff',
          }}
        >
          These are mine
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: '8px 14px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid var(--vt-border, #D6DED9)',
            background: 'var(--vt-surface, #fff)',
            color: 'var(--vt-text-primary)',
          }}
        >
          Discard them
        </button>
      </div>
    </div>
  );
}
