/**
 * Public Stats Strip Component
 * B133C-FE-004
 *
 * Displays aggregate platform statistics from /public/stats endpoint:
 * - VCs issued
 * - Organizations live
 * - Jobs posted
 *
 * Responsive design with animated counting effect.
 */

"use client";

import { useEffect, useState } from 'react';

interface PublicStats {
  vcsIssued: number;
  organizationsLive: number;
  jobsPosted: number;
  lastUpdated?: string;
  cached?: boolean;
}

interface StatItemProps {
  label: string;
  value: number;
  suffix?: string;
  icon?: string;
  animate?: boolean;
}

function StatItem({ label, value, suffix = '', icon, animate = true }: StatItemProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!animate) {
      setDisplayValue(value);
      return;
    }

    // Animated counting effect
    const duration = 1500; // 1.5 seconds
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current += increment;

      if (step >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, animate]);

  const formattedValue = displayValue.toLocaleString();

  return (
    <div className="flex flex-col items-center text-center px-4 py-3">
      {icon && (
        <div className="text-3xl md:text-4xl mb-2" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="text-3xl md:text-5xl font-bold tracking-tight">
        {formattedValue}
        {suffix && <span className="text-2xl md:text-3xl opacity-70">{suffix}</span>}
      </div>
      <div className="text-sm md:text-base opacity-70 mt-1">
        {label}
      </div>
    </div>
  );
}

export default function PublicStatsStrip() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(false);

      // Use backend API endpoint
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
      const response = await fetch(`${apiBase}/public/stats`, {
        cache: 'no-store', // Don't cache on client side (server handles caching)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('[PublicStatsStrip] Failed to fetch stats:', err);
      setError(true);

      // Fallback to demo data
      setStats({
        vcsIssued: 12500,
        organizationsLive: 45,
        jobsPosted: 320,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full py-8 px-4 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">
          Loading platform statistics...
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="w-full py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          <StatItem
            icon="📄"
            value={stats.vcsIssued}
            label="Verifiable Credentials Issued"
            suffix="+"
          />
          <StatItem
            icon="🏥"
            value={stats.organizationsLive}
            label="Organizations Live"
          />
          <StatItem
            icon="💼"
            value={stats.jobsPosted}
            label="Active Job Postings"
          />
        </div>

        {/* Meta Information */}
        <div className="mt-6 text-center text-xs opacity-50">
          {stats.cached && (
            <span className="mr-4" title="Data is cached on server">
              📊 Cached
            </span>
          )}
          {stats.lastUpdated && (
            <span title={new Date(stats.lastUpdated).toLocaleString()}>
              Updated: {new Date(stats.lastUpdated).toLocaleTimeString()}
            </span>
          )}
          {error && (
            <span className="text-yellow-600 ml-4" title="Using demo data">
              ⚠️ Demo Mode
            </span>
          )}
        </div>

        {/* Call to Action */}
        <div className="mt-8 text-center">
          <p className="text-sm opacity-70 mb-3">
            Join thousands of healthcare professionals using verified credentials
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <a
              href="/signup"
              className="px-5 py-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              Get Started Free
            </a>
            <a
              href="/docs/regulatory"
              className="px-5 py-2 rounded-lg border hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Learn More →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version for smaller spaces (e.g., footer, sidebar)
 */
export function PublicStatsCompact() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
        const response = await fetch(`${apiBase}/public/stats`);
        if (response.ok) {
          setStats(await response.json());
        }
      } catch (err) {
        console.error('[PublicStatsCompact] Failed to fetch stats:', err);
      }
    })();
  }, []);

  if (!stats) {
    return null;
  }

  return (
    <div className="flex items-center gap-6 text-sm">
      <div>
        <span className="font-semibold">{stats.vcsIssued.toLocaleString()}</span>
        <span className="opacity-60 ml-1">VCs</span>
      </div>
      <div className="opacity-30">•</div>
      <div>
        <span className="font-semibold">{stats.organizationsLive}</span>
        <span className="opacity-60 ml-1">Orgs</span>
      </div>
      <div className="opacity-30">•</div>
      <div>
        <span className="font-semibold">{stats.jobsPosted}</span>
        <span className="opacity-60 ml-1">Jobs</span>
      </div>
    </div>
  );
}

