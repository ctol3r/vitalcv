'use client';

/**
 * B243C-KMS-026: AuthorDashboard UI
 * Shows author's drafts, published articles, pending reviews, assigned comments; includes quick
 * actions (edit, submit for approval, view analytics); uses pagination and filtering
 */

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Edit,
  Send,
  Eye,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Filter,
} from 'lucide-react';

interface Article {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'pending' | 'published' | 'rejected';
  category: string;
  views: number;
  likes: number;
  comments: number;
  updatedAt: string;
  submittedAt?: string;
  reviewer?: string;
  feedback?: string;
}

// Mock data - replace with API call
const mockArticles: Article[] = [
  {
    id: '1',
    title: 'Getting Started with Credentials',
    slug: 'getting-started-credentials',
    status: 'published',
    category: 'Getting Started',
    views: 1250,
    likes: 42,
    comments: 8,
    updatedAt: '2024-01-20T14:30:00Z',
  },
  {
    id: '2',
    title: 'Advanced API Configuration',
    slug: 'advanced-api-config',
    status: 'pending',
    category: 'API Reference',
    views: 0,
    likes: 0,
    comments: 2,
    updatedAt: '2024-01-19T10:00:00Z',
    submittedAt: '2024-01-19T10:00:00Z',
    reviewer: 'Jane Smith',
    feedback: 'Please add more code examples in section 3.',
  },
  {
    id: '3',
    title: 'Troubleshooting Guide',
    slug: 'troubleshooting-guide',
    status: 'draft',
    category: 'Troubleshooting',
    views: 0,
    likes: 0,
    comments: 0,
    updatedAt: '2024-01-18T16:45:00Z',
  },
  {
    id: '4',
    title: 'Security Best Practices',
    slug: 'security-best-practices',
    status: 'rejected',
    category: 'Best Practices',
    views: 0,
    likes: 0,
    comments: 1,
    updatedAt: '2024-01-15T09:00:00Z',
    reviewer: 'Mike Johnson',
    feedback: 'Content needs more depth and examples.',
  },
];

const mockStats = {
  totalArticles: 12,
  published: 8,
  pending: 2,
  drafts: 2,
  totalViews: 15420,
  totalLikes: 342,
  totalComments: 45,
};

export default function AuthorDashboard() {
  const [articles, setArticles] = useState<Article[]>(mockArticles);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} days ago`;
    return formatDate(dateString);
  };

  const getStatusBadge = (status: Article['status']) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500">Published</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pending Review</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
    }
  };

  const filteredArticles = articles.filter((article) => {
    const matchesStatus = statusFilter === 'all' || article.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || article.category === categoryFilter;
    return matchesStatus && matchesCategory;
  });

  const categories = Array.from(new Set(articles.map((a) => a.category)));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Author Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your articles, track performance, and respond to feedback
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Articles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.totalArticles}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{mockStats.published}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.totalViews.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Likes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.totalLikes}</div>
            </CardContent>
          </Card>
        </div>

        {/* Articles Tabs */}
        <Tabs defaultValue="all" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all" onClick={() => setStatusFilter('all')}>
                All ({articles.length})
              </TabsTrigger>
              <TabsTrigger value="published" onClick={() => setStatusFilter('published')}>
                Published ({mockStats.published})
              </TabsTrigger>
              <TabsTrigger value="pending" onClick={() => setStatusFilter('pending')}>
                Pending ({mockStats.pending})
              </TabsTrigger>
              <TabsTrigger value="drafts" onClick={() => setStatusFilter('draft')}>
                Drafts ({mockStats.drafts})
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button asChild>
                <Link href="/knowledge/editor/new">
                  <FileText className="h-4 w-4 mr-2" />
                  New Article
                </Link>
              </Button>
            </div>
          </div>

          {/* Articles List */}
          <div className="space-y-4">
            {filteredArticles.map((article) => (
              <Card key={article.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl">{article.title}</CardTitle>
                        {getStatusBadge(article.status)}
                      </div>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Updated {formatRelativeTime(article.updatedAt)}
                        </span>
                        <Badge variant="outline">{article.category}</Badge>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {article.views} views
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        {article.likes} likes
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        {article.comments} comments
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {article.status === 'draft' && (
                        <>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/knowledge/editor/${article.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </Button>
                          <Button size="sm" asChild>
                            <Link href={`/knowledge/editor/${article.id}`}>
                              <Send className="h-4 w-4 mr-2" />
                              Submit
                            </Link>
                          </Button>
                        </>
                      )}
                      {article.status === 'pending' && (
                        <>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/knowledge/editor/${article.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </Button>
                          {article.feedback && (
                            <div className="text-sm text-muted-foreground max-w-xs">
                              <strong>Feedback:</strong> {article.feedback}
                            </div>
                          )}
                        </>
                      )}
                      {article.status === 'published' && (
                        <>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/knowledge/${article.slug}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/knowledge/editor/${article.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </Button>
                        </>
                      )}
                      {article.status === 'rejected' && (
                        <>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/knowledge/editor/${article.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Revise
                            </Link>
                          </Button>
                          {article.feedback && (
                            <div className="text-sm text-destructive max-w-xs">
                              <strong>Rejection reason:</strong> {article.feedback}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredArticles.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No articles found</h3>
                <p className="text-muted-foreground mb-4">
                  {statusFilter !== 'all'
                    ? `No articles with status "${statusFilter}"`
                    : 'Create your first article to get started'}
                </p>
                <Button asChild>
                  <Link href="/knowledge/editor/new">
                    <FileText className="h-4 w-4 mr-2" />
                    Create Article
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </Tabs>
      </div>
    </div>
  );
}

