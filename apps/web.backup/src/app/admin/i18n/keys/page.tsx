/**
 * B252C-I18N-025: TranslationKeyManagement UI
 *
 * Displays translation keys: list with search/filter; shows number of translations
 * and status (complete/incomplete); allows creating new keys, editing default messages;
 * accessible and responsive
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';
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
  Plus,
  Search,
  Edit,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';

interface TranslationKey {
  id: string;
  key: string;
  namespace: string;
  defaultMessage: string;
  description?: string;
  totalLanguages: number;
  translatedLanguages: number;
  isComplete: boolean;
}

export default function TranslationKeyManagementPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<TranslationKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    key: '',
    namespace: 'common',
    defaultMessage: '',
    description: '',
  });

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/i18n/keys');
      if (!response.ok) {
        throw new Error('Failed to fetch translation keys');
      }
      const data = await response.json();
      setKeys(data.keys || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/admin/i18n/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create translation key');
      }

      setShowCreateForm(false);
      setFormData({ key: '', namespace: 'common', defaultMessage: '', description: '' });
      await fetchKeys();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredKeys = keys.filter((key) => {
    const query = searchQuery.toLowerCase();
    return (
      key.key.toLowerCase().includes(query) ||
      key.namespace.toLowerCase().includes(query) ||
      key.defaultMessage.toLowerCase().includes(query) ||
      (key.description && key.description.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading translation keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Translation Keys</h1>
          <p className="text-gray-600">Manage translation keys and their messages</p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Key
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Translation Key</CardTitle>
            <CardDescription>Add a new translation key to the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="common.save"
                  aria-required="true"
                />
              </div>
              <div>
                <Label htmlFor="namespace">Namespace</Label>
                <Input
                  id="namespace"
                  value={formData.namespace}
                  onChange={(e) =>
                    setFormData({ ...formData, namespace: e.target.value })
                  }
                  placeholder="common"
                  aria-required="true"
                />
              </div>
              <div>
                <Label htmlFor="defaultMessage">Default Message</Label>
                <Textarea
                  id="defaultMessage"
                  value={formData.defaultMessage}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultMessage: e.target.value })
                  }
                  placeholder="Save"
                  rows={3}
                  aria-required="true"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Button label for saving"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate}>Create</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({
                      key: '',
                      namespace: 'common',
                      defaultMessage: '',
                      description: '',
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search keys, namespaces, or messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Search translation keys"
            />
          </div>
        </CardContent>
      </Card>

      {/* Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>Translation Keys</CardTitle>
          <CardDescription>
            List of all translation keys in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Default Message</TableHead>
                <TableHead>Translations</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredKeys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'No keys found matching your search' : 'No translation keys found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <div className="font-mono text-sm">{key.key}</div>
                      {key.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {key.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{key.namespace}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate">{key.defaultMessage}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {key.translatedLanguages} / {key.totalLanguages}
                      </span>
                    </TableCell>
                    <TableCell>
                      {key.isComplete ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Complete
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="w-3 h-3 mr-1" />
                          Incomplete
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/i18n/edit/${key.id}`)}
                        aria-label={`Edit translations for ${key.key}`}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
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

