'use client'

import { BookOpen, Shield, Download, Upload, Users, FileText, ExternalLink, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface FAQ {
  question: string
  answer: string
}

interface Resource {
  title: string
  description: string
  url: string
  type: 'internal' | 'external'
}

export default function PrivacyEducationPage() {
  const faqs: FAQ[] = [
    {
      question: 'What is a personal vault?',
      answer:
        'Your personal vault is a secure storage system where all your credentials, contracts, and data are stored. You have full control over what data is stored and who can access it.',
    },
    {
      question: 'How do I export my data?',
      answer:
        'You can request a data export from the Privacy Dashboard. Choose your preferred format (JSON, CSV, PDF, or XML) and scope. You\'ll receive an email notification when your export is ready for download.',
    },
    {
      question: 'Can I import data from another system?',
      answer:
        'Yes! You can import data by uploading a file or connecting to an external vault. The system will validate the data and show you a preview before importing.',
    },
    {
      question: 'What happens when I revoke access?',
      answer:
        'When you revoke access for a third-party application or data share, they immediately lose access to your data. However, they may have already processed data shared before revocation.',
    },
    {
      question: 'How long is my data retained?',
      answer:
        'Data retention depends on the type of data and your configured retention policies. Some data types have minimum retention requirements based on regulations like HIPAA or GDPR.',
    },
    {
      question: 'Can I request deletion of my data?',
      answer:
        'Yes, you can submit a data deletion request. The system will verify your identity, check for any legal or regulatory obligations that prevent deletion, and then proceed with deletion if approved.',
    },
    {
      question: 'What are retention policies?',
      answer:
        'Retention policies define how long different types of data are stored. After the retention period expires, data is automatically deleted. You can configure these policies in the Privacy Settings.',
    },
    {
      question: 'How do I manage third-party app access?',
      answer:
        'You can view and manage all third-party applications that have access to your data from the Third-Party Connections page. You can revoke access at any time.',
    },
  ]

  const resources: Resource[] = [
    {
      title: 'Privacy Dashboard',
      description: 'Overview of your vault, data sharing, and privacy settings',
      url: '/demo/privacy/dashboard',
      type: 'internal',
    },
    {
      title: 'Data Download Guide',
      description: 'Step-by-step guide to exporting your data',
      url: '/demo/privacy/download',
      type: 'internal',
    },
    {
      title: 'GDPR Compliance',
      description: 'Learn about your rights under GDPR',
      url: 'https://gdpr.eu/what-is-gdpr/',
      type: 'external',
    },
    {
      title: 'HIPAA Privacy Rule',
      description: 'Understanding HIPAA privacy requirements',
      url: 'https://www.hhs.gov/hipaa/for-professionals/privacy/index.html',
      type: 'external',
    },
    {
      title: 'Data Sharing History',
      description: 'View timeline of all data sharing events',
      url: '/demo/privacy/history',
      type: 'internal',
    },
    {
      title: 'Consent Management',
      description: 'Manage consent given for data sharing',
      url: '/demo/privacy/consent',
      type: 'internal',
    },
  ]

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
          <BookOpen className="h-10 w-10 text-primary" />
          Privacy Education & Documentation
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Learn about your data rights, how your personal vault works, and how to manage your
          privacy settings
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Privacy Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Overview of your vault size, record counts, and active shares
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/demo/privacy/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="h-5 w-5" />
              Export Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Request a download of your data in various formats
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/demo/privacy/download">Request Download</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5" />
              Import Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Import data from files or external vaults
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/demo/privacy/import">Import Data</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Manage Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View and manage third-party app connections
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/demo/privacy/connections">Manage Connections</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Your Personal Vault Works</CardTitle>
          <CardDescription>
            Understanding the key concepts and features of your privacy controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Personal Vault
              </h3>
              <p className="text-sm text-muted-foreground">
                Your personal vault is a secure, encrypted storage system where all your data is
                stored. You have complete control over what data is stored and who can access it.
                The vault size and usage are displayed on your dashboard.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Download className="h-4 w-4" />
                Data Export
              </h3>
              <p className="text-sm text-muted-foreground">
                You can request a complete export of your data at any time. Choose from multiple
                formats (JSON, CSV, PDF, XML) and select the scope of data to export. The export
                will be prepared and you'll receive a notification when it's ready.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Data Import
              </h3>
              <p className="text-sm text-muted-foreground">
                Import your data from external sources by uploading a file or connecting to an
                external vault. The system validates the data and shows you a preview before
                importing.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Data Sharing
              </h3>
              <p className="text-sm text-muted-foreground">
                You control who has access to your data. View all active shares, third-party
                applications, and consent records. You can revoke access at any time.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Retention Policies
              </h3>
              <p className="text-sm text-muted-foreground">
                Configure how long different types of data are retained. Some data types have
                minimum retention requirements based on regulations. Data exceeding the retention
                period is automatically deleted.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Consent Management
              </h3>
              <p className="text-sm text-muted-foreground">
                Track and manage consent given for data sharing with third parties. View consent
                purposes, durations, and expiration dates. Revoke consent at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step-by-Step Guides */}
      <Card>
        <CardHeader>
          <CardTitle>Step-by-Step Guides</CardTitle>
          <CardDescription>Follow these guides to perform common privacy operations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="border-l-4 border-primary pl-4 space-y-2">
              <h3 className="font-semibold">How to Export Your Data</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Navigate to the Privacy Dashboard</li>
                <li>Click "Request Data Download" or go to the Data Download page</li>
                <li>Select one or more formats (JSON, CSV, PDF, XML)</li>
                <li>Choose the scope of data to export (all data or specific types)</li>
                <li>Select additional options (metadata, audit trail)</li>
                <li>Submit your request</li>
                <li>You'll receive an email when your export is ready</li>
                <li>Download the file from the provided link</li>
              </ol>
            </div>

            <div className="border-l-4 border-primary pl-4 space-y-2">
              <h3 className="font-semibold">How to Import Data</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Go to the Data Import page</li>
                <li>Choose your import source (file upload or external vault)</li>
                <li>If uploading a file, select your file (JSON, CSV, or XML)</li>
                <li>If connecting to external vault, provide URL and credentials</li>
                <li>Wait for validation to complete</li>
                <li>Review the preview of records to be imported</li>
                <li>Confirm the import</li>
                <li>Monitor the import progress</li>
              </ol>
            </div>

            <div className="border-l-4 border-primary pl-4 space-y-2">
              <h3 className="font-semibold">How to Revoke Third-Party Access</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Go to the Third-Party Connections page</li>
                <li>Find the application you want to revoke</li>
                <li>Click the revoke button (trash icon)</li>
                <li>Confirm the revocation in the dialog</li>
                <li>The application will immediately lose access to your data</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="space-y-2">
                <h3 className="font-semibold">{faq.question}</h3>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Resources</CardTitle>
          <CardDescription>
            Links to internal pages and external compliance resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resources.map((resource, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{resource.title}</h4>
                    {resource.type === 'external' && (
                      <Badge variant="outline" className="text-xs">
                        External
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{resource.description}</p>
                  {resource.type === 'internal' ? (
                    <Button variant="link" size="sm" asChild className="p-0 h-auto">
                      <Link href={resource.url}>
                        Visit page <ExternalLink className="w-3 h-3 ml-1" />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="link" size="sm" asChild className="p-0 h-auto">
                      <a href={resource.url} target="_blank" rel="noopener noreferrer">
                        Open link <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            If you have questions about your privacy rights or need assistance with privacy-related
            operations, please contact our privacy team.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Email:</span>
              <a href="mailto:privacy@example.com" className="text-primary hover:underline">
                privacy@example.com
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Support:</span>
              <a href="/support" className="text-primary hover:underline">
                Visit Support Center
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

