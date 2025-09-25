import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { 
  Plus, 
  FolderOpen, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  Grid, 
  List,
  Menu,
  Settings,
  ArrowLeft,
  MoreHorizontal,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Badge } from '@/components/ui/badge';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { RequireAuth } from '@/components/auth/AuthProvider';
import { useFolders, useCreateFolder, useUpdateFolder, useDeleteFolder } from '@/hooks/useFolders';
import { usePrompts } from '@/hooks/usePrompts';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { DashboardLayout } from '@/components/ui/dashboard-layout';
import type { Folder, Prompt } from '@shared/schema';

interface FolderCardProps {
  folder: Folder;
  viewMode: 'grid' | 'list';
  promptCount: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function FolderCard({ folder, viewMode, promptCount, onOpen, onEdit, onDelete }: FolderCardProps) {
  if (viewMode === 'grid') {
    return (
      <div className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground truncate">{folder.name}</h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="h-6 w-6 p-0"
                data-testid={`menu-folder-${folder.id}`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {promptCount} {promptCount === 1 ? 'prompt' : 'prompts'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpen}
          className="w-full"
          data-testid={`button-open-folder-${folder.id}`}
        >
          Open Folder
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center space-x-3">
        <FolderOpen className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-medium text-foreground">{folder.name}</h3>
          <p className="text-sm text-muted-foreground">
            {promptCount} {promptCount === 1 ? 'prompt' : 'prompts'}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpen}
          data-testid={`button-open-folder-${folder.id}`}
        >
          Open
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="h-8 w-8 p-0"
              data-testid={`menu-folder-${folder.id}`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit2 className="w-4 h-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface PromptCardProps {
  prompt: Prompt;
  viewMode: 'grid' | 'list';
}

function PromptCard({ prompt, viewMode }: PromptCardProps) {
  if (viewMode === 'grid') {
    return (
      <div className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium text-foreground truncate">{prompt.title}</h3>
          {prompt.isFavorite && (
            <Badge variant="secondary" className="ml-2">❤️</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {prompt.content.substring(0, 100)}...
        </p>
        <div className="flex items-center justify-between">
          <Badge variant="outline">{prompt.platform}</Badge>
          <Button variant="default" size="sm">
            View
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <h3 className="font-medium text-foreground truncate">{prompt.title}</h3>
          {prompt.isFavorite && (
            <Badge variant="secondary">❤️</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {prompt.content.substring(0, 60)}...
        </p>
        <Badge variant="outline" className="mt-1">{prompt.platform}</Badge>
      </div>
      <Button variant="default" size="sm">
        View
      </Button>
    </div>
  );
}

interface CreateFolderModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  isLoading?: boolean;
}

function CreateFolderModal({ open, onClose, onCreate, isLoading }: CreateFolderModalProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
      setName('');
    }
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="folder-name" className="text-sm font-medium">
                Folder Name
              </label>
              <Input
                id="folder-name"
                data-testid="input-folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter folder name"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isLoading}
              data-testid="button-create-folder"
            >
              {isLoading ? 'Creating...' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EditFolderModalProps {
  folder: Folder | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, name: string) => void;
  isLoading?: boolean;
}

function EditFolderModal({ folder, open, onClose, onUpdate, isLoading }: EditFolderModalProps) {
  const [name, setName] = useState(folder?.name || '');

  // Update name when folder changes
  React.useEffect(() => {
    setName(folder?.name || '');
  }, [folder?.name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && folder) {
      onUpdate(folder.id, name.trim());
    }
  };

  const handleClose = () => {
    setName(folder?.name || '');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="edit-folder-name" className="text-sm font-medium">
                Folder Name
              </label>
              <Input
                id="edit-folder-name"
                data-testid="input-edit-folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter folder name"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isLoading}
              data-testid="button-update-folder"
            >
              {isLoading ? 'Updating...' : 'Update Folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FoldersPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all folders
  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  
  // Fetch all prompts to count prompts per folder
  const { data: allPrompts = [] } = usePrompts();

  // Fetch prompts for selected folder
  const { data: folderPrompts = [], isLoading: folderPromptsLoading } = useQuery<Prompt[]>({
    queryKey: ['/api/prompts', 'folder', selectedFolder?.id],
    queryFn: async (): Promise<Prompt[]> => {
      if (!selectedFolder) return [];
      
      console.log('Fetching prompts for folder ID:', selectedFolder.id);
      
      const res = await fetch(`/api/prompts?folders=${selectedFolder.id}`, {
        headers: AuthService.getAuthHeaders()
      });
      
      if (!res.ok) {
        console.error('Failed to fetch prompts:', res.status);
        throw new Error('Failed to fetch folder prompts');
      }
      
      const result = await res.json();
      console.log('Received result:', result);
      
      // Handle both the advanced filtering response and simple response
      if (result.prompts) {
        return result.prompts;
      }
      return result;
    },
    enabled: !!selectedFolder
  });

  // Mutations
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();

  // Handlers
  const handleCreatePrompt = () => {
    // Navigate to create prompt
    window.location.href = '/dashboard';
  };

  const handleImport = () => {
    // Handle import functionality
    toast({
      title: "Import",
      description: "Import functionality will be implemented.",
    });
  };

  const handleCreateFolder = async (name: string) => {
    try {
      await createFolder.mutateAsync({ name });
      setIsCreateModalOpen(false);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  const handleUpdateFolder = async (id: string, name: string) => {
    try {
      await updateFolder.mutateAsync({ id, name });
      setEditingFolder(null);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    try {
      await deleteFolder.mutateAsync(folder.id);
      if (selectedFolder?.id === folder.id) {
        setSelectedFolder(null);
      }
      setFolderToDelete(null);
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  // Filter folders based on search
  const filteredFolders = folders.filter((folder: Folder) =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter prompts based on search
  const filteredPrompts = folderPrompts.filter((prompt: Prompt) =>
    prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prompt.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <RequireAuth>
      <DashboardLayout
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search folders or prompts..."
        onCreatePrompt={handleCreatePrompt}
        onImport={handleImport}
      >

            {/* Folders Content Header - EXACT SAME structure as Dashboard */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Folders</h2>
                <p className="text-muted-foreground mt-1">Organize your prompts into folders</p>
              </div>
              <div className="flex items-center space-x-3">
                {/* View Toggle */}
                <div className="flex rounded-lg border border-border">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-r-none"
                    data-testid="button-view-grid"
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-l-none"
                    data-testid="button-view-list"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Create Folder Button */}
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  data-testid="button-new-folder"
                  className="hover:bg-[var(--btn-active-bg)] hover:text-[var(--btn-active-fg)]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Folder
                </Button>
              </div>
            </div>

            {!selectedFolder ? (
              <div>
                {/* Folders Display */}
                {foldersLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : filteredFolders.length > 0 ? (
                  <div className={
                    viewMode === 'grid' 
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                      : 'space-y-2'
                  }>
                    {filteredFolders.map((folder) => {
                      const promptCount = allPrompts.filter(p => p.folderId === folder.id).length;
                      return (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          viewMode={viewMode}
                          promptCount={promptCount}
                          onOpen={() => setSelectedFolder(folder)}
                          onEdit={() => setEditingFolder(folder)}
                          onDelete={() => setFolderToDelete(folder)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64">
                    <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2 text-foreground">
                      {searchQuery ? 'No folders found' : 'No folders yet'}
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery 
                        ? 'Try adjusting your search terms.' 
                        : 'Create folders to organize your prompts'
                      }
                    </p>
                    {!searchQuery && (
                      <Button
                        onClick={() => setIsCreateModalOpen(true)}
                        data-testid="button-create-first-folder"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Folder
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Folder Content Header - EXACT SAME structure as Dashboard */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setSelectedFolder(null)}
                      data-testid="button-back-to-folders"
                      className="flex items-center space-x-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Folders</span>
                    </Button>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{selectedFolder.name}</h2>
                      <p className="text-muted-foreground mt-1">
                        {folderPrompts.length} {folderPrompts.length === 1 ? 'prompt' : 'prompts'} in this folder
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {/* View Toggle */}
                    <div className="flex rounded-lg border border-border">
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className="rounded-r-none"
                        data-testid="button-view-grid"
                      >
                        <Grid className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className="rounded-l-none"
                        data-testid="button-view-list"
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Folder Actions */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingFolder(selectedFolder)}
                      data-testid="button-rename-folder"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Rename
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFolderToDelete(selectedFolder)}
                      data-testid="button-delete-folder"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Prompts in folder */}
                {folderPromptsLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : filteredPrompts.length > 0 ? (
                  <div className={
                    viewMode === 'grid' 
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                      : 'space-y-2'
                  }>
                    {filteredPrompts.map((prompt) => (
                      <PromptCard key={prompt.id} prompt={prompt} viewMode={viewMode} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'No prompts found matching your search.' : 'No prompts in this folder yet'}
                  </div>
                )}
              </div>
            )}

      </DashboardLayout>

        {/* Create Folder Modal */}
        <CreateFolderModal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateFolder}
          isLoading={createFolder.isPending}
        />

        {/* Edit Folder Modal */}
        <EditFolderModal
          folder={editingFolder}
          open={!!editingFolder}
          onClose={() => setEditingFolder(null)}
          onUpdate={handleUpdateFolder}
          isLoading={updateFolder.isPending}
        />

        {/* Delete Folder Confirmation */}
        <AlertDialog
          open={!!folderToDelete}
          onOpenChange={() => setFolderToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Folder</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{folderToDelete?.name}"? 
                This action cannot be undone, but prompts in this folder will not be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => folderToDelete && handleDeleteFolder(folderToDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-folder"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </RequireAuth>
  );
}