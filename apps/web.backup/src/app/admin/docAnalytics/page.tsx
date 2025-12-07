'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Eye, Download, Edit, Users, Calendar } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AccessibleDataTable, TableColumn } from '@/components/accessibility/AccessibleDataTable'

// Types
interface AnalyticsData {
  totalViews: number
  totalEdits: number
  totalDownloads: number
  totalUsers: number
  viewsByCategory: Array<{ category: string; count: number }>
  topDocuments: Array<{
    id: string
    title: string
    views: number
    edits: number
    downloads: number
    category: string
  }>
  viewsOverTime: Array<{ date: string; views: number }>
}

// Mock data - replace with API call
const mockAnalytics: AnalyticsData = {
  totalViews: 1245,
  totalEdits: 89,
  totalDownloads: 234,
  totalUsers: 156,
  viewsByCategory: [
    { category: 'Clinical', count: 456 },
    { category: 'Compliance', count: 389 },
    { category: 'Training', count: 234 },
    { category: 'Policy', count: 166 },
  ],
  topDocuments: [
    {
      id: '1',
      title: 'Clinical Guidelines 2024',
      views: 245,
      edits: 3,
      downloads: 12,
      category: 'Clinical',
    },
    {
      id: '2',
      title: 'Compliance Policy Update',
      views: 189,
      edits: 2,
      downloads: 8,
      category: 'Compliance',
    },
    {
      id: '3',
      title: 'Training Manual Draft',
      views: 156,
      edits: 5,
      downloads: 15,
      category: 'Training',
    },
  ],
  viewsOverTime: [
    { date: '2024-01-01', views: 45 },
    { date: '2024-01-02', views: 52 },
    { date: '2024-01-03', views: 48 },
    { date: '2024-01-04', views: 61 },
    { date: '2024-01-05', views: 55 },
  ],
}

export default function DocumentAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [timeRange, setTimeRange] = useState('30d')

  useEffect(() => {
    // In a real app, fetch analytics
    // const fetchAnalytics = async () => {
    //   const response = await fetch(`/api/admin/docAnalytics?range=${timeRange}`)
    //   const data = await response.json()
    //   setAnalytics(data)
    // }
    // fetchAnalytics()
    setAnalytics(mockAnalytics)
  }, [timeRange])

  if (!analytics) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading analytics...</p>
      </div>
    )
  }

  const columns: TableColumn<typeof analytics.topDocuments[0]>[] = [
    {
      id: 'title',
      header: 'Document',
      accessor: (doc) => doc.title,
      sortable: true,
    },
    {
      id: 'category',
      header: 'Category',
      accessor: (doc) => <Badge variant="outline">{doc.category}</Badge>,
      sortable: true,
    },
    {
      id: 'views',
      header: 'Views',
      accessor: (doc) => (
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          {doc.views}
        </div>
      ),
      sortable: true,
    },
    {
      id: 'edits',
      header: 'Edits',
      accessor: (doc) => (
        <div className="flex items-center gap-2">
          <Edit className="h-4 w-4 text-muted-foreground" />
          {doc.edits}
        </div>
      ),
      sortable: true,
    },
    {
      id: 'downloads',
      header: 'Downloads',
      accessor: (doc) => (
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          {doc.downloads}
        </div>
      ),
      sortable: true,
    },
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Document Analytics</h1>
          <p className="text-muted-foreground mt-1">
            View engagement metrics and usage statistics
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]" aria-label="Select time range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all documents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Edits</CardTitle>
            <Edit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalEdits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Document modifications</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalDownloads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Document downloads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Users engaged</p>
          </CardContent>
        </Card>
      </div>

      {/* Views by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Views by Category</CardTitle>
          <CardDescription>Document views grouped by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.viewsByCategory.map((item) => {
              const maxCount = Math.max(...analytics.viewsByCategory.map((i) => i.count))
              const percentage = (item.count / maxCount) * 100

              return (
                <div key={item.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.category}</span>
                    <span className="text-sm text-muted-foreground">{item.count} views</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                      role="progressbar"
                      aria-valuenow={item.count}
                      aria-valuemin={0}
                      aria-valuemax={maxCount}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Top Documents</CardTitle>
          <CardDescription>Most viewed and engaged documents</CardDescription>
        </CardHeader>
        <CardContent>
          <AccessibleDataTable
            data={analytics.topDocuments}
            columns={columns}
            caption="Top documents by engagement metrics"
            filterable={true}
            filterPlaceholder="Filter documents..."
          />
        </CardContent>
      </Card>

      {/* Views Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Views Over Time</CardTitle>
          <CardDescription>Document views trend for selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analytics.viewsOverTime.map((item) => {
              const maxViews = Math.max(...analytics.viewsOverTime.map((i) => i.views))
              const percentage = (item.views / maxViews) * 100

              return (
                <div key={item.date} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-muted-foreground">
                    {new Date(item.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all flex items-center justify-end pr-2"
                        style={{ width: `${percentage}%` }}
                        role="progressbar"
                        aria-valuenow={item.views}
                        aria-valuemin={0}
                        aria-valuemax={maxViews}
                      >
                        <span className="text-xs text-primary-foreground font-medium">
                          {item.views}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

