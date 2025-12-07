'use client';

/**
 * S72-POST-2C-007: Public Changelog page for demo environment
 *
 * Lists major changes by date since 3-day MVP.
 * Includes short notes and link from demo footer.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Sparkles, Shield, Zap, Users, Globe } from 'lucide-react';

interface ChangelogEntry {
  date: string;
  version?: string;
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'security' | 'integration' | 'bugfix';
  highlights?: string[];
}

const changelogEntries: ChangelogEntry[] = [
  {
    date: '2025-11-09',
    version: '1.0.0',
    title: 'MVP Launch',
    description: 'Initial release of VitalCV platform with core credentialing workflows.',
    category: 'feature',
    highlights: [
      'NPI-based identity verification',
      'Verifiable credential issuance (W3C VC)',
      'Credential verification and revocation',
      'Job application workflow',
      'Privileging workflow (demo)',
    ],
  },
  {
    date: '2025-11-03',
    title: 'Pilot → Live Export',
    description: 'Added branded document export and invoice PDF generation.',
    category: 'feature',
    highlights: ['Branded document templates', 'Invoice PDF generation', 'Export functionality'],
  },
  {
    date: '2025-11-02',
    title: 'OIDC4VCI + StatusList + Anchors',
    description: 'Implemented OIDC4VCI credential issuance, status list management, and blockchain anchoring.',
    category: 'integration',
    highlights: [
      'OIDC4VCI flow for credential issuance',
      'Status list for revocation management',
      'Blockchain anchoring (demo)',
    ],
  },
  {
    date: '2025-11-01',
    title: 'Agent MCP Box + Domain Packs',
    description: 'Added agent system with MCP (Model Context Protocol) integration and domain-specific packs.',
    category: 'feature',
    highlights: ['Multi-agent system', 'MCP integration', 'Domain-specific agent packs'],
  },
  {
    date: '2025-10-28',
    title: 'Security & Governance Dashboard',
    description: 'Added comprehensive security and governance dashboard for organizations.',
    category: 'security',
    highlights: [
      'Policy acceptance tracking',
      'Two-factor authentication management',
      'Roles and permissions management',
      'Audit log viewer',
    ],
  },
  {
    date: '2025-10-25',
    title: 'NPI Claim System',
    description: 'Implemented multi-level NPI claim verification workflow.',
    category: 'feature',
    highlights: [
      'Level 0: Public NPI lookup',
      'Level 1: Email OTP verification',
      'Level 2: Document upload and OCR',
      'Level 3: Issuer attestation',
    ],
  },
  {
    date: '2025-10-20',
    title: 'AI-Powered Job Matching',
    description: 'Added AI matching engine for credential-to-job matching.',
    category: 'feature',
    highlights: ['Semantic matching', 'Credential analysis', 'Job recommendation engine'],
  },
  {
    date: '2025-10-15',
    title: 'Mobile Wallet Support',
    description: 'Added support for mobile credential wallets and QR code scanning.',
    category: 'feature',
    highlights: ['QR code generation', 'Mobile wallet compatibility', 'Deep linking'],
  },
];

function getCategoryIcon(category: ChangelogEntry['category']) {
  switch (category) {
    case 'feature':
      return <Sparkles className="h-4 w-4" />;
    case 'improvement':
      return <Zap className="h-4 w-4" />;
    case 'security':
      return <Shield className="h-4 w-4" />;
    case 'integration':
      return <Globe className="h-4 w-4" />;
    case 'bugfix':
      return <Zap className="h-4 w-4" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function getCategoryBadge(category: ChangelogEntry['category']) {
  const variants: Record<ChangelogEntry['category'], { label: string; className: string }> = {
    feature: { label: 'Feature', className: 'bg-blue-500' },
    improvement: { label: 'Improvement', className: 'bg-green-500' },
    security: { label: 'Security', className: 'bg-purple-500' },
    integration: { label: 'Integration', className: 'bg-orange-500' },
    bugfix: { label: 'Bug Fix', className: 'bg-red-500' },
  };

  const variant = variants[category];
  return (
    <Badge className={variant.className} variant="default">
      {variant.label}
    </Badge>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ChangelogPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
          <Calendar className="h-8 w-8" />
          Changelog
        </h1>
        <p className="text-muted-foreground text-lg">
          Major changes and updates to the VitalCV platform since MVP launch.
        </p>
      </div>

      {/* Changelog Entries */}
      <div className="space-y-6">
        {changelogEntries.map((entry, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getCategoryIcon(entry.category)}
                    <CardTitle className="text-xl">{entry.title}</CardTitle>
                    {entry.version && (
                      <Badge variant="outline" className="ml-2">
                        v{entry.version}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-base">{entry.description}</CardDescription>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {getCategoryBadge(entry.category)}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(entry.date)}
                  </div>
                </div>
              </div>
            </CardHeader>
            {entry.highlights && entry.highlights.length > 0 && (
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {entry.highlights.map((highlight, idx) => (
                    <li key={idx}>{highlight}</li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Footer Note */}
      <Card className="mt-8 bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Users className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">About This Changelog</p>
              <p>
                This changelog tracks major changes to the VitalCV platform since the MVP launch on
                November 9, 2025. For detailed technical documentation, see{' '}
                <a href="/docs" className="text-primary hover:underline">
                  our documentation
                </a>
                .
              </p>
              <p>
                For questions or feedback, please contact{' '}
                <a href="mailto:support@vitalcv.com" className="text-primary hover:underline">
                  support@vitalcv.com
                </a>
                .
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

