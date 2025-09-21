import { useState } from 'react';
import { Menu, Filter, Download, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { PromptCard } from '@/components/dashboard/PromptCard';
import { CreatePromptModal } from '@/components/dashboard/CreatePromptModal';
import { RequireAuth } from '@/components/auth/AuthProvider';
import { usePrompts } from '@/hooks/usePrompts';
import { useIsMobile } from '@/hooks/use-mobile';
import { Prompt } from '@shared/schema';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  
  const isMobile = useIsMobile();
  const { data: prompts = [], isLoading } = usePrompts(searchQuery);

  const handleCreatePrompt = () => {
    setEditingPrompt(undefined);
    setCreateModalOpen(true);
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setCreateModalOpen(true);
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/export', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('promptlockr_token')}`,
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'promptlockr-export.json';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const content = await file.text();
          const response = await fetch('/api/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('promptlockr_token')}`,
            },
            body: JSON.stringify({ data: content }),
          });
          
          if (response.ok) {
            window.location.reload();
          }
        } catch (error) {
          console.error('Import failed:', error);
        }
      }
    };
    input.click();
  };

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        {/* Navigation Header */}
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

            {/* Search Bar */}
            <div className="flex-1 max-w-2xl mx-8 hidden md:block">
              <SearchBar onSearch={setSearchQuery} />
            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-foreground">U</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <Sidebar
            onCreatePrompt={handleCreatePrompt}
            onImport={handleImport}
            className={cn(
              "lg:translate-x-0 fixed lg:relative z-30",
              isMobile && sidebarOpen ? "translate-x-0" : isMobile ? "-translate-x-full" : ""
            )}
          />

          {/* Mobile Sidebar Overlay */}
          {isMobile && sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main Content */}
          <main className="flex-1 p-6 lg:p-8">
            {/* Content Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">All Prompts</h2>
                <p className="text-muted-foreground mt-1">Manage and organize your AI prompts</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  data-testid="button-filter"
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <Filter className="w-4 h-4" />
                  <span>Filter</span>
                </Button>
                <Button
                  data-testid="button-export"
                  variant="outline"
                  onClick={handleExport}
                  className="flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </Button>
              </div>
            </div>

            {/* Search Bar (Mobile) */}
            <div className="md:hidden mb-6">
              <SearchBar 
                onSearch={setSearchQuery}
                placeholder="Search prompts..."
              />
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && prompts.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No prompts found</h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery ? 'Try adjusting your search terms.' : 'Get started by creating your first prompt.'}
                </p>
                <Button
                  data-testid="button-create-first-prompt"
                  onClick={handleCreatePrompt}
                  className="flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Your First Prompt</span>
                </Button>
              </div>
            )}

            {/* Prompts Grid */}
            {!isLoading && prompts.length > 0 && (
              <>
                <div 
                  data-testid="prompts-grid"
                  className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
                >
                  {prompts.map((prompt) => (
                    <PromptCard
                      key={prompt.id}
                      prompt={prompt}
                      onEdit={handleEditPrompt}
                    />
                  ))}
                </div>

                {/* Load More Button */}
                {prompts.length >= 50 && (
                  <div className="flex justify-center mt-8">
                    <Button
                      data-testid="button-load-more"
                      variant="outline"
                      className="flex items-center space-x-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Load More Prompts</span>
                    </Button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Create Prompt Modal */}
      <CreatePromptModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        editingPrompt={editingPrompt}
      />
    </RequireAuth>
  );
}
