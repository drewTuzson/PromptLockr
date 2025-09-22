import { useTrashedPrompts, useRestorePrompt, usePermanentlyDeletePrompt } from '@/hooks/usePrompts';
import { PromptCard } from '@/components/dashboard/PromptCard';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trash2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
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

export default function TrashPage() {
  const { data: trashedPrompts = [], isLoading, error, refetch } = useTrashedPrompts();
  const restorePrompt = useRestorePrompt();
  const permanentlyDeletePrompt = usePermanentlyDeletePrompt();
  
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);

  const handleRestore = async (promptId: string) => {
    try {
      await restorePrompt.mutateAsync(promptId);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handlePermanentDelete = async (promptId: string) => {
    try {
      await permanentlyDeletePrompt.mutateAsync(promptId);
      setPromptToDelete(null);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Trash</h1>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="text-muted-foreground">Loading trashed prompts...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Trash</h1>
        </div>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="text-destructive">Failed to load trashed prompts</div>
          <Button onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trash</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {trashedPrompts.length} {trashedPrompts.length === 1 ? 'prompt' : 'prompts'} in trash
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
          data-testid="button-refresh-trash"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {trashedPrompts.length === 0 ? (
        <div className="text-center py-12">
          <Trash2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Trash is empty</h3>
          <p className="text-sm text-muted-foreground">
            Deleted prompts will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {trashedPrompts.map((prompt) => (
            <div key={prompt.id} className="relative group">
              <PromptCard
                prompt={prompt}
                onEdit={() => {}} // Disabled for trashed prompts
              />
              
              {/* Trash-specific actions overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center space-x-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleRestore(prompt.id)}
                  disabled={restorePrompt.isPending}
                  data-testid={`button-restore-${prompt.id}`}
                  className="bg-primary text-primary-foreground hover-bg-consistent"
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
          ))}
        </div>
      )}

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
              onClick={() => promptToDelete && handlePermanentDelete(promptToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}