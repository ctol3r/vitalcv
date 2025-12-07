/**
 * B252C-I18N-029: LanguagePackUpload UI
 *
 * Page for uploading language pack files (JSON/CSV); validates format;
 * shows import summary (added/updated keys); allows exporting language packs;
 * accessible forms; responsive
 */

'use client';

import { useState, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface ImportSummary {
  added: number;
  updated: number;
  errors: number;
  total: number;
}

export default function LanguagePackUploadPage() {
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ImportSummary | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/json',
        'text/csv',
        'text/plain',
        'application/vnd.ms-excel',
      ];
      const validExtensions = ['.json', '.csv'];

      const isValidType =
        validTypes.includes(file.type) ||
        validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

      if (!isValidType) {
        setError('Please select a JSON or CSV file');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setSuccess(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('format', selectedFile.name.endsWith('.csv') ? 'csv' : 'json');

      const response = await fetch('/api/admin/i18n/languagePacks/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to import language pack');
      }

      const data = await response.json();
      setSuccess(data.summary || { added: 0, updated: 0, errors: 0, total: 0 });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      setExporting(true);
      setError(null);

      const response = await fetch(
        `/api/admin/i18n/languagePacks/export?format=${format}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export language pack');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `language-pack.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Language Pack Management</h1>
        <p className="text-gray-600">
          Import and export language packs in JSON or CSV format
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Import Successful</AlertTitle>
          <AlertDescription className="text-green-700">
            <div className="mt-2 space-y-1">
              <div>Added: {success.added} keys</div>
              <div>Updated: {success.updated} keys</div>
              {success.errors > 0 && (
                <div className="text-orange-700">Errors: {success.errors}</div>
              )}
              <div className="font-medium">Total processed: {success.total} keys</div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Import Language Pack</CardTitle>
            <CardDescription>
              Upload a JSON or CSV file containing translations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Select File</Label>
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    type="file"
                    accept=".json,.csv"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    aria-describedby="file-upload-description"
                  />
                  <p id="file-upload-description" className="mt-1 text-xs text-muted-foreground">
                    Supported formats: JSON, CSV
                  </p>
                </div>
              </div>

              {selectedFile && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{selectedFile.name}</span>
                  <Badge variant="outline">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </Badge>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload and Import
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Export Card */}
        <Card>
          <CardHeader>
            <CardTitle>Export Language Pack</CardTitle>
            <CardDescription>
              Download all translations in JSON or CSV format
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Export Format</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Choose the format for your language pack export
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => handleExport('json')}
                  disabled={exporting}
                  className="w-full justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export as JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleExport('csv')}
                  disabled={exporting}
                  className="w-full justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export as CSV
                </Button>
              </div>

              {exporting && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing export...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Format Information */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>File Format Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">JSON Format</h3>
              <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
                {`{
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete"
}`}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2">CSV Format</h3>
              <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
                {`key,en-US,es-ES,fr-FR
common.save,Save,Guardar,Enregistrer
common.cancel,Cancel,Cancelar,Annuler`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

