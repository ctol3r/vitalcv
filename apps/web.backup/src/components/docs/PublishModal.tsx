'use client'

import { useState } from 'react'
import { X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '@/components/design/Modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Types
interface PublishModalProps {
  documentId: string
  title: string
  content: string
  currentCategory: string
  currentTags: string[]
  onClose: () => void
  onPublish: (data: {
    category: string
    tags: string[]
    changeSummary: string
  }) => Promise<void>
}

// Mock categories - replace with API call
const categories = ['Clinical', 'Compliance', 'Training', 'Policy', 'Procedure']

export function PublishModal({
  documentId,
  title,
  content,
  currentCategory,
  currentTags,
  onClose,
  onPublish,
}: PublishModalProps) {
  const [category, setCategory] = useState(currentCategory)
  const [tags, setTags] = useState<string[]>(currentTags)
  const [tagInput, setTagInput] = useState('')
  const [changeSummary, setChangeSummary] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      handleAddTag()
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!category) {
      newErrors.category = 'Category is required'
    }

    if (!changeSummary.trim()) {
      newErrors.changeSummary = 'Change summary is required'
    }

    if (changeSummary.length < 10) {
      newErrors.changeSummary = 'Change summary must be at least 10 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePublish = async () => {
    if (!validate()) return

    setIsPublishing(true)
    try {
      await onPublish({
        category,
        tags,
        changeSummary: changeSummary.trim(),
      })
    } catch (error) {
      console.error('Publish error:', error)
      setErrors({ submit: 'Failed to publish document. Please try again.' })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <Modal open={true} onOpenChange={onClose}>
      <ModalContent size="large">
        <ModalHeader>
          <ModalTitle>Publish Document</ModalTitle>
          <ModalDescription>
            Review and configure settings before publishing this document
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-6 py-4">
          {/* Document Preview */}
          <div className="space-y-2">
            <Label>Document Title</Label>
            <div className="p-3 bg-muted rounded-md">
              <p className="font-medium">{title}</p>
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" aria-label="Select category" aria-invalid={!!errors.category}>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.category}
              </p>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a tag and press Enter"
                aria-label="Add tag"
              />
              <Button type="button" variant="outline" onClick={handleAddTag} aria-label="Add tag">
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring rounded"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Change Summary */}
          <div className="space-y-2">
            <Label htmlFor="changeSummary">
              Change Summary <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="changeSummary"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="Describe the changes made in this version..."
              className="min-h-[100px]"
              aria-label="Change summary"
              aria-invalid={!!errors.changeSummary}
              aria-describedby={errors.changeSummary ? 'changeSummary-error' : undefined}
            />
            {errors.changeSummary && (
              <p id="changeSummary-error" className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.changeSummary}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {changeSummary.length} characters (minimum 10)
            </p>
          </div>

          {/* Content Preview */}
          <div className="space-y-2">
            <Label>Content Preview</Label>
            <div className="p-4 bg-muted rounded-md max-h-[200px] overflow-auto">
              <p className="text-sm whitespace-pre-wrap line-clamp-6">{content}</p>
            </div>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {errors.submit}
              </p>
            </div>
          )}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={isPublishing}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={isPublishing} aria-label="Publish document">
            {isPublishing ? (
              <>
                <span className="mr-2">Publishing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Publish
              </>
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

