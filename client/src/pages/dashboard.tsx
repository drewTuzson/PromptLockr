import { useState } from 'react';
import { Menu, Download, RotateCcw, ArrowLeft, Trash2, Grid3X3, List, Edit, ChevronDown, ArrowUpAZ, ArrowDownAZ, Clock, Star } from 'lucide-react';
import { useRoute, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { PromptCard } from '@/components/dashboard/PromptCard';
import { CreatePromptModal } from '@/components/dashboard/CreatePromptModal';
import { PromptDetailModal } from '@/components/dashboard/PromptDetailModal';
import { TemplateCard, CreateTemplateModal, TemplateDetailModal, TemplateInstantiationModal } from '@/components/templates';
import { FilterDrawer } from '@/components/filters/FilterDrawer';
import { SearchBar } from '@/components/dashboard/SearchBar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RequireAuth } from '@/components/auth/AuthProvider';
import { usePrompts, useFavoritePrompts, useTrashedPrompts, useRestorePrompt, usePermanentlyDeletePrompt } from '@/hooks/usePrompts';
import { useFolders } from '@/hooks/useFolders';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFilteredPrompts } from '@/hooks/useFilteredPrompts';
import { useTemplates, useDeleteTemplate, useInstantiateTemplate, TemplateWithVariables } from '@/hooks/useTemplates';
import { Prompt, Folder } from '@shared/schema';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PromptFilters } from '@/types/filters';

// Platform classes for badge styling
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

