/**
 * B241C-I18N-028: DocumentTemplateLocalisation
 *
 * Allows admins to upload and manage localised versions of document templates
 * (e.g. policies, contracts); selects correct template based on user's locale;
 * supports preview and versioning
 */

'use client';

import { useState, useMemo } from 'react';
import { Upload, Eye, Download, FileText, Globe, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useTranslation, type Locale } from '@/i18n';
import { cn } from '@/lib/utils';

export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'policy' | 'contract' | 'agreement' | 'other';
  versions: TemplateVersion[];
  defaultLocale: Locale;
}

export interface TemplateVersion {
  id: string;
  locale: Locale;
  version: string;
  content: string;
  uploadedAt: Date;
  uploadedBy: string;
  fileUrl?: string;
}

interface DocumentTemplateLocalisationProps {
  templates?: DocumentTemplate[];
  onUpload?: (templateId: string, locale: Locale, file: File) => Promise<void>;
  onPreview?: (template: DocumentTemplate, version: TemplateVersion) => void;
  onDownload?: (template: DocumentTemplate, version: TemplateVersion) => void;
  className?: string;
}

export function DocumentTemplateLocalisation({
  templates: initialTemplates = [],
  onUpload,
  onPreview,
  onDownload,
  className,
}: DocumentTemplateLocalisationProps) {
  const { locale: userLocale, t } = useTranslation();
  const [templates, setTemplates] = useState<DocumentTemplate[]>(initialTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [uploadLocale, setUploadLocale] = useState<Locale>(userLocale);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewVersion, setPreviewVersion] = useState<TemplateVersion | null>(null);

  // Get available locales
  const availableLocales: Locale[] = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'];

  // Get template for current locale
  const getTemplateForLocale = (template: DocumentTemplate, locale: Locale): TemplateVersion | null => {
    return template.versions.find((v) => v.locale === locale) || null;
  };

  // Check if locale has template
  const hasLocale = (template: DocumentTemplate, locale: Locale): boolean => {
    return template.versions.some((v) => v.locale === locale);
  };

  // Handle file upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedTemplate || !uploadFile) return;

    try {
      if (onUpload) {
        await onUpload(selectedTemplate.id, uploadLocale, uploadFile);
      }

      // Update local state (in production, this would come from the server)
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        const newVersion: TemplateVersion = {
          id: `v${Date.now()}`,
          locale: uploadLocale,
          version: `1.0.${Date.now()}`,
          content,
          uploadedAt: new Date(),
          uploadedBy: 'Current User', // In production, get from auth
        };

        setTemplates((prev) =>
          prev.map((t) =>
            t.id === selectedTemplate.id
              ? {
                  ...t,
                  versions: [...t.versions, newVersion],
                }
              : t
          )
        );
      };
      reader.readAsText(uploadFile);

      // Reset form
      setUploadFile(null);
      setUploadLocale(userLocale);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  // Handle preview
  const handlePreview = (template: DocumentTemplate, version: TemplateVersion) => {
    setPreviewVersion(version);
    if (onPreview) {
      onPreview(template, version);
    }
  };

  // Handle download
  const handleDownload = (template: DocumentTemplate, version: TemplateVersion) => {
    if (onDownload) {
      onDownload(template, version);
      return;
    }

    // Default download behavior
    const blob = new Blob([version.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}-${version.locale}-${version.version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('documents.templates.title', 'Document Templates')}</h2>
          <p className="text-muted-foreground">
            {t('documents.templates.description', 'Manage localized document templates')}
          </p>
        </div>
      </div>

      {/* Templates table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('documents.templates.name', 'Name')}</TableHead>
              <TableHead>{t('documents.templates.type', 'Type')}</TableHead>
              <TableHead>{t('documents.templates.locales', 'Available Locales')}</TableHead>
              <TableHead>{t('documents.templates.versions', 'Versions')}</TableHead>
              <TableHead>{t('common.actions', 'Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {t('documents.templates.noTemplates', 'No templates found')}
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => {
                const userVersion = getTemplateForLocale(template, userLocale);
                const missingLocales = availableLocales.filter((l) => !hasLocale(template, l));

                return (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {template.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{template.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {availableLocales.map((locale) => (
                          <Badge
                            key={locale}
                            variant={hasLocale(template, locale) ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            <Globe className="h-3 w-3 mr-1" />
                            {locale}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <span>{template.versions.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {userVersion && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(template, userVersion)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(template, userVersion)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedTemplate(template)}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {t('common.upload', 'Upload')}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                {t('documents.templates.upload', 'Upload Template')} - {template.name}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>{t('documents.templates.locale', 'Locale')}</Label>
                                <Select value={uploadLocale} onValueChange={(v) => setUploadLocale(v as Locale)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableLocales.map((loc) => (
                                      <SelectItem key={loc} value={loc}>
                                        {loc}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>{t('documents.templates.file', 'File')}</Label>
                                <Input
                                  type="file"
                                  accept=".txt,.md,.html,.docx"
                                  onChange={handleFileSelect}
                                />
                              </div>
                              <Button onClick={handleUpload} disabled={!uploadFile}>
                                <Upload className="h-4 w-4 mr-2" />
                                {t('common.upload', 'Upload')}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Preview dialog */}
      {previewVersion && (
        <Dialog open={!!previewVersion} onOpenChange={() => setPreviewVersion(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>
                {t('documents.templates.preview', 'Template Preview')} - {previewVersion.locale}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-auto">
              <pre className="whitespace-pre-wrap font-mono text-sm">{previewVersion.content}</pre>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

