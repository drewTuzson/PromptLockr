import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { AuthService } from '@/lib/auth';
import { Folder, CreateFolder } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

export function useFolders() {
  return useQuery<Folder[]>({
    queryKey: ['/api/folders'],
    queryFn: async () => {
      const res = await fetch('/api/folders', {
        headers: AuthService.getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error('Failed to fetch folders');
      }
      return res.json();
    },
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateFolder) => {
      const res = await apiRequest('POST', '/api/folders', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
      toast({
        title: "Folder created",
        description: "Your folder has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to create folder",
        description: error.message,
      });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Folder>) => {
      const res = await apiRequest('PUT', `/api/folders/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
      toast({
        title: "Folder updated",
        description: "Your folder has been renamed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update folder",
        description: error.message,
      });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/folders/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
      toast({
        title: "Folder deleted",
        description: "The folder has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete folder",
        description: error.message,
      });
    },
  });
}