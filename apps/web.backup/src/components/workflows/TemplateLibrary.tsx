'use client'

import { useState } from 'react'
import { Search, Copy, Eye, Download, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { WorkflowTemplate, WorkflowDefinition } from '@/types/workflow'

interface TemplateLibraryProps {
  onSelectTemplate: (template: WorkflowTemplate) => void
  onCloneTemplate?: (template: WorkflowTemplate) => void
}

const TEMPLATE_CATEGORIES = [
  'All',
  'Credential Management',
  'Contract Review',
  'Notifications',
  'Data Processing',
  'Automation',
] as const

const SAMPLE_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'credential-renewal',
    name: 'Credential Renewal Reminder',
    description: 'Automatically send reminders when credentials are approaching expiration dates.',
    category: 'Credential Management',
    definition: {
      id: 'template-credential-renewal',
      name: 'Credential Renewal Reminder',
      description: 'Send reminders for expiring credentials',
      status: 'draft',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      trigger: {
        type: 'cron',
        cronExpression: '0 9 * * *', // Daily at 9 AM
      },
      steps: [
        {
          id: 'step-1',
          name: 'Check Expiring Credentials',
          type: 'api_call',
          action: 'check_expiring_credentials',
          parameters: { daysAhead: 30 },
          position: { x: 0, y: 0 },
        },
        {
          id: 'step-2',
          name: 'Send Reminder Email',
          type: 'notification',
          action: 'send_email',
          parameters: {
            template: 'credential_renewal_reminder',
          },
          position: { x: 200, y: 0 },
        },
      ],
    },
    tags: ['credentials', 'renewal', 'notifications'],
  },
  {
    id: 'contract-review',
    name: 'Contract Review Workflow',
    description: 'Automate contract review process with notifications and approvals.',
    category: 'Contract Review',
    definition: {
      id: 'template-contract-review',
      name: 'Contract Review Workflow',
      description: 'Automated contract review',
      status: 'draft',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      trigger: {
        type: 'event',
        eventTypes: ['contract.uploaded'],
      },
      steps: [
        {
          id: 'step-1',
          name: 'Extract Contract Data',
          type: 'data_transform',
          action: 'extract_contract_fields',
          parameters: {},
          position: { x: 0, y: 0 },
        },
        {
          id: 'step-2',
          name: 'Notify Reviewers',
          type: 'notification',
          action: 'notify_reviewers',
          parameters: {},
          position: { x: 200, y: 0 },
        },
      ],
    },
    tags: ['contracts', 'review', 'approval'],
  },
  {
    id: 'document-processing',
    name: 'Document Processing Pipeline',
    description: 'Process uploaded documents with OCR, validation, and storage.',
    category: 'Data Processing',
    definition: {
      id: 'template-document-processing',
      name: 'Document Processing Pipeline',
      description: 'Process documents automatically',
      status: 'draft',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      trigger: {
        type: 'event',
        eventTypes: ['document.uploaded'],
      },
      steps: [
        {
          id: 'step-1',
          name: 'Run OCR',
          type: 'api_call',
          action: 'run_ocr',
          parameters: {},
          position: { x: 0, y: 0 },
        },
        {
          id: 'step-2',
          name: 'Validate Data',
          type: 'data_transform',
          action: 'validate_document_data',
          parameters: {},
          position: { x: 200, y: 0 },
        },
        {
          id: 'step-3',
          name: 'Store Results',
          type: 'api_call',
          action: 'store_document',
          parameters: {},
          position: { x: 400, y: 0 },
        },
      ],
    },
    tags: ['documents', 'ocr', 'processing'],
  },
]

export function WorkflowTemplateLibrary({ onSelectTemplate, onCloneTemplate }: TemplateLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [previewTemplate, setPreviewTemplate] = useState<WorkflowTemplate | null>(null)

  const templates = SAMPLE_TEMPLATES.filter((template) => {
    if (selectedCategory !== 'All' && template.category !== selectedCategory) return false
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return (
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags?.some((tag) => tag.toLowerCase().includes(query))
      )
    }
    return true
  })

  const handleClone = (template: WorkflowTemplate) => {
    if (onCloneTemplate) {
      onCloneTemplate(template)
    } else {
      onSelectTemplate(template)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Workflow Template Library
          </CardTitle>
          <CardDescription>
            Browse pre-built workflow templates for common use cases. Preview, clone, and customize them for your needs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {TEMPLATE_CATEGORIES.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No templates found matching your criteria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="mt-2">{template.description}</CardDescription>
                  </div>
                  <Badge variant="outline">{template.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  <p>Steps: {template.definition.steps.length}</p>
                  <p>Trigger: {template.definition.trigger.type}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPreviewTemplate(template)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleClone(template)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Clone
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {previewTemplate && (
        <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{previewTemplate.name}</DialogTitle>
              <DialogDescription>{previewTemplate.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Category</h4>
                <Badge>{previewTemplate.category}</Badge>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Trigger</h4>
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm">
                    <strong>Type:</strong> {previewTemplate.definition.trigger.type}
                  </p>
                  {previewTemplate.definition.trigger.cronExpression && (
                    <p className="text-sm">
                      <strong>Cron:</strong> <code className="text-xs bg-background px-1 py-0.5 rounded">{previewTemplate.definition.trigger.cronExpression}</code>
                    </p>
                  )}
                  {previewTemplate.definition.trigger.eventTypes && (
                    <p className="text-sm">
                      <strong>Events:</strong> {previewTemplate.definition.trigger.eventTypes.join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Steps ({previewTemplate.definition.steps.length})</h4>
                <div className="space-y-2">
                  {previewTemplate.definition.steps.map((step, index) => (
                    <Card key={step.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline">{index + 1}</Badge>
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{step.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Type: {step.type} | Action: {step.action}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setPreviewTemplate(null)}>
                  Close
                </Button>
                <Button className="flex-1" onClick={() => handleClone(previewTemplate)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Clone & Customize
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
