import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { AuthService } from '@/lib/auth';
import { Prompt, CreatePrompt } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

export function usePrompts(searchQuery?: string) {
  return useQuery<Prompt[]>({
    queryKey: ['/api/prompts', searchQuery ? `?q=${searchQuery}` : ''],
    queryFn: async () => {
      const url = searchQuery ? `/api/prompts?q=${encodeURIComponent(searchQuery)}` : '/api/prompts';
      const res = await fetch(url, {
        headers: AuthService.getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error('Failed to fetch prompts');
      }
      return res.json();
    },
  });
}

export function useCreatePrompt() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreatePrompt) => {
      const res = await apiRequest('POST', '/api/prompts', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompts'] });
      toast({
        title: "Prompt created",
        description: "Your prompt has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to create prompt",
        description: error.message,
      });
    },
  });
}

export function useUpdatePrompt() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Prompt>) => {
      const res = await apiRequest('PUT', `/api/prompts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prompts/favorites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prompts/recent'] });
      toast({
        title: "Prompt updated",
        description: "Your changes have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update prompt",
        description: error.message,
      });
    },
  });
}

export function useDeletePrompt() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/prompts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prompts/favorites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prompts/recent'] });
      toast({
        title: "Prompt deleted",
        description: "The prompt has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete prompt",
        description: error.message,
      });
    },
  });
}

export function useFavoritePrompts() {
  return useQuery<Prompt[]>({
    queryKey: ['/api/prompts/favorites'],
    queryFn: async () => {
      const res = await fetch('/api/prompts/favorites', {
        headers: AuthService.getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error('Failed to fetch favorites');
      }
      return res.json();
    },
  });
}

export function useRecentPrompts() {
  return useQuery<Prompt[]>({
    queryKey: ['/api/prompts/recent'],
    queryFn: async () => {
      const res = await fetch('/api/prompts/recent', {
        headers: AuthService.getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error('Failed to fetch recent prompts');
      }
      return res.json();
    },
  });
}
