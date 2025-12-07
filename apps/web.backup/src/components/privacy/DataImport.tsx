'use client'

import { useState, useRef } from 'react'
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type ImportSource = 'file' | 'external-vault' | 'api'
type ImportStatus = 'idle' | 'validating' | 'preview' | 'importing' | 'completed' | 'failed'

interface PreviewRecord {
  id: string
  type: string
  title: string
  date: string
  status: 'valid' | 'warning' | 'error'
  message?: string
}

interface ImportState {
  source: ImportSource
  status: ImportStatus
  file: File | null
  externalVaultUrl: string
  externalVaultCredentials: {
    apiKey: string
    secret: string
  }
  previewRecords: PreviewRecord[]
  progress: number
  error: string | null
}

export default function DataImport() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ImportState>({
    source: 'file',
    status: 'idle',
    file: null,
    externalVaultUrl: '',
    externalVaultCredentials: {
      apiKey: '',
      secret: '',
    },
    previewRecords: [],
    progress: 0,
    error: null,
  })
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setState((prev) => ({ ...prev, file, status: 'validating', error: null }))

    // Simulate file validation
    setTimeout(() => {
      const mockPreview: PreviewRecord[] = [
        {
          id: '1',
          type: 'Credential',
          title: 'Medical License',
          date: '2024-01-15',
          status: 'valid',
        },
        {
          id: '2',
          type: 'Credential',
          title: 'Board Certification',
          date: '2024-02-20',
          status: 'valid',
        },
        {
          id: '3',
          type: 'Contract',
          title: 'Employment Agreement',
          date: '2024-03-10',
          status: 'warning',
          message: 'Missing signature field',
        },
        {
          id: '4',
          type: 'Credential',
          title: 'Invalid Record',
          date: 'invalid',
          status: 'error',
          message: 'Invalid date format',
        },
      ]

      setState((prev) => ({
        ...prev,
        previewRecords: mockPreview,
        status: 'preview',
      }))
    }, 1500)
  }

  async function handleExternalVaultConnect() {
    if (!state.externalVaultUrl || !state.externalVaultCredentials.apiKey) {
      setState((prev) => ({
        ...prev,
        error: 'Please provide vault URL and API key',
      }))
      return
    }

    setState((prev) => ({ ...prev, status: 'validating', error: null }))

    // Simulate connection and validation
    setTimeout(() => {
      const mockPreview: PreviewRecord[] = [
        {
          id: 'ext-1',
          type: 'Credential',
          title: 'Professional License',
          date: '2023-12-01',
          status: 'valid',
        },
        {
          id: 'ext-2',
          type: 'Credential',
          title: 'Specialty Certification',
          date: '2023-11-15',
          status: 'valid',
        },
      ]

      setState((prev) => ({
        ...prev,
        previewRecords: mockPreview,
        status: 'preview',
      }))
    }, 2000)
  }

  async function handleImport() {
    setShowConfirmDialog(false)
    setState((prev) => ({ ...prev, status: 'importing', progress: 0 }))

    // Simulate import progress
    const interval = setInterval(() => {
      setState((prev) => {
        const newProgress = Math.min(prev.progress + 10, 100)
        if (newProgress >= 100) {
          clearInterval(interval)
          return {
            ...prev,
            status: 'completed',
            progress: 100,
          }
        }
        return {
          ...prev,
          progress: newProgress,
        }
      })
    }, 500)
  }

  function resetImport() {
    setState({
      source: 'file',
      status: 'idle',
      file: null,
      externalVaultUrl: '',
      externalVaultCredentials: {
        apiKey: '',
        secret: '',
      },
      previewRecords: [],
      progress: 0,
      error: null,
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const validRecords = state.previewRecords.filter((r) => r.status === 'valid').length
  const warningRecords = state.previewRecords.filter((r) => r.status === 'warning').length
  const errorRecords = state.previewRecords.filter((r) => r.status === 'error').length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data
          </CardTitle>
          <CardDescription>
            Upload a file or connect to an external vault to import your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Source Selection */}
          <div className="space-y-3">
            <Label>Import Source</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setState((prev) => ({ ...prev, source: 'file', status: 'idle' }))}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  state.source === 'file'
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-accent'
                }`}
              >
                <FileText className="h-5 w-5 mb-2" />
                <div className="font-medium">Upload File</div>
                <div className="text-sm text-muted-foreground">JSON, CSV, or XML</div>
              </button>
              <button
                onClick={() =>
                  setState((prev) => ({ ...prev, source: 'external-vault', status: 'idle' }))
                }
                className={`p-4 border rounded-lg text-left transition-colors ${
                  state.source === 'external-vault'
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-accent'
                }`}
              >
                <ExternalLink className="h-5 w-5 mb-2" />
                <div className="font-medium">External Vault</div>
                <div className="text-sm text-muted-foreground">Connect via API</div>
              </button>
              <button
                onClick={() => setState((prev) => ({ ...prev, source: 'api', status: 'idle' }))}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  state.source === 'api'
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-accent'
                }`}
                disabled
              >
                <ExternalLink className="h-5 w-5 mb-2 opacity-50" />
                <div className="font-medium">API Import</div>
                <div className="text-sm text-muted-foreground">Coming soon</div>
              </button>
            </div>
          </div>

          {/* File Upload */}
          {state.source === 'file' && (
            <div className="space-y-3">
              <Label>Select File</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,.xml"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {state.file ? (
                    <div className="space-y-2">
                      <FileText className="h-8 w-8 mx-auto text-primary" />
                      <div className="font-medium">{state.file.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {(state.file.size / 1024).toFixed(2)} KB
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          resetImport()
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <div className="font-medium">Click to upload or drag and drop</div>
                      <div className="text-sm text-muted-foreground">
                        JSON, CSV, or XML files up to 10MB
                      </div>
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* External Vault Connection */}
          {state.source === 'external-vault' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Vault URL</Label>
                <Input
                  placeholder="https://vault.example.com/api"
                  value={state.externalVaultUrl}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, externalVaultUrl: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="Enter API key"
                  value={state.externalVaultCredentials.apiKey}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      externalVaultCredentials: {
                        ...prev.externalVaultCredentials,
                        apiKey: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Secret (Optional)</Label>
                <Input
                  type="password"
                  placeholder="Enter secret if required"
                  value={state.externalVaultCredentials.secret}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      externalVaultCredentials: {
                        ...prev.externalVaultCredentials,
                        secret: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              <Button onClick={handleExternalVaultConnect} className="w-full">
                Connect and Validate
              </Button>
            </div>
          )}

          {/* Validation Status */}
          {state.status === 'validating' && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Validating file/credentials...</span>
            </div>
          )}

          {/* Error Message */}
          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {state.status === 'preview' && state.previewRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Import Preview</CardTitle>
            <CardDescription>
              Review the records that will be imported. You can proceed with valid records only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4">
              <Badge variant="default">{validRecords} Valid</Badge>
              {warningRecords > 0 && <Badge variant="secondary">{warningRecords} Warnings</Badge>}
              {errorRecords > 0 && <Badge variant="destructive">{errorRecords} Errors</Badge>}
            </div>

            {/* Records Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.previewRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.type}</TableCell>
                    <TableCell className="font-medium">{record.title}</TableCell>
                    <TableCell>{record.date}</TableCell>
                    <TableCell>
                      {record.status === 'valid' && (
                        <Badge variant="default">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Valid
                        </Badge>
                      )}
                      {record.status === 'warning' && (
                        <Badge variant="secondary">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Warning
                        </Badge>
                      )}
                      {record.status === 'error' && (
                        <Badge variant="destructive">
                          <X className="w-3 h-3 mr-1" />
                          Error
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button onClick={() => setShowConfirmDialog(true)} disabled={validRecords === 0}>
                Confirm Import ({validRecords} records)
              </Button>
              <Button variant="outline" onClick={resetImport}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Progress */}
      {state.status === 'importing' && (
        <Card>
          <CardHeader>
            <CardTitle>Importing Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Importing records...</span>
                <span>{state.progress}%</span>
              </div>
              <Progress value={state.progress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Complete */}
      {state.status === 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle>Import Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Successfully imported {validRecords} records</span>
            </div>
            <Button onClick={resetImport}>Import More Data</Button>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Import</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to import {validRecords} record(s) into your vault. This action cannot
              be undone. Do you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>Confirm Import</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

