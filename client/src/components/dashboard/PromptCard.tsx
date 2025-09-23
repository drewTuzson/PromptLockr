import { useState } from 'react';
import { Heart, Copy, MoreVertical, Edit, Trash2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Prompt } from '@shared/schema';
import { useUpdatePrompt, useDeletePrompt } from '@/hooks/usePrompts';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { EnhancementModal } from '@/components/enhancement/EnhancementModal';

interface PromptCardProps {
  prompt: Prompt;
  onEdit?: (prompt: Prompt) => void;
  onClick?: (prompt: Prompt) => void;
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

export function PromptCard({ prompt, onEdit, onClick }: PromptCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showEnhancement, setShowEnhancement] = useState(false);
  const updatePrompt = useUpdatePrompt();
  const deletePrompt = useDeletePrompt();
  const { toast } = useToast();

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
    if (confirm('Are you sure you want to delete this prompt?')) {
      deletePrompt.mutate(prompt.id);
    }
  };

  const formatLastAccessed = (date: Date | string | null) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 60) return `Used ${minutes}m ago`;
    if (hours < 24) return `Used ${hours}h ago`;
    if (days === 1) return 'Used 1 day ago';
    if (days < 7) return `Used ${days} days ago`;
    return `Used ${Math.floor(days / 7)}w ago`;
  };

  return (
    <>
      <Card 
        data-testid={`card-prompt-${prompt.id}`}
        className="shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onClick?.(prompt)}
      >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <Badge 
            className={cn("text-xs px-2.5 py-1 rounded-full font-medium hover-bg-consistent", platformClasses[prompt.platform] || platformClasses['Custom/Other'])}
          >
            {prompt.platform}
          </Badge>
          <div className={cn(
            "flex items-center space-x-2 transition-opacity",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            <Button
              data-testid="button-copy"
              variant="ghost"
              size="sm"
              className="p-1.5 h-auto hover-bg-consistent"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
            >
              <Copy className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              data-testid="button-favorite"
              variant="ghost"
              size="sm"
              className="p-1.5 h-auto hover-bg-consistent"
              onClick={(e) => {
                e.stopPropagation();
                handleFavoriteToggle();
              }}
            >
              <Heart 
                className={cn(
                  "w-4 h-4 transition-colors",
                  prompt.isFavorite ? "text-accent fill-current" : "text-muted-foreground"
                )} 
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  data-testid="button-menu"
                  variant="ghost"
                  size="sm"
                  className="p-1.5 h-auto hover-bg-consistent"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(prompt);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEnhancement(true);
                  }}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Enhance with AI
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className="text-destructive hover:!bg-destructive hover:!text-destructive-foreground focus:!bg-destructive focus:!text-destructive-foreground"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <h3 
          data-testid="text-prompt-title"
          className="font-semibold text-foreground mb-2 line-clamp-2"
        >
          {prompt.title}
        </h3>
        
        <p 
          data-testid="text-prompt-content"
          className="text-sm text-muted-foreground mb-4 line-clamp-3"
        >
          {prompt.content}
        </p>
        
        {prompt.tags && prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {prompt.tags.map((tag, index) => (
              <Badge 
                key={index}
                variant="secondary"
                className="text-xs px-2 py-1 rounded-md"
                data-testid={`tag-${tag}-${index}`}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span data-testid="text-last-accessed">{formatLastAccessed(prompt.lastAccessed)}</span>
          <span data-testid="text-char-count">{prompt.charCount} chars</span>
        </div>
      </CardContent>
      </Card>

      {showEnhancement && (
        <EnhancementModal
          isOpen={showEnhancement}
          onClose={() => setShowEnhancement(false)}
          promptId={prompt.id}
          initialContent={prompt.content}
          mode="existing"
          onEnhanced={async (enhanced) => {
            updatePrompt.mutate({
              id: prompt.id,
              content: enhanced
            });
            setShowEnhancement(false);
          }}
        />
      )}
    </>
  );
}
