'use client';

/**
 * B243C-KMS-021: KnowledgeBaseHome UI
 * Home page of knowledge base: displays categories, most popular/recent articles, search bar;
 * responsive layout; supports dark mode; includes quick links to FAQs and featured topics
 */

import { useState } from 'react';
import Link from 'next/link';
import { ContentSearch } from '@/components/knowledge/ContentSearch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  TrendingUp,
  Clock,
  HelpCircle,
  ArrowRight,
  Star,
  FileText,
  Tag,
  ChevronRight,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  articleCount: number;
  color: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  views: number;
  publishedAt: string;
  author: {
    name: string;
    avatar?: string;
  };
  featured?: boolean;
}

export default function KnowledgeBaseHome() {
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data - replace with API calls
  const categories: Category[] = [
    {
      id: '1',
      name: 'Getting Started',
      description: 'New to the platform? Start here',
      icon: <BookOpen className="h-5 w-5" />,
      articleCount: 12,
      color: 'bg-blue-500',
    },
    {
      id: '2',
      name: 'API Reference',
      description: 'Complete API documentation',
      icon: <FileText className="h-5 w-5" />,
      articleCount: 45,
      color: 'bg-green-500',
    },
    {
      id: '3',
      name: 'Troubleshooting',
      description: 'Common issues and solutions',
      icon: <HelpCircle className="h-5 w-5" />,
      articleCount: 28,
      color: 'bg-orange-500',
    },
    {
      id: '4',
      name: 'Best Practices',
      description: 'Tips and recommendations',
      icon: <Star className="h-5 w-5" />,
      articleCount: 19,
      color: 'bg-purple-500',
    },
    {
      id: '5',
      name: 'FAQs',
      description: 'Frequently asked questions',
      icon: <HelpCircle className="h-5 w-5" />,
      articleCount: 35,
      color: 'bg-pink-500',
    },
    {
      id: '6',
      name: 'Guides',
      description: 'Step-by-step tutorials',
      icon: <BookOpen className="h-5 w-5" />,
      articleCount: 22,
      color: 'bg-indigo-500',
    },
  ];

  const popularArticles: Article[] = [
    {
      id: '1',
      title: 'Getting Started with Credentials',
      slug: 'getting-started-credentials',
      excerpt: 'Learn how to set up and manage credentials in the platform...',
      category: 'Getting Started',
      tags: ['credentials', 'setup'],
      views: 1250,
      publishedAt: '2024-01-15',
      author: { name: 'John Doe' },
      featured: true,
    },
    {
      id: '2',
      title: 'API Authentication Guide',
      slug: 'api-authentication',
      excerpt: 'Complete guide to authenticating API requests...',
      category: 'API Reference',
      tags: ['api', 'authentication'],
      views: 980,
      publishedAt: '2024-01-10',
      author: { name: 'Jane Smith' },
    },
    {
      id: '3',
      title: 'Troubleshooting Common Issues',
      slug: 'troubleshooting-common-issues',
      excerpt: 'Solutions to the most common problems users encounter...',
      category: 'Troubleshooting',
      tags: ['troubleshooting', 'help'],
      views: 750,
      publishedAt: '2024-01-08',
      author: { name: 'Mike Johnson' },
    },
  ];

  const recentArticles: Article[] = [
    {
      id: '4',
      title: 'New Feature: Enhanced Security',
      slug: 'new-feature-enhanced-security',
      excerpt: 'Learn about the latest security enhancements...',
      category: 'Best Practices',
      tags: ['security', 'features'],
      views: 320,
      publishedAt: '2024-01-20',
      author: { name: 'Sarah Williams' },
    },
    {
      id: '5',
      title: 'Best Practices for Credential Management',
      slug: 'best-practices-credential-management',
      excerpt: 'Tips for effectively managing credentials...',
      category: 'Best Practices',
      tags: ['credentials', 'management'],
      views: 450,
      publishedAt: '2024-01-18',
      author: { name: 'David Brown' },
    },
    {
      id: '6',
      title: 'API Rate Limiting Explained',
      slug: 'api-rate-limiting-explained',
      excerpt: 'Understanding rate limits and how to handle them...',
      category: 'API Reference',
      tags: ['api', 'rate-limiting'],
      views: 280,
      publishedAt: '2024-01-16',
      author: { name: 'Emily Davis' },
    },
  ];

  const featuredTopics = [
    { name: 'Authentication', slug: 'category/authentication', count: 15 },
    { name: 'Credentials', slug: 'category/credentials', count: 23 },
    { name: 'Security', slug: 'category/security', count: 18 },
    { name: 'API Integration', slug: 'category/api-integration', count: 12 },
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="border-b bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Knowledge Base</h1>
            </div>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Find answers, guides, and documentation to help you get the most out of the platform
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mt-8">
              <ContentSearch
                onSearch={(query) => setSearchQuery(query)}
                placeholder="Search articles, guides, and documentation..."
              />
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-sm">
              <span className="text-muted-foreground">Quick links:</span>
              <Link
                href="/knowledge/category/faqs"
                className="text-primary hover:underline flex items-center gap-1"
              >
                <HelpCircle className="h-4 w-4" />
                FAQs
              </Link>
              <Link
                href="/knowledge/editor/new"
                className="text-primary hover:underline flex items-center gap-1"
              >
                <FileText className="h-4 w-4" />
                Create Article
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Categories Grid */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold">Browse by Category</h2>
            <Button variant="ghost" asChild>
              <Link href="/knowledge/categories">
                View All
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <Link key={category.id} href={`/knowledge/category/${category.id}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`p-2 rounded-lg ${category.color} text-white`}>
                        {category.icon}
                      </div>
                      <Badge variant="secondary">{category.articleCount} articles</Badge>
                    </div>
                    <CardTitle className="mt-4 group-hover:text-primary transition-colors">
                      {category.name}
                    </CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" size="sm" className="w-full justify-start group-hover:justify-end transition-all">
                      Explore
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Popular and Recent Articles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Popular Articles */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold">Most Popular</h2>
            </div>
            <div className="space-y-4">
              {popularArticles.map((article) => (
                <Link key={article.id} href={`/knowledge/${article.slug}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg group-hover:text-primary transition-colors">
                              {article.title}
                            </CardTitle>
                            {article.featured && (
                              <Badge variant="default" className="gap-1">
                                <Star className="h-3 w-3" />
                                Featured
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="line-clamp-2">{article.excerpt}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span>{article.views} views</span>
                          <span>{formatDate(article.publishedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{article.category}</Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {article.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent Articles */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold">Recently Published</h2>
            </div>
            <div className="space-y-4">
              {recentArticles.map((article) => (
                <Link key={article.id} href={`/knowledge/${article.slug}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">
                            {article.title}
                          </CardTitle>
                          <CardDescription className="line-clamp-2 mt-2">
                            {article.excerpt}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span>By {article.author.name}</span>
                          <span>{formatDate(article.publishedAt)}</span>
                        </div>
                        <Badge variant="outline">{article.category}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {article.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Featured Topics */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Featured Topics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredTopics.map((topic) => (
              <Link key={topic.slug} href={`/knowledge/${topic.slug}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer text-center">
                  <CardHeader>
                    <CardTitle className="text-lg">{topic.name}</CardTitle>
                    <CardDescription>{topic.count} articles</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

