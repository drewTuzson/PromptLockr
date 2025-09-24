import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, Info, Play, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { type Template, type TemplateVariable } from '@shared/schema';

interface TemplateInstantiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template & {
    variables: TemplateVariable[];
  };
  onInstantiate: (data: {
    templateId: string;
    variableValues: Record<string, any>;
    targetFolder?: string;
    title?: string;
  }) => Promise<void>;
  folders?: Array<{ id: string; name: string; }>;
}

export function TemplateInstantiationModal({
  isOpen,
  onClose,
  template,
  onInstantiate,
  folders = []
}: TemplateInstantiationModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, any>>({});
  const [promptTitle, setPromptTitle] = useState('');
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [previewContent, setPreviewContent] = useState('');

  // Initialize default values and generate preview
  useEffect(() => {
    if (isOpen && template) {
      // Set default values for variables
      const defaultValues: Record<string, any> = {};
      template.variables.forEach((variable) => {
        if (variable.defaultValue) {
          switch (variable.variableType) {
            case 'boolean':
              defaultValues[variable.variableName] = variable.defaultValue === 'true';
              break;
            case 'number':
              defaultValues[variable.variableName] = Number(variable.defaultValue);
              break;
            default:
              defaultValues[variable.variableName] = variable.defaultValue;
          }
        }
      });
      setVariableValues(defaultValues);
      
      // Set default title
      setPromptTitle(`${template.title} - ${new Date().toLocaleDateString()}`);
      
      // Generate initial preview
      generatePreview(template.content, defaultValues);
    }
  }, [isOpen, template]);

  // Update preview when variables change
  useEffect(() => {
    if (template) {
      generatePreview(template.content, variableValues);
    }
  }, [variableValues, template]);

  const generatePreview = (content: string, values: Record<string, any>) => {
    let preview = content;
    
    // Replace variables with their values
    template.variables.forEach((variable) => {
      const value = values[variable.variableName];
      const formattedValue = formatVariableValue(value, variable.variableType || 'text');
      const regex = new RegExp(`\\{\\{${variable.variableName}\\}\\}`, 'g');
      preview = preview.replace(regex, formattedValue);
    });
    
    setPreviewContent(preview);
  };

  const formatVariableValue = (value: any, type: string): string => {
    if (value === null || value === undefined || value === '') {
      return `{{${type.toUpperCase()}_PLACEHOLDER}}`;
    }
    
    switch (type) {
      case 'date':
        if (value instanceof Date) {
          return format(value, 'MMM dd, yyyy');
        }
        return value.toString();
      case 'boolean':
        return value ? 'yes' : 'no';
      case 'number':
        return value.toString();
      default:
        return value.toString();
    }
  };

  const updateVariableValue = (variableName: string, value: any) => {
    setVariableValues(prev => ({
      ...prev,
      [variableName]: value
    }));
  };

  const validateVariables = (): boolean => {
    const errors: string[] = [];
    
    template.variables.forEach((variable) => {
      const value = variableValues[variable.variableName];
      
      // Check required variables
      if (variable.required && (value === undefined || value === null || value === '')) {
        if (!variable.defaultValue) {
          errors.push(`${variable.variableName} is required`);
        }
      }
      
      // Type-specific validation
      if (value !== undefined && value !== null && value !== '') {
        switch (variable.variableType) {
          case 'number':
            const numValue = Number(value);
            if (isNaN(numValue)) {
              errors.push(`${variable.variableName} must be a number`);
            } else {
              if (variable.minValue != null && numValue < variable.minValue) {
                errors.push(`${variable.variableName} must be at least ${variable.minValue}`);
              }
              if (variable.maxValue != null && numValue > variable.maxValue) {
                errors.push(`${variable.variableName} must be at most ${variable.maxValue}`);
              }
            }
            break;
          case 'dropdown':
            if (variable.options && !variable.options.includes(String(value))) {
              errors.push(`${variable.variableName} has invalid option selected`);
            }
            break;
        }
      }
    });
    
    if (errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: errors.join(', '),
        variant: 'destructive',
      });
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateVariables()) return;

    setIsSubmitting(true);
    try {
      await onInstantiate({
        templateId: template.id,
        variableValues,
        targetFolder: targetFolder || undefined,
        title: promptTitle.trim() || undefined
      });

      // Reset form
      setVariableValues({});
      setPromptTitle('');
      setTargetFolder('');
      
      onClose();
      
      toast({
        title: 'Prompt Created',
        description: 'Your prompt has been created from the template.',
      });
    } catch (error: any) {
      console.error('Error instantiating template:', error);
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create prompt from template.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setVariableValues({});
    setPromptTitle('');
    setTargetFolder('');
    setPreviewContent('');
    onClose();
  };

  const renderVariableInput = (variable: TemplateVariable) => {
    const value = variableValues[variable.variableName];
    
    switch (variable.variableType) {
      case 'text':
        return (
          <div key={variable.id}>
            <Label htmlFor={variable.variableName} className="flex items-center gap-1">
              {variable.variableName}
              {variable.required && <span className="text-destructive">*</span>}
            </Label>
            {variable.description && (
              <p className="text-sm text-muted-foreground mb-1">{variable.description}</p>
            )}
            <Textarea
              id={variable.variableName}
              value={value || ''}
              onChange={(e) => updateVariableValue(variable.variableName, e.target.value)}
              placeholder={variable.defaultValue || `Enter ${variable.variableName}...`}
              rows={3}
              data-testid={`input-variable-${variable.variableName}`}
            />
          </div>
        );

      case 'dropdown':
        return (
          <div key={variable.id}>
            <Label className="flex items-center gap-1">
              {variable.variableName}
              {variable.required && <span className="text-destructive">*</span>}
            </Label>
            {variable.description && (
              <p className="text-sm text-muted-foreground mb-1">{variable.description}</p>
            )}
            <Select
              value={value || ''}
              onValueChange={(newValue) => updateVariableValue(variable.variableName, newValue)}
            >
              <SelectTrigger data-testid={`select-variable-${variable.variableName}`}>
                <SelectValue placeholder={`Select ${variable.variableName}...`} />
              </SelectTrigger>
              <SelectContent>
                {variable.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'number':
        return (
          <div key={variable.id}>
            <Label htmlFor={variable.variableName} className="flex items-center gap-1">
              {variable.variableName}
              {variable.required && <span className="text-destructive">*</span>}
            </Label>
            {variable.description && (
              <p className="text-sm text-muted-foreground mb-1">{variable.description}</p>
            )}
            <Input
              id={variable.variableName}
              type="number"
              value={value || ''}
              onChange={(e) => updateVariableValue(variable.variableName, Number(e.target.value) || '')}
              placeholder={variable.defaultValue || `Enter ${variable.variableName}...`}
              min={variable.minValue ?? undefined}
              max={variable.maxValue ?? undefined}
              data-testid={`input-variable-${variable.variableName}`}
            />
            {(variable.minValue != null || variable.maxValue != null) && (
              <p className="text-xs text-muted-foreground mt-1">
                Range: {variable.minValue ?? '∞'} - {variable.maxValue ?? '∞'}
              </p>
            )}
          </div>
        );

      case 'date':
        return (
          <div key={variable.id}>
            <Label className="flex items-center gap-1">
              {variable.variableName}
              {variable.required && <span className="text-destructive">*</span>}
            </Label>
            {variable.description && (
              <p className="text-sm text-muted-foreground mb-1">{variable.description}</p>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !value && 'text-muted-foreground'
                  )}
                  data-testid={`button-date-${variable.variableName}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value ? format(value, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={value}
                  onSelect={(date) => updateVariableValue(variable.variableName, date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );

      case 'boolean':
        return (
          <div key={variable.id}>
            <Label className="flex items-center gap-1">
              {variable.variableName}
              {variable.required && <span className="text-destructive">*</span>}
            </Label>
            {variable.description && (
              <p className="text-sm text-muted-foreground mb-1">{variable.description}</p>
            )}
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id={variable.variableName}
                checked={!!value}
                onCheckedChange={(checked) => updateVariableValue(variable.variableName, !!checked)}
                data-testid={`checkbox-variable-${variable.variableName}`}
              />
              <Label htmlFor={variable.variableName} className="cursor-pointer">
                {value ? 'Yes' : 'No'}
              </Label>
            </div>
          </div>
        );

      default:
        return (
          <div key={variable.id}>
            <Label htmlFor={variable.variableName} className="flex items-center gap-1">
              {variable.variableName}
              {variable.required && <span className="text-destructive">*</span>}
            </Label>
            {variable.description && (
              <p className="text-sm text-muted-foreground mb-1">{variable.description}</p>
            )}
            <Input
              id={variable.variableName}
              value={value || ''}
              onChange={(e) => updateVariableValue(variable.variableName, e.target.value)}
              placeholder={variable.defaultValue || `Enter ${variable.variableName}...`}
              data-testid={`input-variable-${variable.variableName}`}
            />
          </div>
        );
    }
  };

  if (!template) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="instantiate-template-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Create Prompt from Template
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Info */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {template.title}
              </CardTitle>
              {template.description && (
                <p className="text-sm text-muted-foreground">{template.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {template.tags?.map((tag: string, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {template.platform && (
                  <Badge variant="default" className="text-xs">
                    {template.platform}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {template.variables.length} variable{template.variables.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel: Variables */}
            <div className="space-y-6">
              {/* Prompt Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Prompt Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="promptTitle">Title</Label>
                    <Input
                      id="promptTitle"
                      value={promptTitle}
                      onChange={(e) => setPromptTitle(e.target.value)}
                      placeholder="Enter prompt title..."
                      data-testid="input-prompt-title"
                    />
                  </div>

                  {folders.length > 0 && (
                    <div>
                      <Label>Folder</Label>
                      <Select value={targetFolder} onValueChange={setTargetFolder}>
                        <SelectTrigger data-testid="select-target-folder">
                          <SelectValue placeholder="Select folder (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {folders.map((folder) => (
                            <SelectItem key={folder.id} value={folder.id}>
                              {folder.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Variables */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Template Variables</CardTitle>
                  {template.variables.some(v => v.required) && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Fields marked with * are required
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-96">
                    <div className="space-y-4 pr-4">
                      {template.variables.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                          <Info className="h-4 w-4 inline mr-1" />
                          This template has no variables to configure.
                        </p>
                      ) : (
                        template.variables.map(renderVariableInput)
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel: Preview */}
            <div>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96 w-full rounded-md border p-4">
                    <div className="whitespace-pre-wrap font-mono text-sm" data-testid="template-preview">
                      {previewContent || template.content}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-2">
                    Live preview of your prompt with current variable values.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            data-testid="button-create-prompt"
          >
            {isSubmitting ? 'Creating...' : 'Create Prompt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}