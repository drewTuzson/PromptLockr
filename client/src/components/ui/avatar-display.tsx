import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { generateAvatar, getOptimalAvatarUrl } from '@shared/avatarUtils';

interface AvatarDisplayProps {
  user: {
    username?: string;
    displayName?: string;
    avatar40Url?: string;
    avatar80Url?: string;
    avatar160Url?: string;
    avatar320Url?: string;
    hasCustomAvatar?: boolean;
    avatarGeneratedColor?: string;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOnlineStatus?: boolean;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl'
};

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  user,
  size = 'md',
  className,
  showOnlineStatus = false
}) => {
  // Generate avatar data for fallback
  const generatedAvatar = generateAvatar(user.displayName || '', user.username || '');
  const avatarUrl = getOptimalAvatarUrl({
    ...user,
    hasCustomAvatar: user.hasCustomAvatar || false
  }, size);

  // Use stored avatar color or generate new one
  const backgroundColor = user.avatarGeneratedColor || generatedAvatar.backgroundColor;

  return (
    <div className="relative">
      <Avatar className={cn(sizeClasses[size], className)}>
        {user.hasCustomAvatar && avatarUrl && (
          <AvatarImage 
            src={avatarUrl} 
            alt={user.displayName || user.username || 'User avatar'}
          />
        )}
        <AvatarFallback
          style={{
            backgroundColor: backgroundColor,
            color: generatedAvatar.textColor
          }}
          className="font-medium"
        >
          {generatedAvatar.initials}
        </AvatarFallback>
      </Avatar>
      
      {showOnlineStatus && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full" />
      )}
    </div>
  );
};