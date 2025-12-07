'use client'

import { useEffect, useState } from 'react'
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Copy,
  Search,
  RefreshCw,
  Tag,
  Code,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ContractTemplate {
  id: string
  name: string
  slug: string
  description: string | null
  language: string
  content: string
  variables: string[] | null
  versionNumber: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export default function ContractTemplateManagerPage() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    language: 'en',
    content: '',
    variables: [] as string[],
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/contract-templates')
      if (!response.ok) {
        throw new Error(`Failed to load templates (${response.status})`)
      }
      const data = await response.json()
      setTemplates(data.templates || [])
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load templates')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      slug: '',
      description: '',
      language: 'en',
      content: '',
      variables: [],
    })
  }

  function openCreateDialog() {
    resetForm()
    setShowCreateDialog(true)
  }

  function openEditDialog(template: ContractTemplate) {
    setFormData({
      name: template.name,
      slug: template.slug,
      description: template.description || '',
      language: template.language,
      content: template.content,
      variables: template.variables || [],
    })
    setSelectedTemplate(template)
    setShowEditDialog(true)
  }

  function openDeleteDialog(template: ContractTemplate) {
    setSelectedTemplate(template)
    setShowDeleteDialog(true)
  }

  async function createTemplate() {
    try {
      const response = await fetch('/api/admin/contract-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        throw new Error('Failed to create template')
      }
      setShowCreateDialog(false)
      resetForm()
      loadTemplates()
    } catch (err: any) {
      setError(err.message ?? 'Failed to create template')
    }
  }

  async function updateTemplate() {
    if (!selectedTemplate) return
    try {
      const response = await fetch(`/api/admin/contract-templates/${selectedTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        throw new Error('Failed to update template')
      }
      setShowEditDialog(false)
      setSelectedTemplate(null)
      resetForm()
      loadTemplates()
    } catch (err: any) {
      setError(err.message ?? 'Failed to update template')
    }
  }

  async function deleteTemplate() {
    if (!selectedTemplate) return
    try {
      const response = await fetch(`/api/admin/contract-templates/${selectedTemplate.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete template')
      }
      setShowDeleteDialog(false)
      setSelectedTemplate(null)
      loadTemplates()
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete template')
    }
  }

  async function duplicateTemplate(template: ContractTemplate) {
    try {
      const response = await fetch('/api/admin/contract-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          slug: `${template.slug}-copy`,
          description: template.description,
          language: template.language,
          content: template.content,
          variables: template.variables || [],
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to duplicate template')
      }
      loadTemplates()
    } catch (err: any) {
      setError(err.message ?? 'Failed to duplicate template')
    }
  }

  function extractVariables(content: string): string[] {
    const matches = content.match(/\{\{(\w+)\}\}/g)
    if (!matches) return []
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))]
  }

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="py-16 text-center text-muted-foreground">Loading templates…</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7 text-primary" aria-hidden="true" />
              Contract Template Manager
            </h1>
            <p className="text-muted-foreground max-w-2xl mt-2">
              Create, edit, and manage contract templates with variables
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadTemplates} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{template.slug}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{template.language}</Badge>
                  </TableCell>
                  <TableCell>{template.versionNumber}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {template.variables?.length || 0} variable{(template.variables?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(template)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateTemplate(template)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(template)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTemplates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No templates found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false)
          setShowEditDialog(false)
          resetForm()
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {showEditDialog ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              {showEditDialog ? 'Update the contract template' : 'Create a new contract template with variables'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Template name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="template-slug"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Template description"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={formData.language}
                onValueChange={(value) => setFormData({ ...formData, language: value })}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => {
                  const newContent = e.target.value
                  const vars = extractVariables(newContent)
                  setFormData({ ...formData, content: newContent, variables: vars })
                }}
                placeholder="Template content with {{variables}}"
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{variableName}}'} for template variables
              </p>
            </div>
            {formData.variables.length > 0 && (
              <div className="space-y-2">
                <Label>Detected Variables</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.variables.map((varName) => (
                    <Badge key={varName} variant="outline">
                      <Code className="h-3 w-3 mr-1" />
                      {varName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setShowEditDialog(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={showEditDialog ? updateTemplate : createTemplate}>
              {showEditDialog ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteTemplate}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

