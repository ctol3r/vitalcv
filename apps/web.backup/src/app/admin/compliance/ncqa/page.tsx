'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

interface NCQARecord {
  id: string;
  credentialId: string;
  ruleName: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string | null;
  checkedAt: string;
  credentialName?: string;
  credentialType?: string;
  userName?: string;
}

export default function NCQAPage() {
  const [records, setRecords] = useState<NCQARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<NCQARecord | null>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/compliance/ncqa/records');
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to fetch records', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-500 hover:bg-green-600">Pass</Badge>;
      case 'fail':
        return <Badge variant="destructive">Fail</Badge>;
      case 'warn':
        return <Badge variant="secondary" className="bg-yellow-500 text-white hover:bg-yellow-600">Warn</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">NCQA Compliance Monitoring</h1>
        <Button onClick={fetchRecords} variant="outline">Refresh</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Rule Executions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8 text-gray-500">Loading records...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Clinician / Credential</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            No compliance records found.
                        </TableCell>
                    </TableRow>
                ) : (
                    records.map((record) => (
                    <TableRow key={record.id}>
                        <TableCell>
                        {format(new Date(record.checkedAt), 'MMM d, HH:mm')}
                        </TableCell>
                        <TableCell>
                        <div className="font-medium">{record.userName || 'Unknown User'}</div>
                        <div className="text-xs text-gray-500">
                            {record.credentialName || record.credentialType || record.credentialId}
                        </div>
                        </TableCell>
                        <TableCell className="font-medium">{record.ruleName}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell className="max-w-xs truncate text-gray-600" title={record.detail || ''}>
                        {record.detail}
                        </TableCell>
                        <TableCell>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRecord(record)}
                        >
                            Details
                        </Button>
                        </TableCell>
                    </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rule Execution Details</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-[100px_1fr] gap-y-3">
                <div className="font-semibold text-gray-500">Rule</div>
                <div className="font-medium">{selectedRecord.ruleName}</div>

                <div className="font-semibold text-gray-500">Status</div>
                <div>{getStatusBadge(selectedRecord.status)}</div>

                <div className="font-semibold text-gray-500">Time</div>
                <div>{format(new Date(selectedRecord.checkedAt), 'PPP p')}</div>

                <div className="font-semibold text-gray-500">Clinician</div>
                <div>{selectedRecord.userName || 'N/A'}</div>

                <div className="font-semibold text-gray-500">Credential</div>
                <div>
                  <div className="font-medium">{selectedRecord.credentialName}</div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">{selectedRecord.credentialId}</div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-md mt-4 border">
                <div className="font-semibold mb-1 text-sm text-gray-700">Output Message</div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedRecord.detail}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}














