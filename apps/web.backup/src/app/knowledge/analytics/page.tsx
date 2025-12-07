'use client';

/**
 * B243C-KMS-030: KnowledgeBaseAnalyticsDashboard UI
 * Displays article performance metrics: total views, unique readers, average read time, top articles,
 * search queries; includes charts and tables; supports time range filters and CSV download
 */

import { useState } from 'react';
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
  TrendingUp,
  Users,
  Clock,
  Eye,
  Search,
  FileText,
  Download,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import Link from 'next/link';

interface ArticleMetrics {
  id: string;
  title: string;
  slug: string;
  views: number;
  uniqueReaders: number;
  avgReadTime: number;
  completionRate: number;
  likes: number;
  comments: number;
  trend: 'up' | 'down';
  trendPercent: number;
}

interface SearchQuery {
  query: string;
  count: number;
  results: number;
  avgPosition: number;
}

// Mock data - replace with API call
const mockMetrics = {
  totalViews: 45230,
  uniqueReaders: 12340,
  avgReadTime: 4.5,
  totalArticles: 156,
  totalLikes: 1234,
  totalComments: 456,
  viewsChange: 12.5,
  readersChange: 8.3,
};

const mockTopArticles: ArticleMetrics[] = [
  {
    id: '1',
    title: 'Getting Started with Credentials',
    slug: 'getting-started-credentials',
    views: 1250,
    uniqueReaders: 980,
    avgReadTime: 5.2,
    completionRate: 78,
    likes: 42,
    comments: 8,
    trend: 'up',
    trendPercent: 15.3,
  },
  {
    id: '2',
    title: 'API Authentication Guide',
    slug: 'api-authentication',
    views: 980,
    uniqueReaders: 750,
    avgReadTime: 4.8,
    completionRate: 72,
    likes: 35,
    comments: 12,
    trend: 'up',
    trendPercent: 8.7,
  },
  {
    id: '3',
    title: 'Troubleshooting Common Issues',
    slug: 'troubleshooting-common-issues',
    views: 750,
    uniqueReaders: 620,
    avgReadTime: 6.1,
    completionRate: 65,
    likes: 28,
    comments: 15,
    trend: 'down',
    trendPercent: 3.2,
  },
];

const mockSearchQueries: SearchQuery[] = [
  { query: 'authentication', count: 234, results: 12, avgPosition: 2.3 },
  { query: 'credentials setup', count: 189, results: 8, avgPosition: 1.8 },
  { query: 'api error', count: 156, results: 15, avgPosition: 4.2 },
  { query: 'troubleshooting', count: 142, results: 22, avgPosition: 3.1 },
  { query: 'security best practices', count: 128, results: 6, avgPosition: 2.1 },
];

export default function KnowledgeBaseAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const handleExportCSV = () => {
    // In production, generate and download CSV
    const csvContent = 'data:text/csv;charset=utf-8,Article,Views,Readers\n';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `analytics-${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Track performance metrics and insights for your knowledge base
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Total Views
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{formatNumber(mockMetrics.totalViews)}</div>
              <div className="flex items-center gap-1 text-sm text-green-600">
                <ArrowUp className="h-4 w-4" />
                <span>+{mockMetrics.viewsChange}% from last period</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Unique Readers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{formatNumber(mockMetrics.uniqueReaders)}</div>
              <div className="flex items-center gap-1 text-sm text-green-600">
                <ArrowUp className="h-4 w-4" />
                <span>+{mockMetrics.readersChange}% from last period</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Average Read Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{mockMetrics.avgReadTime} min</div>
              <div className="text-sm text-muted-foreground">Per article</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Total Articles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{mockMetrics.totalArticles}</div>
              <div className="text-sm text-muted-foreground">Published articles</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Likes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{formatNumber(mockMetrics.totalLikes)}</div>
              <div className="text-sm text-muted-foreground">User engagement</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Search className="h-4 w-4" />
                Total Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{formatNumber(mockMetrics.totalComments)}</div>
              <div className="text-sm text-muted-foreground">User feedback</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Articles */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Articles</CardTitle>
              <CardDescription>Most viewed articles in the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockTopArticles.map((article, index) => (
                  <div key={article.id} className="border-b last:border-0 pb-4 last:pb-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-muted-foreground">
                            #{index + 1}
                          </span>
                          <Link
                            href={`/knowledge/${article.slug}`}
                            className="font-semibold hover:text-primary"
                          >
                            {article.title}
                          </Link>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{formatNumber(article.views)} views</span>
                          <span>{formatNumber(article.uniqueReaders)} readers</span>
                          <span>{article.avgReadTime} min avg</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {article.trend === 'up' ? (
                          <div className="flex items-center gap-1 text-green-600 text-sm">
                            <ArrowUp className="h-4 w-4" />
                            {article.trendPercent}%
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-600 text-sm">
                            <ArrowDown className="h-4 w-4" />
                            {article.trendPercent}%
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{article.completionRate}% completion</span>
                      <span>{article.likes} likes</span>
                      <span>{article.comments} comments</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Search Queries */}
          <Card>
            <CardHeader>
              <CardTitle>Popular Search Queries</CardTitle>
              <CardDescription>Most searched terms in the knowledge base</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockSearchQueries.map((query, index) => (
                  <div key={index} className="border-b last:border-0 pb-4 last:pb-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-muted-foreground">
                            #{index + 1}
                          </span>
                          <span className="font-semibold">{query.query}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{formatNumber(query.count)} searches</span>
                          <span>{query.results} results</span>
                          <span>Avg position: {query.avgPosition.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Charts Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Views Over Time</CardTitle>
            <CardDescription>Article views trend for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2" />
                <p>Chart visualization would be rendered here</p>
                <p className="text-sm">(Integrate with a charting library like recharts or chart.js)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

