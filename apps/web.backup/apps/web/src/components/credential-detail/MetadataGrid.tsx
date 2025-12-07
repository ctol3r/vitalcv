/**
 * MetadataGrid Component
 * Dynamic grid layout for credential metadata fields
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Lock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHapticFeedback } from '@/lib/haptic';
import { useState } from 'react';
import type { Credential } from '@/lib/repositories/credential-repository';
import type { SelectiveDisclosure } from '@/lib/services/trust-service';

interface MetadataGridProps {
  credential: Credential;
  selectiveDisclosure: SelectiveDisclosure;
  className?: string;
}

export function MetadataGrid({ credential, selectiveDisclosure, className }: MetadataGridProps) {
  const [sensitiveOpen, setSensitiveOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['id', 'license']));

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      triggerHapticFeedback('light');
      return next;
    });
  };

  const toggleSensitive = () => {
    setSensitiveOpen((prev) => !prev);
    triggerHapticFeedback('light');
  };

  const claims = credential.subject.claims;
  const categories = credential.fieldCategories || {};

  const renderField = (key: string, value: any, isSensitive = false) => {
    const isHidden = selectiveDisclosure.hidden.includes(key);

    return (
      <div key={key} className="flex justify-between items-start py-2 border-b last:border-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-medium capitalize text-muted-foreground">
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </span>
          {isSensitive && (
            <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
          {isHidden && (
            <Badge variant="outline" className="text-xs">
              Hidden (SD-JWT)
            </Badge>
          )}
        </div>
        <div className="text-sm font-mono text-right ml-4 max-w-md break-words">
          {isHidden ? (
            <span className="text-muted-foreground italic">••••••••</span>
          ) : typeof value === 'object' ? (
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {JSON.stringify(value, null, 2)}
            </code>
          ) : (
            <span>{String(value)}</span>
          )}
        </div>
      </div>
    );
  };

  const renderCategory = (categoryName: string, fields: string[], icon?: React.ReactNode) => {
    const isExpanded = expandedCategories.has(categoryName);
    const categoryFields = fields.filter((f) => claims[f] !== undefined);

    if (categoryFields.length === 0) return null;

    return (
      <Card key={categoryName} className="mb-4">
        <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(categoryName)}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {icon}
                  <span className="capitalize">{categoryName}</span>
                  <Badge variant="secondary" className="ml-2">
                    {categoryFields.length}
                  </Badge>
                </CardTitle>
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {categoryFields.map((field) =>
                  renderField(field, claims[field], selectiveDisclosure.hidden.includes(field)),
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  const uncategorizedFields = Object.keys(claims).filter(
    (key) =>
      !categories.id?.includes(key) &&
      !categories.license?.includes(key) &&
      !categories.cert?.includes(key) &&
      !categories.practice?.includes(key),
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Categorized Fields */}
      {categories.id && renderCategory('ID', categories.id, <Badge className="h-4 w-4 p-0" />)}
      {categories.license &&
        renderCategory('License', categories.license, <Badge className="h-4 w-4 p-0" />)}
      {categories.cert &&
        renderCategory('Certification', categories.cert, <Badge className="h-4 w-4 p-0" />)}
      {categories.practice &&
        renderCategory('Practice', categories.practice, <Badge className="h-4 w-4 p-0" />)}

      {/* Sensitive Information Panel */}
      {selectiveDisclosure.hidden.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <Collapsible open={sensitiveOpen} onOpenChange={toggleSensitive}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-amber-50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                    <Lock className="h-4 w-4" />
                    Sensitive Information (SD-JWT)
                    <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800">
                      {selectiveDisclosure.hidden.length} hidden
                    </Badge>
                  </CardTitle>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform text-amber-700',
                      sensitiveOpen && 'rotate-180',
                    )}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <p className="text-sm text-amber-800">
                    The following fields are hidden using Selective Disclosure JSON Web Token
                    (SD-JWT) patterns for privacy protection.
                  </p>
                  <div className="space-y-1">
                    {selectiveDisclosure.hidden.map((field) => (
                      <div
                        key={field}
                        className="flex items-center justify-between py-2 border-b border-amber-200 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <Lock className="h-3 w-3 text-amber-600" />
                          <span className="text-sm font-medium capitalize text-amber-900">
                            {field.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs bg-amber-100 border-amber-300">
                          Hidden
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {selectiveDisclosure.rationale && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                      <p className="text-xs text-amber-700">
                        <strong>Rationale:</strong> Fields are hidden to protect personal
                        information while maintaining credential verifiability.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Uncategorized Fields */}
      {uncategorizedFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {uncategorizedFields.map((field) =>
                renderField(field, claims[field], selectiveDisclosure.hidden.includes(field)),
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

