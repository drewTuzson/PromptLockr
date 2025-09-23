import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, Calendar, BarChart3, Settings, Type, Hash, CheckSquare, List } from 'lucide-react';
import { type Template, type TemplateVariable } from '@shared/schema';

interface TemplateDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template & {
    variables: TemplateVariable[];
  };
}

export function TemplateDetailModal({
  isOpen,
  onClose,
  template
}: TemplateDetailModalProps) {
  const getVariableTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type className="h-4 w-4" />;
      case 'number': return <Hash className="h-4 w-4" />;
      case 'boolean': return <CheckSquare className="h-4 w-4" />;
      case 'date': return <Calendar className="h-4 w-4" />;
      case 'dropdown': return <List className="h-4 w-4" />;
      default: return <Type className="h-4 w-4" />;
    }
  };

  const getVariableTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'text': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'number': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'boolean': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'date': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'dropdown': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (!template) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="template-detail-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Template Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-xl" data-testid="template-title">
                    {template.title}
                  </CardTitle>
                  {template.description && (
                    <p className="text-muted-foreground" data-testid="template-description">
                      {template.description}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    <span data-testid="text-use-count">{template.useCount || 0} uses</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span data-testid="text-created-date">
                      {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tags and Category */}
              <div className="flex flex-wrap gap-2 pt-2">
                {template.category && (
                  <Badge variant="default" data-testid={`category-${template.category}`}>
                    {template.category}
                  </Badge>
                )}
                {template.tags?.map((tag: string, index: number) => (
                  <Badge key={index} variant="secondary" data-testid={`tag-${tag}`}>
                    {tag}
                  </Badge>
                ))}
                <Badge variant="outline" data-testid="variable-count">
                  {template.variables.length} variable{template.variables.length !== 1 ? 's' : ''}
                </Badge>
                {template.isPublic && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Public
                  </Badge>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Template Content */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Content</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 w-full rounded-md border p-4 bg-muted/30">
                <div 
                  className="whitespace-pre-wrap font-mono text-sm" 
                  data-testid="template-content"
                >
                  {template.content}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground mt-2">
                Variables are marked with <code>&#123;&#123;variableName&#125;&#125;</code> syntax
              </p>
            </CardContent>
          </Card>

          {/* Variables */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Template Variables
              </CardTitle>
            </CardHeader>
            <CardContent>
              {template.variables.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  This template has no configurable variables.
                </p>
              ) : (
                <div className="space-y-4">
                  {template.variables.map((variable, index) => (
                    <Card key={variable.id || index} className="border-muted" data-testid={`variable-${variable.variableName}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getVariableTypeIcon(variable.variableType || 'text')}
                            <h4 className="font-medium" data-testid={`variable-name-${variable.variableName}`}>
                              {variable.variableName}
                            </h4>
                            {variable.required && (
                              <Badge variant="destructive" className="text-xs px-2 py-1">
                                Required
                              </Badge>
                            )}
                          </div>
                          <Badge 
                            className={`text-xs px-2 py-1 ${getVariableTypeBadgeColor(variable.variableType || 'text')}`}
                            data-testid={`variable-type-${variable.variableName}`}
                          >
                            {variable.variableType}
                          </Badge>
                        </div>

                        {variable.description && (
                          <p className="text-sm text-muted-foreground mb-3" data-testid={`variable-description-${variable.variableName}`}>
                            {variable.description}
                          </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                          {variable.defaultValue && (
                            <div>
                              <span className="font-medium">Default:</span>
                              <span className="ml-1 font-mono bg-muted px-1 rounded" data-testid={`variable-default-${variable.variableName}`}>
                                {variable.defaultValue}
                              </span>
                            </div>
                          )}

                          {variable.variableType === 'dropdown' && variable.options && variable.options.length > 0 && (
                            <div className="sm:col-span-2 lg:col-span-3">
                              <span className="font-medium">Options:</span>
                              <div className="flex flex-wrap gap-1 mt-1" data-testid={`variable-options-${variable.variableName}`}>
                                {variable.options.map((option, optionIndex) => (
                                  <Badge key={optionIndex} variant="outline" className="text-xs">
                                    {option}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {variable.variableType === 'number' && (variable.minValue != null || variable.maxValue != null) && (
                            <div data-testid={`variable-range-${variable.variableName}`}>
                              <span className="font-medium">Range:</span>
                              <span className="ml-1 font-mono">
                                {variable.minValue ?? '∞'} - {variable.maxValue ?? '∞'}
                              </span>
                            </div>
                          )}

                          <div>
                            <span className="font-medium">Order:</span>
                            <span className="ml-1" data-testid={`variable-order-${variable.variableName}`}>
                              #{variable.sortOrder || index + 1}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Template ID:</span>
                  <span className="ml-1 font-mono text-muted-foreground" data-testid="template-id">
                    {template.id}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium">Created:</span>
                  <span className="ml-1" data-testid="template-created-full">
                    {template.createdAt ? new Date(template.createdAt).toLocaleString() : 'Unknown'}
                  </span>
                </div>

                {template.updatedAt && template.updatedAt !== template.createdAt && (
                  <div>
                    <span className="font-medium">Last Updated:</span>
                    <span className="ml-1" data-testid="template-updated">
                      {new Date(template.updatedAt).toLocaleString()}
                    </span>
                  </div>
                )}

                <div>
                  <span className="font-medium">Usage Count:</span>
                  <span className="ml-1" data-testid="template-usage-count">
                    {template.useCount || 0} times
                  </span>
                </div>

                <div>
                  <span className="font-medium">Public:</span>
                  <span className="ml-1" data-testid="template-public-status">
                    {template.isPublic ? 'Yes' : 'No'}
                  </span>
                </div>

                <div>
                  <span className="font-medium">Content Length:</span>
                  <span className="ml-1" data-testid="template-content-length">
                    {template.content.length} characters
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}