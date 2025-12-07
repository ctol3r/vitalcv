'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, AlertTriangle, CheckCircle2, Download, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface ContractIntel {
  id: string;
  contractId: string;
  intel: {
    obligations: Array<{ type: string; description: string }>;
    risks: Array<{ clause: string; severity: string }>;
  };
  updatedAt: string;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractIntel[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      setContracts([]);
    } catch (error) {
      console.error('Failed to fetch contracts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contract Intelligence</h1>
          <p className="text-muted-foreground mt-2">
            Contract-reading AI to parse hiring terms, privileges, compensation, compliance obligations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Upload Contract
          </Button>
          <Button onClick={fetchContracts} disabled={loading}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contracts
          </CardTitle>
          <CardDescription>Parsed contract intelligence and risk analysis</CardDescription>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No contracts analyzed yet</p>
              <Button className="mt-4" variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Upload First Contract
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract ID</TableHead>
                  <TableHead>Obligations</TableHead>
                  <TableHead>Risks</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-mono text-sm">{contract.contractId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{contract.intel.obligations.length}</Badge>
                    </TableCell>
                    <TableCell>
                      {contract.intel.risks.length > 0 ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {contract.intel.risks.length}
                        </Badge>
                      ) : (
                        <Badge variant="default">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          None
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(contract.updatedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="default">Active</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








