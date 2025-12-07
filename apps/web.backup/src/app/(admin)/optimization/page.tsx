'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/design/Card';
import { Button } from '@/components/design/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/design/Table';

export default function OptimizationLogPage() {
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Mock Data
  const loops = [
    { id: 'opt_1', type: 'routing', timestamp: '2025-11-23 06:00', details: 'Re-routed high latency traffic', status: 'Applied' },
    { id: 'opt_2', type: 'compliance', timestamp: '2025-11-23 00:00', details: 'Flagged 3 high-risk credentials', status: 'Applied' },
    { id: 'opt_3', type: 'matching', timestamp: '2025-11-22 18:00', details: 'Adjusted matching threshold to 0.85', status: 'Applied' },
  ];

  const predictions = [
    { metric: 'Latency', current: '240ms', projected: '180ms', improvement: '25%' },
    { metric: 'Compliance Risk', current: 'High', projected: 'Medium', improvement: 'Risk reduced' },
  ];

  const handleRollback = () => {
    setIsRollingBack(true);
    setTimeout(() => {
        alert('Rollback initiated for last optimization cycle.');
        setIsRollingBack(false);
    }, 1000);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Optimization Log</h1>
          <p className="text-muted-foreground">Continuous optimization loops and adjustments.</p>
        </div>
        <Button variant="destructive" onClick={handleRollback} disabled={isRollingBack}>
           {isRollingBack ? 'Rolling back...' : 'Rollback Last Change'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
            <CardHeader>
                <CardTitle>Predicted Improvements</CardTitle>
                <CardDescription>Estimated impact of recent changes</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Metric</TableHead>
                            <TableHead>Current</TableHead>
                            <TableHead>Projected</TableHead>
                            <TableHead>Gain</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {predictions.map((p) => (
                            <TableRow key={p.metric}>
                                <TableCell>{p.metric}</TableCell>
                                <TableCell>{p.current}</TableCell>
                                <TableCell>{p.projected}</TableCell>
                                <TableCell className="text-green-600 font-medium">{p.improvement}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

         <Card>
            <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Optimization Engine</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="font-medium">Active</span>
                </div>
                <p className="text-sm text-muted-foreground">Next run in 4 hours 12 minutes.</p>
                <div className="mt-4 p-4 bg-muted rounded-md text-xs font-mono">
                    Last anchor: 0x8a7f...3b21
                </div>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Recent Loops</CardTitle>
            <CardDescription>Log of applied adjustments</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loops.map((loop) => (
                        <TableRow key={loop.id}>
                            <TableCell>{loop.timestamp}</TableCell>
                            <TableCell className="capitalize">{loop.type}</TableCell>
                            <TableCell>{loop.details}</TableCell>
                            <TableCell>
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    {loop.status}
                                </span>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}


