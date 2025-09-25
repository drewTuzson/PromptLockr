import React from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import {
  Home,
  Search,
  Plus,
  BookOpen,
  User,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MobileNavigationProps {
  onCreateClick?: () => void;
  notificationCount?: number;
}

const navigationItems = [
  { id: 'home', label: 'Home', icon: Home, path: '/dashboard' },
  { id: 'explore', label: 'Explore', icon: Search, path: '/explore' },
  { id: 'create', label: 'Create', icon: Plus, path: null }, // Special create button
  { id: 'library', label: 'Library', icon: BookOpen, path: '/dashboard/library' },
  { id: 'profile', label: 'Profile', icon: User, path: '/profile' }
];

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  onCreateClick,
  notificationCount = 0
}) => {
  const [location, setLocation] = useLocation();

  const handleItemClick = (item: typeof navigationItems[0]) => {
    if (item.id === 'create') {
      onCreateClick?.();
    } else if (item.path) {
      setLocation(item.path);
    }
  };

  const isActive = (path: string | null) => {
    if (!path) return false;
    return location === path || location.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-1 pb-safe">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          if (item.id === 'create') {
            return (
              <Button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={cn(
                  "relative flex flex-col items-center justify-center min-h-[64px] px-3 py-2 rounded-full",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "shadow-lg transform transition-all duration-200",
                  "active:scale-95"
                )}
                size="sm"
                data-testid="button-create-prompt"
              >
                <Icon className="w-6 h-6" />
              </Button>
            );
          }

          return (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => handleItemClick(item)}
              className={cn(
                "relative flex flex-col items-center justify-center min-h-[64px] px-3 py-1 rounded-lg",
                "transition-all duration-200 active:scale-95",
                active
                  ? "text-primary bg-primary/10"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              )}
              data-testid={`button-nav-${item.id}`}
            >
              <div className="relative">
                <Icon className={cn("w-5 h-5", active && "stroke-2")} />
                {item.id === 'profile' && notificationCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 w-5 h-5 p-0 text-xs flex items-center justify-center"
                    data-testid="badge-notification-count"
                  >
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-xs mt-1 transition-opacity duration-200",
                active ? "font-medium" : "font-normal"
              )}>
                {item.label}
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
};