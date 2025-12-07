'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Eye,
  FileText,
  GitBranch,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PublishModal } from '@/components/docs/PublishModal'

// Types
interface Document {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  status: 'draft' | 'published' | 'archived'
  currentVersion: number
  versionToken: string
}

// Mock data - replace with API call
const mockDocument: Document = {
  id: '1',
  title: 'Clinical Guidelines 2024',
  content: `# Clinical Guidelines 2024

## Introduction

This document outlines the clinical guidelines for the year 2024.`,
  category: 'Clinical',
  tags: ['guidelines', 'clinical', '2024'],
  status: 'draft',
  currentVersion: 3,
  versionToken: 'v3-abc123',
}

export default function DocumentEditorPage() {
  const params = useParams()
  const router = useRouter()
  const documentId = params.documentId as string

  const [document, setDocument] = useState<Document | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [diffContent, setDiffContent] = useState<string | null>(null)

  useEffect(() => {
    // In a real app, fetch document by ID
    // const fetchDocument = async () => {
    //   const response = await fetch(`/api/documents/${documentId}`)
    //   const data = await response.json()
    //   setDocument(data)
    //   setTitle(data.title)
    //   setContent(data.content)
    // }
    // fetchDocument()
    setDocument(mockDocument)
    setTitle(mockDocument.title)
    setContent(mockDocument.content)
  }, [documentId])

  useEffect(() => {
    if (document) {
      const changed = title !== document.title || content !== document.content
      setHasChanges(changed)
    }
  }, [title, content, document])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus('saving')

    try {
      // In a real app, save draft
      // await fetch(`/api/documents/${documentId}/draft`, {
      //   method: 'POST',
      //   body: JSON.stringify({ title, content }),
      // })

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setSaveStatus('saved')
      setHasChanges(false)
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleShowDiff = () => {
    if (document) {
      // Simple diff - in a real app, use a proper diff library
      const oldLines = document.content.split('\n')
      const newLines = content.split('\n')
      const diff = newLines
        .map((line, i) => {
          if (i >= oldLines.length || line !== oldLines[i]) {
            return `+ ${line}`
          }
          return `  ${line}`
        })
        .join('\n')
      setDiffContent(diff)
    }
  }

  const renderMarkdown = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-3xl font-bold mt-6 mb-4">{line.slice(2)}</h1>
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-2xl font-semibold mt-5 mb-3">{line.slice(3)}</h2>
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-xl font-semibold mt-4 mb-2">{line.slice(4)}</h3>
        }
        if (line.trim() === '') {
          return <br key={i} />
        }
        return <p key={i} className="mb-2">{line}</p>
      })
  }

  if (!document) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading document...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/docs/${documentId}`)}
            aria-label="Back to document"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Document</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">Version {document.currentVersion}</Badge>
              <Badge variant="secondary" className="text-xs">
                <GitBranch className="mr-1 h-3 w-3" />
                {document.versionToken}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Unsaved changes
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            aria-label="Save draft"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button
            onClick={() => setShowPublishModal(true)}
            aria-label="Publish document"
          >
            Publish
          </Button>
        </div>
      </div>

      {/* Editor */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'edit' | 'preview')}>
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="diff" onClick={handleShowDiff}>Diff</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Editor</CardTitle>
              <CardDescription>
                Edit your document using Markdown syntax
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Document title"
                  aria-label="Document title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your document content in Markdown..."
                  className="min-h-[500px] font-mono text-sm"
                  aria-label="Document content"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>
                  {content.split('\n').length} lines • {content.length} characters
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>How your document will appear</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert min-h-[500px]">
                {renderMarkdown(content)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Changes</CardTitle>
              <CardDescription>Compare your changes with the current version</CardDescription>
            </CardHeader>
            <CardContent>
              {diffContent ? (
                <pre className="font-mono text-sm bg-muted p-4 rounded-lg overflow-auto min-h-[500px]">
                  {diffContent}
                </pre>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Click the Diff tab to view changes
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Publish Modal */}
      {showPublishModal && (
        <PublishModal
          documentId={documentId}
          title={title}
          content={content}
          currentCategory={document.category}
          currentTags={document.tags}
          onClose={() => setShowPublishModal(false)}
          onPublish={async (data) => {
            // In a real app, publish document
            // await fetch(`/api/documents/${documentId}/publish`, {
            //   method: 'POST',
            //   body: JSON.stringify(data),
            // })
            console.log('Publishing:', data)
            setShowPublishModal(false)
            router.push(`/docs/${documentId}`)
          }}
        />
      )}
    </div>
  )
}

