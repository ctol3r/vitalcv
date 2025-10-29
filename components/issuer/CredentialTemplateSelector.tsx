'use client';

/**
 * Credential Template Selector
 *
 * Template dropdown for different credential types
 */

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Award, Briefcase, GraduationCap } from 'lucide-react';

export type CredentialTemplate = 'license' | 'board-cert' | 'residency' | 'custom';

interface TemplateConfig {
  id: CredentialTemplate;
  name: string;
  description: string;
  icon: React.ReactNode;
  requiredFields: string[];
  defaultFields: Record<string, string>;
}

const templates: TemplateConfig[] = [
  {
    id: 'license',
    name: 'Medical License',
    description: 'State medical board license',
    icon: <Briefcase className="h-4 w-4" />,
    requiredFields: ['state', 'licenseNumber', 'issuedDate', 'expiresDate'],
    defaultFields: {
      credentialSubject: 'MedicalLicense',
      issuerDid: 'did:web:medical-board',
      credentialSchema: 'https://schema.org/MedicalLicense',
    },
  },
  {
    id: 'board-cert',
    name: 'Board Certification',
    description: 'Specialty board certification',
    icon: <Award className="h-4 w-4" />,
    requiredFields: ['boardName', 'specialty', 'certificationDate', 'certificationNumber'],
    defaultFields: {
      credentialSubject: 'BoardCertification',
      issuerDid: 'did:web:specialty-board',
      credentialSchema: 'https://schema.org/BoardCertification',
    },
  },
  {
    id: 'residency',
    name: 'Residency Completion',
    description: 'Medical residency program completion',
    icon: <GraduationCap className="h-4 w-4" />,
    requiredFields: ['programName', 'completionDate', 'programDirector', 'facility'],
    defaultFields: {
      credentialSubject: 'ResidencyCompletion',
      issuerDid: 'did:web:acgme',
      credentialSchema: 'https://schema.org/EducationalCredential',
    },
  },
  {
    id: 'custom',
    name: 'Custom Credential',
    description: 'Define your own credential type',
    icon: <Badge className="h-4 w-4" />,
    requiredFields: ['credentialType', 'subject', 'issuer'],
    defaultFields: {
      credentialSubject: 'VerifiableCredential',
      issuerDid: '',
      credentialSchema: '',
    },
  },
];

interface CredentialTemplateSelectorProps {
  value?: CredentialTemplate;
  onValueChange: (template: CredentialTemplate) => void;
  onTemplateSelected?: (config: TemplateConfig) => void;
}

export function CredentialTemplateSelector({
  value,
  onValueChange,
  onTemplateSelected,
}: CredentialTemplateSelectorProps) {
  const handleChange = (newValue: CredentialTemplate) => {
    onValueChange(newValue);
    const templateConfig = templates.find((t) => t.id === newValue);
    if (templateConfig && onTemplateSelected) {
      onTemplateSelected(templateConfig);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === value);

  return (
    <div className="space-y-3">
      <Label>Credential Template</Label>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a template" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              <div className="flex items-center gap-2">
                {template.icon}
                <div>
                  <div className="font-medium">{template.name}</div>
                  <div className="text-xs text-muted-foreground">{template.description}</div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedTemplate && (
        <div className="rounded-lg border p-3 bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs">
              Required Fields
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedTemplate.requiredFields.map((field) => (
              <Badge key={field} variant="outline" className="text-xs">
                {field}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function getTemplateConfig(templateId: CredentialTemplate): TemplateConfig | undefined {
  return templates.find((t) => t.id === templateId);
}
