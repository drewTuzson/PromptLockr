import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Info, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TemplateVariable {
  variableName: string;
  variableType: 'text' | 'dropdown' | 'number' | 'date' | 'boolean';
  required: boolean;
  defaultValue?: string;
  options?: string[];
  description?: string;
  minValue?: number;
  maxValue?: number;
}

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (templateData: {
    title: string;
    description: string;
    content: string;
    platform?: string;
    tags: string[];
    variables: TemplateVariable[];
  }) => Promise<void>;
  initialContent?: string; // For converting existing prompts to templates
}

export function CreateTemplateModal({ 
  isOpen, 
  onClose, 
  onSubmit,
  initialContent = ''
}: CreateTemplateModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState(initialContent);
  const [platform, setPlatform] = useState('ChatGPT'); // Changed from category to platform with default
  const [tags, setTags] = useState<string[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // Auto-detect variables from content
  const detectVariables = async () => {
    setIsDetecting(true);
    try {
      // Parse {{variableName}} patterns
      const regex = /\{\{(\w+)\}\}/g;
      const detectedVars = new Set<string>();
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        detectedVars.add(match[1]);
      }
      
      // Create variable objects for detected variables
      const newVariables: TemplateVariable[] = Array.from(detectedVars).map(varName => ({
        variableName: varName,
        variableType: 'text' as const,
        required: true,
        description: `Auto-detected variable: ${varName}`
      }));
      
      // Merge with existing variables, avoiding duplicates
      const existingNames = new Set(variables.map(v => v.variableName));
      const uniqueNewVars = newVariables.filter(v => !existingNames.has(v.variableName));
      
      setVariables([...variables, ...uniqueNewVars]);
      
      if (uniqueNewVars.length > 0) {
        toast({
          title: 'Variables Detected',
          description: `Found ${uniqueNewVars.length} variable${uniqueNewVars.length !== 1 ? 's' : ''} in your template content.`,
        });
      } else {
        toast({
          title: 'No New Variables',
          description: 'No new variables detected in the content.',
        });
      }
    } catch (error) {
      console.error('Error detecting variables:', error);
      toast({
        title: 'Detection Failed',
        description: 'Could not detect variables from content.',
        variant: 'destructive',
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const addVariable = () => {
    const newVariable: TemplateVariable = {
      variableName: '',
      variableType: 'text',
      required: true,
      description: ''
    };
    setVariables([...variables, newVariable]);
  };

  const updateVariable = (index: number, updates: Partial<TemplateVariable>) => {
    const updatedVariables = [...variables];
    updatedVariables[index] = { ...updatedVariables[index], ...updates };
    setVariables(updatedVariables);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const validateForm = () => {
    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Template title is required.',
        variant: 'destructive',
      });
      return false;
    }

    if (!content.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Template content is required.',
        variant: 'destructive',
      });
      return false;
    }

    // Validate variables
    for (const [index, variable] of Array.from(variables.entries())) {
      if (!variable.variableName.trim()) {
        toast({
          title: 'Variable Error',
          description: `Variable #${index + 1} must have a name.`,
          variant: 'destructive',
        });
        return false;
      }

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.variableName)) {
        toast({
          title: 'Variable Error',
          description: `Variable "${variable.variableName}" has invalid name. Use only letters, numbers, and underscores.`,
          variant: 'destructive',
        });
        return false;
      }

      if (variable.variableType === 'dropdown' && (!variable.options || variable.options.length === 0)) {
        toast({
          title: 'Variable Error',
          description: `Dropdown variable "${variable.variableName}" must have options.`,
          variant: 'destructive',
        });
        return false;
      }

      if (variable.variableType === 'number') {
        if (variable.minValue !== undefined && variable.maxValue !== undefined && variable.minValue > variable.maxValue) {
          toast({
            title: 'Variable Error',
            description: `Variable "${variable.variableName}" has invalid range.`,
            variant: 'destructive',
          });
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        content: content.trim(),
        platform: platform.trim() || undefined,
        tags,
        variables
      });

      // Reset form
      setTitle('');
      setDescription('');
      setContent('');
      setPlatform('ChatGPT');
      setTags([]);
      setVariables([]);
      setTagInput('');
      
      onClose();
      
      toast({
        title: 'Template Created',
        description: 'Your template has been created successfully.',
      });
    } catch (error: any) {
      console.error('Error creating template:', error);
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create template.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form state
    setTitle('');
    setDescription('');
    setContent(initialContent);
    setPlatform('ChatGPT');
    setTags([]);
    setVariables([]);
    setTagInput('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="create-template-modal">
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Template Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter template title..."
                data-testid="input-title"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this template does..."
                rows={2}
                data-testid="input-description"
              />
            </div>

            <div>
              <Label htmlFor="platform">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger data-testid="select-platform">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ChatGPT">ChatGPT</SelectItem>
                  <SelectItem value="Claude">Claude</SelectItem>
                  <SelectItem value="Perplexity">Perplexity</SelectItem>
                  <SelectItem value="Gemini">Gemini</SelectItem>
                  <SelectItem value="Midjourney">Midjourney</SelectItem>
                  <SelectItem value="DALL-E">DALL-E</SelectItem>
                  <SelectItem value="Copilot">Copilot</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tags</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add tags..."
                  data-testid="input-tag"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addTag}
                  data-testid="button-add-tag"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1" data-testid={`tag-${tag}`}>
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Template Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="content">Template Content *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={detectVariables}
                disabled={isDetecting || !content.trim()}
                data-testid="button-detect-variables"
              >
                <Wand2 className="h-4 w-4 mr-1" />
                {isDetecting ? 'Detecting...' : 'Auto-Detect Variables'}
              </Button>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your template content. Use {{variableName}} for variables..."
              rows={8}
              className="font-mono"
              data-testid="input-content"
            />
            <p className="text-sm text-muted-foreground mt-2">
              <Info className="inline h-4 w-4 mr-1" />
              Use <code>&#123;&#123;variableName&#125;&#125;</code> syntax for variables that users can customize.
            </p>
          </div>

          {/* Variables Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Template Variables</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariable}
                  data-testid="button-add-variable"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Variable
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {variables.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No variables defined. Variables allow users to customize the template content.
                </p>
              ) : (
                <div className="space-y-4">
                  {variables.map((variable, index) => (
                    <Card key={index} className="border-muted" data-testid={`variable-config-${index}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-medium">Variable #{index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVariable(index)}
                            data-testid={`button-remove-variable-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Variable Name *</Label>
                            <Input
                              value={variable.variableName}
                              onChange={(e) => updateVariable(index, { variableName: e.target.value })}
                              placeholder="e.g., productName, userAge"
                              data-testid={`input-variable-name-${index}`}
                            />
                          </div>

                          <div>
                            <Label>Type</Label>
                            <Select
                              value={variable.variableType}
                              onValueChange={(value: any) => updateVariable(index, { variableType: value })}
                            >
                              <SelectTrigger data-testid={`select-variable-type-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="dropdown">Dropdown</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="md:col-span-2">
                            <Label>Description</Label>
                            <Input
                              value={variable.description || ''}
                              onChange={(e) => updateVariable(index, { description: e.target.value })}
                              placeholder="Describe what this variable is for..."
                              data-testid={`input-variable-description-${index}`}
                            />
                          </div>

                          <div>
                            <Label>Default Value</Label>
                            <Input
                              value={variable.defaultValue || ''}
                              onChange={(e) => updateVariable(index, { defaultValue: e.target.value })}
                              placeholder="Optional default value"
                              data-testid={`input-variable-default-${index}`}
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`required-${index}`}
                              checked={variable.required}
                              onCheckedChange={(checked) => updateVariable(index, { required: !!checked })}
                              data-testid={`checkbox-variable-required-${index}`}
                            />
                            <Label htmlFor={`required-${index}`}>Required</Label>
                          </div>

                          {/* Type-specific fields */}
                          {variable.variableType === 'dropdown' && (
                            <div className="md:col-span-2">
                              <Label>Options (comma-separated)</Label>
                              <Input
                                value={variable.options?.join(', ') || ''}
                                onChange={(e) => updateVariable(index, { 
                                  options: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                                })}
                                placeholder="Option 1, Option 2, Option 3"
                                data-testid={`input-variable-options-${index}`}
                              />
                            </div>
                          )}

                          {variable.variableType === 'number' && (
                            <div className="grid grid-cols-2 gap-2 md:col-span-2">
                              <div>
                                <Label>Min Value</Label>
                                <Input
                                  type="number"
                                  value={variable.minValue ?? ''}
                                  onChange={(e) => updateVariable(index, { 
                                    minValue: e.target.value ? Number(e.target.value) : undefined 
                                  })}
                                  placeholder="Minimum"
                                  data-testid={`input-variable-min-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Max Value</Label>
                                <Input
                                  type="number"
                                  value={variable.maxValue ?? ''}
                                  onChange={(e) => updateVariable(index, { 
                                    maxValue: e.target.value ? Number(e.target.value) : undefined 
                                  })}
                                  placeholder="Maximum"
                                  data-testid={`input-variable-max-${index}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
            data-testid="button-create"
            className="hover:bg-[var(--btn-active-bg)] hover:text-[var(--btn-active-fg)]"
          >
            {isSubmitting ? 'Creating...' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}