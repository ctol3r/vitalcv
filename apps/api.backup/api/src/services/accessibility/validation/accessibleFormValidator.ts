/**
 * B242A-ACC-009: AccessibleFormValidator
 *
 * Validates forms for accessible patterns:
 * - Required field announcements
 * - Error messages associated with inputs
 * - Keyboard navigation
 * Returns structured validation results.
 */

export interface FormField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio';
  required?: boolean;
  label?: string;
  labelId?: string;
  errorMessage?: string;
  errorId?: string;
  describedBy?: string;
  hasAriaLabel?: boolean;
  hasAriaLabelledBy?: boolean;
  tabIndex?: number;
}

export interface FormValidationIssue {
  fieldId: string;
  type: 'error' | 'warning';
  criterion: string; // WCAG criterion
  message: string;
  suggestion: string;
}

export interface FormValidationResult {
  valid: boolean;
  issues: FormValidationIssue[];
  summary: {
    totalIssues: number;
    errors: number;
    warnings: number;
  };
}

export class AccessibleFormValidator {
  /**
   * Validate a single form field
   */
  validateField(field: FormField): FormValidationIssue[] {
    const issues: FormValidationIssue[] = [];

    // Check for accessible name (label)
    if (!field.label && !field.hasAriaLabel && !field.hasAriaLabelledBy) {
      issues.push({
        fieldId: field.id,
        type: 'error',
        criterion: '3.3.2 Labels or Instructions',
        message: `Field "${field.name}" is missing an accessible label`,
        suggestion: 'Add a visible label, aria-label, or aria-labelledby attribute',
      });
    }

    // Check for required field indication
    if (field.required) {
      if (!field.label?.includes('required') && !field.label?.includes('*')) {
        issues.push({
          fieldId: field.id,
          type: 'warning',
          criterion: '3.3.2 Labels or Instructions',
          message: `Required field "${field.name}" should indicate it is required`,
          suggestion: 'Add "(required)" to label text or use aria-required="true" with visual indicator',
        });
      }

      // Check for aria-required
      if (!field.hasAriaLabel && !field.labelId) {
        issues.push({
          fieldId: field.id,
          type: 'warning',
          criterion: '3.3.2 Labels or Instructions',
          message: `Required field "${field.name}" should have aria-required="true"`,
          suggestion: 'Add aria-required="true" attribute',
        });
      }
    }

    // Check for error message association
    if (field.errorMessage && !field.errorId && !field.describedBy) {
      issues.push({
        fieldId: field.id,
        type: 'error',
        criterion: '3.3.1 Error Identification',
        message: `Error message for "${field.name}" is not associated with the input`,
        suggestion: 'Use aria-describedby to link error message to input field',
      });
    }

    // Check for proper tab order
    if (field.tabIndex !== undefined && field.tabIndex > 0) {
      issues.push({
        fieldId: field.id,
        type: 'warning',
        criterion: '2.4.3 Focus Order',
        message: `Field "${field.name}" has positive tabIndex`,
        suggestion: 'Use tabIndex="0" or remove tabIndex to use natural DOM order',
      });
    }

    // Check for proper input type
    if (field.type === 'text' && field.name.toLowerCase().includes('email')) {
      issues.push({
        fieldId: field.id,
        type: 'warning',
        criterion: '4.1.2 Name, Role, Value',
        message: `Email field "${field.name}" should use type="email"`,
        suggestion: 'Change input type to "email" for better validation and mobile keyboard',
      });
    }

    return issues;
  }

