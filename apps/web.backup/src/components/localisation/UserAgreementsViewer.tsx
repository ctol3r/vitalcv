/**
 * B230C-INTL-014: UserAgreements Viewer
 *
 * Displays the current user agreements, privacy notices, and region-specific documents
 * in the selected language; supports PDF download and version history.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  FileText,
  Clock,
  Loader2,
  Globe,
  AlertCircle,
  History,
} from 'lucide-react';

interface AgreementDocument {
  id: string;
  type: 'terms' | 'privacy' | 'region_specific';
  title: string;
  version: string;
  effectiveDate: string;
  language: string;
  content: string; // HTML or markdown content
  pdfUrl?: string;
  regionCode?: string;
  countryCode?: string;
}

interface AgreementVersion {
  version: string;
  effectiveDate: string;
  language: string;
  pdfUrl?: string;
}

interface UserAgreementsViewerProps {
  userId?: string;
  initialLanguage?: string;
}

export function UserAgreementsViewer({
  userId,
  initialLanguage = 'en-US',
}: UserAgreementsViewerProps) {
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
  const [documents, setDocuments] = useState<AgreementDocument[]>([]);
  const [versions, setVersions] = useState<Record<string, AgreementVersion[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<AgreementDocument | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const LANGUAGES = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'es-ES', label: 'Español' },
    { value: 'fr-FR', label: 'Français' },
    { value: 'de-DE', label: 'Deutsch' },
    { value: 'it-IT', label: 'Italiano' },
    { value: 'pt-BR', label: 'Português' },
    { value: 'zh-CN', label: '中文' },
    { value: 'ja-JP', label: '日本語' },
  ];

  useEffect(() => {
    loadAgreements();
  }, [selectedLanguage, userId]);

  async function loadAgreements() {
    try {
      setLoading(true);
      const url = userId
        ? `/api/demo/user/agreements?language=${selectedLanguage}&userId=${userId}`
        : `/api/demo/user/agreements?language=${selectedLanguage}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load agreements');

      const data = await res.json();
      setDocuments(data.documents || []);
      setVersions(data.versions || {});

      if (data.documents && data.documents.length > 0) {
        setSelectedDoc(data.documents[0]);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agreements');
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf(doc: AgreementDocument) {
    if (!doc.pdfUrl) {
      // Generate PDF on the fly if not available
      try {
        const res = await fetch(`/api/demo/user/agreements/${doc.id}/pdf?language=${selectedLanguage}`);
        if (!res.ok) throw new Error('Failed to generate PDF');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc.title}-${doc.version}-${selectedLanguage}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (err) {
        alert(`Failed to download PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } else {
      window.open(doc.pdfUrl, '_blank');
    }
  }

  function getDocumentTypeLabel(type: string) {
    switch (type) {
      case 'terms':
        return 'Terms of Service';
      case 'privacy':
        return 'Privacy Policy';
      case 'region_specific':
        return 'Regional Document';
      default:
        return type;
    }
  }

  function getDocumentTypeBadge(type: string) {
    switch (type) {
      case 'terms':
        return <Badge variant="outline">Terms</Badge>;
      case 'privacy':
        return <Badge variant="outline" className="bg-blue-50">Privacy</Badge>;
      case 'region_specific':
        return <Badge variant="outline" className="bg-purple-50">Regional</Badge>;
      default:
        return null;
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Agreements & Privacy Notices</CardTitle>
              <CardDescription>
                Review terms of service, privacy policies, and region-specific documents
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 border border-destructive rounded-md bg-destructive/10">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No agreements available for the selected language.</p>
            </div>
          ) : (
            <Tabs defaultValue={documents[0]?.id} onValueChange={(id) => {
              const doc = documents.find((d) => d.id === id);
              if (doc) setSelectedDoc(doc);
            }}>
              <TabsList className="grid w-full grid-cols-3">
                {documents.map((doc) => (
                  <TabsTrigger key={doc.id} value={doc.id} className="flex items-center gap-2">
                    {getDocumentTypeBadge(doc.type)}
                    <span className="truncate">{getDocumentTypeLabel(doc.type)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {documents.map((doc) => (
                <TabsContent key={doc.id} value={doc.id} className="mt-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="mb-2">{doc.title}</CardTitle>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>Version {doc.version}</span>
                            </div>
                            <span>
                              Effective: {new Date(doc.effectiveDate).toLocaleDateString()}
                            </span>
                            {doc.regionCode && (
                              <Badge variant="outline">
                                {doc.countryCode}-{doc.regionCode}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {versions[doc.id] && versions[doc.id].length > 1 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowHistory(!showHistory)}
                            >
                              <History className="mr-2 h-4 w-4" />
                              History
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => downloadPdf(doc)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {showHistory && versions[doc.id] && (
                        <div className="mb-6 p-4 border rounded-md bg-muted/50">
                          <h4 className="font-semibold mb-3">Version History</h4>
                          <div className="space-y-2">
                            {versions[doc.id].map((version) => (
                              <div
                                key={version.version}
                                className="flex items-center justify-between p-2 border rounded"
                              >
                                <div>
                                  <span className="font-medium">Version {version.version}</span>
                                  <span className="text-sm text-muted-foreground ml-2">
                                    Effective: {new Date(version.effectiveDate).toLocaleDateString()}
                                  </span>
                                </div>
                                {version.pdfUrl && (
                                  <Button variant="ghost" size="sm" onClick={() => window.open(version.pdfUrl, '_blank')}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div
                        className="prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: doc.content }}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

