'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Reply, Edit, Trash2, Send, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
// Simple date formatting helper
const formatDistanceToNow = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

// Types
interface Comment {
  id: string
  content: string
  author: string
  authorId: string
  createdAt: string
  updatedAt?: string
  parentId?: string
  replies?: Comment[]
  isEdited?: boolean
}

interface CommentSectionProps {
  documentId: string
}

// Mock data - replace with API call
const mockComments: Comment[] = [
  {
    id: '1',
    content: 'This section needs clarification on the treatment protocols.',
    author: 'Dr. John Doe',
    authorId: 'user-2',
    createdAt: '2024-01-15T10:30:00Z',
    replies: [
      {
        id: '1-1',
        content: 'I agree, let me update that section.',
        author: 'Dr. Jane Smith',
        authorId: 'user-1',
        createdAt: '2024-01-15T11:00:00Z',
        parentId: '1',
      },
    ],
  },
  {
    id: '2',
    content: 'Great document! Very comprehensive.',
    author: 'Dr. Sarah Johnson',
    authorId: 'user-3',
    createdAt: '2024-01-16T09:15:00Z',
  },
]

export function CommentSection({ documentId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const currentUserId = 'user-1' // Replace with actual user ID

  useEffect(() => {
    // In a real app, fetch comments
    // const fetchComments = async () => {
    //   const response = await fetch(`/api/documents/${documentId}/comments`)
    //   const data = await response.json()
    //   setComments(data)
    // }
    // fetchComments()
    setComments(mockComments)
  }, [documentId])

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    const comment: Comment = {
      id: `comment-${Date.now()}`,
      content: newComment,
      author: 'Current User', // Replace with actual user
      authorId: currentUserId,
      createdAt: new Date().toISOString(),
    }

    // In a real app, POST to API
    // await fetch(`/api/documents/${documentId}/comments`, {
    //   method: 'POST',
    //   body: JSON.stringify(comment),
    // })

    setComments([...comments, comment])
    setNewComment('')
  }

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim()) return

    const reply: Comment = {
      id: `reply-${Date.now()}`,
      content: replyContent,
      author: 'Current User',
      authorId: currentUserId,
      createdAt: new Date().toISOString(),
      parentId,
    }

    // In a real app, POST to API
    setComments(
      comments.map((comment) => {
        if (comment.id === parentId) {
          return {
            ...comment,
            replies: [...(comment.replies || []), reply],
          }
        }
        return comment
      })
    )
    setReplyContent('')
    setReplyingTo(null)
  }

  const handleEdit = async (commentId: string) => {
    const comment = findComment(comments, commentId)
    if (!comment) return

    // In a real app, PATCH to API
    setComments(
      comments.map((c) => {
        if (c.id === commentId) {
          return { ...c, content: editContent, isEdited: true, updatedAt: new Date().toISOString() }
        }
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map((r) =>
              r.id === commentId
                ? { ...r, content: editContent, isEdited: true, updatedAt: new Date().toISOString() }
                : r
            ),
          }
        }
        return c
      })
    )
    setEditingId(null)
    setEditContent('')
  }

  const handleDelete = async (commentId: string) => {
    // In a real app, DELETE to API
    setComments(
      comments
        .filter((c) => c.id !== commentId)
        .map((c) => ({
          ...c,
          replies: c.replies?.filter((r) => r.id !== commentId),
        }))
    )
  }

  const findComment = (comments: Comment[], id: string): Comment | null => {
    for (const comment of comments) {
      if (comment.id === id) return comment
      if (comment.replies) {
        const found = comment.replies.find((r) => r.id === id)
        if (found) return found
      }
    }
    return null
  }

  const canEdit = (comment: Comment) => comment.authorId === currentUserId
  const canDelete = (comment: Comment) => comment.authorId === currentUserId

  const renderComment = (comment: Comment, isReply = false) => {
    const isEditing = editingId === comment.id

    return (
      <div key={comment.id} className={isReply ? 'ml-8 mt-4' : 'mt-4'}>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{comment.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                  {comment.isEdited && (
                    <Badge variant="outline" className="text-xs">
                      Edited
                    </Badge>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleEdit(comment.id)}
                        aria-label="Save edit"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null)
                          setEditContent('')
                        }}
                        aria-label="Cancel edit"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                )}
              </div>
              {(canEdit(comment) || canDelete(comment)) && !isEditing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Comment options">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEdit(comment) && (
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditContent(comment.content)
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete(comment) && (
                      <DropdownMenuItem
                        onClick={() => handleDelete(comment.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {!isReply && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setReplyingTo(comment.id)
                  setReplyContent('')
                }}
                aria-label={`Reply to ${comment.author}`}
              >
                <Reply className="mr-2 h-4 w-4" />
                Reply
              </Button>
            )}
            {replyingTo === comment.id && (
              <div className="mt-4 space-y-2">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-[80px]"
                  aria-label="Reply content"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleReply(comment.id)}
                    aria-label="Post reply"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Post Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplyingTo(null)
                      setReplyContent('')
                    }}
                    aria-label="Cancel reply"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        {comment.replies?.map((reply) => renderComment(reply, true))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({comments.length})
        </h3>

        {/* Add Comment */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="min-h-[100px]"
              aria-label="New comment"
            />
            <div className="flex justify-end mt-2">
              <Button onClick={handleAddComment} aria-label="Post comment">
                <Send className="mr-2 h-4 w-4" />
                Post Comment
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Comments List */}
        {comments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          <div className="space-y-4">{comments.map((comment) => renderComment(comment))}</div>
        )}
      </div>
    </div>
  )
}

