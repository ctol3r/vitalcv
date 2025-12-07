'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ExternalLink,
  ShieldAlert,
  Info,
  Download,
  Link as LinkIcon,
} from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type ComplianceStatus = 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT'

type Regulation = {
  id: string
  name: string
  jurisdiction: string
  url?: string
}

type MappedFeature = {
  id: string
  name: string
  description: string
  status: ComplianceStatus
}

type Evidence = {
  id: string
  title: string
  type: string
  uploadedAt: string
  url: string
}

type ObligationDetail = {
  id: string
  title: string
  description: string
  status: ComplianceStatus
  regulations: Regulation[]
  mappedFeatures: MappedFeature[]
  evidence: Evidence[]
  guidance: string
  lastUpdated: string
  nextReviewDate: string
}

type ObligationDetailViewerProps = {
  obligationId: string
  obligation?: ObligationDetail
  onClose?: () => void
}

export function ObligationDetailViewer({ obligationId, obligation, onClose }: ObligationDetailViewerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'evidence' | 'guidance'>('overview')

  // In a real app, this would fetch from an API
  const obligationData = obligation || buildMockObligation(obligationId)

  const statusBadgeClass = getStatusBadgeClass(obligationData.status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{obligationData.title}</h2>
            <Badge variant="outline" className={statusBadgeClass}>
              {obligationData.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-muted-foreground max-w-3xl">{obligationData.description}</p>
        </div>
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Regulations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />
            Relevant Regulations
          </CardTitle>
          <CardDescription>Regulatory frameworks that apply to this obligation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {obligationData.regulations.map((regulation) => (
              <div key={regulation.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <h4 className="font-medium">{regulation.name}</h4>
                  <p className="text-sm text-muted-foreground">{regulation.jurisdiction}</p>
                </div>
                {regulation.url && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={regulation.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                      View Regulation
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4" aria-label="Obligation detail tabs">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'features', label: 'Mapped Features' },
            { id: 'evidence', label: 'Evidence' },
            { id: 'guidance', label: 'Guidance' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Current Status</p>
                    <div className="flex items-center gap-2">
                      {obligationData.status === 'COMPLIANT' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                      ) : obligationData.status === 'WARNING' ? (
                        <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
                      ) : (
                        <ShieldAlert className="h-5 w-5 text-rose-600" aria-hidden="true" />
                      )}
                      <span className="font-semibold">{obligationData.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Last Updated</p>
                    <p className="font-medium">{obligationData.lastUpdated}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Next Review</p>
                    <p className="font-medium">{obligationData.nextReviewDate}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Mapped Features</p>
                    <p className="text-2xl font-bold">{obligationData.mappedFeatures.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Evidence Attached</p>
                    <p className="text-2xl font-bold">{obligationData.evidence.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Regulations</p>
                    <p className="text-2xl font-bold">{obligationData.regulations.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'features' && (
          <Card>
            <CardHeader>
              <CardTitle>Mapped Features</CardTitle>
              <CardDescription>System features that help fulfill this obligation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {obligationData.mappedFeatures.map((feature) => (
                  <div key={feature.id} className="rounded-md border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{feature.name}</h4>
                      <Badge variant="outline" className={getStatusBadgeClass(feature.status)}>
                        {feature.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
                {obligationData.mappedFeatures.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No features mapped to this obligation yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'evidence' && (
          <Card>
            <CardHeader>
              <CardTitle>Attached Evidence</CardTitle>
              <CardDescription>Documents and artifacts demonstrating compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {obligationData.evidence.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <h4 className="font-medium">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {item.type} • Uploaded {item.uploadedAt}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
                {obligationData.evidence.length === 0 && (
                  <div className="text-center py-8 space-y-2">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">No evidence attached yet.</p>
                    <Button variant="outline" size="sm">
                      Upload Evidence
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'guidance' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" aria-hidden="true" />
                Compliance Guidance
              </CardTitle>
              <CardDescription>Best practices and recommendations for meeting this obligation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground whitespace-pre-line">{obligationData.guidance}</p>
              </div>
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-3">Related Resources</h4>
                <div className="space-y-2">
                  {obligationData.regulations.map((regulation) => (
                    <Link
                      key={regulation.id}
                      href={regulation.url || '#'}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <LinkIcon className="h-4 w-4" aria-hidden="true" />
                      {regulation.name} - Official Documentation
                    </Link>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function getStatusBadgeClass(status: ComplianceStatus): string {
  switch (status) {
    case 'COMPLIANT':
      return 'border-emerald-300 text-emerald-900 bg-emerald-50'
    case 'WARNING':
      return 'border-amber-300 text-amber-900 bg-amber-50'
    case 'NON_COMPLIANT':
      return 'border-rose-300 text-rose-900 bg-rose-50'
  }
}

function buildMockObligation(id: string): ObligationDetail {
  return {
    id,
    title: 'GDPR Data Protection Obligation',
    description:
      'Ensures that personal data of EU residents is processed in accordance with GDPR requirements, including data minimization, purpose limitation, and individual rights.',
    status: 'COMPLIANT',
    regulations: [
      {
        id: 'gdpr',
        name: 'General Data Protection Regulation (GDPR)',
        jurisdiction: 'European Union',
        url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679',
      },
    ],
    mappedFeatures: [
      {
        id: 'feat-001',
        name: 'Data Minimization',
        description: 'System automatically limits data collection to only what is necessary for the stated purpose.',
        status: 'COMPLIANT',
      },
      {
        id: 'feat-002',
        name: 'Right to Access',
        description: 'Users can request and download their personal data through the privacy dashboard.',
        status: 'COMPLIANT',
      },
      {
        id: 'feat-003',
        name: 'Right to Erasure',
        description: 'Data deletion requests are processed within 30 days with audit trail.',
        status: 'COMPLIANT',
      },
      {
        id: 'feat-004',
        name: 'Data Portability',
        description: 'Users can export their data in machine-readable formats (JSON, CSV).',
        status: 'WARNING',
      },
    ],
    evidence: [
      {
        id: 'ev-001',
        title: 'GDPR Compliance Assessment Report',
        type: 'PDF',
        uploadedAt: '2025-10-15',
        url: '#',
      },
      {
        id: 'ev-002',
        title: 'Data Processing Impact Assessment',
        type: 'PDF',
        uploadedAt: '2025-09-20',
        url: '#',
      },
      {
        id: 'ev-003',
        title: 'Privacy Policy Documentation',
        type: 'DOCX',
        uploadedAt: '2025-08-10',
        url: '#',
      },
    ],
    guidance: `To maintain compliance with this obligation:

1. Regularly review and update data processing activities
2. Ensure all data processing has a lawful basis
3. Implement technical and organizational measures to protect personal data
4. Maintain records of processing activities
5. Conduct regular Data Protection Impact Assessments (DPIAs)
6. Train staff on GDPR requirements
7. Establish procedures for handling data subject requests
8. Review and update privacy notices regularly

For questions or concerns, contact the Data Protection Officer.`,
    lastUpdated: '2025-10-15',
    nextReviewDate: '2026-01-15',
  }
}

