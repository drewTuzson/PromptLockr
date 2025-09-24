import { useState, useEffect } from 'react';
import { useTemplates, useCreateTemplate, useDeleteTemplate, useInstantiateTemplate, type TemplateWithVariables } from '@/hooks/useTemplates';
import { TemplateCard, CreateTemplateModal, TemplateDetailModal, TemplateInstantiationModal } from '@/components/templates';
import { useFolders } from '@/hooks/useFolders';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusIcon, Grid3X3, List, Menu } from 'lucide-react';
import { RequireAuth } from '@/components/auth/AuthProvider';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

export default function TemplatesPage() {
  const { data: templates = [], isLoading, refetch } = useTemplates();
  const { data: folders = [] } = useFolders();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const instantiateTemplate = useInstantiateTemplate();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [detailTemplate, setDetailTemplate] = useState<TemplateWithVariables | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithVariables | undefined>();
  const [instantiatingTemplate, setInstantiatingTemplate] = useState<TemplateWithVariables | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleTemplateCreated = async (templateData: {
    title: string;
    description: string;
    content: string;
    platform?: string;
    tags: string[];
    variables: any[];
  }) => {
    const templateToCreate = {
      ...templateData,
      platform: templateData.platform || 'ChatGPT', // Use platform instead of category
    };
    await createTemplate.mutateAsync(templateToCreate);
    setShowCreateModal(false);
    await refetch(); // Refresh the templates list
  };

  const handleTemplateDelete = async (templateId: string) => {
    await deleteTemplate.mutateAsync(templateId);
    await refetch(); // Refresh after deletion
  };

  const handleTemplateInstantiate = async (data: {
    templateId: string;
    variableValues: Record<string, any>;
    targetFolder?: string;
    title?: string;
  }) => {
    await instantiateTemplate.mutateAsync(data);
    setInstantiatingTemplate(null);
  };

  // Add handlers for consistent layout
  const handleCreatePrompt = () => {
    // Navigate to prompts page and open create modal
    window.location.href = '/dashboard?create=true';
  };

  const handleImport = () => {
    // Navigate to prompts page and open import modal  
    window.location.href = '/dashboard?import=true';
  };

  return (
    <RequireAuth>
      <div className="flex h-screen bg-background">
        {/* Navigation Header - Same as Dashboard */}
        <header className="bg-card border-b border-border shadow-sm sticky top-0 z-40 w-full lg:hidden">
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

            {/* Header Actions */}
            <div className="flex items-center space-x-3">
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

        <div className="flex flex-1">
          {/* Sidebar - Same as Dashboard */}
          <Sidebar
            onCreatePrompt={handleCreatePrompt}
            onImport={handleImport}
            className={cn(
              "lg:translate-x-0 fixed lg:relative z-30",
              sidebarOpen ? "translate-x-0" : "lg:translate-x-0 -translate-x-full"
            )}
          />

          {/* Mobile Sidebar Overlay */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 lg:hidden z-20"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            {/* Templates Header */}
            <header className="bg-card border-b border-border shadow-sm sticky top-0 z-40 hidden lg:block">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center space-x-4">
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

                {/* Header Actions */}
                <div className="flex items-center space-x-3">
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

            {/* Templates Content */}
            <div className="p-6">
              {/* Templates Header with Controls */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">
                    Templates
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Create reusable templates with variables for consistent prompts
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* View Mode Toggle */}
                  {templates.length > 0 && (
                    <div className="flex items-center border rounded-lg">
                      <Button
                        data-testid="button-view-card"
                        variant={viewMode === 'card' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('card')}
                        className="rounded-r-none"
                      >
                        <Grid3X3 className="w-4 h-4" />
                      </Button>
                      <Button
                        data-testid="button-view-list"
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className="rounded-l-none border-l"
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  
                  <Button
                    data-testid="button-create-template"
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Create Template
                  </Button>
                </div>
              </div>
          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && templates.length === 0 && (
            <div className="text-center py-16">
              <div className="inline-flex flex-col items-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <PlusIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2 text-foreground">No templates found</h3>
                <p className="text-muted-foreground mb-6 max-w-sm">
                  Templates help you create consistent prompts with customizable variables. Get started by creating your first template.
                </p>
                <Button
                  data-testid="button-create-first-template"
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  Create Your First Template
                </Button>
              </div>
            </div>
          )}

          {/* Templates Display */}
          {!isLoading && templates.length > 0 && (
            <>
              {/* Templates Count */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="px-3 py-1">
                    {templates.length} template{templates.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>

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
                      onDelete={handleTemplateDelete}
                      onInstantiate={setInstantiatingTemplate}
                      onViewUsage={(templateId) => {
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
            </div>
          </main>
        </div>

        {/* Modals */}
        <CreateTemplateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleTemplateCreated}
        />

        <TemplateDetailModal
          isOpen={!!detailTemplate}
          onClose={() => setDetailTemplate(null)}
          template={detailTemplate!}
        />

        <TemplateInstantiationModal
          isOpen={!!instantiatingTemplate}
          onClose={() => setInstantiatingTemplate(null)}
          template={instantiatingTemplate!}
          onInstantiate={handleTemplateInstantiate}
          folders={folders.map(f => ({ id: f.id, name: f.name }))}
        />
      </div>
    </RequireAuth>
  );
}