'use client'

/**
 * B234C-COMM-013: PostEditor UI
 *
 * Provides rich-text/markdown editor for creating posts and comments;
 * supports attachments (images, files); integrates tag suggestions and preview
 */

import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Upload,
  X,
  Image as ImageIcon,
  File,
  Tag,
  Eye,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  Code,
} from 'lucide-react'

interface Attachment {
  id: string
  name: string
  type: 'image' | 'file'
  url?: string
  file?: File
  preview?: string
}

interface PostEditorProps {
  post?: {
    id: string
    title: string
    content: string
    tags: string[]
    category?: {
      id: string
      name: string
    }
  }
  onSave: (data: {
    title: string
    content: string
    tags: string[]
    attachments: Attachment[]
  }) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

const suggestedTags = [
  'workflow',
  'optimization',
  'verification',
  'documents',
  'api',
  'webhooks',
  'best-practices',
  'credentialing',
  'technical',
  'support',
]

export function PostEditor({
  post,
  onSave,
  onCancel,
  mode = 'create',
}: PostEditorProps) {
  const [title, setTitle] = useState(post?.title || '')
  const [content, setContent] = useState(post?.content || '')
  const [tags, setTags] = useState<string[]>(post?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [suggestedTagsVisible, setSuggestedTagsVisible] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (tagInput.length > 0) {
      setSuggestedTagsVisible(true)
    } else {
      setSuggestedTagsVisible(false)
    }
  }, [tagInput])

  const handleFileSelect = (files: FileList | null, type: 'image' | 'file') => {
    if (!files) return

    Array.from(files).forEach((file) => {
      const attachment: Attachment = {
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        type,
        file,
      }

      if (type === 'image' && file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          attachment.preview = e.target?.result as string
          setAttachments((prev) => [...prev, attachment])
        }
        reader.readAsDataURL(file)
      } else {
        setAttachments((prev) => [...prev, attachment])
      }
    })
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const addTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim()
    if (normalizedTag && !tags.includes(normalizedTag)) {
      setTags((prev) => [...prev, normalizedTag])
    }
    setTagInput('')
    setSuggestedTagsVisible(false)
  }

  const removeTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((tag) => tag !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = document.activeElement as HTMLTextAreaElement
    if (!textarea || textarea.tagName !== 'TEXTAREA') return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    const newText =
      content.substring(0, start) +
      prefix +
      selectedText +
      suffix +
      content.substring(end)

    setContent(newText)

    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      const newPosition = start + prefix.length + selectedText.length + suffix.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      alert('Please fill in both title and content')
      return
    }

    onSave({
      title: title.trim(),
      content: content.trim(),
      tags,
      attachments,
    })
  }

  const filteredSuggestedTags = suggestedTags.filter(
    (tag) =>
      tag.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(tag)
  )

  const renderMarkdownPreview = () => {
    // Simple markdown rendering (for production, use a proper markdown library)
    let html = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline">$1</a>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      .replace(/^\* (.*$)/gm, '<li class="ml-4">$1</li>')
      .replace(/\n/g, '<br />')

    return { __html: html }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create New Post' : 'Edit Post'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-2 block">Title</label>
            <Input
              placeholder="Enter post title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Content Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Content</label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 border rounded-md">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertMarkdown('**', '**')}
                    title="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertMarkdown('*', '*')}
                    title="Italic"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertMarkdown('`', '`')}
                    title="Code"
                  >
                    <Code className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertMarkdown('[', '](url)')}
                    title="Link"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertMarkdown('- ', '')}
                    title="List"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant={showPreview ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </div>
            </div>

            {showPreview ? (
              <Card>
                <CardContent className="pt-6">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={renderMarkdownPreview()}
                  />
                </CardContent>
              </Card>
            ) : (
              <Textarea
                placeholder="Write your post content... (Markdown supported)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium mb-2 block">Tags</label>
            <div className="relative">
              <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[2.5rem]">
                {tags.map((tag) => (
                  <Badge key={tag} variant="default" className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  type="text"
                  placeholder="Add tags..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  className="border-0 focus-visible:ring-0 flex-1 min-w-[120px]"
                />
              </div>
              {suggestedTagsVisible && filteredSuggestedTags.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredSuggestedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                    >
                      <Tag className="h-3 w-3 inline mr-2" />
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="text-sm font-medium mb-2 block">Attachments</label>
            <div className="flex gap-2 mb-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files, 'image')}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files, 'file')}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Add Image
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <File className="h-4 w-4 mr-2" />
                Add File
              </Button>
            </div>
            {attachments.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {attachments.map((attachment) => (
                  <Card key={attachment.id} className="relative">
                    {attachment.preview ? (
                      <div className="relative aspect-square">
                        <img
                          src={attachment.preview}
                          alt={attachment.name}
                          className="w-full h-full object-cover rounded-t-md"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => removeAttachment(attachment.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <File className="h-4 w-4 shrink-0" />
                            <span className="text-xs truncate">{attachment.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => removeAttachment(attachment.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {mode === 'create' ? 'Create Post' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

