import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Template, TemplateVariable, insertTemplateSchema, insertTemplateVariableSchema } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Template with variables type for UI components
export type TemplateWithVariables = Template & {
  variables: TemplateVariable[];
};

// Template creation data type
export type CreateTemplateData = {
  title: string;
  description?: string;
  content: string;
  category: string;
  tags: string[];
  variables: Array<{
    variableName: string;
    variableType: 'text' | 'number' | 'dropdown' | 'date' | 'boolean';
    description?: string;
    required: boolean;
    defaultValue?: string;
    options?: string[];
    min?: number;
    max?: number;
  }>;
};

// Template instantiation data type
export type InstantiateTemplateData = {
  templateId: string;
  variableValues: Record<string, any>;
  targetFolder?: string;
  title?: string;
};

// Get all templates
export function useTemplates() {
  return useQuery<TemplateWithVariables[]>({
    queryKey: ['/api/templates'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get a single template by ID
export function useTemplate(templateId: string | null) {
  return useQuery<TemplateWithVariables>({
    queryKey: ['/api/templates', templateId],
    enabled: !!templateId,
  });
}

// Create a new template
export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateTemplateData) => {
      const res = await apiRequest('POST', '/api/templates', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({
        title: "Template created",
        description: "Your template has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Error creating template:', error);
      toast({
        variant: "destructive",
        title: "Failed to create template",
        description: error.message || "Could not create the template. Please try again.",
      });
    },
  });
}

// Update a template
export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateTemplateData>) => {
      const res = await apiRequest('PATCH', `/api/templates/${id}`, data);
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/templates', id] });
      toast({
        title: "Template updated",
        description: "Your template has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Error updating template:', error);
      toast({
        variant: "destructive",
        title: "Failed to update template",
        description: error.message || "Could not update the template. Please try again.",
      });
    },
  });
}

// Delete a template
export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiRequest('DELETE', `/api/templates/${templateId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({
        title: "Template deleted",
        description: "The template has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting template:', error);
      toast({
        variant: "destructive",
        title: "Failed to delete template",
        description: error.message || "Could not delete the template. Please try again.",
      });
    },
  });
}

// Instantiate a template (create a prompt from a template)
export function useInstantiateTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InstantiateTemplateData) => {
      const res = await apiRequest('POST', '/api/templates/instantiate', data);
      return res.json();
    },
    onSuccess: () => {
      // Invalidate prompts queries since a new prompt was created
      queryClient.invalidateQueries({ queryKey: ['/api/prompts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prompts/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prompts/favorites'] });
      
      // Also invalidate template usage for analytics
      queryClient.invalidateQueries({ queryKey: ['/api/templates', 'usage'] });
      
      toast({
        title: "Prompt created from template",
        description: "Your new prompt has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Error instantiating template:', error);
      toast({
        variant: "destructive",
        title: "Failed to create prompt",
        description: error.message || "Could not create a prompt from the template. Please try again.",
      });
    },
  });
}

// Get template usage history
export function useTemplateUsage(templateId: string | null) {
  return useQuery({
    queryKey: ['/api/templates', templateId, 'usage'],
    enabled: !!templateId,
  });
}