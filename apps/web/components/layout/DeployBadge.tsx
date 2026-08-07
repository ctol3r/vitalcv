'use client';

/**
 * DeployBadge — subtle live/preview indicator in the Footer.
 *
 * Fetches /api/deploy-info once on mount. Shows:
 *   ● Live          (production)
 *   ◆ Preview       (preview deployment)
 *   ○ Dev           (local development)
 *
 * Links to /updates. Non-intrusive; designed to be a single line in the footer.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface DeployInfo {
  env: 'production' | 'preview' | 'development';
  sha: string;
  message: string;
  branch: string;
  /** ISO build timestamp, or null when the build time is unknown. */
  deployedAt: string | null;
}

function useDeployInfo() {
  const [info, setInfo] = useState<DeployInfo | null>(null);

  useEffect(() => {
    fetch('/api/deploy-info')
      .then((r) => r.ok ? r.json() : null)
      .then((d: DeployInfo | null) => { if (d) setInfo(d); })
      .catch(() => null);
  }, []);

  return info;
}

/**
 * Relative build age, or null when the build time is unknown.
 *
 * `deployedAt` used to fall back to the request clock, so this rendered
 * "just now" on every page load regardless of when the build actually ran.
 * An unknown build time now renders nothing rather than a comforting lie.
 */
function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) return null;
  const ms = Date.now() - parsed;
  const mins = Math.floor(ms / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function DeployBadge() {
  const info = useDeployInfo();

  if (!info) {
    // Render nothing until loaded — avoids layout shift
    return null;
  }

  const isProd = info.env === 'production';
  const isPrev = info.env === 'preview';

  const dot = isProd
    ? 'bg-emerald-400'
    : isPrev
      ? 'bg-amber-400'
      : 'bg-muted';

  const label = isProd ? 'Live' : isPrev ? 'Preview' : 'Dev';
  const age = relativeTime(info.deployedAt);

  return (
    <Link
      href="/updates"
      className="inline-flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/70 transition-colors"
      title="View latest updates"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${isProd ? 'animate-pulse' : ''}`} />
      <span>{label}</span>
      {age && (
        <>
          <span className="text-white/30">·</span>
          <span>{age}</span>
        </>
      )}
    </Link>
  );
}
