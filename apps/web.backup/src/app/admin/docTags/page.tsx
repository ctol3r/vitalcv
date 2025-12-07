'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '@/components/design/Modal'
import { Badge } from '@/components/ui/badge'
import { AccessibleDataTable, TableColumn } from '@/components/accessibility/AccessibleDataTable'

// Types
interface DocumentTag {
  id: string
  name: string
  slug: string
  description?: string
  usageCount: number
  createdAt: string
  updatedAt: string
}

// Mock data - replace with API call
const mockTags: DocumentTag[] = [
  {
    id: '1',
    name: 'guidelines',
    slug: 'guidelines',
    description: 'Clinical guidelines',
    usageCount: 15,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: '2',
    name: 'compliance',
    slug: 'compliance',
    description: 'Compliance related',
    usageCount: 8,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: '3',
    name: 'training',
    slug: 'training',
    description: 'Training materials',
    usageCount: 12,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
]

export default function DocumentTagsPage() {
  const [tags, setTags] = useState<DocumentTag[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingTag, setEditingTag] = useState<DocumentTag | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    // In a real app, fetch tags
    // const fetchTags = async () => {
    //   const response = await fetch('/api/admin/docTags')
    //   const data = await response.json()
    //   setTags(data)
    // }
    // fetchTags()
    setTags(mockTags)
  }, [])

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required'
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens'
    } else if (tags.some((tag) => tag.slug === formData.slug && tag.id !== editingTag?.id)) {
      newErrors.slug = 'Slug must be unique'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      if (editingTag) {
        // Update tag
        // await fetch(`/api/admin/docTags/${editingTag.id}`, {
        //   method: 'PATCH',
        //   body: JSON.stringify(formData),
        // })
        setTags(
          tags.map((tag) =>
            tag.id === editingTag.id
              ? { ...tag, ...formData, updatedAt: new Date().toISOString() }
              : tag
          )
        )
      } else {
        // Create tag
        // await fetch('/api/admin/docTags', {
        //   method: 'POST',
        //   body: JSON.stringify(formData),
        // })
        const newTag: DocumentTag = {
          id: `tag-${Date.now()}`,
          ...formData,
          usageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setTags([...tags, newTag])
      }

      handleClose()
    } catch (error) {
      console.error('Error saving tag:', error)
      setErrors({ submit: 'Failed to save tag' })
    }
  }

  const handleEdit = (tag: DocumentTag) => {
    setEditingTag(tag)
    setFormData({
      name: tag.name,
      slug: tag.slug,
      description: tag.description || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId)
    if (!tag) return

    if (tag.usageCount > 0) {
      alert(
        `Cannot delete tag "${tag.name}" because it is used in ${tag.usageCount} document(s).`
      )
      return
    }

    if (!confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) return

    try {
      // await fetch(`/api/admin/docTags/${tagId}`, {
      //   method: 'DELETE',
      // })
      setTags(tags.filter((t) => t.id !== tagId))
    } catch (error) {
      console.error('Error deleting tag:', error)
    }
  }

  const handleClose = () => {
    setShowModal(false)
    setEditingTag(null)
    setFormData({ name: '', slug: '', description: '' })
    setErrors({})
  }

  const handleNameChange = (name: string) => {
    setFormData({ ...formData, name, slug: generateSlug(name) })
  }

  const filteredTags = tags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const columns: TableColumn<DocumentTag>[] = [
    {
      id: 'name',
      header: 'Name',
      accessor: (tag) => (
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{tag.name}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: 'slug',
      header: 'Slug',
      accessor: (tag) => <code className="text-xs">#{tag.slug}</code>,
      sortable: true,
    },
    {
      id: 'description',
      header: 'Description',
      accessor: (tag) => tag.description || '-',
    },
    {
      id: 'usageCount',
      header: 'Usage',
      accessor: (tag) => (
        <Badge variant={tag.usageCount > 0 ? 'default' : 'outline'}>
          {tag.usageCount} document{tag.usageCount !== 1 ? 's' : ''}
        </Badge>
      ),
      sortable: true,
    },
    {
      id: 'actions',
      header: 'Actions',
      accessor: (tag) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(tag)}
            aria-label={`Edit ${tag.name}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(tag.id)}
            disabled={tag.usageCount > 0}
            aria-label={`Delete ${tag.name}`}
            className="text-destructive hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Document Tags</h1>
          <p className="text-muted-foreground mt-1">
            Manage document tags with unique slug validation
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} aria-label="Create new tag">
          <Plus className="mr-2 h-4 w-4" />
          New Tag
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="text"
            placeholder="Search by name, slug, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search tags"
          />
        </CardContent>
      </Card>

      {/* Tags Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tags</CardTitle>
          <CardDescription>
            List of all document tags with usage counts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccessibleDataTable
            data={filteredTags}
            columns={columns}
            caption="Document tags management table"
            filterable={false}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal open={true} onOpenChange={handleClose}>
          <ModalContent size="medium">
            <ModalHeader>
              <ModalTitle>{editingTag ? 'Edit Tag' : 'Create Tag'}</ModalTitle>
              <ModalDescription>
                {editingTag ? 'Update tag information' : 'Create a new document tag'}
              </ModalDescription>
            </ModalHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Tag name"
                  aria-label="Tag name"
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">
                  Slug <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value.toLowerCase() })
                  }
                  placeholder="tag-slug"
                  aria-label="Tag slug"
                  aria-invalid={!!errors.slug}
                />
                {errors.slug && (
                  <p className="text-sm text-destructive">{errors.slug}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  URL-friendly identifier (lowercase, hyphens only). Must be unique.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Tag description"
                  aria-label="Tag description"
                />
              </div>

              {errors.submit && (
                <p className="text-sm text-destructive">{errors.submit}</p>
              )}
            </div>

            <ModalFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} aria-label={editingTag ? 'Update tag' : 'Create tag'}>
                {editingTag ? 'Update' : 'Create'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </div>
  )
}

