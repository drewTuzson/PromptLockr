import { useState } from 'react';
import { 
  Folder, 
  ChevronRight, 
  MoreHorizontal, 
  Edit, 
  Trash2,
  Check,
  X 
} from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useUpdateFolder, useDeleteFolder } from '@/hooks/useFolders';
import { cn } from '@/lib/utils';
import type { Folder as FolderType } from '@shared/schema';

interface FolderItemProps {
  folder: FolderType;
  promptCount?: number;
}

export function FolderItem({ folder, promptCount = 0 }: FolderItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();

  const handleRename = async () => {
    if (!editName.trim() || editName === folder.name) {
      setIsEditing(false);
      setEditName(folder.name);
      return;
    }

    try {
      await updateFolder.mutateAsync({
        id: folder.id,
        name: editName.trim(),
      });
      setIsEditing(false);
    } catch (error) {
      setEditName(folder.name);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName(folder.name);
  };

  const handleDelete = async () => {
    try {
      await deleteFolder.mutateAsync(folder.id);
      setShowDeleteDialog(false);
    } catch (error) {
      setShowDeleteDialog(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-muted">
        <Folder className="w-4 h-4 text-muted-foreground" />
        <Input
          data-testid={`input-rename-folder-${folder.id}`}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyPress}
          className="h-6 text-sm border-none bg-transparent p-0 focus-visible:ring-0"
          autoFocus
        />
        <Button
          data-testid={`button-save-rename-${folder.id}`}
          size="sm"
          variant="ghost"
          onClick={handleRename}
          disabled={updateFolder.isPending}
          className="h-6 w-6 p-1"
        >
          <Check className="w-3 h-3" />
        </Button>
        <Button
          data-testid={`button-cancel-rename-${folder.id}`}
          size="sm"
          variant="ghost"
          onClick={handleCancelEdit}
          className="h-6 w-6 p-1"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div
        data-testid={`folder-${folder.name.toLowerCase().replace(/\s+/g, '-')}`}
        className="group flex items-center space-x-2 px-3 py-2 rounded-lg hover-bg-consistent transition-colors"
      >
        <Link 
          to={`/dashboard/folder/${folder.id}`}
          className="flex items-center space-x-2 flex-1 cursor-pointer"
        >
          <Folder className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm flex-1">{folder.name}</span>
          <span className="text-xs text-muted-foreground">{promptCount}</span>
        </Link>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-testid={`button-folder-menu-${folder.id}`}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.preventDefault()} // Prevent navigation when clicking menu
            >
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem
              data-testid={`menu-rename-folder-${folder.id}`}
              onClick={() => setIsEditing(true)}
              className="cursor-pointer"
            >
              <Edit className="w-4 h-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid={`menu-delete-folder-${folder.id}`}
              onClick={() => setShowDeleteDialog(true)}
              className="cursor-pointer text-destructive focus:text-destructive hover:!bg-destructive hover:!text-destructive-foreground focus:!bg-destructive focus:!text-destructive-foreground"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the folder "{folder.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid={`button-cancel-delete-${folder.id}`}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid={`button-confirm-delete-${folder.id}`}
              onClick={handleDelete}
              disabled={deleteFolder.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFolder.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}