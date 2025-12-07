'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BadgeCheck,
  ClipboardCopy,
  Download,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  Wand2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { IssuerClaim } from '@/lib/issuer/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
const DEFAULT_ISSUER_ID = process.env.NEXT_PUBLIC_ISSUER_ID || 'demo-issuer';

interface TemplateVersionRecord {
  id: string;
  version: number;
  name: string;
  schema: Record<string, any>;
  createdAt: string;
}

interface CredentialTemplateRecord {
  id: string;
  issuerId: string;
  name: string;
  schema: Record<string, any>;
  metadata?: Record<string, any> | null;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  versions: TemplateVersionRecord[];
}

export default function ClaimTemplatePage() {
  const params = useParams<{ id: string }>();
  const claimId = params?.id;
  const { toast } = useToast();

  const [claim, setClaim] = useState<IssuerClaim | null>(null);
  const [templates, setTemplates] = useState<CredentialTemplateRecord[]>([]);
  const [issuerId, setIssuerId] = useState(DEFAULT_ISSUER_ID);
  const [loadingClaim, setLoadingClaim] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [selectedVersion, setSelectedVersion] = useState<number>();
  const [draftPayload, setDraftPayload] = useState('');
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    if (!claimId) return;
    const loadClaim = async () => {
      setLoadingClaim(true);
      try {
        const response = await fetch(`/api/issuer/claims?claimId=${claimId}`);
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error || 'Unable to fetch claim');
        }
        setClaim(body.claim as IssuerClaim);
      } catch (error) {
        toast({
          title: 'Failed to load claim',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setLoadingClaim(false);
      }
    };
    loadClaim();
  }, [claimId, toast]);

  const fetchTemplates = useCallback(
    async (targetIssuerId: string) => {
      if (!targetIssuerId) return;
      setLoadingTemplates(true);
      try {
        const response = await fetch(`${API_BASE}/api/templates/${encodeURIComponent(targetIssuerId)}`);
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.message || body?.error || 'Unable to fetch templates');
        }
        setTemplates(body.templates ?? []);
        setSelectedTemplateId(undefined);
        setSelectedVersion(undefined);
        setDraftPayload('');
      } catch (error) {
        toast({
          title: 'Failed to load templates',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setLoadingTemplates(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    fetchTemplates(issuerId);
  }, [fetchTemplates, issuerId]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [templates, selectedTemplateId],
  );

  const activeVersion = useMemo(() => {
    if (!selectedTemplate) return undefined;
    if (selectedVersion) {
      return selectedTemplate.versions.find((version) => version.version === selectedVersion) ?? selectedTemplate.versions[0];
    }
    return selectedTemplate.versions[0];
  }, [selectedTemplate, selectedVersion]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    const version = template?.versions?.[0];
    if (version) {
      setSelectedVersion(version.version);
      setDraftPayload(buildDraftPayload(version.schema ?? template?.schema ?? {}, templateId, version.version, claim));
    }
  };

  const handleVersionChange = (versionValue: string) => {
    if (!selectedTemplate) return;
    const versionNumber = Number(versionValue);
    setSelectedVersion(versionNumber);
    const version = selectedTemplate.versions.find((item) => item.version === versionNumber);
    if (version) {
      setDraftPayload(buildDraftPayload(version.schema ?? {}, selectedTemplate.id, version.version, claim));
    }
  };

  const handleCopy = async () => {
    if (!draftPayload) return;
    await navigator.clipboard.writeText(draftPayload);
    toast({ title: 'Template copied', description: 'JSON payload copied to clipboard.' });
  };

  const handleDownload = () => {
    if (!draftPayload || !selectedTemplate || !activeVersion) return;
    const blob = new Blob([draftPayload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedTemplate.name}-v${activeVersion.version}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleIssue = async () => {
    if (!claimId || !selectedTemplate || !activeVersion) {
      toast({
        title: 'Select a template',
        description: 'Choose a template and version before issuing.',
        variant: 'destructive',
      });
      return;
    }
    setIssuing(true);
    try {
      const response = await fetch(`/api/issuer/issue/${claimId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: `${selectedTemplate.id}:v${activeVersion.version}`,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || 'Issuance failed');
      }
      toast({
        title: 'Credential issued',
        description: `Template ${selectedTemplate.name} (${activeVersion.version}) applied.`,
      });
    } catch (error) {
      toast({
        title: 'Issuance failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="container space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Use credential template</h1>
          <p className="text-muted-foreground">
            Prefill verifiable credential payloads with curated schema presets.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/issuer/claims/${claimId}/psv`}>
            <Shield className="mr-2 h-4 w-4" />
            Back to PSV
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>Template library</CardTitle>
            <CardDescription>Pull templates per issuer and select a version to prefill.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="issuerId">Issuer ID</Label>
                <Input
                  id="issuerId"
                  value={issuerId}
                  onChange={(event) => setIssuerId(event.target.value)}
                  placeholder="demo-issuer"
                />
              </div>
              <Button variant="outline" onClick={() => fetchTemplates(issuerId)} disabled={loadingTemplates}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>

            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates registered for this issuer.</p>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    selected={template.id === selectedTemplateId}
                    onSelect={handleTemplateSelect}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Claim context</CardTitle>
            <CardDescription>Fields used to prefill the template.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {loadingClaim ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading claim...
              </div>
            ) : claim ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{claim.specialty}</Badge>
                  <span>{claim.clinicianName}</span>
                </div>
                <div className="space-y-1">
                  <p>NPI {claim.npi}</p>
                  <p>{claim.facility}</p>
                  <p>License: {claim.autoParsed.license.state} · {claim.autoParsed.license.number}</p>
                  <p>Board: {claim.autoParsed.board.name} #{claim.autoParsed.board.certificateId}</p>
                </div>
              </>
            ) : (
              <p>Claim not found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Prefilled credential payload
            </CardTitle>
            <CardDescription>Select a template + version to view and edit the JSON envelope.</CardDescription>
          </div>
          {selectedTemplate && (
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground">Version</Label>
                <Select
                  value={String(activeVersion?.version ?? '')}
                  onValueChange={handleVersionChange}
                  disabled={!selectedTemplate}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Pick version" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedTemplate.versions.map((version) => (
                      <SelectItem key={version.id} value={String(version.version)}>
                        v{version.version} · {new Date(version.createdAt).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="outline">Current v{selectedTemplate.currentVersion}</Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => selectedTemplate && activeVersion && setDraftPayload(buildDraftPayload(activeVersion.schema ?? {}, selectedTemplate.id, activeVersion.version, claim))} disabled={!selectedTemplate}>
              <Wand2 className="mr-2 h-4 w-4" />
              Prefill again
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!draftPayload}>
              <ClipboardCopy className="mr-2 h-4 w-4" />
              Copy JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!draftPayload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
          <Textarea
            value={draftPayload}
            onChange={(event) => setDraftPayload(event.target.value)}
            rows={20}
            className="font-mono text-xs"
            placeholder="{ ... }"
          />
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleIssue} disabled={issuing || !selectedTemplate} className="gap-2">
              {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
              Issue with template
            </Button>
            {selectedTemplate && activeVersion && (
              <p className="text-xs text-muted-foreground">
                Issuing as {selectedTemplate.name} · version {activeVersion.version}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: CredentialTemplateRecord;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      className={`w-full rounded-lg border p-4 text-left transition hover:border-primary ${
        selected ? 'border-primary bg-primary/5' : 'border-border'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{template.name}</p>
          <p className="text-xs text-muted-foreground">
            Updated {new Date(template.updatedAt).toLocaleString()}
          </p>
        </div>
        <Badge variant={selected ? 'default' : 'outline'}>v{template.currentVersion}</Badge>
      </div>
      {template.metadata && (
        <p className="mt-2 text-xs text-muted-foreground">
          {JSON.stringify(template.metadata)}
        </p>
      )}
    </button>
  );
}

function buildDraftPayload(
  schema: Record<string, any>,
  templateId: string,
  version: number,
  claim: IssuerClaim | null,
) {
  const payload = JSON.parse(JSON.stringify(schema ?? {}));
  payload.credentialSubject = {
    ...(payload.credentialSubject ?? {}),
    clinicianName: claim?.clinicianName,
    npi: claim?.npi,
    specialty: claim?.specialty,
    facility: claim?.facility,
    license: claim?.autoParsed.license,
    boardCertification: claim?.autoParsed.board,
  };
  payload.metadata = {
    ...(payload.metadata ?? {}),
    claimId: claim?.id,
    templateId,
    templateVersion: `v${version}`,
  };
  return JSON.stringify(payload, null, 2);
}










