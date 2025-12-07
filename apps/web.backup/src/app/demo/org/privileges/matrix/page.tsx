'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, CheckCircle2, Filter, Loader2, Search } from 'lucide-react';

interface PrivilegeMatrixEntry {
  id: string;
  privilegeCode: string;
  name: string;
  specialty: string;
  description: string;
  prerequisites: Array<{ type: string; [key: string]: any }>;
  prerequisiteDescriptions: string[];
}

interface MatrixResponse {
  success: boolean;
  data: PrivilegeMatrixEntry[];
}

const PAGE_TITLE = 'Privilege Matrix Browser';

export default function PrivilegeMatrixPage() {
  const [privileges, setPrivileges] = useState<PrivilegeMatrixEntry[]>([]);
  const [specialty, setSpecialty] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Record<string, PrivilegeMatrixEntry>>({});

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    async function fetchMatrix() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (specialty !== 'all') params.append('specialty', specialty);
        if (searchTerm.trim().length > 0) params.append('search', searchTerm.trim());
        const response = await fetch(`/api/privileges/matrix?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload: MatrixResponse = await response.json();
        if (!isCancelled) {
          setPrivileges(payload.data);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Unable to load privilege matrix');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchMatrix();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [specialty, searchTerm]);

  const specialties = useMemo(() => {
    const unique = new Set<string>();
    privileges.forEach((entry) => unique.add(entry.specialty));
    return Array.from(unique).sort();
  }, [privileges]);

  const selectionCount = Object.keys(selectedCodes).length;

  const togglePrivilege = (privilege: PrivilegeMatrixEntry) => {
    setSelectedCodes((current) => {
      const next = { ...current };
      if (next[privilege.privilegeCode]) {
        delete next[privilege.privilegeCode];
      } else {
        next[privilege.privilegeCode] = privilege;
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedCodes({});

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo &raquo; Org &raquo; Privileges</p>
        <h1 className="text-3xl font-bold">{PAGE_TITLE}</h1>
        <p className="text-muted-foreground max-w-3xl">
          Browse our seeded PrivilegeMatrix, filter by specialty, and build a PrivilegeSet v2 selection. Screen reader
          hints and live region updates are included for accessibility.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Search by specialty or keyword to refine privilege definitions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="specialty-select" className="text-sm font-medium">
              Specialty
            </label>
            <select
              id="specialty-select"
              className="border rounded-md px-3 py-2 bg-background"
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
            >
              <option value="all">All specialties</option>
              {specialties.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="search" className="text-sm font-medium">
              Keyword search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by privilege code or name"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card aria-live="polite" aria-atomic="true">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {selectionCount > 0 ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            Selection Summary
          </CardTitle>
          <CardDescription>
            {selectionCount > 0
              ? `${selectionCount} privilege${selectionCount === 1 ? '' : 's'} selected`
              : 'No privileges selected yet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectionCount > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {Object.values(selectedCodes).map((privilege) => (
                  <Badge key={privilege.privilegeCode} variant="secondary">
                    {privilege.privilegeCode}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={clearSelection}>
                  Clear selection
                </Button>
                <Button
                  variant="default"
                  onClick={() => navigator.clipboard.writeText(Object.keys(selectedCodes).join(', '))}
                >
                  Copy codes
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select privileges below to build a PrivilegeSet v2 payload.</p>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error loading privileges</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading privilege matrix…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {privileges.map((privilege) => {
            const selected = Boolean(selectedCodes[privilege.privilegeCode]);
            return (
              <Card key={privilege.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{privilege.name}</CardTitle>
                      <CardDescription>{privilege.privilegeCode}</CardDescription>
                    </div>
                    <Badge variant="secondary">{privilege.specialty}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 flex-1">
                  <p className="text-sm text-muted-foreground">{privilege.description}</p>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Prerequisites</p>
                    {privilege.prerequisiteDescriptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No additional prerequisites recorded.</p>
                    ) : (
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {privilege.prerequisiteDescriptions.map((prereq) => (
                          <li key={prereq}>{prereq}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={selected}
                        aria-label={`Select ${privilege.name}`}
                        onCheckedChange={() => togglePrivilege(privilege)}
                      />
                      Include in PrivilegeSet
                    </label>
                    <Button variant={selected ? 'secondary' : 'outline'} onClick={() => togglePrivilege(privilege)}>
                      {selected ? 'Remove' : 'Add'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {!loading && privileges.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-12">
              No privileges match the selected filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

