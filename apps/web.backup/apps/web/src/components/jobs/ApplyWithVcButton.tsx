/**
 * B149B-FE-009: Hide 'Apply with VitalCV' button when `applyWithVC.enabled=false`
 *
 * Component that conditionally renders the Apply with VitalCV button based on feature flag.
 * If flag disabled for org, button is not rendered and fallback text is shown.
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

interface ApplyWithVcButtonProps {
  jobId: string;
  partnerId?: string;
  orgId?: string;
  onApply?: () => void;
  className?: string;
  fallbackText?: string;
}

/**
 * Check if applyWithVC feature is enabled for the organization
 */
async function checkApplyWithVCEnabled(orgId?: string): Promise<boolean> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const url = orgId
      ? `${apiUrl}/api/feature-flags/applyWithVC.enabled?orgId=${orgId}`
      : `${apiUrl}/api/feature-flags/applyWithVC.enabled`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // If endpoint doesn't exist or returns error, default to enabled
      console.warn('[ApplyWithVcButton] Feature flag check failed, defaulting to enabled');
      return true;
    }

    const data = await response.json();
    return data.enabled === true;
  } catch (error) {
    console.error('[ApplyWithVcButton] Error checking feature flag:', error);
    // Default to enabled on error to avoid breaking existing functionality
    return true;
  }
}

/**
 * ApplyWithVcButton component
 * Renders the Apply with VitalCV button only if the feature flag is enabled
 */
export function ApplyWithVcButton({
  jobId,
  partnerId,
  orgId,
  onApply,
  className,
  fallbackText = 'Apply with traditional application',
}: ApplyWithVcButtonProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkFlag() {
      setLoading(true);
      const isEnabled = await checkApplyWithVCEnabled(orgId);
      setEnabled(isEnabled);
      setLoading(false);
    }

    checkFlag();
  }, [orgId]);

  const handleApply = () => {
    if (typeof window !== 'undefined' && (window as any).VitalCV) {
      (window as any).VitalCV.apply({
        jobId,
        partnerId,
      });
    } else if (onApply) {
      onApply();
    } else {
      // Fallback: redirect to apply page
      window.location.href = `/apply/${jobId}`;
    }
  };

  // Show loading state (optional - can be removed if you want instant render)
  if (loading) {
    return (
      <Button disabled className={className}>
        <Shield className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    );
  }

  // If feature is disabled, don't render button
  if (enabled === false) {
    return (
      <div className={className}>
        <p className="text-sm text-gray-600">{fallbackText}</p>
      </div>
    );
  }

  // Feature is enabled, render button
  return (
    <Button onClick={handleApply} className={className}>
      <Shield className="h-4 w-4 mr-2" />
      Apply with VitalCV
    </Button>
  );
}