export default function Dashboard() {
  // Check for folder route first, then fall back to view route
  const [folderMatch, folderParams] = useRoute('/dashboard/folder/:folderId');
  const [viewMatch, viewParams] = useRoute('/dashboard/:view?');
  
  const view = folderMatch ? 'folder' : (viewParams?.view || 'all');
  const folderId = folderParams?.folderId;
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [detailPrompt, setDetailPrompt] = useState<Prompt | null>(null);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [advancedFilters, setAdvancedFilters] = useState<PromptFilters>({});
  const [useAdvancedFiltering, setUseAdvancedFiltering] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  
  const isMobile = useIsMobile();
  
  // Sort options configuration
  const sortOptions = [
    { value: 'recent', label: 'Most Recent', icon: <Clock className="w-4 h-4" /> },
    { value: 'oldest', label: 'Oldest First', icon: <Clock className="w-4 h-4" /> },
    { value: 'a-z', label: 'A to Z', icon: <ArrowUpAZ className="w-4 h-4" /> },
    { value: 'z-a', label: 'Z to A', icon: <ArrowDownAZ className="w-4 h-4" /> },
    { value: 'favorites', label: 'Most Favorited', icon: <Star className="w-4 h-4" /> },
  ];
  
  // Function to sort prompts
  const sortPrompts = (prompts: Prompt[]) => {
    const sortedPrompts = [...prompts];
    switch (sortBy) {
      case 'recent':
        return sortedPrompts.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      case 'oldest':
        return sortedPrompts.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      case 'a-z':
        return sortedPrompts.sort((a, b) => a.title.localeCompare(b.title));
      case 'z-a':
        return sortedPrompts.sort((a, b) => b.title.localeCompare(a.title));
      case 'favorites':
        return sortedPrompts.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
      default:
        return sortedPrompts;
    }
  };
  
  // Fetch data based on current view and filtering method
  const { data: filteredData, isLoading: filteredLoading } = useFilteredPrompts(advancedFilters);
  const { data: allPrompts = [], isLoading: allLoading } = usePrompts(searchQuery);
  const { data: favoritePrompts = [], isLoading: favoritesLoading } = useFavoritePrompts();
  const { data: trashedPrompts = [], isLoading: trashedLoading } = useTrashedPrompts();
  const { data: folders = [] } = useFolders();
  const { data: templates = [], isLoading: templatesLoading } = useTemplates();
  
  // Trash actions
  const restorePrompt = useRestorePrompt();
  const permanentlyDeletePrompt = usePermanentlyDeletePrompt();
  const deleteTemplate = useDeleteTemplate();
  const instantiateTemplate = useInstantiateTemplate();
  
  // Template-related state
  const [createTemplateModalOpen, setCreateTemplateModalOpen] = useState(false);
  const [detailTemplate, setDetailTemplate] = useState<TemplateWithVariables | null>(null);
  const [instantiatingTemplate, setInstantiatingTemplate] = useState<TemplateWithVariables | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithVariables | undefined>();
  
  // Determine which prompts to show based on view and filtering method
  let sourcePrompts: Prompt[] = [];
  let isLoading = false;

  if (useAdvancedFiltering && filteredData) {
    // Use advanced filtering results
    if (Array.isArray(filteredData)) {
      sourcePrompts = filteredData;
    } else {
      sourcePrompts = filteredData.prompts || [];
    }
    isLoading = filteredLoading;
  } else {
    // Use basic view-based fetching
    switch (view) {
      case 'favorites':
        sourcePrompts = favoritePrompts;
        isLoading = favoritesLoading;
        break;
      case 'trash':
        sourcePrompts = trashedPrompts;
        isLoading = trashedLoading;
        break;
      case 'folder':
        // Filter prompts by the specified folder
        sourcePrompts = allPrompts.filter(p => p.folderId === folderId);
        isLoading = allLoading;
        break;
      case 'templates':
        // Templates view - will be handled differently in rendering
        sourcePrompts = [];
        isLoading = templatesLoading;
        break;
      default:
        sourcePrompts = allPrompts;
        isLoading = allLoading;
    }
  }
  
  // Apply sorting to prompts
  const prompts = sortPrompts(sourcePrompts);

  // Handle advanced filter changes
  const handleAdvancedFiltersChange = (filters: PromptFilters) => {
    // Preserve folder scope when filtering
    const filtersWithFolderScope = view === 'folder' && folderId 
      ? { ...filters, folders: [folderId] }
      : filters;
      
    setAdvancedFilters(filtersWithFolderScope);
    // Enable advanced filtering if any filters are applied
    const hasFilters = !!(
      filtersWithFolderScope.search ||
      filtersWithFolderScope.platforms?.length ||
      filtersWithFolderScope.tags?.length ||
      filtersWithFolderScope.folders?.length ||
      filtersWithFolderScope.favoritesOnly ||
      filtersWithFolderScope.recentOnly ||
      filtersWithFolderScope.dateCreated ||
      filtersWithFolderScope.dateModified ||
      filtersWithFolderScope.lastUsed
    );
    setUseAdvancedFiltering(hasFilters);
    
    // Sync search query with filter search
    if (filtersWithFolderScope.search !== undefined) {
      setSearchQuery(filtersWithFolderScope.search || '');
    }
  };

  
  // Get current folder name if in folder view
  const currentFolder = folderId ? folders.find(f => f.id === folderId) : null;
  
  // Get page title based on view
  const getPageTitle = () => {
    switch (view) {
      case 'favorites':
        return 'Favorites';
      case 'trash':
        return 'Trash';
      case 'folder':
        return currentFolder ? `Folder: ${currentFolder.name}` : 'Folder';
      default:
        return 'All Prompts';
    }
  };
  
  const getPageDescription = () => {
    switch (view) {
      case 'favorites':
        return 'Your favorited prompts';
      case 'trash':
        return 'Deleted prompts that can be restored or permanently removed';
      case 'folder':
        return currentFolder ? `Prompts in "${currentFolder.name}"` : 'Folder prompts';
      default:
        return 'Manage and organize your AI prompts';
    }
  };

  const handleCreatePrompt = () => {
    setEditingPrompt(undefined);
    setCreateModalOpen(true);
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setCreateModalOpen(true);
  };

  const handleRestorePrompt = async (promptId: string) => {
    try {
      await restorePrompt.mutateAsync(promptId);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handlePermanentDeletePrompt = async (promptId: string) => {
    try {
      await permanentlyDeletePrompt.mutateAsync(promptId);
      setPromptToDelete(null);
    } catch (error) {
      // Error handling is done in the hook
    }
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
                variant="outline"
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

            {/* Header Actions - Search Bar and User Menu */}
            <div className="flex items-center space-x-4">
              {/* Search Bar - Now on right side */}
              {view !== 'templates' && (
                <div className="relative w-80">
                  <SearchBar
                    onSearch={setSearchQuery}
                    placeholder="Search prompts, tags, or content..."
                    className="w-full"
                  />
                </div>
              )}
              
              {/* User Menu */}
              <Link to="/settings" className="cursor-pointer">
                <div 
                  data-testid="link-profile-settings"
                  className="w-8 h-8 bg-primary rounded-full flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  {/* TODO: Post-MVP - Add profile photo upload functionality to replace text initial */}
                  <span className="text-sm font-medium text-primary-foreground">U</span>
                </div>
              </Link>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar - Fixed/Sticky */}
          <Sidebar
            onCreatePrompt={handleCreatePrompt}
            onImport={handleImport}
            className={cn(
              "lg:translate-x-0 fixed lg:sticky lg:top-[73px] z-30",
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
          <main className="flex-1 p-6 lg:p-8 overflow-y-auto">

            {/* Content Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                {view === 'folder' && (
                  <Button
                    data-testid="button-back-to-all-prompts"
                    variant="outline"
                    asChild
                    className="flex items-center space-x-2"
                  >
                    <Link to="/dashboard">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to All Prompts</span>
                    </Link>
                  </Button>
                )}
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{getPageTitle()}</h2>
                  <p className="text-muted-foreground mt-1">{getPageDescription()}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                
                {/* Sort Dropdown - Only show for prompt views */}
                {view !== 'templates' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2"
                        data-testid="button-sort"
                      >
                        <ArrowUpAZ className="w-4 h-4" />
                        Sort
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {sortOptions.map(option => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => setSortBy(option.value)}
                          className={cn(
                            "dropdown-menu-item cursor-pointer",
                            sortBy === option.value && "bg-[var(--btn-active-bg)] text-[var(--btn-active-fg)] font-medium"
                          )}
                          data-testid={`sort-option-${option.value}`}
                        >
                          {option.icon}
                          <span className="ml-2">{option.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                
                {/* Filter Button - Only show for prompt views */}
                {view !== 'templates' && (
                  <FilterDrawer
                    filters={advancedFilters}
                    onFiltersChange={handleAdvancedFiltersChange}
                    className="hover:bg-[#f0f5f7] transition-colors"
                  />
                )}
                
                {/* View Mode Toggle */}
                <div className="flex items-center border rounded-lg">
                  <Button
                    data-testid="button-view-card"
                    variant={viewMode === 'card' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('card')}
                    className="rounded-r-none"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button
                    data-testid="button-view-list"
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-l-none border-l"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
                
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

            {/* Filter Drawer (Mobile) - Only show for prompt views */}
            {view !== 'templates' && (
              <div className="md:hidden mb-6 flex justify-center">
                <FilterDrawer
                  filters={advancedFilters}
                  onFiltersChange={handleAdvancedFiltersChange}
                  className="w-full max-w-sm"
                />
              </div>
            )}

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
                  {searchQuery ? 'Try adjusting your search terms.' : 
                   view === 'favorites' ? 'No favorites yet. Start by favoriting some prompts!' :
                   view === 'trash' ? 'Trash is empty.' :
                   'Get started by creating your first prompt.'}
                </p>
                {/* Only show create button for main views, not for trash or favorites */}
                {!searchQuery && view !== 'favorites' && view !== 'trash' && (
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
                )}
              </div>
            )}

            {/* Templates Display */}
            {view === 'templates' && !isLoading && templates.length > 0 && (
              <>
                {viewMode === 'card' ? (
                  <div 
                    data-testid="templates-grid"
                    className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
                  >
                    {templates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onView={setDetailTemplate}
                        onEdit={setEditingTemplate}
                        onDelete={(templateId) => deleteTemplate.mutate(templateId)}
                        onInstantiate={setInstantiatingTemplate}
                        onViewUsage={(templateId) => {
                          // TODO: Implement usage viewing
                          console.log('View usage for template:', templateId);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  // List View for templates
                  <div 
                    data-testid="templates-list" 
                    className="space-y-2"
                  >
                    {templates.map((template) => (
                      <div 
                        key={template.id} 
                        className="flex items-center justify-between p-4 bg-card border rounded-lg hover:shadow-sm transition-shadow cursor-pointer group"
                        onClick={() => setDetailTemplate(template)}
                        data-testid={`list-item-template-${template.id}`}
                      >
                        <div className="flex items-center space-x-4 flex-1 min-w-0">
                          <Badge 
                            className="text-xs px-2.5 py-1 rounded-full font-medium bg-accent text-accent-foreground"
                          >
                            Template
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate" data-testid="text-template-title">
                              {template.title}
                            </h3>
                            {template.description && (
                              <p className="text-sm text-muted-foreground truncate">
                                {template.description}
                              </p>
                            )}
                          </div>
                          {/* Template Variables Count */}
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            <Badge variant="outline" className="text-xs">
                              {template.variables?.length || 0} variables
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground flex-shrink-0">
                            {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'No date'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Empty state for templates */}
            {view === 'templates' && !isLoading && templates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No templates found</h3>
                <p className="text-muted-foreground mb-6">
                  Get started by creating your first template.
                </p>
                <Button
                  data-testid="button-create-first-template"
                  onClick={() => setCreateTemplateModalOpen(true)}
                  className="flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Your First Template</span>
                </Button>
              </div>
            )}

            {/* Prompts Display */}
            {view !== 'templates' && !isLoading && prompts.length > 0 && (
              <>
                {viewMode === 'card' ? (
                  <div 
                    data-testid="prompts-grid"
                    className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
                  >
                    {view === 'trash' ? (
                      // Render trash-specific prompt cards with restore/delete actions
                      prompts.map((prompt) => (
                        <div key={prompt.id} className="relative group">
                          <PromptCard
                            prompt={prompt}
                            onEdit={() => {}} // Disabled for trashed prompts
                            onClick={setDetailPrompt}
                          />
                          
                          {/* Trash-specific actions overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center space-x-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleRestorePrompt(prompt.id)}
                              disabled={restorePrompt.isPending}
                              data-testid={`button-restore-${prompt.id}`}
                              className="bg-primary text-primary-foreground"
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setPromptToDelete(prompt.id)}
                              disabled={permanentlyDeletePrompt.isPending}
                              data-testid={`button-permanent-delete-${prompt.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete Forever
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      // Render normal prompt cards for other views
                      prompts.map((prompt) => (
                        <PromptCard
                          key={prompt.id}
                          prompt={prompt}
                          onEdit={handleEditPrompt}
                          onClick={setDetailPrompt}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  // List View
                  <div 
                    data-testid="prompts-list" 
                    className="space-y-2"
                  >
                    {prompts.map((prompt) => (
                      <div 
                        key={prompt.id} 
                        className="flex items-center justify-between p-4 bg-card border rounded-lg hover:shadow-sm transition-shadow cursor-pointer group"
                        onClick={() => setDetailPrompt(prompt)}
                        data-testid={`list-item-prompt-${prompt.id}`}
                      >
                        <div className="flex items-center space-x-4 flex-1 min-w-0">
                          <Badge 
                            className={cn("text-xs px-2.5 py-1 rounded-full font-medium", platformClasses[prompt.platform] || platformClasses['Custom/Other'])}
                          >
                            {prompt.platform}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate" data-testid="text-prompt-title">
                              {prompt.title}
                            </h3>
                          </div>
                          {/* Tags */}
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            {prompt.tags && prompt.tags.length > 0 && prompt.tags.map((tag, index) => (
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
                          <div className="text-sm text-muted-foreground flex-shrink-0">
                            {prompt.createdAt ? new Date(prompt.createdAt).toLocaleDateString() : 'No date'}
                          </div>
                        </div>
                        
                        {view === 'trash' ? (
                          // Trash actions for list view
                          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestorePrompt(prompt.id);
                              }}
                              disabled={restorePrompt.isPending}
                              data-testid={`button-restore-list-${prompt.id}`}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPromptToDelete(prompt.id);
                              }}
                              disabled={permanentlyDeletePrompt.isPending}
                              data-testid={`button-permanent-delete-list-${prompt.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          // Normal actions for list view
                          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPrompt(prompt);
                              }}
                              data-testid={`button-edit-list-${prompt.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

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

      {/* Prompt Detail Modal */}
      <PromptDetailModal
        prompt={detailPrompt}
        isOpen={!!detailPrompt}
        onClose={() => setDetailPrompt(null)}
        onEdit={(prompt) => {
          setEditingPrompt(prompt);
          setCreateModalOpen(true);
        }}
      />

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={!!promptToDelete} onOpenChange={() => setPromptToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the prompt and remove all its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-permanent-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-permanent-delete"
              onClick={() => promptToDelete && handlePermanentDeletePrompt(promptToDelete)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template Modals */}
      <CreateTemplateModal
        isOpen={createTemplateModalOpen}
        onClose={() => {
          setCreateTemplateModalOpen(false);
          setEditingTemplate(undefined);
        }}
        onSubmit={async (templateData) => {
          // TODO: Implement template creation
          console.log('Creating template:', templateData);
          setCreateTemplateModalOpen(false);
        }}
        initialContent={editingTemplate?.content || ''}
      />

      {detailTemplate && (
        <TemplateDetailModal
          template={detailTemplate}
          isOpen={true}
          onClose={() => setDetailTemplate(null)}
        />
      )}

      {instantiatingTemplate && (
        <TemplateInstantiationModal
          isOpen={!!instantiatingTemplate}
          onClose={() => setInstantiatingTemplate(null)}
          template={instantiatingTemplate}
          onInstantiate={async (data) => {
            await instantiateTemplate.mutateAsync(data);
            setInstantiatingTemplate(null);
          }}
          folders={folders}
        />
      )}
    </RequireAuth>
  );
}
