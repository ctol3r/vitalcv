'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  FileText,
  Save,
  X,
  Eye,
  Code,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface Contract {
  id: string
  title: string
  currentVersionId: string | null
  currentVersion?: ContractVersion
  template?: ContractTemplate
}

interface ContractVersion {
  id: string
  versionNumber: number
  content: string
  changeSummary: string | null
}

interface ContractTemplate {
  id: string
  name: string
  variables: string[] | null
}

interface TemplateVariable {
  name: string
  value: string
}

export default function ContractEditorPage() {
  const router = useRouter()
  const params = useParams()
  const contractId = params.contractId as string
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [changeSummary, setChangeSummary] = useState('')
  const [templateVariables, setTemplateVariables] = useState<TemplateVariable[]>([])
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isDraft, setIsDraft] = useState(true)

  useEffect(() => {
    if (contractId) {
      loadContract()
    }
  }, [contractId])

  useEffect(() => {
    if (contract?.template?.variables) {
      const vars = contract.template.variables.map((name: string) => ({
        name,
        value: '',
      }))
      setTemplateVariables(vars)
    }
  }, [contract?.template])

  async function loadContract() {
    try {
      setLoading(true)
      const response = await fetch(`/api/contracts/${contractId}`)
      if (!response.ok) {
        throw new Error(`Failed to load contract (${response.status})`)
      }
      const data = await response.json()
      setContract(data.contract)
      if (data.contract.currentVersion) {
        setContent(data.contract.currentVersion.content)
      } else if (data.contract.template) {
        // Initialize with template content
        setContent(data.contract.template.content || '')
      }
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load contract')
    } finally {
      setLoading(false)
    }
  }

  function renderTemplateWithVariables(templateContent: string, vars: TemplateVariable[]) {
    let rendered = templateContent
    vars.forEach(({ name, value }) => {
      const placeholder = `{{${name}}}`
      rendered = rendered.replace(new RegExp(placeholder, 'g'), value || `[${name}]`)
    })
    return rendered
  }

  function renderMarkdown(text: string) {
    // Simple markdown rendering - in production, use a proper markdown library like react-markdown
    return (
      <div className="prose prose-sm max-w-none">
        <pre className="whitespace-pre-wrap font-sans">{text}</pre>
      </div>
    )
  }

  async function saveDraft() {
    try {
      setSaving(true)
      const response = await fetch(`/api/contracts/${contractId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          changeSummary: changeSummary || 'Draft saved',
          isDraft: true,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to save draft')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message ?? 'Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  async function submitForReview() {
    try {
      setSaving(true)
      const response = await fetch(`/api/contracts/${contractId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          changeSummary: changeSummary || 'Contract updated',
          isDraft: false,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to submit for review')
      }
      router.push(`/contracts/${contractId}`)
    } catch (err: any) {
      setError(err.message ?? 'Failed to submit for review')
    } finally {
      setSaving(false)
    }
  }

  const previewContent = contract?.template
    ? renderTemplateWithVariables(content, templateVariables)
    : content

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="py-16 text-center text-muted-foreground">Loading contract editor…</div>
      </div>
    )
  }

  if (error && !contract) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/contracts/${contractId}`)}>
              Back to Contract
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/contracts/${contractId}`}
                className="text-sm text-muted-foreground hover:underline"
              >
                Contract
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Edit</span>
            </div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7 text-primary" aria-hidden="true" />
              Edit Contract
            </h1>
            {contract && (
              <p className="text-muted-foreground mt-2">{contract.title}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/contracts/${contractId}`)}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              onClick={submitForReview}
              disabled={saving}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Submit for Review
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>Draft saved successfully</AlertDescription>
        </Alert>
      )}

      {/* Template Variables */}
      {contract?.template && templateVariables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Template Variables</CardTitle>
            <CardDescription>
              Fill in the template variables to customize the contract content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {templateVariables.map((variable, index) => (
                <div key={variable.name} className="space-y-2">
                  <Label htmlFor={`var-${variable.name}`}>
                    {variable.name}
                    {contract.template?.variables?.includes(variable.name) && (
                      <Badge variant="outline" className="ml-2">Required</Badge>
                    )}
                  </Label>
                  <Input
                    id={`var-${variable.name}`}
                    value={variable.value}
                    onChange={(e) => {
                      const updated = [...templateVariables]
                      updated[index].value = e.target.value
                      setTemplateVariables(updated)
                    }}
                    placeholder={`Enter ${variable.name}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Change Summary</CardTitle>
          <CardDescription>
            Describe the changes made in this version
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="Enter a summary of changes..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Editor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contract Content</CardTitle>
              <CardDescription>
                Edit the contract content using markdown
              </CardDescription>
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'edit' | 'preview')}>
              <TabsList>
                <TabsTrigger value="edit">
                  <Code className="h-4 w-4 mr-2" />
                  Edit
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'edit' ? (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter contract content in markdown format..."
              rows={20}
              className="font-mono text-sm"
            />
          ) : (
            <div className="border rounded-lg p-4 bg-muted/50 min-h-[400px]">
              {renderMarkdown(previewContent)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Summary Preview */}
      {changeSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Change Summary Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{changeSummary}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

