import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PromptFilters } from '../types/filters';

interface FilteredPromptsResponse {
  prompts: any[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  filters: PromptFilters;
}

export function useFilteredPrompts(filters: PromptFilters) {
  const queryClient = useQueryClient();
  
  // Build query parameters
  const buildQueryString = (filters: PromptFilters): string => {
    const params = new URLSearchParams();
    
    if (filters.search) params.set('search', filters.search);
    if (filters.platforms?.length) params.set('platforms', filters.platforms.join(','));
    if (filters.tags?.length) params.set('tags', filters.tags.join(','));
    if (filters.folders?.length) params.set('folders', filters.folders.join(','));
    
    if (filters.dateCreated?.start) {
      const startDate = filters.dateCreated.start instanceof Date 
        ? filters.dateCreated.start 
        : new Date(filters.dateCreated.start);
      params.set('dateCreatedStart', startDate.toISOString());
    }
    if (filters.dateCreated?.end) {
      const endDate = filters.dateCreated.end instanceof Date 
        ? filters.dateCreated.end 
        : new Date(filters.dateCreated.end);
      params.set('dateCreatedEnd', endDate.toISOString());
    }
    
    if (filters.dateModified?.start) {
      const startDate = filters.dateModified.start instanceof Date 
        ? filters.dateModified.start 
        : new Date(filters.dateModified.start);
      params.set('dateModifiedStart', startDate.toISOString());
    }
    if (filters.dateModified?.end) {
      const endDate = filters.dateModified.end instanceof Date 
        ? filters.dateModified.end 
        : new Date(filters.dateModified.end);
      params.set('dateModifiedEnd', endDate.toISOString());
    }
    
    if (filters.lastUsed?.start) {
      const startDate = filters.lastUsed.start instanceof Date 
        ? filters.lastUsed.start 
        : new Date(filters.lastUsed.start);
      params.set('lastUsedStart', startDate.toISOString());
    }
    if (filters.lastUsed?.end) {
      const endDate = filters.lastUsed.end instanceof Date 
        ? filters.lastUsed.end 
        : new Date(filters.lastUsed.end);
      params.set('lastUsedEnd', endDate.toISOString());
    }
    
    if (filters.favoritesOnly) params.set('favoritesOnly', 'true');
    if (filters.recentOnly) params.set('recentOnly', 'true');
    if (filters.enhanced) params.set('enhanced', 'true');
    if (filters.trashedOnly) params.set('trashedOnly', 'true');
    
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
    if (filters.limit) params.set('limit', filters.limit.toString());
    if (filters.offset) params.set('offset', filters.offset.toString());
    
    return params.toString();
  };

  // Create query key for caching
  const queryKey = ['prompts', 'filtered', filters];

  return useQuery<FilteredPromptsResponse | any[]>({
    queryKey,
    queryFn: async () => {
      const queryString = buildQueryString(filters);
      const url = `/api/prompts${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized');
        }
        throw new Error('Failed to fetch prompts');
      }

      const data = await response.json();
      
      // Handle both response formats (advanced filtering vs basic)
      if (Array.isArray(data)) {
        // Legacy response format
        return data;
      } else {
        // Advanced filtering response format
        return data as FilteredPromptsResponse;
      }
    },
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Helper hook for invalidating filtered prompts cache
export function useInvalidateFilteredPrompts() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['prompts', 'filtered'] });
  };
}