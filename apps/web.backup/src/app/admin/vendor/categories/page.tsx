'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, FileText, CheckCircle2, AlertCircle, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface VendorCategory {
  id: string
  name: string
  description?: string
  usageCount: number
  complianceRequirements: string[]
  defaultChecklist: ChecklistItem[]
  createdAt: string
  updatedAt: string
}

interface ChecklistItem {
  id: string
  question: string
  required: boolean
}

export default function VendorCategoryManagementPage() {
  const [categories, setCategories] = useState<VendorCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<VendorCategory | null>(null)
  const [editingCategory, setEditingCategory] = useState<Partial<VendorCategory>>({
    name: '',
    description: '',
    complianceRequirements: [],
    defaultChecklist: [],
  })
  const [newChecklistItem, setNewChecklistItem] = useState({ question: '', required: false })
  const [newRequirement, setNewRequirement] = useState('')

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    try {
      setLoading(true)
      const response = await fetch('/api/demo/vendor/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')
      const payload = await response.json()
      setCategories(payload.categories || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    try {
      const response = await fetch('/api/demo/vendor/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCategory),
      })
      if (!response.ok) throw new Error('Failed to create category')
      await fetchCategories()
      setShowCreateDialog(false)
      setEditingCategory({ name: '', description: '', complianceRequirements: [], defaultChecklist: [] })
    } catch (err) {
      alert(`Failed to create: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function handleUpdate() {
    if (!selectedCategory) return
    try {
      const response = await fetch(`/api/demo/vendor/categories/${selectedCategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCategory),
      })
      if (!response.ok) throw new Error('Failed to update category')
      await fetchCategories()
      setShowEditDialog(false)
      setSelectedCategory(null)
      setEditingCategory({ name: '', description: '', complianceRequirements: [], defaultChecklist: [] })
    } catch (err) {
      alert(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function handleDelete() {
    if (!selectedCategory) return
    try {
      const response = await fetch(`/api/demo/vendor/categories/${selectedCategory.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete category')
      await fetchCategories()
      setShowDeleteDialog(false)
      setSelectedCategory(null)
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  function openEditDialog(category: VendorCategory) {
    setSelectedCategory(category)
    setEditingCategory({
      name: category.name,
      description: category.description,
      complianceRequirements: category.complianceRequirements || [],
      defaultChecklist: category.defaultChecklist || [],
    })
    setShowEditDialog(true)
  }

  function openDeleteDialog(category: VendorCategory) {
    setSelectedCategory(category)
    setShowDeleteDialog(true)
  }

  function addChecklistItem() {
    if (!newChecklistItem.question.trim()) return
    setEditingCategory({
      ...editingCategory,
      defaultChecklist: [
        ...(editingCategory.defaultChecklist || []),
        {
          id: Date.now().toString(),
          question: newChecklistItem.question,
          required: newChecklistItem.required,
        },
      ],
    })
    setNewChecklistItem({ question: '', required: false })
  }

  function removeChecklistItem(itemId: string) {
    setEditingCategory({
      ...editingCategory,
      defaultChecklist: (editingCategory.defaultChecklist || []).filter((item) => item.id !== itemId),
    })
  }

  function addRequirement() {
    if (!newRequirement.trim()) return
    setEditingCategory({
      ...editingCategory,
      complianceRequirements: [...(editingCategory.complianceRequirements || []), newRequirement.trim()],
    })
    setNewRequirement('')
  }

  function removeRequirement(requirement: string) {
    setEditingCategory({
      ...editingCategory,
      complianceRequirements: (editingCategory.complianceRequirements || []).filter((r) => r !== requirement),
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-sm text-muted-foreground">Loading categories...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-sm text-destructive">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendor Category Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, edit, and manage vendor categories with compliance requirements and due diligence checklists
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Vendor Category</DialogTitle>
              <DialogDescription>
                Define a new vendor category with compliance requirements and default checklist
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">
                  Category Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="category-name"
                  value={editingCategory.name || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="e.g., Healthcare Services, IT Services"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-description">Description</Label>
                <Textarea
                  id="category-description"
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  placeholder="Describe this category..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Compliance Requirements</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newRequirement}
                    onChange={(e) => setNewRequirement(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addRequirement()
                      }
                    }}
                    placeholder="Add requirement and press Enter..."
                  />
                  <Button type="button" variant="outline" onClick={addRequirement}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(editingCategory.complianceRequirements || []).map((req, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {req}
                      <button
                        type="button"
                        onClick={() => removeRequirement(req)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default Due Diligence Checklist</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={newChecklistItem.question}
                      onChange={(e) => setNewChecklistItem({ ...newChecklistItem, question: e.target.value })}
                      placeholder="Enter checklist question..."
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newChecklistItem.required}
                        onChange={(e) => setNewChecklistItem({ ...newChecklistItem, required: e.target.checked })}
                      />
                      <span className="text-sm">Required</span>
                    </label>
                    <Button type="button" variant="outline" onClick={addChecklistItem}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(editingCategory.defaultChecklist || []).map((item) => (
                      <Card key={item.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span>{item.question}</span>
                              {item.required && (
                                <Badge variant="outline" className="text-xs">
                                  Required
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeChecklistItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!editingCategory.name}>
                Create Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Categories</CardTitle>
          <CardDescription>
            Manage vendor categories and their associated requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Usage Count</TableHead>
                  <TableHead>Requirements</TableHead>
                  <TableHead>Checklist Items</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {category.description || 'No description'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{category.usageCount} vendors</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {category.complianceRequirements?.slice(0, 2).map((req, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {req}
                          </Badge>
                        ))}
                        {category.complianceRequirements && category.complianceRequirements.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{category.complianceRequirements.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {category.defaultChecklist?.length || 0} items
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(category)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(category)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No categories found. Create your first category to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vendor Category</DialogTitle>
            <DialogDescription>
              Update category details, compliance requirements, and checklist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-category-name"
                value={editingCategory.name || ''}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category-description">Description</Label>
              <Textarea
                id="edit-category-description"
                value={editingCategory.description || ''}
                onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Compliance Requirements</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newRequirement}
                  onChange={(e) => setNewRequirement(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addRequirement()
                    }
                  }}
                  placeholder="Add requirement and press Enter..."
                />
                <Button type="button" variant="outline" onClick={addRequirement}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(editingCategory.complianceRequirements || []).map((req, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {req}
                    <button
                      type="button"
                      onClick={() => removeRequirement(req)}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default Due Diligence Checklist</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={newChecklistItem.question}
                    onChange={(e) => setNewChecklistItem({ ...newChecklistItem, question: e.target.value })}
                    placeholder="Enter checklist question..."
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newChecklistItem.required}
                      onChange={(e) => setNewChecklistItem({ ...newChecklistItem, required: e.target.checked })}
                    />
                    <span className="text-sm">Required</span>
                  </label>
                  <Button type="button" variant="outline" onClick={addChecklistItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {(editingCategory.defaultChecklist || []).map((item) => (
                    <Card key={item.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span>{item.question}</span>
                            {item.required && (
                              <Badge variant="outline" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeChecklistItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!editingCategory.name}>
              Update Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedCategory?.name}"? This action cannot be undone.
              {selectedCategory && selectedCategory.usageCount > 0 && (
                <div className="mt-2 flex items-center gap-2 text-orange-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">
                    This category is used by {selectedCategory.usageCount} vendor(s). Deleting it may affect those vendors.
                  </span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

