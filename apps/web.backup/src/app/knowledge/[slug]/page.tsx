'use client';

/**
 * B243C-KMS-022: ArticleDetailPage UI
 * Renders article content with headings, code blocks, tables, images; displays author info,
 * publication date, related articles; supports comments and feedback; mobile-friendly
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  User,
  Calendar,
  Clock,
  Tag,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Share2,
  Bookmark,
  ChevronRight,
  ArrowLeft,
  Code,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock article data - replace with API call
const mockArticle = {
  id: '1',
  title: 'Getting Started with Credentials',
  slug: 'getting-started-credentials',
  content: `
# Getting Started with Credentials

Welcome to the credential management system! This guide will help you get started with creating and managing credentials.

## Overview

Credentials are digital certificates that verify your identity and qualifications. They are stored securely and can be shared with authorized parties.

## Prerequisites

Before you begin, make sure you have:

- An active account
- Required documentation
- Access to the platform

## Step 1: Create Your First Credential

To create a credential, follow these steps:

\`\`\`javascript
const credential = {
  type: 'professional',
  issuer: 'platform',
  subject: 'user-id',
  claims: {
    name: 'John Doe',
    qualification: 'MD'
  }
};
\`\`\`

## Step 2: Verify Your Credential

Once created, your credential will be verified automatically. You can check the status in your dashboard.

## Best Practices

| Practice | Description | Priority |
|----------|-------------|----------|
| Regular Updates | Keep credentials current | High |
| Secure Storage | Use encrypted storage | High |
| Backup | Maintain backups | Medium |

## Images

![Credential Example](/images/credential-example.png)

## Conclusion

This guide covered the basics of credential management. For more advanced topics, see our [Advanced Guide](/knowledge/advanced-credentials).
  `,
  category: 'Getting Started',
  tags: ['credentials', 'setup', 'tutorial'],
  author: {
    id: '1',
    name: 'John Doe',
    avatar: '/avatars/john-doe.jpg',
    bio: 'Senior Developer and Platform Expert',
  },
  publishedAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-20T14:30:00Z',
  readTime: 5,
  views: 1250,
  likes: 42,
  dislikes: 2,
  comments: [
    {
      id: '1',
      author: { name: 'Jane Smith', avatar: '/avatars/jane-smith.jpg' },
      content: 'Great article! Very helpful for beginners.',
      createdAt: '2024-01-16T09:00:00Z',
      likes: 5,
    },
    {
      id: '2',
      author: { name: 'Mike Johnson', avatar: '/avatars/mike-johnson.jpg' },
      content: 'Could you add more examples for advanced use cases?',
      createdAt: '2024-01-17T11:00:00Z',
      likes: 2,
    },
  ],
  relatedArticles: [
    {
      id: '2',
      title: 'Advanced Credential Management',
      slug: 'advanced-credentials',
      excerpt: 'Learn advanced techniques for managing credentials...',
      category: 'Best Practices',
    },
    {
      id: '3',
      title: 'API Authentication Guide',
      slug: 'api-authentication',
      excerpt: 'Complete guide to authenticating API requests...',
      category: 'API Reference',
    },
  ],
};

export default function ArticleDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [comment, setComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showComments, setShowComments] = useState(true);

  // In a real app, fetch article by slug
  const article = mockArticle;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return formatDate(dateString);
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    if (isDisliked) setIsDisliked(false);
  };

  const handleDislike = () => {
    setIsDisliked(!isDisliked);
    if (isLiked) setIsLiked(false);
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    // Handle comment submission
    setComment('');
  };

  // Simple markdown renderer (in production, use a proper markdown library)
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = '';

    lines.forEach((line, index) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End code block
          elements.push(
            <pre key={`code-${index}`} className="bg-muted p-4 rounded-lg overflow-x-auto">
              <code className="text-sm">{codeBlockContent.join('\n')}</code>
            </pre>
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          // Start code block
          codeBlockLanguage = line.slice(3).trim();
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={index} className="text-3xl font-bold mt-8 mb-4">
            {line.slice(2)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-2xl font-semibold mt-6 mb-3">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-xl font-semibold mt-4 mb-2">
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith('|')) {
        // Table row
        const cells = line.split('|').filter((cell) => cell.trim());
        if (cells.length > 0) {
          elements.push(
            <tr key={index} className="border-b">
              {cells.map((cell, i) => (
                <td key={i} className="px-4 py-2">
                  {cell.trim()}
                </td>
              ))}
            </tr>
          );
        }
      } else if (line.trim() === '') {
        elements.push(<br key={index} />);
      } else if (line.startsWith('![')) {
        // Image
        const match = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        if (match) {
          elements.push(
            <div key={index} className="my-6">
              <img
                src={match[2]}
                alt={match[1]}
                className="rounded-lg w-full max-w-2xl mx-auto"
              />
            </div>
          );
        }
      } else {
        // Regular paragraph
        const processedLine = line
          .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline">$1</a>');
        elements.push(
          <p
            key={index}
            className="mb-4 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: processedLine }}
          />
        );
      }
    });

    return elements;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/knowledge" className="hover:text-foreground">
            Knowledge Base
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/knowledge/category/${article.category.toLowerCase().replace(/\s+/g, '-')}`} className="hover:text-foreground">
            {article.category}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{article.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <article className="lg:col-span-2">
            {/* Article Header */}
            <div className="mb-6">
              <Link
                href="/knowledge"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Knowledge Base
              </Link>
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{article.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{article.author.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(article.publishedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{article.readTime} min read</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{article.views} views</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <Badge variant="outline">{article.category}</Badge>
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Article Content */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  {renderContent(article.content)}
                </div>
              </CardContent>
            </Card>

            {/* Article Actions */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <Button
                variant={isLiked ? 'default' : 'outline'}
                size="sm"
                onClick={handleLike}
                className="gap-2"
              >
                <ThumbsUp className="h-4 w-4" />
                {article.likes + (isLiked ? 1 : 0)}
              </Button>
              <Button
                variant={isDisliked ? 'destructive' : 'outline'}
                size="sm"
                onClick={handleDislike}
                className="gap-2"
              >
                <ThumbsDown className="h-4 w-4" />
                {article.dislikes + (isDisliked ? 1 : 0)}
              </Button>
              <Button
                variant={isBookmarked ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsBookmarked(!isBookmarked)}
                className="gap-2"
              >
                <Bookmark className="h-4 w-4" />
                {isBookmarked ? 'Saved' : 'Save'}
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>

            {/* Comments Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Comments ({article.comments.length})
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowComments(!showComments)}
                  >
                    {showComments ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardHeader>
              {showComments && (
                <CardContent className="space-y-6">
                  {/* Comment Form */}
                  <form onSubmit={handleSubmitComment} className="space-y-4">
                    <Textarea
                      placeholder="Add a comment..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                    />
                    <Button type="submit" disabled={!comment.trim()}>
                      Post Comment
                    </Button>
                  </form>

                  {/* Comments List */}
                  <div className="space-y-4">
                    {article.comments.map((comment) => (
                      <div key={comment.id} className="border-b pb-4 last:border-0">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{comment.author.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {formatRelativeTime(comment.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm mb-2">{comment.content}</p>
                            <div className="flex items-center gap-4">
                              <Button variant="ghost" size="sm" className="h-8 gap-1">
                                <ThumbsUp className="h-3 w-3" />
                                {comment.likes}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8">
                                Reply
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Author Info */}
              <Card>
                <CardHeader>
                  <CardTitle>About the Author</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">{article.author.name}</div>
                      <div className="text-sm text-muted-foreground">{article.author.bio}</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    View Profile
                  </Button>
                </CardContent>
              </Card>

              {/* Related Articles */}
              <Card>
                <CardHeader>
                  <CardTitle>Related Articles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {article.relatedArticles.map((related) => (
                    <Link
                      key={related.id}
                      href={`/knowledge/${related.slug}`}
                      className="block group"
                    >
                      <div className="space-y-1">
                        <div className="font-medium group-hover:text-primary transition-colors">
                          {related.title}
                        </div>
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {related.excerpt}
                        </div>
                        <Badge variant="outline" className="text-xs mt-2">
                          {related.category}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>

              {/* Article Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Article Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Published</span>
                    <span>{formatDate(article.publishedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span>{formatDate(article.updatedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Views</span>
                    <span>{article.views}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

