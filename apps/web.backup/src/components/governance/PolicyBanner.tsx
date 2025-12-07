'use client';

/**
 * B141B-FE-005: Org policy acceptance banner
 *
 * Displays a prominent banner at the top of the page when a new policy version is published.
 * Features:
 * - Appears for OrgAdmins until they accept the new policy
 * - Button opens a policy modal for review
 * - Persists acceptance state to prevent re-prompting
 * - Accessible with keyboard navigation and screen reader support
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, FileText, X } from 'lucide-react';

interface PolicyVersion {
  id: string;
  version: string;
  title: string;
  publishedAt: string;
  content: string;
  requiresAcceptance: boolean;
}

interface PolicyBannerProps {
  /** User's current role(s) - banner only shows for OrgAdmins */
  userRoles?: string[];
  /** Organization ID to check for policy acceptance */
  orgId?: string;
}

export function PolicyBanner({ userRoles = [], orgId }: PolicyBannerProps) {
  const [latestPolicy, setLatestPolicy] = useState<PolicyVersion | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Check if user is an OrgAdmin
  const isOrgAdmin = userRoles.includes('OrgAdmin') || userRoles.includes('org.admin');

  useEffect(() => {
    if (isOrgAdmin && orgId) {
      checkForNewPolicy();
    }
  }, [isOrgAdmin, orgId]);

  async function checkForNewPolicy() {
    try {
      // TODO: Replace with actual API endpoint
      const response = await fetch(`/api/org/${orgId}/policies/latest`);
      if (!response.ok) throw new Error('Failed to fetch policy');

      const data = await response.json();

      if (data.policy && !data.accepted) {
        setLatestPolicy(data.policy);
        setShowBanner(true);
      }
    } catch (error) {
      console.error('Error checking for new policy:', error);
      // For demo purposes, show a mock policy
      const mockPolicy: PolicyVersion = {
        id: 'policy-001',
        version: '2.1.0',
        title: 'Updated Privacy and Data Protection Policy',
        publishedAt: '2025-11-10',
        content: getMockPolicyContent(),
        requiresAcceptance: true,
      };
      setLatestPolicy(mockPolicy);
      // Check localStorage to see if already accepted
      const acceptedPolicies = JSON.parse(localStorage.getItem('acceptedPolicies') || '[]');
      if (!acceptedPolicies.includes(mockPolicy.id)) {
        setShowBanner(true);
      }
    }
  }

  function getMockPolicyContent(): string {
    return `
# Updated Privacy and Data Protection Policy

**Effective Date:** November 10, 2025
**Version:** 2.1.0

## Summary of Changes

This update to our Privacy and Data Protection Policy includes important changes regarding:

1. **Enhanced Data Encryption**: All PHI (Protected Health Information) must now be encrypted both at rest and in transit using AES-256 encryption.

2. **Audit Log Retention**: Audit logs must be retained for a minimum of 7 years to comply with updated healthcare regulations.

3. **Third-Party Data Sharing**: New restrictions on sharing PHI with third-party services. All data processors must be HIPAA-compliant and undergo annual security audits.

4. **User Access Reviews**: Organization administrators must conduct quarterly access reviews to ensure proper role assignments.

5. **Incident Response**: Updated incident response procedures with mandatory notification within 24 hours of any suspected PHI breach.

## Full Policy Details

### 1. Data Collection and Usage

We collect only the minimum necessary information required to provide credentialing and verification services...

### 2. Data Security Measures

All organizational data is protected using industry-standard security measures...

### 3. User Rights and Responsibilities

Organization members have the right to access, modify, and request deletion of their data...

### 4. Compliance Requirements

This policy ensures compliance with HIPAA, HITECH, and state-specific healthcare regulations...

---

By accepting this policy, you acknowledge that you have read, understood, and agree to comply with all terms outlined above.
    `;
  }

  async function handleAcceptPolicy() {
    if (!latestPolicy) return;

    try {
      setAccepting(true);

      // TODO: Replace with actual API endpoint
      const response = await fetch(`/api/org/${orgId}/policies/${latestPolicy.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to accept policy');

      // Persist acceptance locally
      const acceptedPolicies = JSON.parse(localStorage.getItem('acceptedPolicies') || '[]');
      acceptedPolicies.push(latestPolicy.id);
      localStorage.setItem('acceptedPolicies', JSON.stringify(acceptedPolicies));

      // Hide banner and modal
      setShowBanner(false);
      setShowPolicyModal(false);
    } catch (error) {
      console.error('Error accepting policy:', error);
      alert('Failed to accept policy. Please try again.');
    } finally {
      setAccepting(false);
    }
  }

  function handleDismiss() {
    // Temporarily hide the banner (it will show again on next page load if not accepted)
    setShowBanner(false);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  if (!showBanner || !latestPolicy) {
    return null;
  }

  return (
    <>
      {/* Banner */}
      <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900 mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3 flex-1">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-500 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="font-semibold text-orange-900 dark:text-orange-100">
                  New Policy Requires Your Attention
                </p>
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  A new version ({latestPolicy.version}) of our <strong>{latestPolicy.title}</strong> was published on {formatDate(latestPolicy.publishedAt)}.
                  As an Organization Administrator, you must review and accept this policy before it takes effect.
                </p>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => setShowPolicyModal(true)}
                    variant="default"
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Review Policy
                  </Button>
                  <Button
                    onClick={handleDismiss}
                    variant="outline"
                    size="sm"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              aria-label="Dismiss policy banner"
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Policy Review Modal */}
      <Dialog open={showPolicyModal} onOpenChange={setShowPolicyModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {latestPolicy.title}
            </DialogTitle>
            <DialogDescription>
              Version {latestPolicy.version} • Published {formatDate(latestPolicy.publishedAt)}
            </DialogDescription>
          </DialogHeader>

          {/* Policy Content - Scrollable */}
          <div className="flex-1 overflow-y-auto py-4 pr-2">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-sm">
                {latestPolicy.content}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setShowPolicyModal(false)}
              disabled={accepting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAcceptPolicy}
              disabled={accepting}
            >
              {accepting ? 'Accepting...' : 'Accept Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

