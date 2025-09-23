import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BarChart3, Calendar, FileText, ExternalLink, User, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface TemplateUsageEntry {
  id: string;
  promptId?: string;
  variableValues: Record<string, any>;
  createdAt: string;
}

interface TemplateUsageData {
  templateId: string;
  templateTitle: string;
  useCount: number;
  usage: TemplateUsageEntry[];
}

interface TemplateUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  onViewPrompt?: (promptId: string) => void;
}

export function TemplateUsageModal({
  isOpen,
  onClose,
  templateId,
  onViewPrompt
}: TemplateUsageModalProps) {
  const [selectedUsage, setSelectedUsage] = useState<TemplateUsageEntry | null>(null);

  const {
    data: usageData,
    isLoading,
    error,
    refetch
  } = useQuery<TemplateUsageData>({
    queryKey: ['/api/templates', templateId, 'usage'],
    enabled: isOpen && !!templateId,
  });

  // Reset selected usage when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedUsage(null);
    }
  }, [isOpen]);

  const formatVariableValue = (key: string, value: any): string => {
    if (value === null || value === undefined) {
      return 'Not provided';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (typeof value === 'object' && value instanceof Date) {
      return new Date(value).toLocaleDateString();
    }
    
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    return String(value);
  };

  const handleViewPrompt = (promptId: string) => {
    if (onViewPrompt) {
      onViewPrompt(promptId);
      onClose();
    }
  };

  const renderVariableValues = (values: Record<string, any>) => {
    const entries = Object.entries(values);
    
    if (entries.length === 0) {
      return (
        <p className="text-sm text-muted-foreground italic">
          No variables were configured
        </p>
      );
    }
    
    return (
      <div className="space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between items-start gap-2">
            <span className="text-sm font-medium min-w-0 flex-1 break-words">
              {key}:
            </span>
            <span className="text-sm text-muted-foreground min-w-0 flex-1 break-words text-right">
              {formatVariableValue(key, value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="template-usage-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Template Usage History
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {error && (
            <Card className="border-destructive/50">
              <CardContent className="p-4">
                <p className="text-destructive">
                  Failed to load template usage data. Please try again.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  className="mt-2"
                  data-testid="button-retry"
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {usageData && (
            <>
              {/* Summary Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg" data-testid="template-usage-title">
                        {usageData.templateTitle}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Template Usage Analytics
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary" data-testid="total-usage-count">
                        {usageData.useCount}
                      </div>
                      <p className="text-xs text-muted-foreground">Total Uses</p>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Usage History */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Usage List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Usage Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {usageData.usage.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        This template hasn't been used yet.
                      </p>
                    ) : (
                      <ScrollArea className="h-96">
                        <div className="space-y-3 pr-4">
                          {usageData.usage.map((usage, index) => (
                            <Card
                              key={usage.id}
                              className={`border-muted cursor-pointer transition-colors hover:bg-muted/30 ${
                                selectedUsage?.id === usage.id ? 'ring-2 ring-primary' : ''
                              }`}
                              onClick={() => setSelectedUsage(usage)}
                              data-testid={`usage-entry-${index}`}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline" className="text-xs">
                                    Use #{usageData.usage.length - index}
                                  </Badge>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(usage.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                
                                <div className="text-xs text-muted-foreground">
                                  {Object.keys(usage.variableValues).length} variables configured
                                </div>
                                
                                {usage.promptId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewPrompt(usage.promptId!);
                                    }}
                                    className="mt-2 h-6 text-xs"
                                    data-testid={`button-view-prompt-${index}`}
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    View Prompt
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>

                {/* Variable Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Variable Values
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!selectedUsage ? (
                      <p className="text-muted-foreground text-center py-8">
                        Select a usage entry to view the variable values used.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">Usage Details:</span>
                          <Badge variant="outline" data-testid="selected-usage-date">
                            {new Date(selectedUsage.createdAt).toLocaleString()}
                          </Badge>
                        </div>
                        
                        <Separator />
                        
                        <div data-testid="selected-usage-variables">
                          {renderVariableValues(selectedUsage.variableValues)}
                        </div>

                        {selectedUsage.promptId && (
                          <>
                            <Separator />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewPrompt(selectedUsage.promptId!)}
                              className="w-full"
                              data-testid="button-view-selected-prompt"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View Generated Prompt
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}