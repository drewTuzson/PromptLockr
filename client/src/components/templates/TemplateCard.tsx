import { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, FileText, Eye, Trash2, Play, Clock, BarChart3 } from 'lucide-react';
import { type Template, type TemplateVariable } from '@shared/schema';

interface TemplateCardProps {
  template: Template & {
    variables: TemplateVariable[];
  };
  onView: (template: TemplateCardProps['template']) => void;
  onEdit: (template: TemplateCardProps['template']) => void;
  onDelete: (templateId: string) => void;
  onInstantiate: (template: TemplateCardProps['template']) => void;
  onViewUsage: (templateId: string) => void;
}

export function TemplateCard({
  template,
  onView,
  onEdit,
  onDelete,
  onInstantiate,
  onViewUsage
}: TemplateCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(template.id);
    } catch (error) {
      console.error('Error deleting template:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const variableCount = template.variables?.length || 0;
  const requiredVariables = template.variables?.filter(v => v.required === true).length || 0;
  
  // Truncate content for preview
  const contentPreview = template.content.length > 150 
    ? template.content.substring(0, 150) + '...' 
    : template.content;

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border-border/50 bg-card/50 backdrop-blur-sm" data-testid={`template-card-${template.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 
              className="font-medium text-card-foreground mb-1 cursor-pointer hover:text-primary transition-colors"
              onClick={() => onView(template)}
              data-testid="template-title"
            >
              {template.title}
            </h3>
            {template.description && (
              <p className="text-sm text-muted-foreground mb-2" data-testid="template-description">
                {template.description}
              </p>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="template-menu-button">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(template)} data-testid="button-view">
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onInstantiate(template)} data-testid="button-instantiate">
                <Play className="mr-2 h-4 w-4" />
                Create Prompt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(template)} data-testid="button-edit">
                <FileText className="mr-2 h-4 w-4" />
                Edit Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewUsage(template.id)} data-testid="button-usage">
                <BarChart3 className="mr-2 h-4 w-4" />
                Usage History
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-destructive focus:text-destructive"
                data-testid="button-delete"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md border-l-4 border-primary/20">
            <div className="font-mono whitespace-pre-wrap" data-testid="template-content-preview">
              {contentPreview}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span data-testid="text-variable-count">
                {variableCount} variable{variableCount !== 1 ? 's' : ''}
                {requiredVariables > 0 && ` (${requiredVariables} required)`}
              </span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span data-testid="text-created-date">
                {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'Unknown'}
              </span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1" data-testid="text-use-count">
              <BarChart3 className="h-3 w-3" />
              <span>{template.useCount || 0} uses</span>
            </div>
          </div>

          {template.variables && template.variables.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.variables.slice(0, 3).map((variable) => (
                <Badge 
                  key={variable.id} 
                  variant="secondary" 
                  className="text-xs px-2 py-1"
                  data-testid={`variable-badge-${variable.variableName}`}
                >
                  {variable.variableName}
                  {variable.required && <span className="text-destructive ml-1">*</span>}
                </Badge>
              ))}
              {template.variables.length > 3 && (
                <Badge variant="outline" className="text-xs px-2 py-1">
                  +{template.variables.length - 3} more
                </Badge>
              )}
            </div>
          )}

          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.tags.slice(0, 3).map((tag: string, index: number) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs px-2 py-1"
                  data-testid={`tag-${tag}`}
                >
                  {tag}
                </Badge>
              ))}
              {template.tags.length > 3 && (
                <Badge variant="outline" className="text-xs px-2 py-1">
                  +{template.tags.length - 3} more
                </Badge>
              )}
            </div>
          )}

          {template.category && (
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-xs px-2 py-1" data-testid={`category-${template.category}`}>
                {template.category}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="px-4 py-3 bg-muted/20 flex items-center justify-between">
        <Button
          onClick={() => onView(template)}
          variant="ghost"
          size="sm"
          className="text-xs"
          data-testid="button-view-footer"
        >
          <Eye className="mr-1 h-3 w-3" />
          View
        </Button>
        
        <Button
          onClick={() => onInstantiate(template)}
          variant="outline"
          size="sm"
          className="text-xs"
          data-testid="button-create-prompt"
        >
          <Play className="mr-1 h-3 w-3" />
          Create Prompt
        </Button>
      </CardFooter>
    </Card>
  );
}