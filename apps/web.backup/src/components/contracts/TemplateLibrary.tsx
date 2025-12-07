'use client'

import { useEffect, useState } from 'react'
import { Search, FileText, Copy, Eye, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ContractTemplate {
  id: string
  name: string
  description?: string
  type: 'revenue_share' | 'service_agreement' | 'privacy' | 'custom'
  language: string
  version: string
  createdAt: string
  updatedAt: string
}

interface TemplateLibraryProps {
  onSelectTemplate?: (templateId: string) => void
}

export function TemplateLibrary({ onSelectTemplate }: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)
  const [previewContent, setPreviewContent] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [typeFilter])

  async function loadTemplates() {
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'all') {
        params.append('type', typeFilter)
      }
      const response = await fetch(`/api/demo/org/contracts/templates?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to load templates (${response.status})`)
      }
      const payload = await response.json()
      setTemplates(payload.templates || [])
    } catch (err: any) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadTemplatePreview(templateId: string) {
    try {
      const response = await fetch(`/api/demo/org/contracts/templates/${templateId}/preview`)
      if (!response.ok) {
        throw new Error(`Failed to load preview (${response.status})`)
      }
      const payload = await response.json()
      setPreviewContent(payload.content || '')
    } catch (err: any) {
      console.error('Failed to load preview:', err)
      setPreviewContent('Preview not available')
    }
  }

  function getTypeBadge(type: ContractTemplate['type']) {
    const variants: Record<ContractTemplate['type'], { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      revenue_share: { label: 'Revenue Share', variant: 'default' },
      service_agreement: { label: 'Service Agreement', variant: 'secondary' },
      privacy: { label: 'Privacy', variant: 'outline' },
      custom: { label: 'Custom', variant: 'outline' },
    }
    const { label, variant } = variants[type]
    return <Badge variant={variant}>{label}</Badge>
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || template.type === typeFilter
    return matchesSearch && matchesType
  })

  function handleSelectTemplate(template: ContractTemplate) {
    if (onSelectTemplate) {
      onSelectTemplate(template.id)
    }
  }

  function handleDuplicateTemplate(template: ContractTemplate) {
    // In production, this would create a copy of the template
    console.log('Duplicating template:', template.id)
    // For now, just select it
    handleSelectTemplate(template)
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">Loading templates…</div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="search">Search Templates</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Template Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger id="type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="revenue_share">Revenue Share</SelectItem>
              <SelectItem value="service_agreement">Service Agreement</SelectItem>
              <SelectItem value="privacy">Privacy</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {template.description || 'No description'}
                  </CardDescription>
                </div>
                {getTypeBadge(template.type)}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="text-sm text-muted-foreground mb-4 space-y-1">
                <div>Version: {template.version}</div>
                <div>Language: {template.language.toUpperCase()}</div>
                <div>Updated: {new Date(template.updatedAt).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-2 mt-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedTemplate(template)
                    loadTemplatePreview(template.id)
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicateTemplate(template)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {onSelectTemplate && (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    Use Template
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No templates found</p>
          {searchQuery && <p className="text-sm mt-2">Try adjusting your search or filters</p>}
        </div>
      )}

      {/* Preview Dialog */}
      {selectedTemplate && (
        <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTemplate.name}</DialogTitle>
              <DialogDescription>
                Template Preview - Version {selectedTemplate.version}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getTypeBadge(selectedTemplate.type)}
                <span className="text-sm text-muted-foreground">
                  Language: {selectedTemplate.language.toUpperCase()}
                </span>
              </div>
              {previewContent ? (
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm bg-muted p-4 rounded-lg">
                    {previewContent}
                  </pre>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Loading preview...
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

