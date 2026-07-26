import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Lock,
} from 'lucide-react';
import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { StoryIcon } from '@/components/home/StoryIcon';
import type { JourneyChapter, JourneyRowState } from '@/components/home/journey';

/**
 * JourneyCard (W2.2) — one rotary-file leaf of the career journey.
 *
 * Semantic, server-renderable content: heading, claim, source-state rows, and
 * a real next action — the card IS the chapter's meaning, with or without the
 * rail's 3D pose (the `.journey-card` class receives the leaf transform vars
 * only in pinned mode). Visual grammar reuses the approved story-card shell
 * and state classes, so the card language is unchanged from the reviewed
 * product story.
 */

const STATE_META: Record<JourneyRowState, { icon: React.ReactNode; className: string }> = {
  source: { icon: <CheckCircle2 size={12} aria-hidden="true" />, className: 'story-state-source' },
  checked: { icon: <CheckCircle2 size={12} aria-hidden="true" />, className: 'story-state-checked' },
  gated: { icon: <Lock size={12} aria-hidden="true" />, className: 'story-state-gated' },
  attention: {
    icon: <AlertTriangle size={12} aria-hidden="true" />,
    className: 'story-state-attention',
  },
  neutral: { icon: <Circle size={11} aria-hidden="true" />, className: 'story-state-neutral' },
};

export function JourneyCard({ chapter }: { chapter: JourneyChapter }) {
  return (
    <div className="journey-card" data-journey-card={chapter.id}>
      <Card className="story-card-shell">
        <div className="story-card-copy">
          <span className="story-card-icon" aria-hidden="true">
            <StoryIcon name={chapter.icon} size={40} />
          </span>
          <p className="story-card-eyebrow">{chapter.eyebrow}</p>
          <h3>{chapter.title}</h3>
          <p>{chapter.body}</p>
        </div>

        <div className="story-product-ui" aria-label={`${chapter.label} product example`}>
          <div className="story-product-topline">
            <span>{chapter.label}</span>
            <span>Illustrative</span>
          </div>
          <ul>
            {chapter.rows.map((row) => (
              <li key={`${chapter.id}-${row.label}`}>
                <span>{row.label}</span>
                <span className={`story-state ${STATE_META[row.state].className}`}>
                  {STATE_META[row.state].icon}
                  {row.detail}
                </span>
              </li>
            ))}
          </ul>
          <Link href={chapter.href} className="story-product-action" data-journey-action={chapter.id}>
            {chapter.action}
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default JourneyCard;
