'use client';

/**
 * B243C-KMS-023: CategoryPage UI
 * Lists all articles within a selected category; shows article summaries and tags;
 * supports sorting by date or popularity; includes breadcrumb navigation
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  ChevronRight,
  Calendar,
  TrendingUp,
  Tag,
  User,
  Clock,
  Search,
} from 'lucide-react';
import { ContentSearch } from '@/components/knowledge/ContentSearch';

// Mock data - replace with API call
const mockCategory = {
  id: '1',
  name: 'Getting Started',
  description: 'New to the platform? Start here with our comprehensive guides and tutorials.',
  articleCount: 12,
};

const mockArticles = [
  {
    id: '1',
    title: 'Getting Started with Credentials',
    slug: 'getting-started-credentials',
    excerpt: 'Learn how to set up and manage credentials in the platform. This comprehensive guide covers everything from initial setup to advanced configuration.',
    category: 'Getting Started',
    tags: ['credentials', 'setup', 'tutorial'],
    author: { name: 'John Doe' },
    publishedAt: '2024-01-15T10:00:00Z',
    views: 1250,
    readTime: 5,
  },
  {
    id: '2',
    title: 'Understanding the Dashboard',
    slug: 'understanding-dashboard',
    excerpt: 'Navigate the dashboard with confidence. Learn about all the features and how to customize your workspace.',
    category: 'Getting Started',
    tags: ['dashboard', 'navigation'],
    author: { name: 'Jane Smith' },
    publishedAt: '2024-01-10T09:00:00Z',
    views: 980,
    readTime: 3,
  },
  {
    id: '3',
    title: 'First Steps: Account Setup',
    slug: 'first-steps-account-setup',
    excerpt: 'Complete guide to setting up your account, including verification steps and security best practices.',
    category: 'Getting Started',
    tags: ['account', 'setup', 'security'],
    author: { name: 'Mike Johnson' },
    publishedAt: '2024-01-08T14:00:00Z',
    views: 750,
    readTime: 4,
  },
  {
    id: '4',
    title: 'Quick Start Guide',
    slug: 'quick-start-guide',
    excerpt: 'Get up and running in minutes with this quick start guide. Perfect for users who want to dive right in.',
    category: 'Getting Started',
    tags: ['quick-start', 'tutorial'],
    author: { name: 'Sarah Williams' },
    publishedAt: '2024-01-05T11:00:00Z',
    views: 650,
    readTime: 2,
  },
];

type SortOption = 'date-desc' | 'date-asc' | 'popularity-desc' | 'popularity-asc';

export default function CategoryPage() {
  const params = useParams();
  const categoryId = params?.categoryId as string;
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [searchQuery, setSearchQuery] = useState('');

  // In a real app, fetch category and articles by categoryId
  const category = mockCategory;
  const articles = mockArticles;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const sortedArticles = [...articles].sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      case 'date-asc':
        return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      case 'popularity-desc':
        return b.views - a.views;
      case 'popularity-asc':
        return a.views - b.views;
      default:
        return 0;
    }
  });

  const filteredArticles = sortedArticles.filter((article) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      article.title.toLowerCase().includes(query) ||
      article.excerpt.toLowerCase().includes(query) ||
      article.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/knowledge" className="hover:text-foreground">
            Knowledge Base
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{category.name}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Knowledge Base
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{category.name}</h1>
          <p className="text-lg text-muted-foreground mb-4">{category.description}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{category.articleCount} articles</span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <ContentSearch
            onSearch={(query) => setSearchQuery(query)}
            placeholder={`Search articles in ${category.name}...`}
          />
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''} found
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm text-muted-foreground">
                Sort by:
              </label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger id="sort" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Newest First
                    </div>
                  </SelectItem>
                  <SelectItem value="date-asc">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Oldest First
                    </div>
                  </SelectItem>
                  <SelectItem value="popularity-desc">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Most Popular
                    </div>
                  </SelectItem>
                  <SelectItem value="popularity-asc">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Least Popular
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Articles Grid */}
        {filteredArticles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredArticles.map((article) => (
              <Link key={article.id} href={`/knowledge/${article.slug}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-2">
                        {article.title}
                      </CardTitle>
                    </div>
                    <CardDescription className="line-clamp-3">{article.excerpt}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {article.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs gap-1">
                          <Tag className="h-3 w-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{article.author.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(article.publishedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{article.readTime} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>{article.views} views</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No articles found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? `No articles match "${searchQuery}" in this category.`
                  : 'No articles available in this category yet.'}
              </p>
              {searchQuery && (
                <Button variant="outline" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

