import { db } from '../db.js';
import { templates, templateVariables, templateUsage, prompts } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { type Template, type TemplateVariable } from '../../shared/schema.js';

export interface TemplateValidationResult {
  valid: boolean;
  errors?: string[];
  missingRequired?: string[];
  invalidTypes?: Record<string, string>;
}

export interface TemplateInstantiationRequest {
  templateId: string;
  variableValues: Record<string, any>;
  targetFolder?: string;
  title?: string;
}

export class TemplateEngine {
  /**
   * Parse template content to extract variables
   * Variables use {{variableName}} syntax
   */
  parseVariables(content: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables);
  }

  /**
   * Validate template content
   */
  validateTemplate(content: string): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    // Check for unclosed brackets
    const openCount = (content.match(/\{\{/g) || []).length;
    const closeCount = (content.match(/\}\}/g) || []).length;
    
    if (openCount !== closeCount) {
      errors.push('Template has mismatched variable brackets');
    }
    
    // Check for invalid variable names
    const regex = /\{\{([^}]+)\}\}/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const varName = match[1].trim();
      if (!/^\w+$/.test(varName)) {
        errors.push(`Invalid variable name: ${varName}. Use only letters, numbers, and underscores.`);
      }
    }
    
    // Check for empty template
    const withoutVars = content.replace(/\{\{[^}]+\}\}/g, '').trim();
    if (!withoutVars) {
      errors.push('Template cannot be empty after variable removal');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Instantiate template with provided values
   */
  instantiateTemplate(
    content: string,
    variables: TemplateVariable[],
    values: Record<string, any>
  ): { result: string; validation: TemplateValidationResult } {
    const validation = this.validateVariableValues(variables, values);
    
    if (!validation.valid) {
      return { result: content, validation };
    }
    
    let result = content;
    
    // Replace each variable with its value
    for (const variable of variables) {
      const value = values[variable.variableName] ?? (variable.defaultValue || '');
      const formattedValue = this.formatValue(value, variable.variableType || 'text');
      const regex = new RegExp(`\\{\\{${variable.variableName}\\}\\}`, 'g');
      result = result.replace(regex, formattedValue);
    }
    
    return { result, validation };
  }

  /**
   * Validate variable values against template requirements
   */
  validateVariableValues(
    variables: TemplateVariable[],
    values: Record<string, any>
  ): TemplateValidationResult {
    const errors: string[] = [];
    const missingRequired: string[] = [];
    const invalidTypes: Record<string, string> = {};
    
    for (const variable of variables) {
      const value = values[variable.variableName];
      
      // Check required
      if (variable.required && (value === undefined || value === null || value === '')) {
        if (!variable.defaultValue) {
          missingRequired.push(variable.variableName);
        }
      }
      
      // Type validation if value exists
      if (value !== undefined && value !== null && value !== '') {
        switch (variable.variableType) {
          case 'number':
            if (typeof value !== 'number' && isNaN(Number(value))) {
              invalidTypes[variable.variableName] = 'Must be a number';
            } else {
              const num = Number(value);
              if (variable.minValue != null && num < variable.minValue) {
                invalidTypes[variable.variableName] = `Must be at least ${variable.minValue}`;
              }
              if (variable.maxValue != null && num > variable.maxValue) {
                invalidTypes[variable.variableName] = `Must be at most ${variable.maxValue}`;
              }
            }
            break;
            
          case 'dropdown':
            if (variable.options && !variable.options.includes(String(value))) {
              invalidTypes[variable.variableName] = 'Invalid option selected';
            }
            break;
            
          case 'date':
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              invalidTypes[variable.variableName] = 'Invalid date format';
            }
            break;
            
          case 'boolean':
            if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
              invalidTypes[variable.variableName] = 'Must be true or false';
            }
            break;
        }
      }
    }
    
    return {
      valid: missingRequired.length === 0 && Object.keys(invalidTypes).length === 0,
      errors,
      missingRequired: missingRequired.length > 0 ? missingRequired : undefined,
      invalidTypes: Object.keys(invalidTypes).length > 0 ? invalidTypes : undefined
    };
  }

  /**
   * Format value based on variable type
   */
  private formatValue(value: any, type: string): string {
    if (value === null || value === undefined) return '';
    
    switch (type) {
      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        return new Date(value).toLocaleDateString();
        
      case 'boolean':
        return value ? 'yes' : 'no';
        
      case 'number':
        return String(value);
        
      default:
        return String(value);
    }
  }

  /**
   * Convert a prompt to a template
   */
  async convertPromptToTemplate(
    promptContent: string,
    userId: string
  ): Promise<{ templateContent: string; detectedVariables: string[] }> {
    // Detect potential variables (capitalized words, placeholders, etc.)
    const potentialVars = new Set<string>();
    
    // Find [PLACEHOLDER] style
    const bracketRegex = /\[([A-Z_]+)\]/g;
    let match;
    while ((match = bracketRegex.exec(promptContent)) !== null) {
      potentialVars.add(match[1]);
    }
    
    // Find <placeholder> style
    const angleRegex = /<([A-Z_]+)>/g;
    while ((match = angleRegex.exec(promptContent)) !== null) {
      potentialVars.add(match[1]);
    }
    
    // Find CAPS_WORDS that look like placeholders
    const capsRegex = /\b([A-Z][A-Z_]+)\b/g;
    while ((match = capsRegex.exec(promptContent)) !== null) {
      if (match[1].length > 2) { // Avoid short acronyms
        potentialVars.add(match[1]);
      }
    }
    
    // Convert detected patterns to template variables
    let templateContent = promptContent;
    const detectedVariables: string[] = [];
    
    for (const varName of Array.from(potentialVars)) {
      const normalizedName = varName.toLowerCase().replace(/_/g, '_');
      detectedVariables.push(normalizedName);
      
      // Replace all variations with template syntax
      templateContent = templateContent.replace(
        new RegExp(`\\[${varName}\\]|<${varName}>|\\b${varName}\\b`, 'g'),
        `{{${normalizedName}}}`
      );
    }
    
    return { templateContent, detectedVariables };
  }
}

export const templateEngine = new TemplateEngine();