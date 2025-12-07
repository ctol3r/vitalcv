/**
 * B252C-I18N-024: LanguageManagement UI
 *
 * Allows administrators to manage languages: list languages, enable/disable languages,
 * create/edit language definitions; accessible forms; responsive design
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Plus,
  Edit,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from 'lucide-react';

interface Language {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function LanguageManagementPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    nativeName: '',
  });

  useEffect(() => {
    fetchLanguages();
  }, []);

  const fetchLanguages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/i18n/languages');
      if (!response.ok) {
        throw new Error('Failed to fetch languages');
      }
      const data = await response.json();
      setLanguages(data.languages || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/i18n/languages/${id}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle language status');
      }

      await fetchLanguages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/admin/i18n/languages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create language');
      }

      setShowCreateForm(false);
      setFormData({ code: '', name: '', nativeName: '' });
      await fetchLanguages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = async (id: string) => {
    const language = languages.find((l) => l.id === id);
    if (!language) return;

    try {
      const response = await fetch(`/api/admin/i18n/languages/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update language');
      }

      setEditingId(null);
      setFormData({ code: '', name: '', nativeName: '' });
      await fetchLanguages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEdit = (language: Language) => {
    setEditingId(language.id);
    setFormData({
      code: language.code,
      name: language.name,
      nativeName: language.nativeName,
    });
    setShowCreateForm(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading languages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Language Management</h1>
          <p className="text-gray-600">Manage available languages in the system</p>
        </div>
        <Button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setEditingId(null);
            setFormData({ code: '', name: '', nativeName: '' });
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Language
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Create/Edit Form */}
      {(showCreateForm || editingId) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {editingId ? 'Edit Language' : 'Create New Language'}
            </CardTitle>
            <CardDescription>
              {editingId
                ? 'Update language information'
                : 'Add a new language to the system'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="code">Language Code (ISO 639-1)</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="en-US"
                  disabled={!!editingId}
                  aria-required="true"
                />
              </div>
              <div>
                <Label htmlFor="name">English Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="English"
                  aria-required="true"
                />
              </div>
              <div>
                <Label htmlFor="nativeName">Native Name</Label>
                <Input
                  id="nativeName"
                  value={formData.nativeName}
                  onChange={(e) =>
                    setFormData({ ...formData, nativeName: e.target.value })
                  }
                  placeholder="English"
                  aria-required="true"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (editingId) {
                      handleEdit(editingId);
                    } else {
                      handleCreate();
                    }
                  }}
                >
                  {editingId ? 'Update' : 'Create'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingId(null);
                    setFormData({ code: '', name: '', nativeName: '' });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Languages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Languages</CardTitle>
          <CardDescription>
            List of all languages configured in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Native Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {languages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No languages found
                  </TableCell>
                </TableRow>
              ) : (
                languages.map((lang) => (
                  <TableRow key={lang.id}>
                    <TableCell>
                      <Badge variant="outline">{lang.code}</Badge>
                    </TableCell>
                    <TableCell>{lang.name}</TableCell>
                    <TableCell>{lang.nativeName}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleEnabled(lang.id, lang.enabled)}
                        aria-label={`${lang.enabled ? 'Disable' : 'Enable'} ${lang.name}`}
                      >
                        {lang.enabled ? (
                          <>
                            <ToggleRight className="w-4 h-4 mr-2 text-green-600" />
                            Enabled
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 mr-2 text-gray-400" />
                            Disabled
                          </>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(lang)}
                          aria-label={`Edit ${lang.name}`}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

