import { ReactNode, useState } from 'react';
import { Menu } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  searchEnabled?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  onCreatePrompt?: () => void;
  onImport?: () => void;
}

/**
 * Shared dashboard layout component that ensures consistent header and sidebar
 * styling across all pages (Dashboard, Folders, Templates).
 * 
 * Extracted from the working Dashboard component to prevent CSS drift
 * and ensure identical positioning and responsive behavior.
 */
export function DashboardLayout({
  children,
  searchEnabled = true,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = "Search...",
  onCreatePrompt,
  onImport
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Default handlers if not provided
  const handleCreatePrompt = onCreatePrompt || (() => {
    window.location.href = '/dashboard';
  });

  const handleImport = onImport || (() => {
    // Handle import functionality
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header - EXACT same as Dashboard */}
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              data-testid="button-sidebar-toggle"
              variant="ghost"
              size="sm"
              className="lg:hidden p-2"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L3.09 8.26L12 14L20.91 8.26L12 2Z"/>
                  <path d="M3.09 15.74L12 22L20.91 15.74L12 9.48L3.09 15.74Z"/>
                </svg>
              </div>
              <h1 className="text-xl font-bold text-foreground">PromptLockr</h1>
            </div>
          </div>

          {/* Header Actions - Search Bar and User Menu - EXACT same as Dashboard */}
          <div className="flex items-center space-x-4">
            {/* Search Bar - Now on right side - EXACT same as Dashboard */}
            {searchEnabled && onSearchChange && (
              <div className="relative w-80">
                <SearchBar
                  onSearch={onSearchChange}
                  placeholder={searchPlaceholder}
                  className="w-full"
                />
              </div>
            )}
            
            {/* User Menu - EXACT same as Dashboard */}
            <Link to="/settings" className="cursor-pointer">
              <div 
                data-testid="link-profile-settings"
                className="w-8 h-8 bg-primary rounded-full flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <span className="text-sm font-medium text-primary-foreground">U</span>
              </div>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - EXACT same positioning as Dashboard with CORRECT CSS classes */}
        <Sidebar
          onCreatePrompt={handleCreatePrompt}
          onImport={handleImport}
          className={cn(
            // CRITICAL: Use lg:sticky lg:top-[73px] NOT lg:relative - this fixes the styling issue
            "lg:translate-x-0 fixed lg:sticky lg:top-[73px] z-30",
            isMobile && sidebarOpen ? "translate-x-0" : isMobile ? "-translate-x-full" : ""
          )}
        />

        {/* Mobile Sidebar Overlay - EXACT same as Dashboard */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content - EXACT same structure as Dashboard */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}