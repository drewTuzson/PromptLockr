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
  LogOut,
  Check,
  X,
  File
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ui/theme-provider';
import { usePrompts, useFavoritePrompts, useRecentPrompts, useTrashedPrompts } from '@/hooks/usePrompts';
import { useFolders, useCreateFolder } from '@/hooks/useFolders';
import { FolderItem } from './FolderItem';
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
  const { data: trashedPrompts = [] } = useTrashedPrompts();
  const { data: folders = [] } = useFolders();
  const createFolder = useCreateFolder();
  
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      await createFolder.mutateAsync({ name: newFolderName.trim() });
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  const handleCancelCreate = () => {
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateFolder();
    } else if (e.key === 'Escape') {
      handleCancelCreate();
    }
  };


  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <aside className={cn("w-64 bg-card border-r border-border h-screen flex flex-col sidebar-transition", className)}>
      {/* Top Section - Fixed */}
      <div className="flex-shrink-0 p-6 space-y-6">
        {/* Quick Actions */}
        <div className="space-y-3">
          <Button
            data-testid="button-new-prompt"
            onClick={onCreatePrompt}
            className="w-full py-2.5 px-4 rounded-lg font-medium hover-bg-consistent flex items-center justify-center space-x-2"
            variant="outline"
          >
            <Plus className="w-4 h-4" />
            <span>New Prompt</span>
          </Button>
          <Button
            data-testid="button-import"
            onClick={onImport}
            variant="outline"
            className="w-full border border-border py-2.5 px-4 rounded-lg font-medium hover-bg-consistent transition-colors flex items-center justify-center space-x-2"
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
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover-bg-consistent",
                location === '/dashboard' 
                  ? "bg-muted text-foreground" 
                  : "text-muted-foreground"
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
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover-bg-consistent",
                location === '/dashboard/favorites'
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
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
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover-bg-consistent",
                location === '/dashboard/recent'
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Clock className="w-4 h-4" />
              <span>Recent</span>
            </div>
          </Link>
          
          <Link href="/dashboard/trash" className="block">
            <div
              data-testid="link-trash"
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover-bg-consistent",
                location === '/dashboard/trash'
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Trash2 className="w-4 h-4" />
              <span>Trash</span>
              <Badge variant="secondary" className="ml-auto text-xs px-2 py-1 rounded-full">
                {trashedPrompts.length}
              </Badge>
            </div>
          </Link>
          
          <Link href="/dashboard/templates" className="block">
            <div
              data-testid="link-templates"
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover-bg-consistent",
                location === '/dashboard/templates'
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <File className="w-4 h-4" />
              <span>Templates</span>
            </div>
          </Link>
        </nav>
      </div>

      {/* Middle Section - Scrollable Folders */}
      <div className="flex-1 overflow-hidden px-6">
        <div className="space-y-2 h-full">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Folders
          </div>
          <div className="space-y-1 overflow-y-auto h-full">
            {folders.map((folder) => {
              // Count prompts in this folder
              const promptCount = allPrompts.filter(p => p.folderId === folder.id).length;
              return (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  promptCount={promptCount}
                />
              );
            })}
            {isCreatingFolder ? (
              <div className="flex items-center space-x-2 px-3 py-2">
                <Folder className="w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="input-new-folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Folder name"
                  className="h-6 text-xs border-none bg-transparent p-0 focus-visible:ring-0"
                  autoFocus
                />
                <Button
                  data-testid="button-save-folder"
                  size="sm"
                  variant="ghost"
                  onClick={handleCreateFolder}
                  disabled={createFolder.isPending || !newFolderName.trim()}
                  className="h-6 w-6 p-1"
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  data-testid="button-cancel-folder"
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelCreate}
                  className="h-6 w-6 p-1"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button
                data-testid="button-new-folder"
                variant="ghost"
                className="w-full justify-start space-x-2 px-3 py-2 h-auto text-xs text-muted-foreground hover-bg-consistent"
                onClick={() => setIsCreatingFolder(true)}
              >
                <Plus className="w-4 h-4" />
                <span>New Folder</span>
              </Button>
            )}
            {folders.length === 0 && (
              <div className="text-xs text-muted-foreground px-3 py-2">
                No folders yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section - Fixed */}
      <div className="flex-shrink-0 p-6 space-y-6">
        {/* User Actions */}
        <div className="border-t border-border pt-6 space-y-2">
          <Button
            data-testid="button-theme-toggle"
            variant="ghost"
            onClick={toggleTheme}
            className="w-full justify-start space-x-3 hover-bg-consistent"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </Button>
          
          <Button
            data-testid="button-settings"
            variant="ghost"
            className="w-full justify-start space-x-3 hover-bg-consistent"
            asChild
          >
            <Link to="/settings">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Link>
          </Button>
          
          <Button
            data-testid="button-logout"
            variant="ghost"
            onClick={logout}
            className="w-full justify-start space-x-3 text-destructive hover-bg-consistent"
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
