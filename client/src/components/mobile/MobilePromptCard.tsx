import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AvatarDisplay } from '@/components/ui/avatar-display';
import { useToast } from '@/hooks/use-toast';
import {
  Copy,
  Heart,
  Share,
  MoreVertical,
  Globe,
  Lock,
  Bookmark,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, PanInfo } from 'framer-motion';

interface MobilePromptCardProps {
  prompt: {
    id: string;
    title: string;
    content: string;
    platform?: string;
    tags?: string[];
    isPublic?: boolean;
    isFavorite?: boolean;
    likeCount?: number;
    saveCount?: number;
    remixCount?: number;
    isLiked?: boolean;
    isSaved?: boolean;
    user?: {
      username?: string;
      displayName?: string;
      avatar40Url?: string;
      hasCustomAvatar?: boolean;
      avatarGeneratedColor?: string;
    };
  };
  onLike?: (promptId: string) => void;
  onSave?: (promptId: string) => void;
  onShare?: (promptId: string) => void;
  onCopy?: (promptId: string) => void;
  onViewProfile?: (userId: string) => void;
  className?: string;
}

export const MobilePromptCard: React.FC<MobilePromptCardProps> = ({
  prompt,
  onLike,
  onSave,
  onShare,
  onCopy,
  onViewProfile,
  className
}) => {
  const [showFullContent, setShowFullContent] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleSwipe = (event: any, info: PanInfo) => {
    const offset = info.offset.x;
    
    if (Math.abs(offset) > 100) {
      // Swipe right - quick like
      if (offset > 0) {
        onLike?.(prompt.id);
        toast({
          title: prompt.isLiked ? "Removed from liked" : "Added to liked",
          duration: 2000
        });
      }
      // Swipe left - quick save
      else {
        onSave?.(prompt.id);
        toast({
          title: prompt.isSaved ? "Removed from saved" : "Added to saved",
          duration: 2000
        });
      }
      setSwipeOffset(0);
    } else {
      setSwipeOffset(0);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      toast({
        title: "Copied to clipboard",
        duration: 2000
      });
      onCopy?.(prompt.id);
    } catch (error) {
      toast({
        title: "Failed to copy",
        variant: "destructive",
        duration: 2000
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: prompt.title,
          text: prompt.content,
          url: window.location.href
        });
      } catch (error) {
        // User cancelled or error occurred
      }
    } else {
      // Fallback to clipboard
      handleCopy();
    }
    onShare?.(prompt.id);
  };

  const truncatedContent = prompt.content.length > 150 
    ? `${prompt.content.substring(0, 150)}...` 
    : prompt.content;

  return (
    <motion.div
      ref={cardRef}
      className={cn("w-full", className)}
      drag="x"
      dragConstraints={{ left: -150, right: 150 }}
      dragElastic={0.2}
      onDragEnd={handleSwipe}
      whileDrag={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden touch-manipulation">
        {/* Swipe indicators */}
        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none z-10">
          <div className={cn(
            "flex items-center space-x-2 bg-red-500/90 text-white px-3 py-2 rounded-full transition-opacity",
            swipeOffset > 50 ? "opacity-100" : "opacity-0"
          )}>
            <Heart className="w-4 h-4 fill-current" />
            <span className="text-sm font-medium">Like</span>
          </div>
          <div className={cn(
            "flex items-center space-x-2 bg-blue-500/90 text-white px-3 py-2 rounded-full transition-opacity",
            swipeOffset < -50 ? "opacity-100" : "opacity-0"
          )}>
            <Bookmark className="w-4 h-4 fill-current" />
            <span className="text-sm font-medium">Save</span>
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {prompt.user && (
                <button
                  onClick={() => onViewProfile?.(prompt.id)}
                  className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                  data-testid="button-user-profile"
                >
                  <AvatarDisplay
                    user={{
                      displayName: prompt.user.displayName,
                      username: prompt.user.username,
                      hasCustomAvatar: prompt.user.hasCustomAvatar || false,
                      avatar40Url: prompt.user.avatar40Url,
                      avatarGeneratedColor: prompt.user.avatarGeneratedColor
                    }}
                    size="sm"
                  />
                  <div className="text-left">
                    <div className="text-sm font-medium">
                      {prompt.user.displayName || prompt.user.username || 'Anonymous'}
                    </div>
                    {prompt.user.username && (
                      <div className="text-xs text-muted-foreground">
                        @{prompt.user.username}
                      </div>
                    )}
                  </div>
                </button>
              )}
            </div>
            <div className="flex items-center space-x-1">
              {prompt.isPublic ? (
                <Globe className="w-4 h-4 text-green-600" data-testid="icon-public" />
              ) : (
                <Lock className="w-4 h-4 text-gray-400" data-testid="icon-private" />
              )}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg leading-tight" data-testid="text-prompt-title">
              {prompt.title}
            </h3>
            
            <div 
              className="text-gray-700 dark:text-gray-300 leading-relaxed cursor-pointer"
              onClick={() => setShowFullContent(!showFullContent)}
              data-testid="text-prompt-content"
            >
              {showFullContent ? prompt.content : truncatedContent}
              {prompt.content.length > 150 && (
                <span className="text-primary ml-1 font-medium">
                  {showFullContent ? 'Show less' : 'Show more'}
                </span>
              )}
            </div>

            {/* Platform Badge */}
            {prompt.platform && (
              <Badge variant="secondary" className="text-xs" data-testid={`badge-platform-${prompt.platform.toLowerCase().replace(/\s+/g, '-')}`}>
                {prompt.platform}
              </Badge>
            )}

            {/* Tags */}
            {prompt.tags && prompt.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {prompt.tags.slice(0, 3).map((tag, index) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="text-xs px-2 py-1"
                    data-testid={`tag-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    #{tag}
                  </Badge>
                ))}
                {prompt.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs px-2 py-1">
                    +{prompt.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onLike?.(prompt.id)}
                className={cn(
                  "flex items-center space-x-1 hover:text-red-600 transition-colors",
                  prompt.isLiked && "text-red-600"
                )}
                data-testid="button-like"
              >
                <Heart className={cn("w-4 h-4", prompt.isLiked && "fill-current")} />
                <span className="text-sm">{prompt.likeCount || 0}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSave?.(prompt.id)}
                className={cn(
                  "flex items-center space-x-1 hover:text-blue-600 transition-colors",
                  prompt.isSaved && "text-blue-600"
                )}
                data-testid="button-save"
              >
                <Bookmark className={cn("w-4 h-4", prompt.isSaved && "fill-current")} />
                <span className="text-sm">{prompt.saveCount || 0}</span>
              </Button>

              {prompt.remixCount !== undefined && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center space-x-1 text-purple-600"
                  data-testid="button-remix"
                >
                  <Zap className="w-4 h-4" />
                  <span className="text-sm">{prompt.remixCount}</span>
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="hover:text-primary transition-colors"
                data-testid="button-copy"
              >
                <Copy className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="hover:text-primary transition-colors"
                data-testid="button-share"
              >
                <Share className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="hover:text-primary transition-colors"
                data-testid="button-menu"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};