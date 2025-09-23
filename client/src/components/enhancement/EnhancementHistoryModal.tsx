import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { History, Copy, Clock, Sparkles, Settings } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { format } from 'date-fns';

interface EnhancementHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  promptId: string;
}

interface HistoryEntry {
  sessionId: string;
  timestamp: string;
  enhanced: string;
  options: {
    platform?: string;
    tone?: string;
    focus?: string;
  };
}

export function EnhancementHistoryModal({ 
  isOpen, 
  onClose, 
  promptId 
}: EnhancementHistoryModalProps) {
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const { toast } = useToast();

  // Fetch enhancement history
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['/api/prompts', promptId, 'enhancement-history'],
    enabled: isOpen && !!promptId
  });

  const history: HistoryEntry[] = (historyData as any)?.history || [];
  const originalContent = (historyData as any)?.original || '';

  const handleCopyContent = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: 'Copied to clipboard',
        description: 'Content has been copied.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to copy',
        description: 'Could not copy content to clipboard.',
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return {
        date: format(date, 'MMM d, yyyy'),
        time: format(date, 'h:mm a')
      };
    } catch (error) {
      return {
        date: 'Unknown',
        time: ''
      };
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Enhancement History
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full w-8 h-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Loading history...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Enhancement History
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            {history.length === 0 
              ? 'No enhancement history available' 
              : `${history.length} enhancement${history.length === 1 ? '' : 's'} found`
            }
          </div>
        </DialogHeader>

        {history.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No enhancements yet</p>
              <p className="text-sm">Start enhancing this prompt to see history here</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex gap-6 min-h-0">
            {/* History List */}
            <div className="w-80 flex-shrink-0">
              <div className="text-sm font-medium mb-3">Enhancement Sessions</div>
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {history.map((entry) => {
                    const { date, time } = formatTimestamp(entry.timestamp);
                    const isSelected = selectedEntry?.sessionId === entry.sessionId;
                    
                    return (
                      <Card 
                        key={entry.sessionId}
                        className={`cursor-pointer transition-all hover:shadow-sm ${
                          isSelected ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => setSelectedEntry(entry)}
                        data-testid={`history-entry-${entry.sessionId}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <div className="text-xs font-medium">{date}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">{time}</div>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mb-2">
                            {entry.options.platform && (
                              <Badge variant="outline" className="text-xs">
                                {entry.options.platform}
                              </Badge>
                            )}
                            {entry.options.tone && (
                              <Badge variant="outline" className="text-xs">
                                {entry.options.tone}
                              </Badge>
                            )}
                            {entry.options.focus && (
                              <Badge variant="outline" className="text-xs">
                                {entry.options.focus}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {entry.enhanced.substring(0, 80)}...
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Content View */}
            <div className="flex-1 min-w-0">
              {selectedEntry ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      <div className="text-sm font-medium">
                        {formatTimestamp(selectedEntry.timestamp).date} at {formatTimestamp(selectedEntry.timestamp).time}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyContent(selectedEntry.enhanced)}
                      data-testid="button-copy-history-content"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                    {/* Original */}
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Original</h4>
                        <Badge variant="outline" className="text-xs">
                          {originalContent.length} chars
                        </Badge>
                      </div>
                      <ScrollArea className="flex-1 border rounded-lg p-3">
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                          {originalContent}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Enhanced */}
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Enhanced</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {selectedEntry.enhanced.length} chars
                          </Badge>
                          <div className="flex gap-1">
                            {selectedEntry.options.platform && (
                              <Badge variant="secondary" className="text-xs">
                                {selectedEntry.options.platform}
                              </Badge>
                            )}
                            {selectedEntry.options.tone && (
                              <Badge variant="secondary" className="text-xs">
                                {selectedEntry.options.tone}
                              </Badge>
                            )}
                            {selectedEntry.options.focus && (
                              <Badge variant="secondary" className="text-xs">
                                {selectedEntry.options.focus}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <ScrollArea className="flex-1 border rounded-lg p-3">
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedEntry.enhanced}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select an enhancement session</p>
                    <p className="text-sm">Choose a session from the list to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <Separator className="my-4" />
        
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}