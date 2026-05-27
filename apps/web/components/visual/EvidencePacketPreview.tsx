'use client';

import * as React from 'react';
import { Button } from './primitives';
import { TruthChip } from './TruthChip';
import type { TruthState } from './types';

/**
 * Evidence Packet Preview (chat22 fix #10).
 *
 * Pre-send preview surface — what the institution will receive when the
 * clinician shares a scope-bound packet. Renders as a slide-in drawer
 * with a printable summary inside.
 *
 * The "scope" toggle list is real — selecting fields adjusts what the
 * packet would contain. We don't actually send anything from this preview;
 * the parent owns the actual send/share action.
 */

export type PacketField = {
  id: string;
  label: string;
  state: TruthState;
  source: string;
};

export type EvidencePacketPreviewProps = {
  open: boolean;
  onClose: () => void;
  subjectName: string;
  subjectNpi: string;
  recipientHint?: string;
  fields: PacketField[];
  /** Field ids that are initially included; defaults to all. */
  initialIncluded?: string[];
  /** Called when the user confirms send. The parent owns the actual API call. */
  onSend?: (includedFieldIds: string[]) => void;
};

export function EvidencePacketPreview({
  open,
  onClose,
  subjectName,
  subjectNpi,
  recipientHint = 'Institution credentialing office',
  fields,
  initialIncluded,
  onSend,
}: EvidencePacketPreviewProps) {
  const [included, setIncluded] = React.useState<Set<string>>(
    () => new Set(initialIncluded ?? fields.map((f) => f.id)),
  );

  React.useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function toggle(id: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSend() {
    onSend?.(Array.from(included));
  }

  return (
    <>
      <div
        className="vs-drawer-backdrop"
        data-open={open}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className="vs-drawer"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label="Evidence packet preview"
        aria-hidden={!open}
        style={{ width: 'min(560px, 92vw)' }}
      >
        <div className="vs-drawer-hd">
          <span className="vs-ttl">Evidence packet · preview</span>
          <Button variant="ghost" size="md" onClick={onClose} aria-label="Close evidence packet preview">
            Close ✕
          </Button>
        </div>
        <div className="vs-drawer-bd">
          <div className="vs-eyebrow" style={{ marginBottom: 10 }}>
            <span className="vs-tag">Scoped share</span>
            <span className="vs-ln" />
            <span>For {recipientHint}</span>
          </div>
          <h3 className="vs-h2" style={{ marginBottom: 6 }}>
            {subjectName}
          </h3>
          <p className="vs-muted vs-small" style={{ marginBottom: 18 }}>
            NPI <span className="mono">{subjectNpi}</span> · only the fields below will be
            included.
          </p>

          <div className="vs-card">
            <div className="vs-card-hd">
              <span className="vs-ttl">Fields in this packet</span>
              <span className="vs-sp" />
              <span className="vs-aside">{included.size} of {fields.length}</span>
            </div>
            <div className="vs-card-bd" style={{ padding: '6px 18px' }}>
              {fields.map((field) => {
                const isIn = included.has(field.id);
                return (
                  <label
                    key={field.id}
                    className="vs-field"
                    style={{ cursor: 'pointer', alignItems: 'center' }}
                  >
                    <span className="vs-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={isIn}
                        onChange={() => toggle(field.id)}
                        aria-label={`Include ${field.label}`}
                      />
                      {field.label}
                    </span>
                    <span className="vs-value vs-muted vs-small">
                      {isIn ? 'will be sent' : 'excluded'}
                    </span>
                    <span className="vs-meta">
                      <TruthChip state={field.state} source={field.source} />
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <p className="vs-muted vs-small" style={{ marginTop: 18, lineHeight: 1.55 }}>
            The recipient sees only the fields above plus a read receipt. Final review remains the
            institution&apos;s responsibility — VitalCV never marks the clinician cleared or approved.
          </p>
        </div>
        <div className="vs-drawer-ft">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <span className="vs-sp" style={{ flex: 1 }} />
          <Button variant="accent" onClick={handleSend} disabled={included.size === 0}>
            Send packet
          </Button>
        </div>
      </aside>
    </>
  );
}
