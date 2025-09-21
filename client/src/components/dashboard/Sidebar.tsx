import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Plus, 
  Upload, 
  Briefcase, 
  Heart, 
  Clock, 
  Trash2, 
  Folder, 
  ChevronRight,
  Sun,
  Moon,
  Settings,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ui/theme-provider';
import { usePrompts, useFavoritePrompts, useRecentPrompts } from '@/hooks/usePrompts';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onCreatePrompt: () => void;
  onImport: () => void;
  className?: string;
}

export function Sidebar({ onCreatePrompt, onImport, className }: SidebarProps) {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();
  
  const { data: allPrompts = [] } = usePrompts();
  const { data: favoritePrompts = [] } = useFavoritePrompts();
  const { data: recentPrompts = [] } = useRecentPrompts();
  
  const [platformFilters, setPlatformFilters] = useState({
    ChatGPT: true,
    Claude: true,
    Midjourney: false,
    'DALL-E': false,
  });

  const getPlatformCount = (platform: string) => {
    return allPrompts.filter(p => p.platform === platform).length;
  };

  const togglePlatformFilter = (platform: string) => {
    setPlatformFilters(prev => ({
      ...prev,
      [platform]: !prev[platform as keyof typeof prev]
    }));
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <aside className={cn("w-64 bg-card border-r border-border min-h-screen sidebar-transition", className)}>
      <div className="p-6 space-y-6">
        {/* Quick Actions */}
        <div className="space-y-3">
          <Button
            data-testid="button-new-prompt"
            onClick={onCreatePrompt}
            className="w-full bg-primary text-primary-foreground py-2.5 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Prompt</span>
          </Button>
          <Button
            data-testid="button-import"
            onClick={onImport}
            variant="outline"
            className="w-full border border-border py-2.5 px-4 rounded-lg font-medium hover:bg-muted transition-colors flex items-center justify-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Import</span>
          </Button>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Navigation
          </div>
          <Link href="/dashboard" className="block">
            <div
              data-testid="link-all-prompts"
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                location === '/dashboard' 
                  ? "bg-muted text-foreground" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Briefcase className="w-4 h-4" />
              <span className="font-medium">All Prompts</span>
              <Badge variant="secondary" className="ml-auto text-xs px-2 py-1 rounded-full">
                {allPrompts.length}
              </Badge>
            </div>
          </Link>
          
          <Link href="/dashboard/favorites" className="block">
            <div
              data-testid="link-favorites"
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                location === '/dashboard/favorites'
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Heart className="w-4 h-4" />
              <span>Favorites</span>
              <Badge variant="default" className="ml-auto text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full">
                {favoritePrompts.length}
              </Badge>
            </div>
          </Link>
          
          <Link href="/dashboard/recent" className="block">
            <div
              data-testid="link-recent"
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                location === '/dashboard/recent'
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Clock className="w-4 h-4" />
              <span>Recent</span>
            </div>
          </Link>
          
          <div className="flex items-center space-x-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
            <Trash2 className="w-4 h-4" />
            <span>Trash</span>
            <Badge variant="secondary" className="ml-auto text-xs px-2 py-1 rounded-full">
              0
            </Badge>
          </div>
        </nav>

        {/* Folders */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Folders
          </div>
          <div className="space-y-1">
            {[
              { name: 'Content Creation', count: 45 },
              { name: 'Development', count: 32 },
              { name: 'Image Generation', count: 28 },
              { name: 'Research & Analysis', count: 22 },
            ].map((folder) => (
              <div
                key={folder.name}
                data-testid={`folder-${folder.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <Folder className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{folder.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{folder.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Filters */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Platforms
          </div>
          <div className="space-y-2">
            {Object.entries(platformFilters).map(([platform, checked]) => (
              <label key={platform} className="flex items-center space-x-3 cursor-pointer">
                <Checkbox
                  data-testid={`checkbox-${platform.toLowerCase()}`}
                  checked={checked}
                  onCheckedChange={() => togglePlatformFilter(platform)}
                  className="rounded border-border text-primary focus:ring-ring"
                />
                <div className={`platform-${platform.toLowerCase().replace('-', '')} text-xs px-2 py-1 rounded-md`}>
                  {platform}
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                  {getPlatformCount(platform)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* User Actions */}
        <div className="border-t border-border pt-6 space-y-2">
          <Button
            data-testid="button-theme-toggle"
            variant="ghost"
            onClick={toggleTheme}
            className="w-full justify-start space-x-3"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </Button>
          
          <Button
            data-testid="button-settings"
            variant="ghost"
            className="w-full justify-start space-x-3"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </Button>
          
          <Button
            data-testid="button-logout"
            variant="ghost"
            onClick={logout}
            className="w-full justify-start space-x-3 text-destructive hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        </div>

        {/* User Info */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-primary-foreground">
                {user?.email.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
