'use client'

import { useState } from 'react'
import { BookOpen, HelpCircle, FileText, MessageSquare, Search, ChevronRight, ExternalLink, Mail, Phone, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface FAQ {
  id: string
  question: string
  answer: string
  category: string
}

interface Resource {
  id: string
  title: string
  description: string
  type: 'guide' | 'tutorial' | 'documentation' | 'video'
  url?: string
  category: string
}

interface SupportTicket {
  id: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  createdAt: string
}

const FAQS: FAQ[] = [
  {
    id: '1',
    question: 'What documents do I need to provide during onboarding?',
    answer: 'You will need to provide business registration documents, tax identification, insurance certificates, and any industry-specific certifications. The exact requirements depend on your vendor category.',
    category: 'Onboarding',
  },
  {
    id: '2',
    question: 'How long does the onboarding process take?',
    answer: 'The onboarding process typically takes 5-10 business days, depending on the completeness of your documentation and the complexity of your vendor category requirements.',
    category: 'Onboarding',
  },
  {
    id: '3',
    question: 'What compliance requirements apply to my category?',
    answer: 'Compliance requirements vary by vendor category. You can view the specific requirements for your category in your vendor profile. Common requirements include HIPAA compliance, data security standards, and insurance coverage.',
    category: 'Compliance',
  },
  {
    id: '4',
    question: 'How do I update my vendor information?',
    answer: 'You can update your vendor information by logging into your vendor portal and navigating to your profile. For significant changes, you may need to contact your account manager.',
    category: 'Account Management',
  },
  {
    id: '5',
    question: 'What happens if my contract expires?',
    answer: 'You will receive renewal notifications 90 days before expiration. You can initiate the renewal process through your vendor portal or contact your account manager.',
    category: 'Contracts',
  },
  {
    id: '6',
    question: 'How do I submit a support ticket?',
    answer: 'You can submit a support ticket through this support portal by clicking "Submit Ticket" and filling out the form. Our support team typically responds within 24 hours.',
    category: 'Support',
  },
]

const RESOURCES: Resource[] = [
  {
    id: '1',
    title: 'Vendor Onboarding Guide',
    description: 'Complete step-by-step guide to the vendor onboarding process',
    type: 'guide',
    category: 'Onboarding',
  },
  {
    id: '2',
    title: 'Compliance Requirements Overview',
    description: 'Understanding compliance requirements for your vendor category',
    type: 'documentation',
    category: 'Compliance',
  },
  {
    id: '3',
    title: 'Document Upload Tutorial',
    description: 'Video tutorial on how to upload and manage vendor documents',
    type: 'video',
    category: 'Account Management',
  },
  {
    id: '4',
    title: 'Contract Renewal Process',
    description: 'Guide to renewing your vendor contract',
    type: 'guide',
    category: 'Contracts',
  },
  {
    id: '5',
    title: 'Performance Metrics Explained',
    description: 'Understanding how your performance metrics are calculated',
    type: 'documentation',
    category: 'Performance',
  },
  {
    id: '6',
    title: 'Security Best Practices',
    description: 'Security guidelines for vendor data handling',
    type: 'guide',
    category: 'Security',
  },
]

export default function VendorSupportPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketDescription, setTicketDescription] = useState('')
  const [ticketSubmitted, setTicketSubmitted] = useState(false)

  const categories = ['all', 'Onboarding', 'Compliance', 'Account Management', 'Contracts', 'Support', 'Performance', 'Security']

  const filteredFAQs = FAQS.filter((faq) => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const filteredResources = RESOURCES.filter((resource) => {
    const matchesSearch = resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || resource.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  function getResourceIcon(type: Resource['type']) {
    switch (type) {
      case 'video':
        return <ExternalLink className="h-4 w-4" />
      case 'guide':
        return <FileText className="h-4 w-4" />
      case 'tutorial':
        return <BookOpen className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  function getResourceBadge(type: Resource['type']) {
    const labels = {
      guide: 'Guide',
      tutorial: 'Tutorial',
      documentation: 'Docs',
      video: 'Video',
    }
    return <Badge variant="outline">{labels[type]}</Badge>
  }

  async function handleSubmitTicket() {
    if (!ticketSubject.trim() || !ticketDescription.trim()) return

    try {
      const response = await fetch('/api/demo/vendor/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: ticketSubject,
          description: ticketDescription,
        }),
      })

      if (!response.ok) throw new Error('Failed to submit ticket')

      setTicketSubject('')
      setTicketDescription('')
      setTicketSubmitted(true)
      setTimeout(() => setTicketSubmitted(false), 5000)
    } catch (err) {
      alert(`Failed to submit ticket: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Vendor Knowledge Base & Support</h1>
        <p className="text-sm text-muted-foreground">
          Find answers, access resources, and get help with vendor management
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search FAQs, guides, and resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              New to the platform? Start here with our onboarding guide.
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Compliance Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Understand compliance requirements and how to meet them.
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5" />
              Contact Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Need help? Submit a support ticket or contact us directly.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="faqs">
        <TabsList>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="ticket">Submit Ticket</TabsTrigger>
          <TabsTrigger value="contact">Contact Info</TabsTrigger>
        </TabsList>

        <TabsContent value="faqs" className="space-y-4">
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'All Categories' : category}
              </Button>
            ))}
          </div>

          {/* FAQs */}
          <div className="space-y-4">
            {filteredFAQs.length > 0 ? (
              filteredFAQs.map((faq) => (
                <Card key={faq.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{faq.question}</CardTitle>
                      <Badge variant="secondary">{faq.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground py-8">
                    No FAQs found matching your search criteria.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'All Categories' : category}
              </Button>
            ))}
          </div>

          {/* Resources */}
          <div className="grid gap-4 md:grid-cols-2">
            {filteredResources.length > 0 ? (
              filteredResources.map((resource) => (
                <Card key={resource.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getResourceIcon(resource.type)}
                        {resource.title}
                      </CardTitle>
                      {getResourceBadge(resource.type)}
                    </div>
                    <CardDescription>{resource.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{resource.category}</Badge>
                      <Button variant="outline" size="sm">
                        View <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="md:col-span-2">
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground py-8">
                    No resources found matching your search criteria.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ticket" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Submit Support Ticket</CardTitle>
              <CardDescription>
                Describe your issue and our support team will get back to you within 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticketSubmitted && (
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <HelpCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Ticket submitted successfully!</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="ticket-subject">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ticket-subject"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Brief description of your issue..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="ticket-description"
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  placeholder="Provide detailed information about your issue..."
                  rows={6}
                />
              </div>
              <Button onClick={handleSubmitTicket} disabled={!ticketSubject.trim() || !ticketDescription.trim()}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Submit Ticket
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  For general inquiries and support requests
                </p>
                <a href="mailto:vendor-support@example.com" className="text-primary hover:underline">
                  vendor-support@example.com
                </a>
                <p className="text-xs text-muted-foreground mt-2">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Response time: Within 24 hours
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Phone Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  For urgent matters and account management
                </p>
                <a href="tel:+1-555-123-4567" className="text-primary hover:underline">
                  +1 (555) 123-4567
                </a>
                <p className="text-xs text-muted-foreground mt-2">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Hours: Monday-Friday, 9 AM - 5 PM EST
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Support Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li>Check the FAQs and resources before submitting a ticket</li>
                <li>Provide as much detail as possible when describing your issue</li>
                <li>Include relevant document IDs or reference numbers if applicable</li>
                <li>For contract-related questions, include your contract number</li>
                <li>For technical issues, describe the steps you've already taken</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

