"use client";

export default function PreprodBanner() {
  const flags = [] as string[];

  if (process.env.NEXT_PUBLIC_PROMOTE_AUTO === '1') flags.push('Auto-Promote');
  if (process.env.NEXT_PUBLIC_OIDC_DEMO === '1') flags.push('OIDC Demo');
  if (process.env.NEXT_PUBLIC_STREAM_DEFAULT === '1') flags.push('Streaming');

  return flags.length ? (
    <div className="text-xs px-3 py-1.5 rounded bg-yellow-50 border border-yellow-200 text-yellow-800 font-medium">
      🔧 Preprod: {flags.join(' • ')}
    </div>
  ) : null;
}

