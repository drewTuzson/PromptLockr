import { Link, useLocation } from 'wouter';
import { 
  Plus, 
  Upload, 
  Briefcase, 
  Heart, 
  Trash2, 
  Folder, 
  Sun,
  Moon,
  Settings,
  LogOut,
  File
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/ui/theme-provider';
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


  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <aside className={cn("w-64 bg-card border-r border-border h-[calc(100vh-73px)] lg:sticky lg:top-[73px] flex flex-col sidebar-transition", className)}>
      {/* Top Section - Navigation */}
      <div className="flex-1 p-6 space-y-6">
        {/* Quick Actions */}
        <div className="space-y-3">
          <Button
            data-testid="button-new-prompt"
            onClick={onCreatePrompt}
            className="w-full py-2.5 px-4 rounded-lg font-medium flex items-center justify-center space-x-2"
            variant="default"
          >
            <Plus className="w-4 h-4" />
            <span>New Prompt</span>
          </Button>
          <Button
            data-testid="button-import"
            onClick={onImport}
            variant="default"
            className="w-full py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
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
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)]",
                location === '/dashboard' 
                  ? "bg-muted text-foreground" 
                  : "text-muted-foreground"
              )}
            >
              <Briefcase className="w-4 h-4" />
              <span className="font-medium">All Prompts</span>
            </div>
          </Link>
          
          <Link href="/dashboard/favorites" className="block">
            <div
              data-testid="link-favorites"
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)]",
                location === '/dashboard/favorites'
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Heart className="w-4 h-4" />
              <span>Favorites</span>
            </div>
          </Link>
          
          <Link href="/dashboard/folders" className="block">
            <div
              data-testid="link-folders"
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)]",
                location === '/dashboard/folders'
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Folder className="w-4 h-4" />
              <span>Folders</span>
            </div>
          </Link>
          
          <Link href="/dashboard/templates" className="block">
            <div
              data-testid="link-templates"
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)]",
                location === '/dashboard/templates'
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <File className="w-4 h-4" />
              <span>Templates</span>
            </div>
          </Link>
          
          <Link href="/dashboard/trash" className="block">
            <div
              data-testid="link-trash"
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)]",
                location === '/dashboard/trash'
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Trash2 className="w-4 h-4" />
              <span>Trash</span>
            </div>
          </Link>
        </nav>
      </div>


      {/* Bottom Section - Fixed */}
      <div className="flex-shrink-0 p-6 space-y-6">
        {/* User Actions */}
        <div className="border-t border-border pt-6 space-y-2">
          <Button
            data-testid="button-theme-toggle"
            variant="outline"
            onClick={toggleTheme}
            className="w-full justify-start space-x-3 border-0"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </Button>
          
          <Button
            data-testid="button-settings"
            variant="outline"
            className="w-full justify-start space-x-3 border-0"
            asChild
          >
            <Link to="/settings">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Link>
          </Button>
          
          <Button
            data-testid="button-logout"
            variant="logout"
            onClick={logout}
            className="w-full justify-start space-x-3"
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
