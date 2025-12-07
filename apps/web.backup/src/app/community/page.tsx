'use client'

/**
 * B234C-COMM-011: ForumHomePage UI
 *
 * Displays list of ForumCategories and top posts; allows quick search and filter by tags;
 * shows trending discussions and unanswered questions
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  TrendingUp,
  MessageSquare,
  Clock,
  User,
  ArrowUp,
  Tag,
  Filter,
  X,
} from 'lucide-react'

// Mock data types - replace with actual API types
interface ForumCategory {
  id: string
  name: string
  description: string
  postCount: number
  icon?: string
}

interface ForumPost {
  id: string
  title: string
  excerpt: string
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
  replyCount: number
  viewCount: number
  upvotes: number
  createdAt: string
  lastActivityAt: string
  isAnswered?: boolean
  isPinned?: boolean
}

// Mock data - replace with actual API calls
const mockCategories: ForumCategory[] = [
  {
    id: '1',
    name: 'General Discussion',
    description: 'General topics and questions',
    postCount: 234,
  },
  {
    id: '2',
    name: 'Credentialing',
    description: 'Questions about credentialing processes',
    postCount: 156,
  },
  {
    id: '3',
    name: 'Best Practices',
    description: 'Share and learn best practices',
    postCount: 89,
  },
  {
    id: '4',
    name: 'Technical Support',
    description: 'Get help with technical issues',
    postCount: 67,
  },
]

const mockPosts: ForumPost[] = [
  {
    id: '1',
    title: 'How to streamline credentialing workflow?',
    excerpt: 'Looking for advice on optimizing our credentialing process...',
    author: { id: '1', name: 'Dr. Sarah Chen' },
    category: { id: '2', name: 'Credentialing' },
    tags: ['workflow', 'optimization'],
    replyCount: 12,
    viewCount: 234,
    upvotes: 45,
    createdAt: '2025-11-15T10:00:00Z',
    lastActivityAt: '2025-11-16T08:30:00Z',
    isAnswered: true,
    isPinned: true,
  },
  {
    id: '2',
    title: 'Best practices for document verification',
    excerpt: 'What documents should be verified first?',
    author: { id: '2', name: 'John Martinez' },
    category: { id: '2', name: 'Credentialing' },
    tags: ['verification', 'documents'],
    replyCount: 8,
    viewCount: 189,
    upvotes: 32,
    createdAt: '2025-11-15T14:00:00Z',
    lastActivityAt: '2025-11-16T09:15:00Z',
    isAnswered: false,
  },
  {
    id: '3',
    title: 'API integration question',
    excerpt: 'Having trouble with the webhook endpoints...',
    author: { id: '3', name: 'Alex Kim' },
    category: { id: '4', name: 'Technical Support' },
    tags: ['api', 'webhooks'],
    replyCount: 5,
    viewCount: 156,
    upvotes: 18,
    createdAt: '2025-11-16T07:00:00Z',
    lastActivityAt: '2025-11-16T09:00:00Z',
    isAnswered: false,
  },
]

const allTags = ['workflow', 'optimization', 'verification', 'documents', 'api', 'webhooks', 'best-practices']

export default function ForumHomePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Filter posts based on search, tags, and category
  const filteredPosts = useMemo(() => {
    return mockPosts.filter((post) => {
      const matchesSearch =
        searchQuery === '' ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((tag) => post.tags.includes(tag))

      const matchesCategory =
        selectedCategory === null || post.category.id === selectedCategory

      return matchesSearch && matchesTags && matchesCategory
    })
  }, [searchQuery, selectedTags, selectedCategory])

  const trendingPosts = useMemo(() => {
    return [...mockPosts]
      .sort((a, b) => b.upvotes - a.upvotes)
      .slice(0, 5)
  }, [])

  const unansweredPosts = useMemo(() => {
    return mockPosts.filter((post) => !post.isAnswered)
  }, [])

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

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

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Community Forum</h1>
        <p className="text-muted-foreground">
          Connect, share knowledge, and get help from the community
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search posts, questions, discussions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter by tags:</span>
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleTag(tag)}
            >
              {tag}
              {selectedTags.includes(tag) && (
                <X className="ml-1 h-3 w-3" />
              )}
            </Badge>
          ))}
          {selectedTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTags([])}
              className="text-xs"
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Categories */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant={selectedCategory === null ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setSelectedCategory(null)}
              >
                All Categories
              </Button>
              {mockCategories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{category.name}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {category.postCount}
                    </Badge>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All Posts</TabsTrigger>
              <TabsTrigger value="trending">
                <TrendingUp className="h-4 w-4 mr-2" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="unanswered">
                <MessageSquare className="h-4 w-4 mr-2" />
                Unanswered
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="space-y-4">
                {filteredPosts.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      No posts found matching your criteria
                    </CardContent>
                  </Card>
                ) : (
                  filteredPosts.map((post) => (
                    <Card
                      key={post.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <Link href={`/community/posts/${post.id}`}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {post.isPinned && (
                                  <Badge variant="default">Pinned</Badge>
                                )}
                                {post.isAnswered && (
                                  <Badge variant="secondary">Answered</Badge>
                                )}
                                <Badge variant="outline">{post.category.name}</Badge>
                              </div>
                              <CardTitle className="text-xl mb-2">{post.title}</CardTitle>
                              <CardDescription className="line-clamp-2">
                                {post.excerpt}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                <span>{post.author.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageSquare className="h-4 w-4" />
                                <span>{post.replyCount} replies</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{formatTimeAgo(post.lastActivityAt)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-sm">
                                <ArrowUp className="h-4 w-4" />
                                <span>{post.upvotes}</span>
                              </div>
                              <div className="flex gap-1">
                                {post.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    <Tag className="h-3 w-3 mr-1" />
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="trending" className="mt-6">
              <div className="space-y-4">
                {trendingPosts.map((post) => (
                  <Card
                    key={post.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <Link href={`/community/posts/${post.id}`}>
                      <CardHeader>
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <Badge variant="outline">{post.category.name}</Badge>
                        </div>
                        <CardTitle className="text-xl mb-2">{post.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {post.excerpt}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{post.author.name}</span>
                            <span>{post.replyCount} replies</span>
                            <span>{formatTimeAgo(post.lastActivityAt)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                            <ArrowUp className="h-4 w-4" />
                            <span>{post.upvotes} upvotes</span>
                          </div>
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="unanswered" className="mt-6">
              <div className="space-y-4">
                {unansweredPosts.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      All questions have been answered! 🎉
                    </CardContent>
                  </Card>
                ) : (
                  unansweredPosts.map((post) => (
                    <Card
                      key={post.id}
                      className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary"
                    >
                      <Link href={`/community/posts/${post.id}`}>
                        <CardHeader>
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            <Badge variant="outline">{post.category.name}</Badge>
                          </div>
                          <CardTitle className="text-xl mb-2">{post.title}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {post.excerpt}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{post.author.name}</span>
                              <span>{post.replyCount} replies</span>
                              <span>{formatTimeAgo(post.createdAt)}</span>
                            </div>
                            <Button variant="outline" size="sm">
                              Answer Question
                            </Button>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

