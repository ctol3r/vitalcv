'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  FileText,
  TrendingUp,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  Users,
  DollarSign,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface PartnerProfile {
  id: string
  name: string
  status: 'active' | 'pending' | 'suspended'
  contactEmail: string
  createdAt: string
}

interface Agreement {
  id: string
  title: string
  status: 'draft' | 'pending' | 'active' | 'expired'
  expiryDate?: string
}

interface Opportunity {
  id: string
  title: string
  status: 'new' | 'in_progress' | 'won' | 'lost'
  potentialValue?: number
}

interface Task {
  id: string
  title: string
  status: 'open' | 'in_progress' | 'blocked' | 'done'
  dueDate?: string
}

interface Campaign {
  id: string
  name: string
  status: 'draft' | 'active' | 'completed'
  metrics?: {
    leads?: number
    conversions?: number
    spend?: number
  }
}

interface DashboardMetrics {
  activeAgreements: number
  pendingOpportunities: number
  openTasks: number
  activeCampaigns: number
  totalRevenue: number
  conversionRate: number
}

const monthlyData = [
  { month: 'Jan', opportunities: 4, proposals: 2 },
  { month: 'Feb', opportunities: 6, proposals: 3 },
  { month: 'Mar', opportunities: 5, proposals: 4 },
  { month: 'Apr', opportunities: 8, proposals: 5 },
  { month: 'May', opportunities: 7, proposals: 6 },
  { month: 'Jun', opportunities: 9, proposals: 7 },
]

const campaignData = [
  { name: 'Q1 Campaign', leads: 120, conversions: 45 },
  { name: 'Q2 Campaign', leads: 150, conversions: 60 },
  { name: 'Q3 Campaign', leads: 180, conversions: 72 },
  { name: 'Q4 Campaign', leads: 200, conversions: 85 },
]

export default function PartnerDashboardPage() {
  const [profile, setProfile] = useState<PartnerProfile | null>(null)
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeAgreements: 0,
    pendingOpportunities: 0,
    openTasks: 0,
    activeCampaigns: 0,
    totalRevenue: 0,
    conversionRate: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      // In a real app, these would be separate API calls
      const [profileRes, agreementsRes, opportunitiesRes, tasksRes, campaignsRes] =
        await Promise.all([
          fetch('/api/partners/profile'),
          fetch('/api/partners/agreements?limit=5'),
          fetch('/api/partners/opportunities?status=new,in_progress&limit=5'),
          fetch('/api/partners/tasks?status=open,in_progress&limit=5'),
          fetch('/api/partners/campaigns?status=active&limit=3'),
        ])

      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setProfile(profileData)
      }

      if (agreementsRes.ok) {
        const agreementsData = await agreementsRes.json()
        setAgreements(agreementsData.agreements || [])
        setMetrics((prev) => ({
          ...prev,
          activeAgreements: agreementsData.agreements?.filter(
            (a: Agreement) => a.status === 'active'
          ).length || 0,
        }))
      }

      if (opportunitiesRes.ok) {
        const opportunitiesData = await opportunitiesRes.json()
        setOpportunities(opportunitiesData.opportunities || [])
        setMetrics((prev) => ({
          ...prev,
          pendingOpportunities: opportunitiesData.opportunities?.length || 0,
        }))
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setTasks(tasksData.tasks || [])
        setMetrics((prev) => ({
          ...prev,
          openTasks: tasksData.tasks?.filter((t: Task) => t.status !== 'done').length || 0,
        }))
      }

      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json()
        setCampaigns(campaignsData.campaigns || [])
        setMetrics((prev) => ({
          ...prev,
          activeCampaigns: campaignsData.campaigns?.length || 0,
        }))
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      pending: 'secondary',
      suspended: 'destructive',
      draft: 'outline',
      expired: 'destructive',
      new: 'secondary',
      in_progress: 'default',
      won: 'default',
      lost: 'destructive',
      open: 'secondary',
      blocked: 'destructive',
      done: 'default',
      completed: 'default',
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  const formatCurrency = (cents?: number) => {
    if (!cents) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Partner Dashboard</h1>
          {profile && (
            <p className="text-muted-foreground">
              Welcome back, {profile.name}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/partners/opportunities">
              <Plus className="mr-2 h-4 w-4" />
              New Opportunity
            </Link>
          </Button>
          <Button asChild>
            <Link href="/partners/agreements">
              <FileText className="mr-2 h-4 w-4" />
              Upload Agreement
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agreements</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeAgreements}</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/partners/agreements" className="hover:underline">
                View all agreements
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Opportunities</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingOpportunities}</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/partners/opportunities" className="hover:underline">
                View all opportunities
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.openTasks}</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/partners/tasks" className="hover:underline">
                View all tasks
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/partners/campaigns" className="hover:underline">
                View all campaigns
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Partnership Activity</CardTitle>
            <CardDescription>Opportunities and proposals over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="opportunities" stroke="#8884d8" name="Opportunities" />
                <Line type="monotone" dataKey="proposals" stroke="#82ca9d" name="Proposals" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>Leads and conversions by campaign</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={campaignData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="leads" fill="#8884d8" name="Leads" />
                <Bar dataKey="conversions" fill="#82ca9d" name="Conversions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Agreements</CardTitle>
                <CardDescription>Your latest partnership agreements</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/partners/agreements">
                  View all <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {agreements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No agreements yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agreements.map((agreement) => (
                    <TableRow key={agreement.id}>
                      <TableCell className="font-medium">{agreement.title}</TableCell>
                      <TableCell>{getStatusBadge(agreement.status)}</TableCell>
                      <TableCell>
                        {agreement.expiryDate
                          ? new Date(agreement.expiryDate).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pending Opportunities</CardTitle>
                <CardDescription>Opportunities requiring attention</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/partners/opportunities">
                  View all <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No pending opportunities
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((opp) => (
                    <TableRow key={opp.id}>
                      <TableCell className="font-medium">{opp.title}</TableCell>
                      <TableCell>{getStatusBadge(opp.status)}</TableCell>
                      <TableCell>{formatCurrency(opp.potentialValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Tasks</CardTitle>
              <CardDescription>Collaboration tasks that need attention</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/partners/tasks">
                View all <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No open tasks
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell>
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString()
                        : 'No due date'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

