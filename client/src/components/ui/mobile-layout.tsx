import { ReactNode, useState } from 'react';
import { Menu, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

interface MobileLayoutProps {
  children: ReactNode;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
}

export function MobileLayout({ 
  children, 
  searchQuery = '', 
  onSearchChange, 
  searchPlaceholder = "Search..." 
}: MobileLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleCreatePrompt = () => {
    window.location.href = '/dashboard';
  };

  const handleImport = () => {
    // Handle import functionality
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "w-64 border-r bg-background h-screen",
        isMobile ? "hidden" : "block"
      )}>
        <Sidebar 
          onCreatePrompt={handleCreatePrompt}
          onImport={handleImport}
        />
      </aside>

      {/* Mobile Sidebar */}
      {isMobile && (
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-background border-r shadow-lg",
          "transform transition-transform duration-200 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex justify-end p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <Sidebar 
            onCreatePrompt={handleCreatePrompt}
            onImport={handleImport}
          />
        </aside>
      )}

      {/* Mobile Menu Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with Mobile Menu Toggle */}
        <header className="h-14 md:h-16 border-b bg-background px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2"
                data-testid="button-mobile-menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L3.09 8.26L12 14L20.91 8.26L12 2Z"/>
                  <path d="M3.09 15.74L12 22L20.91 15.74L12 9.48L3.09 15.74Z"/>
                </svg>
              </div>
              <h1 className="text-lg md:text-xl font-bold text-foreground">PromptLockr</h1>
            </div>
          </div>
          
          {/* Mobile-optimized search and user menu */}
          <div className="flex items-center gap-2 md:gap-4">
            {!isMobile && onSearchChange && (
              <div className="relative w-64 lg:w-80">
                <SearchBar
                  onSearch={onSearchChange}
                  placeholder={searchPlaceholder}
                  className="w-full"
                />
              </div>
            )}
            {isMobile && onSearchChange && (
              <Button variant="ghost" size="sm" className="p-2">
                <Search className="w-5 h-5" />
              </Button>
            )}
            
            {/* User Menu */}
            <Link to="/settings" className="cursor-pointer">
              <div 
                data-testid="link-profile-settings"
                className="w-8 h-8 bg-primary rounded-full flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <span className="text-sm font-medium text-primary-foreground">U</span>
              </div>
            </Link>
          </div>
        </header>

        {/* Mobile Search Bar (when search is collapsed) */}
        {isMobile && onSearchChange && (
          <div className="border-b bg-background p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-10 w-full"
                data-testid="input-mobile-search"
              />
            </div>
          </div>
        )}
        
        {/* Content */}
        {children}
      </div>
    </div>
  );
}