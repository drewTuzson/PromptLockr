import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Database, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ExportJob, CreateExportJob } from '@shared/schema';

interface ExportManagerProps {
  className?: string;
}

type ExportType = 'full' | 'prompts' | 'collections';
type ExportFormat = 'json' | 'csv' | 'markdown';

const exportTypeOptions = [
  { value: 'full' as const, label: 'Full Export', description: 'All prompts and collections', icon: Database },
  { value: 'prompts' as const, label: 'Prompts Only', description: 'All your prompts', icon: FileText },
  { value: 'collections' as const, label: 'Collections Only', description: 'All your folders', icon: FileText },
];

const formatOptions = [
  { value: 'json' as const, label: 'JSON', description: 'Machine-readable format' },
  { value: 'csv' as const, label: 'CSV', description: 'Spreadsheet format' },
  { value: 'markdown' as const, label: 'Markdown', description: 'Human-readable format' },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return Clock;
    case 'processing':
      return RefreshCw;
    case 'completed':
      return CheckCircle;
    case 'failed':
      return XCircle;
    default:
      return AlertCircle;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'processing':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return 'Unknown size';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export function ExportManager({ className }: ExportManagerProps) {
  const [selectedType, setSelectedType] = useState<ExportType>('full');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const { toast } = useToast();

  // Fetch recent export jobs
  const { data: exportJobs = [], isLoading: isLoadingJobs } = useQuery<ExportJob[]>({
    queryKey: ['/api/export/jobs'],
    refetchInterval: 5000, // Poll every 5 seconds for status updates
  });

  // Create export job mutation
  const createExportMutation = useMutation({
    mutationFn: async (data: CreateExportJob) => {
      return await apiRequest('POST', '/api/export', data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/export/jobs'] });
      toast({
        title: "Export Started",
        description: `Your ${selectedType} export in ${selectedFormat.toUpperCase()} format has been queued for processing.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed", 
        description: error.message || "Failed to start export job",
        variant: "destructive",
      });
    },
  });

  // Download export file mutation
  const downloadMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/export/${jobId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Download failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'export.json';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Download Complete",
        description: "Your export file has been downloaded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download export file",
        variant: "destructive",
      });
    },
  });

  const handleCreateExport = () => {
    createExportMutation.mutate({
      exportType: selectedType,
      format: selectedFormat,
    });
  };

  const handleDownload = (jobId: string) => {
    downloadMutation.mutate(jobId);
  };

  const getEstimatedTime = (type: ExportType) => {
    const estimates = { full: 3, prompts: 1, collections: 1 };
    return estimates[type] || 2;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Download className="w-5 h-5" />
          <span>Export Data</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Configuration */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="export-type">Export Type</Label>
            <Select value={selectedType} onValueChange={(value: ExportType) => setSelectedType(value)}>
              <SelectTrigger data-testid="select-export-type">
                <SelectValue placeholder="Select what to export" />
              </SelectTrigger>
              <SelectContent>
                {exportTypeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center space-x-2">
                        <Icon className="w-4 h-4" />
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="export-format">Format</Label>
            <Select value={selectedFormat} onValueChange={(value: ExportFormat) => setSelectedFormat(value)}>
              <SelectTrigger data-testid="select-export-format">
                <SelectValue placeholder="Select export format" />
              </SelectTrigger>
              <SelectContent>
                {formatOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="text-sm">
              <div className="font-medium">Estimated time: ~{getEstimatedTime(selectedType)} minutes</div>
              <div className="text-muted-foreground">You'll be able to download when ready</div>
            </div>
            <Button 
              onClick={handleCreateExport}
              disabled={createExportMutation.isPending}
              data-testid="button-start-export"
            >
              {createExportMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Start Export
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Recent Export Jobs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Recent Exports</h4>
            {isLoadingJobs && <RefreshCw className="w-4 h-4 animate-spin" />}
          </div>

          {exportJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Download className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No exports yet. Create your first export above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exportJobs.slice(0, 5).map((job: ExportJob) => {
                const StatusIcon = getStatusIcon(job.status || 'unknown');
                const isCompleted = job.status === 'completed';
                const isFailed = job.status === 'failed';
                const isProcessing = job.status === 'processing';

                return (
                  <div 
                    key={job.id} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`job-${job.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <StatusIcon 
                        className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`}
                      />
                      <div>
                        <div className="font-medium text-sm">
                          {exportTypeOptions.find(opt => opt.value === job.exportType)?.label} 
                          ({job.format.toUpperCase()})
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {job.createdAt ? new Date(job.createdAt).toLocaleString() : 'Unknown date'}
                          {job.fileSize && isCompleted && ` • ${formatFileSize(job.fileSize)}`}
                        </div>
                        {isFailed && job.errorMessage && (
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {job.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Badge 
                        className={getStatusColor(job.status || 'unknown')}
                        data-testid={`status-${job.status || 'unknown'}`}
                      >
                        {job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1) : 'Unknown'}
                      </Badge>
                      
                      {isCompleted && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(job.id)}
                          disabled={downloadMutation.isPending}
                          data-testid={`button-download-${job.id}`}
                        >
                          {downloadMutation.isPending ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}