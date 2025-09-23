import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Copy, RotateCcw, Clock, AlertCircle } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface RateLimitStatus {
  limit: number;
  remaining: number;
  resetTime: string;
}

interface EnhanceResponse {
  enhanced: string;
  original?: string;
  sessionId: string;
  success: boolean;
}

interface EnhancementModalProps {
  isOpen: boolean;
  onClose: () => void;
  promptId?: string;
  initialContent?: string;
  mode: 'existing' | 'new'; // For existing prompts or during creation
  onEnhanced?: (enhanced: string) => void; // Callback for new prompt creation
}

interface EnhancementOptions {
  platform?: string;
  tone?: 'professional' | 'casual' | 'academic' | 'creative';
  focus?: 'clarity' | 'engagement' | 'specificity' | 'structure';
}

export function EnhancementModal({ 
  isOpen, 
  onClose, 
  promptId, 
  initialContent,
  mode,
  onEnhanced 
}: EnhancementModalProps) {
  const [options, setOptions] = useState<EnhancementOptions>({
    platform: 'ChatGPT',
    tone: 'professional',
    focus: 'clarity'
  });
  const [originalContent, setOriginalContent] = useState(initialContent || '');
  const [enhancedContent, setEnhancedContent] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const { toast } = useToast();

  // Get rate limit status
  const { data: rateLimitStatus, refetch: refetchRateLimit, isLoading: rateLimitLoading } = useQuery<RateLimitStatus>({
    queryKey: ['/api/enhancement/rate-limit'],
    enabled: isOpen
  });

  // Enhancement mutation for existing prompts
  const enhanceExistingMutation = useMutation({
    mutationFn: async (data: EnhancementOptions) => {
      const res = await apiRequest('POST', `/api/prompts/${promptId}/enhance`, {
        platform: data.platform,
        tone: data.tone,
        focus: data.focus
      });
      return res.json();
    },
    onSuccess: (response: EnhanceResponse) => {
      setEnhancedContent(response.enhanced);
      setCurrentSessionId(response.sessionId);
      if (response.original) setOriginalContent(response.original);
      refetchRateLimit();
      // Invalidate cache for history and prompts
      if (promptId) {
        queryClient.invalidateQueries({ queryKey: ['/api/prompts', promptId, 'enhancement-history'] });
        queryClient.invalidateQueries({ queryKey: ['/api/prompts'] });
      }
      toast({
        title: 'Enhancement complete!',
        description: 'Your prompt has been enhanced with AI.',
      });
    },
    onError: (error: any) => {
      const message = error.message || 'Failed to enhance prompt';
      toast({
        variant: 'destructive',
        title: 'Enhancement failed',
        description: message,
      });
    }
  });

  // Enhancement mutation for new prompts
  const enhanceNewMutation = useMutation({
    mutationFn: async (data: { content: string } & EnhancementOptions) => {
      const res = await apiRequest('POST', '/api/prompts/enhance-new', data);
      return res.json();
    },
    onSuccess: (response: EnhanceResponse) => {
      setEnhancedContent(response.enhanced);
      setCurrentSessionId(response.sessionId);
      refetchRateLimit();
      toast({
        title: 'Enhancement complete!',
        description: 'Your prompt has been enhanced with AI.',
      });
    },
    onError: (error: any) => {
      const message = error.message || 'Failed to enhance prompt';
      toast({
        variant: 'destructive',
        title: 'Enhancement failed',
        description: message,
      });
    }
  });

  const handleEnhance = () => {
    if (mode === 'existing' && promptId) {
      enhanceExistingMutation.mutate(options);
    } else if (mode === 'new' && originalContent) {
      enhanceNewMutation.mutate({
        content: originalContent,
        ...options
      });
    }
  };

  const handleCopyEnhanced = async () => {
    if (!enhancedContent) return;
    
    try {
      await navigator.clipboard.writeText(enhancedContent);
      toast({
        title: 'Copied to clipboard',
        description: 'Enhanced content has been copied.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to copy',
        description: 'Could not copy content to clipboard.',
      });
    }
  };

  const handleUseEnhanced = () => {
    if (enhancedContent && onEnhanced) {
      onEnhanced(enhancedContent);
    }
    onClose();
  };

  const handleReset = () => {
    setEnhancedContent('');
    setCurrentSessionId('');
  };

  const isEnhancing = enhanceExistingMutation.isPending || enhanceNewMutation.isPending;
  const canEnhance = rateLimitStatus && rateLimitStatus.remaining > 0;
  const resetTime = rateLimitStatus ? new Date(rateLimitStatus.resetTime) : null;
  const showRateLimitWarning = !rateLimitLoading && rateLimitStatus && rateLimitStatus.remaining <= 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Prompt Enhancement
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Rate Limit: {rateLimitStatus?.remaining || 0}/{rateLimitStatus?.limit || 10} remaining
            </div>
            {resetTime && (
              <div>Resets at {resetTime.toLocaleTimeString()}</div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Configuration Panel */}
          <div className="w-80 flex-shrink-0 space-y-4 p-4 bg-muted/20 rounded-lg">
            <div>
              <label className="text-sm font-medium mb-2 block">Target Platform</label>
              <Select 
                value={options.platform} 
                onValueChange={(value) => setOptions(prev => ({ ...prev, platform: value }))}
              >
                <SelectTrigger data-testid="select-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ChatGPT">ChatGPT</SelectItem>
                  <SelectItem value="Claude">Claude</SelectItem>
                  <SelectItem value="Gemini">Gemini</SelectItem>
                  <SelectItem value="Perplexity">Perplexity</SelectItem>
                  <SelectItem value="Midjourney">Midjourney</SelectItem>
                  <SelectItem value="DALL-E">DALL-E</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tone</label>
              <Select 
                value={options.tone} 
                onValueChange={(value) => setOptions(prev => ({ ...prev, tone: value as any }))}
              >
                <SelectTrigger data-testid="select-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Focus</label>
              <Select 
                value={options.focus} 
                onValueChange={(value) => setOptions(prev => ({ ...prev, focus: value as any }))}
              >
                <SelectTrigger data-testid="select-focus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clarity">Clarity</SelectItem>
                  <SelectItem value="engagement">Engagement</SelectItem>
                  <SelectItem value="specificity">Specificity</SelectItem>
                  <SelectItem value="structure">Structure</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === 'new' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Original Content</label>
                <Textarea
                  data-testid="input-original-content"
                  value={originalContent}
                  onChange={(e) => setOriginalContent(e.target.value)}
                  placeholder="Enter your prompt content to enhance..."
                  className="min-h-[120px] resize-none"
                  maxLength={10000}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {originalContent.length}/10,000 characters
                </div>
              </div>
            )}

            {showRateLimitWarning && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg" data-testid="alert-rate-limit">
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Rate limit exceeded
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {resetTime && `Resets at ${resetTime.toLocaleTimeString()}`}
                </div>
              </div>
            )}
          </div>

          {/* Content Comparison */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* Original */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Original</h3>
                  <Badge variant="outline">
                    {mode === 'existing' ? originalContent.length : 
                     mode === 'new' ? originalContent.length : 0} chars
                  </Badge>
                </div>
                <ScrollArea className="flex-1 border rounded-lg p-4">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {mode === 'existing' ? originalContent : 
                     mode === 'new' ? originalContent : 'No content'}
                  </div>
                </ScrollArea>
              </div>

              {/* Enhanced */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Enhanced</h3>
                  <div className="flex items-center gap-2">
                    {enhancedContent && (
                      <>
                        <Badge variant="outline">
                          {enhancedContent.length} chars
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCopyEnhanced}
                          data-testid="button-copy-enhanced"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <ScrollArea className="flex-1 border rounded-lg p-4">
                  {isEnhancing ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="animate-spin rounded-full w-8 h-8 border-b-2 border-primary"></div>
                      <span className="ml-2">Enhancing with AI...</span>
                    </div>
                  ) : enhancedContent ? (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {enhancedContent}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Click "Enhance" to see AI improvements
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <DialogFooter className="flex-shrink-0">
          <div className="flex items-center gap-3">
            {enhancedContent && (
              <Button 
                variant="outline" 
                onClick={handleReset}
                data-testid="button-reset-enhancement"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            )}
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-enhancement">
              Cancel
            </Button>
            {!enhancedContent ? (
              <Button 
                onClick={handleEnhance}
                disabled={isEnhancing || rateLimitLoading || !canEnhance || (mode === 'new' && !originalContent)}
                data-testid="button-enhance"
              >
                {isEnhancing ? (
                  <div className="animate-spin rounded-full w-4 h-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {isEnhancing ? 'Enhancing...' : 'Enhance'}
              </Button>
            ) : (
              mode === 'new' && (
                <Button onClick={handleUseEnhanced} data-testid="button-use-enhanced">
                  Use Enhanced Version
                </Button>
              )
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}