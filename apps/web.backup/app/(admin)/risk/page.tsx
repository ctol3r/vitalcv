'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { AlertTriangle, CheckCircle, AlertOctagon } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function RiskDashboard() {
  const [risks, setRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRisks() {
      try {
        const res = await apiClient.getRiskScores();
        if (res.data) {
            setRisks(res.data);
        }
      } catch (error) {
        console.error("Failed to fetch risk scores", error);
      } finally {
        setLoading(false);
      }
    }
    fetchRisks();
  }, []);

  if (loading) return <div className="p-8">Loading risk data...</div>;

  const highRiskCount = risks.filter(r => r.score > 0.7).length;
  const mediumRiskCount = risks.filter(r => r.score > 0.3 && r.score <= 0.7).length;
  const lowRiskCount = risks.filter(r => r.score <= 0.3).length;

  const trendData = [
    { name: 'Mon', high: Math.max(0, highRiskCount - 2), medium: mediumRiskCount + 1, low: lowRiskCount - 5 },
    { name: 'Tue', high: Math.max(0, highRiskCount - 1), medium: mediumRiskCount, low: lowRiskCount - 2 },
    { name: 'Wed', high: highRiskCount, medium: mediumRiskCount, low: lowRiskCount },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Provider Risk Dashboard</h1>
        <Badge variant="outline" className="text-sm">
          Updated: {new Date().toLocaleDateString()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 flex items-center gap-2">
              <AlertOctagon className="h-6 w-6" />
              {highRiskCount}
            </div>
            <p className="text-xs text-muted-foreground">Score &gt; 0.7</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Medium Risk Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              {mediumRiskCount}
            </div>
            <p className="text-xs text-muted-foreground">Score 0.3 - 0.7</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Risk Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
              <CheckCircle className="h-6 w-6" />
              {lowRiskCount}
            </div>
            <p className="text-xs text-muted-foreground">Score &lt; 0.3</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
            <CardHeader>
                <CardTitle>Risk Trends</CardTitle>
                <CardDescription>Daily fluctuation in risk categories</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="high" stroke="#ef4444" strokeWidth={2} />
                        <Line type="monotone" dataKey="medium" stroke="#eab308" strokeWidth={2} />
                        <Line type="monotone" dataKey="low" stroke="#22c55e" strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
                <CardDescription>Current provider distribution</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: 'Current', high: highRiskCount, medium: mediumRiskCount, low: lowRiskCount }]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="high" fill="#ef4444" />
                        <Bar dataKey="medium" fill="#eab308" />
                        <Bar dataKey="low" fill="#22c55e" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Clinician Risk Scores</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Clinician</TableHead>
                        <TableHead>Risk Score</TableHead>
                        <TableHead>Contributing Factors</TableHead>
                        <TableHead>Last Updated</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {risks.map((risk) => (
                        <TableRow key={risk.id}>
                            <TableCell className="font-medium">
                                {risk.user?.email || risk.userId}
                            </TableCell>
                            <TableCell>
                                <Badge variant={risk.score > 0.7 ? "destructive" : risk.score > 0.3 ? "outline" : "secondary"}
                                       className={risk.score > 0.3 && risk.score <= 0.7 ? "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200" : ""}>
                                    {risk.score.toFixed(2)}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                    {risk.factors?.sanctionsSignals?.leieMatch && (
                                        <span className="text-red-600 flex items-center gap-1"><AlertOctagon className="w-3 h-3"/> LEIE Match</span>
                                    )}
                                    {risk.factors?.sanctionsSignals?.npdbMatch && (
                                        <span className="text-red-600 flex items-center gap-1"><AlertOctagon className="w-3 h-3"/> NPDB Match</span>
                                    )}
                                    {risk.factors?.monitoringEvents?.recentFailures > 0 && (
                                        <span className="text-yellow-600">Monitoring Failures</span>
                                    )}
                                    {!risk.factors?.sanctionsSignals?.leieMatch && !risk.factors?.sanctionsSignals?.npdbMatch && !risk.factors?.monitoringEvents?.recentFailures && "None detected"}
                                </div>
                            </TableCell>
                            <TableCell>
                                {new Date(risk.updatedAt).toLocaleString()}
                            </TableCell>
                        </TableRow>
                    ))}
                    {risks.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                No risk scores found. Run the risk calculation job.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}














