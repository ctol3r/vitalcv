import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { TrustStateCard } from '@/components/trust-state/TrustStateCard';
import { CredentialFactCard } from '@/components/trust-state/CredentialFactCard';
import { SourceProvenanceDrawer } from '@/components/trust-state/SourceProvenanceDrawer';
import { EvidenceArtifactPreview } from '@/components/trust-state/EvidenceArtifactPreview';
import { MonitoringStatusBadge } from '@/components/trust-state/MonitoringStatusBadge';
import { SanctionRiskBadge } from '@/components/trust-state/SanctionRiskBadge';
import { DisclosureScopePanel } from '@/components/trust-state/DisclosureScopePanel';
import { AuditTrailTimeline } from '@/components/trust-state/AuditTrailTimeline';
import { ClearToStartBanner } from '@/components/trust-state/ClearToStartBanner';
import { TrustWidget } from '@/components/embeddable/TrustWidget';
import { TrustConsentModal } from '@/components/embeddable/TrustConsentModal';
import { Button } from '@/components/ui/button';

export default {
  title: 'Trust Primitives',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

const MOCK_DATA = {
  success: {
    band: 'GREEN',
    windowStatus: 'WITHIN_WINDOW',
    verifiedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 86400000 * 100).toISOString(),
    daysRemaining: 100,
    windowDays: 120,
    startReady: true,
    blockingReasons: [],
  } as any,
  expiring: {
    band: 'YELLOW',
    windowStatus: 'EXPIRING_SOON',
    verifiedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 86400000 * 5).toISOString(),
    daysRemaining: 5,
    windowDays: 120,
    startReady: false,
    blockingReasons: [],
  } as any,
};

export const AllTrustPrimitives = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="w-full max-w-2xl space-y-8 p-6 bg-slate-50 min-h-screen">
      <div>
        <h2 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Monitoring & Risk Badges</h2>
        <div className="flex gap-4">
          <MonitoringStatusBadge active={true} lastMonitoredAt={new Date().toISOString()} />
          <MonitoringStatusBadge active={false} lastMonitoredAt={new Date().toISOString()} />
          <SanctionRiskBadge hasRisk={false} />
          <SanctionRiskBadge hasRisk={true} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Clear To Start Banner</h2>
        <ClearToStartBanner />
      </div>

      {/* Section 8: Embeddable Widget */}
      <section>
        <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b">Embeddable Widget & Consent</h2>
        <div className="grid grid-cols-1 gap-8 max-w-2xl">
          <div>
            <h3 className="text-sm font-semibold mb-3 text-slate-500">Trust Widget (Clear to Start)</h3>
            <TrustWidget data={MOCK_DATA.success} />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3 text-slate-500">Trust Widget (Review Needed)</h3>
            <TrustWidget data={MOCK_DATA.expiring} />
          </div>
          <div className="h-[400px] border border-dashed border-slate-300 rounded-xl relative overflow-hidden">
            <h3 className="text-sm font-semibold m-3 text-slate-500 absolute top-0 left-0 z-50">Consent Modal Simulator</h3>
            {/* We mock the fixed positioning by putting it in this relative container but normally it's fixed w/ backdrop */}
            <div className="absolute inset-0 z-40 bg-white">
              <TrustConsentModal requestingParty="MegaHealth System" purposes={['Employment Verification']} />
            </div>
          </div>
        </div>
      </section>

      <div>
        <h2 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Disclosure Scope Panel</h2>
        <DisclosureScopePanel purposes={['Pre-employment Verification', 'Credentialing Check']} expiresInDays={30} />
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Evidence Artifact Preview</h2>
        <EvidenceArtifactPreview
          artifactName="State Medical License (CA)"
           fieldsDisclosed={['License Number', 'Issue Date', 'Expiration', 'Status']}
           fieldsRedacted={['Home Address', 'Date of Birth', 'SSN']}
        />
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Credential Fact Card</h2>
        <CredentialFactCard
          credential={{
            credentialType: 'STATE_LICENSE',
            status: 'ACTIVE',
            issuer: 'California Medical Board',
            issuingStateOrBody: 'State of California',
            credentialIdentifier: 'A-123456',
            issueDate: '2020-01-01T00:00:00.000Z',
            expirationDate: '2025-01-01T00:00:00.000Z',
          }}
        />
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Trust State Card</h2>
        <TrustStateCard
          data={{
            band: 'GREEN',
            windowStatus: 'WITHIN_WINDOW',
            verifiedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
            validUntil: new Date(Date.now() + 86400000 * 100).toISOString(),
            daysRemaining: 100,
            windowDays: 120,
            startReady: true,
            blockingReasons: [],
          }}
        />
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Audit Trail Timeline</h2>
        <AuditTrailTimeline
          events={[
            {
              id: '1',
              type: 'SOURCE_RETRIEVED',
              label: 'Medical License Retrieved',
              timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
              signer: 'Nursys API Gateway',
              hash: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
              metadata: { source: 'Nursys', method: 'API_DIRECT' }
            },
            {
              id: '2',
              type: 'PORTABLE_ARTIFACT_ISSUED',
              label: 'Portable Trust Artifact Generated',
              timestamp: new Date(Date.now() - 86400000 * 1.5).toISOString(),
              signer: 'VitalCV Network',
              hash: '8b1a9953c4611296a827abf8c47804d7e6c49c6b',
              metadata: { keyId: 'v1_es256_prod_99' }
            },
            {
              id: '3',
              type: 'VERIFICATION_COMPLETED',
              label: 'Verification Accepted',
              employer: 'Mercor Health',
              facility: 'Main Campus',
              timestamp: new Date().toISOString(),
              metadata: {}
            }
          ]}
        />
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Source Provenance Drawer</h2>
        <Button onClick={() => setDrawerOpen(true)}>Open Provenance Drawer</Button>
        <SourceProvenanceDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          retrieval={{
            method: 'API',
            retrievedAt: new Date().toISOString(),
            agent: { system: 'VitalCV Data Engine', version: '2.4.1' },
            source: { sourceType: 'NCSBN', sourceName: 'Nursys Encompass', authoritative: true, sourceUrl: '' }
          }}
          integrity={{
            signatureAlgorithm: 'ES256',
            publicKeyId: 'k1_prod_99xyz',
            artifactHash: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
            rawPayloadHash: 'payload_hash_here',
            signedAt: new Date().toISOString()
          }}
        />
      </div>

    </div>
  );
};
