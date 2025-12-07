'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useRoleUX } from '@/contexts/RoleUXContext';

export function RoleGlossary() {
  const { config } = useRoleUX();
  const terms = Object.entries(config?.terminology ?? {});
  if (!terms.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No shared terminology defined for this role yet. Admins can configure the glossary under UX settings.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {terms.map(([term, definition]) => (
        <Card key={term} className="border-dashed">
          <CardContent className="flex flex-col gap-2 py-4">
            <Badge variant="secondary" className="w-fit uppercase">
              {term}
            </Badge>
            <p className="text-sm text-foreground">{definition}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

