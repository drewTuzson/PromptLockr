import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Copy, 
  Edit, 
  Trash2, 
  Heart,
  Calendar,
  User,
  Folder,
  FileText,
  Sparkles
} from 'lucide-react';
import { Prompt } from '@shared/schema';
import { useUpdatePrompt, useDeletePrompt } from '@/hooks/usePrompts';
import { useFolders } from '@/hooks/useFolders';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { EnhancementModal } from '@/components/enhancement/EnhancementModal';

interface PromptDetailModalProps {
  prompt: Prompt | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (prompt: Prompt) => void;
}

const platformClasses: Record<string, string> = {
  ChatGPT: 'platform-chatgpt',
  Claude: 'platform-claude',
  Perplexity: 'platform-perplexity',
  Gemini: 'platform-gemini',
  Mistral: 'platform-mistral',
  Midjourney: 'platform-midjourney',
  'DALL-E': 'platform-dalle',
  'Stable Diffusion': 'platform-stablediffusion',
  'Leonardo AI': 'platform-leonardo',
  Llama: 'platform-llama',
  Cohere: 'platform-cohere',
  'Custom/Other': 'platform-other',
};

export function PromptDetailModal({ prompt, isOpen, onClose, onEdit }: PromptDetailModalProps) {
  const [isEnhancementModalOpen, setIsEnhancementModalOpen] = useState(false);
  const updatePrompt = useUpdatePrompt();
  const deletePrompt = useDeletePrompt();
  const { data: folders } = useFolders();
  const { toast } = useToast();

  if (!prompt) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      toast({
        title: "Copied to clipboard",
        description: "The prompt content has been copied.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Could not copy the prompt to clipboard.",
      });
    }
  };

  const handleFavoriteToggle = () => {
    updatePrompt.mutate({
      id: prompt.id,
      isFavorite: !prompt.isFavorite,
    });
  };

  const handleDelete = () => {
    deletePrompt.mutate(prompt.id, {
      onSuccess: () => {
        onClose();
      }
    });
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(prompt);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4 pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <DialogTitle className="text-xl font-bold text-left">
                {prompt.title}
              </DialogTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge 
                  className={cn("text-xs px-3 py-1 rounded-full font-medium", platformClasses[prompt.platform] || platformClasses['Custom/Other'])}
                >
                  {prompt.platform}
                </Badge>
                {(prompt.tags || []).map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs px-2 py-1 rounded-full">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Created {prompt.createdAt ? new Date(prompt.createdAt).toLocaleDateString() : 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              <span>{prompt.content.length} characters</span>
            </div>
            {prompt.folderId && (
              <div className="flex items-center gap-1">
                <Folder className="w-3 h-3" />
                <span>{folders?.find(f => f.id === prompt.folderId)?.name || 'In folder'}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Prompt Content
            </h3>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground">
                {prompt.content}
              </pre>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-3">
              <Button
                data-testid={`button-copy-prompt-${prompt.id}`}
                onClick={handleCopy}
                className="flex items-center gap-2 px-6 py-2.5"
              >
                <Copy className="w-4 h-4" />
                Copy to Clipboard
              </Button>
              
              <Button
                data-testid={`button-favorite-prompt-${prompt.id}`}
                variant="outline"
                onClick={handleFavoriteToggle}
                disabled={updatePrompt.isPending}
                className={cn(
                  "flex items-center gap-2",
                  prompt.isFavorite ? "text-red-500" : ""
                )}
              >
                <Heart className={cn("w-4 h-4", prompt.isFavorite ? "fill-current" : "")} />
                {prompt.isFavorite ? "Unfavorite" : "Favorite"}
              </Button>
              
              <Button
                data-testid={`button-enhance-prompt-${prompt.id}`}
                variant="outline"
                onClick={() => setIsEnhancementModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Enhance with AI
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                data-testid={`button-edit-prompt-${prompt.id}`}
                variant="outline"
                onClick={handleEdit}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
              
              <Button
                data-testid={`button-delete-prompt-${prompt.id}`}
                variant="destructive"
                onClick={handleDelete}
                disabled={deletePrompt.isPending}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deletePrompt.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      <EnhancementModal
        isOpen={isEnhancementModalOpen}
        onClose={() => setIsEnhancementModalOpen(false)}
        promptId={prompt.id}
        initialContent={prompt.content}
        mode="existing"
      />
    </Dialog>
  );
}