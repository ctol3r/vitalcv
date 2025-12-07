'use client';

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, AlertTriangle, TrendingUp, Users } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function WorkforcePage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  // Using demo-org for MVP
  const { data, error, isLoading } = useSWR(`${backendUrl}/api/workforce/predict/demo-org`, fetcher);

  if (isLoading) return <div className="p-8">Loading workforce intelligence...</div>;
  if (error) return <div className="p-8 text-red-500">Error loading data</div>;

  const { breakdown, next12Months, overallRiskScore } = data;

  const highRiskSpecialties = breakdown.filter((b: any) => b.riskScore > 0.7);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Workforce Intelligence</h1>
            <p className="text-muted-foreground">AI-driven predictive analytics for workforce planning</p>
        </div>
        <Badge variant={overallRiskScore > 0.5 ? "destructive" : "secondary"} className="text-lg px-4 py-1">
            Risk Score: {overallRiskScore.toFixed(2)}
        </Badge>
      </div>

      {highRiskSpecialties.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Workforce Shortages Detected</AlertTitle>
          <AlertDescription>
            High risk detected in: {highRiskSpecialties.map((s: any) => s.specialty).join(', ')}. Immediate hiring action recommended.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projected Shortage</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
                {breakdown.reduce((acc: number, curr: any) => acc + (curr.shortage > 0 ? curr.shortage : 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">across all specialties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Risk Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallRiskScore.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">0.0 (Low) - 1.0 (High)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Projected Shortage Trends (Next 12 Months)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={next12Months}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="predictedShortage" fill="#8884d8" name="Projected Shortage" />
                </BarChart>
                </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Risk Heatmap & Urgency</CardTitle>
                <CardDescription>Breakdown by specialty</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Specialty</TableHead>
                            <TableHead>Risk</TableHead>
                            <TableHead>Urgency</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {breakdown.map((item: any) => (
                            <TableRow key={item.specialty}>
                                <TableCell className="font-medium">{item.specialty}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${item.riskScore > 0.7 ? 'bg-red-500' : item.riskScore > 0.4 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                        <span>{item.riskScore.toFixed(2)}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={item.hiringUrgency === 'HIGH' ? 'destructive' : item.hiringUrgency === 'MEDIUM' ? 'secondary' : 'outline'}>
                                        {item.hiringUrgency}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>

      <Card>
          <CardHeader>
              <CardTitle>Recommended Actions</CardTitle>
          </CardHeader>
          <CardContent>
              <ul className="list-disc pl-5 space-y-2">
                  {highRiskSpecialties.map((s: any) => (
                      <li key={s.specialty}>
                          <strong>{s.specialty}:</strong> Initiate aggressive recruitment campaign. Consider locum tenens coverage for Q3.
                      </li>
                  ))}
                  {overallRiskScore < 0.3 && <li>Workforce stability is good. Maintain current retention programs.</li>}
                  {overallRiskScore >= 0.3 && overallRiskScore < 0.7 && <li>Monitor nursing trends closely. Prepare contingency plans.</li>}
              </ul>
          </CardContent>
      </Card>
    </div>
  );
}

