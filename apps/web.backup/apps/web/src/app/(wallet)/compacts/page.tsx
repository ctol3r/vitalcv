'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCheck2, ShieldCheck, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type CompactDocument = {
  id: string;
  compact: string;
  documentUrl: string;
  verified: boolean;
  createdAt: string;
};

type VerificationResult = {
  clinicianId: string;
  compact: string;
  eligibility: string;
  missingDocs: string[];
  sanctionsClear: boolean;
};

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');
const REQUIRED_DOCS = [
  { compact: 'IMLC', label: 'Primary state license + letter of qualification' },
  { compact: 'PSYPACT', label: 'E.Passport verification + background check' },
  { compact: 'NLC', label: 'Residency proof + RN license verification' },
];

export default function WalletCompactsPage() {
  const [clinicianId, setClinicianId] = useState('wallet-demo-clinician');
  const [documents, setDocuments] = useState<CompactDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedCompact, setSelectedCompact] = useState('IMLC');
  const [documentUrl, setDocumentUrl] = useState('');
  const [fileName, setFileName] = useState('imlc-proof.pdf');
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(buildApiUrl(`/api/compacts/documents/${clinicianId}`));
      if (!response.ok) throw new Error('Unable to load documents');
      const payload = await response.json();
      setDocuments(payload.documents ?? []);
    } catch (err) {
      console.error('Failed to load compact documents', err);
      setError(err instanceof Error ? err.message : 'Unable to load compact documents');
    }
  }, [clinicianId]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  async function handleUpload() {
    if (!documentUrl.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl(`/api/compacts/documents/${clinicianId}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compact: selectedCompact,
          documentUrl,
          fileName,
          mimeType: documentUrl.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png',
        }),
      });
      if (!response.ok) throw new Error('Upload failed');
      setDocumentUrl('');
      await fetchDocuments();
    } catch (err) {
      console.error('Upload failed', err);
      setError(err instanceof Error ? err.message : 'Unable to upload document');
    } finally {
      setUploading(false);
    }
  }

  async function handleVerify() {
    setError(null);
    try {
      const response = await fetch(buildApiUrl(`/api/compacts/verify/${clinicianId}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compact: selectedCompact,
          sanctionsClear: true,
        }),
      });
      if (!response.ok) throw new Error('Verification failed');
      const payload = (await response.json()) as VerificationResult;
      setVerification(payload);
    } catch (err) {
      console.error('Verification failed', err);
      setError(err instanceof Error ? err.message : 'Unable to verify compact');
    }
  }

  const uploadedByCompact = useMemo(() => {
    const map = new Map<string, number>();
    documents.forEach((doc) => {
      map.set(doc.compact, (map.get(doc.compact) ?? 0) + 1);
    });
    return map;
  }, [documents]);

  return (
    <div className="container max-w-4xl space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Wallet · Compacts</p>
        <h1 className="text-3xl font-bold">Interstate compact checklist</h1>
        <p className="text-muted-foreground">
          Upload required documents, track eligibility, and trigger verification directly from your wallet.
        </p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Clinician context</CardTitle>
          <CardDescription>Provide the clinician identifier you are staging documents for.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="text-sm font-medium">Clinician ID</label>
          <Input value={clinicianId} onChange={(event) => setClinicianId(event.target.value)} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Requirements</CardTitle>
            <CardDescription>Per-compact document checklist</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REQUIRED_DOCS.map((item) => (
              <div
                key={item.compact}
                className="flex items-center justify-between rounded-lg border bg-muted/40 p-3"
              >
                <div>
                  <p className="font-semibold">{item.compact}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
                <Badge variant={uploadedByCompact.get(item.compact) ? 'default' : 'outline'}>
                  {uploadedByCompact.get(item.compact) ? 'Uploaded' : 'Pending'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload document</CardTitle>
            <CardDescription>Attach PDF or image evidence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium">Compact</label>
              <Select value={selectedCompact} onValueChange={setSelectedCompact}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMLC">IMLC</SelectItem>
                  <SelectItem value="PSYPACT">PSYPACT</SelectItem>
                  <SelectItem value="NLC">NLC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Document URL</label>
              <Input
                placeholder="https://files.example.com/imlc.pdf"
                value={documentUrl}
                onChange={(event) => setDocumentUrl(event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">File name</label>
              <Input value={fileName} onChange={(event) => setFileName(event.target.value)} />
            </div>
            <Button onClick={() => void handleUpload()} disabled={uploading || !documentUrl.trim()}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded documents</CardTitle>
          <CardDescription>Latest submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compact</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>{doc.compact}</TableCell>
                    <TableCell>
                      <a
                        href={doc.documentUrl}
                        className="text-sm text-primary underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {doc.documentUrl}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant={doc.verified ? 'default' : 'outline'}>
                        {doc.verified ? 'Verified' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(doc.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Verification</CardTitle>
            <CardDescription>Run automated eligibility check</CardDescription>
          </div>
          <Button variant="secondary" onClick={() => void handleVerify()}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Verify {selectedCompact}
          </Button>
        </CardHeader>
        <CardContent>
          {verification ? (
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Eligibility</p>
                <p className="text-2xl font-semibold">{verification.eligibility}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Missing documents</p>
                {verification.missingDocs.length ? (
                  <ul className="text-sm">
                    {verification.missingDocs.map((doc) => (
                      <li key={doc}>&bull; {doc}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm">All requirements satisfied.</p>
                )}
              </div>
            </div>
          ) : (
            <Alert>
              <FileCheck2 className="h-4 w-4" />
              <AlertTitle>Ready to verify</AlertTitle>
              <AlertDescription>Upload at least one document then click verify.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}










