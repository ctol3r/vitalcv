'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Edit,
  History,
  MessageSquare,
  Paperclip,
  Download,
  Share2,
  Eye,
  Calendar,
  User,
  Tag,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CommentSection } from '@/components/docs/CommentSection'

// Types
interface DocumentVersion {
  id: string
  version: number
  content: string
  changeSummary: string
  author: string
  createdAt: string
}

interface Document {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  status: 'draft' | 'published' | 'archived'
  author: string
  authorId: string
  createdAt: string
  updatedAt: string
  currentVersion: number
  versions: DocumentVersion[]
  attachments: Array<{ id: string; name: string; url: string; size: number }>
  metadata: {
    views: number
    downloads: number
    lastViewed?: string
  }
}

// Mock data - replace with API call
const mockDocument: Document = {
  id: '1',
  title: 'Clinical Guidelines 2024',
  content: `# Clinical Guidelines 2024

## Introduction

This document outlines the clinical guidelines for the year 2024. These guidelines are based on the latest research and best practices in the field.

## Section 1: Patient Care

### 1.1 Initial Assessment

All patients should receive a comprehensive initial assessment within 24 hours of admission.

### 1.2 Treatment Protocols

Treatment protocols should be followed as outlined in the standard operating procedures.

## Section 2: Documentation

All clinical documentation must be completed within 48 hours of patient interaction.

## Conclusion

These guidelines are subject to regular review and updates.`,
  category: 'Clinical',
  tags: ['guidelines', 'clinical', '2024'],
  status: 'published',
  author: 'Dr. Jane Smith',
  authorId: 'user-1',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-15',
  currentVersion: 3,
  versions: [
    {
      id: 'v1',
      version: 1,
      content: 'Initial version',
      changeSummary: 'Initial document creation',
      author: 'Dr. Jane Smith',
      createdAt: '2024-01-01',
    },
    {
      id: 'v2',
      version: 2,
      content: 'Updated version',
      changeSummary: 'Added Section 2 on documentation',
      author: 'Dr. Jane Smith',
      createdAt: '2024-01-10',
    },
    {
      id: 'v3',
      version: 3,
      content: 'Current version',
      changeSummary: 'Updated treatment protocols',
      author: 'Dr. Jane Smith',
      createdAt: '2024-01-15',
    },
  ],
  attachments: [
    { id: 'att1', name: 'appendix-a.pdf', url: '/files/appendix-a.pdf', size: 1024000 },
    { id: 'att2', name: 'references.docx', url: '/files/references.docx', size: 512000 },
  ],
  metadata: {
    views: 245,
    downloads: 12,
    lastViewed: '2024-01-20',
  },
}

export default function DocumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const documentId = params.documentId as string
  const [document, setDocument] = useState<Document | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('content')

  useEffect(() => {
    // In a real app, fetch document by ID
    // const fetchDocument = async () => {
    //   const response = await fetch(`/api/documents/${documentId}`)
    //   const data = await response.json()
    //   setDocument(data)
    // }
    // fetchDocument()
    setDocument(mockDocument)
  }, [documentId])

  if (!document) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading document...</p>
      </div>
    )
  }

  const displayedVersion = selectedVersion
    ? document.versions.find((v) => v.version === selectedVersion)
    : document.versions[document.versions.length - 1]

  const canEdit = true // Replace with actual permission check

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Button
            variant="ghost"
            onClick={() => router.push('/docs/library')}
            className="mb-4"
            aria-label="Back to document library"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{document.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline">{document.category}</Badge>
              <Badge
                variant={document.status === 'published' ? 'default' : 'secondary'}
              >
                {document.status}
              </Badge>
              {document.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <Tag className="mr-1 h-3 w-3" />
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              onClick={() => router.push(`/docs/${documentId}/edit`)}
              aria-label="Edit document"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          <Button variant="outline" aria-label="Download document">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button variant="outline" aria-label="Share document">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Author</span>
              </div>
              <p className="font-medium">{document.author}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Updated</span>
              </div>
              <p className="font-medium">
                {new Date(document.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>Views</span>
              </div>
              <p className="font-medium">{document.metadata.views}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Download className="h-4 w-4" />
                <span>Downloads</span>
              </div>
              <p className="font-medium">{document.metadata.downloads}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="history">Version History</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Document Content</CardTitle>
                {selectedVersion && (
                  <Badge variant="outline">
                    Version {selectedVersion}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-auto p-0"
                      onClick={() => setSelectedVersion(null)}
                      aria-label="View current version"
                    >
                      View Current
                    </Button>
                  </Badge>
                )}
              </div>
              {displayedVersion && (
                <CardDescription>
                  Version {displayedVersion.version} • {displayedVersion.changeSummary} •{' '}
                  {new Date(displayedVersion.createdAt).toLocaleDateString()}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: document.content
                    .split('\n')
                    .map((line) => {
                      if (line.startsWith('# ')) {
                        return `<h1>${line.slice(2)}</h1>`
                      }
                      if (line.startsWith('## ')) {
                        return `<h2>${line.slice(3)}</h2>`
                      }
                      if (line.startsWith('### ')) {
                        return `<h3>${line.slice(4)}</h3>`
                      }
                      if (line.trim() === '') {
                        return '<br/>'
                      }
                      return `<p>${line}</p>`
                    })
                    .join(''),
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
              <CardDescription>
                View and compare different versions of this document
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {document.versions
                  .slice()
                  .reverse()
                  .map((version) => (
                    <div
                      key={version.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Version {version.version}</span>
                          {version.version === document.currentVersion && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {version.changeSummary}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          By {version.author} •{' '}
                          {new Date(version.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedVersion(version.version)
                          setActiveTab('content')
                        }}
                        aria-label={`View version ${version.version}`}
                      >
                        <History className="mr-2 h-4 w-4" />
                        View
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="space-y-4">
          <CommentSection documentId={documentId} />
        </TabsContent>

        <TabsContent value="attachments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
              <CardDescription>Files attached to this document</CardDescription>
            </CardHeader>
            <CardContent>
              {document.attachments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No attachments
                </p>
              ) : (
                <div className="space-y-2">
                  {document.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Paperclip className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{attachment.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(attachment.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={attachment.url}
                          download
                          aria-label={`Download ${attachment.name}`}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

