'use client'

import { useMemo, useState } from 'react'
import {
  Award,
  Calendar,
  TrendingUp,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  ArrowRight,
  GraduationCap,
  CreditCard,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

type Credential = {
  id: string
  name: string
  issuer: string
  issueDate: string
  expiryDate?: string
  status: 'active' | 'expiring' | 'expired'
}

type TrainingCredit = {
  id: string
  amount: number
  source: string
  expiresAt?: string
}

type ExpiringCredential = {
  id: string
  name: string
  expiryDate: string
  daysUntilExpiry: number
}

type Recommendation = {
  id: string
  type: 'course' | 'credential' | 'mentorship'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

type CareerDashboardData = {
  credentials: Credential[]
  trainingCredits: TrainingCredit[]
  expiringCredentials: ExpiringCredential[]
  recommendations: Recommendation[]
  stats: {
    totalCredentials: number
    activeCredentials: number
    totalCredits: number
    expiringCount: number
  }
}

export default function CareerDashboardPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const data = useMemo(() => buildMockData(), [])

  const filteredRecommendations = useMemo(() => {
    if (!searchQuery) return data.recommendations
    const query = searchQuery.toLowerCase()
    return data.recommendations.filter(
      (rec) =>
        rec.title.toLowerCase().includes(query) ||
        rec.description.toLowerCase().includes(query) ||
        rec.type.toLowerCase().includes(query),
    )
  }, [searchQuery, data.recommendations])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • User • Career Dashboard</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" aria-hidden="true" />
              Career Dashboard
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Track your career progress, manage credentials, training credits, and discover opportunities for growth.
            </p>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credentials</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalCredentials}</div>
            <p className="text-xs text-muted-foreground">
              {data.stats.activeCredentials} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training Credits</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalCredits}</div>
            <p className="text-xs text-muted-foreground">Available credits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.expiringCount}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.recommendations.length}</div>
            <p className="text-xs text-muted-foreground">Next steps available</p>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Credentials Alert */}
      {data.expiringCredentials.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="h-5 w-5" />
              Credentials Expiring Soon
            </CardTitle>
            <CardDescription className="text-amber-800">
              {data.expiringCredentials.length} {data.expiringCredentials.length === 1 ? 'credential' : 'credentials'} need renewal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.expiringCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between rounded-md border border-amber-300 bg-white p-3"
                >
                  <div>
                    <p className="font-medium">{cred.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Expires in {cred.daysUntilExpiry} {cred.daysUntilExpiry === 1 ? 'day' : 'days'} • {cred.expiryDate}
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    Renew Now
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Completed Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Completed Credentials
            </CardTitle>
            <CardDescription>Your active professional credentials and certifications.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.credentials.map((cred) => (
                <div key={cred.id} className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{cred.name}</p>
                      <StatusBadge status={cred.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{cred.issuer}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Issued: {cred.issueDate}</span>
                      {cred.expiryDate && <span>Expires: {cred.expiryDate}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Link href="/demo/user/career/credentials">
                <Button variant="outline" className="w-full">
                  View All Credentials
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Training Credits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Training Credits
            </CardTitle>
            <CardDescription>Available credits for continuing education and training.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.trainingCredits.map((credit) => (
                <div
                  key={credit.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{credit.amount} Credits</p>
                    <p className="text-sm text-muted-foreground">{credit.source}</p>
                    {credit.expiresAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Expires: {credit.expiresAt}
                      </p>
                    )}
                  </div>
                  <Link href="/demo/training/catalog">
                    <Button size="sm" variant="outline">
                      Browse Courses
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Link href="/demo/training/catalog">
                <Button variant="outline" className="w-full">
                  Explore Training Catalog
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommended Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Recommended Next Steps
          </CardTitle>
          <CardDescription>
            Personalized recommendations based on your career goals and current credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search recommendations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-3">
            {filteredRecommendations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No recommendations found.</p>
            ) : (
              filteredRecommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-start justify-between rounded-md border p-4 hover:bg-accent transition-colors"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                      >
                        {rec.priority}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {rec.type}
                      </Badge>
                    </div>
                    <p className="font-medium">{rec.title}</p>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                  </div>
                  <div className="ml-4">
                    {rec.type === 'course' && (
                      <Link href={`/demo/training/catalog?course=${rec.id}`}>
                        <Button size="sm">View Course</Button>
                      </Link>
                    )}
                    {rec.type === 'credential' && (
                      <Link href={`/demo/user/career/credentials?credential=${rec.id}`}>
                        <Button size="sm">Learn More</Button>
                      </Link>
                    )}
                    {rec.type === 'mentorship' && (
                      <Link href={`/demo/mentorship/match?mentorship=${rec.id}`}>
                        <Button size="sm">Find Mentor</Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: Credential['status'] }) {
  const config = {
    active: { label: 'Active', variant: 'default' as const, icon: CheckCircle2 },
    expiring: { label: 'Expiring Soon', variant: 'default' as const, icon: Clock },
    expired: { label: 'Expired', variant: 'destructive' as const, icon: AlertCircle },
  }[status]

  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

function buildMockData(): CareerDashboardData {
  return {
    credentials: [
      {
        id: 'cred1',
        name: 'Medical License',
        issuer: 'State Medical Board',
        issueDate: '2020-01-15',
        expiryDate: '2026-12-31',
        status: 'active',
      },
      {
        id: 'cred2',
        name: 'Board Certification - Cardiology',
        issuer: 'American Board of Internal Medicine',
        issueDate: '2018-06-01',
        expiryDate: '2027-06-30',
        status: 'active',
      },
      {
        id: 'cred3',
        name: 'DEA Registration',
        issuer: 'Drug Enforcement Administration',
        issueDate: '2023-01-01',
        expiryDate: '2025-12-20',
        status: 'expiring',
      },
      {
        id: 'cred4',
        name: 'ACLS Certification',
        issuer: 'American Heart Association',
        issueDate: '2024-03-01',
        expiryDate: '2026-03-01',
        status: 'active',
      },
    ],
    trainingCredits: [
      {
        id: 'credit1',
        amount: 25,
        source: 'Annual Training Allocation',
        expiresAt: '2026-12-31',
      },
      {
        id: 'credit2',
        amount: 10,
        source: 'Continuing Education Bonus',
        expiresAt: '2025-12-31',
      },
    ],
    expiringCredentials: [
      {
        id: 'cred3',
        name: 'DEA Registration',
        expiryDate: '2025-12-20',
        daysUntilExpiry: 34,
      },
    ],
    recommendations: [
      {
        id: 'rec1',
        type: 'course',
        title: 'Advanced Cardiac Life Support Renewal',
        description: 'Your ACLS certification expires in 3 months. Renew now to maintain your credentials.',
        priority: 'high',
      },
      {
        id: 'rec2',
        type: 'credential',
        title: 'Telemedicine Certification',
        description: 'Based on your specialty, consider obtaining telemedicine certification to expand your practice.',
        priority: 'medium',
      },
      {
        id: 'rec3',
        type: 'mentorship',
        title: 'Find a Cardiology Mentor',
        description: 'Connect with experienced cardiologists to advance your career and expand your network.',
        priority: 'low',
      },
      {
        id: 'rec4',
        type: 'course',
        title: 'Cardiac Catheterization Techniques',
        description: 'Enhance your skills with this advanced course on cardiac catheterization procedures.',
        priority: 'medium',
      },
    ],
    stats: {
      totalCredentials: 4,
      activeCredentials: 3,
      totalCredits: 35,
      expiringCount: 1,
    },
  }
}

