'use client'

import { useState } from 'react'
import {
  BookOpen,
  FileText,
  ExternalLink,
  ShieldAlert,
  Search,
  ChevronRight,
  Info,
  Link as LinkIcon,
} from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Regulation = {
  id: string
  name: string
  abbreviation: string
  jurisdiction: string
  description: string
  obligations: string[]
  bestPractices: string[]
  legalReferences: { title: string; url: string }[]
  policyDocuments: { title: string; url: string }[]
  evidenceExamples: string[]
}

export default function ComplianceEducationPage() {
  const [search, setSearch] = useState('')
  const [selectedRegulation, setSelectedRegulation] = useState<string | null>(null)

  const regulations: Regulation[] = [
    {
      id: 'gdpr',
      name: 'General Data Protection Regulation',
      abbreviation: 'GDPR',
      jurisdiction: 'European Union',
      description:
        'The GDPR is a comprehensive data protection law that governs how organizations process personal data of EU residents. It emphasizes transparency, accountability, and individual rights.',
      obligations: [
        'Lawful basis for processing personal data',
        'Data minimization and purpose limitation',
        'Right to access personal data',
        'Right to rectification',
        'Right to erasure (right to be forgotten)',
        'Right to data portability',
        'Right to object to processing',
        'Data breach notification',
        'Data Protection Impact Assessments (DPIAs)',
        'Appointment of Data Protection Officer (DPO) where required',
      ],
      bestPractices: [
        'Implement privacy by design and by default',
        'Maintain records of processing activities',
        'Conduct regular DPIAs for high-risk processing',
        'Establish clear data retention policies',
        'Train staff on GDPR requirements',
        'Implement technical and organizational security measures',
        'Establish procedures for handling data subject requests',
        'Regularly review and update privacy notices',
      ],
      legalReferences: [
        {
          title: 'GDPR Official Text (EUR-Lex)',
          url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679',
        },
        {
          title: 'GDPR Guidelines (EDPB)',
          url: 'https://edpb.europa.eu/our-work-tools/general-guidance/gdpr-guidelines-recommendations-best-practices_en',
        },
      ],
      policyDocuments: [
        { title: 'Privacy Policy Template', url: '/docs/privacy-policy-template.pdf' },
        { title: 'Data Processing Agreement', url: '/docs/dpa-template.pdf' },
        { title: 'DPIA Template', url: '/docs/dpia-template.pdf' },
      ],
      evidenceExamples: [
        'Records of processing activities',
        'Data Protection Impact Assessment reports',
        'Privacy notices and consent forms',
        'Data subject request handling logs',
        'Data breach incident reports',
        'Staff training records',
      ],
    },
    {
      id: 'hipaa',
      name: 'Health Insurance Portability and Accountability Act',
      abbreviation: 'HIPAA',
      jurisdiction: 'United States',
      description:
        'HIPAA establishes national standards for protecting sensitive patient health information. It includes the Privacy Rule and Security Rule, which govern how covered entities handle Protected Health Information (PHI).',
      obligations: [
        'Implement administrative, physical, and technical safeguards',
        'Conduct risk assessments',
        'Develop and implement security policies and procedures',
        'Train workforce members on HIPAA requirements',
        'Execute Business Associate Agreements (BAAs)',
        'Maintain audit logs of PHI access',
        'Implement access controls and authentication',
        'Encrypt PHI in transit and at rest',
        'Report security incidents and breaches',
        'Designate a Privacy Officer and Security Officer',
      ],
      bestPractices: [
        'Conduct annual HIPAA risk assessments',
        'Implement least privilege access controls',
        'Use encryption for all PHI',
        'Regularly update security policies',
        'Conduct workforce training on HIPAA annually',
        'Maintain comprehensive audit logs',
        'Implement incident response procedures',
        'Regularly review and update BAAs',
      ],
      legalReferences: [
        {
          title: 'HIPAA Privacy Rule (HHS)',
          url: 'https://www.hhs.gov/hipaa/for-professionals/privacy/index.html',
        },
        {
          title: 'HIPAA Security Rule (HHS)',
          url: 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
        },
      ],
      policyDocuments: [
        { title: 'HIPAA Privacy Policy Template', url: '/docs/hipaa-privacy-policy.pdf' },
        { title: 'BAA Template', url: '/docs/baa-template.pdf' },
        { title: 'Risk Assessment Checklist', url: '/docs/hipaa-risk-assessment.pdf' },
      ],
      evidenceExamples: [
        'Risk assessment reports',
        'Security policies and procedures documentation',
        'Workforce training records',
        'Business Associate Agreements',
        'Audit logs of PHI access',
        'Incident response reports',
      ],
    },
    {
      id: 'ccpa',
      name: 'California Consumer Privacy Act',
      abbreviation: 'CCPA',
      jurisdiction: 'California, United States',
      description:
        'The CCPA grants California consumers rights regarding their personal information, including the right to know, delete, and opt-out of the sale of their personal information.',
      obligations: [
        'Provide notice of collection practices',
        'Honor consumer requests to know what personal information is collected',
        'Honor consumer requests to delete personal information',
        'Honor consumer requests to opt-out of sale of personal information',
        'Provide non-discrimination for exercising rights',
        'Respond to consumer requests within 45 days',
        'Maintain records of consumer requests',
        'Implement reasonable security practices',
      ],
      bestPractices: [
        'Maintain clear privacy notices',
        'Implement efficient request handling processes',
        'Train staff on CCPA requirements',
        'Regularly audit data collection practices',
        'Implement opt-out mechanisms',
        'Maintain detailed records of consumer requests',
        'Review and update privacy policies regularly',
        'Conduct regular security assessments',
      ],
      legalReferences: [
        {
          title: 'CCPA Official Text (California Legislature)',
          url: 'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=CIV&division=3.&title=1.81.5.&part=4.',
        },
        {
          title: 'CCPA Regulations (California Attorney General)',
          url: 'https://oag.ca.gov/privacy/ccpa',
        },
      ],
      policyDocuments: [
        { title: 'CCPA Privacy Notice Template', url: '/docs/ccpa-notice-template.pdf' },
        { title: 'Consumer Request Handling Guide', url: '/docs/ccpa-request-guide.pdf' },
      ],
      evidenceExamples: [
        'Privacy notices',
        'Consumer request logs',
        'Opt-out request records',
        'Data inventory and mapping documents',
        'Security assessment reports',
      ],
    },
  ]

  const filteredRegulations = regulations.filter(
    (reg) =>
      !search ||
      reg.name.toLowerCase().includes(search.toLowerCase()) ||
      reg.abbreviation.toLowerCase().includes(search.toLowerCase()) ||
      reg.description.toLowerCase().includes(search.toLowerCase()),
  )

  const selectedReg = selectedRegulation ? regulations.find((r) => r.id === selectedRegulation) : null

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Compliance • Education</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" aria-hidden="true" />
            Compliance Education & Documentation
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Educational resources explaining each regulation, obligations, processes, and best practices. Links to policy documents, evidence examples, and relevant legal references.
          </p>
        </div>
      </header>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search regulations, obligations, or topics..."
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {!selectedReg ? (
        /* Regulations List */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredRegulations.map((regulation) => (
            <Card
              key={regulation.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedRegulation(regulation.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{regulation.abbreviation}</CardTitle>
                  <Badge variant="outline">{regulation.jurisdiction}</Badge>
                </div>
                <CardDescription>{regulation.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{regulation.description}</p>
                <div className="flex items-center gap-2 text-sm text-primary">
                  <span>Learn more</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Regulation Detail */
        <div className="space-y-6">
          <Button variant="outline" onClick={() => setSelectedRegulation(null)}>
            ← Back to Regulations
          </Button>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{selectedReg.name}</CardTitle>
                  <CardDescription>{selectedReg.jurisdiction}</CardDescription>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {selectedReg.abbreviation}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Overview</h3>
                <p className="text-muted-foreground">{selectedReg.description}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />
                  Key Obligations
                </h3>
                <ul className="space-y-2">
                  {selectedReg.obligations.map((obligation, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-1">•</span>
                      <span>{obligation}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Best Practices</h3>
                <ul className="space-y-2">
                  {selectedReg.bestPractices.map((practice, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{practice}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                  Policy Documents
                </h3>
                <div className="space-y-2">
                  {selectedReg.policyDocuments.map((doc, idx) => (
                    <a
                      key={idx}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      {doc.title}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                  Legal References
                </h3>
                <div className="space-y-2">
                  {selectedReg.legalReferences.map((ref, idx) => (
                    <a
                      key={idx}
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      {ref.title}
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" aria-hidden="true" />
                  Evidence Examples
                </h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {selectedReg.evidenceExamples.map((example, idx) => (
                    <div key={idx} className="rounded-md border p-2 text-sm">
                      {example}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {filteredRegulations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No regulations match your search.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

