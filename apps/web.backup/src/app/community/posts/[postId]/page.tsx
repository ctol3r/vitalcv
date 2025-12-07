'use client'

/**
 * B234C-COMM-012: ThreadView UI
 *
 * Shows post details and threaded comments; supports replying, reacting, editing (if authorised);
 * includes follow/unfollow toggles
 */

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  User,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Share2,
  Bookmark,
  BookmarkCheck,
  Edit,
  Trash2,
  MoreVertical,
  Check,
  X,
  Flag,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PostEditor } from '@/components/community/PostEditor'

// Mock data types
interface Comment {
  id: string
  content: string
  author: {
    id: string
    name: string
    avatar?: string
  }
  upvotes: number
  downvotes: number
  userVote?: 'up' | 'down' | null
  createdAt: string
  editedAt?: string
  isAuthor: boolean
  canEdit: boolean
  canDelete: boolean
  replies?: Comment[]
}

interface Post {
  id: string
  title: string
  content: string
  author: {
    id: string
    name: string
    avatar?: string
  }
  category: {
    id: string
    name: string
  }
  tags: string[]
  upvotes: number
  downvotes: number
  userVote?: 'up' | 'down' | null
  viewCount: number
  replyCount: number
  createdAt: string
  editedAt?: string
  isAuthor: boolean
  canEdit: boolean
  canDelete: boolean
  isFollowed: boolean
  isBookmarked: boolean
  isPinned?: boolean
  isAnswered?: boolean
}

// Mock data - replace with API call
const mockPost: Post = {
  id: '1',
  title: 'How to streamline credentialing workflow?',
  content: `I'm looking for advice on optimizing our credentialing process. We're currently taking about 60 days to complete credentialing for new clinicians, and I'd like to reduce that to under 30 days.

What strategies have worked best for your organization? I'm particularly interested in:
- Document collection workflows
- Verification processes
- Automation opportunities
- Best practices for tracking progress

Any insights would be greatly appreciated!`,
  author: {
    id: '1',
    name: 'Dr. Sarah Chen',
  },
  category: {
    id: '2',
    name: 'Credentialing',
  },
  tags: ['workflow', 'optimization'],
  upvotes: 45,
  downvotes: 2,
  userVote: 'up',
  viewCount: 234,
  replyCount: 12,
  createdAt: '2025-11-15T10:00:00Z',
  isAuthor: false,
  canEdit: false,
  canDelete: false,
  isFollowed: true,
  isBookmarked: false,
  isPinned: true,
  isAnswered: true,
}

const mockComments: Comment[] = [
  {
    id: '1',
    content: 'Great question! We reduced our credentialing time from 75 days to 28 days by implementing an automated document collection system. The key was setting up pre-filled forms and automated reminders.',
    author: {
      id: '2',
      name: 'John Martinez',
    },
    upvotes: 23,
    downvotes: 0,
    userVote: null,
    createdAt: '2025-11-15T11:00:00Z',
    isAuthor: false,
    canEdit: false,
    canDelete: false,
    replies: [
      {
        id: '1-1',
        content: 'Thanks for the insight! What system did you use?',
        author: {
          id: '1',
          name: 'Dr. Sarah Chen',
        },
        upvotes: 5,
        downvotes: 0,
        userVote: null,
        createdAt: '2025-11-15T11:30:00Z',
        isAuthor: true,
        canEdit: true,
        canDelete: true,
      },
    ],
  },
  {
    id: '2',
    content: 'We found that starting verification processes in parallel rather than sequentially saved us about 15 days. Also, having a dedicated credentialing coordinator made a huge difference.',
    author: {
      id: '3',
      name: 'Alex Kim',
    },
    upvotes: 18,
    downvotes: 1,
    userVote: 'up',
    createdAt: '2025-11-15T14:00:00Z',
    isAuthor: false,
    canEdit: false,
    canDelete: false,
  },
]

