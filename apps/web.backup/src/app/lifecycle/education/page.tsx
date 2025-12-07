'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen,
  HelpCircle,
  AlertCircle,
  RefreshCw,
  Ban,
  Clock,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type FAQ = {
  id: string
  question: string
  answer: string
  category: 'expiration' | 'renewal' | 'revocation' | 'general'
}

const FAQS: FAQ[] = [
  {
    id: 'faq-1',
    question: 'What happens when my credential expires?',
    answer:
      'When a credential expires, it becomes invalid and cannot be used for verification. You will receive notifications before expiration (typically at 90, 60, and 30 days). After expiration, you must renew the credential to continue using it.',
    category: 'expiration',
  },
  {
    id: 'faq-2',
    question: 'How do I renew my credential?',
    answer:
      'To renew a credential, navigate to the Expiring Credentials Dashboard and click "Renew" on the credential you want to renew. Fill out the renewal request form with required documents and reason. Your request will be reviewed by administrators.',
    category: 'renewal',
  },
  {
    id: 'faq-3',
    question: 'What is auto-renewal?',
    answer:
      'Auto-renewal automatically submits renewal requests when your credentials are approaching expiration. You can enable this feature in your credential lifecycle settings. Auto-renewal helps ensure continuous credential validity without manual intervention.',
    category: 'renewal',
  },
  {
    id: 'faq-4',
    question: 'Why was my credential revoked?',
    answer:
      'Credentials may be revoked for various reasons including license suspension by regulatory bodies, professional misconduct, or administrative decisions. You will be notified if your credential is revoked and can view the reason in your dashboard.',
    category: 'revocation',
  },
  {
    id: 'faq-5',
    question: 'Can I appeal a revocation?',
    answer:
      'Yes, you can appeal a revocation decision. Contact support through the revocation management page to initiate an appeal. Appeals are reviewed by administrators and may require additional documentation.',
    category: 'revocation',
  },
  {
    id: 'faq-6',
    question: 'What is a credential freeze?',
    answer:
      'A credential freeze temporarily suspends a credential without revoking it. Frozen credentials cannot be verified but remain in the system. Freezes can be lifted to restore the credential to active status.',
    category: 'revocation',
  },
  {
    id: 'faq-7',
    question: 'How long does renewal approval take?',
    answer:
      'Renewal approval times vary depending on the credential type and organization policies. Typically, renewals are processed within 5-10 business days. You can track your renewal request status in the Renewal Status page.',
    category: 'renewal',
  },
  {
    id: 'faq-8',
    question: 'What documents do I need for renewal?',
    answer:
      'Required documents vary by credential type. Common documents include continuing education certificates, updated licenses, and professional certifications. Check the renewal form for specific requirements for your credential type.',
    category: 'renewal',
  },
]

const TUTORIALS = [
  {
    id: 'tutorial-1',
    title: 'Understanding Credential Expiration',
    description: 'Learn how credential expiration works and how to stay ahead of renewals',
    icon: Clock,
    duration: '5 min',
    category: 'expiration',
  },
  {
    id: 'tutorial-2',
    title: 'Submitting a Renewal Request',
    description: 'Step-by-step guide to submitting and tracking renewal requests',
    icon: RefreshCw,
    duration: '8 min',
    category: 'renewal',
  },
  {
    id: 'tutorial-3',
    title: 'Managing Notification Preferences',
    description: 'Configure how and when you receive lifecycle notifications',
    icon: MessageSquare,
    duration: '3 min',
    category: 'general',
  },
  {
    id: 'tutorial-4',
    title: 'Understanding Revocations',
    description: 'Learn about credential revocations and the appeals process',
    icon: Ban,
    duration: '6 min',
    category: 'revocation',
  },
]

export default function LifecycleEducationPage() {
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'expiration' | 'renewal' | 'revocation' | 'general'
  >('all')
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)

  const filteredFAQs =
    selectedCategory === 'all'
      ? FAQS
      : FAQS.filter((faq) => faq.category === selectedCategory)

  const filteredTutorials =
    selectedCategory === 'all'
      ? TUTORIALS
      : TUTORIALS.filter((t) => t.category === selectedCategory || selectedCategory === 'all')

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Lifecycle • Education
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Credential Lifecycle Education</h1>
        <p className="text-muted-foreground max-w-3xl">
          Learn about credential expiration, renewal processes, revocation reasons, appeals process,
          and best practices for managing your credentials.
        </p>
      </header>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'expiration', 'renewal', 'revocation', 'general'] as const).map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
          >
            {category === 'all' ? 'All Topics' : category}
          </Button>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Expiring Credentials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View your credentials with expiry dates and renewal status
            </p>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href="/demo/lifecycle/dashboard">
                View Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="h-5 w-5" />
              Request Renewal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Submit a renewal request for your expiring credentials
            </p>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href="/demo/lifecycle/renewals/new">
                Start Renewal
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5" />
              Get Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Contact support for help with lifecycle management
            </p>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href="/org/support">
                Contact Support
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Tutorials */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Interactive Tutorials
            </CardTitle>
            <CardDescription>
              Step-by-step guides to help you manage your credentials effectively
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredTutorials.map((tutorial) => {
                const Icon = tutorial.icon
                return (
                  <div
                    key={tutorial.id}
                    className="rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{tutorial.title}</h3>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {tutorial.duration}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{tutorial.description}</p>
                    <Button variant="outline" size="sm">
                      Start Tutorial
                      <ArrowRight className="h-3 w-3 ml-2" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* FAQs */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Frequently Asked Questions
            </CardTitle>
            <CardDescription>Common questions about credential lifecycle management</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredFAQs.map((faq) => {
                const isExpanded = expandedFAQ === faq.id
                return (
                  <div
                    key={faq.id}
                    className="rounded-lg border transition-colors"
                    id={faq.id}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFAQ(isExpanded ? null : faq.id)}
                      className="w-full p-4 text-left flex items-start justify-between gap-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{faq.question}</h3>
                          <Badge variant="outline" className="text-xs capitalize">
                            {faq.category}
                          </Badge>
                        </div>
                        {isExpanded && (
                          <p className="text-sm text-muted-foreground mt-2">{faq.answer}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <HelpCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Best Practices */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Best Practices
            </CardTitle>
            <CardDescription>Tips for effective credential lifecycle management</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    1
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Enable Auto-Renewal</h4>
                  <p className="text-sm text-muted-foreground">
                    Turn on auto-renewal for credentials that require regular maintenance to avoid
                    expiration.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    2
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Set Up Reminders</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure reminder notifications at 90, 60, and 30 days before expiration to
                    give yourself time to prepare renewal documents.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    3
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Keep Documents Ready</h4>
                  <p className="text-sm text-muted-foreground">
                    Maintain up-to-date copies of required documents (CE certificates, licenses,
                    etc.) to expedite renewal requests.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    4
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Monitor Regularly</h4>
                  <p className="text-sm text-muted-foreground">
                    Check your Expiring Credentials Dashboard regularly to stay informed about
                    upcoming renewals and take action early.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Additional Resources */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Additional Resources</CardTitle>
            <CardDescription>Links to documentation and support</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <a
                href="/docs/lifecycle"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">Lifecycle Documentation</div>
                  <div className="text-sm text-muted-foreground">
                    Complete guide to credential lifecycle management
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
              </a>
              <a
                href="/org/support"
                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <MessageSquare className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">Support Center</div>
                  <div className="text-sm text-muted-foreground">
                    Get help from our support team
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </a>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

