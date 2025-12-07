'use client'

/**
 * B234C-COMM-015: ModerationDashboard UI
 *
 * Accessible to moderators: lists flagged posts/comments, shows details and user history,
 * provides actions (approve, hide, delete), records decisions
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Trash2,
  User,
  MessageSquare,
  FileText,
  Clock,
  Flag,
  Shield,
  History,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

type FlagStatus = 'pending' | 'approved' | 'hidden' | 'deleted'
type ContentType = 'post' | 'comment'

interface FlaggedContent {
  id: string
  type: ContentType
  content: {
    id: string
    title?: string
    text: string
    author: {
      id: string
      name: string
      avatar?: string
    }
    createdAt: string
    link: string
  }
  flaggedBy: {
    id: string
    name: string
  }
  reason: string
  status: FlagStatus
  flaggedAt: string
  moderatedBy?: {
    id: string
    name: string
  }
  moderatedAt?: string
  moderationNotes?: string
}

interface UserHistory {
  userId: string
  userName: string
  totalFlags: number
  totalPosts: number
  totalComments: number
  previousActions: Array<{
    action: string
    date: string
    moderator: string
  }>
}

// Mock data - replace with API calls
const mockFlaggedContent: FlaggedContent[] = [
  {
    id: '1',
    type: 'post',
    content: {
      id: 'post-1',
      title: 'Spam post title',
      text: 'This is clearly spam content...',
      author: {
        id: 'user-1',
        name: 'SpamUser123',
      },
      createdAt: '2025-11-15T10:00:00Z',
      link: '/community/posts/post-1',
    },
    flaggedBy: {
      id: 'user-2',
      name: 'Community Member',
    },
    reason: 'Spam',
    status: 'pending',
    flaggedAt: '2025-11-16T08:00:00Z',
  },
  {
    id: '2',
    type: 'comment',
    content: {
      id: 'comment-1',
      text: 'Inappropriate comment content here...',
      author: {
        id: 'user-3',
        name: 'ProblemUser',
      },
      createdAt: '2025-11-15T14:00:00Z',
      link: '/community/posts/post-2#comment-1',
    },
    flaggedBy: {
      id: 'user-4',
      name: 'Another Member',
    },
    reason: 'Inappropriate Content',
    status: 'pending',
    flaggedAt: '2025-11-16T07:30:00Z',
  },
  {
    id: '3',
    type: 'post',
    content: {
      id: 'post-2',
      title: 'Already moderated post',
      text: 'This post was already reviewed...',
      author: {
        id: 'user-5',
        name: 'NormalUser',
      },
      createdAt: '2025-11-14T10:00:00Z',
      link: '/community/posts/post-2',
    },
    flaggedBy: {
      id: 'user-6',
      name: 'Reporter',
    },
    reason: 'Misinformation',
    status: 'hidden',
    flaggedAt: '2025-11-15T12:00:00Z',
    moderatedBy: {
      id: 'mod-1',
      name: 'Moderator Admin',
    },
    moderatedAt: '2025-11-15T13:00:00Z',
    moderationNotes: 'Content contains unverified claims. Hidden pending fact-check.',
  },
]

const mockUserHistory: UserHistory[] = [
  {
    userId: 'user-1',
    userName: 'SpamUser123',
    totalFlags: 3,
    totalPosts: 15,
    totalComments: 8,
    previousActions: [
      {
        action: 'Post deleted',
        date: '2025-11-10T10:00:00Z',
        moderator: 'Moderator Admin',
      },
      {
        action: 'Warning issued',
        date: '2025-11-08T14:00:00Z',
        moderator: 'Moderator Admin',
      },
    ],
  },
]

export default function ModerationDashboard() {
  const [flaggedContent, setFlaggedContent] = useState(mockFlaggedContent)
  const [selectedContent, setSelectedContent] = useState<FlaggedContent | null>(null)
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'hide' | 'delete' | null>(null)
  const [moderationNotes, setModerationNotes] = useState('')
  const [filterStatus, setFilterStatus] = useState<FlagStatus | 'all'>('all')

  const filteredContent = useMemo(() => {
    if (filterStatus === 'all') return flaggedContent
    return flaggedContent.filter((item) => item.status === filterStatus)
  }, [flaggedContent, filterStatus])

  const stats = useMemo(() => {
    return {
      pending: flaggedContent.filter((item) => item.status === 'pending').length,
      approved: flaggedContent.filter((item) => item.status === 'approved').length,
      hidden: flaggedContent.filter((item) => item.status === 'hidden').length,
      deleted: flaggedContent.filter((item) => item.status === 'deleted').length,
    }
  }, [flaggedContent])

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const handleAction = (content: FlaggedContent, action: 'approve' | 'hide' | 'delete') => {
    setSelectedContent(content)
    setActionType(action)
    setModerationNotes('')
    setShowActionDialog(true)
  }

  const confirmAction = () => {
    if (!selectedContent || !actionType) return

    const newStatus: FlagStatus =
      actionType === 'approve'
        ? 'approved'
        : actionType === 'hide'
          ? 'hidden'
          : 'deleted'

    setFlaggedContent((prev) =>
      prev.map((item) =>
        item.id === selectedContent.id
          ? {
              ...item,
              status: newStatus,
              moderatedBy: {
                id: 'current-mod',
                name: 'Current Moderator',
              },
              moderatedAt: new Date().toISOString(),
              moderationNotes: moderationNotes.trim() || undefined,
            }
          : item
      )
    )

    setShowActionDialog(false)
    setSelectedContent(null)
    setActionType(null)
    setModerationNotes('')
  }

  const getUserHistory = (userId: string): UserHistory | undefined => {
    return mockUserHistory.find((h) => h.userId === userId)
  }

  const getStatusBadge = (status: FlagStatus) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      case 'approved':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case 'hidden':
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            <EyeOff className="h-3 w-3 mr-1" />
            Hidden
          </Badge>
        )
      case 'deleted':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <Trash2 className="h-3 w-3 mr-1" />
            Deleted
          </Badge>
        )
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Moderation Dashboard</h1>
        </div>
        <p className="text-muted-foreground">
          Review and moderate flagged content in the community
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hidden</p>
                <p className="text-2xl font-bold">{stats.hidden}</p>
              </div>
              <EyeOff className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deleted</p>
                <p className="text-2xl font-bold">{stats.deleted}</p>
              </div>
              <Trash2 className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Flagged Content</CardTitle>
            <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as FlagStatus | 'all')}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="hidden">Hidden</TabsTrigger>
                <TabsTrigger value="deleted">Deleted</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {filteredContent.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No flagged content found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredContent.map((item) => {
                const userHistory = getUserHistory(item.content.author.id)

                return (
                  <Card key={item.id} className="border-l-4 border-l-yellow-500">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {item.type === 'post' ? (
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            )}
                            <Badge variant="outline">{item.type}</Badge>
                            {getStatusBadge(item.status)}
                            <Badge variant="destructive">{item.reason}</Badge>
                          </div>
                          {item.content.title && (
                            <CardTitle className="text-lg mb-2">{item.content.title}</CardTitle>
                          )}
                          <CardDescription className="line-clamp-2 mb-2">
                            {item.content.text}
                          </CardDescription>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{item.content.author.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Flag className="h-4 w-4" />
                              <span>Flagged by {item.flaggedBy.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{formatTimeAgo(item.flaggedAt)}</span>
                            </div>
                          </div>
                          {item.moderatedBy && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              Moderated by {item.moderatedBy.name} on{' '}
                              {new Date(item.moderatedAt!).toLocaleString()}
                              {item.moderationNotes && (
                                <div className="mt-1 p-2 bg-muted rounded text-xs">
                                  {item.moderationNotes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={item.content.link} target="_blank">
                              <Eye className="h-4 w-4 mr-2" />
                              View Content
                            </Link>
                          </Button>
                          {userHistory && (
                            <Button variant="outline" size="sm">
                              <History className="h-4 w-4 mr-2" />
                              User History ({userHistory.totalFlags} flags)
                            </Button>
                          )}
                        </div>
                        {item.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(item, 'approve')}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(item, 'hide')}
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <EyeOff className="h-4 w-4 mr-2" />
                              Hide
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(item, 'delete')}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Confirmation Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Content'}
              {actionType === 'hide' && 'Hide Content'}
              {actionType === 'delete' && 'Delete Content'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' &&
                'This will mark the content as approved and remove the flag.'}
              {actionType === 'hide' &&
                'This will hide the content from public view but keep it in the system.'}
              {actionType === 'delete' &&
                'This will permanently delete the content. This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedContent && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">
                  {selectedContent.content.title || 'Comment'}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {selectedContent.content.text}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Moderation Notes (optional)
              </label>
              <Textarea
                placeholder="Add notes about this moderation decision..."
                value={moderationNotes}
                onChange={(e) => setModerationNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'delete' ? 'destructive' : 'default'}
              onClick={confirmAction}
            >
              {actionType === 'approve' && 'Approve'}
              {actionType === 'hide' && 'Hide'}
              {actionType === 'delete' && 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