  /**
   * Validate an entire form
   */
  validateForm(fields: FormField[]): FormValidationResult {
    const allIssues: FormValidationIssue[] = [];

    fields.forEach((field) => {
      const fieldIssues = this.validateField(field);
      allIssues.push(...fieldIssues);
    });

    // Check for duplicate IDs
    const fieldIds = fields.map((f) => f.id);
    const duplicateIds = fieldIds.filter((id, index) => fieldIds.indexOf(id) !== index);
    duplicateIds.forEach((id) => {
      allIssues.push({
        fieldId: id,
        type: 'error',
        criterion: '4.1.1 Parsing',
        message: `Duplicate field ID: ${id}`,
        suggestion: 'Ensure all form field IDs are unique',
      });
    });

    // Check for proper form structure
    const hasSubmitButton = fields.some(
      (f) => f.type === 'submit' || f.name.toLowerCase().includes('submit')
    );
    if (!hasSubmitButton) {
      allIssues.push({
        fieldId: 'form',
        type: 'warning',
        criterion: '3.2.1 On Focus',
        message: 'Form may be missing a submit button',
        suggestion: 'Ensure form has a visible submit button',
      });
    }

    const errors = allIssues.filter((i) => i.type === 'error').length;
    const warnings = allIssues.filter((i) => i.type === 'warning').length;

    return {
      valid: errors === 0,
      issues: allIssues,
      summary: {
        totalIssues: allIssues.length,
        errors,
        warnings,
      },
    };
  }

  /**
   * Generate accessible HTML for a form field
   */
  generateAccessibleFieldHTML(field: FormField): string {
    const labelId = field.labelId || `${field.id}-label`;
    const errorId = field.errorId || `${field.id}-error`;
    const describedBy = field.errorMessage
      ? `${errorId} ${field.describedBy || ''}`.trim()
      : field.describedBy || '';

    let html = '';

    // Label
    if (field.label) {
      html += `<label id="${labelId}" for="${field.id}">${field.label}`;
      if (field.required) {
        html += ' <span aria-label="required">*</span>';
      }
      html += `</label>\n`;
    }

    // Input field
    const ariaAttributes: string[] = [];
    if (field.hasAriaLabel && !field.label) {
      ariaAttributes.push(`aria-label="${field.label || field.name}"`);
    }
    if (field.hasAriaLabelledBy && field.labelId) {
      ariaAttributes.push(`aria-labelledby="${field.labelId}"`);
    }
    if (field.required) {
      ariaAttributes.push('aria-required="true"');
    }
    if (field.errorMessage) {
      ariaAttributes.push(`aria-invalid="true"`);
    }
    if (describedBy) {
      ariaAttributes.push(`aria-describedby="${describedBy}"`);
    }
    if (field.tabIndex !== undefined) {
      ariaAttributes.push(`tabindex="${field.tabIndex}"`);
    }

    html += `<input
      type="${field.type}"
      id="${field.id}"
      name="${field.name}"
      ${ariaAttributes.join(' ')}
      ${field.required ? 'required' : ''}
    />\n`;

    // Error message
    if (field.errorMessage) {
      html += `<div id="${errorId}" role="alert" aria-live="polite">${field.errorMessage}</div>\n`;
    }

    return html;
  }

  /**
   * Validate keyboard navigation order
   */
  validateKeyboardNavigation(fields: FormField[]): FormValidationIssue[] {
    const issues: FormValidationIssue[] = [];
    const sortedFields = [...fields].sort((a, b) => {
      const aIndex = a.tabIndex ?? 0;
      const bIndex = b.tabIndex ?? 0;
      return aIndex - bIndex;
    });

    sortedFields.forEach((field, index) => {
      if (field.tabIndex !== undefined && field.tabIndex > 0) {
        issues.push({
          fieldId: field.id,
          type: 'warning',
          criterion: '2.4.3 Focus Order',
          message: `Field "${field.name}" has positive tabIndex (${field.tabIndex})`,
          suggestion: 'Avoid positive tabIndex values; use natural DOM order or tabIndex="0"',
        });
      }

      // Check for logical order
      if (index > 0) {
        const prevField = sortedFields[index - 1];
        if (
          prevField.type === 'submit' &&
          field.type !== 'submit' &&
          field.tabIndex === undefined
        ) {
          issues.push({
            fieldId: field.id,
            type: 'warning',
            criterion: '2.4.3 Focus Order',
            message: `Field "${field.name}" appears after submit button in tab order`,
            suggestion: 'Submit button should typically be last in tab order',
          });
        }
      }
    });

    return issues;
  }
}

export const accessibleFormValidator = new AccessibleFormValidator();