export default function ThreadViewPage() {
  const params = useParams()
  const router = useRouter()
  const postId = params.postId as string

  const [post, setPost] = useState(mockPost)
  const [comments, setComments] = useState(mockComments)
  const [isReplying, setIsReplying] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showPostEditor, setShowPostEditor] = useState(false)

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const handleVote = (type: 'post' | 'comment', id: string, vote: 'up' | 'down') => {
    if (type === 'post') {
      setPost((prev) => {
        const currentVote = prev.userVote
        let newUpvotes = prev.upvotes
        let newDownvotes = prev.downvotes
        let newUserVote: 'up' | 'down' | null = vote

        // Remove previous vote
        if (currentVote === 'up') newUpvotes--
        if (currentVote === 'down') newDownvotes--

        // Apply new vote
        if (currentVote === vote) {
          // Toggle off
          newUserVote = null
        } else {
          // Apply vote
          if (vote === 'up') newUpvotes++
          else newDownvotes++
        }

        return {
          ...prev,
          upvotes: newUpvotes,
          downvotes: newDownvotes,
          userVote: newUserVote,
        }
      })
    } else {
      setComments((prev) =>
        prev.map((comment) => {
          if (comment.id === id) {
            return updateCommentVote(comment, vote)
          }
          if (comment.replies) {
            return {
              ...comment,
              replies: comment.replies.map((reply) =>
                reply.id === id ? updateCommentVote(reply, vote) : reply
              ),
            }
          }
          return comment
        })
      )
    }
  }

  const updateCommentVote = (comment: Comment, vote: 'up' | 'down'): Comment => {
    const currentVote = comment.userVote
    let newUpvotes = comment.upvotes
    let newDownvotes = comment.downvotes
    let newUserVote: 'up' | 'down' | null = vote

    if (currentVote === 'up') newUpvotes--
    if (currentVote === 'down') newDownvotes--

    if (currentVote === vote) {
      newUserVote = null
    } else {
      if (vote === 'up') newUpvotes++
      else newDownvotes++
    }

    return {
      ...comment,
      upvotes: newUpvotes,
      downvotes: newDownvotes,
      userVote: newUserVote,
    }
  }

  const handleReply = (commentId: string | null) => {
    if (!replyContent.trim()) return

    const newComment: Comment = {
      id: `new-${Date.now()}`,
      content: replyContent,
      author: {
        id: 'current-user',
        name: 'You',
      },
      upvotes: 0,
      downvotes: 0,
      createdAt: new Date().toISOString(),
      isAuthor: true,
      canEdit: true,
      canDelete: true,
    }

    if (commentId) {
      // Reply to comment
      setComments((prev) =>
        prev.map((comment) => {
          if (comment.id === commentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newComment],
            }
          }
          return comment
        })
      )
    } else {
      // Top-level reply
      setComments((prev) => [...prev, newComment])
    }

    setReplyContent('')
    setIsReplying(null)
    setPost((prev) => ({ ...prev, replyCount: prev.replyCount + 1 }))
  }

  const handleEdit = (commentId: string) => {
    const comment = findComment(comments, commentId)
    if (comment) {
      setEditContent(comment.content)
      setIsEditing(commentId)
    }
  }

  const handleSaveEdit = (commentId: string) => {
    if (!editContent.trim()) return

    setComments((prev) =>
      prev.map((comment) => {
        if (comment.id === commentId) {
          return {
            ...comment,
            content: editContent,
            editedAt: new Date().toISOString(),
          }
        }
        if (comment.replies) {
          return {
            ...comment,
            replies: comment.replies.map((reply) =>
              reply.id === commentId
                ? {
                    ...reply,
                    content: editContent,
                    editedAt: new Date().toISOString(),
                  }
                : reply
            ),
          }
        }
        return comment
      })
    )

    setEditContent('')
    setIsEditing(null)
  }

  const handleDelete = (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    setComments((prev) =>
      prev
        .filter((comment) => comment.id !== commentId)
        .map((comment) => ({
          ...comment,
          replies: comment.replies?.filter((reply) => reply.id !== commentId),
        }))
    )

    setPost((prev) => ({ ...prev, replyCount: prev.replyCount - 1 }))
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

  const toggleFollow = () => {
    setPost((prev) => ({ ...prev, isFollowed: !prev.isFollowed }))
  }

  const toggleBookmark = () => {
    setPost((prev) => ({ ...prev, isBookmarked: !prev.isBookmarked }))
  }

  const renderComment = (comment: Comment, depth = 0) => {
    const isEditingThis = isEditing === comment.id

    return (
      <div key={comment.id} className={depth > 0 ? 'ml-8 mt-4' : 'mt-4'}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{comment.author.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatTimeAgo(comment.createdAt)}
                    {comment.editedAt && ' (edited)'}
                  </div>
                </div>
              </div>
              {(comment.canEdit || comment.canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {comment.canEdit && (
                      <DropdownMenuItem onClick={() => handleEdit(comment.id)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {comment.canDelete && (
                      <DropdownMenuItem
                        onClick={() => handleDelete(comment.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isEditingThis ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(comment.id)}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(null)
                      setEditContent('')
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-sm whitespace-pre-wrap mb-4">{comment.content}</div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVote('comment', comment.id, 'up')}
                      className={comment.userVote === 'up' ? 'text-primary' : ''}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <span className="text-sm min-w-[2rem] text-center">
                      {comment.upvotes - comment.downvotes}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVote('comment', comment.id, 'down')}
                      className={comment.userVote === 'down' ? 'text-destructive' : ''}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  {depth < 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsReplying(comment.id)}
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Reply
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Reply form */}
        {isReplying === comment.id && (
          <Card className="mt-4 ml-8">
            <CardContent className="pt-4">
              <Textarea
                placeholder="Write your reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="min-h-[100px] mb-2"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleReply(comment.id)}>
                  Post Reply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsReplying(null)
                    setReplyContent('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        ← Back to Forum
      </Button>

      {/* Post */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {post.isPinned && <Badge variant="default">Pinned</Badge>}
                {post.isAnswered && <Badge variant="secondary">Answered</Badge>}
                <Badge variant="outline">{post.category.name}</Badge>
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
              <CardTitle className="text-2xl mb-2">{post.title}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{post.author.name}</span>
                </div>
                <span>{formatTimeAgo(post.createdAt)}</span>
                {post.editedAt && <span>(edited)</span>}
                <span>{post.viewCount} views</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFollow}
                className={post.isFollowed ? 'text-primary' : ''}
              >
                {post.isFollowed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleBookmark}
                className={post.isBookmarked ? 'text-primary' : ''}
              >
                {post.isBookmarked ? (
                  <BookmarkCheck className="h-4 w-4" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
              <Button variant="ghost" size="icon">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none mb-6 whitespace-pre-wrap">
            {post.content}
          </div>
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote('post', post.id, 'up')}
                className={post.userVote === 'up' ? 'text-primary' : ''}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold min-w-[3rem] text-center">
                {post.upvotes - post.downvotes}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote('post', post.id, 'down')}
                className={post.userVote === 'down' ? 'text-destructive' : ''}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
            {(post.canEdit || post.canDelete) && (
              <div className="flex gap-2">
                {post.canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPostEditor(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Post
                  </Button>
                )}
                {post.canDelete && (
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comments Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">
          {post.replyCount} {post.replyCount === 1 ? 'Reply' : 'Replies'}
        </h2>

        {/* New comment form */}
        {isReplying === null && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Add a Reply</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Write your reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="min-h-[150px] mb-4"
              />
              <Button onClick={() => handleReply(null)}>Post Reply</Button>
            </CardContent>
          </Card>
        )}

        {/* Comments list */}
        <div>{comments.map((comment) => renderComment(comment))}</div>
      </div>

      {/* Post Editor Dialog */}
      {showPostEditor && (
        <PostEditor
          post={{
            id: post.id,
            title: post.title,
            content: post.content,
            tags: post.tags,
            category: post.category,
          }}
          onSave={(data) => {
            setPost({
              ...post,
              title: data.title,
              content: data.content,
              tags: data.tags,
              editedAt: new Date().toISOString(),
            })
            setShowPostEditor(false)
          }}
          onCancel={() => setShowPostEditor(false)}
          mode="edit"
        />
      )}
    </div>
  )
}

