'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, TrendingDown, Filter } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'

interface VendorRisk {
  vendorId: string
  vendorName: string
  category: string
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  trend: 'up' | 'down' | 'stable'
  alerts: number
  lastUpdated: string
}

interface RiskCategory {
  id: string
  name: string
  count: number
  averageRisk: number
}

interface RiskTrend {
  date: string
  averageRisk: number
  lowRisk: number
  mediumRisk: number
  highRisk: number
  criticalRisk: number
}

export default function VendorRiskDashboardPage() {
  const [vendors, setVendors] = useState<VendorRisk[]>([])
  const [categories, setCategories] = useState<RiskCategory[]>([])
  const [riskTrends, setRiskTrends] = useState<RiskTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all')

  useEffect(() => {
    fetchRiskData()
  }, [selectedCategory, selectedRiskLevel])

  async function fetchRiskData() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') params.append('category', selectedCategory)
      if (selectedRiskLevel !== 'all') params.append('riskLevel', selectedRiskLevel)

      const response = await fetch(`/api/demo/vendor-risk/dashboard?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch risk data')
      const payload = await response.json()
      setVendors(payload.vendors || [])
      setCategories(payload.categories || [])
      setRiskTrends(payload.trends || [])
    } catch (err) {
      console.error('Failed to fetch risk data:', err)
    } finally {
      setLoading(false)
    }
  }

  function getRiskBadge(riskLevel: VendorRisk['riskLevel']) {
    const configs = {
      low: { variant: 'default' as const, color: 'bg-green-600', label: 'Low' },
      medium: { variant: 'secondary' as const, color: 'bg-yellow-600', label: 'Medium' },
      high: { variant: 'destructive' as const, color: 'bg-orange-600', label: 'High' },
      critical: { variant: 'destructive' as const, color: 'bg-red-600', label: 'Critical' },
    }
    const config = configs[riskLevel] || configs.low
    return (
      <Badge variant={config.variant} className={config.color}>
        {config.label}
      </Badge>
    )
  }

  function getTrendIcon(trend: VendorRisk['trend']) {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-600" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-600" />
      default:
        return null
    }
  }

  const highRiskVendors = vendors.filter((v) => v.riskLevel === 'high' || v.riskLevel === 'critical')
  const totalVendors = vendors.length
  const averageRisk = vendors.length > 0
    ? vendors.reduce((sum, v) => sum + v.riskScore, 0) / vendors.length
    : 0

  // Risk distribution
  const riskDistribution = {
    low: vendors.filter((v) => v.riskLevel === 'low').length,
    medium: vendors.filter((v) => v.riskLevel === 'medium').length,
    high: vendors.filter((v) => v.riskLevel === 'high').length,
    critical: vendors.filter((v) => v.riskLevel === 'critical').length,
  }

  // Chart helper functions
  function getMaxValue(data: number[]) {
    return Math.max(...data, 1)
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vendor Risk Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage vendor risk levels across all categories
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVendors}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High Risk Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{highRiskVendors.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(averageRisk)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {vendors.reduce((sum, v) => sum + v.alerts, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name} ({cat.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Risk Level</label>
              <Select value={selectedRiskLevel} onValueChange={setSelectedRiskLevel}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Risk Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Distribution</CardTitle>
          <CardDescription>
            Distribution of vendors across risk levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Low</span>
                  <span className="text-sm text-muted-foreground">{riskDistribution.low}</span>
                </div>
                <div className="h-32 bg-muted rounded-lg overflow-hidden relative">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-green-600 transition-all"
                    style={{
                      height: `${(riskDistribution.low / totalVendors) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Medium</span>
                  <span className="text-sm text-muted-foreground">{riskDistribution.medium}</span>
                </div>
                <div className="h-32 bg-muted rounded-lg overflow-hidden relative">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-yellow-600 transition-all"
                    style={{
                      height: `${(riskDistribution.medium / totalVendors) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">High</span>
                  <span className="text-sm text-muted-foreground">{riskDistribution.high}</span>
                </div>
                <div className="h-32 bg-muted rounded-lg overflow-hidden relative">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-orange-600 transition-all"
                    style={{
                      height: `${(riskDistribution.high / totalVendors) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Critical</span>
                  <span className="text-sm text-muted-foreground">{riskDistribution.critical}</span>
                </div>
                <div className="h-32 bg-muted rounded-lg overflow-hidden relative">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-red-600 transition-all"
                    style={{
                      height: `${(riskDistribution.critical / totalVendors) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Trend Chart */}
      {riskTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Risk Trend Over Time</CardTitle>
            <CardDescription>
              Average risk scores and distribution over the past 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-64 flex items-end gap-2">
                {riskTrends.map((trend, index) => {
                  const maxValue = getMaxValue([
                    trend.averageRisk,
                    trend.lowRisk,
                    trend.mediumRisk,
                    trend.highRisk,
                    trend.criticalRisk,
                  ])
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full h-48 flex items-end gap-0.5 relative">
                        <div
                          className="flex-1 bg-green-600 rounded-t"
                          style={{
                            height: `${(trend.lowRisk / maxValue) * 100}%`,
                          }}
                          title={`Low: ${trend.lowRisk}`}
                        />
                        <div
                          className="flex-1 bg-yellow-600 rounded-t"
                          style={{
                            height: `${(trend.mediumRisk / maxValue) * 100}%`,
                          }}
                          title={`Medium: ${trend.mediumRisk}`}
                        />
                        <div
                          className="flex-1 bg-orange-600 rounded-t"
                          style={{
                            height: `${(trend.highRisk / maxValue) * 100}%`,
                          }}
                          title={`High: ${trend.highRisk}`}
                        />
                        <div
                          className="flex-1 bg-red-600 rounded-t"
                          style={{
                            height: `${(trend.criticalRisk / maxValue) * 100}%`,
                          }}
                          title={`Critical: ${trend.criticalRisk}`}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 text-center">
                        {formatDate(trend.date)}
                      </div>
                      <div className="text-xs font-medium mt-1">
                        Avg: {Math.round(trend.averageRisk)}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-600 rounded" />
                  <span>Low</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-yellow-600 rounded" />
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-600 rounded" />
                  <span>High</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-600 rounded" />
                  <span>Critical</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Risk by Category</CardTitle>
          <CardDescription>
            Average risk scores across vendor categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length > 0 ? (
            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{category.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {category.count} vendors
                      </span>
                      <span className="text-sm font-semibold">
                        Avg Risk: {Math.round(category.averageRisk)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        category.averageRisk < 30
                          ? 'bg-green-600'
                          : category.averageRisk < 70
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                      }`}
                      style={{ width: `${Math.min(category.averageRisk, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No category data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vendor Risk Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Risk Levels</CardTitle>
          <CardDescription>
            Detailed risk assessment for each vendor
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : vendors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead>Alerts</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow key={vendor.vendorId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/demo/vendor/${vendor.vendorId}/profile`}
                        className="text-primary hover:underline"
                      >
                        {vendor.vendorName}
                      </Link>
                    </TableCell>
                    <TableCell>{vendor.category}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{vendor.riskScore}</span>
                        <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              vendor.riskScore < 30
                                ? 'bg-green-600'
                                : vendor.riskScore < 70
                                ? 'bg-yellow-600'
                                : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min(vendor.riskScore, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRiskBadge(vendor.riskLevel)}</TableCell>
                    <TableCell>{getTrendIcon(vendor.trend)}</TableCell>
                    <TableCell>
                      {vendor.alerts > 0 ? (
                        <Badge variant="destructive">{vendor.alerts}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(vendor.lastUpdated).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/demo/vendor/${vendor.vendorId}/profile`}>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No vendors found matching the selected filters
            </div>
          )}
        </CardContent>
      </Card>

      {/* High Risk Alerts */}
      {highRiskVendors.length > 0 && (
        <Card className="border-orange-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              High Risk Vendors Requiring Attention
            </CardTitle>
            <CardDescription>
              Vendors with high or critical risk scores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {highRiskVendors.map((vendor) => (
                <div
                  key={vendor.vendorId}
                  className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg"
                >
                  <div>
                    <Link
                      href={`/demo/vendor/${vendor.vendorId}/profile`}
                      className="font-medium text-primary hover:underline"
                    >
                      {vendor.vendorName}
                    </Link>
                    <div className="text-sm text-muted-foreground">
                      Risk Score: {vendor.riskScore} • {vendor.alerts} alerts
                    </div>
                  </div>
                  <Link href={`/demo/vendor/${vendor.vendorId}/profile`}>
                    <Button variant="outline" size="sm">
                      Review
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

