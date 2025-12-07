'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, ChevronRight, Folder, FolderOpen } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AccessibleDataTable, TableColumn } from '@/components/accessibility/AccessibleDataTable'

// Types
interface Category {
  id: string
  name: string
  slug: string
  description?: string
  parentId?: string
  parent?: Category
  children?: Category[]
  createdAt: string
  updatedAt: string
}

// Mock data - replace with API call
const mockCategories: Category[] = [
  {
    id: '1',
    name: 'Clinical',
    slug: 'clinical',
    description: 'Clinical documents and guidelines',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: '2',
    name: 'Compliance',
    slug: 'compliance',
    description: 'Compliance and regulatory documents',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: '3',
    name: 'Training',
    slug: 'training',
    description: 'Training materials',
    parentId: '1',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
]

export default function DocumentCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parentId: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    // In a real app, fetch categories
    // const fetchCategories = async () => {
    //   const response = await fetch('/api/admin/docCategories')
    //   const data = await response.json()
    //   setCategories(data)
    // }
    // fetchCategories()
    setCategories(mockCategories)
  }, [])

  const buildTree = (categories: Category[]): Category[] => {
    const categoryMap = new Map<string, Category>()
    const roots: Category[] = []

    categories.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, children: [] })
    })

    categories.forEach((cat) => {
      const category = categoryMap.get(cat.id)!
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        const parent = categoryMap.get(cat.parentId)!
        if (!parent.children) parent.children = []
        parent.children.push(category)
      } else {
        roots.push(category)
      }
    })

    return roots
  }

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
    } else if (
      categories.some(
        (cat) => cat.slug === formData.slug && cat.id !== editingCategory?.id
      )
    ) {
      newErrors.slug = 'Slug must be unique'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      if (editingCategory) {
        // Update category
        // await fetch(`/api/admin/docCategories/${editingCategory.id}`, {
        //   method: 'PATCH',
        //   body: JSON.stringify(formData),
        // })
        setCategories(
          categories.map((cat) =>
            cat.id === editingCategory.id
              ? { ...cat, ...formData, updatedAt: new Date().toISOString() }
              : cat
          )
        )
      } else {
        // Create category
        // await fetch('/api/admin/docCategories', {
        //   method: 'POST',
        //   body: JSON.stringify(formData),
        // })
        const newCategory: Category = {
          id: `cat-${Date.now()}`,
          ...formData,
          parentId: formData.parentId || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setCategories([...categories, newCategory])
      }

      handleClose()
    } catch (error) {
      console.error('Error saving category:', error)
      setErrors({ submit: 'Failed to save category' })
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      parentId: category.parentId || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return

    try {
      // await fetch(`/api/admin/docCategories/${categoryId}`, {
      //   method: 'DELETE',
      // })
      setCategories(categories.filter((cat) => cat.id !== categoryId))
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const handleClose = () => {
    setShowModal(false)
    setEditingCategory(null)
    setFormData({ name: '', slug: '', description: '', parentId: '' })
    setErrors({})
  }

  const handleNameChange = (name: string) => {
    setFormData({ ...formData, name, slug: generateSlug(name) })
  }

  const renderCategoryTree = (categories: Category[], level = 0): React.ReactNode => {
    return categories.map((category) => (
      <div key={category.id} className="space-y-2">
        <div
          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          <div className="flex items-center gap-2">
            {category.children && category.children.length > 0 ? (
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Folder className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">{category.name}</p>
              {category.description && (
                <p className="text-sm text-muted-foreground">{category.description}</p>
              )}
              <p className="text-xs text-muted-foreground">/{category.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(category)}
              aria-label={`Edit ${category.name}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(category.id)}
              aria-label={`Delete ${category.name}`}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {category.children && category.children.length > 0 && (
          <div>{renderCategoryTree(category.children, level + 1)}</div>
        )}
      </div>
    ))
  }

  const treeCategories = buildTree(categories)
  const flatCategories = categories.filter((cat) => !cat.parentId)

  const columns: TableColumn<Category>[] = [
    {
      id: 'name',
      header: 'Name',
      accessor: (cat) => cat.name,
      sortable: true,
    },
    {
      id: 'slug',
      header: 'Slug',
      accessor: (cat) => <code className="text-xs">/{cat.slug}</code>,
      sortable: true,
    },
    {
      id: 'description',
      header: 'Description',
      accessor: (cat) => cat.description || '-',
    },
    {
      id: 'parent',
      header: 'Parent',
      accessor: (cat) => {
        if (cat.parentId) {
          const parent = categories.find((c) => c.id === cat.parentId)
          return parent ? parent.name : '-'
        }
        return 'Root'
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      accessor: (cat) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(cat)}
            aria-label={`Edit ${cat.name}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(cat.id)}
            aria-label={`Delete ${cat.name}`}
            className="text-destructive hover:text-destructive"
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
          <h1 className="text-3xl font-bold">Document Categories</h1>
          <p className="text-muted-foreground mt-1">
            Manage document categories and their hierarchical structure
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} aria-label="Create new category">
          <Plus className="mr-2 h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Categories Tree View */}
      <Card>
        <CardHeader>
          <CardTitle>Category Hierarchy</CardTitle>
          <CardDescription>View categories in a tree structure</CardDescription>
        </CardHeader>
        <CardContent>
          {treeCategories.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No categories yet</p>
          ) : (
            <div className="space-y-2">{renderCategoryTree(treeCategories)}</div>
          )}
        </CardContent>
      </Card>

      {/* Categories Table View */}
      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>List of all document categories</CardDescription>
        </CardHeader>
        <CardContent>
          <AccessibleDataTable
            data={flatCategories}
            columns={columns}
            caption="Document categories management table"
            filterable={true}
            filterPlaceholder="Filter categories..."
          />
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal open={true} onOpenChange={handleClose}>
          <ModalContent size="medium">
            <ModalHeader>
              <ModalTitle>
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </ModalTitle>
              <ModalDescription>
                {editingCategory
                  ? 'Update category information'
                  : 'Create a new document category'}
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
                  placeholder="Category name"
                  aria-label="Category name"
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
                  placeholder="category-slug"
                  aria-label="Category slug"
                  aria-invalid={!!errors.slug}
                />
                {errors.slug && (
                  <p className="text-sm text-destructive">{errors.slug}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  URL-friendly identifier (lowercase, hyphens only)
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
                  placeholder="Category description"
                  aria-label="Category description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentId">Parent Category</Label>
                <Select
                  value={formData.parentId || 'none'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, parentId: value === 'none' ? '' : value })
                  }
                >
                  <SelectTrigger id="parentId" aria-label="Select parent category">
                    <SelectValue placeholder="No parent (root category)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent (root category)</SelectItem>
                    {categories
                      .filter((cat) => cat.id !== editingCategory?.id)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {errors.submit && (
                <p className="text-sm text-destructive">{errors.submit}</p>
              )}
            </div>

            <ModalFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} aria-label={editingCategory ? 'Update category' : 'Create category'}>
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </div>
  )
}

